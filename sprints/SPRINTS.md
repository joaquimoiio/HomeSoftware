# Registro de sprints

Fonte de verdade do progresso. Trabalho **uma sprint por vez**, respeitando
dependências. `/dev` pega a próxima `backlog` na ordem; `/nova-sprint` acrescenta.

| #  | Sprint | Status | Depende de |
|----|--------|--------|------------|
| 01 | [Fundação: app único rodando](done/01-fundacao.md) | done | — |
| 02 | [Autenticação: multiusuário (login+senha)](done/02-autenticacao.md) | done | 01 |
| 02b | [Admin: gestão de usuários](done/02b-admin-usuarios.md) | done | 02 |
| 03 | [Base de design e shell](done/03-design-base.md) | done | 01 |
| 04 | [Hub (tela inicial)](done/04-hub.md) | done | 02, 02b, 03 |
| 05 | [Financeiro: fluxo de caixa](done/05-financeiro-fluxo-caixa.md) | done | 02, 03 |
| 06 | [Financeiro: patrimônio](done/06-financeiro-patrimonio.md) | done | 05 |
| 07 | [Financeiro: dívidas](done/07-financeiro-dividas.md) | done | 05 |
| 08 | [Agenda / Calendário](done/08-agenda-calendario.md) | done | 02, 03 |
| 09 | [Comparador de seguidores](done/09-comparador-seguidores.md) | done | 02, 03 |
| 10 | [Deploy no Raspberry Pi](done/10-deploy-pi.md) | done | 01 |
| 11 | [Backup automático (cron)](backlog/11-backup.md) | backlog | 10 |
| 12 | [Remover "categoria" do financeiro](done/12-remover-categoria-financeiro.md) | done | 05 |
| 13 | [Agenda: abas + Work Log](done/13-agenda-worklog.md) | done | 08 |

## Ordem sugerida de execução
01 → 02 → 02b → 03 → 04 → 05 → 06 → 07 → 08 → 09 → 10 → 12 → 13 → 11

Concluídas (status `done`) são movidas para [done/](done/).
