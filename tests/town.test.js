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

test('architecture grows with height or footprint and shrinks after removal',async()=>{
  const {architecturePlan}=await import('../town.js');
  const b={'0,0,0':house,'5,0,0':house};
  assert.equal(architecturePlan(b).get('0,0,0').tier,'cottage');
  b['0,1,0']=house;
  assert.equal(architecturePlan(b).get('0,0,0').tier,'lodge');
  b['0,2,0']=house;b['0,3,0']=house;
  let plan=architecturePlan(b);
  assert.equal(plan.get('0,0,0').tier,'estate');
  assert.equal(plan.get('0,3,0'),plan.get('0,0,0'));
  assert.equal(plan.get('5,0,0').tier,'cottage');
  delete b['0,3,0'];assert.equal(architecturePlan(b).get('0,0,0').tier,'lodge');
  const wide={};for(let x=0;x<5;x++)for(let z=0;z<2;z++)wide[key(x,0,z)]=house;
  assert.equal(architecturePlan(wide).get('0,0,0').tier,'estate');
});

test('balconies do not merge separate buildings into one estate',async()=>{
  const {architecturePlan}=await import('../town.js');
  const b={'0,0,0':house,'1,0,0':{type:'balcony'},'2,0,0':house};
  const plan=architecturePlan(b);
  assert.equal(plan.get('0,0,0').rooms,1);assert.equal(plan.get('2,0,0').rooms,1);
});

test('roles apply to connected houses and survive loading without leaking to neighbors',async()=>{
 const {assignRole}=await import('../town.js');
 const b={'0,0,0':house,'0,1,0':house,'3,0,0':house};
 const assigned=assignRole(b,'0,1,0','fishing');
 assert.equal(assigned['0,0,0'].role,'fishing');assert.equal(assigned['3,0,0'].role,undefined);assert.equal(b['0,0,0'].role,undefined);
 assert.equal(normalize({blocks:assigned}).blocks['0,1,0'].role,'fishing');
 assert.equal(assignRole(assigned,'0,0,0','home')['0,1,0'].role,undefined);
 assert.equal(assignRole(b,'0,0,0','invalid'),null);
});
test('camps upgrade twice, preserve stages, and require dry ground',async()=>{
 const {upgradeCamp}=await import('../town.js');
 let b={'0,0,0':{type:'camp',stage:1}};
 b=upgradeCamp(b,'0,0,0');assert.equal(b['0,0,0'].stage,2);
 b=upgradeCamp(b,'0,0,0');assert.equal(b['0,0,0'].stage,3);
 assert.equal(upgradeCamp(b,'0,0,0'),null);
 assert.equal(normalize({blocks:b}).blocks['0,0,0'].stage,3);
 assert.equal(canPlace({},0,0,0,'camp',{'0,0':'lake'}),false);
 assert.equal(canPlace({'0,0,0':house},0,1,0,'camp'),false);
 assert.equal(canPlace({},0,0,0,'camp'),true);
 const {waterEdit}=await import('../water.js');assert.equal(waterEdit({},b,0,0,'lake'),null);
});

test('connected camps share one hub, furnish at four, and split on removal',async()=>{
 const {campsitePlan,upgradeCamp}=await import('../town.js');
 const c={type:'camp',stage:1},b={'0,0,0':c,'1,0,0':c,'2,0,0':c,'2,0,1':c,'4,0,0':c};
 let plan=campsitePlan(b);assert.equal(plan.get('0,0,0').size,4);assert.equal(plan.get('0,0,0').stage,3);
 assert.equal(plan.get('0,0,0'),plan.get('2,0,1'));assert.equal(plan.get('4,0,0').hub,null);
 const reverse=Object.fromEntries(Object.entries(b).reverse());assert.equal(campsitePlan(reverse).get('0,0,0').hub,plan.get('0,0,0').hub);
 assert.equal(upgradeCamp(b,'0,0,0'),null);
 delete b['1,0,0'];plan=campsitePlan(b);assert.equal(plan.get('0,0,0').size,1);assert.equal(plan.get('2,0,0').size,2);assert.equal(plan.get('2,0,0').stage,2);
 const upgraded=upgradeCamp(b,'2,0,1');assert.equal(upgraded['2,0,0'].stage,3);assert.equal(upgraded['0,0,0'].stage,1);
});

test('narrow stacked towers gain lookouts but broad or unsupported tops do not',async()=>{
 const {lookoutPlan}=await import('../town.js');
 const b={};for(let y=0;y<3;y++)b[key(0,y,0)]=house;
 assert.deepEqual([...lookoutPlan(b)],['0,2,0']);
 b['0,3,0']=house;assert.deepEqual([...lookoutPlan(b)],['0,3,0']);
 delete b['0,3,0'];for(let x=1;x<=2;x++)for(let y=0;y<3;y++)b[key(x,y,0)]=house;
 assert.equal(lookoutPlan(b).size,0);
 for(let y=0;y<3;y++)delete b[key(2,y,0)];assert.equal(lookoutPlan(b).size,2);
 delete b['1,1,0'];assert.equal(lookoutPlan(b).size,0);
});

