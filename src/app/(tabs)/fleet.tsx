import { CarFront } from 'lucide-react-native';
import React from 'react';

import { Card, EmptyState, Screen } from '@/components/ui';
import { colors } from '@/lib/theme';

/** Placeholder — vehicles (Phase 4) and drivers (Phase 5) land here. */
export default function FleetScreen() {
  return (
    <Screen title="Fleet">
      <Card padded={false}>
        <EmptyState
          icon={<CarFront color={colors.textMuted} size={30} />}
          title="Vehicles & drivers"
          message="Fleet management is coming in Phases 4–5."
        />
      </Card>
    </Screen>
  );
}
