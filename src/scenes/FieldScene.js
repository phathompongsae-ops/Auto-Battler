import Phaser from 'phaser';
import { defeatSlime } from '../game/state.js';

export class FieldScene extends Phaser.Scene {
  constructor() { super('Field'); }

  preload() {
    this.load.svg('hero', './assets/characters/hero.svg');
    this.load.svg('slime', './assets/monsters/slime.svg');
    this.load.svg('tree', './assets/props/tree.svg');
  }

  create() {
    this.cameras.main.setBackgroundColor('#79b46d');
    this.physics.world.setBounds(0,0,1500,900);

    this.add.text(30, 26, 'Whispering Meadow', { fontSize:'24px', color:'#fff', stroke:'#000', strokeThickness:4 }).setScrollFactor(0);
    this.add.rectangle(750, 80, 280, 120, 0x59606b).setStrokeStyle(8,0x30343b);
    for (const [x,y] of [[180,180],[300,730],[1210,170],[1310,720],[490,140],[1020,760]]) this.add.image(x,y,'tree');

    this.player = this.physics.add.sprite(750,170,'hero').setScale(1.15).setCollideWorldBounds(true);
    this.slime = this.physics.add.sprite(750,610,'slime').setScale(1.1);
    this.slime.hp = 3;

    this.cameras.main.startFollow(this.player,true,0.12,0.12);
    this.cameras.main.setBounds(0,0,1500,900);
    this.keys = this.input.keyboard.addKeys('W,A,S,D,SPACE');
    this.cursors = this.input.keyboard.createCursorKeys();

    this.status = this.add.text(24,70,'Find the slime and attack at close range.',{
      fontSize:'16px',color:'#f5f1d8',backgroundColor:'#0008',padding:{x:10,y:8}
    }).setScrollFactor(0).setDepth(20);

    this.createTouchControls();
  }

  attack() {
    if (!this.slime?.active) return;
    const d = Phaser.Math.Distance.Between(this.player.x,this.player.y,this.slime.x,this.slime.y);
    if (d > 95) { this.status.setText('Move closer to attack.'); return; }
    this.slime.hp -= 1;
    this.slime.setTintFill(0xffffff);
    this.time.delayedCall(90,()=>this.slime?.clearTint());
    if (this.slime.hp <= 0) {
      const state = this.registry.get('gameState');
      defeatSlime(state);
      this.registry.set('gameState',state);
      this.slime.destroy();
      this.status.setText('Slime defeated! +25 EXP, Slime Core obtained. Return north to town.');
    } else {
      this.status.setText('Hit! Slime HP: '+this.slime.hp+'/3');
    }
  }

  createTouchControls() {
    if (!this.sys.game.device.input.touch) return;
    const mk=(x,y,label)=>this.add.text(x,y,label,{fontSize:'26px',color:'#fff',backgroundColor:'#0008',padding:{x:12,y:8}}).setScrollFactor(0).setDepth(30).setInteractive();
    this.touch={up:false,down:false,left:false,right:false};
    const bind=(obj,key)=>{obj.on('pointerdown',()=>this.touch[key]=true);obj.on('pointerup',()=>this.touch[key]=false);obj.on('pointerout',()=>this.touch[key]=false);};
    bind(mk(95,430,'▲'),'up'); bind(mk(95,495,'▼'),'down'); bind(mk(35,465,'◀'),'left'); bind(mk(155,465,'▶'),'right');
    mk(820,465,'ATTACK').on('pointerdown',()=>this.attack());
  }

  update() {
    const speed=185;
    const body=this.player.body;
    body.setVelocity(0);
    const left=this.cursors.left.isDown||this.keys.A.isDown||this.touch?.left;
    const right=this.cursors.right.isDown||this.keys.D.isDown||this.touch?.right;
    const up=this.cursors.up.isDown||this.keys.W.isDown||this.touch?.up;
    const down=this.cursors.down.isDown||this.keys.S.isDown||this.touch?.down;
    if(left) body.setVelocityX(-speed); if(right) body.setVelocityX(speed); if(up) body.setVelocityY(-speed); if(down) body.setVelocityY(speed);
    body.velocity.normalize().scale(speed);

    if(Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) this.attack();

    if(this.slime?.active) {
      const d=Phaser.Math.Distance.Between(this.slime.x,this.slime.y,this.player.x,this.player.y);
      if(d<240 && d>70) this.physics.moveToObject(this.slime,this.player,42);
      else this.slime.body.setVelocity(0);
    }

    const state=this.registry.get('gameState');
    if(this.player.y<105 && state.starterQuest==='ready_to_turn_in') this.scene.start('Town');
  }
}
