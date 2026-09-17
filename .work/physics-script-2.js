'use strict';
const $=id=>document.getElementById(id);
const TYPES={soldier:{name:'SQUAD',cost:40,desc:'8 soldiers · one shot each · 4% HQ damage'},tank:{name:'TANK',cost:50,desc:'Advance 2 · range 2 · explosive shell'},mg:{name:'MACHINE GUN',cost:40,desc:'10 bullets · assigned column'},holegun:{name:'HOLE GUN',cost:40,desc:'Fresh small hole · 2% HQ damage'},mortar:{name:'MORTAR',cost:200,desc:'10% HQ · nearby target · splash'}};
const MAXHP=100,MAXLEVEL=10,REROLL=2;
let view,s,drag=null,hover=null,aimStart=null,cardSignature='',last=0;
try{view=new HoleDrift3D($('game'));}catch(error){$('hint').textContent='3D could not start. Enable WebGL in your browser and reload.';throw error;}
const icons=Object.fromEntries(Object.keys(TYPES).map(k=>[k,view.icon(k)]));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),rand=a=>a[Math.floor(Math.random()*a.length)];
const count=p=>p.remaining;
// Constrained rigid bodies: gravity and contacts on Y; X/Z and rotation never change.
// Even the quarter-cell hole-gun aperture can contain the diagonal of one brick.
const GOLD_SIZE=Object.freeze({w:.14,d:.18,h:.12});
const FALL_GRAVITY=18,FALL_STEP=1/180,ENTRY_DEPTH=.012,COLLECT_DEPTH=.045;

