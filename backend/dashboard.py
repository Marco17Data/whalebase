"""
仪表盘自动生成器（多语言版）
==========================
所有标题/别名根据 lang 参数返回对应语言。
"""
from __future__ import annotations
from typing import Any
from database import Session, execute_sql, SQLExecutionError, ColumnInfo
from i18n import tr, normalize_lang


def _find_columns_by_type(table_columns: list[ColumnInfo]) -> dict[str, list[ColumnInfo]]:
    measure_keywords = (
        "revenue", "amount", "sales", "total", "price", "value",
        "cost", "profit", "quantity", "qty", "count", "sum",
        "金额", "销售", "总额", "营业", "支出", "成本", "利润", "数量", "单价",
    )
    groups: dict[str, list[ColumnInfo]] = {"datetime": [], "numeric": [], "category": []}
    for col in table_columns:
        if col.dtype == "datetime":
            groups["datetime"].append(col)
            continue
        col_lower = col.name.lower()
        is_measure_name = any(kw in col_lower for kw in measure_keywords)
        if col.dtype in ("integer", "float"):
            if is_measure_name:
                groups["numeric"].append(col)
            elif col.distinct_count is not None and col.distinct_count <= 20:
                groups["category"].append(col)
            else:
                groups["numeric"].append(col)
        elif col.dtype == "text":
            if col.distinct_count is not None and 2 <= col.distinct_count <= 30:
                groups["category"].append(col)
    return groups


def _is_currency_col(col: ColumnInfo) -> bool:
    """是否为货币列(用于前端加货币符号)。"""
    keywords = ("revenue", "amount", "sales", "price", "value", "cost",
                "profit", "total", "金额", "销售", "总额", "营业", "支出", "成本", "利润", "单价")
    return any(kw in col.name.lower() for kw in keywords)


def generate_dashboard(session: Session, lang: str = "en", table_name: str | None = None) -> list[dict[str, Any]]:
    lang = normalize_lang(lang)
    if not session.tables:
        return []
    # 优先使用指定的 table_name,否则用第一个
    if table_name and table_name in session.tables:
        table = session.tables[table_name]
    else:
        table = next(iter(session.tables.values()))
    tname = table.name
    groups = _find_columns_by_type(table.columns)
    cards: list[dict[str, Any]] = []

    # 总记录数
    cards.append(_make_card(
        session,
        title=tr("card.row_count", lang),
        subtitle=tr("subtitle.from_file", lang, file=table.original_filename),
        chart_type="kpi",
        sql=f'SELECT COUNT(*) AS "{tr("alias.row_count", lang)}" FROM "{tname}"',
        currency_cols=[],
    ))

    # 找一个可求和的数值列 - 按关键字优先级遍历
    # 关键:不能用 any() 遍历列优先级,否则 'unit_price' 会先于 'revenue' 匹配
    revenue_keywords = ("revenue", "sales", "amount", "total", "value", "price",
                        "营业额", "销售额", "总额", "金额")
    revenue_col = None
    for kw in revenue_keywords:
        for col in groups["numeric"]:
            if kw.lower() in col.name.lower():
                revenue_col = col
                break
        if revenue_col:
            break
    if revenue_col is None and groups["numeric"]:
        revenue_col = groups["numeric"][0]

    if revenue_col:
        rev_alias = tr("alias.total", lang)
        cards.append(_make_card(
            session,
            title=tr("card.total_revenue", lang, col=revenue_col.name),
            subtitle=tr("subtitle.sum_all", lang),
            chart_type="kpi",
            sql=f'SELECT ROUND(SUM("{revenue_col.name}"), 2) AS "{rev_alias}" FROM "{tname}"',
            currency_cols=[rev_alias] if _is_currency_col(revenue_col) else [],
        ))

    # 时间趋势
    if groups["datetime"] and revenue_col:
        date_col = groups["datetime"][0]
        month_alias = tr("alias.month", lang)
        rev_alias = revenue_col.name  # 保留原列名作别名
        sql = (
            f'SELECT DATE_TRUNC(\'month\', "{date_col.name}") AS "{month_alias}", '
            f'ROUND(SUM("{revenue_col.name}"), 2) AS "{rev_alias}" '
            f'FROM "{tname}" GROUP BY "{month_alias}" ORDER BY "{month_alias}"'
        )
        cards.append(_make_card(
            session,
            title=tr("card.monthly_trend", lang),
            subtitle=tr("subtitle.agg_by", lang, col=date_col.name),
            chart_type="line",
            sql=sql,
            currency_cols=[rev_alias] if _is_currency_col(revenue_col) else [],
        ))

    # TOP 类别
    if groups["category"] and revenue_col:
        cat_col = groups["category"][0]
        rev_alias = revenue_col.name
        sql = (
            f'SELECT "{cat_col.name}", ROUND(SUM("{revenue_col.name}"), 2) AS "{rev_alias}" '
            f'FROM "{tname}" GROUP BY "{cat_col.name}" '
            f'ORDER BY "{rev_alias}" DESC LIMIT 10'
        )
        cards.append(_make_card(
            session,
            title=tr("card.top_by", lang, col=cat_col.name),
            subtitle=tr("subtitle.sorted_by", lang, col=revenue_col.name),
            chart_type="bar",
            sql=sql,
            currency_cols=[rev_alias] if _is_currency_col(revenue_col) else [],
        ))

    # 第二个类别的占比
    if len(groups["category"]) >= 2 and revenue_col:
        cat_col = groups["category"][1]
        rev_alias = revenue_col.name
        sql = (
            f'SELECT "{cat_col.name}", ROUND(SUM("{revenue_col.name}"), 2) AS "{rev_alias}" '
            f'FROM "{tname}" GROUP BY "{cat_col.name}" ORDER BY "{rev_alias}" DESC'
        )
        cards.append(_make_card(
            session,
            title=tr("card.distribution", lang, col=cat_col.name),
            subtitle=tr("subtitle.share_of", lang, col=revenue_col.name),
            chart_type="pie",
            sql=sql,
            currency_cols=[rev_alias] if _is_currency_col(revenue_col) else [],
        ))

    return [c for c in cards if c["result"] is not None]


def _make_card(session, title, subtitle, chart_type, sql, currency_cols=None):
    """统一构造卡片,把 currency_cols 信息放进 result 里。"""
    result = _safe_exec(session, sql)
    if result is not None:
        result["currency_cols"] = currency_cols or []
    return {
        "title": title,
        "subtitle": subtitle,
        "chart_type": chart_type,
        "sql": sql,
        "result": result,
    }


def _safe_exec(session, sql):
    try:
        return execute_sql(session, sql, max_rows=200)
    except SQLExecutionError:
        return None
