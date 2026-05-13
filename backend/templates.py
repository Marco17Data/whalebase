"""
仪表盘模板 + 预设问题库（多语言版）
========================
所有面向用户的字符串通过 i18n.tr(key, lang) 获取。
SQL 别名也用 lang 决定语言。
"""
from __future__ import annotations
from typing import Any
from database import Session, execute_sql, SQLExecutionError, ColumnInfo
from i18n import tr, normalize_lang


# ============================================================
# 列查找工具（保持不变）
# ============================================================
def _find_col(columns, keywords):
    for col in columns:
        if any(kw.lower() in col.name.lower() for kw in keywords):
            return col
    return None


def _find_date_col(columns):
    for col in columns:
        if col.dtype == "datetime":
            return col
    return None


def _find_measure_col(columns):
    """按关键字优先级查找度量列。先 revenue 再 sales 再 ... price。
    重要：必须按 keyword 优先级遍历,不能按 column 顺序遍历,
    否则 'unit_price' 会先于 'revenue' 被匹配上(因为 'price' 是 'unit_price' 的子串)。"""
    priority = ("revenue", "sales", "amount", "total", "value", "price",
                "营业额", "销售额", "总额", "金额")
    numeric_cols = [c for c in columns if c.dtype in ("integer", "float")]
    for kw in priority:
        for col in numeric_cols:
            if kw.lower() in col.name.lower():
                return col
    # 兜底:任何数值列(distinct 多的,排除编号类)
    for col in numeric_cols:
        if col.distinct_count is None or col.distinct_count > 20:
            return col
    return None


def _find_category_col(columns, exclude=None):
    exclude_names = {c.name for c in (exclude or []) if c}
    for col in columns:
        if col.name in exclude_names:
            continue
        if col.dtype == "text" and col.distinct_count is not None and 2 <= col.distinct_count <= 30:
            return col
    return None


def _find_customer_col(columns):
    return _find_col(columns, ("customer", "user", "客户", "用户", "uid"))


def _is_currency_col(col: ColumnInfo) -> bool:
    keywords = ("revenue", "amount", "sales", "price", "value", "cost",
                "profit", "total", "金额", "销售", "总额", "营业", "支出", "成本", "利润", "单价")
    return any(kw in col.name.lower() for kw in keywords)


def _get_table(session, table_name=None):
    """根据 table_name 取表;若 None,取第一个。"""
    if not session.tables:
        return None
    if table_name and table_name in session.tables:
        return session.tables[table_name]
    return next(iter(session.tables.values()))


# ============================================================
# 模板：销售概览
# ============================================================
def template_sales_overview(session: Session, lang: str, table_name: str | None = None) -> list[dict[str, Any]]:
    if not session.tables:
        return []
    table = _get_table(session, table_name)
    if not table:
        return []
    t = table.name
    cards = []
    revenue = _find_measure_col(table.columns)
    date_col = _find_date_col(table.columns)
    customer = _find_customer_col(table.columns)

    # KPI: 订单 / 记录
    kpi_label = tr("card.order_count" if customer else "card.row_count", lang)
    alias_kpi = tr("alias.order_count" if customer else "alias.row_count", lang)
    cards.append(_kpi(session, kpi_label,
                       f'SELECT COUNT(*) AS "{alias_kpi}" FROM "{t}"'))

    # KPI: 总销售
    if revenue:
        alias = tr("alias.total", lang)
        sql = f'SELECT ROUND(SUM("{revenue.name}"), 2) AS "{alias}" FROM "{t}"'
        cards.append(_kpi(
            session, tr("card.total_revenue", lang, col=revenue.name), sql,
            currency_cols=[alias] if _is_currency_col(revenue) else [],
        ))

    # KPI: 独立客户
    if customer:
        alias = tr("alias.customer_count", lang)
        cards.append(_kpi(
            session, tr("card.unique_customers", lang),
            f'SELECT COUNT(DISTINCT "{customer.name}") AS "{alias}" FROM "{t}"',
        ))

    # KPI: 客单价
    if revenue and customer:
        alias = tr("alias.avg_order_value", lang)
        cards.append(_kpi(
            session, tr("card.avg_order_value", lang),
            f'SELECT ROUND(AVG("{revenue.name}"), 2) AS "{alias}" FROM "{t}"',
            currency_cols=[alias] if _is_currency_col(revenue) else [],
        ))

    # 月度趋势
    if date_col and revenue:
        month = tr("alias.month", lang)
        cards.append(_chart(
            session, tr("card.monthly_trend", lang),
            tr("subtitle.agg_by", lang, col=date_col.name), "line",
            f'SELECT DATE_TRUNC(\'month\', "{date_col.name}") AS "{month}", '
            f'ROUND(SUM("{revenue.name}"), 2) AS "{revenue.name}" '
            f'FROM "{t}" GROUP BY "{month}" ORDER BY "{month}"',
            currency_cols=[revenue.name] if _is_currency_col(revenue) else [],
        ))

    # TOP 类别
    cat = _find_category_col(table.columns)
    if cat and revenue:
        cards.append(_chart(
            session, tr("card.top_by", lang, col=cat.name),
            tr("subtitle.top_n", lang, n=10), "bar",
            f'SELECT "{cat.name}", ROUND(SUM("{revenue.name}"), 2) AS "{revenue.name}" '
            f'FROM "{t}" GROUP BY "{cat.name}" '
            f'ORDER BY "{revenue.name}" DESC LIMIT 10',
            currency_cols=[revenue.name] if _is_currency_col(revenue) else [],
        ))

    return [c for c in cards if c is not None]


