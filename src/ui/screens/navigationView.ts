import type { CombatWorld } from '../../game/CombatWorld';
import { h } from '../dom';
import { LOCALES, locale, setLocale, t } from '../i18n';

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
    h('div', { className: 'ui-caption', text: t('map.legend') }),
    h('div', { className: 'ui-caption', text: t('map.position', { x: Math.round(world.player.x), y: Math.round(world.player.y) }) }),
  ]);
}

/** Session-only UI preferences; gameplay and the save schema stay untouched. */
export function renderHudSettings(tab: string | null, world: CombatWorld): Node {
  const root = document.querySelector<HTMLElement>('[data-ui-root]')!;
  const choices = tab === 'controls'
    ? [{ key: 'hideKeys', label: t('settings.hideKeys'), description: t('settings.hideKeysHint') }]
    : [{ key: 'calm', label: t('settings.calm'), description: t('settings.calmHint') },
       { key: 'contrast', label: t('settings.contrast'), description: t('settings.contrastHint') }];
  return h('div', { className: 'ui-list' }, [
    tab === 'controls' ? null : languagePicker(),
    h('div', { className: 'ui-caption', text: t('settings.sessionNote') }),
    ...potionPreferences(world),
    ...choices.map(({ key, label, description }) => {
      const input = h('input', { attrs: { type: 'checkbox', 'data-preference': key } });
      input.checked = root.dataset[key] === 'true';
      input.addEventListener('change', () => { root.dataset[key] = String(input.checked); });
      return h('label', { className: 'ui-preference' }, [input, h('span', {}, [h('span', { className: 'ui-label', text: label }), h('span', { className: 'ui-caption', text: description })])]);
    }),
    tab === 'controls' ? h('div', { className: 'ui-caption', text: t('settings.controlsList') }) : null,
  ]);
}

/** Interface language (device preference, outside the game save). Switching relabels the HUD in place. */
function languagePicker(): HTMLElement {
  const buttons = LOCALES.map(({ id, name }) => {
    const button = h('button', { className: 'ui-button', text: name, attrs: { type: 'button', lang: id, 'data-locale': id, 'aria-pressed': String(locale() === id) } });
    button.addEventListener('click', (e) => { e.stopPropagation(); setLocale(id); });
    return button;
  });
  return h('div', { className: 'ui-preference ui-preference--language', attrs: { role: 'group', 'aria-label': t('settings.language') } }, [
    h('span', {}, [h('span', { className: 'ui-label', text: t('settings.language') }), h('span', { className: 'ui-caption', text: t('settings.languageHint') })]),
    h('span', { className: 'ui-segmented' }, buttons),
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
    const threshold = h('input', { attrs: { type: 'number', min: '1', max: '100', step: '1', 'data-potion-threshold': resource, 'aria-label': t('settings.autoPotionThreshold', { resource: resource.toUpperCase() }) } });
    threshold.value = String(settings[thresholdKey]);
    threshold.addEventListener('change', () => {
      const value = Number(threshold.value);
      if (Number.isFinite(value)) settings[thresholdKey] = Math.min(100, Math.max(1, Math.round(value)));
      threshold.value = String(settings[thresholdKey]);
    });
    return h('label', { className: 'ui-preference' }, [toggle, h('span', { text: t('settings.autoPotion', { resource: resource.toUpperCase() }) }), threshold]);
  });
}
