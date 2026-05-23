"""
FastAPI 主入口
============

API 端点列表:
- POST   /api/session              创建新 session（返回 session_id）
- DELETE /api/session/{sid}        销毁 session
- POST   /api/session/{sid}/upload 上传文件（一次可传多个）
- GET    /api/session/{sid}/tables 列出当前 session 的所有表
- DELETE /api/session/{sid}/table/{name}  删除指定表
- POST   /api/session/{sid}/ask    问问题，返回 SQL + 数据 + 洞察
- POST   /api/session/{sid}/sql    直接执行 SQL（用户手动改 SQL 重跑）
- GET    /api/session/{sid}/suggestions  推荐示例问题
- GET    /api/session/{sid}/auto-insights  Augmented Analytics 自动洞察
- GET    /api/session/{sid}/history       获取历史查询
- POST   /api/session/{sid}/export/markdown  导出 Markdown 报告
- GET    /api/health               健康检查
"""

from __future__ import annotations

import os
from typing import Any

from dotenv import load_dotenv

# 加载 .env（必须在导入其他模块前）
load_dotenv()

from fastapi import FastAPI, UploadFile, File, HTTPException, Path
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field

from database import pool, add_table_from_file, execute_sql, SQLExecutionError
from llm import get_llm_client, LLMError
from analytics import (
    answer_question,
    suggest_questions,
    generate_auto_insights,
)
from dashboard import generate_dashboard
from templates import TEMPLATES, run_template, list_templates as list_templates_i18n, get_preset_questions
from pivot import PivotConfig, run_pivot


# ============================================================
# FastAPI app
# ============================================================
app = FastAPI(
    title="Text2SQL BI API",
    description="自然语言 BI 工具的后端 API",
    version="0.1.0",
)

# CORS（前端开发地址 + 部署后地址）
# FRONTEND_ORIGIN 支持逗号分隔多个 origin
frontend_origin_env = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
frontend_origins = [o.strip() for o in frontend_origin_env.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        *frontend_origins,
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# Pydantic 模型
# ============================================================
class AskRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=1000)
    use_history: bool = True
    lang: str = "en"


class SQLRequest(BaseModel):
    sql: str = Field(..., min_length=1, max_length=10000)


class ExportRequest(BaseModel):
    query_ids: list[int] | None = None
    lang: str = "en"


class CurrencyRequest(BaseModel):
    currency: str = "none"  # USD/EUR/CNY/JPY/GBP/none


# ============================================================
# 辅助函数
# ============================================================
def get_session_or_404(session_id: str):
    s = pool.get(session_id)
    if not s:
        raise HTTPException(404, f"Session {session_id} not found or expired")
    return s


def serialize_table(table) -> dict[str, Any]:
    return {
        "name": table.name,
        "original_filename": table.original_filename,
        "row_count": table.row_count,
        "columns": [
            {
                "name": c.name,
                "dtype": c.dtype,
                "null_count": c.null_count,
                "sample_values": c.sample_values,
                "min_value": c.min_value,
                "max_value": c.max_value,
                "distinct_count": c.distinct_count,
            }
            for c in table.columns
        ],
        "preview_rows": table.preview_rows,
    }


def detect_default_currency(filename: str | None) -> str:
    """根据文件名做简单的货币猜测。"""
    if not filename:
        return "none"
    f = filename.lower()
    if any(k in f for k in ("cn", "china", "中", "rmb", "cny", "yuan")):
        return "CNY"
    if any(k in f for k in ("jp", "japan", "yen", "jpy")):
        return "JPY"
    if any(k in f for k in ("eu", "europe", "eur")):
        return "EUR"
    if any(k in f for k in ("gb", "uk", "gbp", "pound")):
        return "GBP"
    return "USD"


# ============================================================
# Session 端点
# ============================================================
@app.post("/api/session")
async def create_session():
    s = pool.create()
    return {"session_id": s.session_id}


@app.delete("/api/session/{session_id}")
async def delete_session(session_id: str):
    pool.delete(session_id)
    return {"ok": True}


