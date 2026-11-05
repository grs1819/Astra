import * as THREE from 'three';
import {OrbitControls} from './vendor/OrbitControls.js';
import {LIMIT, key, directions, normalize, cottageCount, canPlace, removeBlock, archAxis} from './town.js';

const $=s=>document.querySelector(s);
const canvas=$('#world');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.shadowMap.enabled=true;
renderer.shadowMap.autoUpdate=false;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.setClearColor('#d5dfc7');
const scene=new THREE.Scene();
scene.fog=new THREE.Fog('#d5dfc7',36,85);
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
scene.add(new THREE.HemisphereLight('#fff8df','#748465',2));
const sunlight=new THREE.DirectionalLight('#fff1d1',2);
sunlight.position.set(-12,25,12);sunlight.castShadow=true;
sunlight.shadow.mapSize.set(2048,2048);
Object.assign(sunlight.shadow.camera,{left:-23,right:23,top:23,bottom:-23,near:.1,far:65});
sunlight.shadow.normalBias=.035;scene.add(sunlight);
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
let state={blocks:{},peak:0};
try{const current=localStorage.getItem('mosswood-v2');state=current?normalize(JSON.parse(current)):normalize(JSON.parse(localStorage.getItem('mosswood-v1')),true);}catch{}
let blocks=state.blocks,peak=state.peak,history=[],tool='house',pointerDown=null,hoverHit=null;
const buildings=new THREE.Group(),people=new THREE.Group();scene.add(buildings,people);
let targets=[],villagers=[];
const milestones=[{n:3,name:'The first neighbors',text:'Villagers have found their way to Stillwater.'},{n:6,name:'A lighter touch',text:'Silver birch timber unlocked.'},{n:9,name:'Earth & ember',text:'Terracotta roofs unlocked.'},{n:12,name:'A town of your own',text:'Red cedar and river slate unlocked.'}];
function notify(message){$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(notify.timer);notify.timer=setTimeout(()=>$('#toast').classList.remove('show'),4200);}
function save(){try{localStorage.setItem('mosswood-v2',JSON.stringify({blocks,peak}));}catch{notify('Autosave unavailable. Keep this tab open to preserve your town.');}}
function updateUI(){const n=cottageCount(blocks);peak=Math.max(peak,n);const next=milestones.find(m=>peak<m.n);$('#population').textContent=`${peak>=3?n*2:0} villagers`;$('#next-title').textContent=next?.name||'Room to keep growing';$('#progress-number').textContent=next?`${n} / ${next.n}`:`${n} cottages`;$('#progress').style.width=`${next?Math.min(100,n/next.n*100):100}%`;$('#next-description').textContent=next?`Grow to ${next.n} cottage plots to make your next discovery.`:'All discoveries unlocked. Make this clearing your own.';$('#discovery-count').textContent=`${milestones.filter(m=>peak>=m.n).length} / 4`;$('#journal').innerHTML=milestones.map(m=>`<div>${peak>=m.n?'✦':'○'} ${m.n} cottages · ${m.name}</div>`).join('');for(const [id,values]of Object.entries({wood:{birch:6,cedar:12},roof:{clay:9,slate:12}}))for(const option of $(`#${id}`).options)if(values[option.value])option.disabled=peak<values[option.value];$('#undo').disabled=!history.length;}
const ghost=new THREE.Mesh(new THREE.BoxGeometry(1.01,.96,1.01),new THREE.MeshBasicMaterial({color:'#fff5bf',transparent:true,opacity:.28,depthWrite:false}));ghost.visible=false;scene.add(ghost);
const invisible=new THREE.MeshBasicMaterial({visible:false});
const timber={oak:'#c6a171',birch:'#ded4b3',cedar:'#b77d61'};
const roofs={moss:'#718a58',clay:'#b87755',slate:'#718b94'};
function roof(parent,x,y,z,color){
  // Touching roofs share their ridge; internal gables disappear.
  const left=blocks[key(x-1,y,z)]?.type==='house'&&!blocks[key(x-1,y+1,z)];
  const right=blocks[key(x+1,y,z)]?.type==='house'&&!blocks[key(x+1,y+1,z)];
  const shape=new THREE.Shape();shape.moveTo(-.56,0);shape.lineTo(0,.44);shape.lineTo(.56,0);shape.closePath();
  const geo=new THREE.ExtrudeGeometry(shape,{depth:1.04,bevelEnabled:false});geo.rotateY(Math.PI/2);geo.translate(-.52,0,0);
  const m=new THREE.Mesh(geo,material(color));m.position.set(x,y+1,z);m.castShadow=true;parent.add(m);m.userData={position:[x,y,z],normal:[0,1,0]};targets.push(m);
  if(!left)box(parent,.035,.08,.93,x-.53,y+1.015,z,'#7c684c');
  if(!right)box(parent,.035,.08,.93,x+.53,y+1.015,z,'#7c684c');
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
function rebuild(){
  renderer.shadowMap.needsUpdate=true;
  clear(buildings);clear(people);targets=[];villagers=[];
  for(const [k,b]of Object.entries(blocks)){
    const [x,y,z]=k.split(',').map(Number);
    if(b.type==='tree'){tree(buildings,x,z);}
    if(b.type==='path')box(buildings,.98,.065,.98,x,.025,z,'#cbbb97');
    if(b.type==='house'){
      const wall=timber[b.wood];box(buildings,1,1,1,x,y+.5,z,wall);
      for(const [dx,,dz]of directions){
        if(blocks[key(x+dx,y,z+dz)]?.type==='house')continue;
        const face=new THREE.Group();face.position.set(x+dx*.505,y,z+dz*.505);face.rotation.y=dx?dx*Math.PI/2:dz===-1?Math.PI:0;buildings.add(face);
        for(let h=.17;h<1;h+=.19)box(face,1,.017,.016,0,h,0,'#987951');
        if(y===0&&dz===1){box(face,.24,.57,.035,0,.285,0,'#6c5942');box(face,.035,.035,.04,.065,.29,.02,'#e1c98c');}
        else{box(face,.3,.36,.025,0,.57,.016,'#735e45');box(face,.23,.28,.03,0,.57,.035,'#f2d292');box(face,.025,.28,.035,0,.57,.055,'#957b50');box(face,.23,.025,.035,0,.57,.055,'#957b50');}
        // Brackets under cantilevered rooms, leaving walkable space below.
        if(y>0&&!blocks[key(x,y-1,z)]){const brace=box(face,.07,.48,.07,dx?-.29:.29,-.13,-.12,'#8a7050');brace.rotation.x=-.65;}
      }
      if(!blocks[key(x,y+1,z)])roof(buildings,x,y,z,roofs[b.roof]);
      const axis=archAxis(blocks,x,y,z);if(axis)arch(buildings,x,y,z,axis,'#b5ad89');
    }
    if(b.type==='balcony'){
      box(buildings,1,.12,1,x,y+.06,z,timber[b.wood]);
      for(let i=-2;i<=2;i++)box(buildings,.018,.015,.96,x+i*.19,y+.125,z,'#92784f');
      for(const [dx,,dz]of directions)if(!['house','balcony'].includes(blocks[key(x+dx,y,z+dz)]?.type))railing(buildings,x,y,z,dx,dz,'#866e4d');
    }
    const proxy=new THREE.Mesh(new THREE.BoxGeometry(1,b.type==='house'?1:b.type==='tree'?1.7:.15,1),invisible);
    proxy.position.set(x,y+(b.type==='house'?.5:b.type==='tree'?.85:.075),z);proxy.userData={position:[x,y,z]};buildings.add(proxy);targets.push(proxy);
  }
  if(peak>=3){const homes=Object.keys(blocks).filter(k=>blocks[k].type==='house'&&Number(k.split(',')[1])===0);homes.slice(0,24).forEach((k,i)=>{const[x,,z]=k.split(',').map(Number);const g=new THREE.Group();box(g,.11,.22,.12,0,.14,0,['#a8735e','#788da5','#ba9d54'][i%3]);const head=new THREE.Mesh(new THREE.SphereGeometry(.075,6,5),material('#e6c59e'));head.position.y=.31;g.add(head);people.add(g);villagers.push({g,x,z,i});});}
}
function commit(next){history.push(JSON.stringify(blocks));if(history.length>80)history.shift();const before=peak;blocks=next;updateUI();rebuild();save();for(const m of milestones)if(before<m.n&&peak>=m.n)notify(`✧ ${m.text}`);}
function undo(){if(!history.length)return;blocks=JSON.parse(history.pop());updateUI();rebuild();save();ghost.visible=false;}
function destination(hit){if(!hit)return null;let [x,y,z]=hit.position;if(hit.ground)return[x,0,z];if(tool==='erase')return[x,y,z];if(tool==='path'||tool==='tree')return null;if(blocks[key(x,y,z)]?.type==='balcony'&&tool==='house')return[x,y,z];const [dx,dy,dz]=hit.normal;return[x+dx,y+dy,z+dz];}
function edit(hit,remove=false,paint=false){if(!hit)return;if(remove||tool==='erase'){if(hit.ground)return;commit(removeBlock(blocks,key(...hit.position)));return;}if(paint&&!hit.ground){const k=key(...hit.position);if(['house','balcony'].includes(blocks[k]?.type)){const next=structuredClone(blocks);next[k]={...next[k],wood:$('#wood').value,roof:$('#roof').value};commit(next);}return;}const p=destination(hit);if(!p||!canPlace(blocks,...p,tool)){notify('Choose open ground, a roof, or an exposed wall. Build up to 8 floors.');return;}const next=structuredClone(blocks);next[key(...p)]={type:tool,wood:$('#wood').value,roof:$('#roof').value};commit(next);}
const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
function pick(e){const rect=canvas.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);const hits=raycaster.intersectObjects([...targets,ground],false);for(const hit of hits){if(hit.object===ground){const x=Math.round(hit.point.x),z=Math.round(hit.point.z);return Math.abs(x)<=LIMIT&&Math.abs(z)<=LIMIT?{position:[x,0,z],normal:[0,1,0],ground:true}:null;}return {position:hit.object.userData.position,normal:hit.object.userData.normal||hit.face.normal.toArray().map(Math.round),ground:false};}return null;}
function preview(hit){const p=destination(hit);ghost.visible=!!p&&(tool==='erase'?!hit.ground:canPlace(blocks,...p,tool));if(!ghost.visible)return;ghost.position.set(p[0],p[1]+.5,p[2]);ghost.material.color.set(tool==='erase'?'#d78469':'#fff5bf');ghost.scale.y=tool==='balcony'?.16:1;}
canvas.addEventListener('pointerdown',e=>{if(e.button===1)e.preventDefault();pointerDown={x:e.clientX,y:e.clientY,button:e.button,moved:false,alt:e.altKey};});
canvas.addEventListener('pointermove',e=>{if(pointerDown&&Math.hypot(e.clientX-pointerDown.x,e.clientY-pointerDown.y)>5)pointerDown.moved=true;hoverHit=pick(e);preview(hoverHit);if(pointerDown?.moved)ghost.visible=false;});
canvas.addEventListener('pointerup',e=>{if(pointerDown&&!pointerDown.moved&&pointerDown.button!==1)edit(pick(e),pointerDown.button===2,pointerDown.alt);pointerDown=null;ghost.visible=false;});
canvas.addEventListener('pointercancel',()=>pointerDown=null);canvas.addEventListener('pointerleave',()=>ghost.visible=false);canvas.addEventListener('contextmenu',e=>e.preventDefault());
function selectTool(value){tool=value;document.querySelectorAll('[data-tool]').forEach(b=>{b.classList.toggle('active',b.dataset.tool===tool);b.setAttribute('aria-pressed',String(b.dataset.tool===tool));});ghost.visible=false;}
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
addEventListener('keydown',e=>{if(['SELECT','INPUT'].includes(document.activeElement.tagName))return;if(['1','2','3','4','5'].includes(e.key))selectTool(['house','path','tree','erase','balcony'][Number(e.key)-1]);if((e.ctrlKey||e.metaKey)&&e.key==='z'){e.preventDefault();undo();}if(e.key.toLowerCase()==='q')orbit(Math.PI/8);if(e.key.toLowerCase()==='e')orbit(-Math.PI/8);});
function resize(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);}addEventListener('resize',resize);resize();
updateUI();rebuild();save();
renderer.setAnimationLoop(t=>{controls.update();for(const {g,x,z,i}of villagers){const phase=t*.00025+i*2.4;const px=x+Math.cos(phase)*.9,pz=z+1+Math.sin(phase)*.5;g.visible=!blocks[key(Math.round(px),0,Math.round(pz))]||blocks[key(Math.round(px),0,Math.round(pz))]?.type==='path';g.position.set(px,0,pz);g.rotation.y=-phase;}renderer.render(scene,camera);});
