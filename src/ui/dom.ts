/** Tiny DOM builder for UI components. No framework; components own their elements. */

type Child = Node | string | null | undefined | false;

export interface ElementOptions {
  className?: string;
  text?: string;
  attrs?: Record<string, string>;
  style?: Partial<Record<string, string>>;
}

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options: ElementOptions = {},
  children: Child[] = [],
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (options.className) el.className = options.className;
  if (options.text !== undefined) el.textContent = options.text;
  if (options.attrs) for (const [k, v] of Object.entries(options.attrs)) el.setAttribute(k, v);
  if (options.style) for (const [k, v] of Object.entries(options.style)) if (v !== undefined) el.style.setProperty(k, v);
  for (const child of children) if (child) el.append(child);
  return el;
}

/** Set text only when it changed, so per-frame refreshes don't touch the DOM needlessly. */
export function setText(el: HTMLElement, text: string): void {
  if (el.textContent !== text) el.textContent = text;
}

export function setVar(el: HTMLElement, name: string, value: string): void {
  if (el.style.getPropertyValue(name) !== value) el.style.setProperty(name, value);
}

export function toggleClass(el: HTMLElement, name: string, on: boolean): void {
  if (el.classList.contains(name) !== on) el.classList.toggle(name, on);
}

/**
 * Pointer press/release on an element, with capture so a finger sliding off
 * still releases. Returns a cleanup function.
 */
export function onPress(el: HTMLElement, down: () => void, up: () => void): () => void {
  let pointer: number | null = null;
  const onDown = (e: PointerEvent) => {
    if (pointer !== null) return;
    pointer = e.pointerId;
    el.setPointerCapture?.(e.pointerId);
    e.preventDefault();
    e.stopPropagation();
    el.classList.add('is-pressed');
    down();
  };
  const onUp = (e: PointerEvent) => {
    if (e.pointerId !== pointer) return;
    pointer = null;
    el.classList.remove('is-pressed');
    up();
  };
  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointerup', onUp);
  el.addEventListener('pointercancel', onUp);
  el.addEventListener('lostpointercapture', onUp);
  return () => {
    el.removeEventListener('pointerdown', onDown);
    el.removeEventListener('pointerup', onUp);
    el.removeEventListener('pointercancel', onUp);
    el.removeEventListener('lostpointercapture', onUp);
  };
}
