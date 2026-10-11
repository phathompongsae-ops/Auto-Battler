/*
 * Original vector emblems (24×24) for Haven's medallions and window chrome.
 * Shared symbols stay legible on mobile and accept per-system metal tints.
 */

const PATHS = {
  craft: 'M3 20 16 7m-3-3 4-2 5 5-2 4-7-7Zm-9 13 3 3',
  enhance: 'M6 4h9v5h6l-3 5H8l-5-5h3V4Zm5 10v4m-5 3 2-3h9l2 3H6Z',
  rune: 'M12 2 20 12l-8 10L4 12 12 2Zm0 4v12m-4-6h8M9 8l6 8',
  compass: 'M12 2v3m0 14v3M2 12h3m14 0h3M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0Zm13-4-2 6-6 2 2-6 6-2Z',
  sword: 'M16 2h5v5L10 18l-4-4L16 2Zm-9 9 6 6M4 20l4-4M3 21l-1-1M10 14 19 5',
  slash: 'M5 19C6 9 11 4 21 3c-4 5-9 10-16 16Zm-2 2 5-1M4 14l6 6',
  flame: 'M13 2c2 6-4 6-1 11 2-1 3-3 4-5 5 6 5 13-4 14C2 21 2 11 8 6c-1 4 0 6 2 6-1-5 2-6 3-10Z',
  shield: 'M12 3 3 7v6c0 4 5 7 9 9 4-2 9-5 9-9V7l-9-4Zm0 4v11M7 11h10',
  potion: 'M9 3h6M9 3v5l-4 6a5 5 0 0 0 4 7h6a5 5 0 0 0 4-7l-4-6V3M7 14h10M10 17h4',
  heal: 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6V3Z',
  bow: 'M5 3c15 0 15 18 0 18L10 12 5 3Zm5 9h12m-4-4 4 4-4 4',
  whirl: 'M4 10c1-6 11-8 15-2 4 6-3 13-9 11-5-1-7-7-2-10 4-2 8 2 5 5M4 4v6h6',
  auto: 'M20 8a9 9 0 0 0-15-2L2 9m0-6v6h6m-4 7a9 9 0 0 0 15 2l3-3m0 6v-6h-6',
  dodge: 'M4 12h15m-6-6 6 6-6 6M4 5h5M2 19h7',
  lock: 'M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5V10Zm7 4v3',
  character: 'M12 2 3 6v7c0 4 5 7 9 9 4-2 9-5 9-9V6l-9-4ZM9 10a3 3 0 1 0 6 0 3 3 0 0 0-6 0Zm-2 8c1-5 9-5 10 0',
  inventory: 'M5 8h14l2 12H3L5 8Zm3 0V6a4 4 0 0 1 8 0v2M4 12h16M10 12v4h4v-4M6 18h2m8 0h2',
  skills: 'M12 5C9 2 5 3 2 4v15c4-2 7-1 10 1 3-2 6-3 10-1V4c-3-1-7-2-10 1Zm0 0v15M5 8h4m-4 4h4m-4 4h3m9-9 3 4-3 4-3-4 3-4Z',
  quest: 'M6 3h13v14H8V6a3 3 0 1 0-6 0h6m0 11H5a3 3 0 0 0 0 6h14a3 3 0 0 1 0-6M10 8h6m-6 3h6m-6 3h3',
  pet: 'M8.5 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm7 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM5 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm14 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm-7 6c-2.5 0-4.5-1.6-4.5-3.5S9.5 12 12 12s4.5 2.6 4.5 4.5S14.5 20 12 20Z',
  map: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Zm0 0v14m6-12v14',
  party: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7 0a3 3 0 1 0 0-6M3 20c0-3 2.7-5 6-5s6 2 6 5m2-5c2.4.3 4 2.1 4 5',
  dungeon: 'M4 21V10l8-6 8 6v11M9 21v-6a3 3 0 0 1 6 0v6',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14.5 3h-5l-.4 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2l.4 2.6h5l.4-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z',
  menu: 'M12 2 3 6v8l9 8 9-8V6l-9-4ZM7 7h4v4H7V7Zm6 0h4v4h-4V7Zm-6 6h4v4H7v-4Zm6 0h4v4h-4v-4',
  close: 'M6 6l12 12M18 6 6 18',
  chat: 'M4 4h16v11H11l-5 4v-4H4V4Zm4 5h8m-8 3h5',
  // Market stall: scalloped awning over a counter with a doorway.
  shop: 'M3 9 5 4h14l2 5M3 9h18M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0M5 12v8h14v-8M10 20v-5h4v5',
  // Daily / Weekly commissions: a calendar page with a tick.
  calendar: 'M4 6h16v15H4V6Zm0 5h16M8 3v5m8-5v5m-7 6.5 2 2 4-4',
  // Empty equipment-slot silhouettes (weapon and off-hand reuse `sword` / `shield`).
  helm: 'M4 17c0-7 3-12 8-12s8 5 8 12v3H4v-3Zm0 0h16M9 11h6m-3 0v6',
  chest: 'M7 4 4 6l1 5 2-1v10h10V10l2 1 1-5-3-2-2 2c-1 1-3 1-4 0L7 4Zm5 3v13',
  glove: 'M7 21v-8L5 9c-.5-1.5 1.5-2.5 2.5-1L9 10V4.5a1.5 1.5 0 0 1 3 0V10V3.5a1.5 1.5 0 0 1 3 0V10V5a1.5 1.5 0 0 1 3 0v8c0 3-1 5-2 8H7Z',
  boot: 'M7 3h7v10l5 2c1 .5 2 1.5 2 3v2H5V3h2Zm-2 14h16',
  necklace: 'M4 3c1 6 4 9 8 9s7-3 8-9M12 12v2m-3 3 3-3 3 3-3 4-3-4Z',
  ring: 'M12 21a6 6 0 1 0 0-12 6 6 0 0 0 0 12Zm-3-12 3-5 3 5',
  coin: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-14v10m3-8.5c-.7-.9-1.8-1.5-3-1.5-1.7 0-3 .9-3 2.2s1.3 1.8 3 2.3 3 1 3 2.3-1.3 2.2-3 2.2c-1.2 0-2.3-.6-3-1.5',
  gem: 'M6 4h12l4 6-10 11L2 10l4-6Zm-4 6h20M9 4l3 6 3-6m-3 6v11',
} as const;

