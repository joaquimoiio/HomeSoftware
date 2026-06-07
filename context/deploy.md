# Deploy no Raspberry Pi 3

> Fonte da verdade do **deploy**. Vira a skill `deploy-pi` e o `README.md`.
> O README deve começar do **zero absoluto** (Pi recém-comprado, sem nada), com
> comandos prontos para copiar e linguagem simples (sou iniciante em Pi, mas sei
> programar).

## A. Preparar o Pi (do zero)

- microSD (mín. recomendado ~16GB).
- Gravar **Raspberry Pi OS** com o **Raspberry Pi Imager**. Recomendar a versão
  **Lite** (sem interface gráfica — mais leve no Pi 3; acesso pela rede).
- Nas opções avançadas do Imager, **já ativar SSH**, definir **usuário/senha** e
  configurar o **WiFi** → roda "headless" (sem teclado/monitor).
- Descobrir o **IP do Pi** (roteador, ou `ping raspberrypi.local`) e **conectar via
  SSH**: `ssh usuario@IP`.
- Primeiros comandos no Pi:
  - `sudo apt update && sudo apt full-upgrade -y`
  - Python: `sudo apt install -y python3 python3-venv python3-pip`
  - Node.js (versão recente, ARM) para buildar o frontend (ex.: via NodeSource).

## B. Instalar e rodar a aplicação

- Copiar o projeto: `git clone <repo>` (ou `scp`).
- Backend: criar venv (`python3 -m venv .venv`), ativar, `pip install -r
  backend/requirements.txt`.
- Frontend: `npm install && npm run build` (gera o estático que o FastAPI serve).
- Configurar `.env` a partir do `.env.example` (definir `ADMIN_USER`,
  `ADMIN_PASSWORD` do admin inicial, `SECRET_KEY`, etc.).
- Teste manual antes do serviço: `uvicorn app.main:app --host 0.0.0.0 --port 8000`
  e abrir `http://IP:8000`.

## C. Deixar rodando 24h (systemd)

- Fornecer um arquivo **`.service` pronto** (no repo, ex.: `deploy/painel.service`):
  sobe no boot, **reinicia se cair** (`Restart=always`), roda como o usuário do Pi,
  `WorkingDirectory` no backend, `ExecStart` apontando para o uvicorn da venv.
- Comandos: `sudo cp`, `sudo systemctl daemon-reload`, `enable --now`, `status`,
  `journalctl -u painel -f` (logs), `restart`.

## D. Acessar de qualquer lugar (escolher um)

- **Tailscale:** rede privada, só meus dispositivos. Instalar, `tailscale up`,
  acessar pelo IP Tailscale do Pi. Mais simples e privado.
- **Cloudflare Tunnel:** acesso por navegador de **qualquer lugar** com login
  (Cloudflare Access). Instalar `cloudflared`, criar tunnel, apontar pro `localhost:8000`.
- Explicar a **diferença** no README e deixar o usuário escolher.

## E. Backup (cron)

- Script de **backup automático do SQLite** (ex.: `deploy/backup.sh`): copia o
  `.db` para outra pasta/pendurive com carimbo de data, mantém os últimos N.
- Usar `sqlite3 .backup` ou cópia segura (evitar copiar com o app escrevendo).
- Agendar no **cron** (ex.: 1x/dia): linha de `crontab -e` pronta no README.

## Estrutura de deploy no repo

```
deploy/
├── painel.service     # unit systemd pronta
└── backup.sh          # script de backup do SQLite
```
