---
name: data-model
description: Padrões de modelagem de dados SQLite/SQLAlchemy deste projeto — models por domínio, relacionamentos e criação de schema. Use ao criar/alterar tabelas ou queries.
---

# Skill: data-model

Leia [context/stack.md](../../../context/stack.md) (SQLite via SQLAlchemy) e as
regras das entidades em [context/produto.md](../../../context/produto.md). Aqui é
**como aplicar**.

## Como aplicar
- Engine SQLite + `SessionLocal` + `Base` + `get_db()` em `app/core/db.py`. Caminho
  do `.db` vem do `.env` (`DB_PATH`). Para SQLite use
  `connect_args={"check_same_thread": False}`.
- **Models por domínio** em `app/models/`:
  - `user.py`: `User` (id, `username` único, `password_hash`, `is_admin` bool,
    `is_active` bool, `must_change_password` bool, `created_at`). **Nunca** guardar
    senha em texto — só o hash bcrypt (ver skill backend-api).
  - `finance.py`: `Lancamento` (fluxo de caixa: valor, descrição, categoria, data,
    tipo entrada/saída); `ItemPatrimonio` (nome, valor_atual, tipo
    reserva/investimento, atualizado_em; histórico opcional em tabela à parte);
    `Divida` + `Parcela` (1‑N): parcela tem valor, paga (bool), vencimento opcional.
  - `calendar.py`: `Evento` (título, descrição, início, fim, dia_inteiro, local,
    cor/categoria, regra de recorrência básica).
- **Isolamento por usuário (obrigatório):** toda tabela de domínio (lançamentos,
  itens de patrimônio, dívidas, eventos) carrega `user_id = Column(ForeignKey(
  "users.id"), nullable=False, index=True)`. `Parcela` herda o dono via `Divida`
  (não precisa de `user_id` próprio). As **queries sempre filtram por `user_id`** do
  usuário logado — a modelagem só habilita; quem garante o filtro é a camada de API.
- **Tabelas separadas** conforme [produto.md](../../../context/produto.md): usuários;
  lançamentos; itens de patrimônio; dívidas + parcelas. Relacionamento
  `Divida`→`Parcela` com `relationship` e `cascade="all, delete-orphan"`.
- Valores monetários: armazenar como inteiro de centavos **ou** `Numeric` — escolha
  uma convenção e mantenha. Datas como `Date`/`DateTime` (não string).
- **Criação de schema:** `Base.metadata.create_all()` no startup basta (projeto
  pessoal, 1 banco). Só introduza Alembic se realmente precisar de migrações.

## Não faça
- Não crie banco para o módulo de seguidores (snapshots vão para `.json` no disco).
- Não guarde dinheiro como `float` sem cuidado (erros de arredondamento).
