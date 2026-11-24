/** True for ⌘K on macOS and Ctrl+K elsewhere, the shortcut that opens the command palette. */
export function isPaletteShortcut(event: { key: string; metaKey: boolean; ctrlKey: boolean }) {
  return event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey);
}