# ============================================================
# 模板：复购分析
# ============================================================
def template_repurchase(session: Session, lang: str, table_name: str | None = None) -> list[dict[str, Any]]:
    if not session.tables:
        return []
    table = _get_table(session, table_name)
    if not table:
        return []
    t = table.name
    customer = _find_customer_col(table.columns)
    if not customer:
        return [{"error": tr("warn.no_customer_col", lang)}]

    cards = []

    # 总客户数
    alias = tr("alias.customer_count", lang)
    cards.append(_kpi(
        session, tr("card.unique_customers", lang),
        f'SELECT COUNT(DISTINCT "{customer.name}") AS "{alias}" FROM "{t}"',
    ))

    # 复购客户数
    cards.append(_kpi(
        session, tr("card.repurchase_customers", lang),
        f'SELECT COUNT(*) AS "{alias}" FROM (SELECT "{customer.name}" FROM "{t}" '
        f'GROUP BY "{customer.name}" HAVING COUNT(*) > 1) sub',
    ))

    # 复购率
    rr_alias = tr("alias.repurchase_rate", lang)
    cards.append(_kpi(
        session, tr("card.repurchase_rate", lang),
        f'SELECT ROUND(100.0 * SUM(CASE WHEN cnt > 1 THEN 1 ELSE 0 END) / COUNT(*), 1) AS "{rr_alias}" '
        f'FROM (SELECT "{customer.name}", COUNT(*) AS cnt FROM "{t}" GROUP BY "{customer.name}") sub',
    ))

    # 平均订单/客户
    aoc_alias = tr("alias.avg_orders_per_customer", lang)
    cards.append(_kpi(
        session, tr("card.avg_orders_customer", lang),
        f'SELECT ROUND(COUNT(*) * 1.0 / COUNT(DISTINCT "{customer.name}"), 2) AS "{aoc_alias}" FROM "{t}"',
    ))

    # 频次分布
    freq = tr("alias.purchase_freq", lang)
    cc = tr("alias.customer_count", lang)
    cards.append(_chart(
        session, tr("card.order_freq_dist", lang),
        tr("subtitle.bucketed", lang), "bar",
        f"""WITH freq AS (
  SELECT "{customer.name}", COUNT(*) AS cnt FROM "{t}" GROUP BY "{customer.name}"
)
SELECT
  CASE
    WHEN cnt = 1 THEN '{tr("bucket.1", lang)}'
    WHEN cnt = 2 THEN '{tr("bucket.2", lang)}'
    WHEN cnt = 3 THEN '{tr("bucket.3", lang)}'
    WHEN cnt BETWEEN 4 AND 5 THEN '{tr("bucket.4_5", lang)}'
    WHEN cnt BETWEEN 6 AND 10 THEN '{tr("bucket.6_10", lang)}'
    ELSE '{tr("bucket.11_plus", lang)}'
  END AS "{freq}",
  COUNT(*) AS "{cc}"
FROM freq GROUP BY "{freq}" ORDER BY MIN(cnt)""",
    ))

    # 类别复购率
    cat = _find_category_col(table.columns, exclude=[customer])
    if cat:
        cards.append(_chart(
            session, tr("card.repurchase_by", lang, col=cat.name),
            tr("subtitle.top_n", lang, n=10), "bar",
            f"""WITH x AS (
  SELECT "{cat.name}", "{customer.name}", COUNT(*) AS cnt
  FROM "{t}" GROUP BY "{cat.name}", "{customer.name}"
)
SELECT "{cat.name}",
  ROUND(100.0 * SUM(CASE WHEN cnt > 1 THEN 1 ELSE 0 END) / COUNT(*), 1) AS "{rr_alias}"
FROM x GROUP BY "{cat.name}" ORDER BY "{rr_alias}" DESC LIMIT 10""",
        ))

    return [c for c in cards if c is not None]


