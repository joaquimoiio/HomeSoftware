"""Router da agenda — /api/calendar (CRUD de eventos + consulta por intervalo).

CRUD de eventos do calendário e uma listagem por intervalo que **expande as
ocorrências** de eventos recorrentes (diária/semanal/mensal) dentro da janela
pedida — a recorrência é só uma regra no registro-base, não linhas no banco.

**Tudo é filtrado pelo usuário logado** (`get_current_user`): ao buscar por id
usamos `WHERE id = ? AND user_id = ?` e, se não achar, respondemos 404 (não vaza a
existência de evento de outro usuário). Datas/horas trafegam como `datetime` naive
(hora de parede local) — sem fuso, igual à filosofia de data pura do financeiro.
"""
import calendar as _cal
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, field_validator, model_validator
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..core.db import get_db
from ..core.security import get_current_user
from ..models.calendar import (
    CORES,
    COR_PADRAO,
    REC_DIARIA,
    REC_MENSAL,
    REC_NENHUMA,
    REC_SEMANAL,
    RECORRENCIAS,
    Evento,
)
from ..models.user import User

router = APIRouter(
    prefix="/api/calendar",
    tags=["calendar"],
    dependencies=[Depends(get_current_user)],
)

_cor_pattern = "^(" + "|".join(CORES) + ")$"
_rec_pattern = "^(" + "|".join(RECORRENCIAS) + ")$"


