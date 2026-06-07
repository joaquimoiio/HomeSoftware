# 03 — Base de design e shell da aplicação

**Status:** done

## Objetivo
Implementar a fundação visual (tokens, fontes, textura, motion) e o "shell" comum
(layout, navegação, transições de página) que todos os módulos vão reusar — para
garantir coesão e evitar retrabalho de estilo.

## Skills a usar
- `design-system` — aplicar [context/design.md](../../context/design.md) (estética command center).
- `frontend-ui` — estruturar o shell, layout responsivo e Motion.

## Tasks
- [x] Confirmar tokens em `styles/index.css` e o mapeamento no `tailwind.config.js`
  (já vinham da sprint 01; mantidos e validados).
- [x] Carregar fontes (Fraunces / Hanken Grotesk / JetBrains Mono) e aplicar
  hierarquia (defaults de display nos títulos via `@layer base`).
- [x] Componente de layout/shell (`components/Shell.tsx`) com navegação coesa
  (NavLink + sotaque no ativo), relógio em mono, conta/logout e divisórias finas.
- [x] Textura sutil (grão SVG via `body::after`) e reveals escalonados de entrada
  via Motion (`lib/motion.ts` + `components/Reveal.tsx` — `Stagger`/`Reveal`).
- [x] Componentes-base reutilizáveis: `Button`, `Field` (já existia), `Card`
  editorial, `Value` (número em mono) e `PageHeader`.
- [x] Conferir checklist anti-"cara de IA" do design-system (sem fontes proibidas,
  sem roxo/gradiente, sem emoji; assimetria, divisórias finas, reveals).

## Notas de implementação
- Login e Trocar-senha passaram a consumir o `Button`; o placeholder do hub e a
  tela de Admin passaram a viver dentro do `Shell` + `PageHeader` (prova de reúso
  e coesão), sem mudar nenhuma lógica.
- A navegação do `Shell` já lista os módulos (Financeiro/Agenda/Seguidores); as
  rotas chegam nas sprints 05/08/09 — até lá caem no fallback do router (hub).
- Validado com `npm run build` (tsc + vite): sem erros de tipo; bundle ~98 kB gzip.

## Critérios de aceite
- Nenhuma fonte proibida; sem roxo/gradiente clichê; sem emoji como ícone (usa Lucide).
- Entrada de página com reveals escalonados; layout assimétrico e responsivo.
- Componentes-base prontos para os módulos consumirem.

## Dependências
- 01-fundacao
