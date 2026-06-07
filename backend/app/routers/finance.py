"""Router do financeiro — /api/finance (fluxo de caixa + patrimônio).

CRUD de lançamentos (entradas/saídas) e de itens de patrimônio (reservas/
investimentos), com endpoints de resumo. **Tudo é filtrado pelo usuário logado**
(`get_current_user`): ao buscar por id usamos `WHERE id = ? AND user_id = ?` e, se
não achar, respondemos 404 (não vaza a existência de dado de outro usuário).

Dinheiro entra/sai da API em reais (Decimal, 2 casas) e é guardado como inteiro de
centavos no banco — conversão concentrada em `_para_centavos`/`_reais`.
"""
import calendar
from datetime import date, datetime, timezone
from decimal import Decimal, InvalidOperation

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, field_validator, model_validator
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from ..core.db import get_db
from ..core.security import get_current_user
from ..models.finance import (
    TIPO_ENTRADA,
    TIPO_INVESTIMENTO,
    TIPO_RESERVA,
    TIPO_SAIDA,
    Divida,
    HistoricoPatrimonio,
    ItemPatrimonio,
    Lancamento,
    Parcela,
)
from ..models.user import User

router = APIRouter(
    prefix="/api/finance",
    tags=["finance"],
    dependencies=[Depends(get_current_user)],
)

Tipo = Field(pattern="^(entrada|saida)$")


# --- conversão de dinheiro ---------------------------------------------------
def _para_centavos(valor: Decimal) -> int:
    """Reais (Decimal já validado, positivo, ≤ 2 casas) → inteiro de centavos."""
    return int((valor * 100).to_integral_value())


def _reais(centavos: int) -> float:
    """Centavos → reais para exibição (o valor exato vive em centavos no banco)."""
    return round(centavos / 100, 2)


def _validar_2_casas(v: Decimal) -> Decimal:
    """Recusa mais de 2 casas decimais (ex.: 10.999) — evita perder centavos."""
    try:
        if v != v.quantize(Decimal("0.01")):
            raise ValueError("valor deve ter no máximo 2 casas decimais")
    except InvalidOperation:
        raise ValueError("valor inválido")
    return v


# --- schemas -----------------------------------------------------------------
class LancamentoBase(BaseModel):
    tipo: str = Tipo
    valor: Decimal = Field(gt=0, description="Valor em reais, positivo, até 2 casas")
    descricao: str = Field(min_length=1, max_length=120)
    categoria: str = Field(min_length=1, max_length=60)
    data: date

    @field_validator("valor")
    @classmethod
    def _duas_casas(cls, v: Decimal) -> Decimal:
        # Recusa mais de 2 casas decimais (ex.: 10.999) — evita perder centavos.
        try:
            if v != v.quantize(Decimal("0.01")):
                raise ValueError("valor deve ter no máximo 2 casas decimais")
        except InvalidOperation:
            raise ValueError("valor inválido")
        return v

    @field_validator("descricao", "categoria")
    @classmethod
    def _strip(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("campo não pode ser vazio")
        return v


class LancamentoCreate(LancamentoBase):
    pass


class LancamentoUpdate(LancamentoBase):
    pass


class LancamentoRead(BaseModel):
    id: int
    tipo: str
    valor: float
    descricao: str
    categoria: str
    data: date

    @classmethod
    def of(cls, item: Lancamento) -> "LancamentoRead":
        return cls(
            id=item.id,
            tipo=item.tipo,
            valor=_reais(item.valor_centavos),
            descricao=item.descricao,
            categoria=item.categoria,
            data=item.data,
        )


class Resumo(BaseModel):
    entradas: float
    saidas: float
    saldo: float


class PontoMes(BaseModel):
    mes: str  # "YYYY-MM"
    entradas: float
    saidas: float
    saldo: float


class PontoCategoria(BaseModel):
    categoria: str
    total: float


# --- helpers -----------------------------------------------------------------
def _do_usuario(db: Session, user: User):
    """Base de query já filtrada pelo dono — toda consulta parte daqui."""
    return db.query(Lancamento).filter(Lancamento.user_id == user.id)


def _get_or_404(db: Session, user: User, lancamento_id: int) -> Lancamento:
    item = _do_usuario(db, user).filter(Lancamento.id == lancamento_id).first()
    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Lançamento não encontrado"
        )
    return item


