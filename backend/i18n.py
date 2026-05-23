"""
后端多语言文案表
==============
所有面向用户的字符串（卡片标题、SQL 列别名、subtitle）都从这里取。
按语言代码返回。未配置的语言回退到英文。
"""
from __future__ import annotations

# 10 种语言一致与前端 i18n.tsx
SUPPORTED_LANGS = ("en", "zh", "es", "ja", "ko", "fr", "de", "pt", "it", "ru")

# 文案表：key → {lang: text}
# 占位符用 {col} / {n} 表示
TRANSLATIONS: dict[str, dict[str, str]] = {
    # ---- 通用列别名（用在 SQL 的 AS 后面）----
    "alias.month": {
        "en": "Month", "zh": "月份", "es": "Mes", "ja": "月", "ko": "월",
        "fr": "Mois", "de": "Monat", "pt": "Mês", "it": "Mese", "ru": "Месяц",
    },
    "alias.day": {
        "en": "Day", "zh": "日期", "es": "Día", "ja": "日", "ko": "일",
        "fr": "Jour", "de": "Tag", "pt": "Dia", "it": "Giorno", "ru": "День",
    },
    "alias.total": {
        "en": "Total", "zh": "合计", "es": "Total", "ja": "合計", "ko": "합계",
        "fr": "Total", "de": "Gesamt", "pt": "Total", "it": "Totale", "ru": "Итого",
    },
    "alias.row_count": {
        "en": "Records", "zh": "记录数", "es": "Registros", "ja": "レコード数", "ko": "레코드 수",
        "fr": "Enregistrements", "de": "Datensätze", "pt": "Registros", "it": "Record", "ru": "Записи",
    },
    "alias.order_count": {
        "en": "Orders", "zh": "订单数", "es": "Pedidos", "ja": "注文数", "ko": "주문 수",
        "fr": "Commandes", "de": "Bestellungen", "pt": "Pedidos", "it": "Ordini", "ru": "Заказы",
    },
    "alias.customer_count": {
        "en": "Customers", "zh": "客户数", "es": "Clientes", "ja": "顧客数", "ko": "고객 수",
        "fr": "Clients", "de": "Kunden", "pt": "Clientes", "it": "Clienti", "ru": "Клиенты",
    },
    "alias.repurchase_rate": {
        "en": "Repurchase Rate (%)", "zh": "复购率 (%)", "es": "Tasa Recompra (%)",
        "ja": "リピート率 (%)", "ko": "재구매율 (%)", "fr": "Taux Rachat (%)",
        "de": "Wiederkaufsrate (%)", "pt": "Taxa Recompra (%)", "it": "Tasso Riacquisto (%)",
        "ru": "Повтор покупок (%)",
    },
    "alias.purchase_freq": {
        "en": "Purchase Frequency", "zh": "购买频次", "es": "Frecuencia de Compra",
        "ja": "購買頻度", "ko": "구매 빈도", "fr": "Fréquence d'achat",
        "de": "Kaufhäufigkeit", "pt": "Frequência de Compra", "it": "Frequenza Acquisto",
        "ru": "Частота покупок",
    },
    "alias.group": {
        "en": "Group", "zh": "群体", "es": "Grupo", "ja": "グループ", "ko": "그룹",
        "fr": "Groupe", "de": "Gruppe", "pt": "Grupo", "it": "Gruppo", "ru": "Группа",
    },
    "alias.avg_order_value": {
        "en": "Avg Order Value", "zh": "客单价", "es": "Valor Promedio",
        "ja": "平均注文額", "ko": "객단가", "fr": "Panier moyen",
        "de": "Ø Bestellwert", "pt": "Ticket Médio", "it": "Valore Medio", "ru": "Ср. чек",
    },
    "alias.avg_orders_per_customer": {
        "en": "Avg Orders / Customer", "zh": "平均订单/客户", "es": "Pedidos Prom/Cliente",
        "ja": "平均注文/顧客", "ko": "평균 주문/고객", "fr": "Cmd moy/client",
        "de": "Ø Bestellungen/Kunde", "pt": "Pedidos Méd/Cliente", "it": "Ordini Medi/Cliente",
        "ru": "Ср. заказов/клиент",
    },

    # ---- 频次分桶标签 ----
    "bucket.1": {
        "en": "1 (new)", "zh": "1 次 (新客)", "es": "1 (nuevo)", "ja": "1回 (新規)",
        "ko": "1회 (신규)", "fr": "1 (nouveau)", "de": "1 (neu)", "pt": "1 (novo)",
        "it": "1 (nuovo)", "ru": "1 (новый)",
    },
    "bucket.2": {"en": "2", "zh": "2 次", "es": "2", "ja": "2回", "ko": "2회",
                 "fr": "2", "de": "2", "pt": "2", "it": "2", "ru": "2"},
    "bucket.3": {"en": "3", "zh": "3 次", "es": "3", "ja": "3回", "ko": "3회",
                 "fr": "3", "de": "3", "pt": "3", "it": "3", "ru": "3"},
    "bucket.4_5": {"en": "4-5", "zh": "4-5 次", "es": "4-5", "ja": "4-5回",
                   "ko": "4-5회", "fr": "4-5", "de": "4-5", "pt": "4-5", "it": "4-5", "ru": "4-5"},
    "bucket.6_10": {"en": "6-10", "zh": "6-10 次", "es": "6-10", "ja": "6-10回",
                    "ko": "6-10회", "fr": "6-10", "de": "6-10", "pt": "6-10", "it": "6-10", "ru": "6-10"},
    "bucket.11_plus": {
        "en": "11+ (loyal)", "zh": "11+ 次 (忠诚)", "es": "11+ (leal)", "ja": "11+ (忠実)",
        "ko": "11+ (충성)", "fr": "11+ (fidèle)", "de": "11+ (treu)", "pt": "11+ (leal)",
        "it": "11+ (fedele)", "ru": "11+ (лояльный)",
    },

    # ---- 仪表盘卡片标题 ----
    "card.row_count": {
        "en": "Total Records", "zh": "总记录数", "es": "Total Registros",
        "ja": "総レコード数", "ko": "총 레코드", "fr": "Enregistrements Totaux",
        "de": "Datensätze Gesamt", "pt": "Total de Registros", "it": "Record Totali",
        "ru": "Всего записей",
    },
    "card.order_count": {
        "en": "Total Orders", "zh": "总订单数", "es": "Pedidos Totales",
        "ja": "総注文数", "ko": "총 주문", "fr": "Commandes Totales",
        "de": "Bestellungen Gesamt", "pt": "Total de Pedidos", "it": "Ordini Totali",
        "ru": "Всего заказов",
    },
    "card.total_revenue": {
        "en": "Total Revenue", "zh": "总销售额", "es": "Ingresos Totales",
        "ja": "総売上", "ko": "총 매출", "fr": "Revenu Total",
        "de": "Gesamtumsatz", "pt": "Receita Total", "it": "Ricavi Totali",
        "ru": "Общая выручка",
    },
    "card.unique_customers": {
        "en": "Unique Customers", "zh": "独立客户数", "es": "Clientes Únicos",
        "ja": "ユニーク顧客数", "ko": "고유 고객 수", "fr": "Clients Uniques",
        "de": "Einzigartige Kunden", "pt": "Clientes Únicos", "it": "Clienti Unici",
        "ru": "Уникальные клиенты",
    },
    "card.avg_order_value": {
        "en": "Avg Order Value", "zh": "客单价", "es": "Valor Promedio",
        "ja": "平均注文額", "ko": "객단가", "fr": "Panier Moyen",
        "de": "Ø Bestellwert", "pt": "Ticket Médio", "it": "Valore Medio",
        "ru": "Средний чек",
    },
    "card.monthly_trend": {
        "en": "Monthly Sales Trend", "zh": "月度销售趋势",
        "es": "Tendencia Mensual", "ja": "月次売上推移", "ko": "월별 매출 추이",
        "fr": "Tendance Mensuelle", "de": "Monatliche Entwicklung",
        "pt": "Tendência Mensal", "it": "Andamento Mensile", "ru": "Месячная динамика",
    },

    # ---- Overview KPIs (hero view) ----
    "kpi.total_records": {
        "en": "Total Records", "zh": "总记录数", "es": "Total Registros",
        "ja": "総レコード数", "ko": "총 레코드", "fr": "Total Enregistrements",
        "de": "Datensätze Gesamt", "pt": "Total Registros", "it": "Record Totali",
        "ru": "Всего записей",
    },
    "kpi.total_revenue": {
        "en": "Total Revenue", "zh": "总收入", "es": "Ingresos Totales",
        "ja": "総売上", "ko": "총 매출", "fr": "Revenu Total",
        "de": "Gesamtumsatz", "pt": "Receita Total", "it": "Ricavi Totali",
        "ru": "Общая выручка",
    },
    "kpi.average_order": {
        "en": "Avg Order Value", "zh": "客单价", "es": "Valor Promedio",
        "ja": "平均注文額", "ko": "객단가", "fr": "Panier Moyen",
        "de": "Ø Bestellwert", "pt": "Ticket Médio", "it": "Valore Medio",
        "ru": "Средний чек",
    },
    "kpi.peak_day": {
        "en": "Peak Day", "zh": "最高单日", "es": "Mejor Día",
        "ja": "最高日", "ko": "최고일", "fr": "Meilleur Jour",
        "de": "Spitzentag", "pt": "Melhor Dia", "it": "Giorno Top",
        "ru": "Пик дня",
    },
    "hero.pie_title": {
        "en": "Revenue by {dim}", "zh": "{dim} 收入占比", "es": "Ingresos por {dim}",
        "ja": "{dim} 別売上", "ko": "{dim}별 매출", "fr": "Revenu par {dim}",
        "de": "Umsatz nach {dim}", "pt": "Receita por {dim}", "it": "Ricavi per {dim}",
        "ru": "Выручка по {dim}",
    },
    "hero.trend_title": {
        "en": "Monthly Revenue Trend", "zh": "月度收入趋势", "es": "Tendencia Mensual",
        "ja": "月次収入推移", "ko": "월별 매출 추이", "fr": "Tendance Mensuelle",
        "de": "Monatliche Umsatzentwicklung", "pt": "Tendência Mensal de Receita",
        "it": "Andamento Mensile Ricavi", "ru": "Динамика выручки по месяцам",
    },
    "card.top_by": {
        "en": "Top {col}", "zh": "{col} 排名", "es": "Top {col}",
        "ja": "{col} ランキング", "ko": "{col} 순위", "fr": "Top {col}",
        "de": "Top {col}", "pt": "Top {col}", "it": "Top {col}", "ru": "Топ {col}",
    },
    "card.distribution": {
        "en": "{col} Distribution", "zh": "{col} 分布",
        "es": "Distribución de {col}", "ja": "{col} 分布",
        "ko": "{col} 분포", "fr": "Distribution de {col}",
        "de": "{col}-Verteilung", "pt": "Distribuição de {col}",
        "it": "Distribuzione {col}", "ru": "Распределение {col}",
    },
    "card.repurchase_customers": {
        "en": "Repurchase Customers", "zh": "复购客户数",
        "es": "Clientes Recompra", "ja": "リピート顧客数", "ko": "재구매 고객",
        "fr": "Clients Rachat", "de": "Wiederkäufer", "pt": "Clientes Recompra",
        "it": "Clienti Riacquisto", "ru": "Повторные клиенты",
    },
    "card.repurchase_rate": {
        "en": "Repurchase Rate %", "zh": "复购率 %",
        "es": "Tasa Recompra %", "ja": "リピート率 %", "ko": "재구매율 %",
        "fr": "Taux Rachat %", "de": "Wiederkaufsrate %", "pt": "Taxa Recompra %",
        "it": "Tasso Riacquisto %", "ru": "Доля повторов %",
    },
    "card.avg_orders_customer": {
        "en": "Avg Orders / Customer", "zh": "平均订单/客户",
        "es": "Pedidos Prom/Cliente", "ja": "平均注文/顧客",
        "ko": "평균 주문/고객", "fr": "Cmd moy / client",
        "de": "Ø Bestell./Kunde", "pt": "Pedidos Méd/Cliente",
        "it": "Ordini Medi/Cliente", "ru": "Ср. заказов/клиент",
    },
    "card.order_freq_dist": {
        "en": "Customer Order Frequency", "zh": "客户订单数分布",
        "es": "Frecuencia de Pedidos", "ja": "顧客注文回数分布",
        "ko": "고객 주문 빈도", "fr": "Fréquence des commandes",
        "de": "Bestellfrequenz", "pt": "Frequência de Pedidos",
        "it": "Frequenza Ordini", "ru": "Частота заказов",
    },
    "card.repurchase_by": {
        "en": "{col} Repurchase Rate", "zh": "{col} 复购率",
        "es": "Tasa Recompra por {col}", "ja": "{col}別 リピート率",
        "ko": "{col}별 재구매율", "fr": "Taux rachat par {col}",
        "de": "Wiederkaufsrate nach {col}", "pt": "Recompra por {col}",
        "it": "Riacquisto per {col}", "ru": "Повторы по {col}",
    },
    "card.channel_revenue": {
        "en": "{col} by Channel", "zh": "各渠道 {col}",
        "es": "{col} por canal", "ja": "チャネル別 {col}",
        "ko": "채널별 {col}", "fr": "{col} par canal",
        "de": "{col} nach Kanal", "pt": "{col} por canal",
        "it": "{col} per canale", "ru": "{col} по каналам",
    },
    "card.channel_orders": {
        "en": "Orders by Channel", "zh": "各渠道订单数",
        "es": "Pedidos por canal", "ja": "チャネル別注文数",
        "ko": "채널별 주문", "fr": "Commandes par canal",
        "de": "Bestellungen nach Kanal", "pt": "Pedidos por canal",
        "it": "Ordini per canale", "ru": "Заказы по каналам",
    },
    "card.channel_aov": {
        "en": "Avg Order Value by Channel", "zh": "各渠道客单价",
        "es": "Valor Prom por Canal", "ja": "チャネル別 客単価",
        "ko": "채널별 객단가", "fr": "Panier moyen / canal",
        "de": "Ø Wert nach Kanal", "pt": "Ticket Médio por Canal",
        "it": "Valore Medio per Canale", "ru": "Ср. чек по каналам",
    },
    "card.channel_customers": {
        "en": "Unique Customers by Channel", "zh": "各渠道独立客户数",
        "es": "Clientes Únicos por Canal", "ja": "チャネル別 顧客数",
        "ko": "채널별 고객", "fr": "Clients uniques / canal",
        "de": "Kunden nach Kanal", "pt": "Clientes por Canal",
        "it": "Clienti per Canale", "ru": "Клиенты по каналам",
    },
    "card.region_distribution": {
        "en": "Distribution by {col}", "zh": "按 {col} 分布",
        "es": "Distribución por {col}", "ja": "{col}別 分布",
        "ko": "{col}별 분포", "fr": "Distribution par {col}",
        "de": "Verteilung nach {col}", "pt": "Distribuição por {col}",
        "it": "Distribuzione per {col}", "ru": "Распределение по {col}",
    },
    "card.cross_dimension": {
        "en": "{a} × {b}", "zh": "{a} × {b}",
        "es": "{a} × {b}", "ja": "{a} × {b}", "ko": "{a} × {b}",
        "fr": "{a} × {b}", "de": "{a} × {b}", "pt": "{a} × {b}",
        "it": "{a} × {b}", "ru": "{a} × {b}",
    },

    # ---- 卡片副标题 ----
    "subtitle.from_file": {
        "en": "From {file}", "zh": "来自 {file}",
        "es": "De {file}", "ja": "{file} より", "ko": "{file} 에서",
        "fr": "Depuis {file}", "de": "Aus {file}", "pt": "De {file}",
        "it": "Da {file}", "ru": "Из {file}",
    },
    "subtitle.sum_all": {
        "en": "Sum of all data", "zh": "全部数据求和",
        "es": "Suma de todos", "ja": "全データの合計", "ko": "전체 합계",
        "fr": "Somme totale", "de": "Summe gesamt", "pt": "Soma total",
        "it": "Somma totale", "ru": "Сумма всего",
    },
    "subtitle.agg_by": {
        "en": "Aggregated by {col}", "zh": "按 {col} 聚合",
        "es": "Agregado por {col}", "ja": "{col} 別集計", "ko": "{col} 별 집계",
        "fr": "Agrégé par {col}", "de": "Aggregiert nach {col}",
        "pt": "Agregado por {col}", "it": "Aggregato per {col}",
        "ru": "Агрегация по {col}",
    },
    "subtitle.top_n": {
        "en": "Top {n}", "zh": "前 {n}",
        "es": "Top {n}", "ja": "上位 {n}", "ko": "상위 {n}",
        "fr": "Top {n}", "de": "Top {n}", "pt": "Top {n}",
        "it": "Top {n}", "ru": "Топ {n}",
    },
    "subtitle.sorted_by": {
        "en": "Sorted by {col}", "zh": "按 {col} 排序",
        "es": "Ordenado por {col}", "ja": "{col} で並び替え",
        "ko": "{col} 정렬", "fr": "Trié par {col}",
        "de": "Sortiert nach {col}", "pt": "Ordenado por {col}",
        "it": "Ordinato per {col}", "ru": "По {col}",
    },
    "subtitle.share_of": {
        "en": "Share of {col}", "zh": "{col} 占比",
        "es": "Cuota de {col}", "ja": "{col} の構成比",
        "ko": "{col} 비중", "fr": "Part de {col}",
        "de": "Anteil {col}", "pt": "Participação de {col}",
        "it": "Quota di {col}", "ru": "Доля {col}",
    },
    "subtitle.bucketed": {
        "en": "Frequency buckets", "zh": "购买频次分群",
        "es": "Por frecuencia", "ja": "頻度別グループ", "ko": "빈도 그룹",
        "fr": "Par fréquence", "de": "Nach Frequenz", "pt": "Por frequência",
        "it": "Per frequenza", "ru": "По частоте",
    },
    "subtitle.cross": {
        "en": "Cross-dimension comparison", "zh": "交叉对比",
        "es": "Comparación cruzada", "ja": "クロス比較",
        "ko": "교차 비교", "fr": "Comparaison croisée",
        "de": "Kreuzvergleich", "pt": "Comparação cruzada",
        "it": "Confronto incrociato", "ru": "Перекрёстное сравнение",
    },

    # ---- 警告 / 错误 ----
    "warn.no_customer_col": {
        "en": "No customer/user ID column found. Repurchase analysis requires a customer_id column.",
        "zh": "未找到客户/用户 ID 列。复购分析需要 customer_id 列。",
        "es": "No se encontró columna de cliente/usuario. Se necesita customer_id.",
        "ja": "顧客/ユーザー ID 列が見つかりません。customer_id 列が必要です。",
        "ko": "고객/사용자 ID 컬럼이 없습니다. customer_id 컬럼이 필요합니다.",
        "fr": "Aucune colonne client/utilisateur. customer_id requise.",
        "de": "Keine Kunden-/Benutzer-ID-Spalte. customer_id erforderlich.",
        "pt": "Coluna de cliente/usuário não encontrada. Necessária customer_id.",
        "it": "Colonna cliente/utente non trovata. Necessario customer_id.",
        "ru": "Не найдена колонка клиента/пользователя. Нужна customer_id.",
    },
    "warn.no_channel_col": {
        "en": "No channel column. Make sure data has channel/source/platform column.",
        "zh": "未找到渠道列。请确保数据有 channel/source/平台 等列。",
        "es": "Sin columna de canal. Asegúrese de tener channel/source.",
        "ja": "チャネル列が見つかりません。channel/source 列が必要です。",
        "ko": "채널 컬럼이 없습니다. channel/source 컬럼이 필요합니다.",
        "fr": "Pas de colonne canal. Besoin de channel/source.",
        "de": "Keine Kanal-Spalte. channel/source nötig.",
        "pt": "Sem coluna de canal. Necessário channel/source.",
        "it": "Nessuna colonna canale. Serve channel/source.",
        "ru": "Нет колонки канала. Нужна channel/source.",
    },
    "warn.no_demo_col": {
        "en": "No customer demographic columns found (region/age/gender etc.)",
        "zh": "未找到用户人口统计维度(region/age/gender 等)",
        "es": "Sin columnas demográficas (region/age/gender)",
        "ja": "顧客人口統計列が見つかりません (region/age/gender)",
        "ko": "고객 인구통계 컬럼 없음 (region/age/gender)",
        "fr": "Pas de colonnes démographiques (region/age/gender)",
        "de": "Keine demografischen Spalten (region/age/gender)",
        "pt": "Sem colunas demográficas (region/age/gender)",
        "it": "Nessuna colonna demografica (region/age/gender)",
        "ru": "Нет демографических колонок (region/age/gender)",
    },

    # ---- 模板标题 ----
    "tpl.sales_overview": {
        "en": "Sales Overview", "zh": "销售概览",
        "es": "Resumen de Ventas", "ja": "売上概要", "ko": "매출 개요",
        "fr": "Aperçu des Ventes", "de": "Verkaufsübersicht",
        "pt": "Visão Geral de Vendas", "it": "Panoramica Vendite",
        "ru": "Обзор продаж",
    },
    "tpl.repurchase": {
        "en": "Repurchase Analysis", "zh": "复购分析",
        "es": "Análisis de Recompra", "ja": "リピート分析", "ko": "재구매 분석",
        "fr": "Analyse de Rachat", "de": "Wiederkaufsanalyse",
        "pt": "Análise de Recompra", "it": "Analisi Riacquisto",
        "ru": "Анализ повторов",
    },
    "tpl.channel": {
        "en": "Channel Comparison", "zh": "渠道对比",
        "es": "Comparación de Canales", "ja": "チャネル比較",
        "ko": "채널 비교", "fr": "Comparaison de Canaux",
        "de": "Kanalvergleich", "pt": "Comparação de Canais",
        "it": "Confronto Canali", "ru": "Сравнение каналов",
    },
    "tpl.customer": {
        "en": "Customer Insights", "zh": "用户洞察",
        "es": "Insights de Clientes", "ja": "顧客インサイト",
        "ko": "고객 인사이트", "fr": "Insights Clients",
        "de": "Kunden-Insights", "pt": "Insights de Clientes",
        "it": "Insight Clienti", "ru": "Аналитика клиентов",
    },

    # ---- 预设问题分类 ----
    "preset.cat.sales": {
        "en": "Sales", "zh": "销售", "es": "Ventas", "ja": "売上", "ko": "판매",
        "fr": "Ventes", "de": "Verkauf", "pt": "Vendas", "it": "Vendite", "ru": "Продажи",
    },
    "preset.cat.customer": {
        "en": "Customers", "zh": "客户", "es": "Clientes", "ja": "顧客", "ko": "고객",
        "fr": "Clients", "de": "Kunden", "pt": "Clientes", "it": "Clienti", "ru": "Клиенты",
    },
    "preset.cat.overview": {
        "en": "Overview", "zh": "总览", "es": "Resumen", "ja": "概要", "ko": "개요",
        "fr": "Aperçu", "de": "Übersicht", "pt": "Visão Geral", "it": "Panoramica", "ru": "Обзор",
    },
}


def tr(key: str, lang: str = "en", **kwargs) -> str:
    """Translate by key + lang, fill in placeholders."""
    entry = TRANSLATIONS.get(key, {})
    text = entry.get(lang) or entry.get("en") or key
    if kwargs:
        for k, v in kwargs.items():
            text = text.replace("{" + k + "}", str(v))
    return text


def normalize_lang(lang: str | None) -> str:
    """Normalize a lang code to a supported one (fallback to en)."""
    if not lang:
        return "en"
    lang = lang.lower()[:2]
    return lang if lang in SUPPORTED_LANGS else "en"
