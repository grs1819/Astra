import * as THREE from 'three';
import {OrbitControls} from './vendor/OrbitControls.js';
import {waterKey,waterEdit} from './water.js';
import {createWaterView} from './water-view.js';
import {createVillagers} from './villagers.js';
import {LIMIT, key, directions, normalize, cottageCount, canPlace, removeBlock, archAxis, roofPlan, architecturePlan, assignRole, upgradeCamp, campsitePlan} from './town.js';

const $=s=>document.querySelector(s);
const canvas=$('#world');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.shadowMap.enabled=true;
renderer.shadowMap.autoUpdate=false;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.setClearColor('#dce6d7');
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.12;
const scene=new THREE.Scene();
scene.fog=new THREE.Fog('#dce6d7',38,85);
const camera=new THREE.PerspectiveCamera(38,1,.1,140);
const controls=new OrbitControls(camera,canvas);
controls.enableDamping=true;
controls.minDistance=5;controls.maxDistance=48;
controls.minPolarAngle=.22;controls.maxPolarAngle=1.35;
// Blender-style camera gestures; left/right buttons are reserved for edits.
controls.mouseButtons={LEFT:null,MIDDLE:THREE.MOUSE.ROTATE,RIGHT:null};
controls.touches={ONE:THREE.TOUCH.ROTATE,TWO:THREE.TOUCH.DOLLY_PAN};
function recenter(){camera.position.set(19,20,25);controls.target.set(0,0,0);controls.update();}
recenter();
scene.add(new THREE.HemisphereLight('#dcecf1','#829273',1.65));
const sunlight=new THREE.DirectionalLight('#fff0d6',2.7);
sunlight.position.set(-12,25,12);sunlight.castShadow=true;
sunlight.shadow.mapSize.set(2048,2048);
Object.assign(sunlight.shadow.camera,{left:-23,right:23,top:23,bottom:-23,near:.1,far:65});
sunlight.shadow.normalBias=.025;sunlight.shadow.bias=-.00015;scene.add(sunlight);
const materials=new Map();
function material(color){if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color,roughness:.94}));return materials.get(color);}
function box(parent,w,h,d,x,y,z,color){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material(color));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function clear(group){group.traverse(o=>{if(o.isMesh)o.geometry.dispose();});group.clear();}
const ground=new THREE.Mesh(new THREE.PlaneGeometry(170,170),material('#b9cba6'));
ground.rotation.x=-Math.PI/2;ground.position.y=-.055;ground.receiveShadow=true;scene.add(ground);
const clearing=new THREE.Group();scene.add(clearing);
for(let x=-LIMIT;x<=LIMIT;x++)for(let z=-LIMIT;z<=LIMIT;z++)box(clearing,.99,.05,.99,x,-.025,z,((x+z)%2===0)?'#b9cb9e':'#b5c89b');
clearing.children.forEach(tile=>tile.castShadow=false);
const rand=(x,z)=>(Math.sin(x*127.1+z*311.7)*43758.5453)%1/2+.5;
function tree(parent,x,z,scale=1){const g=new THREE.Group();g.position.set(x,0,z);g.scale.setScalar(scale);parent.add(g);box(g,.14,.8,.14,0,.4,0,'#776748');for(let i=0;i<3;i++){const m=new THREE.Mesh(new THREE.ConeGeometry(.64-i*.12,1.25,7),material(['#59754e','#668357','#789361'][i]));m.position.y=1+i*.43;m.castShadow=true;g.add(m);}return g;}
const forest=new THREE.Group();scene.add(forest);
for(let x=-15;x<=15;x++)for(let z=-15;z<=15;z++)if(Math.max(Math.abs(x),Math.abs(z))>10&&rand(x,z)>.57)tree(forest,x,z,.8+rand(z,x)*.55);
let state={blocks:{},water:{},peak:0};
try{const current=localStorage.getItem('stillwater-beta-v2');state=current?normalize(JSON.parse(current)):normalize(JSON.parse(localStorage.getItem('stillwater-beta-v1')),true);}catch{}
let water=state.water;
const waterView=createWaterView(scene,material,box);
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
let waterAnalysis;
let blocks=state.blocks,peak=state.peak,history=[],tool='house',pointerDown=null,hoverHit=null;
const buildings=new THREE.Group();scene.add(buildings);
const villagers=createVillagers(scene,material);
let targets=[];
const milestones=[{n:3,name:'The first neighbors',text:'Villagers have found their way to Stillwater.'},{n:6,name:'A lighter touch',text:'Silver birch timber unlocked.'},{n:9,name:'Earth & ember',text:'Rust red roof color unlocked.'},{n:12,name:'A town of your own',text:'Red cedar timber and slate blue roof color unlocked.'}];
function notify(message){$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(notify.timer);notify.timer=setTimeout(()=>$('#toast').classList.remove('show'),4200);}
function save(){try{localStorage.setItem('stillwater-beta-v2',JSON.stringify({blocks,water,peak}));}catch{notify('Autosave unavailable. Keep this tab open to preserve your town.');}}
function updateUI(){const n=cottageCount(blocks);peak=Math.max(peak,n);const next=milestones.find(m=>peak<m.n);$('#population').textContent=`${(peak>=3?n*2:0)+Object.values(blocks).filter(b=>b.type==='camp').length*2} villagers`;$('#next-title').textContent=next?.name||'Room to keep growing';$('#progress-number').textContent=next?`${n} / ${next.n}`:`${n} cottages`;$('#progress').style.width=`${next?Math.min(100,n/next.n*100):100}%`;$('#next-description').textContent=next?`Grow to ${next.n} cottage plots to make your next discovery.`:'All discoveries unlocked. Make this clearing your own.';$('#discovery-count').textContent=`${milestones.filter(m=>peak>=m.n).length} / 4`;$('#journal').innerHTML=milestones.map(m=>`<div>${peak>=m.n?'✦':'○'} ${m.n} cottages · ${m.name}</div>`).join('');for(const [id,values]of Object.entries({wood:{birch:6,cedar:12},roof:{clay:9,slate:12}}))for(const option of $(`#${id}`).options)if(values[option.value])option.disabled=peak<values[option.value];$('#undo').disabled=!history.length;}
const ghost=new THREE.Mesh(new THREE.BoxGeometry(1.01,.96,1.01),new THREE.MeshBasicMaterial({color:'#fff5bf',transparent:true,opacity:.28,depthWrite:false}));ghost.visible=false;scene.add(ghost);
const invisible=new THREE.MeshBasicMaterial({visible:false});
const timber={oak:'#c6a171',birch:'#ded4b3',cedar:'#b77d61'};
const roofs={moss:'#718a58',clay:'#b87755',slate:'#718b94'};
let roofForms=new Map(),architecture=new Map();
// Surface details follow each roof triangle, including hips and shared ridges.
const roofMaterials=new Map();
function roofingMaterial(color,tier){
  const id=`${color}:${tier}`;
  if(!roofMaterials.has(id)){
    const tint=new THREE.Color(color);
    if(tier!=='cottage')tint.lerp(new THREE.Color(tier==='estate'?'#92a4a6':'#86877b'),.25);
    roofMaterials.set(id,new THREE.MeshStandardMaterial({color:tint,roughness:tier==='estate'?.34:tier==='lodge'?.73:1,metalness:tier==='estate'?.72:tier==='lodge'?.4:0,side:THREE.DoubleSide}));
  }
  return roofMaterials.get(id);
}
function roofDetails(parent,vertices,tier,color){
  const metal=tier!=='cottage';
  for(let i=0;i<vertices.length;i+=9){
    const a=new THREE.Vector3(...vertices.slice(i,i+3)),b=new THREE.Vector3(...vertices.slice(i+3,i+6)),c=new THREE.Vector3(...vertices.slice(i+6,i+9));
    const normal=new THREE.Vector3().crossVectors(b.clone().sub(a),c.clone().sub(a)).normalize();
    if(normal.y<.1)continue; // Gable walls remain clear of roofing details.
    if(!metal){
      // Low, irregular clumps give living moss thickness without hiding the roof.
      for(let j=0;j<7;j++){
        const u=(j*.381966+.13)%1,v=((j*.618034+.27)%1)*(1-u);
        const point=a.clone().multiplyScalar(1-u-v).addScaledVector(b,u).addScaledVector(c,v);
        const moss=new THREE.Mesh(new THREE.IcosahedronGeometry(.065+(j%3)*.013,0),material(new THREE.Color('#718a58').multiplyScalar(.88+(j%3)*.09).getStyle()));
        moss.scale.set(1,.45,1);moss.position.copy(point).addScaledVector(normal,.018);moss.castShadow=true;parent.add(moss);
      }
      continue;
    }
    // Clip parallel raised seams to the actual sloped face, never across gaps.
    const axis=Math.abs(normal.x)>Math.abs(normal.z)?'z':'x';
    const step=tier==='estate'?.22:.13;
    const lo=Math.min(a[axis],b[axis],c[axis]),hi=Math.max(a[axis],b[axis],c[axis]);
    for(let at=Math.ceil((lo+1e-6)/step)*step;at<hi-1e-6;at+=step){
      const hits=[];
      for(const [p,q]of [[a,b],[b,c],[c,a]]){
        if(Math.abs(q[axis]-p[axis])<1e-8)continue;
        const t=(at-p[axis])/(q[axis]-p[axis]);
        if(t>=0&&t<=1){const hit=p.clone().lerp(q,t);if(!hits.some(h=>h.distanceToSquared(hit)<1e-10))hits.push(hit);}
      }
      if(hits.length!==2)continue;
      const [p,q]=hits,length=p.distanceTo(q);if(length<.001)continue;
      const seam=new THREE.Mesh(new THREE.BoxGeometry(tier==='estate'?.018:.022,length,tier==='estate'?.035:.014),roofingMaterial(color,tier));
      seam.position.copy(p).add(q).multiplyScalar(.5).addScaledVector(normal,.017);
      const along=q.clone().sub(p).normalize();
      const across=new THREE.Vector3().crossVectors(along,normal).normalize();
      seam.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(across,along,normal));seam.castShadow=true;parent.add(seam);
      if(tier==='lodge'&&length>.18){
        const nail=new THREE.Mesh(new THREE.SphereGeometry(.015,4,3),material('#655e50'));
        nail.position.copy(p).lerp(q,.2).addScaledVector(normal,.03);parent.add(nail);
      }
    }
  }
}
function roof(parent,x,y,z,color){
  const form=roofForms.get(key(x,y,z));if(!form)return;
  const top=y+1;
  const tier=architecture.get(key(x,y,z))?.tier||'cottage';
  const estate=tier==='estate';
  const rise=estate?1.35:1;
  if(form.kind==='terrace'){
    const deck=box(parent,1,.08,1,x,top+.04,z,'#bba47d');
    deck.userData={position:[x,y,z],normal:[0,1,0]};targets.push(deck);
    for(let i=-2;i<=2;i++)box(parent,.016,.012,.98,x+i*.19,top+.085,z,'#967c56');
    for(const [dx,,dz]of directions){
      const neighbor=roofForms.get(key(x+dx,y,z+dz));
      if(blocks[key(x+dx,y+1,z+dz)]||neighbor?.kind==='terrace')continue;
      railing(parent,x,top-.03,z,dx,dz,'#897553');
    }
    return;
  }
  const vertices=[];
  function triangle(a,b,c){
    const normal=new THREE.Vector3().crossVectors(new THREE.Vector3().subVectors(new THREE.Vector3(...b),new THREE.Vector3(...a)),new THREE.Vector3().subVectors(new THREE.Vector3(...c),new THREE.Vector3(...a)));
    if(normal.y<0)[b,c]=[c,b];vertices.push(...a,...b,...c);
  }
  if(form.kind==='hip'){
    const corners=[[x-.53,top,z-.53],[x+.53,top,z-.53],[x+.53,top,z+.53],[x-.53,top,z+.53]];
    for(let i=0;i<4;i++)triangle(corners[i],corners[(i+1)%4],[x,top+.48*rise,z]);
  }else{
    const cross=form.axis==='x'?z:x,along=form.axis==='x'?x:z;
    const cuts=[cross-.5,...(form.ridge>cross-.5&&form.ridge<cross+.5?[form.ridge]:[]),cross+.5];
    const height=c=>top+Math.max(0,1-Math.abs(c-form.ridge)/((form.hi-form.lo)/2))*form.height*rise;
    const point=(a,c,h=height(c))=>form.axis==='x'?[a,h,c]:[c,h,a];
    for(let i=0;i<cuts.length-1;i++){
      const c=cuts[i],d=cuts[i+1],a=point(along-.5,c),b=point(along+.5,c),e=point(along+.5,d),f=point(along-.5,d);
      triangle(a,b,e);triangle(a,e,f);
      for(const side of [-1,1]){
        const nx=x+(form.axis==='x'?side:0),nz=z+(form.axis==='z'?side:0);
        if(roofForms.get(key(nx,y,nz))===form)continue;
        const edge=along+side*.5;triangle(point(edge,c,top),point(edge,c),point(edge,d));triangle(point(edge,c,top),point(edge,d),point(edge,d,top));
      }
    }
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.computeVertexNormals();
  const roofMaterial=roofingMaterial(color,tier);
  roofDetails(parent,vertices,tier,color);
  const m=new THREE.Mesh(geometry,roofMaterial);m.castShadow=true;m.receiveShadow=true;m.userData={position:[x,y,z],normal:[0,1,0]};parent.add(m);targets.push(m);
  if(form.kind==='gable'){
    const cross=form.axis==='x'?z:x;
    if(form.ridge>=cross-.5&&form.ridge<cross+.5){
      const cap=box(parent,form.axis==='x'?1.02:.07,.07,form.axis==='z'?1.02:.07,form.axis==='x'?x:form.ridge,top+form.height*rise,form.axis==='z'?z:form.ridge,color);
      cap.material=roofingMaterial(color,tier);
    }
  }
  if(estate&&form.anchor===key(x,y,z)){
    // A capped stone chimney gives larger roof silhouettes a distinct finish.
    box(parent,.16,.6,.18,x+.24,top+.42,z+.16,'#afa78f');
    box(parent,.22,.07,.24,x+.24,top+.75,z+.16,'#d9d0b5');
  }
  for(const [dx,,dz]of directions)if(!blocks[key(x+dx,y,z+dz)])box(parent,dx?.055:1,.065,dz?.055:1,x+dx*.5,top,z+dz*.5,'#8e7955');
}
function railing(parent,x,y,z,dx,dz,color){
  const g=new THREE.Group();g.position.set(x+dx*.46,y+.12,z+dz*.46);g.rotation.y=dx?Math.PI/2:0;parent.add(g);
  box(g,.97,.055,.055,0,.39,0,color);
  for(let i=-2;i<=2;i++)box(g,.045,.39,.045,i*.21,.2,0,color);
}
function arch(parent,x,y,z,axis,color){
  const shape=new THREE.Shape();shape.moveTo(-.5,1);shape.lineTo(.5,1);shape.lineTo(.5,.05);
  for(let i=0;i<=20;i++){const a=i/20*Math.PI;shape.lineTo(Math.cos(a)*.5,.05+Math.sin(a)*.75);}
  shape.lineTo(-.5,1);
  const geo=new THREE.ExtrudeGeometry(shape,{depth:.9,bevelEnabled:false});geo.translate(0,0,-.45);if(axis==='z')geo.rotateY(Math.PI/2);
  const m=new THREE.Mesh(geo,material(color));m.position.set(x,y-1,z);m.castShadow=true;parent.add(m);
}
const roleLabels={fishing:'FISHING',supply:'OUTFITTER',cafe:'BAKERY',inn:'LODGE',workshop:'WOODWORK',boathouse:'BOATHOUSE'};
const signMaterials=new Map();
const roleColors={fishing:'#397c8a',supply:'#b27a3c',cafe:'#b96452',inn:'#716095',workshop:'#826341',boathouse:'#436999'};
function roleDetails(parent,x,z,role,base,dx=0,dz=1){
  const g=new THREE.Group();g.position.set(x,base,z);g.rotation.y=dx?dx*Math.PI/2:dz===-1?Math.PI:0;parent.add(g);
  if(!signMaterials.has(role)){
    const c=document.createElement('canvas');c.width=256;c.height=64;const ctx=c.getContext('2d');ctx.fillStyle=roleColors[role];ctx.fillRect(0,0,256,64);ctx.fillStyle='#fff0cf';ctx.font='bold 30px sans-serif';ctx.textAlign='center';ctx.fillText(roleLabels[role],128,42);
    const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;signMaterials.set(role,new THREE.MeshBasicMaterial({map:texture}));
  }
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(.98,.25),signMaterials.get(role));sign.position.set(0,.84,.61);g.add(sign);
  box(g,1.04,.28,.075,0,.84,.555,roleColors[role]);
  // Color-coded corner banners and projecting signs stay legible while orbiting.
  box(g,.16,.5,.06,-.4,.42,.56,roleColors[role]);
  box(g,.045,.48,.045,.46,.77,.66,'#69583e');
  box(g,.045,.045,.3,.46,.99,.67,'#69583e');
  const hanging=new THREE.Mesh(new THREE.PlaneGeometry(.28,.23),signMaterials.get(role));
  hanging.material.side=THREE.DoubleSide;hanging.position.set(.46,.83,.72);hanging.rotation.y=Math.PI/2;g.add(hanging);
  if(role!=='cafe'){
    const canopy=box(g,.78,.055,.26,0,.66,.64,roleColors[role]);canopy.rotation.x=.14;
  }
  if(role==='cafe'){
    const awning=box(g,.88,.05,.25,0,.7,.62,'#b97859');awning.rotation.x=.15;
    for(let i=-2;i<=2;i++)box(g,.08,.055,.25,i*.17,.705,.62,'#f0dfb8');
  }else if(role==='fishing'){
    for(const x of [-.37,-.27]){const rod=box(g,.025,.7,.025,x,.38,.55,'#6b563c');rod.rotation.z=-.15;}
    box(g,.17,.18,.15,.34,.13,.56,'#82909a');
  }else if(role==='supply'){
    for(const x of [-.34,.34]){box(g,.17,.25,.1,x,.34,.56,'#8c9e70');box(g,.12,.04,.13,x,.48,.57,'#ccae73');}
  }else if(role==='workshop'){
    box(g,.27,.06,.17,.31,.24,.56,'#8f6545');for(const x of [.2,.4])box(g,.03,.23,.12,x,.12,.56,'#735940');
  }else if(role==='inn'){
    for(const x of [-.36,.36]){box(g,.09,.15,.1,x,.56,.56,'#e4b965');box(g,.13,.025,.13,x,.65,.56,'#4c5945');}
  }else if(role==='boathouse'){
    for(const x of [-.36,.36]){box(g,.025,.63,.03,x,.37,.56,'#9c784d');box(g,.1,.19,.035,x,.16,.56,'#bb9762');}
  }
}
function camp(parent,x,z,stage){
  const g=new THREE.Group();g.position.set(x,0,z);parent.add(g);
  const floor=stage===3?.18:.045,peak=stage===3?.95:.72;
  box(g,.9,floor,.9,0,floor/2,0,stage===3?'#af9064':'#8d8063');
  const cloth=material(stage===1?'#73845a':stage===2?'#bf9960':'#e1d3b2');cloth.side=THREE.DoubleSide;
  const points=stage===1?[-.44,floor,-.43,.44,peak,-.43,.44,peak,.43,-.44,floor,-.43,.44,peak,.43,-.44,floor,.43]:[-.44,floor,-.43,0,peak,-.43,0,peak,.43,-.44,floor,-.43,0,peak,.43,-.44,floor,.43,0,peak,-.43,.44,floor,-.43,.44,floor,.43,0,peak,-.43,.44,floor,.43,0,peak,.43];
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(points,3));geo.computeVertexNormals();const cover=new THREE.Mesh(geo,cloth);cover.castShadow=true;cover.receiveShadow=true;g.add(cover);
  for(const zz of [-.4,.4])box(g,.035,peak,.035,stage===1?.42:0,peak/2,zz,'#725a3e');
  box(g,.23,.05,.5,-.13,floor+.03,0,'#a46e57');
  if(stage===3){
    for(const xx of [-.36,.36])box(g,.045,.65,.045,xx,.4,.37,'#8b6e49');
    box(g,.1,.14,.1,.35,.57,.37,'#ebc776');box(g,.28,.08,.12,0,.06,.48,'#bba07a');
    box(g,.28,.08,.58,-.12,.28,0,'#eee3c7');
  }
}

