/**
 * @component Separator
 * @category UI
 * @status Stable
 * @description Visually or semantically separates content within a page or container.
 * @usage Use to divide sections of content, either horizontally (default) or vertically.
 * @example
 * <Separator />
 * <Separator orientation="vertical" />
 */
"use client"

import * as React from "react"

import { cn } from "@/utils"

type SeparatorProps = React.ComponentProps<"div"> & {
  orientation?: "horizontal" | "vertical"
  decorative?: boolean
}

function Separator({
  className,
  orientation = "horizontal",
  decorative = true,
  ...props
}: SeparatorProps) {
  const semantics = decorative
    ? { role: "none" }
    : {
        role: "separator",
        ...(orientation === "vertical"
          ? { "aria-orientation": "vertical" as const }
          : {}),
      }

  return (
    <div
      data-slot="separator-root"
      data-orientation={orientation}
      {...semantics}
      className={cn(
        "bg-border shrink-0 data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px",
        className
      )}
      {...props}
    />
  )
}

export { Separator }
