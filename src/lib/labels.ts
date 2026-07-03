import type { BadgeTone } from '@/components/ui';
import type { DriverStatus, VehicleClass, VehicleStatus } from '@/types/db';

export const VEHICLE_STATUS: Record<VehicleStatus, { label: string; tone: BadgeTone }> = {
  active: { label: 'Active', tone: 'success' },
  in_service: { label: 'In service', tone: 'info' },
  off_road: { label: 'Off road', tone: 'warning' },
  retired: { label: 'Retired', tone: 'neutral' },
};

export const DRIVER_STATUS: Record<DriverStatus, { label: string; tone: BadgeTone }> = {
  active: { label: 'Active', tone: 'success' },
  inactive: { label: 'Inactive', tone: 'neutral' },
  suspended: { label: 'Suspended', tone: 'danger' },
};

export const VEHICLE_CLASS: Record<VehicleClass, string> = {
  standard: 'Standard',
  new: 'Newer',
};

/** The 22 provinces of Papua New Guinea. */
export const PNG_PROVINCES = [
  'Bougainville (AROB)',
  'Central',
  'Chimbu (Simbu)',
  'East New Britain',
  'East Sepik',
  'Eastern Highlands',
  'Enga',
  'Gulf',
  'Hela',
  'Jiwaka',
  'Madang',
  'Manus',
  'Milne Bay',
  'Morobe',
  'National Capital District',
  'New Ireland',
  'Northern (Oro)',
  'Southern Highlands',
  'West New Britain',
  'West Sepik (Sandaun)',
  'Western',
  'Western Highlands',
] as const;

export function titleCase(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

export function initialsOf(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}
