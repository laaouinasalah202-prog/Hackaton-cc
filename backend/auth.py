import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Dict, Optional, Tuple
from urllib.parse import urlencode

import httpx

from backend.config import (
    AUTH_SESSION_MAX_AGE,
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI,
)
from backend.models import AuthUser

GOOGLE_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"
STATE_MAX_AGE = timedelta(minutes=10)


class GoogleAuthError(Exception):
    pass


@dataclass
class PendingState:
    expires_at: datetime


@dataclass
class AuthSession:
    user: AuthUser
    expires_at: datetime


_pending_states: Dict[str, PendingState] = {}
_sessions: Dict[str, AuthSession] = {}


def _require_google_config() -> None:
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise GoogleAuthError(
            "Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET."
        )


def build_google_login_url() -> str:
    _require_google_config()
    state = secrets.token_urlsafe(32)
    _pending_states[state] = PendingState(
        expires_at=datetime.now(timezone.utc) + STATE_MAX_AGE
    )

    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "access_type": "online",
        "prompt": "select_account",
    }
    return f"{GOOGLE_AUTHORIZE_URL}?{urlencode(params)}"


def _consume_state(state: str) -> None:
    pending = _pending_states.pop(state, None)
    if not pending or pending.expires_at <= datetime.now(timezone.utc):
        raise GoogleAuthError("Invalid or expired OAuth state.")


async def exchange_code_for_session(code: str, state: str) -> Tuple[str, AuthUser]:
    _require_google_config()
    _consume_state(state)

    async with httpx.AsyncClient(timeout=10.0) as client:
        token_response = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "redirect_uri": GOOGLE_REDIRECT_URI,
                "grant_type": "authorization_code",
            },
        )
        if token_response.status_code != 200:
            raise GoogleAuthError("Google rejected the authorization code.")

        token_data = token_response.json()
        access_token = token_data.get("access_token")
        if not access_token:
            raise GoogleAuthError("Google did not return an access token.")

        userinfo_response = await client.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if userinfo_response.status_code != 200:
            raise GoogleAuthError("Could not retrieve the Google user profile.")

    profile = userinfo_response.json()
    email = profile.get("email")
    if not profile.get("sub") or not email or not profile.get("email_verified", False):
        raise GoogleAuthError("Google returned an incomplete or unverified profile.")

    user = AuthUser(
        sub=profile["sub"],
        email=email,
        name=profile.get("name", ""),
        picture=profile.get("picture"),
        email_verified=bool(profile.get("email_verified")),
    )
    session_id = secrets.token_urlsafe(32)
    _sessions[session_id] = AuthSession(
        user=user,
        expires_at=datetime.now(timezone.utc) + timedelta(seconds=AUTH_SESSION_MAX_AGE),
    )
    return session_id, user


def get_session(session_id: Optional[str]) -> Optional[AuthUser]:
    if not session_id:
        return None
    session = _sessions.get(session_id)
    if not session:
        return None
    if session.expires_at <= datetime.now(timezone.utc):
        _sessions.pop(session_id, None)
        return None
    return session.user


def delete_session(session_id: Optional[str]) -> None:
    if session_id:
        _sessions.pop(session_id, None)