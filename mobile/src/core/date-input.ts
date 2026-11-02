import { formatCivilDate } from '@/lib/dates/format';

/** Mascara "dd/mm/aaaa" a partir dos algarismos digitados. */
export function maskDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/** "05/11/2026" -> "2026-11-05"; texto incompleto -> "" (a validacao do formulario aponta "Informe uma data valida."). */
export function parseDateInput(text: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
}

export const isoToDateInput = (iso: string): string => formatCivilDate(iso);
