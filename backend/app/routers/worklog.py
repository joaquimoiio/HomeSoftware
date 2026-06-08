"""Router do Work Log — /api/worklog (CRUD de registros de horas + resumo).

Registro próprio de atividades trabalhadas (número da atividade, descrição, hora de
início e duração em minutos). Tudo **filtrado pelo usuário logado**
(`get_current_user`): ao buscar por id usamos `WHERE id = ? AND user_id = ?` e, se
não achar, respondemos 404 (não vaza a existência de registro de outro usuário).

O filtro de período age sobre a **data do início** (`inicio`): `inicio >= 00:00` do
primeiro dia e `< 00:00` do dia seguinte ao último — assim o último dia entra
inteiro. O resumo soma os minutos no período (total e por atividade).
"""
from datetime import date, datetime, time, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..core.db import get_db
from ..core.security import get_current_user
from ..models.user import User
from ..models.worklog import WorkLog

router = APIRouter(
    prefix="/api/worklog",
    tags=["worklog"],
    dependencies=[Depends(get_current_user)],
)


# --- schemas -----------------------------------------------------------------
class WorkLogBase(BaseModel):
    atividade: str = Field(min_length=1, max_length=60)
    descricao: str | None = Field(default=None, max_length=2000)
    inicio: datetime
    duracao_min: int = Field(gt=0, le=60 * 24 * 7)  # teto sóbrio: 1 semana

    @field_validator("atividade")
    @classmethod
    def _strip_atividade(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("a atividade não pode ser vazia")
        return v

    @field_validator("descricao")
    @classmethod
    def _strip_opcional(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        return v or None


class WorkLogCreate(WorkLogBase):
    pass


class WorkLogUpdate(WorkLogBase):
    pass


class WorkLogRead(BaseModel):
    id: int
    atividade: str
    descricao: str | None
    inicio: datetime
    duracao_min: int

    @classmethod
    def of(cls, w: WorkLog) -> "WorkLogRead":
        return cls(
            id=w.id,
            atividade=w.atividade,
            descricao=w.descricao,
            inicio=w.inicio,
            duracao_min=w.duracao_min,
        )


class TotalAtividade(BaseModel):
    atividade: str
    total_min: int


class ResumoWorkLog(BaseModel):
    total_min: int
    registros: int
    por_atividade: list[TotalAtividade]


# --- helpers -----------------------------------------------------------------
def _do_usuario(db: Session, user: User):
    """Base de query já filtrada pelo dono — toda consulta parte daqui."""
    return db.query(WorkLog).filter(WorkLog.user_id == user.id)


def _get_or_404(db: Session, user: User, worklog_id: int) -> WorkLog:
    w = _do_usuario(db, user).filter(WorkLog.id == worklog_id).first()
    if w is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Registro não encontrado"
        )
    return w


def _periodo(inicio: date | None, fim: date | None):
    """Valida o par (início, fim) e devolve os filtros sobre `WorkLog.inicio`.

    Filtra pela data do início: do começo do primeiro dia até o começo do dia
    seguinte ao último — assim o último dia entra inteiro (até 23:59).
    """
    if inicio and fim and fim < inicio:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="fim não pode ser anterior a início",
        )
    filtros = []
    if inicio:
        filtros.append(WorkLog.inicio >= datetime.combine(inicio, time.min))
    if fim:
        filtros.append(WorkLog.inicio < datetime.combine(fim + timedelta(days=1), time.min))
    return filtros


# --- CRUD --------------------------------------------------------------------
@router.get("/registros", response_model=list[WorkLogRead])
async def list_registros(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    inicio: date | None = Query(default=None),
    fim: date | None = Query(default=None),
):
    itens = (
        _do_usuario(db, user)
        .filter(*_periodo(inicio, fim))
        .order_by(WorkLog.inicio.desc(), WorkLog.id.desc())
        .all()
    )
    return [WorkLogRead.of(i) for i in itens]


@router.post(
    "/registros", response_model=WorkLogRead, status_code=status.HTTP_201_CREATED
)
async def create_registro(
    data: WorkLogCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    w = WorkLog(
        user_id=user.id,
        atividade=data.atividade,
        descricao=data.descricao,
        inicio=data.inicio,
        duracao_min=data.duracao_min,
    )
    db.add(w)
    db.commit()
    db.refresh(w)
    return WorkLogRead.of(w)


@router.get("/registros/{worklog_id}", response_model=WorkLogRead)
async def get_registro(
    worklog_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return WorkLogRead.of(_get_or_404(db, user, worklog_id))


@router.put("/registros/{worklog_id}", response_model=WorkLogRead)
async def update_registro(
    worklog_id: int,
    data: WorkLogUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    w = _get_or_404(db, user, worklog_id)
    w.atividade = data.atividade
    w.descricao = data.descricao
    w.inicio = data.inicio
    w.duracao_min = data.duracao_min
    db.commit()
    db.refresh(w)
    return WorkLogRead.of(w)


@router.delete("/registros/{worklog_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_registro(
    worklog_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    w = _get_or_404(db, user, worklog_id)
    db.delete(w)
    db.commit()


# --- resumo ------------------------------------------------------------------
@router.get("/resumo", response_model=ResumoWorkLog)
async def resumo(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    inicio: date | None = Query(default=None),
    fim: date | None = Query(default=None),
):
    filtros = _periodo(inicio, fim)

    total_min, registros = (
        db.query(
            func.coalesce(func.sum(WorkLog.duracao_min), 0),
            func.count(WorkLog.id),
        )
        .filter(WorkLog.user_id == user.id, *filtros)
        .one()
    )

    por_atividade = (
        db.query(
            WorkLog.atividade,
            func.coalesce(func.sum(WorkLog.duracao_min), 0),
        )
        .filter(WorkLog.user_id == user.id, *filtros)
        .group_by(WorkLog.atividade)
        .order_by(func.sum(WorkLog.duracao_min).desc())
        .all()
    )

    return ResumoWorkLog(
        total_min=int(total_min),
        registros=int(registros),
        por_atividade=[
            TotalAtividade(atividade=a, total_min=int(t)) for a, t in por_atividade
        ],
    )
