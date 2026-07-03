import { Banknote, ShieldAlert } from 'lucide-react-native';
import React from 'react';

import { Card, EmptyState, Screen } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { colors } from '@/lib/theme';

/** Placeholder — the fortnightly payroll engine ships in Phase 8. */
export default function PayrollScreen() {
  const { role } = useAuth();

  // Defense in depth: the tab is hidden for non-owners, and RLS blocks the
  // data — but never render payroll UI for them either.
  if (role !== 'owner') {
    return (
      <Screen title="Payroll">
        <Card padded={false}>
          <EmptyState
            icon={<ShieldAlert color={colors.textMuted} size={30} />}
            title="Owner only"
            message="Payroll is restricted to the owner account."
          />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen title="Payroll">
      <Card padded={false}>
        <EmptyState
          icon={<Banknote color={colors.textMuted} size={30} />}
          title="Fortnightly payroll"
          message="Gross takings → 29% commission → deductions → payslip. Coming in Phase 8."
        />
      </Card>
    </Screen>
  );
}
