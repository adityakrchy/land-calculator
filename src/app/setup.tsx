import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Defs, RadialGradient, Stop, Rect } from 'react-native-svg';

import { AnimatedPressable } from '@/components/animated-pressable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ShapeType = string;

const UNIT_OPTIONS = [
  { label: 'Kadi', value: 'kadi' },
  { label: 'Feet', value: 'ft' },
  { label: 'Meter', value: 'm' },
];

const HAND_UNITS = ['Standard', '4 hand (6 ft)', '4.5 hand (6.75 ft)', '5 hand (7.5 ft)', '5.5 hand (8.25 ft)', '6 hand (9 ft)', '6.5 hand (9.75 ft)', '7 hand (10.5 ft)', '7.5 hand (11.25 ft)', '8 hand (12 ft)', '8.5 hand (12.75 ft)', '9 hand (13.5 ft)', '9.5 hand (14.25 ft)', '10 hand (15 ft)', 'Custom'];

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman & Nicobar', 'Chandigarh', 'Dadra & Nagar Haveli',
  'Daman & Diu', 'Delhi', 'Jammu & Kashmir', 'Ladakh',
  'Lakshadweep', 'Puducherry',
];

interface ShapeOption {
  type: ShapeType;
  label: string;
  icon: (color: string) => React.ReactNode;
}

const SHAPES: ShapeOption[] = [
  {
    type: 'triangle',
    label: 'Triangle',
    icon: (color) => (
      <View style={{ width: 0, height: 0, borderLeftWidth: 18, borderRightWidth: 18, borderBottomWidth: 32, borderBottomColor: color, borderLeftColor: 'transparent', borderRightColor: 'transparent', backgroundColor: 'transparent' }} />
    ),
  },
  {
    type: 'right-angled-triangle',
    label: 'Right Triangle',
    icon: (color) => (
      <Svg width="36" height="28" viewBox="0 0 36 28">
        <Path d="M 4 24 L 32 24 L 4 4 Z" stroke={color} strokeWidth="2" fill="none" strokeLinejoin="round" />
      </Svg>
    ),
  },
  {
    type: 'scalene-triangle',
    label: 'Scalene Triangle',
    icon: (color) => (
      <Svg width="36" height="28" viewBox="0 0 36 28">
        <Path d="M 2 24 L 34 22 L 18 4 Z" stroke={color} strokeWidth="2" fill="none" strokeLinejoin="round" />
      </Svg>
    ),
  },
  {
    type: 'quadrilateral',
    label: 'Quadrilateral',
    icon: (color) => (
      <Svg width="36" height="28" viewBox="0 0 36 28">
        <Path d="M 6 22 L 30 20 L 26 6 L 8 8 Z" stroke={color} strokeWidth="2" fill="none" strokeLinejoin="round" />
      </Svg>
    ),
  },
  {
    type: 'polygon',
    label: 'Polygon',
    icon: (color) => (
      <View style={{ width: 32, height: 28, justifyContent: 'center', alignItems: 'center' }}>
        <View style={{ width: 30, height: 26, borderWidth: 2, borderColor: color, borderRadius: 1, transform: [{ rotate: '18deg' }] }} />
      </View>
    ),
  },
  {
    type: 'circle',
    label: 'Circle',
    icon: (color) => (
      <View style={{ width: 30, height: 30, borderWidth: 2, borderColor: color, borderRadius: 15 }} />
    ),
  },
];

