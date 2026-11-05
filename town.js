import {normalizeWater,waterKey} from './water.js';
export const LIMIT = 9;
export const MAX_HEIGHT = 8;
export const key = (x, y, z) => `${x},${y},${z}`;
export const directions = [[1,0,0],[-1,0,0],[0,0,1],[0,0,-1]];
export const inside = (x,y,z) => [x,y,z].every(Number.isInteger) && Math.abs(x)<=LIMIT && Math.abs(z)<=LIMIT && y>=0 && y<MAX_HEIGHT;
export const cottageCount = blocks => new Set(Object.entries(blocks).filter(([,b])=>b.type==='house').map(([k])=>{const [x,,z]=k.split(',');return `${x},${z}`;})).size;
export function normalize(data, legacy=false) {
  const blocks = {};
  const source = legacy ? data?.cells : data?.blocks;
  if (source && typeof source==='object') for(const [k,b] of Object.entries(source)) {
    if(!b || !['house','balcony','tree','path'].includes(b.type)) continue;
    const parts=k.split(',').map(Number);
    if(parts.length!==(legacy?2:3)) continue;
    const [x,y,z]=legacy?[parts[0],0,parts[1]]:parts;
    const floors=legacy&&b.type==='house'?Math.max(1,Math.min(3,Number(b.level)||1)):1;
    for(let i=0;i<floors;i++) if(inside(x,y+i,z) && (['house','balcony'].includes(b.type)||y+i===0)) {
      blocks[key(x,y+i,z)]={type:b.type,wood:['oak','birch','cedar'].includes(b.wood)?b.wood:'oak',roof:['moss','clay','slate'].includes(b.roof)?b.roof:'moss'};
    }
  }
  return {blocks,water:normalizeWater(data?.water,LIMIT),peak:Math.max(Number.isFinite(data?.peak)?data.peak:0,cottageCount(blocks))};
}
export function canPlace(blocks,x,y,z,type,water={}) {
  if(type==='tree'&&water[waterKey(x,z)])return false;
  if(!inside(x,y,z)) return false;
  const existing=blocks[key(x,y,z)];
  if(existing && !(type==='house' && existing.type==='balcony')) return false;
  if(type==='path'||type==='tree') return y===0;
  if(y===0) return true;
  const below=blocks[key(x,y-1,z)];
  return below?.type==='house' || directions.some(([dx,,dz])=>blocks[key(x+dx,y,z+dz)]?.type==='house');
}
// Removing a support removes only elevated components no longer connected to ground.
export function removeBlock(blocks,position) {
  const result=structuredClone(blocks);
  delete result[position];
  const supported=new Set(), queue=Object.keys(result).filter(k=>Number(k.split(',')[1])===0);
  for(const k of queue) supported.add(k);
  for(let i=0;i<queue.length;i++) {
    const k=queue[i], b=result[k];
    if(b.type!=='house') continue;
    const [x,y,z]=k.split(',').map(Number);
    for(const [dx,dy,dz] of [...directions,[0,1,0],[0,-1,0]]) {
      const n=key(x+dx,y+dy,z+dz);
      if(result[n] && ['house','balcony'].includes(result[n].type) && !supported.has(n)) { supported.add(n);queue.push(n); }
    }
  }
  for(const k of Object.keys(result)) if(!supported.has(k)) delete result[k];
  return result;
}
export function archAxis(blocks,x,y,z) {
  if(y<1 || blocks[key(x,y-1,z)]?.type==='house') return null;
  for(const [dx,,dz] of [[1,0,0],[0,0,1]]) {
    if([-1,1].every(sign=>blocks[key(x+sign*dx,y,z+sign*dz)]?.type==='house' && blocks[key(x+sign*dx,y-1,z+sign*dz)]?.type==='house')) return dx?'x':'z';
  }
  return null;
}

// Recompute roof forms from the occupied footprint; no extra saved state.
export function roofPlan(blocks){
  const plan=new Map(),pending=new Set();
  for(const [k,b]of Object.entries(blocks)){
    const [x,y,z]=k.split(',').map(Number);
    if(b.type!=='house'||blocks[key(x,y+1,z)])continue;
    const terrace=directions.some(([dx,,dz])=>blocks[key(x+dx,y+1,z+dz)]?.type==='house');
    if(terrace)plan.set(k,{kind:'terrace'});else pending.add(k);
  }
  while(pending.size){
    const first=pending.values().next().value,queue=[first];pending.delete(first);
    for(let i=0;i<queue.length;i++){
      const [x,y,z]=queue[i].split(',').map(Number);
      for(const [dx,,dz]of directions){const k=key(x+dx,y,z+dz);if(pending.delete(k))queue.push(k);}
    }
    const coords=queue.map(k=>k.split(',').map(Number));
    const xs=coords.map(p=>p[0]),zs=coords.map(p=>p[2]);
    const spanX=Math.max(...xs)-Math.min(...xs),spanZ=Math.max(...zs)-Math.min(...zs);
    const axis=spanX>=spanZ?'x':'z',cross=axis==='x'?zs:xs;
    const lo=Math.min(...cross)-.5,hi=Math.max(...cross)+.5;
    const form={kind:queue.length===1?'hip':'gable',axis,lo,hi,ridge:(lo+hi)/2,height:Math.min(.8,.44*(hi-lo))};
    for(const k of queue)plan.set(k,form);
  }
  return plan;
}
