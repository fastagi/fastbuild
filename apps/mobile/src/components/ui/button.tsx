import * as React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { radii, type SemanticColorTokens } from '@fastbuild/tokens';
import { useTheme } from '../../theme/theme-context';

export type ButtonVariant = 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'link';
export type ButtonSize = 'default' | 'sm' | 'lg' | 'icon';

export interface ButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  readonly loading?: boolean;
  readonly className?: string;
  readonly style?: StyleProp<ViewStyle>;
  readonly textStyle?: StyleProp<TextStyle>;
  readonly children: React.ReactNode;
}

function getVariantStyles(
  variant: ButtonVariant,
  colors: SemanticColorTokens,
  disabled: boolean,
): { container: ViewStyle; text: TextStyle; spinnerColor: string } {
  if (disabled && variant !== 'outline' && variant !== 'ghost' && variant !== 'link') {
    return {
      container: { backgroundColor: colors.muted, borderColor: 'transparent', borderWidth: 0 },
      text: { color: colors.mutedForeground },
      spinnerColor: colors.mutedForeground,
    };
  }

  switch (variant) {
    case 'secondary':
      return {
        container: { backgroundColor: colors.secondary, borderColor: 'transparent', borderWidth: 0 },
        text: { color: colors.secondaryForeground },
        spinnerColor: colors.secondaryForeground,
      };
    case 'outline':
      return {
        container: { backgroundColor: colors.background, borderColor: colors.input, borderWidth: 1 },
        text: { color: disabled ? colors.mutedForeground : colors.foreground },
        spinnerColor: colors.foreground,
      };
    case 'ghost':
      return {
        container: { backgroundColor: 'transparent', borderColor: 'transparent', borderWidth: 0 },
        text: { color: disabled ? colors.mutedForeground : colors.foreground },
        spinnerColor: colors.foreground,
      };
    case 'destructive':
      return {
        container: { backgroundColor: colors.destructive, borderColor: 'transparent', borderWidth: 0 },
        text: { color: colors.destructiveForeground },
        spinnerColor: colors.destructiveForeground,
      };
    case 'link':
      return {
        container: { backgroundColor: 'transparent', borderColor: 'transparent', borderWidth: 0 },
        text: {
          color: disabled ? colors.mutedForeground : colors.primary,
          textDecorationLine: 'underline',
        },
        spinnerColor: colors.primary,
      };
    case 'default':
    default:
      return {
        container: { backgroundColor: colors.primary, borderColor: 'transparent', borderWidth: 0 },
        text: { color: colors.primaryForeground },
        spinnerColor: colors.primaryForeground,
      };
  }
}

const SIZE_STYLES: Record<ButtonSize, { container: ViewStyle; text: TextStyle }> = {
  default: {
    container: { minHeight: 42, paddingHorizontal: 16, paddingVertical: 10, borderRadius: radii.md },
    text: { fontSize: 14, fontWeight: '600' },
  },
  sm: {
    container: { minHeight: 34, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radii.md },
    text: { fontSize: 12, fontWeight: '600' },
  },
  lg: {
    container: { minHeight: 48, paddingHorizontal: 24, paddingVertical: 12, borderRadius: radii.lg },
    text: { fontSize: 15, fontWeight: '600' },
  },
  icon: {
    container: { width: 40, height: 40, borderRadius: radii.md },
    text: { fontSize: 14, fontWeight: '600' },
  },
};

export function Button({
  variant = 'default',
  size = 'default',
  loading = false,
  disabled = false,
  className,
  style,
  textStyle,
  children,
  ...props
}: ButtonProps) {
  const { colors } = useTheme();
  const isDisabled = Boolean(disabled || loading);
  const variantStyles = getVariantStyles(variant, colors, isDisabled);
  const sizeStyles = SIZE_STYLES[size];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      className={className}
      style={({ pressed }) => [
        styles.base,
        sizeStyles.container,
        variantStyles.container,
        pressed && !isDisabled ? styles.pressed : null,
        style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variantStyles.spinnerColor} style={styles.spinner} />
      ) : null}
      {typeof children === 'string' ? (
        <Text style={[sizeStyles.text, variantStyles.text, textStyle]}>{children}</Text>
      ) : (
        children
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  spinner: {
    marginRight: 4,
  },
});
