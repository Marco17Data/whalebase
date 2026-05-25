"""
分析引擎（多语言版）
==================
所有 LLM 业务逻辑。通过 lang 参数让 LLM 用对应语言输出
（explanation / insight / suggested_question / auto_insight 文字）。
"""
from __future__ import annotations
from typing import Any
from llm import LLMClient, extract_json
from database import Session, build_schema_prompt, execute_sql, SQLExecutionError
from i18n import normalize_lang


# 语言代码 → 给 LLM 看的语言名
LANG_NAMES = {
    "en": "English",
    "zh": "Simplified Chinese (简体中文)",
    "es": "Spanish (Español)",
    "ja": "Japanese (日本語)",
    "ko": "Korean (한국어)",
    "fr": "French (Français)",
    "de": "German (Deutsch)",
    "pt": "Portuguese (Português)",
    "it": "Italian (Italiano)",
    "ru": "Russian (Русский)",
}


def _lang_name(lang: str) -> str:
    return LANG_NAMES.get(normalize_lang(lang), "English")


# ============================================================
# 1. NL → SQL
# ============================================================
def _sql_gen_prompt(lang: str) -> str:
    lname = _lang_name(lang)
    return f"""You are a senior data analyst skilled at translating natural-language questions into DuckDB SQL.

Rules:
1. Only use the tables/columns provided. Never invent fields.
2. Use DuckDB dialect (PostgreSQL-like; supports DATE_TRUNC, EXTRACT, QUALIFY, PIVOT).
3. Quote column names with double quotes when they contain non-ASCII or special chars.
4. Aggregate to keep result sets small (GROUP BY + LIMIT).
5. For time series, comparisons, or rankings, return clear dimension + metric.
6. For top-N questions, add ORDER BY ... LIMIT N.
7. Do NOT use DROP/UPDATE/DELETE/INSERT/CREATE.

Output STRICT JSON (no other text):
{{
  "sql": "SELECT ...",
  "explanation": "1-2 sentence explanation IN {lname}",
  "chart_hint": "line" | "bar" | "pie" | "scatter" | "area" | "table"
}}

chart_hint guidelines:
- time series → line or area
- category comparison / ranking → bar
- composition (≤ 7 categories) → pie
- 2 numeric relationship → scatter
- raw detail / many columns → table

IMPORTANT: The "explanation" field MUST be written in {lname}.
"""


async def generate_sql(
    llm: LLMClient,
    session: Session,
    question: str,
    lang: str = "en",
    use_history: bool = True,
) -> dict[str, Any]:
    schema = build_schema_prompt(session)
    user_msg = f"{schema}\n\nUser question: {question}\n\nReturn strict JSON."

    history = session.chat_history if use_history else None
    raw = await llm.chat(
        system_prompt=_sql_gen_prompt(lang),
        user_message=user_msg,
        history=history,
        json_mode=True,
    )
    try:
        parsed = extract_json(raw)
    except ValueError as e:
        raise ValueError(f"LLM returned invalid JSON: {raw[:300]}") from e
    if not isinstance(parsed, dict) or "sql" not in parsed:
        raise ValueError(f"LLM output missing sql field: {parsed}")
    return {
        "sql": parsed["sql"].strip(),
        "explanation": parsed.get("explanation", ""),
        "chart_hint": parsed.get("chart_hint", "table"),
    }


# ============================================================
# 2. Insight generation
# ============================================================
def _insight_prompt(lang: str) -> str:
    lname = _lang_name(lang)
    return f"""You are a senior data analyst skilled at extracting meaningful insights from data.

Task: Given the user's question, the SQL run, and the result, output 2-4 sentences of insight.

Requirements:
- Use specific numbers ("sales grew 23%", not "grew a lot")
- Highlight the most important trend / anomaly / comparison
- Don't restate the data — provide a perspective
- If there's an obvious anomaly or follow-up question, mention it
- Tone: professional, concise, like a colleague briefing
- Output IN {lname}. No prefix labels (don't say "Insight:" or similar).
"""


