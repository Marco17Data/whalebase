"""
数据清洗模块
==========
基于规则的清洗（不调 LLM, 快+确定性）:
- 重复行: 移除完全一样的行
- 缺失值: 数值列填 0, 文本列填占位符, 日期列保留 NULL
- 提供 undo (apply 前 snapshot 原表)
"""

from __future__ import annotations
from typing import Any
from database import Session


def generate_cleanup_suggestions(session: Session, lang: str = "en", table_name: str | None = None) -> dict:
    """返回 AI 风格的建议清单 (基于固定规则但措辞业务友好)。"""
    if not session.tables:
        return {"table": None, "suggestions": []}

    tname = table_name if table_name and table_name in session.tables else next(iter(session.tables))
    table = session.tables[tname]

    # 当前行数
    try:
        row_count = table.row_count
    except Exception:
        row_count = 0

    suggestions = []

    # 1) 重复行检查
    try:
        col_list = ", ".join(f'"{c.name}"' for c in table.columns)
        dup_q = (
            f'SELECT COALESCE(SUM(cnt - 1), 0) FROM ('
            f'SELECT COUNT(*) AS cnt FROM "{tname}" '
            f'GROUP BY {col_list} HAVING COUNT(*) > 1) sub'
        )
        dup_res = session.conn.execute(dup_q).fetchone()
        dup_count = int(dup_res[0] or 0) if dup_res else 0
    except Exception:
        dup_count = 0

    if dup_count > 0:
        suggestions.append({
            "id": "dedup",
            "type": "duplicates",
            "count": dup_count,
            "after_rows": max(row_count - dup_count, 0),
        })

    # 2) 每列空值检查 + 按类型决定填充值
    for col in table.columns:
        try:
            null_q = f'SELECT COUNT(*) FROM "{tname}" WHERE "{col.name}" IS NULL'
            null_res = session.conn.execute(null_q).fetchone()
            null_count = int(null_res[0] or 0) if null_res else 0
        except Exception:
            null_count = 0
        if null_count == 0:
            continue

        # 决定 fill 策略 (基于 DuckDB 列类型)
        dtype = (col.dtype or "").upper()
        if any(t in dtype for t in ("INT", "BIGINT", "DECIMAL", "DOUBLE", "FLOAT", "NUMERIC")):
            fill_strategy = "zero"
            fill_value = 0
        elif any(t in dtype for t in ("DATE", "TIME", "TIMESTAMP")):
            # 日期列: 保留 NULL (没有合理的默认值)
            continue
        else:
            # 文本/其他: 用 "未提供" / "unknown" placeholder
            fill_strategy = "placeholder"
            fill_value = "__PLACEHOLDER__"  # 前端根据 lang 决定显示文本; 后端 apply 时也按 lang 决定

        suggestions.append({
            "id": f"fill_{col.name}",
            "type": "nulls",
            "column": col.name,
            "count": null_count,
            "fill_strategy": fill_strategy,
            "fill_value_numeric": fill_value if fill_strategy == "zero" else None,
        })

    return {
        "table": tname,
        "row_count": row_count,
        "suggestions": suggestions,
    }


# 后端 i18n 没做完的 placeholder 兜底
_PLACEHOLDER_BY_LANG = {
    "en": "Not provided",
    "zh": "未提供",
    "es": "No proporcionado",
    "ja": "未提供",
    "ko": "미제공",
    "fr": "Non fourni",
    "de": "Nicht angegeben",
    "pt": "Não informado",
    "it": "Non fornito",
    "ru": "Не указано",
}