function campGathering(parent,x,z,size){
  const g=new THREE.Group();g.position.set(x,0,z);parent.add(g);
  const fancy=size>=4;
  const hearth=new THREE.Mesh(new THREE.CylinderGeometry(fancy?.24:.18,fancy?.25:.2,.06,12),material('#645c50'));
  hearth.position.y=.065;hearth.receiveShadow=true;g.add(hearth);
  for(let i=0;i<(fancy?12:7);i++){
    const a=i/(fancy?12:7)*Math.PI*2,r=fancy?.23:.18;
    const stone=new THREE.Mesh(new THREE.DodecahedronGeometry(fancy?.055:.045,0),material(i%2?'#aaa58f':'#898877'));
    stone.position.set(Math.cos(a)*r,.105,Math.sin(a)*r);g.add(stone);
  }
  for(const angle of [-.65,.65]){const log=box(g,.29,.05,.06,0,.105,0,'#72503a');log.rotation.y=angle;}
  // Low-poly flames are static so reduced-motion users get the same scene.
  for(let i=0;i<3;i++){
    const flame=new THREE.Mesh(new THREE.ConeGeometry(.055,.19+i*.035,5),material(i===1?'#ffd47a':'#e99444'));
    flame.position.set((i-1)*.045,.19,0);g.add(flame);
  }
  if(fancy){
    for(const side of [-1,1]){
      box(g,.2,.045,.23,side*.36,.17,0,'#b58d5d');
      box(g,.045,.23,.23,side*.45,.29,0,'#9c764f');
      for(const z of [-.08,.08])box(g,.035,.16,.035,side*.36,.08,z,'#745b40');
    }
    box(g,.3,.06,.15,0,.18,-.39,'#ba976b');
    for(const side of [-1,1])box(g,.035,.16,.1,side*.1,.08,-.39,'#745b40');
    box(g,.035,.65,.035,.4,.325,.4,'#756445');
    box(g,.09,.13,.09,.4,.62,.4,'#e8c77c');
  }else box(g,.38,.1,.13,0,.085,-.36,'#98744e');
}