def _periodo(inicio: date | None, fim: date | None):
    """Valida o par (início, fim) e devolve os filtros SQLAlchemy a aplicar."""
    if inicio and fim and fim < inicio:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="fim não pode ser anterior a início",
        )
    filtros = []
    if inicio:
        filtros.append(Lancamento.data >= inicio)
    if fim:
        filtros.append(Lancamento.data <= fim)
    return filtros


# Somas condicionais por tipo, reaproveitadas pelos resumos.
_soma_entradas = func.coalesce(
    func.sum(case((Lancamento.tipo == TIPO_ENTRADA, Lancamento.valor_centavos), else_=0)),
    0,
)
_soma_saidas = func.coalesce(
    func.sum(case((Lancamento.tipo == TIPO_SAIDA, Lancamento.valor_centavos), else_=0)),
    0,
)


# --- CRUD --------------------------------------------------------------------
@router.get("/lancamentos", response_model=list[LancamentoRead])
async def list_lancamentos(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    inicio: date | None = Query(default=None),
    fim: date | None = Query(default=None),
    categoria: str | None = Query(default=None),
    tipo: str | None = Query(default=None, pattern="^(entrada|saida)$"),
):
    q = _do_usuario(db, user).filter(*_periodo(inicio, fim))
    if categoria:
        q = q.filter(Lancamento.categoria == categoria)
    if tipo:
        q = q.filter(Lancamento.tipo == tipo)
    itens = q.order_by(Lancamento.data.desc(), Lancamento.id.desc()).all()
    return [LancamentoRead.of(i) for i in itens]