def apply_cleanup(session: Session, selected_ids: list[str], lang: str = "en", table_name: str | None = None) -> dict:
    """
    根据用户选中的 suggestion id 执行清洗。
    apply 前会做一次 snapshot (存在 session._cleanup_snapshots dict 里供 undo)。
    """
    if not session.tables:
        return {"ok": False, "error": "no tables"}

    tname = table_name if table_name and table_name in session.tables else next(iter(session.tables))
    table = session.tables[tname]
    selected = set(selected_ids or [])
    if not selected:
        return {"ok": False, "error": "no actions selected"}

    # ---- 1. Snapshot 原表 (for undo) ----
    snap_name = f"__snap_{tname}__"
    try:
        session.conn.execute(f'DROP TABLE IF EXISTS "{snap_name}"')
        session.conn.execute(f'CREATE TABLE "{snap_name}" AS SELECT * FROM "{tname}"')
        if not hasattr(session, "_cleanup_snapshots"):
            session._cleanup_snapshots = {}
        session._cleanup_snapshots[tname] = snap_name
    except Exception as e:
        return {"ok": False, "error": f"snapshot failed: {e}"}

    actions_done = []
    placeholder = _PLACEHOLDER_BY_LANG.get(lang, _PLACEHOLDER_BY_LANG["en"])

    # ---- 2. 去重 ----
    if "dedup" in selected:
        try:
            col_list = ", ".join(f'"{c.name}"' for c in table.columns)
            # DuckDB: 用 ROW_NUMBER 给每组重复行打编号, 只保留 row_number = 1 的
            session.conn.execute(f'''
                CREATE OR REPLACE TABLE "__dedup_tmp__" AS
                SELECT * FROM (
                    SELECT *, ROW_NUMBER() OVER (PARTITION BY {col_list}) AS __rn FROM "{tname}"
                ) WHERE __rn = 1
            ''')
            # 用 dedup 后的表替换原表
            session.conn.execute(f'DROP TABLE "{tname}"')
            cols_no_rn = ", ".join(f'"{c.name}"' for c in table.columns)
            session.conn.execute(f'CREATE TABLE "{tname}" AS SELECT {cols_no_rn} FROM "__dedup_tmp__"')
            session.conn.execute('DROP TABLE IF EXISTS "__dedup_tmp__"')
            actions_done.append("dedup")
        except Exception as e:
            actions_done.append(f"dedup_error: {e}")

    # ---- 3. 填空值 (按列) ----
    for col in table.columns:
        action_id = f"fill_{col.name}"
        if action_id not in selected:
            continue
        dtype = (col.dtype or "").upper()
        try:
            if any(t in dtype for t in ("INT", "BIGINT", "DECIMAL", "DOUBLE", "FLOAT", "NUMERIC")):
                session.conn.execute(
                    f'UPDATE "{tname}" SET "{col.name}" = 0 WHERE "{col.name}" IS NULL'
                )
            elif any(t in dtype for t in ("DATE", "TIME", "TIMESTAMP")):
                continue  # 日期列不动
            else:
                session.conn.execute(
                    f'UPDATE "{tname}" SET "{col.name}" = ? WHERE "{col.name}" IS NULL',
                    [placeholder],
                )
            actions_done.append(action_id)
        except Exception as e:
            actions_done.append(f"{action_id}_error: {e}")

    # ---- 4. 重新计算 table metadata (row_count 之类) ----
    try:
        new_row_count = session.conn.execute(f'SELECT COUNT(*) FROM "{tname}"').fetchone()[0]
        table.row_count = int(new_row_count)
    except Exception:
        pass

    return {"ok": True, "table": tname, "actions": actions_done, "new_row_count": table.row_count}


def undo_cleanup(session: Session, table_name: str | None = None) -> dict:
    """从 snapshot 还原原表。snapshot 一次性: 还原后丢弃, 不能再次 undo。"""
    if not session.tables:
        return {"ok": False, "error": "no tables"}
    tname = table_name if table_name and table_name in session.tables else next(iter(session.tables))
    snaps = getattr(session, "_cleanup_snapshots", {})
    snap_name = snaps.get(tname)
    if not snap_name:
        return {"ok": False, "error": "no snapshot to undo"}
    try:
        session.conn.execute(f'DROP TABLE IF EXISTS "{tname}"')
        session.conn.execute(f'CREATE TABLE "{tname}" AS SELECT * FROM "{snap_name}"')
        session.conn.execute(f'DROP TABLE IF EXISTS "{snap_name}"')
        del snaps[tname]
        # update metadata
        new_rc = session.conn.execute(f'SELECT COUNT(*) FROM "{tname}"').fetchone()[0]
        session.tables[tname].row_count = int(new_rc)
        return {"ok": True, "table": tname, "restored_rows": int(new_rc)}
    except Exception as e:
        return {"ok": False, "error": f"undo failed: {e}"}