function footprintsOverlap(a,b){
 const dx=b.x-a.x,dz=b.z-a.z;
 for(const [x,z]of [[a.c,-a.sn],[a.sn,a.c],[b.c,-b.sn],[b.sn,b.c]]){
  const ra=Math.abs(x*a.c-z*a.sn)*a.w/2+Math.abs(x*a.sn+z*a.c)*a.d/2;
  const rb=Math.abs(x*b.c-z*b.sn)*b.w/2+Math.abs(x*b.sn+z*b.c)*b.d/2;
  if(Math.abs(dx*x+dz*z)>=ra+rb-.001)return false;
 }
 return true;
}
function prepareBrickBodies(p){
 p.bricks=[];p.remaining=0;
 // Replace each old decorative ingot with a tightly packed set of identical bodies.
 // Layout tiers are sampled ONCE. Removing a brick never repositions any other brick.
 for(const tile of p.layout){
  const nx=Math.max(1,Math.floor((tile.w+.008)/(GOLD_SIZE.w+.008)));
  const nz=Math.max(1,Math.floor((tile.d+.008)/(GOLD_SIZE.d+.008)));
  const c=Math.cos(tile.angle),sn=Math.sin(tile.angle);
  for(let level=0;level<tile.levels.length;level++)for(let iy=0;iy<2;iy++)for(let iz=0;iz<nz;iz++)for(let ix=0;ix<nx;ix++){
   const dx=(ix-(nx-1)/2)*(GOLD_SIZE.w+.008),dz=(iz-(nz-1)/2)*(GOLD_SIZE.d+.008),v=tile.levels[level];
   const b={id:s.nextId++,x:p.x+v.x+dx*c+dz*sn,z:p.z+v.z-dx*sn+dz*c,
    y:(level*2+iy)*GOLD_SIZE.h,vy:0,w:GOLD_SIZE.w,d:GOLD_SIZE.d,h:GOLD_SIZE.h,
    angle:tile.angle,c,sn,removed:false,falling:false,capture:null,supports:[]};
   const half=brickHalfBounds(b);b.hx=half.x;b.hz=half.z;
   if(b.z-b.hz<CLEAR_ROWS-1e-6||b.z+b.hz>PILE_MAX_Z+1e-6||b.x-b.hx<.18||b.x+b.hx>7.82)continue;
   if(s.units.some(u=>brickTouchesRect(b,u.x,u.z,...dims(u))))continue;
   p.bricks.push(b);
  }
 }
 p.bricks.sort((a,b)=>a.y-b.y||a.id-b.id);
 // A spatial hash builds immutable support candidates, including lower tiers that
 // become reachable later. There are no pairwise collision searches during a frame.
 const cells=new Map(),cell=.25;
 const keys=b=>{const out=[];for(let z=Math.floor((b.z-b.hz)/cell);z<=Math.floor((b.z+b.hz)/cell);z++)for(let x=Math.floor((b.x-b.hx)/cell);x<=Math.floor((b.x+b.hx)/cell);x++)out.push(x+':'+z);return out;};
 for(let i=0;i<p.bricks.length;i++){
  const b=p.bricks[i],ks=keys(b),candidates=new Set();
  for(const key of ks)for(const j of cells.get(key)||[])candidates.add(j);
  for(const j of candidates){const other=p.bricks[j];if(other.y+other.h<=b.y+.0001&&footprintsOverlap(b,other))b.supports.push(j);}
  for(const key of ks){if(!cells.has(key))cells.set(key,[]);cells.get(key).push(i);}
 }
 // Settle unsupported overhangs during construction, before the board is shown.
 for(const b of p.bricks){let floor=0;for(const i of b.supports)floor=Math.max(floor,p.bricks[i].y+p.bricks[i].h);b.y=floor;}
 p.remaining=p.bricks.length;
}
function activeApertures(){
 const holes=[];
 if(s.phase==='drift')holes.push({h:s.hole,side:s.side,main:true});
 if(s.phase!=='over')for(const h of s.holeShots)holes.push({h,side:h.side,main:false});
 return holes;
}
function fitsAperture(body,h){
 // Full rectangle containment, not a touching edge or center-point shortcut.
 const c=body.c??Math.cos(body.angle||0),sn=body.sn??Math.sin(body.angle||0);
 const dx=body.x-h.x,dz=body.z-h.z,r=Math.max(0,h.r-.003),rr=r*r;
 if(dx*dx+dz*dz>rr)return false;
 for(const sx of [-1,1])for(const sz of [-1,1]){
  const x=dx+sx*body.w/2*c+sz*body.d/2*sn,z=dz-sx*body.w/2*sn+sz*body.d/2*c;
  if(x*x+z*z>rr)return false;
 }
 return true;
}
function apertureFor(body,holes,unit=null){
 for(const aperture of holes){
  // A gun's outgoing projectile must not swallow its own firing platform.
  if(unit&&aperture.h.owner===unit)continue;
  if(fitsAperture(body,aperture.h))return aperture;
 }
 return null;
}
function captureCredit(aperture){return {side:aperture.side,main:aperture.main,holeId:aperture.h.id,ownerId:aperture.h.owner?.id};}
function creditFall(credit,n,pos){
 if(!credit)return;
 earn(n,credit.side,pos,credit.main&&s.hole.id===credit.holeId);
 if(!credit.main){
  const shot=s.holeShots.find(h=>h.id===credit.holeId);
  if(shot){shot.eaten+=n;shot.r=Math.min(.5,shot.r+n*.012);}
  const owner=s.units.find(u=>u.id===credit.ownerId);if(owner)owner.fed=(owner.fed||0)+n;
 }
}
function removeBrick(p,b,side=null){
 if(b.removed)return false;b.removed=true;b.falling=false;p.remaining--;
 if(side!==null)earn(1,side,{x:b.x,z:b.z});
 return true;
}
function advanceBrickPhysics(dt,holes){
 for(const p of s.piles){
  if(!p.remaining)continue;
  for(const b of p.bricks){
   if(b.removed)continue;
   if(b.capture){
    b.vy-=FALL_GRAVITY*dt;b.y+=b.vy*dt;b.falling=true;
    if(b.y+b.h<=-COLLECT_DEPTH){removeBrick(p,b);creditFall(b.capture,1,{x:b.x,z:b.z});}
    continue;
   }
   const aperture=apertureFor(b,holes);
   let floor=aperture?-Infinity:0,floorVelocity=0;
   for(const i of b.supports){const below=p.bricks[i];if(!below.removed&&!below.capture&&below.y+below.h>floor){floor=below.y+below.h;floorVelocity=below.vy;}}
   if(b.y<=floor+.00001&&b.vy===0){b.y=floor;b.falling=false;continue;}
   b.vy-=FALL_GRAVITY*dt;const next=b.y+b.vy*dt;
   if(next<=floor){b.y=floor;b.vy=Math.min(0,floorVelocity);b.falling=b.vy<0;}
   else{b.y=next;b.falling=true;}
   // Commit only after an unsupported body has physically crossed the rim.
   // If the aperture leaves sooner, the returning ground catches this body.
   if(aperture&&b.y<=-ENTRY_DEPTH){b.capture=captureCredit(aperture);b.falling=true;}
  }
 }
}
function unitBody(u){
 const [w,d]=dims(u);
 // The existing gameplay footprint controls fit; the complete model height
 // controls how far the unit must sink before it can be collected.
 const height={soldier:.46,tank:.34,mg:.8,mortar:1.13,holegun:.45,wall:.55}[u.type]||1;
 return {x:u.x,z:u.z,w,d,h:height,angle:0,c:1,sn:0};
}
function advanceUnitPhysics(dt,holes){
 for(const u of [...s.units]){
  u.y??=0;u.vy??=0;const body=unitBody(u);
  if(u.capture){
   u.vy-=FALL_GRAVITY*dt;u.y+=u.vy*dt;u.falling=true;
   if(u.y+body.h<=-COLLECT_DEPTH){
    s.units=s.units.filter(v=>v!==u);
    const amount=u.type==='soldier'?TYPES.soldier.cost/16:(TYPES[u.type]?.cost||0)/2;
    creditFall(u.capture,amount,{x:u.x,z:u.z});
   }
   continue;
  }
  const aperture=apertureFor(body,holes,u);
  if(!aperture&&u.y<=0){u.y=0;u.vy=0;u.falling=false;continue;}
  u.vy-=FALL_GRAVITY*dt;u.y+=u.vy*dt;u.falling=true;
  if(!aperture&&u.y<=0){u.y=0;u.vy=0;u.falling=false;}
  if(aperture&&u.y<=-ENTRY_DEPTH){u.capture=captureCredit(aperture);u.falling=true;}
 }
}
function advanceFalling(dt){const holes=activeApertures();advanceBrickPhysics(dt,holes);advanceUnitPhysics(dt,holes);}
function hasFallingBodies(){return s.units.some(u=>u.falling)||s.piles.some(p=>p.remaining&&p.bricks.some(b=>!b.removed&&b.falling));}