# ============================================================
# 模板：渠道对比
# ============================================================
def template_channel(session: Session, lang: str, table_name: str | None = None) -> list[dict[str, Any]]:
    if not session.tables:
        return []
    table = _get_table(session, table_name)
    if not table:
        return []
    t = table.name
    channel = _find_col(table.columns, ("channel", "source", "platform", "渠道", "来源", "平台"))
    revenue = _find_measure_col(table.columns)
    customer = _find_customer_col(table.columns)

    if not channel:
        return [{"error": tr("warn.no_channel_col", lang)}]

    cards = []

    if revenue:
        cards.append(_chart(
            session, tr("card.channel_revenue", lang, col=revenue.name),
            tr("subtitle.agg_by", lang, col=channel.name), "bar",
            f'SELECT "{channel.name}", ROUND(SUM("{revenue.name}"), 2) AS "{revenue.name}" '
            f'FROM "{t}" GROUP BY "{channel.name}" ORDER BY "{revenue.name}" DESC',
            currency_cols=[revenue.name] if _is_currency_col(revenue) else [],
        ))

    oc = tr("alias.order_count", lang)
    cards.append(_chart(
        session, tr("card.channel_orders", lang),
        tr("subtitle.share_of", lang, col=channel.name), "pie",
        f'SELECT "{channel.name}", COUNT(*) AS "{oc}" '
        f'FROM "{t}" GROUP BY "{channel.name}" ORDER BY "{oc}" DESC',
    ))

    if revenue:
        aov = tr("alias.avg_order_value", lang)
        cards.append(_chart(
            session, tr("card.channel_aov", lang),
            tr("subtitle.agg_by", lang, col=channel.name), "bar",
            f'SELECT "{channel.name}", ROUND(AVG("{revenue.name}"), 2) AS "{aov}" '
            f'FROM "{t}" GROUP BY "{channel.name}" ORDER BY "{aov}" DESC',
            currency_cols=[aov] if _is_currency_col(revenue) else [],
        ))

    if customer:
        cc = tr("alias.customer_count", lang)
        cards.append(_chart(
            session, tr("card.channel_customers", lang),
            tr("subtitle.agg_by", lang, col=channel.name), "bar",
            f'SELECT "{channel.name}", COUNT(DISTINCT "{customer.name}") AS "{cc}" '
            f'FROM "{t}" GROUP BY "{channel.name}" ORDER BY "{cc}" DESC',
        ))

    return [c for c in cards if c is not None]


# ============================================================
# 模板：用户洞察
# ============================================================
def template_customer(session: Session, lang: str, table_name: str | None = None) -> list[dict[str, Any]]:
    if not session.tables:
        return []
    table = _get_table(session, table_name)
    if not table:
        return []
    t = table.name
    revenue = _find_measure_col(table.columns)
    cards = []

    region = _find_col(table.columns, ("region", "city", "province", "country", "地区", "城市", "省份"))
    age = _find_col(table.columns, ("age", "age_group", "年龄"))
    gender = _find_col(table.columns, ("gender", "sex", "性别"))

    if region and revenue:
        cards.append(_chart(
            session, tr("card.region_distribution", lang, col=region.name),
            tr("subtitle.top_n", lang, n=10), "bar",
            f'SELECT "{region.name}", ROUND(SUM("{revenue.name}"), 2) AS "{revenue.name}" '
            f'FROM "{t}" GROUP BY "{region.name}" ORDER BY "{revenue.name}" DESC LIMIT 10',
            currency_cols=[revenue.name] if _is_currency_col(revenue) else [],
        ))

    oc = tr("alias.order_count", lang)
    if age:
        cards.append(_chart(
            session, tr("card.distribution", lang, col=age.name),
            tr("subtitle.share_of", lang, col=age.name), "pie",
            f'SELECT "{age.name}", COUNT(*) AS "{oc}" '
            f'FROM "{t}" GROUP BY "{age.name}" ORDER BY "{oc}" DESC',
        ))

    if gender:
        cards.append(_chart(
            session, tr("card.distribution", lang, col=gender.name),
            tr("subtitle.share_of", lang, col=gender.name), "pie",
            f'SELECT "{gender.name}", COUNT(*) AS "{oc}" '
            f'FROM "{t}" GROUP BY "{gender.name}"',
        ))

    if age and gender and revenue:
        group = tr("alias.group", lang)
        cards.append(_chart(
            session, tr("card.cross_dimension", lang, a=age.name, b=gender.name),
            tr("subtitle.cross", lang), "bar",
            f'SELECT "{age.name}" || \' / \' || "{gender.name}" AS "{group}", '
            f'ROUND(SUM("{revenue.name}"), 2) AS "{revenue.name}" '
            f'FROM "{t}" GROUP BY "{group}" ORDER BY "{revenue.name}" DESC',
            currency_cols=[revenue.name] if _is_currency_col(revenue) else [],
        ))

    if not cards:
        return [{"error": tr("warn.no_demo_col", lang)}]
    return cards