async def generate_insight(
    llm: LLMClient,
    question: str,
    sql: str,
    result: dict[str, Any],
    lang: str = "en",
) -> str:
    preview_rows = result["rows"][:50]
    data_summary = (
        f"\nQuery result ({result['row_count']} rows, showing first {len(preview_rows)}):\n"
        f"Columns: {result['columns']}\n"
        f"Rows: {preview_rows}\n"
    )
    user_msg = f"User question: {question}\n\nSQL:\n{sql}\n{data_summary}\nProvide insight."
    return await llm.chat(
        system_prompt=_insight_prompt(lang),
        user_message=user_msg,
    )


# ============================================================
# 3. Question suggestions
# ============================================================
def _suggest_prompt(lang: str) -> str:
    lname = _lang_name(lang)
    return f"""You are a data analyst. Given the user's data schema, suggest 5 valuable analytical questions.

Requirements:
- Concrete, executable, based on actual fields
- Cover diverse angles: trends, comparisons, rankings, distributions, correlations
- Each ≤ 25 words / characters
- Skip trivial questions ("how many rows")
- Write IN {lname}.

Output strict JSON array: ["q1", "q2", "q3", "q4", "q5"]
"""


async def suggest_questions(llm: LLMClient, session: Session, lang: str = "en") -> list[str]:
    if not session.tables:
        return []
    schema = build_schema_prompt(session)
    raw = await llm.chat(
        system_prompt=_suggest_prompt(lang),
        user_message=f"{schema}\n\nSuggest 5 valuable analytical questions.",
        json_mode=True,
    )
    try:
        parsed = extract_json(raw)
        if isinstance(parsed, dict):
            for v in parsed.values():
                if isinstance(v, list):
                    parsed = v
                    break
        if isinstance(parsed, list):
            return [str(q) for q in parsed[:5]]
    except ValueError:
        pass
    return []


# ============================================================
# 4. Auto Insights (UPGRADED: real stats + business analyst tone)
# ============================================================
def _auto_insight_prompt(lang: str) -> str:
    from datetime import date
    lname = _lang_name(lang)
    today = date.today().isoformat()
    return f"""You are a senior business analyst preparing a briefing for a non-technical executive.

CONTEXT:
- Today's date is {today}.
- The data you'll see is HISTORICAL business data. The end date being in the past is NORMAL and EXPECTED.
- You will be given both the schema AND pre-computed real statistics.
- USE THE REAL NUMBERS in your insights. Speak with confidence, not hedging.

Task: Find 3-5 most valuable, actionable business insights for the executive.

ABSOLUTE RULES (must follow):
1. BE EXTREMELY CONCISE. Each insight = ONE short sentence, max 18 words. NO filler.
2. Lead with the number. Use shorthand: "$2.4M", "+12%", "AOV $9".
3. NEVER comment on date range, data cutoff, or no current-year data.
4. NEVER say "the field shows" or "samples indicate" - programmer speak.
5. NEVER use backticks. NEVER use connectors like "however", "while", "moreover", "additionally", "this indicates".
6. NEVER restate trivial facts (data has N rows, range 1 to 5).
7. ALWAYS include hard numbers. NEVER use "might", "could", "suggests".
8. Output 4 insights (not 3-5).
9. Write IN {lname}.

GOOD (concise, one-line each):
- "Female drives 54% revenue ($1.24M); male AOV $427 vs $417."
- "East China: 31% revenue from 22% orders. Top AOV $520."
- "Top 3 products = 58% of revenue."
- "Age 26-35: 33.6% revenue ($773K). 18-25 highest AOV ($454)."

BAD (banned):
- Anything > 18 words per insight
- Multi-sentence insights
- "This indicates a potential..." / "It is worth noting..."
- "Data cut-off in late 2025"
- "Might indicate", "could suggest"

Output strict JSON array:
[
  {{"title": "Punchy 5-10 word headline", "content": "Specific finding with real numbers + business implication", "suggested_question": "One sharp follow-up question"}},
  ...
]
"""