const GROWTH=[0,25,75,160,300,500,800,1200,1750,2500],UPGRADE_PRICES=[20,80,200,450,800,1300,2000,3000,4500];
// Main hole has ten levels; radius caps at one big cell.
const radius=level=>.28+.08*Math.max(0,Math.min(9,level-1));
function growthLevel(eaten,start=1){const total=GROWTH[start-1]+eaten;let level=1;while(level<MAXLEVEL&&total>=GROWTH[level])level++;return level;}
const upgradeCost=side=>UPGRADE_PRICES[s.upgrades[side]]??Infinity;
function resetHole(){const level=1+s.upgrades[s.side],r=radius(level);s.hole={id:s.nextId++,x:4,z:s.side?r:10-r,r,level,eaten:0,vx:0,vz:0};s.bounces=0;}
function dims(u){return u.type==='soldier'?[.25,.5]:(u.type==='tank'||u.type==='holegun')?[.5,.5]:[1,1];}
// Each pile owns freely positioned, rotated stacks. Every gold bar remains collectible.
// The complete footprint is restricted to z=2..8, preserving two rows at EACH HQ.
const CLEAR_ROWS=2,PILE_MAX_Z=10-CLEAR_ROWS;

function brickHalfBounds(b){const c=Math.abs(Math.cos(b.angle)),n=Math.abs(Math.sin(b.angle));return {x:(c*b.w+n*b.d)/2,z:(n*b.w+c*b.d)/2};}
function brickLocal(b,x,z){const c=Math.cos(b.angle),n=Math.sin(b.angle),dx=x-b.x,dz=z-b.z;return {x:dx*c-dz*n,z:dx*n+dz*c};}
function brickTouchesRect(b,x,z,w,d){
 const dx=x-b.x,dz=z-b.z,c=Math.cos(b.angle),n=Math.sin(b.angle),ac=Math.abs(c),an=Math.abs(n);
 return Math.abs(dx)<w/2+ac*b.w/2+an*b.d/2-.001&&Math.abs(dz)<d/2+an*b.w/2+ac*b.d/2-.001&&Math.abs(dx*c-dz*n)<b.w/2+ac*w/2+an*d/2-.001&&Math.abs(dx*n+dz*c)<b.d/2+an*w/2+ac*d/2-.001;
}
function pileLayout(shape){
 const layout=[];
 const add=(x,z,n,w=.29,d=.46,angle=0)=>layout.push({x,z,n,w,d,angle});
 if(shape==='round'){
  add(0,0,5,.31,.49,.12);
  for(let ring=1;ring<=2;ring++){const amount=ring===1?6:10,r=ring===1?.34:.67;for(let j=0;j<amount;j++){const a=j/amount*Math.PI*2;add(Math.sin(a)*r,Math.cos(a)*r,ring===1?3:2,ring===1?.32:.39,.36,a);}}
 }else if(shape==='crescent'){
  for(let row=0;row<3;row++)for(let col=0;col<5;col++){if(row===2&&col<2)continue;add((col-2)*.315,(row-1)*.455,2+((col+row)%3===0?2:0),.29,.43,0);}
 }else if(shape==='ridge'){
  for(let row=0;row<2;row++)for(let col=0;col<5;col++)add((col-2)*.315,(row-.5)*.46,2+(row===0?1:0)+(col===2?1:0));
 }else if(shape==='small'){
  for(let row=0;row<2;row++)for(let col=0;col<3;col++)add((col-1)*.31,(row-.5)*.45,col===1?4:2);
 }else if(shape==='scatter'){
  for(let row=0;row<3;row++)for(let col=0;col<4;col++){if((row===0&&col===3)||(row===2&&col===0))continue;add((col-1.5)*.34+(row===1?.055:0),(row-1)*.46,2+(col+row)%3,.29,.43,(row===0?.09:-.045));}
 }else{
  // Offset each smaller tier by half a bar, like a real stack of ingots.
  // Stable supporting columns preserve bottom collection and top-down gunfire.
  for(let row=0;row<3;row++)for(let col=0;col<5;col++){add((col-2)*.31,(row-1)*.455,2);const b=layout.at(-1);b.levels=[{x:b.x,z:b.z},{x:b.x,z:b.z}];}
  let supports=layout.slice().sort((a,b)=>Math.hypot(a.x,a.z)-Math.hypot(b.x,b.z));
  for(const [cols,rows]of [[4,2],[3,2],[2,2],[1,2],[1,1]]){
   supports=supports.slice(0,cols*rows);
   const ordered=supports.slice().sort((a,b)=>a.z-b.z||a.x-b.x);
   ordered.forEach((b,i)=>{b.n++;b.levels.push({x:(i%cols-(cols-1)/2)*.31,z:(Math.floor(i/cols)-(rows-1)/2)*.455});});
  }
 }
 return layout;
}
function createPile(x,z,shape,angle=0){
 const c=Math.cos(angle),n=Math.sin(angle),transform=v=>({x:(v.x*c+v.z*n)*1.18,z:(-v.x*n+v.z*c)*1.12});
 const layout=pileLayout(shape).map(b=>({...b,...transform(b),levels:(b.levels||Array.from({length:b.n},()=>({x:b.x,z:b.z}))).map(transform),w:b.w*1.18,d:b.d*1.12,angle:b.angle+angle}));
 let x0=Infinity,x1=-Infinity,z0=Infinity,z1=-Infinity;
 for(const b of layout){const h=brickHalfBounds(b);x0=Math.min(x0,b.x-h.x);x1=Math.max(x1,b.x+h.x);z0=Math.min(z0,b.z-h.z);z1=Math.max(z1,b.z+h.z);}
 x=clamp(x,.22-x0,7.78-x1);z=clamp(z,CLEAR_ROWS-z0,PILE_MAX_Z-z1);
 const p={id:s.nextId++,x,z,shape,layout,width:x1-x0,depth:z1-z0};
 // Occupied portions are omitted during replenishment, so gold cannot appear inside a unit.
 prepareBrickBodies(p);
 return p;
}
function seedBricks(){
 if(s.piles.some(count))return;s.piles=[];
 const slots=[
  [1.45,2.84,'pyramid',-.025],[4.0,2.77,'small',.015],[6.54,2.91,'round',-.12],
  [1.42,4.94,'scatter',-.06],[4.13,5.03,'pyramid',.018],[6.69,4.98,'crescent',.065],
  [1.46,7.09,'round',.08],[4.13,7.18,'ridge',-.035],[6.57,7.03,'pyramid',.04]
 ];
 for(const [x,z,shape,angle]of slots){
  const p=createPile(x+(Math.random()-.5)*.15,z+(Math.random()-.5)*.1,shape,angle+(Math.random()-.5)*.035);
  if(count(p))s.piles.push(p);
 }
 // Late-game units can occupy all the normal pile positions. Try every remaining middle cell.
 if(!s.piles.length)for(let z=2.5;z<8;z++)for(let x=.6;x<8;x++){const p=createPile(x,z,'small');if(count(p)){s.piles.push(p);return;}}
}


