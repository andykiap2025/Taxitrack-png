/**
 * Payroll math — PURE functions only (no supabase, no react) so the
 * money logic is independently testable. Persistence lives in
 * lib/payrollActions.ts.
 *
 * Business rules (CLAUDE.md):
 * - Pay = commission % × gross takings per 14-day period (rate snapshotted)
 * - Gross aggregates BY DRIVER (relief days included via driver_id)
 * - Offset mode: surpluses cancel shortfalls within the period (carried
 *   entries roll in when carry-forward is on); only a NET shortfall becomes
 *   a deduction
 * - Surplus is already inside gross — bonus mode adds bonus_rate × surplus
 *   on top, never double-counts gross
 */
import type {
  BalanceLedgerEntry,
  LedgerStatus,
  ShortfallPolicy,
  SurplusPolicy,
} from '../types/db';

// ---------------------------------------------------------------- periods

/** Days between two yyyy-MM-dd dates (b - a). */
function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export type Period = { start: string; end: string };

/** The 14-day period containing `date`, aligned to the anchor date. */
export function periodForDate(date: string, anchor: string): Period {
  const offset = dayDiff(anchor, date);
  const index = Math.floor(offset / 14);
  const start = addDays(anchor, index * 14);
  return { start, end: addDays(start, 13) };
}

export function shiftPeriod(period: Period, deltaPeriods: number): Period {
  const start = addDays(period.start, deltaPeriods * 14);
  return { start, end: addDays(start, 13) };
}

/** 1-based day number of `date` inside the period (1..14). */
export function dayOfPeriod(date: string, period: Period): number {
  return dayDiff(period.start, date) + 1;
}

// ---------------------------------------------------------------- payroll

export type PayrollSettings = {
  commission_rate: number;
  shortfall_policy: ShortfallPolicy;
  surplus_policy: SurplusPolicy;
  surplus_bonus_rate: number;
  carry_forward_balance: boolean;
};

type LedgerInput = Pick<BalanceLedgerEntry, 'id' | 'date' | 'entry_type' | 'amount'>;

export type LedgerResolution = { id: string; status: LedgerStatus; resolved: boolean };

export type PayrollComputation = {
  grossTakings: number;
  commissionRate: number;
  grossPay: number;
  totalShortfalls: number;
  totalSurpluses: number;
  /** surpluses − shortfalls over the entries considered (incl. carried). */
  netBalance: number;
  shortfallDeduction: number;
  surplusBonus: number;
  manualDeductions: number;
  totalDeductions: number;
  netPay: number;
  resolutions: LedgerResolution[];
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Compute one driver's pay for one period.
 * `ledgerEntries` = this period's unresolved entries; `carriedEntries` =
 * prior entries with status 'carried' (pass [] when carry-forward is off).
 */
export function computePayroll(input: {
  takingsAmounts: number[];
  ledgerEntries: LedgerInput[];
  carriedEntries: LedgerInput[];
  deductionAmounts: number[];
  settings: PayrollSettings;
}): PayrollComputation {
  const { settings } = input;
  const all = [...input.carriedEntries, ...input.ledgerEntries].sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : 0,
  );

  const grossTakings = round2(input.takingsAmounts.reduce((s, a) => s + Number(a), 0));
  const grossPay = round2(grossTakings * settings.commission_rate);

  const debits = all.filter((e) => e.entry_type === 'shortfall');
  const credits = all.filter((e) => e.entry_type === 'surplus');
  const totalShortfalls = round2(debits.reduce((s, e) => s + Number(e.amount), 0));
  const totalSurpluses = round2(credits.reduce((s, e) => s + Number(e.amount), 0));
  const netBalance = round2(totalSurpluses - totalShortfalls);

  const resolutions: LedgerResolution[] = [];
  let shortfallDeduction = 0;
  let surplusBonus = 0;

  const resolveShortfalls = (amountOwed: number) => {
    // amountOwed is what remains after any offsetting.
    if (amountOwed <= 0) {
      for (const d of debits) resolutions.push({ id: d.id, status: 'offset', resolved: true });
      return;
    }
    switch (settings.shortfall_policy) {
      case 'deduct':
        shortfallDeduction = round2(amountOwed);
        for (const d of debits) resolutions.push({ id: d.id, status: 'deducted', resolved: true });
        break;
      case 'carry_forward':
        for (const d of debits) resolutions.push({ id: d.id, status: 'carried', resolved: false });
        break;
      case 'flag_only':
        for (const d of debits) resolutions.push({ id: d.id, status: 'waived', resolved: true });
        break;
    }
  };

  if (settings.surplus_policy === 'offset') {
    if (netBalance >= 0) {
      // All shortfalls cancelled; leftover credit carries or expires.
      for (const d of debits) resolutions.push({ id: d.id, status: 'offset', resolved: true });
      for (const c of credits) {
        if (netBalance > 0 && settings.carry_forward_balance) {
          resolutions.push({ id: c.id, status: 'carried', resolved: false });
        } else {
          resolutions.push({ id: c.id, status: 'offset', resolved: true });
        }
      }
    } else {
      // Credits fully consumed; net shortfall handled per policy.
      for (const c of credits) resolutions.push({ id: c.id, status: 'offset', resolved: true });
      resolveShortfalls(-netBalance);
    }
  } else {
    // pay_through / bonus: no offsetting — full shortfalls per policy.
    resolveShortfalls(totalShortfalls);
    const creditStatus: LedgerStatus = settings.surplus_policy === 'bonus' ? 'paid_bonus' : 'offset';
    if (settings.surplus_policy === 'bonus') {
      surplusBonus = round2(totalSurpluses * settings.surplus_bonus_rate);
    }
    for (const c of credits) resolutions.push({ id: c.id, status: creditStatus, resolved: true });
  }

  const manualDeductions = round2(input.deductionAmounts.reduce((s, a) => s + Number(a), 0));
  const totalDeductions = round2(manualDeductions + shortfallDeduction);
  const netPay = round2(grossPay + surplusBonus - totalDeductions);

  return {
    grossTakings,
    commissionRate: settings.commission_rate,
    grossPay,
    totalShortfalls,
    totalSurpluses,
    netBalance,
    shortfallDeduction,
    surplusBonus,
    manualDeductions,
    totalDeductions,
    netPay,
    resolutions,
  };
}
