import * as React from 'react';
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import { radii, spacing } from '@fastbuild/tokens';
import { useTheme } from '../../theme/theme-context';

export interface CardProps extends ViewProps {
  readonly className?: string;
  readonly style?: StyleProp<ViewStyle>;
}

export interface CardTextProps extends TextProps {
  readonly className?: string;
  readonly style?: StyleProp<TextStyle>;
}

export function Card({ className, style, ...props }: CardProps) {
  const { colors } = useTheme();
  return (
    <View
      className={className}
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
        style,
      ]}
      {...props}
    />
  );
}

export function CardHeader({ className, style, ...props }: CardProps) {
  return <View className={className} style={[styles.header, style]} {...props} />;
}

export function CardTitle({ className, style, ...props }: CardTextProps) {
  const { colors } = useTheme();
  return (
    <Text
      className={className}
      style={[styles.title, { color: colors.cardForeground }, style]}
      {...props}
    />
  );
}

export function CardDescription({ className, style, ...props }: CardTextProps) {
  const { colors } = useTheme();
  return (
    <Text
      className={className}
      style={[styles.description, { color: colors.mutedForeground }, style]}
      {...props}
    />
  );
}

export function CardContent({ className, style, ...props }: CardProps) {
  return <View className={className} style={[styles.content, style]} {...props} />;
}

export function CardFooter({ className, style, ...props }: CardProps) {
  return <View className={className} style={[styles.footer, style]} {...props} />;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    padding: spacing.lg,
    gap: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
});