function newMatch(){view.reset();s={phase:'aim',side:0,turn:1,time:0,bank:[0,0],hp:[MAXHP,MAXHP],upgrades:[0,0],units:[],piles:[],nextId:1,offers:[],selected:-1,angle:0,bounces:0,queue:[],holeShots:[],moves:[],tankMoves:[],impacts:[],timer:0,after:null,aiDelay:1,aiBuilds:0,placed:0,message:'',messageTime:0,totalCollected:[0,0]};seedBricks();resetHole();drag=null;hover=null;cardSignature='';$('ghost').hidden=true;updateUI();}
function overlap(ax,az,aw,ah,bx,bz,bw,bh){return Math.abs(ax-bx)<(aw+bw)/2-.001&&Math.abs(az-bz)<(ah+bh)/2-.001;}
function frontier(side){const own=s.units.filter(u=>u.side===side&&!u.falling);return side?Math.min(10,Math.max(2,...own.map(u=>Math.floor(u.z)+1))):Math.max(0,Math.min(8,...own.map(u=>Math.floor(u.z))));}
function canPlace(x,z,type,side=s.side){if(!Number.isFinite(x)||!Number.isFinite(z)||Math.abs(x-.5-Math.round(x-.5))>.001||Math.abs(z-.5-Math.round(z-.5))>.001||x<.5||x>7.5||z<.5||z>9.5)return false;const row=Math.floor(z),col=Math.floor(x),edge=frontier(side);if(side?row>=edge:row<edge)return false;if(s.units.some(u=>Math.floor(u.x)===col&&Math.floor(u.z)===row))return false;return !bricksBlocked(x,z,1,1);}
function snap(p,type){return {x:Math.floor(p.x)+.5,z:Math.floor(p.z)+.5,type};}
function say(text){s.message=text;s.messageTime=2.5;}

function spend(n){s.bank[s.side]-=n;}
function earn(n,side,pos,growth=false){if(!n)return;s.bank[side]+=n;s.totalCollected[side]+=n;if(growth){s.hole.eaten+=n;s.hole.level=growthLevel(s.hole.eaten,1+s.upgrades[side]);s.hole.r=radius(s.hole.level);}}




// Exact swept circle / rectangle overlap: prevents frame-rate tunnelling and edge misses.



