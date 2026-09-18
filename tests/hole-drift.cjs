const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const elements=new Map();
const element=()=>({style:{},classList:{toggle(){}},addEventListener(){},hidden:false,innerHTML:'',textContent:'',showModal(){},close(){}});
const context=vm.createContext({console,Math,Set,Map,JSON,Number,Infinity,document:{getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);},addEventListener(){}},window:{},navigator:{},requestAnimationFrame(){},HoleDrift3D:class{reset(){}icon(){return '';}effect(){}draw(){}}});
for(const script of scripts)new vm.Script(script);
vm.runInContext(scripts[2],context);
const run=code=>vm.runInContext(code,context);
run(`function physicsFixture(layers=3){
 newMatch();s.phase='drift';s.hole.x=4;s.hole.z=5;s.hole.r=.28;s.hole.vx=s.hole.vz=0;
 const bricks=Array.from({length:layers},(_,i)=>({id:s.nextId++,x:4,z:5,y:i*GOLD_SIZE.h,vy:0,...GOLD_SIZE,angle:0,c:1,sn:0,hx:GOLD_SIZE.w/2,hz:GOLD_SIZE.d/2,removed:false,falling:false,capture:null,supports:Array.from({length:i},(_,j)=>j)}));
 s.piles=[{id:s.nextId++,x:4,z:5,width:.14,depth:.18,remaining:layers,bricks}];return s.piles[0];
}
function settlePhysics(seconds){for(let t=0;t<seconds;t+=FALL_STEP)advanceFalling(FALL_STEP);}`);
assert.equal(run(`(()=>{newMatch();for(const p of s.piles)for(const b of p.bricks){if(b.w!==GOLD_SIZE.w||b.d!==GOLD_SIZE.d||b.h!==GOLD_SIZE.h)return false;if(!fitsAperture(b,{x:b.x,z:b.z,r:.125}))return false;if(b.z-b.hz<2-1e-6||b.z+b.hz>8+1e-6)return false;}return true;})()`),true);
console.log('PASS: uniform bricks fit the smallest aperture and preserve the clear rows.');
assert.equal(run(`(()=>{const p=physicsFixture();advanceFalling(FALL_STEP);return s.bank[0]===0&&p.remaining===3&&p.bricks[0].y<0;})()`),true);
assert.equal(run(`(()=>{const p=physicsFixture();settlePhysics(.8);return s.bank[0]===3&&p.remaining===0&&p.bricks.every(b=>b.y+b.h<=-COLLECT_DEPTH&&b.x===4&&b.z===5);})()`),true);
console.log('PASS: contact does not award gold; fully submerged bodies award exactly once.');
assert.equal(run(`(()=>{const p=physicsFixture(5);s.hole.x=3.5;for(let t=0;t<1/5.8;t+=FALL_STEP){s.hole.x+=5.8*FALL_STEP;advanceFalling(FALL_STEP);}s.phase='settle';settlePhysics(1);return p.remaining>0&&p.remaining<5&&s.bank[0]===5-p.remaining&&p.bricks.every(b=>b.x===4&&b.z===5)&&p.bricks.filter(b=>!b.removed).every(b=>b.y>=0&&!b.falling);})()`),true);
console.log('PASS: fast passage leaves upper bricks behind; remaining bricks settle vertically.');
assert.equal(run(`(()=>{const p=physicsFixture(1);s.hole.x=4.3;settlePhysics(.5);return p.remaining===1&&p.bricks[0].y===0&&s.bank[0]===0;})()`),true);
assert.equal(run(`(()=>{const p=physicsFixture(3);s.phase='build';removeBrick(p,p.bricks[0],0);settlePhysics(.7);return p.bricks[1].y===0&&Math.abs(p.bricks[2].y-GOLD_SIZE.h)<.0001&&p.bricks.every(b=>b.x===4&&b.z===5)&&s.bank[0]===1;})()`),true);
console.log('PASS: edge overlaps are rejected; destroying a support makes higher bricks fall.');
assert.equal(run(`(()=>{physicsFixture(0);const u={id:s.nextId++,type:'giant',side:1,x:4,z:5,y:0,vy:0,hp:50,maxhp:50};s.units=[u];settlePhysics(.3);if(u.y!==0||s.bank[0]!==0)return false;s.hole.r=.55;advanceFalling(FALL_STEP);if(!s.units.includes(u)||s.bank[0]!==0)return false;settlePhysics(.8);return !s.units.includes(u)&&Math.abs(s.bank[0]-refundOf('giant'))<1e-9&&u.x===4&&u.z===5;})()`),true);
console.log('PASS: units require a fitting aperture, descend vertically, and pay only after submersion.');
assert.equal(run(`(()=>{physicsFixture(1);settlePhysics(.055);const b=s.piles[0].bricks[0];if(!b.capture||b.removed)return false;s.phase='settle';s.side=1;settlePhysics(.5);return s.bank[0]===1&&s.bank[1]===0;})()`),true);
console.log('PASS: delayed collection retains the original collector.');