def _compute_real_stats(session: Session, max_dims: int = 3) -> str:
    """Compute real statistics from the data to ground the AI insights."""
    if not session.tables:
        return ""
    table = next(iter(session.tables.values()))
    tname = table.name

    revenue_keywords = ("revenue", "sales", "amount", "total", "value", "price",
                        "营业额", "销售额", "总额", "金额")
    revenue_col = None
    for kw in revenue_keywords:
        for col in table.columns:
            if col.dtype in ("integer", "float") and kw.lower() in col.name.lower():
                revenue_col = col
                break
        if revenue_col:
            break
    if revenue_col is None:
        for col in table.columns:
            if col.dtype in ("integer", "float"):
                revenue_col = col
                break

    date_col = next((c for c in table.columns if c.dtype == "datetime"), None)
    cat_cols = [c for c in table.columns
                if c.dtype == "text" and c.distinct_count and c.distinct_count <= 30][:max_dims]

    stats_lines = [f"## Real Statistics for {tname}"]

    try:
        r = execute_sql(session, f'SELECT COUNT(*) FROM "{tname}"', max_rows=1)
        if r and r["rows"]:
            stats_lines.append(f"- Total rows: {r['rows'][0][0]:,}")
    except SQLExecutionError:
        pass

    if revenue_col:
        try:
            r = execute_sql(session, (
                f'SELECT ROUND(SUM("{revenue_col.name}"), 2), '
                f'ROUND(AVG("{revenue_col.name}"), 2), '
                f'ROUND(MIN("{revenue_col.name}"), 2), '
                f'ROUND(MAX("{revenue_col.name}"), 2) '
                f'FROM "{tname}"'
            ), max_rows=1)
            if r and r["rows"]:
                t, a, mn, mx = r["rows"][0]
                stats_lines.append(
                    f"- {revenue_col.name}: total={t:,.0f}, avg={a:,.2f}, min={mn:,.2f}, max={mx:,.2f}"
                )
        except SQLExecutionError:
            pass

    for cat_col in cat_cols:
        try:
            if revenue_col:
                sql = (
                    f'SELECT "{cat_col.name}", COUNT(*) AS cnt, '
                    f'ROUND(SUM("{revenue_col.name}"), 2) AS rev, '
                    f'ROUND(SUM("{revenue_col.name}") * 100.0 / SUM(SUM("{revenue_col.name}")) OVER (), 1) AS pct '
                    f'FROM "{tname}" WHERE "{cat_col.name}" IS NOT NULL '
                    f'GROUP BY "{cat_col.name}" ORDER BY rev DESC LIMIT 7'
                )
            else:
                sql = (
                    f'SELECT "{cat_col.name}", COUNT(*) AS cnt, '
                    f'ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) AS pct '
                    f'FROM "{tname}" WHERE "{cat_col.name}" IS NOT NULL '
                    f'GROUP BY "{cat_col.name}" ORDER BY cnt DESC LIMIT 7'
                )
            r = execute_sql(session, sql, max_rows=10)
            if r and r["rows"]:
                stats_lines.append(f"- Breakdown by {cat_col.name}:")
                for row in r["rows"]:
                    if revenue_col:
                        label, cnt, rev, pct = row
                        stats_lines.append(f"    - {label}: {cnt:,} orders, revenue={rev:,.0f} ({pct}%)")
                    else:
                        label, cnt, pct = row
                        stats_lines.append(f"    - {label}: {cnt:,} ({pct}%)")
        except SQLExecutionError:
            pass

    if date_col and revenue_col:
        try:
            r = execute_sql(session, (
                f"SELECT DATE_TRUNC('month', \"{date_col.name}\") AS m, "
                f'ROUND(SUM("{revenue_col.name}"), 0) AS v '
                f'FROM "{tname}" GROUP BY m ORDER BY m'
            ), max_rows=24)
            if r and r["rows"] and len(r["rows"]) >= 2:
                rows = r["rows"]
                stats_lines.append(f"- Monthly {revenue_col.name} ({len(rows)} months):")
                if len(rows) <= 8:
                    for m, v in rows:
                        stats_lines.append(f"    - {str(m).split(' ')[0]}: {v:,.0f}")
                else:
                    for m, v in rows[:3]:
                        stats_lines.append(f"    - {str(m).split(' ')[0]}: {v:,.0f}")
                    stats_lines.append(f"    - ... ({len(rows) - 6} months omitted) ...")
                    for m, v in rows[-3:]:
                        stats_lines.append(f"    - {str(m).split(' ')[0]}: {v:,.0f}")
                first_3_avg = sum(v for _, v in rows[:3]) / 3
                last_3_avg = sum(v for _, v in rows[-3:]) / 3
                change_pct = (last_3_avg - first_3_avg) / first_3_avg * 100 if first_3_avg else 0
                direction = "growing" if change_pct > 5 else ("declining" if change_pct < -5 else "stable")
                stats_lines.append(f"    - Trend: {direction} ({change_pct:+.1f}% from start to end)")
        except SQLExecutionError:
            pass

    return "\n".join(stats_lines)


