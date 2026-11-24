/** Copies text with the async Clipboard API; resolves false where the browser refuses or lacks it. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (!navigator.clipboard) {
      return false;
    }
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