// Combat fixtures deliberately isolate X/Z targeting from the falling simulation.
run(`
view.effects=[];view.effect=(from,to,kind,duration)=>view.effects.push({from,to,kind,duration});view.finishArrow=()=>{};
function combatFixture(){newMatch();s.phase='actions';s.piles=[];s.units=[];s.impacts=[];s.movers=[];s.queue=[];s.after=null;view.effects=[];}
function fighter(type,side,x,z){const t=TYPES[type],u={id:s.nextId++,squad:s.nextId++,type,side,x,z,y:0,vy:0,hp:t.hp,maxhp:t.hp,built:0,falling:false,capture:null};s.units.push(u);return u;}
function stackAt(x,z,layers=4){const p={id:s.nextId++,x,z,width:GOLD_SIZE.w,depth:GOLD_SIZE.d,remaining:layers,bricks:Array.from({length:layers},(_,i)=>({id:s.nextId++,x,z,y:i*GOLD_SIZE.h,vy:0,...GOLD_SIZE,angle:0,c:1,sn:0,hx:GOLD_SIZE.w/2,hz:GOLD_SIZE.d/2,removed:false,falling:false,capture:null,supports:[]}))};s.piles.push(p);return p;}
`);
assert.equal(run(`formation('miner').length===30&&formation('miner').every(p=>Math.hypot(p.x,p.z)<=.5)&&Math.max(...formation('miner').map(p=>Math.hypot(p.x,p.z)))>.48`),true);
console.log('PASS: all 30 miners spawn within a half-cell radius.');
for(const side of [0,1]){
 assert.equal(run(`(()=>{combatFixture();const dir=${side}?1:-1,u=fighter('miner',${side},4,5),front=stackAt(4,5+dir*.2,7),back=stackAt(4,5-dir*.2),far=stackAt(4.6,5+dir*.2),enemy=fighter('miner',1-${side},4.12,5+dir*.12),friend=fighter('miner',${side},4.12,5+dir*.12),rear=fighter('miner',1-${side},4,5-dir*.2);step(u);advanceMovers(1/60);return front.remaining===0&&back.remaining===4&&far.remaining===4&&s.bank[${side}]===7&&!s.units.includes(enemy)&&s.units.includes(friend)&&s.units.includes(rear)&&u.swingAt===s.time&&!s.movers.length&&!view.effects.length;})()`),true);
 assert.equal(run(`(()=>{combatFixture();const dir=${side}?1:-1,u=fighter('giant',${side},4,5),near=stackAt(4.85,5+dir*.25,9),far=stackAt(5.3,5+dir*.25),enemy=fighter('giant',1-${side},4.3,5+dir*.3),rear=fighter('miner',1-${side},4,5-dir*.2);step(u);advanceMovers(1/60);return near.remaining===0&&far.remaining===4&&enemy.hp===37.5&&s.units.includes(rear)&&!view.effects.length;})()`),true);
}
console.log('PASS: both teams sweep forward half circles, collect every stack tier, spare allies/rear targets, and swing without shooting.');
assert.equal(run(`(()=>{combatFixture();const u=fighter('miner',0,4,5),block=fighter('miner',0,4,4.83);startMove(u);let maxSide=0;for(let i=0;i<240&&s.movers.length;i++){advanceMovers(1/60);maxSide=Math.max(maxSide,Math.abs(u.x-4));}return !s.movers.length&&u.z<3.15&&maxSide>.035&&block.z===4.83;})()`),true);
assert.equal(run(`(()=>{combatFixture();const units=formation('miner').map(o=>fighter('miner',0,4+o.x,6+o.z)),before=units.map(u=>u.z);for(const u of units)startMove(u);for(let i=0;i<300&&s.movers.length;i++)advanceMovers(1/60);return !s.movers.length&&units.every((u,i)=>before[i]-u.z>1.65&&before[i]-u.z<=2.00001&&u.x>=.14&&u.x<=7.86);})()`),true);
assert.equal(run(`(()=>{combatFixture();const u=fighter('miner',0,4,5),p=stackAt(4,4,8);startMove(u);for(let i=0;i<100&&s.movers.length;i++)advanceMovers(.05);const stopped=u.z;advanceMovers(1);return !s.movers.length&&p.remaining===0&&Math.abs(stopped-(4+GOLD_SIZE.d/2+TYPES.miner.reach))<.001&&u.z===stopped&&u.swingAt!==undefined;})()`),true);
console.log('PASS: miners sidestep stationary friends, dense squads advance without queueing, and stop exactly at first gold contact.');
for(const side of [0,1]){
 assert.equal(run(`(()=>{combatFixture();const dir=${side}?1:-1,u=fighter('arrow',${side},4,${side}?1:9),friend=fighter('giant',${side},4,${side}?2:8),p=stackAt(4,${side}?3:7,10),back=stackAt(4.3,(${side}?3:7)-dir*.3,5),far=stackAt(4.8,${side}?3:7,3);actionQueue([u],()=>{});if(s.queue.length!==1)return false;s.queue.shift()();const arrow=s.impacts[0];advanceArrow(arrow,.1);if(p.remaining!==10||s.bank[${side}]!==0)return false;for(let i=0;i<30&&s.impacts.length;i++)advanceArrow(arrow,.05);return s.impacts.length===0&&p.remaining===0&&back.remaining===0&&far.remaining===3&&friend.hp===50&&s.bank[${side}]===15&&view.effects.length===1&&view.effects[0].kind==='arrow'&&view.effects[0].from.x===view.effects[0].to.x&&u.aim===0;})()`),true);
 assert.equal(run(`(()=>{combatFixture();const u=fighter('arrow',${side},4,${side}?1:9),enemy=fighter('cannon',1-${side},4,${side}?3:7);step(u);advanceArrow(s.impacts[0],1);return enemy.hp===100&&s.impacts.length===0&&s.hp[1-${side}]===100;})()`),true);
 assert.equal(run(`(()=>{combatFixture();const u=fighter('arrow',${side},4,${side}?1:9),enemy=fighter('giant',1-${side},4,${side}?3:7);step(u);advanceArrow(s.impacts[0],1);return enemy.hp===45;})()`),true);
 assert.equal(run(`(()=>{combatFixture();const u=fighter('arrow',${side},4,${side}?1:9),offLane=stackAt(4.7,5);step(u);advanceArrow(s.impacts[0],3);return s.hp[1-${side}]===90&&s.hp[${side}]===100&&s.impacts.length===0&&offLane.remaining===4;})()`),true);
}
console.log('PASS: one delayed straight arrow passes through allies, collects a full-circle stack area, deals 50% tower / 10% wall damage, and cannot tunnel.');
assert.equal(run(`(()=>{combatFixture();const u=fighter('arrow',0,4,9);step(u);const enemy=fighter('miner',1,4,7);advanceArrow(s.impacts[0],1);return !s.units.includes(enemy)&&s.hp[1]===100&&!s.impacts.length;})()`),true);
assert.equal(run(`(()=>{combatFixture();const u=fighter('cannon',0,4,9),p=stackAt(4,7,6),enemy=fighter('giant',1,4,5);step(u);if(s.impacts.length!==1||view.effects[0].kind!=='mortar'||s.hp[1]!==100)return false;tick(1.31);return s.hp[1]===100&&p.remaining===6&&enemy.hp===30;})()`),true);
assert.equal(run(`(()=>{combatFixture();const u=fighter('cannon',0,4,9),p=stackAt(4,7,6);step(u);tick(1.31);return s.hp[1]===90&&p.remaining===6;})()`),true);
console.log('PASS: arrows hit newly encountered enemies; cannon ignores gold, hits the nearest enemy in its lane, and falls back to the wall when the lane is clear.');