async def generate_auto_insights(
    llm: LLMClient, session: Session, lang: str = "en",
) -> list[dict[str, str]]:
    # Compare mode: delegate to compare-specific insights (don't touch homepage logic)
    cm = getattr(session, "compare_mode", None) or {}
    if cm.get("active"):
        return await generate_compare_insights(llm, session, lang=lang)

    if not session.tables:
        return []
    schema = build_schema_prompt(session)
    real_stats = _compute_real_stats(session)
    raw = await llm.chat(
        system_prompt=_auto_insight_prompt(lang),
        user_message=f"{schema}\n\n{real_stats}\n\nProvide 3-5 specific, actionable insights using the real numbers above. Do not comment on date ranges.",
        json_mode=True,
    )
    import logging
    logger = logging.getLogger(__name__)
    try:
        parsed = extract_json(raw)
        if isinstance(parsed, dict):
            for v in parsed.values():
                if isinstance(v, list):
                    parsed = v
                    break
        if isinstance(parsed, list):
            insights = [
                {
                    "title": str(item.get("title", "")),
                    "content": str(item.get("content", "")),
                    "suggested_question": str(item.get("suggested_question", "")),
                }
                for item in parsed[:5]
                if isinstance(item, dict)
            ]
            if not insights:
                logger.warning("auto_insights: parsed list but no valid items. Raw: %s", raw[:500])
            return insights
        logger.warning("auto_insights: parsed JSON is neither list nor dict-with-list. Type=%s, Raw: %s",
                       type(parsed).__name__, raw[:500])
    except ValueError as e:
        logger.warning("auto_insights: extract_json failed (%s). Raw: %s", e, raw[:500])
    except Exception as e:
        logger.warning("auto_insights: unexpected error (%s). Raw: %s", e, raw[:500])
    return []


# ============================================================
# 5. End-to-end answer
# ============================================================
async def answer_question(
    llm: LLMClient,
    session: Session,
    question: str,
    lang: str = "en",
) -> dict[str, Any]:
    lang = normalize_lang(lang)
    sql_result = await generate_sql(llm, session, question, lang=lang)

    try:
        query_result = execute_sql(session, sql_result["sql"])
    except SQLExecutionError as e:
        fix_prompt = (
            f"Previous SQL failed:\nSQL: {sql_result['sql']}\nError: {e}\n\n"
            f"Rewrite the SQL to avoid this error."
        )
        retry_raw = await llm.chat(
            system_prompt=_sql_gen_prompt(lang),
            user_message=f"{build_schema_prompt(session)}\n\nUser question: {question}\n\n{fix_prompt}",
            json_mode=True,
        )
        try:
            retry_parsed = extract_json(retry_raw)
            sql_result["sql"] = retry_parsed["sql"]
            sql_result["explanation"] = retry_parsed.get(
                "explanation", sql_result["explanation"]
            )
            query_result = execute_sql(session, sql_result["sql"])
        except Exception as retry_err:
            raise SQLExecutionError(
                f"SQL failed (retry also failed): {e}\nRetry error: {retry_err}"
            ) from retry_err

    insight = ""
    if query_result["row_count"] > 0:
        try:
            insight = await generate_insight(
                llm, question, sql_result["sql"], query_result, lang=lang
            )
        except Exception:
            insight = ""

    return {
        "question": question,
        "sql": sql_result["sql"],
        "explanation": sql_result["explanation"],
        "chart_hint": sql_result["chart_hint"],
        "result": query_result,
        "insight": insight,
    }


