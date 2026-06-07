---
name: frontend-ui
description: Padrões de frontend React/Vite/Tailwind deste projeto — rotas por módulo, cliente de API, estado leve. Use ao criar/alterar telas e componentes. Para o visual, combine com a skill design-system.
---

# Skill: frontend-ui

Leia [context/stack.md](../../../context/stack.md) (convenções de frontend) e, para
qualquer coisa visual, **sempre** a skill [design-system](../design-system/SKILL.md)
+ [context/design.md](../../../context/design.md). Aqui é a parte de **engenharia**
do front.

## Como aplicar
- **React + Vite + Tailwind.** Uma rota/componente por módulo + o hub (React Router):
  `/` (hub), `/login`, `/financeiro`, `/agenda`, `/seguidores`. Páginas em
  `src/pages/`, componentes reutilizáveis em `src/components/`.
- Cliente HTTP fino em `src/lib/api.ts`: `fetch` com `credentials: 'include'`,
  trata **401 → redireciona pro login**. Centralize aqui as chamadas `/api/*`.
- Estado de servidor **leve**: fetch + estado local, ou TanStack Query se ajudar.
  **Não** use Redux nem libs de estado pesadas (alvo é Pi 3).
- Ícones **Lucide**, nunca emoji. Animações com **Motion** (ver design-system).
- **Responsivo**: no mobile o layout é repensado, não só espremido.
- Build (`npm run build`) gera `frontend/dist`, que o FastAPI serve em produção.
  Em dev, use o proxy do Vite para `/api`.

## Não faça
- Não invente visual fora do [design-system](../design-system/SKILL.md).
- Não adicione bibliotecas pesadas de UI sem necessidade clara.
