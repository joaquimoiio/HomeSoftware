/**
 * Utilitários de data/hora locais para a agenda — sem libs (leve no Pi).
 * Tudo trabalha em HORA DE PAREDE LOCAL e serializa em ISO *naive* (sem fuso,
 * sem o "Z" do toISOString) para casar com o backend, que guarda datetime naive.
 */
const p2 = (n: number) => String(n).padStart(2, "0");

/** Date → "YYYY-MM-DDTHH:MM:SS" (local, sem fuso). */
export function toLocalISO(d: Date): string {
  return (
    `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}` +
    `T${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`
  );
}

/** Date → "YYYY-MM-DD" (local). */
export function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}

/** Date → "HH:MM" (local). */
export function toLocalTimeStr(d: Date): string {
  return `${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

/** "YYYY-MM-DD" ou "YYYY-MM-DDTHH:MM[:SS]" → Date local (sem deslocar fuso). */
export function parseLocal(s: string): Date {
  const [datePart, timePart] = s.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  let hh = 0,
    mm = 0,
    ss = 0;
  if (timePart) {
    const [h, mi, se] = timePart.split(":").map(Number);
    hh = h || 0;
    mm = mi || 0;
    ss = se || 0;
  }
  return new Date(y, m - 1, d, hh, mm, ss);
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
}

export function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** Soma `n` meses preservando hora e ajustando o dia em meses curtos. */
export function addMonths(d: Date, n: number): Date {
  const total = d.getMonth() + n;
  const year = d.getFullYear() + Math.floor(total / 12);
  const month = ((total % 12) + 12) % 12;
  const day = Math.min(d.getDate(), daysInMonth(year, month));
  return new Date(year, month, day, d.getHours(), d.getMinutes(), d.getSeconds());
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** Domingo da semana que contém `d` (calendário pt-BR começa no domingo). */
export function startOfWeek(d: Date): Date {
  const r = startOfDay(d);
  r.setDate(r.getDate() - r.getDay()); // getDay(): 0 = domingo
  return r;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isToday(d: Date): boolean {
  return isSameDay(d, new Date());
}

/** Minutos decorridos desde a meia-noite local de `d`. */
export function minutesSinceMidnight(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

export const WEEKDAYS_SHORT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

export const MONTHS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export const MONTHS_SHORT = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];
