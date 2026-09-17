from pathlib import Path
import re

root=Path(__file__).resolve().parent.parent
path=root/'Hole-Drift.html'
t=path.read_text(encoding='utf-8')
backup=root/'.work/Hole-Drift.before-physics.html'
if not backup.exists(): backup.write_text(t,encoding='utf-8')
else: t=backup.read_text(encoding='utf-8')

def replace(old,new):
 global t
 assert old in t,old[:100]
 t=t.replace(old,new)

def function(name,new):
 global t
 match=re.search(r'^function '+name+r'\(',t,re.M)
 assert match,name
 # Existing functions end either at their line end or a column-zero closing brace.
 start=match.start();opening=t.index('{',match.start());depth=0;quote=None;escape=False;i=opening
 while i<len(t):
  c=t[i]
  if quote:
   if escape:escape=False
   elif c=='\\':escape=True
   elif c==quote:quote=None
  elif c in "'\"`":quote=c
  elif t.startswith('//',i):i=t.index('\n',i);continue
  elif t.startswith('/*',i):i=t.index('*/',i)+2;continue
  elif c=='{':depth+=1
  elif c=='}':
   depth-=1
   if depth==0:break
  i+=1
 t=t[:start]+new.rstrip()+t[i+1:]

replace('const count=p=>p.cols.reduce((a,b)=>a+b,0);','const count=p=>p.remaining;\n'+(root/'.work/vertical-physics.js').read_text(encoding='utf-8'))
replace("s.hole={x:4,z:s.side?r:10-r,r,level,eaten:0,vx:0,vz:0,contacts:new Set(),unitContacts:new Set()}","s.hole={id:s.nextId++,x:4,z:s.side?r:10-r,r,level,eaten:0,vx:0,vz:0}")
replace('s.hole.contacts.clear();','')
replace('const p={id:s.nextId++,x,z,shape,layout,cols:layout.map(b=>b.n),offsets:layout.map(()=>0),width:x1-x0,depth:z1-z0};','const p={id:s.nextId++,x,z,shape,layout,width:x1-x0,depth:z1-z0};')
replace('p.cols=p.cols.map((v,i)=>s.units.some(u=>p.layout[i].levels.some((_,l)=>brickTouchesRect(brickPos(p,i,l),u.x,u.z,...dims(u))))?0:v);','prepareBrickBodies(p);')
function('brickPos','')
function('collectColumn','')
function('collectPile','')
function('holeCollect','')
function('collectDrift','')
function('sweptHit','')
function('pointSegmentDist','')
function('pointRectDist','')
function('brickBurst','')
function('spend','function spend(n){s.bank[s.side]-=n;}')
replace('collectDrift(ax,az);','')
replace('const h=s.hole,ax=h.x,az=h.z;','const h=s.hole;')
function('finishDrift',"function finishDrift(){s.phase='settle';s.hole.vx=s.hole.vz=0;}")
function('targetFor', '''function targetFor(u,range=30,includeBricks=true){
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
}''')
function('harvest', '''function harvest(p,side,mode,target=null){
 const eligible=b=>!b.removed&&!b.capture&&(!target||brickTouchesRect(b,target.cellX+.5,target.cellZ+.5,1,1));
 if(mode==='all'){for(const b of p.bricks)if(eligible(b))removeBrick(p,b,side);return;}
 let selected=null;for(const b of p.bricks)if(eligible(b)&&(!selected||(mode==='top'?b.y>selected.y:b.y<selected.y)))selected=b;
 if(selected)removeBrick(p,selected,side);
}''')
function('bricksBlocked', '''function bricksBlocked(x,z,w,d){return s.piles.some(p=>p.remaining&&Math.abs(p.x-x)<(p.width+w)/2+.1&&Math.abs(p.z-z)<(p.depth+d)/2+.1&&p.bricks.some(b=>!b.removed&&b.y+b.h>0&&brickTouchesRect(b,x,z,w,d)));}''')
replace('Math.max(...target.p.cols)*.244',"Math.max(0,...target.p.bricks.filter(b=>!b.removed).map(b=>b.y+b.h))")
replace('s.units.filter(u=>u.side===side)','s.units.filter(u=>u.side===side&&!u.falling)')
replace("if(!s.units.includes(u)||s.phase==='over')return;","if(!s.units.includes(u)||u.falling||s.phase==='over')return;")
replace("v=>v.type==='soldier'&&v.squad===u.squad","v=>v.type==='soldier'&&v.squad===u.squad&&!v.falling")
replace('function damageUnit(u,percent){u.hp-=', 'function damageUnit(u,percent){if(u.capture)return;u.hp-=')
replace("if(!s.units.includes(u))continue;let t=target;","if(!s.units.includes(u)||u.falling)continue;let t=target;")
replace('m.units.filter(u=>s.units.includes(u))','m.units.filter(u=>s.units.includes(u)&&!u.falling)')
replace('if(!s.units.includes(u)){s.tankMoves','if(!s.units.includes(u)||u.falling){s.tankMoves')
replace("function shoot(u,target,wallDamage,unitDamage,kind='shot'){if(!target)return;","function shoot(u,target,wallDamage,unitDamage,kind='shot'){if(!target||u.falling)return;")
replace('built:s.time,fed:0,column:','built:s.time,y:0,vy:0,falling:false,capture:null,fed:0,column:')
replace('s.holeShots.push({x:u.x,z:u.z,startZ:u.z,side:u.side,r:.125,owner:u,eaten:0,contacts:new Set()})','s.holeShots.push({id:s.nextId++,x:u.x,z:u.z,startZ:u.z,side:u.side,r:.125,owner:u,eaten:0})')
function('advanceHoleShots', '''function advanceHoleShots(dt){for(const h of [...s.holeShots]){h.z+=(h.side?1:-1)*2.5*dt;h.r=Math.min(.5,h.r+.09*dt);if(h.z<=0||h.z>=10){damageWall(1-h.side,2);s.holeShots=s.holeShots.filter(v=>v!==h);}}}''')
function('tick', '''function tick(dt){
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
}''')

