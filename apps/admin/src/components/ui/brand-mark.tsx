import type { SVGProps } from 'react';
import { BRAND_MARK_RECTS, BRAND_MARK_VIEWBOX } from '@fastbuild/tokens/brand';
import { cn } from '@/lib/cn';

/** FastBuild geometric Modular Stack "F" mark. */
export function FastBuildMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={BRAND_MARK_VIEWBOX} fill="currentColor" {...props}>
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

interface BrandMarkProps {
  size?: 'md' | 'lg';
  className?: string;
}

/** Monochrome high-contrast brand tile aligned with the Web shell. */
export function BrandMark({ size = 'md', className }: BrandMarkProps) {
  return (
    <span
      className={cn(
        'brand-mark',
        size === 'lg' ? 'size-10 rounded-xl' : 'size-8 rounded-lg',
        className,
      )}
      aria-hidden="true"
    >
      <FastBuildMark className={size === 'lg' ? 'size-6' : 'size-4.5'} />
    </span>
  );
}