export default function SetupScreen() {
  const theme = useTheme();
  const [selectedUnit, setSelectedUnit] = useState<string>('ft');
  const [selectedShape, setSelectedShape] = useState<ShapeType>('triangle');
  const [selectedState, setSelectedState] = useState<string>('');
  const [showStatePicker, setShowStatePicker] = useState(false);
  const [selectedHandUnit, setSelectedHandUnit] = useState<string>('');
  const [showHandUnitPicker, setShowHandUnitPicker] = useState(false);
  const [customDhurSqFt, setCustomDhurSqFt] = useState<string>('');
  const [validationError, setValidationError] = useState<string>('');
  const [loaded, setLoaded] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);

  // Load saved preferences on mount
  useEffect(() => {
    (async () => {
      try {
        const savedState = await SecureStore.getItemAsync('pref_state');
        const savedHandUnit = await SecureStore.getItemAsync('pref_hand_unit');
        const savedCustomDhur = await SecureStore.getItemAsync('pref_custom_dhur_sqft');
        if (savedState) setSelectedState(savedState);
        if (savedHandUnit) setSelectedHandUnit(savedHandUnit);
        if (savedCustomDhur) setCustomDhurSqFt(savedCustomDhur);
      } catch { }
      setLoaded(true);
    })();
  }, []);

  // Persist selections when they change
  useEffect(() => {
    if (!loaded) return;
    SecureStore.setItemAsync('pref_state', selectedState).catch(() => { });
  }, [selectedState, loaded]);

  useEffect(() => {
    if (!loaded) return;
    SecureStore.setItemAsync('pref_hand_unit', selectedHandUnit).catch(() => { });
  }, [selectedHandUnit, loaded]);

  useEffect(() => {
    if (!loaded) return;
    SecureStore.setItemAsync('pref_custom_dhur_sqft', customDhurSqFt).catch(() => { });
  }, [customDhurSqFt, loaded]);

  const isComplete = selectedUnit && selectedShape && selectedState && selectedHandUnit &&
    (selectedHandUnit !== 'Custom' || (customDhurSqFt && !isNaN(parseFloat(customDhurSqFt)) && parseFloat(customDhurSqFt) > 0));

  const handleStart = () => {
    if (!isComplete) {
      setValidationError('Please select all options before continuing.');
      return;
    }
    setValidationError('');
    router.push({
      pathname: '/',
      params: { unit: selectedUnit, shape: selectedShape, state: selectedState, handUnit: selectedHandUnit, customDhurSqFt },
    });
  };

  const isDark = theme.background === '#0d0e12';

  return (
    <ThemedView style={styles.container}>
      {/* Radial Wash Background */}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <Svg width="100%" height={380} style={{ position: 'absolute', top: 0, left: 0 }}>
          <Defs>
            <RadialGradient id="header-wash" cx="50%" cy="0%" r="50%" fx="50%" fy="0%">
              <Stop offset="0%" stopColor={isDark ? '#151624' : '#e0efff'} stopOpacity={isDark ? '0.6' : '0.7'} />
              <Stop offset="100%" stopColor={isDark ? '#0d0e12' : '#f9fafb'} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#header-wash)" />
        </Svg>
      </View>

      <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.safeArea}>
        {/* Scrollable content — fills space above the button */}
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <ThemedText type="subtitle" style={styles.headerTitle}>
              Area Finder
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary, fontSize: 13, marginTop: -2 }}>
              Configure your land calculation workspace
            </ThemedText>
          </View>

          {/* Measurement Unit */}
          <View style={styles.section}>
            <ThemedText type="smallBold" style={styles.sectionTitle}>
              Measurement Unit
            </ThemedText>
            <View style={[styles.optionsRow, { backgroundColor: theme.backgroundElement, borderColor: theme.borderStrong }]}>
              {UNIT_OPTIONS.map(u => {
                const isSelected = selectedUnit === u.value;
                return (
                  <AnimatedPressable
                    key={u.value}
                    onPress={() => setSelectedUnit(u.value)}
                    style={[
                      styles.optionButton,
                      isSelected && {
                        backgroundColor: theme.primary,
                      },
                    ]}
                  >
                    <ThemedText
                      type="defaultSemiBold"
                      style={[
                        styles.optionText,
                        { color: isSelected ? theme.onPrimary : theme.textSecondary },
                      ]}
                    >
                      {u.label}
                    </ThemedText>
                  </AnimatedPressable>
                );
              })}
            </View>
          </View>

          {/* Location & Local Unit */}
          <View style={styles.section}>
            <ThemedText type="smallBold" style={styles.sectionTitle}>
              Location & Local Unit
            </ThemedText>
            {selectedHandUnit && selectedHandUnit !== 'Standard' ? (
              <ThemedText type="default" style={[styles.dhurPreview, { backgroundColor: theme.backgroundElement, borderColor: theme.borderStrong, color: theme.text }]}>
                {(() => {
                  if (selectedHandUnit === 'Custom') {
                    if (!customDhurSqFt || isNaN(parseFloat(customDhurSqFt)) || parseFloat(customDhurSqFt) <= 0) return null;
                    return `${parseFloat(customDhurSqFt).toFixed(4)} sq ft (1 Dhur)`;
                  }
                  const match = selectedHandUnit.match(/\(([\d.]+)\s*ft\)/);
                  if (!match) return null;
                  const ft = parseFloat(match[1]);
                  const dhur = ft * ft;
                  return `${dhur.toFixed(4)} sq ft (1 Dhur)`;
                })()}
              </ThemedText>
            ) : null}
            <View style={styles.dropdownsRow}>
              {/* State dropdown */}
              <AnimatedPressable
                onPress={() => setShowStatePicker(true)}
                style={[
                  styles.stateDropdown,
                  { backgroundColor: theme.backgroundElement, borderColor: theme.borderStrong },
                ]}
              >
                <ThemedText
                  type="default"
                  style={{
                    color: selectedState ? theme.text : theme.textSecondary,
                    flex: 1,
                    fontSize: 13,
                  }}
                  numberOfLines={1}
                >
                  {selectedState || 'Select state'}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 10 }}>
                  ▼
                </ThemedText>
              </AnimatedPressable>

              {/* Hand unit dropdown */}
              <AnimatedPressable
                onPress={() => setShowHandUnitPicker(true)}
                style={[
                  styles.stateDropdown,
                  { backgroundColor: theme.backgroundElement, borderColor: theme.borderStrong },
                ]}
              >
                <ThemedText
                  type="default"
                  style={{
                    color: selectedHandUnit ? theme.text : theme.textSecondary,
                    flex: 1,
                    fontSize: 13,
                  }}
                  numberOfLines={1}
                >
                  {selectedHandUnit || 'Select unit'}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 10 }}>
                  ▼
                </ThemedText>
              </AnimatedPressable>
            </View>

            {selectedHandUnit === 'Custom' && (
              <View style={styles.customInputRow}>
                <ThemedText type="smallBold" style={styles.customInputLabel}>
                  Sq ft per Dhur
                </ThemedText>
                <TextInput
                  style={[
                    styles.customInput,
                    {
                      backgroundColor: theme.backgroundElement,
                      color: theme.text,
                      borderColor: isInputFocused ? theme.primary : theme.borderStrong,
                      borderWidth: isInputFocused ? 1.5 : 1,
                    }
                  ]}
                  value={customDhurSqFt}
                  onChangeText={setCustomDhurSqFt}
                  placeholder="e.g. 300.00"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="decimal-pad"
                  onFocus={() => setIsInputFocused(true)}
                  onBlur={() => setIsInputFocused(false)}
                />
              </View>
            )}
          </View>

          {/* State Picker Modal */}
          <Modal
            visible={showStatePicker}
            transparent
            animationType="fade"
            onRequestClose={() => setShowStatePicker(false)}
          >
            <Pressable
              style={styles.modalOverlay}
              onPress={() => setShowStatePicker(false)}
            >
              <Pressable
                style={[styles.modalContent, { backgroundColor: theme.background }]}
                onPress={() => { }}
              >
                <View style={[styles.modalHeader, { borderBottomColor: theme.borderStrong }]}>
                  <ThemedText type="defaultSemiBold" style={styles.modalTitle}>
                    Select State
                  </ThemedText>
                  <Pressable onPress={() => setShowStatePicker(false)}>
                    <ThemedText type="small" style={{ color: theme.textLink, fontWeight: '700', fontSize: 15 }}>
                      Done
                    </ThemedText>
                  </Pressable>
                </View>
                <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
                  {INDIAN_STATES.map(state => {
                    const isSelected = selectedState === state;
                    return (
                      <Pressable
                        key={state}
                        onPress={() => {
                          setSelectedState(state);
                          setShowStatePicker(false);
                        }}
                        style={[
                          styles.stateRow,
                          isSelected && { backgroundColor: theme.backgroundSelected },
                        ]}
                      >
                        <ThemedText
                          type="default"
                          style={{
                            color: theme.text,
                            fontWeight: isSelected ? '700' : '400',
                          }}
                        >
                          {state}
                        </ThemedText>
                        {isSelected && (
                          <ThemedText type="small" style={{ color: theme.primary, fontWeight: '700' }}>
                            ✓
                          </ThemedText>
                        )}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </Pressable>
            </Pressable>
          </Modal>

          {/* Hand Unit Picker Modal */}
          <Modal
            visible={showHandUnitPicker}
            transparent
            animationType="fade"
            onRequestClose={() => setShowHandUnitPicker(false)}
          >
            <Pressable
              style={styles.modalOverlay}
              onPress={() => setShowHandUnitPicker(false)}
            >
              <Pressable
                style={[styles.modalContent, { backgroundColor: theme.background }]}
                onPress={() => { }}
              >
                <View style={[styles.modalHeader, { borderBottomColor: theme.borderStrong }]}>
                  <ThemedText type="defaultSemiBold" style={styles.modalTitle}>
                    Select Local Unit
                  </ThemedText>
                  <Pressable onPress={() => setShowHandUnitPicker(false)}>
                    <ThemedText type="small" style={{ color: theme.textLink, fontWeight: '700', fontSize: 15 }}>
                      Done
                    </ThemedText>
                  </Pressable>
                </View>
                <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
                  {[...HAND_UNITS].map(unit => {
                    const isSelected = selectedHandUnit === unit;
                    return (
                      <Pressable
                        key={unit}
                        onPress={() => {
                          setSelectedHandUnit(unit);
                          setShowHandUnitPicker(false);
                        }}
                        style={[
                          styles.stateRow,
                          isSelected && { backgroundColor: theme.backgroundSelected },
                        ]}
                      >
                        <ThemedText
                          type="default"
                          style={{
                            color: theme.text,
                            fontWeight: isSelected ? '700' : '400',
                          }}
                        >
                          {unit}
                        </ThemedText>
                        {isSelected && (
                          <ThemedText type="small" style={{ color: theme.primary, fontWeight: '700' }}>
                            ✓
                          </ThemedText>
                        )}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </Pressable>
            </Pressable>
          </Modal>

          {/* Shape — 2-column grid, vertically scrollable */}
          <View style={styles.section}>
            <ThemedText type="smallBold" style={styles.sectionTitle}>
              Shape
            </ThemedText>
            <View style={styles.shapesGrid}>
              {SHAPES.map((s) => {
                const isSelected = selectedShape === s.type;
                return (
                  <AnimatedPressable
                    key={s.type}
                    onPress={() => setSelectedShape(s.type)}
                    style={[
                      styles.shapeCard,
                      {
                        backgroundColor: isSelected ? theme.backgroundSelected : theme.backgroundElement,
                        borderColor: isSelected ? theme.primary : theme.borderStrong,
                        borderWidth: isSelected ? 1.5 : 1,
                      },
                    ]}
                  >
                    <View style={styles.shapeIconContainer}>
                      {s.icon(isSelected ? theme.primary : theme.textSecondary)}
                    </View>
                    <ThemedText
                      type="smallBold"
                      style={{
                        color: isSelected ? theme.primary : theme.textSecondary,
                        textAlign: 'center',
                        fontSize: 11,
                        fontWeight: isSelected ? '700' : '500'
                      }}
                    >
                      {s.label}
                    </ThemedText>
                  </AnimatedPressable>
                );
              })}
            </View>
          </View>
        </ScrollView>

        {/* Sticky bottom button */}
        <View style={[styles.bottomBar, { backgroundColor: theme.background, borderTopColor: theme.borderStrong }]}>
          {validationError ? (
            <ThemedText type="small" style={styles.errorText}>
              {validationError}
            </ThemedText>
          ) : null}
          <AnimatedPressable
            onPress={handleStart}
            disabled={!isComplete}
            style={[
              styles.startButton,
              { backgroundColor: theme.primary, opacity: isComplete ? 1 : 0.3 },
            ]}
          >
            <ThemedText type="defaultSemiBold" style={[styles.startButtonText, { color: theme.onPrimary }]}>
              Start Calculating
            </ThemedText>
          </AnimatedPressable>
        </View>
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
    paddingTop: Spacing.four,
    paddingBottom: Spacing.three,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
    gap: Spacing.four,
  },
  header: {
    gap: Spacing.one,
    alignItems: 'center',
    marginVertical: Spacing.two,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  section: {
    gap: Spacing.three,
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  optionsRow: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 24,
    borderWidth: 1,
    width: '100%',
    maxWidth: 340,
    alignSelf: 'center',
  },
  optionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  dropdownsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    width: '100%',
  },
  dhurPreview: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: 12,
    overflow: 'hidden',
    alignSelf: 'center',
    borderWidth: 1,
  },
  stateDropdown: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    minHeight: 48,
    paddingHorizontal: Spacing.three,
    borderRadius: 12,
    borderWidth: 1,
  },
  customInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: Spacing.two,
  },
  customInputLabel: {
    fontSize: 13,
    minWidth: 100,
  },
  customInput: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    fontSize: 15,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    maxHeight: '70%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: Spacing.five,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  modalList: {
    paddingHorizontal: Spacing.four,
    maxHeight: 400,
  },
  stateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    borderRadius: 8,
  },
  shapesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
    paddingBottom: Spacing.two,
  },
  shapeCard: {
    width: 104,
    height: 104,
    padding: Spacing.two,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.two,
  },
  shapeIconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    height: 38,
  },
  bottomBar: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderTopWidth: 1,
    gap: Spacing.two,
  },
  errorText: {
    color: '#ff4d4f',
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
  },
  startButton: {
    paddingVertical: Spacing.three,
    borderRadius: 12,
    alignItems: 'center',
  },
  startButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
});

