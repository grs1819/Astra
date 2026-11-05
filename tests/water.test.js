import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeWater,waterKey,analyzeWater,waterEdit} from '../water.js';
import {normalize,canPlace,removeBlock} from '../town.js';
const house={type:'house',wood:'oak',roof:'moss'};
test('old saves acquire an empty water layer; new water survives normalization',()=>{
  assert.deepEqual(normalize({blocks:{'0,0,0':house}}).water,{});
  const state=normalize({blocks:{'0,0,0':house},water:{'0,0':'lake','1,0':'river','2,0':'stream','10,0':'lake','0,0,0':'lake','1.5,0':'river','0,1':'lava'}});
  assert.deepEqual(state.water,{'0,0':'lake','1,0':'river','2,0':'stream'});assert.deepEqual(state.blocks['0,0,0'],house);
});
test('decoration progresses at 4, 10, and 18 connected tiles',()=>{
  for(const [size,tier]of [[1,0],[3,0],[4,1],[9,1],[10,2],[17,2],[18,3]]){
    const water={};for(let x=0;x<size;x++)water[waterKey(x-9,0)]='stream';
    const result=analyzeWater(water);assert.equal(result.bodies.length,1);assert.equal(result.bodies[0].size,size);assert.equal(result.bodies[0].tier,tier);
  }
});
test('mixed water connects cardinally, not diagonally; removal splits bodies',()=>{
  const water={'0,0':'stream','1,0':'river','2,0':'lake','3,1':'lake'};
  assert.equal(analyzeWater(water).bodies.length,2);
  const split=waterEdit(water,{},1,0,null);assert.equal(analyzeWater(split).bodies.length,3);assert.equal(water['1,0'],'river');
});
test('water coexists with cottages and paths; painting cannot destroy trees',()=>{
  const blocks={'0,0,0':house,'1,0,0':{type:'path'},'2,0,0':{type:'tree'}};
  let water=waterEdit({},blocks,0,0,'river');water=waterEdit(water,blocks,1,0,'lake');
  assert.equal(waterEdit(water,blocks,2,0,'stream'),null);assert.equal(blocks['0,0,0'],house);
  assert.equal(canPlace({},0,0,0,'house',water),true);assert.equal(canPlace({},0,0,0,'path',water),true);assert.equal(canPlace({},0,0,0,'tree',water),false);
});
test('water deletion and building deletion leave the independent layer intact',()=>{
  const blocks={'0,0,0':house,'0,1,0':house},water={'0,0':'lake'};
  assert.deepEqual(waterEdit(water,blocks,0,0,null),{});assert.equal(Object.keys(blocks).length,2);
  assert.deepEqual(removeBlock(blocks,'0,0,0'),{});assert.deepEqual(water,{'0,0':'lake'});
});
test('water painting rejects invalid tools, bounds, and no-op edits',()=>{
  assert.equal(waterEdit({}, {},10,0,'river'),null);assert.equal(waterEdit({}, {},0,0,'sea'),null);
  assert.equal(waterEdit({'0,0':'stream'}, {},0,0,'stream'),null);assert.equal(waterEdit({}, {},0,0,null),null);
  assert.deepEqual(waterEdit({'0,0':'stream'}, {},0,0,'lake'),{'0,0':'lake'});assert.deepEqual(normalizeWater(null),{});
});
