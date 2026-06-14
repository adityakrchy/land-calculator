/* eslint-disable react-hooks/refs */
import React, { useRef } from 'react';
import { Animated, Platform, Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';

const AnimatedPressableContainer = Animated.createAnimatedComponent(Pressable);

interface AnimatedPressableProps extends PressableProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  opacityTo?: number;
}

export function AnimatedPressable({
  children,
  style,
  scaleTo = 0.98,
  opacityTo = 0.85,
  ...props
}: AnimatedPressableProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = (event: any) => {
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: scaleTo,
        duration: 80,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(opacityAnim, {
        toValue: opacityTo,
        duration: 80,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
    if (props.onPressIn) props.onPressIn(event);
  };

  const handlePressOut = (event: any) => {
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
    if (props.onPressOut) props.onPressOut(event);
  };

  return (
    <AnimatedPressableContainer
      {...props}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[
        {
          transform: [{ scale: scaleAnim }],
          opacity: opacityAnim,
        },
        typeof style === 'function' ? style({ pressed: false }) : style,
      ] as any}
    >
      {children}
    </AnimatedPressableContainer>
  );
}
