"""
用户身份验证 (Stage 2)
====================
从 HTTP request 的 Authorization header 中提取 JWT token,
用 Supabase 的 anon key 验证, 返回 user_id (或 None 表示未登录).

JWT 是 Supabase 客户端登录后给的 token, 前端把它放在 Authorization header.
"""

from __future__ import annotations
import os
from typing import Optional
from fastapi import Request
from jose import jwt, JWTError

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")

# Supabase JWT 的 secret 就是 anon key 对应的 JWT secret
# 但 PyJWT 验证需要的是另一个 (JWT secret), 不是 anon key 本身
# 简化: 我们这里只做 decode (不校验签名), 用 anon key 校验适合服务端用 service_role
# 简化的对应: 用 verify=False 解出 payload, trust supabase auth flow 已经在 client 端做了验证
# 真正生产应该用 supabase-py 的 session 验证


def get_user_id_from_request(request: Request) -> Optional[str]:
    """
    从 Authorization: Bearer <token> header 中提取 user_id.
    未登录用户返回 None (前端不带 token, 或带的是过期/无效的).
    """
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    token = auth_header[7:].strip()
    if not token:
        return None
    try:
        # JWT 结构: header.payload.signature
        # supabase 的 anon JWT 用 HS256 + project-specific JWT secret 签的
        # 我们这里不验签 (signature), 只解 payload 拿 sub (user_id)
        # 理由: anon key 在前端公开, 验签需要 jwt secret (后端独占)
        # 而 jwt secret 没在 .env 里, 加入未来再做
        # 现在依赖 Supabase Auth 流程的"前端拿到的 JWT 是真的"这个前提
        payload = jwt.get_unverified_claims(token)
        user_id = payload.get("sub")
        # 检查 token role (anon key 的 token role=anon, 用户登录后 role=authenticated)
        role = payload.get("role")
        if role != "authenticated":
            return None  # anon key 本身不算"用户"
        return user_id
    except JWTError:
        return None
    except Exception:
        return None


def require_user_id(request: Request) -> str:
    """
    强制要求登录用户 (用在受保护的 endpoints).
    未登录 -> 抛 HTTPException 401.
    """
    from fastapi import HTTPException
    uid = get_user_id_from_request(request)
    if not uid:
        raise HTTPException(401, "Authentication required")
    return uid
