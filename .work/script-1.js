/* Real WebGL geometry; world coordinates are measured in battlefield cells. */
class HoleDrift3D {
 constructor(canvas){
  this.canvas=canvas;
  this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
  this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));
  this.renderer.shadowMap.enabled=true;
  this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  this.renderer.outputColorSpace=THREE.SRGBColorSpace;
  this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
  this.renderer.toneMappingExposure=1.0;
  this.renderer.setClearColor(0x78b936);
  this.scene=new THREE.Scene();this.scene.scale.set(1,1.65,1.08);
  this.camera=new THREE.OrthographicCamera(-5,5,6,-6,.1,80);
  this.camera.position.set(4,27,13.012);this.camera.lookAt(4,0,5.778);
  this.ray=new THREE.Raycaster();this.plane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
  this.mats=new Map();this.roundedGeos=new Map();
  this.boxGeo=this.roundedGeometry(1,1,1,.09);
  this.cylGeo=new THREE.CylinderGeometry(1,1,1,32);
  this.ballGeo=new THREE.SphereGeometry(1,16,12);
  this.bricks=new Map();this.unitMeshes=new Map();this.effects=[];this.shotMeshes=new Map();this.labelEls=new Map();
  this.labels=document.getElementById('labels');
  this.scene.add(new THREE.HemisphereLight(0xe9f6ff,0x557027,1.0));
  const sun=new THREE.DirectionalLight(0xfff1ce,2.7);
  sun.position.set(-6,13,-5);sun.target.position.set(4,0,5);sun.castShadow=true;
  sun.shadow.mapSize.set(2048,2048);
  Object.assign(sun.shadow.camera,{left:-11,right:11,top:12,bottom:-12,near:.5,far:45});
  sun.shadow.bias=-.0003;sun.shadow.normalBias=.025;sun.shadow.radius=3;
  this.scene.add(sun,sun.target);
  const fill=new THREE.DirectionalLight(0xd6eeff,.6);fill.position.set(7,8,8);this.scene.add(fill);
  this.makeEnvironment();this.makeGold();this.floor();
  this.hole=this.holeModel(0xe9ead3);this.scene.add(this.hole);
  this.aim=new THREE.Group();this.scene.add(this.aim);
  for(let i=0;i<27;i++)this.ball(this.aim,0xfff7c6,0,.06,0,.035);
  this.pads=new THREE.Group();this.scene.add(this.pads);
  for(let z=0;z<10;z++)for(let x=0;x<8;x++){
   const p=new THREE.Mesh(new THREE.PlaneGeometry(.94,.94),new THREE.MeshBasicMaterial({color:0xc8ff9e,transparent:true,opacity:0,depthWrite:false}));
   p.rotation.x=-Math.PI/2;p.position.set(x+.5,.018,z+.5);this.pads.add(p);
  }
  this.preview=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({color:0xdafa9c,transparent:true,opacity:.6,depthWrite:false}));
  this.preview.rotation.x=-Math.PI/2;this.preview.position.y=.03;this.preview.visible=false;this.scene.add(this.preview);
  this.resize();new ResizeObserver(()=>this.resize()).observe(canvas.parentElement);
 }

 mesh(g,geo,c,x,y,z,sx,sy,sz){const m=new THREE.Mesh(geo,this.mat(c));m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;m.receiveShadow=true;g.add(m);return m;}
 box(g,c,x,y,z,sx,sy,sz){return this.mesh(g,this.boxGeo,c,x,y,z,sx,sy,sz);}
 cyl(g,c,x,y,z,r,h){return this.mesh(g,this.cylGeo,c,x,y,z,r,h,r);}
 ball(g,c,x,y,z,r){return this.mesh(g,this.ballGeo,c,x,y,z,r,r,r);}

 roundedGeometry(w,h,d,r){
  // Project subdivided cube faces around an inset box to make genuinely rounded edges.
  const geo=new THREE.BoxGeometry(w,h,d,6,6,6),p=geo.attributes.position,normals=geo.attributes.normal;
  const core=new THREE.Vector3(w/2-r,h/2-r,d/2-r),v=new THREE.Vector3(),q=new THREE.Vector3();
  for(let i=0;i<p.count;i++){
   v.fromBufferAttribute(p,i);
   // Concentrate vertices at the bevel, leaving a broad, flat face in the middle.
   for(const [axis,size]of [['x',w],['y',h],['z',d]]){const f=v[axis]/(size/2);v[axis]=Math.abs(f)<.01?0:Math.sign(f)*(size/2-r+r*(Math.abs(f)-1/3)*1.5);}
   q.copy(v).clamp(core.clone().negate(),core);v.sub(q).normalize();normals.setXYZ(i,v.x,v.y,v.z);v.multiplyScalar(r).add(q);p.setXYZ(i,v.x,v.y,v.z);
  }
  return geo;
 }
 mat(c){if(!this.mats.has(c))this.mats.set(c,new THREE.MeshStandardMaterial({color:c,roughness:.48,metalness:.02,envMapIntensity:.35}));return this.mats.get(c);}
 softBox(g,c,x,y,z,w,h,d,r=.06){
  r=Math.min(r,w*.25,h*.25,d*.25);const key=[w,h,d,r].join(':');
  if(!this.roundedGeos.has(key))this.roundedGeos.set(key,this.roundedGeometry(w,h,d,r));
  return this.mesh(g,this.roundedGeos.get(key),c,x,y,z,1,1,1);
 }
 makeEnvironment(){
  // Procedural studio reflections keep the standalone game completely offline.
  const room=new THREE.Scene();room.background=new THREE.Color(0x9dabb9);
  for(const [x,y,z,w,h,c,power]of [[-4,7,-3,7,5,0xfff8df,6],[5,4,3,4,7,0xe8f4ff,2.5],[0,9,0,9,4,0xffffff,4]]){
   const light=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:new THREE.Color(c).multiplyScalar(power),side:THREE.DoubleSide}));
   light.position.set(x,y,z);light.lookAt(0,0,0);room.add(light);
  }
  const pmrem=new THREE.PMREMGenerator(this.renderer);this.environment=pmrem.fromScene(room,.025);this.scene.environment=this.environment.texture;
  pmrem.dispose();room.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});
 }
 makeGold(){
  const geo=this.roundedGeometry(.3,.24,.48,.055),p=geo.attributes.position,colors=[];
  for(let i=0;i<p.count;i++){
   const y=p.getY(i),t=(y+.12)/.24;
   p.setX(i,p.getX(i)*(1-.17*t));p.setZ(i,p.getZ(i)*(1-.12*t));
   const c=new THREE.Color().setRGB(1,.32+.53*t,.003+.028*t);colors.push(c.r,c.g,c.b);
  }
  geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  this.goldGeo=geo;this.goldMat=new THREE.MeshPhysicalMaterial({color:0xffbd06,vertexColors:true,metalness:.24,roughness:.23,clearcoat:.65,clearcoatRoughness:.16,envMapIntensity:.65,toneMapped:false});
  this.gold=new THREE.InstancedMesh(geo,this.goldMat,2048);this.gold.count=0;this.gold.castShadow=true;this.gold.receiveShadow=true;this.gold.frustumCulled=false;this.gold.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.scene.add(this.gold);
  this.goldTransform=new THREE.Object3D();
  const c=document.createElement('canvas');c.width=c.height=64;const ctx=c.getContext('2d'),gradient=ctx.createRadialGradient(32,32,5,32,32,32);
  gradient.addColorStop(0,'rgba(36,44,5,.6)');gradient.addColorStop(.5,'rgba(36,44,5,.26)');gradient.addColorStop(1,'rgba(36,44,5,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);
  this.contactMat=new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthWrite:false});this.pileShadows=new Map();
 }
 grassTexture(){
  const c=document.createElement('canvas');c.width=c.height=512;const ctx=c.getContext('2d');
  let seed=3071;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  ctx.fillStyle='#80be37';ctx.fillRect(0,0,512,512);
  for(let i=0;i<3500;i++){const x=random()*512,y=random()*512,r=2+random()*10;const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,random()>.48?'rgba(162,213,52,.065)':'rgba(51,120,24,.035)');g.addColorStop(1,'transparent');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);}
  for(let i=0;i<22000;i++){ctx.fillStyle=random()>.5?'rgba(213,238,126,.09)':'rgba(40,101,16,.045)';ctx.fillRect(random()*512,random()*512,1+random()*2,1+random()*2);}
  const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(4,5);tex.anisotropy=this.renderer.capabilities.getMaxAnisotropy();return tex;
 }
 floor(){
  const g=new THREE.Group();this.scene.add(g);
  const turf=new THREE.Mesh(new THREE.PlaneGeometry(40,40),new THREE.MeshStandardMaterial({map:this.grassTexture(),roughness:1,envMapIntensity:.15}));
  turf.rotation.x=-Math.PI/2;turf.position.set(4,-.015,5);turf.receiveShadow=true;g.add(turf);
  // Fine inset seams, with a light edge, let the grass remain continuous across the grid.
  for(let x=0;x<=8;x++){this.box(g,0x588b27,x,-.004,5,.012,.006,10);this.box(g,0x97cf54,x+.014,-.004,5,.009,.006,10);}
  for(let z=0;z<=10;z++){this.box(g,0x588b27,4,-.004,z,8,.006,.012);this.box(g,0x97cf54,4,-.004,z+.014,8,.006,.009);}
  for(const x of [-.18,8.18]){
   this.softBox(g,0x7d7d35,x,.12,5,.3,.28,10.4,.055);
   for(let z=.2;z<10;z+=.46)this.softBox(g,0xe5cf77,x,.245,z,.29,.4,.415,.065);
  }
  for(let side=0;side<2;side++){
   const z=side?-.27:10.27,c=side?0xf04233:0x168bf3,dark=side?0xb5221d:0x1163b9;
   this.softBox(g,dark,4,.26,z,8.55,.51,.48,.065);
   for(let x=.04;x<8.4;x+=.55){
    this.softBox(g,c,x,.31,z,.525,.58,.53,.075);
    this.softBox(g,side?0xff5141:0x249dff,x,.67,z-.035,.515,.28,.59,.065);
   }
   const back=z+(side?-.38:.38);
   this.softBox(g,dark,4,.39,back,1.68,.76,1.13,.12);
   this.softBox(g,c,4,.66,back,1.74,.49,1.13,.12);
   if(side){
    this.softBox(g,0x532316,4,.27,z+.29,.32,.43,.045,.05);
    for(const x of [3.39,4.61]){this.cyl(g,dark,x,.5,z,.29,.95);this.cyl(g,c,x,.86,z,.30,.4);this.softBox(g,0xff5545,x,1.06,z-.10,.52,.27,.57,.075);}
    this.softBox(g,c,4,1.02,z-.30,.43,.3,.42,.05);
   }else{
    for(const x of [3.43,4,4.57]){this.cyl(g,dark,x,.85,z,.28,.25);this.cyl(g,0x35a8ff,x,.95,z-.025,.27,.2);}
   }
  }
  // Small plants and round tree canopies frame the board without occupying playable cells.
  const grass=(x,z,scale=1)=>{for(let i=0;i<3;i++){const leaf=this.ball(g,[0x76c72c,0x9cdb3a,0x55ac24][i],x+(i-1)*.08*scale,.09*scale,z+(i%2)*.07,.085*scale);leaf.scale.y*=2.3;leaf.rotation.z=(i-1)*-.28;}};
  for(const [x,z,k]of [[.33,.65,.8],[7.5,1.1,1],[2.7,1.5,.8],[5.6,1.25,1],[.45,4.6,.8],[7.7,5.3,.75],[2.75,4.4,.8],[5.3,4.65,.7],[.35,8.9,.8],[2.35,9.4,1],[6.85,9.3,1],[5.5,8.5,.7],[2,11.45,1],[5.5,11.75,1],[6.4,12,.9],[1,-1.45,1],[6.4,-1.3,.8]])grass(x,z,k);
  for(const [x,z]of [[.35,5.9],[7.65,7.7],[.4,8],[7.65,3.7]]){grass(x,z,.55);for(let i=0;i<5;i++){const a=i*Math.PI*2/5;this.ball(g,0xfff8d1,x+Math.cos(a)*.055,.1,z+Math.sin(a)*.055,.041);}this.ball(g,0xffcb26,x,.12,z,.029);}
  const tree=(x,z,k)=>{this.cyl(g,0x81602d,x,.28*k,z,.12*k,.55*k);for(const [dx,y,dz,r,c]of [[0,.8,0,.49,0x3fa735],[-.28,.65,.08,.36,0x65bd28],[.23,.86,.09,.36,0x7bcc2f],[-.12,1.08,-.1,.33,0x9cdb3e]]){const b=this.ball(g,c,x+dx*k,y*k,z+dz*k,r*k);b.scale.y*=1.2;}};
  for(const [x,z,k]of [[-.62,-1.0,1.05],[8.65,-1.1,1.2],[-.82,2,.8],[8.87,3.1,.85],[-.82,7.8,.9],[8.78,8.5,.8],[-.45,11.3,1.1],[8.55,11.35,1.1],[-.4,12.25,.95],[8.6,12.5,.9]])tree(x,z,k);
  const rockGeo=new THREE.DodecahedronGeometry(1,0);
  for(const [x,z,r]of [[1.18,-1.05,.24],[6.9,-1.1,.32],[1.35,11.8,.32],[6.25,12.1,.27],[5.6,11.5,.16]]){const rock=this.mesh(g,rockGeo,0xa6a58c,x,r*.48,z,r,r*.85,r);rock.rotation.set(.14,x*.7,.2);}
 }
 drawGold(s,dt){
  const live=new Set(),pileLive=new Set();let instance=0;const m=this.goldTransform;
  for(const p of s.piles){
   if(!count(p))continue;pileLive.add(p.id);
   let shadow=this.pileShadows.get(p.id);
   if(!shadow){shadow=new THREE.Mesh(new THREE.PlaneGeometry(1,1),this.contactMat);shadow.rotation.x=-Math.PI/2;shadow.position.set(p.x,.005,p.z);shadow.scale.set(p.width*1.4,p.depth*1.4,1);this.scene.add(shadow);this.pileShadows.set(p.id,shadow);}
   for(let col=0;col<p.cols.length;col++){
    for(let l=0;l<p.cols[col];l++){
     const b=brickPos(p,col,l);
     const key=p.id+':'+col+':'+(l+(p.offsets?.[col]||0));live.add(key);
     const y=.123+l*.244;let state=this.bricks.get(key);
     if(!state){state={y};this.bricks.set(key,state);}state.y+=(y-state.y)*Math.min(1,dt*14);
     m.position.set(b.x,state.y,b.z);m.rotation.set(0,b.angle,0);m.scale.set(b.w/.3,1,b.d/.48);m.updateMatrix();
     this.gold.setMatrixAt(instance++,m.matrix);
    }
   }
  }
  this.gold.count=instance;this.gold.instanceMatrix.needsUpdate=true;
  for(const key of this.bricks.keys())if(!live.has(key))this.bricks.delete(key);
  for(const [id,shadow]of this.pileShadows)if(!pileLive.has(id)){this.scene.remove(shadow);shadow.geometry.dispose();this.pileShadows.delete(id);}
 }

 soldierModel(side,general=false){const g=new THREE.Group(),c=side?0xd34545:0x387cd1;this.box(g,0x333d2e,-.15,.16,0,.19,.32,.23);this.box(g,0x333d2e,.15,.16,0,.19,.32,.23);this.box(g,c,0,.44,0,.48,.42,.32);this.ball(g,0xe1b183,0,.83,0,.24);this.cyl(g,c,0,.99,0,.29,.15);this.box(g,c,0,.95,-.13,.55,.07,.36);this.box(g,0x313b30,.15,.52,-.3,.14,.15,.61);this.box(g,0xd8bc77,0,.51,-.18,.1,.07,.02);if(general)this.box(g,0xffd66c,0,1.02,-.28,.12,.08,.025);return g;}
 unitModel(type,side){if(type==='soldier'){const soldier=this.soldierModel(side);soldier.scale.setScalar(.38);return soldier;}if(type==='tank'){const g=new THREE.Group(),c=side?0xd34545:0x387cd1;for(const x of [-.34,.34]){this.box(g,0x25352e,x,.18,0,.22,.27,.9);for(let z=-.3;z<=.3;z+=.15)this.cyl(g,0x4d5c47,x,.1,z,.1,.15);}this.box(g,c,0,.27,0,.65,.3,.78);this.cyl(g,c,0,.5,0,.27,.25);const barrel=this.cyl(g,0x354e40,0,.52,-.4,.065,.6);barrel.rotation.x=Math.PI/2;g.scale.setScalar(.5);return g;}const g=new THREE.Group(),c=side?0xd34545:0x387cd1;this.box(g,0x3c4935,0,.08,0,.81,.15,.75);if(type==='wall'){for(let l=0;l<2;l++)for(let i=0;i<4;i++)this.box(g,side?(l?0xe16b64:0xc44545):(l?0x69a6e7:0x347dca),(i-1.5)*.48,.18+l*.23,0,.45,.2,.78);return g;}
  this.cyl(g,c,0,.25,0,.32,.35);this.ball(g,c,0,.49,0,.3);const barrel=this.cyl(g,0x303c31,0,.54,-.38,.095,.6);barrel.rotation.x=Math.PI/2;if(type==='mg'){for(let x of [-.12,.12]){let b=this.cyl(g,0x3b4438,x,.57,-.42,.055,.75);b.rotation.x=Math.PI/2;}this.box(g,0x8c9360,.31,.35,0,.23,.22,.26);}if(type==='mortar'){barrel.rotation.x=.6;barrel.position.set(0,.72,-.12);barrel.scale.set(.17,.75,.17);this.box(g,0x838d57,0,.19,.22,.7,.12,.3);}if(type==='holegun'){barrel.scale.set(.21,.65,.21);this.cyl(g,0x849787,0,.48,0,.34,.28);const ring=new THREE.Mesh(new THREE.TorusGeometry(.18,.04,8,24),this.mat(0xb9d9c2));ring.position.set(0,.54,-.7);g.add(ring);}if(type==='holegun')g.scale.setScalar(.5);if(type==='mg'){const turret=new THREE.Group();for(const child of [...g.children].slice(1)){g.remove(child);turret.add(child);}g.add(turret);g.userData.turret=turret;}return g;
 }
 holeModel(color){const g=new THREE.Group(),disk=new THREE.Mesh(new THREE.CircleGeometry(1,64),new THREE.MeshBasicMaterial({color:0x0b100f}));disk.rotation.x=-Math.PI/2;disk.position.y=.045;g.add(disk);const ring=new THREE.Mesh(new THREE.TorusGeometry(1,.045,8,64),this.mat(color));ring.rotation.x=-Math.PI/2;ring.position.y=.055;g.add(ring);return g;}
 resize(){
  const r=this.canvas.getBoundingClientRect(),a=r.width/Math.max(1,r.height),h=Math.max(7.1,4.65/a);
  this.renderer.setSize(r.width,r.height,false);Object.assign(this.camera,{left:-h*a,right:h*a,top:h,bottom:-h});this.camera.updateProjectionMatrix();this.camera.updateMatrixWorld();
 }
 groundPoint(x,y){const r=this.canvas.getBoundingClientRect();this.ray.setFromCamera(new THREE.Vector2((x-r.left)/r.width*2-1,-(y-r.top)/r.height*2+1),this.camera);const p=new THREE.Vector3();return this.ray.ray.intersectPlane(this.plane,p)?{x:p.x,z:p.z/1.08}:null;}
 icon(type){const s=new THREE.Scene();s.background=new THREE.Color(0x73844e);s.add(new THREE.HemisphereLight(0xffffff,0x617044,3));const l=new THREE.DirectionalLight(0xffe5b1,3);l.position.set(-3,6,5);s.add(l);let m=this.unitModel(type,0);if(type==='soldier'){m=new THREE.Group();for(let i=0;i<8;i++){const u=this.unitModel(type,0);u.position.set((i%4)*.27-.4,0,Math.floor(i/4)*.45-.2);m.add(u);}}s.add(m);const c=new THREE.OrthographicCamera(-1.25,1.25,1,-1,.1,20);c.position.set(2,2.3,-3);c.lookAt(0,.35,0);this.renderer.setSize(140,100,false);this.renderer.render(s,c);const url=this.canvas.toDataURL();this.resize();return url;}
 reset(){
  for(const m of this.unitMeshes.values())this.scene.remove(m);for(const e of this.effects)this.scene.remove(e.mesh);for(const m of this.shotMeshes.values())this.scene.remove(m);
  for(const shadow of this.pileShadows.values()){this.scene.remove(shadow);shadow.geometry.dispose();}
  this.pileShadows.clear();this.gold.count=0;this.shotMeshes.clear();this.bricks.clear();this.unitMeshes.clear();this.effects=[];this.labels.innerHTML='';this.labelEls.clear();
 }
 effect(from,to,kind='brick',duration=.5){const mesh=kind==='hole'?this.holeModel(from.side?0xff6868:0x68b5ff):new THREE.Mesh(kind==='brick'?this.goldGeo:this.ballGeo,kind==='brick'?this.goldMat:this.mat(from.side?0xff5959:0x57adff));if(kind==='brick')mesh.scale.setScalar(.8);else if(kind!=='hole')mesh.scale.setScalar(.075);else mesh.scale.setScalar(.25);this.scene.add(mesh);this.effects.push({mesh,from:{...from},to:{...to},kind,t:0,duration});}
 draw(s,dt,valid,hover){
  this.drawGold(s,dt);
  const ids=new Set();for(const u of s.units){ids.add(u.id);let g=this.unitMeshes.get(u.id);if(!g){g=this.unitModel(u.type,u.side);g.position.set(u.x,0,u.z);g.rotation.y=u.side?Math.PI:0;this.unitMeshes.set(u.id,g);this.scene.add(g);}g.position.x+=(u.x-g.position.x)*Math.min(1,dt*10);g.position.z+=(u.z-g.position.z)*Math.min(1,dt*10);g.scale.y=(u.type==='soldier'?.38:(u.type==='tank'||u.type==='holegun')?.5:1)*Math.min(1,(s.time-u.built)/.5+.05);if(u.type==='mg'&&g.userData.turret){const target=(u.side?1:-1)*(u.aim||0);g.userData.turret.rotation.y+=(target-g.userData.turret.rotation.y)*Math.min(1,dt*12);}if(u.type==='wall')g.children.forEach((b,i)=>{if(i>0)b.visible=i<=u.hp;});let e=this.labelEls.get(u.id);if(!e){e=document.createElement('span');e.className='unitlabel'+(u.side?' enemy':'');this.labels.appendChild(e);this.labelEls.set(u.id,e);}e.style.display=u.type==='soldier'?'none':'block';e.innerHTML='<i><em style="width:'+Math.max(0,u.hp/u.maxhp*100)+'%"></em></i>';const v=new THREE.Vector3(u.x,1.12*1.65,u.z*1.08).project(this.camera),r=this.canvas.getBoundingClientRect();e.style.left=(v.x*.5+.5)*r.width+'px';e.style.top=(-v.y*.5+.5)*r.height+'px';}
  for(const [id,m]of this.unitMeshes)if(!ids.has(id)){this.scene.remove(m);this.unitMeshes.delete(id);this.labelEls.get(id)?.remove();this.labelEls.delete(id);}
  this.hole.visible=s.phase==='aim'||s.phase==='drift'||s.phase==='build'||s.phase==='actions';this.hole.position.set(s.hole.x,0,s.hole.z);this.hole.scale.setScalar(this.hole.scale.x+(s.hole.r-this.hole.scale.x)*Math.min(1,dt*10));this.hole.children[1].material=this.mat(s.side?0xffb5a5:0xf7f4e3);this.aim.visible=s.phase==='aim'&&s.side===0;for(let i=0;i<this.aim.children.length;i++){let d=.2+i*.19;this.aim.children[i].position.set(s.hole.x+Math.sin(s.angle)*d,.07,s.hole.z-Math.cos(s.angle)*d);this.aim.children[i].visible=d>s.hole.r&&this.aim.children[i].position.z>0&&this.aim.children[i].position.x>0&&this.aim.children[i].position.x<8;}
  this.pads.children.forEach((p,i)=>{p.material.opacity=s.phase==='build'&&s.side===0&&valid(i%8+.5,Math.floor(i/8)+.5,s.selected>=0?s.offers[s.selected]:'soldier')?.23:0;});this.preview.visible=!!hover&&s.phase==='build';if(hover){this.preview.position.set(hover.x,.032,hover.z);this.preview.scale.x=1;this.preview.material.color.setHex(hover.ok?0xd7f99a:0xef805f);}
  const shotLive=new Set(s.holeShots);for(const h of s.holeShots){let m=this.shotMeshes.get(h);if(!m){m=this.holeModel(h.side?0xff7c79:0x81c5ff);this.scene.add(m);this.shotMeshes.set(h,m);}m.position.set(h.x,0,h.z);m.scale.setScalar(h.r);}for(const [h,m]of this.shotMeshes)if(!shotLive.has(h)){this.scene.remove(m);this.shotMeshes.delete(h);}
  for(let i=this.effects.length-1;i>=0;i--){const e=this.effects[i];e.t+=dt;const t=Math.min(1,e.t/e.duration),h=e.kind==='shot'?(e.from.y??.5)*(1-t)+(e.to.y??.4)*t:e.kind==='mortar'?(.65*(1-t)+.35*t+4*3.2*t*(1-t)):e.kind==='hole'?.07:(e.kind==='collect'?.25:Math.sin(t*Math.PI)*(e.kind==='mortar'?3:1.35)+.3);e.mesh.position.set(e.from.x+(e.to.x-e.from.x)*t,h,e.from.z+(e.to.z-e.from.z)*t);if(e.kind==='brick')e.mesh.rotation.set(t*7,t*5,0);if(e.kind==='collect')e.mesh.scale.setScalar(.15*(1-t));if(t===1){this.scene.remove(e.mesh);this.effects.splice(i,1);}}
  const rect=this.canvas.getBoundingClientRect();
  for(const [id,z]of [['playerHUD',10.27],['enemyHUD',-.27]]){
   const el=document.getElementById(id),left=new THREE.Vector3(-.05,.37*1.65,(z+.29)*1.08).project(this.camera),right=new THREE.Vector3(8.05,.37*1.65,(z+.29)*1.08).project(this.camera);
   el.style.left=((left.x*.5+.5)*rect.width)+'px';el.style.right=((.5-right.x*.5)*rect.width)+'px';el.style.top=((-left.y*.5+.5)*rect.height-7)+'px';el.style.bottom='auto';
  }
  const badge=new THREE.Vector3(4,1.48*1.65,-.25*1.08).project(this.camera),phase=document.getElementById('phaseBadge');
  phase.style.top=((-badge.y*.5+.5)*rect.height-10)+'px';
  this.renderer.render(this.scene,this.camera);
 }
}
