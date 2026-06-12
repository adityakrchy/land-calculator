import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import {
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
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ShapeType = 'triangle' // | 'rectangle' | 'parallelogram' | 'trapezoid' | 'quadrilateral';

interface InputFields {
  base?: string;
  height?: string;
  length?: string;
  width?: string;
  sideA?: string; // Top base for Trapezoid, Side a for Triangle
  sideA_in?: string; // Inches part of sideA (when unit is feet)
  sideB?: string; // Bottom base for Trapezoid, Side b for Triangle
  sideB_in?: string; // Inches part of sideB (when unit is feet)
  sideC?: string; // Side c for Triangle
  sideC_in?: string; // Inches part of sideC (when unit is feet)
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
        const parseSide = (feetVal?: string, inchVal?: string) => {
          const feet = parseAsNaN(feetVal);
          const inch = parseAsNaN(inchVal);
          if (isNaN(feet) && isNaN(inch)) return NaN;
          let total = 0;
          if (!isNaN(feet)) total += feet;
          if (!isNaN(inch)) {
            // Per user request: divide inch value by 1.2 so that the actual value could be calculated (since 12 inch is 1 feet).
            // Change 1.2 to 12 if you wish to use standard mathematical feet-to-inches conversion.
            total += inch / 1.2;
          }
          return total;
        };

        let a = unit === 'ft' ? parseSide(inputs.sideA, inputs.sideA_in) : parseAsNaN(inputs.sideA);
        let b = unit === 'ft' ? parseSide(inputs.sideB, inputs.sideB_in) : parseAsNaN(inputs.sideB);
        let c = unit === 'ft' ? parseSide(inputs.sideC, inputs.sideC_in) : parseAsNaN(inputs.sideC);
        let A = parseAsNaN(inputs.angleA);
        let B = parseAsNaN(inputs.angleB);
        let C = parseAsNaN(inputs.angleC);

        const knownCount = [a, b, c, A, B, C].filter(n => !isNaN(n)).length;
        hasInputs = knownCount >= 3;

        const solved = solveTriangleParams(a, b, c, A, B, C);
        solvedTriangle = solved;

        a = solved.a; b = solved.b; c = solved.c;

        const isTriangleInequalityValid = !isNaN(a) && !isNaN(b) && !isNaN(c) && a + b > c && a + c > b && b + c > a;
        isValid = isTriangleInequalityValid;

        if (isValid) {
          const s = (a + b + c) / 2;
          const val = s * (s - a) * (s - b) * (s - c);
          area = Math.sqrt(val);
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

    // Base Area
    const sqM = areaInSqM;
    const sqYd = sqM * 1.19599;
    const hectare = sqM / 10000;
    const are = sqM / 100;
    const sqFt = sqM * 10.7639;
    const acre = sqFt / 43560;
    const cent = acre * 100;

    // Darbhanga Standard: 1 Katha = 1901.25 sq ft
    const katha = sqFt / 1901.25;
    const bigha = katha / 20;

    const formattedUnits = [
      { label: 'Square Mtr', value: sqM.toFixed(2) },
      { label: 'Square Yard', value: sqYd.toFixed(2) },
      { label: 'Hectare', value: hectare.toFixed(4) },
      { label: 'Are', value: are.toFixed(4) },
      { label: 'Square Ft', value: sqFt.toFixed(2) },
      { label: 'Acre', value: acre.toFixed(4) },
      { label: 'Cent/Decimal', value: cent.toFixed(2) },
      { label: 'Katha', value: katha.toFixed(2), note: 'Darbhanga Std' },
      { label: 'Bigha', value: bigha.toFixed(2), note: 'Darbhanga Std' },
    ];

    return (
      <View style={{ marginTop: 16 }}>
        <View style={styles.divider} />
        <ThemedText type="smallBold" style={styles.stepsTitle}>
          Converted Land Area:
        </ThemedText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, gap: 8 }}>
          {formattedUnits.map((item, idx) => (
            <View key={idx} style={{ flexGrow: 1, minWidth: '45%', backgroundColor: 'rgba(60, 135, 247, 0.05)', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(60, 135, 247, 0.1)' }}>
              <ThemedText type="small" themeColor="textSecondary">{item.label}</ThemedText>
              {/* <ThemedText type="defaultSemiBold" style={{ marginTop: 2 }}>{item.value}</ThemedText> */}
              {item.note && (
                <ThemedText type="small" style={{ color: '#888', fontSize: 10, marginTop: 4 }}>
                  {item.note}
                </ThemedText>
              )}
            </View>
          ))}
        </View>
      </View>
    );
  };

  // Dynamic input fields helper based on selected shape
  const renderInputFields = () => {
    if (selectedShape === 'triangle' && unit === 'ft') {
      const s = calculationResult.solvedTriangle;
      
      const renderSplitInput = (
        feetKey: 'sideA' | 'sideB' | 'sideC',
        inchKey: 'sideA_in' | 'sideB_in' | 'sideC_in',
        label: string,
        solvedVal?: number
      ) => {
        let ftPlaceholder = 'e.g. 5';
        let inPlaceholder = 'e.g. 7';
        if (solvedVal && !isNaN(solvedVal) && !inputs[feetKey] && !inputs[inchKey]) {
          const solvedFt = Math.floor(solvedVal);
          const solvedIn = Math.round((solvedVal - solvedFt) * 1.2 * 10) / 10;
          ftPlaceholder = solvedFt.toString();
          inPlaceholder = solvedIn.toString();
        }

        return (
          <View key={feetKey} style={styles.inputContainer}>
            <ThemedText type="smallBold" style={styles.inputLabel}>
              {label}
            </ThemedText>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1, position: 'relative' }}>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: theme.backgroundElement,
                      color: theme.text,
                      borderColor: activeField === feetKey ? '#3c87f7' : theme.backgroundSelected,
                      paddingRight: 28,
                    },
                  ]}
                  value={inputs[feetKey] || ''}
                  onChangeText={val => handleInputChange(feetKey, val)}
                  placeholder={ftPlaceholder}
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="decimal-pad"
                  onFocus={() => setActiveField(feetKey)}
                  onBlur={() => setActiveField(null)}
                />
                <View style={{ position: 'absolute', right: 10, top: 0, bottom: 0, justifyContent: 'center', pointerEvents: 'none' }}>
                  <ThemedText type="small" themeColor="textSecondary">ft</ThemedText>
                </View>
              </View>
              <View style={{ flex: 1, position: 'relative' }}>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: theme.backgroundElement,
                      color: theme.text,
                      borderColor: activeField === inchKey ? '#3c87f7' : theme.backgroundSelected,
                      paddingRight: 28,
                    },
                  ]}
                  value={inputs[inchKey] || ''}
                  onChangeText={val => handleInputChange(inchKey, val)}
                  placeholder={inPlaceholder}
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="decimal-pad"
                  onFocus={() => setActiveField(inchKey)}
                  onBlur={() => setActiveField(null)}
                />
                <View style={{ position: 'absolute', right: 10, top: 0, bottom: 0, justifyContent: 'center', pointerEvents: 'none' }}>
                  <ThemedText type="small" themeColor="textSecondary">in</ThemedText>
                </View>
              </View>
            </View>
          </View>
        );
      };

      return (
        <View style={styles.inputsGrid}>
          {renderSplitInput('sideA', 'sideA_in', 'Side A', s?.a)}
          {renderSplitInput('sideB', 'sideB_in', 'Side B', s?.b)}
          {renderSplitInput('sideC', 'sideC_in', 'Side C', s?.c)}
          
          {[
            { key: 'angleA' as const, label: 'Angle A (°)', placeholder: (s && !isNaN(s.A) && !inputs.angleA) ? s.A.toFixed(1) : 'e.g. 90' },
            { key: 'angleB' as const, label: 'Angle B (°)', placeholder: (s && !isNaN(s.B) && !inputs.angleB) ? s.B.toFixed(1) : 'e.g. 53' },
            { key: 'angleC' as const, label: 'Angle C (°)', placeholder: (s && !isNaN(s.C) && !inputs.angleC) ? s.C.toFixed(1) : 'e.g. 37' },
          ].map(f => (
            <View key={f.key} style={styles.inputContainer}>
              <ThemedText type="smallBold" style={styles.inputLabel}>
                {f.label}
              </ThemedText>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: theme.backgroundElement,
                    color: theme.text,
                    borderColor: activeField === f.key ? '#3c87f7' : theme.backgroundSelected,
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
            </View>
          ))}
        </View>
      );
    }

    const fields: { key: keyof InputFields; label: string; placeholder: string }[] = [];

    if (selectedShape === 'triangle') {
      const s = calculationResult.solvedTriangle;
      fields.push(
        { key: 'sideA', label: `Side A`, placeholder: (s && !isNaN(s.a) && !inputs.sideA) ? s.a.toFixed(2) : 'e.g. 5' },
        { key: 'sideB', label: 'Side B', placeholder: (s && !isNaN(s.b) && !inputs.sideB) ? s.b.toFixed(2) : 'e.g. 6' },
        { key: 'sideC', label: 'Side C', placeholder: (s && !isNaN(s.c) && !inputs.sideC) ? s.c.toFixed(2) : 'e.g. 7' },
        { key: 'angleA', label: `Angle A (°)`, placeholder: (s && !isNaN(s.A) && !inputs.angleA) ? s.A.toFixed(1) : 'e.g. 90' },
        { key: 'angleB', label: 'Angle B (°)', placeholder: (s && !isNaN(s.B) && !inputs.angleB) ? s.B.toFixed(1) : 'e.g. 53' },
        { key: 'angleC', label: 'Angle C (°)', placeholder: (s && !isNaN(s.C) && !inputs.angleC) ? s.C.toFixed(1) : 'e.g. 37' }
      );
    } else if (selectedShape === 'rectangle') {
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

    return (
      <View style={styles.inputsGrid}>
        {fields.map(f => (
          <View key={f.key} style={styles.inputContainer}>
            <ThemedText type="smallBold" style={styles.inputLabel}>
              {f.label}
            </ThemedText>
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: theme.backgroundElement,
                  color: theme.text,
                  borderColor: activeField === f.key ? '#3c87f7' : theme.backgroundSelected,
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
          </View>
        ))}
      </View>
    );
  };

  const sideData = useMemo(() => {
    if (selectedShape !== 'triangle' || unit !== 'ft') {
      const s =
        selectedShape === 'triangle' && calculationResult.solvedTriangle && calculationResult.isValid
          ? [
              calculationResult.solvedTriangle.a.toString(),
              calculationResult.solvedTriangle.b.toString(),
              calculationResult.solvedTriangle.c.toString(),
            ]
          : [
              inputs.sideA || inputs.base || inputs.length || inputs.diagonal || '0',
              inputs.sideB || inputs.height || inputs.width || inputs.h1 || '0',
              inputs.sideC || inputs.h2 || '0',
            ];
      return { sides: s, sideLabels: undefined };
    }

    const parseSideNum = (feetVal?: string, inchVal?: string) => {
      const feet = parseFloat(feetVal || '0');
      const inch = parseFloat(inchVal || '0');
      if (isNaN(feet) && isNaN(inch)) return 0;
      let total = 0;
      if (!isNaN(feet)) total += feet;
      if (!isNaN(inch)) total += inch / 1.2;
      return total;
    };

    const formatLabel = (val: number, rawFt?: string, rawIn?: string) => {
      if (rawFt || rawIn) {
        const parts = [];
        if (rawFt) parts.push(`${rawFt} ft`);
        if (rawIn) parts.push(`${rawIn} in`);
        return parts.join(' ');
      }
      if (isNaN(val) || val <= 0) return '0 ft';
      const ft = Math.floor(val);
      const inch = Math.round((val - ft) * 1.2 * 10) / 10;
      if (inch > 0) {
        return `${ft} ft ${inch} in`;
      }
      return `${ft} ft`;
    };

    let aNum = 0;
    let bNum = 0;
    let cNum = 0;
    if (calculationResult.solvedTriangle && calculationResult.isValid) {
      aNum = calculationResult.solvedTriangle.a;
      bNum = calculationResult.solvedTriangle.b;
      cNum = calculationResult.solvedTriangle.c;
    } else {
      aNum = parseSideNum(inputs.sideA, inputs.sideA_in);
      bNum = parseSideNum(inputs.sideB, inputs.sideB_in);
      cNum = parseSideNum(inputs.sideC, inputs.sideC_in);
    }

    const s = [aNum.toString(), bNum.toString(), cNum.toString()];
    const sideLabels = [
      formatLabel(aNum, inputs.sideA, inputs.sideA_in),
      formatLabel(bNum, inputs.sideB, inputs.sideB_in),
      formatLabel(cNum, inputs.sideC, inputs.sideC_in),
    ];

    return { sides: s, sideLabels };
  }, [selectedShape, unit, inputs, calculationResult]);

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
                      <ThemedText type="title" style={styles.resultValue}>
                        {calculationResult.area.toFixed(2)}{' '}
                        <ThemedText type="subtitle" style={styles.resultUnit}>
                          {unit}²
                        </ThemedText>
                      </ThemedText>
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
        </ScrollView>
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
    gap: Spacing.two,
  },
  inputContainer: {
    gap: Spacing.one,
  },
  inputLabel: {
    fontSize: 12,
  },
  textInput: {
    height: 48,
    borderWidth: 1.5,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
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
});
