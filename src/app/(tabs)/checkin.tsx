import { ClipboardCheck } from 'lucide-react-native';
import React from 'react';

import { Card, EmptyState, Screen } from '@/components/ui';
import { colors } from '@/lib/theme';

/** Placeholder — the 11pm quick-entry workflow ships in Phase 6. */
export default function CheckinScreen() {
  return (
    <Screen title="Check-in">
      <Card padded={false}>
        <EmptyState
          icon={<ClipboardCheck color={colors.textMuted} size={30} />}
          title="11pm check-in"
          message="The nightly takings quick-entry list is coming in Phase 6."
        />
      </Card>
    </Screen>
  );
}
