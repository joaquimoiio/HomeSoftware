# Guia completo — subir o Painel de Comando no Raspberry Pi (do zero)

Guia passo a passo para instalar e rodar o **Painel de Comando** num **Raspberry Pi 3
com Raspberry Pi OS Lite** (sem interface gráfica). **Tudo é feito no próprio Pi** —
você instala git, Python e Node no Pi, clona o repositório, builda o frontend lá e
deixa rodando 24h. Não precisa copiar nada do PC.

> Cobertura deste guia: do Pi zerado até **acessar o painel pela rede local**
> (`http://IP_DO_PI:8000`) com o app rodando 24h via systemd. Acesso de fora de casa
> (Tailscale/Cloudflare) e backup ficam para depois.

---

## 0. O que você precisa antes de começar

- Raspberry Pi 3 com **Raspberry Pi OS Lite** já gravado e ligado.
- Na gravação (Raspberry Pi Imager), você já deve ter definido **usuário e senha** e
  ativado o **SSH** e o **WiFi**. (O Pi Lite não tem tela; você o controla pelo terminal.)
- Um PC na **mesma rede WiFi** do Pi para acessar o painel no navegador.

> **Sobre o SSH:** como o Pi Lite não tem monitor nem teclado, a única forma de digitar
> comandos nele é conectando pelo terminal via SSH a partir do seu PC. Isso **não**
> significa "fazer pelo PC": todos os comandos rodam **dentro do Pi**. Você só usa o SSH
> como "teclado remoto".

---

## 1. Conectar no Pi

No seu PC, abra o **PowerShell** (Windows) ou terminal e conecte (troque pelo seu
usuário e o IP do Pi — o IP aparece no painel do roteador, ou tente `raspberrypi.local`):

```bash
ssh SEU_USUARIO@IP_DO_PI
```

Exemplo: `ssh joaquim@192.168.0.42`. Digite a senha que você criou no Imager.

Depois de conectado, **descubra e anote** estes dados (vamos usar adiante):

```bash
whoami          # seu usuário no Pi
hostname -I     # o IP do Pi na rede (use o primeiro número)
```

---

## 2. Atualizar o sistema e instalar tudo (git, Python, Node)

Rode **um bloco de cada vez** dentro do Pi.

### 2.1 Atualizar o sistema

```bash
sudo apt update && sudo apt full-upgrade -y
```

### 2.2 Instalar Git e Python

```bash
sudo apt install -y git python3 python3-venv python3-pip
```

### 2.3 Instalar o Node.js (para buildar o frontend)

O Node não vem no Pi OS Lite. Instale a versão 20 (compatível com ARM) via NodeSource:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### 2.4 Conferir se tudo instalou

```bash
git --version
python3 --version     # precisa ser 3.10 ou maior
node --version        # ex.: v20.x
npm --version
```

Se todos responderem com um número de versão, está pronto.

---

## 3. Baixar o projeto (clone)

```bash
cd ~
git clone https://github.com/joaquimoiio/HomeSoftware.git
cd HomeSoftware
```

A partir daqui, os comandos assumem que você está dentro de `~/HomeSoftware`.

---

## 4. Backend — criar o ambiente Python e instalar as dependências

```bash
# Cria o ambiente virtual isolado dentro de backend/
python3 -m venv backend/.venv

# Instala as dependências do backend dentro desse ambiente
backend/.venv/bin/pip install --upgrade pip
backend/.venv/bin/pip install -r backend/requirements.txt
```

> Pode demorar alguns minutos no Pi 3 (ele compila algumas libs). É normal.

---

## 5. Configurar o `.env` (segredos do app)

O app precisa de um arquivo `.env` com a senha do admin e a chave de sessão. Crie a
partir do exemplo:

```bash
cp backend/.env.example backend/.env
```

Antes de editar, **gere uma chave secreta aleatória** e copie o resultado:

```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

Agora abra o `.env` para editar:

```bash
nano backend/.env
```

Altere pelo menos estas três linhas:

```ini
ADMIN_USER=admin
ADMIN_PASSWORD=escolha-uma-senha-forte-sua
SECRET_KEY=cole-aqui-a-chave-que-o-comando-gerou
```

As outras linhas (`DB_PATH`, `SNAPSHOT_DIR`, `ACCESS_TOKEN_EXPIRE_MINUTES`) podem ficar
como estão. Para salvar no `nano`: **Ctrl+O**, **Enter**, depois **Ctrl+X** para sair.

> O `ADMIN_USER`/`ADMIN_PASSWORD` cria o **primeiro admin** no primeiro start. Depois
> disso, troque a senha pela tela do app — o `.env` é só o bootstrap inicial.

---

## 6. Frontend — buildar o site

O FastAPI serve o frontend **já compilado** (a pasta `frontend/dist`). Ela não vem no
git, então você precisa gerá-la **uma vez** (e de novo sempre que o frontend mudar):

```bash
cd ~/HomeSoftware/frontend
npm install
npm run build
cd ~/HomeSoftware
```

Confirme que gerou os arquivos certos:

```bash
ls frontend/dist
```

Tem que aparecer **`index.html`** e uma pasta **`assets`**. Se aparecer, o frontend está
pronto.

> **Se o `npm run build` falhar por falta de memória** (Pi 3 tem só 1GB), veja a seção
> "Problemas comuns" no fim deste guia (aumentar swap).

---

## 7. Teste manual (antes de deixar 24h)

Antes de configurar o serviço automático, teste na mão para garantir que tudo sobe. O
`--host 0.0.0.0` é o que permite acessar do seu PC:

```bash
cd ~/HomeSoftware/backend
.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Deixe esse terminal aberto. No navegador do **seu PC**, acesse:

```
http://IP_DO_PI:8000
```