// Exercise the real Three.js models without needing a GPU-backed renderer.
vm.runInContext(scripts[0],context);
vm.runInContext(scripts[1],context);
assert.equal(run(`(()=>{const modelView=Object.create(HoleDrift3D.prototype);modelView.mats=new Map();modelView.roundedGeos=new Map();modelView.plainBoxGeo=new THREE.BoxGeometry(1,1,1);modelView.plainCylGeo=new THREE.CylinderGeometry(1,1,1,10);modelView.boxGeo=modelView.plainBoxGeo;modelView.cylGeo=modelView.plainCylGeo;modelView.ballGeo=new THREE.SphereGeometry(1,8,6);modelView.scene=new THREE.Scene();modelView.effects=[];const blue=modelView.arrowModel(0),red=modelView.arrowModel(1),miner=modelView.minerModel(0,0),giant=modelView.giantModel(0);modelView.effect({x:4,z:8,y:.54,side:0,projectileId:7},{x:4,z:0,y:.54},'arrow',2);const valid=blue.children.some(m=>m.geometry.type==='ConeGeometry')&&red.rotation.y===Math.PI&&miner.userData.pick.children.length===2&&giant.userData.pick.children.length===2&&modelView.effects[0].mesh.position.z===8;modelView.finishArrow(7);return valid&&modelView.effects.length===0&&modelView.scene.children.length===0;})()`),true);
console.log('PASS: arrow meshes have a shaft, arrowhead and fletching; pickaxes swing as one tool; hit arrows leave the scene.');

