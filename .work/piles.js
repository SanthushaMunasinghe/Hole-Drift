// Each pile owns freely positioned, rotated stacks. Every gold bar remains collectible.
// The complete footprint is restricted to z=2..8, preserving two rows at EACH HQ.
const CLEAR_ROWS=2,PILE_MAX_Z=10-CLEAR_ROWS;
function brickPos(p,i,level=0){const b=p.layout[i],v=b.levels?.[(p.offsets?.[i]||0)+level]||b;return {x:p.x+v.x,z:p.z+v.z,w:b.w,d:b.d,angle:b.angle};}
function brickHalfBounds(b){const c=Math.abs(Math.cos(b.angle)),n=Math.abs(Math.sin(b.angle));return {x:(c*b.w+n*b.d)/2,z:(n*b.w+c*b.d)/2};}
function brickLocal(b,x,z){const c=Math.cos(b.angle),n=Math.sin(b.angle),dx=x-b.x,dz=z-b.z;return {x:dx*c-dz*n,z:dx*n+dz*c};}
function brickTouchesRect(b,x,z,w,d){
 const dx=x-b.x,dz=z-b.z,c=Math.cos(b.angle),n=Math.sin(b.angle),ac=Math.abs(c),an=Math.abs(n);
 return Math.abs(dx)<w/2+ac*b.w/2+an*b.d/2-.001&&Math.abs(dz)<d/2+an*b.w/2+ac*b.d/2-.001&&Math.abs(dx*c-dz*n)<b.w/2+ac*w/2+an*d/2-.001&&Math.abs(dx*n+dz*c)<b.d/2+an*w/2+ac*d/2-.001;
}
function pileLayout(shape){
 const layout=[];
 const add=(x,z,n,w=.29,d=.46,angle=0)=>layout.push({x,z,n,w,d,angle});
 if(shape==='round'){
  add(0,0,5,.31,.49,.12);
  for(let ring=1;ring<=2;ring++){const amount=ring===1?6:10,r=ring===1?.34:.67;for(let j=0;j<amount;j++){const a=j/amount*Math.PI*2;add(Math.sin(a)*r,Math.cos(a)*r,ring===1?3:2,ring===1?.32:.39,.36,a);}}
 }else if(shape==='crescent'){
  for(let row=0;row<3;row++)for(let col=0;col<5;col++){if(row===2&&col<2)continue;add((col-2)*.315,(row-1)*.455,2+((col+row)%3===0?2:0),.29,.43,0);}
 }else if(shape==='ridge'){
  for(let row=0;row<2;row++)for(let col=0;col<5;col++)add((col-2)*.315,(row-.5)*.46,2+(row===0?1:0)+(col===2?1:0));
 }else if(shape==='small'){
  for(let row=0;row<2;row++)for(let col=0;col<3;col++)add((col-1)*.31,(row-.5)*.45,col===1?4:2);
 }else if(shape==='scatter'){
  for(let row=0;row<3;row++)for(let col=0;col<4;col++){if((row===0&&col===3)||(row===2&&col===0))continue;add((col-1.5)*.34+(row===1?.055:0),(row-1)*.46,2+(col+row)%3,.29,.43,(row===0?.09:-.045));}
 }else{
  // Offset each smaller tier by half a bar, like a real stack of ingots.
  // Stable supporting columns preserve bottom collection and top-down gunfire.
  for(let row=0;row<3;row++)for(let col=0;col<5;col++){add((col-2)*.31,(row-1)*.455,2);const b=layout.at(-1);b.levels=[{x:b.x,z:b.z},{x:b.x,z:b.z}];}
  let supports=layout.slice().sort((a,b)=>Math.hypot(a.x,a.z)-Math.hypot(b.x,b.z));
  for(const [cols,rows]of [[4,2],[3,2],[2,2],[1,2],[1,1]]){
   supports=supports.slice(0,cols*rows);
   const ordered=supports.slice().sort((a,b)=>a.z-b.z||a.x-b.x);
   ordered.forEach((b,i)=>{b.n++;b.levels.push({x:(i%cols-(cols-1)/2)*.31,z:(Math.floor(i/cols)-(rows-1)/2)*.455});});
  }
 }
 return layout;
}
function createPile(x,z,shape,angle=0){
 const c=Math.cos(angle),n=Math.sin(angle),transform=v=>({x:(v.x*c+v.z*n)*1.18,z:(-v.x*n+v.z*c)*1.12});
 const layout=pileLayout(shape).map(b=>({...b,...transform(b),levels:(b.levels||Array.from({length:b.n},()=>({x:b.x,z:b.z}))).map(transform),w:b.w*1.18,d:b.d*1.12,angle:b.angle+angle}));
 let x0=Infinity,x1=-Infinity,z0=Infinity,z1=-Infinity;
 for(const b of layout){const h=brickHalfBounds(b);x0=Math.min(x0,b.x-h.x);x1=Math.max(x1,b.x+h.x);z0=Math.min(z0,b.z-h.z);z1=Math.max(z1,b.z+h.z);}
 x=clamp(x,.22-x0,7.78-x1);z=clamp(z,CLEAR_ROWS-z0,PILE_MAX_Z-z1);
 const p={id:s.nextId++,x,z,shape,layout,cols:layout.map(b=>b.n),offsets:layout.map(()=>0),width:x1-x0,depth:z1-z0};
 // Occupied portions are omitted during replenishment, so gold cannot appear inside a unit.
 p.cols=p.cols.map((v,i)=>s.units.some(u=>p.layout[i].levels.some((_,l)=>brickTouchesRect(brickPos(p,i,l),u.x,u.z,...dims(u))))?0:v);
 return p;
}
function seedBricks(){
 if(s.piles.some(count))return;s.piles=[];
 const slots=[
  [1.45,2.84,'pyramid',-.025],[4.0,2.77,'small',.015],[6.54,2.91,'round',-.12],
  [1.42,4.94,'scatter',-.06],[4.13,5.03,'pyramid',.018],[6.69,4.98,'crescent',.065],
  [1.46,7.09,'round',.08],[4.13,7.18,'ridge',-.035],[6.57,7.03,'pyramid',.04]
 ];
 for(const [x,z,shape,angle]of slots){
  const p=createPile(x+(Math.random()-.5)*.15,z+(Math.random()-.5)*.1,shape,angle+(Math.random()-.5)*.035);
  if(count(p))s.piles.push(p);
 }
 // Late-game units can occupy all the normal pile positions. Try every remaining middle cell.
 if(!s.piles.length)for(let z=2.5;z<8;z++)for(let x=.6;x<8;x++){const p=createPile(x,z,'small');if(count(p)){s.piles.push(p);return;}}
}
