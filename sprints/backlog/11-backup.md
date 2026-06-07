# 11 — Backup automático do SQLite (cron)

**Status:** backlog

## Objetivo
Backup automático e seguro do banco SQLite, agendado no cron, com script pronto.

## Skills a usar
- `deploy-pi` — seguir a seção E de [context/deploy.md](../../context/deploy.md).

## Tasks
- [ ] `deploy/backup.sh`: usa `sqlite3 .backup`, carimbo de data, mantém os últimos N.
- [ ] Destino configurável (outra pasta/pendrive).
- [ ] Linha de `crontab -e` pronta no README (ex.: 1x/dia).
- [ ] Documentar como restaurar a partir de um backup.

## Critérios de aceite
- Script gera um backup íntegro sem corromper o `.db` em uso.
- Cron documentado; retenção dos últimos N funciona.

## Dependências
- 10-deploy-pi
