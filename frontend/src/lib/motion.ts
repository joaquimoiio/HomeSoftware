/**
 * Variants de movimento compartilhadas (Motion) — fonte única para os reveals
 * escalonados de entrada que dão o "ligar o painel" do command center.
 * Use <Stagger>/<Reveal> (components/Reveal.tsx) em vez de repetir isto.
 */
import type { Variants } from "motion/react";

// Recipiente: orquestra os filhos em cascata.
export const stagger: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.06, delayChildren: 0.04 },
  },
};

// Item: sobe e aparece com easing suave (sem "molinha" exagerada).
export const revealItem: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  },
};
