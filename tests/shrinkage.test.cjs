const {test}=require('node:test');
const assert=require('node:assert/strict');
require('../src/physics.js');require('../src/runner.js');
const {Engine}=SteakPhysics;
const near=(a,b,tol=1e-8)=>assert.ok(Math.abs(a-b)<=tol,`${a} vs ${b}`);
const sum=a=>a.reduce((s,x)=>s+x,0);

test('Geometry change preserves material heat, water, crust, pan state and oil capacity',()=>{
 const e=new Engine({meat:'minced',nr:8,nz:12});e.action('oil',15);e.action('add');
 for(let i=0;i<e.T.length;i++)e.T[i]=20+i/4;
 e.doses[0][1]=.8;
 const energy=e.energy(),water=Array.from(e.water),T=Array.from(e.T),caps=Array.from(e.panMesh.capacities),PT=Array.from(e.panT),mass=Array.from(e.mesh.mass),g=Array.from(e.edgeG),area=e.mesh.area;
 assert.equal(e.updateGeometry(1),true);near(e.energy(),energy);assert.deepEqual(Array.from(e.water),water);assert.deepEqual(Array.from(e.T),T);assert.deepEqual(Array.from(e.mesh.mass),mass);assert.deepEqual(Array.from(e.panMesh.capacities),caps);assert.deepEqual(Array.from(e.panT),PT);near(e.doses[0][1],.8);
 near(e.observe().diameter,11.2);near(e.observe().thickness,32.5);near(e.mesh.area,area*.64*.49);near(sum(e.panMesh.contactArea),e.mesh.area);near(e.panMesh.contact.reduce((s,x)=>s+x[2],0),e.mesh.area);assert.notDeepEqual(Array.from(e.edgeG),g);
});

test('Minced geometry evolves while closed-system total heat remains conserved',()=>{
 const e=new Engine({meat:'minced',panInitial:220,losses:false,evaporation:false,nr:8,nz:12});e.action('add');const initial=e.energy();e.step(180);
 assert.ok(e.shrinkProgress>0);assert.ok(e.observe().diameter<14);assert.ok(e.observe().thickness>25);near(e.energy(),initial,1e-6);near(e.observe().energyResidual,0,1e-6);
});

test('Ready meat, disabled deformation and whole cuts keep their initial dimensions',()=>{
 for(const config of [{meat:'minced'},{meat:'minced',shrinkage:false},{meat:'beef'}]){
  const e=new Engine({...config,nr:8,nz:12,panInitial:200});e.T.fill(90);
  if(config.shrinkage===false||config.meat==='beef')e.action('add');
  e.updateShrinkage();e.step(10);near(e.observe().diameter,14);near(e.observe().thickness,25);near(e.shrinkProgress,0);
 }
});

test('Deformation and its material history do not reverse when resting and cooling',()=>{
 const e=new Engine({meat:'minced',nr:8,nz:12});e.action('add');e.T.fill(75);e.updateShrinkage();const before=e.observe();e.action('rest');e.T.fill(25);e.step(30);const after=e.observe();
 near(after.shrinkProgress,before.shrinkProgress);near(after.thickness,before.thickness);near(after.diameter,before.diameter);assert.equal(e.updateGeometry(0),false);
});

test('Cloned deformation state, mesh and oil capacities are isolated',()=>{
 const e=new Engine({meat:'minced',nr:8,nz:12});e.action('oil',10);e.action('add');e.updateGeometry(.3);const clone=e.clone(),before=e.observe(),area=e.mesh.area,caps=Array.from(e.panMesh.capacities);
 clone.T.fill(90);clone.updateShrinkage();clone.action('oil',10);assert.ok(clone.shrinkProgress>e.shrinkProgress);near(e.mesh.area,area);assert.deepEqual(e.observe(),before);assert.deepEqual(Array.from(e.panMesh.capacities),caps);assert.ok(e.shrinkHistory.every(x=>x===0));
 clone.mesh.nodes[0].z=123;assert.notEqual(e.mesh.nodes[0].z,123);
});

test('Geometry changes the center heating history, not only the observation fields',()=>{
 const config={meat:'minced',nr:8,nz:12,panInitial:220,losses:false,evaporation:false};
 const moving=new Engine(config),fixed=new Engine({...config,shrinkage:false});moving.action('add');fixed.action('add');moving.step(300);fixed.step(300);
 assert.ok(moving.shrinkProgress>.1);assert.ok(Math.abs(moving.observe().core-fixed.observe().core)>.1);near(moving.observe().energyResidual,0,1e-6);near(fixed.observe().energyResidual,0,1e-6);
});

test('Deformed minced suggestion replays with dimensions and cooked-through removal',()=>{
 const config={meat:'minced',thickness:15,nr:8,nz:12},plan=SteakRunner.suggest(config,52),result=SteakRunner.run(config,plan.events,plan.duration),removed=result.snapshots.find(p=>p.s.time===plan.removed);
 assert.ok(plan.reached);assert.ok(removed.s.min>=75);assert.ok(removed.s.diameter<14);assert.ok(removed.s.thickness>15);near(removed.s.min,plan.predicted.minAtRemoval,.03);assert.ok(result.snapshots.every(p=>Math.abs(p.s.energyResidual)<1e-5));
});
