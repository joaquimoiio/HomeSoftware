---
name: backend-api
description: Padrões para escrever a API FastAPI deste projeto — routers por módulo, schemas Pydantic, auth e tratamento de erros. Use ao criar/alterar endpoints do backend.
---

# Skill: backend-api

Leia primeiro [context/stack.md](../../../context/stack.md) (estrutura do backend e
convenções de API) e as regras de negócio em
[context/produto.md](../../../context/produto.md). Esta skill é só **como aplicar**.

## Como aplicar
- Um **router por módulo** em `backend/app/routers/`, com prefixo:
  `/api/auth`, `/api/admin`, `/api/finance`, `/api/calendar`, `/api/followers`.
  Inclua os routers em `app/main.py` com `app.include_router(...)`.
- **Schemas Pydantic** separados por intenção: `XCreate`, `XUpdate`, `XRead`. Nunca
  exponha o model SQLAlchemy direto. **Nunca** retorne `password_hash` em um `Read`.
- Endpoints `async`. Dependência de DB via `Depends(get_db)`; dependência de auth
  via `Depends(get_current_user)` em **tudo** exceto `/api/auth/login` e estáticos.
- **Auth multiusuário** (em `core/security.py`):
  - `password_hash`/`verify` com **bcrypt** (passlib `CryptContext`). JWT com `sub` =
    id do usuário; cookie httpOnly.
  - `get_current_user(token, db)` decodifica o JWT, carrega o `User`, recusa
    inativo (401). `get_current_admin` reusa `get_current_user` e exige `is_admin`
    (senão **403**). Use `get_current_admin` em **todo** `/api/admin/*`.
  - **Bootstrap:** no startup, se não há nenhum usuário, criar o admin a partir de
    `ADMIN_USER`/`ADMIN_PASSWORD` do `.env` (idempotente).
  - **Cadastro/reset seguro:** gerar senha aleatória forte (`secrets.token_urlsafe`),
    salvar só o hash, devolvê-la **uma única vez** no response e marcar
    `must_change_password=True`. Endpoint de troca de senha limpa a flag.
- **Isolamento por usuário:** todo recurso de domínio filtra por
  `current_user.id`. Ao buscar por id, faça `WHERE id = ? AND user_id = ?`; se não
  achar, **404** (não vaze existência). Em `Create`, grave `user_id=current_user.id`.
- **Valide e trate erros** explicitamente: JSON inválido (upload seguidores),
  números positivos com 2 casas (financeiro), datas coerentes (`fim >= início`),
  `username` único (409/400 ao duplicar). Use `HTTPException` com status correto
  (400/401/403/404/409/422). Nada de 500 silencioso.
- Mantenha endpoints finos: lógica de domínio fora da função de rota quando crescer.
- `app/main.py` também **serve o frontend buildado** (`frontend/dist`) na raiz, com
  fallback SPA — sem quebrar as rotas `/api/*`.

## Não faça
- Não use banco no módulo de seguidores (snapshots em disco, **por usuário**).
- Não adicione deps pesadas/sem wheel ARM (ver [context/stack.md](../../../context/stack.md)).
- Não retorne segredos, hash de senha nem stack traces ao cliente.
- Não confie no front para isolamento: o **backend** sempre filtra por `user_id`.
