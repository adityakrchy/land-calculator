/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#171717',
    background: '#f9fafb',
    backgroundElement: '#f1f3f5',
    backgroundSelected: '#e5e7eb',
    textSecondary: '#60646c',
    primary: '#0b57d0',
    primaryActive: '#0842a0',
    textLink: '#0d74ce',
    textLinkSecondary: '#476cff',
    border: '#f1f3f5',
    borderStrong: '#e5e7eb',
    card: '#ffffff',
    surfaceDark: '#171717',
    onPrimary: '#ffffff',
    onDark: '#ffffff',
    success: '#16a34a',
    error: '#eb8e90',
    warning: '#ab6400',
    muted: '#999999',
    skyLight: '#cfe7ff',
    skyMid: '#a8c8e8',
  },
  dark: {
    text: '#ffffff',
    background: '#0d0e12',
    backgroundElement: '#16171d',
    backgroundSelected: '#232530',
    textSecondary: '#b0b4ba',
    primary: '#589cff',
    primaryActive: '#3b82f6',
    textLink: '#47c2ff',
    textLinkSecondary: '#476cff',
    border: '#1d1e26',
    borderStrong: '#232530',
    card: '#12131a',
    surfaceDark: '#171717',
    onPrimary: '#0d0e12',
    onDark: '#ffffff',
    success: '#16a34a',
    error: '#eb8e90',
    warning: '#ab6400',
    muted: '#999999',
    skyLight: '#cfe7ff',
    skyMid: '#a8c8e8',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
