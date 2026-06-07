# 10 — Deploy no Raspberry Pi (systemd + acesso remoto)

**Status:** done

## Objetivo
Documentar e empacotar o deploy do zero no Pi 3: instalar, rodar como serviço
systemd 24h e acessar de qualquer lugar (Tailscale ou Cloudflare Tunnel).

## Skills a usar
- `deploy-pi` — seguir [context/deploy.md](../../context/deploy.md) (passos A→D).

## Tasks
- [x] README do zero absoluto: gravar Raspberry Pi OS Lite, SSH/WiFi/usuário, IP, SSH, deps.
- [x] Passos de instalar/rodar (venv, requirements, build do front, `.env`, teste manual).
- [x] `deploy/painel.service` pronto (Restart=always, uvicorn da venv, host 0.0.0.0).
- [x] Comandos systemd (enable --now, status, logs, restart).
- [x] Seção de acesso remoto: Tailscale e Cloudflare Tunnel, com a diferença explicada.

## Critérios de aceite
- README permite a um iniciante em Pi subir o app do zero copiando comandos.
- Unit systemd sobe no boot e reinicia se cair.
- Instruções de Tailscale e Cloudflare presentes e claras.

## Dependências
- 01-fundacao
