---
description: EXECUTA uma sprint — carrega as skills declaradas, implementa as tasks, valida pelos critérios de aceite e move a sprint para done.
argument-hint: "[sprint]"
---

# Comando: /dev

Uso:
- `/dev` — pega a **próxima sprint pendente** em `sprints/backlog/`, respeitando
  **dependências** e a ordem de `sprints/SPRINTS.md`.
- `/dev <nome-ou-número>` — executa a sprint que eu indicar.

Sprint indicada (se houver): **$ARGUMENTS**

Ao rodar, faça nesta ordem:

1. **Abra** o arquivo da sprint e **carregue as skills que ela declarou** (use a
   Skill tool para cada skill declarada e leia o `context/` que elas apontam).
   Confira que as **dependências** estão em `done`; se não, avise e pare.
2. **Resuma o plano** em poucas linhas (o que vai fazer e com quais skills).
3. **Implemente as tasks** seguindo os padrões dessas skills e do
   [context/](context/). Se algo estiver **ambíguo, pergunte antes** de
   implementar.
4. **Valide** conforme os **critérios de aceite** (rode/teste o que der; relate o
   resultado honestamente).
5. **Conclua:** marque `Status: done` no arquivo, **mova-o para `sprints/done/`** e
   **atualize `sprints/SPRINTS.md`**.
6. No fim, **diga o que foi feito** e **sugira a próxima sprint**.

## Regras
- **Uma sprint por vez.** Não adiante trabalho de sprints futuras.
- `SPRINTS.md` é a fonte de verdade do progresso — mantenha sempre atualizado.
- Respeite a stack e o design ([context/](context/)); nada de deps pesadas
  no Pi 3.
