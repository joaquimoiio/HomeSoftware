# Acessar o Painel de fora de casa — Tailscale Funnel (grátis, sem domínio)

Continuação do [GUIA-PI.md](GUIA-PI.md). Pré-requisito: o painel **já roda 24h** no Pi e
você abre `http://IP_DO_PI:8000` na rede local. Aqui vamos deixá-lo acessível **de
qualquer lugar** (trabalho, celular no 4G) por um **endereço público HTTPS de graça**,
sem comprar domínio e **sem instalar nada** no aparelho de quem acessa.

## Como funciona (em 1 minuto)

O Tailscale roda no Pi. O **Funnel** publica o seu app num endereço fixo tipo
`https://NOME-DO-PI.SEU-TAILNET.ts.net`, com HTTPS automático. Quem abre esse endereço
cai no painel — **não precisa abrir porta no roteador** e o IP da sua casa fica escondido.

```
Navegador (trabalho)  ──HTTPS──>  Tailscale Funnel  ──>  Pi (localhost:8000)
```

> **Segurança:** essa URL é **pública** (qualquer um que souber dela chega à tela de
> login). A sua proteção é o **login do próprio painel** (usuário/senha) + a URL ser
> difícil de adivinhar. Use uma **senha forte** no admin. (Se quiser acesso 100%
> privado, veja a nota no fim sobre usar o Tailscale **sem** Funnel.)

Todos os comandos rodam **dentro do Pi** (conecte por `ssh SEU_USUARIO@IP_DO_PI`).

---

## 1. Instalar o Tailscale no Pi

```bash
curl -fsSL https://tailscale.com/install.sh | sh
```

O script detecta o ARM do Pi e instala sozinho. Confira:

```bash
tailscale version
```

---

## 2. Conectar o Pi à sua conta Tailscale

```bash
sudo tailscale up
```

O comando vai imprimir uma **URL**. Copie e abra **no navegador do seu PC**, faça login
(pode usar Google, Microsoft, GitHub ou e-mail — é grátis para uso pessoal) e **autorize**
o Pi. Quando autorizar, o terminal confirma a conexão.

Veja o nome que o seu Pi recebeu na rede (vai aparecer algo como `raspberrypi` e o seu
*tailnet*, tipo `seunome.ts.net`):

```bash
tailscale status
```

---

## 3. Ligar MagicDNS e HTTPS (necessário para o Funnel)

O Funnel precisa de HTTPS, e isso se liga **uma vez** no painel web do Tailscale (não no
Pi):

1. Abra https://login.tailscale.com/admin/dns
2. Ative **MagicDNS** (botão *Enable MagicDNS*).
3. Mais abaixo, ative **HTTPS Certificates** (*Enable HTTPS*).

Pode fechar a aba depois.

---

## 4. Publicar o app no Funnel

De volta ao Pi, exponha a porta 8000 (a mesma do `painel.service`). O `--bg` faz rodar em
segundo plano **e** salva a config, que volta sozinha após reboot:

```bash
sudo tailscale funnel --bg 8000
```

> **Se aparecer um aviso pedindo para habilitar o Funnel**, o Tailscale mostra uma URL.
> Abra no navegador do PC, clique para **habilitar o Funnel** no seu tailnet e rode o
> comando acima de novo. (É uma permissão que se liga uma vez por conta.)

---

## 5. Pegar o seu endereço

```bash
tailscale funnel status
```

Vai mostrar a URL pública, algo como:

```
https://raspberrypi.seunome.ts.net
```

**Anote essa URL** — é por ela que você acessa o painel de qualquer lugar.

---

## 6. Testar "de fora"

- No celular, **desligue o WiFi** (use 4G/5G) e abra a URL `…ts.net` no navegador.
- Deve abrir a **tela de login** do painel.
- Entre com o `ADMIN_USER` / `ADMIN_PASSWORD` do `.env`. Funcionou de fora = está pronto.
  🎉

Como o serviço `tailscaled` já roda 24h e a config do Funnel ficou salva (`--bg`), isso
**continua valendo após reiniciar o Pi** — não precisa criar nenhum serviço extra.

---

## 7. Comandos úteis do dia a dia

```bash
# Ver o status da rede Tailscale e o nome/IP do Pi
tailscale status

# Ver o que está publicado no Funnel (e a URL)
tailscale funnel status

# Desligar o Funnel (deixa de ser público; Tailscale continua ligado)
sudo tailscale funnel --bg --https=443 off    # ou: sudo tailscale funnel reset

# Religar
sudo tailscale funnel --bg 8000

# Status do serviço do Tailscale
sudo systemctl status tailscaled
```

---

## 8. Problemas comuns

### A URL `.ts.net` não abre / dá erro de certificado
- Confirme que ligou **MagicDNS** e **HTTPS Certificates** no passo 3. O primeiro
  certificado pode levar alguns minutos para emitir.
- `tailscale funnel status` deve listar a porta 8000 → `http://127.0.0.1:8000`.

### Abre a URL mas dá "Bad gateway" / página em branco
- O app está de pé? No Pi: `curl -s http://localhost:8000/api/health` → `{"status":"ok"}`.
- Se não estiver: `sudo systemctl status painel` e `sudo systemctl restart painel`.

### "Funnel not enabled" / pede permissão
- Veja o aviso do passo 4: abra a URL que o comando mostrou e habilite o Funnel no painel
  do Tailscale, depois rode `sudo tailscale funnel --bg 8000` de novo.

### O login do painel não "gruda"
- Não deve ocorrer (cookie `httpOnly`/`samesite=lax` funciona por HTTPS). Garanta que
  você sempre usa a **mesma** URL (não misture `http://IP:8000` local com a `…ts.net` na
  mesma janela).

### Esqueci/quero ver minha URL de novo
- `tailscale funnel status` (mostra a URL) ou monte: `https://` + nome do Pi em
  `tailscale status` + `.ts.net`.

---

## Nota: quer acesso 100% privado (sem URL pública)?

O Funnel deixa o app **público** (protegido pelo login do painel). Se preferir que **só os
seus aparelhos** consigam acessar — mais privado, sem nenhuma URL exposta — é só **não**
usar o Funnel:

1. Instale o app do **Tailscale** também no seu celular/notebook e logue na **mesma
   conta**.
2. Acesse o Pi pelo IP Tailscale dele (veja em `tailscale status`, tipo
   `100.x.y.z:8000`), ou pelo nome MagicDNS `http://raspberrypi:8000`.

A diferença: nesse modo privado você **precisa** do app Tailscale instalado e logado em
cada aparelho de onde for acessar (não serve para um PC do trabalho onde você não pode
instalar nada). O Funnel é justamente para esse caso "qualquer navegador, sem instalar".
