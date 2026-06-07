"""Router de autenticação — /api/auth.

login (usuário+senha → cookie), logout, me (usuário logado) e change-password
(troca a senha e limpa a flag must_change_password). Nenhum response devolve o
password_hash.
"""
from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..core.db import get_db
from ..core.security import (
    clear_auth_cookie,
    create_access_token,
    get_current_user,
    hash_password,
    set_auth_cookie,
    verify_password,
)
from ..models.user import User

router = APIRouter(prefix="/api/auth", tags=["auth"])


# --- schemas -----------------------------------------------------------------
class LoginIn(BaseModel):
    username: str
    password: str


class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)


class UserRead(BaseModel):
    id: int
    username: str
    is_admin: bool
    must_change_password: bool

    model_config = {"from_attributes": True}


# --- endpoints ---------------------------------------------------------------
@router.post("/login", response_model=UserRead)
async def login(data: LoginIn, response: Response, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == data.username).first()
    # Mensagem genérica e mesma resposta para usuário inexistente / inativo /
    # senha errada: não vaza quais usuários existem.
    if (
        user is None
        or not user.is_active
        or not verify_password(data.password, user.password_hash)
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário ou senha inválidos",
        )
    token = create_access_token(user.id)
    set_auth_cookie(response, token)
    return user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(response: Response, _: User = Depends(get_current_user)):
    clear_auth_cookie(response)


@router.get("/me", response_model=UserRead)
async def me(user: User = Depends(get_current_user)):
    return user


@router.post("/change-password", response_model=UserRead)
async def change_password(
    data: ChangePasswordIn,
    response: Response,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(data.current_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Senha atual incorreta",
        )
    user.password_hash = hash_password(data.new_password)
    user.must_change_password = False
    db.commit()
    db.refresh(user)
    # Re-emite o cookie: senha trocada => sessão renovada.
    set_auth_cookie(response, create_access_token(user.id))
    return user
