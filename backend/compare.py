"""
多数据集对比模块 (Stage 3 Step 3)
===================================
- detect_comparable_tables(): 找出 session 里所有相似度 >= 80% 的表组
- enable_compare_mode(): 把选中的表 UNION ALL 成一张大表 (加 __dataset 列)
- disable_compare_mode(): 拆掉合并表, 恢复独立模式
- get_compare_status(): 当前 session 是不是在比较模式
"""

from __future__ import annotations
import re
from typing import Any
from database import Session

SIMILARITY_THRESHOLD = 0.95  # 80% 列匹配率视为可对比


def _normalize_col_name(name: str) -> str:
    """customer_id, Customer ID, customerId -> customerid"""
    return re.sub(r"[^a-z0-9]", "", name.lower())


def _column_similarity(cols_a: list, cols_b: list) -> dict:
    """
    返回 {match_pct, matched_names, missing_in_b, missing_in_a}
    其中 cols_a/b 是 ColumnInfo 列表
    """
    map_a = {_normalize_col_name(c.name): c for c in cols_a}
    map_b = {_normalize_col_name(c.name): c for c in cols_b}
    common_keys = set(map_a.keys()) & set(map_b.keys())

    # 类型也要相似 (粗略: 数值 vs 数值, 文本 vs 文本)
    matched = []
    for k in common_keys:
        ta = (map_a[k].dtype or "").upper()
        tb = (map_b[k].dtype or "").upper()
        is_num_a = any(t in ta for t in ("INT","DECIMAL","DOUBLE","FLOAT","NUMERIC","BIGINT"))
        is_num_b = any(t in tb for t in ("INT","DECIMAL","DOUBLE","FLOAT","NUMERIC","BIGINT"))
        if is_num_a == is_num_b:  # 同为数值或同为非数值
            matched.append(map_a[k].name)

    denom = max(len(cols_a), len(cols_b))
    pct = len(matched) / denom if denom else 0.0

    return {
        "match_pct": round(pct * 100, 1),
        "matched_columns": matched,
        "matched_count": len(matched),
        "total_a": len(cols_a),
        "total_b": len(cols_b),
    }


def detect_comparable_tables(session: Session) -> dict:
    """
    扫描 session 里所有表, 返回相似度 >= 80% 的组。
    返回: {"groups": [{"tables": [name1, name2], "match_pct": 100.0, "matched_columns": [...]}, ...]}
    """
    # 排除内部表 (snapshot, dedup tmp, compare merged)
    real_tables = [
        (name, table) for name, table in session.tables.items()
        if not name.startswith("__") and not name.endswith("__")
    ]
    if len(real_tables) < 2:
        return {"groups": []}

    groups = []
    used = set()
    for i, (name_a, table_a) in enumerate(real_tables):
        if name_a in used:
            continue
        group_members = [name_a]
        group_meta = None
        for j, (name_b, table_b) in enumerate(real_tables[i+1:], start=i+1):
            if name_b in used:
                continue
            sim = _column_similarity(table_a.columns, table_b.columns)
            if sim["match_pct"] >= SIMILARITY_THRESHOLD * 100:
                group_members.append(name_b)
                used.add(name_b)
                if group_meta is None:
                    group_meta = sim
        if len(group_members) >= 2:
            used.add(name_a)
            groups.append({
                "tables": group_members,
                "match_pct": group_meta["match_pct"],
                "matched_columns": group_meta["matched_columns"],
                "matched_count": group_meta["matched_count"],
            })

    return {"groups": groups}


COMPARE_TABLE_NAME = "__compare_merged__"


