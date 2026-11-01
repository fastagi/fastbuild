import { useSyncExternalStore } from 'react';

// Tailwind's `sm` breakpoint is 40rem; this is its exact complement.
const belowSmQuery = '(max-width: 39.99rem)';

function media(): MediaQueryList | null {
  return typeof window.matchMedia === 'function' ? window.matchMedia(belowSmQuery) : null;
}

function subscribe(onChange: () => void) {
  const list = media();
  list?.addEventListener('change', onChange);
  return () => list?.removeEventListener('change', onChange);
}

/** True below Tailwind's `sm`, for layouts that render different markup rather than restyle it. */
export function useBelowSm() {
  return useSyncExternalStore(
    subscribe,
    () => media()?.matches ?? false,
    () => false,
  );
}
