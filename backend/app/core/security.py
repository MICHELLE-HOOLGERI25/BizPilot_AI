
import base64
import hashlib
import hmac
import json
import time
from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import settings


bearer_scheme = HTTPBearer(auto_error=False)

ROLE_PERMISSIONS: dict[str, set[str]] = {
    "viewer": {
        "products:read",
        "inventory:read",
        "sales:read",
        "suppliers:read",
        "purchase_orders:read",
    },
    "operator": {
        "products:read",
        "inventory:read",
        "sales:read",
        "suppliers:read",
        "purchase_orders:read",
        "purchase_orders:create",
    },
    "admin": {"*"},
}


@dataclass(frozen=True)
class Actor:
    actor_id: str
    tenant_id: str
    role: str

    def can(self, permission: str) -> bool:
        permissions = ROLE_PERMISSIONS.get(self.role, set())
        return "*" in permissions or permission in permissions


def _unauthorized(detail: str = "Authentication required") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def _decode_segment(segment: str) -> bytes:
    return base64.urlsafe_b64decode(
        segment + ("=" * (-len(segment) % 4))
    )


def _encode_segment(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode().rstrip("=")


def create_access_token(
    actor_id: str,
    tenant_id: str,
    role: str,
    expires_in_seconds: int = 3600,
) -> str:
    """
    Create a signed token for trusted server-side tooling/tests.
    Do not expose this function as an unauthenticated HTTP endpoint.
    """
    if not settings.auth_token_secret:
        raise RuntimeError("AUTH_TOKEN_SECRET is not configured")

    if not actor_id.strip() or not tenant_id.strip():
        raise ValueError("actor_id and tenant_id are required")

    if role not in ROLE_PERMISSIONS:
        raise ValueError("Unknown role")

    payload = {
        "sub": actor_id,
        "tenant_id": tenant_id,
        "role": role,
        "exp": int(time.time()) + expires_in_seconds,
    }
    body = _encode_segment(
        json.dumps(payload, separators=(",", ":"), sort_keys=True).encode()
    )
    signature = hmac.new(
        settings.auth_token_secret.get_secret_value().encode(),
        body.encode(),
        hashlib.sha256,
    ).digest()

    return f"{body}.{_encode_segment(signature)}"


def _actor_from_token(token: str) -> Actor:
    if not settings.auth_token_secret:
        raise _unauthorized("Token authentication is not configured")

    try:
        body, encoded_signature = token.split(".", maxsplit=1)
        supplied_signature = _decode_segment(encoded_signature)
        expected_signature = hmac.new(
            settings.auth_token_secret.get_secret_value().encode(),
            body.encode(),
            hashlib.sha256,
        ).digest()

        if not hmac.compare_digest(supplied_signature, expected_signature):
            raise _unauthorized("Invalid bearer token")

        payload = json.loads(_decode_segment(body))
        if int(payload["exp"]) <= int(time.time()):
            raise _unauthorized("Bearer token has expired")

        actor_id = str(payload["sub"]).strip()
        tenant_id = str(payload["tenant_id"]).strip()
        role = str(payload["role"])

        if not actor_id or not tenant_id or role not in ROLE_PERMISSIONS:
            raise _unauthorized("Invalid bearer token")

        return Actor(
            actor_id=actor_id,
            tenant_id=tenant_id,
            role=role,
        )
    except HTTPException:
        raise
    except (ValueError, KeyError, TypeError, json.JSONDecodeError):
        raise _unauthorized("Invalid bearer token")


def get_current_actor(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None,
        Depends(bearer_scheme),
    ],
    x_demo_actor_id: Annotated[str | None, Header()] = None,
    x_demo_tenant_id: Annotated[str | None, Header()] = None,
    x_demo_role: Annotated[str | None, Header()] = None,
) -> Actor:
    environment = settings.app_env.strip().lower()

    if settings.demo_auth_enabled and environment in {"development", "test"}:
        # These headers are intentionally a local-development fixture only.
        # They are ignored entirely outside development/test.
        if (
            x_demo_actor_id
            and x_demo_tenant_id
            and x_demo_role
        ):
            if x_demo_role not in ROLE_PERMISSIONS:
                raise HTTPException(
                    status_code=403,
                    detail="Unknown demo role",
                )

            return Actor(
                actor_id=x_demo_actor_id.strip(),
                tenant_id=x_demo_tenant_id.strip(),
                role=x_demo_role,
            )

    if credentials is None or credentials.scheme.lower() != "bearer":
        raise _unauthorized()

    return _actor_from_token(credentials.credentials)


def require_permission(permission: str):
    def dependency(
        actor: Annotated[Actor, Depends(get_current_actor)],
    ) -> Actor:
        if not actor.can(permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Permission denied",
            )
        return actor

    return dependency
