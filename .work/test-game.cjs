const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('Hole-Drift.html','utf8');
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
for(const script of scripts)new vm.Script(script);
const elements=new Map();
const element=()=>({style:{},classList:{toggle(){}},addEventListener(){},hidden:false,innerHTML:'',textContent:'',showModal(){},close(){}});
const context=vm.createContext({console,Math,Set,Map,JSON,Number,Infinity,document:{getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);},addEventListener(){}},window:{},navigator:{},requestAnimationFrame(){},HoleDrift3D:class{reset(){}icon(){return '';}effect(){}draw(){}}});
vm.runInContext(scripts[2],context);
const run=code=>vm.runInContext(code,context);
let bars=0;
for(let match=0;match<100;match++){
 run('newMatch()');
 const info=run(`(()=>{let low=Infinity,high=-Infinity,left=Infinity,right=-Infinity,crossings=0;for(const p of s.piles)for(let i=0;i<p.cols.length;i++){const b=brickPos(p,i),h=brickHalfBounds(b);low=Math.min(low,b.z-h.z);high=Math.max(high,b.z+h.z);left=Math.min(left,b.x-h.x);right=Math.max(right,b.x+h.x);}for(const p of s.piles)for(const q of s.piles){if(p.id>=q.id)continue;for(let i=0;i<p.cols.length;i++)for(let j=0;j<q.cols.length;j++){const b=brickPos(p,i),a=brickPos(q,j);const h=brickHalfBounds(a);if(brickTouchesRect(b,a.x,a.z,h.x*2,h.z*2))crossings++;}}return {low,high,left,right,crossings,n:s.piles.length,bars:s.piles.reduce((v,p)=>v+count(p),0),shapes:new Set(s.piles.map(p=>p.shape)).size};})()`);
 assert.ok(info.low>=2-1e-8 && info.high<=8+1e-8,'two full clear rows');
 assert.ok(info.left>=.22-1e-8&&info.right<=7.78+1e-8,'inside side walls');
 assert.equal(info.n,9);assert.ok(info.shapes>=5);assert.equal(info.crossings,0,'separate piles must not overlap');bars=info.bars;
 assert.equal(run(`(()=>{for(let z of [.5,1.5,8.5,9.5])for(let x=.5;x<8;x++)if(!canPlace(x,z,'soldier',z<2?1:0))return false;return true;})()`),true);
}
console.log('PASS: 100 randomized layouts; all 32 HQ deployment cells clear; 9 non-overlapping piles; '+bars+' gold bars.');
run(`newMatch();s.piles=[createPile(4,5,'round',.34)];`);
assert.equal(run(`(()=>{const p=s.piles[0],b=brickPos(p,0),h={x:b.x,z:b.z,r:.08,contacts:new Set(),eaten:0,owner:{}};const before=count(p);holeCollect(h,b.x,b.z,0,false);const first=count(p);holeCollect(h,b.x,b.z,0,false);const second=count(p);h.x=0;h.z=0;holeCollect(h,0,0,0,false);h.x=b.x;h.z=b.z;holeCollect(h,b.x,b.z,0,false);return first===before-1&&second===first&&count(p)===first-1;})()`),true);
console.log('PASS: rotated stacks collect once per contact, then collect again after leaving.');
assert.equal(run(`(()=>{newMatch();const p=s.piles[0],b=brickPos(p,0),u={x:b.x,z:9,side:0,column:Math.floor(b.x)};const t=targetFor(u);return t?.kind==='bricks'&&t.p.cols[t.index]>0;})()`),true);
assert.equal(run(`(()=>{newMatch();const p=s.piles[0],b=brickPos(p,0);return !canPlace(Math.floor(b.x)+.5,Math.floor(b.z)+.5,'tank',1)&&bricksBlocked(b.x,b.z,.1,.1);})()`),true);
assert.equal(run(`(()=>{newMatch();const p=s.piles[0],b=brickPos(p,0),target={cellX:Math.floor(b.x),cellZ:Math.floor(b.z)};const before=count(p);harvest(p,0,'all',target);return count(p)>0&&count(p)<before&&s.bank[0]===before-count(p);})()`),true);
console.log('PASS: targeting finds free-positioned gold; occupied cells are blocked; explosions clear only their targeted cell.');
for(let angle of [-1.2,-.8,-.3,0,.4,.9,1.2]){
 run(`newMatch();launch(${angle});for(let i=0;i<4000&&s.phase==='drift';i++)tick(1/60);`);
 const state=run('window.holeDrift.getState()');
 assert.equal(state.phase,'build');assert.ok(state.bank[0]>0);assert.ok(state.hp[1]<=100);assert.ok(state.piles.every(p=>p.cols.every(n=>Number.isInteger(n)&&n>=0)));
 assert.equal(run('s.totalCollected[0]+s.piles.reduce((n,p)=>n+count(p),0)'),bars,'gold accounting');
}
console.log('PASS: seven complete drifts reach building, collect gold, and conserve all gold bars.');
run(`newMatch();launch(.45);for(let i=0;i<4000&&s.phase==='drift';i++)tick(1/60);`);
assert.equal(run(`(()=>{s.bank[0]=500;s.offers=['soldier','tank','mg'];const ok=place(0,3.5,8.5);for(let i=0;i<1500&&s.phase==='actions';i++)tick(1/60);return ok&&s.phase==='build'&&s.units.length===8;})()`),true);
run(`endTurn();for(let i=0;i<16000&&s.side===1&&s.phase!=='over';i++)tick(1/60);`);
assert.equal(run('s.side'),0);assert.equal(run('s.phase'),'aim');
console.log('PASS: build a squad, resolve actions, complete the AI turn and return to player aim.');
assert.equal(run(`(()=>{newMatch();s.piles.forEach(p=>p.cols.fill(0));s.units=[{x:4,z:5,type:'tank',side:0}];seedBricks();return s.piles.every(p=>p.cols.every((n,i)=>!n||!brickTouchesRect(brickPos(p,i),4,5,.5,.5)));})()`),true);
console.log('PASS: replenishment avoids surviving units.');
assert.equal(run(`(()=>{newMatch();for(const p of s.piles)for(let i=0;i<p.cols.length;i++)for(let l=0;l<p.cols[i];l++){const b=brickPos(p,i,l),h=brickHalfBounds(b);if(b.z-h.z<2-1e-8||b.z+h.z>8+1e-8)return false;}return true;})()`),true);
assert.equal(run(`(()=>{newMatch();const p=s.piles[0],target={cellX:Math.floor(p.x),cellZ:Math.floor(p.z)};harvest(p,0,'all',target);for(let i=0;i<p.cols.length;i++){if(p.cols[i]!==p.layout[i].levels.length-p.offsets[i])return false;for(let l=0;l<p.cols[i];l++)if(brickTouchesRect(brickPos(p,i,l),target.cellX+.5,target.cellZ+.5,1,1))return false;}return count(p)>0;})()`),true);
console.log('PASS: every staggered upper tier respects the clear rows; cell blasts remove all affected bars and retain other tiers.');