test('concave roofs follow occupied tiles and meet at shared edges',async()=>{
 const {roofPlan,joinedRoofHeight}=await import('../town.js');
 const b={};for(const [x,z]of [[0,0],[1,0],[2,0],[0,1],[0,2]])b[key(x,0,z)]=house;
 const plan=roofPlan(b),form=plan.get('0,0,0');assert.equal(form.kind,'joined');assert.equal(plan.has('1,0,1'),false);
 assert.equal(plan.get('1,0,0'),form);assert.equal(joinedRoofHeight(form,.5,1),0);assert.ok(joinedRoofHeight(form,0,0)>0);
 for(let x=0;x<3;x++)for(let z=0;z<3;z++)b[key(x,0,z)]=house;
 assert.equal(roofPlan(b).get('0,0,0').kind,'gable');
});
test('connected houses share one entrance and prefer an adjacent path',async()=>{
 const {entrancePlan}=await import('../town.js');
 const b={'0,0,0':house,'1,0,0':house,'2,0,0':house};
 let plan=entrancePlan(b);assert.equal(plan.size,1);assert.equal(plan.get('1,0,0').dz,1);
 b['-1,0,0']={type:'path'};plan=entrancePlan(b);assert.equal(plan.size,1);assert.equal(plan.get('0,0,0').dx,-1);
 delete b['1,0,0'];assert.equal(entrancePlan(b).size,2);
});

test('tree species persist and legacy or invalid species become pine',()=>{
 const blocks={};for(const [i,species]of ['larch','birch','pine','redwood','unknown'].entries())blocks[key(i,0,0)]={type:'tree',species};
 blocks['5,0,0']={type:'tree'};
 const result=normalize({blocks}).blocks;
 for(const [i,species]of ['larch','birch','pine','redwood','pine','pine'].entries())assert.equal(result[key(i,0,0)].species,species);
});

test('path surfaces persist and old paths default to gravel',()=>{
 const b=normalize({blocks:{'0,0,0':{type:'path',surface:'cobble'},'1,0,0':{type:'path'}}}).blocks;
 assert.equal(b['0,0,0'].surface,'cobble');assert.equal(b['1,0,0'].surface,'gravel');
});

test('deck covers persist, join matching neighbors, and defer to overhead rooms',async()=>{
 const {deckCoverPlan}=await import('../town.js');
 const b={'0,0,0':{type:'balcony',cover:'roofed'},'1,0,0':{type:'balcony',cover:'roofed'},'2,0,0':{type:'balcony',cover:'pergola'},'0,0,-1':house};
 let plan=deckCoverPlan(b);assert.equal(plan.get('0,0,0'),plan.get('1,0,0'));assert.notEqual(plan.get('1,0,0'),plan.get('2,0,0'));assert.deepEqual(plan.get('0,0,0').wall,[0,-1]);
 assert.equal(normalize({blocks:b}).blocks['0,0,0'].cover,'roofed');
 b['0,1,0']=house;plan=deckCoverPlan(b);assert.equal(plan.has('0,0,0'),false);assert.equal(plan.get('1,0,0').tiles.length,1);
 delete b['0,1,0'];b['0,0,0'].cover='open';assert.equal(deckCoverPlan(b).has('0,0,0'),false);
});

test('connected deck roofs follow the top of their attached wall and detach cleanly',async()=>{
 const {deckCoverPlan,architecturePlan}=await import('../town.js');
 const b={'0,0,0':{type:'balcony',cover:'roofed',roof:'moss'},'1,0,0':{type:'balcony',cover:'roofed'},'0,0,-1':{...house,roof:'clay'},'0,1,-1':{...house,roof:'slate'}};
 let form=deckCoverPlan(b).get('1,0,0');
 assert.equal(form.attachedHouse,'0,1,-1');
 assert.equal(b[form.attachedHouse].roof,'slate');
 assert.equal(architecturePlan(b).get(form.attachedHouse).tier,'lodge');
 delete b['0,1,-1'];form=deckCoverPlan(b).get('1,0,0');
 assert.equal(b[form.attachedHouse].roof,'clay');
 assert.equal(architecturePlan(b).get(form.attachedHouse).tier,'cottage');
 delete b['0,0,-1'];assert.equal(deckCoverPlan(b).get('1,0,0').attachedHouse,null);
});

test('porches inherit finishes across open and covered tiles and update on attachment changes',async()=>{
 const {porchFinishPlan}=await import('../town.js');
 const b={'0,0,0':{type:'balcony',wood:'birch'},'1,0,0':{type:'balcony',cover:'roofed'},'0,0,-1':{...house,wood:'cedar',roof:'clay'},'0,1,-1':{...house,roof:'slate'}};
 let plan=porchFinishPlan(b);
 assert.deepEqual(plan.get('1,0,0'),{wood:'cedar',roof:'slate',tier:'lodge'});
 assert.equal(plan.get('0,0,0'),plan.get('1,0,0'));
 delete b['0,1,-1'];b['0,0,-1'].wood='birch';
 assert.deepEqual(porchFinishPlan(b).get('1,0,0'),{wood:'birch',roof:'clay',tier:'cottage'});
 delete b['0,0,-1'];
 assert.deepEqual(porchFinishPlan(b).get('1,0,0'),{wood:'oak',roof:'moss',tier:'cottage'});
});

test('camp furniture persists, stays separate from shelters, and requires dry ground',async()=>{
 const {campFacing,campsitePlan}=await import('../town.js');
 const input={'0,0,0':{type:'camp',stage:2},'1,0,0':{type:'campProp',kind:'fire'},'2,0,0':{type:'campProp',kind:'seating'},'3,0,0':{type:'campProp',kind:'table'},'4,0,0':{type:'campProp',kind:'lantern'}};
 const b=normalize({blocks:input}).blocks;
 for(const k of Object.keys(input))assert.equal(b[k].type,input[k].type);
 for(const k of Object.keys(input).slice(1))assert.equal(b[k].kind,input[k].kind);
 assert.equal(campsitePlan(b).get('0,0,0').size,1);
 assert.equal(canPlace({},0,1,0,'campProp'),false);
 assert.equal(canPlace({},0,0,0,'campProp',{'0,0':'lake'}),false);
 assert.equal(canPlace({},0,0,0,'campProp'),true);
 assert.equal(campFacing(b,2,0,true),-Math.PI/2);
});
