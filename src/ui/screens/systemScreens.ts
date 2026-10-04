import { RECIPES } from '../../data/craftingData';
import { EQUIPMENT_DEFS } from '../../data/equipmentItems';
import { JOBS } from '../../data/jobData';
import type { CombatWorld } from '../../game/CombatWorld';
import { createButton } from '../components/Button';
import { h, setText } from '../dom';

/*
 * TEMPORARY system screens (not final UI): small, functional bodies for
 * Job Change, Warp, Enhancement, Enchant and Craft. They only call the
 * feature-gated production actions on CombatWorld; the menus decide whether
 * the screen may open at all.
 */

const caption = (text: string, role?: string) => h('div', { className: 'ui-caption', text, attrs: role ? { 'data-role': role } : {} });
const label = (text: string) => h('div', { className: 'ui-label', text });

/** A list that re-renders itself after each action, with a result line. */
function selfRendering(build: (rerender: () => void, say: (text: string) => void) => Node[]): HTMLElement {
  const root = h('div', { className: 'ui-list' });
  const result = caption('', 'result');
  const say = (text: string) => setText(result, text);
  const rerender = () => root.replaceChildren(...build(rerender, say), result);
  rerender();
  return root;
}

const describe = (r: { ok: boolean; reason?: string; message?: string }) => (r.ok ? 'Done.' : (r.message ?? r.reason ?? 'Failed.'));

export function renderJobChange(world: CombatWorld, openJobSelect?: () => boolean): HTMLElement {
  return selfRendering(() => {
    const job = world.jobChange;
    const stage = job.stage();
    const rows: Node[] = [label(`Current job: ${JOBS[world.player.progress.classId].name}`)];
    if (stage === 'class_1') rows.push(caption('Your Class 1 job is chosen. (Class 2 comes later.)'));
    else if (stage === 'selection_available') {
      const choose = createButton({ label: 'Choose your Class', variant: 'primary', onClick: () => openJobSelect?.() });
      choose.dataset.action = 'choose-class';
      rows.push(caption('Your Job Trial is complete.'), choose);
    } else {
      rows.push(caption('Speak with the Job Instructor to begin the Job Trial.'));
      for (const id of ['job_c1_01_instructor', 'job_c1_02_trial', 'job_c1_03_report']) {
        rows.push(caption(`${world.quests.defs[id].title}: ${world.quests.status(id)}`));
      }
    }
    return rows;
  });
}

export function renderWarp(world: CombatWorld): HTMLElement {
  return selfRendering((rerender, say) => {
    const town = createButton({
      label: `Use Town Warp Scroll (${world.inventory.count('town_warp_scroll')})`,
      onClick: () => {
        say(describe(world.useWarpScroll('town')));
        rerender();
      },
    });
    town.dataset.action = 'town-warp';
    return [label(`Current map: ${world.location.mapId}`), town, caption('Dungeon Warp Scrolls take you to a discovered dungeon entrance.')];
  });
}

export function renderEnhancement(world: CombatWorld): HTMLElement {
  return selfRendering((rerender, say) => {
    const items = [...world.player.equipment.items.values()];
    if (!items.length) return [caption('No equipment to enhance.')];
    return [
      caption(`Enhancement Stones: ${world.inventory.count('enhancement_stone')} · Gold: ${world.wallet.get('gold')}`),
      ...items.map((item) => {
        const button = createButton({
          label: 'Enhance',
          onClick: () => {
            const r = world.enhanceEquipment(item.instanceId);
            say(r.ok && 'success' in r ? (r.success ? `Success: +${r.to}` : `Failed (now +${r.to})`) : describe(r));
            rerender();
          },
        });
        button.dataset.enhance = item.instanceId;
        return h('div', { className: 'ui-list__row' }, [label(`${EQUIPMENT_DEFS[item.defId]?.name ?? item.defId} +${item.enhancement}`), button]);
      }),
    ];
  });
}

export function renderEnchant(world: CombatWorld): HTMLElement {
  return selfRendering((rerender, say) => {
    const items = [...world.player.equipment.items.values()];
    if (!items.length) return [caption('No equipment to enchant.')];
    return items.map((item) => {
      const button = createButton({
        label: 'Reroll',
        onClick: () => {
          say(describe(world.rerollPlayerEnchants(item.instanceId)));
          rerender();
        },
      });
      button.dataset.enchant = item.instanceId;
      const lines = item.enchants.map((l) => `${l.optionId} (${l.quality})`).join(', ') || 'no lines';
      return h('div', { className: 'ui-list__row' }, [h('div', {}, [label(EQUIPMENT_DEFS[item.defId]?.name ?? item.defId), caption(lines)]), button]);
    });
  });
}

export function renderCraft(world: CombatWorld): HTMLElement {
  return selfRendering((rerender, say) => {
    const recipes = Object.values(RECIPES).map((r) => {
      const button = createButton({
        label: 'Start',
        onClick: () => {
          say(describe(world.startCraft(r.id)));
          rerender();
        },
      });
      button.dataset.craft = r.id;
      return h('div', { className: 'ui-list__row' }, [h('div', {}, [label(EQUIPMENT_DEFS[r.outputDefId]?.name ?? r.outputDefId), caption(`${r.gold} Gold · ${Math.round(r.durationMs / 3_600_000)}h`)]), button]);
    });
    const jobs = world.crafting.jobs
      .filter((j) => !j.claimed)
      .map((j) => {
        const button = createButton({
          label: 'Claim',
          onClick: () => {
            say(describe(world.claimCraft(j.jobId)));
            rerender();
          },
        });
        button.dataset.claimCraft = j.jobId;
        return h('div', { className: 'ui-list__row' }, [label(`${RECIPES[j.recipeId].id}`), button]);
      });
    return [...recipes, ...(jobs.length ? [label('In progress'), ...jobs] : [])];
  });
}
