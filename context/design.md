# Design system — "Command Center" editorial escuro

> Fonte da verdade do **visual**. CRÍTICO: a interface **NÃO PODE parecer feita por
> IA genérica**. Comprometa-se com uma estética forte, específica e coesa, e
> capriche nos detalhes. Como aplicar na prática: skill `design-system` + `frontend-ui`.

## Decisões já tomadas (não reabrir sem motivo)

Para garantir coesão entre o hub e os três módulos, estas escolhas estão **fixadas**:

- **Estética:** painel escuro editorial tipo *command center* — sofisticado,
  pessoal, densidade de informação controlada.
- **Sotaque único:** **âmbar / laranja-queimado**. Um só, usado com parcimônia.
- **Tipografia:**
  - Display: **Fraunces** (serifa com personalidade, para títulos e números grandes).
  - Corpo: **Hanken Grotesk** (limpo, legível — NÃO é Inter/Roboto/etc.).
  - Mono: **JetBrains Mono** (números, valores monetários, datas, horários).

Tudo em **CSS variables**. Tokens base sugeridos (ajuste fino na implementação):

```css
:root {
  /* fundo escuro profundo — carvão/azul-noite, NÃO preto puro */
  --bg-900: #0e1116;   /* fundo da página */
  --bg-800: #141821;   /* superfícies/painéis */
  --bg-700: #1c212c;   /* superfície elevada */
  --line:   #2a3140;   /* divisórias finas */
  --line-strong: #3a4252;

  --text:   #e6e9ef;   /* texto principal */
  --text-dim: #9aa3b2; /* secundário */
  --text-faint: #5f6b7e;

  /* sotaque único — âmbar/laranja-queimado */
  --accent: #ff8a3d;
  --accent-strong: #ff6a00;
  --accent-soft: rgba(255, 138, 61, 0.12);

  /* semânticos discretos (use pouco) */
  --pos: #6fcf97;      /* entradas / pago / positivo */
  --neg: #e57373;      /* saídas / a pagar / negativo */
}
```

## Proibido (denuncia "IA genérica")

- Fontes **Inter, Roboto, Arial, Helvetica, system-ui, Open Sans, Lato**. E **NÃO
  use Space Grotesk**.
- **Gradiente roxo/violeta** clichê e gradientes sem propósito.
- Layout **todo simétrico e centralizado**; cartões iguais e previsíveis.
- **Emoji no lugar de ícones.**
- Tudo com **cantos super arredondados + sombra azulada padrão do Tailwind**.

## Direção a seguir

- **Cor:** fundo escuro profundo (carvão/azul-noite com leve temperatura), **um
  único sotaque vivo** (âmbar) usado com parcimônia.
- **Tipografia com hierarquia caprichada:** display marcante + corpo legível +
  monoespaçada bonita para números/valores/datas.
- **Composição:** quebre a grade de propósito — **assimetria**, algum elemento que
  "vaza", **espaço negativo** onde respira e **densidade** onde informa. Nada
  igualzinho e centralizado.
- **Profundidade:** **textura sutil** (grão/ruído fino), camadas e sombras com
  intenção; **bordas/divisórias finas** e elegantes em vez de cartões "flutuando".
- **Movimento:** entrada de página **orquestrada com reveals escalonados**
  (staggered, via `animation-delay`); usar a biblioteca **Motion** (antiga Framer
  Motion). Hover states caprichados, sem exagero.
- **Ícones:** set consistente e refinado — **Lucide**. Nunca emoji.
- **Coesão:** hub e os três módulos parecem claramente **o mesmo produto**.
- **Responsivo e rápido:** no mobile, layout **repensado**, não só espremido.

## Aplicação por módulo (espírito, não pixel)

- **Hub:** entrada de comando. Lista/grade assimétrica dos 3 módulos com um título
  de display forte, relógio/data em mono, reveals escalonados na entrada.
- **Financeiro:** densidade de dados; valores em mono, sinais em `--pos`/`--neg`;
  gráficos sóbrios (sem 3D, sem cores aleatórias — usar o sotaque + neutros).
- **Agenda:** grade de calendário com divisórias finas; dia atual marcado pelo
  sotaque; eventos com cor/categoria discreta.
- **Seguidores:** duas colunas (ganhos/perdidos) com contadores em mono e tom
  semântico; estado vazio bem cuidado.
