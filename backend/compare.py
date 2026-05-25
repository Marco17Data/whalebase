"""
多数据集对比 (Stage 3 Step 3)
============================
对比模式的本质 = 用合并表跑完整 dashboard + 附加 dataset 维度的 delta
"""
from __future__ import annotations
import re
from typing import Any
from database import Session

SIMILARITY_THRESHOLD = 0.95
COMPARE_TABLE_NAME = "__compare_merged__"


def _normalize_col_name(name: str) -> str:
    return re.sub(r"[^a-z0-9]", "", name.lower())


def _column_similarity(cols_a: list, cols_b: list) -> dict:
    map_a = {_normalize_col_name(c.name): c for c in cols_a}
    map_b = {_normalize_col_name(c.name): c for c in cols_b}
    common_keys = set(map_a.keys()) & set(map_b.keys())
    matched = []
    for k in common_keys:
        ta = (map_a[k].dtype or "").upper()
        tb = (map_b[k].dtype or "").upper()
        is_num_a = any(t in ta for t in ("INT","DECIMAL","DOUBLE","FLOAT","NUMERIC","BIGINT"))
        is_num_b = any(t in tb for t in ("INT","DECIMAL","DOUBLE","FLOAT","NUMERIC","BIGINT"))
        if is_num_a == is_num_b:
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


def enable_compare_mode(session: Session, table_names: list[str]) -> dict:
    if not table_names or len(table_names) < 2:
        return {"ok": False, "error": "need at least 2 tables"}
    # 清旧状态以支持切换
    disable_compare_mode(session)
    valid = [t for t in table_names if t in session.tables]
    if len(valid) < 2:
        return {"ok": False, "error": "less than 2 valid tables in session"}
    first_cols = {_normalize_col_name(c.name): c for c in session.tables[valid[0]].columns}
    common_norm = set(first_cols.keys())
    for t in valid[1:]:
        cols_b = {_normalize_col_name(c.name): c for c in session.tables[t].columns}
        common_norm &= set(cols_b.keys())
    if not common_norm:
        return {"ok": False, "error": "no common columns across selected tables"}
    common_cols_in_order = [c.name for c in session.tables[valid[0]].columns
                            if _normalize_col_name(c.name) in common_norm]
    select_parts = []
    for tname in valid:
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
        from database import _read_columns_metadata, TableInfo
        cols, row_count, preview = _read_columns_metadata(session.conn, COMPARE_TABLE_NAME)
        session.tables[COMPARE_TABLE_NAME] = TableInfo(
            name=COMPARE_TABLE_NAME, original_filename="(compare mode merged)",
            columns=cols, row_count=row_count, preview_rows=preview,
        )
        session.compare_mode = {"active": True, "source_tables": valid, "merged_table": COMPARE_TABLE_NAME}
        return {"ok": True, "merged_table": COMPARE_TABLE_NAME, "source_tables": valid, "row_count": row_count}
    except Exception as e:
        return {"ok": False, "error": f"merge failed: {e}"}


def disable_compare_mode(session: Session) -> dict:
    try:
        session.conn.execute(f'DROP TABLE IF EXISTS "{COMPARE_TABLE_NAME}"')
        session.tables.pop(COMPARE_TABLE_NAME, None)
        if hasattr(session, "compare_mode"):
            session.compare_mode = {"active": False}
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def get_compare_status(session: Session) -> dict:
    cm = getattr(session, "compare_mode", None) or {"active": False}
    return cm


def compute_dataset_deltas(session: Session, table, lang: str = "en") -> dict:
    """
    在 compare 模式下, 为每个 KPI 计算 per-dataset 的拆分值。
    被 dashboard.generate_overview 调用 (在主逻辑后追加 comparison 字段)。
    """
    from dashboard import _find_columns_by_type, _is_currency_col, _safe_exec
    cm = getattr(session, "compare_mode", None) or {}
    if not cm.get("active"):
        return None
    datasets = cm.get("source_tables", [])
    if not datasets:
        return None

    tname = table.name  # __compare_merged__
    groups = _find_columns_by_type(table.columns)

    # 找 revenue 列 (跟主逻辑一致)
    revenue_keywords = ("revenue", "sales", "amount", "total", "value", "price",
                        "营业额", "销售额", "总额", "金额")
    revenue_col = None
    for kw in revenue_keywords:
        for col in groups["numeric"]:
            if kw.lower() in col.name.lower():
                revenue_col = col; break
        if revenue_col: break
    if revenue_col is None and groups["numeric"]:
        revenue_col = groups["numeric"][0]
    is_currency = bool(revenue_col and _is_currency_col(revenue_col))

    rows_by_ds = {}
    rev_by_ds = {}
    trend_by_ds = {}

    for ds in datasets:
        ds_esc = ds.replace("\'", "\'\'")
        # 行数
        r = _safe_exec(session, f'SELECT COUNT(*) FROM "{tname}" WHERE __dataset = \'{ds_esc}\'')
        if r and r["rows"]:
            rows_by_ds[ds] = int(r["rows"][0][0])
        # 收入
        if revenue_col:
            r2 = _safe_exec(session, f'SELECT ROUND(SUM("{revenue_col.name}"), 2) FROM "{tname}" WHERE __dataset = \'{ds_esc}\'')
            if r2 and r2["rows"] and r2["rows"][0][0] is not None:
                rev_by_ds[ds] = float(r2["rows"][0][0])
        # 月度趋势
        if revenue_col and groups["datetime"]:
            dc = groups["datetime"][0]
            r3 = _safe_exec(session, (
                f'SELECT DATE_TRUNC(\'month\', "{dc.name}") AS m, '
                f'ROUND(SUM("{revenue_col.name}"), 2) AS v '
                f'FROM "{tname}" WHERE __dataset = \'{ds_esc}\' GROUP BY m ORDER BY m'
            ))
            if r3 and r3["rows"]:
                trend_by_ds[ds] = [
                    {"month": str(row[0])[:10], "value": float(row[1] or 0)}
                    for row in r3["rows"]
                ]

    return {
        "datasets": datasets,
        "kpi_by_dataset": {
            "rows": rows_by_ds or None,
            "revenue": rev_by_ds or None,
        },
        "trend_by_dataset": trend_by_ds or None,
        "is_currency": is_currency,
    }
