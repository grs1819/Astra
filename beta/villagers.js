import * as THREE from 'three';
import {buildNavigation,reachable,findRoute} from './navigation.js';
import {waterKey} from './water.js';

export function createVillagers(scene,material){
  const group=new THREE.Group();group.name='villagers';scene.add(group);
  let agents=[],walkGraph=new Map(),bikeGraph=new Map(),lastTime=null,attractions=[],fishingSpots=new Map();
  const geometries={sphere:new THREE.SphereGeometry(1,8,6),limb:new THREE.CylinderGeometry(1,1,1,6),body:new THREE.CylinderGeometry(.8,1,1,8),shoe:new THREE.BoxGeometry(1,1,1),wheel:new THREE.TorusGeometry(.145,.018,5,16),shadow:new THREE.CircleGeometry(1,16)};
  const shadowMaterial=new THREE.MeshBasicMaterial({color:'#334b3b',transparent:true,opacity:.16,depthWrite:false});
  function mesh(parent,geo,color,scale,pos){const m=new THREE.Mesh(geometries[geo],material(color));m.scale.set(...scale);m.position.set(...pos);parent.add(m);return m;}
  function rod(parent,a,b,r,color){const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),delta=end.clone().sub(start);const m=mesh(parent,'limb',color,[r,delta.length(),r],start.clone().add(end).multiplyScalar(.5).toArray());m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return m;}
  function person(index,bike){
    const root=new THREE.Group();group.add(root);
    const shadow=new THREE.Mesh(geometries.shadow,shadowMaterial);shadow.rotation.x=-Math.PI/2;shadow.scale.set(bike?.19:.13,bike?.38:.13,1);shadow.position.y=.008;root.add(shadow);
    const figure=new THREE.Group();root.add(figure);
    const skin=['#dcb38f','#b87955','#895840','#edc4a2'][index%4],coat=['#af775f','#7e99a5','#c5a45e','#8f9a73','#b492a0'][index%5];
    const torso=mesh(figure,'body',coat,[.09,.19,.075],[0,.34,0]);
    mesh(figure,'sphere',skin,[.077,.085,.073],[0,.51,.012]);
    mesh(figure,'sphere',['#69523d','#a17c4d','#48423a'][index%3],[.08,.045,.075],[0,.563,0]);
    for(const x of [-.027,.027])mesh(figure,'sphere','#333b34',[.009,.01,.007],[x,.52,.081]);
    if(index%3===0){mesh(figure,'limb','#b6a17b',[.104,.018,.104],[0,.577,0]);mesh(figure,'body','#b6a17b',[.077,.052,.077],[0,.604,0]);}
    const arms=[],legs=[];
    for(const side of [-1,1]){
      const arm=new THREE.Group();arm.position.set(side*.105,.405,0);figure.add(arm);mesh(arm,'limb',coat,[.026,.17,.026],[0,-.08,0]);mesh(arm,'sphere',skin,[.027,.03,.027],[0,-.18,0]);arms.push(arm);
      const leg=new THREE.Group();leg.position.set(side*.045,.25,0);figure.add(leg);mesh(leg,'limb','#566274',[.032,.19,.032],[0,-.095,0]);mesh(leg,'shoe','#665b49',[.062,.048,.105],[0,-.225,.025]);legs.push(leg);
    }
    let wheels=[],cranks=[],pedalLegs=[];
    if(bike){
      figure.position.set(0,.15,-.04);torso.rotation.x=.13;
      const frame=new THREE.Group();root.add(frame);
      for(const z of [-.27,.27]){
        const wheel=new THREE.Group();wheel.position.set(0,.165,z);wheel.rotation.y=Math.PI/2;frame.add(wheel);
        mesh(wheel,'wheel','#43514a',[1,1,1],[0,0,0]);
        for(let i=0;i<4;i++){const angle=i*Math.PI/4;rod(wheel,[-.13*Math.cos(angle),-.13*Math.sin(angle),0],[.13*Math.cos(angle),.13*Math.sin(angle),0],.004,'#bfc4b6');}wheels.push(wheel);
      }
      const rear=[0,.165,-.27],front=[0,.165,.27],hub=[0,.17,-.04],seat=[0,.40,-.11],handle=[0,.43,.20],frameColor=['#99775c','#7a9b91','#b88765'][index%3];
      for(const [a,b]of [[rear,hub],[rear,seat],[seat,hub],[hub,handle],[seat,handle],[handle,front]])rod(frame,a,b,.014,frameColor);
      mesh(frame,'shoe','#66594b',[.11,.035,.14],[0,.43,-.11]);rod(frame,[0,.43,.2],[0,.49,.24],.013,'#7b8175');rod(frame,[-.13,.49,.24],[.13,.49,.24],.013,'#7b8175');
      for(let i=0;i<2;i++){
        legs[i].visible=false;arms[i].visible=false;
        const armSide=i===0?-1:1;
        rod(root,[armSide*.105,.555,-.04],[armSide*.12,.47,.10],.025,coat);
        rod(root,[armSide*.12,.47,.10],[armSide*.12,.49,.24],.022,skin);
        mesh(root,'sphere',skin,[.026,.026,.026],[armSide*.12,.49,.24]);
        const side=i===0?-1:1,upper=rod(root,[0,0,0],[0,1,0],.03,'#566274'),lower=rod(root,[0,0,0],[0,1,0],.026,'#566274');pedalLegs.push({side,upper,lower});
        cranks.push(mesh(root,'shoe','#665b49',[.07,.035,.09],[0,0,0]));
      }
    }
    const fishingRod=new THREE.Mesh(geometries.limb,material('#795b39'));fishingRod.scale.set(.009,.65,.009);fishingRod.position.set(.08,.38,.24);fishingRod.rotation.x=.85;fishingRod.visible=false;figure.add(fishingRod);
    return {root,figure,arms,legs,wheels,cranks,pedalLegs,bike,rod:fishingRod};
  }
  function rebuild(blocks,water,unlocked){
    // Geometry and materials are shared; rebuilding removes instances only.
    group.clear();agents=[];lastTime=null;
    walkGraph=buildNavigation(blocks,water);bikeGraph=buildNavigation(blocks,water,true);
    attractions=[];fishingSpots=new Map();
    for(const [k,block]of Object.entries(blocks)){
      const [x,y,z]=k.split(',').map(Number);if(y!==0||!block.role||block.role==='home')continue;
      for(const [dx,dz]of [[0,1],[1,0],[-1,0],[0,-1]]){const id=waterKey(x+dx,z+dz);if(walkGraph.has(id))attractions.push(id);}
      if(['fishing','boathouse'].includes(block.role))for(const [id,node]of walkGraph){
        if(Math.abs(node.x-x)+Math.abs(node.z-z)>4)continue;
        const shore=[[0,1],[1,0],[-1,0],[0,-1]].find(([dx,dz])=>water[waterKey(node.x+dx,node.z+dz)]);
        if(shore){attractions.push(id);if(block.role==='fishing')fishingSpots.set(id,shore);}
      }
    }
    attractions=[...new Set(attractions)];
    if(!unlocked&&!Object.values(blocks).some(b=>b.type==='camp'))return;
    const homes=Object.keys(blocks).filter(k=>(blocks[k].type==='camp'||unlocked&&blocks[k].type==='house')&&Number(k.split(',')[1])===0);
    homes.slice(0,12).forEach((k,i)=>{
      const [x,,z]=k.split(',').map(Number);
      const starts=[[x,z+1],[x+1,z],[x-1,z],[x,z-1]].map(p=>waterKey(...p)).filter(id=>walkGraph.has(id));
      if(!starts.length)return;
      for(let resident=0;resident<2;resident++){
        const index=i*2+resident,base=starts[resident%starts.length];
        const cycleStart=reachable(walkGraph,base,5).find(id=>bikeGraph.has(id)&&reachable(bikeGraph,id,8).length>=3);
        const bike=resident===1&&!!cycleStart,id=bike?cycleStart:base,graph=bike?bikeGraph:walkGraph;
        const a={...person(index,bike),id,graph,index,route:[],progress:0,phase:index*1.7,pause:index*.12,choices:0};
        const node=graph.get(id);a.root.position.set(node.x,node.y,node.z);if(bike)pedalPose(a);agents.push(a);
      }
    });
  }
  function poseRod(m,a,b){const delta=new THREE.Vector3().subVectors(b,a);m.position.copy(a).add(b).multiplyScalar(.5);m.scale.y=delta.length();m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());}
  function pedalPose(a){
    for(let i=0;i<2;i++){
          const {side,upper,lower}=a.pedalLegs[i],phase=a.phase+i*Math.PI;
          const hip=new THREE.Vector3(side*.045,.40,-.04),foot=new THREE.Vector3(side*.07,.17+Math.cos(phase)*.085,-.04+Math.sin(phase)*.085),knee=new THREE.Vector3(side*.065,.31,.10);
          poseRod(upper,hip,knee);poseRod(lower,knee,foot);a.cranks[i].position.copy(foot);
        }
  }
  function animate(t,reducedMotion=false){
    const dt=lastTime===null?0:Math.min(.06,(t-lastTime)/1000);lastTime=t;
    if(reducedMotion)return;
    for(const a of agents){
      if(a.pause>0){a.pause-=dt;if(!a.bike){const shore=fishingSpots.get(a.id);a.rod.visible=!!shore;a.legs.forEach(l=>l.rotation.x=0);a.arms.forEach(l=>l.rotation.x=shore?-1:0);a.figure.position.y=0;if(shore)a.root.rotation.y=Math.atan2(shore[0],shore[1]);}continue;}
      a.rod.visible=false;
      if(!a.route.length){
        const choices=reachable(a.graph,a.id,6).filter(id=>id!==a.id);
        if(!choices.length)continue;
        const visits=attractions.filter(id=>id!==a.id&&a.graph.has(id)&&findRoute(a.graph,a.id,id).length);
        const options=visits.length&&a.choices%2===0?visits:choices;
        const destination=options[(a.index*7+a.choices++*11)%options.length];a.route=findRoute(a.graph,a.id,destination).slice(1);
      }
      if(!a.route.length)continue;
      const start=a.graph.get(a.id),end=a.graph.get(a.route[0]);
      const speed=a.bike?.7:.32+(a.index%3)*.035;a.progress=Math.min(1,a.progress+dt*speed/Math.hypot(end.x-start.x,end.z-start.z));
      const x=THREE.MathUtils.lerp(start.x,end.x,a.progress),z=THREE.MathUtils.lerp(start.z,end.z,a.progress);
      // Feet and wheels follow the actual tile height, including raised bridge decks.
      const tile=walkGraph.get(waterKey(Math.round(x),Math.round(z)));
      a.root.position.set(x,tile?.y??start.y,z);
      const heading=Math.atan2(end.x-start.x,end.z-start.z);
      a.root.rotation.y+=Math.atan2(Math.sin(heading-a.root.rotation.y),Math.cos(heading-a.root.rotation.y))*Math.min(1,dt*10);
      a.phase+=dt*speed*(a.bike?7:16);
      if(a.bike){
        a.wheels.forEach(w=>w.rotation.z-=dt*speed/.145);
        pedalPose(a);
      }else{
        a.legs.forEach((leg,i)=>leg.rotation.x=Math.sin(a.phase+i*Math.PI)*.38);
        a.arms.forEach((arm,i)=>arm.rotation.x=-Math.sin(a.phase+i*Math.PI)*.28);
        a.figure.position.y=Math.abs(Math.sin(a.phase))*.012;
      }
      if(a.progress>=1){a.id=a.route.shift();a.progress=0;if(!a.route.length)a.pause=attractions.includes(a.id)?4+(a.index%3):a.bike?.25:.7+(a.index%3)*.5;}
    }
  }
  return {group,rebuild,animate,get agents(){return agents;}};
}
