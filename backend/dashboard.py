"""
仪表盘自动生成器（多语言版）
==========================
所有标题/别名根据 lang 参数返回对应语言。
"""
from __future__ import annotations
from typing import Any
from database import Session, execute_sql, SQLExecutionError, ColumnInfo
from i18n import tr, normalize_lang, humanize


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



def generate_overview(session: Session, lang: str = "en", table_name: str | None = None) -> dict:
    """Hero overview: 4 KPIs + pie + trend (different from generate_dashboard)."""
    lang = normalize_lang(lang)
    if not session.tables:
        return {"kpis": [], "pie": None, "trend": None}

    if table_name and table_name in session.tables:
        table = session.tables[table_name]
    else:
        table = next(iter(session.tables.values()))
    tname = table.name
    groups = _find_columns_by_type(table.columns)

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

    is_currency = revenue_col and _is_currency_col(revenue_col)

    kpis = []

    # Helper: compute sparkline + month-over-month % + completeness flag
    def _month_metrics(agg_sql_expr: str) -> tuple[list[float], float | None, str | None]:
        """Return (sparkline_last_12_months, change_pct, period_status).
        period_status: 'partial' if current month is incomplete (>=5 days left),
                       'complete' if current month finished,
                       None if no date column or < 2 months data."""
        if not groups["datetime"]:
            return [], None, None
        dc = groups["datetime"][0]
        res = _safe_exec(session, (
            f"SELECT DATE_TRUNC('month', \"{dc.name}\") AS m, {agg_sql_expr} AS v "
            f'FROM "{tname}" GROUP BY m ORDER BY m DESC LIMIT 12'
        ))
        if not res or not res["rows"]:
            return [], None, None
        # Reverse to chronological order
        points = [float(r[1]) if r[1] is not None else 0.0 for r in reversed(res["rows"])]

        if len(points) < 2:
            return points, None, "single"

        # Check completeness of the last (most recent) month
        max_date_res = _safe_exec(session, f'SELECT MAX("{dc.name}") AS d FROM "{tname}"')
        is_partial = False
        if max_date_res and max_date_res["rows"]:
            md = max_date_res["rows"][0][0]
            if md:
                # Check if current month is incomplete (more than 5 days left in month)
                days_left_res = _safe_exec(session, (
                    "SELECT DATE_PART('day', LAST_DAY(CAST(? AS DATE))) - "
                    "DATE_PART('day', CAST(? AS DATE)) AS days_left"
                ).replace("?", f"'{str(md).split(' ')[0]}'"))
                if days_left_res and days_left_res["rows"]:
                    days_left = days_left_res["rows"][0][0]
                    if days_left is not None and days_left >= 5:
                        is_partial = True

        pct = None
        if not is_partial and points[-2] > 0:
            pct = (points[-1] - points[-2]) / points[-2] * 100

        status = "partial" if is_partial else "complete"
        return points, pct, status

    if revenue_col:
        total_rev = _safe_exec(session, f'SELECT ROUND(SUM("{revenue_col.name}"), 2) AS total FROM "{tname}"')
        if total_rev and total_rev["rows"]:
            spark, change, status = _month_metrics(f'SUM("{revenue_col.name}")')
            kpis.append({
                "label": tr("kpi.total_revenue", lang),
                "value": total_rev["rows"][0][0],
                "format": "currency" if is_currency else "number",
                "sparkline": spark,
                "change_pct": change,
                "period_status": status,
            })

    # Whalebase is a sales analytics tool, so default this to Total Orders
    total_rows = _safe_exec(session, f'SELECT COUNT(*) AS n FROM "{tname}"')
    if total_rows and total_rows["rows"]:
        spark, change, status = _month_metrics("COUNT(*)")
        kpis.append({
            "label": tr("kpi.total_orders", lang),
            "value": total_rows["rows"][0][0],
            "format": "number",
            "sparkline": spark,
            "change_pct": change,
            "period_status": status,
        })

    if revenue_col:
        avg_rev = _safe_exec(session, f'SELECT ROUND(AVG("{revenue_col.name}"), 2) AS avg FROM "{tname}"')
        if avg_rev and avg_rev["rows"]:
            spark, change, status = _month_metrics(f'AVG("{revenue_col.name}")')
            kpis.append({
                "label": tr("kpi.average_order", lang),
                "value": avg_rev["rows"][0][0],
                "format": "currency" if is_currency else "number",
                "sparkline": spark,
                "change_pct": change,
                "period_status": status,
            })

    if revenue_col and groups["datetime"]:
        date_col = groups["datetime"][0]
        peak = _safe_exec(session, (
            f'SELECT "{date_col.name}", ROUND(SUM("{revenue_col.name}"), 2) AS day_total '
            f'FROM "{tname}" GROUP BY "{date_col.name}" ORDER BY day_total DESC LIMIT 1'
        ))
        if peak and peak["rows"]:
            d, v = peak["rows"][0]
            date_str = str(d).split(" ")[0] if d else "-"
            kpis.append({"label": tr("kpi.peak_day", lang), "value": date_str, "sub": v, "format": "date"})

    pie = None
    if revenue_col and groups["category"]:
        cat_col = groups["category"][0]
        pie_res = _safe_exec(session, (
            f'SELECT "{cat_col.name}", ROUND(SUM("{revenue_col.name}"), 2) AS total '
            f'FROM "{tname}" WHERE "{cat_col.name}" IS NOT NULL '
            f'GROUP BY "{cat_col.name}" ORDER BY total DESC LIMIT 6'
        ))
        if pie_res and pie_res["rows"]:
            total_sum = sum(row[1] for row in pie_res["rows"] if row[1])
            pie = {
                "title": tr("hero.pie_title", lang, dim=humanize(cat_col.name, lang)),
                "dimension": cat_col.name,
                "total": total_sum,
                "is_currency": is_currency,
                "slices": [{"label": str(row[0]), "value": row[1],
                            "pct": (row[1] / total_sum * 100) if total_sum else 0}
                           for row in pie_res["rows"]],
            }

    trend = None
    if revenue_col and groups["datetime"]:
        date_col = groups["datetime"][0]
        trend_res = _safe_exec(session, (
            f"SELECT DATE_TRUNC('month', \"{date_col.name}\") AS month, "
            f'ROUND(SUM("{revenue_col.name}"), 2) AS total '
            f'FROM "{tname}" GROUP BY month ORDER BY month'
        ))
        if trend_res and trend_res["rows"]:
            # Anomaly detection on trend points
            values = [row[1] for row in trend_res["rows"] if row[1] is not None]
            mean_val = sum(values) / len(values) if values else 0
            variance = sum((v - mean_val) ** 2 for v in values) / len(values) if values else 0
            std_dev = variance ** 0.5
            threshold = 2.0
            points = []
            for row in trend_res["rows"]:
                v = row[1] if row[1] is not None else 0
                is_anomaly = std_dev > 0 and abs(v - mean_val) > threshold * std_dev
                deviation_pct = ((v - mean_val) / mean_val * 100) if mean_val else 0
                points.append({
                    "month": str(row[0]).split(" ")[0] if row[0] else "",
                    "value": v,
                    "is_anomaly": is_anomaly,
                    "anomaly_type": ("spike" if v > mean_val else "drop") if is_anomaly else None,
                    "deviation_pct": round(deviation_pct, 1),
                    "mean_value": round(mean_val, 2),
                })
            trend = {
                "title": tr("hero.trend_title", lang),
                "is_currency": is_currency,
                "points": points,
            }

    # Mark high concentration (top slice > 50%)
    if pie and pie.get("slices") and len(pie["slices"]) > 0:
        top_pct = pie["slices"][0].get("pct", 0)
        top3_pct = sum(s.get("pct", 0) for s in pie["slices"][:3])
        pie["high_concentration"] = top_pct > 50
        pie["top_pct"] = round(top_pct, 1)
        pie["top3_pct"] = round(top3_pct, 1)
        pie["top_label"] = pie["slices"][0].get("label", "")

    return {"kpis": kpis, "pie": pie, "trend": trend}



