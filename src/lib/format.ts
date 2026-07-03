/**
 * PNG conventions — NON-NEGOTIABLE (see CLAUDE.md):
 * currency "K1,234.50", dates DD/MM/YYYY, timezone Pacific/Port_Moresby.
 * The business day is always the Port Moresby calendar date.
 */
import { format, parseISO } from 'date-fns';

export const TIMEZONE = 'Pacific/Port_Moresby';

/** "K1,234.50" · negatives as "-K30.00". */
export function formatPGK(amount: number, opts?: { decimals?: number }): string {
  const decimals = opts?.decimals ?? 2;
  const abs = Math.abs(amount);
  const formatted = abs.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${amount < 0 ? '-' : ''}K${formatted}`;
}

type DateInput = Date | string;

function toDate(value: DateInput): Date {
  return typeof value === 'string' ? parseISO(value) : value;
}

/** "25/12/2026" */
export function formatDate(value: DateInput): string {
  return format(toDate(value), 'dd/MM/yyyy');
}

/** "Thu 25 Dec 2026" — for headers and payslips. */
export function formatDateLong(value: DateInput): string {
  return format(toDate(value), 'EEE dd MMM yyyy');
}

/** "25 Dec" — compact, for list rows. */
export function formatDateShort(value: DateInput): string {
  return format(toDate(value), 'dd MMM');
}

/** "11:05 PM" */
export function formatTime(value: DateInput): string {
  return format(toDate(value), 'h:mm a');
}

/**
 * Today's business date (yyyy-MM-dd) in Port Moresby, regardless of the
 * device timezone. en-CA locale yields the ISO date layout.
 */
export function todayISO(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Current time-of-day in Port Moresby as minutes since midnight. */
export function nowPOMMinutes(now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return h * 60 + m;
}

/** "+675 7XXX XXXX" — best-effort formatting, never rejects input. */
export function formatPhonePNG(raw: string): string {
  const digits = raw.replace(/\D/g, '').replace(/^675/, '');
  if (digits.length !== 8) return raw.trim();
  return `+675 ${digits.slice(0, 4)} ${digits.slice(4)}`;
}
