/**
 * Payroll persistence + payslip PDF. All money math comes from the pure,
 * tested functions in lib/payroll.ts — this file only loads inputs,
 * writes results, and renders the payslip.
 */
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import { Platform } from 'react-native';

import { formatDate, formatDateLong, formatName, formatPGK } from '@/lib/format';
import { computePayroll, type PayrollComputation, type Period } from '@/lib/payroll';
import { supabase } from '@/lib/supabase';
import type {
  AppSettings,
  BalanceLedgerEntry,
  Deduction,
  Driver,
  PayPeriod,
} from '@/types/db';

export type DriverPayrollData = {
  driver: Driver;
  existing: PayPeriod | null;
  takings: { date: string; amount_received: number }[];
  ledgerEntries: BalanceLedgerEntry[];
  carriedEntries: BalanceLedgerEntry[];
  /** Unapplied deductions (open period) or the period's applied ones (finalised). */
  deductions: Deduction[];
  computation: PayrollComputation;
};

/** Load one driver's payroll inputs for a period and compute the numbers. */
export async function loadDriverPayroll(
  driverId: string,
  period: Period,
  settings: AppSettings,
): Promise<{ data: DriverPayrollData | null; error: string | null }> {
  const [d, pp, t, l, c] = await Promise.all([
    supabase.from('drivers').select('*').eq('id', driverId).single(),
    supabase
      .from('pay_periods')
      .select('*')
      .eq('driver_id', driverId)
      .eq('period_start', period.start)
      .maybeSingle(),
    supabase
      .from('daily_takings')
      .select('date, amount_received')
      .eq('driver_id', driverId)
      .gte('date', period.start)
      .lte('date', period.end)
      .order('date'),
    supabase
      .from('balance_ledger')
      .select('*')
      .eq('driver_id', driverId)
      .eq('status', 'outstanding')
      .gte('date', period.start)
      .lte('date', period.end),
    settings.carry_forward_balance
      ? supabase
          .from('balance_ledger')
          .select('*')
          .eq('driver_id', driverId)
          .eq('status', 'carried')
          .lt('date', period.start)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const existing = (pp.data as PayPeriod | null) ?? null;

  const ded = existing
    ? await supabase.from('deductions').select('*').eq('pay_period_id', existing.id)
    : await supabase
        .from('deductions')
        .select('*')
        .eq('driver_id', driverId)
        .is('pay_period_id', null)
        .lte('date', period.end);

  const error = d.error ?? pp.error ?? t.error ?? l.error ?? c.error ?? ded.error;
  if (error) return { data: null, error: error.message };

  const takings = (t.data ?? []) as DriverPayrollData['takings'];
  const ledgerEntries = (l.data ?? []) as BalanceLedgerEntry[];
  const carriedEntries = (c.data ?? []) as BalanceLedgerEntry[];
  const deductions = (ded.data ?? []) as Deduction[];

  const computation = existing
    ? storedComputation(existing, deductions)
    : computePayroll({
        takingsAmounts: takings.map((x) => Number(x.amount_received)),
        ledgerEntries,
        carriedEntries,
        deductionAmounts: deductions.map((x) => Number(x.amount)),
        settings,
      });

  return {
    data: {
      driver: d.data as Driver,
      existing,
      takings,
      ledgerEntries,
      carriedEntries,
      deductions,
      computation,
    },
    error: null,
  };
}

/** Finalised periods show their snapshotted numbers, never a recompute. */
function storedComputation(p: PayPeriod, deductions: Deduction[]): PayrollComputation {
  return {
    grossTakings: Number(p.gross_takings),
    commissionRate: Number(p.commission_rate),
    grossPay: Number(p.gross_pay),
    totalShortfalls: Number(p.total_shortfalls),
    totalSurpluses: Number(p.total_surpluses),
    netBalance: Number(p.net_balance),
    shortfallDeduction: Number(p.shortfall_deduction),
    surplusBonus: Number(p.surplus_bonus),
    manualDeductions: deductions.reduce((s, d) => s + Number(d.amount), 0),
    totalDeductions: Number(p.total_deductions),
    netPay: Number(p.net_pay),
    resolutions: [],
  };
}

/**
 * Finalise: snapshot the numbers into pay_periods, resolve ledger entries,
 * attach deductions. Owner-only (enforced by RLS); every write is audited.
 */
export async function finalisePeriod(
  data: DriverPayrollData,
  period: Period,
  settings: AppSettings,
  userId: string | null,
): Promise<{ payPeriod: PayPeriod | null; error: string | null }> {
  const comp = data.computation;

  const { data: inserted, error: insErr } = await supabase
    .from('pay_periods')
    .upsert(
      {
        driver_id: data.driver.id,
        period_start: period.start,
        period_end: period.end,
        gross_takings: comp.grossTakings,
        commission_rate: settings.commission_rate,
        gross_pay: comp.grossPay,
        total_shortfalls: comp.totalShortfalls,
        total_surpluses: comp.totalSurpluses,
        net_balance: comp.netBalance,
        shortfall_deduction: comp.shortfallDeduction,
        surplus_bonus: comp.surplusBonus,
        total_deductions: comp.totalDeductions,
        net_pay: comp.netPay,
        status: 'finalised',
        finalised_at: new Date().toISOString(),
        finalised_by: userId,
      },
      { onConflict: 'driver_id,period_start' },
    )
    .select()
    .single();
  if (insErr) return { payPeriod: null, error: insErr.message };
  const payPeriod = inserted as PayPeriod;

  // Resolve ledger entries by status group.
  const groups = new Map<string, { ids: string[]; resolved: boolean }>();
  for (const r of comp.resolutions) {
    const g = groups.get(r.status) ?? { ids: [], resolved: r.resolved };
    g.ids.push(r.id);
    groups.set(r.status, g);
  }
  for (const [status, g] of groups) {
    const { error } = await supabase
      .from('balance_ledger')
      .update({
        status,
        resolved_in_pay_period_id: g.resolved ? payPeriod.id : null,
      })
      .in('id', g.ids);
    if (error) return { payPeriod, error: `Ledger update failed: ${error.message}` };
  }

  // Attach the manual deductions that were included.
  if (data.deductions.length > 0 && !data.existing) {
    const { error } = await supabase
      .from('deductions')
      .update({ pay_period_id: payPeriod.id })
      .in('id', data.deductions.map((x) => x.id));
    if (error) return { payPeriod, error: `Deduction update failed: ${error.message}` };
  }

  return { payPeriod, error: null };
}

export async function markPaid(payPeriodId: string): Promise<string | null> {
  const { error } = await supabase
    .from('pay_periods')
    .update({ status: 'paid', paid_date: new Date().toISOString().slice(0, 10) })
    .eq('id', payPeriodId);
  return error ? error.message : null;
}

// ---------------------------------------------------------------- payslip

export function payslipHTML(input: {
  driver: Driver;
  period: Period;
  comp: PayrollComputation;
  deductions: Deduction[];
  daysWorked: number;
  status: string;
  paidDate: string | null;
}): string {
  const { driver, period, comp, deductions, daysWorked } = input;
  const row = (label: string, value: string, cls = '') =>
    `<tr class="${cls}"><td>${label}</td><td class="num">${value}</td></tr>`;

  const deductionRows = deductions
    .map((d) =>
      row(
        `&nbsp;&nbsp;${d.type.charAt(0).toUpperCase() + d.type.slice(1)}${d.description ? ` — ${d.description}` : ''} (${formatDate(d.date)})`,
        `− ${formatPGK(Number(d.amount))}`,
      ),
    )
    .join('');

  return `<!doctype html><html><head><meta charset="utf-8"><style>
  body { font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; color: #101828; margin: 0; padding: 32px; }
  .head { background: #0B1220; color: #fff; border-radius: 14px; padding: 24px 28px; display: flex; justify-content: space-between; align-items: center; }
  .head h1 { margin: 0; font-size: 22px; } .head .sub { color: rgba(255,255,255,0.7); font-size: 12px; margin-top: 4px; }
  .badge { background: #F5A524; color: #231303; font-weight: 700; border-radius: 999px; padding: 6px 14px; font-size: 12px; text-transform: uppercase; }
  .meta { display: flex; gap: 32px; margin: 22px 4px; font-size: 13px; }
  .meta b { display: block; font-size: 15px; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 14px; }
  td { padding: 9px 10px; border-bottom: 1px solid #E3E8F0; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  tr.section td { font-weight: 700; background: #F4F6FA; }
  tr.total td { font-weight: 800; font-size: 17px; border-top: 2px solid #101828; border-bottom: none; }
  .sig { display: flex; gap: 48px; margin-top: 56px; }
  .sig div { flex: 1; border-top: 1px solid #98A2B3; padding-top: 6px; font-size: 12px; color: #5B6779; }
  .foot { margin-top: 28px; font-size: 11px; color: #8B96A8; }
  </style></head><body>
  <div class="head">
    <div><h1>Payslip · Safeco Taxi Service</h1><div class="sub">Port Moresby · Built by Skyworks Systems © 2026</div></div>
    <div class="badge">${input.status}</div>
  </div>
  <div class="meta">
    <div>Driver<b>${formatName(driver.full_name)}</b></div>
    <div>Pay period<b>${formatDate(period.start)} – ${formatDate(period.end)}</b></div>
    <div>Days worked<b>${daysWorked}</b></div>
    ${input.paidDate ? `<div>Paid<b>${formatDate(input.paidDate)}</b></div>` : ''}
  </div>
  <table>
    ${row('Gross takings (cash received)', formatPGK(comp.grossTakings), 'section')}
    ${row(`Commission @ ${(comp.commissionRate * 100).toFixed(0)}%`, formatPGK(comp.grossPay))}
    ${comp.surplusBonus > 0 ? row('Surplus bonus', `+ ${formatPGK(comp.surplusBonus)}`) : ''}
    ${row('Target balance', '', 'section')}
    ${row('&nbsp;&nbsp;Surpluses (days over target)', formatPGK(comp.totalSurpluses))}
    ${row('&nbsp;&nbsp;Shortfalls (days under target)', `− ${formatPGK(comp.totalShortfalls)}`)}
    ${row('&nbsp;&nbsp;Net balance', formatPGK(comp.netBalance))}
    ${row('Deductions', '', 'section')}
    ${comp.shortfallDeduction > 0 ? row('&nbsp;&nbsp;Net shortfall deduction', `− ${formatPGK(comp.shortfallDeduction)}`) : ''}
    ${deductionRows || row('&nbsp;&nbsp;None', '')}
    ${row('NET PAY', formatPGK(comp.netPay), 'total')}
  </table>
  <div class="sig"><div>Driver signature</div><div>Owner signature</div></div>
  <div class="foot">Generated ${formatDateLong(new Date())} · Safeco Taxi Service</div>
  </body></html>`;
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Render the payslip PDF, upload it to private storage
 * (payslips/{driver_id}/{period_start}.pdf) and record the path.
 * Returns the local file URI for immediate sharing.
 * On web there is no printToFileAsync — opens the print dialog instead.
 */
export async function generateAndUploadPayslip(input: {
  html: string;
  driverId: string;
  periodStart: string;
  payPeriodId: string;
}): Promise<{ localUri: string | null; error: string | null }> {
  if (Platform.OS === 'web') {
    await Print.printAsync({ html: input.html });
    return { localUri: null, error: null };
  }

  const { uri } = await Print.printToFileAsync({ html: input.html });

  try {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const path = `${input.driverId}/${input.periodStart}.pdf`;
    const { error: upErr } = await supabase.storage
      .from('payslips')
      .upload(path, base64ToBytes(base64), {
        contentType: 'application/pdf',
        upsert: true,
      });
    if (upErr) return { localUri: uri, error: `Upload failed: ${upErr.message}` };

    const { error: linkErr } = await supabase
      .from('pay_periods')
      .update({ payslip_url: path })
      .eq('id', input.payPeriodId);
    if (linkErr) return { localUri: uri, error: linkErr.message };

    return { localUri: uri, error: null };
  } catch (err) {
    return { localUri: uri, error: err instanceof Error ? err.message : String(err) };
  }
}