# ============================================================
# 表管理
# ============================================================
@app.post("/api/session/{session_id}/upload")
async def upload_files(session_id: str, files: list[UploadFile] = File(...)):
    s = get_session_or_404(session_id)
    MAX_FILE_MB = 50
    MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024
    results = []
    errors = []
    for f in files:
        try:
            content = await f.read()
            if len(content) > MAX_FILE_BYTES:
                size_mb = round(len(content) / (1024 * 1024), 1)
                errors.append({
                    "filename": f.filename,
                    "error": f"File {f.filename} is {size_mb} MB; max allowed is {MAX_FILE_MB} MB. Please split or sample your data first."
                })
                continue
            table = add_table_from_file(s, f.filename or "data", content)
            results.append(serialize_table(table))
        except Exception as e:
            errors.append({"filename": f.filename, "error": str(e)})

    # 第一次上传时自动猜测一个货币
    if results and not getattr(s, "currency", None):
        s.currency = detect_default_currency(results[0]["original_filename"])

    # User uploaded manually -> no longer in sample state
    if results:
        s.is_sample = False
        s.sample_id = None

    return {"tables": results, "errors": errors, "suggested_currency": getattr(s, "currency", "USD")}


# ============================================================
# Sample data (one-click try for new users)
# ============================================================
SAMPLES_DIR = os.path.join(os.path.dirname(__file__), "samples")

SAMPLE_REGISTRY = {
    "sales": {
        "filename": "sample_sales.csv",
        "label_en": "Sales (mixed regions)",
        "label_zh": "Sample dataset 1",
        "rows": 5455, "cols": 13,
        "currency": "USD",
    },
    "coffee": {
        "filename": "coffee_shop_sales.csv",
        "label_en": "Coffee shop chain",
        "label_zh": "Sample dataset 2",
        "rows": 3000, "cols": 11,
        "currency": "USD",
    },
    "ecommerce": {
        "filename": "ecommerce_orders.csv",
        "label_en": "E-commerce orders",
        "label_zh": "Sample dataset 3",
        "rows": 2500, "cols": 12,
        "currency": "USD",
    },
    "restaurant": {
        "filename": "restaurant_orders.csv",
        "label_en": "Restaurant orders",
        "label_zh": "Sample dataset 4",
        "rows": 1200, "cols": 12,
        "currency": "EUR",
    },
}


@app.get("/api/samples")
async def list_samples():
    """List all available sample datasets (used by welcome page)."""
    return {
        "samples": [
            {"id": k, **{key: v for key, v in info.items() if key != "filename"}}
            for k, info in SAMPLE_REGISTRY.items()
        ]
    }


@app.post("/api/session/{session_id}/load-sample/{sample_id}")
async def load_sample(session_id: str, sample_id: str):
    """Load a sample dataset into the session (like upload, but with preset CSV)."""
    s = get_session_or_404(session_id)
    info = SAMPLE_REGISTRY.get(sample_id)
    if not info:
        raise HTTPException(404, f"Unknown sample: {sample_id}")
    path = os.path.join(SAMPLES_DIR, info["filename"])
    if not os.path.exists(path):
        raise HTTPException(500, f"Sample file missing on server: {info['filename']}")
    with open(path, "rb") as f:
        content = f.read()
    try:
        table = add_table_from_file(s, info["filename"], content)
    except Exception as e:
        raise HTTPException(500, f"Failed to load sample: {e}")
    # Auto-set sample-recommended currency
    if not getattr(s, "currency", None) or s.currency == "none":
        s.currency = info.get("currency", "USD")
    # Mark session as "in sample state" (frontend uses this to show banner)
    s.is_sample = True
    s.sample_id = sample_id
    return {
        "table": serialize_table(table),
        "currency": s.currency,
        "sample_id": sample_id,
    }


@app.get("/api/session/{session_id}/tables")
async def list_tables(session_id: str):
    s = get_session_or_404(session_id)
    return {
        "tables": [serialize_table(t) for t in s.tables.values()],
        "currency": getattr(s, "currency", "none"),
        "is_sample": getattr(s, "is_sample", False),
        "sample_id": getattr(s, "sample_id", None),
    }


@app.delete("/api/session/{session_id}/table/{table_name}")
async def delete_table(session_id: str, table_name: str):
    s = get_session_or_404(session_id)
    if table_name not in s.tables:
        raise HTTPException(404, f"Table {table_name} not found")
    try:
        s.conn.execute(f'DROP TABLE IF EXISTS "{table_name}"')
    except Exception:
        pass
    s.tables.pop(table_name, None)
    return {"ok": True}


