---
name: design-system
description: Aplica a identidade visual "command center" escura e editorial do projeto. Use SEMPRE que criar ou alterar qualquer tela/componente. Garante que a UI não pareça feita por IA genérica.
---

# Skill: design-system

A fonte da verdade visual é [context/design.md](../../../context/design.md) — **leia
antes de mexer em qualquer pixel**. Lá estão as decisões fixadas (estética command
center escura; sotaque **âmbar/laranja-queimado**; fontes **Fraunces** display +
**Hanken Grotesk** corpo + **JetBrains Mono** números; tokens em CSS variables) e a
lista do que é **proibido**. Esta skill é o checklist de **como aplicar**.

## Checklist ao construir/alterar UI
1. Use os **tokens CSS** (`--bg-*`, `--text*`, `--accent*`) — nunca cores soltas.
2. **Sotaque com parcimônia:** âmbar só em foco/ação/destaque, não em tudo.
3. **Tipografia:** Fraunces para títulos/números grandes; Hanken Grotesk no corpo;
   **JetBrains Mono em todo número** (valores, datas, horários, contadores).
4. **Composição assimétrica:** quebre a grade, deixe algo "vazar", use espaço
   negativo + densidade onde informa. Não centralize tudo.
5. **Profundidade sóbria:** divisórias finas (`--line`) > cartões flutuando; textura
   sutil (grão/ruído fino); sombras com intenção, não a sombra azul padrão.
6. **Movimento:** entrada com reveals **escalonados** (Motion / `animation-delay`);
   hover caprichado sem exagero.
7. **Ícones Lucide**, nunca emoji.
8. **Coesão:** hub e os 3 módulos parecem o mesmo produto.
9. **Mobile repensado**, não só espremido.

## Verificação rápida (se algum "sim", refaça)
- Parece Inter/Roboto, roxo, cartões brancos com sombra suave, tudo centralizado?
- Usei emoji como ícone? Usei Space Grotesk? Gradiente sem propósito?
→ Qualquer um desses = está caindo no clichê de IA. Volte para [design.md](../../../context/design.md).
