import React, { useState } from 'react';
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
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { usePolygonStore } from '@/store/use-polygon-store';
import { PolygonCanvas } from '@/components/polygon-canvas';

const UNITS = ['cm', 'm', 'in', 'ft', 'mm'];

export default function PlotScreen() {
  const theme = useTheme();
  const [unit, setUnit] = useState<string>('ft');
  const [activeField, setActiveField] = useState<string | null>(null);

  const {
    sideCount,
    sideLengths,
    vertices,
    area,
    perimeter,
    angles,
    isValid,
    hasCalculated,
    error,
    setSideCount,
    updateSideLength,
    generateGeometry,
    reset,
  } = usePolygonStore();

  const handleIncrement = () => {
    if (sideCount < 20) {
      setSideCount(sideCount + 1);
    }
  };

  const handleDecrement = () => {
    if (sideCount > 3) {
      setSideCount(sideCount - 1);
    }
  };

  // Convert area to square meters, then convert to other standard units if needed
  const convertedAreaSqFt = () => {
    // Conversion factors to meters (then square to get area factor)
    const toMeter: Record<string, number> = {
      'mm': 0.001,
      'cm': 0.01,
      'in': 0.0254,
      'ft': 0.3048,
      'm': 1
    };
    const factor = toMeter[unit] || 1;
    const areaInSqM = area * (factor * factor);
    // Convert to sq ft
    return areaInSqM * 10.7639;
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <ThemedText type="subtitle" style={styles.headerTitle}>
                Polygon Plotter
              </ThemedText>
              <View style={styles.badge}>
                <ThemedText type="code" style={styles.badgeText}>
                  v1.0
                </ThemedText>
              </View>
            </View>
            <ThemedText themeColor="textSecondary" style={styles.headerSubtitle}>
              Define a custom polygon by specifying sides and lengths to view and calculate land boundaries.
            </ThemedText>
          </View>

          {/* Unit Selector */}
          <View style={styles.sectionHeader}>
            <ThemedText type="smallBold">Select Measurement Unit</ThemedText>
            <View style={styles.unitSelector}>
              {UNITS.map(u => (
                <Pressable
                  key={u}
                  onPress={() => setUnit(u)}
                  style={[
                    styles.unitButton,
                    unit === u && { backgroundColor: '#3c87f7' },
                  ]}
                >
                  <ThemedText
                    type="smallBold"
                    style={{ color: unit === u ? '#ffffff' : theme.textSecondary }}
                  >
                    {u}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Plot Definition Card */}
          <View style={styles.card}>
            <ThemedText type="smallBold" style={styles.cardTitle}>
              Plot Definition
            </ThemedText>
            <View style={styles.sideCountRow}>
              <View>
                <ThemedText type="defaultSemiBold">Number of Sides</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Min 3, Max 20 sides
                </ThemedText>
              </View>
              <View style={styles.counterContainer}>
                <Pressable
                  onPress={handleDecrement}
                  style={[styles.counterBtn, { backgroundColor: theme.backgroundSelected }]}
                  disabled={sideCount <= 3}
                >
                  <SymbolView name="minus" size={16} tintColor={theme.text} />
                </Pressable>
                <View style={styles.counterValueContainer}>
                  <ThemedText type="subtitle" style={styles.counterValue}>
                    {sideCount}
                  </ThemedText>
                </View>
                <Pressable
                  onPress={handleIncrement}
                  style={[styles.counterBtn, { backgroundColor: theme.backgroundSelected }]}
                  disabled={sideCount >= 20}
                >
                  <SymbolView name="plus" size={16} tintColor={theme.text} />
                </Pressable>
              </View>
            </View>
          </View>

          {/* Side Lengths Card */}
          <View style={styles.card}>
            <View style={styles.formHeaderRow}>
              <ThemedText type="smallBold" style={styles.cardTitle}>
                Side Lengths
              </ThemedText>
              <Pressable onPress={reset} style={styles.clearButton}>
                <ThemedText type="small" style={{ color: '#ff4d4f' }}>
                  Reset Inputs
                </ThemedText>
              </Pressable>
            </View>

            <View style={styles.inputsGrid}>
              {Object.keys(sideLengths).map((key) => (
                <View key={key} style={styles.inputContainer}>
                  <ThemedText type="smallBold" style={styles.inputLabel}>
                    Side {key}
                  </ThemedText>
                  <View style={styles.textInputWrapper}>
                    <TextInput
                      style={[
                        styles.textInput,
                        {
                          backgroundColor: theme.backgroundElement,
                          color: theme.text,
                          borderColor: activeField === key ? '#3c87f7' : theme.backgroundSelected,
                        },
                      ]}
                      value={sideLengths[key]}
                      onChangeText={(val) => updateSideLength(key, val)}
                      placeholder="10"
                      placeholderTextColor={theme.textSecondary}
                      keyboardType="decimal-pad"
                      onFocus={() => setActiveField(key)}
                      onBlur={() => setActiveField(null)}
                    />
                    <View style={styles.inputUnit}>
                      <ThemedText type="small" themeColor="textSecondary">
                        {unit}
                      </ThemedText>
                    </View>
                  </View>
                </View>
              ))}
            </View>

            <Pressable
              onPress={generateGeometry}
              style={({ pressed }) => [
                styles.generateBtn,
                pressed && { opacity: 0.85 },
              ]}
            >
              <ThemedText type="defaultSemiBold" style={styles.generateBtnText}>
                Generate Geometry
              </ThemedText>
            </Pressable>
          </View>

          {/* Geometry Result Card */}
          {hasCalculated && (
            <View style={[styles.card, { borderColor: isValid ? '#3c87f7' : '#ff4d4f', borderWidth: 1 }]}>
              <ThemedText type="smallBold" style={[styles.cardTitle, { color: isValid ? '#3c87f7' : '#ff4d4f' }]}>
                {isValid ? 'Geometry Calculation' : 'Validation Error'}
              </ThemedText>

              {isValid ? (
                <View style={styles.resultsContainer}>
                  {/* Visual Render Canvas */}
                  <PolygonCanvas
                    vertices={vertices}
                    sideLengths={sideLengths}
                    sideCount={sideCount}
                    activeField={activeField}
                    angles={angles}
                    unit={unit}
                  />

                  {/* Summary Rows */}
                  <View style={styles.summaryGrid}>
                    <View style={[styles.summaryCard, { backgroundColor: 'rgba(60, 135, 247, 0.05)' }]}>
                      <ThemedText type="small" themeColor="textSecondary">
                        Total Area
                      </ThemedText>
                      <ThemedText type="defaultSemiBold" style={styles.summaryValue}>
                        {area.toFixed(2)} {unit}²
                      </ThemedText>
                      {unit !== 'ft' && (
                        <ThemedText type="small" style={{ fontSize: 10, color: '#888', marginTop: 2 }}>
                          {convertedAreaSqFt().toFixed(2)} sq ft
                        </ThemedText>
                      )}
                    </View>

                    <View style={[styles.summaryCard, { backgroundColor: 'rgba(60, 135, 247, 0.05)' }]}>
                      <ThemedText type="small" themeColor="textSecondary">
                        Perimeter
                      </ThemedText>
                      <ThemedText type="defaultSemiBold" style={styles.summaryValue}>
                        {perimeter.toFixed(2)} {unit}
                      </ThemedText>
                    </View>
                  </View>

                  {/* Interior Angles */}
                  <View style={styles.anglesSection}>
                    <ThemedText type="smallBold" style={styles.sectionTitle}>
                      Interior Angles
                    </ThemedText>
                    <View style={styles.chipsContainer}>
                      {angles.map((ang, idx) => (
                        <View key={idx} style={[styles.chip, { backgroundColor: theme.backgroundSelected }]}>
                          <ThemedText type="smallBold" style={{ color: theme.text }}>
                            ∠{String.fromCharCode(65 + idx)} = {ang.toFixed(1)}°
                          </ThemedText>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
              ) : (
                <View style={styles.errorContainer}>
                  <SymbolView name="exclamationmark.triangle.fill" size={24} tintColor="#ff4d4f" />
                  <ThemedText style={styles.errorText}>
                    {error || 'Invalid shape configuration.'}
                  </ThemedText>
                </View>
              )}
            </View>
          )}
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
    paddingBottom: BottomTabInset + Spacing.five,
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
  sectionHeader: {
    gap: Spacing.two,
  },
  unitSelector: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  unitButton: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  card: {
    backgroundColor: 'transparent',
    borderRadius: Spacing.three,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
    gap: Spacing.three,
  },
  cardTitle: {
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sideCountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  counterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Spacing.two,
    overflow: 'hidden',
  },
  counterBtn: {
    width: 38,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
  },
  counterValueContainer: {
    width: 44,
    alignItems: 'center',
  },
  counterValue: {
    fontWeight: '700',
  },
  formHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  clearButton: {
    paddingVertical: Spacing.half,
  },
  inputsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  inputContainer: {
    width: '46%',
    flexGrow: 1,
    gap: Spacing.one,
  },
  inputLabel: {
    fontSize: 11,
  },
  textInputWrapper: {
    position: 'relative',
    justifyContent: 'center',
  },
  textInput: {
    height: 40,
    borderWidth: 1.5,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    fontSize: 14,
  },
  inputUnit: {
    position: 'absolute',
    right: 12,
    pointerEvents: 'none',
  },
  generateBtn: {
    backgroundColor: '#3c87f7',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  generateBtnText: {
    color: '#ffffff',
  },
  resultsContainer: {
    gap: Spacing.four,
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  summaryCard: {
    flex: 1,
    padding: Spacing.three,
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: 'rgba(60, 135, 247, 0.1)',
  },
  summaryValue: {
    marginTop: Spacing.one,
  },
  anglesSection: {
    gap: Spacing.two,
  },
  sectionTitle: {
    fontSize: 12,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  errorText: {
    color: '#ff4d4f',
    fontWeight: '700',
    flex: 1,
  },
});