# ============================================================
# 问答 / SQL 执行
# ============================================================
@app.post("/api/session/{session_id}/ask")
async def ask(session_id: str, req: AskRequest):
    s = get_session_or_404(session_id)
    if not s.tables:
        raise HTTPException(400, "Upload data first")

    try:
        llm = get_llm_client()
    except LLMError as e:
        raise HTTPException(500, f"LLM config error: {e}")

    try:
        result = await answer_question(llm, s, req.question, lang=req.lang)
    except SQLExecutionError as e:
        raise HTTPException(400, str(e))
    except LLMError as e:
        raise HTTPException(500, f"LLM call failed: {e}")
    except Exception as e:
        raise HTTPException(500, f"Analysis failed: {e}")

    if req.use_history:
        s.chat_history.append({"role": "user", "content": req.question})
        s.chat_history.append(
            {"role": "assistant", "content": f"SQL: {result['sql']}"}
        )
        if len(s.chat_history) > 20:
            s.chat_history = s.chat_history[-20:]

    query_id = len(s.query_history)
    s.query_history.append({"id": query_id, **result})
    result["id"] = query_id

    return result


@app.post("/api/session/{session_id}/sql")
async def run_sql(session_id: str, req: SQLRequest):
    s = get_session_or_404(session_id)
    try:
        result = execute_sql(s, req.sql)
    except SQLExecutionError as e:
        raise HTTPException(400, str(e))
    return {"sql": req.sql, "result": result}


class RetranslateRequest(BaseModel):
    """重新翻译某些查询的 explanation + insight。用于切语言后刷新已有结果。"""
    queries: list[dict]  # 每个 dict 至少含 question, sql, result(可选 chart_hint)
    lang: str = "en"


@app.post("/api/session/{session_id}/retranslate")
async def retranslate(session_id: str, req: RetranslateRequest):
    """用新语言重新生成 explanation + insight,SQL 和数据不变。
    用于用户切语言时刷新已有的 AI/preset 查询结果。"""
    s = get_session_or_404(session_id)
    from analytics import generate_insight
    try:
        llm = get_llm_client()
    except LLMError:
        # 没 LLM 也无所谓,返回原数据
        return {"queries": req.queries}

    out = []
    for q in req.queries:
        result = q.get("result", {})
        # 没有结果就跳过
        if not result or result.get("row_count", 0) == 0:
            out.append(q)
            continue
        try:
            new_insight = await generate_insight(
                llm, q.get("question", ""), q.get("sql", ""), result, lang=req.lang,
            )
        except Exception:
            new_insight = q.get("insight", "")
        # explanation 字段太短,不重新生成(避免额外 LLM 调用),前端直接展示
        new_q = {**q, "insight": new_insight}
        out.append(new_q)
    return {"queries": out}


# ============================================================
# 货币设置（session 级别）
# ============================================================
@app.get("/api/session/{session_id}/currency")
async def get_currency(session_id: str):
    s = get_session_or_404(session_id)
    # 货币存在 session 的额外字段中
    currency = getattr(s, "currency", "none")
    return {"currency": currency}


@app.post("/api/session/{session_id}/currency")
async def set_currency(session_id: str, req: CurrencyRequest):
    s = get_session_or_404(session_id)
    s.currency = req.currency
    return {"currency": req.currency}


# ============================================================
# 智能推荐
# ============================================================
@app.get("/api/session/{session_id}/suggestions")
async def get_suggestions(session_id: str, lang: str = "en"):
    s = get_session_or_404(session_id)
    if not s.tables:
        return {"questions": []}
    try:
        llm = get_llm_client()
        questions = await suggest_questions(llm, s, lang=lang)
    except LLMError as e:
        raise HTTPException(500, f"LLM call failed: {e}")
    return {"questions": questions}


@app.get("/api/session/{session_id}/auto-insights")
async def get_auto_insights(session_id: str, lang: str = "en"):
    s = get_session_or_404(session_id)
    if not s.tables:
        return {"insights": []}
    try:
        llm = get_llm_client()
        insights = await generate_auto_insights(llm, s, lang=lang)
    except LLMError as e:
        raise HTTPException(500, f"LLM call failed: {e}")
    return {"insights": insights}


@app.get("/api/session/{session_id}/dashboard")
async def get_dashboard(session_id: str, lang: str = "en", table: str | None = None):
    """预生成仪表盘 (无 LLM, 基于 schema)。"""
    s = get_session_or_404(session_id)
    cards = generate_dashboard(s, lang=lang, table_name=table)
    return {"cards": cards}


@app.get("/api/templates")
async def list_templates(lang: str = "en"):
    """列出所有可用的仪表盘模板。"""
    return {"templates": list_templates_i18n(lang)}


@app.post("/api/session/{session_id}/template/{template_id}")
async def run_template_endpoint(session_id: str, template_id: str, lang: str = "en", table: str | None = None):
    """运行指定模板。"""
    s = get_session_or_404(session_id)
    if not s.tables:
        raise HTTPException(400, "Upload data first")
    return run_template(s, template_id, lang=lang, table_name=table)


