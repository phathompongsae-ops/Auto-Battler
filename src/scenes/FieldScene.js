import Phaser from 'phaser';
import { damagePlayer, defeatSlime } from '../game/state.js';

export class FieldScene extends Phaser.Scene {
  constructor(){ super('Field'); }
  preload(){ this.load.svg('hero','./assets/characters/hero.svg'); this.load.svg('slime','./assets/monsters/slime.svg'); this.load.svg('tree','./assets/props/tree.svg'); }
  create(){
    this.physics.world.setBounds(0,0,1500,900); this.cameras.main.setBounds(0,0,1500,900); this.cameras.main.setBackgroundColor('#79b46d');
    this.add.rectangle(750,450,1500,900,0x79b46d).setDepth(-5); this.add.rectangle(750,450,170,900,0xc8ad74).setDepth(-4);
    for(const [x,y] of [[160,160],[270,720],[1220,170],[1320,710],[450,260],[1050,690]]) this.add.image(x,y,'tree').setDepth(y);
    this.player=this.physics.add.sprite(750,155,'hero').setScale(1.15).setCollideWorldBounds(true); this.player.hp=140; this.player.facing='down';
    this.slime=this.physics.add.sprite(750,610,'slime').setScale(1.1); this.slime.hp=48; this.slime.lastAttack=0;
    this.physics.add.collider(this.player,this.slime); this.cameras.main.startFollow(this.player,true,0.14,0.14); this.cameras.main.setRoundPixels(true);
    this.keys=this.input.keyboard.addKeys('W,A,S,D,SPACE'); this.cursors=this.input.keyboard.createCursorKeys(); this.lastAttack=-9999;
    this.hud=this.add.text(18,18,'',{fontSize:'15px',color:'#fff',backgroundColor:'#0009',padding:{x:10,y:8}}).setScrollFactor(0).setDepth(50);
    this.notice=this.add.text(18,92,'Find the Meadow Slime. SPACE / ATTACK',{fontSize:'14px',color:'#fff',backgroundColor:'#0009',padding:{x:9,y:6}}).setScrollFactor(0).setDepth(50);
    this.touch={up:false,down:false,left:false,right:false}; this.createTouchControls(); this.refreshHud();
  }
  refreshHud(){ const s=this.registry.get('gameState'); this.hud.setText(`Whispering Meadow\nWarrior Lv.${s.level}  HP ${s.hp}/${s.maxHp}  EXP ${s.exp}/${s.expToNext}  Gold ${s.gold}\nQuest: ${s.starterQuest}`); }
  createTouchControls(){
    const mk=(x,y,t)=>this.add.text(x,y,t,{fontSize:'24px',color:'#fff',backgroundColor:'#0008',padding:{x:12,y:8}}).setScrollFactor(0).setDepth(60).setInteractive();
    const bind=(o,k)=>{o.on('pointerdown',()=>this.touch[k]=true);o.on('pointerup',()=>this.touch[k]=false);o.on('pointerout',()=>this.touch[k]=false);};
    bind(mk(92,410,'▲'),'up'); bind(mk(92,485,'▼'),'down'); bind(mk(28,450,'◀'),'left'); bind(mk(154,450,'▶'),'right'); mk(815,458,'ATTACK').on('pointerdown',()=>this.attack());
  }
  attack(){
    if(!this.slime?.active || this.time.now-this.lastAttack<500) return; this.lastAttack=this.time.now;
    const d=Phaser.Math.Distance.Between(this.player.x,this.player.y,this.slime.x,this.slime.y);
    if(d>95){ this.notice.setText('Move closer to attack.'); return; }
    this.slime.hp-=16; this.slime.setTintFill(0xffffff); this.time.delayedCall(100,()=>this.slime?.clearTint());
    this.tweens.add({targets:this.slime,scaleX:1.25,scaleY:.85,duration:80,yoyo:true});
    if(this.slime.hp<=0){
      const s=this.registry.get('gameState'); defeatSlime(s); this.registry.set('gameState',s); this.slime.destroy(); this.refreshHud();
      this.notice.setText('Slime defeated! +25 EXP + Slime Core. Return north.');
    } else this.notice.setText('Warrior hit! Slime HP '+this.slime.hp+'/48');
  }
  update(){
    const b=this.player.body, speed=180; b.setVelocity(0);
    const l=this.cursors.left.isDown||this.keys.A.isDown||this.touch.left,r=this.cursors.right.isDown||this.keys.D.isDown||this.touch.right,u=this.cursors.up.isDown||this.keys.W.isDown||this.touch.up,d=this.cursors.down.isDown||this.keys.S.isDown||this.touch.down;
    if(l)b.setVelocityX(-speed); if(r)b.setVelocityX(speed); if(u)b.setVelocityY(-speed); if(d)b.setVelocityY(speed); if(b.velocity.lengthSq())b.velocity.normalize().scale(speed);
    if(Phaser.Input.Keyboard.JustDown(this.keys.SPACE))this.attack();
    if(this.slime?.active){ const dist=Phaser.Math.Distance.Between(this.slime.x,this.slime.y,this.player.x,this.player.y); if(dist<250&&dist>68)this.physics.moveToObject(this.slime,this.player,48);else this.slime.body.setVelocity(0);
      if(dist<=72&&this.time.now-this.slime.lastAttack>1200){this.slime.lastAttack=this.time.now;const s=this.registry.get('gameState');damagePlayer(s,12);this.registry.set('gameState',s);this.player.setTintFill(0xff7777);this.time.delayedCall(120,()=>this.player?.clearTint());this.refreshHud();if(s.hp<=0){s.lastMessage='The Slime knocked you out.';this.scene.start('Town');}}
    }
    if(this.player.y<95)this.scene.start('Town');
  }
}
