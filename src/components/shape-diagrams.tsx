import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { calculateInteriorAngles, generatePolygon, generateTriangle } from '@/utils/geometry';
import { Text as RNText, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { ThemedText } from './themed-text';

interface ShapeDiagramProps {
  shape: 'triangle' | 'right-angled-triangle' | 'scalene-triangle' | 'rectangle' | 'parallelogram' | 'trapezoid' | 'quadrilateral';
  activeField: string | null;
  sides: string[];
  sideLabels?: string[];
}

export function ShapeDiagram({ shape, activeField, sides, sideLabels }: ShapeDiagramProps) {
  const theme = useTheme();

  const scaleVal = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedScale = useSharedValue(1);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scaleVal.value = savedScale.value * e.scale;
    })
    .onEnd(() => {
      // Clamp scale between 0.5 and 5
      if (scaleVal.value < 0.5) scaleVal.value = withSpring(0.5);
      if (scaleVal.value > 5) scaleVal.value = withSpring(5);
      savedScale.value = scaleVal.value;
    });

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  // Double tap to reset
  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      scaleVal.value = withSpring(1);
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
      savedScale.value = 1;
      savedTranslateX.value = 0;
      savedTranslateY.value = 0;
    });

  const composed = Gesture.Simultaneous(pinchGesture, panGesture, doubleTapGesture);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scaleVal.value },
      ],
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      width: '100%'
    };
  });

  const getHighlightStyle = (fields: string[]) => {
    const isActive = activeField && fields.includes(activeField);
    return {
      borderColor: isActive ? '#3c87f7' : theme.textSecondary,
      color: isActive ? '#3c87f7' : theme.textSecondary,
      fontWeight: isActive ? '700' : '500',
    };
  };

  const renderShape = () => {
    switch (shape) {
      case 'scalene-triangle':
      case 'triangle': {
        const sideAHighlight = getHighlightStyle(['sideA']);
        const sideBHighlight = getHighlightStyle(['sideB']);
        const sideCHighlight = getHighlightStyle(['sideC']);

        // Parse side lengths
        let s0 = parseFloat(sides[0]); // Side A value
        let s1 = parseFloat(sides[1]); // Side B value
        let s2 = parseFloat(sides[2]); // Side C value

        const isValidTriangle =
          !isNaN(s0) && !isNaN(s1) && !isNaN(s2) &&
          s0 > 0 && s1 > 0 && s2 > 0 &&
          s0 + s1 > s2 && s0 + s2 > s1 && s1 + s2 > s0;

        if (!isValidTriangle) {
          s0 = 5; s1 = 6; s2 = 5;
        }

        // Use the same triangle generation logic as plot.tsx (geometry.ts)
        // generateTriangle(first, second, third) produces:
        //   AB = first param, BC = second param, AC = third param
        const modelPoints = generateTriangle(s0, s1, s2);
        // modelPoints[0] = A, modelPoints[1] = B, modelPoints[2] = C

        // Compute interior angles using the same logic as plot.tsx
        const angles = isValidTriangle ? calculateInteriorAngles(modelPoints) : [60, 60, 60];
        const angleA = angles[0]; // ∠A at vertex A
        const angleB = angles[1]; // ∠B at vertex B
        const angleC = angles[2]; // ∠C at vertex C

        // Rotate 90 degrees clockwise: (x, y) -> (y, -x)
        const rotPoints = modelPoints.map(p => ({ x: p.y, y: -p.x }));
        const r1 = rotPoints[0]; // A
        const r2 = rotPoints[1]; // B
        const r3 = rotPoints[2]; // C

        // Bounding box
        const minX = Math.min(r1.x, r2.x, r3.x);
        const maxX = Math.max(r1.x, r2.x, r3.x);
        const minY = Math.min(r1.y, r2.y, r3.y);
        const maxY = Math.max(r1.y, r2.y, r3.y);

        const w = maxX - minX;
        const h = maxY - minY;

        // Scaling to fit canvas (300x180 max, using 240x120 to leave padding)
        const maxWidth = 240;
        const maxHeight = 120;
        const scale = w > 0 && h > 0 ? Math.min(maxWidth / w, maxHeight / h) : 1;

        const scaledW = w * scale;
        const scaledH = h * scale;

        // Center offsets (Canvas size: 300x180)
        const offsetX = (300 - scaledW) / 2;
        const offsetY = (180 - scaledH) / 2;

        // Scale and shift coordinates (invert Y axis for React Native)
        const transformPoint = (p: { x: number, y: number }) => ({
          x: (p.x - minX) * scale + offsetX,
          y: 180 - ((p.y - minY) * scale + offsetY)
        });

        // Screen coordinates of vertices
        const vA = transformPoint(r1);   // vertex A
        const vB = transformPoint(r2);   // vertex B
        const vC = transformPoint(r3);   // vertex C

        const centroidX = (vA.x + vB.x + vC.x) / 3;
        const centroidY = (vA.y + vB.y + vC.y) / 3;

        const renderDynamicLine = (start: { x: number, y: number }, end: { x: number, y: number }, styleHighlight: any, label: string) => {
          const length = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
          const angle = Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI;
          const midX = (start.x + end.x) / 2;
          const midY = (start.y + end.y) / 2;

          return (
            <View key={label} style={[
              styles.line,
              {
                left: midX - length / 2,
                top: midY - 1, // 1 is half of height 2
                width: length,
                height: 2,
                backgroundColor: styleHighlight.borderColor,
                transform: [{ rotate: `${angle}deg` }]
              }
            ]} />
          );
        };

        // Angles are now computed by calculateInteriorAngles above (same as plot.tsx)

        // Helper to push text outward from centroid (in screen space)
        const getLabelPos = (p: { x: number, y: number }, distanceAway: number) => {
          const vx = p.x - centroidX;
          const vy = p.y - centroidY;
          const len = Math.sqrt(vx * vx + vy * vy) || 1;
          return { x: p.x + (vx / len) * distanceAway, y: p.y + (vy / len) * distanceAway };
        };

        // Helper to push text inward from vertex (in screen space)
        const getInteriorPos = (p: { x: number, y: number }, distanceInside: number) => {
          const vx = centroidX - p.x;
          const vy = centroidY - p.y;
          const len = Math.sqrt(vx * vx + vy * vy) || 1;
          return { x: p.x + (vx / len) * distanceInside, y: p.y + (vy / len) * distanceInside };
        };

        const renderArc = (v: { x: number, y: number }, adj1: { x: number, y: number }, adj2: { x: number, y: number }, R: number, color: string) => {
          const u = { x: adj1.x - v.x, y: adj1.y - v.y };
          const w = { x: adj2.x - v.x, y: adj2.y - v.y };
          const lenU = Math.sqrt(u.x * u.x + u.y * u.y) || 1;
          const lenW = Math.sqrt(w.x * w.x + w.y * w.y) || 1;
          const nu = { x: u.x / lenU, y: u.y / lenU };
          const nw = { x: w.x / lenW, y: w.y / lenW };
          const A = { x: v.x + nu.x * R, y: v.y + nu.y * R };
          const B = { x: v.x + nw.x * R, y: v.y + nw.y * R };
          const cross = nu.x * nw.y - nu.y * nw.x;
          const sweep = cross > 0 ? 1 : 0;
          return <Path d={`M ${A.x} ${A.y} A ${R} ${R} 0 0 ${sweep} ${B.x} ${B.y}`} fill="none" stroke={color} strokeWidth="1.5" />;
        };

        // Edge midpoints (screen coordinates):
        //   AB between vA and vB, BC between vB and vC, CA between vC and vA
        const midAB = { x: (vA.x + vB.x) / 2, y: (vA.y + vB.y) / 2 };   // side c = Side C
        const midBC = { x: (vB.x + vC.x) / 2, y: (vB.y + vC.y) / 2 };   // side a = Side A
        const midCA = { x: (vC.x + vA.x) / 2, y: (vC.y + vA.y) / 2 };   // side b = Side B

        // Side label positions
        const labelAB_pos = getLabelPos(midAB, 22);   // AB = c = Side C
        const labelBC_pos = getLabelPos(midBC, 22);   // BC = a = Side A
        const labelCA_pos = getLabelPos(midCA, 22);   // CA = b = Side B

        // Angle labels pulled inward from each vertex
        const angleA_pos = getInteriorPos(vA, 22);   // angle at A
        const angleB_pos = getInteriorPos(vB, 22);   // angle at B
        const angleC_pos = getInteriorPos(vC, 22);   // angle at C

        // Vertex label positions (pushed outward from centroid)
        const vertexA_pos = getLabelPos(vA, 18);
        const vertexB_pos = getLabelPos(vB, 18);
        const vertexC_pos = getLabelPos(vC, 18);

        // Active state booleans for each side
        const isSideAActive = activeField === 'sideA';  // AB = Side A
        const isSideBActive = activeField === 'sideB';  // BC = Side B
        const isSideCActive = activeField === 'sideC';  // CA = Side C

        // Side label text: each edge shows its actual length
        const labelABText = isValidTriangle ? (sideLabels?.[0] ?? `${s0}`) : 'a';  // AB = s0 = Side A
        const labelBCText = isValidTriangle ? (sideLabels?.[1] ?? `${s1}`) : 'b';  // BC = s1 = Side B
        const labelCAText = isValidTriangle ? (sideLabels?.[2] ?? `${s2}`) : 'c';  // CA = s2 = Side C

        return (
          <View style={styles.canvas}>
            {/* Vertex dots */}
            <View style={[styles.apexDot, { left: vA.x - 3, top: vA.y - 3, backgroundColor: theme.textSecondary }]} />
            <View style={[styles.apexDot, { left: vB.x - 3, top: vB.y - 3, backgroundColor: theme.textSecondary }]} />
            <View style={[styles.apexDot, { left: vC.x - 3, top: vC.y - 3, backgroundColor: theme.textSecondary }]} />

            {/* SVG Arcs for Angles */}
            {isValidTriangle && (
              <Svg style={StyleSheet.absoluteFill}>
                {renderArc(vA, vB, vC, 16, theme.textSecondary)}
                {renderArc(vB, vA, vC, 16, theme.textSecondary)}
                {renderArc(vC, vA, vB, 16, theme.textSecondary)}
              </Svg>
            )}

            {/* Dynamic Lines representing sides */}
            {renderDynamicLine(vA, vB, sideAHighlight, 'sideA')}
            {renderDynamicLine(vB, vC, sideBHighlight, 'sideB')}
            {renderDynamicLine(vA, vC, sideCHighlight, 'sideC')}

            {/* Labels for sides */}
            <View style={[styles.labelBox, { left: labelAB_pos.x - 25, top: labelAB_pos.y - 10, width: 50, backgroundColor: isSideAActive ? '#3c87f7' : theme.backgroundElement, borderColor: isSideAActive ? '#3c87f7' : 'rgba(120,120,120,0.2)' }]} pointerEvents="none">
              <RNText style={[styles.labelBoxText, { color: isSideAActive ? '#ffffff' : theme.text }]}>
                {labelABText}
              </RNText>
            </View>
            <View style={[styles.labelBox, { left: labelBC_pos.x - 25, top: labelBC_pos.y - 10, width: 50, backgroundColor: isSideBActive ? '#3c87f7' : theme.backgroundElement, borderColor: isSideBActive ? '#3c87f7' : 'rgba(120,120,120,0.2)' }]} pointerEvents="none">
              <RNText style={[styles.labelBoxText, { color: isSideBActive ? '#ffffff' : theme.text }]}>
                {labelBCText}
              </RNText>
            </View>
            <View style={[styles.labelBox, { left: labelCA_pos.x - 25, top: labelCA_pos.y - 10, width: 50, backgroundColor: isSideCActive ? '#3c87f7' : theme.backgroundElement, borderColor: isSideCActive ? '#3c87f7' : 'rgba(120,120,120,0.2)' }]} pointerEvents="none">
              <RNText style={[styles.labelBoxText, { color: isSideCActive ? '#ffffff' : theme.text }]}>
                {labelCAText}
              </RNText>
            </View>

            {/* Vertex labels */}
            <View style={[styles.vertexLabelBox, { left: vertexA_pos.x - 12, top: vertexA_pos.y - 10 }]} pointerEvents="none">
              <RNText style={[styles.vertexLabelText, { color: theme.textSecondary }]}>A</RNText>
            </View>
            <View style={[styles.vertexLabelBox, { left: vertexB_pos.x - 12, top: vertexB_pos.y - 10 }]} pointerEvents="none">
              <RNText style={[styles.vertexLabelText, { color: theme.textSecondary }]}>B</RNText>
            </View>
            <View style={[styles.vertexLabelBox, { left: vertexC_pos.x - 12, top: vertexC_pos.y - 10 }]} pointerEvents="none">
              <RNText style={[styles.vertexLabelText, { color: theme.textSecondary }]}>C</RNText>
            </View>

            {/* Labels for angles */}
            {isValidTriangle && (
              <>
                <View style={[styles.angleLabelBox, { left: angleA_pos.x - 30, top: angleA_pos.y - 8 }]} pointerEvents="none">
                  <RNText style={[styles.angleLabelText, { color: isSideAActive ? '#3c87f7' : 'rgba(120,120,120,0.7)' }]}>
                    ∠A {angleA.toFixed(1)}°
                  </RNText>
                </View>
                <View style={[styles.angleLabelBox, { left: angleB_pos.x - 30, top: angleB_pos.y - 8 }]} pointerEvents="none">
                  <RNText style={[styles.angleLabelText, { color: isSideBActive ? '#3c87f7' : 'rgba(120,120,120,0.7)' }]}>
                    ∠B {angleB.toFixed(1)}°
                  </RNText>
                </View>
                <View style={[styles.angleLabelBox, { left: angleC_pos.x - 30, top: angleC_pos.y - 8 }]} pointerEvents="none">
                  <RNText style={[styles.angleLabelText, { color: isSideCActive ? '#3c87f7' : 'rgba(120,120,120,0.7)' }]}>
                    ∠C {angleC.toFixed(1)}°
                  </RNText>
                </View>
              </>
            )}
          </View>
        );
      }

      case 'right-angled-triangle': {
        const sideAHighlight = getHighlightStyle(['sideA']);
        const sideBHighlight = getHighlightStyle(['sideB']);
        const sideCHighlight = getHighlightStyle(['sideC']);

        // Parse side lengths
        let s0 = parseFloat(sides[0]); // Side A value
        let s1 = parseFloat(sides[1]); // Side B value
        let s2 = parseFloat(sides[2]); // Side C value

        const isValidTriangle =
          !isNaN(s0) && !isNaN(s1) && !isNaN(s2) &&
          s0 > 0 && s1 > 0 && s2 > 0 &&
          s0 + s1 > s2 && s0 + s2 > s1 && s1 + s2 > s0;

        if (!isValidTriangle) {
          // Classic 3-4-5 right triangle skeleton (a² + b² = c²)
          s0 = 3; s1 = 4; s2 = 5;
        }

        // Use the same triangle generation logic as plot.tsx (geometry.ts)
        const modelPoints = generateTriangle(s0, s1, s2);

        // Compute interior angles
        const angles = isValidTriangle ? calculateInteriorAngles(modelPoints) : [60, 60, 60];
        const angleA = angles[0];
        const angleB = angles[1];
        const angleC = angles[2];

        // Rotate 90 degrees clockwise: (x, y) -> (y, -x)
        const rotPoints = modelPoints.map(p => ({ x: p.y, y: -p.x }));
        const r1 = rotPoints[0]; // A
        const r2 = rotPoints[1]; // B
        const r3 = rotPoints[2]; // C

        // Bounding box
        const minX = Math.min(r1.x, r2.x, r3.x);
        const maxX = Math.max(r1.x, r2.x, r3.x);
        const minY = Math.min(r1.y, r2.y, r3.y);
        const maxY = Math.max(r1.y, r2.y, r3.y);

        const w = maxX - minX;
        const h = maxY - minY;

        // Scaling to fit canvas (300x180 max, using 240x120 to leave padding)
        const maxWidth = 240;
        const maxHeight = 120;
        const scale = w > 0 && h > 0 ? Math.min(maxWidth / w, maxHeight / h) : 1;

        const scaledW = w * scale;
        const scaledH = h * scale;

        // Center offsets (Canvas size: 300x180)
        const offsetX = (300 - scaledW) / 2;
        const offsetY = (180 - scaledH) / 2;

        // Scale and shift coordinates (invert Y axis for React Native)
        const transformPoint = (p: { x: number, y: number }) => ({
          x: (p.x - minX) * scale + offsetX,
          y: 180 - ((p.y - minY) * scale + offsetY)
        });

        // Screen coordinates of vertices
        const vA = transformPoint(r1);
        const vB = transformPoint(r2);
        const vC = transformPoint(r3);

        const centroidX = (vA.x + vB.x + vC.x) / 3;
        const centroidY = (vA.y + vB.y + vC.y) / 3;

        const renderDynamicLine = (start: { x: number, y: number }, end: { x: number, y: number }, styleHighlight: any, label: string) => {
          const length = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
          const angle = Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI;
          const midX = (start.x + end.x) / 2;
          const midY = (start.y + end.y) / 2;

          return (
            <View key={label} style={[
              styles.line,
              {
                left: midX - length / 2,
                top: midY - 1,
                width: length,
                height: 2,
                backgroundColor: styleHighlight.borderColor,
                transform: [{ rotate: `${angle}deg` }]
              }
            ]} />
          );
        };

        // Helper to push text outward from centroid (in screen space)
        const getLabelPos = (p: { x: number, y: number }, distanceAway: number) => {
          const vx = p.x - centroidX;
          const vy = p.y - centroidY;
          const len = Math.sqrt(vx * vx + vy * vy) || 1;
          return { x: p.x + (vx / len) * distanceAway, y: p.y + (vy / len) * distanceAway };
        };

        // Helper to push text inward from vertex (in screen space)
        const getInteriorPos = (p: { x: number, y: number }, distanceInside: number) => {
          const vx = centroidX - p.x;
          const vy = centroidY - p.y;
          const len = Math.sqrt(vx * vx + vy * vy) || 1;
          return { x: p.x + (vx / len) * distanceInside, y: p.y + (vy / len) * distanceInside };
        };

        const renderArc = (v: { x: number, y: number }, adj1: { x: number, y: number }, adj2: { x: number, y: number }, R: number, color: string) => {
          const u = { x: adj1.x - v.x, y: adj1.y - v.y };
          const w = { x: adj2.x - v.x, y: adj2.y - v.y };
          const lenU = Math.sqrt(u.x * u.x + u.y * u.y) || 1;
          const lenW = Math.sqrt(w.x * w.x + w.y * w.y) || 1;
          const nu = { x: u.x / lenU, y: u.y / lenU };
          const nw = { x: w.x / lenW, y: w.y / lenW };
          const A = { x: v.x + nu.x * R, y: v.y + nu.y * R };
          const B = { x: v.x + nw.x * R, y: v.y + nw.y * R };
          const cross = nu.x * nw.y - nu.y * nw.x;
          const sweep = cross > 0 ? 1 : 0;
          return <Path d={`M ${A.x} ${A.y} A ${R} ${R} 0 0 ${sweep} ${B.x} ${B.y}`} fill="none" stroke={color} strokeWidth="1.5" />;
        };

        // Edge midpoints (screen coordinates)
        const midAB = { x: (vA.x + vB.x) / 2, y: (vA.y + vB.y) / 2 };
        const midBC = { x: (vB.x + vC.x) / 2, y: (vB.y + vC.y) / 2 };
        const midCA = { x: (vC.x + vA.x) / 2, y: (vC.y + vA.y) / 2 };

        // Side label positions
        const labelAB_pos = getLabelPos(midAB, 22);
        const labelBC_pos = getLabelPos(midBC, 22);
        const labelCA_pos = getLabelPos(midCA, 22);

        // Angle labels pulled inward from each vertex
        const angleA_pos = getInteriorPos(vA, 22);
        const angleB_pos = getInteriorPos(vB, 22);
        const angleC_pos = getInteriorPos(vC, 22);

        // Vertex label positions (pushed outward from centroid)
        const vertexA_pos = getLabelPos(vA, 18);
        const vertexB_pos = getLabelPos(vB, 18);
        const vertexC_pos = getLabelPos(vC, 18);

        // Active state booleans for each side
        const isSideAActive = activeField === 'sideA';
        const isSideBActive = activeField === 'sideB';
        const isSideCActive = activeField === 'sideC';

        // Side label text: each edge shows its actual length
        const labelABText = isValidTriangle ? (sideLabels?.[0] ?? `${s0}`) : 'a';
        const labelBCText = isValidTriangle ? (sideLabels?.[1] ?? `${s1}`) : 'b';
        const labelCAText = isValidTriangle ? (sideLabels?.[2] ?? `${s2}`) : 'c';

        return (
          <View style={styles.canvas}>
            {/* Vertex dots */}
            <View style={[styles.apexDot, { left: vA.x - 3, top: vA.y - 3, backgroundColor: theme.textSecondary }]} />
            <View style={[styles.apexDot, { left: vB.x - 3, top: vB.y - 3, backgroundColor: theme.textSecondary }]} />
            <View style={[styles.apexDot, { left: vC.x - 3, top: vC.y - 3, backgroundColor: theme.textSecondary }]} />

            {/* SVG Arcs for Angles */}
            {isValidTriangle && (
              <Svg style={StyleSheet.absoluteFill}>
                {renderArc(vA, vB, vC, 16, theme.textSecondary)}
                {renderArc(vB, vA, vC, 16, theme.textSecondary)}
                {renderArc(vC, vA, vB, 16, theme.textSecondary)}
              </Svg>
            )}

            {/* Dynamic Lines representing sides */}
            {renderDynamicLine(vA, vB, sideAHighlight, 'sideA')}
            {renderDynamicLine(vB, vC, sideBHighlight, 'sideB')}
            {renderDynamicLine(vA, vC, sideCHighlight, 'sideC')}

            {/* Labels for sides */}
            <View style={[styles.labelBox, { left: labelAB_pos.x - 25, top: labelAB_pos.y - 10, width: 50, backgroundColor: isSideAActive ? '#3c87f7' : theme.backgroundElement, borderColor: isSideAActive ? '#3c87f7' : 'rgba(120,120,120,0.2)' }]} pointerEvents="none">
              <RNText style={[styles.labelBoxText, { color: isSideAActive ? '#ffffff' : theme.text }]}>
                {labelABText}
              </RNText>
            </View>
            <View style={[styles.labelBox, { left: labelBC_pos.x - 25, top: labelBC_pos.y - 10, width: 50, backgroundColor: isSideBActive ? '#3c87f7' : theme.backgroundElement, borderColor: isSideBActive ? '#3c87f7' : 'rgba(120,120,120,0.2)' }]} pointerEvents="none">
              <RNText style={[styles.labelBoxText, { color: isSideBActive ? '#ffffff' : theme.text }]}>
                {labelBCText}
              </RNText>
            </View>
            <View style={[styles.labelBox, { left: labelCA_pos.x - 25, top: labelCA_pos.y - 10, width: 50, backgroundColor: isSideCActive ? '#3c87f7' : theme.backgroundElement, borderColor: isSideCActive ? '#3c87f7' : 'rgba(120,120,120,0.2)' }]} pointerEvents="none">
              <RNText style={[styles.labelBoxText, { color: isSideCActive ? '#ffffff' : theme.text }]}>
                {labelCAText}
              </RNText>
            </View>

            {/* Vertex labels */}
            <View style={[styles.vertexLabelBox, { left: vertexA_pos.x - 12, top: vertexA_pos.y - 10 }]} pointerEvents="none">
              <RNText style={[styles.vertexLabelText, { color: theme.textSecondary }]}>A</RNText>
            </View>
            <View style={[styles.vertexLabelBox, { left: vertexB_pos.x - 12, top: vertexB_pos.y - 10 }]} pointerEvents="none">
              <RNText style={[styles.vertexLabelText, { color: theme.textSecondary }]}>B</RNText>
            </View>
            <View style={[styles.vertexLabelBox, { left: vertexC_pos.x - 12, top: vertexC_pos.y - 10 }]} pointerEvents="none">
              <RNText style={[styles.vertexLabelText, { color: theme.textSecondary }]}>C</RNText>
            </View>

            {/* Labels for angles */}
            {isValidTriangle && (
              <>
                <View style={[styles.angleLabelBox, { left: angleA_pos.x - 30, top: angleA_pos.y - 8 }]} pointerEvents="none">
                  <RNText style={[styles.angleLabelText, { color: isSideAActive ? '#3c87f7' : 'rgba(120,120,120,0.7)' }]}>
                    ∠A {angleA.toFixed(1)}°
                  </RNText>
                </View>
                <View style={[styles.angleLabelBox, { left: angleB_pos.x - 30, top: angleB_pos.y - 8 }]} pointerEvents="none">
                  <RNText style={[styles.angleLabelText, { color: isSideBActive ? '#3c87f7' : 'rgba(120,120,120,0.7)' }]}>
                    ∠B {angleB.toFixed(1)}°
                  </RNText>
                </View>
                <View style={[styles.angleLabelBox, { left: angleC_pos.x - 30, top: angleC_pos.y - 8 }]} pointerEvents="none">
                  <RNText style={[styles.angleLabelText, { color: isSideCActive ? '#3c87f7' : 'rgba(120,120,120,0.7)' }]}>
                    ∠C {angleC.toFixed(1)}°
                  </RNText>
                </View>
              </>
            )}
          </View>
        );
      }

      case 'rectangle': {
        const lengthHighlight = getHighlightStyle(['length']);
        const widthHighlight = getHighlightStyle(['width']);
        return (
          <View style={styles.canvas}>
            <View style={[styles.rectangleBox, { borderColor: theme.textSecondary }]}>
              {/* Highlight borders */}
              <View style={[styles.rectBorderHighlight, { bottom: -2, left: -2, right: -2, height: 4, backgroundColor: lengthHighlight.borderColor }]} />
              <View style={[styles.rectBorderHighlight, { top: -2, bottom: -2, right: -2, width: 4, backgroundColor: widthHighlight.borderColor }]} />
            </View>
            <ThemedText style={[styles.label, styles.bottomLabel, { color: lengthHighlight.color, fontWeight: lengthHighlight.fontWeight as any }]}>
              length (l)
            </ThemedText>
            <ThemedText style={[styles.label, styles.rightLabel, { color: widthHighlight.color, fontWeight: widthHighlight.fontWeight as any }]}>
              width (w)
            </ThemedText>
          </View>
        );
      }

      case 'parallelogram': {
        const baseHighlight = getHighlightStyle(['base']);
        const heightHighlight = getHighlightStyle(['height']);
        return (
          <View style={styles.canvas}>
            {/* Skewed parallelogram container */}
            <View style={[styles.parallelogramContainer, { transform: [{ skewX: '-20deg' }] }]}>
              <View style={[styles.parallelogramBox, { borderColor: theme.textSecondary }]}>
                {/* Base highlight */}
                <View style={[styles.rectBorderHighlight, { bottom: -2, left: -2, right: -2, height: 4, backgroundColor: baseHighlight.borderColor }]} />
              </View>
            </View>

            {/* Height indicator (dashed vertical line inside) */}
            <View style={[styles.verticalDashedContainer, { left: '35%', top: 30, height: 75 }]}>
              {Array.from({ length: 6 }).map((_, i) => (
                <View key={i} style={[styles.dashDot, { backgroundColor: heightHighlight.borderColor }]} />
              ))}
            </View>

            {/* Height right angle indicator */}
            <View style={[styles.rightAngle, { left: '35%', bottom: 35, borderColor: heightHighlight.borderColor }]} />

            <ThemedText style={[styles.label, styles.bottomLabel, { color: baseHighlight.color, fontWeight: baseHighlight.fontWeight as any }]}>
              base (b)
            </ThemedText>
            <ThemedText style={[styles.label, styles.heightLabel, { left: '22%', top: 58, color: heightHighlight.color, fontWeight: heightHighlight.fontWeight as any }]}>
              height (h)
            </ThemedText>
          </View>
        );
      }

      case 'trapezoid': {
        const topHighlight = getHighlightStyle(['sideA']);
        const bottomHighlight = getHighlightStyle(['sideB']);
        const heightHighlight = getHighlightStyle(['height']);
        return (
          <View style={styles.canvas}>
            {/* Base bottom line */}
            <View style={[styles.line, styles.horizontalLine, { bottom: 35, left: 30, right: 30, backgroundColor: bottomHighlight.borderColor }]} />

            {/* Top base line */}
            <View style={[styles.line, styles.horizontalLine, { top: 35, left: 60, right: 60, backgroundColor: topHighlight.borderColor }]} />

            {/* Left slanted side */}
            <View style={[styles.line, {
              top: 35,
              left: 60,
              width: 80,
              height: 2,
              transform: [{ rotate: '68deg' }, { translateX: -37 }],
              backgroundColor: theme.textSecondary
            }]} />

            {/* Right slanted side */}
            <View style={[styles.line, {
              top: 35,
              right: 60,
              width: 80,
              height: 2,
              transform: [{ rotate: '-68deg' }, { translateX: 37 }],
              backgroundColor: theme.textSecondary
            }]} />

            {/* Height indicator */}
            <View style={[styles.verticalDashedContainer, { left: '35%', top: 35, height: 70 }]}>
              {Array.from({ length: 6 }).map((_, i) => (
                <View key={i} style={[styles.dashDot, { backgroundColor: heightHighlight.borderColor }]} />
              ))}
            </View>

            <View style={[styles.rightAngle, { left: '35%', bottom: 35, borderColor: heightHighlight.borderColor }]} />

            <ThemedText style={[styles.label, { top: 12, left: '42%', color: topHighlight.color, fontWeight: topHighlight.fontWeight as any }]}>
              top base (a)
            </ThemedText>
            <ThemedText style={[styles.label, styles.bottomLabel, { color: bottomHighlight.color, fontWeight: bottomHighlight.fontWeight as any }]}>
              bottom base (b)
            </ThemedText>
            <ThemedText style={[styles.label, styles.heightLabel, { left: '22%', top: 58, color: heightHighlight.color, fontWeight: heightHighlight.fontWeight as any }]}>
              height (h)
            </ThemedText>
          </View>
        );
      }

      case 'quadrilateral': {
        const sideAHighlight = getHighlightStyle(['sideA']);
        const sideBHighlight = getHighlightStyle(['sideB']);
        const sideCHighlight = getHighlightStyle(['sideC']);
        const sideDHighlight = getHighlightStyle(['sideD']);

        // Parse side lengths — AB, BC, CD, DA
        let s0 = parseFloat(sides[0]); // AB
        let s1 = parseFloat(sides[1]); // BC
        let s2 = parseFloat(sides[2]); // CD
        let s3 = parseFloat(sides[3]); // DA

        const isValidQuad =
          !isNaN(s0) && !isNaN(s1) && !isNaN(s2) && !isNaN(s3) &&
          s0 > 0 && s1 > 0 && s2 > 0 && s3 > 0;

        if (!isValidQuad) {
          // Default rectangle shape
          s0 = 3; s1 = 5; s2 = 3; s3 = 5;
        }

        // Use generatePolygon to get vertex positions for the 4 sides
        const modelPoints = generatePolygon([s0, s1, s2, s3]);
        // modelPoints[0] = A, [1] = B, [2] = C, [3] = D

        // Compute interior angles
        const angles = isValidQuad ? calculateInteriorAngles(modelPoints) : [90, 90, 90, 90];
        const angleA = angles[0]; // ∠A at vertex A
        const angleB = angles[1]; // ∠B at vertex B
        const angleC = angles[2]; // ∠C at vertex C
        const angleD = angles[3]; // ∠D at vertex D

        // Rotate 90 degrees clockwise: (x, y) -> (y, -x)
        const rotPoints = modelPoints.map(p => ({ x: p.y, y: -p.x }));
        const rA = rotPoints[0]; // A
        const rB = rotPoints[1]; // B
        const rC = rotPoints[2]; // C
        const rD = rotPoints[3]; // D

        // Bounding box
        const minX = Math.min(rA.x, rB.x, rC.x, rD.x);
        const maxX = Math.max(rA.x, rB.x, rC.x, rD.x);
        const minY = Math.min(rA.y, rB.y, rC.y, rD.y);
        const maxY = Math.max(rA.y, rB.y, rC.y, rD.y);

        const w = maxX - minX;
        const h = maxY - minY;

        // Scaling to fit canvas (300x180 max, using 220x100 to leave padding for labels)
        const maxWidth = 220;
        const maxHeight = 100;
        const scale = w > 0 && h > 0 ? Math.min(maxWidth / w, maxHeight / h) : 1;

        const scaledW = w * scale;
        const scaledH = h * scale;

        // Center offsets (Canvas size: 300x180)
        const offsetX = (300 - scaledW) / 2;
        const offsetY = (180 - scaledH) / 2;

        // Scale and shift coordinates (invert Y axis for React Native)
        const transformPoint = (p: { x: number, y: number }) => ({
          x: (p.x - minX) * scale + offsetX,
          y: 180 - ((p.y - minY) * scale + offsetY)
        });

        // Screen coordinates of vertices
        const vA = transformPoint(rA);
        const vB = transformPoint(rB);
        const vC = transformPoint(rC);
        const vD = transformPoint(rD);

        const centroidX = (vA.x + vB.x + vC.x + vD.x) / 4;
        const centroidY = (vA.y + vB.y + vC.y + vD.y) / 4;

        const renderDynamicLine = (start: { x: number, y: number }, end: { x: number, y: number }, styleHighlight: any, label: string) => {
          const length = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
          const angle = Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI;
          const midX = (start.x + end.x) / 2;
          const midY = (start.y + end.y) / 2;

          return (
            <View key={label} style={[
              styles.line,
              {
                left: midX - length / 2,
                top: midY - 1,
                width: length,
                height: 2,
                backgroundColor: styleHighlight.borderColor,
                transform: [{ rotate: `${angle}deg` }]
              }
            ]} />
          );
        };

        // Helper to push text outward from centroid (in screen space)
        const getLabelPos = (p: { x: number, y: number }, distanceAway: number) => {
          const vx = p.x - centroidX;
          const vy = p.y - centroidY;
          const len = Math.sqrt(vx * vx + vy * vy) || 1;
          return { x: p.x + (vx / len) * distanceAway, y: p.y + (vy / len) * distanceAway };
        };

        // Helper to push text inward from vertex (in screen space)
        const getInteriorPos = (p: { x: number, y: number }, distanceInside: number) => {
          const vx = centroidX - p.x;
          const vy = centroidY - p.y;
          const len = Math.sqrt(vx * vx + vy * vy) || 1;
          return { x: p.x + (vx / len) * distanceInside, y: p.y + (vy / len) * distanceInside };
        };

        const renderArc = (v: { x: number, y: number }, adj1: { x: number, y: number }, adj2: { x: number, y: number }, R: number, color: string) => {
          const u = { x: adj1.x - v.x, y: adj1.y - v.y };
          const w = { x: adj2.x - v.x, y: adj2.y - v.y };
          const lenU = Math.sqrt(u.x * u.x + u.y * u.y) || 1;
          const lenW = Math.sqrt(w.x * w.x + w.y * w.y) || 1;
          const nu = { x: u.x / lenU, y: u.y / lenU };
          const nw = { x: w.x / lenW, y: w.y / lenW };
          const A = { x: v.x + nu.x * R, y: v.y + nu.y * R };
          const B = { x: v.x + nw.x * R, y: v.y + nw.y * R };
          const cross = nu.x * nw.y - nu.y * nw.x;
          const sweep = cross > 0 ? 1 : 0;
          return <Path d={`M ${A.x} ${A.y} A ${R} ${R} 0 0 ${sweep} ${B.x} ${B.y}`} fill="none" stroke={color} strokeWidth="1.5" />;
        };

        // Edge midpoints
        const midAB = { x: (vA.x + vB.x) / 2, y: (vA.y + vB.y) / 2 }; // AB
        const midBC = { x: (vB.x + vC.x) / 2, y: (vB.y + vC.y) / 2 }; // BC
        const midCD = { x: (vC.x + vD.x) / 2, y: (vC.y + vD.y) / 2 }; // CD
        const midDA = { x: (vD.x + vA.x) / 2, y: (vD.y + vA.y) / 2 }; // DA

        // Side label positions
        const labelAB_pos = getLabelPos(midAB, 22);
        const labelBC_pos = getLabelPos(midBC, 22);
        const labelCD_pos = getLabelPos(midCD, 22);
        const labelDA_pos = getLabelPos(midDA, 22);

        // Angle labels pulled inward from each vertex
        const angleA_pos = getInteriorPos(vA, 22);
        const angleB_pos = getInteriorPos(vB, 22);
        const angleC_pos = getInteriorPos(vC, 22);
        const angleD_pos = getInteriorPos(vD, 22);

        // Vertex label positions (pushed outward from centroid)
        const vertexA_pos = getLabelPos(vA, 18);
        const vertexB_pos = getLabelPos(vB, 18);
        const vertexC_pos = getLabelPos(vC, 18);
        const vertexD_pos = getLabelPos(vD, 18);

        // Active state booleans for each side
        const isSideAActive = activeField === 'sideA'; // AB
        const isSideBActive = activeField === 'sideB'; // BC
        const isSideCActive = activeField === 'sideC'; // CD
        const isSideDActive = activeField === 'sideD'; // DA

        // Side label text
        const labelABText = isValidQuad ? (sideLabels?.[0] ?? `${s0}`) : 'a';
        const labelBCText = isValidQuad ? (sideLabels?.[1] ?? `${s1}`) : 'b';
        const labelCDText = isValidQuad ? (sideLabels?.[2] ?? `${s2}`) : 'c';
        const labelDAText = isValidQuad ? (sideLabels?.[3] ?? `${s3}`) : 'd';

        return (
          <View style={styles.canvas}>
            {/* Vertex dots */}
            <View style={[styles.apexDot, { left: vA.x - 3, top: vA.y - 3, backgroundColor: theme.textSecondary }]} />
            <View style={[styles.apexDot, { left: vB.x - 3, top: vB.y - 3, backgroundColor: theme.textSecondary }]} />
            <View style={[styles.apexDot, { left: vC.x - 3, top: vC.y - 3, backgroundColor: theme.textSecondary }]} />
            <View style={[styles.apexDot, { left: vD.x - 3, top: vD.y - 3, backgroundColor: theme.textSecondary }]} />

            {/* SVG Arcs for Angles */}
            {isValidQuad && (
              <Svg style={StyleSheet.absoluteFill}>
                {renderArc(vA, vB, vD, 14, theme.textSecondary)}
                {renderArc(vB, vA, vC, 14, theme.textSecondary)}
                {renderArc(vC, vB, vD, 14, theme.textSecondary)}
                {renderArc(vD, vA, vC, 14, theme.textSecondary)}
              </Svg>
            )}

            {/* Dynamic Lines representing sides */}
            {renderDynamicLine(vA, vB, sideAHighlight, 'sideA')}
            {renderDynamicLine(vB, vC, sideBHighlight, 'sideB')}
            {renderDynamicLine(vC, vD, sideCHighlight, 'sideC')}
            {renderDynamicLine(vD, vA, sideDHighlight, 'sideD')}

            {/* Labels for sides */}
            <View style={[styles.labelBox, { left: labelAB_pos.x - 25, top: labelAB_pos.y - 10, width: 50, backgroundColor: isSideAActive ? '#3c87f7' : theme.backgroundElement, borderColor: isSideAActive ? '#3c87f7' : 'rgba(120,120,120,0.2)' }]} pointerEvents="none">
              <RNText style={[styles.labelBoxText, { color: isSideAActive ? '#ffffff' : theme.text }]}>
                {labelABText}
              </RNText>
            </View>
            <View style={[styles.labelBox, { left: labelBC_pos.x - 25, top: labelBC_pos.y - 10, width: 50, backgroundColor: isSideBActive ? '#3c87f7' : theme.backgroundElement, borderColor: isSideBActive ? '#3c87f7' : 'rgba(120,120,120,0.2)' }]} pointerEvents="none">
              <RNText style={[styles.labelBoxText, { color: isSideBActive ? '#ffffff' : theme.text }]}>
                {labelBCText}
              </RNText>
            </View>
            <View style={[styles.labelBox, { left: labelCD_pos.x - 25, top: labelCD_pos.y - 10, width: 50, backgroundColor: isSideCActive ? '#3c87f7' : theme.backgroundElement, borderColor: isSideCActive ? '#3c87f7' : 'rgba(120,120,120,0.2)' }]} pointerEvents="none">
              <RNText style={[styles.labelBoxText, { color: isSideCActive ? '#ffffff' : theme.text }]}>
                {labelCDText}
              </RNText>
            </View>
            <View style={[styles.labelBox, { left: labelDA_pos.x - 25, top: labelDA_pos.y - 10, width: 50, backgroundColor: isSideDActive ? '#3c87f7' : theme.backgroundElement, borderColor: isSideDActive ? '#3c87f7' : 'rgba(120,120,120,0.2)' }]} pointerEvents="none">
              <RNText style={[styles.labelBoxText, { color: isSideDActive ? '#ffffff' : theme.text }]}>
                {labelDAText}
              </RNText>
            </View>

            {/* Vertex labels */}
            <View style={[styles.vertexLabelBox, { left: vertexA_pos.x - 12, top: vertexA_pos.y - 10 }]} pointerEvents="none">
              <RNText style={[styles.vertexLabelText, { color: theme.textSecondary }]}>A</RNText>
            </View>
            <View style={[styles.vertexLabelBox, { left: vertexB_pos.x - 12, top: vertexB_pos.y - 10 }]} pointerEvents="none">
              <RNText style={[styles.vertexLabelText, { color: theme.textSecondary }]}>B</RNText>
            </View>
            <View style={[styles.vertexLabelBox, { left: vertexC_pos.x - 12, top: vertexC_pos.y - 10 }]} pointerEvents="none">
              <RNText style={[styles.vertexLabelText, { color: theme.textSecondary }]}>C</RNText>
            </View>
            <View style={[styles.vertexLabelBox, { left: vertexD_pos.x - 12, top: vertexD_pos.y - 10 }]} pointerEvents="none">
              <RNText style={[styles.vertexLabelText, { color: theme.textSecondary }]}>D</RNText>
            </View>

            {/* Labels for angles */}
            {isValidQuad && (
              <>
                <View style={[styles.angleLabelBox, { left: angleA_pos.x - 30, top: angleA_pos.y - 8 }]} pointerEvents="none">
                  <RNText style={[styles.angleLabelText, { color: isSideAActive ? '#3c87f7' : 'rgba(120,120,120,0.7)' }]}>
                    ∠A {angleA.toFixed(1)}°
                  </RNText>
                </View>
                <View style={[styles.angleLabelBox, { left: angleB_pos.x - 30, top: angleB_pos.y - 8 }]} pointerEvents="none">
                  <RNText style={[styles.angleLabelText, { color: isSideBActive ? '#3c87f7' : 'rgba(120,120,120,0.7)' }]}>
                    ∠B {angleB.toFixed(1)}°
                  </RNText>
                </View>
                <View style={[styles.angleLabelBox, { left: angleC_pos.x - 30, top: angleC_pos.y - 8 }]} pointerEvents="none">
                  <RNText style={[styles.angleLabelText, { color: isSideCActive ? '#3c87f7' : 'rgba(120,120,120,0.7)' }]}>
                    ∠C {angleC.toFixed(1)}°
                  </RNText>
                </View>
                <View style={[styles.angleLabelBox, { left: angleD_pos.x - 30, top: angleD_pos.y - 8 }]} pointerEvents="none">
                  <RNText style={[styles.angleLabelText, { color: isSideDActive ? '#3c87f7' : 'rgba(120,120,120,0.7)' }]}>
                    ∠D {angleD.toFixed(1)}°
                  </RNText>
                </View>
              </>
            )}
          </View>
        );
      }

      default:
        return null;
    }
  };

  return (
    <GestureDetector gesture={composed}>
      <Animated.View style={[styles.container, { backgroundColor: theme.backgroundElement }]}>
        {/* <ThemedText style={{ position: 'absolute', top: 10, right: 10, fontSize: 10, color: theme.textSecondary, zIndex: 10, opacity: 0.6 }}>
          Pinch to zoom, drag to pan. Double tap to reset.
        </ThemedText> */}
        <Animated.View style={animatedStyle}>
          {renderShape()}
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 220,
    width: '100%',
    borderRadius: Spacing.four,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  canvas: {
    width: 300,
    height: 180,
    position: 'relative',
  },
  line: {
    position: 'absolute',
  },
  horizontalLine: {
    height: 2,
  },
  verticalDashedContainer: {
    position: 'absolute',
    left: '50%',
    top: 30,
    bottom: 35,
    width: 2,
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dashDot: {
    width: 2,
    height: 6,
    borderRadius: 1,
  },
  rightAngle: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderTopWidth: 1.5,
    borderRightWidth: 1.5,
    transform: [{ rotate: '-90deg' }],
  },
  apexDot: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    zIndex: 10,
  },
  labelBox: {
    position: 'absolute',
    height: 22,
    borderRadius: 4,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  labelBoxText: {
    fontSize: 11,
    fontWeight: 'bold',
    lineHeight: 14,
  },
  vertexLabelBox: {
    position: 'absolute',
    width: 24,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  vertexLabelText: {
    fontSize: 12,
    fontWeight: 'bold',
    lineHeight: 14,
  },
  angleLabelBox: {
    position: 'absolute',
    width: 60,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  angleLabelText: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 14,
  },
  rectangleBox: {
    position: 'absolute',
    top: 30,
    bottom: 35,
    left: 40,
    right: 40,
    borderWidth: 2,
    borderRadius: Spacing.one,
  },
  rectBorderHighlight: {
    position: 'absolute',
  },
  parallelogramContainer: {
    position: 'absolute',
    top: 30,
    bottom: 35,
    left: 50,
    right: 50,
  },
  parallelogramBox: {
    flex: 1,
    borderWidth: 2,
    borderRadius: Spacing.one,
  },
  label: {
    position: 'absolute',
    fontSize: 12,
  },
  bottomLabel: {
    bottom: 10,
    left: 0,
    right: 0,
    textAlign: 'center',
  },
  rightLabel: {
    right: 15,
    top: '40%',
  },
  heightLabel: {
    left: '37%',
    top: '40%',
  },
  dynamicLabel: {
    position: 'absolute',
    fontSize: 12,
    textAlign: 'center',
    width: 50,
    height: 20,
    lineHeight: 20,
  },
});
