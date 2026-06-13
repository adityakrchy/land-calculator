import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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

const HAND_UNITS = ['Standard', '4 hand (6 ft)', '4.5 hand (6.75 ft)', '5 hand (7.5 ft)', '5.5 hand (8.25 ft)', '6 hand (9 ft)', '6.5 hand (9.75 ft)', '7 hand (10.5 ft)', '7.5 hand (11.25 ft)', '8 hand (12 ft)', '8.5 hand (12.75 ft)', '9 hand (13.5 ft)', '9.5 hand (14.25 ft)', '10 hand (15 ft)'];

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
    type: 'rectangle',
    label: 'Rectangle',
    icon: (color) => (
      <View style={{ width: 36, height: 24, borderWidth: 2, borderColor: color, borderRadius: 2 }} />
    ),
  },
  {
    type: 'square',
    label: 'Square',
    icon: (color) => (
      <View style={{ width: 28, height: 28, borderWidth: 2, borderColor: color, borderRadius: 2 }} />
    ),
  },
  {
    type: 'parallelogram',
    label: 'Parallelogram',
    icon: (color) => (
      <View style={{ width: 34, height: 22, borderWidth: 2, borderColor: color, transform: [{ skewX: '-15deg' }], borderRadius: 1 }} />
    ),
  },
  {
    type: 'trapezoid',
    label: 'Trapezoid',
    icon: (color) => (
      <View style={{ width: 20, height: 0, borderBottomWidth: 24, borderBottomColor: color, borderLeftWidth: 8, borderLeftColor: 'transparent', borderRightWidth: 8, borderRightColor: 'transparent', backgroundColor: 'transparent' }} />
    ),
  },
  {
    type: 'circle',
    label: 'Circle',
    icon: (color) => (
      <View style={{ width: 30, height: 30, borderWidth: 2, borderColor: color, borderRadius: 15 }} />
    ),
  },
  {
    type: 'rhombus',
    label: 'Rhombus',
    icon: (color) => (
      <View style={{ width: 0, height: 0, borderLeftWidth: 16, borderRightWidth: 16, borderBottomWidth: 14, borderTopWidth: 14, borderBottomColor: color, borderTopColor: color, borderLeftColor: 'transparent', borderRightColor: 'transparent', backgroundColor: 'transparent' }} />
    ),
  },
  {
    type: 'hexagon',
    label: 'Hexagon',
    icon: (color) => (
      <View style={{ position: 'relative', width: 32, height: 28 }}>
        <View style={{ position: 'absolute', top: 2, left: 4, width: 24, height: 24, borderWidth: 2, borderColor: color, borderRadius: 1, transform: [{ rotate: '45deg' }] }} />
        <View style={{ position: 'absolute', top: 2, left: 4, width: 24, height: 24, borderWidth: 2, borderColor: color, borderRadius: 1, transform: [{ rotate: '-45deg' }] }} />
      </View>
    ),
  },
  {
    type: 'pentagon',
    label: 'Pentagon',
    icon: (color) => (
      <View style={{ width: 30, height: 28, borderWidth: 2, borderColor: color, borderRadius: 1, transform: [{ rotate: '36deg' }] }} />
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
  const [validationError, setValidationError] = useState<string>('');
  const [loaded, setLoaded] = useState(false);

  // Load saved preferences on mount
  useEffect(() => {
    (async () => {
      try {
        const savedState = await SecureStore.getItemAsync('pref_state');
        const savedHandUnit = await SecureStore.getItemAsync('pref_hand_unit');
        if (savedState) setSelectedState(savedState);
        if (savedHandUnit) setSelectedHandUnit(savedHandUnit);
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

  const isComplete = selectedUnit && selectedShape && selectedState && selectedHandUnit;

  const handleStart = () => {
    if (!isComplete) {
      setValidationError('Please select all options before continuing.');
      return;
    }
    setValidationError('');
    router.replace({
      pathname: '/',
      params: { unit: selectedUnit, shape: selectedShape, state: selectedState },
    });
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
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
            <ThemedText themeColor="textSecondary" style={styles.headerSubtitle}>
              Select a measurement unit and shape to get started.
            </ThemedText>
          </View>

          {/* Measurement Unit */}
          <View style={styles.section}>
            <ThemedText type="smallBold" style={styles.sectionTitle}>
              Measurement Unit
            </ThemedText>
            <View style={styles.optionsRow}>
              {UNIT_OPTIONS.map(u => {
                const isSelected = selectedUnit === u.value;
                return (
                  <Pressable
                    key={u.value}
                    onPress={() => setSelectedUnit(u.value)}
                    style={[
                      styles.optionButton,
                      {
                        backgroundColor: isSelected ? '#3c87f7' : theme.backgroundElement,
                        borderColor: isSelected ? '#3c87f7' : theme.backgroundSelected,
                      },
                    ]}
                  >
                    <ThemedText
                      type="defaultSemiBold"
                      style={[
                        styles.optionText,
                        { color: isSelected ? '#ffffff' : theme.text },
                      ]}
                    >
                      {u.label}
                    </ThemedText>
                  </Pressable>
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
              <ThemedText type="default" style={styles.dhurPreview}>
                {(() => {
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
              <Pressable
                onPress={() => setShowStatePicker(true)}
                style={[
                  styles.stateDropdown,
                  { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected },
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
              </Pressable>

              {/* Hand unit dropdown */}
              <Pressable
                onPress={() => setShowHandUnitPicker(true)}
                style={[
                  styles.stateDropdown,
                  { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected },
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
              </Pressable>
            </View>
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
                <View style={[styles.modalHeader, { borderBottomColor: theme.backgroundSelected }]}>
                  <ThemedText type="defaultSemiBold" style={styles.modalTitle}>
                    Select State
                  </ThemedText>
                  <Pressable onPress={() => setShowStatePicker(false)}>
                    <ThemedText type="small" style={{ color: '#3c87f7', fontWeight: '700', fontSize: 15 }}>
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
                          isSelected && { backgroundColor: 'rgba(60, 135, 247, 0.1)' },
                        ]}
                      >
                        <ThemedText
                          type="default"
                          style={{
                            color: isSelected ? '#3c87f7' : theme.text,
                            fontWeight: isSelected ? '700' : '400',
                          }}
                        >
                          {state}
                        </ThemedText>
                        {isSelected && (
                          <ThemedText type="small" style={{ color: '#3c87f7', fontWeight: '700' }}>
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
                <View style={[styles.modalHeader, { borderBottomColor: theme.backgroundSelected }]}>
                  <ThemedText type="defaultSemiBold" style={styles.modalTitle}>
                    Select Local Unit
                  </ThemedText>
                  <Pressable onPress={() => setShowHandUnitPicker(false)}>
                    <ThemedText type="small" style={{ color: '#3c87f7', fontWeight: '700', fontSize: 15 }}>
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
                          isSelected && { backgroundColor: 'rgba(60, 135, 247, 0.1)' },
                        ]}
                      >
                        <ThemedText
                          type="default"
                          style={{
                            color: isSelected ? '#3c87f7' : theme.text,
                            fontWeight: isSelected ? '700' : '400',
                          }}
                        >
                          {unit}
                        </ThemedText>
                        {isSelected && (
                          <ThemedText type="small" style={{ color: '#3c87f7', fontWeight: '700' }}>
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
                  <Pressable
                    key={s.type}
                    onPress={() => setSelectedShape(s.type)}
                    style={[
                      styles.shapeCard,
                      {
                        backgroundColor: isSelected ? '#3c87f7' : theme.backgroundElement,
                        borderColor: isSelected ? '#3c87f7' : theme.backgroundSelected,
                      },
                    ]}
                  >
                    <View style={styles.shapeIconContainer}>
                      {s.icon(isSelected ? '#ffffff' : theme.text)}
                    </View>
                    <ThemedText
                      type="smallBold"
                      style={{ color: isSelected ? '#ffffff' : theme.text, textAlign: 'center', fontSize: 11 }}
                    >
                      {s.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </ScrollView>

        {/* Sticky bottom button */}
        <View style={[styles.bottomBar, { backgroundColor: theme.background, borderTopColor: theme.backgroundSelected }]}>
          {validationError ? (
            <ThemedText type="small" style={styles.errorText}>
              {validationError}
            </ThemedText>
          ) : null}
          <Pressable
            onPress={handleStart}
            disabled={!isComplete}
            style={[
              styles.startButton,
              { backgroundColor: isComplete ? '#3c87f7' : 'rgba(60, 135, 247, 0.3)' },
            ]}
          >
            <ThemedText type="defaultSemiBold" style={styles.startButtonText}>
              Start Calculating
            </ThemedText>
          </Pressable>
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
    paddingTop: Spacing.five,
    paddingBottom: Spacing.three,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
    gap: Spacing.four,
  },
  header: {
    gap: Spacing.one,
    alignItems: 'center',
  },
  headerTitle: {
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  section: {
    gap: Spacing.two,
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  optionsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    justifyContent: 'center',
  },
  optionButton: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1.5,
  },
  optionText: {
    fontSize: 16,
    fontWeight: '700',
  },
  dropdownsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    width: '100%',
  },
  dhurPreview: {
    fontSize: 13,
    fontWeight: '600',
    color: '#083374ff',
    textAlign: 'center',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    backgroundColor: 'rgba(60, 135, 247, 0.08)',
    borderRadius: Spacing.two,
    overflow: 'hidden',
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: '#000000',
  },
  stateDropdown: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    minHeight: 48,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    maxHeight: '70%',
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
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
    paddingHorizontal: Spacing.one,
    borderRadius: Spacing.two,
  },
  shapesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    justifyContent: 'center',
    paddingBottom: Spacing.two,
  },
  shapeCard: {
    width: 90,
    height: 88,
    padding: Spacing.one,
    borderRadius: Spacing.three,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.one,
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
    gap: Spacing.one,
  },
  errorText: {
    color: '#ff4d4f',
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
  },
  startButton: {
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
  },
  startButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
});
