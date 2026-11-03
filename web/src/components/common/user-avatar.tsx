/**
 * @component UserAvatar
 * @category Common
 * @status Stable
 * @description A user's initials in an avatar circle, or a generic person icon when there are none.
 * @usage AuthUser has no picture field, so initials are all the shell can show of its own user.
 * @example
 * <UserAvatar name={user?.name} email={user?.email} />
 */
'use client';

import { UserRound } from 'lucide-react';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';

/** Up to two letters from the name, else the first letter of the email. */
export function getUserInitials(name?: string | null, email?: string | null): string {
  const words = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  const source = words.length > 0 ? words : [email?.trim() ?? ''];

  return source
    .slice(0, 2)
    .map(word => Array.from(word)[0] ?? '')
    .join('')
    .toUpperCase();
}

interface UserAvatarProps {
  name?: string | null;
  email?: string | null;
  className?: string;
}

export function UserAvatar({ name, email, className }: UserAvatarProps) {
  const initials = getUserInitials(name, email);

  return (
    // Decorative: the control that hosts the avatar supplies the accessible name.
    <Avatar aria-hidden="true" className={className}>
      <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
        {initials || <UserRound className="size-4" />}
      </AvatarFallback>
    </Avatar>
  );
}
