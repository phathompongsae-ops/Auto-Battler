import { CAPTAIN_NPC_ID, SMITH_NPC_ID } from '../npcData';
import type { QuestDef } from '../questData';

/*
 * MVP main quest chain: a short guided tour of the current vertical slice.
 * Town (meet a service NPC) → Field (wolves, their fangs, the Elite Boar) →
 * back to Town → the Sunken Crypt (enter it, defeat the Crypt Lord) → back to
 * Town for the final reward. Rewards are DEMO values.
 */

export const MVP_FIELD_ENTRY_ID = 'demo_field_entry';
export const MVP_CRYPT_ENTRANCE_ID = 'demo_crypt_entrance';

export const MAIN_QUESTS: Readonly<Record<string, QuestDef>> = {
  mvp_01_welcome: {
    id: 'mvp_01_welcome',
    title: 'Welcome to Haven',
    description: 'Captain Rowan wants you to meet Smith Brann at the forge before you head out.',
    type: 'main',
    giverNpcId: CAPTAIN_NPC_ID,
    turnInNpcId: SMITH_NPC_ID,
    objectives: [{ kind: 'talk', npcId: SMITH_NPC_ID, label: 'Meet Smith Brann' }],
    rewards: { exp: 60, gold: 50, items: [{ itemId: 'town_warp_scroll', count: 1 }] },
    nextQuestIds: ['mvp_02_meadow'],
  },
  mvp_02_meadow: {
    id: 'mvp_02_meadow',
    title: 'Trouble in the Meadow',
    description: 'Brann needs wolf fangs, and an Elite Boar is terrorising the Green Meadow. Report to Captain Rowan when it is done.',
    type: 'main',
    giverNpcId: SMITH_NPC_ID,
    turnInNpcId: CAPTAIN_NPC_ID,
    objectives: [
      { kind: 'visit', locationId: MVP_FIELD_ENTRY_ID, label: 'Reach the Green Meadow' },
      { kind: 'kill', monsterId: 'wolf', count: 3, label: 'Wolves' },
      { kind: 'collect', itemId: 'wolf_fang', count: 3, label: 'Wolf Fangs' },
      { kind: 'kill', monsterId: 'elite_boar', tier: 'elite', label: 'Elite Boar' },
    ],
    rewards: { exp: 600, gold: 150, items: [{ itemId: 'enhancement_stone', count: 3 }] },
    prerequisites: { requiredQuestIds: ['mvp_01_welcome'] },
    nextQuestIds: ['mvp_03_crypt'],
  },
  mvp_03_crypt: {
    id: 'mvp_03_crypt',
    title: 'Into the Sunken Crypt',
    description: 'The Crypt Lord stirs beneath Haven. Enter the Sunken Crypt through the Dungeon Gate, defeat it, and return to Captain Rowan.',
    type: 'main',
    giverNpcId: CAPTAIN_NPC_ID,
    turnInNpcId: CAPTAIN_NPC_ID,
    objectives: [
      { kind: 'visit', locationId: MVP_CRYPT_ENTRANCE_ID, label: 'Enter the Sunken Crypt' },
      { kind: 'kill', monsterId: 'crypt_lord', tier: 'dungeon_boss', label: 'Crypt Lord' },
    ],
    rewards: {
      exp: 2500,
      gold: 600,
      items: [
        { itemId: 'enchant_stone', count: 2 },
        { itemId: 'protection_stone', count: 1 },
      ],
    },
    prerequisites: { requiredQuestIds: ['mvp_02_meadow'] },
  },
};
