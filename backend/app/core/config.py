"""Configuração da aplicação, lida do .env (ver .env.example).

Esqueleto da Fase 1 — as features usam estes settings nas sprints seguintes.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Admin inicial (bootstrap no 1º startup); depois as credenciais vivem no banco.
    ADMIN_USER: str = "admin"
    ADMIN_PASSWORD: str = "troque-esta-senha-do-admin"
    SECRET_KEY: str = "dev-inseguro-troque"
    DB_PATH: str = "./painel.db"
    SNAPSHOT_DIR: str = "./snapshots"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080


settings = Settings()