(ex.: `http://192.168.0.42:8000`). Deve abrir a **tela de login**. Para testar só a API:
`http://IP_DO_PI:8000/api/health` deve responder `{"status":"ok"}`.

Login com o `ADMIN_USER` / `ADMIN_PASSWORD` que você pôs no `.env`.

Para **parar** o teste: **Ctrl+C** nesse terminal.

---

## 8. Deixar rodando 24h (systemd, sobe sozinho no boot)

O teste manual só roda enquanto o terminal está aberto. Para o app ficar de pé sempre
(e voltar sozinho se cair ou se o Pi reiniciar), usamos um serviço do systemd.

### 8.1 Criar o arquivo de serviço

Há **duas formas** de criar o `/etc/systemd/system/painel.service`. As duas dão no mesmo
resultado — escolha **uma**.

> O repositório já traz um arquivo pronto em `deploy/painel.service`. Mas ele vem com
> `User=pi` e os caminhos `/home/pi/...` **fixos**. Se o seu usuário no Pi **não** é `pi`
> (ex.: `joaquim`), copiar esse arquivo direto causa o erro `User=pi ... no such process`.
> Por isso a **forma A é a recomendada**: ela preenche o usuário e os caminhos sozinha.

**Forma A (recomendada) — colar este bloco**, que usa `$USER` e `$HOME` automaticamente,
então já fica com o usuário e o caminho certos seja qual for o seu login:

```bash
sudo tee /etc/systemd/system/painel.service > /dev/null <<EOF
[Unit]
Description=Painel de Comando (FastAPI + frontend)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$USER
Group=$USER
WorkingDirectory=$HOME/HomeSoftware/backend
ExecStart=$HOME/HomeSoftware/backend/.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=3
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF
```

**Forma B — copiar o arquivo pronto do repositório.** Só use se o seu usuário for `pi`;
caso contrário, **edite os 3 campos** (`User`, `WorkingDirectory`, `ExecStart`) trocando
`pi`/`/home/pi` pelo seu usuário e caminho **antes** de habilitar o serviço:

```bash
sudo cp ~/HomeSoftware/deploy/painel.service /etc/systemd/system/painel.service
# se NÃO for o usuário "pi", edite os caminhos/usuário:
sudo nano /etc/systemd/system/painel.service
```

Confira que ficou com seu usuário e caminho corretos:

```bash
cat /etc/systemd/system/painel.service
```

### 8.2 Ativar e iniciar

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now painel
sudo systemctl status painel
```

Deve aparecer **`active (running)`** (em verde). Aperte **q** para sair do status.

### 8.3 Acessar do PC

```
http://IP_DO_PI:8000
```

Pronto — agora o painel sobe sozinho com o Pi e fica rodando 24h. ✅

---

## 9. Comandos úteis do dia a dia

```bash
# Ver o status do serviço
sudo systemctl status painel

# Ver os logs ao vivo (Ctrl+C para sair)
journalctl -u painel -f

# Ver as últimas 30 linhas de log
journalctl -u painel -n 30 --no-pager

# Reiniciar o app (use depois de mudar o .env ou rebuildar o frontend)
sudo systemctl restart painel

# Parar / iniciar
sudo systemctl stop painel
sudo systemctl start painel
```

### Atualizar o app depois de mudanças no repositório

```bash
cd ~/HomeSoftware
git pull

# se o backend mudou (requirements):
backend/.venv/bin/pip install -r backend/requirements.txt

# se o frontend mudou:
cd frontend && npm install && npm run build && cd ~/HomeSoftware

# aplicar:
sudo systemctl restart painel
```

---

## 10. Problemas comuns (e como resolver)

### `failed to determine user credentials: no such process`
O `painel.service` está com um usuário que não existe (ex.: `User=pi`, mas as versões
novas do Pi OS não criam mais o usuário `pi`). **Solução:** refaça o passo **8.1** — o
bloco com `$USER` preenche o usuário certo sozinho. Depois `daemon-reload` e `restart`.

### Acessa e aparece `{"detail":"Not Found"}` / log mostra `GET / 404`
O FastAPI não encontrou a pasta `frontend/dist`. Causas:
1. O frontend não foi buildado → rode o passo **6** (`npm run build`).
2. Foi buildado **depois** de o serviço subir → o app só verifica a pasta ao iniciar.
   Rode `sudo systemctl restart painel`.
3. Confirme a estrutura: `ls frontend/dist` deve mostrar `index.html` e `assets`
   **diretamente** ali (não dentro de outro `dist`).

### Não consigo acessar do PC (a página não carrega)
- Confirme que o serviço está `active (running)`: `sudo systemctl status painel`.
- Confirme que o app escuta em `0.0.0.0` (o `ExecStart` tem `--host 0.0.0.0`).
- Confirme o IP do Pi: `hostname -I`. PC e Pi têm que estar na **mesma rede**.
- Teste no próprio Pi: `curl -s http://localhost:8000/api/health` → `{"status":"ok"}`.

### `npm run build` falha por falta de memória no Pi 3
O Pi 3 tem só 1GB de RAM. Aumente a memória virtual (swap) temporariamente:

```bash
sudo dphys-swapfile swapoff
sudo sed -i 's/^CONF_SWAPSIZE=.*/CONF_SWAPSIZE=1024/' /etc/dphys-swapfile
sudo dphys-swapfile setup
sudo dphys-swapfile swapon
```

Depois tente o build de novo. (Opcional: depois do build, volte o swap para o valor
original, geralmente `100`, repetindo os comandos.)

### Porta 8000 já em uso
Provavelmente o teste manual (passo 7) ainda está rodando em outro terminal. Pare-o com
**Ctrl+C**, ou veja quem usa a porta: `sudo lsof -i :8000`.
