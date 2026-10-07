import type { CombatWorld } from '../../game/CombatWorld';
import { h } from '../dom';

/** Current area chart uses the same live map pixels as the HUD, never changes navigation. */
export function renderAreaMap(world: CombatWorld): Node {
  const map = world.maps.map;
  const canvas = h('canvas', { className: 'ui-area-map', attrs: { role: 'img', 'aria-label': `${map.displayName}: terrain and current player location` } });
  const source = document.querySelector<HTMLCanvasElement>('[data-hud=minimap] canvas');
  if (source) {
    canvas.width = source.width; canvas.height = source.height;
    canvas.getContext('2d')!.drawImage(source, 0, 0);
  }
  return h('div', { className: 'ui-area-chart' }, [
    h('div', { className: 'ui-title', text: map.displayName }), canvas,
    h('div', { className: 'ui-caption', text: 'Gold · You     Red · Monsters     Green · Loot     Violet · Gate' }),
    h('div', { className: 'ui-caption', text: `Current position: ${Math.round(world.player.x)}, ${Math.round(world.player.y)}` }),
  ]);
}

/** Session-only UI preferences; gameplay and the save schema stay untouched. */
export function renderHudSettings(tab: string | null, world: CombatWorld): Node {
  const root = document.querySelector<HTMLElement>('[data-ui-root]')!;
  const choices = tab === 'controls'
    ? [{ key: 'hideKeys', label: 'Hide keyboard hints', description: 'Keep combat labels and cooldowns visible.' }]
    : [{ key: 'calm', label: 'Reduce decorative motion', description: 'Remove interface transitions and ready-state glow.' },
       { key: 'contrast', label: 'Stronger panel backing', description: 'Improve text contrast over bright terrain.' }];
  return h('div', { className: 'ui-list' }, [
    h('div', { className: 'ui-caption', text: 'Interface preferences for this play session.' }),
    ...potionPreferences(world),
    ...choices.map(({ key, label, description }) => {
      const input = h('input', { attrs: { type: 'checkbox', 'data-preference': key } });
      input.checked = root.dataset[key] === 'true';
      input.addEventListener('change', () => { root.dataset[key] = String(input.checked); });
      return h('label', { className: 'ui-preference' }, [input, h('span', {}, [h('span', { className: 'ui-label', text: label }), h('span', { className: 'ui-caption', text: description })])]);
    }),
    tab === 'controls' ? h('div', { className: 'ui-caption', text: 'Move: WASD / arrows / drag · Attack: Space · Skills: Q E R F G · Dodge: Shift · HP Potion: 1 · MP Potion: 2 · Talk: T · Character: C · Inventory: I · Skills: K · Quests: J · Map: M · Close: Esc' }) : null,
  ]);
}

function potionPreferences(world: CombatWorld): HTMLElement[] {
  const settings = world.player.progress.autoPotions;
  return (['hp', 'mp'] as const).map(resource => {
    const toggleKey = resource === 'hp' ? 'hpEnabled' : 'mpEnabled';
    const thresholdKey = resource === 'hp' ? 'hpThreshold' : 'mpThreshold';
    const toggle = h('input', { attrs: { type: 'checkbox', 'data-auto-potion': resource, 'aria-label': 'Auto ' + resource.toUpperCase() + ' Potion' } });
    toggle.checked = settings[toggleKey];
    toggle.addEventListener('change', () => { settings[toggleKey] = toggle.checked; });
    const threshold = h('input', { attrs: { type: 'number', min: '1', max: '100', step: '1', 'data-potion-threshold': resource, 'aria-label': resource.toUpperCase() + ' threshold percent' } });
    threshold.value = String(settings[thresholdKey]);
    threshold.addEventListener('change', () => {
      const value = Number(threshold.value);
      if (Number.isFinite(value)) settings[thresholdKey] = Math.min(100, Math.max(1, Math.round(value)));
      threshold.value = String(settings[thresholdKey]);
    });
    return h('label', { className: 'ui-preference' }, [toggle, h('span', { text: 'Auto ' + resource.toUpperCase() + ' Potion below % (in combat)' }), threshold]);
  });
}
