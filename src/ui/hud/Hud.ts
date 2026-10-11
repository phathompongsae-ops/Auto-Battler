import type Phaser from 'phaser';
import type { CharacterArt } from '../../data/characterArt';
import type { CombatWorld } from '../../game/CombatWorld';
import type { TouchDragSource } from '../../input/TouchDragSource';
import type { VirtualActionSource } from '../../input/VirtualActionSource';
import { h } from '../dom';
import { DEMO_QUESTS } from '../data/quests';
import { JobSelectWindow } from '../screens/JobSelectWindow';
import { WindowManager } from '../screens/WindowManager';
import { onLocaleChange, t } from '../i18n';
import { UiRoot } from '../UiRoot';
import { ActionCluster } from './ActionCluster';
import { Joystick } from './Joystick';
import { MenuBar } from './MenuBar';
import { SystemStrip } from './SystemStrip';
import { Minimap } from './Minimap';
import { PlayerFrame } from './PlayerFrame';
import { QuestProgressSource, QuestTracker } from './QuestTracker';
import { RespawnNotice, TargetFrame } from './TargetFrame';
import { LootFeed } from './LootFeed';
import { StatusRow } from './StatusRow';
import { InteractPrompt, QuestTrackerHud } from './QuestHud';

export interface HudOptions {
  world: CombatWorld;
  art: CharacterArt | null;
  actions: VirtualActionSource;
  drag: TouchDragSource;
  /** Legacy HUD quest examples, shown only by the explicit fixture test mode. */
  fixtureQuests?: boolean;
}

/**
 * The in-game HUD. Regions sit in the corners and edges, leaving the centre
 * of the screen open. Reads simulation state every frame; writes only on
 * change. Input goes through the same Action/Direction sources as keys.
 */
export class Hud {
  readonly root: UiRoot;
  readonly windows: WindowManager;
  /** TEMPORARY DEMO Class 1 job selection (opens itself when selection is available). */
  readonly jobSelect: JobSelectWindow;
  private readonly quests: QuestProgressSource;
  private readonly player: PlayerFrame;
  /** Player buffs / debuffs / potion recoveries, directly under the player frame. */
  private readonly playerStatus = new StatusRow('player-status', 6);
  private readonly offLocale: () => void;
  private readonly world: CombatWorld;
  private readonly minimap: Minimap;
  private readonly menu: MenuBar;
  private readonly systems: SystemStrip;
  private readonly tracker: QuestTracker;
  private readonly joystick: Joystick;
  private readonly actions: ActionCluster;
  private readonly target: TargetFrame;
  private readonly respawn: RespawnNotice;
  private readonly lootFeed: LootFeed;
  private readonly interact: InteractPrompt;
  private readonly questTracker: QuestTrackerHud;
  /** Top-centre region (target frame); its fit against the top corners is re-measured only after a resize. */
  private readonly topCenter: HTMLDivElement;
  private readonly bandObserver: ResizeObserver;
  private fittedTier: string | null = null;

  constructor(scene: Phaser.Scene, options: HudOptions) {
    const { world } = options;
    this.world = world;
    this.root = new UiRoot(scene.game);
    this.quests = new QuestProgressSource(world, options.fixtureQuests ? DEMO_QUESTS : []);
    this.windows = new WindowManager(this.root.el, { world, quests: this.quests, openJobSelect: () => this.jobSelect.open() });
    this.jobSelect = new JobSelectWindow(this.root.el, world, this.windows);

    this.player = new PlayerFrame(world.player, options.art, world.wallet);
    this.minimap = new Minimap(world, scene.cameras.main);
    this.menu = new MenuBar(this.windows);
    this.systems = new SystemStrip(world, this.windows);
    this.tracker = new QuestTracker(this.quests);
    this.joystick = new Joystick(options.drag, this.root);
    this.actions = new ActionCluster(world, options.actions);
    this.target = new TargetFrame(world);
    this.respawn = new RespawnNotice(world);
    this.lootFeed = new LootFeed(world);
    this.interact = new InteractPrompt(world, this.windows);
    this.questTracker = new QuestTrackerHud(world);

    const region = (name: string, children: Node[]) =>
      h('div', { className: `hud__region hud__${name}`, attrs: { 'data-region': name } }, children);

    this.topCenter = region('top-center', [this.target.el]);
    const hud = h('div', { className: 'hud', attrs: { 'data-hud': 'root' } }, [
      this.joystick.el,
      region('top-left', [this.player.el, this.playerStatus.el]),
      this.topCenter,
      region('center', [this.respawn.el]),
      region('loot', [this.lootFeed.el]),
      region('interact', [this.interact.el]),
      region('top-right', [h('div', { className: 'hud-map-group' }, [this.menu.el, this.minimap.el]), this.questTracker.el]),
      region('left-middle', options.fixtureQuests ? [this.tracker.el] : []),
      region('bottom-right', [this.actions.el]),
      region('systems', [this.systems.el]),
    ]);
    // Only buttons and slots take pointer events (see components.css); gaps between
    // them and every panel let clicks and drags through to the game.
    this.root.el.append(hud);
    this.playerStatus.setLabel(t('hud.playerStatuses'));
    this.offLocale = onLocaleChange(() => this.playerStatus.setLabel(t('hud.playerStatuses')));
    // Re-fit the target frame only when the screen or a top corner changes size, never per frame.
    this.bandObserver = new ResizeObserver(() => (this.fittedTier = null));
    for (const el of [this.root.el, this.player.el, this.menu.el]) this.bandObserver.observe(el);
  }

  /**
   * The target frame stays centred on screen while it fits between the player frame and the utility row.
   * On narrow screens (844x390, 640x360) it centres in the free gap instead and may wrap its state line,
   * so a boss's "Winding up!" warning is never under the Shop / Daily buttons.
   */
  private fitTarget(): void {
    const frame = this.target.el;
    const tier = frame.dataset.tier ?? '';
    if (frame.hidden || this.fittedTier === tier) return;
    this.fittedTier = tier;
    const GAP = 6;
    const root = this.root.el.getBoundingClientRect();
    const left = this.player.el.getBoundingClientRect().right - root.left + GAP;
    const right = this.menu.el.getBoundingClientRect().left - root.left - GAP;
    const half = parseFloat(getComputedStyle(frame).width) / 2;
    const centred = root.width / 2 - half >= left && root.width / 2 + half <= right;
    this.topCenter.style.left = centred ? '' : `${(left + right) / 2}px`;
    frame.style.maxWidth = centred ? '' : `${Math.max(120, right - left)}px`;
    this.topCenter.classList.toggle('is-fitted', !centred);
  }

  update(now: number): void {
    this.player.update();
    this.playerStatus.update(this.world.player.combat, now);
    this.minimap.update(now);
    this.menu.update();
    this.systems.update();
    this.tracker.update();
    this.joystick.update();
    this.actions.update(now);
    this.target.update(now);
    this.fitTarget();
    this.respawn.update(now);
    this.interact.update();
    this.questTracker.update();
  }

  destroy(): void {
    this.bandObserver.disconnect();
    this.offLocale();
    this.target.destroy();
    this.lootFeed.destroy();
    this.interact.destroy();
    this.questTracker.destroy();
    this.actions.destroy();
    this.menu.destroy();
    this.systems.destroy();
    this.quests.destroy();
    this.jobSelect.destroy();
    this.windows.destroy();
    this.root.destroy();
  }
}
