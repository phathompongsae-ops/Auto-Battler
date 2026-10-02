export function createGameState() {
  return { classId:'warrior', level:1, exp:0, expToNext:100, gold:0, hp:140, maxHp:140, inventory:[], starterQuest:'not_started', lastMessage:'' };
}
export function addExp(state, amount) {
  state.exp += Math.max(0, amount);
  while (state.exp >= state.expToNext) {
    state.exp -= state.expToNext; state.level += 1; state.expToNext = Math.floor(state.expToNext * 1.25);
    state.maxHp += 12; state.hp = state.maxHp;
  }
  return state;
}
export function acceptStarterQuest(state) {
  if (state.starterQuest === 'not_started') { state.starterQuest='accepted'; state.lastMessage='Quest accepted: Defeat the Meadow Slime.'; }
  return state;
}
export function defeatSlime(state) {
  if (state.starterQuest === 'accepted') {
    state.starterQuest='ready_to_turn_in'; addExp(state,25);
    if (!state.inventory.includes('slime_core')) state.inventory.push('slime_core');
    state.lastMessage='Slime defeated! Slime Core obtained.';
  }
  return state;
}
export function completeStarterQuest(state) {
  if (state.starterQuest === 'ready_to_turn_in' && state.inventory.includes('slime_core')) {
    state.starterQuest='complete'; state.inventory=state.inventory.filter(i=>i!=='slime_core');
    addExp(state,50); state.gold += 20; state.lastMessage='Quest complete! +50 EXP, +20 Gold.';
  }
  return state;
}
export function damagePlayer(state, amount) { state.hp=Math.max(0,state.hp-Math.max(0,amount)); return state; }
export function respawnPlayer(state) { state.hp=state.maxHp; state.lastMessage='You recovered at the town shrine.'; return state; }
