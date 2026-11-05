// Water occupies terrain independently of buildings. Connectivity is cardinal,
// so touching corners do not merge bodies or unlock shared decoration tiers.
export const WATER_TYPES = {
  stream: {label:'Stream',width:.36,color:'#79b5ae'},
  river: {label:'River',width:.74,color:'#5d9f9e'},
  lake: {label:'Lake',width:1,color:'#548f96'},
};
export const waterKey=(x,z)=>`${x},${z}`;
export const waterDirections=[[1,0],[-1,0],[0,1],[0,-1]];
export function normalizeWater(source,limit=9){
  const result={};
  if(!source||typeof source!=='object')return result;
  for(const [k,type] of Object.entries(source)){
    const p=k.split(',').map(Number);
    if(p.length===2&&p.every(v=>Number.isInteger(v)&&Math.abs(v)<=limit)&&Object.hasOwn(WATER_TYPES,type))result[waterKey(...p)]=type;
  }
  return result;
}
export function analyzeWater(water){
  const cells=new Map(),bodies=[];
  for(const start of Object.keys(water)){
    if(cells.has(start))continue;
    const body={id:start,tiles:[],size:0,tier:0};
    const queue=[start];cells.set(start,body);
    for(let i=0;i<queue.length;i++){
      const k=queue[i],[x,z]=k.split(',').map(Number);body.tiles.push(k);
      for(const [dx,dz]of waterDirections){const n=waterKey(x+dx,z+dz);if(water[n]&&!cells.has(n)){cells.set(n,body);queue.push(n);}}
    }
    body.size=body.tiles.length;
    body.tier=body.size>=18?3:body.size>=10?2:body.size>=4?1:0;
    bodies.push(body);
  }
  return {cells,bodies};
}
export function waterEdit(water,blocks,x,z,type,limit=9){
  if(!Number.isInteger(x)||!Number.isInteger(z)||Math.abs(x)>limit||Math.abs(z)>limit)return null;
  const k=waterKey(x,z);
  if(type===null){if(!water[k])return null;const next={...water};delete next[k];return next;}
  if(!Object.hasOwn(WATER_TYPES,type)||['tree','camp'].includes(blocks[`${x},0,${z}`]?.type)||water[k]===type)return null;
  return {...water,[k]:type};
}
