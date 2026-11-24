import '@testing-library/jest-dom/vitest';

afterEach(() => {
  window.localStorage.clear();
  document.documentElement.classList.remove('dark');
});
