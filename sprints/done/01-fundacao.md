# 01 — Fundação: app único rodando (FastAPI serve React)

**Status:** done

## Objetivo
Deixar o esqueleto vivo: FastAPI servindo a API e o frontend React buildado num só
processo, com config via `.env`, banco SQLite inicializável e dev funcional.

## Skills a usar
- `backend-api` — montar `main.py`, health, servir estáticos com fallback SPA.
- `data-model` — `db.py`/`Base`/`get_db` e `create_all` no startup.
- `frontend-ui` — Vite/React/Tailwind buildando e o proxy `/api` em dev.

## Tasks
- [x] Confirmar que `pip install -r backend/requirements.txt` instala em Python 3.10+.
- [x] `npm install` e `npm run build` gerando `frontend/dist`.
- [x] `uvicorn app.main:app` serve `/api/health` e o `index.html` do dist.
- [x] Startup chama `Base.metadata.create_all(bind=engine)` (cria o `.db` vazio).
- [x] Carregar settings do `.env` (copiar de `.env.example`).
- [x] Documentar no README os passos de dev (rodar back + front).

> **Nota de validação:** código implementado e revisado estaticamente. A máquina
> de dev (Windows) não tem Python/Node instalados — o runtime real é o Pi —, então
> `pip install`, `npm build` e `uvicorn` não foram executados aqui. Validar ao subir
> no Pi (ou numa máquina com as toolchains) seguindo o [README.md](../../README.md).

## Critérios de aceite
- `GET /api/health` retorna `{"status":"ok"}`.
- Build do front é servido pelo FastAPI em `http://localhost:8000`.
- Em dev, `npm run dev` (5173) conversa com a API via proxy.

## Dependências
- nenhuma
