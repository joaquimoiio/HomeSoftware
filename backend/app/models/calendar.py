"""Model do módulo de agenda — eventos do calendário.

`Evento` é um compromisso do usuário (`user_id`), com início e fim em `DateTime`
**naive** (hora de parede local — sem fuso, mesma filosofia de "data pura" do
financeiro: evita deslocamentos de timezone num app pessoal). Eventos de dia
inteiro guardam mesmo assim os dois extremos (a flag `dia_inteiro` diz à UI para
ignorar o horário). A **recorrência** é básica (diária/semanal/mensal) e fica só
como uma regra no registro-base; as ocorrências são expandidas na consulta por
intervalo (ver router), não materializadas no banco.
"""
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)

from ..core.db import Base

# Paleta discreta de cores/categorias (espelhada no frontend). Chave guardada no
# banco; o hex correspondente vive na UI para manter o visual coeso.
CORES = ("amber", "azul", "verde", "roxo", "rosa", "petroleo", "vermelho", "cinza")
COR_PADRAO = "amber"

# Regras de recorrência aceitas (espelhadas no schema Pydantic da API).
REC_NENHUMA = "nenhuma"
REC_DIARIA = "diaria"
REC_SEMANAL = "semanal"
REC_MENSAL = "mensal"
RECORRENCIAS = (REC_NENHUMA, REC_DIARIA, REC_SEMANAL, REC_MENSAL)


def _agora() -> datetime:
    """Instante atual em UTC — default da coluna de criação."""
    return datetime.now(timezone.utc)


class Evento(Base):
    __tablename__ = "eventos"

    id = Column(Integer, primary_key=True)
    # Dono do evento — base do isolamento. Indexado: toda query filtra por ele.
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    titulo = Column(String(120), nullable=False)
    descricao = Column(Text, nullable=True)
    # Início e fim como hora de parede local (naive). Indexa o início: a consulta
    # por intervalo parte dele.
    inicio = Column(DateTime, nullable=False, index=True)
    fim = Column(DateTime, nullable=False)
    dia_inteiro = Column(Boolean, nullable=False, default=False)
    local = Column(String(120), nullable=True)
    cor = Column(String(20), nullable=False, default=COR_PADRAO)
    # Regra de recorrência básica; "nenhuma" para evento único.
    recorrencia = Column(String(10), nullable=False, default=REC_NENHUMA)

    created_at = Column(DateTime, nullable=False, default=_agora)

    __table_args__ = (
        CheckConstraint("fim >= inicio", name="ck_evento_fim_apos_inicio"),
        CheckConstraint(
            "recorrencia in ('nenhuma', 'diaria', 'semanal', 'mensal')",
            name="ck_evento_recorrencia",
        ),
    )
