/**
 * Row types mirroring supabase/migrations/00001_schema.sql.
 * Keep in sync when the schema changes.
 */

export type UserRole = 'owner' | 'supervisor' | 'driver';
export type VehicleClass = 'standard' | 'new';
export type VehicleStatus = 'active' | 'in_service' | 'off_road' | 'retired';
export type DriverStatus = 'active' | 'inactive' | 'suspended';
export type CheckinStatus = 'on_time' | 'late' | 'missed';
export type LedgerEntryType = 'shortfall' | 'surplus';
export type LedgerStatus = 'outstanding' | 'offset' | 'deducted' | 'paid_bonus' | 'waived' | 'carried';
export type DeductionType = 'fuel' | 'advance' | 'fine' | 'repair' | 'shortfall' | 'other';
export type PayPeriodStatus = 'open' | 'finalised' | 'paid';
export type DowntimeReason = 'service' | 'accident' | 'other';
export type DocOwnerType = 'vehicle' | 'driver';
export type DocType = 'registration' | 'safety_sticker' | 'mvil_insurance' | 'drivers_license' | 'taxi_permit';
export type IncidentType = 'accident' | 'fine' | 'damage' | 'theft' | 'other';
export type ShortfallPolicy = 'deduct' | 'carry_forward' | 'flag_only';
export type SurplusPolicy = 'offset' | 'pay_through' | 'bonus';

export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  phone: string | null;
  created_at: string;
}

export interface Vehicle {
  id: string;
  plate_no: string;
  make: string;
  model: string;
  year: number | null;
  vehicle_class: VehicleClass;
  daily_target: number;
  odometer_current: number;
  status: VehicleStatus;
  photo_url: string | null;
  engine_no: string | null;
  created_at: string;
  updated_at: string;
}

export interface Driver {
  id: string;
  full_name: string;
  phone: string | null;
  license_no: string | null;
  license_expiry: string | null;
  status: DriverStatus;
  date_started: string | null;
  user_id: string | null;
  photo_url: string | null;
  license_photo_url: string | null;
  province: string | null;
  residence: string | null;
  created_at: string;
  updated_at: string;
}

export interface Assignment {
  id: string;
  driver_id: string;
  vehicle_id: string;
  start_date: string;
  end_date: string | null;
  created_at: string;
}

export interface DailyTakings {
  id: string;
  date: string;
  driver_id: string;
  vehicle_id: string;
  is_relief_driver: boolean;
  amount_declared: number;
  amount_received: number;
  variance: number;
  /** null = target suppressed (vehicle downtime). */
  target_amount: number | null;
  target_met: boolean | null;
  shortfall_amount: number;
  surplus_amount: number;
  odometer_reading: number | null;
  checkin_time: string | null;
  checkin_status: CheckinStatus;
  notes: string | null;
  entered_by: string | null;
  locked: boolean;
  unlocked_until: string | null;
  unlocked_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BalanceLedgerEntry {
  id: string;
  driver_id: string;
  vehicle_id: string;
  takings_id: string | null;
  date: string;
  entry_type: LedgerEntryType;
  amount: number;
  status: LedgerStatus;
  offset_against_id: string | null;
  resolved_in_pay_period_id: string | null;
  created_at: string;
}

export interface Deduction {
  id: string;
  driver_id: string;
  pay_period_id: string | null;
  type: DeductionType;
  amount: number;
  date: string;
  description: string | null;
  entered_by: string | null;
  created_at: string;
}

export interface PayPeriod {
  id: string;
  driver_id: string;
  period_start: string;
  period_end: string;
  gross_takings: number;
  commission_rate: number;
  gross_pay: number;
  total_shortfalls: number;
  total_surpluses: number;
  net_balance: number;
  shortfall_deduction: number;
  surplus_bonus: number;
  total_deductions: number;
  net_pay: number;
  status: PayPeriodStatus;
  paid_date: string | null;
  payslip_url: string | null;
  finalised_at: string | null;
  finalised_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ServiceRecord {
  id: string;
  vehicle_id: string;
  service_date: string;
  odometer_at_service: number;
  cost: number;
  workshop: string | null;
  notes: string | null;
  next_due_date: string | null;
  next_due_odometer: number | null;
  created_at: string;
}

export interface DowntimeLog {
  id: string;
  vehicle_id: string;
  start_date: string;
  end_date: string | null;
  reason: DowntimeReason;
  notes: string | null;
  created_at: string;
}

export interface ComplianceDoc {
  id: string;
  owner_type: DocOwnerType;
  vehicle_id: string | null;
  driver_id: string | null;
  doc_type: DocType;
  issue_date: string | null;
  expiry_date: string;
  reference_no: string | null;
  document_url: string | null;
  created_at: string;
}

export interface Incident {
  id: string;
  vehicle_id: string;
  driver_id: string | null;
  date: string;
  type: IncidentType;
  description: string | null;
  cost: number;
  police_report_no: string | null;
  photos: string[];
  deduction_id: string | null;
  created_at: string;
}

export interface AppSettings {
  id: number;
  commission_rate: number;
  target_standard: number;
  target_new: number;
  shortfall_policy: ShortfallPolicy;
  surplus_policy: SurplusPolicy;
  surplus_bonus_rate: number;
  carry_forward_balance: boolean;
  checkin_time: string;
  checkin_grace_minutes: number;
  alert_days: number[];
  pay_period_anchor: string;
  updated_at: string;
}
