import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, font, radius, spacing, type } from '@/lib/theme';

export type BarDatum = {
  key: string;
  /** Short axis label, e.g. "25/06". Only first/last are drawn. */
  label: string;
  value: number;
};

type Props = {
  data: BarDatum[];
  height?: number;
  formatValue: (value: number) => string;
};

/**
 * Single-series bar chart, native Views only.
 * Mark spec: thin bars, 4px rounded data-ends on the baseline, 2px gaps,
 * recessive grid, tap-to-inspect with a direct label (no hover on native).
 */
export function BarChart({ data, height = 140, formatValue }: Props) {
  const [selectedKey, setSelectedKey] = useState<string | null>(
    data.length > 0 ? data[data.length - 1].key : null,
  );

  if (data.length === 0) return null;

  const max = Math.max(...data.map((d) => d.value), 1);
  const selected = data.find((d) => d.key === selectedKey) ?? data[data.length - 1];

  return (
    <View>
      {/* Direct label for the inspected bar */}
      <View style={styles.tooltipRow}>
        <Text style={styles.tooltipValue}>{formatValue(selected.value)}</Text>
        <Text style={type.caption}>{selected.label}</Text>
      </View>

      <View style={[styles.plot, { height }]}>
        {/* Recessive max gridline */}
        <View style={styles.gridTop}>
          <Text style={styles.gridLabel}>{formatValue(max)}</Text>
        </View>
        <View style={styles.bars}>
          {data.map((d) => {
            const h = Math.max(Math.round((d.value / max) * (height - 24)), d.value > 0 ? 3 : 0);
            const active = d.key === selected.key;
            return (
              <Pressable
                key={d.key}
                onPress={() => setSelectedKey(d.key)}
                style={styles.barHit}
                accessibilityLabel={`${d.label}: ${formatValue(d.value)}`}
              >
                <View
                  style={[
                    styles.bar,
                    { height: h },
                    active && styles.barActive,
                    d.value === 0 && styles.barZero,
                  ]}
                />
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Baseline + first/last axis labels */}
      <View style={styles.baseline} />
      <View style={styles.axisRow}>
        <Text style={styles.gridLabel}>{data[0].label}</Text>
        <Text style={styles.gridLabel}>{data[data.length - 1].label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tooltipRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  tooltipValue: {
    fontFamily: font.extrabold,
    fontSize: 20,
    color: colors.text,
  },
  plot: {
    justifyContent: 'flex-end',
  },
  gridTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    alignItems: 'flex-end',
  },
  gridLabel: {
    fontFamily: font.medium,
    fontSize: 10,
    color: colors.textMuted,
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
  barHit: {
    flex: 1,
    alignItems: 'stretch',
    justifyContent: 'flex-end',
    minHeight: 24, // tap target taller than tiny bars
  },
  bar: {
    backgroundColor: colors.chart,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  barActive: {
    backgroundColor: colors.chartEmphasis,
  },
  barZero: {
    height: 2,
    backgroundColor: colors.border,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  baseline: {
    height: 1.5,
    backgroundColor: colors.borderStrong,
    borderRadius: 1,
  },
  axisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xxs,
  },
});