def generate_data_quality(session: Session, lang: str = "en", table_name: str | None = None) -> dict:
    """Compute data quality metrics: duplicate rows + per-column null rates."""
    if not session.tables:
        return {"row_count": 0, "col_count": 0, "duplicate_rows": 0, "duplicate_pct": 0.0, "columns_with_nulls": []}

    tname = table_name if table_name and table_name in session.tables else next(iter(session.tables))
    table = session.tables[tname]
    cols = list(table.columns)

    # Row + col counts
    row_count = table.row_count
    col_count = len(cols)

    # Duplicate rows: count rows that have any other identical row
    duplicate_rows = 0
    try:
        col_list = ", ".join(f'"{c.name}"' for c in cols)
        dup_q = (
            f'SELECT COUNT(*) FROM ('
            f'SELECT {col_list}, COUNT(*) AS cnt FROM "{tname}" '
            f'GROUP BY {col_list} HAVING COUNT(*) > 1) sub'
        )
        dup_res = _safe_exec(session, dup_q)
        if dup_res and dup_res["rows"]:
            # This gives groups of dupes; we want extra rows beyond first
            extra_q = (
                f'SELECT SUM(cnt - 1) FROM ('
                f'SELECT COUNT(*) AS cnt FROM "{tname}" '
                f'GROUP BY {col_list} HAVING COUNT(*) > 1) sub'
            )
            extra_res = _safe_exec(session, extra_q)
            if extra_res and extra_res["rows"] and extra_res["rows"][0][0] is not None:
                duplicate_rows = int(extra_res["rows"][0][0])
    except Exception:
        duplicate_rows = 0

    duplicate_pct = round(duplicate_rows / row_count * 100, 1) if row_count else 0.0

    # Per-column null rate (only show columns with > 0 nulls)
    columns_with_nulls = []
    for col in cols:
        try:
            null_res = _safe_exec(session, f'SELECT COUNT(*) FROM "{tname}" WHERE "{col.name}" IS NULL')
            if null_res and null_res["rows"]:
                null_count = int(null_res["rows"][0][0] or 0)
                if null_count > 0:
                    columns_with_nulls.append({
                        "name": col.name,
                        "null_count": null_count,
                        "null_pct": round(null_count / row_count * 100, 1) if row_count else 0.0,
                    })
        except Exception:
            continue

    # Sort by null_pct desc, keep top 5
    columns_with_nulls.sort(key=lambda x: x["null_pct"], reverse=True)
    columns_with_nulls = columns_with_nulls[:5]

    return {
        "row_count": row_count,
        "col_count": col_count,
        "duplicate_rows": duplicate_rows,
        "duplicate_pct": duplicate_pct,
        "columns_with_nulls": columns_with_nulls,
    }
