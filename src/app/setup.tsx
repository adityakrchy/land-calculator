import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ShapeType = 'triangle';

const UNIT_OPTIONS = [
  { label: 'Kadi', value: 'kadi' },
  { label: 'Feet', value: 'ft' },
  { label: 'Meter', value: 'm' },
];

const SHAPES: { type: ShapeType; label: string }[] = [
  { type: 'triangle', label: 'Triangle' },
];

export default function SetupScreen() {
  const theme = useTheme();
  const [selectedUnit, setSelectedUnit] = useState<string>('m');
  const [selectedShape, setSelectedShape] = useState<ShapeType>('triangle');

  const handleStart = () => {
    router.replace({
      pathname: '/',
      params: { unit: selectedUnit, shape: selectedShape },
    });
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
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

          {/* Shape */}
          <View style={styles.section}>
            <ThemedText type="smallBold" style={styles.sectionTitle}>
              Shape
            </ThemedText>
            <View style={styles.optionsRow}>
              {SHAPES.map(s => {
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
                      <View
                        style={{
                          width: 0,
                          height: 0,
                          borderLeftWidth: 20,
                          borderRightWidth: 20,
                          borderBottomWidth: 35,
                          borderBottomColor: isSelected ? '#ffffff' : theme.text,
                          borderLeftColor: 'transparent',
                          borderRightColor: 'transparent',
                          backgroundColor: 'transparent',
                        }}
                      />
                    </View>
                    <ThemedText
                      type="smallBold"
                      style={{
                        color: isSelected ? '#ffffff' : theme.text,
                        textAlign: 'center',
                      }}
                    >
                      {s.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Start Button */}
          <Pressable
            onPress={handleStart}
            style={[styles.startButton, { backgroundColor: '#3c87f7' }]}
          >
            <ThemedText type="defaultSemiBold" style={styles.startButtonText}>
              Start Calculating
            </ThemedText>
          </Pressable>
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
    paddingTop: Spacing.five,
    paddingBottom: Spacing.five,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
    gap: Spacing.five,
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
  shapeCard: {
    width: 130,
    height: 120,
    padding: Spacing.two,
    borderRadius: Spacing.three,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.one,
  },
  shapeIconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  startButton: {
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  startButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
});
