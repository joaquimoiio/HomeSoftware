"""Autenticação: hash bcrypt, JWT em cookie httpOnly e dependências de acesso.

- `hash_password`/`verify_password` — passlib + bcrypt (senha nunca em texto).
- `create_access_token` — JWT assinado com SECRET_KEY; `sub` = id do usuário.
- `set_auth_cookie`/`clear_auth_cookie` — guarda/limpa o token num cookie httpOnly.
- `get_current_user` — lê o cookie, valida o token, carrega o User (recusa inativo).
- `get_current_admin` — reusa o anterior e exige `is_admin` (senão 403).
- `bootstrap_admin` — no startup cria o 1º admin a partir do .env, se não há usuários.
"""
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
from fastapi import Cookie, Depends, HTTPException, Response, status
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from ..models.user import User
from .config import settings
from .db import get_db

ALGORITHM = "HS256"
COOKIE_NAME = "painel_session"


# --- senhas ------------------------------------------------------------------
# Usamos a lib `bcrypt` direto (não passlib): passlib está sem manutenção e quebra
# com bcrypt >= 4.1/5.x. bcrypt tem wheel para ARM e é o que importa no Pi.
def _to_72(password: str) -> bytes:
    # bcrypt só considera os primeiros 72 bytes; truncamos para não estourar com
    # senhas longas (bcrypt 5.x levanta ValueError em vez de truncar sozinho).
    return password.encode("utf-8")[:72]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(_to_72(password), bcrypt.gensalt()).decode("ascii")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(_to_72(password), password_hash.encode("ascii"))
    except ValueError:
        # hash malformado no banco — trata como não confere, sem 500.
        return False


def generate_password() -> str:
    """Senha forte aleatória para cadastro/reset de usuário pelo admin.

    `token_urlsafe(12)` => ~16 caracteres URL-safe (>= 96 bits de entropia),
    bem acima do mínimo de 8 da troca de senha. Mostrada uma única vez ao admin.
    """
    return secrets.token_urlsafe(12)


# --- JWT ---------------------------------------------------------------------
def create_access_token(user_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    payload = {"sub": str(user_id), "exp": expire}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHM)


def set_auth_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        samesite="lax",
        # secure=False: o Pi é acessado por http na rede local / Tailscale.
        secure=False,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )


def clear_auth_cookie(response: Response) -> None:
    response.delete_cookie(key=COOKIE_NAME, path="/")


# --- dependências de acesso --------------------------------------------------
_credentials_error = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED, detail="Não autenticado"
)


def get_current_user(
    painel_session: str | None = Cookie(default=None, alias=COOKIE_NAME),
    db: Session = Depends(get_db),
) -> User:
    if not painel_session:
        raise _credentials_error
    try:
        payload = jwt.decode(
            painel_session, settings.SECRET_KEY, algorithms=[ALGORITHM]
        )
        user_id = int(payload.get("sub"))
    except (JWTError, TypeError, ValueError):
        raise _credentials_error

    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise _credentials_error
    return user


def get_current_admin(user: User = Depends(get_current_user)) -> User:
    if not user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Acesso restrito a admin"
        )
    return user


# --- bootstrap do 1º admin ---------------------------------------------------
def bootstrap_admin(db: Session) -> None:
    """Cria o admin do .env se ainda não existe nenhum usuário (idempotente)."""
    if db.query(User.id).first() is not None:
        return
    admin = User(
        username=settings.ADMIN_USER,
        password_hash=hash_password(settings.ADMIN_PASSWORD),
        is_admin=True,
        is_active=True,
        # 1º admin já entra com a senha do .env; trocar depois é recomendado mas
        # não obrigatório (ele é quem administra). Usuários criados pelo admin é
        # que entram com must_change_password=True (ver sprint 02b).
        must_change_password=False,
    )
    db.add(admin)
    db.commit()
