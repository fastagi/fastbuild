import * as React from 'react';
import { renderElement } from '@ui-sdk/react/primitive';

type SlotProps = React.HTMLAttributes<HTMLElement> & { ref?: React.Ref<HTMLElement> };

/**
 * Renders its single child element with these props merged in: class names and styles combine,
 * handlers chain, refs merge. It backs the shadcn-style `asChild` prop on local primitives.
 */
function Slot({ children, ...props }: SlotProps) {
  if (!React.isValidElement(children)) {
    return null;
  }
  return renderElement('span', props, children);
}

/**
 * Maps the shadcn-style `asChild` prop onto a ui-sdk part's `render` prop, so the part's behavior
 * and ARIA land on the caller's element instead of the part's default one.
 */
function asChildProps(asChild: boolean | undefined, children: React.ReactNode) {
  return asChild && React.isValidElement(children) ? { render: children } : { children };
}

export { Slot, asChildProps };
