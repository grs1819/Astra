import * as THREE from 'three';
import {OrbitControls} from './vendor/OrbitControls.js';
import {waterKey,waterEdit} from './water.js';
import {createWaterView} from './water-view.js';
import {pathLinks,dockOpen,pathOutline} from './navigation.js';
import {createVillagers} from './villagers.js';
import {LIMIT, key, directions, normalize, cottageCount, canPlace, removeBlock, archAxis, roofPlan, architecturePlan, assignRole, upgradeCamp, campsitePlan, lookoutPlan, entrancePlan, joinedRoofHeight} from './town.js';

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
controls.minPolarAngle=.06;controls.maxPolarAngle=1.48;
controls.screenSpacePanning=false; // Two-finger drags follow the ground plane.
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
const treeHeights={pine:2.5,larch:2.7,birch:2.35,redwood:3.8};
function tree(parent,x,z,scale=1,species='pine'){
  const g=new THREE.Group();g.name=`tree-${species}`;g.position.set(x,0,z);g.scale.setScalar(scale);parent.add(g);
  const redwood=species==='redwood',birch=species==='birch',larch=species==='larch';
  const trunk=redwood?.3:birch?.095:.14,height=redwood?2.7:birch?1.8:1.3;
  box(g,trunk,height,trunk,0,height/2,0,birch?'#e6e1cb':redwood?'#94573f':'#776748');
  if(birch){
    for(let i=0;i<7;i++)box(g,.1,.025,.105,0,.18+i*.21,0,'#6f7162');
    for(const [xx,yy,zz,r]of [[-.25,1.55,0,.45],[.26,1.8,.08,.46],[0,2.02,-.12,.36]]){
      const leaves=new THREE.Mesh(new THREE.IcosahedronGeometry(r,1),material('#9eaf68'));leaves.position.set(xx,yy,zz);leaves.scale.y=.85;leaves.castShadow=true;g.add(leaves);
    }
  }else{
    const layers=redwood?4:larch?5:3;
    for(let i=0;i<layers;i++){
      const radius=redwood?.64-i*.1:larch?.57-i*.09:.64-i*.12;
      const m=new THREE.Mesh(new THREE.ConeGeometry(radius,redwood?1.3:larch?.75:1.25,larch?9:7),material(larch?['#a7ac59','#b3b866','#bec276'][i%3]:redwood?['#49694d','#557652','#65825c'][i%3]:['#59754e','#668357','#789361'][i%3]));
      m.position.y=redwood?1.5+i*.55:larch?.8+i*.38:1+i*.43;m.castShadow=true;g.add(m);
    }
  }
  return g;
}
const forest=new THREE.Group();scene.add(forest);
for(let x=-15;x<=15;x++)for(let z=-15;z<=15;z++)if(Math.max(Math.abs(x),Math.abs(z))>10&&rand(x,z)>.57)tree(forest,x,z,.8+rand(z,x)*.4,['pine','larch','birch','redwood'][Math.min(3,Math.floor(rand(x+33,z-19)*4))]);
let state={blocks:{},water:{},peak:0};
try{const current=localStorage.getItem('mosswood-v2');state=current?normalize(JSON.parse(current)):normalize(JSON.parse(localStorage.getItem('mosswood-v1')),true);}catch{}
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
function save(){try{localStorage.setItem('mosswood-v2',JSON.stringify({blocks,water,peak}));}catch{notify('Autosave unavailable. Keep this tab open to preserve your town.');}}
function updateUI(){const n=cottageCount(blocks);peak=Math.max(peak,n);const next=milestones.find(m=>peak<m.n);$('#population').textContent=`${(peak>=3?n*2:0)+Object.values(blocks).filter(b=>b.type==='camp').length*2} villagers`;$('#next-title').textContent=next?.name||'Room to keep growing';$('#progress-number').textContent=next?`${n} / ${next.n}`:`${n} cottages`;$('#progress').style.width=`${next?Math.min(100,n/next.n*100):100}%`;$('#next-description').textContent=next?`Grow to ${next.n} cottage plots to make your next discovery.`:'All discoveries unlocked. Make this clearing your own.';$('#discovery-count').textContent=`${milestones.filter(m=>peak>=m.n).length} / 4`;$('#journal').innerHTML=milestones.map(m=>`<div>${peak>=m.n?'✦':'○'} ${m.n} cottages · ${m.name}</div>`).join('');for(const [id,values]of Object.entries({wood:{birch:6,cedar:12},roof:{clay:9,slate:12}}))for(const option of $(`#${id}`).options)if(values[option.value])option.disabled=peak<values[option.value];$('#undo').disabled=!history.length;}
const ghost=new THREE.Mesh(new THREE.BoxGeometry(1.01,.96,1.01),new THREE.MeshBasicMaterial({color:'#fff5bf',transparent:true,opacity:.28,depthWrite:false}));ghost.visible=false;scene.add(ghost);
const invisible=new THREE.MeshBasicMaterial({visible:false});
const timber={oak:'#c6a171',birch:'#ded4b3',cedar:'#b77d61'};
const roofs={moss:'#718a58',clay:'#b87755',slate:'#718b94'};
let roofForms=new Map(),architecture=new Map(),lookouts=new Set();
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
  }else if(form.kind==='joined'){
    const step=.25;
    const point=(a,b)=>[a,top+joinedRoofHeight(form,a,b)*rise,b];
    for(let i=0;i<4;i++)for(let j=0;j<4;j++){
      const a=x-.5+i*step,b=z-.5+j*step;
      triangle(point(a,b),point(a+step,b),point(a+step,b+step));
      triangle(point(a,b),point(a+step,b+step),point(a,b+step));
    }
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
  if(estate&&!lookouts.has(key(x,y,z))&&form.anchor===key(x,y,z)){
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
const lookoutGlass=new THREE.MeshStandardMaterial({color:'#c5e5df',transparent:true,opacity:.14,roughness:.18,metalness:.12,depthWrite:false,side:THREE.DoubleSide});
function lookoutRoom(parent,x,y,z,b){
  const g=new THREE.Group();g.name='lookout-room';g.position.set(x,y,z);parent.add(g);
  box(g,1,.09,1,0,.045,0,'#c3a078');
  for(let i=-2;i<=2;i++)box(g,.012,.008,.98,i*.19,.094,0,'#957750');
  box(g,1.08,.09,1.08,0,.955,0,timber[b.wood]);
  for(const [dx,,dz]of directions){
    if(lookouts.has(key(x+dx,y,z+dz)))continue;
    const face=new THREE.Group();face.position.set(dx*.49,0,dz*.49);face.rotation.y=dx?Math.PI/2:0;g.add(face);
    box(face,1,.12,.055,0,.15,0,timber[b.wood]);
    for(const xx of [-.47,.47])box(face,.045,.76,.065,xx,.55,0,'#765b40');
    const pane=new THREE.Mesh(new THREE.PlaneGeometry(.88,.69),lookoutGlass);pane.position.y=.555;face.add(pane);
  }
  function rod(a,b,r,color){
    const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),delta=end.clone().sub(start);
    const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,delta.length(),8),material(color));mesh.position.copy(start).add(end).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());mesh.castShadow=true;g.add(mesh);return mesh;
  }
  // Brass telescope on a timber tripod, aimed out of a panoramic window.
  for(const foot of [[-.34,.1,.33],[.02,.1,.35],[-.15,.1,-.01]])rod(foot,[-.16,.49,.19],.014,'#826141');
  rod([-.16,.48,.05],[-.16,.62,.4],.052,'#c49b59');
  rod([-.16,.61,.37],[-.16,.63,.43],.061,'#465859');
  rod([-.16,.47,.02],[-.16,.48,.06],.024,'#4f5148');
  // Cast-iron stove, glowing door, hearth, and a flue through the roof.
  box(g,.3,.025,.3,.27,.11,-.25,'#898575');
  box(g,.2,.27,.2,.27,.265,-.25,'#414644');
  box(g,.125,.12,.015,.27,.27,-.142,'#d8964e');
  box(g,.14,.02,.02,.27,.2,-.13,'#292f2d');
  rod([.27,.39,-.25],[.27,1.65,-.25],.032,'#4d5553');
  box(g,.13,.035,.13,.27,1.66,-.25,'#434b48');
  for(const xx of [.2,.34])box(g,.035,.07,.035,xx,.14,-.25,'#414644');
  // A low map table leaves the sightline to the telescope clear.
  box(g,.3,.04,.2,-.25,.31,-.28,'#9e774d');
  for(const xx of [-.36,-.14])box(g,.025,.19,.13,xx,.2,-.28,'#795d40');
  box(g,.22,.006,.14,-.25,.335,-.28,'#e4d7b2');
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

