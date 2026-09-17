// Constrained rigid bodies: gravity and contacts on Y; X/Z and rotation never change.
// Even the quarter-cell hole-gun aperture can contain the diagonal of one brick.
const GOLD_SIZE=Object.freeze({w:.14,d:.18,h:.12});
const FALL_GRAVITY=26,FALL_STEP=1/180,ENTRY_DEPTH=.008,COLLECT_DEPTH=.62;
const INTAKE=Object.freeze({speed:4.65,largeSpeed:4.2,shotSpeed:2.2,pull:54,maxFallSpeed:10,supportFraction:.2});
function holeStrength(h){return clamp((h.r-.28)/.72,0,1);}
function driftSpeed(h){return INTAKE.speed+(INTAKE.largeSpeed-INTAKE.speed)*holeStrength(h);}
function intakeGravity(aperture,y){return FALL_GRAVITY+(aperture?10+INTAKE.pull*holeStrength(aperture.h)/(1+Math.max(0,y)*.22):0);}

// Exact footprint contact area is calculated once at spawn. A tiny corner must
// not suspend an entire upper tier after its substantial supports have drained.
function contactArea(a,b){
 const corners=body=>[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,z])=>({x:body.x+x*body.w/2*body.c+z*body.d/2*body.sn,z:body.z-x*body.w/2*body.sn+z*body.d/2*body.c}));
 let polygon=corners(a);const clip=corners(b);
 for(let i=0;i<4&&polygon.length;i++){
  const a=clip[i],b=clip[(i+1)%4],dx=b.x-a.x,dz=b.z-a.z,side=p=>dx*(p.z-a.z)-dz*(p.x-a.x),out=[];
  let prev=polygon[polygon.length-1],pd=side(prev);
  for(const next of polygon){const nd=side(next);if((pd>=0)!==(nd>=0)){const t=pd/(pd-nd);out.push({x:prev.x+(next.x-prev.x)*t,z:prev.z+(next.z-prev.z)*t});}if(nd>=0)out.push(next);prev=next;pd=nd;}
  polygon=out;
 }
 let area=0;for(let i=0;i<polygon.length;i++){const a=polygon[i],b=polygon[(i+1)%polygon.length];area+=a.x*b.z-a.z*b.x;}
 return Math.abs(area)/2;
}
function supportingSurface(p,b,ground){
 let y=ground,velocity=0,ceiling=Infinity;
 // Aggregate adjacent contacts at the same height, so a genuine two-brick
 // bridge remains supported while isolated slivers do not pin whole stacks.
 for(let pass=0;pass<b.supports.length;pass++){
  let top=ground;
  for(const i of b.supports){const below=p.bricks[i],height=below.y+below.h;if(!below.removed&&!below.capture&&height<ceiling&&height>top)top=height;}
  if(top===ground)break;
  let area=0,v=0;
  for(let j=0;j<b.supports.length;j++){
   const below=p.bricks[b.supports[j]],height=below.y+below.h;
   if(below.removed||below.capture||height>top+.00001||top-height>=.014)continue;
   const weight=b.supportAreas?.[j]??b.w*b.d;area+=weight;v+=below.vy*weight;
  }
  if(area>=b.w*b.d*INTAKE.supportFraction){y=top;velocity=v/area;break;}
  ceiling=top-.014;
 }
 return {y,velocity};
}

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
    angle:tile.angle,c,sn,removed:false,falling:false,capture:null,supports:[],supportAreas:[]};
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
  for(const j of candidates){const other=p.bricks[j];if(other.y+other.h<=b.y+.0001&&footprintsOverlap(b,other)){b.supports.push(j);b.supportAreas.push(contactArea(b,other));}}
  for(const key of ks){if(!cells.has(key))cells.set(key,[]);cells.get(key).push(i);}
 }
 // Settle unsupported overhangs during construction, before the board is shown.
 for(const b of p.bricks)b.y=supportingSurface(p,b,0).y;
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
function captureCredit(aperture){return {side:aperture.side,main:aperture.main,holeId:aperture.h.id,ownerId:aperture.h.owner?.id,gravity:intakeGravity(aperture,0)};}
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
    b.vy=Math.max(-INTAKE.maxFallSpeed,b.vy-(b.capture.gravity||FALL_GRAVITY)*dt);b.y+=b.vy*dt;b.falling=true;
    if(b.y+b.h<=-COLLECT_DEPTH){removeBrick(p,b);creditFall(b.capture,1,{x:b.x,z:b.z});}
    continue;
   }
   const aperture=apertureFor(b,holes);
   const support=supportingSurface(p,b,aperture?-Infinity:0),floor=support.y,floorVelocity=support.velocity;
   if(b.y<=floor+.00001&&b.vy===0){b.y=floor;b.falling=false;continue;}
   // All unsupported tiers across the entire aperture accelerate concurrently.
   // This is a continuous flow, with no one-layer-per-pass or contact quota.
   b.vy=Math.max(-INTAKE.maxFallSpeed,b.vy-intakeGravity(aperture,b.y)*dt);const next=b.y+b.vy*dt;
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
   u.vy=Math.max(-INTAKE.maxFallSpeed,u.vy-(u.capture.gravity||FALL_GRAVITY)*dt);u.y+=u.vy*dt;u.falling=true;
   if(u.y+body.h<=-COLLECT_DEPTH){
    s.units=s.units.filter(v=>v!==u);
    const amount=u.type==='soldier'?TYPES.soldier.cost/16:(TYPES[u.type]?.cost||0)/2;
    creditFall(u.capture,amount,{x:u.x,z:u.z});
   }
   continue;
  }
  const aperture=apertureFor(body,holes,u);
  if(!aperture&&u.y<=0){u.y=0;u.vy=0;u.falling=false;continue;}
  u.vy=Math.max(-INTAKE.maxFallSpeed,u.vy-intakeGravity(aperture,u.y)*dt);u.y+=u.vy*dt;u.falling=true;
  if(!aperture&&u.y<=0){u.y=0;u.vy=0;u.falling=false;}
  if(aperture&&u.y<=-ENTRY_DEPTH){u.capture=captureCredit(aperture);u.falling=true;}
 }
}
function advanceFalling(dt){const holes=activeApertures();advanceBrickPhysics(dt,holes);advanceUnitPhysics(dt,holes);}
function hasFallingBodies(){return s.units.some(u=>u.falling)||s.piles.some(p=>p.remaining&&p.bricks.some(b=>!b.removed&&b.falling));}
