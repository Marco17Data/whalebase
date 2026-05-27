"""
Supabase 持久化层 (Stage 2)
===========================
封装与 Supabase 的所有交互:
- 文件上传到 Storage
- user_files 表的 CRUD
- user_sessions 表的读写
- user_queries 表的历史记录
"""

from __future__ import annotations
import os
import uuid
from typing import Optional
from supabase import create_client, Client

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")

# 全局 client (anon key, 操作时通过 RLS 用 JWT 限制访问权限)
# 注意: 这个 client 不带 user JWT, 所以无法读用户私有数据
# 真正访问用户数据时, 需要用 _get_client_for_user(jwt) 拿一个带 JWT 的 client
_global_client: Optional[Client] = None


def _get_global_client() -> Client:
    """无用户上下文的全局 client (适合 service 任务、不涉及用户数据)。"""
    global _global_client
    if _global_client is None:
        if not SUPABASE_URL or not SUPABASE_ANON_KEY:
            raise RuntimeError("SUPABASE_URL and SUPABASE_ANON_KEY must be set in env")
        _global_client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
    return _global_client


_service_client: Optional[Client] = None

def _get_service_client() -> Client:
    """
    Service-role client (bypasses RLS).
    Use ONLY after we've manually verified the user_id, e.g. against the
    JWT-extracted user_id. Never expose this client to user input.
    """
    global _service_client
    if _service_client is None:
        if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
            raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in env")
        _service_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    return _service_client


def _get_user_client(user_jwt: str) -> Client:
    """
    创建一个带用户 JWT 的 client. 后续所有 query/storage 操作都会以这个用户身份执行.
    RLS 规则会自动确保用户只能访问自己的数据.
    """
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        raise RuntimeError("SUPABASE_URL and SUPABASE_ANON_KEY must be set in env")
    client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
    # 把 JWT 设置成当前 session 的 access_token
    # 这样 RLS 检查 auth.uid() 时就知道是这个用户
    client.postgrest.auth(user_jwt)
    client.storage._client.headers["Authorization"] = f"Bearer {user_jwt}"
    return client


# ============================================================
# 文件管理
# ============================================================
MAX_FILE_BYTES = 10 * 1024 * 1024  # 10 MB
MAX_FILES_PER_USER = 30
BUCKET = "user-uploads"


def upload_file(user_jwt: str, user_id: str, filename: str, file_bytes: bytes,
                row_count: Optional[int] = None, col_count: Optional[int] = None) -> dict:
    """
    上传文件到 Supabase Storage + 在 user_files 表添加记录.
    返回 {"ok": True/False, "file_id": str | None, "error": str | None}
    """
    if len(file_bytes) > MAX_FILE_BYTES:
        return {"ok": False, "error": f"File exceeds {MAX_FILE_BYTES // (1024*1024)}MB limit", "file_id": None}

    # Storage 上传用 user client (Storage RLS works correctly)
    user_client = _get_user_client(user_jwt)
    # 元数据 (user_files 表) 用 service client (Postgres RLS via JWT 不可靠)
    svc = _get_service_client()

    # 1. 检查用户文件数量 (用 service client 绕过 RLS)
    try:
        count_resp = svc.table("user_files").select("id", count="exact").eq("user_id", user_id).execute()
        current_count = count_resp.count or 0
        if current_count >= MAX_FILES_PER_USER:
            return {"ok": False, "error": f"Limit reached: max {MAX_FILES_PER_USER} files per user", "file_id": None}
    except Exception as e:
        return {"ok": False, "error": f"DB error: {e}", "file_id": None}

    # 2. 上传到 Storage (路径: {user_id}/{file_id}-{filename})
    file_id = str(uuid.uuid4())
    storage_path = f"{user_id}/{file_id}-{filename}"
    try:
        user_client.storage.from_(BUCKET).upload(
            storage_path,
            file_bytes,
            {"content-type": "text/csv"}
        )
    except Exception as e:
        return {"ok": False, "error": f"Storage upload failed: {e}", "file_id": None}

    # 3. 插入 user_files 表
    try:
        svc.table("user_files").insert({
            "id": file_id,
            "user_id": user_id,
            "filename": filename,
            "storage_path": storage_path,
            "size_bytes": len(file_bytes),
            "row_count": row_count,
            "col_count": col_count,
        }).execute()
    except Exception as e:
        # rollback storage
        try:
            user_client.storage.from_(BUCKET).remove([storage_path])
        except Exception:
            pass
        return {"ok": False, "error": f"DB insert failed: {e}", "file_id": None}

    return {"ok": True, "file_id": file_id, "storage_path": storage_path, "error": None}


