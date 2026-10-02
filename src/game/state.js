export function createGameState() {
  return {
    level: 1,
    exp: 0,
    inventory: [],
    starterQuest: 'not_started'
  };
}

export function acceptStarterQuest(state) {
  if (state.starterQuest === 'not_started') state.starterQuest = 'accepted';
  return state;
}

export function defeatSlime(state) {
  if (state.starterQuest === 'accepted') {
    state.starterQuest = 'ready_to_turn_in';
    state.exp += 25;
    if (!state.inventory.includes('slime_core')) state.inventory.push('slime_core');
  }
  return state;
}

export function completeStarterQuest(state) {
  if (state.starterQuest === 'ready_to_turn_in' && state.inventory.includes('slime_core')) {
    state.starterQuest = 'complete';
    state.inventory = state.inventory.filter((item) => item !== 'slime_core');
    state.exp += 25;
  }
  return state;
}
