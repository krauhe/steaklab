const {test}=require('node:test');
const assert=require('node:assert/strict');
require('../src/physics.js');
const {Engine,sidePanViewFactor,panSideRadiation}=globalThis.SteakPhysics;
const SIGMA=5.670374419e-8;
const near=(a,b,tol=1e-10)=>assert.ok(Math.abs(a-b)<=tol,`${a} vs ${b}`);
const exchange=(e,ep=e.panMaterial.emissivity,em=.95)=>panSideRadiation(e.mesh,e.panRadiationGeometry,e.bottomSide,e.T,e.pan,e.config.ambient,ep,em);

test('Pan view factors have the half-plane limit and agree with direct area integration',()=>{
 near(sidePanViewFactor(.06,0),.5);near(sidePanViewFactor(.06,1e-8),.5,2e-5);
 // Independent Cartesian quadrature over the visible portion of the pan disk.
 const R=.06,z=.025,Rp=.14,nx=240,ny=320,dx=(Rp-R)/nx;let areaIntegral=0;
 for(let x=0;x<nx;x++){const X=R+(x+.5)*dx,v=Math.sqrt(Rp*Rp-X*X),dy=2*v/ny;
  for(let y=0;y<ny;y++){const Y=-v+(y+.5)*dy,d2=(X-R)**2+Y*Y+z*z;areaIntegral+=z*(X-R)/(Math.PI*d2*d2)*dx*dy;}}
 near(sidePanViewFactor(R,z),areaIntegral,2e-5);
 for(const r of [.035,.06,.11]){let previous=.5;for(const h of [.001,.01,.03,.06,.15]){const f=sidePanViewFactor(r,h);assert.ok(f>0&&f<previous);previous=f;near(f,sidePanViewFactor(r,h,.14,512),2e-5);}}
 assert.throws(()=>sidePanViewFactor(.15,.02));
});

test('Integrated view factors respect reciprocal areas and reverse with the physical pose',()=>{
 for(const thickness of [8,25,60])for(const diameter of [8,14,22])for(const aspect of [.45,.78,1]){
  const e=new Engine({thickness,diameter,aspect}),g=e.panRadiationGeometry,m=e.mesh;
  for(const pose of g.view){const area=pose.reduce((sum,f,j)=>sum+f*m.side[j].area,0);assert.ok(area>0&&area<g.exposed);assert.ok([...pose].every(f=>f>0&&f<.5));}
  for(let j=0;j<g.view[0].length;j++)near(g.view[0][j],g.view[1][g.view[1].length-1-j]);
 }
 const totals=[12,24,48].map(nz=>{const e=new Engine({nz});return e.panRadiationGeometry.view[0].reduce((s,f,j)=>s+f*e.mesh.side[j].area,0);});
 near(totals[0],totals[2],2e-10);near(totals[1],totals[2],2e-10);
});

test('Grey-diffuse exchange is in equilibrium at room temperature and closes its energy ledger',()=>{
 const e=new Engine({initial:22,panInitial:22});
 for(const ep of [.35,.75,1]){const q=exchange(e,ep);near(q.pairHeat,0);near(q.roomLoss,0);for(const f of q.sideFlux)near(f,0);}
 e.pan=200;e.T.forEach((_,i)=>e.T[i]=30+80*e.mesh.nodes[i].z/e.mesh.H);
 for(const ep of [.35,.75,1])for(const em of [.3,.95,1]){const q=exchange(e,ep,em);near(q.sideFlux.reduce((a,b)=>a+b,0)+q.panFlux+q.roomLoss,0,1e-12);assert.ok(q.pairHeat>0);}
});

test('Black surfaces match Stefan–Boltzmann exchange and transfer reverses for a cooler pan',()=>{
 const e=new Engine({initial:22,panInitial:200}),q=exchange(e,1,1),g=e.panRadiationGeometry;
 let expected=0;for(let j=0;j<e.mesh.side.length;j++){const value=e.mesh.side[j].area*g.view[0][j]*SIGMA*((200+273.15)**4-(22+273.15)**4);near(q.sideFlux[j],value);expected+=value;}
 near(q.pairHeat,expected);near(q.sideRoom,0);
 e.pan=22;e.T.fill(100);assert.ok(exchange(e).pairHeat<0);
});

test('Pan radiation warms the side through the solver while conserving total energy',()=>{
 const on=new Engine({panInitial:220,evaporation:false});on.action('oil',10);on.action('add');
 const off=on.clone();off.config={...off.config,panRadiation:false};on.step(120);off.step(120);
 const middle=on.mesh.side[on.mesh.nz/2].i;
 assert.ok(on.T[middle]>off.T[middle]+.5,`${on.T[middle]} vs ${off.T[middle]}`);
 near(on.observe().energyResidual,0,3e-6);near(off.observe().energyResidual,0,3e-6);
 assert.ok([...on.T].every(t=>t>=5&&t<=220));
});

test('Moving to a rack stops pan coupling; resting on the pan retains it',()=>{
 const hot=new Engine({panInitial:220,evaporation:false});hot.action('add');hot.step(100);
 for(const mode of ['air','foil']){const a=hot.clone(),b=hot.clone();b.config={...b.config,panRadiation:false};a.action('rest',mode);b.action('rest',mode);a.step(60);b.step(60);assert.deepEqual(a.T,b.T);near(a.pan,b.pan);}
 const a=hot.clone(),b=hot.clone();b.config={...b.config,panRadiation:false};a.action('rest','pan');b.action('rest','pan');a.step(60);b.step(60);
 assert.ok(a.T[a.mesh.side[a.mesh.nz/2].i]>b.T[b.mesh.side[b.mesh.nz/2].i]);near(a.observe().energyResidual,0,3e-6);
});
