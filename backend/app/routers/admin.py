"""Router de administração — /api/admin (somente admin).

Gestão de usuários pelo admin: listar, cadastrar, resetar senha, ativar/desativar,
promover e remover. Ao cadastrar ou resetar, o sistema gera uma senha forte
aleatória, salva só o hash e devolve a senha **uma única vez** no response,
marcando a conta para trocar a senha no primeiro login.

Salvaguardas: nunca deixar o sistema sem nenhum admin ativo (rebaixar/desativar/
excluir o último admin ativo é bloqueado); `username` único (409 ao duplicar).
Nenhum response expõe `password_hash`.
"""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from ..core.db import get_db
from ..core.security import generate_password, get_current_admin, hash_password
from ..models.user import User

router = APIRouter(
    prefix="/api/admin",
    tags=["admin"],
    dependencies=[Depends(get_current_admin)],
)


# --- schemas -----------------------------------------------------------------
class AdminUserRead(BaseModel):
    id: int
    username: str
    is_admin: bool
    is_active: bool
    must_change_password: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class AdminUserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    is_admin: bool = False

    @field_validator("username")
    @classmethod
    def _strip(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("usuário não pode ser vazio")
        return v


class AdminUserUpdate(BaseModel):
    is_active: bool | None = None
    is_admin: bool | None = None


class UserWithPassword(BaseModel):
    """Resposta de cadastro/reset: o usuário + a senha gerada (uma única vez)."""

    user: AdminUserRead
    generated_password: str


# --- helpers -----------------------------------------------------------------
def _get_user_or_404(db: Session, user_id: int) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado"
        )
    return user


def _other_active_admin_exists(db: Session, exclude_id: int) -> bool:
    """Há outro admin ativo além do usuário `exclude_id`?"""
    return (
        db.query(User.id)
        .filter(
            User.is_admin.is_(True),
            User.is_active.is_(True),
            User.id != exclude_id,
        )
        .first()
        is not None
    )


_last_admin_error = HTTPException(
    status_code=status.HTTP_409_CONFLICT,
    detail="É preciso manter ao menos um admin ativo",
)


# --- endpoints ---------------------------------------------------------------
@router.get("/users", response_model=list[AdminUserRead])
async def list_users(db: Session = Depends(get_db)):
    return db.query(User).order_by(User.created_at.asc()).all()


@router.post(
    "/users", response_model=UserWithPassword, status_code=status.HTTP_201_CREATED
)
async def create_user(data: AdminUserCreate, db: Session = Depends(get_db)):
    exists = db.query(User.id).filter(User.username == data.username).first()
    if exists is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Usuário já existe"
        )
    password = generate_password()
    user = User(
        username=data.username,
        password_hash=hash_password(password),
        is_admin=data.is_admin,
        is_active=True,
        must_change_password=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return UserWithPassword(user=AdminUserRead.model_validate(user), generated_password=password)


@router.post("/users/{user_id}/reset-password", response_model=UserWithPassword)
async def reset_password(user_id: int, db: Session = Depends(get_db)):
    user = _get_user_or_404(db, user_id)
    password = generate_password()
    user.password_hash = hash_password(password)
    user.must_change_password = True
    db.commit()
    db.refresh(user)
    return UserWithPassword(user=AdminUserRead.model_validate(user), generated_password=password)


@router.patch("/users/{user_id}", response_model=AdminUserRead)
async def update_user(
    user_id: int,
    data: AdminUserUpdate,
    db: Session = Depends(get_db),
):
    user = _get_user_or_404(db, user_id)

    # Rebaixar (tirar admin) ou desativar o último admin ativo é proibido.
    losing_admin = data.is_admin is False and user.is_admin
    deactivating = data.is_active is False and user.is_active
    if (losing_admin or deactivating) and user.is_admin and user.is_active:
        if not _other_active_admin_exists(db, exclude_id=user.id):
            raise _last_admin_error

    if data.is_admin is not None:
        user.is_admin = data.is_admin
    if data.is_active is not None:
        user.is_active = data.is_active
    db.commit()
    db.refresh(user)
    return user


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(user_id: int, db: Session = Depends(get_db)):
    user = _get_user_or_404(db, user_id)
    if user.is_admin and user.is_active and not _other_active_admin_exists(
        db, exclude_id=user.id
    ):
        raise _last_admin_error
    db.delete(user)
    db.commit()
