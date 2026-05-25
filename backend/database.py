"""
DuckDB 数据层
==========
每个 session 一个独立的 DuckDB in-memory 连接，session 销毁时数据自动清掉。
零持久化、零隐私问题。

职责:
- 接收上传的 CSV / Excel 文件
- 用 DuckDB 自动推断 schema 建表
- 提供 schema 描述给 LLM（生成 SQL 用）
- 安全执行 LLM 生成的 SQL（白名单 + 超时）
"""

from __future__ import annotations

import io
import re
import time
import uuid
import threading
from dataclasses import dataclass, field
from typing import Any

import duckdb
import pandas as pd


# ============================================================
# 数据模型
# ============================================================
@dataclass
class ColumnInfo:
    name: str
    dtype: str
    null_count: int
    sample_values: list[Any]
    min_value: Any = None
    max_value: Any = None
    distinct_count: int | None = None


@dataclass
class TableInfo:
    name: str  # SQL 里用的表名（清洗后）
    original_filename: str
    row_count: int
    columns: list[ColumnInfo]
    preview_rows: list[dict[str, Any]]  # 前 20 行用于前端展示


@dataclass
class Session:
    session_id: str
    conn: duckdb.DuckDBPyConnection
    tables: dict[str, TableInfo] = field(default_factory=dict)
    chat_history: list[dict[str, str]] = field(default_factory=list)
    query_history: list[dict[str, Any]] = field(default_factory=list)
    last_active: float = field(default_factory=time.time)
    currency: str = "none"  # USD/EUR/CNY/JPY/GBP/none


# ============================================================
# Session 池（带过期清理）
# ============================================================
class SessionPool:
    """
    全局 session 池。每个浏览器 session 对应一个 DuckDB 连接。
    超过 SESSION_TTL 秒未活动的 session 自动清理（节约内存）。
    """

    SESSION_TTL = 60 * 60 * 2  # 2 小时

    def __init__(self):
        self._sessions: dict[str, Session] = {}
        self._lock = threading.Lock()

    def create(self) -> Session:
        with self._lock:
            session_id = str(uuid.uuid4())
            conn = duckdb.connect(":memory:")
            session = Session(session_id=session_id, conn=conn)
            self._sessions[session_id] = session
            self._cleanup_expired()
            return session

    def get(self, session_id: str) -> Session | None:
        with self._lock:
            session = self._sessions.get(session_id)
            if session:
                session.last_active = time.time()
            return session

    def delete(self, session_id: str) -> None:
        with self._lock:
            session = self._sessions.pop(session_id, None)
            if session:
                try:
                    session.conn.close()
                except Exception:
                    pass

    def _cleanup_expired(self) -> None:
        """清理过期 session（在锁内调用）。"""
        now = time.time()
        expired = [
            sid
            for sid, s in self._sessions.items()
            if now - s.last_active > self.SESSION_TTL
        ]
        for sid in expired:
            session = self._sessions.pop(sid)
            try:
                session.conn.close()
            except Exception:
                pass


# 全局实例
pool = SessionPool()


# ============================================================
# 工具函数
# ============================================================
def sanitize_table_name(filename: str) -> str:
    """把文件名转成合法的 SQL 表名。"""
    # 去后缀
    name = re.sub(r"\.[^.]+$", "", filename)
    # 只保留字母数字下划线
    name = re.sub(r"[^a-zA-Z0-9_\u4e00-\u9fa5]", "_", name)
    # 数字开头加前缀
    if name and name[0].isdigit():
        name = "t_" + name
    # 空的话用默认
    if not name:
        name = "data"
    return name.lower()


def load_file_to_dataframe(filename: str, content: bytes) -> pd.DataFrame:
    """根据文件后缀解析成 DataFrame。"""
    lower = filename.lower()
    if lower.endswith(".csv"):
        # 尝试多种编码
        for encoding in ("utf-8", "utf-8-sig", "gbk", "gb18030", "latin-1"):
            try:
                return pd.read_csv(io.BytesIO(content), encoding=encoding)
            except (UnicodeDecodeError, UnicodeError):
                continue
        raise ValueError(f"无法解码 CSV 文件 {filename}（尝试了 utf-8 / gbk / latin-1）")
    elif lower.endswith((".xlsx", ".xls")):
        return pd.read_excel(io.BytesIO(content))
    elif lower.endswith(".tsv"):
        return pd.read_csv(io.BytesIO(content), sep="\t")
    elif lower.endswith(".json"):
        return pd.read_json(io.BytesIO(content))
    else:
        raise ValueError(f"不支持的文件格式: {filename}（支持 csv/tsv/xlsx/xls/json）")