@router.post(
    "/lancamentos", response_model=LancamentoRead, status_code=status.HTTP_201_CREATED
)
async def create_lancamento(
    data: LancamentoCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    item = Lancamento(
        user_id=user.id,
        tipo=data.tipo,
        valor_centavos=_para_centavos(data.valor),
        descricao=data.descricao,
        categoria=data.categoria,
        data=data.data,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return LancamentoRead.of(item)


@router.get("/lancamentos/{lancamento_id}", response_model=LancamentoRead)
async def get_lancamento(
    lancamento_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return LancamentoRead.of(_get_or_404(db, user, lancamento_id))


@router.put("/lancamentos/{lancamento_id}", response_model=LancamentoRead)
async def update_lancamento(
    lancamento_id: int,
    data: LancamentoUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    item = _get_or_404(db, user, lancamento_id)
    item.tipo = data.tipo
    item.valor_centavos = _para_centavos(data.valor)
    item.descricao = data.descricao
    item.categoria = data.categoria
    item.data = data.data
    db.commit()
    db.refresh(item)
    return LancamentoRead.of(item)


@router.delete(
    "/lancamentos/{lancamento_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_lancamento(
    lancamento_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    item = _get_or_404(db, user, lancamento_id)
    db.delete(item)
    db.commit()


# --- resumos -----------------------------------------------------------------
@router.get("/resumo", response_model=Resumo)
async def resumo(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    inicio: date | None = Query(default=None),
    fim: date | None = Query(default=None),
):
    entradas, saidas = (
        db.query(_soma_entradas, _soma_saidas)
        .filter(Lancamento.user_id == user.id, *_periodo(inicio, fim))
        .one()
    )
    return Resumo(
        entradas=_reais(entradas),
        saidas=_reais(saidas),
        saldo=_reais(entradas - saidas),
    )


@router.get("/resumo/por-mes", response_model=list[PontoMes])
async def resumo_por_mes(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    inicio: date | None = Query(default=None),
    fim: date | None = Query(default=None),
):
    mes = func.strftime("%Y-%m", Lancamento.data)
    rows = (
        db.query(mes.label("mes"), _soma_entradas, _soma_saidas)
        .filter(Lancamento.user_id == user.id, *_periodo(inicio, fim))
        .group_by("mes")
        .order_by("mes")
        .all()
    )
    return [
        PontoMes(
            mes=m,
            entradas=_reais(e),
            saidas=_reais(s),
            saldo=_reais(e - s),
        )
        for m, e, s in rows
    ]


@router.get("/resumo/por-categoria", response_model=list[PontoCategoria])
async def resumo_por_categoria(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    inicio: date | None = Query(default=None),
    fim: date | None = Query(default=None),
    tipo: str = Query(default=TIPO_SAIDA, pattern="^(entrada|saida)$"),
):
    total = func.sum(Lancamento.valor_centavos)
    rows = (
        db.query(Lancamento.categoria, total.label("total"))
        .filter(
            Lancamento.user_id == user.id,
            Lancamento.tipo == tipo,
            *_periodo(inicio, fim),
        )
        .group_by(Lancamento.categoria)
        .order_by(total.desc())
        .all()
    )
    return [PontoCategoria(categoria=c, total=_reais(t)) for c, t in rows]


# =============================================================================
# Patrimônio (reservas e investimentos) — saldo acumulado, atualizado à mão.
# =============================================================================
TipoItem = Field(pattern="^(reserva|investimento)$")


class ItemPatrimonioBase(BaseModel):
    nome: str = Field(min_length=1, max_length=80)
    valor: Decimal = Field(ge=0, description="Valor atual em reais, até 2 casas")
    tipo: str = TipoItem

    @field_validator("valor")
    @classmethod
    def _duas_casas(cls, v: Decimal) -> Decimal:
        # Recusa mais de 2 casas decimais — mesma regra do fluxo de caixa.
        try:
            if v != v.quantize(Decimal("0.01")):
                raise ValueError("valor deve ter no máximo 2 casas decimais")
        except InvalidOperation:
            raise ValueError("valor inválido")
        return v

    @field_validator("nome")
    @classmethod
    def _strip(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("campo não pode ser vazio")
        return v


class ItemPatrimonioCreate(ItemPatrimonioBase):
    pass


class ItemPatrimonioUpdate(ItemPatrimonioBase):
    pass


class ItemPatrimonioRead(BaseModel):
    id: int
    nome: str
    valor: float
    tipo: str
    atualizado_em: datetime

    @classmethod
    def of(cls, item: ItemPatrimonio) -> "ItemPatrimonioRead":
        return cls(
            id=item.id,
            nome=item.nome,
            valor=_reais(item.valor_centavos),
            tipo=item.tipo,
            atualizado_em=item.atualizado_em,
        )


class ResumoPatrimonio(BaseModel):
    guardado: float  # soma das reservas
    investido: float  # soma dos investimentos
    total: float


class PontoHistorico(BaseModel):
    valor: float
    registrado_em: datetime


# --- helpers -----------------------------------------------------------------
def _itens_do_usuario(db: Session, user: User):
    """Base de query de patrimônio já filtrada pelo dono."""
    return db.query(ItemPatrimonio).filter(ItemPatrimonio.user_id == user.id)


def _get_item_or_404(db: Session, user: User, item_id: int) -> ItemPatrimonio:
    item = _itens_do_usuario(db, user).filter(ItemPatrimonio.id == item_id).first()
    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Item não encontrado"
        )
    return item


# Soma condicional por tipo, reaproveitada pelo resumo de patrimônio.
_soma_reservas = func.coalesce(
    func.sum(
        case((ItemPatrimonio.tipo == TIPO_RESERVA, ItemPatrimonio.valor_centavos), else_=0)
    ),
    0,
)
_soma_investimentos = func.coalesce(
    func.sum(
        case(
            (ItemPatrimonio.tipo == TIPO_INVESTIMENTO, ItemPatrimonio.valor_centavos),
            else_=0,
        )
    ),
    0,
)


# --- resumo (antes de /{item_id} para não ser capturado pela rota dinâmica) --
@router.get("/patrimonio/resumo", response_model=ResumoPatrimonio)
async def resumo_patrimonio(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    guardado, investido = (
        db.query(_soma_reservas, _soma_investimentos)
        .filter(ItemPatrimonio.user_id == user.id)
        .one()
    )
    return ResumoPatrimonio(
        guardado=_reais(guardado),
        investido=_reais(investido),
        total=_reais(guardado + investido),
    )


# --- CRUD --------------------------------------------------------------------
@router.get("/patrimonio", response_model=list[ItemPatrimonioRead])
async def list_patrimonio(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    tipo: str | None = Query(default=None, pattern="^(reserva|investimento)$"),
):
    q = _itens_do_usuario(db, user)
    if tipo:
        q = q.filter(ItemPatrimonio.tipo == tipo)
    itens = q.order_by(
        ItemPatrimonio.valor_centavos.desc(), ItemPatrimonio.id.desc()
    ).all()
    return [ItemPatrimonioRead.of(i) for i in itens]


@router.post(
    "/patrimonio",
    response_model=ItemPatrimonioRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_item_patrimonio(
    data: ItemPatrimonioCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    agora = datetime.now(timezone.utc)
    centavos = _para_centavos(data.valor)
    item = ItemPatrimonio(
        user_id=user.id,
        nome=data.nome,
        valor_centavos=centavos,
        tipo=data.tipo,
        atualizado_em=agora,
    )
    # Primeiro ponto do histórico — o valor com que o item nasceu.
    item.historico.append(
        HistoricoPatrimonio(valor_centavos=centavos, registrado_em=agora)
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return ItemPatrimonioRead.of(item)


@router.get("/patrimonio/{item_id}", response_model=ItemPatrimonioRead)
async def get_item_patrimonio(
    item_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return ItemPatrimonioRead.of(_get_item_or_404(db, user, item_id))


@router.put("/patrimonio/{item_id}", response_model=ItemPatrimonioRead)
async def update_item_patrimonio(
    item_id: int,
    data: ItemPatrimonioUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    item = _get_item_or_404(db, user, item_id)
    item.nome = data.nome
    item.tipo = data.tipo
    novo = _para_centavos(data.valor)
    # Só carimba "atualizado em" e registra histórico quando o valor muda — editar
    # só o nome/tipo não conta como atualização do valor.
    if novo != item.valor_centavos:
        agora = datetime.now(timezone.utc)
        item.valor_centavos = novo
        item.atualizado_em = agora
        item.historico.append(
            HistoricoPatrimonio(valor_centavos=novo, registrado_em=agora)
        )
    db.commit()
    db.refresh(item)
    return ItemPatrimonioRead.of(item)


@router.delete(
    "/patrimonio/{item_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_item_patrimonio(
    item_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    item = _get_item_or_404(db, user, item_id)
    db.delete(item)  # cascade remove o histórico do item
    db.commit()


@router.get(
    "/patrimonio/{item_id}/historico", response_model=list[PontoHistorico]
)
async def historico_patrimonio(
    item_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    item = _get_item_or_404(db, user, item_id)
    return [
        PontoHistorico(valor=_reais(h.valor_centavos), registrado_em=h.registrado_em)
        for h in item.historico
    ]


# =============================================================================
# Dívidas e parcelas — uma dívida tem N parcelas (iguais ou diferentes). O total,
# o pago e o que falta são derivados das parcelas; marcar parcela como paga move
# o progresso. Tudo filtrado pelo dono (parcela herda o dono via dívida).
# =============================================================================
MODO_IGUAIS = "iguais"
MODO_DIFERENTES = "diferentes"


def _add_meses(d: date, n: int) -> date:
    """`d` + `n` meses, ajustando o dia para meses mais curtos (31/jan +1 → 28/fev)."""
    total = d.month - 1 + n
    ano = d.year + total // 12
    mes = total % 12 + 1
    dia = min(d.day, calendar.monthrange(ano, mes)[1])
    return date(ano, mes, dia)


# --- schemas -----------------------------------------------------------------
class ParcelaInput(BaseModel):
    valor: Decimal = Field(gt=0, description="Valor da parcela em reais, até 2 casas")
    vencimento: date | None = None

    @field_validator("valor")
    @classmethod
    def _duas_casas(cls, v: Decimal) -> Decimal:
        return _validar_2_casas(v)


class DividaCreate(BaseModel):
    nome: str = Field(min_length=1, max_length=80)
    modo: str = Field(pattern="^(iguais|diferentes)$")
    # modo "iguais": gera N parcelas com o mesmo valor.
    num_parcelas: int | None = Field(default=None, ge=1, le=600)
    valor_parcela: Decimal | None = Field(default=None, gt=0)
    # opcional: se informado, gera vencimentos mensais a partir desta data.
    primeiro_vencimento: date | None = None
    # modo "diferentes": uma entrada por parcela, com valor (e vencimento) próprios.
    parcelas: list[ParcelaInput] | None = None

    @field_validator("nome")
    @classmethod
    def _strip(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("nome não pode ser vazio")
        return v

    @field_validator("valor_parcela")
    @classmethod
    def _duas_casas(cls, v: Decimal | None) -> Decimal | None:
        return _validar_2_casas(v) if v is not None else v

    @model_validator(mode="after")
    def _checar_modo(self) -> "DividaCreate":
        if self.modo == MODO_IGUAIS:
            if self.num_parcelas is None or self.valor_parcela is None:
                raise ValueError(
                    "modo 'iguais' exige num_parcelas e valor_parcela"
                )
        else:  # diferentes
            if not self.parcelas:
                raise ValueError(
                    "modo 'diferentes' exige ao menos uma parcela em 'parcelas'"
                )
        return self


class DividaUpdate(BaseModel):
    nome: str = Field(min_length=1, max_length=80)

    @field_validator("nome")
    @classmethod
    def _strip(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("nome não pode ser vazio")
        return v


class ParcelaUpdate(BaseModel):
    """PATCH parcial de uma parcela — só os campos enviados são aplicados."""

    paga: bool | None = None
    valor: Decimal | None = Field(default=None, gt=0)
    vencimento: date | None = None

    @field_validator("valor")
    @classmethod
    def _duas_casas(cls, v: Decimal | None) -> Decimal | None:
        return _validar_2_casas(v) if v is not None else v


class ParcelaRead(BaseModel):
    id: int
    numero: int
    valor: float
    paga: bool
    vencimento: date | None

    @classmethod
    def of(cls, p: Parcela) -> "ParcelaRead":
        return cls(
            id=p.id,
            numero=p.numero,
            valor=_reais(p.valor_centavos),
            paga=p.paga,
            vencimento=p.vencimento,
        )


class DividaResumo(BaseModel):
    total: float
    pago: float
    falta: float
    parcelas_totais: int
    parcelas_pagas: int
    parcelas_restantes: int


class DividaRead(BaseModel):
    id: int
    nome: str
    resumo: DividaResumo

    @classmethod
    def of(cls, d: Divida) -> "DividaRead":
        return cls(id=d.id, nome=d.nome, resumo=_resumo_divida(d))


class DividaDetail(DividaRead):
    parcelas: list[ParcelaRead]

    @classmethod
    def of(cls, d: Divida) -> "DividaDetail":
        return cls(
            id=d.id,
            nome=d.nome,
            resumo=_resumo_divida(d),
            parcelas=[ParcelaRead.of(p) for p in d.parcelas],
        )


class ResumoGeralDividas(BaseModel):
    total_devido: float  # soma de todas as parcelas
    total_pago: float  # soma das parcelas pagas
    total_a_pagar: float  # quanto ainda falta no geral
    dividas: int  # quantidade de dívidas


# --- helpers -----------------------------------------------------------------
def _resumo_divida(d: Divida) -> DividaResumo:
    """Resumo derivado das parcelas da dívida (total, pago, falta, contagens)."""
    total = sum(p.valor_centavos for p in d.parcelas)
    pago = sum(p.valor_centavos for p in d.parcelas if p.paga)
    pagas = sum(1 for p in d.parcelas if p.paga)
    totais = len(d.parcelas)
    return DividaResumo(
        total=_reais(total),
        pago=_reais(pago),
        falta=_reais(total - pago),
        parcelas_totais=totais,
        parcelas_pagas=pagas,
        parcelas_restantes=totais - pagas,
    )


def _dividas_do_usuario(db: Session, user: User):
    """Base de query de dívidas já filtrada pelo dono."""
    return db.query(Divida).filter(Divida.user_id == user.id)


def _get_divida_or_404(db: Session, user: User, divida_id: int) -> Divida:
    divida = _dividas_do_usuario(db, user).filter(Divida.id == divida_id).first()
    if divida is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Dívida não encontrada"
        )
    return divida


# --- resumo geral (antes de /{divida_id} para não cair na rota dinâmica) -----
@router.get("/dividas/resumo", response_model=ResumoGeralDividas)
async def resumo_dividas(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    base = db.query(Parcela).join(Divida).filter(Divida.user_id == user.id)
    total = base.with_entities(
        func.coalesce(func.sum(Parcela.valor_centavos), 0)
    ).scalar()
    pago = (
        base.filter(Parcela.paga.is_(True))
        .with_entities(func.coalesce(func.sum(Parcela.valor_centavos), 0))
        .scalar()
    )
    return ResumoGeralDividas(
        total_devido=_reais(total),
        total_pago=_reais(pago),
        total_a_pagar=_reais(total - pago),
        dividas=_dividas_do_usuario(db, user).count(),
    )


# --- CRUD --------------------------------------------------------------------
@router.get("/dividas", response_model=list[DividaRead])
async def list_dividas(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    dividas = _dividas_do_usuario(db, user).order_by(Divida.id.desc()).all()
    return [DividaRead.of(d) for d in dividas]


@router.post(
    "/dividas", response_model=DividaDetail, status_code=status.HTTP_201_CREATED
)
async def create_divida(
    data: DividaCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    divida = Divida(user_id=user.id, nome=data.nome)
    if data.modo == MODO_IGUAIS:
        valor_c = _para_centavos(data.valor_parcela)
        for i in range(data.num_parcelas):
            venc = (
                _add_meses(data.primeiro_vencimento, i)
                if data.primeiro_vencimento
                else None
            )
            divida.parcelas.append(
                Parcela(numero=i + 1, valor_centavos=valor_c, paga=False, vencimento=venc)
            )
    else:  # diferentes
        for i, p in enumerate(data.parcelas):
            divida.parcelas.append(
                Parcela(
                    numero=i + 1,
                    valor_centavos=_para_centavos(p.valor),
                    paga=False,
                    vencimento=p.vencimento,
                )
            )
    db.add(divida)
    db.commit()
    db.refresh(divida)
    return DividaDetail.of(divida)


@router.get("/dividas/{divida_id}", response_model=DividaDetail)
async def get_divida(
    divida_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return DividaDetail.of(_get_divida_or_404(db, user, divida_id))


@router.put("/dividas/{divida_id}", response_model=DividaDetail)
async def update_divida(
    divida_id: int,
    data: DividaUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    divida = _get_divida_or_404(db, user, divida_id)
    divida.nome = data.nome
    db.commit()
    db.refresh(divida)
    return DividaDetail.of(divida)


@router.delete("/dividas/{divida_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_divida(
    divida_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    divida = _get_divida_or_404(db, user, divida_id)
    db.delete(divida)  # cascade remove as parcelas
    db.commit()


@router.patch(
    "/dividas/{divida_id}/parcelas/{parcela_id}", response_model=DividaDetail
)
async def update_parcela(
    divida_id: int,
    parcela_id: int,
    data: ParcelaUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    divida = _get_divida_or_404(db, user, divida_id)
    parcela = next((p for p in divida.parcelas if p.id == parcela_id), None)
    if parcela is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Parcela não encontrada"
        )
    enviados = data.model_fields_set
    if "paga" in enviados and data.paga is not None:
        parcela.paga = data.paga
    if "valor" in enviados and data.valor is not None:
        parcela.valor_centavos = _para_centavos(data.valor)
    if "vencimento" in enviados:
        parcela.vencimento = data.vencimento  # null limpa o vencimento
    db.commit()
    db.refresh(divida)
    return DividaDetail.of(divida)