function joinedCamp(parent,x,z,group){
  const coords=group.tiles.map(k=>k.split(',').map(Number));
  const xs=coords.map(p=>p[0]),zs=coords.map(p=>p[2]);
  const alongX=Math.max(...xs)-Math.min(...xs)>=Math.max(...zs)-Math.min(...zs);
  const cross=alongX?zs:xs,lo=Math.min(...cross)-.5,hi=Math.max(...cross)+.5,ridge=(lo+hi)/2;
  const stage=Math.max(group.stage,...group.tiles.map(k=>blocks[k].stage||1));
  const floor=stage===3?.18:.055,eave=floor+.35,peak=eave+.6;
  box(parent,1,floor,1,x,floor/2,z,stage===3?'#af9064':'#8d8063');
  const c=alongX?z:x,a=alongX?x:z,cuts=[c-.5,...(ridge>c-.5&&ridge<c+.5?[ridge]:[]),c+.5];
  const point=(along,t)=>alongX?[along,eave+(1-Math.abs(t-ridge)/((hi-lo)/2))*(peak-eave),t]:[t,eave+(1-Math.abs(t-ridge)/((hi-lo)/2))*(peak-eave),along];
  const vertices=[];
  for(let i=0;i<cuts.length-1;i++){
    const p=point(a-.5,cuts[i]),q=point(a+.5,cuts[i]),r=point(a+.5,cuts[i+1]),t=point(a-.5,cuts[i+1]);vertices.push(...p,...q,...r,...p,...r,...t);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.computeVertexNormals();
  const cloth=material(stage===3?'#e1d3b2':'#bf9960');cloth.side=THREE.DoubleSide;
  const canopy=new THREE.Mesh(geometry,cloth);canopy.castShadow=true;canopy.receiveShadow=true;parent.add(canopy);
  // Only perimeter edges get poles and rolled canvas. Interior rooms stay open.
  for(const [dx,,dz]of directions){
    if(group.tiles.includes(key(x+dx,0,z+dz)))continue;
    const cx=x+dx*.48,cz=z+dz*.48;
    const height=point(alongX?cx:cz,alongX?cz:cx)[1];
    box(parent,.035,height,.035,cx,height/2,cz,'#806442');
  }
  box(parent,.24,.07,.53,x-.2,floor+.04,z,'#eee3c7');
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

let gravelMaterial;
function crushedStone(){
  if(gravelMaterial)return gravelMaterial;
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#b9b5a4';ctx.fillRect(0,0,128,128);
  for(let i=0;i<950;i++){
    const x=(i*73.13)%128,y=(i*i*19.73)%128;
    ctx.fillStyle=['#a29e91','#ccc7b7','#ded8c6','#8f9087'][i%4];
    ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+2+i%3,y+1);ctx.lineTo(x+1,y+3);ctx.closePath();ctx.fill();
  }
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  gravelMaterial=new THREE.MeshStandardMaterial({map:texture,bumpMap:texture,bumpScale:.012,roughness:1});return gravelMaterial;
}
function roundedPathGeometry(x,z){
  const shape=new THREE.Shape();pathOutline(blocks,x,z).forEach(([a,b],i)=>i?shape.lineTo(a,-b):shape.moveTo(a,-b));shape.closePath();
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:.06,bevelEnabled:false});geometry.rotateX(-Math.PI/2);return geometry;
}
const stoneReliefMaterial=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1});
function pathRelief(parent,x,z,cobble){
  const vertices=[],normals=[],colors=[];
  const count=cobble?36:45;
  for(let i=0;i<count;i++){
    const px=cobble?(i%6-2.5)/6:(rand(i+x*13,z+7)-.5)*.8;
    const pz=cobble?(Math.floor(i/6)-2.5)/6:(rand(z+i*17,x+3)-.5)*.8;
    const h=cobble?.016+rand(x+i,z)*.008:.008;
    const edgeCorner=cobble&&Math.abs(px)>.4&&Math.abs(pz)>.4&&!['path','house'].includes(blocks[key(x+Math.sign(px),0,z)]?.type)&&!['path','house'].includes(blocks[key(x,0,z+Math.sign(pz))]?.type);
    const geo=(cobble?new THREE.BoxGeometry(edgeCorner?.09:.15,h,edgeCorner?.09:.15):new THREE.IcosahedronGeometry(.012+rand(i,z)*.008,0)).toNonIndexed();
    geo.translate(x+px,.1+h/2,z+pz);
    const color=new THREE.Color(cobble?['#c8b28c','#d5c09c','#bfa780','#dac8aa'][i%4]:['#a8a596','#c5c0ad','#989b92'][i%3]);
    vertices.push(...geo.attributes.position.array);normals.push(...geo.attributes.normal.array);
    for(let n=0;n<geo.attributes.position.count;n++)colors.push(color.r,color.g,color.b);geo.dispose();
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  const mesh=new THREE.Mesh(geo,stoneReliefMaterial);mesh.receiveShadow=true;mesh.castShadow=true;parent.add(mesh);
}
function pathTile(parent,x,z){
  const wet=!!water[waterKey(x,z)],top=.1,cobble=blocks[key(x,0,z)]?.surface==='cobble';
  const color=wet?'#b49a71':'#a89577',surface=wet?material(color):cobble?material(color):crushedStone();
  const disk=new THREE.Mesh(roundedPathGeometry(x,z),surface);
  disk.position.set(x,.04,z);disk.receiveShadow=true;parent.add(disk);
  disk.userData={position:[x,0,z],normal:[0,1,0]};targets.push(disk);
  for(const [dx,dz]of pathLinks(blocks,x,z)){
    if(!dx||!dz)continue; // Cardinal tiles meet directly; no overlapping slabs.
    const link=new THREE.Mesh(new THREE.BoxGeometry(.72,.06,Math.SQRT2/2+.004),surface);
    link.position.set(x+dx*.25,.07,z+dz*.25);link.rotation.y=Math.atan2(dx,dz);link.receiveShadow=true;parent.add(link);
    link.userData={position:[x,0,z],normal:[0,1,0]};targets.push(link);
  }
  if(!wet)pathRelief(parent,x,z,cobble);
  if(wet){
    // Rounded wooden landings grow into continuous boardwalks and dock heads.
    for(let i=-2;i<=2;i++){
      const offset=i*.16,width=2*Math.sqrt(.46*.46-offset*offset);
      box(parent,width,.012,.018,x,top+.006,z+offset,'#806c4f');
    }
    for(const [dx,,dz]of directions){
      if(dockOpen(blocks,x,z,dx,dz))continue;
      railing(parent,x,-.015,z,dx,dz,'#8a7454');
    }
    for(const dx of [-.3,.3])for(const dz of [-.3,.3]){
      if(pathLinks(blocks,x,z).some(([a,b])=>a===Math.sign(dx)&&b===Math.sign(dz)))continue;
      box(parent,.065,.34,.065,x+dx,.17,z+dz,'#887254');
      box(parent,.085,.035,.085,x+dx,.35,z+dz,'#d0b68b');
    }

  }
}

function rebuild(){
  renderer.shadowMap.needsUpdate=true;
  clear(buildings);targets=[];
  waterAnalysis=waterView.rebuild(water,blocks);
  roofForms=roofPlan(blocks);
  architecture=architecturePlan(blocks);
  lookouts=lookoutPlan(blocks);
  const camps=campsitePlan(blocks);
  const entrances=entrancePlan(blocks,water);
  const buildingFronts=new Map();
  for(const [id,entry]of entrances)buildingFronts.set(architecture.get(id),entry);
  for(const [k,b]of Object.entries(blocks)){
    const [x,y,z]=k.split(',').map(Number);
    if(b.type==='tree'){tree(buildings,x,z,1,b.species||'pine');}
    if(b.type==='camp'){
      const group=camps.get(k);
      if(group.size===1)camp(buildings,x,z,b.stage||1);
      else{
        joinedCamp(buildings,x,z,group);
        if(group.hub===k){
          // Put the fire outside the fabric, only on an unoccupied dry tile.
          let spot;
          for(const id of group.tiles){
            const [cx,,cz]=id.split(',').map(Number);
            for(const [dx,dz]of [[0,1],[1,0],[-1,0],[0,-1]]){
              const nx=cx+dx,nz=cz+dz;
              if(Math.abs(nx)<=LIMIT&&Math.abs(nz)<=LIMIT&&!blocks[key(nx,0,nz)]&&!water[waterKey(nx,nz)]){spot=[nx,nz];break;}
            }
            if(spot)break;
          }
          if(spot)campGathering(buildings,...spot,group.size);
        }
      }
    }
    if(b.type==='path')pathTile(buildings,x,z);
    if(b.type==='house'){
      const wetBase=y===0&&!!water[waterKey(x,z)],base=wetBase?.26:0;
      const tier=architecture.get(k).tier,estate=tier==='estate',lodge=tier==='lodge';
      const lookout=lookouts.has(k);
      if(lookout)lookoutRoom(buildings,x,y,z,b);
      const wall=estate?(y===0?'#b6ad94':'#e0d4b7'):timber[b.wood];if(!lookout)box(buildings,1,1-base,1,x,y+base+(1-base)/2,z,wall);
      if(wetBase){
        for(const dx of [-.37,.37])for(const dz of [-.37,.37])box(buildings,.1,.28,.1,x+dx,.14,z+dz,'#817057');
        box(buildings,1.08,.08,1.08,x,.26,z,'#ac916a');
      }
      for(const [dx,,dz]of directions){
        if(lookout||blocks[key(x+dx,y,z+dz)]?.type==='house')continue;
        const contiguous=side=>blocks[key(x+dz*side,y,z-dx*side)]?.type==='house'&&blocks[key(x+dx+dz*side,y,z+dz-dx*side)]?.type!=='house';
        const entrance=buildingFronts.get(architecture.get(k));
        const isFront=entrance?.dx===dx&&entrance?.dz===dz;
        const entryPosition=entrance?.k.split(',').map(Number);
        const entryBay=isFront&&entryPosition&&(dx?entryPosition[2]===z:entryPosition[0]===x);
        // Count the continuous exposed wall to space side windows across a facade.
        const exposed=offset=>blocks[key(x+dz*offset,y,z-dx*offset)]?.type==='house'&&blocks[key(x+dx+dz*offset,y,z+dz-dx*offset)]?.type!=='house';
        let left=0,right=0;while(exposed(-left-1))left++;while(exposed(right+1))right++;
        const quietBay=estate&&!isFront&&left+right>=2&&left%2===1;
        const face=new THREE.Group();face.position.set(x+dx*.505,y+base,z+dz*.505);face.scale.y=1-base;face.rotation.y=dx?dx*Math.PI/2:dz===-1?Math.PI:0;buildings.add(face);
        if(lodge){
          for(let h=.1;h<1;h+=.16){
            const log=new THREE.Mesh(new THREE.CylinderGeometry(.085,.085,1,7),material(timber[b.wood]));
            log.rotation.z=Math.PI/2;log.position.set(0,h,.008);log.castShadow=true;face.add(log);
          }
        }else if(estate){
          // Light cornices belong at roof edges, rather than framing every room.
          if(!blocks[key(x,y+1,z)])box(face,1,.045,.065,0,.96,.018,'#eaddc2');
          if(y===0)box(face,1,.07,.055,0,.07,.015,'#a79a7e');
          else box(face,1,.025,.025,0,.025,.008,'#c8b99b');
          for(const side of [-1,1]){
            if(contiguous(side))continue;
            box(face,.04,.87,.04,side*.475,.51,.012,timber[b.wood]);
            if(y===0)for(let h=.23;h<.9;h+=.3)box(face,.095,.07,.05,side*.46,h,.02,'#d0c5aa');
          }
        }else for(let h=.17;h<1;h+=.19)box(face,1,.017,.016,0,h,0,'#987951');
        const terraceDoor=y>0&&(blocks[key(x+dx,y,z+dz)]?.type==='balcony'||roofForms.get(key(x+dx,y-1,z+dz))?.kind==='terrace');
        if((y===0&&entrances.get(k)?.dx===dx&&entrances.get(k)?.dz===dz)||terraceDoor){
          box(face,estate?.34:.24,.61,.045,0,.305,.09,'#6c5942');
          box(face,.035,.035,.04,.08,.29,.12,'#e1c98c');
          if(estate){
            for(const side of [-1,1])box(face,.045,.66,.075,side*.22,.33,.07,'#eaddc2');
            box(face,.52,.055,.19,0,.68,.08,'#b5a286');
            if(y===0){
              const canopy=box(face,.6,.045,.26,0,.75,.11,roofs[b.roof]);canopy.rotation.x=.12;
              for(const side of [-1,1])box(face,.045,.1,.06,side*.24,.68,.12,timber[b.wood]);
            }
            box(face,.22,.12,.04,0,.54,.12,'#f2d292');
          }
        }else{
          const positions=quietBay?[]:estate&&entryBay&&y>0?[-.15,.15]:[0];
          for(const wx of positions){
            const w=estate?(positions.length===2?.17:isFront?.27:.21):.3,h=estate?(isFront?.34:.27):.36,depth=lodge?.105:.025;
            const trim=estate?.035:.07;
            box(face,w+trim,h+trim,estate?.035:.055,wx,.56,depth,'#735e45');
            box(face,w,h,.03,wx,.56,depth+.04,'#f2d292');
            box(face,estate?.014:.025,h,.025,wx,.56,depth+.06,'#957b50');
            if(!estate||isFront)box(face,w,estate?.014:.025,.025,wx,.56,depth+.06,'#957b50');
            if(estate)box(face,w+.06,.025,.075,wx,.56-h/2-.025,.045,'#d9caae');
          }
        }
        // Brackets under cantilevered rooms, leaving walkable space below.
        if(y>0&&!blocks[key(x,y-1,z)]){const brace=box(face,.07,.48,.07,dx?-.29:.29,-.13,-.12,'#8a7050');brace.rotation.x=-.65;}
      }
      const front=entrances.get(k);
      if(front&&b.role&&b.role!=='home')roleDetails(buildings,x,z,b.role,base,front.dx,front.dz);
      // Shared entrances follow adjacent paths, with stairs only on clear ground.
      if(y===0&&front){
        const nx=x+front.dx,nz=z+front.dz;
        if(!blocks[key(nx,0,nz)]&&!water[waterKey(nx,nz)]&&Math.abs(nx)<=LIMIT&&Math.abs(nz)<=LIMIT){
          const steps=wetBase?3:1;
          for(let i=0;i<steps;i++){
            const h=(steps-i)*(wetBase?.085:.065),distance=.56+i*.11;
            box(buildings,front.dx?.12:.4,h,front.dz?.12:.4,x+front.dx*distance,h/2,z+front.dz*distance,'#afa68a');
          }
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
    const proxy=new THREE.Mesh(new THREE.BoxGeometry(1,['house','camp'].includes(b.type)?1:b.type==='tree'?(treeHeights[b.species]||2.5):b.type==='path'&&water[waterKey(x,z)]?.45:.15,1),invisible);
    proxy.position.set(x,y+(['house','camp'].includes(b.type)?.5:b.type==='tree'?(treeHeights[b.species]||2.5)/2:b.type==='path'&&water[waterKey(x,z)]?.225:.075),z);proxy.userData={position:[x,y,z]};buildings.add(proxy);targets.push(proxy);
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
  if(tool==='path'&&!hit.ground&&blocks[key(...hit.position)]?.type==='path'){const next=structuredClone(blocks);next[key(...hit.position)].surface=$('#path-surface').value;commit(next);return;}
  if(paint&&!hit.ground){const k=key(...hit.position);if(['house','balcony'].includes(blocks[k]?.type)){const next=structuredClone(blocks);next[k]={...next[k],wood:$('#wood').value,roof:$('#roof').value};commit(next);}return;}
  const p=destination(hit);
  if(!p||!canPlace(blocks,...p,tool,water)){notify(tool==='tree'?'Trees need open, dry ground.':'Choose open ground, a roof, or an exposed wall. Build up to 8 floors.');return;}
  const next=structuredClone(blocks);next[key(...p)]={type:tool,wood:$('#wood').value,roof:$('#roof').value};if(tool==='path')next[key(...p)].surface=$('#path-surface').value;if(tool==='tree')next[key(...p)].species=$('#tree-species').value;if(tool==='camp')next[key(...p)].stage=1;if(tool==='house'&&!hit.ground&&blocks[key(...hit.position)]?.role)next[key(...p)].role=blocks[key(...hit.position)].role;commit(next);
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
const touchContacts=new Map();
function resetPointerInteraction(){
  touchContacts.clear();
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
  if(e.pointerType==='touch'){
    touchContacts.set(e.pointerId,{x:e.clientX,y:e.clientY,moved:touchContacts.size>0,time:performance.now()});
    if(touchContacts.size>1)for(const contact of touchContacts.values())contact.moved=true;
    canvas.setPointerCapture(e.pointerId);ghost.visible=false;return;
  }
  if(![0,1,2].includes(e.button))return;
  if(e.button===1){e.preventDefault();canvas.style.cursor='grabbing';}
  pointerDown={pointerId:e.pointerId,x:e.clientX,y:e.clientY,button:e.button,moved:false,alt:e.altKey};
});
canvas.addEventListener('pointermove',e=>{
  if(e.pointerType==='touch'){
    const contact=touchContacts.get(e.pointerId);
    if(contact&&Math.hypot(e.clientX-contact.x,e.clientY-contact.y)>8)contact.moved=true;
    ghost.visible=false;return;
  }
  if(pointerDown&&Math.hypot(e.clientX-pointerDown.x,e.clientY-pointerDown.y)>5)pointerDown.moved=true;
  // Camera drags do not need an expensive building raycast on every event.
  if(pointerDown&&(pointerDown.button===1||pointerDown.moved)){ghost.visible=false;return;}
  hoverHit=pick(e);preview(hoverHit);
});
canvas.addEventListener('pointerup',e=>{
  if(e.pointerType==='touch'){
    const contact=touchContacts.get(e.pointerId);
    touchContacts.delete(e.pointerId);
    if(contact&&!contact.moved&&Math.hypot(e.clientX-contact.x,e.clientY-contact.y)<=8&&performance.now()-contact.time<500)edit(pick(e));
    ghost.visible=false;return;
  }
  if(pointerDown?.pointerId!==e.pointerId)return;
  if(!pointerDown.moved&&pointerDown.button!==1)edit(pick(e),pointerDown.button===2,pointerDown.alt);
  pointerDown=null;ghost.visible=false;canvas.style.cursor='';
});
canvas.addEventListener('pointercancel',e=>{touchContacts.delete(e.pointerId);for(const contact of touchContacts.values())contact.moved=true;pointerDown=null;ghost.visible=false;canvas.style.cursor='';});
canvas.addEventListener('lostpointercapture',e=>{if(e.pointerType==='touch'){if(touchContacts.has(e.pointerId))resetPointerInteraction();return;}if(pointerDown?.pointerId===e.pointerId)resetPointerInteraction();});
addEventListener('blur',resetPointerInteraction);
document.addEventListener('visibilitychange',()=>{if(document.hidden)resetPointerInteraction();});
// Suppress native middle-button autoscroll on browsers that still dispatch it.
canvas.addEventListener('mousedown',e=>{if(e.button===1)e.preventDefault();});
canvas.addEventListener('auxclick',e=>{if(e.button===1)e.preventDefault();});
canvas.addEventListener('pointerleave',()=>ghost.visible=false);
canvas.addEventListener('contextmenu',e=>e.preventDefault());
function selectTool(value){tool=value;$('#water-options').hidden=value!=='water';$('#building-materials').hidden=['water','role','camp','tree','path'].includes(value);$('#role-options').hidden=value!=='role';$('#tree-options').hidden=value!=='tree';$('#path-options').hidden=value!=='path';document.querySelectorAll('[data-tool]').forEach(b=>{b.classList.toggle('active',b.dataset.tool===tool);b.setAttribute('aria-pressed',String(b.dataset.tool===tool));});ghost.visible=false;}
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
