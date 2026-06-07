# Painel de Comando

App web **pessoal e multiusuário** que roda 24h num Raspberry Pi 3 e é acessada de
qualquer lugar. Um hub com 3 módulos: **comparador de seguidores**, **controle
financeiro** e **agenda/calendário**. Stack leve num só processo:
**FastAPI + SQLite + React/Vite/Tailwind**.

> Guia do projeto e fonte da verdade: [CLAUDE.md](CLAUDE.md) e [context/](context/).
> Deploy no Pi: [context/deploy.md](context/deploy.md).

## Pré-requisitos

- **Python 3.10+** (backend)
- **Node 18+** (frontend)

## Configuração

```bash
cd backend
cp .env.example .env        # Windows: copy .env.example .env
# edite .env: defina ADMIN_USER/ADMIN_PASSWORD (admin inicial) e um SECRET_KEY longo
```

As chaves do `.env` (ver [backend/.env.example](backend/.env.example)):
`ADMIN_USER`, `ADMIN_PASSWORD`, `SECRET_KEY`, `DB_PATH`, `SNAPSHOT_DIR`,
`ACCESS_TOKEN_EXPIRE_MINUTES`. **Nunca** comite o `.env` real.

App **multiusuário**: o 1º startup cria um admin a partir de
`ADMIN_USER`/`ADMIN_PASSWORD`; depois o admin cadastra os demais usuários pelo painel
(`/admin`). Cada usuário tem dados isolados (financeiro e agenda).

## Desenvolvimento (dois processos)

Em dev rodam dois servidores: o FastAPI (API, porta 8000) e o Vite (frontend,
porta 5173). O Vite encaminha as chamadas `/api` para o FastAPI via proxy.

### 1. Backend (terminal A)

```bash
cd backend
python -m venv .venv
# Windows (PowerShell):  .\.venv\Scripts\Activate.ps1
# Linux/macOS:           source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

- Health check: <http://localhost:8000/api/health> → `{"status":"ok"}`
- No startup o app cria o schema/arquivo SQLite (`DB_PATH`) se ainda não existir.

### 2. Frontend (terminal B)

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173 (proxy /api -> :8000)
```

Abra <http://localhost:5173> — as chamadas `/api/*` chegam ao FastAPI pelo proxy.

## Build de produção (um processo)

Em produção o FastAPI serve o frontend já buildado. Gere o `dist` e suba só o
uvicorn:

```bash
cd frontend && npm run build      # gera frontend/dist
cd ../backend && uvicorn app.main:app --port 8000
```

Acesse <http://localhost:8000>: o FastAPI serve o `index.html` do `dist` (com
fallback SPA) e a API em `/api/*`.

## Estrutura

```
backend/    FastAPI (app/main.py, core/, models/, routers/), requirements.txt
frontend/   React + Vite + Tailwind (src/), build em frontend/dist
context/    Fonte da verdade: produto, stack, design, deploy
deploy/     Artefatos de produção (painel.service — unit systemd)
sprints/    Metodologia de trabalho (backlog/ + done/, SPRINTS.md)
```

---

# Deploy no Raspberry Pi (do zero, 24h)

Guia para subir o app num **Raspberry Pi 3** recém-comprado e deixá-lo rodando o dia
todo, acessível de qualquer lugar. É feito para iniciante em Pi: copie e cole os
comandos. Fonte da verdade desta seção: [context/deploy.md](context/deploy.md).

> Convenção deste guia: usuário do Pi = **`pi`** e o projeto clonado em
> **`/home/pi/HomeSoftware`**. Se você usar outro nome de usuário ou outra pasta,
> ajuste os caminhos (inclusive dentro de [`deploy/painel.service`](deploy/painel.service)).

## A. Preparar o Pi (sem teclado nem monitor)

