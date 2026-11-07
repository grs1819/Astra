// Sparse elevation steps keep older saves flat and editing reversible.
export const TERRAIN_STEP=.25;
export const TERRAIN_MAX=6;
const id=(x,z)=>`${x},${z}`;
export function normalizeTerrain(source){
 const result={};
 if(!source||typeof source!=='object')return result;
 for(const [k,value]of Object.entries(source)){
  const parts=k.split(',').map(Number);
  if(parts.length!==2||!parts.every(n=>Number.isInteger(n)&&Math.abs(n)<=9)||!Number.isFinite(value))continue;
  const n=Math.max(0,Math.min(TERRAIN_MAX,Math.round(value)));if(n)result[id(...parts)]=n;
 }
 return result;
}
export const terrainLevel=(terrain,x,z)=>terrain[id(x,z)]||0;
// Flat tile centers blend continuously through rounded shoulders at the edges.
const blend=t=>{t=Math.max(0,Math.min(1,(t-.25)*2));return t*t*(3-2*t);};
export function terrainHeight(terrain,x,z){
 const a=Math.floor(x),b=Math.floor(z),u=blend(x-a),v=blend(z-b);
 const h=(dx,dz)=>terrainLevel(terrain,a+dx,b+dz)*TERRAIN_STEP;
 return (h(0,0)*(1-u)+h(1,0)*u)*(1-v)+(h(0,1)*(1-u)+h(1,1)*u)*v;
}
export function levelSite(terrain,x,z){
 const h=terrainLevel(terrain,x,z);
 for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)if(terrainLevel(terrain,x+dx,z+dz)!==h)return false;
 return true;
}
export function editTerrain(terrain,blocks,water,x,z,mode,level=0){
 if(!Number.isInteger(x)||!Number.isInteger(z)||Math.abs(x)>9||Math.abs(z)>9)return null;
 // Protect all affected shoulders around rigid buildings, camp furniture, and water.
 for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++){
  if(water[id(x+dx,z+dz)])return null;
  for(let y=0;y<8;y++)if(['house','balcony','camp','campProp'].includes(blocks[`${x+dx},${y},${z+dz}`]?.type))return null;
 }
 const old=terrainLevel(terrain,x,z),value=mode==='raise'?old+1:mode==='lower'?old-1:mode==='level'?level:old;
 const next=Math.max(0,Math.min(TERRAIN_MAX,value));
 if(next===old)return null;
 const result={...terrain};if(next)result[id(x,z)]=next;else delete result[id(x,z)];return result;
}

// Decorative landscape stays outside the playable clearing and never enters saves.
export function borderHeight(x,z){
 const radius=Math.max(Math.abs(x),Math.abs(z));
 if(radius<=10.5||radius>=27)return 0;
 const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
 const edge=smooth((radius-10.5)/3)*smooth((27-radius)/5);
 const hill=(a,b,size,height)=>height*Math.exp(-((x-a)**2+(z-b)**2)/(size*size));
 return edge*(.22+.28*(Math.sin(x*.37+z*.2)+1)+hill(-16,-15,4.2,3.8)+hill(15,-18,4.6,4.7)+hill(-19,4,3.7,2.9)+hill(18,12,4,1.8)+hill(-5,17,4.8,1));
}
