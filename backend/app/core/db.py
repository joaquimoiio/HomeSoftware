"""Engine SQLite + sessão + Base declarativa.

Esqueleto da Fase 1. Os models (finance, calendar) são adicionados nas sprints
do banco e registrados via Base.metadata.create_all() no startup.
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from .config import settings

engine = create_engine(
    f"sqlite:///{settings.DB_PATH}",
    connect_args={"check_same_thread": False},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
