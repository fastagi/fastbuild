/**
 * @component Tabs
 * @category UI
 * @status Stable
 * @description A set of layered sections of content, or tabs, that are displayed one at a time.
 * @usage Use to organize content into multiple views that can be toggled via a list of triggers.
 * @example
 * <Tabs defaultValue="account">
 *   <TabsList>
 *     <TabsTrigger value="account">Account</TabsTrigger>
 *     <TabsTrigger value="password">Password</TabsTrigger>
 *   </TabsList>
 *   <TabsContent value="account">Account settings here.</TabsContent>
 *   <TabsContent value="password">Change password here.</TabsContent>
 * </Tabs>
 */
"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/utils"

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  )
}

const EDGE_TOLERANCE_PX = 1
// Clears the 2rem fade, which would otherwise cover a tab scrolled just into view.
const REVEAL_MARGIN_PX = 32

function revealActiveTrigger(list: HTMLElement, behavior: ScrollBehavior) {
  const active = list.querySelector<HTMLElement>('[role="tab"][data-state="active"]')
  if (!active || list.scrollWidth <= list.clientWidth) return

  const listRect = list.getBoundingClientRect()
  const activeRect = active.getBoundingClientRect()
  let left: number | null = null
  if (activeRect.left < listRect.left + REVEAL_MARGIN_PX) {
    left = list.scrollLeft + activeRect.left - listRect.left - REVEAL_MARGIN_PX
  } else if (activeRect.right > listRect.right - REVEAL_MARGIN_PX) {
    left = list.scrollLeft + activeRect.right - listRect.right + REVEAL_MARGIN_PX
  }
  // `scrollIntoView` would also move the page, so only the list itself scrolls.
  if (left !== null) list.scrollTo({ left, behavior })
}

/**
 * A tab strip wider than its parent scrolls instead of clipping. Each edge with more tabs past it
 * fades out, and the active tab is kept in view, including when it changes from outside the strip.
 */
function TabsList({
  className,
  ref,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  const [list, setList] = React.useState<HTMLDivElement | null>(null)
  const [overflow, setOverflow] = React.useState({ start: false, end: false })

  const setRefs = React.useCallback(
    (node: HTMLDivElement | null) => {
      setList(node)
      if (typeof ref === "function") ref(node)
      else if (ref) ref.current = node
    },
    [ref]
  )

  React.useEffect(() => {
    if (!list) return

    const measure = () => {
      const start = list.scrollLeft > EDGE_TOLERANCE_PX
      const end =
        list.scrollLeft + list.clientWidth < list.scrollWidth - EDGE_TOLERANCE_PX
      setOverflow(current =>
        current.start === start && current.end === end ? current : { start, end }
      )
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const onResize = () => {
      measure()
      revealActiveTrigger(list, "auto")
    }
    const onTabsChanged = () => {
      measure()
      revealActiveTrigger(list, reducedMotion ? "auto" : "smooth")
    }

    onResize()
    list.addEventListener("scroll", measure, { passive: true })
    const resizeObserver =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(onResize)
    resizeObserver?.observe(list)
    const mutationObserver = new MutationObserver(onTabsChanged)
    mutationObserver.observe(list, {
      attributes: true,
      attributeFilter: ["data-state"],
      childList: true,
      subtree: true,
    })

    return () => {
      list.removeEventListener("scroll", measure)
      resizeObserver?.disconnect()
      mutationObserver.disconnect()
    }
  }, [list])

  return (
    <TabsPrimitive.List
      ref={setRefs}
      data-slot="tabs-list"
      data-overflow-start={overflow.start ? "" : undefined}
      data-overflow-end={overflow.end ? "" : undefined}
      className={cn(
        "bg-muted text-muted-foreground inline-flex h-9 w-fit max-w-full items-center justify-start overflow-x-auto rounded-lg p-[3px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden pointer-coarse:h-12",
        "[--fade-end:black] [--fade-start:black] data-overflow-end:[--fade-end:transparent] data-overflow-start:[--fade-start:transparent] [mask-image:linear-gradient(to_right,var(--fade-start),black_2rem,black_calc(100%-2rem),var(--fade-end))]",
        className
      )}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "inline-flex h-[calc(100%-1px)] flex-1 shrink-0 items-center justify-center gap-1.5 rounded-md border border-transparent px-3 py-1 text-sm font-medium whitespace-nowrap transition-all focus-ring interactive-subtle",
        "text-muted-foreground hover:text-foreground/70",
        "data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-md data-[state=active]:ring-1 data-[state=active]:ring-black/5 dark:data-[state=active]:ring-white/10",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
