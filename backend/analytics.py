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
# 4. Auto Insights
# ============================================================
def _auto_insight_prompt(lang: str) -> str:
    lname = _lang_name(lang)
    return f"""You are a data analyst. The user just uploaded data and hasn't asked yet.

Task: Proactively analyze this data and find 3-5 most valuable insights.

Strategy:
- Don't repeat "the data has N rows"
- Find: anomalies, significant trends, outstanding categories, imbalanced distributions, data quality issues
- Each insight must reference specific fields and observations
- 1-2 sentences each
- Write IN {lname}

You may reason from schema (sample values, ranges, distinct counts, null counts).

Output strict JSON array:
[
  {{"title": "5-10 word title", "content": "1-2 sentence insight", "suggested_question": "one follow-up question"}},
  ...
]
"""


async def generate_auto_insights(
    llm: LLMClient, session: Session, lang: str = "en",
) -> list[dict[str, str]]:
    if not session.tables:
        return []
    schema = build_schema_prompt(session)
    raw = await llm.chat(
        system_prompt=_auto_insight_prompt(lang),
        user_message=f"{schema}\n\nProvide 3-5 insights.",
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
            return [
                {
                    "title": str(item.get("title", "")),
                    "content": str(item.get("content", "")),
                    "suggested_question": str(item.get("suggested_question", "")),
                }
                for item in parsed[:5]
                if isinstance(item, dict)
            ]
    except ValueError:
        pass
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