def list_user_files(user_jwt: str, user_id: str) -> list:
    """返回用户所有文件的元数据列表 (最新在前)."""
    client = _get_service_client()  # bypass RLS for reliable access
    try:
        resp = client.table("user_files").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
        return resp.data or []
    except Exception as e:
        return []


def download_file(user_jwt: str, storage_path: str) -> Optional[bytes]:
    """下载文件原始字节. 如果用户没权限或文件不存在返回 None."""
    client = _get_user_client(user_jwt)
    try:
        data = client.storage.from_(BUCKET).download(storage_path)
        return data
    except Exception:
        return None


def delete_file(user_jwt: str, user_id: str, file_id: str) -> dict:
    """删除文件: 删 storage + user_files 表行 (cascade 会自动删 user_queries 相关)."""
    client = _get_service_client()  # bypass RLS for reliable access
    try:
        # 先查 storage_path
        resp = client.table("user_files").select("storage_path").eq("id", file_id).eq("user_id", user_id).single().execute()
        if not resp.data:
            return {"ok": False, "error": "File not found or not yours"}
        storage_path = resp.data["storage_path"]
        # 删 storage
        try:
            client.storage.from_(BUCKET).remove([storage_path])
        except Exception:
            pass
        # 删 DB
        client.table("user_files").delete().eq("id", file_id).eq("user_id", user_id).execute()
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": str(e)}


# ============================================================
# Session 状态
# ============================================================
def get_user_session_state(user_jwt: str, user_id: str) -> dict:
    """读用户的最近会话状态 (用 upsert 模式, 没有就用默认值)."""
    client = _get_user_client(user_jwt)
    try:
        resp = client.table("user_sessions").select("*").eq("user_id", user_id).single().execute()
        return resp.data or {}
    except Exception:
        return {}


def update_user_session_state(user_jwt: str, user_id: str,
                                active_file_id: Optional[str] = None,
                                preferred_lang: Optional[str] = None,
                                preferred_currency: Optional[str] = None) -> dict:
    """更新用户会话状态. 用 upsert (插入或更新)."""
    client = _get_user_client(user_jwt)
    update = {"user_id": user_id, "last_active": "now()"}
    if active_file_id is not None:
        update["active_file_id"] = active_file_id
    if preferred_lang is not None:
        update["preferred_lang"] = preferred_lang
    if preferred_currency is not None:
        update["preferred_currency"] = preferred_currency
    try:
        client.table("user_sessions").upsert(update, on_conflict="user_id").execute()
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": str(e)}


# ============================================================
# 查询历史 (可选)
# ============================================================
def save_query(user_jwt: str, user_id: str, file_id: str, question: str, sql: str) -> dict:
    client = _get_user_client(user_jwt)
    try:
        client.table("user_queries").insert({
            "user_id": user_id, "file_id": file_id,
            "question": question, "sql": sql,
        }).execute()
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def list_user_queries(user_jwt: str, user_id: str, file_id: Optional[str] = None, limit: int = 50) -> list:
    client = _get_user_client(user_jwt)
    try:
        q = client.table("user_queries").select("*").eq("user_id", user_id).order("created_at", desc=True).limit(limit)
        if file_id:
            q = q.eq("file_id", file_id)
        return q.execute().data or []
    except Exception:
        return []