async def generate_compare_insights(llm, session, lang: str = "en") -> list:
    """
    Compare 模式专属洞察 — 基于 per-dataset 对比生成。
    跟 generate_auto_insights 完全独立, 用专门的 prompt 让 Gemini 写对比。
    """
    from i18n import normalize_lang
    from compare import COMPARE_TABLE_NAME

    lang = normalize_lang(lang)
    cm = getattr(session, "compare_mode", None) or {}
    if not cm.get("active") or COMPARE_TABLE_NAME not in session.tables:
        return []

    table = session.tables[COMPARE_TABLE_NAME]
    tname = COMPARE_TABLE_NAME
    datasets = cm.get("source_tables", [])
    if len(datasets) < 2:
        return []

    # === 计算 per-dataset 聚合(为 Gemini 提供"对比素材") ===
    from dashboard import _find_columns_by_type, _is_currency_col, _safe_exec
    groups = _find_columns_by_type(table.columns)
    revenue_keywords = ("revenue","sales","amount","total","value","price","金额","销售","总额","营业")
    revenue_col = None
    for kw in revenue_keywords:
        for c in groups["numeric"]:
            if kw.lower() in c.name.lower():
                revenue_col = c; break
        if revenue_col: break
    if revenue_col is None and groups["numeric"]:
        revenue_col = groups["numeric"][0]

    # per-dataset 统计
    agg_lines = []
    for ds in datasets:
        ds_esc = ds.replace("'", "''")
        # 行数 + 收入
        r = _safe_exec(session, f'SELECT COUNT(*) FROM "{tname}" WHERE __dataset = \'{ds_esc}\'')
        rows = int(r["rows"][0][0]) if r and r["rows"] else 0
        rev = None
        if revenue_col:
            r2 = _safe_exec(session, f'SELECT ROUND(SUM("{revenue_col.name}"), 2) FROM "{tname}" WHERE __dataset = \'{ds_esc}\'')
            if r2 and r2["rows"] and r2["rows"][0][0] is not None:
                rev = float(r2["rows"][0][0])
        # AOV
        aov = round(rev / rows, 2) if rev and rows else None
        # 月度趋势 (前 3 月)
        trend_str = ""
        if revenue_col and groups["datetime"]:
            dc = groups["datetime"][0]
            r3 = _safe_exec(session, (
                f'SELECT DATE_TRUNC(\'month\', "{dc.name}") AS m, '
                f'ROUND(SUM("{revenue_col.name}"), 2) AS v '
                f'FROM "{tname}" WHERE __dataset = \'{ds_esc}\' GROUP BY m ORDER BY m DESC LIMIT 3'
            ))
            if r3 and r3["rows"]:
                pts = [(str(row[0])[:7], float(row[1] or 0)) for row in reversed(r3["rows"])]
                trend_str = ", ".join(f"{m}: {v}" for m, v in pts)
        agg_lines.append(f"- {ds}: rows={rows}, revenue={rev}, AOV={aov}, recent_trend=[{trend_str}]")

    agg_block = "\n".join(agg_lines)

    # === 语言指令 ===
    lang_instr = {
        "en": "Respond in English.",
        "zh": "用简体中文回答。",
        "es": "Responde en español.",
        "ja": "日本語で答えてください。",
        "ko": "한국어로 답하세요.",
        "fr": "Réponds en français.",
        "de": "Antworte auf Deutsch.",
        "pt": "Responde em português.",
        "it": "Rispondi in italiano.",
        "ru": "Отвечайте на русском.",
    }.get(lang, "Respond in English.")

    # === Prompt ===
    prompt = f"""You are a business analyst comparing {len(datasets)} datasets: {", ".join(datasets)}.

Here are key per-dataset metrics:
{agg_block}

Generate EXACTLY 3 comparison insights. Each insight MUST:
- Be a direct comparison (e.g. "X is 15% higher than Y in revenue")
- Quote specific numbers/percentages
- Be under 18 words
- Have a 2-4 word title

{lang_instr}

Return JSON only (no markdown, no commentary):
{{"insights": [
  {{"title": "<title>", "content": "<comparison sentence with numbers>"}},
  ...
]}}"""

    # System prompt: instruct JSON output
    system_prompt = "You are a business analyst writing concise dataset-comparison insights. Output strict JSON only."
    try:
        raw = await llm.chat(
            system_prompt=system_prompt,
            user_message=prompt,
            json_mode=True,
        )
        parsed = extract_json(raw)
        if isinstance(parsed, dict) and "insights" in parsed:
            return parsed["insights"][:3]
        if isinstance(parsed, list):
            return parsed[:3]
    except Exception as e:
        return [{"title": "Compare", "content": f"Compare insights unavailable: {e}"}]
    return []

