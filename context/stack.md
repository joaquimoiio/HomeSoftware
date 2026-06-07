# Stack e convenções técnicas

> Fonte da verdade do **como técnico**. Restrições de negócio: [produto.md](produto.md).

## Restrição-mãe: o alvo é um Raspberry Pi 3 (1GB RAM, ARM)

Toda decisão técnica passa por isto. **Leve sempre.** Evite dependências pesadas
ou sem wheel pré-compilada para ARM (Raspberry Pi OS, Python 3.10+). Um único
processo, um único serviço systemd.

## Stack obrigatória

- **Backend:** Python **FastAPI** (async). Serve a API **e** os arquivos estáticos
  do frontend já compilado — tudo num processo só.
- **Banco:** **SQLite** via **SQLAlchemy**. Usado **apenas** pelos módulos
  financeiro e de agenda. O comparador de seguidores **NÃO usa banco**.
- **Frontend:** **React + Vite + Tailwind CSS**. Build estático servido pelo FastAPI.
- **Auth:** **multiusuário** com tabela `users` no SQLite. Login por
  **usuário + senha**; senhas com **hash bcrypt** (nunca texto puro). Sessão por
  **cookie/JWT** (o `sub` do token é o id do usuário). Papéis **admin**/comum.
  O **primeiro admin** é criado no startup a partir do `.env`
  (`ADMIN_USER`/`ADMIN_PASSWORD`) quando não há nenhum usuário. Todas as rotas e a
  API **protegidas atrás do login**; rotas de administração exigem **admin**.
- Servidor ASGI: **uvicorn** (sem gunicorn — 1 worker basta no Pi).

## Estrutura do backend

```
backend/
├── app/
│   ├── main.py            # app FastAPI, monta routers, serve estáticos do frontend
│   ├── core/
│   │   ├── config.py      # settings via pydantic-settings / .env
│   │   ├── security.py    # auth: hash bcrypt, JWT, deps get_current_user/get_current_admin
│   │   └── db.py          # engine SQLite + SessionLocal + Base + get_db()
│   ├── models/            # modelos SQLAlchemy por domínio (user.py, finance.py, calendar.py)
│   └── routers/           # rotas por módulo
│       ├── auth.py        # /api/auth   (login, logout, me, trocar senha)
│       ├── admin.py       # /api/admin  (gestão de usuários — só admin)
│       ├── finance.py     # /api/finance
│       ├── calendar.py    # /api/calendar
│       └── followers.py   # /api/followers
├── requirements.txt
└── .env.example
```

## Convenções de API

- REST claro, **prefixos por módulo**: `/api/auth`, `/api/admin`, `/api/finance`,
  `/api/calendar`, `/api/followers`. Front estático servido na raiz `/` (fallback SPA
  para rotas do React).
- Schemas de entrada/saída com **Pydantic** (separe `Create`, `Update`, `Read`).
  **Nunca** exponha o hash de senha em nenhum schema de saída.
- **Trate erros e validações:** JSON inválido no upload de seguidores, valores
  numéricos no financeiro (positivos, 2 casas), datas válidas. Responda com
  `HTTPException` + status correto, nunca 500 silencioso.
- Dependência `get_current_user` protege tudo exceto `/api/auth/login` e os estáticos;
  rotas `/api/admin/*` exigem `get_current_admin`.
- **Isolamento por usuário:** todo recurso de dados carrega `user_id` e as queries
  filtram pelo usuário logado. Acessar id de outro usuário ⇒ **404** (não 403, para
  não vazar existência).

## Convenções do frontend

- **Um componente/rota por módulo** + o hub. Router (React Router) com rotas:
  `/` (hub), `/login`, `/financeiro`, `/agenda`, `/seguidores`.
- Cliente HTTP fino em `src/lib/api.ts` (fetch com credenciais/cookie, trata 401 →
  redireciona pro login).
- Estado de servidor simples (pode usar TanStack Query se leve; caso contrário,
  fetch + estado local). **Não** introduzir Redux nem libs de estado pesadas.

## Qualidade e segredos

- **Sem segredos no código.** As credenciais do admin inicial e a chave de sessão
  vêm do `.env`. Incluir `.env.example` com as chaves (`ADMIN_USER`,
  `ADMIN_PASSWORD`, `SECRET_KEY`, `DB_PATH`, `SNAPSHOT_DIR`,
  `ACCESS_TOKEN_EXPIRE_MINUTES`) sem valores reais. `ADMIN_PASSWORD` só serve para o
  bootstrap do 1º admin — depois as senhas vivem no banco como hash.
- Validação consistente em ambas as pontas (backend é a autoridade).
- Código organizado e legível; sem over-engineering — é uso pessoal.
