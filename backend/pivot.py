"""
数据透视表（Pivot）后端
==================
接收前端传来的: 行维度 / 列维度 / 度量 / 聚合方式 / 筛选条件
生成 SQL,返回结果。

支持的聚合: sum / avg / count / count_distinct / min / max
"""

from __future__ import annotations
from typing import Any
from pydantic import BaseModel
from database import Session, execute_sql, SQLExecutionError


AGG_FUNCS = {
    "sum": "SUM",
    "avg": "AVG",
    "count": "COUNT",
    "count_distinct": "COUNT(DISTINCT",  # 特殊处理
    "min": "MIN",
    "max": "MAX",
}


class PivotConfig(BaseModel):
    table: str
    rows: list[str] = []        # 行维度列名
    columns: list[str] = []     # 列维度列名(透视字段)
    measure: str | None = None  # 度量列名(数值列)
    agg: str = "sum"            # 聚合方式
    filters: list[dict[str, Any]] = []  # [{"column": "x", "op": "=", "value": "y"}]
    limit: int = 1000


def _quote(name: str) -> str:
    """SQL 标识符加引号，防止特殊字符。"""
    return '"' + name.replace('"', '""') + '"'


def _build_agg_expr(agg: str, measure: str | None) -> str:
    """构造聚合表达式。"""
    if agg == "count" or measure is None:
        return "COUNT(*)"
    if agg == "count_distinct":
        return f"COUNT(DISTINCT {_quote(measure)})"
    func = AGG_FUNCS.get(agg, "SUM")
    return f"{func}({_quote(measure)})"


def _build_where(filters: list[dict[str, Any]]) -> str:
    """构造 WHERE 子句。"""
    if not filters:
        return ""
    conds = []
    ops = {"=", "!=", ">", "<", ">=", "<=", "LIKE", "IS NULL", "IS NOT NULL", "IN"}
    for f in filters:
        col = f.get("column")
        op = (f.get("op") or "=").upper()
        val = f.get("value")
        if not col or op not in ops:
            continue
        if op in ("IS NULL", "IS NOT NULL"):
            conds.append(f"{_quote(col)} {op}")
        elif op == "IN" and isinstance(val, list):
            vals = ",".join(_format_value(v) for v in val)
            conds.append(f"{_quote(col)} IN ({vals})")
        elif op == "LIKE":
            conds.append(f"{_quote(col)} LIKE {_format_value(str(val) if val else '')}")
        else:
            conds.append(f"{_quote(col)} {op} {_format_value(val)}")
    return " WHERE " + " AND ".join(conds) if conds else ""


def _format_value(v: Any) -> str:
    """把值格式化为 SQL 字面量。"""
    if v is None:
        return "NULL"
    if isinstance(v, (int, float)):
        return str(v)
    if isinstance(v, bool):
        return "TRUE" if v else "FALSE"
    s = str(v).replace("'", "''")
    return f"'{s}'"


def build_pivot_sql(config: PivotConfig) -> str:
    """根据配置生成 SQL。"""
    if not config.table:
        raise ValueError("缺少表名")
    if not config.rows and not config.columns:
        # 没有维度,只算总聚合
        agg_expr = _build_agg_expr(config.agg, config.measure)
        where = _build_where(config.filters)
        return f'SELECT {agg_expr} AS "结果" FROM {_quote(config.table)}{where}'

    # 简化版：把 rows 和 columns 都拼成一行 GROUP BY,前端再做行列布局
    # （DuckDB 有 PIVOT 但语法复杂,这里用 GROUP BY + 前端转置更稳）
    select_cols = config.rows + config.columns
    select_quoted = ", ".join(_quote(c) for c in select_cols)
    agg_expr = _build_agg_expr(config.agg, config.measure)
    measure_label = config.measure or "count"
    where = _build_where(config.filters)
    
    sql = (
        f"SELECT {select_quoted}, {agg_expr} AS {_quote(measure_label)} "
        f"FROM {_quote(config.table)}"
        f"{where} "
        f"GROUP BY {select_quoted} "
        f"ORDER BY {_quote(measure_label)} DESC "
        f"LIMIT {min(config.limit, 5000)}"
    )
    return sql


def run_pivot(session: Session, config: PivotConfig) -> dict[str, Any]:
    """执行透视并返回结果。"""
    if config.table not in session.tables:
        raise ValueError(f"表 {config.table} 不存在")
    sql = build_pivot_sql(config)
    result = execute_sql(session, sql)
    return {"sql": sql, "result": result, "config": config.model_dump()}
