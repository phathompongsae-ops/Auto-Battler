import Phaser from 'phaser';
import { acceptStarterQuest, completeStarterQuest, createGameState, respawnPlayer } from '../game/state.js';

export class TownScene extends Phaser.Scene {
  constructor(){super('Town');}
  preload(){this.load.svg('hero','./assets/characters/hero.svg');this.load.svg('elder','./assets/npc/elder.svg');this.load.svg('tree','./assets/props/tree.svg');}
  create(){
    if(!this.registry.get('gameState'))this.registry.set('gameState',createGameState());
    const s=this.registry.get('gameState'); if(s.hp<=0)respawnPlayer(s);
    this.physics.world.setBounds(0,0,1400,900);this.cameras.main.setBounds(0,0,1400,900);this.cameras.main.setBackgroundColor('#6ea867');
    this.add.rectangle(700,450,150,900,0xc9b27c).setDepth(-3);this.add.rectangle(700,420,480,250,0xd7c58f).setDepth(-2);
    for(const [x,y] of [[180,140],[280,700],[1120,160],[1220,700],[350,170],[1030,650]])this.add.image(x,y,'tree').setDepth(y);
    for(const [x,y] of [[470,260],[930,260],[470,600],[930,600]]){this.add.rectangle(x,y,220,125,0x80513d).setStrokeStyle(8,0x493228).setDepth(y);this.add.triangle(x,y-80,0,80,110,0,220,80,0xa9684f).setDepth(y);}
    this.player=this.physics.add.sprite(700,540,'hero').setScale(1.15).setCollideWorldBounds(true);
    this.elder=this.physics.add.staticSprite(700,360,'elder').setScale(1.1);this.physics.add.collider(this.player,this.elder);
    this.cameras.main.startFollow(this.player,true,.14,.14);this.cameras.main.setRoundPixels(true);
    this.keys=this.input.keyboard.addKeys('W,A,S,D,E');this.cursors=this.input.keyboard.createCursorKeys();this.touch={up:false,down:false,left:false,right:false};this.createTouchControls();
    this.hud=this.add.text(18,18,'',{fontSize:'15px',color:'#fff',backgroundColor:'#0009',padding:{x:10,y:8}}).setScrollFactor(0).setDepth(50);
    this.notice=this.add.text(18,96,'E / INTERACT near Elder Rowan. South gate leads to the meadow.',{fontSize:'14px',color:'#fff',backgroundColor:'#0009',padding:{x:9,y:6}}).setScrollFactor(0).setDepth(50);this.refreshHud();
  }
  refreshHud(){const s=this.registry.get('gameState');const q={not_started:'Speak with Elder Rowan',accepted:'Defeat the Meadow Slime',ready_to_turn_in:'Return the Slime Core',complete:'Meadow Slime cleared'}[s.starterQuest];this.hud.setText(`Willowbrook - Starter Town\nWarrior Lv.${s.level}  HP ${s.hp}/${s.maxHp}  EXP ${s.exp}/${s.expToNext}  Gold ${s.gold}\nQuest: ${q}`);}
  interact(){const s=this.registry.get('gameState');if(Phaser.Math.Distance.Between(this.player.x,this.player.y,this.elder.x,this.elder.y)>100){this.notice.setText('Move closer to Elder Rowan.');return;}if(s.starterQuest==='not_started')acceptStarterQuest(s);else if(s.starterQuest==='ready_to_turn_in')completeStarterQuest(s);else s.lastMessage=s.starterQuest==='accepted'?'Elder Rowan: Find the Slime beyond the south gate.':'Elder Rowan: Thank you, Warrior.';this.registry.set('gameState',s);this.refreshHud();this.notice.setText(s.lastMessage);}
  createTouchControls(){const mk=(x,y,t)=>this.add.text(x,y,t,{fontSize:'24px',color:'#fff',backgroundColor:'#0008',padding:{x:12,y:8}}).setScrollFactor(0).setDepth(60).setInteractive();const bind=(o,k)=>{o.on('pointerdown',()=>this.touch[k]=true);o.on('pointerup',()=>this.touch[k]=false);o.on('pointerout',()=>this.touch[k]=false);};bind(mk(92,410,'▲'),'up');bind(mk(92,485,'▼'),'down');bind(mk(28,450,'◀'),'left');bind(mk(154,450,'▶'),'right');mk(785,458,'INTERACT').on('pointerdown',()=>this.interact());}
  update(){const b=this.player.body,speed=175;b.setVelocity(0);const l=this.cursors.left.isDown||this.keys.A.isDown||this.touch.left,r=this.cursors.right.isDown||this.keys.D.isDown||this.touch.right,u=this.cursors.up.isDown||this.keys.W.isDown||this.touch.up,d=this.cursors.down.isDown||this.keys.S.isDown||this.touch.down;if(l)b.setVelocityX(-speed);if(r)b.setVelocityX(speed);if(u)b.setVelocityY(-speed);if(d)b.setVelocityY(speed);if(b.velocity.lengthSq())b.velocity.normalize().scale(speed);if(Phaser.Input.Keyboard.JustDown(this.keys.E))this.interact();const s=this.registry.get('gameState');if(this.player.y>825&&s.starterQuest!=='not_started')this.scene.start('Field');}
}
