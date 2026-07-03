import { CheckCircle2, CloudOff, RefreshCw } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text } from 'react-native';

import {
  discardQueued,
  flushQueue,
  subscribeQueue,
  type QueueState,
} from '@/lib/offlineQueue';
import { colors, font, radius, spacing } from '@/lib/theme';

/**
 * Sync status indicator: green when everything reached the server, amber
 * with a count while entries wait locally. Tap to sync now; long-press a
 * failure report to review/discard stuck entries.
 */
export function SyncChip() {
  const [state, setState] = useState<QueueState>({ pending: [], syncing: false });

  useEffect(() => subscribeQueue(setState), []);

  const failed = state.pending.filter((i) => i.lastError && !isNetworkMessage(i.lastError));
  const count = state.pending.length;

  if (count === 0) {
    return (
      <Pressable style={[styles.chip, styles.ok]} onPress={() => flushQueue()}>
        <CheckCircle2 size={14} color={colors.success} />
        <Text style={[styles.label, { color: colors.success }]}>Synced</Text>
      </Pressable>
    );
  }

  const showFailures = () => {
    if (failed.length === 0) {
      flushQueue();
      return;
    }
    const first = failed[0];
    Alert.alert(
      'Entry could not sync',
      `${first.lastError}\n\nEntry: ${first.key.replace('|', ' · ')}`,
      [
        { text: 'Keep & retry', onPress: () => flushQueue() },
        {
          text: 'Discard entry',
          style: 'destructive',
          onPress: () => discardQueued(first.key),
        },
      ],
    );
  };

  return (
    <Pressable style={[styles.chip, failed.length > 0 ? styles.bad : styles.wait]} onPress={showFailures}>
      {state.syncing ? (
        <ActivityIndicator size={12} color={colors.warning} />
      ) : failed.length > 0 ? (
        <CloudOff size={14} color={colors.danger} />
      ) : (
        <RefreshCw size={14} color={colors.warning} />
      )}
      <Text style={[styles.label, { color: failed.length > 0 ? colors.danger : colors.warning }]}>
        {failed.length > 0 ? `${failed.length} failed` : `${count} to sync`}
      </Text>
    </Pressable>
  );
}

function isNetworkMessage(message: string): boolean {
  return /network|fetch|timeout|timed out|abort|socket|ENOTFOUND|ECONN/i.test(message);
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  ok: {
    backgroundColor: colors.successSoft,
  },
  wait: {
    backgroundColor: colors.warningSoft,
  },
  bad: {
    backgroundColor: colors.dangerSoft,
  },
  label: {
    fontFamily: font.semibold,
    fontSize: 12,
  },
});
