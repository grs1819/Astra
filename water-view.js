import * as THREE from 'three';
import {WATER_TYPES,waterKey,waterDirections,analyzeWater} from './water.js';
import {LIMIT} from './town.js';

// The shoreline depth field and water geometry rebuild only after edits.
// Surface movement runs on the GPU using world coordinates, so waves continue
// across tile seams without adding geometry or rendering the scene a second time.
export function createWaterView(scene,material,box){
  const group=new THREE.Group();group.name='water';scene.add(group);
  const resolution=256,extent=LIMIT*2+1,half=extent/2;
  const mask=new Uint8Array(resolution*resolution);
  const depthPixels=new Uint8Array(resolution*resolution*4);
  const depthTexture=new THREE.DataTexture(depthPixels,resolution,resolution,THREE.RGBAFormat);
  depthTexture.minFilter=depthTexture.magFilter=THREE.LinearFilter;
  depthTexture.generateMipmaps=false;
  const clock={value:0};
  const surfaces=new Map();
  for(const type of Object.keys(WATER_TYPES)){
    const surface=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.27,metalness:0});
    const uniforms={
      uWaterTime:clock,uWaterDepth:{value:depthTexture},uWaterExtent:{value:extent},
      uWaterSpeed:{value:{stream:1.2,river:.85,lake:.38}[type]},
      uWaterShallow:{value:new THREE.Color('#9bc6b5')},
      uWaterDeep:{value:new THREE.Color({stream:'#67a9a4',river:'#448d94',lake:'#397e8e'}[type])},
    };
    surface.userData.waterUniforms=uniforms;
    surface.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,uniforms);
      shader.vertexShader='varying vec3 vWaterWorld;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
        vWaterWorld=(modelMatrix*vec4(position,1.0)).xyz;`);
      shader.fragmentShader=`
        varying vec3 vWaterWorld;
        uniform float uWaterTime;
        uniform float uWaterExtent;
        uniform float uWaterSpeed;
        uniform sampler2D uWaterDepth;
        uniform vec3 uWaterShallow;
        uniform vec3 uWaterDeep;
      `+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
        vec2 waterP=vWaterWorld.xz;
        float waterT=uWaterTime*uWaterSpeed;
        float waterDepth=texture2D(uWaterDepth,waterP/uWaterExtent+0.5).r;
        float waveA=dot(waterP,vec2(3.1,1.7))-waterT;
        float waveB=dot(waterP,vec2(-1.9,4.3))+waterT*0.72;
        float waveC=sin(waterP.x*6.4+sin(waterP.y*3.8)-waterT*1.3);
        vec3 waterColor=mix(uWaterShallow,uWaterDeep,smoothstep(0.02,0.8,waterDepth));
        float caustic=pow(0.5+0.5*sin(waveA+sin(waveB)*0.6),5.0);
        waterColor+=vec3(0.035,0.055,0.045)*caustic*(1.0-waterDepth);
        float ripple=smoothstep(0.94,1.0,waveC)*(0.5+0.5*sin(waveB));
        waterColor=mix(waterColor,vec3(0.68,0.85,0.79),ripple*0.12);
        float shoreline=(1.0-smoothstep(0.045,0.18,waterDepth));
        float shorePulse=0.6+0.4*sin(waveA*0.7+waveB*0.4);
        waterColor=mix(waterColor,vec3(0.72,0.84,0.69),shoreline*shorePulse*0.16);
        vec3 waterView=normalize(cameraPosition-vWaterWorld);
        float fresnel=pow(1.0-clamp(waterView.y,0.0,1.0),3.0);
        diffuseColor.rgb=mix(waterColor,vec3(0.58,0.75,0.79),fresnel*0.32);
      `);
      shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_begin>',`#include <normal_fragment_begin>
        vec3 waterNormal=normalize(vec3(
          -0.065*cos(waveA)+0.026*cos(waveB),
          1.0,
          -0.036*cos(waveA)-0.058*cos(waveB)
        ));
        normal=normalize(mat3(viewMatrix)*waterNormal);
      `);
    };
    surface.customProgramCacheKey=()=> 'stillwater-surface-v1';
    surfaces.set(type,surface);
  }
  const waterMaterials=new Set(surfaces.values());
  // Rasterize the actual wet polygons, not just the occupied grid cells. This
  // keeps pale shallows aligned with narrow streams, bends, and mixed widths.
  function cover(points){
    const xs=points.map(p=>p[0]),zs=points.map(p=>p[1]);
    const ix=v=>Math.max(0,Math.min(resolution-1,Math.floor((v+half)/extent*resolution)));
    for(let y=ix(Math.min(...zs));y<=ix(Math.max(...zs));y++)for(let x=ix(Math.min(...xs));x<=ix(Math.max(...xs));x++){
      const px=(x+.5)/resolution*extent-half,pz=(y+.5)/resolution*extent-half;
      let inside=false;
      for(let i=0,j=points.length-1;i<points.length;j=i++){
        const [ax,az]=points[i],[bx,bz]=points[j];
        if((az>pz)!==(bz>pz)&&px<(bx-ax)*(pz-az)/(bz-az)+ax)inside=!inside;
      }
      if(inside)mask[y*resolution+x]=1;
    }
  }
  function updateDepth(){
    const distances=new Float32Array(mask.length);
    for(let i=0;i<mask.length;i++)distances[i]=mask[i]?10000:0;
    for(let y=0;y<resolution;y++)for(let x=0;x<resolution;x++){
      const i=y*resolution+x;if(!mask[i])continue;
      if(!x||!y||x===resolution-1||y===resolution-1)distances[i]=1;
      if(x)distances[i]=Math.min(distances[i],distances[i-1]+1);
      if(y)distances[i]=Math.min(distances[i],distances[i-resolution]+1);
      if(x&&y)distances[i]=Math.min(distances[i],distances[i-resolution-1]+Math.SQRT2);
      if(x<resolution-1&&y)distances[i]=Math.min(distances[i],distances[i-resolution+1]+Math.SQRT2);
    }
    for(let y=resolution-1;y>=0;y--)for(let x=resolution-1;x>=0;x--){
      const i=y*resolution+x;if(!mask[i])continue;
      if(x<resolution-1)distances[i]=Math.min(distances[i],distances[i+1]+1);
      if(y<resolution-1)distances[i]=Math.min(distances[i],distances[i+resolution]+1);
      if(x<resolution-1&&y<resolution-1)distances[i]=Math.min(distances[i],distances[i+resolution+1]+Math.SQRT2);
      if(x&&y<resolution-1)distances[i]=Math.min(distances[i],distances[i+resolution-1]+Math.SQRT2);
    }
    for(let i=0;i<mask.length;i++){
      const depth=Math.round(Math.min(1,distances[i]*extent/resolution/1.1)*255);
      depthPixels.set([depth,depth,depth,255],i*4);
    }
    depthTexture.needsUpdate=true;
  }
  const hash=(x,z)=>{const n=Math.sin(x*97.13+z*171.7)*43758.5;return n-Math.floor(n);};
  function flat(points,height,mat){
    const shape=new THREE.Shape();points.forEach(([x,z],i)=>i?shape.lineTo(x,-z):shape.moveTo(x,-z));shape.closePath();
    const mesh=new THREE.Mesh(new THREE.ShapeGeometry(shape),mat);mesh.rotation.x=-Math.PI/2;mesh.position.y=height;mesh.receiveShadow=true;group.add(mesh);if(waterMaterials.has(mat))cover(points);return mesh;
  }
  function disk(x,z,r,height,mat){const m=new THREE.Mesh(new THREE.CircleGeometry(r,20),mat);m.rotation.x=-Math.PI/2;m.position.set(x,height,z);m.receiveShadow=true;group.add(m);if(waterMaterials.has(mat))cover(Array.from({length:20},(_,i)=>[x+Math.cos(i/20*Math.PI*2)*r,z+Math.sin(i/20*Math.PI*2)*r]));return m;}
  function rock(x,z,size){const m=new THREE.Mesh(new THREE.DodecahedronGeometry(size,0),material('#9b9e8d'));m.scale.set(1,.65,.8);m.rotation.set(.1,hash(x,z)*6,.2);m.position.set(x,size*.29+.02,z);m.castShadow=true;m.receiveShadow=true;group.add(m);}
  function rebuild(water,blocks){
    group.traverse(o=>{if(o.isMesh)o.geometry.dispose();});group.clear();mask.fill(0);
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
    updateDepth();
    return analysis;
  }
  function animate(t,reducedMotion=false){clock.value=reducedMotion?0:t*.001;}
  return {group,rebuild,animate};
}
