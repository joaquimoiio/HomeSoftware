# 07 — Financeiro: dívidas e parcelas

**Status:** done

## Objetivo
Gerenciar dívidas com parcelas (iguais ou diferentes), marcar parcelas como pagas e
mostrar progresso por dívida e total geral.

## Skills a usar
- `data-model` — models `Divida` + `Parcela` (1‑N, cascade).
- `backend-api` — router `/api/finance` (dívidas/parcelas), geração de parcelas, validações.
- `frontend-ui` — aba de dívidas.
- `design-system` — barras de progresso sóbrias, valores em mono.

## Tasks
- [x] Models `Divida` (com `user_id` FK) e `Parcela` (valor, paga, vencimento opcional;
      herda o dono via `Divida`). Endpoints filtrados pelo `user_id` do logado.
- [x] Criação: modo parcelas iguais (gera N) ou valores diferentes (edita cada uma).
- [x] Endpoints CRUD + marcar parcela paga + resumos (total, pago, falta, parcelas restantes).
- [x] Tela: criar dívida, listar parcelas, marcar paga, barra de progresso por dívida.
- [x] Visão geral: total devido e total a pagar somando todas as dívidas.

## Critérios de aceite
- Gerar parcelas iguais e editar valores diferentes funciona; persiste em SQLite.
- Marcar parcela paga atualiza resumo e barra de progresso.
- Totais (devido / a pagar) corretos no geral.
- **Isolamento:** cada usuário só vê as próprias dívidas/parcelas; id de outro → 404.

## Dependências
- 05-financeiro-fluxo-caixa
