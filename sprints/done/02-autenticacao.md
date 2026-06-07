# 02 — Autenticação: multiusuário com login e senha

**Status:** done

## Objetivo
Proteger todo o app com login **multiusuário** (usuário + senha, hash bcrypt),
sessão por cookie/JWT, admin inicial via `.env`, e o fluxo de **trocar senha no
primeiro acesso**. Base para o isolamento por usuário dos demais módulos.

## Skills a usar
- `data-model` — model `User` (username único, password_hash, is_admin, is_active,
  must_change_password, created_at).
- `backend-api` — `core/security.py` (hash bcrypt, JWT, `get_current_user`,
  `get_current_admin`), router `/api/auth`, bootstrap do admin no startup.
- `frontend-ui` — tela de login, guarda de rotas, tela de troca de senha, 401 em `api.ts`.
- `design-system` — login e troca de senha já seguem a identidade visual.

## Tasks
- [x] Model `User` + criação de schema no startup (já há `create_all`).
- [x] `core/security.py`: `hash_password`/`verify_password` (bcrypt direto — ver
      nota), criação/validação de JWT (`sub` = id do usuário), cookie httpOnly.
- [x] Dependências `get_current_user` (recusa usuário inativo) e `get_current_admin`
      (exige `is_admin`, senão 403).
- [x] **Bootstrap do admin** no startup: se não há nenhum usuário, cria admin a
      partir de `ADMIN_USER`/`ADMIN_PASSWORD` do `.env` (idempotente).
- [x] `routers/auth.py`: `POST /api/auth/login` (usuário+senha → cookie),
      `POST /api/auth/logout`, `GET /api/auth/me`,
      `POST /api/auth/change-password` (limpa `must_change_password`).
- [x] `get_current_user` aplicado a todos os routers (só existe `/api/auth` por ora;
      `login` é público, `me`/`logout`/`change-password` exigem sessão).
- [x] Frontend: página `/login`, rota protegida, redirect em 401, e tela/forçar
      **troca de senha no primeiro acesso** quando `must_change_password`.

## Critérios de aceite
- Sem login, qualquer `/api/*` protegido responde 401 e a UI manda pro `/login`.
- Login com usuário+senha corretos dá acesso; senha errada/usuário inativo → 401.
- Senhas só são guardadas como **hash bcrypt**; nenhum endpoint devolve o hash.
- 1º startup sem usuários cria o admin do `.env`; logar com ele funciona.
- Usuário com `must_change_password` é levado a trocar a senha antes de usar o app.
- `SECRET_KEY` e credenciais do admin vêm do `.env` (nada hardcoded).

## Dependências
- 01-fundacao

## Nota de validação
- **Backend validado de verdade:** smoke test com `TestClient` (descartável, já
  removido) cobriu 17 casos, todos verdes — me sem login → 401; login com senha
  errada / usuário inativo → 401; login ok seta cookie e devolve usuário **sem**
  `password_hash`; bootstrap criou o admin do `.env`; `must_change_password` no
  fluxo do usuário comum; `change-password` (senha atual errada → 400, nova curta →
  422, ok limpa a flag); logout → 204 e invalida a sessão.
- **Troca passlib → `bcrypt` direto:** `passlib` está sem manutenção e quebra com
  `bcrypt` >= 4.1/5.x (o `detect_wrap_bug` manda um probe > 72 bytes que o bcrypt
  novo rejeita com `ValueError`). Passei a usar a lib `bcrypt` diretamente
  (truncando a 72 bytes), que tem wheel ARM e é o que o passlib só embrulhava.
  `requirements.txt` atualizado (`passlib[bcrypt]` → `bcrypt`).
- **Frontend não foi buildado:** esta máquina (Windows) não tem Node/npm — o
  runtime é o Pi. Código revisado contra a API do React Router v6 e o `tsconfig`
  estrito (type-only imports marcados, tokens do design-system). Validar o
  `npm run build` ao subir no Pi (ou numa máquina com Node).
