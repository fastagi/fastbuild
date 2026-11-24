import type { SVGProps } from 'react';
import { cn } from '@/lib/cn';

/** FastBuild geometric Modular Stack "F" mark. */
export function FastBuildMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
      <rect x="4" y="3.5" width="16" height="4.25" rx="1.25" />
      <rect x="4" y="10" width="11.5" height="4.25" rx="1.25" />
      <rect x="4" y="16.5" width="5.25" height="4.25" rx="1.25" />
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
