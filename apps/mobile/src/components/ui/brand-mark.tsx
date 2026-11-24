import * as React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { BRAND_MARK_RECTS, BRAND_MARK_VIEWBOX, radii } from '@fastbuild/tokens';
import { useTheme } from '../../theme/theme-context';

export interface FastBuildMarkProps {
  readonly size?: number;
  readonly color?: string;
}

/**
 * FastBuild geometric Modular Stack "F" mark driven by `@fastbuild/tokens`
 * `BRAND_MARK_RECTS` & `BRAND_MARK_VIEWBOX` so Mobile matches Web/Admin/Desktop 1:1.
 */
export function FastBuildMark({ size = 18, color }: FastBuildMarkProps) {
  const { colors } = useTheme();
  const fill = color ?? colors.primaryForeground;

  return (
    <Svg width={size} height={size} viewBox={BRAND_MARK_VIEWBOX} fill="none">
      {BRAND_MARK_RECTS.map((rect, index) => (
        <Rect
          key={index}
          x={rect.x}
          y={rect.y}
          width={rect.width}
          height={rect.height}
          rx={rect.rx}
          fill={fill}
        />
      ))}
    </Svg>
  );
}

export interface BrandMarkProps {
  readonly size?: 'sm' | 'md' | 'lg';
  readonly className?: string;
  readonly style?: ViewStyle;
}

const TILE_SIZES: Record<NonNullable<BrandMarkProps['size']>, { box: number; radius: number; icon: number }> = {
  sm: { box: 28, radius: radii.md, icon: 16 },
  md: { box: 34, radius: radii.lg, icon: 19 },
  lg: { box: 44, radius: radii.xl, icon: 24 },
};

/** Monochrome high-contrast brand tile aligned across Web, Admin, Desktop, and Mobile. */
export function BrandMark({ size = 'md', className, style }: BrandMarkProps) {
  const { colors } = useTheme();
  const metrics = TILE_SIZES[size];

  return (
    <View
      className={className}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.tile,
        {
          width: metrics.box,
          height: metrics.box,
          borderRadius: metrics.radius,
          backgroundColor: colors.primary,
        },
        style,
      ]}
    >
      <FastBuildMark size={metrics.icon} color={colors.primaryForeground} />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