def add_table_from_file(
    session: Session, filename: str, content: bytes
) -> TableInfo:
    """把上传的文件加载到 session 的 DuckDB 里，并返回表信息。"""
    df = load_file_to_dataframe(filename, content)

    if df.empty:
        raise ValueError(f"{filename} 是空文件")

    # 清洗列名（去空格、特殊字符）
    df.columns = [_clean_column_name(c) for c in df.columns]

    # 自动尝试把看起来像日期的列解析为 datetime
    _try_parse_dates(df)

    # 生成唯一表名（如果同名已存在，加后缀）
    base_name = sanitize_table_name(filename)
    table_name = base_name
    suffix = 1
    while table_name in session.tables:
        suffix += 1
        table_name = f"{base_name}_{suffix}"

    # 注册到 DuckDB
    session.conn.register(f"_tmp_{table_name}", df)
    session.conn.execute(
        f'CREATE OR REPLACE TABLE "{table_name}" AS SELECT * FROM _tmp_{table_name}'
    )
    session.conn.unregister(f"_tmp_{table_name}")

    # 推断 schema 信息
    columns = _infer_columns(session.conn, table_name, df)

    # 前 20 行预览（处理 NaN/datetime 为 JSON 兼容格式）
    preview_df = df.head(20)
    preview_rows = _df_to_json_safe(preview_df)

    table_info = TableInfo(
        name=table_name,
        original_filename=filename,
        row_count=len(df),
        columns=columns,
        preview_rows=preview_rows,
    )
    session.tables[table_name] = table_info
    return table_info


def _clean_column_name(col: str) -> str:
    """清洗列名（保留中英文，特殊字符变下划线）。"""
    col = str(col).strip()
    col = re.sub(r"[^a-zA-Z0-9_\u4e00-\u9fa5]", "_", col)
    if not col:
        col = "col"
    if col[0].isdigit():
        col = "c_" + col
    return col


def _try_parse_dates(df: pd.DataFrame) -> None:
    """
    原地把看起来像日期的列转成 datetime。
    判断标准: 列名含日期关键词 + 字符串列 + 前几个值能被解析。
    """
    date_keywords = ("date", "time", "日期", "时间", "_at", "_on")
    for col in df.columns:
        if not pd.api.types.is_object_dtype(df[col]):
            continue
        col_lower = str(col).lower()
        if not any(kw in col_lower for kw in date_keywords):
            continue
        # 试解析前 5 个非空值
        sample = df[col].dropna().head(5)
        if sample.empty:
            continue
        try:
            parsed_sample = pd.to_datetime(sample, errors="raise")
            # 全部解析成功才转
            df[col] = pd.to_datetime(df[col], errors="coerce")
        except (ValueError, TypeError):
            continue


def _infer_columns(
    conn: duckdb.DuckDBPyConnection, table_name: str, df: pd.DataFrame
) -> list[ColumnInfo]:
    """推断每列的统计信息。"""
    columns = []
    for col in df.columns:
        dtype = str(df[col].dtype)
        null_count = int(df[col].isna().sum())

        # 取 5 个非空样本
        sample = df[col].dropna().head(5).tolist()
        sample = [_to_json_safe(v) for v in sample]

        # 数值列算 min/max
        min_v, max_v = None, None
        if pd.api.types.is_numeric_dtype(df[col]) and not df[col].isna().all():
            min_v = _to_json_safe(df[col].min())
            max_v = _to_json_safe(df[col].max())
        elif pd.api.types.is_datetime64_any_dtype(df[col]):
            min_v = _to_json_safe(df[col].min())
            max_v = _to_json_safe(df[col].max())

        # 类别列算 distinct
        distinct_count = None
        if df[col].nunique(dropna=True) < min(50, len(df)):
            distinct_count = int(df[col].nunique(dropna=True))

        columns.append(
            ColumnInfo(
                name=str(col),
                dtype=_simplify_dtype(dtype),
                null_count=null_count,
                sample_values=sample,
                min_value=min_v,
                max_value=max_v,
                distinct_count=distinct_count,
            )
        )
    return columns


def _simplify_dtype(dtype: str) -> str:
    """把 pandas dtype 简化成人类可读的字符串。"""
    dtype = dtype.lower()
    if "int" in dtype:
        return "integer"
    if "float" in dtype:
        return "float"
    if "bool" in dtype:
        return "boolean"
    if "datetime" in dtype or "date" in dtype:
        return "datetime"
    return "text"


def _to_json_safe(value: Any) -> Any:
    """把单个值转成 JSON 安全的类型。"""
    if pd.isna(value):
        return None
    if isinstance(value, (pd.Timestamp,)):
        return value.isoformat()
    if hasattr(value, "item"):  # numpy types
        return value.item()
    return value


def _df_to_json_safe(df: pd.DataFrame) -> list[dict[str, Any]]:
    """DataFrame 转 JSON 安全的字典列表。"""
    rows = []
    for _, row in df.iterrows():
        rows.append({col: _to_json_safe(row[col]) for col in df.columns})
    return rows


# ============================================================
# SQL 执行
# ============================================================
class SQLExecutionError(Exception):
    pass