def enable_compare_mode(session: Session, table_names: list[str]) -> dict:
    """
    把多个表 UNION ALL 成一张合并表, 加一列 __dataset 标记来源。
    把合并表注册到 session.tables, 标记为 active_table。
    每次调用都先清理旧合并表 + compare_mode 状态, 支持切换对比组。
    """
    if not table_names or len(table_names) < 2:
        return {"ok": False, "error": "need at least 2 tables"}

    # 清理旧 compare 状态 (允许切换对比组)
    disable_compare_mode(session)  # cleanup old state

    valid = [t for t in table_names if t in session.tables]
    if len(valid) < 2:
        return {"ok": False, "error": "less than 2 valid tables in session"}

    # 找出共同列 (按 normalized 列名)
    first_cols = {_normalize_col_name(c.name): c for c in session.tables[valid[0]].columns}
    common_norm = set(first_cols.keys())
    for t in valid[1:]:
        cols_b = {_normalize_col_name(c.name): c for c in session.tables[t].columns}
        common_norm &= set(cols_b.keys())

    if not common_norm:
        return {"ok": False, "error": "no common columns across selected tables"}

    # 用第一张表的原始列名作为统一列名 (其他表用 normalized 对齐)
    common_cols_in_order = [c.name for c in session.tables[valid[0]].columns
                            if _normalize_col_name(c.name) in common_norm]

    # 为每张表生成 SELECT __dataset, col1, col2 ... 的子查询
    select_parts = []
    for tname in valid:
        # 对照: 这张表里 normalized -> 实际列名
        norm_to_real = {_normalize_col_name(c.name): c.name for c in session.tables[tname].columns}
        col_exprs = []
        for first_col in common_cols_in_order:
            target_norm = _normalize_col_name(first_col)
            real_col = norm_to_real.get(target_norm)
            if real_col:
                col_exprs.append(f'"{real_col}" AS "{first_col}"')
            else:
                col_exprs.append(f'NULL AS "{first_col}"')
        select_parts.append(
            f'SELECT \'{tname}\' AS __dataset, ' + ", ".join(col_exprs) + f' FROM "{tname}"'
        )

    union_sql = " UNION ALL ".join(select_parts)
    create_sql = f'CREATE OR REPLACE TABLE "{COMPARE_TABLE_NAME}" AS {union_sql}'

    try:
        session.conn.execute(create_sql)
        # 注册到 session.tables (复用 add_table_from_file 的部分逻辑 — 简化: 让 list_tables 能看到)
        # 但 add_table_from_file 需要文件 content, 我们用 internal helper 重新读 schema
        from database import _read_columns_metadata
        cols, row_count, preview = _read_columns_metadata(session.conn, COMPARE_TABLE_NAME)
        # 包成 TableInfo
        from database import TableInfo
        ti = TableInfo(
            name=COMPARE_TABLE_NAME,
            original_filename="(compare mode merged)",
            columns=cols,
            row_count=row_count,
            preview_rows=preview,
        )
        session.tables[COMPARE_TABLE_NAME] = ti
        # 标记 session 在比较模式
        session.compare_mode = {
            "active": True,
            "source_tables": valid,
            "merged_table": COMPARE_TABLE_NAME,
        }
        return {
            "ok": True,
            "merged_table": COMPARE_TABLE_NAME,
            "source_tables": valid,
            "row_count": row_count,
        }
    except Exception as e:
        return {"ok": False, "error": f"merge failed: {e}"}


def disable_compare_mode(session: Session) -> dict:
    """删除合并表, 恢复独立模式。"""
    try:
        session.conn.execute(f'DROP TABLE IF EXISTS "{COMPARE_TABLE_NAME}"')
        session.tables.pop(COMPARE_TABLE_NAME, None)
        if hasattr(session, "compare_mode"):
            session.compare_mode = {"active": False}
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def get_compare_status(session: Session) -> dict:
    """当前 session 是不是在比较模式? 返回元数据供前端 UI 用。"""
    cm = getattr(session, "compare_mode", None) or {"active": False}
    return cm



