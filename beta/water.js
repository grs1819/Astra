// Water occupies terrain independently of buildings and joins across diagonals.
export const WATER_TYPES = {
  stream: {label:'Stream',width:.36,color:'#79b5ae'},
  river: {label:'River',width:.74,color:'#5d9f9e'},
  lake: {label:'Lake',width:1,color:'#548f96'},
};
export const waterKey=(x,z)=>`${x},${z}`;
export const waterConnections=[[1,1],[1,-1],[-1,1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]];
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
      for(const [dx,dz]of waterConnections){const n=waterKey(x+dx,z+dz);if(water[n]&&!cells.has(n)){cells.set(n,body);queue.push(n);}}
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

// Keep joined edges exactly on the grid; soften only exposed shoreline.
export function lakeOutline(water,x,z){
  const points=[];
  for(let i=0;i<64;i++){
    const angle=i/64*Math.PI*2,c=Math.cos(angle),s=Math.sin(angle);
    const sx=c>=0?1:-1,sz=s>=0?1:-1;
    const openX=!water[waterKey(x+sx,z)],openZ=!water[waterKey(x,z+sz)];
    const exposed=Math.abs(c)>=Math.abs(s)?openX:openZ;
    let radius=.5/Math.max(Math.abs(c),Math.abs(s));
    if(openX&&openZ)radius=.5/Math.pow(c**4+s**4,.25);
    if(exposed){
      const t=Math.abs(c)>=Math.abs(s)?s/c:c/s;
      const envelope=Math.cos(t*Math.PI/2)**2;
      radius-=(.025+.014*Math.sin((x+c)*4.3+(z+s)*3.7)) * envelope;
    }
    points.push([x+c*radius,z+s*radius]);
  }
  return points;
}
