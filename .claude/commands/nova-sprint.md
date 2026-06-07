---
description: Transforma uma ideia numa sprint bem definida e registra no backlog. NÃO implementa nada — só planeja.
argument-hint: "<descrição do que quero>"
---

# Comando: /nova-sprint

Uso: `/nova-sprint <descrição do que quero>`

Descrição recebida: **$ARGUMENTS**

Quando eu rodar este comando, faça **exatamente** isto e **nada de implementação**:

1. **Transforme** minha descrição numa sprint bem definida (objetivo claro, pequena
   e entregável). Se algo estiver ambíguo, **pergunte antes** de registrar.
2. **Decida e declare quais skills de conhecimento** ela deve usar — dentre
   `backend-api`, `data-model`, `frontend-ui`, `design-system`, `deploy-pi` — e
   **explique o porquê** de cada uma.
3. **Crie o arquivo** `sprints/backlog/NN-nome-curto.md` (NN = próximo número
   sequencial, olhando `sprints/SPRINTS.md` e as pastas `backlog/`+`done/`), com o
   formato abaixo.
4. **Atualize** o índice `sprints/SPRINTS.md` (adicione a linha na ordem correta).
5. **NÃO implemente nada.** Só planeja e registra. No fim, mostre o resumo da sprint
   criada.

## Formato do arquivo da sprint

```markdown
# NN — <Título da sprint>

**Status:** backlog

## Objetivo
<1-2 frases.>

## Skills a usar
- <skill> — <por quê>

## Tasks
- [ ] <task>
- [ ] <task>

## Critérios de aceite
- <como sei que ficou pronta>

## Dependências
- <sprints que precisam estar prontas antes, ou "nenhuma">
```

## Lembretes
- Contexto/regra de negócio vem de [context/](context/) — referencie, não
  copie. Sprints pequenas, ordenadas por dependência.
