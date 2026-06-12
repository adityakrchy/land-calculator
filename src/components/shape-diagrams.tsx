import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { StyleSheet, View } from 'react-native';
import { ThemedText } from './themed-text';
import Svg, { Path } from 'react-native-svg';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';

interface ShapeDiagramProps {
  shape: 'triangle' | 'rectangle' | 'parallelogram' | 'trapezoid' | 'quadrilateral';
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
      case 'triangle': {
        const sideAHighlight = getHighlightStyle(['sideA']);
        const sideBHighlight = getHighlightStyle(['sideB']);
        const sideCHighlight = getHighlightStyle(['sideC']);

        // Parse side lengths
        let a = parseFloat(sides[0]);
        let b = parseFloat(sides[1]);
        let c = parseFloat(sides[2]);

        const isValidTriangle =
          !isNaN(a) && !isNaN(b) && !isNaN(c) &&
          a > 0 && b > 0 && c > 0 &&
          a + b > c && a + c > b && b + c > a;

        if (!isValidTriangle) {
          // Generic fallback triangle if inputs are incomplete or invalid
          a = 5; b = 6; c = 5;
        }

        // Geometric calculation (base = b, placed on X axis)
        const p1 = { x: 0, y: 0 };
        const p2 = { x: b, y: 0 };
        const x3 = (b * b + a * a - c * c) / (2 * b);
        const y3 = Math.sqrt(Math.max(0, a * a - x3 * x3));
        const p3 = { x: x3, y: y3 };

        // Bounding box
        const minX = Math.min(0, b, x3);
        const maxX = Math.max(0, b, x3);
        const minY = 0;
        const maxY = y3;

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
        const transformPoint = (p: {x: number, y: number}) => ({
          x: (p.x - minX) * scale + offsetX,
          y: 180 - ((p.y - minY) * scale + offsetY)
        });

        const v1 = transformPoint(p1);
        const v2 = transformPoint(p2);
        const v3 = transformPoint(p3);

        const centroidX = (v1.x + v2.x + v3.x) / 3;
        const centroidY = (v1.y + v2.y + v3.y) / 3;

        const renderDynamicLine = (start: {x: number, y: number}, end: {x: number, y: number}, styleHighlight: any, label: string) => {
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

        // Internal Angles (Law of Cosines)
        const angleA = Math.acos((b * b + c * c - a * a) / (2 * b * c)) * (180 / Math.PI);
        const angleB = Math.acos((a * a + c * c - b * b) / (2 * a * c)) * (180 / Math.PI);
        const angleC = Math.acos((a * a + b * b - c * c) / (2 * a * b)) * (180 / Math.PI);

        // Helper to push text outward from midpoint
        const getLabelPos = (p: {x: number, y: number}, distanceAway: number) => {
          const vx = p.x - centroidX;
          const vy = p.y - centroidY;
          const len = Math.sqrt(vx * vx + vy * vy) || 1;
          return { x: p.x + (vx / len) * distanceAway, y: p.y + (vy / len) * distanceAway };
        };

        // Helper to push text inward from vertex
        const getInteriorPos = (p: {x: number, y: number}, distanceInside: number) => {
            const vx = centroidX - p.x;
            const vy = centroidY - p.y;
            const len = Math.sqrt(vx * vx + vy * vy) || 1;
            return { x: p.x + (vx / len) * distanceInside, y: p.y + (vy / len) * distanceInside };
        };

        const renderArc = (v: {x: number, y: number}, adj1: {x: number, y: number}, adj2: {x: number, y: number}, R: number, color: string) => {
          const u = { x: adj1.x - v.x, y: adj1.y - v.y };
          const w = { x: adj2.x - v.x, y: adj2.y - v.y };
          const lenU = Math.sqrt(u.x*u.x + u.y*u.y) || 1;
          const lenW = Math.sqrt(w.x*w.x + w.y*w.y) || 1;
          const nu = { x: u.x/lenU, y: u.y/lenU };
          const nw = { x: w.x/lenW, y: w.y/lenW };
          const A = { x: v.x + nu.x * R, y: v.y + nu.y * R };
          const B = { x: v.x + nw.x * R, y: v.y + nw.y * R };
          const cross = nu.x * nw.y - nu.y * nw.x;
          const sweep = cross > 0 ? 1 : 0;
          return <Path d={`M ${A.x} ${A.y} A ${R} ${R} 0 0 ${sweep} ${B.x} ${B.y}`} fill="none" stroke={color} strokeWidth="1.5" />;
        };

        const sideB_mid = { x: (v1.x + v2.x) / 2, y: (v1.y + v2.y) / 2 };
        const sideA_mid = { x: (v1.x + v3.x) / 2, y: (v1.y + v3.y) / 2 };
        const sideC_mid = { x: (v2.x + v3.x) / 2, y: (v2.y + v3.y) / 2 };

        const labelB_pos = getLabelPos(sideB_mid, 20);
        const labelA_pos = getLabelPos(sideA_mid, 20);
        const labelC_pos = getLabelPos(sideC_mid, 20);

        const pA_text = getInteriorPos(v2, 45);
        const pB_text = getInteriorPos(v3, 45);
        const pC_text = getInteriorPos(v1, 45);

        return (
          <View style={styles.canvas}>
            {/* SVG Arcs for Angles */}
            {isValidTriangle && (
              <Svg style={StyleSheet.absoluteFill}>
                {renderArc(v1, v2, v3, 16, theme.textSecondary)}
                {renderArc(v2, v1, v3, 16, theme.textSecondary)}
                {renderArc(v3, v1, v2, 16, theme.textSecondary)}
              </Svg>
            )}

            {/* Dynamic Lines representing sides */}
            {renderDynamicLine(v1, v2, sideBHighlight, 'sideB')}
            {renderDynamicLine(v1, v3, sideAHighlight, 'sideA')}
            {renderDynamicLine(v2, v3, sideCHighlight, 'sideC')}

            {/* Labels for sides */}
            <ThemedText style={[styles.dynamicLabel, { left: labelA_pos.x - 25, top: labelA_pos.y - 10, color: sideAHighlight.color, fontWeight: sideAHighlight.fontWeight as any }]}>
              {isValidTriangle ? (sideLabels?.[0] ?? `${a}`) : 'a'}
            </ThemedText>
            <ThemedText style={[styles.dynamicLabel, { left: labelB_pos.x - 25, top: labelB_pos.y - 10, color: sideBHighlight.color, fontWeight: sideBHighlight.fontWeight as any }]}>
              {isValidTriangle ? (sideLabels?.[1] ?? `${b}`) : 'b'}
            </ThemedText>
            <ThemedText style={[styles.dynamicLabel, { left: labelC_pos.x - 25, top: labelC_pos.y - 10, color: sideCHighlight.color, fontWeight: sideCHighlight.fontWeight as any }]}>
              {isValidTriangle ? (sideLabels?.[2] ?? `${c}`) : 'c'}
            </ThemedText>

            {/* Labels for angles */}
            {isValidTriangle && (
              <>
                <ThemedText style={[styles.dynamicLabel, { left: pA_text.x - 25, top: pA_text.y - 10, fontSize: 10, color: theme.textSecondary }]}>
                  {angleA.toFixed(1)}°
                </ThemedText>
                <ThemedText style={[styles.dynamicLabel, { left: pB_text.x - 25, top: pB_text.y - 10, fontSize: 10, color: theme.textSecondary }]}>
                  {angleB.toFixed(1)}°
                </ThemedText>
                <ThemedText style={[styles.dynamicLabel, { left: pC_text.x - 25, top: pC_text.y - 10, fontSize: 10, color: theme.textSecondary }]}>
                  {angleC.toFixed(1)}°
                </ThemedText>
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
        const dHighlight = getHighlightStyle(['diagonal']);
        const h1Highlight = getHighlightStyle(['h1']);
        const h2Highlight = getHighlightStyle(['h2']);
        return (
          <View style={styles.canvas}>
            {/* Outer Boundary of quadrilateral */}
            {/* Side 1: Top-Left to Top-Right */}
            <View style={[styles.line, { top: 50, left: 50, width: 105, height: 2, transform: [{ rotate: '-12deg' }, { translateX: 50 }], backgroundColor: theme.textSecondary }]} />
            {/* Side 2: Top-Right to Bottom-Right */}
            <View style={[styles.line, { top: 40, right: 40, width: 85, height: 2, transform: [{ rotate: '70deg' }, { translateY: 40 }], backgroundColor: theme.textSecondary }]} />
            {/* Side 3: Bottom-Right to Bottom-Left */}
            <View style={[styles.line, { bottom: 40, left: 40, width: 145, height: 2, transform: [{ rotate: '5deg' }, { translateX: 70 }], backgroundColor: theme.textSecondary }]} />
            {/* Side 4: Bottom-Left to Top-Left */}
            <View style={[styles.line, { top: 50, left: 50, width: 75, height: 2, transform: [{ rotate: '100deg' }, { translateY: 35 }], backgroundColor: theme.textSecondary }]} />

            {/* Diagonal line (dashed) */}
            <View style={[styles.line, {
              top: 50,
              left: 50,
              width: 160,
              height: 2,
              borderStyle: 'dashed',
              borderWidth: 1,
              transform: [{ rotate: '25deg' }, { translateX: 75 }],
              borderColor: dHighlight.borderColor,
              backgroundColor: 'transparent'
            }]} />

            {/* Perpendicular h1 (top-left apex to diagonal) */}
            <View style={[styles.line, {
              top: 40,
              left: 50,
              width: 48,
              height: 2,
              borderStyle: 'dashed',
              borderWidth: 1,
              transform: [{ rotate: '-65deg' }, { translateX: 22 }, { translateY: 10 }],
              borderColor: h1Highlight.borderColor,
              backgroundColor: 'transparent'
            }]} />

            {/* Perpendicular h2 (bottom-right apex to diagonal) */}
            <View style={[styles.line, {
              bottom: 40,
              right: 40,
              width: 45,
              height: 2,
              borderStyle: 'dashed',
              borderWidth: 1,
              transform: [{ rotate: '-65deg' }, { translateX: -20 }, { translateY: -10 }],
              borderColor: h2Highlight.borderColor,
              backgroundColor: 'transparent'
            }]} />

            {/* Labels */}
            <ThemedText style={[styles.label, { top: 78, left: '55%', color: dHighlight.color, fontWeight: dHighlight.fontWeight as any, fontSize: 11 }]}>
              diagonal (d)
            </ThemedText>
            <ThemedText style={[styles.label, { top: 38, left: '26%', color: h1Highlight.color, fontWeight: h1Highlight.fontWeight as any, fontSize: 11 }]}>
              h1
            </ThemedText>
            <ThemedText style={[styles.label, { bottom: 35, right: '28%', color: h2Highlight.color, fontWeight: h2Highlight.fontWeight as any, fontSize: 11 }]}>
              h2
            </ThemedText>
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
        <ThemedText style={{ position: 'absolute', top: 10, right: 10, fontSize: 10, color: theme.textSecondary, zIndex: 10, opacity: 0.6 }}>
          Pinch to zoom, drag to pan. Double tap to reset.
        </ThemedText>
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
    left: '50%',
    top: 28,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#3c87f7',
    marginLeft: -3,
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
