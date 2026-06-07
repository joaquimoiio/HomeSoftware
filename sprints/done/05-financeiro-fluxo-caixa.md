# 05 — Financeiro: fluxo de caixa

**Status:** done

## Objetivo
Registrar entradas e saídas com CRUD completo, mostrar saldo/totais, e visões por
mês e por categoria com gráfico simples.

## Skills a usar
- `data-model` — model `Lancamento` (valor, descrição, categoria, data, tipo).
- `backend-api` — router `/api/finance` (CRUD + agregações por mês/categoria), validações.
- `frontend-ui` — tela do financeiro (aba fluxo de caixa) e cliente de API.
- `design-system` — valores em mono, sinais `--pos`/`--neg`, gráfico sóbrio.

## Tasks
- [x] Model `Lancamento` (com `user_id` FK) + schemas Create/Update/Read.
- [x] Endpoints CRUD `/api/finance/lancamentos` + endpoints de resumo (saldo, por mês, por categoria),
      **todos filtrados pelo `user_id` do usuário logado** (`get_current_user`).
- [x] Validar valores (positivos, 2 casas) e datas; erros com status correto.
- [x] Tela: lista + formulário de lançamento, saldo/totais, filtro por período.
- [x] Gráfico simples (por mês e por categoria).

## Critérios de aceite
- Criar/editar/excluir lançamentos persiste em SQLite e reflete na tela.
- Saldo = entradas − saídas; totais e visões por mês/categoria corretos.
- **Isolamento:** cada usuário só vê/edita os próprios lançamentos; acessar id de
  outro usuário responde 404.
- Valores em mono, sinais com cor semântica; nada de gráfico exagerado.

## Dependências
- 02-autenticacao
- 03-design-base