# 禁止的 SQL 关键字（防 LLM 生成破坏性语句）
_FORBIDDEN_KEYWORDS = re.compile(
    r"\b(DROP|TRUNCATE|DELETE|UPDATE|INSERT|ALTER|CREATE|ATTACH|DETACH|COPY|EXPORT|INSTALL|LOAD|PRAGMA|SET)\b",
    re.IGNORECASE,
)


def execute_sql(session: Session, sql: str, max_rows: int = 10000) -> dict[str, Any]:
    """
    安全执行 SQL（只允许 SELECT/WITH/SHOW）。

    Returns:
        {
            "columns": [...],
            "rows": [[...], ...],
            "row_count": int,
            "truncated": bool,
        }
    """
    sql = sql.strip().rstrip(";")

    # 安全检查
    if _FORBIDDEN_KEYWORDS.search(sql):
        raise SQLExecutionError(
            "SQL 包含被禁止的关键字（仅允许查询，不允许修改/删除数据）"
        )
    if not re.match(r"^\s*(SELECT|WITH|SHOW|DESCRIBE|EXPLAIN)\b", sql, re.IGNORECASE):
        raise SQLExecutionError("SQL 必须以 SELECT / WITH / SHOW / DESCRIBE 开头")

    try:
        result = session.conn.execute(sql)
        columns = [desc[0] for desc in result.description] if result.description else []
        rows = result.fetchall()
    except duckdb.Error as e:
        raise SQLExecutionError(f"SQL 执行失败: {e}") from e

    truncated = len(rows) > max_rows
    if truncated:
        rows = rows[:max_rows]

    # 转 JSON 安全
    safe_rows = [[_to_json_safe(v) for v in row] for row in rows]

    return {
        "columns": columns,
        "rows": safe_rows,
        "row_count": len(safe_rows),
        "truncated": truncated,
    }


# ============================================================
# Schema 描述（给 LLM 用）
# ============================================================
def build_schema_prompt(session: Session) -> str:
    """
    生成给 LLM 看的 schema 描述。
    格式紧凑、信息密度高，专门为 SQL 生成优化。
    """
    if not session.tables:
        return "（当前 session 还没有上传任何数据表）"

    lines = ["数据库中可用的表（DuckDB 方言）:\n"]
    for table in session.tables.values():
        lines.append(f"表名: {table.name}  (来源文件: {table.original_filename}, 共 {table.row_count} 行)")
        lines.append("列:")
        for col in table.columns:
            extras = []
            if col.distinct_count is not None and col.distinct_count <= 20:
                extras.append(f"distinct values: {col.sample_values}")
            elif col.sample_values:
                extras.append(f"sample: {col.sample_values[:3]}")
            if col.min_value is not None:
                extras.append(f"range: [{col.min_value}, {col.max_value}]")
            if col.null_count > 0:
                extras.append(f"nulls: {col.null_count}")
            extras_str = " | ".join(extras) if extras else ""
            lines.append(f"  - {col.name} ({col.dtype})  {extras_str}")
        lines.append("")
    return "\n".join(lines)



def _read_columns_metadata(conn, table_name: str):
    """从已存在的表里读 ColumnInfo 列表 + row_count + preview_rows (前 5 行)。
    供 compare.enable_compare_mode 等内部用途。"""
    # Schema
    schema_rows = conn.execute(f'DESCRIBE "{table_name}"').fetchall()
    cols = []
    for row in schema_rows:
        col_name = row[0]
        raw_dtype = (row[1] or "").upper()
        # 归一化 DuckDB 原始类型 -> dashboard.py 期望的友好别名
        if any(t in raw_dtype for t in ("DATE", "TIME", "TIMESTAMP")):
            col_dtype = "datetime"
        elif any(t in raw_dtype for t in ("INT", "BIGINT", "SMALLINT", "TINYINT")):
            col_dtype = "integer"
        elif any(t in raw_dtype for t in ("DOUBLE", "FLOAT", "DECIMAL", "NUMERIC", "REAL")):
            col_dtype = "float"
        elif any(t in raw_dtype for t in ("VARCHAR", "TEXT", "STRING", "CHAR")):
            col_dtype = "text"
        elif "BOOL" in raw_dtype:
            col_dtype = "boolean"
        else:
            col_dtype = raw_dtype.lower() or "text"
        # 简化版: 不算 null_count/sample/min/max/distinct (后续操作不依赖)
        try:
            distinct_count = conn.execute(
                f'SELECT COUNT(DISTINCT "{col_name}") FROM "{table_name}"'
            ).fetchone()[0]
        except Exception:
            distinct_count = None
        cols.append(ColumnInfo(
            name=col_name, dtype=col_dtype, null_count=0, sample_values=[],
            min_value=None, max_value=None, distinct_count=distinct_count,
        ))
    row_count = conn.execute(f'SELECT COUNT(*) FROM "{table_name}"').fetchone()[0]
    try:
        preview = conn.execute(f'SELECT * FROM "{table_name}" LIMIT 5').fetchall()
        preview_rows = [list(r) for r in preview]
    except Exception:
        preview_rows = []
    return cols, int(row_count), preview_rows

