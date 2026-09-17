 cutGround(material){
  material.onBeforeCompile=shader=>{
   shader.uniforms.holeCount=this.holeUniforms.count;
   shader.uniforms.holeCircles=this.holeUniforms.circles;
   shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 vHoleXZ;').replace('#include <begin_vertex>','#include <begin_vertex>\nvHoleXZ = (modelMatrix * vec4(transformed, 1.0)).xz;');
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 vHoleXZ;\nuniform int holeCount;\nuniform vec4 holeCircles[16];').replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
    for (int i = 0; i < 16; i++) {
     if (i >= holeCount) break;
     vec2 q = (vHoleXZ - holeCircles[i].xy) / holeCircles[i].zw;
     if (dot(q, q) < 1.0) discard;
    }`);
  };
  material.customProgramCacheKey=()=> 'hole-drift-open-ground-v1';
  return material;
 }
 updateHoleOpenings(s){
  let count=0;
  const add=h=>{if(count<16)this.holeUniforms.circles.value[count++].set(h.x,h.z*1.08,h.r,h.r*1.08);};
  if(s.phase!=='over')add(s.hole);
  for(const h of s.holeShots)add(h);
  this.holeUniforms.count.value=count;
 }
 holeModel(color){
  const g=new THREE.Group();
  const disk=new THREE.Mesh(new THREE.CircleGeometry(1,64),new THREE.MeshBasicMaterial({color:0x030608}));
  disk.rotation.x=-Math.PI/2;disk.position.y=-.76;g.add(disk);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(1,.035,8,64),this.mat(color));
  ring.rotation.x=-Math.PI/2;ring.position.y=.018;g.add(ring);
  const wall=new THREE.Mesh(new THREE.CylinderGeometry(1,1,.76,64,1,true),new THREE.MeshStandardMaterial({color:0x101b20,roughness:.93,side:THREE.BackSide,envMapIntensity:.06}));
  wall.position.y=-.38;wall.receiveShadow=true;g.add(wall);
  return g;
 }
