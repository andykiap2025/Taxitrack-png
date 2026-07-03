/**
 * Balance ledger helpers. Business rule (CLAUDE.md): shortfalls are DEBITS,
 * surpluses are CREDITS; running balance per driver = Σ credits − Σ debits
 * over unresolved entries (outstanding / carried). Resolution happens at
 * payroll via the offset engine (lib/payroll.ts).
 */
import type { BadgeTone } from '@/components/ui';
import { formatPGK } from '@/lib/format';
import type { BalanceLedgerEntry, DeductionType, LedgerStatus } from '@/types/db';

type OpenEntry = Pick<BalanceLedgerEntry, 'entry_type' | 'amount' | 'status'>;

export function openBalance(entries: OpenEntry[]): {
  credits: number;
  debits: number;
  balance: number;
} {
  let credits = 0;
  let debits = 0;
  for (const e of entries) {
    if (e.status !== 'outstanding' && e.status !== 'carried') continue;
    if (e.entry_type === 'surplus') credits += Number(e.amount);
    else debits += Number(e.amount);
  }
  return { credits, debits, balance: credits - debits };
}

export function balanceLabel(balance: number): { label: string; tone: BadgeTone } {
  if (balance > 0) return { label: `${formatPGK(balance)} in credit`, tone: 'success' };
  if (balance < 0) return { label: `${formatPGK(-balance)} owing`, tone: 'danger' };
  return { label: 'Balanced', tone: 'neutral' };
}

export const LEDGER_STATUS_LABELS: Record<LedgerStatus, string> = {
  outstanding: 'Outstanding',
  offset: 'Offset',
  deducted: 'Deducted',
  paid_bonus: 'Bonus paid',
  waived: 'Waived',
  carried: 'Carried over',
};

export const DEDUCTION_TYPE_LABELS: Record<DeductionType, string> = {
  fuel: 'Fuel',
  advance: 'Advance',
  fine: 'Fine',
  repair: 'Repair',
  shortfall: 'Shortfall',
  other: 'Other',
};
