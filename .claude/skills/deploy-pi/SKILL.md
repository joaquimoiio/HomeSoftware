---
name: deploy-pi
description: Como empacotar e documentar o deploy no Raspberry Pi 3 — systemd, acesso remoto (Tailscale/Cloudflare) e backup via cron. Use em sprints de deploy/README/operação.
---

# Skill: deploy-pi

A fonte da verdade é [context/deploy.md](../../../context/deploy.md) — siga aquela
ordem (A→E). Esta skill é **como aplicar** ao gerar artefatos.

## Como aplicar
- O **README.md** começa do **zero absoluto** (Pi recém-comprado): gravar Raspberry
  Pi OS **Lite** com o Imager, ativar SSH/usuário/WiFi nas opções avançadas, achar o
  IP, conectar por SSH, atualizar, instalar Python+venv+pip e Node. Comandos prontos
  para copiar, linguagem simples (iniciante em Pi, mas programador).
- Forneça artefatos **prontos** no repo, em `deploy/`:
  - `painel.service` — unit systemd: `Restart=always`, roda como usuário do Pi,
    `WorkingDirectory` no backend, `ExecStart` no uvicorn da venv (`--host 0.0.0.0`).
  - `backup.sh` — backup do SQLite (use `sqlite3 .backup`, carimbo de data, retém N).
- Documente os comandos de operação: `systemctl enable --now`, `status`,
  `journalctl -u painel -f`, `restart`.
- **Acesso remoto:** explique **Tailscale** (privado) **e** **Cloudflare Tunnel**
  (navegador de qualquer lugar com login), com a diferença, e deixe o usuário escolher.
- **Backup:** linha de `crontab -e` pronta (1x/dia).

## Cuidados ARM/Pi 3
- Tudo precisa ter wheel ARM / buildar leve. Build do frontend pode ser pesado no Pi
  3 — registre a opção de buildar em outra máquina e enviar o `dist` se necessário.
- 1 worker uvicorn. Sem serviços extras desnecessários.
