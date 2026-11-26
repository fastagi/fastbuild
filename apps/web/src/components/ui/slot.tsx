import * as React from 'react';
import { mergeProps, renderElement } from '@ui-sdk/react/primitive';

type SlotProps = React.HTMLAttributes<HTMLElement> & {
  ref?: React.Ref<HTMLElement>;
};

function Slottable({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function isSlottable(
  child: React.ReactNode
): child is React.ReactElement<{ children?: React.ReactNode }, typeof Slottable> {
  return React.isValidElement(child) && child.type === Slottable;
}

/**
 * Renders its single child element (or the element wrapped in `<Slottable>`) with these props
 * merged in: class names and styles combine, handlers chain, refs merge. It backs the
 * shadcn-style `asChild` prop on local primitives.
 */
function Slot({ children, ...props }: SlotProps) {
  const childrenArray = React.Children.toArray(children);
  const slottable = childrenArray.find(isSlottable);

  if (slottable) {
    const newElement = slottable.props.children;
    if (!React.isValidElement<Record<string, unknown>>(newElement)) {
      return null;
    }

    const newChildren = childrenArray.map(child => {
      if (child === slottable) {
        return newElement.props.children as React.ReactNode;
      }
      return child;
    });

    return React.cloneElement(
      newElement,
      mergeProps(props, newElement.props),
      ...newChildren
    );
  }

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

export { Slot, Slottable, asChildProps };
