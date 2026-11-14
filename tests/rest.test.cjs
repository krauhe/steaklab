const {test}=require('node:test');
const assert=require('node:assert/strict');
require('../src/physics.js');
const {Engine,REST_MODES}=globalThis.SteakPhysics;
const near=(a,b,tol=1e-8)=>assert.ok(Math.abs(a-b)<=tol,`${a} vs ${b}`);
function cookedCut(){
 const e=new Engine({panInitial:220});e.action('power',4);e.action('oil',10);e.action('add');e.step(180);e.action('flip');e.step(180);return e;
}

test('Default rest equals explicit air and remains uncoupled from the spatial pan',()=>{
 const base=new Engine({panInitial:200,nr:6,nz:8,panRadiation:false});base.action('add');base.step(60);base.action('flip');base.step(60);
 const implicit=base.clone(),explicit=base.clone();assert.equal(implicit.action('rest'),true);assert.equal(explicit.action('rest','air'),true);
 implicit.step(180);explicit.step(180);assert.deepEqual(implicit.observe(),explicit.observe());assert.deepEqual(implicit.T,explicit.T);
 // A changed pan field must not heat meat that has been moved to the rack.
 const hotter=implicit.clone(),unchanged=implicit.clone();hotter.pan+=100;hotter.step(30);unchanged.step(30);assert.deepEqual(hotter.T,unchanged.T);
 near(implicit.observe().energyResidual,0,5e-6);
 assert.equal(implicit.observe().restMode,'air');assert.equal(implicit.action('flip'),false);
});

test('Air, loose foil and residual pan heat produce distinct conservative rest histories',()=>{
 const base=cookedCut(),states={};
 for(const mode of ['air','foil','pan']){const e=base.clone();assert.equal(e.action('rest',mode),true);e.action('power',0);e.step(180);states[mode]={engine:e,...e.observe()};near(e.observe().energyResidual,0,2e-6);assert.equal(e.observe().restMode,mode);assert.equal(e.bottomSide,base.bottomSide);}
 assert.ok(states.foil.core>states.air.core);assert.ok(states.foil.faceA>states.air.faceA&&states.foil.faceB>states.air.faceB);
 assert.ok(states.foil.engine.energyLost<states.air.engine.energyLost);near(states.foil.pan,states.air.pan);
 assert.ok(states.pan.core>states.foil.core);assert.ok(states.pan.faceB>states.foil.faceB+20);
 assert.ok(states.pan.evaporated>states.air.evaporated);assert.ok(states.pan.brownB>states.air.brownB);
 assert.equal(REST_MODES.foil.convection,.4);assert.equal(REST_MODES.foil.radiation,.5);
});

test('Pan rest switches the stove target off while preserving hob lag and coupled energy',()=>{
 const e=new Engine({panInitial:200,losses:false,evaporation:false});e.action('power',6);e.action('add');e.step(40);
 const watts=e.actualWatts,input=e.energyInput,pan=e.pan,meatEnergy=()=>e.T.reduce((sum,temp,i)=>sum+temp*e.mesh.mass[i],0),before=meatEnergy();
 assert.equal(e.action('rest','pan'),true);assert.equal(e.power,0);assert.equal(e.actualWatts,watts);assert.equal(e.hasPanContact(),true);
 e.step(12);near(e.actualWatts,watts*Math.exp(-12/3),1e-7);near(e.energyInput-input,watts*3*(1-Math.exp(-12/3)),1e-7);
 near(e.observe().energyResidual,0,2e-6);assert.ok(e.pan<pan);assert.ok(meatEnergy()>before);
 // An explicitly scheduled later stove action remains authoritative.
 assert.equal(e.action('power',7),true);assert.equal(e.power,7);
});

test('A pan-resting cut can be flipped and later moved off the pan',()=>{
 const e=cookedCut();e.action('rest','pan');const side=e.bottomSide,T=Float64Array.from(e.T),doses=e.doses.map(d=>Float64Array.from(d));
 assert.equal(e.action('flip'),true);assert.equal(e.bottomSide,1-side);assert.deepEqual(e.T,T);assert.deepEqual(e.doses,doses);assert.equal(e.restMode,'pan');
 assert.equal(e.action('rest','pan'),false);assert.equal(e.action('rest','foil'),true);assert.equal(e.hasPanContact(),false);assert.equal(e.action('flip'),false);
 assert.equal(e.action('rest','air'),false); // An off-pan rest is already underway.
 const another=new Engine();another.action('add');assert.equal(another.action('rest','unknown'),false);assert.equal(another.phase,'cooking');
});

test('Clones retain rest mode without sharing temperature, water or dose state',()=>{
 const e=cookedCut();e.action('rest','pan');const copy=e.clone();assert.equal(copy.restMode,'pan');assert.equal(copy.observe().restMode,'pan');
 copy.action('rest','foil');copy.step(60);assert.equal(e.restMode,'pan');assert.equal(copy.restMode,'foil');assert.equal(e.time,360);
 assert.notDeepEqual(copy.T,e.T);assert.notEqual(copy.water,e.water);assert.notEqual(copy.doses[0],e.doses[0]);
 near(copy.observe().energyResidual,0,2e-6);near(e.observe().energyResidual,0,2e-6);
});

test('Foil factors alter only environmental meat losses',()=>{
 const e=new Engine({panInitial:210,losses:false});e.action('add');e.step(100);
 const a=e.clone(),f=e.clone();a.action('rest','air');f.action('rest','foil');a.step(180);f.step(180);
 assert.deepEqual(a.T,f.T);assert.deepEqual(a.water,f.water);assert.deepEqual(a.doses,f.doses);near(a.pan,f.pan);
});
