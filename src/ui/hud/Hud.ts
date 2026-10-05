import type Phaser from 'phaser';
import type { CharacterArt } from '../../data/characterArt';
import type { CombatWorld } from '../../game/CombatWorld';
import type { TouchDragSource } from '../../input/TouchDragSource';
import type { VirtualActionSource } from '../../input/VirtualActionSource';
import { h } from '../dom';
import { DEMO_QUESTS } from '../data/quests';
import { JobSelectWindow } from '../screens/JobSelectWindow';
import { WindowManager } from '../screens/WindowManager';
import { UiRoot } from '../UiRoot';
import { ActionCluster } from './ActionCluster';
import { Joystick } from './Joystick';
import { MenuBar } from './MenuBar';
import { Minimap } from './Minimap';
import { PlayerFrame } from './PlayerFrame';
import { QuestProgressSource, QuestTracker } from './QuestTracker';

export interface HudOptions {
  world: CombatWorld;
  art: CharacterArt | null;
  actions: VirtualActionSource;
  drag: TouchDragSource;
  tiles: number[][];
  areaName: string;
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
  private readonly minimap: Minimap;
  private readonly menu: MenuBar;
  private readonly tracker: QuestTracker;
  private readonly joystick: Joystick;
  private readonly actions: ActionCluster;

  constructor(scene: Phaser.Scene, options: HudOptions) {
    const { world } = options;
    this.root = new UiRoot(scene.game);
    this.quests = new QuestProgressSource(world, options.fixtureQuests ? DEMO_QUESTS : []);
    this.windows = new WindowManager(this.root.el, { world, quests: this.quests, openJobSelect: () => this.jobSelect.open() });
    this.jobSelect = new JobSelectWindow(this.root.el, world, this.windows);

    this.player = new PlayerFrame(world.player, options.art);
    this.minimap = new Minimap(world, scene.cameras.main, options.tiles, options.areaName);
    this.menu = new MenuBar(world, this.windows, this.quests);
    this.tracker = new QuestTracker(this.quests);
    this.joystick = new Joystick(options.drag, this.root);
    this.actions = new ActionCluster(world, options.actions);

    const region = (name: string, children: Node[]) =>
      h('div', { className: `hud__region hud__${name}`, attrs: { 'data-region': name } }, children);

    const hud = h('div', { className: 'hud', attrs: { 'data-hud': 'root' } }, [
      this.joystick.el,
      region('top-left', [this.player.el]),
      region('top-right', [this.minimap.el, this.menu.el]),
      region('left-middle', options.fixtureQuests ? [this.tracker.el] : []),
      region('bottom-right', [this.actions.el]),
    ]);
    // Only buttons and slots take pointer events (see components.css); gaps between
    // them and every panel let clicks and drags through to the game.
    this.root.el.append(hud);
  }

  update(now: number): void {
    this.player.update();
    this.minimap.update(now);
    this.menu.update();
    this.tracker.update();
    this.joystick.update();
    this.actions.update(now);
  }

  destroy(): void {
    this.actions.destroy();
    this.menu.destroy();
    this.quests.destroy();
    this.jobSelect.destroy();
    this.windows.destroy();
    this.root.destroy();
  }
}
