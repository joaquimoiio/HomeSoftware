# 06 — Financeiro: patrimônio (reservas e investimentos)

**Status:** done

## Objetivo
Cadastrar itens de patrimônio com valor atualizado manualmente, mostrar totais de
guardado/investido/total e deixar clara a diferença para o saldo do fluxo de caixa.

## Skills a usar
- `data-model` — model `ItemPatrimonio` (+ histórico opcional em tabela à parte).
- `backend-api` — router `/api/finance` (recursos de patrimônio), totais.
- `frontend-ui` — aba de patrimônio.
- `design-system` — valores em mono; distinção visual saldo × patrimônio.

## Tasks
- [x] Model `ItemPatrimonio` (com `user_id` FK; nome, valor_centavos, tipo reserva/investimento, atualizado_em).
- [x] Tabela de histórico de evolução por item (`HistoricoPatrimonio`, cascade) + mini-gráfico (sparkline).
- [x] Endpoints CRUD + totais (guardado, investido, patrimônio total) + histórico, **filtrados pelo `user_id`**.
- [x] Tela: aba Patrimônio com lista de itens, formulário, totais e nota explicando saldo × patrimônio.

## Critérios de aceite
- CRUD de itens persiste; data de última atualização registrada.
- Totais por tipo e total geral corretos; UI deixa clara a diferença vs. fluxo de caixa.
- **Isolamento:** cada usuário só vê os próprios itens; acessar id de outro → 404.

## Dependências
- 05-financeiro-fluxo-caixa
