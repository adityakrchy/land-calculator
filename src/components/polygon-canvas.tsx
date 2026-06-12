import React from 'react';
import { StyleSheet, View, Text as RNText } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { Vertex, Point } from '@/utils/geometry';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import { ThemedText } from './themed-text';

interface PolygonCanvasProps {
  vertices: Vertex[];
  sideLengths: Record<string, string>;
  sideCount: number;
  activeField: string | null;
  angles: number[];
  unit: string;
}

export function PolygonCanvas({ vertices, sideLengths, sideCount, activeField, angles, unit }: PolygonCanvasProps) {
  const theme = useTheme();

  // Gesture shared values for zoom & pan
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
      width: 320,
      height: 240,
      position: 'relative',
    };
  });

  if (vertices.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundElement }]}>
        <ThemedText themeColor="textSecondary" style={styles.placeholderText}>
          Enter side lengths and click &quot;Generate Geometry&quot; to plot.
        </ThemedText>
      </View>
    );
  }

  // Rotate vertices 90° clockwise for visual display: (x, y) → (y, -x)
  const renderVertices = vertices.map(v => ({ ...v, x: v.y, y: -v.x }));

  // Bounding box calculation for scaling and centering
  const xs = renderVertices.map((v) => v.x);
  const ys = renderVertices.map((v) => v.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const w = maxX - minX || 1;
  const h = maxY - minY || 1;

  const canvasWidth = 320;
  const canvasHeight = 240;
  const padding = 70; // Leave margin for labels

  const scale = Math.min((canvasWidth - padding) / w, (canvasHeight - padding) / h);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  // Center of coordinates mapping function
  const transformPoint = (p: Point): Point => {
    return {
      x: (p.x - centerX) * scale + canvasWidth / 2,
      y: canvasHeight / 2 - (p.y - centerY) * scale, // Flip Y axis for screen space
    };
  };

  // Centroid of the polygon for pushing labels outward / pulling angles inward
  const centroidX = renderVertices.reduce((sum, v) => sum + v.x, 0) / renderVertices.length;
  const centroidY = renderVertices.reduce((sum, v) => sum + v.y, 0) / renderVertices.length;
  const centroidScreen = transformPoint({ x: centroidX, y: centroidY });

  const transformedPoints = renderVertices.map((v) => transformPoint(v));

  // Angle arc renderer helper
  const renderArc = (v: Point, prev: Point, next: Point, R: number, isActive: boolean) => {
    const ptV = transformPoint(v);
    const ptPrev = transformPoint(prev);
    const ptNext = transformPoint(next);

    const u = { x: ptPrev.x - ptV.x, y: ptPrev.y - ptV.y };
    const wVec = { x: ptNext.x - ptV.x, y: ptNext.y - ptV.y };

    const lenU = Math.sqrt(u.x * u.x + u.y * u.y) || 1;
    const lenW = Math.sqrt(wVec.x * wVec.x + wVec.y * wVec.y) || 1;

    const nu = { x: u.x / lenU, y: u.y / lenU };
    const nw = { x: wVec.x / lenW, y: wVec.y / lenW };

    const A = { x: ptV.x + nu.x * R, y: ptV.y + nu.y * R };
    const B = { x: ptV.x + nw.x * R, y: ptV.y + nw.y * R };

    // Find the correct sweep orientation
    const cross = nu.x * nw.y - nu.y * nw.x;
    const sweep = cross > 0 ? 1 : 0;

    return (
      <Path
        d={`M ${A.x} ${A.y} A ${R} ${R} 0 0 ${sweep} ${B.x} ${B.y}`}
        fill="none"
        stroke={isActive ? '#3c87f7' : 'rgba(120, 120, 120, 0.4)'}
        strokeWidth={isActive ? '2' : '1'}
      />
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText style={styles.hint}>
        Double-tap to reset. Pinch to zoom, drag to pan.
      </ThemedText>

      <GestureDetector gesture={composed}>
        <Animated.View style={styles.zoomArea}>
          <Animated.View style={animatedStyle}>
            {/* SVG Elements */}
            <Svg width={canvasWidth} height={canvasHeight} style={StyleSheet.absoluteFill}>
              {/* Draw Polygon Base Outline */}
              {renderVertices.map((v, i) => {
                const nextV = renderVertices[(i + 1) % renderVertices.length];
                const ptStart = transformedPoints[i];
                const ptEnd = transformedPoints[(i + 1) % renderVertices.length];
                const labelKey = `${v.id}${nextV.id}`;
                const isSideActive = activeField === labelKey;

                return (
                  <Path
                    key={`edge-${i}`}
                    d={`M ${ptStart.x} ${ptStart.y} L ${ptEnd.x} ${ptEnd.y}`}
                    stroke={isSideActive ? '#3c87f7' : 'rgba(120, 120, 120, 0.3)'}
                    strokeWidth={isSideActive ? '4.5' : '2'}
                    strokeLinecap="round"
                  />
                );
              })}

              {/* Draw Angle Arcs */}
              {renderVertices.map((v, i) => {
                const prev = renderVertices[(i - 1 + renderVertices.length) % renderVertices.length];
                const next = renderVertices[(i + 1) % renderVertices.length];
                const isAngleActive = activeField ? activeField.includes(v.id) : false;

                return (
                  <React.Fragment key={`arc-${v.id}`}>
                    {renderArc(v, prev, next, 15, isAngleActive)}
                  </React.Fragment>
                );
              })}

              {/* Draw Vertices */}
              {renderVertices.map((v, i) => {
                const pt = transformedPoints[i];
                const isVertexActive = activeField ? activeField.includes(v.id) : false;

                return (
                  <Circle
                    key={`dot-${v.id}`}
                    cx={pt.x}
                    cy={pt.y}
                    r={isVertexActive ? '6' : '4'}
                    fill={isVertexActive ? '#3c87f7' : theme.textSecondary}
                    stroke={theme.backgroundElement}
                    strokeWidth="1"
                  />
                );
              })}
            </Svg>

            {/* Direct sibling labels overlay (matching shape-diagrams.tsx layout structure) */}

            {/* Side Labels */}
            {renderVertices.map((v, i) => {
              const nextV = renderVertices[(i + 1) % renderVertices.length];
              const midPoint = { x: (v.x + nextV.x) / 2, y: (v.y + nextV.y) / 2 };
              const midScreen = transformPoint(midPoint);

              // Outward push direction in screen space (pixels)
              const dx = midScreen.x - centroidScreen.x;
              const dy = midScreen.y - centroidScreen.y;
              const dLen = Math.sqrt(dx * dx + dy * dy) || 1;
              const labelPos = {
                x: midScreen.x + (dx / dLen) * 28,
                y: midScreen.y + (dy / dLen) * 28,
              };
              const labelKey = `${v.id}${nextV.id}`;
              const labelVal = sideLengths[labelKey] || '';
              const isSideActive = activeField === labelKey;

              const displayText = labelVal ? `${labelVal} ${unit}` : labelKey;
              const rectWidth = displayText.length * 6 + 10;

              return (
                <View
                  key={`side-lbl-${i}`}
                  style={[
                    styles.absLabelContainer,
                    {
                      left: labelPos.x - rectWidth / 2,
                      top: labelPos.y - 9,
                      width: rectWidth,
                      backgroundColor: isSideActive ? '#3c87f7' : theme.backgroundElement,
                      borderColor: isSideActive ? '#3c87f7' : 'rgba(120,120,120,0.2)',
                    },
                  ]}
                  pointerEvents="none"
                >
                  <RNText
                    style={[
                      styles.sideText,
                      { color: isSideActive ? '#ffffff' : theme.text },
                    ]}
                  >
                    {displayText}
                  </RNText>
                </View>
              );
            })}

            {/* Vertex and Angle Labels */}
            {renderVertices.map((v, i) => {
              const vScreen = transformPoint(v);

              // Push vertex label outward from centroid in screen space
              const dxV = vScreen.x - centroidScreen.x;
              const dyV = vScreen.y - centroidScreen.y;
              const dLenV = Math.sqrt(dxV * dxV + dyV * dyV) || 1;
              const labelPos = {
                x: vScreen.x + (dxV / dLenV) * 18,
                y: vScreen.y + (dyV / dLenV) * 18,
              };

              // Pull angle text inward towards centroid in screen space
              const angleVal = angles[i] || 0;
              const anglePos = {
                x: vScreen.x - (dxV / dLenV) * 22,
                y: vScreen.y - (dyV / dLenV) * 22,
              };

              const isVertexActive = activeField ? activeField.includes(v.id) : false;

              return (
                <React.Fragment key={`labels-${v.id}`}>
                  {/* Vertex Label (A, B, C...) */}
                  <View
                    style={[styles.vertexLabelWrapper, { left: labelPos.x - 15, top: labelPos.y - 10 }]}
                    pointerEvents="none"
                  >
                    <RNText
                      style={[
                        styles.vertexText,
                        { color: isVertexActive ? '#3c87f7' : theme.textSecondary },
                      ]}
                    >
                      {v.id}
                    </RNText>
                  </View>

                  {/* Corner Angle Text */}
                  <View
                    style={[styles.angleLabelWrapper, { left: anglePos.x - 30, top: anglePos.y - 8 }]}
                    pointerEvents="none"
                  >
                    <RNText
                      style={[
                        styles.angleText,
                        { color: isVertexActive ? '#3c87f7' : 'rgba(120, 120, 120, 0.7)' },
                      ]}
                    >
                      {`∠${v.id}: ${angleVal.toFixed(0)}°`}
                    </RNText>
                  </View>
                </React.Fragment>
              );
            })}
          </Animated.View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 260,
    width: '100%',
    borderRadius: Spacing.four,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  zoomArea: {
    width: 320,
    height: 240,
    position: 'relative',
  },
  placeholderText: {
    padding: Spacing.three,
    textAlign: 'center',
  },
  hint: {
    position: 'absolute',
    top: 8,
    right: 8,
    fontSize: 9,
    opacity: 0.5,
    zIndex: 10,
    pointerEvents: 'none',
  },
  absLabelContainer: {
    position: 'absolute',
    height: 22,
    borderRadius: 4,
    borderWidth: 1,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  sideText: {
    fontSize: 11,
    fontWeight: 'bold',
    lineHeight: 14,
  },
  vertexLabelWrapper: {
    position: 'absolute',
    width: 30,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  vertexText: {
    fontSize: 12,
    fontWeight: 'bold',
    lineHeight: 14,
  },
  angleLabelWrapper: {
    position: 'absolute',
    width: 60,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  angleText: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 14,
  },
});
