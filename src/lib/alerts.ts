/**
 * Expiry countdown helpers — compliance docs, licenses, service due.
 * Alert tiers (spec): 30 / 14 / 7 days before expiry.
 */
import { differenceInCalendarDays, parseISO } from 'date-fns';

import type { BadgeTone } from '@/components/ui';
import { formatDate } from '@/lib/format';

export function daysUntil(dateISO: string, from: Date = new Date()): number {
  return differenceInCalendarDays(parseISO(dateISO), from);
}

/** danger: overdue or ≤7 days · warning: ≤30 days · success otherwise. */
export function toneForDays(days: number): BadgeTone {
  if (days <= 7) return 'danger';
  if (days <= 30) return 'warning';
  return 'success';
}

/** "Expired 3 days ago" · "Due today" · "12 days left" · "Valid · 25/12/2026" */
export function expiryLabel(dateISO: string): string {
  const days = daysUntil(dateISO);
  if (days < 0) return `Expired ${Math.abs(days)}d ago`;
  if (days === 0) return 'Expires today';
  if (days <= 30) return `${days}d left`;
  return `Valid · ${formatDate(dateISO)}`;
}

export const DOC_TYPE_LABELS: Record<string, string> = {
  registration: 'Registration',
  safety_sticker: 'Safety sticker',
  mvil_insurance: 'MVIL insurance',
  drivers_license: "Driver's license",
  taxi_permit: 'Taxi permit',
};
