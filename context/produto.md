# Produto — Painel de Comando pessoal

> Fonte da verdade do **o quê**. Visão, módulos e regras de negócio.
> Quem define o **como técnico**: [stack.md](stack.md). Visual: [design.md](design.md). Deploy: [deploy.md](deploy.md).

## Visão

Aplicação web **pessoal e multiusuário** — um "painel de comando" — que roda
**24h num Raspberry Pi 3 Model B** (1GB RAM, CPU modesto) e é acessada de qualquer
lugar (Tailscale ou Cloudflare Tunnel). Prioridade absoluta: **ser leve**. Nada de
stack pesada (sem Java/Spring, sem serviços extras desnecessários).

Cada usuário tem **login próprio** e vê **apenas os seus dados** (financeiro e
agenda são **isolados por usuário**). Um usuário **admin** cadastra os demais por um
painel simples. Tela inicial é um **hub** onde escolho qual módulo abrir. Tudo atrás
de login.

## Usuários e administração

Poucos usuários (escala doméstica), mas com **isolamento real** entre eles.

- **Papéis:** `admin` e usuário comum. O **primeiro admin** nasce no 1º startup a
  partir do `.env` (não existe usuário ⇒ cria admin com `ADMIN_USER`/`ADMIN_PASSWORD`).
- **Painel de admin** (só admin acessa): listar usuários, **cadastrar** novo usuário,
  **resetar senha**, ativar/desativar e (opcional) promover a admin.
- **Segurança ao cadastrar:** ao criar um usuário, o sistema **gera uma senha forte
  aleatória**, mostra **uma única vez** para o admin repassar, e marca a conta para
  **trocar a senha no primeiro login**. Senhas **sempre** guardadas com **hash
  (bcrypt)** — nunca em texto puro. Mesmo fluxo no "resetar senha".
- **Isolamento:** toda entidade de dados pertence a um usuário (`user_id`) e toda
  consulta é filtrada pelo usuário logado. Um usuário **nunca** vê/edita dado de
  outro. O comparador de seguidores não tem banco, mas os **snapshots em disco** vão
  para uma pasta **por usuário**.

## Módulos

1. **Comparador de seguidores** — sem banco de dados.
2. **Controle financeiro** — fluxo de caixa + patrimônio + dívidas, com banco.
3. **Agenda / Calendário** — estilo Google Calendar, com banco.

---

## Módulo 1 — Comparador de seguidores (SEM banco)

Fluxo: **upload de dois arquivos JSON** — a lista atual de seguidores e uma
anterior. O app compara e mostra:

- Quem **parou de seguir** (estava na anterior, não está na atual).
- Quem **começou a seguir** (está na atual, não estava na anterior).
- **Contagens e saldo** (total atual, total anterior, ganhos, perdidos, saldo).

Regras:
- Arquivos processados **em memória**. **Nada salvo no SQLite.**
- Parsing **tolerante** a formatos comuns de export: JSON com lista de objetos
  contendo um campo de username/handle. Deixar **claro na UI qual campo** está
  sendo usado como identificador (detectar entre nomes comuns: `username`,
  `handle`, `value`, `string_list_data[].value`, etc.).
- Botão **"salvar snapshot de referência"**: guarda a lista atual num arquivo
  `.json` no disco (NÃO no SQLite), para numa próxima vez subir só a lista nova e
  comparar contra o snapshot salvo. Os snapshots ficam numa **pasta por usuário**
  (ex.: `SNAPSHOT_DIR/<user_id>/`) — um usuário não enxerga snapshot de outro.

---

## Módulo 2 — Controle financeiro (COM banco)

Persistir em SQLite, **tabelas separadas**: lançamentos; itens de patrimônio;
dívidas + parcelas vinculadas. Toda linha pertence a um usuário (`user_id`) e as
consultas são **sempre filtradas pelo usuário logado**. Três abas:

### 2a. Fluxo de caixa (entradas e saídas)
- Registrar entradas e saídas: **valor, descrição, categoria, data, tipo**.
- **Saldo atual** (entradas − saídas); totais de entradas e saídas do período.
- Visão **por mês** e **por categoria**, com **gráfico simples**.
- **CRUD completo** dos lançamentos.

### 2b. Patrimônio (reservas e investimentos)
- Itens nomeados (ex.: "Reserva de emergência", "Tesouro Direto", "Ações"), cada
  um com: **valor atual** (atualizado manualmente), **tipo** (reserva/investimento),
  **data da última atualização**.
- Totais de **guardado**, **investido** e **patrimônio total**. Deixar claro na UI
  a diferença entre **saldo do fluxo de caixa** e **patrimônio acumulado**.
- Opcional: **histórico de evolução** de cada item, com mini-gráfico.
- **CRUD completo.**

### 2c. Dívidas (aba própria)
- Criar dívida com: **nome** (ex.: "Notebook", "Cartão", "Empréstimo"),
  **quantidade de parcelas** e **valor das parcelas**. Dois modos:
  - parcelas iguais (informo valor + número → app gera todas), ou
  - valores diferentes por parcela (edito cada uma).
- Por dívida: **valor total** (soma das parcelas), **quanto já foi pago**, **quanto
  falta**, **quantas parcelas faltam**; **data de vencimento opcional** por parcela.
- **Marcar parcelas como pagas** (uma a uma); resumo atualiza.
- Visão geral: **total devido** (todas as dívidas) e **total a pagar**, com **barra
  de progresso** (parcelas pagas vs. totais) por dívida.
- **CRUD completo.**

---

## Módulo 3 — Agenda / Calendário (COM banco)

Funcionar **como um Google Calendar de verdade** (calendário visual com eventos),
NÃO uma lista de tarefas.

- **Visões:** mês (grade com eventos nos dias), semana (faixas de horário), dia
  (agenda hora a hora). Navegação **anterior / próximo / "hoje"** e alternância de
  visão. **Dia atual destacado.**
- **Eventos:** título, descrição opcional, **início e fim com data/hora**, opção de
  **dia inteiro**, **local** opcional, **cor/categoria**. **Recorrência** básica
  (diária/semanal/mensal). Clicar num dia/horário **cria** evento; clicar num
  evento **abre para ver/editar/excluir**. Arrastar para criar/mover é **desejável**
  (se pesar no Pi, vira melhoria futura).
- Pode usar lib leve de calendário (ex.: FullCalendar) **ou** construir a grade do
  zero — o que casar melhor com a estética (ver [design.md](design.md)).
- Persistir todos os eventos em SQLite, **vinculados ao usuário** (`user_id`); cada
  um vê apenas a própria agenda.
