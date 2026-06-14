import { StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'defaultSemiBold' | 'title' | 'small' | 'smallBold' | 'subtitle' | 'link' | 'linkPrimary' | 'code';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      style={[
        { color: theme[themeColor ?? (type === 'linkPrimary' ? 'textLink' : 'text')] },
        type === 'default' && styles.default,
        type === 'defaultSemiBold' && styles.defaultSemiBold,
        type === 'title' && styles.title,
        type === 'small' && styles.small,
        type === 'smallBold' && styles.smallBold,
        type === 'subtitle' && styles.subtitle,
        type === 'link' && styles.link,
        type === 'linkPrimary' && styles.linkPrimary,
        type === 'code' && styles.code,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  small: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '400',
  },
  smallBold: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
  },
  default: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400',
  },
  defaultSemiBold: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
  },
  title: {
    fontSize: 48,
    fontWeight: '600',
    lineHeight: 52.8,
    letterSpacing: -1.44,
  },
  subtitle: {
    fontSize: 28,
    lineHeight: 33.6,
    fontWeight: '600',
    letterSpacing: -0.84,
  },
  link: {
    fontSize: 14,
    lineHeight: 19.6,
    fontWeight: '500',
  },
  linkPrimary: {
    fontSize: 14,
    lineHeight: 19.6,
    fontWeight: '500',
  },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: '400',
    fontSize: 13,
    lineHeight: 19.5,
  },
});
