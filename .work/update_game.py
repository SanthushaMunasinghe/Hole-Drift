from pathlib import Path
import re

root = Path(__file__).resolve().parent.parent
source = (root / '.work/Hole-Drift.before.html').read_text(encoding='utf-8')
visuals = (root / '.work/visuals.js').read_text(encoding='utf-8')
def method(text, name, replacement):
    pattern = rf'^ {name}\([^\n]*(?:\n(?! [a-zA-Z]+\(|}})[^\n]*)*'
    result, n = re.subn(pattern, lambda _: replacement.rstrip(), text, count=1, flags=re.M)
    assert n == 1, name
    return result

start = source.index('class HoleDrift3D {')
end = source.index('</script><script>\'use strict\';', start)
renderer = source[start:end]
constructor = visuals[:visuals.index(' roundedGeometry(')]
methods = visuals[visuals.index(' roundedGeometry('):]
renderer = method(renderer, 'constructor', constructor)
renderer = method(renderer, 'mat', '')
renderer = method(renderer, 'floor', '')
renderer = renderer.replace('{x:p.x,z:p.z}:null','{x:p.x,z:p.z/1.08}:null')
renderer = renderer.replace('new THREE.Vector3(u.x,1.12,u.z).project(this.camera)','new THREE.Vector3(u.x,1.12*1.65,u.z*1.08).project(this.camera)')
renderer = renderer.replace(' soldierModel(', methods + '\n soldierModel(', 1)
renderer = method(renderer, 'resize', ''' resize(){
  const r=this.canvas.getBoundingClientRect(),a=r.width/Math.max(1,r.height),h=Math.max(7.1,4.65/a);
  this.renderer.setSize(r.width,r.height,false);Object.assign(this.camera,{left:-h*a,right:h*a,top:h,bottom:-h});this.camera.updateProjectionMatrix();this.camera.updateMatrixWorld();
 }''')
renderer = method(renderer, 'reset', ''' reset(){
  for(const m of this.unitMeshes.values())this.scene.remove(m);for(const e of this.effects)this.scene.remove(e.mesh);for(const m of this.shotMeshes.values())this.scene.remove(m);
  for(const shadow of this.pileShadows.values()){this.scene.remove(shadow);shadow.geometry.dispose();}
  this.pileShadows.clear();this.gold.count=0;this.shotMeshes.clear();this.bricks.clear();this.unitMeshes.clear();this.effects=[];this.labels.innerHTML='';this.labelEls.clear();
 }''')
renderer = re.sub(r'^  const live=new Set\(\);for\(const p of s.piles\).*$', '  this.drawGold(s,dt);', renderer, flags=re.M)
renderer = renderer.replace("kind==='brick'?this.boxGeo:this.ballGeo,this.mat(kind==='brick'?0xdca36b:from.side?0xff5959:0x57adff)", "kind==='brick'?this.goldGeo:this.ballGeo,kind==='brick'?this.goldMat:this.mat(from.side?0xff5959:0x57adff)")
renderer = renderer.replace("if(kind==='brick')mesh.scale.set(.24,.12,.16)", "if(kind==='brick')mesh.scale.setScalar(.8)")
renderer = renderer.replace('s.side?0xff7c79:0x81c5ff','s.side?0xffb5a5:0xf7f4e3')
renderer = re.sub(r"^  for\(const \[id,z\]of \[\['playerHUD'.*$", '''  const rect=this.canvas.getBoundingClientRect();
  for(const [id,z]of [['playerHUD',10.27],['enemyHUD',-.27]]){
   const el=document.getElementById(id),left=new THREE.Vector3(-.05,.37*1.65,(z+.29)*1.08).project(this.camera),right=new THREE.Vector3(8.05,.37*1.65,(z+.29)*1.08).project(this.camera);
   el.style.left=((left.x*.5+.5)*rect.width)+'px';el.style.right=((.5-right.x*.5)*rect.width)+'px';el.style.top=((-left.y*.5+.5)*rect.height-7)+'px';el.style.bottom='auto';
  }
  const badge=new THREE.Vector3(4,1.48*1.65,-.25*1.08).project(this.camera),phase=document.getElementById('phaseBadge');
  phase.style.top=((-badge.y*.5+.5)*rect.height-10)+'px';
  this.renderer.render(this.scene,this.camera);''', renderer, flags=re.M)
source = source[:start] + renderer + source[end:]

def function(name, replacement):
    global source
    source,n = re.subn(r'^function '+name+r'\([^\n]*$',lambda _:replacement.rstrip(),source,count=1,flags=re.M)
    assert n==1,name

