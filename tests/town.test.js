import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalize,key,canPlace,removeBlock,archAxis,cottageCount} from '../town.js';
const house={type:'house',wood:'oak',roof:'moss'};
test('legacy save preserves cottage floors, materials, and discoveries',()=>{
  const result=normalize({cells:{'1,2':{...house,level:3},'2,2':{type:'path'}},peak:12},true);
  assert.equal(Object.keys(result.blocks).length,4);assert.deepEqual(result.blocks['1,2,2'],house);assert.equal(result.peak,12);assert.equal(cottageCount(result.blocks),1);
});
test('rooms extend sideways, balconies attach, and unsupported blocks are rejected',()=>{
  const b={'0,0,0':house,'0,1,0':house};
  assert.equal(canPlace(b,1,1,0,'house'),true);assert.equal(canPlace(b,1,1,0,'balcony'),true);
  assert.equal(canPlace(b,3,1,0,'house'),false);assert.equal(canPlace(b,0,8,0,'house'),false);
  assert.equal(canPlace(b,1,1,0,'tree'),false);assert.equal(canPlace(b,10,0,0,'house'),false);
});
test('a raised span between two supports produces an arch',()=>{
  const b={};for(const x of [-1,1])for(const y of [0,1])b[key(x,y,0)]=house;b['0,1,0']=house;
  assert.equal(archAxis(b,0,1,0),'x');b['0,0,0']=house;assert.equal(archAxis(b,0,1,0),null);
});
test('removal prunes floating components but preserves bridges connected at the other end',()=>{
  const b={'0,0,0':house,'0,1,0':house,'1,1,0':house,'2,1,0':house,'2,0,0':house,'1,1,1':{type:'balcony'}};
  const one=removeBlock(b,'0,0,0');assert.equal(Object.keys(one).length,5);
  const two=removeBlock(one,'2,0,0');assert.equal(Object.keys(two).length,0);assert.equal(Object.keys(b).length,6);
});
test('saved data is sanitized and balconies can become enclosed rooms',()=>{
  const b=normalize({blocks:{'0,1,0':{type:'balcony'},'99,0,0':house,'0,-1,0':house,'0,0,0':house}}).blocks;
  assert.equal(Object.keys(b).length,2);assert.equal(canPlace(b,0,1,0,'house'),true);
});

test('roof footprints align ridges and create reversible terraces beside taller rooms',async()=>{
  const {roofPlan}=await import('../town.js');
  const b={'0,0,0':house};assert.equal(roofPlan(b).get('0,0,0').kind,'hip');
  b['0,0,1']=house;let roofs=roofPlan(b);assert.equal(roofs.get('0,0,0').axis,'z');assert.equal(roofs.get('0,0,0'),roofs.get('0,0,1'));
  b['0,1,1']=house;roofs=roofPlan(b);assert.equal(roofs.get('0,0,0').kind,'terrace');assert.equal(roofs.has('0,0,1'),false);assert.equal(roofs.get('0,1,1').kind,'hip');
  delete b['0,1,1'];assert.equal(roofPlan(b).get('0,0,0').kind,'gable');
});