assert.equal(run(`TYPES.miner.cost===40&&TYPES.giant.cost===50&&TYPES.arrow.cost===40&&TYPES.cannon.cost===150&&TYPES.giant.reach===1&&CARDS.holeSize.cost===40&&CARDS.holeDamage.cost===40`),true);
assert.equal(run(`(()=>{combatFixture();for(let i=0;i<25;i++){offerCards();if(s.offers.length!==4||new Set(s.offers).size!==4)return false;}s.upgrades[0]=9;offerCards();return s.offers.length===4&&!('reroll' in window.holeDrift)&&!('upgrade' in window.holeDrift);})()`),true);
assert.equal(run(`(()=>{combatFixture();s.phase='build';s.bank[0]=1000;s.offers=['holeSize','miner','arrow','holeDamage'];if(place(0,1,1)||s.bank[0]!==1000||s.offers.length!==4)return false;if(!place(0,s.hole.x,s.hole.z)||s.offers.join(',')!=='miner,arrow,holeDamage'||s.bank[0]!==960)return false;if(!place(0,2,9)||s.offers.join(',')!=='arrow,holeDamage'||s.bank[0]!==920)return false;for(let i=0;i<400&&s.phase==='actions';i++)tick(1/60);if(s.phase!=='build'||s.offers.length!==2)return false;if(!place(0,6,9)||s.offers.join(',')!=='holeDamage'||s.bank[0]!==880)return false;for(let i=0;i<400&&s.phase==='actions';i++)tick(1/60);if(!place(0,7,9)||s.offers.length||s.bank[0]!==840)return false;updateUI();return $('cards').innerHTML===''&&$('bounceInfo').textContent==='0 CARDS LEFT'&&endTurn()&&s.offers.length===0;})()`),true);
console.log('PASS: restored prices and 150-brick cannon, four unique cards per turn, 4→3→2→1→0 consumption, no reroll/replacement, and valid unit/tower placement.');
for(const side of [0,1]){
 assert.equal(run(`(()=>{combatFixture();s.side=${side};resetHole();s.phase='build';s.bank[${side}]=200;s.offers=['holeSize','holeSize','holeDamage','holeDamage'];const z=s.side?1:9,id=s.hole.id;
 if(!place(0,1,z)||!place(0,2,z)||!place(0,3,z)||!place(0,5,z))return false;
 if(s.hole.id!==id||s.hole.level!==3||Math.abs(s.hole.r-.44)>1e-8||s.hole.damage!==9||s.bank[s.side]!==40||s.units.length!==4||s.impacts.length)return false;
 const size=s.units.filter(u=>u.type==='holeSize'),damage=s.units.filter(u=>u.type==='holeDamage');
 damageUnit(size[0],50);if(s.hole.level!==3||size[0].hp!==20)return false;
 damageUnit(size[0],50);damageUnit(damage[0],100);if(s.hole.level!==2||s.hole.damage!==7)return false;
 endTurn();s.phase='build';endTurn();if(s.side!==${side}||s.hole.level!==2||s.hole.damage!==7)return false;
 damageUnit(size[1],100);damageUnit(damage[1],100);return s.hole.level===1&&s.hole.r===.28&&s.hole.damage===5;
 })()`),true);
}
assert.equal(run(`(()=>{combatFixture();s.phase='build';s.bank[0]=40;s.offers=['holeSize'];if(place(0,1,1)||s.bank[0]!==40||!place(0,1,9))return false;s.offers=['holeDamage'];return !place(0,2,9)&&s.offers.length===1&&s.units.length===1;})()`),true);
assert.equal(run(`(()=>{combatFixture();const size=fighter('holeSize',1,4,5),damage=fighter('holeDamage',1,4,5);s.side=1;resetHole();if(s.hole.level!==2||s.hole.damage!==7)return false;for(let i=0;i<9;i++)fighter('holeSize',0,1,9);s.side=0;s.phase='drift';resetHole();s.hole.x=4;s.hole.z=5;settlePhysics(.8);if(s.units.some(u=>u.side===1)||s.upgrades[1]||s.damageUpgrades[1]||s.bank[0]!==40)return false;s.side=1;resetHole();return s.hole.level===1&&s.hole.damage===5;})()`),true);
assert.equal(run(`(()=>{combatFixture();for(let i=0;i<11;i++)fighter('holeSize',0,1,9);fighter('holeSize',1,7,1);resetHole();if(s.hole.level!==10||s.hole.r!==1)return false;damageUnit(s.units[0],100);if(s.hole.level!==10)return false;damageUnit(s.units[0],100);damageUnit(s.units[0],100);return s.hole.level===9&&s.upgrades[1]===1;})()`),true);
assert.equal(run(`['holeSize','holeDamage'].every(k=>TYPES[k].hp===40&&TYPES[k].kind==='tower'&&TYPES[k].scale===.5625&&TYPES[k].w===.75)&&['arrow','cannon'].every(k=>TYPES[k].scale===.5625*.75&&TYPES[k].w===.75*.75&&TYPES[k].d===.75*.75)`),true);
console.log('PASS: ground placement, passive 40 HP power towers, additive team bonuses, destruction rollback, swallowed bonuses, level cap and combat tower scaling.');
assert.equal(run(`(()=>{const p=physicsFixture(50),r=s.hole.r;settlePhysics(3);return s.bank[0]===50&&p.remaining===0&&s.hole.r===r&&s.hole.level===1;})()`),true);
console.log('PASS: swallowing gold never grows the hole.');
assert.equal(run(`(()=>{combatFixture();const early=fighter('miner',0,4,5),late=fighter('giant',0,7,7),p=stackAt(4,4.8,10),origin=late.z;actionQueue([early,late],()=>s.phase='build');if(s.queue.length!==1)return false;s.queue.shift()();for(let i=0;i<30;i++)tick(1/60);if(p.remaining!==10||s.bank[0]!==0||early.swingAt!==undefined||late.swingAt!==undefined||late.z>=origin)return false;for(let i=0;i<300&&s.movers.length;i++)tick(1/60);const stamp=early.swingAt;if(stamp===undefined||late.swingAt!==stamp||p.remaining!==0||s.bank[0]!==10||Math.abs(late.z-(origin-2))>.001)return false;for(let i=0;i<60;i++)tick(1/60);return early.swingAt===stamp&&late.swingAt===stamp&&s.bank[0]===10&&s.meleeBatch.length===0&&s.phase==='build';})()`),true);
assert.equal(run(`(()=>{combatFixture();s.phase='build';s.side=1;resetHole();s.bank[1]=80;s.offers=['holeSize','holeDamage'];ai();ai();if(s.offers.length!==0||s.bank[1]!==0||s.upgrades[1]!==1||s.damageUpgrades[1]!==1)return false;ai();return s.side===0&&s.phase==='aim';})()`),true);
console.log('PASS: different squads and unit types finish moving before one shared attack; AI uses its finite upgrade hand and ends the turn.');

