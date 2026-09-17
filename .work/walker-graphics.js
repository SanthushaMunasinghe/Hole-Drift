 // Rounded toy workers share baked geometry, including the thirty-member crowd models.
 minerModel(side,lod=1){return this.workerModel(side,false,lod);}
 giantModel(side){return this.workerModel(side,true,1);}
 workerMaterial(side,part){
  this.workerMats??=new Map();const key=side+':'+part;if(this.workerMats.has(key))return this.workerMats.get(key);
  const team=side?0xef493b:0x078feb,colors={helmet:team,cloth:side?0xc9312c:0x086ac4,skin:0xf2b06d,leather:0x71401f,boot:0x423126,steel:0xbecbd6,socket:0x536576,buckle:0xe6b660,eye:0x263441,spark:0xffe5a1};
  const material=part==='spark'?new THREE.MeshBasicMaterial({color:colors[part],toneMapped:false}):new THREE.MeshPhysicalMaterial({color:colors[part],roughness:part==='helmet'?.24:part==='steel'?.25:part==='skin'?.63:.68,metalness:part==='steel'?.72:part==='socket'?.45:part==='buckle'?.5:0,clearcoat:part==='helmet'?.8:.08,clearcoatRoughness:.22,envMapIntensity:part==='steel'?1.1:.65});
  this.workerMats.set(key,material);return material;
 }
 bakeWorkerParts(group){
  const buckets=new Map();
  for(const mesh of [...group.children]){if(!mesh.isMesh)continue;mesh.updateMatrix();let geo=mesh.geometry.clone().applyMatrix4(mesh.matrix);if(geo.index){const indexed=geo;geo=geo.toNonIndexed();indexed.dispose();}const key=mesh.material.uuid;if(!buckets.has(key))buckets.set(key,{material:mesh.material,geos:[]});buckets.get(key).geos.push(geo);group.remove(mesh);}
  for(const {material,geos}of buckets.values()){
   const size=geos.reduce((n,g)=>n+g.attributes.position.array.length,0),positions=new Float32Array(size),normals=new Float32Array(size);let offset=0;
   for(const geo of geos){positions.set(geo.attributes.position.array,offset);normals.set(geo.attributes.normal.array,offset);offset+=geo.attributes.position.array.length;geo.dispose();}
   const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3));geometry.computeBoundingSphere();group.add(new THREE.Mesh(geometry,material));
  }
 }
 workerModel(side,giant,lod){
  this.workerTemplates??=new Map();const key=[side,giant,lod].join(':');
  if(!this.workerTemplates.has(key)){
   this.workerGeos??={ball:new THREE.SphereGeometry(1,12,8),dome:new THREE.SphereGeometry(1,16,10,0,Math.PI*2,0,Math.PI/2),cylinder:new THREE.CylinderGeometry(1,1,1,12),round:this.roundedGeometry(1,1,1,.18,4),flash:new THREE.RingGeometry(.68,1,20),trail:new THREE.RingGeometry(.46,.49,18,1,.12,1.9)};
   if(!this.workerGeos.pick){const shape=new THREE.Shape();shape.moveTo(-.35,-.10);shape.lineTo(-.27,.055);shape.quadraticCurveTo(0,.20,.28,.055);shape.lineTo(.37,-.075);shape.lineTo(.20,-.015);shape.quadraticCurveTo(0,.075,-.20,-.005);shape.closePath();this.workerGeos.pick=new THREE.ExtrudeGeometry(shape,{depth:.065,bevelEnabled:true,bevelSize:.012,bevelThickness:.012,bevelSegments:2,steps:1,curveSegments:6});this.workerGeos.pick.translate(0,0,-.0325);}
   const root=new THREE.Group(),figure=new THREE.Group();figure.name='figure';figure.scale.set(giant?1.48:1,giant?1.27:1,giant?1.3:1);root.add(figure);
   const body=new THREE.Group();body.name='body';figure.add(body);
   const add=(parent,geo,part,x,y,z,sx,sy=sx,sz=sx)=>{const mesh=new THREE.Mesh(this.workerGeos[geo],this.workerMaterial(side,part));mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);parent.add(mesh);return mesh;};
   const round=(parent,part,x,y,z,xs,ys,zs)=>add(parent,'round',part,x,y,z,xs,ys,zs);
   // A short, rounded overall silhouette, broad bare shoulders and a cinched leather belt.
   round(body,'cloth',0,.56,.015,giant?.58:.48,.40,.34);
   round(body,'leather',0,.40,0,giant?.59:.50,.075,.355);
   round(body,'buckle',0,.40,-.19,.105,.065,.025);
   for(const sign of [-1,1]){const strap=round(body,'leather',sign*.11,.62,-.17,.065,.39,.025);strap.rotation.z=sign*.26;const back=round(body,'leather',sign*.075,.63,.185,.065,.41,.025);back.rotation.z=sign*-.55;}
   add(body,'ball','skin',0,.85,-.025,.20,.18,.185);
   round(body,'skin',0,.78,-.12,.25,.12,.14);
   if(lod){for(const sign of [-1,1])add(body,'ball','eye',sign*.065,.87,-.195,.016,.018,.012);add(body,'ball','skin',0,.83,-.218,.038,.037,.036);}
   // Wide brim, smooth dome and the small crown button from the reference helmets.
   add(body,'cylinder','helmet',0,.973,-.025,.325,.045,.295);
   add(body,'dome','helmet',0,.985,0,.302,.203,.284);
   add(body,'ball','helmet',0,1.176,.015,.067,.032,.065);
   if(lod){round(body,'helmet',0,1.04,-.239,.055,.09,.06);round(body,'buckle',0,1.035,-.272,.05,.04,.016);}
   const legs=[],arms=[];
   for(const sign of [-1,1]){
    const leg=new THREE.Group();leg.name=sign<0?'legL':'legR';leg.position.set(sign*(giant?.145:.12),.31,0);figure.add(leg);legs.push(leg);
    round(leg,'cloth',0,-.085,.015,.16,.22,.21);round(leg,'boot',0,-.23,-.055,.195,.13,.29);
    const arm=new THREE.Group();arm.name=sign<0?'armL':'armR';arm.position.set(sign*(giant?.34:.285),.71,.015);body.add(arm);arms.push(arm);
    add(arm,'ball','skin',0,-.075,0,giant?.13:.105,.15,.115);add(arm,'ball','skin',sign*.018,-.20,-.025,.09,.115,.09);
    round(arm,'leather',sign*.018,-.27,-.025,.155,.095,.15);add(arm,'ball','skin',sign*.018,-.285,-.085,.066,.066,.06);
   }
   // The complete tool follows the wrist; its steel head has two tapered, curved points.
   const pick=new THREE.Group();pick.name='pick';pick.position.set(.018,-.265,-.08);arms[1].add(pick);
   const handle=new THREE.Group(),head=new THREE.Group();pick.add(handle,head);
   add(handle,'cylinder','leather',0,.16,0,.033,.70,.033);
   if(lod){for(const y of [-.08,-.025,.025])add(handle,'cylinder','boot',0,y,0,.039,.028,.039);}
   add(head,'pick','steel',0,.515,0,giant?1.16:1,1,1);
   round(head,'socket',0,.50,0,.115,.13,.105);
   if(lod)add(head,'cylinder','buckle',0,.405,0,.046,.04,.046);
   // A brief narrow streak and tiny impact chips, attached only to the visual rig.
   const trail=new THREE.Mesh(this.workerGeos.trail,this.workerMaterial(side,'spark'));trail.name='swingTrail';trail.rotation.y=Math.PI/2;trail.position.set(.33,.66,-.08);trail.visible=false;body.add(trail);
   const impact=new THREE.Group();impact.name='pickImpact';impact.position.set(.30,.045,-.58);impact.visible=false;figure.add(impact);
   const ring=add(impact,'flash','spark',0,0,0,1);ring.rotation.x=-Math.PI/2;
   for(let i=0;i<5;i++){const a=i*2.399963;const chip=add(impact,'round',i%2?'steel':'spark',Math.cos(a),.25+(i%3)*.2,Math.sin(a),.13,.10,.24);chip.rotation.set(a,a*.5,a*.7);}
   for(const group of [body,...legs,...arms,handle,head])this.bakeWorkerParts(group);
   root.traverse(mesh=>{if(mesh.isMesh){mesh.castShadow=!!lod;mesh.receiveShadow=!!lod;}});
   this.workerTemplates.set(key,root);
  }
  const g=this.workerTemplates.get(key).clone(true),find=name=>g.getObjectByName(name);
  g.userData.pick=find('pick');g.userData.worker={figure:find('figure'),body:find('body'),legs:[find('legL'),find('legR')],arms:[find('armL'),find('armR')],trail:find('swingTrail'),impact:find('pickImpact'),stride:0,walk:0};
  return g;
 }
 animateWorker(g,u,time,dt){
  const rig=g.userData.worker;if(!rig)return;
  const data=g.userData,distance=data.lastX==null?0:Math.hypot(u.x-data.lastX,u.z-data.lastZ);data.lastX=u.x;data.lastZ=u.z;
  const moving=!u.falling&&distance>1e-5;rig.walk+=((moving?1:0)-rig.walk)*Math.min(1,dt*18);rig.stride+=distance/(u.scale||1)*8;
  const gait=Math.sin(rig.stride),age=u.swingAt==null?Infinity:time-u.swingAt,p=age/.30,attacking=!u.falling&&p>=0&&p<1;
  // Slow anticipation, quick downward chop, a short contact hold, then a soft recovery.
  let chop=0,lean=0,hit=0;
  if(attacking){const ease=t=>t*t*(3-2*t);if(p<.28)chop=.65*ease(p/.28);else if(p<.48)chop=.65-2.20*ease((p-.28)/.20);else if(p<.60)chop=-1.55;else chop=-1.55*(1-ease((p-.60)/.40));lean=p<.28?-.065*(p/.28):.17*Math.sin((p-.28)/.72*Math.PI);hit=p>=.48?Math.max(0,1-(p-.48)/.45):0;}
  const walk=attacking?0:rig.walk;
  rig.body.position.y=Math.abs(gait)*.019*walk-(attacking?.026*Math.max(0,-chop):0);rig.body.rotation.set(-lean,attacking?chop*.045:0,gait*.028*walk);
  rig.legs[0].rotation.x=gait*.29*walk;rig.legs[1].rotation.x=-gait*.29*walk;
  rig.arms[0].rotation.set(-gait*.20*walk-chop*.22,0,-.10);rig.arms[1].rotation.set(.12+chop,0,.10);
  g.userData.pick.rotation.set(-.12+chop*.10,0,-.16);
  rig.trail.visible=attacking&&p>.30&&p<.50;rig.trail.rotation.x=chop*.7;
  rig.impact.visible=hit>0;rig.impact.scale.setScalar((.07+(1-hit)*.14)*Math.sqrt(hit));rig.impact.rotation.y=(u.id||0)*2.4;
  if(u.falling){rig.walk=0;rig.trail.visible=false;rig.impact.visible=false;}
 }
 rigPick(g,parts,x,y,z){const pivot=new THREE.Group();pivot.position.set(x,y,z);g.add(pivot);for(const mesh of parts){mesh.position.sub(pivot.position);pivot.add(mesh);}g.userData.pick=pivot;}
