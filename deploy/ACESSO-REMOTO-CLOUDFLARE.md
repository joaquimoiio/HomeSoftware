# Acessar o Painel de fora de casa — Cloudflare Tunnel

Continuação do [GUIA-PI.md](GUIA-PI.md). Pré-requisito: o painel **já roda 24h** no Pi
e você consegue abrir `http://IP_DO_PI:8000` na sua rede local. Agora vamos deixá-lo
acessível **de qualquer lugar** (trabalho, celular no 4G, etc.) por um endereço web com
**tela de login** — sem instalar nada no aparelho de quem acessa.

## Como funciona (em 1 minuto)

O `cloudflared` roda no Pi e abre uma "ponte" de saída até a Cloudflare. **Você não
abre nenhuma porta no roteador** e o IP da sua casa fica escondido. Quem acessa
`https://painel.seudominio.com` cai na Cloudflare, que entrega a página pela ponte até o
`localhost:8000` do Pi. Tudo por HTTPS, de graça.

```
Navegador (trabalho)  ──HTTPS──>  Cloudflare  ──ponte cloudflared──>  Pi (localhost:8000)
```

---

## 0. O que você precisa antes

1. **Conta na Cloudflare** (grátis): https://dash.cloudflare.com/sign-up
2. **Um domínio** adicionado à Cloudflare. O Cloudflare Tunnel precisa de um domínio para
   te dar um endereço fixo (ex.: `painel.seusite.com`). Opções:
   - Registrar um domínio barato (ex.: `.xyz`/`.click` saem por ~R$10–40/ano em
     registradores como Namecheap, GoDaddy, Registro.br para `.com.br`).
   - Já tem um domínio? Basta **adicioná-lo à Cloudflare** (Add a site) e trocar os
     *nameservers* no seu registrador para os que a Cloudflare indicar. A própria
     Cloudflare guia esse passo no painel.
3. O Pi ligado e com o serviço `painel` rodando (`sudo systemctl status painel`).

> **Só quer testar rápido, sem domínio?** Veja a seção **"Atalho: teste relâmpago"** no
> fim. Mas para uso 24h de verdade, siga o passo a passo abaixo (endereço fixo + login).

Todos os comandos abaixo rodam **dentro do Pi** (conecte por `ssh SEU_USUARIO@IP_DO_PI`).

---

## 1. Instalar o `cloudflared` no Pi

O Pi é ARM, então baixamos o pacote certo para a arquitetura. Rode este bloco — ele
detecta sozinho se o seu Pi OS é 32 ou 64 bits e baixa o `.deb` correspondente:

```bash
ARCH=$(dpkg --print-architecture)   # geralmente "armhf" (32 bits) ou "arm64"
cd /tmp
curl -L -o cloudflared.deb "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${ARCH}.deb"
sudo dpkg -i cloudflared.deb
```

Confira que instalou:

```bash
cloudflared --version
```

Deve aparecer algo como `cloudflared version 2024.x.x`.

---

## 2. Logar o `cloudflared` na sua conta Cloudflare

```bash
cloudflared tunnel login
```

O comando vai imprimir uma **URL longa**. Copie essa URL e abra **no navegador do seu
PC** (o Pi não tem tela). Faça login na Cloudflare, **escolha o seu domínio** na lista e
clique em **Authorize**.

Quando autorizar, o Pi salva um certificado em `~/.cloudflared/cert.pem` e o terminal
mostra uma mensagem de sucesso. Pode fechar a aba do navegador.

---

## 3. Criar o túnel

```bash
cloudflared tunnel create painel
```

Isso cria o túnel chamado `painel` e gera um arquivo de credencial. **Anote** o que ele
imprime — em especial o **ID do túnel** (um UUID tipo `a1b2c3d4-...`) e o **caminho do
arquivo `.json`** (algo como `/home/SEU_USUARIO/.cloudflared/a1b2c3d4-....json`).

Confira:

```bash
cloudflared tunnel list
ls ~/.cloudflared
```

---

## 4. Criar o arquivo de configuração

Vamos dizer ao túnel **qual domínio** entra e **para onde** ele manda (o app no
`localhost:8000`). Crie o `config.yml`:

```bash
nano ~/.cloudflared/config.yml
```

Cole o conteúdo abaixo, **trocando** `SEU_USUARIO`, o nome do arquivo `.json` (use o que
o passo 3 mostrou) e `painel.seudominio.com` pelo endereço que você quer usar:

```yaml
tunnel: painel
credentials-file: /home/SEU_USUARIO/.cloudflared/COLE-O-UUID-AQUI.json

ingress:
  - hostname: painel.seudominio.com
    service: http://localhost:8000
  - service: http_status:404
```

Salve no `nano`: **Ctrl+O**, **Enter**, **Ctrl+X**.

> O bloco `ingress` é uma lista: a primeira regra que casar vence. A última
> (`http_status:404`) é obrigatória e responde 404 para qualquer endereço que não seja o
> seu — funciona como "pega o resto".

---

## 5. Apontar o domínio para o túnel (DNS)

Este comando cria sozinho o registro DNS na Cloudflare ligando seu endereço ao túnel:

```bash
cloudflared tunnel route dns painel painel.seudominio.com
```

(Troque `painel.seudominio.com` pelo mesmo endereço que você pôs no `config.yml`.)

### Teste antes de virar serviço

Rode o túnel na mão uma vez para ver se sobe:

