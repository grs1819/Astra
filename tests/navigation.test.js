import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildNavigation,reachable,findRoute} from '../navigation.js';

test('walking excludes buildings, trees, and open water but includes bridge decks',()=>{
 const graph=buildNavigation({'0,0,0':{type:'house'},'1,0,0':{type:'tree'},'2,0,0':{type:'path'}},{'2,0':'river','3,0':'lake'});
 assert.equal(graph.has('0,0'),false);assert.equal(graph.has('1,0'),false);assert.equal(graph.has('3,0'),false);
 assert.equal(graph.get('2,0').y,.1);assert.equal(graph.get('4,0').y,0);assert.equal(graph.has('10,0'),false);
});
test('cycling stays on connected paths and cannot cross a gap',()=>{
 const blocks={'0,0,0':{type:'path'},'1,0,0':{type:'path'},'2,0,0':{type:'path'},'4,0,0':{type:'path'}};
 const graph=buildNavigation(blocks,{},true);assert.equal(graph.size,4);
 assert.deepEqual(findRoute(graph,'0,0','2,0'),['0,0','1,0','2,0']);assert.deepEqual(findRoute(graph,'0,0','4,0'),[]);
 assert.equal(reachable(graph,'0,0').length,3);
});
test('paths are preferred over an equally short grass route',()=>{
 const blocks={};for(let x=0;x<=3;x++)blocks[`${x},0,1`]={type:'path'};
 const route=findRoute(buildNavigation(blocks,{}),'0,0','3,0');assert.ok(route.includes('1,1'));assert.ok(route.includes('2,1'));
});
test('bridge railings prevent walking off the sides',()=>{
 const graph=buildNavigation({'0,0,0':{type:'path'},'-1,0,0':{type:'path'}},{'0,0':'river'});
 assert.ok(graph.get('0,0').neighbors.includes('1,0'));assert.ok(graph.get('0,0').neighbors.includes('-1,0'));
 assert.equal(graph.get('0,0').neighbors.includes('0,1'),false);assert.equal(graph.get('0,1').neighbors.includes('0,0'),false);
});
test('new obstacles remove the old route and isolated cells remain safe',()=>{
 const blocks={'0,0,0':{type:'path'},'1,0,0':{type:'path'},'2,0,0':{type:'path'}};
 assert.equal(findRoute(buildNavigation(blocks,{},true),'0,0','2,0').length,3);
 blocks['1,0,0']={type:'house'};const graph=buildNavigation(blocks,{},true);
 assert.deepEqual(findRoute(graph,'0,0','2,0'),[]);assert.deepEqual(reachable(graph,'0,0'),['0,0']);assert.deepEqual(reachable(graph,'missing'),[]);
});

test('diagonal paths connect for walkers and cyclists without cutting solid corners',()=>{
 const blocks={'0,0,0':{type:'path'},'1,0,1':{type:'path'},'2,0,2':{type:'path'}};
 for(const cycling of [false,true])assert.deepEqual(findRoute(buildNavigation(blocks,{},cycling),'0,0','2,2'),['0,0','1,1','2,2']);
 for(const type of ['house','tree','camp']){
   blocks['1,0,0']={type};assert.equal(buildNavigation(blocks,{},true).get('0,0').neighbors.includes('1,1'),false);
 }
});
test('diagonal boardwalks connect at their real deck heights and remove cleanly',()=>{
 const blocks={'0,0,0':{type:'path'},'1,0,1':{type:'path'}};
 const graph=buildNavigation(blocks,{'1,1':'lake'},true);
 assert.equal(graph.get('0,0').y,.1);assert.equal(graph.get('1,1').y,.1);assert.deepEqual(findRoute(graph,'0,0','1,1'),['0,0','1,1']);
 delete blocks['1,0,1'];assert.deepEqual(buildNavigation(blocks,{'1,1':'lake'},true).get('0,0').neighbors,[]);
});

test('right angle paths do not add a diagonal infill and shared edges stay square',async()=>{
 const {pathLinks,pathOutline}=await import('../navigation.js');
 const b={'0,0,0':{type:'path'},'1,0,0':{type:'path'},'1,0,1':{type:'path'}};
 assert.equal(pathLinks(b,0,0).some(([x,z])=>x===1&&z===1),false);
 const outline=pathOutline(b,0,0);assert.ok(outline.some(([x,z])=>x===.5&&z===.5));
 const graph=buildNavigation(b,{'1,0':'river'},true);assert.equal(graph.get('0,0').y,graph.get('1,0').y);
});