# ============================================================
# 卡片构造
# ============================================================
def _kpi(session, title, sql, currency_cols=None):
    res = _safe_exec(session, sql)
    if res is None:
        return None
    res["currency_cols"] = currency_cols or []
    return {"title": title, "subtitle": "", "chart_type": "kpi",
            "sql": sql, "result": res}


def _chart(session, title, subtitle, chart_type, sql, currency_cols=None):
    res = _safe_exec(session, sql)
    if res is None or res.get("row_count", 0) == 0:
        return None
    res["currency_cols"] = currency_cols or []
    return {"title": title, "subtitle": subtitle, "chart_type": chart_type,
            "sql": sql, "result": res}


def _safe_exec(session, sql):
    try:
        return execute_sql(session, sql, max_rows=200)
    except SQLExecutionError:
        return None


# ============================================================
# 模板注册表
# ============================================================
TEMPLATES = {
    "sales_overview": {"title_key": "tpl.sales_overview", "icon": "trending-up", "fn": template_sales_overview},
    "repurchase":     {"title_key": "tpl.repurchase",     "icon": "refresh-cw",  "fn": template_repurchase},
    "channel":        {"title_key": "tpl.channel",        "icon": "git-branch",  "fn": template_channel},
    "customer":       {"title_key": "tpl.customer",       "icon": "users",       "fn": template_customer},
}


def run_template(session, template_id, lang="en", table_name=None):
    lang = normalize_lang(lang)
    tpl = TEMPLATES.get(template_id)
    if not tpl:
        return {"error": f"Unknown template: {template_id}", "cards": []}
    cards = tpl["fn"](session, lang, table_name)
    errors = [c["error"] for c in cards if isinstance(c, dict) and "error" in c]
    valid = [c for c in cards if "error" not in c]
    return {
        "template_id": template_id,
        "title": tr(tpl["title_key"], lang),
        "cards": valid,
        "warnings": errors,
    }


def list_templates(lang="en"):
    """供前端按当前语言列出模板。"""
    lang = normalize_lang(lang)
    return [
        {"id": tid, "title": tr(tpl["title_key"], lang), "icon": tpl["icon"]}
        for tid, tpl in TEMPLATES.items()
    ]