assert.equal(run(`(()=>{const renderer=Object.create(HoleDrift3D.prototype),shared=new THREE.MeshStandardMaterial({color:0x387cd1}),geometry=new THREE.BoxGeometry(1,1,1),blue=new THREE.Group(),red=new THREE.Group();blue.add(new THREE.Mesh(geometry,shared));red.add(new THREE.Mesh(geometry,shared));blue.children[0].castShadow=true;renderer.sinkPlane=new THREE.Plane(new THREE.Vector3(0,1,0),1);renderer.prepareUnitMaterials(blue,0);renderer.prepareUnitMaterials(red,1);for(const phase of ['aim','drift']){renderer.setUnitOpacity(blue,unitOpacity({side:0},{side:0,phase}));if(blue.children[0].material.opacity!==.5)return false;}const m=blue.children[0].material;if(!m.transparent||m.depthWrite||blue.children[0].castShadow||shared.opacity!==1||red.children[0].material.opacity!==1)return false;if(unitOpacity({side:1},{side:0,phase:'build'})!==1||unitOpacity({side:0},{side:0,phase:'over'})!==1)return false;renderer.setUnitOpacity(blue,unitOpacity({side:0},{side:1,phase:'aim'}));return m.opacity===1&&!m.transparent&&m.depthWrite&&blue.children[0].castShadow;})()`),true);
console.log('PASS: fading preserves independent team/scenery materials and restores opacity, depth and shadows.');

