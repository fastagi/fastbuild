/**
 * @component Avatar
 * @category UI
 * @status Stable
 * @description An image element with a fallback for representing the user.
 * @usage Use for user profiles, comments, or team member lists.
 * @example
 * <Avatar>
 *   <AvatarImage src="https://github.com/shadcn.png" alt="Profile photo" />
 *   <AvatarFallback>CN</AvatarFallback>
 * </Avatar>
 */
"use client"

import * as React from "react"
import * as AvatarPrimitive from "@ui-sdk/react/avatar"

import { cn } from "@/utils"

type WithClassName<T> = Omit<T, "className"> & { className?: string }

function Avatar({
  className,
  ...props
}: WithClassName<React.ComponentProps<typeof AvatarPrimitive.Avatar>>) {
  return (
    <AvatarPrimitive.Avatar
      data-slot="avatar"
      className={cn(
        "relative flex size-8 shrink-0 overflow-hidden rounded-full",
        className
      )}
      {...props}
    />
  )
}

export interface AvatarImageProps
  extends Omit<
    WithClassName<React.ComponentProps<typeof AvatarPrimitive.AvatarImage>>,
    "alt"
  > {
  alt: string
}

function AvatarImage({
  className,
  ...props
}: AvatarImageProps) {
  return (
    <AvatarPrimitive.AvatarImage
      data-slot="avatar-image"
      className={cn("aspect-square size-full", className)}
      {...props}
    />
  )
}

function AvatarFallback({
  className,
  ...props
}: WithClassName<React.ComponentProps<typeof AvatarPrimitive.AvatarFallback>>) {
  return (
    <AvatarPrimitive.AvatarFallback
      data-slot="avatar-fallback"
      className={cn(
        "bg-muted flex size-full items-center justify-center rounded-full",
        className
      )}
      {...props}
    />
  )
}

export { Avatar, AvatarImage, AvatarFallback }
