import type { SVGProps } from 'react';
import { BRAND_MARK_RECTS, BRAND_MARK_VIEWBOX } from '@fastbuild/tokens';
import { cn } from './cn.ts';

/** FastBuild geometric Modular Stack "F" mark driven by `@fastbuild/tokens`. */
export function FastBuildMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={BRAND_MARK_VIEWBOX}
      fill="currentColor"
      {...props}
    >
      {BRAND_MARK_RECTS.map((rect, index) => (
        <rect
          key={index}
          x={rect.x}
          y={rect.y}
          width={rect.width}
          height={rect.height}
          rx={rect.rx}
        />
      ))}
    </svg>
  );
}

export interface BrandMarkProps {
  readonly size?: 'sm' | 'md' | 'lg';
  readonly className?: string;
}

const tileSizeClasses: Record<NonNullable<BrandMarkProps['size']>, string> = {
  sm: 'size-7 rounded-md',
  md: 'size-8 rounded-lg',
  lg: 'size-10 rounded-xl',
};

const iconSizeClasses: Record<NonNullable<BrandMarkProps['size']>, string> = {
  sm: 'size-4',
  md: 'size-4.5',
  lg: 'size-6',
};

/** Monochrome high-contrast brand tile aligned across Web, Admin, and Desktop. */
export function BrandMark({ size = 'md', className }: BrandMarkProps) {
  return (
    <span
      className={cn(
        'grid shrink-0 place-items-center bg-primary text-primary-foreground',
        tileSizeClasses[size],
        className,
      )}
      aria-hidden="true"
    >
      <FastBuildMark className={iconSizeClasses[size]} />
    </span>
  );
}
