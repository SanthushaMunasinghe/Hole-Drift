const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const elements=new Map(),element=()=>({style:{},classList:{toggle(){}},addEventListener(){},hidden:false,innerHTML:'',textContent:''});
let seed=42;
const math=Object.create(Math);math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32);
const context=vm.createContext({console,Math:math,document:{getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);},addEventListener(){}},window:{},navigator:{},requestAnimationFrame(){},HoleDrift3D:class{reset(){}icon(){return '';}effect(){}finishArrow(){}}});
for(const script of scripts)new vm.Script(script);
vm.runInContext(scripts[2],context);
const run=code=>vm.runInContext(code,context);
run(`function fixture(){newMatch();s.units=[];s.piles=[];s.phase='drift';}
function wall(w,x=4,z=5){const u={id:s.nextId++,type:'wall',side:-1,x,z,w,d:.5,hp:160,maxhp:160,y:0,vy:0,built:-1};s.units.push(u);return u;}
function fighter(type,side,x,z){const t=TYPES[type],u={id:s.nextId++,squad:s.nextId++,type,side,x,z,hp:t.hp,maxhp:t.hp,y:0,vy:0};s.units.push(u);return u;}`);
assert.equal(run(`(()=>{
 const counts=new Set(),widths=new Set(),layouts=new Set();
 for(let i=0;i<60;i++){
  newMatch();const walls=s.units.filter(u=>u.side===-1);counts.add(walls.length);
  if(walls.length<3||walls.length>5||s.piles.length!==12)return false;
  layouts.add(JSON.stringify(walls.map(u=>[u.x,u.z,u.w])));
  for(const u of walls){widths.add(u.w);if(u.w!==1||u.hp!==160||u.x-u.w/2<0||u.x+u.w/2>8||u.z-.25<2||u.z+.25>8)return false;
   if(!s.piles.some(p=>p.bricks.some(b=>brickTouchesRect(b,u.x,u.z,u.w+.16,u.d+.16))))return false;
   if(walls.some(v=>v!==u&&overlap(u.x,u.z,...dims(u),v.x,v.z,...dims(v))))return false;
   if(s.piles.some(p=>p.bricks.some(b=>brickTouchesRect(b,u.x,u.z,...dims(u)))))return false;
  }
  const near=s.piles.filter(p=>p.z>5),far=s.piles.filter(p=>p.z<5);
  if(near.length===far.length&&near.every(p=>far.some(q=>Math.abs(q.z-(10-p.z))<1e-6&&q.shape===p.shape)))return false;
 }
 return counts.size===3&&widths.size===1&&layouts.size===60;
})()`),true);
console.log('PASS: 60 levels have 3–5 random full-cell walls, 160 HP, clear HQ rows, no gold intersections and asymmetric gold layouts.');
assert.equal(run(`(()=>{newMatch();const walls=s.units.slice(),u=walls[0];damageUnit(u,25);s.phase='build';endTurn();if(s.units.length!==walls.length||u.hp!==120)return false;s.piles=[];seedBricks();if(s.units.length!==walls.length||u.hp!==120)return false;damageUnit(u,100);s.piles=[];seedBricks();return !s.units.includes(u)&&s.units.length===walls.length-1&&s.piles.every(p=>p.bricks.every(b=>s.units.every(w=>!brickTouchesRect(b,w.x,w.z,...dims(w)))));})()`),true);
console.log('PASS: walls and damage persist through turns/refills; destroyed walls stay removed.');
for(const side of [0,1])for(const width of [1]){
 assert.equal(run(`(()=>{fixture();s.side=${side};const u=wall(${width}),dir=s.side?1:-1;s.hole={x:4,z:5-dir*1.2,r:.28,level:1,damage:5,vx:0,vz:dir*4.65};driftStep(.3);const hp=u.hp;driftStep(.02);if(s.hole.vz*dir>=0||hp!==152||u.hp!==hp||s.bounces!==1||unitOpacity(u,s)!==1)return false;s.hole.x=4;s.hole.z=5;s.hole.r=3;advanceFalling(.5);return !u.capture&&u.y===0&&s.bank[0]===0&&s.bank[1]===0;})()`),true);
 assert.equal(run(`(()=>{fixture();s.side=${side};const u=wall(${width}),dir=s.side?1:-1,a=fighter('arrow',s.side,4,s.side?1:9);fireArrow(a);advanceArrow(s.impacts[0],3);return u.hp===144&&s.hp[0]===100&&s.hp[1]===100;})()`),true);
 assert.equal(run(`(()=>{fixture();s.side=${side};const u=wall(${width}),dir=s.side?1:-1,a=fighter('miner',s.side,4,5-dir*.4);if(meleeTarget(a)?.u!==u)return false;areaDamage(s.side,a,TYPES.miner.reach,5,{forward:true,wallDamage:4});return u.hp===153.6;})()`),true);
 assert.equal(run(`(()=>{fixture();s.side=${side};const u=wall(${width}),a=fighter('cannon',s.side,4,s.side?1:9);const target=targetFor(a,30,{bricks:false});return target?.u===u;})()`),true);
}
console.log('PASS: both teams bounce off, damage and target full-cell walls; neutral walls stay opaque and cannot be swallowed.');
assert.equal(run(`(()=>{fixture();const u=wall(.5);s.hole={x:4.65,z:5,r:.28,level:1,damage:5,vx:-4.65,vz:0};if(bounceOffWalls(s.hole)||u.hp!==160)return false;s.hole.x=4.5;if(!bounceOffWalls(s.hole)||u.hp!==152)return false;const a=fighter('arrow',0,4.4,9);fireArrow(a);if(s.impacts[0].stopWall)return false;u.w=1;fireArrow(a);return s.impacts[1].stopWall===u;})()`),true);
assert.equal(run(`(()=>{fixture();const u=wall(.5),a=fighter('miner',0,4.65,5.1);if(meleeTarget(a))return false;areaDamage(0,a,.2,5,{forward:true,wallDamage:4});if(u.hp!==160)return false;u.w=1;return meleeTarget(a)?.u===u;})()`),true);
assert.equal(run(`(()=>{fixture();s.phase='build';fighter('wall',0,1,3);wall(.5,4,5);return !canPlace(4,5,'wall')&&canPlace(4.76,5,'wall');})()`),true);
assert.equal(run(`(()=>{fixture();const u=wall(.5);u.hp=8;s.hole={x:4,z:5.6,r:.28,level:1,damage:5,vx:0,vz:-4.65};driftStep(.05);return !s.units.includes(u)&&s.hole.vz>0&&s.bank[0]===0&&s.hp.every(v=>v===100);})()`),true);
console.log('PASS: narrow wall edges agree for holes, arrows, melee and placement; destruction does not affect team health or gold.');
vm.runInContext(scripts[0],context);vm.runInContext(scripts[1],context);
assert.equal(run(`(()=>{const v=Object.create(HoleDrift3D.prototype);v.mats=new Map();v.roundedGeos=new Map();for(const width of [1]){const g=v.wallModel(-1),blue=v.wallModel(0);g.scale.x=width;const size=new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3());if(Math.abs(size.x-width)>1e-6||Math.abs(size.y-.5)>1e-6||Math.abs(size.z-.5)>1e-6||g.children.length<7)return false;if(!g.children.every(m=>{const c=m.material.color;return Math.max(c.r,c.g,c.b)-Math.min(c.r,c.g,c.b)<.1&&Math.min(c.r,c.g,c.b)>.08;}))return false;}return true;})()`),true);
console.log('PASS: neutral rock walls have varied gray stones and exact full-cell dimensions.');
