# 13 — Agenda: abas + Work Log (registro de horas)

**Status:** done

## Objetivo
Dar ao módulo Agenda uma sub-navegação por abas (igual ao Financeiro): **Agenda**
(calendário atual) e **Work Log**, um registro de atividades trabalhadas com número
da atividade, o que foi feito, hora de início e duração — com resumo de horas.

## Decisões de design (já definidas)
- **Tempo:** registra **hora de início + duração** (ex.: 2h30); o fim não é pedido.
- **Número da atividade:** **texto livre** (ex.: `OS-1234`, `#4567`).
- **Resumo:** mostrar **totais de horas** no período e por atividade.
- Work Log é um **registro próprio** (tabela separada), não aparece no calendário.

## Skills a usar
- data-model — criar a tabela `WorkLog` (isolada por `user_id`), com início como
  DateTime naive (mesma filosofia da agenda) e duração em minutos (Integer, fácil de somar).
- backend-api — novo router para Work Log: CRUD isolado por usuário + endpoint de
  resumo (total de minutos no período e por atividade); schemas Pydantic.
- frontend-ui — componente `AgendaTabs` (Agenda / Work Log), nova página Work Log com
  rota `/agenda/worklog`, refatorar a página Agenda para exibir as abas, e cliente de
  API novo em `api.ts`.
- design-system — aplicar a identidade "command center" às abas e à tela do Work Log
  (durações/horas em mono tabular-nums, sotaque âmbar só em ação/foco).

## Tasks
- [ ] data-model: criar `WorkLog` (`backend/app/models/`) com `user_id`, `atividade`
      (String, texto livre), `descricao` (Text), `inicio` (DateTime naive),
      `duracao_min` (Integer), `created_at`; registrar a criação do schema.
- [ ] backend-api: router Work Log com listar (filtro por período), criar, editar e
      excluir — sempre filtrando por `user_id`.
- [ ] backend-api: endpoint de resumo (total de horas no período + total por atividade).
- [ ] frontend: componente `AgendaTabs` (espelha `FinanceTabs`) com abas Agenda / Work Log.
- [ ] frontend: refatorar `Agenda.tsx` para renderizar as abas acima do conteúdo.
- [ ] frontend: nova página `WorkLog.tsx` com formulário (atividade, descrição, início,
      duração), lista dos registros do período e bloco de resumo com totais.
- [ ] frontend: adicionar rota `/agenda/worklog` em `App.tsx` e funções no `api.ts`.
- [ ] design-system: revisar visual das abas e da tela para não destoar do resto.

## Critérios de aceite
- Em `/agenda` aparecem as abas **Agenda** e **Work Log**; a aba Agenda mantém o
  calendário atual funcionando.
- Em `/agenda/worklog` dá para criar/editar/excluir um registro com número da
  atividade (texto), descrição, hora de início e duração; a duração é exibida legível.
- O resumo mostra o total de horas do período e o total por atividade, batendo com os
  registros listados.
- Cada usuário vê apenas seus próprios registros (isolamento por `user_id`).
- Backend sobe sem erros e a agenda/calendário continua funcionando como antes.

## Dependências
- 08 (Agenda / Calendário) — feita.