function rebuild(){
  renderer.shadowMap.needsUpdate=true;
  clear(buildings);targets=[];
  waterAnalysis=waterView.rebuild(water,blocks);
  roofForms=roofPlan(blocks);
  architecture=architecturePlan(blocks);
  const camps=campsitePlan(blocks);
  for(const [k,b]of Object.entries(blocks)){
    const [x,y,z]=k.split(',').map(Number);
    if(b.type==='tree'){tree(buildings,x,z);}
    if(b.type==='camp'){
      const group=camps.get(k);
      // Contiguous ground pads visually join the tents and gathering area.
      if(group.size>=2)box(buildings,1,.035,1,x,.018,z,'#ad9c78');
      if(group.hub===k)campGathering(buildings,x,z,group.size);
      else camp(buildings,x,z,Math.max(b.stage||1,group.stage));
    }
    if(b.type==='path'){
      if(water[waterKey(x,z)]){
        box(buildings,1,.12,1,x,.15,z,'#b49a71');
        for(let i=-2;i<=2;i++)box(buildings,.018,.012,.97,x+i*.19,.215,z,'#806c4f');
        for(const dx of [-.37,.37])for(const dz of [-.37,.37])box(buildings,.07,.22,.07,x+dx,.11,z+dz,'#887254');
        const alongX=[-1,1].some(dx=>blocks[key(x+dx,0,z)]?.type==='path');
        for(const side of [-1,1]){
          const dx=alongX?0:side,dz=alongX?side:0;
          if(!['path','house','balcony'].includes(blocks[key(x+dx,0,z+dz)]?.type))railing(buildings,x,.1,z,dx,dz,'#8a7454');
        }
      }else box(buildings,.98,.065,.98,x,.025,z,'#cbbb97');
    }
    if(b.type==='house'){
      const wetBase=y===0&&!!water[waterKey(x,z)],base=wetBase?.26:0;
      const tier=architecture.get(k).tier,estate=tier==='estate',lodge=tier==='lodge';
      const wall=estate?(y===0?'#b6ad94':'#e0d4b7'):timber[b.wood];box(buildings,1,1-base,1,x,y+base+(1-base)/2,z,wall);
      if(wetBase){
        for(const dx of [-.37,.37])for(const dz of [-.37,.37])box(buildings,.1,.28,.1,x+dx,.14,z+dz,'#817057');
        box(buildings,1.08,.08,1.08,x,.26,z,'#ac916a');
      }
      for(const [dx,,dz]of directions){
        if(blocks[key(x+dx,y,z+dz)]?.type==='house')continue;
        const face=new THREE.Group();face.position.set(x+dx*.505,y+base,z+dz*.505);face.scale.y=1-base;face.rotation.y=dx?dx*Math.PI/2:dz===-1?Math.PI:0;buildings.add(face);
        if(lodge){
          for(let h=.1;h<1;h+=.16){
            const log=new THREE.Mesh(new THREE.CylinderGeometry(.085,.085,1.04,7),material(timber[b.wood]));
            log.rotation.z=Math.PI/2;log.position.set(0,h,.008);log.castShadow=true;face.add(log);
          }
        }else if(estate){
          box(face,1.04,.09,.09,0,.94,.025,'#eaddc2');
          box(face,1.04,.08,.08,0,.07,.025,'#a79a7e');
          for(const side of [-1,1]){
            box(face,.075,.84,.08,side*.45,.5,.025,timber[b.wood]);
            if(y===0)for(let h=.18;h<.9;h+=.2)box(face,.13,.09,.1,side*.43,h,.035,'#d6cbb1');
          }
        }else for(let h=.17;h<1;h+=.19)box(face,1,.017,.016,0,h,0,'#987951');
        const terraceDoor=y>0&&(blocks[key(x+dx,y,z+dz)]?.type==='balcony'||roofForms.get(key(x+dx,y-1,z+dz))?.kind==='terrace');
        if((y===0&&dz===1)||terraceDoor){
          box(face,estate?.34:.24,.61,.045,0,.305,.09,'#6c5942');
          box(face,.035,.035,.04,.08,.29,.12,'#e1c98c');
          if(estate){
            for(const side of [-1,1])box(face,.065,.66,.12,side*.22,.33,.09,'#eaddc2');
            box(face,.54,.09,.18,0,.69,.09,'#eaddc2');
            box(face,.22,.12,.04,0,.54,.12,'#f2d292');
          }
        }else{
          const positions=estate?[-.22,.22]:[0];
          for(const wx of positions){
            const w=estate?.25:.3,h=estate?.46:.36,depth=lodge?.105:.035;
            box(face,w+.07,h+.07,.055,wx,.56,depth,'#735e45');
            box(face,w,h,.03,wx,.56,depth+.04,'#f2d292');
            box(face,.025,h,.035,wx,.56,depth+.06,'#957b50');
            box(face,w,.025,.035,wx,.56,depth+.06,'#957b50');
            if(estate){box(face,w+.1,.055,.12,wx,.29,.06,'#eaddc2');box(face,w+.1,.065,.09,wx,.83,.06,'#eaddc2');}
          }
        }
        // Brackets under cantilevered rooms, leaving walkable space below.
        if(y>0&&!blocks[key(x,y-1,z)]){const brace=box(face,.07,.48,.07,dx?-.29:.29,-.13,-.12,'#8a7050');brace.rotation.x=-.65;}
      }
      if(y===0&&b.role&&b.role!=='home')for(const [dx,,dz]of directions)if(blocks[key(x+dx,0,z+dz)]?.type!=='house')roleDetails(buildings,x,z,b.role,base,dx,dz);
      // Short entrance stairs occupy only free frontage and rebuild with terrain.
      if(y===0&&!blocks[key(x,0,z+1)]&&!water[waterKey(x,z+1)]&&z<LIMIT){
        const steps=wetBase?3:1;
        for(let i=0;i<steps;i++){
          const h=(steps-i)*(wetBase?.085:.065);
          box(buildings,.4,h,.12,x,h/2,z+.56+i*.11,'#afa68a');
        }
      }
      if(!blocks[key(x,y+1,z)])roof(buildings,x,y,z,roofs[b.roof]);
      const axis=archAxis(blocks,x,y,z);if(axis)arch(buildings,x,y,z,axis,'#b5ad89');
    }
    if(b.type==='balcony'){
      box(buildings,1,.12,1,x,y+.06,z,timber[b.wood]);
      for(let i=-2;i<=2;i++)box(buildings,.018,.015,.96,x+i*.19,y+.125,z,'#92784f');
      for(const [dx,,dz]of directions)if(!['house','balcony'].includes(blocks[key(x+dx,y,z+dz)]?.type))railing(buildings,x,y,z,dx,dz,'#866e4d');
    }
    const proxy=new THREE.Mesh(new THREE.BoxGeometry(1,['house','camp'].includes(b.type)?1:b.type==='tree'?1.7:b.type==='path'&&water[waterKey(x,z)]?.45:.15,1),invisible);
    proxy.position.set(x,y+(['house','camp'].includes(b.type)?.5:b.type==='tree'?.85:b.type==='path'&&water[waterKey(x,z)]?.225:.075),z);proxy.userData={position:[x,y,z]};buildings.add(proxy);targets.push(proxy);
  }
  villagers.rebuild(blocks,water,peak>=3);
}
function commit(next,nextWater=water){
  history.push(JSON.stringify({blocks,water}));if(history.length>80)history.shift();
  const before=peak;blocks=next;water=nextWater;updateUI();rebuild();save();
  for(const m of milestones)if(before<m.n&&peak>=m.n)notify(`✧ ${m.text}`);
}
function undo(){if(!history.length)return;const previous=JSON.parse(history.pop());blocks=previous.blocks;water=previous.water;updateUI();rebuild();save();ghost.visible=false;}
function destination(hit){
  if(!hit)return null;
  const [x,y,z]=hit.position;
  if(tool==='role')return null;
  if(tool==='camp')return hit.ground?[x,0,z]:blocks[key(x,y,z)]?.type==='camp'?[x,y,z]:null;
  if(tool==='water')return[x,0,z];
  if(hit.ground)return[x,0,z];
  if(tool==='erase')return[x,y,z];
  if(tool==='path'||tool==='tree')return null;
  if(blocks[key(x,y,z)]?.type==='balcony'&&tool==='house')return[x,y,z];
  const [dx,dy,dz]=hit.normal;return[x+dx,y+dy,z+dz];
}
function edit(hit,remove=false,paint=false){
  if(!hit)return;
  const [x,,z]=hit.position;
  if(tool==='water'){
    const next=waterEdit(water,blocks,x,z,remove?null:$('#water-kind').value,LIMIT);
    if(next)commit(blocks,next);
    else if(!remove&&['tree','camp'].includes(blocks[key(x,0,z)]?.type))notify('Remove this tree or campsite first to make room for water.');
    return;
  }
  if(remove||tool==='erase'){
    if(hit.ground){const next=waterEdit(water,blocks,x,z,null,LIMIT);if(next)commit(blocks,next);}
    else commit(removeBlock(blocks,key(...hit.position)));
    return;
  }
  if(tool==='role'){const next=assignRole(blocks,key(...hit.position),$('#building-role').value);if(next){commit(next);notify('Building purpose updated. Connect paths to welcome visitors.');}else notify('Choose an existing building.');return;}
  if(tool==='camp'&&!hit.ground&&blocks[key(...hit.position)]?.type==='camp'){const next=upgradeCamp(blocks,key(...hit.position));if(next){commit(next);notify(next[key(...hit.position)].stage===2?'A proper tent, ready for adventure.':'Your glamping retreat is ready.');}else notify('This campsite is fully upgraded.');return;}
  if(paint&&!hit.ground){const k=key(...hit.position);if(['house','balcony'].includes(blocks[k]?.type)){const next=structuredClone(blocks);next[k]={...next[k],wood:$('#wood').value,roof:$('#roof').value};commit(next);}return;}
  const p=destination(hit);
  if(!p||!canPlace(blocks,...p,tool,water)){notify(tool==='tree'?'Trees need open, dry ground.':'Choose open ground, a roof, or an exposed wall. Build up to 8 floors.');return;}
  const next=structuredClone(blocks);next[key(...p)]={type:tool,wood:$('#wood').value,roof:$('#roof').value};if(tool==='camp')next[key(...p)].stage=1;if(tool==='house'&&!hit.ground&&blocks[key(...hit.position)]?.role)next[key(...p)].role=blocks[key(...hit.position)].role;commit(next);
}
const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
function pick(e){const rect=canvas.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);const hits=raycaster.intersectObjects([...targets,ground],false);for(const hit of hits){if(hit.object===ground){const x=Math.round(hit.point.x),z=Math.round(hit.point.z);return Math.abs(x)<=LIMIT&&Math.abs(z)<=LIMIT?{position:[x,0,z],normal:[0,1,0],ground:true}:null;}return {position:hit.object.userData.position,normal:hit.object.userData.normal||hit.face.normal.toArray().map(Math.round),ground:false};}return null;}
function preview(hit){
  const p=destination(hit);
  const wet=hit&&water[waterKey(hit.position[0],hit.position[2])];
  ghost.visible=!!p&&(tool==='water'?!!waterEdit(water,blocks,p[0],p[2],$('#water-kind').value,LIMIT):tool==='erase'?(!hit.ground||!!wet):tool==='camp'&&blocks[key(...p)]?.type==='camp'?!!upgradeCamp(blocks,key(...p)):canPlace(blocks,...p,tool,water));
  if(tool==='water'&&hit){
    const body=waterAnalysis.cells.get(waterKey(hit.position[0],hit.position[2]));
    $('#water-status').textContent=body?`${body.size} connected tiles · ${['Gentle ripples','Pebbles along the banks','Boulders join the shoreline','Reeds and water lilies'][body.tier]}`:'Click the grid to grow a waterway.';
  }
  if(!ghost.visible)return;
  ghost.position.set(p[0],tool==='water'?.08:p[1]+.5,p[2]);
  ghost.material.color.set(tool==='water'?'#77c9ce':tool==='erase'?'#d78469':'#fff5bf');
  ghost.scale.set(1,tool==='water'?.065:tool==='balcony'?.16:1,1);
}
function resetPointerInteraction(){
  const id=pointerDown?.pointerId;
  pointerDown=null;ghost.visible=false;canvas.style.cursor='';
  if(id!==undefined&&canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);
  // A release outside the window can leave OrbitControls tracking the old
  // mouse pointer. Reset its public event connection before the next gesture.
  controls.disconnect();controls.connect(canvas);
}
// Recover a missed release before OrbitControls sees a fresh mouse press.
canvas.addEventListener('pointerdown',e=>{
  if(e.pointerType!=='touch'&&pointerDown?.pointerId===e.pointerId)resetPointerInteraction();
},{capture:true});
canvas.addEventListener('pointerdown',e=>{
  if(![0,1,2].includes(e.button))return;
  if(e.button===1){e.preventDefault();canvas.style.cursor='grabbing';}
  pointerDown={pointerId:e.pointerId,x:e.clientX,y:e.clientY,button:e.button,moved:false,alt:e.altKey};
});
canvas.addEventListener('pointermove',e=>{
  if(pointerDown&&Math.hypot(e.clientX-pointerDown.x,e.clientY-pointerDown.y)>5)pointerDown.moved=true;
  // Camera drags do not need an expensive building raycast on every event.
  if(pointerDown&&(pointerDown.button===1||pointerDown.moved)){ghost.visible=false;return;}
  hoverHit=pick(e);preview(hoverHit);
});
canvas.addEventListener('pointerup',e=>{
  if(pointerDown?.pointerId!==e.pointerId)return;
  if(!pointerDown.moved&&pointerDown.button!==1)edit(pick(e),pointerDown.button===2,pointerDown.alt);
  pointerDown=null;ghost.visible=false;canvas.style.cursor='';
});
canvas.addEventListener('pointercancel',()=>{pointerDown=null;ghost.visible=false;canvas.style.cursor='';});
canvas.addEventListener('lostpointercapture',e=>{if(pointerDown?.pointerId===e.pointerId)resetPointerInteraction();});
addEventListener('blur',resetPointerInteraction);
document.addEventListener('visibilitychange',()=>{if(document.hidden)resetPointerInteraction();});
// Suppress native middle-button autoscroll on browsers that still dispatch it.
canvas.addEventListener('mousedown',e=>{if(e.button===1)e.preventDefault();});
canvas.addEventListener('auxclick',e=>{if(e.button===1)e.preventDefault();});
canvas.addEventListener('pointerleave',()=>ghost.visible=false);
canvas.addEventListener('contextmenu',e=>e.preventDefault());
function selectTool(value){tool=value;$('#water-options').hidden=value!=='water';$('#building-materials').hidden=['water','role','camp'].includes(value);$('#role-options').hidden=value!=='role';document.querySelectorAll('[data-tool]').forEach(b=>{b.classList.toggle('active',b.dataset.tool===tool);b.setAttribute('aria-pressed',String(b.dataset.tool===tool));});ghost.visible=false;}
document.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>selectTool(b.dataset.tool));
$('#undo').onclick=undo;
const dock=$('.dock'), dockMenu=$('#build-menu'), dockToggle=$('#dock-toggle');
function setTasks(open){
  $('#tasks-panel').hidden=!open;
  $('#tasks-toggle').setAttribute('aria-expanded',String(open));
}
function setDock(open){
  if(!open && dockMenu.contains(document.activeElement))dockToggle.focus();
  dock.dataset.open=String(open);
  dockMenu.inert=!open;
  dockMenu.setAttribute('aria-hidden',String(!open));
  dockToggle.setAttribute('aria-expanded',String(open));
  dockToggle.setAttribute('aria-label',open?'Close building menu':'Open building menu');
  dockToggle.title=(open?'Close':'Open')+' building menu (B)';
  $('#dock-caption').innerHTML=open?'A little room to create':'Build your town <kbd>B</kbd>';
  if(!open)setTasks(false);
  // Restart the short logo bounce and water ripple on each toggle.
  dockToggle.classList.remove('animating');
  void dockToggle.offsetWidth;
  dockToggle.classList.add('animating');
}
dockToggle.addEventListener('animationend',()=>dockToggle.classList.remove('animating'));
dockToggle.onclick=()=>setDock(dock.dataset.open!=='true');
$('#tasks-toggle').onclick=()=>setTasks($('#tasks-panel').hidden);
addEventListener('keydown',e=>{
  if(e.key==='Escape' && dock.dataset.open==='true'){e.preventDefault();setDock(false);return;}
  if(['SELECT','INPUT','TEXTAREA'].includes(document.activeElement.tagName)||e.ctrlKey||e.metaKey||e.altKey||e.repeat)return;
  if(e.key.toLowerCase()==='b'){e.preventDefault();setDock(dock.dataset.open!=='true');}
  if(e.key.toLowerCase()==='r')recenter();
});
function orbit(delta){const offset=camera.position.clone().sub(controls.target);offset.applyAxisAngle(new THREE.Vector3(0,1,0),delta);camera.position.copy(controls.target).add(offset);controls.update();}
controls.addEventListener('change',()=>{ghost.visible=false;});
addEventListener('keydown',e=>{if(['SELECT','INPUT'].includes(document.activeElement.tagName))return;if(['1','2','3','4','5','6','7','8'].includes(e.key))selectTool(['house','path','tree','erase','balcony','water','camp','role'][Number(e.key)-1]);if((e.ctrlKey||e.metaKey)&&e.key==='z'){e.preventDefault();undo();}if(e.key.toLowerCase()==='q')orbit(Math.PI/8);if(e.key.toLowerCase()==='e')orbit(-Math.PI/8);});
function resize(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);}addEventListener('resize',resize);resize();
updateUI();rebuild();save();
renderer.setAnimationLoop(t=>{
  controls.update();waterView.animate(t,reducedMotion.matches);
  villagers.animate(t,reducedMotion.matches);
  renderer.render(scene,camera);
});
