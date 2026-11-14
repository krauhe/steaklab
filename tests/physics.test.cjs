const {test}=require('node:test');
const assert=require('node:assert/strict');
require('../src/physics.js');require('../src/runner.js');
const {Engine}=globalThis.SteakPhysics;
const near=(a,b,tol,message)=>assert.ok(Math.abs(a-b)<=tol,`${message||''}: ${a} vs ${b}, tolerance ${tol}`);
test('FEM integrates cylinder heat capacity, face area and corrected ellipse perimeter',()=>{
 for(const config of [{},{thickness:8,aspect:.45},{thickness:60,diameter:22,nr:24,nz:48}]){const e=new Engine(config),m=e.mesh,c=e.material;
 near(m.mass.reduce((a,b)=>a+b,0),Math.PI*m.R*m.R*m.H*c.rho*c.cp,1e-8,'capacity');
 near(m.faceA.reduce((a,b)=>a+b.area,0),Math.PI*m.R*m.R,1e-12,'face');
 near(m.side.reduce((a,b)=>a+b.area,0),m.perimeter*m.H,1e-12,'side');
 assert.ok(m.edges.every(edge=>edge[2]>0));assert.ok([...m.mass].every(v=>v>0));}
});
test('Closed pan-meat coupling conserves energy and preserves temperature bounds',()=>{
 const e=new Engine({panInitial:250,losses:false,evaporation:false});e.action('add');e.step(300);
 near(e.observe().energyResidual,0,2e-6,'energy in joules');assert.ok(Math.min(...e.T)>=5);assert.ok(Math.max(...e.T)<=250);assert.ok(e.pan<250&&e.pan>5);
});
test('Convection, radiation, oil mixing, burner lag and latent heat close the energy balance',()=>{
 const e=new Engine();e.action('power',12);e.step(110);e.action('oil',10);e.action('add');e.action('power',4);e.step(160);e.action('flip');e.step(160);e.action('rest');e.action('power',0);e.step(200);
 near(e.observe().energyResidual,0,5e-6,'all-process balance');assert.ok(e.evaporated>0);assert.ok(e.evaporated<=e.initialWater+1e-10);assert.ok([...e.water].every(v=>v>=0));
});
test('Flip changes the boundary identity without moving temperatures or destroying face history',()=>{
 const e=new Engine({panInitial:200});e.action('add');e.step(80);const before=Array.from(e.T),dose=Array.from(e.doses[0]);assert.equal(e.action('flip'),true);assert.equal(e.bottomSide,1);assert.deepEqual(Array.from(e.T),before);assert.deepEqual(Array.from(e.doses[0]),dose);
 const b=e.observe().faceB;e.step(10);assert.ok(e.observe().faceB>b);assert.equal(e.action('add'),false);
});
test('No heat is fabricated before placement; rest produces carryover from the existing field',()=>{
 const e=new Engine();e.action('power',12);e.step(100);assert.ok([...e.T].every(t=>t===5));e.action('add');e.action('power',3);e.step(180);e.action('flip');e.step(180);e.action('rest');const t=e.observe().core;e.step(60);assert.ok(e.observe().core>t);assert.equal(e.action('flip'),false);
});
test('Tissue water plus the areal film is invariant under mesh refinement',()=>{
 const masses=[12,24,48].map(nz=>new Engine({nz,nr:18}).initialWater);near(masses[0],masses[1],1e-12);near(masses[1],masses[2],1e-12);
});
test('Wet interior cannot exceed boiling until its local latent reservoir is exhausted',()=>{
 const e=new Engine({thickness:8,panInitial:260});e.action('add');e.action('power',8);e.step(180);e.action('flip');e.step(180);for(let i=0;i<e.T.length;i++)if(e.water[i]>1e-10)assert.ok(e.T[i]<=100+1e-8,'wet node '+i+' at '+e.T[i]);near(e.observe().energyResidual,0,1e-5);
});
test('Analytical insulated axial cosine mode converges when the mesh is refined',()=>{
 const errors=[];
 for(const nz of [12,24,48]){const e=new Engine({nz,nr:12,losses:false,evaporation:false,initial:20}),H=e.mesh.H;e.phase='resting';for(let i=0;i<e.T.length;i++)e.T[i]=70+10*Math.cos(Math.PI*e.mesh.nodes[i].z/H);e.initialEnergy=e.energy();e.step(120);
 const alpha=e.material.k/(e.material.rho*e.material.cp),decay=Math.exp(-alpha*(Math.PI/H)**2*120);let err=0,weight=0;
 for(let i=0;i<e.T.length;i++){const exact=70+10*Math.cos(Math.PI*e.mesh.nodes[i].z/H)*decay;err+=e.mesh.mass[i]*(e.T[i]-exact)**2;weight+=e.mesh.mass[i];}
 errors.push(Math.sqrt(err/weight));near(e.observe().energyResidual,0,2e-6);
 }
 assert.ok(errors[1]<errors[0]&&errors[2]<errors[1],JSON.stringify(errors));assert.ok(errors[2]<.025,JSON.stringify(errors));console.log('Analytical cosine RMS errors °C:',errors);
});
test('Extreme geometry and contact remain finite without temperature clamping',()=>{
 for(const c of [{thickness:8,diameter:8,aspect:.45,pan:'aluminum',contact:1.5,nz:48},{thickness:60,diameter:22,aspect:1,pan:'grill',contact:.5}]){const e=new Engine({...c,panInitial:300});e.action('oil',30);e.action('power',12);e.action('add');e.step(90);e.action('flip');e.step(90);assert.ok([...e.T].every(t=>Number.isFinite(t)&&t>=0&&t<500));near(e.observe().energyResidual,0,1e-5);}
});
test('Scheduler hits fractional, simultaneous and final events without time drift',()=>{
 const r=SteakRunner.run({},[{time:0,type:'power',value:12},{time:10.5,type:'oil',value:10},{time:10.5,type:'add'},{time:15.25,type:'flip'},{time:180,type:'rest'}],180);
 assert.equal(r.warnings.length,0);const placed=r.snapshots.find(p=>p.s.time===10.5);assert.ok(placed);assert.equal(placed.s.phase,'cooking');assert.equal(placed.s.oil,10);const flipped=r.snapshots.find(p=>p.s.time===15.25);assert.equal(flipped.s.bottomSide,1);assert.equal(r.snapshots.at(-1).s.time,180);assert.equal(r.snapshots.at(-1).s.phase,'resting');
});
test('Chunked fallback and worker scheduler produce identical results',()=>{
 const events=[{time:0,type:'power',value:12},{time:80,type:'add'},{time:100.3,type:'flip'},{time:160,type:'rest'}];const whole=SteakRunner.run({},events,180),job=SteakRunner.prepare({},events,180);for(let t=30;t<=180;t+=30)SteakRunner.advance(job,t);const chunked=SteakRunner.finish(job);assert.equal(chunked.snapshots.length,whole.snapshots.length);for(let i=0;i<whole.snapshots.length;i++)near(chunked.snapshots[i].s.core,whole.snapshots[i].s.core,1e-10);
});
test('Suggested plans for all four meats replay and reach their modeled core targets',()=>{
 for(const[meat,target]of[['beef',56],['pork',63],['chicken',75],['fish',63]]){
  const p=SteakRunner.suggest({meat},target),r=SteakRunner.run({meat},p.events,p.duration);assert.ok(p.reached,meat);assert.equal(r.warnings.length,0);const rest=r.snapshots.filter(s=>s.s.time>=p.removed),peak=Math.max(...rest.map(s=>s.s.core));near(peak,p.predicted.peak,.08,meat+' replay');assert.ok(peak>=target&&peak<target+2,meat+' target '+peak);assert.ok(p.placed>0&&p.removed>p.placed&&p.duration<=2700);
 }
});
test('Thicker cuts require a later removal time in suggested plans',()=>{
 const thin=SteakRunner.suggest({thickness:15},56),thick=SteakRunner.suggest({thickness:35},56);assert.ok(thick.removed-thick.placed>thin.removed-thin.placed);assert.ok(thick.restSeconds>thin.restSeconds);
});
test('Prospective-rest clones do not mutate the live physics state',()=>{
 const e=new Engine({panInitial:220});e.action('add');e.step(100);const before=Array.from(e.T),water=Array.from(e.water),copy=e.clone();copy.action('rest');copy.step(180);assert.deepEqual(Array.from(e.T),before);assert.deepEqual(Array.from(e.water),water);assert.equal(e.phase,'cooking');assert.equal(e.time,100);
});

