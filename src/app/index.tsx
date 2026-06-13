import { SymbolView } from 'expo-symbols';
import { useMemo, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ShapeDiagram } from '@/components/shape-diagrams';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { generateTriangle, calculateInteriorAngles } from '@/utils/geometry';

type ShapeType = 'triangle' // | 'rectangle' | 'parallelogram' | 'trapezoid' | 'quadrilateral';

interface InputFields {
  base?: string;
  height?: string;
  length?: string;
  width?: string;
  sideA?: string; // Top base for Trapezoid, Side a for Triangle
  sideB?: string; // Bottom base for Trapezoid, Side b for Triangle
  sideC?: string; // Side c for Triangle
  angleA?: string;
  angleB?: string;
  angleC?: string;
  diagonal?: string; // For Quadrilateral
  h1?: string; // Perpendicular 1 for Quadrilateral
  h2?: string; // Perpendicular 2 for Quadrilateral
}

const SHAPES: { type: ShapeType; label: string; icon: string; }[] = [
  { type: 'triangle', label: 'Triangle', icon: 'triangle' }
  // { type: 'rectangle', label: 'Rectangle', icon: 'rectangle' },
  // { type: 'parallelogram', label: 'Parallelogram', icon: 'square.skew.ltr' },
  // { type: 'trapezoid', label: 'Trapezoid', icon: 'trapezoid' },
  // { type: 'quadrilateral', label: 'Quadrilateral', icon: 'square.dashed' },
];

const UNITS = ['cm', 'm', 'in', 'ft', 'mm'];

const ShapeIcon = ({ type, color }: { type: ShapeType; color: string }) => {
  switch (type) {
    case 'triangle':
      return (
        <View style={{ width: 0, height: 0, borderLeftWidth: 16, borderRightWidth: 16, borderBottomWidth: 28, borderBottomColor: color, borderLeftColor: 'transparent', borderRightColor: 'transparent', backgroundColor: 'transparent' }} />
      );
    // case 'rectangle':
    //   return (
    //     <View style={{ width: 36, height: 24, borderWidth: 2, borderColor: color, borderRadius: 2 }} />
    //   );
    // case 'parallelogram':
    //   return (
    //     <View style={{ width: 32, height: 24, borderWidth: 2, borderColor: color, transform: [{ skewX: '-20deg' }] }} />
    //   );
    // case 'trapezoid':
    //   return (
    //     <View style={{ width: 18, height: 0, borderBottomWidth: 24, borderBottomColor: color, borderLeftWidth: 8, borderLeftColor: 'transparent', borderRightWidth: 8, borderRightColor: 'transparent', backgroundColor: 'transparent' }} />
    //   );
    // case 'quadrilateral':
    //   return (
    //     <View style={{ width: 26, height: 26, borderWidth: 2, borderColor: color, transform: [{ rotate: '15deg' }, { skewY: '-10deg' }] }} />
    //   );
    default:
      return null;
  }
};