1. Pegue um **microSD** (mínimo recomendado ~16 GB).
2. No seu PC, instale o **[Raspberry Pi Imager](https://www.raspberrypi.com/software/)**.
3. No Imager: **Choose OS → Raspberry Pi OS (other) → Raspberry Pi OS Lite (64-bit)**.
   A versão **Lite** (sem interface gráfica) é mais leve no Pi 3 — o acesso é pela rede.
4. Clique na **engrenagem** (⚙️, opções avançadas) **antes de gravar** e configure:
   - ✅ **Enable SSH** (use "password authentication").
   - **Set username and password** → usuário `pi` e uma senha sua.
   - **Configure wireless LAN** → nome e senha do seu WiFi (+ o país, ex.: `BR`).
   - **Set locale** → fuso horário (ex.: `America/Sao_Paulo`).
5. **Grave** o cartão, ponha no Pi e ligue. Ele entra na rede sozinho ("headless").

### Descobrir o IP e conectar por SSH

O Pi não tem tela; você entra nele pela rede. Descubra o IP de uma destas formas:

- Veja a lista de dispositivos no painel do seu **roteador**, ou
- Tente o nome de rede:
  ```bash
  ping raspberrypi.local
  ```

Com o IP em mãos (ex.: `192.168.0.42`), conecte (no PowerShell do Windows também funciona):

```bash
ssh pi@192.168.0.42
```

### Atualizar e instalar as dependências do sistema

Já dentro do Pi (via SSH):

```bash
sudo apt update && sudo apt full-upgrade -y

# Python (backend)
sudo apt install -y python3 python3-venv python3-pip git

# Node.js 20 LTS (frontend) — pacote ARM oficial da NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

Confira: `python3 --version` (≥ 3.10) e `node --version` (≥ 18).

## B. Instalar e rodar a aplicação

```bash
# 1. Clonar o projeto na home do usuário pi
cd ~
git clone <URL-DO-SEU-REPO> HomeSoftware
cd HomeSoftware

# 2. Backend: venv + dependências
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# 3. Configurar o .env (admin inicial + chave de sessão)
cp .env.example .env
nano .env    # defina ADMIN_USER, ADMIN_PASSWORD e um SECRET_KEY longo e aleatório
```

> Gere um `SECRET_KEY` forte assim e cole no `.env`:
> ```bash
> python3 -c "import secrets; print(secrets.token_urlsafe(48))"
> ```

```bash
# 4. Frontend: build do estático que o FastAPI vai servir
cd ../frontend
npm install
npm run build      # gera frontend/dist
```

> **Build pesado no Pi 3?** O `npm run build` pode demorar/faltar memória no Pi 3
> (1 GB RAM). Se travar, **builde no seu PC** (`npm install && npm run build`) e
> envie só a pasta `dist` para o Pi:
> ```bash
> scp -r frontend/dist pi@192.168.0.42:/home/pi/HomeSoftware/frontend/
> ```

### Teste manual (antes de virar serviço)

```bash
cd ~/HomeSoftware/backend
source .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

No navegador do seu PC, abra `http://192.168.0.42:8000` (o IP do Pi). Deve aparecer a
tela de login. Funcionou? Pare com **Ctrl+C** e siga para deixar rodando 24h.

## C. Deixar rodando 24h (systemd)

O repo já traz a unit pronta em [`deploy/painel.service`](deploy/painel.service)
(`Restart=always`, sobe no boot, roda como `pi`, uvicorn da venv em `0.0.0.0:8000`).

> Se você **não** usou usuário `pi` ou clonou em outra pasta, edite os campos `User`,
> `WorkingDirectory` e `ExecStart` no `painel.service` antes de copiar.

```bash
# Instalar e ativar
sudo cp ~/HomeSoftware/deploy/painel.service /etc/systemd/system/painel.service
sudo systemctl daemon-reload
sudo systemctl enable --now painel     # liga agora E no boot
```

Comandos do dia a dia:

```bash
sudo systemctl status painel     # está rodando?
journalctl -u painel -f          # ver os logs ao vivo (Ctrl+C para sair)
sudo systemctl restart painel    # reiniciar (ex.: após git pull + novo build)
sudo systemctl stop painel       # parar
```

Para **atualizar o app** depois: `git pull`, refaça o build do frontend
(`cd frontend && npm run build`), reinstale o requirements se mudou
(`pip install -r backend/requirements.txt` na venv) e `sudo systemctl restart painel`.

## D. Acessar de qualquer lugar (escolha UMA)

Dentro de casa, `http://IP-DO-PI:8000` já funciona. Para acessar **de fora** (rua,
trabalho) sem abrir portas do roteador, use uma destas duas opções:

### Opção 1 — Tailscale (rede privada, mais simples)

Cria uma VPN só entre **os seus dispositivos**. O app continua privado: ninguém na
internet aberta o alcança. Bom se só você (e seu celular/notebook) vai acessar.

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

Instale o app Tailscale também no seu celular/PC, faça login na mesma conta, e acesse
pelo **IP Tailscale do Pi** (algo como `100.x.y.z:8000`). Veja o IP com `tailscale ip -4`.

### Opção 2 — Cloudflare Tunnel (navegador de qualquer lugar)

Publica o app numa **URL `https://...`** que abre em qualquer navegador, sem instalar
nada no dispositivo cliente. Proteja com **Cloudflare Access** (login) para não ficar
público. Bom se quiser abrir de um dispositivo qualquer só com o link. Exige um domínio
gerenciado no Cloudflare.

```bash
# Instala o cloudflared (binário ARM) e cria um tunnel
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared bookworm main" | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt update && sudo apt install -y cloudflared

cloudflared tunnel login            # autentica no seu domínio Cloudflare
cloudflared tunnel create painel    # cria o tunnel
# aponte o tunnel para o app local e crie a rota DNS (substitua o subdomínio):
cloudflared tunnel route dns painel painel.seu-dominio.com
cloudflared tunnel run --url http://localhost:8000 painel
```

Depois habilite uma política no **Cloudflare Access** para exigir login ao abrir
`painel.seu-dominio.com`.

**Resumindo a diferença:** *Tailscale* = privado, só nos seus aparelhos (instala
cliente em cada um). *Cloudflare Tunnel* = uma URL pública protegida por login, abre em
qualquer navegador (precisa de domínio). Escolha **uma**.
