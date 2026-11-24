// Applies the saved theme before first paint. CSP forbids inline scripts, so this is a blocking
// external file loaded from index.html. Keep it in step with resolveDarkTheme and the persist key
// in src/features/preferences; ThemeSync takes over once the application mounts.
/* global document, window */
(function () {
  var theme = 'system';
  try {
    var saved = JSON.parse(window.localStorage.getItem('fastbuild-spa-preferences'));
    if (saved && saved.state && saved.state.theme) {
      theme = saved.state.theme;
    }
  } catch {
    // Blocked or corrupt storage falls back to the system preference.
  }
  var dark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  var root = document.documentElement;
  root.classList.toggle('dark', dark);
  root.style.colorScheme = dark ? 'dark' : 'light';
})();
