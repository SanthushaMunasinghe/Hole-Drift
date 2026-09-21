const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const elements=new Map(),element=()=>({style:{},classList:{toggle(){}},addEventListener(){},hidden:false,innerHTML:'',textContent:''});
const context=vm.createContext({console,Math,document:{getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);},addEventListener(){}},window:{},navigator:{},requestAnimationFrame(){},HoleDrift3D:class{reset(){this.effects=[];}icon(){return '';}effect(from,to,kind,duration){this.effects.push({from,to,kind,duration});}}});
for(const script of scripts)new vm.Script(script);
vm.runInContext(scripts[2],context);const run=code=>vm.runInContext(code,context);
run(`function fixture(side){newMatch();s.units=[];s.piles=[];s.side=side;resetHole();s.phase='build';s.bank[side]=1000;s.offers=['holeSize','holeDamage'];}
function nextOwnTurn(){s.phase='build';endTurn();s.phase='build';endTurn();}
function completeDrift(){if(s.phase!=='aim')s.phase='aim';launch(0);finishDrift();tick(.01);}`);
for(const side of [0,1]){
 assert.equal(run(`(()=>{fixture(${side});const initial=s.hole.r,z=s.side?1:9;
  if(!place(0,1,z))return false;s.phase='build';if(!place(0,7,z))return false;
  if(Math.abs((s.hole.r-initial)*2-SMALL_CELL)>1e-9||s.hole.damage!==7||view.effects.length!==2)return false;
  if(view.effects[0].kind!=='powerSize'||view.effects[1].kind!=='powerDamage'||view.effects.some(e=>e.to.side!==s.side||e.to.holeId!==s.hole.id||e.to.z!==z))return false;
  for(let i=0;i<5;i++)syncPowerTowers();resetHole();if(view.effects.length!==2||s.hole.damage!==7)return false;
  nextOwnTurn();if(view.effects.length!==2||s.hole.damage!==7||Math.abs((s.hole.r-initial)*2-SMALL_CELL)>1e-9)return false;
  launch(0);syncPowerTowers();if(view.effects.length!==2||s.hole.damage!==7)return false;finishDrift();tick(.01);
  if(Math.abs((s.hole.r-initial)*2-.2)>1e-9||s.hole.damage!==9||view.effects.length!==4)return false;
  const bursts=view.effects.slice(2);if(bursts.some(e=>e.to.holeId!==s.hole.id||e.to.side!==s.side||e.to.z!==z))return false;
  damageUnit(s.units[0],100);damageUnit(s.units[0],100);nextOwnTurn();completeDrift();
  return s.hole.damage===9&&Math.abs((s.hole.r-initial)*2-.2)<1e-9&&view.effects.length===4;
 })()`),true);
}
console.log('PASS: both teams gain 0.1 cell in diameter and +2 damage points on build and after its own drift only; no boosts at turn start or mid-drift; bursts target the new hole, never duplicate, and earned upgrades persist.');
assert.equal(run(`(()=>{fixture(0);s.offers=['holeSize'];place(0,1,9);const u=s.units[0];u.capture={side:1};nextOwnTurn();completeDrift();if(s.hole.level!==2||view.effects.length!==1)return false;u.capture=null;u.hp=0;nextOwnTurn();completeDrift();return s.hole.level===2&&view.effects.length===1;})()`),true);
assert.equal(run(`(()=>{fixture(0);s.upgrades[0]=MAXLEVEL-1;resetHole();s.offers=['holeSize','holeDamage'];place(0,1,9);s.phase='build';place(0,7,9);nextOwnTurn();completeDrift();return s.hole.level===10&&Math.abs(s.hole.r-.73)<1e-9&&s.hole.damage===9&&view.effects.length===2&&view.effects.every(e=>e.kind==='powerDamage');})()`),true);
console.log('PASS: captured/dead towers do not activate; size stays capped without a false lightning burst; damage continues at +2 points.');
vm.runInContext(scripts[0],context);vm.runInContext(scripts[1],context);
assert.equal(run(`(()=>{const v=Object.create(HoleDrift3D.prototype);v.scene=new THREE.Scene();v.effects=[];
 const state={side:0,phase:'aim',hole:{id:9,x:4,z:9,r:.33}};
 for(const kind of ['powerSize','powerDamage'])v.effect({x:1,z:8,y:.45},{x:4,z:9,y:.06,side:0,holeId:9},kind,1.25);
 const [size,damage]=v.effects;if(size.mesh.children[0].material.color.equals(damage.mesh.children[0].material.color))return false;
 let disposed=0;for(const e of v.effects)e.mesh.traverse(m=>{if(m.isMesh){m.geometry.addEventListener('dispose',()=>disposed++);m.material.addEventListener('dispose',()=>disposed++);}});
 v.updatePowerBolts(state,.1);const p=size.mesh.children[0].geometry.attributes.position;
 if(![...p.array].every(Number.isFinite)||size.mesh.children[2].position.x!==4||size.mesh.children[2].position.z!==9)return false;
 state.phase='drift';state.hole.x=5;state.hole.z=7;v.updatePowerBolts(state,.1);
 const endX=(p.getX(70)+p.getX(71))/2,endZ=(p.getZ(70)+p.getZ(71))/2;
 if(Math.abs(endX-5)>1e-5||Math.abs(endZ-7)>1e-5)return false;
 v.updatePowerBolts(state,1.1);if(v.effects.length||v.scene.children.length||disposed!==12)return false;
 v.effect({x:1,z:8,y:.45},{side:0,holeId:9},'powerSize',1.25);state.side=1;v.updatePowerBolts(state,.01);
 if(v.effects.length||v.scene.children.length)return false;
 state.side=0;v.effect({x:1,z:8,y:.45},{side:0,holeId:8},'powerDamage',1.25);v.updatePowerBolts(state,.01);
 return !v.effects.length&&!v.scene.children.length;
})()`),true);
console.log('PASS: distinct blue/amber lightning follows its hole, fades, releases geometry/materials and never carries over to another hole or team.');