for(const side of [0,1]){
 assert.equal(run(`(()=>{const own={side:${side}},other={side:1-${side}};for(const phase of ['aim','drift','settle','actions','build','over']){const state={side:${side},phase,offers:['holeSize','holeDamage','miner'],selected:0};if(unitOpacity(own,state)!==(['aim','drift'].includes(phase)?.5:1)||unitOpacity(other,state)!==1)return false;}const state={side:${side},phase:'build',offers:['holeSize','holeDamage','miner'],selected:0};for(const i of [0,1]){const dragging={side:${side},i,moved:true};if(unitOpacity(own,state,dragging)!==1||unitOpacity(other,state,dragging)!==1||unitOpacity(own,state,{...dragging,moved:false})!==1)return false;}return unitOpacity(own,state,{side:${side},i:2,moved:true})===1&&unitOpacity(own,state,{side:1-${side},i:0,moved:true})===1&&unitOpacity(own,state,null)===1;})()`),true);
}
console.log('PASS: both teams fade only during their own aim/drift; all tower placement stays opaque.');

// Defensive walls must reflect holes without being collected or taking repeated contact damage.
for(const side of [0,1]){
 assert.equal(run(`(()=>{combatFixture();s.side=${side};s.phase='drift';const dir=s.side?1:-1,w=fighter('wall',1-s.side,4,5);s.hole={x:4,z:5-dir*1.2,r:.28,level:1,damage:7,vx:0,vz:dir*4.65};driftStep(.3);const hp=w.hp;driftStep(.02);return s.hole.vz*dir<0&&hp===148.8&&w.hp===hp&&s.bounces===1;})()`),true);
 assert.equal(run(`(()=>{combatFixture();s.side=${side};s.phase='drift';const dir=s.side?1:-1,w=fighter('wall',s.side,4,5);s.hole={x:4,z:5-dir*1.2,r:.28,level:1,damage:5,vx:0,vz:dir*4.65};driftStep(.5);advanceFalling(.1);return s.hole.vz*dir>0&&(s.hole.z-5)*dir>0&&w.hp===160&&s.bounces===0&&unitOpacity(w,s)===.5;})()`),true);
}
assert.equal(run(`(()=>{combatFixture();s.phase='drift';const w=fighter('wall',1,4,5);s.hole={x:3,z:5,r:.28,level:1,damage:5,vx:4.65,vz:0};driftStep(.1);return s.hole.vx<0&&w.hp===152&&s.bounces===1;})()`),true);
assert.equal(run(`(()=>{combatFixture();s.phase='drift';const w=fighter('wall',1,4,5);w.hp=8;s.hole={x:4,z:5.6,r:.28,level:1,damage:5,vx:0,vz:-4.65};driftStep(.05);return !s.units.includes(w)&&s.hole.vz>0&&s.bounces===1;})()`),true);
assert.equal(run(`(()=>{combatFixture();s.phase='drift';const w=fighter('wall',1,4,5);s.hole.x=4;s.hole.z=5;s.hole.r=3;advanceFalling(.5);return w.y===0&&!w.capture&&s.units.includes(w);})()`),true);
assert.equal(run(`(()=>{combatFixture();s.phase='build';s.bank[0]=40;s.offers=['wall'];if(canPlace(.4,9,'wall')||!place(0,4,9))return false;const w=s.units[0];step(w);return w.hp===TYPES.arrow.hp*4&&s.bank[0]===0&&!s.offers.length&&s.phase==='build'&&!s.impacts.length&&cardBox('wall').w===1&&cardBox('wall').d===.5;})()`),true);
assert.equal(run(`(()=>{const v=Object.create(HoleDrift3D.prototype);v.mats=new Map();v.roundedGeos=new Map();const g=v.wallModel(0),b=new THREE.Box3().setFromObject(g),size=b.getSize(new THREE.Vector3());return Math.abs(size.x-1)<1e-6&&Math.abs(size.z-.5)<1e-6&&Math.abs(size.y-.5)<1e-6;})()`),true);
console.log('PASS: wall placement, exact model dimensions, 160 HP, passive behavior, both-team pass-through, enemy reflection, damage, destruction, and swallow immunity.');
assert.equal(run(`(()=>{const v=Object.create(HoleDrift3D.prototype);v.mats=new Map();v.roundedGeos=new Map();v.boxGeo=new THREE.BoxGeometry(1,1,1);v.cylGeo=new THREE.CylinderGeometry(1,1,1,16);v.ballGeo=new THREE.SphereGeometry(1,16,12);return ['holeSize','holeDamage'].every(type=>{const model=v.unitModel(type,0);model.scale.setScalar(TYPES[type].scale);const size=new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());return size.x<=TYPES[type].w&&size.z<=TYPES[type].d&&size.y<=TYPES[type].height&&model.children.length>=5;});})()`),true);
console.log('PASS: both power tower models fit their full-size footprints and capture heights.');
