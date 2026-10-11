import Phaser from 'phaser';
import { NPC_ART_CONTRACT, npcArtKey } from '../data/npcArt';

/*
 * TEST-ONLY: a contract-shaped stand-in for a production NPC master (192×192,
 * feet on row 153, body axis between columns 94 and 95, 121 px tall), so the
 * production drawing path can be verified before real art is delivered.
 * Never used by the game itself; installed and removed through the debug API.
 */
/** Fixture textures this module created (a delivered master is never touched). */
const installed = new Set<string>();

export function installNpcArtFixture(scene: Phaser.Scene, npcId: string): boolean {
  const key = npcArtKey(npcId);
  if (scene.textures.exists(key)) return false;
  const c = NPC_ART_CONTRACT;
  const tex = scene.textures.createCanvas(key, c.canvas, c.canvas);
  if (!tex) return false;
  const g = tex.getContext();
  const top = c.feetRow + 1 - 121;
  g.fillStyle = '#c9a04a';
  g.beginPath();
  g.arc(c.axisX, top + 26, 26, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#3f6fd8';
  g.fillRect(c.axisX - 22, top + 50, 44, 50);
  g.fillStyle = '#2a2233';
  g.fillRect(c.axisX - 16, top + 100, 12, 21);
  g.fillRect(c.axisX + 4, top + 100, 12, 21);
  tex.refresh();
  tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
  installed.add(key);
  return true;
}

export function removeNpcArtFixture(scene: Phaser.Scene, npcId: string): void {
  const key = npcArtKey(npcId);
  if (!installed.delete(key)) return;
  if (scene.textures.exists(key)) scene.textures.remove(key);
}