/**
 * Layered emblems: several shapes drawn in order (later parts sit in front), each
 * tagged with data-part so CSS can colour blades and hilts separately.
 */
const LAYERED = {
  // Primary attack: two long swords crossed point-up, the left-leaning one in front.
  // Each: pointed blade with a fuller line, a crossguard, a grip and a round pommel.
  crossed_swords: [
    { part: 'blade', d: 'M21 3 18 4 9.5 12.5 11.5 14.5 20 6Z' },
    { part: 'fuller', d: 'M18 6 11.4 12.6' },
    { part: 'hilt', d: 'M7.5 10.1 6.1 11.5 12.5 17.9 13.9 16.5Z' },
    { part: 'hilt', d: 'M8.7 14.1 4.8 18 6 19.2 9.9 15.3Z' },
    { part: 'hilt', d: 'M2.6 19.9a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0-3 0Z' },
    { part: 'blade', d: 'M3 3 6 4 14.5 12.5 12.5 14.5 4 6Z' },
    { part: 'fuller', d: 'M6 6 12.6 12.6' },
    { part: 'hilt', d: 'M16.5 10.1 17.9 11.5 11.5 17.9 10.1 16.5Z' },
    { part: 'hilt', d: 'M15.3 14.1 19.2 18 18 19.2 14.1 15.3Z' },
    { part: 'hilt', d: 'M18.4 19.9a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0-3 0Z' },
  ],
} as const satisfies Record<string, readonly { part: string; d: string }[]>;

export type IconName = keyof typeof PATHS | keyof typeof LAYERED;

export function icon(name: IconName): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.8');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('ui-icon');
  const parts = name in LAYERED ? LAYERED[name as keyof typeof LAYERED] : [{ part: '', d: PATHS[name as keyof typeof PATHS] }];
  if (name in LAYERED) svg.classList.add('ui-icon--layered');
  for (const { part, d } of parts) {
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', d);
    if (part) path.dataset.part = part;
    svg.append(path);
  }
  return svg;
}
