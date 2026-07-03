/**
 * Service due logic — spec: every 3 months OR 5,000 km, whichever first.
 * next_due_date / next_due_odometer are set by a DB trigger on each
 * service record; this module only interprets them for display.
 */
import type { BadgeTone } from '@/components/ui';
import { daysUntil } from '@/lib/alerts';
import type { ServiceRecord, Vehicle } from '@/types/db';

export type ServiceState = {
  label: string;
  tone: BadgeTone;
  /** True when due within 14 days / 500 km, or overdue. */
  needsAttention: boolean;
};

export function serviceState(vehicle: Vehicle, last: ServiceRecord | null): ServiceState {
  if (!last) {
    return { label: 'No service on record', tone: 'warning', needsAttention: true };
  }
  const daysLeft = last.next_due_date ? daysUntil(last.next_due_date) : null;
  const kmLeft =
    last.next_due_odometer !== null ? last.next_due_odometer - vehicle.odometer_current : null;

  const overdue = (daysLeft !== null && daysLeft < 0) || (kmLeft !== null && kmLeft < 0);
  if (overdue) {
    const by =
      kmLeft !== null && kmLeft < 0
        ? `${Math.abs(kmLeft).toLocaleString('en-US')} km`
        : `${Math.abs(daysLeft ?? 0)}d`;
    return { label: `Overdue by ${by}`, tone: 'danger', needsAttention: true };
  }

  const dueSoon = (daysLeft !== null && daysLeft <= 14) || (kmLeft !== null && kmLeft <= 500);
  if (dueSoon) {
    const in_ =
      kmLeft !== null && kmLeft <= 500
        ? `${kmLeft.toLocaleString('en-US')} km`
        : `${daysLeft}d`;
    return { label: `Due in ${in_}`, tone: 'warning', needsAttention: true };
  }

  return {
    label:
      kmLeft !== null && daysLeft !== null
        ? `OK · ${daysLeft}d / ${kmLeft.toLocaleString('en-US')} km left`
        : 'OK',
    tone: 'success',
    needsAttention: false,
  };
}