function('brickPos',(root / '.work/piles.js').read_text(encoding='utf-8'))
# Remove the old square-only generator, which follows the newly inserted functions.
source,n=re.subn(r'^function seedBricks\(\)\{if\(s.piles.some\(count\)\).*$', '', source, count=1, flags=re.M)
assert n==1
source=source.replace('p.offsets??=Array(8).fill(0)','p.offsets??=Array(p.cols.length).fill(0)')
source=source.replace('for(let i=0;i<8;i++)if(p.cols[i]>max)', 'for(let i=0;i<p.cols.length;i++)if(p.cols[i]>max)')
source=source.replace('return !s.piles.some(p=>p.x===col&&p.z===row&&count(p));','return !bricksBlocked(x,z,1,1);')
function('holeCollect', '''function holeCollect(h,ax,az,side,main=false){
 const active=new Set();
 for(const p of s.piles)for(let i=0;i<p.cols.length;i++){
  if(!p.cols[i])continue;
  const k=p.id+':'+i,b=brickPos(p,i),a=brickLocal(b,ax,az),v=brickLocal(b,h.x,h.z);
  if(sweptHit(a.x,a.z,v.x,v.z,h.r*.9,-b.w/2,-b.d/2,b.w/2,b.d/2)&&!h.contacts.has(k)){
   collectColumn(p,i,side,main);h.contacts.add(k);
   if(!main){h.eaten++;h.r=Math.min(.5,h.r+.012);h.owner.fed=(h.owner.fed||0)+1;}
  }
  if(pointRectDist(v.x,v.z,-b.w/2,-b.d/2,b.w/2,b.d/2)<(h.r+.05)**2)active.add(k);
 }
 for(const k of h.contacts)if(!active.has(k))h.contacts.delete(k);
 for(const u of [...s.units]){
  if(u.side===side)continue;const [w,d]=dims(u),need=Math.max(w,d)/2;if(h.r+.001<need)continue;
  const reach=Math.max(.06,h.r-need+.12);
  if(pointSegmentDist(u.x,u.z,ax,az,h.x,h.z)<=reach*reach){
   s.units=s.units.filter(v=>v!==u);const n=u.type==='soldier'?TYPES.soldier.cost/16:TYPES[u.type].cost/2;earn(n,side,null,main);
   if(!main){h.eaten+=n;h.r=Math.min(.5,h.r+n*.012);h.owner.fed=(h.owner.fed||0)+n;}
  }
 }
}''')
function('targetFor', '''function targetFor(u,range=30,includeBricks=true){
 const dir=u.side?1:-1,col=u.column??Math.floor(u.x);let best=null;
 for(const v of s.units){
  if(v.side===u.side||Math.floor(v.x)!==col)continue;const d=(v.z-u.z)*dir;
  if(d<-.01||d>range)continue;if(!best||d<best.d)best={kind:'unit',u:v,x:v.x,z:v.z,d};
 }
 if(includeBricks)for(const p of s.piles)for(let i=0;i<p.cols.length;i++)for(let level=0;level<p.cols[i];level++){
  const b=brickPos(p,i,level),h=brickHalfBounds(b);
  if(b.x+h.x<=col||b.x-h.x>=col+1)continue;
  const center=(b.z-u.z)*dir;if(center < -h.z-.01)continue;const d=Math.max(0,center-h.z);
  if(d>range)continue;if(!best||d<best.d)best={kind:'bricks',p,index:i,cellX:col,cellZ:Math.floor(b.z),x:b.x,z:b.z,d};
 }
 if(best)return best;const z=u.side?10:0;
 return Math.abs(z-u.z)<=range?{kind:'base',side:1-u.side,x:u.x,z,d:Math.abs(z-u.z)}:null;
}''')
function('harvest', '''function harvest(p,side,mode,target=null){
 const eligible=(i,l)=>!target||brickTouchesRect(brickPos(p,i,l),target.cellX+.5,target.cellZ+.5,1,1);
 const remove=(i,l)=>{if(l===0){collectColumn(p,i,side);return;}p.layout[i].levels.splice((p.offsets[i]||0)+l,1);p.cols[i]--;earn(1,side);};
 if(mode==='all'){for(let i=0;i<p.cols.length;i++)for(let l=p.cols[i]-1;l>=0;l--)if(eligible(i,l))remove(i,l);return;}
 let index=-1,level=-1;
 for(let i=0;i<p.cols.length;i++)for(let l=0;l<p.cols[i];l++)if(eligible(i,l)&&(index<0||(mode==='top'?l>level:l<level))){index=i;level=l;}
 if(index>=0)remove(index,level);
}''')
function('bricksBlocked', '''function bricksBlocked(x,z,w,d){return s.piles.some(p=>p.cols.some((n,i)=>{for(let l=0;l<n;l++)if(brickTouchesRect(brickPos(p,i,l),x,z,w,d))return true;return false;}));}''')
source=source.replace("harvest(target.p,side,'all')","harvest(target.p,side,'all',target)")
source=source.replace("harvest(target.p,u.side,top?'top':u.type==='tank'?'all':'bottom')","harvest(target.p,u.side,top?'top':u.type==='tank'?'all':'bottom',target)")
source=source.replace('Math.max(...target.p.cols)*.14','Math.max(...target.p.cols)*.244')
source=source.replace('p.x+.5-(4+Math.tan(a)*(p.z+.5-s.hole.z))','p.x-(4+Math.tan(a)*(p.z-s.hole.z))')
source=source.replace("$('phaseBadge').textContent=s.phase==='over'?'BATTLE OVER':", "$('phaseBadge').textContent=aim?'ENEMY HQ':s.phase==='over'?'BATTLE OVER':")
source=source.replace("?'MAX SIZE':'↑ SIZE <b>'", "?'MAX SIZE':'SIZE <b>'")
source=source.replace("Collect bricks · leave a pile to collect its next layer", "Collect gold · leave a stack to collect its next bar")
source=source.replace("mine?'UNITS ACTING':s.phase==='drift'","mine?(s.phase==='drift'?'YOUR DRIFT':'UNITS ACTING'):s.phase==='drift'")
source=source.replace('collect brick stacks, build your army', 'collect golden ingots, build your army')
source=source.replace('</style>',(root / '.work/polish.css').read_text(encoding='utf-8')+'\n</style>',1)
(root / 'Hole-Drift.html').write_text(source,encoding='utf-8')
scripts = re.findall(r'<script>(.*?)</script>',source,re.S)
for i,s in enumerate(scripts):
    if i: (root / f'.work/script-{i}.js').write_text(s,encoding='utf-8')
print(f'Updated standalone game: {len(source):,} characters, {len(scripts)} scripts')
