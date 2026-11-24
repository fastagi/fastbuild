import * as React from 'react';
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import { radii, type SemanticColorTokens } from '@fastbuild/tokens';
import { useTheme } from '../../theme/theme-context';

export type StatusTone = 'brand' | 'danger' | 'neutral' | 'success' | 'warning';

export interface StatusDotProps extends Omit<ViewProps, 'style'> {
  readonly tone?: StatusTone;
  readonly label?: string;
  readonly className?: string;
  readonly style?: StyleProp<ViewStyle>;
}

function getToneColors(
  tone: StatusTone,
  colors: SemanticColorTokens,
): { dot: string; background: string; border: string; text: string } {
  switch (tone) {
    case 'brand':
      return {
        dot: colors.brand,
        background: colors.brandSubtle,
        border: colors.brand,
        text: colors.brandStrong,
      };
    case 'danger':
      return {
        dot: colors.danger,
        background: colors.dangerSubtle,
        border: colors.danger,
        text: colors.dangerStrong,
      };
    case 'success':
      return {
        dot: colors.success,
        background: colors.successSubtle,
        border: colors.success,
        text: colors.successStrong,
      };
    case 'warning':
      return {
        dot: colors.warning,
        background: colors.warningSubtle,
        border: colors.warning,
        text: colors.warningStrong,
      };
    case 'neutral':
    default:
      return {
        dot: colors.mutedForeground,
        background: colors.muted,
        border: colors.border,
        text: colors.mutedForeground,
      };
  }
}

/** Semantic status indicator dot with optional pill label, matching `@fastbuild/ui`. */
export function StatusDot({
  tone = 'neutral',
  label,
  className,
  style,
  ...props
}: StatusDotProps) {
  const { colors } = useTheme();
  const palette = getToneColors(tone, colors);

  if (label) {
    return (
      <View
        className={className}
        style={[
          styles.pill,
          {
            backgroundColor: palette.background,
            borderColor: palette.border,
          },
          style,
        ]}
        {...props}
      >
        <View style={[styles.pillDot, { backgroundColor: palette.dot }]} />
        <Text style={[styles.pillText, { color: palette.text }]}>{label}</Text>
      </View>
    );
  }

  return (
    <View
      className={className}
      style={[styles.dot, { backgroundColor: palette.dot }, style]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  dot: {
    width: 8,
    height: 8,
    borderRadius: radii.full,
  },
  pill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 26,
    paddingHorizontal: 10,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  pillDot: {
    width: 6,
    height: 6,
    borderRadius: radii.full,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