test('Disabled timeline actions have no thermal or phase effect and can be restored',()=>{
 const baseline=[{time:0,type:'power',value:5},{time:10,type:'add'}];
 const optional=[{time:20,type:'oil',value:10},{time:25,type:'flip'},{time:30,type:'power',value:0},{time:40,type:'rest'}].map(e=>({...e,enabled:false}));
 const a=SteakRunner.run({},baseline,180),b=SteakRunner.run({},baseline.concat(optional),180);
 assert.deepEqual(b.snapshots,a.snapshots);assert.equal(b.warnings.length,0);
 const restored=SteakRunner.run({},baseline.concat(optional.map(e=>({...e,enabled:true}))),180).snapshots.at(-1).s;
 assert.equal(restored.phase,'resting');assert.equal(restored.bottomSide,1);assert.equal(restored.oil,10);assert.equal(restored.power,0);
});

test('Nonstick and hybrid presets use their own capacities and conserve coupled heat',()=>{
 for(const [pan,capacity] of [['nonstick',900],['hybrid',845]]){
  const e=new Engine({pan,panInitial:210});assert.equal(e.config.pan,pan);near(e.panCapacity,capacity,1e-10);
  assert.notEqual(e.panMaterial.emissivity,e.panMaterial.bottomEmissivity);
  e.action('oil',10);e.action('add');e.step(120);e.action('flip');e.step(120);
  near(e.observe().energyResidual,0,5e-6);assert.ok([...e.T].every(Number.isFinite));assert.ok(e.observe().core>5);
 }
});
