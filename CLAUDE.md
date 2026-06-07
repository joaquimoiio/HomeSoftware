# Painel de Comando — guia do projeto

App web **pessoal e multiusuário**, que roda **24h num Raspberry Pi 3** e acesso de
qualquer lugar. **Cada usuário tem seus próprios dados** (financeiro e agenda
isolados por usuário); um **admin** cadastra novos usuários por um painel simples.
Um **hub** que abre 3 módulos: **comparador de seguidores** (sem banco), **controle
financeiro** (fluxo de caixa + patrimônio + dívidas) e **agenda/calendário** estilo
Google Calendar. Stack leve: **FastAPI + SQLite + React/Vite/Tailwind**, tudo num só
processo. Prioridade: **ser leve no Pi**.

Este arquivo é só o índice. **Não duplique conteúdo aqui** — aponte para o resto.

## Contexto (fonte da verdade — o que o produto É)
- [context/produto.md](context/produto.md) — visão, módulos e regras de negócio.
- [context/stack.md](context/stack.md) — stack, estrutura e convenções técnicas.
- [context/design.md](context/design.md) — identidade visual (CRÍTICO: não pode parecer IA).
- [context/deploy.md](context/deploy.md) — subir no Raspberry Pi.

## Como trabalhamos (metodologia)
Trabalho em **sprints**. Eu disparo **comandos**; as sprints carregam **skills**.
- **Comando** `/nova-sprint <descrição>` — planeja e registra uma sprint no backlog
  (não implementa). Ver [.claude/commands/nova-sprint.md](.claude/commands/nova-sprint.md).
- **Comando** `/dev [sprint]` — executa a próxima sprint pendente (ou a indicada).
  Ver [.claude/commands/dev.md](.claude/commands/dev.md).
- Registro/progresso das sprints: [sprints/SPRINTS.md](sprints/SPRINTS.md).
- **Uma sprint por vez**, sem adiantar trabalho de sprints futuras.

## Skills de conhecimento (carregadas pelas sprints)
- [backend-api](.claude/skills/backend-api/SKILL.md) — padrões de FastAPI/API.
- [data-model](.claude/skills/data-model/SKILL.md) — SQLite/SQLAlchemy/migrações.
- [frontend-ui](.claude/skills/frontend-ui/SKILL.md) — React/Vite/Tailwind.
- [design-system](.claude/skills/design-system/SKILL.md) — aplicar a identidade visual.
- [deploy-pi](.claude/skills/deploy-pi/SKILL.md) — deploy no Pi.

## Regras gerais
- Tudo precisa rodar leve em ARM (Pi 3, Python 3.10+). Evite deps pesadas/sem wheel ARM.
- Sem segredos no código — usar `.env` (manter `.env.example`).
- Comparador de seguidores **não** usa banco; financeiro e agenda usam SQLite.
