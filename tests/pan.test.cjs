const {test}=require('node:test');
const assert=require('node:assert/strict');
require('../src/physics.js');
const {Engine,PANS}=globalThis.SteakPhysics;
const near=(a,b,tol=1e-10)=>assert.ok(Math.abs(a-b)<=tol,`${a} vs ${b}, tolerance ${tol}`);

test('Pan shell preserves preset mass/capacity and conservative contact/burner areas',()=>{
 for(const pan of Object.keys(PANS)){
  const e=new Engine({pan,diameter:22,aspect:.45}),p=e.panMesh;
  near(p.masses.reduce((s,x)=>s+x,0),PANS[pan].mass);
  near(p.capacities.reduce((s,x)=>s+x,0),PANS[pan].mass*PANS[pan].cp);
  near(p.thickness*p.shellArea*PANS[pan].rho,PANS[pan].mass);
  near(p.nodes.slice(0,p.bottomCount).reduce((s,n)=>s+n.area,0),Math.PI*.14**2);
  near(p.contactArea.reduce((s,x)=>s+x,0),e.mesh.area);
  for(let r=0;r<e.mesh.faceA.length;r++)near(p.contact.filter(x=>x[0]===r).reduce((s,x)=>s+x[2],0),e.mesh.faceA[r].area,1e-14);
  near(p.burnerWeights.reduce((s,x)=>s+x,0),1);
  assert.equal(p.edges.length,p.nodes.length-1);assert.ok(p.edges.every(([i,j,g])=>j===i+1&&g>0));
  assert.ok(p.capacities.every(x=>x>0));assert.ok(p.nodes.slice(p.bottomCount).every(n=>n.z>0&&n.z<.02&&n.r>.14&&n.r<.154));
  assert.ok(p.burnerWeights.slice(p.bottomCount).every(x=>x===0));assert.ok(p.contactArea.slice(p.bottomCount).every(x=>x===0));
  assert.ok(p.contactArea.every((a,i)=>a<=p.nodes[i].area+1e-14));
 }
});

test('Closed shell conduction and ambient oil mixing conserve energy and temperature bounds',()=>{
 const e=new Engine({losses:false,evaporation:false});
 for(let i=0;i<e.panT.length;i++)e.panT[i]=230-190*i/(e.panT.length-1);
 e.initialEnergy=e.energy();const energy=e.energy(),wall=Array.from(e.panT.slice(e.panMesh.bottomCount)),capacity=e.panCapacity;
 e.action('oil',20);near(e.energy(),energy,1e-8);near(e.panCapacity,capacity+40);
 near(e.panMesh.capacities.reduce((s,x)=>s+x,0),e.panCapacity);
 assert.deepEqual(Array.from(e.panT.slice(e.panMesh.bottomCount)),wall);
 e.step(90);near(e.observe().energyResidual,0,1e-6);
 assert.ok(e.panT.every(x=>x>=22&&x<=230));
 e.pan=123;assert.ok(e.panT.every(x=>x===123));near(e.pan,123);near(e.panContactTemp,123);
});

test('Local burner heats the bottom center before the wall without direct wall power',()=>{
 const e=new Engine({losses:false,evaporation:false});e.action('power',12);e.step(30);
 const s=e.observe(),lastBottom=e.panMesh.bottomCount-1;
 assert.ok(e.panT[0]>e.panT[lastBottom]+30);assert.ok(e.panT[lastBottom]>s.panRim);
 assert.ok(s.panRim>e.config.ambient);assert.ok(s.panMax>s.pan&&s.pan>s.panMin);
 near(s.panRim,e.panT.at(-1));near(s.energyResidual,0,1e-6);
 const expected=e.panT.reduce((sum,t,i)=>sum+t*e.panMesh.capacities[i],0)/e.panCapacity;near(e.pan,expected);
});