def generate_compare_overview(session, lang: str = "en") -> dict:
    """
    在 compare 模式下生成 overview。
    后端返回的结构兼容前端原 overview, 额外加一个 'comparison' 字段:
    {
        "kpis": [...],   # 主 KPI (跟正常一样, 但基于合并表)
        "pie": null,     # compare 模式下 pie 暂不画 (太复杂)
        "trend": {...},  # 跟正常一样, 单条线
        "comparison": {
            "datasets": ["march_sales", "april_sales"],  # 按文件名
            "kpi_by_dataset": {           # 每个 KPI 在每个 dataset 的值
                "revenue":  {"march_sales": 1000, "april_sales": 1200},
                "orders":   {"march_sales": 3,    "april_sales": 4},
            },
            "trend_by_dataset": {         # 每个 dataset 的月度走势
                "march_sales": [{"month": "2025-03", "value": 1000}],
                "april_sales": [{"month": "2025-04", "value": 1200}],
            }
        }
    }
    """
    from i18n import tr, normalize_lang
    from dashboard import _find_columns_by_type, _is_currency_col, _safe_exec

    lang = normalize_lang(lang)
    cm = getattr(session, "compare_mode", None) or {}
    if not cm.get("active") or COMPARE_TABLE_NAME not in session.tables:
        return {"kpis": [], "pie": None, "trend": None, "comparison": None}

    table = session.tables[COMPARE_TABLE_NAME]
    tname = COMPARE_TABLE_NAME
    groups = _find_columns_by_type(table.columns)

    # 找 revenue 列 (跟 generate_overview 同样逻辑)
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

    # === 主 KPI 卡 (合并表的总计) ===
    kpis = []
    
    # 总行数
    total_rows_res = _safe_exec(session, f'SELECT COUNT(*) FROM "{tname}"')
    if total_rows_res and total_rows_res["rows"]:
        kpis.append({
            "label": tr("kpi.total_records", lang),
            "value": int(total_rows_res["rows"][0][0]),
            "format": "number",
        })

    # 总收入
    if revenue_col:
        total_rev_res = _safe_exec(session, f'SELECT ROUND(SUM("{revenue_col.name}"), 2) FROM "{tname}"')
        if total_rev_res and total_rev_res["rows"] and total_rev_res["rows"][0][0] is not None:
            kpis.append({
                "label": tr("kpi.total_revenue", lang),
                "value": float(total_rev_res["rows"][0][0]),
                "format": "currency" if is_currency else "number",
            })

    # === Comparison: 按 __dataset 分组的指标 ===
    datasets = cm.get("source_tables", [])
    kpi_by_dataset = {}
    trend_by_dataset = {}

    # 每个 dataset 的总行数和总收入
    rows_by_ds = {}
    rev_by_ds = {}
    for ds in datasets:
        # 总行数
        ds_escaped = ds.replace("'", "''")
        r = _safe_exec(session, f'SELECT COUNT(*) FROM "{tname}" WHERE __dataset = \'{ds_escaped}\'')
        if r and r["rows"]:
            rows_by_ds[ds] = int(r["rows"][0][0])
        # 总收入
        if revenue_col:
            r2 = _safe_exec(session,
                f'SELECT ROUND(SUM("{revenue_col.name}"), 2) FROM "{tname}" WHERE __dataset = \'{ds_escaped}\'')
            if r2 and r2["rows"] and r2["rows"][0][0] is not None:
                rev_by_ds[ds] = float(r2["rows"][0][0])

    if rows_by_ds:
        kpi_by_dataset["rows"] = rows_by_ds
    if rev_by_ds:
        kpi_by_dataset["revenue"] = rev_by_ds

    # === 趋势线 (每个 dataset 一条) ===
    if revenue_col and groups["datetime"]:
        dc = groups["datetime"][0]
        for ds in datasets:
            ds_escaped3 = ds.replace("'", "''")
            r = _safe_exec(session, (
                f'SELECT DATE_TRUNC(\'month\', "{dc.name}") AS m, '
                f'ROUND(SUM("{revenue_col.name}"), 2) AS v '
                f'FROM "{tname}" WHERE __dataset = \'{ds_escaped3}\' GROUP BY m ORDER BY m'
            ))
            if r and r["rows"]:
                trend_by_dataset[ds] = [
                    {"month": str(row[0])[:10], "value": float(row[1] or 0)}
                    for row in r["rows"]
                ]

    return {
        "kpis": kpis,
        "pie": None,  # compare 模式不画 pie
        "trend": None,  # compare 模式用 comparison.trend_by_dataset 代替
        "comparison": {
            "datasets": datasets,
            "kpi_by_dataset": kpi_by_dataset,
            "trend_by_dataset": trend_by_dataset,
            "is_currency": is_currency,
        },
    }