export default function HomeScreen() {
  const theme = useTheme();
  const [selectedShape, setSelectedShape] = useState<ShapeType>('triangle');
  const [unit, setUnit] = useState<string>('cm');
  const [activeField, setActiveField] = useState<string | null>(null);
  const [inputs, setInputs] = useState<InputFields>({});

  // ── Collapsing header on scroll ────────────────────────────────────────
  const scrollY = useRef(new Animated.Value(0)).current;
  const COLLAPSE_DISTANCE = 200;

  const collapsibleOpacity = scrollY.interpolate({
    inputRange: [0, COLLAPSE_DISTANCE],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const collapsibleTranslateY = scrollY.interpolate({
    inputRange: [0, COLLAPSE_DISTANCE],
    outputRange: [0, -15],
    extrapolate: 'clamp',
  });

  const compactOpacity = scrollY.interpolate({
    inputRange: [COLLAPSE_DISTANCE * 0.5, COLLAPSE_DISTANCE],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const compactTranslateY = scrollY.interpolate({
    inputRange: [COLLAPSE_DISTANCE * 0.5, COLLAPSE_DISTANCE],
    outputRange: [-32, 0],
    extrapolate: 'clamp',
  });

  // Reset inputs when shape changes
  const handleShapeSelect = (shape: ShapeType) => {
    setSelectedShape(shape);
    setInputs({});
    setActiveField(null);
  };

  const handleInputChange = (field: keyof InputFields, value: string) => {
    // Only allow numbers and decimal point
    const cleanValue = value.replace(/[^0-9.]/g, '');

    // Ensure only one decimal point
    const parts = cleanValue.split('.');
    const formattedValue = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : cleanValue;

    setInputs(prev => ({
      ...prev,
      [field]: formattedValue,
    }));
  };

  // Perform Calculation & Build Step-by-Step Explanation
  const calculationResult = useMemo(() => {
    const parseFloatVal = (val?: string) => {
      const num = parseFloat(val || '0');
      return isNaN(num) || num < 0 ? 0 : num;
    };

    let area = 0;
    let areaInSqM = 0;
    let isValid = false;
    let hasInputs = false;
    let solvedTriangle: { a: number; b: number; c: number; A: number; B: number; C: number } | null = null;

    const toRad = Math.PI / 180;
    const toDeg = 180 / Math.PI;

    function solveTriangleParams(a: number, b: number, c: number, A: number, B: number, C: number) {
      let knownCount = [a, b, c, A, B, C].filter(n => !isNaN(n)).length;
      if (knownCount < 3) return { a, b, c, A, B, C };

      for (let i = 0; i < 4; i++) {
        if (!isNaN(A) && !isNaN(B) && isNaN(C)) C = 180 - A - B;
        if (!isNaN(A) && !isNaN(C) && isNaN(B)) B = 180 - A - C;
        if (!isNaN(B) && !isNaN(C) && isNaN(A)) A = 180 - B - C;

        if (!isNaN(a) && !isNaN(b) && !isNaN(c)) {
          if (isNaN(A)) A = Math.acos((b * b + c * c - a * a) / (2 * b * c)) * toDeg;
          if (isNaN(B)) B = Math.acos((a * a + c * c - b * b) / (2 * a * c)) * toDeg;
          if (isNaN(C)) C = Math.acos((a * a + b * b - c * c) / (2 * a * b)) * toDeg;
        }

        if (!isNaN(b) && !isNaN(c) && !isNaN(A) && isNaN(a)) a = Math.sqrt(b * b + c * c - 2 * b * c * Math.cos(A * toRad));
        if (!isNaN(a) && !isNaN(c) && !isNaN(B) && isNaN(b)) b = Math.sqrt(a * a + c * c - 2 * a * c * Math.cos(B * toRad));
        if (!isNaN(a) && !isNaN(b) && !isNaN(C) && isNaN(c)) c = Math.sqrt(a * a + b * b - 2 * a * b * Math.cos(C * toRad));

        let R = NaN;
        if (!isNaN(a) && !isNaN(A) && A > 0 && A < 180) R = a / Math.sin(A * toRad);
        else if (!isNaN(b) && !isNaN(B) && B > 0 && B < 180) R = b / Math.sin(B * toRad);
        else if (!isNaN(c) && !isNaN(C) && C > 0 && C < 180) R = c / Math.sin(C * toRad);

        if (!isNaN(R)) {
          if (!isNaN(A) && isNaN(a)) a = R * Math.sin(A * toRad);
          if (!isNaN(B) && isNaN(b)) b = R * Math.sin(B * toRad);
          if (!isNaN(C) && isNaN(c)) c = R * Math.sin(C * toRad);

          if (!isNaN(a) && isNaN(A)) { let s = a / R; if (s <= 1) A = Math.asin(s) * toDeg; }
          if (!isNaN(b) && isNaN(B)) { let s = b / R; if (s <= 1) B = Math.asin(s) * toDeg; }
          if (!isNaN(c) && isNaN(C)) { let s = c / R; if (s <= 1) C = Math.asin(s) * toDeg; }
        }
      }

      const isValidT = !isNaN(a) && !isNaN(b) && !isNaN(c) && !isNaN(A) && !isNaN(B) && !isNaN(C) &&
        a > 0 && b > 0 && c > 0 && A > 0 && B > 0 && C > 0 &&
        Math.abs(A + B + C - 180) < 0.1 &&
        a + b > c && a + c > b && b + c > a;

      if (!isValidT) return { a: NaN, b: NaN, c: NaN, A: NaN, B: NaN, C: NaN };
      return { a, b, c, A, B, C };
    }

    switch (selectedShape) {
      case 'triangle': {
        const parseAsNaN = (val?: string) => val ? parseFloat(val) : NaN;
        const parseSide = (val?: string) => {
          if (!val) return NaN;
          const parts = val.split('.');
          const feet = parseInt(parts[0], 10);
          const inches = parts.length > 1 ? parseInt(parts[1], 10) : 0;
          if (isNaN(feet) && isNaN(inches)) return NaN;
          let total = 0;
          if (!isNaN(feet)) total += feet;
          if (!isNaN(inches)) total += inches / 12;
          return total;
        };

        let sideA = unit === 'ft' ? parseSide(inputs.sideA) : parseAsNaN(inputs.sideA);
        let sideB = unit === 'ft' ? parseSide(inputs.sideB) : parseAsNaN(inputs.sideB);
        let sideC = unit === 'ft' ? parseSide(inputs.sideC) : parseAsNaN(inputs.sideC);
        let angA = parseAsNaN(inputs.angleA);
        let angB = parseAsNaN(inputs.angleB);
        let angC = parseAsNaN(inputs.angleC);

        const knownCount = [sideA, sideB, sideC, angA, angB, angC].filter(n => !isNaN(n)).length;
        hasInputs = knownCount >= 3;

        // Use solveTriangleParams for general solving (handles angle-entry cases)
        const solved = solveTriangleParams(sideA, sideB, sideC, angA, angB, angC);
        sideA = solved.a; sideB = solved.b; sideC = solved.c;

        const isTriangleInequalityValid = !isNaN(sideA) && !isNaN(sideB) && !isNaN(sideC)
          && sideA > 0 && sideB > 0 && sideC > 0
          && sideA + sideB > sideC && sideA + sideC > sideB && sideB + sideC > sideA;
        isValid = isTriangleInequalityValid;

        if (isValid) {
          // Use the same triangle generation and angle calculation as plot.tsx
          const points = generateTriangle(sideA, sideB, sideC);
          const angles = calculateInteriorAngles(points);

          solvedTriangle = {
            a: sideA,
            b: sideB,
            c: sideC,
            A: angles[0],
            B: angles[1],
            C: angles[2],
          };

          // Heron's formula
          const s = (sideA + sideB + sideC) / 2;
          area = Math.sqrt(s * (s - sideA) * (s - sideB) * (s - sideC));
        } else {
          solvedTriangle = { a: sideA, b: sideB, c: sideC, A: NaN, B: NaN, C: NaN };
        }
        break;
      }
      // case 'rectangle': {
      //   const l = parseFloatVal(inputs.length);
      //   const w = parseFloatVal(inputs.width);
      //   hasInputs = !isNaN(l) && !isNaN(w);
      //   isValid = hasInputs && l > 0 && w > 0;
      //   area = l * w;
      //   break;
      // }
      // case 'parallelogram': {
      //   const b = parseFloatVal(inputs.base);
      //   const h = parseFloatVal(inputs.height);
      //   hasInputs = !isNaN(b) && !isNaN(h);
      //   isValid = hasInputs && b > 0 && h > 0;
      //   area = b * h;
      //   break;
      // }
      // case 'trapezoid': {
      //   const a = parseFloatVal(inputs.sideA);
      //   const b = parseFloatVal(inputs.sideB);
      //   const h = parseFloatVal(inputs.height);
      //   hasInputs = !isNaN(a) && !isNaN(b) && !isNaN(h);
      //   isValid = hasInputs && a > 0 && b > 0 && h > 0;
      //   area = 0.5 * (a + b) * h;
      //   break;
      // }
      // case 'quadrilateral': {
      //   const d = parseFloatVal(inputs.diagonal);
      //   const h1 = parseFloatVal(inputs.h1);
      //   const h2 = parseFloatVal(inputs.h2);
      //   hasInputs = !isNaN(d) && !isNaN(h1) && !isNaN(h2);
      //   isValid = hasInputs && d > 0 && h1 > 0 && h2 > 0;
      //   area = 0.5 * d * (h1 + h2);
      //   break;
      // }
    }

    // Conversion factors to square meters (m²)
    // Based on squaring the linear conversion factors to meters
    const toMeterFactor: Record<string, number> = {
      'mm': 0.001,
      'cm': 0.01,
      'in': 0.0254,
      'ft': 0.3048,
      'm': 1
    };

    if (isValid) {
      const factor = toMeterFactor[unit] || 1;
      areaInSqM = area * (factor * factor);
    }

    return { area, areaInSqM, isValid, hasInputs, solvedTriangle };
  }, [selectedShape, inputs, unit]);

  const renderAreaConversions = () => {
    if (!calculationResult.isValid) return null;
    const { areaInSqM } = calculationResult;

    const sqFt = areaInSqM * 10.7639;

    const conversions: { label: string; value: string }[] = [
      { label: 'Kadi Sq', value: (sqFt / 2.25).toFixed(2) },
      { label: 'Cent / Decimal', value: (sqFt / 435.6).toFixed(2) },
      { label: 'Dhur', value: (sqFt / 95.0625).toFixed(2) },
      { label: 'Katha', value: (sqFt / 1901.25).toFixed(2) },
      { label: 'Bigha', value: (sqFt / 38025).toFixed(3) },
      { label: 'Kasma', value: (sqFt / 47.53125).toFixed(2) },
      { label: 'Acre', value: (sqFt / 43560).toFixed(4) },
      { label: 'Hectare', value: (sqFt / 107639).toFixed(4) },
      { label: 'Sq Yard / Gaj', value: (sqFt / 9).toFixed(2) },
    ];

    return (
      <View style={styles.conversionsSection}>
        <View style={styles.divider} />
        <ThemedText type="smallBold" style={styles.stepsTitle}>
          Converted Land Area
        </ThemedText>
        <View style={styles.conversionsList}>
          {conversions.map((item, idx) => (
            <View
              key={idx}
              style={[
                styles.conversionRow,
                {
                  backgroundColor: 'rgba(60, 135, 247, 0.04)',
                  borderColor: 'rgba(60, 135, 247, 0.1)',
                },
              ]}
            >
              <ThemedText type="default" style={styles.conversionLabel}>
                {item.label}
              </ThemedText>
              <ThemedText type="defaultSemiBold" style={styles.conversionValue}>
                {item.value}
              </ThemedText>
            </View>
          ))}
        </View>
      </View>
    );
  };

  // Dynamic input fields helper based on selected shape
  const formatFtInput = (val: number) => {
    if (isNaN(val) || val <= 0) return 'e.g. 4.7';
    const ft = Math.floor(val);
    const inch = Math.round((val - ft) * 12);
    return `${ft}.${inch}`;
  };

  const renderInputFields = () => {
    if (selectedShape === 'triangle') {
      const s = calculationResult.solvedTriangle;

      // Side fields - each full-width row
      type SideField = { key: keyof InputFields; label: string; placeholder: string };
      const sideFields: SideField[] = [];

      if (unit === 'ft') {
        sideFields.push(
          { key: 'sideA', label: 'Side A', placeholder: (s && !isNaN(s.a) && !inputs.sideA) ? formatFtInput(s.a) : 'e.g. 4.7' },
          { key: 'sideB', label: 'Side B', placeholder: (s && !isNaN(s.b) && !inputs.sideB) ? formatFtInput(s.b) : 'e.g. 5.6' },
          { key: 'sideC', label: 'Side C', placeholder: (s && !isNaN(s.c) && !inputs.sideC) ? formatFtInput(s.c) : 'e.g. 6.8' },
        );
      } else {
        sideFields.push(
          { key: 'sideA', label: 'Side A', placeholder: (s && !isNaN(s.a) && !inputs.sideA) ? s.a.toFixed(2) : 'e.g. 5' },
          { key: 'sideB', label: 'Side B', placeholder: (s && !isNaN(s.b) && !inputs.sideB) ? s.b.toFixed(2) : 'e.g. 6' },
          { key: 'sideC', label: 'Side C', placeholder: (s && !isNaN(s.c) && !inputs.sideC) ? s.c.toFixed(2) : 'e.g. 7' },
        );
      }

      const unitSuffix = unit === 'ft' ? 'ft' : unit;

      const hasAngles = s && !isNaN(s.A) && !isNaN(s.B) && !isNaN(s.C) && s.A > 0 && s.B > 0 && s.C > 0;
      const angleLabels = ['A', 'B', 'C'];

      return (
        <>
          {/* Sides - each full-width row */}
          <View style={styles.sidesSection}>
            {sideFields.map(f => (
              <View key={f.key} style={styles.sideRow}>
                <ThemedText type="small" style={styles.sideLabel}>
                  {f.label}
                </ThemedText>
                <View style={{ position: 'relative', flex: 1 }}>
                  <TextInput
                    style={[
                      styles.textInput,
                      {
                        backgroundColor: theme.backgroundElement,
                        color: theme.text,
                        borderColor: activeField === f.key ? '#3c87f7' : theme.backgroundSelected,
                        paddingRight: 28,
                      },
                    ]}
                    value={inputs[f.key] || ''}
                    onChangeText={val => handleInputChange(f.key, val)}
                    placeholder={f.placeholder}
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="decimal-pad"
                    onFocus={() => setActiveField(f.key)}
                    onBlur={() => setActiveField(null)}
                  />
                  <View style={styles.inputSuffix}>
                    <ThemedText type="small" themeColor="textSecondary">
                      {unitSuffix}
                    </ThemedText>
                  </View>
                </View>
              </View>
            ))}
          </View>

          {/* Angles - 3-column display */}
          <View style={styles.anglesSection}>
            <View style={styles.anglesRow}>
              {angleLabels.map((label) => {
                const angleVal = label === 'A' ? s?.A : label === 'B' ? s?.B : s?.C;
                const displayVal =
                  hasAngles ? `${angleVal!.toFixed(1)}°` : '—';
                return (
                  <View key={label} style={styles.angleItem}>
                    <ThemedText type="small" style={styles.angleLabel}>
                      ∠{label}
                    </ThemedText>
                    <View
                      style={[
                        styles.angleValueBox,
                        {
                          backgroundColor: theme.backgroundElement,
                          borderColor: activeField === `angle${label}` ? '#3c87f7' : theme.backgroundSelected,
                        },
                      ]}
                    >
                      <ThemedText
                        type="defaultSemiBold"
                        style={[
                          styles.angleValue,
                          { color: hasAngles ? '#3c87f7' : theme.textSecondary },
                        ]}
                      >
                        {displayVal}
                      </ThemedText>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        </>
      );
    }

    const fields: { key: keyof InputFields; label: string; placeholder: string }[] = [];

    if (selectedShape === 'rectangle') {
      fields.push(
        { key: 'length', label: 'Length (l)', placeholder: 'e.g. 8' },
        { key: 'width', label: 'Width (w)', placeholder: 'e.g. 4' }
      );
    } else if (selectedShape === 'parallelogram') {
      fields.push(
        { key: 'base', label: 'Base (b)', placeholder: 'e.g. 12' },
        { key: 'height', label: 'Height (h)', placeholder: 'e.g. 6' }
      );
    } else if (selectedShape === 'trapezoid') {
      fields.push(
        { key: 'sideA', label: 'Top base (a)', placeholder: 'e.g. 6' },
        { key: 'sideB', label: 'Bottom base (b)', placeholder: 'e.g. 10' },
        { key: 'height', label: 'Height (h)', placeholder: 'e.g. 4' }
      );
    } else if (selectedShape === 'quadrilateral') {
      fields.push(
        { key: 'diagonal', label: 'Diagonal (d)', placeholder: 'e.g. 12' },
        { key: 'h1', label: 'Perpendicular 1 (h₁)', placeholder: 'e.g. 3' },
        { key: 'h2', label: 'Perpendicular 2 (h₂)', placeholder: 'e.g. 5' }
      );
    }

    if (fields.length > 0) {
      return (
        <View style={styles.inputsGrid}>
          {fields.map(f => (
            <View key={f.key} style={styles.inputContainer}>
              <ThemedText type="small" style={styles.inputLabel}>
                {f.label}
              </ThemedText>
              <View style={{ position: 'relative', flex: 1 }}>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: theme.backgroundElement,
                      color: theme.text,
                      borderColor: activeField === f.key ? '#3c87f7' : theme.backgroundSelected,
                      paddingRight: 28,
                    },
                  ]}
                  value={inputs[f.key] || ''}
                  onChangeText={val => handleInputChange(f.key, val)}
                  placeholder={f.placeholder}
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="decimal-pad"
                  onFocus={() => setActiveField(f.key)}
                  onBlur={() => setActiveField(null)}
                />
                <View style={styles.inputSuffix}>
                  <ThemedText type="small" themeColor="textSecondary">{unit}</ThemedText>
                </View>
              </View>
            </View>
          ))}
        </View>
      );
    }

    return null;
  };

  const parseSideNum = (val?: string) => {
    if (!val) return 0;
    const parts = val.split('.');
    const feet = parseInt(parts[0], 10);
    const inches = parts.length > 1 ? parseInt(parts[1], 10) : 0;
    if (isNaN(feet) && isNaN(inches)) return 0;
    let total = 0;
    if (!isNaN(feet)) total += feet;
    if (!isNaN(inches)) total += inches / 12;
    return total;
  };

  const formatLabel = (val: number, rawValue?: string) => {
    if (rawValue) {
      const parts = rawValue.split('.');
      const ft = parseInt(parts[0], 10);
      const inch = parts.length > 1 ? parseInt(parts[1], 10) : 0;
      if (!isNaN(ft)) {
        if (inch > 0) return `${ft} ft ${inch} in`;
        return `${ft} ft`;
      }
    }
    if (isNaN(val) || val <= 0) return '0 ft';
    const ft = Math.floor(val);
    const inch = Math.round((val - ft) * 12 * 10) / 10;
    if (inch > 0) {
      return `${ft} ft ${inch} in`;
    }
    return `${ft} ft`;
  };

  const sideData = useMemo(() => {
    let aNum = 0;
    let bNum = 0;
    let cNum = 0;

    if (calculationResult.solvedTriangle && calculationResult.isValid) {
      aNum = calculationResult.solvedTriangle.a;
      bNum = calculationResult.solvedTriangle.b;
      cNum = calculationResult.solvedTriangle.c;
    } else {
      if (selectedShape === 'triangle' && unit === 'ft') {
        aNum = parseSideNum(inputs.sideA);
        bNum = parseSideNum(inputs.sideB);
        cNum = parseSideNum(inputs.sideC);
      } else {
        aNum = parseFloat(inputs.sideA || inputs.base || inputs.length || inputs.diagonal || '0') || 0;
        bNum = parseFloat(inputs.sideB || inputs.height || inputs.width || inputs.h1 || '0') || 0;
        cNum = parseFloat(inputs.sideC || inputs.h2 || '0') || 0;
      }
    }

    const s = [aNum.toString(), bNum.toString(), cNum.toString()];
    let sideLabels: string[] | undefined;
    if (selectedShape === 'triangle' && unit === 'ft') {
      sideLabels = [
        formatLabel(aNum, inputs.sideA),
        formatLabel(bNum, inputs.sideB),
        formatLabel(cNum, inputs.sideC),
      ];
    }

    return { sides: s, sideLabels };
  }, [selectedShape, unit, inputs, calculationResult]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        {/* Compact header that appears on scroll */}
        <Animated.View
          style={[
            styles.compactHeader,
            {
              backgroundColor: theme.backgroundElement,
              borderBottomColor: theme.backgroundSelected,
              opacity: compactOpacity,
              transform: [{ translateY: compactTranslateY }],
            },
          ]}
          pointerEvents="none"
        >
          <View style={styles.compactHeaderInner}>
            <ThemedText
              type="default"
              style={[
                styles.compactHeaderText,
                { color: '#3c87f7' },
              ]}
            >
              {selectedShape.charAt(0).toUpperCase() + selectedShape.slice(1)}
            </ThemedText>
            <ThemedText
              type="default"
              style={[
                styles.compactHeaderText,
                { color: theme.textSecondary, marginHorizontal: 6 },
              ]}
            >
              ·
            </ThemedText>
            <ThemedText
              type="default"
              style={[
                styles.compactHeaderText,
                { color: theme.text },
              ]}
            >
              {unit}
            </ThemedText>
          </View>
        </Animated.View>

        <Animated.ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true }
          )}
          scrollEventThrottle={16}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <ThemedText type="subtitle" style={styles.headerTitle}>
                Area Finder
              </ThemedText>
              <View style={styles.badge}>
                <ThemedText type="code" style={styles.badgeText}>
                  v1.0
                </ThemedText>
              </View>
            </View>
            <ThemedText themeColor="textSecondary" style={styles.headerSubtitle}>
              Select a geometric shape and enter its dimensions to calculate the area.
            </ThemedText>
          </View>

          {/* Collapsible Section: Unit Selector + Shape Cards */}
          <Animated.View
            style={[
              styles.collapsibleSection,
              {
                opacity: collapsibleOpacity,
                transform: [{ translateY: collapsibleTranslateY }],
              },
            ]}
          >
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

            {/* Horizontal Shape Cards */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.shapeSelectorScroll}
            >
              {SHAPES.map(s => {
                const isSelected = selectedShape === s.type;
                const iconColor = isSelected ? '#ffffff' : theme.text;
                return (
                  <Pressable
                    key={s.type}
                    onPress={() => handleShapeSelect(s.type)}
                    style={[
                      styles.shapeCard,
                      {
                        backgroundColor: isSelected ? '#3c87f7' : theme.backgroundElement,
                        borderColor: isSelected ? '#3c87f7' : theme.backgroundSelected,
                      },
                    ]}
                  >
                    {isSelected && (
                      <View style={styles.checkmarkBadge}>
                        <SymbolView name="checkmark.circle.fill" size={14} tintColor="#ffffff" />
                      </View>
                    )}

                    <View style={styles.shapeIconCenterContainer}>
                      <ShapeIcon type={s.type} color={iconColor} />
                    </View>

                    <View style={styles.shapeCardTextContainer}>
                      <ThemedText
                        type="smallBold"
                        style={[styles.shapeCardLabel, { color: isSelected ? '#ffffff' : theme.text }]}
                      >
                        {s.label}
                      </ThemedText>

                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Animated.View>

          {/* Live Visualization Diagram */}
          <View style={styles.card}>
            <ThemedText type="smallBold" style={styles.cardTitle}>
              Interactive Diagram
            </ThemedText>
            <ShapeDiagram
              shape={selectedShape}
              activeField={activeField}
              sides={sideData.sides}
              sideLabels={sideData.sideLabels}
            />
          </View>

          {/* Dimension Form Fields */}
          <View style={styles.card}>
            <View style={styles.formHeaderRow}>
              <ThemedText type="smallBold" style={styles.cardTitle}>
                Enter Dimensions
              </ThemedText>
              <Pressable
                onPress={() => setInputs({})}
                style={styles.clearButton}
              >
                <ThemedText type="small" style={{ color: '#ff4d4f' }}>
                  Clear All
                </ThemedText>
              </Pressable>
            </View>
            {renderInputFields()}
          </View>

          {/* Live Result and Step-by-Step Solution */}
          <View style={[styles.card, styles.resultCard, { borderColor: '#3c87f7' }]}>
            <ThemedText type="smallBold" style={styles.resultTitle}>
              Calculation Result
            </ThemedText>
            <View style={styles.resultContainer}>
              {calculationResult.hasInputs ? (
                <View>
                  {calculationResult.isValid ? (
                    <>
                      <View style={styles.totalSqFtRow}>
                        <ThemedText type="defaultSemiBold" style={styles.totalSqFtLabel}>
                          Total Sq Foot
                        </ThemedText>
                        <ThemedText type="title" style={styles.resultValue}>
                          {(calculationResult.areaInSqM * 10.7639).toFixed(2)}{' '}
                          <ThemedText type="subtitle" style={styles.resultUnit}>
                            sq ft
                          </ThemedText>
                        </ThemedText>
                      </View>
                    </>
                  ) : (
                    <View style={styles.invalidContainer}>
                      <SymbolView name="exclamationmark.triangle.fill" size={24} tintColor="#ff4d4f" />
                      <ThemedText style={styles.invalidText}>
                        Invalid Geometry Constraint
                      </ThemedText>
                    </View>
                  )}

                  {/* Converted Area Formats */}
                  {renderAreaConversions()}
                </View>
              ) : (
                <View style={styles.waitingContainer}>
                  <SymbolView name="square.and.pencil" size={28} tintColor={theme.textSecondary} />
                  <ThemedText themeColor="textSecondary" style={styles.waitingText}>
                    Please enter positive values for all dimensions to see the step-by-step solution.
                  </ThemedText>
                </View>
              )}
            </View>
          </View>
        </Animated.ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  invalidContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginVertical: Spacing.one,
  },
  invalidText: {
    color: '#ff4d4f',
    fontWeight: '700',
    fontSize: 16,
  },
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
  shapeSelectorScroll: {
    gap: Spacing.two,
    paddingRight: Spacing.four,
  },
  shapeCard: {
    width: 100,
    height: 95,
    padding: Spacing.two,
    borderRadius: Spacing.three,
    borderWidth: 1.5,
    position: 'relative',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  checkmarkBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    zIndex: 1,
  },
  shapeIconCenterContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: Spacing.one,
  },
  shapeCardTextContainer: {
    alignItems: 'center',
    width: '100%',
  },
  shapeCardLabel: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  shapeCardDesc: {
    fontSize: 9,
    textAlign: 'center',
    marginTop: 2,
  },
  card: {
    padding: Spacing.three,
    borderRadius: Spacing.four,
    borderWidth: 1.5,
    borderColor: 'rgba(128,128,128,0.15)',
    gap: Spacing.three,
  },
  cardTitle: {
    fontSize: 14,
    opacity: 0.8,
  },
  formHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  clearButton: {
    paddingVertical: Spacing.half,
    paddingHorizontal: Spacing.two,
  },
  inputsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  inputContainer: {
    width: '48%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  inputLabel: {
    fontSize: 13,
    minWidth: 52,
  },
  textInput: {
    height: 42,
    borderWidth: 1.5,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: 0,
    fontSize: 16,
    flex: 1,
  },
  inputSuffix: {
    position: 'absolute',
    right: 8,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    pointerEvents: 'none',
  },

  // Triangle sides
  sidesSection: {
    gap: Spacing.two,
  },
  sideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  sideLabel: {
    fontSize: 14,
    fontWeight: '600',
    minWidth: 52,
  },

  // Triangle angles display
  anglesSection: {
    marginTop: Spacing.two,
  },
  anglesRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  angleItem: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.one,
  },
  angleLabel: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: '#3c87f7',
  },
  angleValueBox: {
    width: '100%',
    height: 42,
    borderWidth: 1.5,
    borderRadius: Spacing.two,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.two,
  },
  angleValue: {
    fontSize: 16,
    fontWeight: '700',
  },

  resultCard: {
    borderWidth: 2,
  },
  resultTitle: {
    fontSize: 14,
    color: '#3c87f7',
  },
  resultContainer: {
    minHeight: 100,
    justifyContent: 'center',
  },
  resultValue: {
    fontWeight: '700',
    color: '#3c87f7',
  },
  resultUnit: {
    fontWeight: '600',
  },
  formulaText: {
    marginTop: Spacing.one,
    fontSize: 13,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(128,128,128,0.15)',
    marginVertical: Spacing.three,
  },
  stepsTitle: {
    fontSize: 13,
    marginBottom: Spacing.two,
  },
  stepsContainer: {
    gap: Spacing.two,
  },
  stepRow: {
    lineHeight: 20,
  },
  waitingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.four,
    gap: Spacing.two,
  },
  waitingText: {
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 18,
    maxWidth: 260,
  },
  compactHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    borderBottomWidth: 1,
    zIndex: 10,
  },
  compactHeaderText: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  compactHeaderInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  collapsibleSection: {
    gap: Spacing.four,
  },

  // Total Sq Ft row
  totalSqFtRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.two,
  },
  totalSqFtLabel: {
    fontSize: 15,
    color: '#3c87f7',
  },

  // Conversions single column list
  conversionsSection: {
    marginTop: 16,
  },
  conversionsList: {
    gap: Spacing.one,
    marginTop: Spacing.two,
  },
  conversionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
    borderWidth: 1,
  },
  conversionLabel: {
    fontSize: 15,
  },
  conversionValue: {
    fontSize: 15,
    color: '#3c87f7',
  },
});