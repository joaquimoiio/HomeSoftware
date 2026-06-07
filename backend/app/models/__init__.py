"""Registra os models na Base para o create_all() do startup.

Importe aqui cada model novo ao criá-lo nas próximas sprints.
"""
from .calendar import Evento  # noqa: F401
from .finance import (  # noqa: F401
    Divida,
    HistoricoPatrimonio,
    ItemPatrimonio,
    Lancamento,
    Parcela,
)
from .user import User  # noqa: F401

__all__ = [
    "User",
    "Lancamento",
    "ItemPatrimonio",
    "HistoricoPatrimonio",
    "Divida",
    "Parcela",
    "Evento",
]
