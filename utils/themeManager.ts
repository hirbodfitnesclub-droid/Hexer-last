export type ColorTheme = 'green' | 'blue' | 'purple';

export const COLOR_THEMES: { id: ColorTheme; label: string }[] = [
  { id: 'green', label: 'سبز' },
  { id: 'blue', label: 'آبی' },
  { id: 'purple', label: 'بنفش' },
];

export function getStoredColorTheme(): ColorTheme {
  const theme = localStorage.getItem('hexer-color-theme');
  if (theme === 'blue' || theme === 'purple' || theme === 'green') {
    return theme;
  }
  return 'green';
}

export function applyColorTheme(theme: ColorTheme): void {
  localStorage.setItem('hexer-color-theme', theme);
  if (theme === 'green') {
    document.documentElement.removeAttribute('data-color-theme');
  } else {
    document.documentElement.setAttribute('data-color-theme', theme);
  }
}

export function isDarkMode(): boolean {
  return document.documentElement.classList.contains('dark');
}

export function toggleDarkMode(): boolean {
  const isDark = document.documentElement.classList.toggle('dark');
  localStorage.setItem('hexer-theme', isDark ? 'dark' : 'light');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', isDark ? '#121212' : '#F4F5F7');
  return isDark;
}