# --- schemas -----------------------------------------------------------------
class EventoBase(BaseModel):
    titulo: str = Field(min_length=1, max_length=120)
    descricao: str | None = Field(default=None, max_length=2000)
    inicio: datetime
    fim: datetime
    dia_inteiro: bool = False
    local: str | None = Field(default=None, max_length=120)
    cor: str = Field(default=COR_PADRAO, pattern=_cor_pattern)
    recorrencia: str = Field(default=REC_NENHUMA, pattern=_rec_pattern)

    @field_validator("titulo")
    @classmethod
    def _strip_titulo(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("título não pode ser vazio")
        return v

    @field_validator("descricao", "local")
    @classmethod
    def _strip_opcional(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        return v or None

    @model_validator(mode="after")
    def _checar_intervalo(self) -> "EventoBase":
        if self.fim < self.inicio:
            raise ValueError("fim não pode ser anterior ao início")
        return self


class EventoCreate(EventoBase):
    pass


class EventoUpdate(EventoBase):
    pass


class EventoRead(BaseModel):
    """Evento-base, como persistido (para abrir no formulário de edição)."""

    id: int
    titulo: str
    descricao: str | None
    inicio: datetime
    fim: datetime
    dia_inteiro: bool
    local: str | None
    cor: str
    recorrencia: str

    @classmethod
    def of(cls, e: Evento) -> "EventoRead":
        return cls(
            id=e.id,
            titulo=e.titulo,
            descricao=e.descricao,
            inicio=e.inicio,
            fim=e.fim,
            dia_inteiro=e.dia_inteiro,
            local=e.local,
            cor=e.cor,
            recorrencia=e.recorrencia,
        )


class Ocorrencia(BaseModel):
    """Uma ocorrência concreta na janela consultada.

    Carrega o `id` do evento-base (editar/excluir age sobre a série inteira) e o
    `inicio`/`fim` já calculados para aquela repetição. `recorrente` diz à UI que
    é uma instância de um evento que se repete.
    """

    id: int
    titulo: str
    descricao: str | None
    inicio: datetime
    fim: datetime
    dia_inteiro: bool
    local: str | None
    cor: str
    recorrencia: str
    recorrente: bool


# --- expansão de recorrência -------------------------------------------------
def _add_meses_dt(d: datetime, n: int) -> datetime:
    """`d` + `n` meses, preservando a hora e ajustando o dia em meses curtos."""
    total = d.month - 1 + n
    ano = d.year + total // 12
    mes = total % 12 + 1
    dia = min(d.day, _cal.monthrange(ano, mes)[1])
    return d.replace(year=ano, month=mes, day=dia)


def _ocorrencias(ev: Evento, jan_inicio: datetime, jan_fim: datetime):
    """Pares (início, fim) das ocorrências de `ev` que tocam [jan_inicio, jan_fim].

    Um evento ocorre na janela quando se sobrepõe a ela: `inicio <= jan_fim` e
    `fim >= jan_inicio`. Para os recorrentes avançamos a partir do início-base,
    saltando direto para perto da janela (sem iterar desde a origem).
    """
    dur = ev.fim - ev.inicio
    base = ev.inicio
    rec = ev.recorrencia

    if rec == REC_NENHUMA:
        if base <= jan_fim and ev.fim >= jan_inicio:
            return [(base, ev.fim)]
        return []

    out: list[tuple[datetime, datetime]] = []
    if rec in (REC_DIARIA, REC_SEMANAL):
        passo = timedelta(days=1 if rec == REC_DIARIA else 7)
        # salta para perto: nº de passos até o fim alcançar o início da janela.
        falta = jan_inicio - ev.fim
        k = falta // passo if falta.total_seconds() > 0 else 0
        occ = base + k * passo
        # ajuste fino da borda do floor (garante a 1ª ocorrência que toca a janela).
        while occ + dur < jan_inicio:
            occ += passo
        while occ <= jan_fim:
            out.append((occ, occ + dur))
            occ += passo
    else:  # mensal — janelas são curtas; aproxima pelo nº de meses.
        meses = (jan_inicio.year - base.year) * 12 + (jan_inicio.month - base.month)
        k = max(0, meses)
        occ = _add_meses_dt(base, k)
        while occ + dur < jan_inicio and k < 10000:
            k += 1
            occ = _add_meses_dt(base, k)
        # pode ter saltado além; recua se a anterior ainda toca a janela.
        while k > 0 and _add_meses_dt(base, k - 1) + dur >= jan_inicio:
            k -= 1
            occ = _add_meses_dt(base, k)
        while occ <= jan_fim:
            out.append((occ, occ + dur))
            k += 1
            occ = _add_meses_dt(base, k)
    return out


# --- helpers de query --------------------------------------------------------
def _do_usuario(db: Session, user: User):
    """Base de query já filtrada pelo dono — toda consulta parte daqui."""
    return db.query(Evento).filter(Evento.user_id == user.id)


def _get_or_404(db: Session, user: User, evento_id: int) -> Evento:
    ev = _do_usuario(db, user).filter(Evento.id == evento_id).first()
    if ev is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Evento não encontrado"
        )
    return ev


# --- consulta por intervalo (ocorrências expandidas) -------------------------
@router.get("/eventos", response_model=list[Ocorrencia])
async def list_eventos(
    inicio: datetime = Query(..., description="Início da janela (datetime naive)"),
    fim: datetime = Query(..., description="Fim da janela (datetime naive)"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if fim < inicio:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="fim não pode ser anterior a início",
        )
    # Pré-filtro no banco: pega não-recorrentes que se sobrepõem à janela e
    # todos os recorrentes que começam antes do fim dela (a expansão refina).
    candidatos = (
        _do_usuario(db, user)
        .filter(
            or_(
                Evento.recorrencia != REC_NENHUMA,
                (Evento.inicio <= fim) & (Evento.fim >= inicio),
            ),
            Evento.inicio <= fim,
        )
        .all()
    )
    out: list[Ocorrencia] = []
    for ev in candidatos:
        recorrente = ev.recorrencia != REC_NENHUMA
        for occ_inicio, occ_fim in _ocorrencias(ev, inicio, fim):
            out.append(
                Ocorrencia(
                    id=ev.id,
                    titulo=ev.titulo,
                    descricao=ev.descricao,
                    inicio=occ_inicio,
                    fim=occ_fim,
                    dia_inteiro=ev.dia_inteiro,
                    local=ev.local,
                    cor=ev.cor,
                    recorrencia=ev.recorrencia,
                    recorrente=recorrente,
                )
            )
    out.sort(key=lambda o: o.inicio)
    return out


# --- CRUD --------------------------------------------------------------------
@router.post(
    "/eventos", response_model=EventoRead, status_code=status.HTTP_201_CREATED
)
async def create_evento(
    data: EventoCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    ev = Evento(
        user_id=user.id,
        titulo=data.titulo,
        descricao=data.descricao,
        inicio=data.inicio,
        fim=data.fim,
        dia_inteiro=data.dia_inteiro,
        local=data.local,
        cor=data.cor,
        recorrencia=data.recorrencia,
    )
    db.add(ev)
    db.commit()
    db.refresh(ev)
    return EventoRead.of(ev)


@router.get("/eventos/{evento_id}", response_model=EventoRead)
async def get_evento(
    evento_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return EventoRead.of(_get_or_404(db, user, evento_id))


@router.put("/eventos/{evento_id}", response_model=EventoRead)
async def update_evento(
    evento_id: int,
    data: EventoUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    ev = _get_or_404(db, user, evento_id)
    ev.titulo = data.titulo
    ev.descricao = data.descricao
    ev.inicio = data.inicio
    ev.fim = data.fim
    ev.dia_inteiro = data.dia_inteiro
    ev.local = data.local
    ev.cor = data.cor
    ev.recorrencia = data.recorrencia
    db.commit()
    db.refresh(ev)
    return EventoRead.of(ev)


@router.delete("/eventos/{evento_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_evento(
    evento_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    ev = _get_or_404(db, user, evento_id)
    db.delete(ev)
    db.commit()