start=t.index(' drawGold(s,dt){');end=t.index('\n soldierModel(',start)
t=t[:start]+''' drawGold(s,dt){
  const pileLive=new Set();let instance=0;const m=this.goldTransform;
  for(const p of s.piles){
   if(!count(p))continue;pileLive.add(p.id);
   let shadow=this.pileShadows.get(p.id);
   if(!shadow){shadow=new THREE.Mesh(new THREE.PlaneGeometry(1,1),this.contactMat);shadow.rotation.x=-Math.PI/2;shadow.position.set(p.x,.005,p.z);shadow.scale.set(p.width*1.4,p.depth*1.4,1);this.scene.add(shadow);this.pileShadows.set(p.id,shadow);}
   for(const b of p.bricks){
    if(b.removed)continue;
    // The simulation owns Y. No layout resampling, scaling-away, or horizontal tween.
    m.position.set(b.x,b.y+b.h/2,b.z);m.rotation.set(0,b.angle,0);m.scale.set(b.w/.3,b.h/.24,b.d/.48);m.updateMatrix();
    this.gold.setMatrixAt(instance++,m.matrix);
   }
  }
  this.gold.count=instance;this.gold.instanceMatrix.needsUpdate=true;
  for(const [id,shadow]of this.pileShadows)if(!pileLive.has(id)){this.scene.remove(shadow);shadow.geometry.dispose();this.pileShadows.delete(id);}
 }
''' +t[end:]
replace('roundedGeometry(w,h,d,r){','roundedGeometry(w,h,d,r,segments=6){')
replace('new THREE.BoxGeometry(w,h,d,6,6,6)','new THREE.BoxGeometry(w,h,d,segments,segments,segments)')
replace('this.roundedGeometry(.3,.24,.48,.055)','this.roundedGeometry(.3,.24,.48,.055,4)')
replace('new THREE.InstancedMesh(geo,this.goldMat,2048)','new THREE.InstancedMesh(geo,this.goldMat,8192)')
replace('g.position.x+=(u.x-g.position.x)*Math.min(1,dt*10);g.position.z+=(u.z-g.position.z)*Math.min(1,dt*10);','g.position.set(u.x,u.y||0,u.z);')
replace("if(u.type==='mg'&&g.userData.turret)","if(u.type==='mg'&&!u.falling&&g.userData.turret)")
replace("e.style.display=u.type==='soldier'?'none':'block';","e.style.display=u.type==='soldier'||u.capture?'none':'block';")
replace('new THREE.Vector3(u.x,1.12*1.65,u.z*1.08)','new THREE.Vector3(u.x,(1.12+(u.y||0))*1.65,u.z*1.08)')
replace("this.hole.visible=s.phase==='aim'||s.phase==='drift'||s.phase==='build'||s.phase==='actions';","this.hole.visible=s.phase!=='over';")
replace('this.hole.scale.setScalar(this.hole.scale.x+(s.hole.r-this.hole.scale.x)*Math.min(1,dt*10))','this.hole.scale.setScalar(s.hole.r)')
# Render clipping makes the top sink through the rim rather than poke out beneath
# the turf. Physical removal and bank credit still wait for the whole body to pass.
replace('this.renderer.shadowMap.enabled=true;','this.renderer.localClippingEnabled=true;this.sinkPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0);\n  this.renderer.shadowMap.enabled=true;')
replace('this.gold=new THREE.InstancedMesh','this.goldMat.clippingPlanes=[this.sinkPlane];this.goldMat.clipShadows=true;\n  this.gold=new THREE.InstancedMesh')
replace('g=this.unitModel(u.type,u.side);g.position.set(u.x,0,u.z);','g=this.unitModel(u.type,u.side);g.traverse(child=>{if(child.isMesh){child.material.clippingPlanes=[this.sinkPlane];child.material.clipShadows=true;}});g.position.set(u.x,u.y||0,u.z);')
replace("Collect gold · leave a stack to collect its next bar","Let gold fall in · fast passes leave upper bricks")
replace("s.phase==='actions'?'UNITS ACTING':'BUILD'","s.phase==='settle'?'GOLD SETTLING':s.phase==='actions'?'UNITS ACTING':'BUILD'")
replace("mine?(s.phase==='drift'?'YOUR DRIFT':'UNITS ACTING')","s.phase==='settle'?'GOLD SETTLING':mine?(s.phase==='drift'?'YOUR DRIFT':'UNITS ACTING')")
replace('It deals 5% to the enemy HQ.</p>','It deals 5% to the enemy HQ. All gold bricks have the same size. Bricks and units fall straight down only when their full footprint fits inside the hole. Gold is collected after it falls below the surface; fast passes can leave upper bricks behind.</p>')
path.write_text(t,encoding='utf-8')
for i,script in enumerate(re.findall(r'<script>(.*?)</script>',t,re.S)):
 if i:(root/f'.work/physics-script-{i}.js').write_text(script,encoding='utf-8')
print('Updated vertical falling, uniform brick bodies, rendering, and combat integration.')
