import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedPressable } from '@/components/animated-pressable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Unit = 'ft' | 'm' | 'kadi';

const UNIT_LABELS: Record<Unit, string> = {
  ft: 'Feet',
  m: 'Meters',
  kadi: 'Kadi',
};


const ALL_UNITS: Unit[] = ['ft', 'm', 'kadi'];

// Linear conversion factors to meters
const TO_METER: Record<Unit, number> = {
  ft: 0.3048,
  m: 1,
  kadi: 0.4572,
};

function convertValue(value: number, from: Unit, to: Unit): number {
  const inMeters = value * TO_METER[from];
  return inMeters / TO_METER[to];
}

export default function ConverterScreen() {
  const theme = useTheme();
  const [value, setValue] = useState('');
  const [sourceUnit, setSourceUnit] = useState<Unit>('ft');
  const [isInputFocused, setIsInputFocused] = useState(false);

  const numVal = parseFloat(value);
  const isValid = !isNaN(numVal) && numVal > 0;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <ThemedText type="subtitle" style={styles.headerTitle}>
                Conversion Table
              </ThemedText>
              <View style={styles.badge}>
                <ThemedText type="code" style={styles.badgeText}>
                  v1.0
                </ThemedText>
              </View>
            </View>
            <ThemedText themeColor="textSecondary" style={styles.headerSubtitle}>
              Convert between Feet, Meters & Kadi
            </ThemedText>
          </View>

          {/* Source unit picker */}
          <View style={[styles.card, { borderColor: theme.borderStrong }]}>
            <ThemedText type="smallBold" style={[styles.cardTitle, { color: theme.textSecondary, alignSelf: 'center' }]}>
              Select Unit
            </ThemedText>
            <View style={[styles.unitRow, { backgroundColor: theme.backgroundElement, borderColor: theme.borderStrong }]}>
              {ALL_UNITS.map((u) => (
                <AnimatedPressable
                  key={u}
                  onPress={() => setSourceUnit(u)}
                  style={[
                    styles.unitBtn,
                    sourceUnit === u && { backgroundColor: theme.primary },
                  ]}
                >
                  <ThemedText
                    type="smallBold"
                    style={{
                      color: sourceUnit === u ? theme.onPrimary : theme.textSecondary,
                    }}
                  >
                    {UNIT_LABELS[u]}
                  </ThemedText>
                </AnimatedPressable>
              ))}
            </View>

            {/* Value input */}
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.backgroundElement,
                  color: theme.text,
                  borderColor: isInputFocused ? theme.primary : theme.borderStrong,
                  borderWidth: isInputFocused ? 1.5 : 1,
                },
              ]}
              value={value}
              onChangeText={setValue}
              placeholder={`Enter value in ${UNIT_LABELS[sourceUnit].toLowerCase()}`}
              placeholderTextColor={theme.textSecondary}
              keyboardType="decimal-pad"
              onFocus={() => setIsInputFocused(true)}
              onBlur={() => setIsInputFocused(false)}
            />

            {/* ⇣ icon */}
            {isValid && (
              <View style={styles.arrowContainer}>
                <SymbolView
                  name="arrow.down"
                  size={18}
                  tintColor={theme.primary}
                />
              </View>
            )}

            {/* Results */}
            <View style={styles.resultsSection}>
              {ALL_UNITS.map((u) => {
                const converted = isValid
                  ? convertValue(numVal, sourceUnit, u)
                  : 0;
                return (
                  <View
                    key={u}
                    style={[
                      styles.resultRow,
                      { borderColor: theme.borderStrong, borderWidth: 1 },
                      u === sourceUnit && {
                        backgroundColor: theme.backgroundSelected,
                        borderColor: theme.primary,
                        borderWidth: 1.5,
                      },
                    ]}
                  >
                    <View style={styles.resultLabelRow}>
                      <ThemedText
                        type="default"
                        style={u === sourceUnit ? { fontWeight: '700' } : undefined}
                      >
                        {UNIT_LABELS[u]}
                      </ThemedText>
                      {u === sourceUnit && (
                        <View style={[styles.sourceBadge, { backgroundColor: theme.primary }]}>
                          <ThemedText
                            type="code"
                            style={[styles.sourceBadgeText, { color: theme.onPrimary }]}
                          >
                            source
                          </ThemedText>
                        </View>
                      )}
                    </View>
                    <ThemedText
                      type="defaultSemiBold"
                      style={[
                        styles.resultValue,
                        {
                          color: isValid ? theme.text : theme.textSecondary,
                        },
                      ]}
                    >
                      {isValid ? converted.toFixed(4) : '—'}
                    </ThemedText>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Quick reference */}
          <View style={styles.card}>
            <ThemedText type="smallBold" style={styles.cardTitle}>
              Quick Reference
            </ThemedText>
            <View style={styles.refGrid}>
              <View style={styles.refRow}>
                <ThemedText type="default">1 Feet</ThemedText>
                <ThemedText type="defaultSemiBold" style={styles.refValue}>
                  0.3048 m
                </ThemedText>
              </View>
              <View style={styles.refRow}>
                <ThemedText type="default">1 Feet</ThemedText>
                <ThemedText type="defaultSemiBold" style={styles.refValue}>
                  0.6667 kadi
                </ThemedText>
              </View>
              <View style={styles.refRow}>
                <ThemedText type="default">1 Meter</ThemedText>
                <ThemedText type="defaultSemiBold" style={styles.refValue}>
                  3.2808 ft
                </ThemedText>
              </View>
              <View style={styles.refRow}>
                <ThemedText type="default">1 Meter</ThemedText>
                <ThemedText type="defaultSemiBold" style={styles.refValue}>
                  2.1872 kadi
                </ThemedText>
              </View>
              <View style={styles.refRow}>
                <ThemedText type="default">1 Kadi</ThemedText>
                <ThemedText type="defaultSemiBold" style={styles.refValue}>
                  1.5 ft
                </ThemedText>
              </View>
              <View style={styles.refRow}>
                <ThemedText type="default">1 Kadi</ThemedText>
                <ThemedText type="defaultSemiBold" style={styles.refValue}>
                  0.4572 m
                </ThemedText>
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.five,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
    gap: Spacing.four,
  },
  header: {
    gap: Spacing.one,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  headerTitle: {
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  badge: {
    backgroundColor: '#171717',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Spacing.two,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  card: {
    padding: Spacing.four,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.12)',
    gap: Spacing.three,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  unitRow: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 24,
    borderWidth: 1,
    width: '100%',
    maxWidth: 340,
    alignSelf: 'center',
  },
  unitBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '600',
  },
  arrowContainer: {
    alignItems: 'center',
    marginVertical: -Spacing.one,
  },
  resultsSection: {
    gap: Spacing.two,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderRadius: 12,
  },
  resultLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  sourceBadge: {
    backgroundColor: '#171717',
    paddingHorizontal: Spacing.two,
    paddingVertical: 1,
    borderRadius: Spacing.one,
  },
  sourceBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '700',
  },
  resultValue: {
    fontSize: 17,
  },
  refGrid: {
    gap: Spacing.two,
  },
  refRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.one,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128,128,128,0.08)',
  },
  refValue: {
  },
});
