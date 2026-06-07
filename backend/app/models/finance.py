"""Models do módulo financeiro — fluxo de caixa e patrimônio.

`Lancamento` é uma entrada ou saída de caixa, sempre pertencente a um usuário
(`user_id`). Dinheiro é guardado como **inteiro de centavos** (`valor_centavos`)
para não sofrer com arredondamento de float; a camada de API converte de/para
reais. `ItemPatrimonio` (sprint 06) é uma reserva/investimento com valor atualizado
manualmente, com histórico de evolução à parte. Dívidas chegam na sprint 07.
"""
from datetime import date, datetime, timezone

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
)
from sqlalchemy.orm import relationship

from ..core.db import Base

# Tipos de lançamento aceitos (espelhado no schema Pydantic da API).
TIPO_ENTRADA = "entrada"
TIPO_SAIDA = "saida"

# Tipos de item de patrimônio (espelhado no schema Pydantic da API).
TIPO_RESERVA = "reserva"
TIPO_INVESTIMENTO = "investimento"


def _agora() -> datetime:
    """Instante atual em UTC — default das colunas de timestamp."""
    return datetime.now(timezone.utc)


class Lancamento(Base):
    __tablename__ = "lancamentos"

    id = Column(Integer, primary_key=True)
    # Dono do lançamento — base do isolamento. Indexado: toda query filtra por ele.
    user_id = Column(
        Integer, ForeignKey("users.id"), nullable=False, index=True
    )
    tipo = Column(String(10), nullable=False)  # "entrada" | "saida"
    # Valor em centavos, sempre positivo; o sinal vem do `tipo`.
    valor_centavos = Column(Integer, nullable=False)
    descricao = Column(String(120), nullable=False)
    categoria = Column(String(60), nullable=False, index=True)
    data = Column(Date, nullable=False, default=date.today, index=True)
    created_at = Column(
        DateTime, nullable=False, default=lambda: datetime.now(timezone.utc)
    )

    __table_args__ = (
        CheckConstraint("valor_centavos > 0", name="ck_lancamento_valor_positivo"),
        CheckConstraint(
            "tipo in ('entrada', 'saida')", name="ck_lancamento_tipo"
        ),
    )


class ItemPatrimonio(Base):
    """Reserva ou investimento com valor atualizado manualmente pelo dono.

    Diferente do fluxo de caixa: aqui guardamos o **saldo acumulado** de cada
    item (não movimentos). `atualizado_em` marca a última vez que o valor mudou;
    cada mudança também vira um ponto em `HistoricoPatrimonio` para o gráfico.
    """

    __tablename__ = "itens_patrimonio"

    id = Column(Integer, primary_key=True)
    # Dono do item — base do isolamento. Indexado: toda query filtra por ele.
    user_id = Column(
        Integer, ForeignKey("users.id"), nullable=False, index=True
    )
    nome = Column(String(80), nullable=False)
    # Valor atual em centavos (>= 0; um item pode zerar sem ser excluído).
    valor_centavos = Column(Integer, nullable=False)
    tipo = Column(String(20), nullable=False)  # "reserva" | "investimento"
    # Data/hora da última atualização do valor (não da criação do registro).
    atualizado_em = Column(DateTime, nullable=False, default=_agora)
    created_at = Column(DateTime, nullable=False, default=_agora)

    historico = relationship(
        "HistoricoPatrimonio",
        back_populates="item",
        cascade="all, delete-orphan",
        order_by="HistoricoPatrimonio.registrado_em",
    )

    __table_args__ = (
        CheckConstraint(
            "valor_centavos >= 0", name="ck_item_patrimonio_valor_nao_negativo"
        ),
        CheckConstraint(
            "tipo in ('reserva', 'investimento')", name="ck_item_patrimonio_tipo"
        ),
    )


class HistoricoPatrimonio(Base):
    """Ponto de evolução de um item: o valor que ele tinha num instante.

    Herda o dono via `ItemPatrimonio` (não precisa de `user_id` próprio). Gravado
    na criação do item e a cada vez que o valor é alterado — alimenta o
    mini-gráfico de evolução na tela.
    """

    __tablename__ = "historico_patrimonio"

    id = Column(Integer, primary_key=True)
    item_id = Column(
        Integer,
        ForeignKey("itens_patrimonio.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    valor_centavos = Column(Integer, nullable=False)
    registrado_em = Column(DateTime, nullable=False, default=_agora)

    item = relationship("ItemPatrimonio", back_populates="historico")

    __table_args__ = (
        CheckConstraint(
            "valor_centavos >= 0", name="ck_historico_patrimonio_valor_nao_negativo"
        ),
    )


class Divida(Base):
    """Uma dívida do usuário, composta por uma ou mais parcelas (1‑N).

    A dívida em si não guarda valor: o total, o pago e o que falta são derivados
    das `parcelas` (cada parcela tem o próprio valor e a flag `paga`). Isso permite
    parcelas iguais ou de valores diferentes sem campos redundantes que poderiam
    divergir. Excluir a dívida remove as parcelas (cascade).
    """

    __tablename__ = "dividas"

    id = Column(Integer, primary_key=True)
    # Dono da dívida — base do isolamento. Indexado: toda query filtra por ele.
    user_id = Column(
        Integer, ForeignKey("users.id"), nullable=False, index=True
    )
    nome = Column(String(80), nullable=False)
    created_at = Column(DateTime, nullable=False, default=_agora)

    parcelas = relationship(
        "Parcela",
        back_populates="divida",
        cascade="all, delete-orphan",
        order_by="Parcela.numero",
    )


class Parcela(Base):
    """Uma parcela de uma `Divida` — herda o dono via a dívida (sem `user_id`).

    `numero` é a ordem (1..N) usada para exibição. `valor_centavos` é o valor da
    parcela (parcelas iguais → todas com o mesmo valor; diferentes → cada uma com
    o seu). `paga` marca a quitação; `vencimento` é opcional.
    """

    __tablename__ = "parcelas"

    id = Column(Integer, primary_key=True)
    divida_id = Column(
        Integer,
        ForeignKey("dividas.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    numero = Column(Integer, nullable=False)  # ordem da parcela (1..N)
    valor_centavos = Column(Integer, nullable=False)
    paga = Column(Boolean, nullable=False, default=False)
    vencimento = Column(Date, nullable=True)  # opcional

    divida = relationship("Divida", back_populates="parcelas")

    __table_args__ = (
        CheckConstraint("valor_centavos > 0", name="ck_parcela_valor_positivo"),
    )
