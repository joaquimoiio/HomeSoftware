# 02b — Admin: painel de gestão de usuários

**Status:** done

## Objetivo
Painel simples, **só para admin**, para cadastrar e administrar usuários com
segurança: ao criar (ou resetar) um usuário, o sistema **gera uma senha forte**,
mostra **uma única vez** e marca a conta para **trocar a senha no primeiro login**.

## Skills a usar
- `backend-api` — router `/api/admin` protegido por `get_current_admin`; geração de
  senha (`secrets`), schemas que nunca expõem o hash.
- `frontend-ui` — tela `/admin` (lista + cadastro), visível só para admins.
- `design-system` — tabela/lista sóbria, "copiar senha gerada", estados de confirmação.

## Tasks
- [x] `routers/admin.py` (todas exigem `get_current_admin`):
      - `GET /api/admin/users` — lista (sem `password_hash`).
      - `POST /api/admin/users` — cria usuário; **gera senha forte**, salva hash,
        `must_change_password=True`, devolve a senha **uma vez** no response.
      - `POST /api/admin/users/{id}/reset-password` — gera nova senha (mesmo fluxo).
      - `PATCH /api/admin/users/{id}` — ativar/desativar e (opcional) promover admin.
      - `DELETE /api/admin/users/{id}` — remover (ou desativar) usuário.
- [x] Salvaguardas: não permitir o admin **se auto-rebaixar/desativar/excluir** se
      for o último admin ativo; `username` único (409 ao duplicar).
- [x] Frontend `/admin`: lista de usuários, formulário de cadastro, ação de reset,
      ativar/desativar; **mostrar a senha gerada uma vez** com botão copiar e aviso.
- [x] Esconder o acesso ao painel para não-admin (link e rota).

## Critérios de aceite
- Admin cadastra usuário e recebe a senha gerada **uma única vez**; o novo usuário
  loga e é **forçado a trocar a senha** (integra com a sprint 02).
- Endpoints `/api/admin/*` retornam **403** para usuário comum e **401** sem login.
- Nenhum response expõe `password_hash`.
- Não é possível ficar sem nenhum admin ativo; `username` duplicado é rejeitado.

## Dependências
- 02-autenticacao

## Nota de validação
- **Backend validado de verdade:** smoke test com `TestClient` (descartável, já
  removido) cobriu **31 casos, todos verdes** — `/api/admin/*` sem login → 401 e
  com usuário comum → 403; cadastro → 201 com senha gerada e
  `must_change_password=True`; nenhum response expõe `password_hash`; `username`
  duplicado → 409 e curto (<3) → 422; o novo usuário loga com a senha gerada e é
  forçado a trocar (integra com a sprint 02), e `change-password` limpa a flag;
  `reset-password` gera nova senha e remarca a flag; `PATCH` ativa/desativa
  (usuário inativo não loga → 401) e promove/rebaixa; salvaguarda do **último
  admin ativo** bloqueia rebaixar/desativar/excluir com 409; `DELETE` de usuário
  comum → 204 e id inexistente → 404.
- **Geração de senha:** `secrets.token_urlsafe(12)` (~16 chars, >96 bits), salvo
  só o hash bcrypt e devolvido **uma única vez** em `UserWithPassword`.
- **Frontend não foi buildado:** esta máquina (Windows) não tem Node/npm — o
  runtime é o Pi. Código revisado contra o `tsconfig` estrito (`noUnusedLocals`/
  `noUnusedParameters`, imports type-only inline), tokens do design-system e a API
  do React Router v6 / `motion`. Validar o `npm run build` ao subir no Pi.
- **Acesso escondido:** link "Gerir usuários" só aparece para admin no hub e a
  rota `/admin` (`AdminRoute`) redireciona não-admin para `/`.