# ============================================================
# 预设问题库
# ============================================================
# label_key 是 i18n key; build 接收(t_name, measure, date, cat_col, lang)返回 sql
PRESET_QUESTIONS = [
    {
        "id": "sales_by_month",
        "category": "sales",
        "label_key": "preset.q.sales_by_month",
        "needs": ["date", "measure"],
        "chart_hint": "line",
        "build": lambda t, m, d, c, lang: (
            f'SELECT DATE_TRUNC(\'month\', "{d.name}") AS "{tr("alias.month", lang)}", '
            f'ROUND(SUM("{m.name}"), 2) AS "{m.name}" '
            f'FROM "{t}" GROUP BY "{tr("alias.month", lang)}" ORDER BY "{tr("alias.month", lang)}"'
        ),
        "is_currency": lambda m: _is_currency_col(m),
        "currency_col_name": lambda m: m.name,
    },
    {
        "id": "top_products",
        "category": "sales",
        "label_key": "preset.q.top_products",
        "needs": ["category", "measure"],
        "chart_hint": "bar",
        "build": lambda t, m, d, c, lang: (
            f'SELECT "{c.name}", ROUND(SUM("{m.name}"), 2) AS "{m.name}" '
            f'FROM "{t}" GROUP BY "{c.name}" ORDER BY "{m.name}" DESC LIMIT 10'
        ),
        "is_currency": lambda m: _is_currency_col(m),
        "currency_col_name": lambda m: m.name,
    },
    {
        "id": "daily_trend",
        "category": "sales",
        "label_key": "preset.q.daily_trend",
        "needs": ["date", "measure"],
        "chart_hint": "area",
        "build": lambda t, m, d, c, lang: (
            f'SELECT DATE_TRUNC(\'day\', "{d.name}") AS "{tr("alias.day", lang)}", '
            f'ROUND(SUM("{m.name}"), 2) AS "{m.name}" '
            f'FROM "{t}" GROUP BY "{tr("alias.day", lang)}" ORDER BY "{tr("alias.day", lang)}"'
        ),
        "is_currency": lambda m: _is_currency_col(m),
        "currency_col_name": lambda m: m.name,
    },
    {
        "id": "top_customers",
        "category": "customer",
        "label_key": "preset.q.top_customers",
        "needs": ["customer", "measure"],
        "chart_hint": "bar",
        "build": lambda t, m, d, c, lang: (
            f'SELECT "{c.name}", ROUND(SUM("{m.name}"), 2) AS "{m.name}" '
            f'FROM "{t}" GROUP BY "{c.name}" ORDER BY "{m.name}" DESC LIMIT 10'
        ),
        "is_currency": lambda m: _is_currency_col(m),
        "currency_col_name": lambda m: m.name,
    },
    {
        "id": "repurchase_rate",
        "category": "customer",
        "label_key": "preset.q.repurchase_rate",
        "needs": ["customer"],
        "chart_hint": "kpi",
        "build": lambda t, m, d, c, lang: (
            f'SELECT ROUND(100.0 * SUM(CASE WHEN cnt > 1 THEN 1 ELSE 0 END) / COUNT(*), 1) '
            f'AS "{tr("alias.repurchase_rate", lang)}" '
            f'FROM (SELECT "{c.name}", COUNT(*) AS cnt FROM "{t}" GROUP BY "{c.name}") sub'
        ),
        "is_currency": lambda m: False,
        "currency_col_name": lambda m: "",
    },
    {
        "id": "order_freq_distribution",
        "category": "customer",
        "label_key": "preset.q.order_freq_distribution",
        "needs": ["customer"],
        "chart_hint": "bar",
        "build": lambda t, m, d, c, lang: (
            f"""WITH freq AS (SELECT "{c.name}", COUNT(*) AS cnt FROM "{t}" GROUP BY "{c.name}")
SELECT
  CASE WHEN cnt = 1 THEN '{tr("bucket.1", lang)}' WHEN cnt = 2 THEN '{tr("bucket.2", lang)}'
       WHEN cnt = 3 THEN '{tr("bucket.3", lang)}' WHEN cnt BETWEEN 4 AND 5 THEN '{tr("bucket.4_5", lang)}'
       WHEN cnt BETWEEN 6 AND 10 THEN '{tr("bucket.6_10", lang)}' ELSE '{tr("bucket.11_plus", lang)}' END AS "{tr("alias.purchase_freq", lang)}",
  COUNT(*) AS "{tr("alias.customer_count", lang)}"
FROM freq GROUP BY "{tr("alias.purchase_freq", lang)}" ORDER BY MIN(cnt)"""
        ),
        "is_currency": lambda m: False,
        "currency_col_name": lambda m: "",
    },
    {
        "id": "total_revenue",
        "category": "overview",
        "label_key": "preset.q.total_revenue",
        "needs": ["measure"],
        "chart_hint": "kpi",
        "build": lambda t, m, d, c, lang: (
            f'SELECT ROUND(SUM("{m.name}"), 2) AS "{tr("alias.total", lang)}" FROM "{t}"'
        ),
        "is_currency": lambda m: _is_currency_col(m),
        "currency_col_name": lambda m: tr("alias.total", "en"),  # 注意,因为 alias 在前端展示,这里返回当前 lang 的 alias 由 get_preset_questions 处理
    },
    {
        "id": "row_count",
        "category": "overview",
        "label_key": "preset.q.row_count",
        "needs": [],
        "chart_hint": "kpi",
        "build": lambda t, m, d, c, lang: (
            f'SELECT COUNT(*) AS "{tr("alias.row_count", lang)}" FROM "{t}"'
        ),
        "is_currency": lambda m: False,
        "currency_col_name": lambda m: "",
    },
]


