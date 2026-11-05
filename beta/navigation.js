import {LIMIT,key,directions} from './town.js';
import {waterKey} from './water.js';
export function buildNavigation(blocks,water,cycling=false){
  const nodes=new Map();
  for(let x=-LIMIT;x<=LIMIT;x++)for(let z=-LIMIT;z<=LIMIT;z++){
    const block=blocks[key(x,0,z)],wet=!!water[waterKey(x,z)],path=block?.type==='path';
    if((block&&!path)||(wet&&!path)||(cycling&&!path))continue;
    nodes.set(waterKey(x,z),{x,z,y:path?(wet?.215:.06):0,path,neighbors:[]});
  }
  function bridgeAllows(a,b){
    if(!water[waterKey(a.x,a.z)])return true;
    // Match the rail openings created by the footbridge renderer.
    if(b.path)return true;
    const alongX=[-1,1].some(dx=>blocks[key(a.x+dx,0,a.z)]?.type==='path');
    return alongX?a.z===b.z:a.x===b.x;
  }
  for(const node of nodes.values())for(const [dx,,dz]of directions){
    const id=waterKey(node.x+dx,node.z+dz),next=nodes.get(id);
    if(next&&bridgeAllows(node,next)&&bridgeAllows(next,node))node.neighbors.push(id);
  }
  return nodes;
}
export function reachable(nodes,start,maxSteps=8){
  if(!nodes.has(start))return [];
  const queue=[[start,0]],seen=new Set([start]);
  for(let i=0;i<queue.length;i++){
    const [id,steps]=queue[i];if(steps>=maxSteps)continue;
    for(const next of nodes.get(id).neighbors)if(!seen.has(next)){seen.add(next);queue.push([next,steps+1]);}
  }
  return [...seen];
}
export function findRoute(nodes,start,end){
  if(!nodes.has(start)||!nodes.has(end))return [];
  const costs=new Map([[start,0]]),previous=new Map(),open=new Set([start]);
  while(open.size){
    let best;for(const id of open)if(best===undefined||costs.get(id)<costs.get(best))best=id;
    open.delete(best);if(best===end)break;
    for(const next of nodes.get(best).neighbors){const cost=costs.get(best)+(nodes.get(next).path?1:2.5);if(cost<(costs.get(next)??Infinity)){costs.set(next,cost);previous.set(next,best);open.add(next);}}
  }
  if(!costs.has(end))return [];
  const result=[end];while(result[0]!==start)result.unshift(previous.get(result[0]));return result;
}
