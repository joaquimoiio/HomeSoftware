"""App FastAPI — ponto de entrada.

Esqueleto da Fase 1: cria o app, inicializa o banco no startup, expõe /api/health
e serve o frontend buildado (frontend/dist) com fallback SPA quando ele existir.
Auth e os routers de cada módulo (auth, finance, calendar, followers) entram nas
sprints seguintes — veja sprints/SPRINTS.md e a skill backend-api.
"""
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from . import models  # noqa: F401  — registra os models na Base p/ create_all
from .core.db import Base, SessionLocal, engine
from .core.security import bootstrap_admin
from .routers import admin, auth, calendar, finance, followers


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Cria o schema (e o arquivo .db vazio) se ainda não existir. Para um app
    # pessoal de 1 banco isto basta; Alembic só se realmente precisar migrar.
    Base.metadata.create_all(bind=engine)
    # Bootstrap do 1º admin a partir do .env (idempotente).
    db = SessionLocal()
    try:
        bootstrap_admin(db)
    finally:
        db.close()
    yield


app = FastAPI(title="Painel de Comando", lifespan=lifespan)

# --- API ---------------------------------------------------------------------
app.include_router(auth.router)  # -> /api/auth
app.include_router(admin.router)  # -> /api/admin (só admin)
app.include_router(finance.router)  # -> /api/finance
app.include_router(calendar.router)  # -> /api/calendar
app.include_router(followers.router)  # -> /api/followers (sem banco; snapshots em disco)


@app.get("/api/health")
async def health():
    return {"status": "ok"}


# --- Frontend estático (servido em produção pelo mesmo processo) -------------
DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"

if DIST.is_dir():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    @app.get("/{full_path:path}")
    async def spa(full_path: str):
        # Rotas /api/* não tratadas não devem cair no fallback SPA: devolvem 404
        # JSON em vez de index.html (mantém a semântica da API limpa).
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not Found")
        # fallback SPA: qualquer outra rota devolve o index.html
        return FileResponse(DIST / "index.html")
