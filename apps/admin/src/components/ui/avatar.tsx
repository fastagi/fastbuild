import * as React from 'react';
import * as AvatarPrimitive from '@ui-sdk/react/avatar';

import { cn } from '@/lib/cn';

type WithClassName<T> = Omit<T, 'className'> & { className?: string };

function Avatar({
  className,
  ...props
}: WithClassName<React.ComponentProps<typeof AvatarPrimitive.Avatar>>) {
  return (
    <AvatarPrimitive.Avatar
      className={cn('relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full', className)}
      {...props}
    />
  );
}

function AvatarImage({
  className,
  ...props
}: WithClassName<React.ComponentProps<typeof AvatarPrimitive.AvatarImage>>) {
  return (
    <AvatarPrimitive.AvatarImage
      className={cn('aspect-square h-full w-full', className)}
      {...props}
    />
  );
}

function AvatarFallback({
  className,
  ...props
}: WithClassName<React.ComponentProps<typeof AvatarPrimitive.AvatarFallback>>) {
  return (
    <AvatarPrimitive.AvatarFallback
      className={cn(
        'flex h-full w-full items-center justify-center rounded-full bg-muted',
        className,
      )}
      {...props}
    />
  );
}

export { Avatar, AvatarImage, AvatarFallback };