function damageWall(side,n){s.hp[side]=Math.max(0,s.hp[side]-n);if(!s.hp[side]){s.phase='over';s.queue=[];s.after=null;}}
function damageUnit(u,percent){if(u.capture)return;u.hp-=u.type==='soldier'?u.maxhp:u.maxhp*percent/100;if(u.hp<=.00001)s.units=s.units.filter(v=>v!==u);}
function launch(angle=s.angle){if(s.phase!=='aim')return false;s.angle=clamp(angle,-1.25,1.25);s.phase='drift';s.hole.vx=Math.sin(s.angle)*5.8;s.hole.vz=(s.side?1:-1)*Math.cos(s.angle)*5.8;return true;}
function driftStep(dt){const h=s.hole;h.x+=h.vx*dt;h.z+=h.vz*dt;let bounced=false;
 if(h.x<h.r){h.x=h.r;if(h.vx<0){h.vx=-h.vx;bounced=true;}}if(h.x>8-h.r){h.x=8-h.r;if(h.vx>0){h.vx=-h.vx;bounced=true;}}
 if(h.z<h.r){h.z=h.r;if(h.vz<0){h.vz=-h.vz;bounced=true;if(s.side===0)damageWall(1,5);}}if(h.z>10-h.r){h.z=10-h.r;if(h.vz>0){h.vz=-h.vz;bounced=true;if(s.side===1)damageWall(0,5);}}

 if(bounced)s.bounces++;if(s.bounces>=5&&s.phase!=='over')finishDrift();
}
function offerCards(){s.offers=Object.keys(TYPES).sort(()=>Math.random()-.5).slice(0,3);s.selected=-1;}
function actionQueue(units,after){s.phase='actions';s.queue=[];s.timer=.15;s.after=after;const squads=new Set();for(const u of units){if(u.type==='soldier'){if(squads.has(u.squad))continue;squads.add(u.squad);}for(let i=0;i<(u.type==='mg'?10:1);i++)s.queue.push(()=>act(u));}if(!s.queue.length){s.after=null;after();}}
function enterBuild(){if(s.phase==='over')return;s.phase='build';offerCards();s.aiDelay=.7;s.aiBuilds=0;s.placed=0;s.aiRerolls=0;}
function finishDrift(){s.phase='settle';s.hole.vx=s.hole.vz=0;}
function targetFor(u,range=30,includeBricks=true){
 const dir=u.side?1:-1,col=u.column??Math.floor(u.x);let best=null;
 for(const v of s.units){
  if(v.side===u.side||v.falling||Math.floor(v.x)!==col)continue;const d=(v.z-u.z)*dir;
  if(d<-.01||d>range)continue;if(!best||d<best.d)best={kind:'unit',u:v,x:v.x,z:v.z,d};
 }
 if(includeBricks)for(const p of s.piles){
  if(!p.remaining||p.x+p.width/2<col||p.x-p.width/2>col+1)continue;
  for(const b of p.bricks){
   if(b.removed||b.capture||b.x+b.hx<=col||b.x-b.hx>=col+1)continue;
   const center=(b.z-u.z)*dir;if(center < -b.hz-.01)continue;const d=Math.max(0,center-b.hz);
   if(d>range)continue;if(!best||d<best.d)best={kind:'bricks',p,brickId:b.id,cellX:col,cellZ:Math.floor(b.z),x:b.x,z:b.z,y:b.y+b.h/2,d};
  }
 }
 if(best)return best;const z=u.side?10:0;
 return Math.abs(z-u.z)<=range?{kind:'base',side:1-u.side,x:u.x,z,d:Math.abs(z-u.z)}:null;
}
function harvest(p,side,mode,target=null){
 const eligible=b=>!b.removed&&!b.capture&&(!target||brickTouchesRect(b,target.cellX+.5,target.cellZ+.5,1,1));
 if(mode==='all'){for(const b of p.bricks)if(eligible(b))removeBrick(p,b,side);return;}
 let selected=null;for(const b of p.bricks)if(eligible(b)&&(!selected||(mode==='top'?b.y>selected.y:b.y<selected.y)))selected=b;
 if(selected)removeBrick(p,selected,side);
}
function blast(side,target,wallDamage=10,unitDamage=40){if(target.kind==='base')damageWall(target.side,wallDamage);else if(target.kind==='bricks')harvest(target.p,side,'all',target);else if(s.units.includes(target.u))damageUnit(target.u,unitDamage);for(const v of [...s.units])if(v.side!==side&&v.type==='soldier'&&Math.hypot(v.x-target.x,v.z-target.z)<=1)damageUnit(v,100);}
function bricksBlocked(x,z,w,d){return s.piles.some(p=>p.remaining&&Math.abs(p.x-x)<(p.width+w)/2+.1&&Math.abs(p.z-z)<(p.depth+d)/2+.1&&p.bricks.some(b=>!b.removed&&b.y+b.h>0&&brickTouchesRect(b,x,z,w,d)));}
function squadTarget(units){const leader=units.reduce((a,b)=>a.side?(a.z>b.z?a:b):(a.z<b.z?a:b));return targetFor(leader,.85);}
function squadFire(units,target){for(const u of units){if(!s.units.includes(u)||u.falling)continue;let t=target;if(t.kind==='unit'&&!s.units.includes(t.u))t=targetFor(u,.85);if(!t)continue;shoot(u,t,4,5);}}
function advanceCrowds(dt){for(const m of [...s.moves]){const units=m.units.filter(u=>s.units.includes(u)&&!u.falling);if(!units.length){s.moves=s.moves.filter(v=>v!==m);continue;}const target=squadTarget(units);if(target){squadFire(units,target);s.moves=s.moves.filter(v=>v!==m);continue;}const step=Math.min(m.remaining,dt*1.1),dir=units[0].side?1:-1;let canMove=units.every(u=>u.z+dir*step>=.25&&u.z+dir*step<=9.75&&!bricksBlocked(u.x,u.z+dir*step,.22,.45));if(!canMove){const t=targetFor(units.reduce((a,b)=>dir>0?(a.z>b.z?a:b):(a.z<b.z?a:b)),1.2);if(t)squadFire(units,t);s.moves=s.moves.filter(v=>v!==m);continue;}for(const u of units)u.z+=dir*step;m.remaining-=step;if(m.remaining<=.0001){const t=squadTarget(units);if(t)squadFire(units,t);s.moves=s.moves.filter(v=>v!==m);}}}

