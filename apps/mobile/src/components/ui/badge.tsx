import * as React from 'react';
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import { radii, type SemanticColorTokens } from '@fastbuild/tokens';
import { useTheme } from '../../theme/theme-context';

export type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

export interface BadgeProps extends Omit<ViewProps, 'style' | 'children'> {
  readonly variant?: BadgeVariant;
  readonly className?: string;
  readonly style?: StyleProp<ViewStyle>;
  readonly textStyle?: StyleProp<TextStyle>;
  readonly children: React.ReactNode;
}

function getBadgeStyles(
  variant: BadgeVariant,
  colors: SemanticColorTokens,
): { container: ViewStyle; text: TextStyle } {
  switch (variant) {
    case 'secondary':
      return {
        container: { backgroundColor: colors.secondary, borderColor: 'transparent' },
        text: { color: colors.secondaryForeground },
      };
    case 'destructive':
      return {
        container: { backgroundColor: colors.destructive, borderColor: 'transparent' },
        text: { color: colors.destructiveForeground },
      };
    case 'outline':
      return {
        container: { backgroundColor: 'transparent', borderColor: colors.border },
        text: { color: colors.foreground },
      };
    case 'default':
    default:
      return {
        container: { backgroundColor: colors.primary, borderColor: 'transparent' },
        text: { color: colors.primaryForeground },
      };
  }
}

export function Badge({
  variant = 'default',
  className,
  style,
  textStyle,
  children,
  ...props
}: BadgeProps) {
  const { colors } = useTheme();
  const variantStyles = getBadgeStyles(variant, colors);

  return (
    <View
      className={className}
      style={[styles.base, variantStyles.container, style]}
      {...props}
    >
      {typeof children === 'string' ? (
        <Text style={[styles.text, variantStyles.text, textStyle]}>{children}</Text>
      ) : (
        children
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
});