test('A cold ingredient locally cools its footprint while the outer floor and wall retain heat',()=>{
 const e=new Engine({panInitial:220,losses:false,evaporation:false});e.action('add');e.step(30);
 const outer=e.panT[e.panMesh.bottomCount-1];
 assert.ok(e.panT[0]<outer-30);assert.ok(e.panContactTemp<e.pan);assert.ok(e.panT.at(-1)>e.panT[0]+30);
 assert.ok(e.panT.every(x=>x>=5&&x<=220));assert.ok(e.T.every(x=>x>=5&&x<=220));near(e.observe().energyResidual,0,1e-6);
});

test('Pan clones and observed fields do not share mutable temperature/capacity state',()=>{
 const e=new Engine({panInitial:210});e.action('power',4);e.step(20);
 const before=e.observe(),capacity=Array.from(e.panMesh.capacities),copy=e.clone();
 assert.notEqual(copy.panT,e.panT);assert.notEqual(copy.panMesh.capacities,e.panMesh.capacities);assert.notEqual(copy.panMesh.nodes[0],e.panMesh.nodes[0]);
 copy.action('oil',10);copy.step(15);copy.panMesh.nodes[0].r+=.001;
 assert.deepEqual(e.observe(),before);assert.deepEqual(Array.from(e.panMesh.capacities),capacity);
 before.panField[0]=-999;assert.notEqual(e.panT[0],-999);assert.notEqual(e.observe().panField[0],-999);
});

test('Shared irradiation retains local T^4 emission and does not drain cold exposed rings',()=>{
 const e=new Engine({initial:22,panInitial:22,evaporation:false});
 // Isolate radiation from tangential conduction; all meat and room start equal.
 e.panMesh.edges=[];e.panMesh.diag.fill(0);e.panT[13]=350;e.action('add');e.initialEnergy=e.energy();e.step(.5);
 assert.ok(e.panT[10]>=22);assert.ok(e.panT[13]<350);near(e.observe().energyResidual,0,1e-6);
});

test('Bottom and wall temperatures converge under shell refinement',()=>{
 const fields=[];
 for(const [panNr,panNw] of [[14,4],[28,8],[56,16]]){
  const e=new Engine({pan:'aluminum',panNr,panNw,nr:6,nz:8,losses:false,evaporation:false});e.action('power',8);e.step(45);
  const at=(r,z=0)=>{
   const nodes=e.panMesh.nodes;let best=Infinity,value=0;
   for(let i=0;i<nodes.length-1;i++){const a=nodes[i],b=nodes[i+1],dr=b.r-a.r,dz=b.z-a.z,u=Math.max(0,Math.min(1,((r-a.r)*dr+(z-a.z)*dz)/(dr*dr+dz*dz))),distance=(r-a.r-u*dr)**2+(z-a.z-u*dz)**2;if(distance<best){best=distance;value=e.panT[i]*(1-u)+e.panT[i+1]*u;}}
   return value;
  };
  fields.push([at(.02),at(.06),at(.1),at(.13),at(.1505,.015)]);near(e.observe().energyResidual,0,1e-6);
 }
 const rms=(a,b)=>Math.sqrt(a.reduce((s,x,i)=>s+(x-b[i])**2,0)/a.length),coarse=rms(fields[0],fields[1]),fine=rms(fields[1],fields[2]);
 assert.ok(fine<coarse*.5,`${coarse} then ${fine}`);assert.ok(fine<.1);
});

test('All pan presets remain finite with refined shell, maximum contact, oil and thin meat',()=>{
 for(const pan of Object.keys(PANS)){
  const e=new Engine({pan,panInitial:300,panNr:28,panNw:8,thickness:8,diameter:22,aspect:1,contact:1.5,nr:6,nz:8});
  e.action('oil',30);e.action('power',12);e.action('add');e.step(60);e.action('flip');e.step(60);
  assert.ok(e.panT.every(t=>Number.isFinite(t)&&t>=0));assert.ok(e.T.every(t=>Number.isFinite(t)&&t>=0));near(e.observe().energyResidual,0,1e-5);
 }
});
