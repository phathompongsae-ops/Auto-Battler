import type { QuestDef } from '../questData';

/*
 * DEMO / TEST FIXTURES ONLY: a tiny chain proving the Quest Engine. Not the
 * Demo's real Main Quests. NPC and location ids are placeholders until maps
 * and NPCs exist.
 */
export const DEMO_NPC_ID = 'demo_npc_guide';
export const DEMO_MARKER_ID = 'demo_marker_gate';

export const DEMO_TEST_QUESTS: Readonly<Record<string, QuestDef>> = {
  q_demo_01: {
    id: 'q_demo_01',
    title: 'A Friendly Greeting',
    description: 'Talk to the guide.',
    type: 'main',
    objectives: [{ kind: 'talk', npcId: DEMO_NPC_ID }],
    rewards: { exp: 100, gold: 50 },
    nextQuestIds: ['q_demo_02'],
  },
  q_demo_02: {
    id: 'q_demo_02',
    title: 'Slime Patrol',
    description: 'Defeat 3 Slimes.',
    type: 'main',
    objectives: [{ kind: 'kill', monsterId: 'slime', count: 3 }],
    rewards: { exp: 300, items: [{ itemId: 'town_warp_scroll', count: 1 }] },
    prerequisites: { requiredQuestIds: ['q_demo_01'] },
    nextQuestIds: ['q_demo_03'],
  },
  q_demo_03: {
    id: 'q_demo_03',
    title: 'The Old Gate',
    description: 'Visit the marker by the gate.',
    type: 'feature',
    objectives: [{ kind: 'visit', locationId: DEMO_MARKER_ID }],
    rewards: {},
    prerequisites: { requiredQuestIds: ['q_demo_02'] },
    featureUnlockId: 'demo_feature',
  },
};
