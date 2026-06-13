import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';

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

const UNIT_ABBR: Record<Unit, string> = {
  ft: 'ft',
  m: 'm',
  kadi: 'kadi',
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
          <View style={styles.card}>
            <ThemedText type="smallBold" style={styles.cardTitle}>
              Select Unit
            </ThemedText>
            <View style={styles.unitRow}>
              {ALL_UNITS.map((u) => (
                <Pressable
                  key={u}
                  onPress={() => setSourceUnit(u)}
                  style={[
                    styles.unitBtn,
                    sourceUnit === u && { backgroundColor: '#3c87f7' },
                  ]}
                >
                  <ThemedText
                    type="smallBold"
                    style={{
                      color: sourceUnit === u ? '#ffffff' : theme.textSecondary,
                    }}
                  >
                    {UNIT_LABELS[u]}
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            {/* Value input */}
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.backgroundElement,
                  color: theme.text,
                  borderColor: theme.backgroundSelected,
                },
              ]}
              value={value}
              onChangeText={setValue}
              placeholder={`Enter value in ${UNIT_LABELS[sourceUnit].toLowerCase()}`}
              placeholderTextColor={theme.textSecondary}
              keyboardType="decimal-pad"
            />

            {/* ⇣ icon */}
            {isValid && (
              <View style={styles.arrowContainer}>
                <SymbolView
                  name="arrow.down"
                  size={18}
                  tintColor="#3c87f7"
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
                      u === sourceUnit && {
                        backgroundColor: 'rgba(60, 135, 247, 0.06)',
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
                        <View style={styles.sourceBadge}>
                          <ThemedText
                            type="code"
                            style={styles.sourceBadgeText}
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
                          color: isValid ? '#3c87f7' : theme.textSecondary,
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
    backgroundColor: '#3c87f7',
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
    borderRadius: Spacing.four,
    borderWidth: 1.5,
    borderColor: 'rgba(128,128,128,0.15)',
    gap: Spacing.three,
  },
  cardTitle: {
    fontSize: 14,
    opacity: 0.8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  unitRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  unitBtn: {
    flex: 1,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  input: {
    height: 48,
    borderWidth: 1.5,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    fontSize: 18,
    textAlign: 'center',
    fontWeight: '600',
  },
  arrowContainer: {
    alignItems: 'center',
    marginVertical: -Spacing.one,
  },
  resultsSection: {
    gap: Spacing.one,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
  },
  resultLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  sourceBadge: {
    backgroundColor: '#3c87f7',
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
    color: '#3c87f7',
  },
});
