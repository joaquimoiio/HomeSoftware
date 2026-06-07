# 08 — Agenda / Calendário (estilo Google Calendar)

**Status:** done

## Objetivo
Calendário visual de verdade com visões mês/semana/dia, navegação, e eventos com
data/hora, dia inteiro, local, cor/categoria e recorrência básica.

## Skills a usar
- `data-model` — model `Evento` (início, fim, dia_inteiro, local, cor/categoria, recorrência).
- `backend-api` — router `/api/calendar` (CRUD, consulta por intervalo).
- `frontend-ui` — telas de calendário (lib leve tipo FullCalendar ou grade própria).
- `design-system` — grade com divisórias finas, dia atual no sotaque, eventos discretos.

## Tasks
- [ ] Model `Evento` (com `user_id` FK) + schemas; endpoints CRUD e listagem por
      intervalo de datas, **filtrados pelo `user_id` do usuário logado**.
- [ ] Recorrência básica (diária/semanal/mensal) — expandir ocorrências na consulta.
- [ ] Visões mês/semana/dia com navegação anterior/próximo/hoje e troca de visão.
- [ ] Criar clicando no dia/horário; abrir evento para ver/editar/excluir.
- [ ] (Desejável) arrastar para criar/mover — se pesar no Pi, registrar como melhoria futura.

## Critérios de aceite
- As três visões funcionam, com dia atual destacado e navegação correta.
- Eventos persistem em SQLite; recorrência básica aparece nas datas certas.
- **Isolamento:** cada usuário só vê a própria agenda; evento de outro → 404.
- Visual coeso (parece o mesmo produto do hub).

## Dependências
- 02-autenticacao
- 03-design-base
