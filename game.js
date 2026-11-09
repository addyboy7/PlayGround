(() => {
  'use strict';
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const $ = (id) => document.getElementById(id);
  const TILE = 32, WORLD_W = 220, WORLD_H = 42;
  const BLOCKS = {
    grass:{name:'عشب',color:'#83ad5e',icon:'▦',hard:0.38,drop:'dirt'}, dirt:{name:'تراب',color:'#a9784e',icon:'▪',hard:0.3},
    stone:{name:'حجر',color:'#87929a',icon:'◆',hard:0.85}, wood:{name:'خشب',color:'#bd8550',icon:'▥',hard:0.55},
    leaves:{name:'أوراق',color:'#76a85c',icon:'❋',hard:0.18}, sand:{name:'رمل',color:'#dfc47d',icon:'▨',hard:0.24}, coal:{name:'فحم',color:'#697276',icon:'⬟',hard:1.0},
    flower:{name:'زهرة',color:'#eaa5a0',icon:'✿',hard:0.12,drop:'flower'},
  };
  const SLOT_TYPES = ['dirt','wood','stone','sand','leaves'];
  const state = {running:false,paused:false,over:false,world:null,seed:0,inventory:{dirt:12,wood:5,stone:0,sand:0,leaves:0},selected:0,player:null,camera:{x:0,y:0},keys:{},pointer:{x:0,y:0,down:false,button:0,inside:false},mineTimer:0,hitProgress:0,hitTarget:'',enemies:[],particles:[],time:8,health:100,xp:0,level:1,woodQuest:0,elapsed:0,lastSave:0,toastTimer:0,sound:true,mutedContext:null,wasSaved:false};
  let width=0,height=0,dpr=1,last=0,frame=0;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const rand=(n)=>{let t=n+0x6D2B79F5;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};
  const hash=(x,y,s=state.seed)=>rand(Math.imul(x+1009,374761393)^Math.imul(y+71,668265263)^s);
  const label=(s)=>{ $('toast').textContent=s; $('toast').classList.add('show');state.toastTimer=2.1; };
  const resize=()=>{dpr=Math.min(devicePixelRatio||1,2);width=innerWidth;height=innerHeight;canvas.width=Math.floor(width*dpr);canvas.height=Math.floor(height*dpr);canvas.style.width=width+'px';canvas.style.height=height+'px';ctx.setTransform(dpr,0,0,dpr,0,0);};
  addEventListener('resize',resize);resize();
  function surfaceAt(x){return state.world?.surface[Math.floor(clamp(x,0,WORLD_W-1))]||23;}
  function idx(x,y){return y*WORLD_W+x;}
  function getBlock(x,y){if(!state.world||x<0||x>=WORLD_W||y<0||y>=WORLD_H)return null;return state.world.blocks[idx(x,y)];}
  function setBlock(x,y,type){if(x<0||x>=WORLD_W||y<0||y>=WORLD_H)return;state.world.blocks[idx(x,y)]=type;state.world.edits.set(idx(x,y),type);}
  function makeWorld(seed){
    state.seed=seed;const blocks=new Array(WORLD_W*WORLD_H).fill(null),surface=new Array(WORLD_W), edits=new Map();let h=24;
    for(let x=0;x<WORLD_W;x++){h+= (rand(seed+x*17)-.48)*.7;h=Math.round(clamp(h+Math.sin(x*.075)*.36,17,29));surface[x]=h;
      for(let y=h;y<WORLD_H;y++){let type=y===h?'grass':y<h+4?'dirt':'stone';if(y>h+3&&y<WORLD_H-2&&hash(x,y)<.045)type='coal';if(y>h+8&&hash(x+83,y)<.055)type=null;blocks[idx(x,y)]=type;}
      if(h>27){blocks[idx(x,h)]='sand';if(x>0&&surface[x-1]>27)blocks[idx(x-1,surface[x-1])]='sand';}
      if(x>4&&x<WORLD_W-4&&x<15===false&&rand(seed+x*31)>.89&&h<27){const trunk=3+Math.floor(rand(seed+x*11)*2);for(let t=1;t<=trunk;t++)blocks[idx(x,h-t)]='wood';for(let dy=-2;dy<=1;dy++)for(let dx=-2;dx<=2;dx++){if(Math.abs(dx)+Math.abs(dy)<4&&blocks[idx(x+dx,h-trunk+dy)]===null)blocks[idx(x+dx,h-trunk+dy)]='leaves';}}
      if(x>18&&rand(seed+x*53)>.955&&h<26)blocks[idx(x,h-1)]='flower';
    }
    state.world={blocks,surface,edits};
  }
  function newGame(){
    const seed=Math.floor(Math.random()*2147483000);makeWorld(seed);state.inventory={dirt:12,wood:5,stone:0,sand:0,leaves:0};state.selected=0;state.time=8;state.health=100;state.xp=0;state.level=1;state.woodQuest=0;state.elapsed=0;state.enemies=[];state.particles=[];state.over=false;
    const sx=10, sy=surfaceAt(sx)-1;state.player={x:sx*TILE,y:sy*TILE-28,w:20,h:28,vx:0,vy:0,onGround:false,face:1,anim:0,invuln:0};state.camera.x=0;state.camera.y=0;saveGame();updateHUD();
  }
  function saveGame(){try{const p=state.player;localStorage.setItem('wildblocks-save',JSON.stringify({seed:state.seed,edits:[...state.world.edits],inventory:state.inventory,x:p.x,y:p.y,time:state.time,health:state.health,xp:state.xp,level:state.level,woodQuest:state.woodQuest}));}catch(e){}}
  function loadGame(){try{const data=JSON.parse(localStorage.getItem('wildblocks-save'));if(!data)return false;makeWorld(data.seed);for(const [i,t] of data.edits||[])state.world.blocks[i]=t;state.world.edits=new Map(data.edits||[]);state.inventory={...state.inventory,...data.inventory};state.time=data.time||8;state.health=data.health??100;state.xp=data.xp||0;state.level=data.level||1;state.woodQuest=data.woodQuest||0;state.player={x:data.x||10*TILE,y:data.y||((surfaceAt(10)-1)*TILE-28),w:20,h:28,vx:0,vy:0,onGround:false,face:1,anim:0,invuln:0};state.camera.x=0;state.camera.y=0;updateHUD();return true;}catch(e){return false;}}
  function updateHUD(){
    const health=clamp(state.health,0,100);$('healthFill').style.width=health+'%';$('healthText').textContent=Math.round(health)+'%';$('xpText').textContent=state.xp;$('levelText').textContent=state.level;
    $('questCount').textContent=Math.min(state.woodQuest,5)+'/5';$('questFill').style.width=Math.min(100,state.woodQuest*20)+'%';$('objectiveText').textContent=state.woodQuest>=5?'أحسنت! استكشف العالم':'اجمع 5 قطع خشب';
    const hh=Math.floor(state.time)%24,mm=Math.floor((state.time%1)*60);$('clockLabel').textContent=(hh>=6&&hh<18?'☀':'☾')+' '+String(hh).padStart(2,'0')+':'+String(mm).padStart(2,'0');
    $('worldLabel').textContent='عالم #'+String(state.seed%10000).padStart(4,'0');
    renderHotbar();
  }
  function renderHotbar(){const bar=$('hotbar');bar.innerHTML='';SLOT_TYPES.forEach((type,i)=>{const slot=document.createElement('button');slot.className='slot'+(i===state.selected?' selected':'');slot.setAttribute('aria-label',BLOCKS[type].name+' '+(state.inventory[type]||0));slot.innerHTML=`<span class="slot-key">${i+1}</span><span class="slot-icon">${BLOCKS[type].icon}</span><span class="slot-count">${state.inventory[type]||''}</span>`;slot.onclick=()=>selectSlot(i);bar.appendChild(slot);});const type=SLOT_TYPES[state.selected];$('selectedName').textContent=BLOCKS[type].name;$('selectedCount').textContent='× '+(state.inventory[type]||0);$('selectedInfo').classList.add('show');}
  function selectSlot(i){state.selected=(i+SLOT_TYPES.length)%SLOT_TYPES.length;renderHotbar();}
  function addItem(type,n=1){if(!BLOCKS[type])return;const slot=SLOT_TYPES.includes(type)?type:'dirt';state.inventory[slot]=(state.inventory[slot]||0)+n;renderHotbar();}
  function awardXP(n){state.xp+=n;if(state.xp>=state.level*20){state.xp-=state.level*20;state.level++;state.health=Math.min(100,state.health+15);label('ارتقيت إلى المستوى '+state.level+'! +15 صحة');}updateHUD();}
  function onMined(type){let drop=BLOCKS[type]?.drop||type;if(type==='grass')drop='dirt';if(type==='coal'){drop='stone';addItem(drop,1);label('قطعة فحم ثمينة!');}else if(['dirt','stone','wood','leaves','sand'].includes(drop)){addItem(drop,1);if(drop==='wood'&&state.woodQuest<5){state.woodQuest++;updateHUD();if(state.woodQuest===5){awardXP(15);label('اكتملت المهمة! +15 XP');}}}if(type!=='leaves')awardXP(type==='wood'?2:1);}
  function collides(x,y,w,h){const x0=Math.floor(x/TILE),x1=Math.floor((x+w-1)/TILE),y0=Math.floor(y/TILE),y1=Math.floor((y+h-1)/TILE);for(let ty=y0;ty<=y1;ty++)for(let tx=x0;tx<=x1;tx++)if(getBlock(tx,ty))return true;return false;}
  function movePlayer(dt){const p=state.player;if(!p)return;const left=state.keys.ArrowLeft||state.keys.KeyA,right=state.keys.ArrowRight||state.keys.KeyD;let dir=(right?1:0)-(left?1:0);if(dir){p.vx+=dir*150*dt;p.face=dir;p.anim+=dt*10;}else p.vx*=Math.pow(.001,dt);p.vx=clamp(p.vx,-145,145);
    p.vy=Math.min(520,p.vy+900*dt);let nx=p.x+p.vx*dt;if(!collides(nx,p.y,p.w,p.h))p.x=nx;else{const sign=Math.sign(p.vx);while(Math.abs(p.vx)>1&&collides(p.x+sign,p.y,p.w,p.h)){p.vx-=sign*10;}p.vx=0;}
    let ny=p.y+p.vy*dt;p.onGround=false;if(!collides(p.x,ny,p.w,p.h))p.y=ny;else{const sign=Math.sign(p.vy);while(Math.abs(p.vy)>1&&collides(p.x,p.y+sign,p.w,p.h)){p.y+=sign;p.vy-=sign*12;}if(sign>0)p.onGround=true;p.vy=0;}
    p.x=clamp(p.x,0,(WORLD_W-1)*TILE);if(p.y>WORLD_H*TILE){state.health=0;}if(p.invuln>0)p.invuln-=dt;
    const targetX=p.x+p.w/2-width*.44,targetY=p.y+p.h/2-height*.57;state.camera.x+=(clamp(targetX,0,WORLD_W*TILE-width)-state.camera.x)*Math.min(1,dt*4);state.camera.y+=(clamp(targetY,0,WORLD_H*TILE-height)-state.camera.y)*Math.min(1,dt*4);
  }
  function jump(){const p=state.player;if(p&&p.onGround){p.vy=-365;p.onGround=false;}}
  function screenToTile(sx,sy){return{x:Math.floor((sx+state.camera.x)/TILE),y:Math.floor((sy+state.camera.y)/TILE)};}
  function targetTile(){if(state.pointer.inside)return screenToTile(state.pointer.x,state.pointer.y);const p=state.player;return{x:Math.floor((p.x+p.w/2+p.face*TILE*1.6)/TILE),y:Math.floor((p.y+p.h*.45)/TILE)};}
  function inReach(tx,ty){const p=state.player;return Math.hypot((tx+.5)*TILE-(p.x+p.w/2),(ty+.5)*TILE-(p.y+p.h/2))<TILE*5.2;}
  function mine(dt){if(!state.pointer.down||state.pointer.button===2&&state.pointer.inside)return;state.mineTimer-=dt;if(state.mineTimer>0)return;const t=targetTile();if(!inReach(t.x,t.y)){state.mineTimer=.25;return;}const enemy=state.enemies.find(e=>Math.abs(e.x+e.w/2-(t.x+.5)*TILE)<TILE*.8&&Math.abs(e.y-(t.y+1)*TILE)<TILE*1.2);if(enemy){enemy.hp--;state.mineTimer=.32;burst(enemy.x+enemy.w/2,enemy.y,'#b9ec78',5);if(enemy.hp<=0){state.enemies.splice(state.enemies.indexOf(enemy),1);awardXP(5);label('هُزم الوحل! +5 XP');}return;}
    const type=getBlock(t.x,t.y);if(!type){state.hitProgress=0;state.hitTarget='';state.mineTimer=.16;return;}const id=t.x+','+t.y;if(state.hitTarget!==id){state.hitTarget=id;state.hitProgress=0;}state.hitProgress+=.28/(BLOCKS[type]?.hard||.3);state.mineTimer=.16;
    if(state.hitProgress>=1){setBlock(t.x,t.y,null);onMined(type);burst((t.x+.5)*TILE,(t.y+.5)*TILE,BLOCKS[type].color,7);state.hitProgress=0;state.hitTarget='';state.mineTimer=.08;}
  }
  function place(){const t=targetTile(),type=SLOT_TYPES[state.selected],p=state.player;if(!inReach(t.x,t.y)||getBlock(t.x,t.y)||!state.inventory[type])return;const bx=t.x*TILE,by=t.y*TILE;if(bx<p.x+p.w&&bx+TILE>p.x&&by<p.y+p.h&&by+TILE>p.y)return;setBlock(t.x,t.y,type);state.inventory[type]--;renderHotbar();burst(bx+16,by+16,BLOCKS[type].color,4);}
  function burst(x,y,color,n){for(let i=0;i<n;i++)state.particles.push({x,y,vx:(Math.random()-.5)*95,vy:-Math.random()*100-20,life:.45+Math.random()*.35,color,size:2+Math.random()*4});}
  function spawnEnemy(){const p=state.player;if(state.enemies.length>=5)return;const dir=Math.random()<.5?-1:1,x=clamp(Math.floor(p.x/TILE)+dir*(9+Math.random()*8),2,WORLD_W-3),y=(surfaceAt(x)-1)*TILE;state.enemies.push({x:x*TILE,y,w:25,h:19,vx:0,vy:0,hp:2,dir:dir,phase:Math.random()*6,ground:false});}
  function updateEnemies(dt){const night=state.time<6||state.time>=19;if(night&&Math.random()<dt*.035)spawnEnemy();for(let i=state.enemies.length-1;i>=0;i--){const e=state.enemies[i],p=state.player;e.phase+=dt*4;const dir=Math.sign(p.x-e.x)||e.dir;e.vx=dir*34;e.vy=Math.min(400,e.vy+800*dt);const nx=e.x+e.vx*dt;if(!collides(nx,e.y,e.w,e.h))e.x=nx;else{e.vy=-220;e.dir=-dir;}const ny=e.y+e.vy*dt;if(!collides(e.x,ny,e.w,e.h))e.y=ny;else{if(e.vy>0)e.ground=true;e.vy=0;}if(Math.abs(p.x-e.x)<27&&Math.abs(p.y-e.y)<30&&p.invuln<=0){state.health=Math.max(0,state.health-12);p.invuln=.9;p.vy=-190;p.vx=p.x<e.x?-145:145;updateHUD();label('انتبه! أصابك الوحل');}if(Math.abs(e.x-p.x)>width*1.2)state.enemies.splice(i,1);}}
  function update(dt){if(!state.running||state.paused||state.over)return;state.elapsed+=dt;state.time=(state.time+dt*.025)%24;movePlayer(dt);mine(dt);updateEnemies(dt);for(let i=state.particles.length-1;i>=0;i--){const a=state.particles[i];a.life-=dt;a.x+=a.vx*dt;a.y+=a.vy*dt;a.vy+=220*dt;if(a.life<=0)state.particles.splice(i,1);}if(state.toastTimer>0){state.toastTimer-=dt;if(state.toastTimer<=0)$('toast').classList.remove('show');}if(state.elapsed-state.lastSave>8){saveGame();state.lastSave=state.elapsed;}if(Math.floor(state.elapsed)!==Math.floor(state.elapsed-dt))updateHUD();if(state.health<=0){state.over=true;$('gameOverScreen').classList.remove('hidden');}}

  function drawSky(){
    const hour=state.time,day=hour>=6&&hour<18,night=hour<5||hour>=20;let top,bottom;
    if(day){const dawn=hour<8?(hour-6)/2:hour>16?(18-hour)/2:1;top=`rgb(${Math.round(28+70*dawn)},${Math.round(61+108*dawn)},${Math.round(100+128*dawn)})`;bottom=`rgb(${Math.round(105+109*dawn)},${Math.round(140+95*dawn)},${Math.round(173+73*dawn)})`;}else if(night){top='#101b35';bottom='#344765';}else{const k=hour<6?hour/6:(24-hour)/6;top=`rgb(${35+Math.round(k*38)},${40+Math.round(k*73)},${75+Math.round(k*93)})`;bottom=`rgb(${80+Math.round(k*100)},${81+Math.round(k*113)},${116+Math.round(k*110)})`;}
    const g=ctx.createLinearGradient(0,0,0,height);g.addColorStop(0,top);g.addColorStop(1,bottom);ctx.fillStyle=g;ctx.fillRect(0,0,width,height);
    if(night){for(let i=0;i<80;i++){const x=((i*193.7-state.camera.x*.08)%width+width)%width,y=(i*67.3)%Math.max(1,height*.66);ctx.globalAlpha=.35+hash(i,8)*.55;ctx.fillStyle='#fff4d1';ctx.fillRect(x,y,hash(i,9)>0.8?2:1,hash(i,10)>0.8?2:1);}ctx.globalAlpha=1;}
    const celestial=(hour/24)*Math.PI*2-Math.PI/2,cx=width*.5+Math.cos(celestial)*width*.36,cy=height*.55-Math.sin(celestial)*height*.40;ctx.fillStyle=day?'#ffe9a8':'#e4e6d3';ctx.beginPath();ctx.arc(cx,cy,day?19:15,0,Math.PI*2);ctx.fill();ctx.globalAlpha=.16;ctx.beginPath();ctx.arc(cx,cy,day?34:29,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
    drawMountains(.13,'#5d8190',height*.60,90);drawMountains(.24,'#365b67',height*.69,125);
    for(let i=0;i<6;i++){const x=((i*267-state.camera.x*.16+state.elapsed*6)%(width+220))-110,y=height*(.18+(i%3)*.10);drawCloud(x,y,.65+(i%3)*.15);}
  }
  function drawMountains(factor,color,base,amp){ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(0,height);for(let x=0;x<=width+30;x+=30){const wx=(x+state.camera.x*factor)*.003;const yy=base-Math.sin(wx)*amp-Math.sin(wx*2.7+1)*amp*.3;ctx.lineTo(x,yy);}ctx.lineTo(width,height);ctx.closePath();ctx.globalAlpha=.75;ctx.fill();ctx.globalAlpha=1;}
  function drawCloud(x,y,s){ctx.fillStyle='rgba(245,239,215,.18)';ctx.fillRect(x,y,80*s,14*s);ctx.fillRect(x+12*s,y-9*s,25*s,12*s);ctx.fillRect(x+38*s,y-6*s,28*s,10*s);}
  function drawBlock(type,x,y,tx,ty){const b=BLOCKS[type];if(!b)return;const variations=hash(tx,ty),dark=(hash(tx+8,ty)-.5)*12;ctx.fillStyle=b.color;ctx.fillRect(x,y,TILE,TILE);
    if(type==='grass'){ctx.fillStyle='#6b9b52';ctx.fillRect(x,y,TILE,7);ctx.fillStyle='#a5c974';for(let j=0;j<4;j++)ctx.fillRect(x+2+j*8,y+1,3,2);ctx.fillStyle='#9d714c';ctx.fillRect(x,y+7,TILE,2);}
    if(type==='dirt'||type==='sand'||type==='stone'||type==='coal'){const base=type==='dirt'?'#765237':type==='sand'?'#bd9c58':type==='stone'?'#626c73':'#3e474b';for(let n=0;n<5;n++){const px=3+Math.floor(hash(tx+n*7,ty+n*3)*25),py=4+Math.floor(hash(tx+n*5,ty+n*9)*25);ctx.fillStyle=n%2?'rgba(255,230,180,.2)':'rgba(32,42,45,.18)';ctx.fillRect(x+px,y+py,2+(n%2),2);}if(type==='coal'){ctx.fillStyle='#30383a';ctx.fillRect(x+8,y+8,7,5);ctx.fillRect(x+18,y+18,6,8);ctx.fillStyle='#a0a9a7';ctx.fillRect(x+10,y+8,4,2);}}
    if(type==='wood'){ctx.fillStyle='#885c3a';ctx.fillRect(x+5,y,3,TILE);ctx.fillRect(x+23,y,3,TILE);ctx.fillStyle='#d5a56a';ctx.fillRect(x+11,y,2,TILE);ctx.fillStyle='rgba(60,40,28,.32)';ctx.fillRect(x,y+6,TILE,2);ctx.fillRect(x,y+24,TILE,2);}
    if(type==='leaves'){ctx.fillStyle='rgba(183,218,118,.35)';for(let n=0;n<7;n++){const px=hash(tx+n,ty+3)*27,py=hash(ty+n,tx+4)*27;ctx.fillRect(x+px,y+py,4,4);}ctx.fillStyle='rgba(36,83,50,.28)';ctx.fillRect(x,y+27,TILE,5);}
    if(type==='flower'){ctx.fillStyle='#5e994c';ctx.fillRect(x+15,y+9,3,23);ctx.fillStyle='#ffd6a2';ctx.fillRect(x+10,y+8,12,4);ctx.fillRect(x+14,y+3,4,13);ctx.fillStyle='#d779a0';ctx.fillRect(x+13,y+8,6,5);}
    ctx.fillStyle=`rgba(18,25,24,${.04+variations*.07})`;ctx.fillRect(x,y,TILE,TILE);ctx.strokeStyle='rgba(25,34,37,.24)';ctx.lineWidth=1;ctx.strokeRect(x+.5,y+.5,TILE-1,TILE-1);
    if(type==='grass'){ctx.fillStyle='rgba(190,223,135,.4)';ctx.fillRect(x+1,y+1,TILE-2,1);}
  }
  function drawPlayer(){const p=state.player;if(!p)return;const x=Math.round(p.x-state.camera.x),y=Math.round(p.y-state.camera.y);ctx.save();if(p.invuln>0&&Math.floor(p.invuln*14)%2)ctx.globalAlpha=.45;
    const moving=Math.abs(p.vx)>8,leg=moving?Math.sin(p.anim)*3:0;ctx.fillStyle='rgba(12,21,30,.24)';ctx.fillRect(x-4,y+p.h+1,28,4);
    ctx.fillStyle='#39485d';ctx.fillRect(x+2,y+18,7,10+Math.max(0,leg));ctx.fillRect(x+11,y+18,7,10+Math.max(0,-leg));ctx.fillStyle='#334155';ctx.fillRect(x+1,y+24+Math.max(0,leg),9,4);ctx.fillRect(x+10,y+24+Math.max(0,-leg),10,4);
    ctx.fillStyle='#d49166';ctx.fillRect(x+2,y+5,16,15);ctx.fillStyle='#f0bd91';ctx.fillRect(x+4,y+2,13,13);ctx.fillStyle='#604637';ctx.fillRect(x+3,y,14,5);ctx.fillRect(x+1,y+3,4,5);ctx.fillStyle='#273442';ctx.fillRect(x+(p.face>0?12:5),y+7,2,3);ctx.fillRect(x+(p.face>0?8:12),y+14,4,1);
    ctx.fillStyle='#5a9a90';ctx.fillRect(x+1,y+16,18,4);ctx.fillStyle='#78b3a5';ctx.fillRect(x+2,y+16,16,2);ctx.fillStyle='#7d6048';ctx.fillRect(x+(p.face>0?17:0),y+16,4,8);ctx.restore();
  }
  function drawEnemy(e){const x=Math.round(e.x-state.camera.x),y=Math.round(e.y-state.camera.y+Math.sin(e.phase)*2);ctx.fillStyle='rgba(12,21,30,.2)';ctx.fillRect(x-2,y+e.h,29,3);ctx.fillStyle='#76b956';ctx.fillRect(x+2,y+6,21,12);ctx.fillRect(x+5,y+2,15,7);ctx.fillStyle='#9bd56e';ctx.fillRect(x+6,y+3,12,4);ctx.fillStyle='#314a43';ctx.fillRect(x+7,y+9,3,4);ctx.fillRect(x+16,y+9,3,4);ctx.fillStyle='#d9efd0';ctx.fillRect(x+8,y+9,1,1);ctx.fillRect(x+17,y+9,1,1);ctx.fillStyle='#528a4d';ctx.fillRect(x+5,y+17,4,2);ctx.fillRect(x+17,y+17,4,2);}
  function render(){if(!state.world){ctx.fillStyle='#162b43';ctx.fillRect(0,0,width,height);return;}drawSky();const x0=Math.max(0,Math.floor(state.camera.x/TILE)-1),x1=Math.min(WORLD_W-1,Math.ceil((state.camera.x+width)/TILE)+1),y0=Math.max(0,Math.floor(state.camera.y/TILE)-1),y1=Math.min(WORLD_H-1,Math.ceil((state.camera.y+height)/TILE)+1);
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const type=getBlock(x,y);if(type)drawBlock(type,Math.round(x*TILE-state.camera.x),Math.round(y*TILE-state.camera.y),x,y);}
    for(const e of state.enemies)drawEnemy(e);drawPlayer();
    for(const a of state.particles){ctx.globalAlpha=clamp(a.life*2,0,1);ctx.fillStyle=a.color;ctx.fillRect(a.x-state.camera.x,a.y-state.camera.y,a.size,a.size);ctx.globalAlpha=1;}
    if(state.running&&!state.paused&&!state.over){const t=targetTile(),rx=t.x*TILE-state.camera.x,ry=t.y*TILE-state.camera.y,type=getBlock(t.x,t.y),valid=inReach(t.x,t.y);if(rx>-TILE&&rx<width&&ry>-TILE&&ry<height){ctx.strokeStyle=valid?'rgba(255,226,160,.8)':'rgba(255,255,255,.25)';ctx.lineWidth=2;ctx.strokeRect(Math.round(rx)+1,Math.round(ry)+1,TILE-2,TILE-2);if(type&&state.hitTarget===t.x+','+t.y&&state.hitProgress>0){ctx.fillStyle=`rgba(10,18,27,${state.hitProgress*.55})`;ctx.fillRect(rx,ry,TILE,TILE);ctx.strokeStyle='#ffe28e';ctx.lineWidth=3;ctx.beginPath();ctx.arc(rx+16,ry+16,11,-Math.PI/2,-Math.PI/2+Math.PI*2*state.hitProgress);ctx.stroke();}}}
    if(!((state.time>=6&&state.time<18))){const darkness=state.time<5||state.time>=20?.30:.13;ctx.fillStyle=`rgba(14,24,53,${darkness})`;ctx.fillRect(0,0,width,height);}
    if(state.player){const tx=Math.floor((state.player.x+state.player.w/2)/TILE),ty=Math.floor((state.player.y+state.player.h)/TILE);$('coords').textContent='X '+tx+'  ·  Y '+ty;}
  }
  function loop(now){const dt=Math.min(.04,(now-last)/1000||0);last=now;update(dt);render();frame=requestAnimationFrame(loop);}
  let audioCtx=null;
  function tone(freq=440,duration=.08,wave='sine'){if(!state.sound)return;try{audioCtx ||= new (window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume();const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type=wave;o.frequency.value=freq;g.gain.setValueAtTime(.055,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+duration);o.connect(g);g.connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+duration);}catch(e){}}
  function begin(){if(!state.world){if(!loadGame())newGame();}state.running=true;state.paused=false;$('startScreen').classList.add('hidden');$('pauseScreen').classList.add('hidden');tone(520,.12,'triangle');}
  function togglePause(){if(!state.running||state.over)return;state.paused=!state.paused;$('pauseScreen').classList.toggle('hidden',!state.paused);if(state.paused)saveGame();}
  $('playBtn').addEventListener('click',begin);$('resumeBtn').addEventListener('click',togglePause);$('pauseBtn').addEventListener('click',togglePause);
  $('restartBtn').addEventListener('click',()=>{newGame();state.running=true;state.paused=false;$('pauseScreen').classList.add('hidden');label('بدأ عالم جديد. رحلتك تبدأ الآن!');});
  $('againBtn').addEventListener('click',()=>{newGame();state.running=true;state.over=false;$('gameOverScreen').classList.add('hidden');});
  $('soundBtn').addEventListener('click',()=>{state.sound=!state.sound;$('soundBtn').classList.toggle('active',!state.sound);$('soundBtn').textContent=state.sound?'♪':'×';if(state.sound)tone(620,.08);});
  addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp','Space'].includes(e.code))e.preventDefault();state.keys[e.code]=true;if(e.repeat)return;if(e.code==='Space'||e.code==='ArrowUp'||e.code==='KeyW')jump();if(/^Digit[1-5]$/.test(e.code))selectSlot(Number(e.code.slice(-1))-1);if(e.code==='Escape')togglePause();if(e.code==='KeyF'){const tips=['الخشب أساس كل بناء جيد','كل كتلة تُكسر تمنحك خبرة','الأوحال تظهر بعد حلول الليل','ضع الكتل قربك لبناء جسر'];const i=Math.floor(state.elapsed/3)%tips.length;$('tipText').textContent=tips[i];label(tips[i]);}if(e.code==='KeyX'){state.pointer.down=true;state.pointer.inside=false;setTimeout(()=>state.pointer.down=false,220);}});
  addEventListener('keyup',e=>{state.keys[e.code]=false;});
  canvas.addEventListener('pointermove',e=>{const r=canvas.getBoundingClientRect();state.pointer.x=e.clientX-r.left;state.pointer.y=e.clientY-r.top;state.pointer.inside=e.pointerType==='mouse';});
  canvas.addEventListener('pointerdown',e=>{if(e.button===2){e.preventDefault();state.pointer.x=e.offsetX;state.pointer.y=e.offsetY;state.pointer.inside=true;place();return;}if(e.button!==0)return;state.pointer.down=true;if(e.pointerType==='mouse'){state.pointer.x=e.offsetX;state.pointer.y=e.offsetY;state.pointer.inside=true;}canvas.setPointerCapture?.(e.pointerId);});
  addEventListener('pointerup',()=>{state.pointer.down=false;});canvas.addEventListener('contextmenu',e=>e.preventDefault());
  document.querySelectorAll('[data-control]').forEach(button=>{const control=button.dataset.control;button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture?.(e.pointerId);if(control==='left')state.keys.KeyA=true;if(control==='right')state.keys.KeyD=true;if(control==='jump')jump();if(control==='mine'){state.pointer.down=true;state.pointer.inside=false;}if(control==='place')place();});const release=()=>{if(control==='left')state.keys.KeyA=false;if(control==='right')state.keys.KeyD=false;if(control==='mine')state.pointer.down=false;};button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',release);});
  if(!loadGame())newGame();
  updateHUD();requestAnimationFrame(loop);
})();

