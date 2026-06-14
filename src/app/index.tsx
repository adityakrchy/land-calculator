import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useState } from 'react';
import {
  BackHandler,
  Modal,
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
import { calculateArea, calculateInteriorAngles, calculateQuadrilateralByDiagonal, generatePolygon, generateTriangle, validatePolygonSides } from '@/utils/geometry';

type ShapeType = 'triangle' | 'right-angled-triangle' | 'scalene-triangle' | 'quadrilateral' | 'polygon' | 'circle';

interface InputFields {
  base?: string;
  height?: string;
  length?: string;
  width?: string;
  sideA?: string; // Top base for Trapezoid, Side a for Triangle, AB for Quadrilateral
  sideB?: string; // Bottom base for Trapezoid, Side b for Triangle, BC for Quadrilateral
  sideC?: string; // Side c for Triangle, CD for Quadrilateral
  sideD?: string; // DA for Quadrilateral
  angleA?: string;
  angleB?: string;
  angleC?: string;
  diagonal?: string;
  h1?: string;
  h2?: string;
}

// Parse dhur value from a hand unit string like "6.5 hand (9.75 ft)"
// Returns null when the hand unit is missing or unparseable (error).
// Returns { ft: null, dhur: null } when "Standard" is selected (dhur intentionally absent).
function parseDhurFromHandUnit(handUnit?: string, customDhurSqFt?: string): { ft: number | null; dhur: number | null; isStandard: boolean } | null {
  if (!handUnit) return null;
  if (handUnit === 'Standard') return { ft: null, dhur: null, isStandard: true };
  if (handUnit === 'Custom') {
    if (!customDhurSqFt) return null;
    const sqFt = parseFloat(customDhurSqFt);
    if (isNaN(sqFt) || sqFt <= 0) return null;
    return { ft: null, dhur: sqFt, isStandard: false };
  }
  const match = handUnit.match(/\(([\d.]+)\s*ft\)/);
  if (!match) return null;
  const ft = parseFloat(match[1]);
  if (isNaN(ft) || ft <= 0) return null;
  return { ft, dhur: ft * ft, isStandard: false };
}

// In-memory cache: persists inputs per shape across component re-mounts during navigation
const shapeInputsCache: Record<string, InputFields> = {};
const shapeDiagonalKeyCache: Record<string, 'AC' | 'BD'> = {};
const shapeProceedNoDiagCache: Record<string, boolean> = {};
const shapePolygonSidesCache: Record<string, string[]> = {};
const shapePolygonCountCache: Record<string, number> = {};
const shapePolygonDiagonalsCache: Record<string, Record<string, string>> = {};
const shapePolygonDiagKeysCache: Record<string, string[]> = {};
const shapeCircleDiameterCache: Record<string, string> = {};

/**
 * Generates all possible diagonal keys for an N-sided polygon.
 * Returns array of { key, from, to } where from/to are vertex indices and
 * key is e.g. "AC", "BD" etc.
 * Number of diagonals for N sides = N(N-3)/2.
 */
function generatePolygonDiagonals(N: number): { key: string; from: number; to: number }[] {
  const diags: { key: string; from: number; to: number }[] = [];
  for (let i = 0; i < N; i++) {
    for (let j = i + 2; j < N; j++) {
      // Skip the edge that wraps around (last vertex to first)
      if (i === 0 && j === N - 1) continue;
      diags.push({
        key: `${String.fromCharCode(65 + i)}${String.fromCharCode(65 + j)}`,
        from: i,
        to: j,
      });
    }
  }
  return diags;
}

export default function HomeScreen() {
  const params = useLocalSearchParams<{ unit?: string; shape?: string; handUnit?: string; customDhurSqFt?: string }>();
  const theme = useTheme();
  const [selectedShape, setSelectedShape] = useState<ShapeType>('triangle');
  const [unit, setUnit] = useState<string>('m');
  const [handUnit, setHandUnit] = useState<string>('');
  const [customDhurSqFt, setCustomDhurSqFt] = useState<string>('');
  const [activeField, setActiveField] = useState<string | null>(null);
  const [inputs, setInputs] = useState<InputFields>({});
  const [diagonalKey, setDiagonalKey] = useState<'AC' | 'BD'>('AC');
  const [showDiagonalPicker, setShowDiagonalPicker] = useState(false);
  const [proceedWithoutDiagonal, setProceedWithoutDiagonal] = useState(false);

  // Polygon state
  const [polygonSideCount, setPolygonSideCount] = useState(3);
  const [polygonSides, setPolygonSides] = useState<string[]>(['', '', '']);
  const [polygonDiagonals, setPolygonDiagonals] = useState<Record<string, string>>({});
  const [polygonDiagKeys, setPolygonDiagKeys] = useState<string[]>([]);
  const [activeDiagSlot, setActiveDiagSlot] = useState<number | null>(null);
  const [proceedWithoutPolygonDiagonals, setProceedWithoutPolygonDiagonals] = useState(false);
  const [circleDiameter, setCircleDiameter] = useState('');

  // Redirect to setup if no params provided
  useEffect(() => {
    if (!params.shape || !params.unit) {
      router.replace('/setup');
    } else {
      setSelectedShape(params.shape as ShapeType);
      setUnit(params.unit);
      setHandUnit(params.handUnit || '');
      setCustomDhurSqFt(params.customDhurSqFt || '');
    }
  }, [params.shape, params.unit, params.handUnit, params.customDhurSqFt]);

  // Restore last inputs for this shape from in-memory cache
  useEffect(() => {
    if (!params.shape || !params.unit) return;
    const cached = shapeInputsCache[params.shape];
    if (cached && Object.keys(cached).length > 0) {
      setInputs(cached);
    }
    const cachedKey = shapeDiagonalKeyCache[params.shape];
    if (cachedKey) {
      setDiagonalKey(cachedKey);
    }
    const cachedProceed = shapeProceedNoDiagCache[params.shape];
    if (cachedProceed) {
      setProceedWithoutDiagonal(true);
    } else {
      setProceedWithoutDiagonal(false);
    }
    const cachedPolySides = shapePolygonSidesCache[params.shape];
    if (cachedPolySides) {
      setPolygonSides(cachedPolySides);
    }
    const cachedPolyCount = shapePolygonCountCache[params.shape];
    if (cachedPolyCount) {
      setPolygonSideCount(cachedPolyCount);
    }
    const cachedPolyDiagonals = shapePolygonDiagonalsCache[params.shape];
    if (cachedPolyDiagonals) {
      setPolygonDiagonals(cachedPolyDiagonals);
    }
    const cachedPolyDiagKeys = shapePolygonDiagKeysCache[params.shape];
    if (cachedPolyDiagKeys) {
      setPolygonDiagKeys(cachedPolyDiagKeys);
    }
    const cachedDiameter = shapeCircleDiameterCache[params.shape];
    if (cachedDiameter !== undefined) {
      setCircleDiameter(cachedDiameter);
    }
  }, [params.shape]);

  // Initialize polygon diagonal slot keys when side count changes and none are set
  useEffect(() => {
    if (selectedShape === 'polygon' && polygonDiagKeys.length === 0 && polygonSideCount >= 4) {
      const keys: string[] = [];
      for (let i = 2; i < polygonSideCount - 1; i++) {
        keys.push(`A${String.fromCharCode(65 + i)}`);
      }
      setPolygonDiagKeys(keys);
      shapePolygonDiagKeysCache[selectedShape] = keys;
    }
  }, [selectedShape, polygonSideCount, polygonDiagKeys.length]);

  // Handle hardware back button on Android — go back to setup instead of quitting
  useEffect(() => {
    const onBackPress = () => {
      router.back();
      return true; // prevent default (exiting the app)
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, []);

  const handleInputChange = (field: keyof InputFields, value: string) => {
    // Only allow numbers and decimal point
    const cleanValue = value.replace(/[^0-9.]/g, '');

    // Ensure only one decimal point
    const parts = cleanValue.split('.');
    const formattedValue = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : cleanValue;

    const newInputs = {
      ...inputs,
      [field]: formattedValue,
    };
    setInputs(newInputs);
    // Persist to in-memory cache so it survives component re-mounts during navigation
    shapeInputsCache[selectedShape] = newInputs;

    // If user starts typing a diagonal, reset the "proceed without diagonal" flag
    if (field === 'diagonal' && formattedValue) {
      setProceedWithoutDiagonal(false);
      shapeProceedNoDiagCache[selectedShape] = false;
    }
  };

  // Parse dhur from the selected hand unit
  const dhurInfo = parseDhurFromHandUnit(handUnit, customDhurSqFt);

  // Perform Calculation & Build Step-by-Step Explanation
  const calculationResult = useMemo(() => {
    let area = 0;
    let areaInSqM = 0;
    let isValid = false;
    let isDhurValid = false;
    let dhurSqFt = 0;
    let hasInputs = false;
    let solvedTriangle: { a: number; b: number; c: number; A: number; B: number; C: number } | null = null;
    let solvedQuad: { a: number; b: number; c: number; d: number; A: number; B: number; C: number; D: number } | null = null;
    let polygonDiagValidation: Record<string, number> = {};

    const toRad = Math.PI / 180;
    const toDeg = 180 / Math.PI;

    function solveTriangleParams(a: number, b: number, c: number, A: number, B: number, C: number) {
      // Variable mapping: a=sA (AB), b=sB (BC), c=sC (AC)
      // A=angleA (∠A next to AB), B=angleB (∠B next to BC), C=angleC (∠C next to AC)
      // Geometric vertex labels (from generateTriangle):
      //   AB (a) & BC (b) meet at B → included angle = ∠B
      //   BC (b) & AC (c) meet at C → included angle = ∠C
      //   AB (a) & AC (c) meet at A → included angle = ∠A
      let knownCount = [a, b, c, A, B, C].filter(n => !isNaN(n)).length;
      if (knownCount < 3) return { a, b, c, A, B, C };

      for (let i = 0; i < 4; i++) {
        if (!isNaN(A) && !isNaN(B) && isNaN(C)) C = 180 - A - B;
        if (!isNaN(A) && !isNaN(C) && isNaN(B)) B = 180 - A - C;
        if (!isNaN(B) && !isNaN(C) && isNaN(A)) A = 180 - B - C;

        // Law of Cosines: a² = b² + c² - 2bc·cos(included angle)
        // a (AB) from b (BC), c (AC): included angle at C = ∠C
        if (!isNaN(b) && !isNaN(c) && !isNaN(C) && isNaN(a)) a = Math.sqrt(b * b + c * c - 2 * b * c * Math.cos(C * toRad));
        // b (BC) from a (AB), c (AC): included angle at A = ∠A
        if (!isNaN(a) && !isNaN(c) && !isNaN(A) && isNaN(b)) b = Math.sqrt(a * a + c * c - 2 * a * c * Math.cos(A * toRad));
        // c (AC) from a (AB), b (BC): included angle at B = ∠B
        if (!isNaN(a) && !isNaN(b) && !isNaN(B) && isNaN(c)) c = Math.sqrt(a * a + b * b - 2 * a * b * Math.cos(B * toRad));

        // Law of Sines fallback for missing sides
        let R = NaN;
        if (!isNaN(a) && !isNaN(C) && C > 0 && C < 180) R = a / Math.sin(C * toRad);
        else if (!isNaN(b) && !isNaN(A) && A > 0 && A < 180) R = b / Math.sin(A * toRad);
        else if (!isNaN(c) && !isNaN(B) && B > 0 && B < 180) R = c / Math.sin(B * toRad);

        if (!isNaN(R)) {
          if (!isNaN(C) && isNaN(a)) a = R * Math.sin(C * toRad);
          if (!isNaN(A) && isNaN(b)) b = R * Math.sin(A * toRad);
          if (!isNaN(B) && isNaN(c)) c = R * Math.sin(B * toRad);
        }

        // Always recompute ALL angles from Law of Cosines when all 3 sides are known.
        // angle opposite AB (a) is at vertex C → ∠C
        // angle opposite BC (b) is at vertex A → ∠A
        // angle opposite AC (c) is at vertex B → ∠B
        if (!isNaN(a) && !isNaN(b) && !isNaN(c)) {
          C = Math.acos((b * b + c * c - a * a) / (2 * b * c)) * toDeg;
          A = Math.acos((a * a + c * c - b * b) / (2 * a * c)) * toDeg;
          B = Math.acos((a * a + b * b - c * c) / (2 * a * b)) * toDeg;
        }

        // SSA fallback: solve for a missing side from 2 known sides + non-included angle
        // c = b·cos(C) ± √(a² - b²·sin²(C)) from Law of Cosines quadratic
        if (isNaN(c) && !isNaN(a) && !isNaN(b) && !isNaN(C) && a > 0 && b > 0 && C > 0 && C < 180) {
          const sinC = Math.sin(C * toRad), cosC = Math.cos(C * toRad);
          const D = a * a - b * b * sinC * sinC;
          if (D >= 0) {
            const sqrtD = Math.sqrt(D), term = b * cosC;
            const roots = [term + sqrtD, term - sqrtD].filter(r => r > 0);
            if (roots.length > 0) c = roots[0];
          }
        }
        if (isNaN(a) && !isNaN(b) && !isNaN(c) && !isNaN(A) && b > 0 && c > 0 && A > 0 && A < 180) {
          const sinA = Math.sin(A * toRad), cosA = Math.cos(A * toRad);
          const D = b * b - c * c * sinA * sinA;
          if (D >= 0) {
            const sqrtD = Math.sqrt(D), term = c * cosA;
            const roots = [term + sqrtD, term - sqrtD].filter(r => r > 0);
            if (roots.length > 0) a = roots[0];
          }
        }
        if (isNaN(b) && !isNaN(a) && !isNaN(c) && !isNaN(B) && a > 0 && c > 0 && B > 0 && B < 180) {
          const sinB = Math.sin(B * toRad), cosB = Math.cos(B * toRad);
          const D = a * a - c * c * sinB * sinB;
          if (D >= 0) {
            const sqrtD = Math.sqrt(D), term = c * cosB;
            const roots = [term + sqrtD, term - sqrtD].filter(r => r > 0);
            if (roots.length > 0) b = roots[0];
          }
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
      case 'scalene-triangle':
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
      case 'right-angled-triangle': {
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
        const ab = unit === 'ft' ? parseSide(inputs.sideA) : parseAsNaN(inputs.sideA);
        const bc = unit === 'ft' ? parseSide(inputs.sideB) : parseAsNaN(inputs.sideB);
        hasInputs = !isNaN(ab) && !isNaN(bc);
        isValid = hasInputs && ab > 0 && bc > 0;
        if (isValid) {
          area = 0.5 * ab * bc;
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
      case 'polygon': {
        const parseSide = (val: string) => {
          if (!val) return NaN;
          if (unit !== 'ft') return parseFloat(val);
          const parts = val.split('.');
          const feet = parseInt(parts[0], 10);
          const inches = parts.length > 1 ? parseInt(parts[1], 10) : 0;
          if (isNaN(feet) && isNaN(inches)) return NaN;
          return (isNaN(feet) ? 0 : feet) + (isNaN(inches) ? 0 : inches / 12);
        };
        const parsed = polygonSides.map(s => parseSide(s));
        const allValid = polygonSideCount >= 3 && parsed.every(v => !isNaN(v) && v > 0);
        hasInputs = allValid && polygonSideCount >= 3;

        if (hasInputs && validatePolygonSides(parsed)) {
          if (polygonSideCount >= 4 && polygonDiagKeys.length > 0) {
            // Check if all N-3 fan diagonals are entered
            const diagVals = polygonDiagKeys
              .map(k => parseSide(polygonDiagonals[k]))
              .filter(v => !isNaN(v) && v > 0);
            const allDiagsEntered = diagVals.length >= polygonSideCount - 3;

            if (allDiagsEntered) {
              // Path 1: Heron triangulation using fan from vertex A
              isValid = true;
              const heron = (a: number, b: number, c: number) => {
                const s = (a + b + c) / 2;
                return Math.sqrt(Math.max(0, s * (s - a) * (s - b) * (s - c)));
              };
              let totalArea = 0;
              totalArea += heron(parsed[0], parsed[1], diagVals[0]);
              for (let i = 1; i < polygonSideCount - 3; i++) {
                totalArea += heron(diagVals[i - 1], parsed[i + 1], diagVals[i]);
              }
              if (polygonSideCount >= 4) {
                totalArea += heron(diagVals[diagVals.length - 1], parsed[polygonSideCount - 2], parsed[polygonSideCount - 1]);
              }
              area = totalArea;
            } else if (proceedWithoutPolygonDiagonals) {
              // Path 2: User acknowledged — use shoelace
              isValid = true;
              const points = generatePolygon(parsed);
              area = calculateArea(points, parsed);
              polygonDiagValidation = {};
              for (const diagKey of polygonDiagKeys) {
                const fromIdx = diagKey.charCodeAt(0) - 65;
                const toIdx = diagKey.charCodeAt(1) - 65;
                if (fromIdx >= 0 && fromIdx < points.length && toIdx >= 0 && toIdx < points.length) {
                  const dx = points[toIdx].x - points[fromIdx].x;
                  const dy = points[toIdx].y - points[fromIdx].y;
                  polygonDiagValidation[diagKey] = Math.sqrt(dx * dx + dy * dy);
                }
              }
            }
            // else: isValid remains false → shows "Proceed without diagonals" button
          } else {
            // Triangles (N=3) or polygon with no diagonal slots: use shoelace
            isValid = true;
            const points = generatePolygon(parsed);
            area = calculateArea(points, parsed);
          }
        }
        break;
      }
      case 'circle': {
        const parseCircleDiameter = () => {
          if (!circleDiameter) return NaN;
          if (unit !== 'ft') return parseFloat(circleDiameter);
          const parts = circleDiameter.split('.');
          const feet = parseInt(parts[0], 10);
          const inches = parts.length > 1 ? parseInt(parts[1], 10) : 0;
          if (isNaN(feet) && isNaN(inches)) return NaN;
          return (isNaN(feet) ? 0 : feet) + (isNaN(inches) ? 0 : inches / 12);
        };
        const d = parseCircleDiameter();
        const isDiameterValid = !isNaN(d) && d > 0;
        hasInputs = isDiameterValid;
        if (isDiameterValid) {
          isValid = true;
          const r = d / 2;
          area = Math.PI * r * r;
        }
        break;
      }
      case 'quadrilateral': {
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

        const s0 = unit === 'ft' ? parseSide(inputs.sideA) : parseAsNaN(inputs.sideA);
        const s1 = unit === 'ft' ? parseSide(inputs.sideB) : parseAsNaN(inputs.sideB);
        const s2 = unit === 'ft' ? parseSide(inputs.sideC) : parseAsNaN(inputs.sideC);
        const s3 = unit === 'ft' ? parseSide(inputs.sideD) : parseAsNaN(inputs.sideD);

        hasInputs = !isNaN(s0) && !isNaN(s1) && !isNaN(s2) && !isNaN(s3);

        if (hasInputs && s0 > 0 && s1 > 0 && s2 > 0 && s3 > 0) {
          const diagVal = unit === 'ft' ? parseSide(inputs.diagonal) : parseAsNaN(inputs.diagonal);
          const hasDiagonal = !isNaN(diagVal) && diagVal > 0 && diagonalKey;

          if (hasDiagonal) {
            // Calculate using Heron's formula (diagonal + two triangles)
            const result = calculateQuadrilateralByDiagonal([s0, s1, s2, s3], diagVal, diagonalKey);
            if (result.valid) {
              isValid = true;
              area = result.area;
            }
          } else if (proceedWithoutDiagonal && validatePolygonSides([s0, s1, s2, s3])) {
            // User explicitly chose to proceed without a diagonal — use shoelace
            isValid = true;
            const points = generatePolygon([s0, s1, s2, s3]);
            area = calculateArea(points, [s0, s1, s2, s3]);
          }

          // Compute geometry display data regardless of method used
          if (isValid) {
            const points = generatePolygon([s0, s1, s2, s3]);
            const angles = calculateInteriorAngles(points);
            solvedQuad = {
              a: s0, b: s1, c: s2, d: s3,
              A: angles[0], B: angles[1], C: angles[2], D: angles[3],
            };
          }
        }
        break;
      }
    }

    // Conversion factors to square meters (m²)
    // Based on squaring the linear conversion factors to meters
    const toMeterFactor: Record<string, number> = {
      'ft': 0.3048,
      'm': 1,
      'kadi': 0.4572,
    };

    if (isValid) {
      const factor = toMeterFactor[unit] || 1;
      areaInSqM = area * (factor * factor);
    }

    // Always compute sq ft as the primary conversion base
    const sqFt = areaInSqM * 10.7639;

    // Validate dhur
    if (dhurInfo) {
      isDhurValid = true;
      dhurSqFt = dhurInfo.isStandard ? 0 : (dhurInfo.dhur ?? 0); // 0 = Standard (no dhur value)
    }

    // Override isValid: only fail if dhurInfo is null (missing/unparseable hand unit)
    // Standard is allowed — it just won't show a dhur conversion
    const finalValid = isValid && (dhurInfo !== null);

    return { area, areaInSqM, sqFt, isValid: finalValid, isDhurValid, dhurSqFt, hasInputs, solvedTriangle, solvedQuad, polygonDiagValidation };
  }, [selectedShape, inputs, unit, dhurInfo, diagonalKey, proceedWithoutDiagonal, polygonSides, polygonSideCount, polygonDiagonals, polygonDiagKeys, circleDiameter]);

  const renderAreaConversions = () => {
    if (!calculationResult.isValid) return null;
    const { sqFt, dhurSqFt } = calculationResult;

    const conversions: { label: string; value: string }[] = [
      { label: 'Kadi Sq', value: (sqFt * 2.29568411386).toFixed(2) },
      { label: 'Cent / Decimal', value: (sqFt / 435.6).toFixed(2) },
      { label: 'Dhur', value: dhurSqFt ? (sqFt / dhurSqFt).toFixed(4) : '—' },
      { label: 'Katha', value: (sqFt / (dhurSqFt * 20)).toFixed(2) },
      { label: 'Bigha', value: (sqFt / (dhurSqFt * 20 * 20)).toFixed(3) },
      // { label: 'Kasma', value: (sqFt / 47.53125).toFixed(2) },
      { label: 'Acre', value: (sqFt / 43560).toFixed(4) },
      { label: 'Hectare', value: (sqFt / 107639).toFixed(4) },
      { label: 'Sq Yard / Gaj', value: (sqFt / 9).toFixed(2) },
      { label: 'Sq Mtr', value: (sqFt / 10.7639).toFixed(2) },
    ];

    return (
      <View style={styles.conversionsSection}>
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
          { key: 'sideA', label: 'Side A', placeholder: (s && !isNaN(s.a) && !inputs.sideA) ? formatFtInput(s.a) : '0.0' },
          { key: 'sideB', label: 'Side B', placeholder: (s && !isNaN(s.b) && !inputs.sideB) ? formatFtInput(s.b) : '0.0' },
          { key: 'sideC', label: 'Side C', placeholder: (s && !isNaN(s.c) && !inputs.sideC) ? formatFtInput(s.c) : '0.0' },
        );
      } else {
        sideFields.push(
          { key: 'sideA', label: 'Side A', placeholder: (s && !isNaN(s.a) && !inputs.sideA) ? s.a.toFixed(2) : '0' },
          { key: 'sideB', label: 'Side B', placeholder: (s && !isNaN(s.b) && !inputs.sideB) ? s.b.toFixed(2) : '0' },
          { key: 'sideC', label: 'Side C', placeholder: (s && !isNaN(s.c) && !inputs.sideC) ? s.c.toFixed(2) : '0' },
        );
      }

      const unitSuffix = unit === 'kadi' ? 'kadi' : unit;

      const hasAngles = s && !isNaN(s.A) && !isNaN(s.B) && !isNaN(s.C) && s.A > 0 && s.B > 0 && s.C > 0;
      const angleLabels = ['A', 'B', 'C'];

      return (
        <View style={styles.triangleRows}>
          {sideFields.map((f, idx) => {
            const label = angleLabels[idx];
            const angleVal = label === 'A' ? s?.A : label === 'B' ? s?.B : s?.C;
            const displayVal = hasAngles ? `${angleVal!.toFixed(1)}°` : '0°';
            return (
              <View key={f.key} style={styles.triangleRow}>
                {/* Side label */}
                <ThemedText type="small" style={styles.triangleRowLabel}>
                  {f.label}
                </ThemedText>
                {/* Side input */}
                <View style={{ position: 'relative', flex: 1 }}>
                  <TextInput
                    style={[
                      styles.textInput,
                      {
                        backgroundColor: theme.backgroundElement,
                        color: theme.text,
                        borderColor: activeField === f.key ? '#3c87f7' : '#000000ff',
                        paddingRight: 28,
                      },
                    ]}
                    value={inputs[f.key] || ''}
                    onChangeText={val => handleInputChange(f.key, val)}
                    placeholder={`${f.placeholder} ${unitSuffix}`}
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="decimal-pad"
                    onFocus={() => setActiveField(f.key)}
                    onBlur={() => setActiveField(null)}
                  />
                  {/* <View style={styles.inputSuffix}>
                    <ThemedText type="small" themeColor="textSecondary">
                      {unitSuffix}
                    </ThemedText>
                  </View> */}
                </View>
                {/* Angle label */}
                <ThemedText type="small" style={styles.triangleRowAngleLabel}>
                  ∠{label}
                </ThemedText>
                {/* Angle value box */}
                <View
                  style={[
                    styles.triangleRowAngleBox,
                    {
                      backgroundColor: theme.backgroundElement,
                      borderColor: activeField === `angle${label}` ? '#3c87f7' : '#000000ff',
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
      );
    }

    if (selectedShape === 'right-angled-triangle') {
      const ab = unit === 'ft' ? parseSideNum(inputs.sideA) : parseFloat(inputs.sideA || '0') || 0;
      const bc = unit === 'ft' ? parseSideNum(inputs.sideB) : parseFloat(inputs.sideB || '0') || 0;
      const ac = ab > 0 && bc > 0 ? Math.sqrt(ab * ab + bc * bc) : 0;
      const hasBoth = ab > 0 && bc > 0;
      const angleA = hasBoth ? Math.atan(bc / ab) * (180 / Math.PI) : 0;
      const angleB = 90;
      const angleC = hasBoth ? 90 - angleA : 0;

      const unitSuffix = unit === 'kadi' ? 'kadi' : unit;

      type SideField = { key: string; label: string; placeholder: string; readonly: boolean };
      const sideFields: SideField[] = [];

      if (unit === 'ft') {
        sideFields.push(
          { key: 'sideA', label: 'AB', placeholder: (hasBoth && !inputs.sideA) ? formatFtInput(ab) : '0.0', readonly: false },
          { key: 'sideB', label: 'BC', placeholder: (hasBoth && !inputs.sideB) ? formatFtInput(bc) : '0.0', readonly: false },
          { key: 'sideC', label: 'AC', placeholder: ac > 0 ? formatFtInput(ac) : '—', readonly: true },
        );
      } else {
        sideFields.push(
          { key: 'sideA', label: 'AB', placeholder: (hasBoth && !inputs.sideA) ? ab.toFixed(2) : '0', readonly: false },
          { key: 'sideB', label: 'BC', placeholder: (hasBoth && !inputs.sideB) ? bc.toFixed(2) : '0', readonly: false },
          { key: 'sideC', label: 'AC', placeholder: ac > 0 ? ac.toFixed(2) : '—', readonly: true },
        );
      }

      const hasAngles = hasBoth;
      const angleLabels = ['A', 'B', 'C'];
      const angleValues = [angleA, angleB, angleC];

      return (
        <View style={styles.triangleRows}>
          {sideFields.map((f, idx) => {
            const angleVal = angleValues[idx];
            const displayVal = hasAngles ? `${angleVal.toFixed(1)}°` : '0°';
            const label = angleLabels[idx];

            return (
              <View key={f.key} style={styles.triangleRow}>
                <ThemedText type="small" style={styles.triangleRowLabel}>
                  {f.label}
                </ThemedText>

                {f.readonly ? (
                  <View style={{
                    flex: 1,
                    height: 42,
                    borderWidth: 1.5,
                    borderRadius: Spacing.two,
                    paddingHorizontal: Spacing.two,
                    justifyContent: 'center',
                    backgroundColor: theme.backgroundElement,
                    borderColor: '#000000ff',
                  }}>
                    <ThemedText type="defaultSemiBold" style={{ color: theme.textSecondary }}>
                      {f.placeholder}
                    </ThemedText>
                  </View>
                ) : (
                  <View style={{ position: 'relative', flex: 1 }}>
                    <TextInput
                      style={[
                        styles.textInput,
                        {
                          backgroundColor: theme.backgroundElement,
                          color: theme.text,
                          borderColor: activeField === f.key ? '#3c87f7' : '#000000ff',
                          paddingRight: 28,
                        },
                      ]}
                      value={inputs[f.key as keyof InputFields] || ''}
                      onChangeText={val => handleInputChange(f.key as keyof InputFields, val)}
                      placeholder={`${f.placeholder} ${unitSuffix}`}
                      placeholderTextColor={theme.textSecondary}
                      keyboardType="decimal-pad"
                      onFocus={() => setActiveField(f.key)}
                      onBlur={() => setActiveField(null)}
                    />
                  </View>
                )}

                <ThemedText type="small" style={styles.triangleRowAngleLabel}>
                  ∠{label}
                </ThemedText>

                <View style={[
                  styles.triangleRowAngleBox,
                  {
                    backgroundColor: theme.backgroundElement,
                    borderColor: activeField === `angle${label}` ? '#3c87f7' : '#000000ff',
                  },
                ]}>
                  <ThemedText
                    type="defaultSemiBold"
                    style={[styles.angleValue, { color: hasAngles ? '#3c87f7' : theme.textSecondary }]}
                  >
                    {displayVal}
                  </ThemedText>
                </View>
              </View>
            );
          })}
        </View>
      );
    }

    if (selectedShape === 'scalene-triangle') {
      const s = calculationResult.solvedTriangle;
      const hasSides = s && !isNaN(s.a) && !isNaN(s.b) && !isNaN(s.c) && s.a > 0 && s.b > 0 && s.c > 0;
      const hasAngles = s && !isNaN(s.A) && !isNaN(s.B) && !isNaN(s.C) && s.A > 0 && s.B > 0 && s.C > 0;

      const unitSuffix = unit === 'kadi' ? 'kadi' : unit;

      // Side names for scalene: AB, BC, AC
      type RowField = { sideKey: keyof InputFields; angleKey: keyof InputFields; sideLabel: string; angleLabel: string };
      const rows: RowField[] = [
        { sideKey: 'sideA', angleKey: 'angleA', sideLabel: 'AB', angleLabel: 'A' },
        { sideKey: 'sideB', angleKey: 'angleB', sideLabel: 'BC', angleLabel: 'B' },
        { sideKey: 'sideC', angleKey: 'angleC', sideLabel: 'AC', angleLabel: 'C' },
      ];

      return (
        <View style={styles.triangleRows}>
          {rows.map((row) => {
            const sideValue = inputs[row.sideKey];
            const angleValue = inputs[row.angleKey];
            const hasSide = !!sideValue && !isNaN(parseFloat(sideValue));
            const hasAngle = !!angleValue && !isNaN(parseFloat(angleValue));

            const sideDisabled = hasAngle && !hasSide;
            const angleDisabled = hasSide && !hasAngle;

            // Computed display values from the solver
            const sideNum = row.sideKey === 'sideA' ? s?.a : row.sideKey === 'sideB' ? s?.b : s?.c;
            const angleNum = row.angleKey === 'angleA' ? s?.A : row.angleKey === 'angleB' ? s?.B : s?.C;
            const hasComputed = hasSides || hasAngles;

            const sidePlaceholder = sideDisabled && hasComputed && !isNaN(sideNum!) && sideNum! > 0
              ? (unit === 'ft' ? formatFtInput(sideNum!) : sideNum!.toFixed(2))
              : '0';
            const sideDisplay = sideDisabled && hasComputed && !isNaN(sideNum!) && sideNum! > 0
              ? (unit === 'ft' ? formatFtInput(sideNum!) : sideNum!.toFixed(2))
              : '—';
            const angleDisplay = angleDisabled && hasComputed && !isNaN(angleNum!) && angleNum! > 0
              ? `${angleNum!.toFixed(1)}°`
              : '—';

            return (
              <View key={row.sideKey} style={styles.triangleRow}>
                {/* Side label */}
                <ThemedText type="small" style={styles.triangleRowLabel}>
                  {row.sideLabel}
                </ThemedText>

                {/* Side input/display */}
                {sideDisabled ? (
                  <View style={{
                    flex: 1,
                    height: 42,
                    borderWidth: 1.5,
                    borderRadius: Spacing.two,
                    paddingHorizontal: Spacing.two,
                    justifyContent: 'center',
                    backgroundColor: theme.backgroundElement,
                    borderColor: '#000000ff',
                  }}>
                    <ThemedText type="defaultSemiBold" style={{ color: theme.textSecondary }}>
                      {sideDisplay}
                    </ThemedText>
                  </View>
                ) : (
                  <View style={{ position: 'relative', flex: 1 }}>
                    <TextInput
                      style={[
                        styles.textInput,
                        {
                          backgroundColor: theme.backgroundElement,
                          color: theme.text,
                          borderColor: activeField === row.sideKey ? '#3c87f7' : '#000000ff',
                          paddingRight: 28,
                        },
                      ]}
                      value={sideValue || ''}
                      onChangeText={val => handleInputChange(row.sideKey, val)}
                      placeholder={`${sidePlaceholder} ${unitSuffix}`}
                      placeholderTextColor={theme.textSecondary}
                      keyboardType="decimal-pad"
                      onFocus={() => setActiveField(row.sideKey)}
                      onBlur={() => setActiveField(null)}
                    />
                  </View>
                )}

                {/* Angle label */}
                <ThemedText type="small" style={styles.triangleRowAngleLabel}>
                  ∠{row.angleLabel}
                </ThemedText>

                {/* Angle input/display */}
                {angleDisabled ? (
                  <View style={[
                    styles.triangleRowAngleBox,
                    {
                      backgroundColor: theme.backgroundElement,
                      borderColor: '#000000ff',
                    },
                  ]}>
                    <ThemedText
                      type="defaultSemiBold"
                      style={[styles.angleValue, { color: '#3c87f7' }]}
                    >
                      {angleDisplay}
                    </ThemedText>
                  </View>
                ) : (
                  <View style={{
                    width: 72,
                    height: 42,
                    borderWidth: 1.5,
                    borderRadius: Spacing.two,
                    borderColor: activeField === row.angleKey ? '#3c87f7' : '#000000ff',
                    justifyContent: 'center',
                    backgroundColor: theme.backgroundElement,
                  }}>
                    <TextInput
                      style={{
                        flex: 1,
                        color: theme.text,
                        fontSize: 16,
                        fontWeight: '700',
                        textAlign: 'center',
                        padding: 0,
                      }}
                      value={angleValue || ''}
                      onChangeText={val => handleInputChange(row.angleKey, val.replace(/[^0-9.]/g, ''))}
                      placeholder="0"
                      placeholderTextColor={theme.textSecondary}
                      keyboardType="decimal-pad"
                      onFocus={() => setActiveField(row.angleKey)}
                      onBlur={() => setActiveField(null)}
                    />
                  </View>
                )}
              </View>
            );
          })}
        </View>
      );
    }

    if (selectedShape === 'quadrilateral') {
      const q = calculationResult.solvedQuad;
      const hasComputed = q && !isNaN(q.A) && !isNaN(q.B) && !isNaN(q.C) && !isNaN(q.D) && q.A > 0 && q.B > 0 && q.C > 0 && q.D > 0;

      const unitSuffix = unit === 'kadi' ? 'kadi' : unit;

      // 4 rows: AB, BC, CD, DA — each with side input and computed angle display
      const rows: { sideKey: keyof InputFields; sideLabel: string; angleLabel: string }[] = [
        { sideKey: 'sideA', sideLabel: 'AB', angleLabel: 'A' },
        { sideKey: 'sideB', sideLabel: 'BC', angleLabel: 'B' },
        { sideKey: 'sideC', sideLabel: 'CD', angleLabel: 'C' },
        { sideKey: 'sideD', sideLabel: 'DA', angleLabel: 'D' },
      ];

      return (
        <View style={styles.triangleRows}>
          {rows.map((row) => {
            const angleVal = row.angleLabel === 'A' ? q?.A : row.angleLabel === 'B' ? q?.B : row.angleLabel === 'C' ? q?.C : q?.D;
            const displayAngle = hasComputed ? `${angleVal!.toFixed(1)}°` : '0°';

            return (
              <View key={row.sideKey} style={styles.triangleRow}>
                <ThemedText type="small" style={styles.triangleRowLabel}>
                  {row.sideLabel}
                </ThemedText>
                <View style={{ position: 'relative', flex: 1 }}>
                  <TextInput
                    style={[
                      styles.textInput,
                      {
                        backgroundColor: theme.backgroundElement,
                        color: theme.text,
                        borderColor: activeField === row.sideKey ? '#3c87f7' : '#000000ff',
                        paddingRight: 28,
                      },
                    ]}
                    value={inputs[row.sideKey] || ''}
                    onChangeText={val => handleInputChange(row.sideKey, val)}
                    placeholder={`0 ${unitSuffix}`}
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="decimal-pad"
                    onFocus={() => setActiveField(row.sideKey)}
                    onBlur={() => setActiveField(null)}
                  />
                </View>
                <ThemedText type="small" style={styles.triangleRowAngleLabel}>
                  ∠{row.angleLabel}
                </ThemedText>
                <View
                  style={[
                    styles.triangleRowAngleBox,
                    {
                      backgroundColor: theme.backgroundElement,
                      borderColor: activeField === `angle${row.angleLabel}` ? '#3c87f7' : '#000000ff',
                    },
                  ]}
                >
                  <ThemedText
                    type="defaultSemiBold"
                    style={[styles.angleValue, { color: hasComputed ? '#3c87f7' : theme.textSecondary }]}
                  >
                    {displayAngle}
                  </ThemedText>
                </View>
              </View>
            );
          })}

          {/* Diagonal row — same layout as side rows, dropdown for diagonal selection */}
          <><View style={[styles.dividerLine, { backgroundColor: theme.backgroundSelected }]} />
            <View style={styles.triangleRow}>
              {/* Diagonal dropdown button */}
              <Pressable
                onPress={() => setShowDiagonalPicker(true)}
                style={[styles.diagonalDropdownBtn, { backgroundColor: theme.backgroundElement, borderColor: activeField === 'diagonalKey' ? '#3c87f7' : theme.backgroundSelected }]}
              >
                <ThemedText type="small" style={[styles.triangleRowLabel, { fontSize: 13, marginRight: 2 }]}>
                  {diagonalKey}
                </ThemedText>
                <ThemedText type="small" style={{ fontSize: 9, color: theme.textSecondary }}>
                  ▼
                </ThemedText>
              </Pressable>

              {/* Diagonal length input */}
              <View style={{ position: 'relative', flex: 1 }}>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: theme.backgroundElement,
                      color: theme.text,
                      borderColor: activeField === 'diagonal' ? '#3c87f7' : '#000000ff',
                      paddingRight: 28,
                    },
                  ]}
                  value={inputs.diagonal || ''}
                  onChangeText={val => handleInputChange('diagonal', val)}
                  placeholder={`0 ${unitSuffix}`}
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="decimal-pad"
                  onFocus={() => setActiveField('diagonal')}
                  onBlur={() => setActiveField(null)}
                />
              </View>

              {/* Empty spacer where angle label would be */}
              <View style={{ width: 28 }} />

              {/* Empty spacer where angle value box would be */}
              <View style={{ width: 72 }} />
            </View>
          </>

          {/* Diagonal picker modal */}
          <Modal
            visible={showDiagonalPicker}
            transparent
            animationType="fade"
            onRequestClose={() => setShowDiagonalPicker(false)}
          >
            <Pressable
              style={styles.modalOverlay}
              onPress={() => setShowDiagonalPicker(false)}
            >
              <Pressable
                style={[styles.modalContent, { backgroundColor: theme.background }]}
                onPress={() => { }}
              >
                <View style={[styles.modalHeader, { borderBottomColor: theme.backgroundSelected }]}>
                  <ThemedText type="defaultSemiBold" style={styles.modalTitle}>
                    Select Diagonal
                  </ThemedText>
                  <Pressable onPress={() => setShowDiagonalPicker(false)}>
                    <ThemedText type="small" style={{ color: '#3c87f7', fontWeight: '700', fontSize: 15 }}>
                      Done
                    </ThemedText>
                  </Pressable>
                </View>
                {['AC', 'BD'].map((key) => {
                  const isSelected = diagonalKey === key;
                  return (
                    <Pressable
                      key={key}
                      onPress={() => {
                        setDiagonalKey(key as 'AC' | 'BD');
                        shapeDiagonalKeyCache[selectedShape] = key as 'AC' | 'BD';
                        setShowDiagonalPicker(false);
                      }}
                      style={[
                        styles.modalOptionRow,
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
                        {key === 'AC' ? 'A — C' : 'B — D'}
                      </ThemedText>
                      {isSelected && (
                        <ThemedText type="small" style={{ color: '#3c87f7', fontWeight: '700' }}>
                          ✓
                        </ThemedText>
                      )}
                    </Pressable>
                  );
                })}
              </Pressable>
            </Pressable>
          </Modal>
        </View>
      );
    }

    const fields: { key: keyof InputFields; label: string; placeholder: string }[] = [];

    if (selectedShape === 'polygon') {
      return (
        <View>
          {/* Side count controls */}
          <View style={styles.polygonSideCountRow}>
            <Pressable
              onPress={() => {
                if (polygonSideCount > 3) {
                  const newCount = polygonSideCount - 1;
                  setPolygonSideCount(newCount);
                  setPolygonSides(prev => prev.slice(0, newCount));
                  setPolygonDiagonals({});
                  // Pre-populate N-3 slots with fan diagonals from A
                  const newKeys: string[] = [];
                  for (let i = 2; i < newCount - 1; i++) {
                    newKeys.push(`A${String.fromCharCode(65 + i)}`);
                  }
                  setPolygonDiagKeys(newKeys);
                  shapePolygonCountCache[selectedShape] = newCount;
                  shapePolygonSidesCache[selectedShape] = polygonSides.slice(0, newCount);
                  shapePolygonDiagonalsCache[selectedShape] = {};
                  shapePolygonDiagKeysCache[selectedShape] = newKeys;
                }
              }}
              style={[styles.polygonCountBtn, { opacity: polygonSideCount > 3 ? 1 : 0.3 }]}
            >
              <ThemedText type="defaultSemiBold" style={styles.polygonCountBtnText}>−</ThemedText>
            </Pressable>
            <ThemedText type="defaultSemiBold" style={styles.polygonCountLabel}>
              {polygonSideCount} sides
            </ThemedText>
            <Pressable
              onPress={() => {
                if (polygonSideCount < 20) {
                  const newCount = polygonSideCount + 1;
                  setPolygonSideCount(newCount);
                  setPolygonSides(prev => [...prev, '']);
                  setPolygonDiagonals({});
                  // Pre-populate N-3 slots with fan diagonals from A
                  const newKeys: string[] = [];
                  for (let i = 2; i < newCount - 1; i++) {
                    newKeys.push(`A${String.fromCharCode(65 + i)}`);
                  }
                  setPolygonDiagKeys(newKeys);
                  shapePolygonCountCache[selectedShape] = newCount;
                  shapePolygonSidesCache[selectedShape] = [...polygonSides, ''];
                  shapePolygonDiagonalsCache[selectedShape] = {};
                  shapePolygonDiagKeysCache[selectedShape] = newKeys;
                }
              }}
              style={[styles.polygonCountBtn, { opacity: polygonSideCount < 20 ? 1 : 0.3 }]}
            >
              <ThemedText type="defaultSemiBold" style={styles.polygonCountBtnText}>+</ThemedText>
            </Pressable>
          </View>

          {/* Side input fields */}
          <View style={styles.triangleRows}>
            {Array.from({ length: polygonSideCount }, (_, i) => {
              return (
                <View key={`poly-${i}`} style={styles.triangleRow}>
                  <ThemedText type="small" style={styles.triangleRowLabel}>
                    {String.fromCharCode(65 + i)}{String.fromCharCode(65 + (i + 1) % polygonSideCount)}
                  </ThemedText>
                  <View style={{ position: 'relative', flex: 1 }}>
                    <TextInput
                      style={[
                        styles.textInput,
                        {
                          backgroundColor: theme.backgroundElement,
                          color: theme.text,
                          borderColor: activeField === `polySide${i}` ? '#3c87f7' : '#000000ff',
                        },
                      ]}
                      value={polygonSides[i] || ''}
                      onChangeText={val => {
                        const cleaned = val.replace(/[^0-9.]/g, '');
                        const pts = cleaned.split('.');
                        const formatted = pts.length > 2 ? `${pts[0]}.${pts.slice(1).join('')}` : cleaned;
                        const newSides = [...polygonSides];
                        newSides[i] = formatted;
                        setPolygonSides(newSides);
                        shapePolygonSidesCache[selectedShape] = newSides;
                      }}
                      placeholder={`0`}
                      placeholderTextColor={theme.textSecondary}
                      keyboardType="decimal-pad"
                      onFocus={() => setActiveField(`polySide${i}`)}
                      onBlur={() => setActiveField(null)}
                    />
                  </View>
                </View>
              );
            })}
          </View>

          {/* Diagonal slots: N-3 dropdown+input rows for 4+ sides */}
          {polygonSideCount >= 4 && (() => {
            const diagCount = polygonSideCount - 3;
            const allDiagonals = generatePolygonDiagonals(polygonSideCount);
            const filledCount = polygonDiagKeys.filter(k => polygonDiagonals[k]).length;
            return (
              <View style={[styles.diagonalsSection, { marginTop: Spacing.three, borderTopWidth: 1, borderTopColor: theme.backgroundSelected, paddingTop: Spacing.three }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <ThemedText type="smallBold" style={styles.diagonalsTitle}>
                    Diagonals
                  </ThemedText>
                  <ThemedText type="small" style={styles.diagonalsSubtitle}>
                    {polygonSideCount} sides → {polygonSideCount - 2} triangles · need {diagCount}
                  </ThemedText>
                </View>

                {/* N-3 rows: each with a dropdown to pick diagonal + value input */}
                <View style={styles.polygonDiagonalGrid}>
                  {polygonDiagKeys.map((diagKey, slotIdx) => {
                    const isActive = activeField === `polyDiagSlot${slotIdx}`;
                    const hasValue = !!polygonDiagonals[diagKey];
                    return (
                      <View key={`slot-${slotIdx}`} style={styles.triangleRow}>
                        {/* Dropdown button for this slot */}
                        <Pressable
                          onPress={() => setActiveDiagSlot(slotIdx)}
                          style={[styles.diagonalDropdownBtn, { backgroundColor: theme.backgroundElement, borderColor: activeField === `polyDiagSlot${slotIdx}` ? '#3c87f7' : theme.backgroundSelected }]}
                        >
                          <ThemedText type="small" style={[styles.triangleRowLabel, { fontSize: 12, marginRight: 2, minWidth: 28 }]}>
                            {diagKey}
                          </ThemedText>
                          <ThemedText type="small" style={{ fontSize: 8, color: theme.textSecondary }}>▼</ThemedText>
                        </Pressable>

                        {/* Value input */}
                        <View style={{ position: 'relative', flex: 1 }}>
                          <TextInput
                            style={[
                              styles.textInput,
                              {
                                backgroundColor: theme.backgroundElement,
                                color: theme.text,
                                borderColor: isActive ? '#3c87f7' : '#000000ff',
                              },
                            ]}
                            value={polygonDiagonals[diagKey] || ''}
                            onChangeText={val => {
                              const cleaned = val.replace(/[^0-9.]/g, '');
                              const pts = cleaned.split('.');
                              const formatted = pts.length > 2 ? `${pts[0]}.${pts.slice(1).join('')}` : cleaned;
                              const newDiagonals = { ...polygonDiagonals, [diagKey]: formatted };
                              setPolygonDiagonals(newDiagonals);
                              shapePolygonDiagonalsCache[selectedShape] = newDiagonals;
                            }}
                            placeholder="0"
                            placeholderTextColor={theme.textSecondary}
                            keyboardType="decimal-pad"
                            onFocus={() => setActiveField(`polyDiagSlot${slotIdx}`)}
                            onBlur={() => setActiveField(null)}
                          />
                        </View>

                        {/* Clear button */}
                        {hasValue && (
                          <Pressable
                            onPress={() => {
                              const { [diagKey]: _, ...rest } = polygonDiagonals;
                              setPolygonDiagonals(rest);
                              shapePolygonDiagonalsCache[selectedShape] = rest;
                            }}
                            style={{ padding: Spacing.half }}
                          >
                            <ThemedText type="small" style={{ color: '#ff4d4f', fontWeight: '700', fontSize: 16 }}>✕</ThemedText>
                          </Pressable>
                        )}
                      </View>
                    );
                  })}
                </View>

                {/* Status */}
                {filledCount > 0 && (
                  <ThemedText
                    type="small"
                    style={{
                      color: filledCount >= diagCount ? '#3c87f7' : '#888',
                      fontWeight: '600',
                      fontSize: 11,
                    }}
                  >
                    {filledCount >= diagCount
                      ? `✓ All ${diagCount} diagonal${diagCount !== 1 ? 's' : ''} entered — triangulation ready`
                      : `${filledCount}/${diagCount} diagonal${diagCount !== 1 ? 's' : ''} entered`}
                  </ThemedText>
                )}

                {/* Diagonal validation: user-entered vs computed from coordinates */}
                {calculationResult.isValid && calculationResult.polygonDiagValidation &&
                 Object.keys(calculationResult.polygonDiagValidation).length > 0 && (
                  <View style={{ gap: Spacing.half, marginTop: Spacing.one }}>
                    <ThemedText type="small" style={{ fontSize: 10, opacity: 0.6 }}>
                      Comparison: user value vs computed from coordinates
                    </ThemedText>
                    {Object.entries(calculationResult.polygonDiagValidation).map(([key, computed]) => {
                      const userVal = parseFloat(polygonDiagonals[key]);
                      if (isNaN(userVal)) return null;
                      const diff = Math.abs(userVal - computed);
                      const match = diff < 0.5;
                      return (
                        <View key={key} style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.one }}>
                          <ThemedText type="small" style={{ fontSize: 10, fontWeight: '600', minWidth: 28 }}>
                            {key}
                          </ThemedText>
                          <ThemedText type="small" style={{ fontSize: 10, color: match ? '#3c87f7' : '#ff4d4f' }}>
                            you: {userVal.toFixed(1)}m
                          </ThemedText>
                          <ThemedText type="small" style={{ fontSize: 10, color: theme.textSecondary }}>
                            vs {computed.toFixed(1)}m
                          </ThemedText>
                          {!match && (
                            <ThemedText type="small" style={{ fontSize: 9, color: '#ff4d4f' }}>
                              Δ {diff.toFixed(1)}
                            </ThemedText>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}

                {/* Diagonal picker modal for active slot */}
                <Modal
                  visible={activeDiagSlot !== null && activeDiagSlot < polygonDiagKeys.length}
                  transparent
                  animationType="fade"
                  onRequestClose={() => setActiveDiagSlot(null)}
                >
                  <Pressable
                    style={styles.modalOverlay}
                    onPress={() => setActiveDiagSlot(null)}
                  >
                    <Pressable
                      style={[styles.modalContent, { backgroundColor: theme.background }]}
                      onPress={() => {}}
                    >
                      <View style={[styles.modalHeader, { borderBottomColor: theme.backgroundSelected }]}>
                        <ThemedText type="defaultSemiBold" style={styles.modalTitle}>
                          Pick Diagonal for Slot {activeDiagSlot !== null ? activeDiagSlot + 1 : ''}
                        </ThemedText>
                        <Pressable onPress={() => setActiveDiagSlot(null)}>
                          <ThemedText type="small" style={{ color: '#3c87f7', fontWeight: '700', fontSize: 15 }}>
                            Done
                          </ThemedText>
                        </Pressable>
                      </View>
                      {allDiagonals.map((diag) => {
                        const isUsed = polygonDiagKeys.some((k, i) => k === diag.key && i !== activeDiagSlot);
                        const isSelected = activeDiagSlot !== null && polygonDiagKeys[activeDiagSlot] === diag.key;
                        return (
                          <Pressable
                            key={diag.key}
                            onPress={() => {
                              if (activeDiagSlot === null) return;
                              if (isUsed) return; // already assigned to another slot
                              // Move value from old diagonal to new one if we're swapping
                              const oldKey = polygonDiagKeys[activeDiagSlot];
                              const oldVal = polygonDiagonals[oldKey];
                              const newDiagonals = { ...polygonDiagonals };
                              delete newDiagonals[oldKey];
                              if (oldVal) newDiagonals[diag.key] = oldVal;
                              const newKeys = [...polygonDiagKeys];
                              newKeys[activeDiagSlot] = diag.key;
                              setPolygonDiagKeys(newKeys);
                              setPolygonDiagonals(newDiagonals);
                              shapePolygonDiagKeysCache[selectedShape] = newKeys;
                              shapePolygonDiagonalsCache[selectedShape] = newDiagonals;
                              setActiveDiagSlot(null);
                            }}
                            style={[
                              styles.modalOptionRow,
                              (isSelected || isUsed) && { backgroundColor: 'rgba(60, 135, 247, 0.1)' },
                            ]}
                          >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two, flex: 1 }}>
                              <ThemedText
                                type="default"
                                style={{
                                  color: isUsed ? theme.textSecondary : (isSelected ? '#3c87f7' : theme.text),
                                  fontWeight: isSelected ? '700' : '400',
                                  textDecorationLine: isUsed ? 'line-through' : 'none',
                                }}
                              >
                                {diag.key}
                              </ThemedText>
                              {isUsed && (
                                <ThemedText type="small" style={{ color: theme.textSecondary, fontSize: 10 }}>
                                  (used)
                                </ThemedText>
                              )}
                              {polygonDiagonals[diag.key] && !isUsed && (
                                <ThemedText type="small" style={{ color: '#3c87f7', fontSize: 11 }}>
                                  = {polygonDiagonals[diag.key]}m
                                </ThemedText>
                              )}
                            </View>
                            {isSelected && (
                              <ThemedText type="small" style={{ color: '#3c87f7', fontWeight: '700' }}>✓</ThemedText>
                            )}
                          </Pressable>
                        );
                      })}
                    </Pressable>
                  </Pressable>
                </Modal>
              </View>
            );
          })()}
        </View>
      );
    }

    if (selectedShape === 'circle') {
      const unitSuffix = unit === 'kadi' ? 'kadi' : unit;
      return (
        <View>
          <View style={styles.triangleRow}>
            <ThemedText type="small" style={styles.triangleRowLabel}>
              Diameter
            </ThemedText>
            <View style={{ position: 'relative', flex: 1 }}>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: theme.backgroundElement,
                    color: theme.text,
                    borderColor: activeField === 'diameter' ? '#3c87f7' : '#000000ff',
                  },
                ]}
                value={circleDiameter}
                onChangeText={val => {
                  const cleaned = val.replace(/[^0-9.]/g, '');
                  const pts = cleaned.split('.');
                  const formatted = pts.length > 2 ? `${pts[0]}.${pts.slice(1).join('')}` : cleaned;
                  setCircleDiameter(formatted);
                  shapeCircleDiameterCache[selectedShape] = formatted;
                }}
                placeholder={`0 ${unitSuffix}`}
                placeholderTextColor={theme.textSecondary}
                keyboardType="decimal-pad"
                onFocus={() => setActiveField('diameter')}
                onBlur={() => setActiveField(null)}
              />
            </View>
          </View>
        </View>
      );
    }

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
    let dNum = 0;

    if (selectedShape === 'right-angled-triangle') {
      aNum = unit === 'ft' ? parseSideNum(inputs.sideA) : (parseFloat(inputs.sideA || '0') || 0);
      bNum = unit === 'ft' ? parseSideNum(inputs.sideB) : (parseFloat(inputs.sideB || '0') || 0);
      cNum = aNum > 0 && bNum > 0 ? Math.sqrt(aNum * aNum + bNum * bNum) : 0;
    } else if (selectedShape === 'quadrilateral') {
      aNum = parseFloat(inputs.sideA || '0') || 0;
      bNum = parseFloat(inputs.sideB || '0') || 0;
      cNum = parseFloat(inputs.sideC || '0') || 0;
      dNum = parseFloat(inputs.sideD || '0') || 0;
    } else if (calculationResult.solvedTriangle && calculationResult.isValid) {
      aNum = calculationResult.solvedTriangle.a;
      bNum = calculationResult.solvedTriangle.b;
      cNum = calculationResult.solvedTriangle.c;
    } else {
      if ((selectedShape === 'triangle' || selectedShape === 'scalene-triangle') && unit === 'ft') {
        aNum = parseSideNum(inputs.sideA);
        bNum = parseSideNum(inputs.sideB);
        cNum = parseSideNum(inputs.sideC);
      } else {
        aNum = parseFloat(inputs.sideA || inputs.base || inputs.length || inputs.diagonal || '0') || 0;
        bNum = parseFloat(inputs.sideB || inputs.height || inputs.width || inputs.h1 || '0') || 0;
        cNum = parseFloat(inputs.sideC || inputs.h2 || '0') || 0;
      }
    }

    const s = selectedShape === 'quadrilateral'
      ? [aNum.toString(), bNum.toString(), cNum.toString(), dNum.toString()]
      : selectedShape === 'polygon'
        ? polygonSides.map(sn => sn || '0')
        : selectedShape === 'circle'
          ? [circleDiameter || '0']
          : [aNum.toString(), bNum.toString(), cNum.toString()];

    let sideLabels: string[] | undefined;
    if (selectedShape === 'quadrilateral' && unit === 'ft') {
      sideLabels = [
        formatLabel(aNum, inputs.sideA),
        formatLabel(bNum, inputs.sideB),
        formatLabel(cNum, inputs.sideC),
        formatLabel(dNum, inputs.sideD),
      ];
    } else if ((selectedShape === 'triangle' || selectedShape === 'scalene-triangle') && unit === 'ft') {
      sideLabels = [
        formatLabel(aNum, inputs.sideA),
        formatLabel(bNum, inputs.sideB),
        formatLabel(cNum, inputs.sideC),
      ];
    } else if (selectedShape === 'right-angled-triangle' && unit === 'ft') {
      sideLabels = [
        formatLabel(aNum, inputs.sideA),
        formatLabel(bNum, inputs.sideB),
        formatLabel(cNum, undefined),
      ];
    } else if (selectedShape === 'polygon' && unit === 'ft') {
      sideLabels = polygonSides.map(sn => {
        const num = parseSideNum(sn);
        return num > 0 ? formatLabel(num, sn) : '';
      });
    }

    return { sides: s, sideLabels };
  }, [selectedShape, unit, inputs, calculationResult, polygonSides, circleDiameter]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        {/* Top bar — shape . unit */}
        <View style={[styles.compactHeader, { backgroundColor: theme.backgroundElement, borderBottomColor: theme.backgroundSelected }]}>
          <Pressable onPress={() => router.back()} style={styles.compactHeaderInner}>
            <ThemedText type="default" style={[styles.compactHeaderText, { color: '#3c87f7' }]}>
              {selectedShape === 'right-angled-triangle' ? 'Right-angled Triangle' : selectedShape === 'scalene-triangle' ? 'Scalene Triangle' : selectedShape === 'quadrilateral' ? 'Quadrilateral' : selectedShape === 'polygon' ? 'Polygon' : selectedShape === 'circle' ? 'Circle' : selectedShape.charAt(0).toUpperCase() + selectedShape.slice(1)}
            </ThemedText>
            <ThemedText type="default" style={[styles.compactHeaderText, { color: theme.textSecondary, marginHorizontal: 6 }]}>
              ·
            </ThemedText>
            <ThemedText type="default" style={[styles.compactHeaderText, { color: theme.text }]}>
              {unit === 'ft' ? 'Feet' : unit === 'kadi' ? 'Kadi' : 'Meter'}
            </ThemedText>
          </Pressable>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >

          {/* Live Visualization Diagram + Dimensions (no gap) */}
          <View>
            <View style={styles.diagramCard}>
              {/* <ThemedText type="smallBold" style={styles.cardTitle}>
                Interactive Diagram
              </ThemedText> */}
              <ShapeDiagram
                shape={selectedShape}
                activeField={activeField}
                sides={sideData.sides}
                sideLabels={sideData.sideLabels}
                diagonal={selectedShape === 'quadrilateral' ? inputs.diagonal : undefined}
                diagonalKey={selectedShape === 'quadrilateral' ? diagonalKey : undefined}
                polygonDiagonals={selectedShape === 'polygon' ? polygonDiagonals : undefined}
                unit={unit}
              />
            </View>

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
          </View>

          {/* Live Result and Step-by-Step Solution */}
          <View style={[styles.card, styles.resultCard, { borderColor: '#3c87f7' }]}>
            <View style={styles.resultContainer}>
              {calculationResult.hasInputs ? (
                <View>
                  {calculationResult.isValid ? (
                    <>
                      <View style={styles.totalSqFtRow}>

                        <ThemedText type="subtitle" style={styles.resultValue}>
                          {calculationResult.sqFt.toFixed(2)}{' '}
                          <ThemedText type="subtitle" style={styles.resultUnit}>
                            sq ft
                          </ThemedText>
                        </ThemedText>
                      </View>
                    </>
                  ) : (
                    selectedShape === 'quadrilateral' && !inputs.diagonal && !proceedWithoutDiagonal ? (
                      <View style={styles.proceedContainer}>
                        <Pressable
                          onPress={() => {
                            setProceedWithoutDiagonal(true);
                            shapeProceedNoDiagCache[selectedShape] = true;
                          }}
                          style={styles.proceedButton}
                        >
                          <ThemedText type="defaultSemiBold" style={styles.proceedButtonText}>
                            Proceed without diagonal
                          </ThemedText>
                        </Pressable>
                      </View>
                    ) : selectedShape === 'polygon' && polygonSideCount >= 4 &&
                      calculationResult.hasInputs && !proceedWithoutPolygonDiagonals ? (
                      <View style={styles.proceedContainer}>
                        <Pressable
                          onPress={() => setProceedWithoutPolygonDiagonals(true)}
                          style={styles.proceedButton}
                        >
                          <ThemedText type="defaultSemiBold" style={styles.proceedButtonText}>
                            Proceed without diagonals
                          </ThemedText>
                        </Pressable>
                      </View>
                    ) : (
                      <View style={styles.invalidContainer}>
                        <SymbolView name="exclamationmark.triangle.fill" size={24} tintColor="#ff4d4f" />
                        <ThemedText style={styles.invalidText}>
                          {calculationResult.isDhurValid
                            ? 'Invalid Geometry Constraint'
                            : 'No local unit selected. Please choose a hand unit or Standard in setup.'}
                        </ThemedText>
                      </View>
                    ))}

                  {/* Converted Area Formats */}
                  {renderAreaConversions()}
                </View>
              ) : (
                <View style={styles.waitingContainer}>
                  <SymbolView name="square.and.pencil" size={28} tintColor={theme.textSecondary} />
                  <ThemedText themeColor="text" style={styles.waitingText}>
                    Please enter positive values.
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
    paddingTop: Spacing.one,
    paddingBottom: Spacing.five,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
    gap: Spacing.one,
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
    padding: Spacing.one,
    borderRadius: Spacing.four,
    borderWidth: 1.5,
    borderColor: 'rgba(128,128,128,0.15)',
    gap: Spacing.three,
  },
  diagramCard: {
    paddingVertical: 0,
    paddingHorizontal: Spacing.one,
    borderRadius: Spacing.four,
    borderWidth: 2,
    borderColor: '#3c87f7',
    gap: Spacing.one,
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

  // Triangle row-based layout — each side + angle on one horizontal line
  triangleRows: {
    gap: Spacing.two,
  },
  triangleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  triangleRowLabel: {
    fontSize: 14,
    fontWeight: '600',
    minWidth: 52,
  },
  triangleRowAngleLabel: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: '#000000ff',
    minWidth: 28,
    textAlign: 'center',
  },
  triangleRowAngleBox: {
    width: 72,
    height: 42,
    borderWidth: 1.5,
    borderRadius: Spacing.two,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.two,
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
    fontSize: 24
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
    fontSize: 18,
    fontWeight: 600,
    lineHeight: 18,
    maxWidth: 260,
  },
  compactHeader: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
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

  // Total Sq Ft row
  totalSqFtRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.two,
    textAlign: 'center',
    alignSelf: 'center',
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
    // gap: Spacing.one,
    // marginTop: Spacing.two,
  },
  conversionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
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

  // Diagonal section styles
  dividerLine: {
    height: 1,
    marginVertical: Spacing.two,
  },
  diagonalDropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 52,
    height: 42,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.two,
    borderWidth: 1.5,
    gap: 2,
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
  modalOptionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.two,
  },

  // Proceed without diagonal
  proceedContainer: {
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  proceedPrompt: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    opacity: 0.8,
  },
  proceedButton: {
    backgroundColor: '#3c87f7',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.six,
    borderRadius: Spacing.three,
  },
  proceedButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },

  // Polygon side count controls
  polygonSideCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.four,
    marginBottom: Spacing.three,
  },
  polygonCountBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#3c87f7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  polygonCountBtnText: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 28,
  },
  polygonCountLabel: {
    fontSize: 18,
    fontWeight: '700',
    minWidth: 80,
    textAlign: 'center',
  },

  // Polygon diagonal section
  diagonalsSection: {
    gap: Spacing.two,
  },
  diagonalsTitle: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    opacity: 0.7,
  },
  diagonalsSubtitle: {
    fontSize: 11,
    opacity: 0.6,
  },
  polygonDiagonalGrid: {
    gap: Spacing.one,
  },
});