# 预设问题的标签翻译表（直接放这里,因为 i18n.py 已经够大）
PRESET_LABELS: dict[str, dict[str, str]] = {
    "preset.q.sales_by_month": {
        "en": "Sales by month", "zh": "按月统计销售额", "es": "Ventas por mes",
        "ja": "月別売上", "ko": "월별 매출", "fr": "Ventes par mois",
        "de": "Umsatz pro Monat", "pt": "Vendas por mês", "it": "Vendite per mese",
        "ru": "Продажи по месяцам",
    },
    "preset.q.top_products": {
        "en": "Top 10 products by revenue", "zh": "销售额 Top 10 产品",
        "es": "Top 10 productos", "ja": "売上 Top 10 商品",
        "ko": "매출 Top 10 상품", "fr": "Top 10 produits",
        "de": "Top 10 Produkte", "pt": "Top 10 produtos",
        "it": "Top 10 prodotti", "ru": "Топ-10 товаров",
    },
    "preset.q.daily_trend": {
        "en": "Daily sales trend", "zh": "每日销售趋势",
        "es": "Tendencia diaria", "ja": "日次売上推移",
        "ko": "일별 매출 추이", "fr": "Tendance quotidienne",
        "de": "Tagesumsatz", "pt": "Tendência diária",
        "it": "Andamento giornaliero", "ru": "Ежедневная динамика",
    },
    "preset.q.top_customers": {
        "en": "Top 10 customers", "zh": "Top 10 客户",
        "es": "Top 10 clientes", "ja": "Top 10 顧客",
        "ko": "Top 10 고객", "fr": "Top 10 clients",
        "de": "Top 10 Kunden", "pt": "Top 10 clientes",
        "it": "Top 10 clienti", "ru": "Топ-10 клиентов",
    },
    "preset.q.repurchase_rate": {
        "en": "Repurchase rate", "zh": "复购率",
        "es": "Tasa de recompra", "ja": "リピート率",
        "ko": "재구매율", "fr": "Taux de rachat",
        "de": "Wiederkaufsrate", "pt": "Taxa de recompra",
        "it": "Tasso di riacquisto", "ru": "Доля повторов",
    },
    "preset.q.order_freq_distribution": {
        "en": "Order frequency distribution", "zh": "客户订单数分布",
        "es": "Distribución de frecuencia", "ja": "注文回数分布",
        "ko": "주문 빈도 분포", "fr": "Distribution fréquence",
        "de": "Verteilung der Frequenz", "pt": "Distribuição frequência",
        "it": "Distribuzione frequenza", "ru": "Частота заказов",
    },
    "preset.q.total_revenue": {
        "en": "Total revenue", "zh": "总销售额",
        "es": "Ingresos totales", "ja": "総売上",
        "ko": "총 매출", "fr": "Revenu total",
        "de": "Gesamtumsatz", "pt": "Receita total",
        "it": "Ricavi totali", "ru": "Общая выручка",
    },
    "preset.q.row_count": {
        "en": "Total records", "zh": "总记录数",
        "es": "Total registros", "ja": "総レコード数",
        "ko": "총 레코드", "fr": "Enregistrements",
        "de": "Datensätze gesamt", "pt": "Total registros",
        "it": "Record totali", "ru": "Всего записей",
    },
}


def _preset_label(key: str, lang: str) -> str:
    entry = PRESET_LABELS.get(key, {})
    return entry.get(lang) or entry.get("en") or key


def get_preset_questions(session, lang="en", table_name=None):
    lang = normalize_lang(lang)
    if not session.tables:
        return []
    table = _get_table(session, table_name)
    if not table:
        return []
    cols = table.columns
    measure = _find_measure_col(cols)
    date = _find_date_col(cols)
    customer = _find_customer_col(cols)
    category = _find_category_col(cols, exclude=[customer])
    avail = {"measure": measure, "date": date, "customer": customer, "category": category}

    results = []
    for q in PRESET_QUESTIONS:
        if not all(avail.get(need) is not None for need in q["needs"]):
            continue
        try:
            sql = q["build"](table.name, measure, date, category or customer, lang)
        except Exception:
            continue
        # 货币标记
        currency_col_name = ""
        if measure and q["is_currency"](measure):
            cc = q.get("currency_col_name")
            if cc:
                resolved = cc(measure)
                currency_col_name = resolved if resolved != tr("alias.total", "en") else tr("alias.total", lang)
        results.append({
            "id": q["id"],
            "category": q["category"],
            "label": _preset_label(q["label_key"], lang),
            "chart_hint": q["chart_hint"],
            "sql": sql,
            "currency_col": currency_col_name,
        })
    return results
