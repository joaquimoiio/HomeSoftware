/**
 * Reveals escalonados de entrada (Motion).
 * - <Stagger> envolve uma seção e cadencia os filhos.
 * - <Reveal> é cada filho que sobe/aparece.
 * Respeita prefers-reduced-motion via a própria Motion.
 */
import { motion } from "motion/react";
import type { ReactNode } from "react";
import { revealItem, stagger } from "../lib/motion";

export function Stagger({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="show"
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function Reveal({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div variants={revealItem} className={className}>
      {children}
    </motion.div>
  );
}
