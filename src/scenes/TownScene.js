import Phaser from 'phaser';
import { acceptStarterQuest, completeStarterQuest, createGameState } from '../game/state.js';

export class TownScene extends Phaser.Scene {
  constructor() { super('Town'); }

  preload() {
    this.load.svg('hero', './assets/characters/hero.svg');
    this.load.svg('elder', './assets/npc/elder.svg');
    this.load.svg('tree', './assets/props/tree.svg');
  }

  create() {
    if (!this.registry.get('gameState')) this.registry.set('gameState', createGameState());
    const state = this.registry.get('gameState');

    this.cameras.main.setBackgroundColor('#6ea867');
    this.physics.world.setBounds(0, 0, 1400, 900);

    const path = this.add.rectangle(700, 450, 150, 900, 0xc9b27c).setDepth(-2);
    const plaza = this.add.rectangle(700, 420, 430, 250, 0xd7c58f).setDepth(-2);
    this.add.text(38, 32, 'Aetheria - Starter Town', { fontSize: '24px', color: '#ffffff', stroke: '#000000', strokeThickness: 4 }).setScrollFactor(0);

    for (const [x,y] of [[190,150],[270,690],[1120,180],[1210,700],[350,180],[1030,650]]) {
      this.add.image(x,y,'tree').setScale(1.1);
    }

    this.add.rectangle(490, 280, 220, 135, 0x704b3a).setStrokeStyle(8, 0x3e2d26);
    this.add.rectangle(910, 280, 220, 135, 0x704b3a).setStrokeStyle(8, 0x3e2d26);
    this.add.rectangle(700, 760, 250, 100, 0x4f5967).setStrokeStyle(8, 0x2e3440);

    this.player = this.physics.add.sprite(700, 520, 'hero').setScale(1.15);
    this.player.setCollideWorldBounds(true);

    this.elder = this.physics.add.staticSprite(700, 365, 'elder').setScale(1.1);
    this.physics.add.collider(this.player, this.elder);

    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.cameras.main.setBounds(0,0,1400,900);

    this.keys = this.input.keyboard.addKeys('W,A,S,D,E');
    this.cursors = this.input.keyboard.createCursorKeys();

    this.status = this.add.text(24, 72, this.statusText(state), {
      fontSize: '16px', color: '#f5f1d8', backgroundColor: '#00000088', padding: { x: 10, y: 8 }
    }).setScrollFactor(0).setDepth(20);

    this.hint = this.add.text(24, 490, 'Talk to Elder: E / INTERACT   |   South gate -> Field', {
      fontSize: '15px', color: '#ffffff', backgroundColor: '#00000088', padding: { x: 8, y: 6 }
    }).setScrollFactor(0).setDepth(20);

    this.createTouchControls();
  }

  statusText(state) {
    const labels = {
      not_started: 'Quest: Speak with the Elder',
      accepted: 'Quest: Defeat the Meadow Slime',
      ready_to_turn_in: 'Quest: Return the Slime Core to the Elder',
      complete: 'Quest complete! Demo loop cleared.'
    };
    return labels[state.starterQuest] || '';
  }

  interact() {
    const state = this.registry.get('gameState');
    if (Phaser.Math.Distance.Between(this.player.x, this.player.y, this.elder.x, this.elder.y) > 100) return;
    if (state.starterQuest === 'not_started') acceptStarterQuest(state);
    else if (state.starterQuest === 'ready_to_turn_in') completeStarterQuest(state);
    this.registry.set('gameState', state);
    this.status.setText(this.statusText(state));
  }

  createTouchControls() {
    if (!this.sys.game.device.input.touch) return;
    const mk = (x,y,label) => this.add.text(x,y,label,{fontSize:'26px',color:'#fff',backgroundColor:'#0008',padding:{x:12,y:8}}).setScrollFactor(0).setDepth(30).setInteractive();
    this.touch = { up:false,down:false,left:false,right:false };
    const bind = (obj,key) => {
      obj.on('pointerdown',()=>this.touch[key]=true);
      obj.on('pointerup',()=>this.touch[key]=false);
      obj.on('pointerout',()=>this.touch[key]=false);
    };
    bind(mk(95,430,'▲'),'up'); bind(mk(95,495,'▼'),'down'); bind(mk(35,465,'◀'),'left'); bind(mk(155,465,'▶'),'right');
    mk(790,465,'INTERACT').on('pointerdown',()=>this.interact());
  }

  update() {
    const speed = 180;
    const body = this.player.body;
    body.setVelocity(0);
    const left = this.cursors.left.isDown || this.keys.A.isDown || this.touch?.left;
    const right = this.cursors.right.isDown || this.keys.D.isDown || this.touch?.right;
    const up = this.cursors.up.isDown || this.keys.W.isDown || this.touch?.up;
    const down = this.cursors.down.isDown || this.keys.S.isDown || this.touch?.down;
    if (left) body.setVelocityX(-speed);
    if (right) body.setVelocityX(speed);
    if (up) body.setVelocityY(-speed);
    if (down) body.setVelocityY(speed);
    body.velocity.normalize().scale(speed);

    if (Phaser.Input.Keyboard.JustDown(this.keys.E)) this.interact();

    const state = this.registry.get('gameState');
    if (this.player.y > 820 && state.starterQuest !== 'not_started') {
      this.scene.start('Field');
    }
  }
}
