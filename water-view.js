import * as THREE from 'three';
import {WATER_TYPES,waterKey,waterDirections,analyzeWater} from './water.js';

// All geometry is built locally. Only the ripple meshes animate between edits.
export function createWaterView(scene,material,box){
  const group=new THREE.Group();group.name='water';scene.add(group);
  const surfaces=new Map(Object.entries(WATER_TYPES).map(([type,config])=>[type,new THREE.MeshStandardMaterial({color:config.color,roughness:.3,metalness:.12})]));
  const foam=new THREE.MeshBasicMaterial({color:'#d9f0df',transparent:true,opacity:.48,depthWrite:false});
  let ripples=[];
  const hash=(x,z)=>{const n=Math.sin(x*97.13+z*171.7)*43758.5;return n-Math.floor(n);};
  function flat(points,height,mat){
    const shape=new THREE.Shape();points.forEach(([x,z],i)=>i?shape.lineTo(x,-z):shape.moveTo(x,-z));shape.closePath();
    const mesh=new THREE.Mesh(new THREE.ShapeGeometry(shape),mat);mesh.rotation.x=-Math.PI/2;mesh.position.y=height;mesh.receiveShadow=true;group.add(mesh);return mesh;
  }
  function disk(x,z,r,height,mat){const m=new THREE.Mesh(new THREE.CircleGeometry(r,20),mat);m.rotation.x=-Math.PI/2;m.position.set(x,height,z);m.receiveShadow=true;group.add(m);return m;}
  function rock(x,z,size){const m=new THREE.Mesh(new THREE.DodecahedronGeometry(size,0),material('#9b9e8d'));m.scale.set(1,.65,.8);m.rotation.set(.1,hash(x,z)*6,.2);m.position.set(x,size*.29+.02,z);m.castShadow=true;m.receiveShadow=true;group.add(m);}
  function rebuild(water,blocks){
    group.traverse(o=>{if(o.isMesh)o.geometry.dispose();});group.clear();ripples=[];
    const analysis=analyzeWater(water);
    for(const [k,type]of Object.entries(water)){
      const [x,z]=k.split(',').map(Number),config=WATER_TYPES[type],r=config.width/2,body=analysis.cells.get(k);
      const mat=surfaces.get(type),bank=material('#b6b69a');
      const neighbors=waterDirections.filter(([dx,dz])=>water[waterKey(x+dx,z+dz)]);
      if(type==='lake'){
        flat([[x-.5,z-.5],[x+.5,z-.5],[x+.5,z+.5],[x-.5,z+.5]],.035,mat);
      }else{
        disk(x,z,r+.065,.012,bank);disk(x,z,r,.035,mat);
      }
      // Fill the center shared by four wet tiles, avoiding pinhole islands
      // when the player widens a channel into a continuous body of water.
      if(water[waterKey(x+1,z)]&&water[waterKey(x,z+1)]&&water[waterKey(x+1,z+1)]){
        flat([[x,z],[x+1,z],[x+1,z+1],[x,z+1]],.034,mat);
      }
      // Connect unlike widths using a shared width at the tile boundary.
      for(const [dx,dz]of neighbors){
        const edge=(config.width+WATER_TYPES[water[waterKey(x+dx,z+dz)]].width)/4;
        const polygon=(extra)=>[[x-dz*(r+extra),z+dx*(r+extra)],[x+dx*.5-dz*(edge+extra),z+dz*.5+dx*(edge+extra)],[x+dx*.5+dz*(edge+extra),z+dz*.5-dx*(edge+extra)],[x+dz*(r+extra),z-dx*(r+extra)]];
        if(type!=='lake')flat(polygon(.06),.013,bank);
        flat(polygon(0),.036,mat);
      }
      const shores=waterDirections.filter(([dx,dz])=>!water[waterKey(x+dx,z+dz)]);
      if(type==='lake')for(const [dx,dz]of shores){box(group,dx?.065:1,.045,dz?.065:1,x+dx*.49,.035,z+dz*.49,'#b5b795');}
      const occupied=blocks[`${x},0,${z}`];
      if(!occupied){
        const ripple=box(group,Math.min(config.width*.55,.45),.006,.018,x,.048,z,'#d9f0df');ripple.material=foam;ripple.castShadow=false;ripple.receiveShadow=false;
        ripples.push({mesh:ripple,x,z,phase:hash(x,z)*Math.PI*2,radius:r*.26});
        if(body.tier>=1&&shores.length){
          const [dx,dz]=shores[Math.floor(hash(x,z)*shores.length)];
          const distance=Math.min(.45,r+.035);
          rock(x+dx*distance,z+dz*distance,.065);
          rock(x+dx*distance-dz*.12,z+dz*distance+dx*.12,.045);
        }
        // Stable coordinates give repeatable details after save/reload and undo.
        if(body.tier>=2&&shores.length&&body.tiles.indexOf(k)%3===0){
          const [dx,dz]=shores[0];rock(x+dx*Math.min(.42,r+.08),z+dz*Math.min(.42,r+.08),.17);
        }
        if(body.tier>=3&&shores.length&&hash(z,x)>.35){
          const [dx,dz]=shores.at(-1),distance=Math.min(.46,r+.07);
          for(let i=0;i<3;i++){const h=.19+i*.035;box(group,.018,h,.018,x+dx*distance+(i-1)*.045,h/2+.04,z+dz*distance,'#718759');}
        }
        if(body.tier>=3&&type==='lake'&&hash(x,z)>.65){disk(x+.18,z-.14,.085,.054,material('#8da66b'));disk(x+.16,z-.13,.022,.06,material('#ead2a0'));}
      }
    }
    return analysis;
  }
  function animate(t,reducedMotion=false){for(const r of ripples){r.mesh.position.x=r.x+(reducedMotion?0:Math.sin(t*.0006+r.phase)*r.radius);r.mesh.scale.x=reducedMotion?1:.8+Math.sin(t*.0009+r.phase)*.2;}}
  return {group,rebuild,animate};
}
