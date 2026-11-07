import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeTerrain,terrainHeight,terrainLevel,editTerrain,levelSite} from '../terrain.js';
import {normalize} from '../town.js';
import {buildNavigation,findRoute} from '../navigation.js';
test('old saves stay flat; invalid elevations are rejected or bounded',()=>{
 assert.deepEqual(normalize({blocks:{}}).terrain,{});
 assert.deepEqual(normalizeTerrain({'0,0':2,'1,0':99,'2,0':-3,'1.5,0':2,'10,0':3,'0,1':NaN}),{'0,0':2,'1,0':6});
 assert.equal(terrainHeight({},2.7,-3.1),0);
});
test('raise lower and level preserve input and can return to flat',()=>{
 const original={},a=editTerrain(original,{}, {},0,0,'raise');assert.deepEqual(original,{});assert.equal(terrainLevel(a,0,0),1);
 assert.deepEqual(editTerrain(a,{}, {},0,0,'lower'),{});
 assert.equal(terrainLevel(editTerrain(a,{}, {},1,0,'level',4),1,0),4);
 assert.equal(editTerrain({}, {},{},0,0,'lower'),null);
 assert.equal(editTerrain({'0,0':6},{},{},0,0,'raise'),null);
});
test('terrain shoulders remain continuous with flat centers and level clearings',()=>{
 const t={'0,0':4};assert.equal(terrainHeight(t,0,0),1);assert.equal(terrainHeight(t,.2,.2),1);
 assert(Math.abs(terrainHeight(t,.5-1e-7,0)-terrainHeight(t,.5+1e-7,0))<1e-5);
 assert.equal(levelSite(t,0,0),false);
 for(let x=-1;x<=1;x++)for(let z=-1;z<=1;z++)t[`${x},${z}`]=4;
 assert.equal(levelSite(t,0,0),true);assert.equal(terrainHeight(t,.5,.5),1);
});
test('terrain editing protects nearby water and structural support but allows paths and trees',()=>{
 for(const type of ['house','balcony','camp','campProp'])assert.equal(editTerrain({}, {'1,0,0':{type}},{},0,0,'raise'),null);
 assert.equal(editTerrain({}, {},{'1,1':'lake'},0,0,'raise'),null);
 assert(editTerrain({}, {'0,0,0':{type:'path'}},{},0,0,'raise'));
 assert(editTerrain({}, {'0,0,0':{type:'tree'}},{},0,0,'raise'));
});
test('navigation follows elevation and excludes steep cycling routes',()=>{
 const blocks={'0,0,0':{type:'path'},'1,0,0':{type:'path'}},terrain={'1,0':2};
 const walk=buildNavigation(blocks,{},false,terrain),bike=buildNavigation(blocks,{},true,terrain);
 assert.equal(walk.get('1,0').y,.6);assert.equal(findRoute(walk,'0,0','1,0').length,2);assert.equal(findRoute(bike,'0,0','1,0').length,0);
 assert.equal(findRoute(buildNavigation(blocks,{},true,{'1,0':1}),'0,0','1,0').length,2);
});
