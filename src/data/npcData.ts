import { JOB_INSTRUCTOR_NPC_ID } from './jobChangeData';

/*
 * Town NPCs and the services they run. Plain data: where an NPC stands comes
 * from its navigation target on the map table (data/maps), which quests and
 * Auto Move already use; which quests it gives / takes comes from the quest
 * definitions (giverNpcId / turnInNpcId). New NPCs are one entry here plus a
 * navigation target.
 */

/** What an NPC's dialogue offers besides quests. */
export type NpcService = 'enhancement' | 'enchant' | 'craft' | 'pet' | 'job' | 'dungeon';

export interface NpcDef {
  id: string;
  name: string;
  /** Role line under the name. */
  title: string;
  /** Navigation target (same map) the NPC stands at; quests' talk objectives and Auto Move go there. */
  navTargetId: string;
  greeting: string;
  services: readonly NpcService[];
  /** Placeholder figure tint. */
  color: number;
}

export const CAPTAIN_NPC_ID = 'npc_captain_rowan';
export const SMITH_NPC_ID = 'npc_smith_brann';
export const ENCHANTER_NPC_ID = 'npc_enchanter_lyra';
export const CRAFTER_NPC_ID = 'npc_crafter_odo';
export const STABLEKEEPER_NPC_ID = 'npc_stablekeeper_mira';

/** How close (px) the player must be to talk. */
export const NPC_INTERACT_RADIUS = 56;

const defs: NpcDef[] = [
  {
    id: CAPTAIN_NPC_ID,
    name: 'Captain Rowan',
    title: "Adventurers' Guild",
    navTargetId: 'nav_town_captain',
    greeting: 'Haven needs every blade it can get. The Meadow and the old Crypt below town are crawling with trouble.',
    services: ['dungeon'],
    color: 0x3f6fd8,
  },
  {
    id: SMITH_NPC_ID,
    name: 'Smith Brann',
    title: 'Enhancement',
    navTargetId: 'nav_town_enhancement',
    greeting: 'Bring me Enhancement Stones and a little Gold, and your gear will hit harder.',
    services: ['enhancement'],
    color: 0xc0392b,
  },
  {
    id: ENCHANTER_NPC_ID,
    name: 'Enchanter Lyra',
    title: 'Enchant',
    navTargetId: 'nav_town_enchant',
    greeting: 'Every piece of gear hides a few lines of power. An Enchant Stone lets me reroll them.',
    services: ['enchant'],
    color: 0x9b59d0,
  },
  {
    id: CRAFTER_NPC_ID,
    name: 'Crafter Odo',
    title: 'Crafting',
    navTargetId: 'nav_town_craft',
    greeting: 'Got blueprints and materials? I can turn them into proper gear, given time.',
    services: ['craft'],
    color: 0xd68a2c,
  },
  {
    id: STABLEKEEPER_NPC_ID,
    name: 'Stablekeeper Mira',
    title: 'Pet Stable',
    navTargetId: 'nav_town_pet',
    greeting: 'The stable is still being built. Companions will be waiting here soon!',
    services: ['pet'],
    color: 0x2fa36b,
  },
  {
    id: JOB_INSTRUCTOR_NPC_ID,
    name: 'Job Instructor',
    title: 'Job Change',
    navTargetId: 'nav_demo_job_instructor',
    greeting: 'When you are strong enough (Lv11), I will guide your first Job Change.',
    services: ['job'],
    color: 0xe0b03c,
  },
];

export const NPCS: Readonly<Record<string, NpcDef>> = Object.fromEntries(defs.map((d) => [d.id, d]));