@app.get("/api/session/{session_id}/preset-questions")
async def get_preset_questions_endpoint(session_id: str, lang: str = "en", table: str | None = None):
    s = get_session_or_404(session_id)
    if not s.tables:
        return {"questions": []}
    questions = get_preset_questions(s, lang, table_name=table)
    return {"questions": questions}


@app.post("/api/session/{session_id}/preset/{preset_id}")
async def run_preset(session_id: str, preset_id: str, lang: str = "en", table: str | None = None):
    s = get_session_or_404(session_id)
    if not s.tables:
        raise HTTPException(400, "Upload data first")
    questions = get_preset_questions(s, lang, table_name=table)
    q = next((q for q in questions if q["id"] == preset_id), None)
    if not q:
        raise HTTPException(404, f"Preset {preset_id} unavailable for this dataset")
    try:
        result = execute_sql(s, q["sql"])
    except SQLExecutionError as e:
        raise HTTPException(400, str(e))
    # 货币标记
    currency_cols = [q["currency_col"]] if q.get("currency_col") else []
    result["currency_cols"] = currency_cols
    query_id = len(s.query_history)
    answer = {
        "id": query_id,
        "question": q["label"],
        "sql": q["sql"],
        "explanation": "",
        "chart_hint": q["chart_hint"],
        "result": result,
        "insight": "",
    }
    s.query_history.append(answer)
    return answer


@app.post("/api/session/{session_id}/pivot")
async def run_pivot_endpoint(session_id: str, config: PivotConfig):
    """运行透视表查询。"""
    s = get_session_or_404(session_id)
    try:
        result = run_pivot(s, config)
    except SQLExecutionError as e:
        raise HTTPException(400, str(e))
    except ValueError as e:
        raise HTTPException(400, str(e))
    return result


# ============================================================
# 历史
# ============================================================
@app.get("/api/session/{session_id}/history")
async def get_history(session_id: str):
    s = get_session_or_404(session_id)
    return {"history": s.query_history}


# ============================================================
# 导出
# ============================================================
@app.post("/api/session/{session_id}/export/markdown", response_class=PlainTextResponse)
async def export_markdown(session_id: str, req: ExportRequest):
    s = get_session_or_404(session_id)

    if req.query_ids is None:
        queries = s.query_history
    else:
        queries = [q for q in s.query_history if q["id"] in req.query_ids]

    if not queries:
        raise HTTPException(404, "No queries to export")

    # 标题按语言切换
    titles = {
        "en": ("# Data Analysis Report\n", "**Explanation:**", "**Insight:**"),
        "zh": ("# 数据分析报告\n", "**SQL 解释:**", "**洞察:**"),
        "es": ("# Reporte de Análisis\n", "**Explicación:**", "**Insight:**"),
        "ja": ("# データ分析レポート\n", "**説明:**", "**洞察:**"),
        "ko": ("# 데이터 분석 보고서\n", "**설명:**", "**인사이트:**"),
        "fr": ("# Rapport d'Analyse\n", "**Explication:**", "**Insight:**"),
        "de": ("# Analysebericht\n", "**Erklärung:**", "**Erkenntnis:**"),
        "pt": ("# Relatório de Análise\n", "**Explicação:**", "**Insight:**"),
        "it": ("# Report di Analisi\n", "**Spiegazione:**", "**Insight:**"),
        "ru": ("# Отчёт об анализе\n", "**Объяснение:**", "**Инсайт:**"),
    }
    header, expl_label, insight_label = titles.get(req.lang, titles["en"])

    lines = [header]
    for i, q in enumerate(queries, 1):
        lines.append(f"## {i}. {q['question']}\n")
        if q.get("explanation"):
            lines.append(f"{expl_label} {q['explanation']}\n")
        lines.append("```sql")
        lines.append(q["sql"])
        lines.append("```\n")
        if q.get("insight"):
            lines.append(f"{insight_label} {q['insight']}\n")
        result = q.get("result", {})
        cols = result.get("columns", [])
        rows = result.get("rows", [])[:20]
        if cols:
            lines.append("| " + " | ".join(str(c) for c in cols) + " |")
            lines.append("| " + " | ".join("---" for _ in cols) + " |")
            for row in rows:
                lines.append(
                    "| " + " | ".join("" if v is None else str(v) for v in row) + " |"
                )
            lines.append("")
    return "\n".join(lines)


# ============================================================
# 健康检查
# ============================================================
@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "llm_provider": os.getenv("LLM_PROVIDER", "gemini"),
        "active_sessions": len(pool._sessions),
    }


# ============================================================
# 本地运行入口
# ============================================================
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", 8000)),
        reload=True,
    )
