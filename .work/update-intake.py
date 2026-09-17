from pathlib import Path
import re

root=Path(__file__).resolve().parent.parent
game=root/'Hole-Drift.html'
t=game.read_text(encoding='utf-8')
backup=root/'.work/Hole-Drift.before-intake.html'
if not backup.exists():backup.write_text(t,encoding='utf-8')
else:t=backup.read_text(encoding='utf-8')

def replace(old,new):
 global t
 if old not in t:raise ValueError('Missing source: '+old[:100])
 t=t.replace(old,new)

start=t.index('// Constrained rigid bodies:')
end=t.index('const GROWTH=',start)
t=t[:start]+(root/'.work/vertical-physics.js').read_text(encoding='utf-8')+'\n'+t[end:]
replace('s.hole.vx=Math.sin(s.angle)*5.8;s.hole.vz=(s.side?1:-1)*Math.cos(s.angle)*5.8;', 'const speed=driftSpeed(s.hole);s.hole.vx=Math.sin(s.angle)*speed;s.hole.vz=(s.side?1:-1)*Math.cos(s.angle)*speed;')
replace('function driftStep(dt){const h=s.hole;h.x+=h.vx*dt;', 'function driftStep(dt){const h=s.hole,speed=driftSpeed(h),oldSpeed=Math.hypot(h.vx,h.vz)||speed;h.vx*=speed/oldSpeed;h.vz*=speed/oldSpeed;h.x+=h.vx*dt;')
replace('h.z+=(h.side?1:-1)*2.5*dt;', 'h.z+=(h.side?1:-1)*INTAKE.shotSpeed*dt;')

# Real cutouts in the terrain reveal a dark well beneath each visible opening.
replace('this.sinkPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0);','this.sinkPlane=new THREE.Plane(new THREE.Vector3(0,1,0),1.26);\n  this.holeUniforms={count:{value:0},circles:{value:Array.from({length:16},()=>new THREE.Vector4())}};')
start=t.index(' holeModel(color){');end=t.index('\n resize(){',start)
t=t[:start]+(root/'.work/hole-well.js').read_text(encoding='utf-8')+t[end:]
replace('turf.rotation.x=-Math.PI/2;', 'this.cutGround(turf.material);turf.rotation.x=-Math.PI/2;')
replace('  for(const x of [-.18,8.18]){','  // Turf and inset grid seams all share the same aperture cutouts.\n  for(const mesh of g.children){if(mesh.isMesh&&mesh!==turf){this.cutGround(mesh.material);mesh.castShadow=false;}}\n  for(const x of [-.18,8.18]){')
replace(' draw(s,dt,valid,hover){\n  this.drawGold(s,dt);', ' draw(s,dt,valid,hover){\n  this.updateHoleOpenings(s);this.drawGold(s,dt);')
replace('this.hole.scale.setScalar(s.hole.r);', 'this.hole.scale.set(s.hole.r,1,s.hole.r);')
replace('m.position.set(h.x,0,h.z);m.scale.setScalar(h.r);', 'm.position.set(h.x,0,h.z);m.scale.set(h.r,1,h.r);')
replace("else mesh.scale.setScalar(.25);", "else mesh.scale.set(.25,1,.25);")
replace('Let gold fall in · fast passes leave upper bricks','Bigger holes pull down more stacks · keep drifting')
replace('Gold is collected after it falls below the surface; fast passes can leave upper bricks behind.', 'Larger holes pull multiple stacks downward together. Gold is collected only after sinking into the well; fast edge passes can still leave upper bricks behind.')
game.write_text(t,encoding='utf-8')
print('Saved stronger multi-stack intake, slower hole travel, and visible hole depth. No tests run.')