```bash
cloudflared tunnel run painel
```

Agora, **no navegador do PC** (pode ser pelo 4G do celular para testar "de fora"),
abra `https://painel.seudominio.com`. Deve abrir a tela de login do painel. 🎉

Pare o teste com **Ctrl+C** (ainda não está rodando 24h — isso é o próximo passo).

---

## 6. Deixar o túnel rodando 24h (systemd)

Igual ao serviço `painel`, criamos um serviço para o `cloudflared` subir no boot e voltar
sozinho se cair. Cole este bloco (ele preenche seu usuário e caminho automaticamente):

```bash
sudo tee /etc/systemd/system/cloudflared.service > /dev/null <<EOF
[Unit]
Description=Cloudflare Tunnel (painel)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$USER
ExecStart=/usr/bin/cloudflared tunnel --config $HOME/.cloudflared/config.yml run painel
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF
```

Ative e inicie:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now cloudflared
sudo systemctl status cloudflared
```

Deve aparecer **`active (running)`**. Aperte **q** para sair.

A partir de agora, sempre que o Pi ligar, **dois** serviços sobem sozinhos: o `painel`
(o app) e o `cloudflared` (a ponte de acesso de fora). ✅

---

## 7. (Recomendado) Proteger com login do Cloudflare — Cloudflare Access

Sem isso, **qualquer pessoa** que descobrir o seu endereço cai direto na tela de login do
painel. Para adicionar uma camada extra (uma tela de login da Cloudflare **antes** do
app, com código enviado por e-mail), use o **Cloudflare Zero Trust** (grátis até 50
usuários). Isso é feito **no site da Cloudflare**, não no Pi:

1. Abra https://one.dash.cloudflare.com → na primeira vez, escolha um **nome de time**
   e o plano **Free** (pode pedir um cartão só para validar; não cobra no Free).
2. Menu **Access → Applications → Add an application → Self-hosted**.
3. **Application name**: `Painel`. **Subdomain/Domain**: selecione o seu domínio e
   preencha o subdomínio `painel` (= `painel.seudominio.com`).
4. Em **Policies**, crie uma política **Allow**:
   - Nome: `Eu`.
   - **Include → Emails** → coloque o **seu e-mail**.
5. Salve. Pronto: ao abrir `https://painel.seudominio.com`, a Cloudflare vai pedir seu
   e-mail e enviar um **código de uso único**; só depois libera o painel.

> Com isso você tem **dois cadeados**: o login da Cloudflare (e-mail + código) e o login
> do próprio painel (usuário/senha). Pode manter os dois.

---

## 8. Testar de verdade "de fora"

- No celular, **desligue o WiFi** (use 4G/5G) e abra `https://painel.seudominio.com`.
- Se configurou o Access (passo 7): aparece a tela da Cloudflare → digite seu e-mail →
  pegue o código no e-mail → digita → cai na tela de login do painel.
- Faça login com `ADMIN_USER`/`ADMIN_PASSWORD`. Funcionou de fora = está tudo certo. 🎉

---

## 9. Comandos úteis do dia a dia

```bash
# Status e logs do túnel
sudo systemctl status cloudflared
journalctl -u cloudflared -f          # logs ao vivo (Ctrl+C sai)

# Reiniciar o túnel (depois de mexer no config.yml)
sudo systemctl restart cloudflared

# Listar / apagar túneis
cloudflared tunnel list
cloudflared tunnel delete painel      # se precisar refazer do zero
```

---

## 10. Problemas comuns

### `https://painel.seudominio.com` dá "host error" / 1033 / não abre
- O serviço do túnel está rodando? `sudo systemctl status cloudflared` → `active`.
- O app está de pé? `curl -s http://localhost:8000/api/health` no Pi → `{"status":"ok"}`.
- O DNS foi criado? `cloudflared tunnel route dns painel painel.seudominio.com` (de novo
  não faz mal). Mudança de DNS pode levar alguns minutos para propagar.

### Abre, mas dá `404` / "Bad gateway"
- Confira o `ingress` do `config.yml`: o `service` tem que ser `http://localhost:8000`
  (mesma porta do `ExecStart` do `painel.service`).
- O `hostname` no `config.yml` tem que ser **idêntico** ao do passo 5 (DNS).
- Reinicie após editar: `sudo systemctl restart cloudflared`.

### Login do painel não "gruda" (volta para a tela de login)
- Não deve acontecer: o cookie de sessão é `httpOnly`/`samesite=lax` e funciona por
  HTTPS. Se ocorrer, confirme que está acessando sempre pelo **mesmo** domínio (sem
  misturar `http://IP:8000` e `https://painel...` na mesma janela).

### `credentials file ... not found`
- O caminho do `.json` no `config.yml` está errado. Rode `ls ~/.cloudflared` e ajuste a
  linha `credentials-file:` para o nome exato do arquivo (o UUID do seu túnel).

---

## Atalho: teste relâmpago (sem domínio, sem conta)

Só para **provar** que dá certo, sem configurar nada: no Pi, com o app rodando, rode

```bash
cloudflared tunnel --url http://localhost:8000
```

O comando imprime uma URL aleatória tipo `https://algo-aleatorio.trycloudflare.com`.
Abra ela de qualquer lugar e você verá o painel. **Limitações:** a URL **muda toda vez**
que você reinicia, **não tem login da Cloudflare** na frente e **não serve para 24h** —
é só um teste. Para uso real, faça os passos 1 a 7.
