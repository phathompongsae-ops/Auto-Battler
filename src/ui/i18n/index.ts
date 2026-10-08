import { STRINGS, type StringKey } from './strings';

export type { StringKey } from './strings';

export type Locale = keyof typeof STRINGS;

export const LOCALES: readonly { id: Locale; name: string }[] = [
  { id: 'en', name: 'English' },
  { id: 'th', name: 'ไทย' },
];

const STORAGE_KEY = 'haven.locale';
const isLocale = (value: unknown): value is Locale => typeof value === 'string' && value in STRINGS;

/** `?lang=th` (review links) wins, then this device's saved choice, then English. */
function initialLocale(): Locale {
  if (typeof window === 'undefined') return 'en';
  const fromUrl = new URLSearchParams(window.location.search).get('lang');
  if (isLocale(fromUrl)) return fromUrl;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (isLocale(saved)) return saved;
  } catch {
    // Storage blocked (private mode, sandbox): fall back to English.
  }
  return 'en';
}

let current: Locale = initialLocale();
const listeners = new Set<(locale: Locale) => void>();

export function locale(): Locale {
  return current;
}

/** Interface string for the current locale; English is the fallback for anything missing. */
export function t(key: StringKey, vars?: Readonly<Record<string, string | number>>): string {
  const text: string = STRINGS[current][key] ?? STRINGS.en[key] ?? key;
  return vars ? text.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match)) : text;
}

/** Switch language (saved on this device only; not part of the game save). */
export function setLocale(next: Locale): void {
  if (next === current) return;
  current = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Not persisted; the choice still applies to this session.
  }
  for (const listener of listeners) listener(next);
}

/** Relabel hook for components built once; returns an unsubscribe function. */
export function onLocaleChange(listener: (locale: Locale) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
