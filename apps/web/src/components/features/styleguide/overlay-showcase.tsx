"use client"

import * as React from "react"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent
} from "@/components/ui/dropdown-menu"
import { 
  Sheet, 
  SheetContent, 
  SheetDescription, 
  SheetHeader, 
  SheetTitle, 
  SheetTrigger 
} from "@/components/ui/sheet"
import { 
  Drawer, 
  DrawerClose, 
  DrawerContent, 
  DrawerDescription, 
  DrawerFooter, 
  DrawerHeader, 
  DrawerTitle, 
  DrawerTrigger 
} from "@/components/ui/drawer"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { SettingsIcon, UserIcon, LogOutIcon, ShareIcon, CreditCardIcon } from "lucide-react"

export function OverlayShowcase() {
  return (
    <section className="space-y-8">
      <h2 className="text-2xl font-semibold">Overlays & Menus</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Dropdown Menu</h3>
          <div className="p-6 border rounded-xl bg-card flex justify-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" noScale>Open Menu</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" sideOffset={8}>
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <UserIcon className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                  <DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <CreditCardIcon className="mr-2 h-4 w-4" />
                  <span>Billing</span>
                  <DropdownMenuShortcut>⌘B</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="interactive-subtle">
                    <ShareIcon className="mr-2 h-4 w-4" />
                    <span>Invite Users</span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem>Email</DropdownMenuItem>
                    <DropdownMenuItem>Message</DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-error focus:bg-destructive/10 focus:text-error">
                  <LogOutIcon className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                  <DropdownMenuShortcut>⇧⌘Q</DropdownMenuShortcut>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-medium">Side Sheet</h3>
          <div className="p-6 border rounded-xl bg-card flex justify-center">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" className="interactive">Open Settings</Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>User Settings</SheetTitle>
                  <SheetDescription>
                    Manage your preferences and workspace configuration.
                  </SheetDescription>
                </SheetHeader>
                <div className="py-6 space-y-4">
                  <div className="h-24 rounded-lg bg-muted/30 border border-dashed flex items-center justify-center">
                    <SettingsIcon className="size-8 text-text-muted/50" />
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-medium">Bottom Drawer</h3>
          <div className="p-6 border rounded-xl bg-card flex justify-center">
            <Drawer>
              <DrawerTrigger asChild>
                <Button variant="outline" className="interactive">Mobile Actions</Button>
              </DrawerTrigger>
              <DrawerContent>
                <div className="mx-auto w-full max-w-sm">
                  <DrawerHeader>
                    <DrawerTitle>Quick Actions</DrawerTitle>
                    <DrawerDescription>Shared actions across all devices.</DrawerDescription>
                  </DrawerHeader>
                  <div className="p-4 space-y-2">
                    <Button className="w-full interactive">Create Project</Button>
                    <Button variant="outline" className="w-full interactive">Export Data</Button>
                  </div>
                  <DrawerFooter>
                    <DrawerClose asChild>
                      <Button variant="ghost">Cancel</Button>
                    </DrawerClose>
                  </DrawerFooter>
                </div>
              </DrawerContent>
            </Drawer>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-medium">Dialog Modal</h3>
          <div className="p-6 border rounded-xl bg-card flex flex-wrap justify-center gap-3">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" className="interactive">Small Dialog</Button>
              </DialogTrigger>
              <DialogContent size="sm">
                <DialogHeader>
                  <DialogTitle>Quick Confirmation</DialogTitle>
                  <DialogDescription>
                    This is a small dialog for quick confirmations.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline">Cancel</Button>
                  <Button>OK</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" className="interactive">Default Dialog</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Confirm Action</DialogTitle>
                  <DialogDescription>
                    Are you sure you want to proceed? This action cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg border border-border/50">
                    Your account will be permanently updated with these changes.
                  </p>
                </div>
                <DialogFooter>
                  <Button variant="outline">Cancel</Button>
                  <Button>Confirm</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" className="interactive">Large Dialog</Button>
              </DialogTrigger>
              <DialogContent size="lg">
                <DialogHeader>
                  <DialogTitle>Advanced Settings</DialogTitle>
                  <DialogDescription>
                    Configure advanced options for your workspace. These settings affect all team members.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="h-32 rounded-lg bg-muted/30 border border-dashed flex items-center justify-center">
                    <span className="text-sm text-muted-foreground">Form Content Area</span>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="ghost">Reset to Defaults</Button>
                  <Button variant="outline">Cancel</Button>
                  <Button>Save Changes</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" className="interactive">Scrollable Dialog</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Scrollable Content</DialogTitle>
                  <DialogDescription>
                    The body scrolls while the header and footer stay in place.
                  </DialogDescription>
                </DialogHeader>
                <DialogBody className="py-4">
                  <div className="space-y-4 text-sm text-muted-foreground">
                    <p>DialogBody scrolls on its own while the header and footer stay pinned to the dialog frame.</p>
                    <p>Use it for long confirmation text, review steps, or any content taller than the viewport.</p>
                    <p>The dialog caps its height to the viewport, so the footer actions remain reachable on small screens.</p>
                    <p>Keyboard focus stays trapped inside the dialog while it is open and returns to the trigger on close.</p>
                    <p>Escape and the close button both dismiss the dialog; footer actions decide whether it should close.</p>
                    <p>Scroll position resets each time the dialog opens because its content mounts fresh.</p>
                    <p>Keep the title short and let the description explain what the person is being asked to review.</p>
                    <p>Replace this sample text with the real content of the downstream dialog that needs scrolling.</p>
                  </div>
                </DialogBody>
                <DialogFooter>
                  <Button variant="outline">Cancel</Button>
                  <Button>Confirm</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-medium text-text-muted uppercase tracking-wider">State Audit (Overlays)</h3>
        <div className="flex flex-wrap gap-4 p-6 border rounded-xl bg-card">
          <Button disabled variant="outline">Dropdown Disabled</Button>
          <Button disabled variant="outline">Sheet Disabled</Button>
          <Button disabled variant="outline">Drawer Disabled</Button>
          <Button disabled variant="outline">Dialog Disabled</Button>
        </div>
      </div>
    </section>
  )
}
