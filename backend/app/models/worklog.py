"""Model do Work Log — registro de horas trabalhadas (sprint 13).

Um `WorkLog` é uma atividade que o usuário trabalhou: o **número/identificador**
da atividade (texto livre, ex.: `OS-1234`, `#4567`), o que foi feito, a **hora de
início** e a **duração** — o fim não é pedido. A duração fica em **minutos**
(`Integer`, fácil de somar nos resumos). O início é `DateTime` **naive** (hora de
parede local, mesma filosofia da agenda/financeiro: sem fuso num app pessoal).

É um registro **próprio**, em tabela à parte — não aparece no calendário. Isolado
por `user_id` como todo recurso de domínio; as queries sempre filtram por ele.
"""
from datetime import datetime, timezone

from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)

from ..core.db import Base


def _agora() -> datetime:
    """Instante atual em UTC — default da coluna de criação."""
    return datetime.now(timezone.utc)


class WorkLog(Base):
    __tablename__ = "worklogs"

    id = Column(Integer, primary_key=True)
    # Dono do registro — base do isolamento. Indexado: toda query filtra por ele.
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    # Número/identificador da atividade — texto livre (ex.: OS-1234, #4567).
    atividade = Column(String(60), nullable=False)
    descricao = Column(Text, nullable=True)
    # Hora de início como parede local (naive). Indexa: o resumo filtra por ela.
    inicio = Column(DateTime, nullable=False, index=True)
    # Duração em minutos — somável direto nos resumos.
    duracao_min = Column(Integer, nullable=False)

    created_at = Column(DateTime, nullable=False, default=_agora)

    __table_args__ = (
        CheckConstraint("duracao_min > 0", name="ck_worklog_duracao_positiva"),
    )