function shoot(u,target,wallDamage,unitDamage,kind='shot'){if(!target||u.falling)return;u.aim=Math.atan2(target.x-u.x,Math.abs(target.z-u.z));if(kind==='mortar'){view.effect(u,target,kind,1.3);s.impacts.push({left:1.3,side:u.side,target:{...target},wallDamage,unitDamage});return;}if(target.kind==='bricks'){const top=u.type==='mg';const height=top?Math.max(0,...target.p.bricks.filter(b=>!b.removed).map(b=>b.y+b.h)):.1;view.effect(u,{...target,y:height},kind,.3);harvest(target.p,u.side,top?'top':u.type==='tank'?'all':'bottom',target);}else {view.effect(u,target,kind,.3);if(target.kind==='base')damageWall(target.side,wallDamage);else if(s.units.includes(target.u))damageUnit(target.u,unitDamage);}}
function act(u){if(!s.units.includes(u)||u.falling||s.phase==='over')return;
 if(u.type==='soldier'){const units=s.units.filter(v=>v.type==='soldier'&&v.squad===u.squad&&!v.falling);const target=squadTarget(units);if(target)squadFire(units,target);else s.moves.push({units,remaining:1});return;}
 if(u.type==='mg'){const t=targetFor(u);if(t)shoot(u,t,2,10);return;}
 if(u.type==='mortar'){const t=targetFor(u);if(t)shoot(u,t,10,40,'mortar');return;}
 if(u.type==='tank'){let t=targetFor(u,2);if(u.justBuilt){const nearest=targetFor(u);if(nearest?.kind==='bricks')t=nearest;}u.justBuilt=false;if(t)tankFire(u,t);else s.tankMoves.push({u,remaining:2});return;}
 if(u.type==='holegun'){s.holeShots.push({id:s.nextId++,x:u.x,z:u.z,startZ:u.z,side:u.side,r:.125,owner:u,eaten:0});}
}
function place(index,x,z){if(s.phase!=='build'||!s.offers[index])return false;const type=s.offers[index],cost=TYPES[type].cost;if(s.bank[s.side]<cost){say('Not enough bricks');return false;}if(!canPlace(x,z,type)){say('Choose an empty highlighted space');return false;}spend(cost,{x,z});s.placed++;const squad=s.nextId++,made=[];for(let i=0;i<(type==='soldier'?8:1);i++){const u={id:s.nextId++,squad,type,side:s.side,x:x+(type==='soldier'?(i%4)*.25-.375:0),z:z+(type==='soldier'?Math.floor(i/4)*.5-.25:0),hp:type==='soldier'?1:cost,maxhp:type==='soldier'?1:cost,built:s.time,y:0,vy:0,falling:false,capture:null,fed:0,column:Math.floor(x),justBuilt:true};made.push(u);s.units.push(u);}s.offers[index]=rand(Object.keys(TYPES));s.selected=-1;hover=null;const offers=s.offers.slice();actionQueue(made,()=>{if(s.phase!=='over'){s.phase='build';s.offers=offers;s.aiDelay=.65;}});s.timer=.65;return true;}
function reroll(){if(s.phase!=='build'||s.bank[s.side]<REROLL)return false;spend(REROLL);offerCards();return true;}
function upgrade(){const cost=upgradeCost(s.side);if(s.phase!=='aim'||s.upgrades[s.side]>=MAXLEVEL-1||s.bank[s.side]<cost)return false;spend(cost);s.upgrades[s.side]++;resetHole();say('Starting hole upgraded to level '+s.hole.level);return true;}
function endTurn(){if(s.phase!=='build')return false;s.side=1-s.side;if(!s.side)s.turn++;s.phase='aim';s.selected=-1;hover=null;s.angle=0;seedBricks();resetHole();s.aiDelay=.9;return true;}
function ai(){if(s.side!==1)return;if(s.phase==='aim'){if(s.upgrades[1]<MAXLEVEL-1&&s.bank[1]>upgradeCost(1)+24)upgrade();let best=0,score=-1;for(let a=-1.1;a<=1.1;a+=.22){let val=0;for(const p of s.piles)val+=count(p)*Math.max(0,2-Math.abs(p.x-(4+Math.tan(a)*(p.z-s.hole.z))));if(val>score){score=val;best=a;}}launch(best);return;}if(s.phase==='build'){const options=[];for(let i=0;i<3;i++){const type=s.offers[i];if(TYPES[type].cost>s.bank[1])continue;for(let z=.5;z<10;z++)for(let x=.5;x<8;x++)if(canPlace(x,z,type,1))options.push({i,x,z,score:z*2+Math.random()*3+(type==='mortar'?2:0)});}if(options.length){options.sort((a,b)=>b.score-a.score);const o=options[0];s.aiBuilds++;place(o.i,o.x,o.z);}else if(!s.aiRerolls&&s.bank[1]>10){s.aiRerolls++;reroll();s.aiDelay=.6;}else endTurn();}}
function advanceHoleShots(dt){for(const h of [...s.holeShots]){h.z+=(h.side?1:-1)*2.5*dt;h.r=Math.min(.5,h.r+.09*dt);if(h.z<=0||h.z>=10){damageWall(1-h.side,2);s.holeShots=s.holeShots.filter(v=>v!==h);}}}
function tankFire(u,t){shoot(u,t,20,40,'shell');for(const v of [...s.units])if(v.side!==u.side&&v.type==='soldier'&&Math.hypot(v.x-t.x,v.z-t.z)<=1)damageUnit(v,100);}
function advanceTanks(dt){for(const m of [...s.tankMoves]){const u=m.u;if(!s.units.includes(u)||u.falling){s.tankMoves=s.tankMoves.filter(v=>v!==m);continue;}let target=targetFor(u,2);if(target){tankFire(u,target);s.tankMoves=s.tankMoves.filter(v=>v!==m);continue;}const distance=Math.min(m.remaining,.65*dt),nz=u.z+(u.side?1:-1)*distance;if(nz<.5||nz>9.5||bricksBlocked(u.x,nz,.5,.5)){s.tankMoves=s.tankMoves.filter(v=>v!==m);continue;}u.z=nz;m.remaining-=distance;target=targetFor(u,2);if(target)tankFire(u,target);if(target||m.remaining<=.0001)s.tankMoves=s.tankMoves.filter(v=>v!==m);}}
function tick(dt){
 s.time+=dt;s.messageTime=Math.max(0,s.messageTime-dt);
 if(s.phase!=='over'){advanceCrowds(dt);advanceTanks(dt);}
 // All hole motion and falling share the same small time steps: a fast hole never
 // teleports a whole stack into inventory, even when a render frame is delayed.
 let left=dt;
 while(left>0){const step=Math.min(FALL_STEP,left);
  if(s.phase!=='over')advanceHoleShots(step);
  if(s.phase==='drift')driftStep(step);
  advanceFalling(step);left-=step;
 }
 if(s.phase!=='over')for(const hit of [...s.impacts]){hit.left-=dt;if(hit.left<=0){blast(hit.side,hit.target,hit.wallDamage,hit.unitDamage);s.impacts=s.impacts.filter(v=>v!==hit);}}
 if(s.phase==='settle'){
  if(!hasFallingBodies()){resetHole();actionQueue(s.units.filter(u=>u.side===s.side&&!u.falling),enterBuild);}
 }else if(s.phase==='actions'){
  s.timer-=dt;
  if(s.timer<=0&&!s.holeShots.length&&!s.moves.length&&!s.tankMoves.length&&!s.impacts.length&&!hasFallingBodies()){
   if(s.queue.length){s.queue.shift()();s.timer=.16;}else if(s.after){const after=s.after;s.after=null;after();}
  }
 }else if(s.side===1&&s.phase!=='over'&&s.phase!=='drift'){
  s.aiDelay-=dt;if(s.aiDelay<=0){s.aiDelay=.7;ai();}
 }
}
function updateUI(){const mine=s.side===0,build=mine&&s.phase==='build',aim=mine&&s.phase==='aim';$('bank').textContent=s.bank[0];$('round').textContent='ROUND '+s.turn;for(const [side,n]of [[0,'player'],[1,'enemy']]){$(n+'HP').textContent=Math.ceil(s.hp[side])+'%';$(n+'Bar').style.width=s.hp[side]/MAXHP*100+'%';}$('phaseBadge').textContent=aim?'ENEMY HQ':s.phase==='over'?'BATTLE OVER':(mine?'YOUR ':'ENEMY ')+(s.phase==='aim'||s.phase==='drift'?'DRIFT':s.phase==='settle'?'GOLD SETTLING':s.phase==='actions'?'UNITS ACTING':'BUILD');$('holeInfo').textContent='HOLE LV. '+s.hole.level+(s.phase==='drift'?' · '+s.hole.eaten+' ▰':'');$('bounceInfo').textContent=s.phase==='drift'?Math.max(0,5-s.bounces)+' BOUNCES':(build?s.placed+' DEPLOYED':'START LV. '+(1+s.upgrades[0]));$('app').classList.toggle('building',build);$('app').classList.toggle('aiming',aim);$('buildPanel').hidden=!build;$('waiting').hidden=aim||build;$('waitingText').textContent=s.phase==='over'?'BATTLE COMPLETE':s.phase==='settle'?'GOLD SETTLING':mine?(s.phase==='drift'?'YOUR DRIFT':'UNITS ACTING'):s.phase==='drift'?'ENEMY DRIFTING':'ENEMY TURN';$('upgrade').hidden=!aim;$('upgrade').innerHTML=s.upgrades[0]>=MAXLEVEL-1?'MAX SIZE':'SIZE <b>'+upgradeCost(0)+' ▰</b>';$('upgrade').disabled=s.bank[0]<upgradeCost(0)||s.upgrades[0]>=MAXLEVEL-1;$('hint').textContent=s.messageTime?s.message:aim?'Drag behind your wall · release to drift':build?(s.selected>=0?TYPES[s.offers[s.selected]].desc:'Drag a card to build · spend your bricks'):s.phase==='drift'?'Let gold fall in · fast passes leave upper bricks':s.phase==='over'?'Destroy the enemy HQ to win':'All units fire forward';$('reroll').disabled=s.bank[0]<REROLL;
 const sig=s.offers.join(',')+'|'+s.selected+'|'+s.bank[0]+'|'+s.placed;if(sig!==cardSignature){cardSignature=sig;$('cards').innerHTML=s.offers.map((k,i)=>'<button class="card '+(s.selected===i?'selected':'')+'" data-card="'+i+'" aria-label="'+TYPES[k].name+', '+TYPES[k].cost+' bricks. '+TYPES[k].desc+'" '+(s.bank[0]<TYPES[k].cost?'disabled':'')+'><img src="'+icons[k]+'" alt=""><span class="title">'+TYPES[k].name+'</span><span class="cost">'+TYPES[k].cost+' ▰</span></button>').join('');}
 $('outcome').hidden=s.phase!=='over';if(s.phase==='over'){$('outcomeTitle').textContent=s.hp[1]===0?'VICTORY!':'HQ DESTROYED';$('outcomeText').textContent=(s.hp[1]===0?'Enemy defenses have fallen.':'Your general will fight another day.')+' '+s.totalCollected[0]+' bricks collected.';}
}
$('game').addEventListener('pointerdown',e=>{if(s.side||s.phase!=='aim')return;const p=view.groundPoint(e.clientX,e.clientY);if(!p||p.z<10.35)return;aimStart={x:e.clientX,y:e.clientY};e.currentTarget.setPointerCapture(e.pointerId);});
$('game').addEventListener('pointermove',e=>{if(aimStart)s.angle=clamp((e.clientX-aimStart.x)/115,-1.25,1.25);});
$('game').addEventListener('pointerup',()=>{if(aimStart){aimStart=null;launch();}});$('game').addEventListener('pointercancel',()=>aimStart=null);
$('game').addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();s.angle=clamp(s.angle+(e.key==='ArrowLeft'?-.1:.1),-1.25,1.25);}if(e.key===' '||e.key==='Enter'){e.preventDefault();launch();}});
$('cards').addEventListener('pointerdown',e=>{const b=e.target.closest('[data-card]');if(!b||b.disabled||s.phase!=='build')return;const i=+b.dataset.card;s.selected=i;drag={i,startX:e.clientX,startY:e.clientY,moved:false};});
$('cards').addEventListener('click',e=>{const b=e.target.closest('[data-card]');if(b&&!b.disabled)s.selected=+b.dataset.card;});
document.addEventListener('pointermove',e=>{if(!drag)return;drag.moved=drag.moved||Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)>8;const type=s.offers[drag.i],p=view.groundPoint(e.clientX,e.clientY);if(p){hover=snap(p,type);hover.ok=canPlace(hover.x,hover.z,type);}if(drag.moved){$('ghost').hidden=false;$('ghost').textContent=TYPES[type].name;$('ghost').style.left=e.clientX+'px';$('ghost').style.top=e.clientY-16+'px';}});
document.addEventListener('pointerup',e=>{if(!drag)return;const d=drag;drag=null;$('ghost').hidden=true;if(d.moved&&hover&&hover.ok)place(d.i,hover.x,hover.z);hover=null;});document.addEventListener('pointercancel',()=>{drag=null;hover=null;$('ghost').hidden=true;});
$('game').addEventListener('pointerup',e=>{if(drag||s.side||s.phase!=='build'||s.selected<0)return;const p=view.groundPoint(e.clientX,e.clientY);if(p){const q=snap(p,s.offers[s.selected]);place(s.selected,q.x,q.z);}});
$('reroll').onclick=reroll;$('endTurn').onclick=endTurn;$('upgrade').onclick=upgrade;$('restart').onclick=newMatch;$('again').onclick=newMatch;$('help').onclick=()=>$('helpDialog').showModal();$('closeHelp').onclick=()=>$('helpDialog').close();
newMatch();function frame(t){const dt=Math.min(.05,(t-last)/1000||.016);last=t;tick(dt);updateUI();view.draw(s,dt,canPlace,hover);requestAnimationFrame(frame);}requestAnimationFrame(frame);
window.holeDrift={getState:()=>JSON.parse(JSON.stringify(s,(k,v)=>v instanceof Set?[...v]:v)),launch,place,reroll,upgrade,endTurn,restart:newMatch};
if(navigator.modelContext){for(const [name,description,fn,properties,required]of [['inspect_battle','Inspect Hole Drift state',()=>window.holeDrift.getState(),{},[]],['launch_hole','Launch hole at angle in radians',a=>launch(a.angle),{angle:{type:'number'}},['angle']],['place_unit','Place a card on a big-cell center',a=>place(a.card,a.x,a.z),{card:{type:'integer'},x:{type:'number'},z:{type:'number'}},['card','x','z']],['end_turn','End build phase',endTurn,{},[]]])try{navigator.modelContext.registerTool({name,description,inputSchema:{type:'object',properties,required},execute:async a=>({content:[{type:'text',text:JSON.stringify(fn(a))}]})});}catch{}}
