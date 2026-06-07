# 04 — Hub (tela inicial)

**Status:** done

## Objetivo
Construir o hub: tela inicial que apresenta os 3 módulos e leva a cada um, com a
estética command center e entrada orquestrada.

## Skills a usar
- `frontend-ui` — rotas (`/`) e navegação para os módulos.
- `design-system` — composição assimétrica, reveals escalonados, mono para data/relógio.

## Tasks
- [x] Página do hub com os 3 módulos (financeiro, agenda, seguidores) em grade assimétrica.
- [x] Título de display forte + data/relógio em mono; saudação com o nome do usuário logado.
- [x] Links/cartões navegando para `/financeiro`, `/agenda`, `/seguidores`.
- [x] Acesso ao **painel de admin** (`/admin`) e botão de **logout**; o link de admin
      só aparece para `is_admin` (vem do `GET /api/auth/me`). _Providos pelo Shell no
      topo (`Shield` gated por `is_admin`, `LogOut`) — coesão em vez de duplicar._
- [x] Reveals escalonados na entrada; estados de hover caprichados.

## Critérios de aceite
- Hub abre após login e navega corretamente para os 3 módulos.
- Link de admin aparece só para admin; logout encerra a sessão.
- Visual coeso com o design-system; responsivo no mobile (layout repensado).

## Dependências
- 02-autenticacao
- 03-design-base
