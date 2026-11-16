const {test}=require('node:test');const assert=require('node:assert/strict');
require('../src/physics.js');require('../src/runner.js');
const {Engine,buildMesh,buildPanRadiation,panSideRadiation,shapeRadius,MATERIALS,DEFAULTS}=SteakPhysics;
const near=(a,b,tol=1e-8)=>assert.ok(Math.abs(a-b)<=tol,`${a} vs ${b}`);
const sum=a=>a.reduce((s,x)=>s+x,0);

test('Rounded meridian has narrower flat caps, widest equator and consistent integrated areas',()=>{
 const c={...DEFAULTS,meat:'minced',roundness:1,nr:12,nz:16},m=buildMesh(c,MATERIALS.minced);
 near(shapeRadius(0,1),.7);near(shapeRadius(.5,1),1);near(shapeRadius(1,1),.7);
 near(m.nodes[m.nr].r,m.R*.7);near(m.nodes[(m.nz/2)*(m.nr+1)+m.nr].r,m.R);
 near(m.area,m.maxArea*.49);near(sum(m.faceA.map(n=>n.area)),m.area);
 near(sum(m.boundaryArea),2*m.area+sum(m.side.map(n=>n.area)));
 const cylinder=buildMesh({...c,roundness:0},MATERIALS.minced);near(cylinder.area,cylinder.maxArea);
 assert.ok(m.side.some((n,j)=>Math.abs(n.area-cylinder.side[j].area)>1e-8));
 assert.deepEqual(m.triangles,cylinder.triangles);
});

test('Curved deformation preserves sensible energy and oil while reducing contact to actual cap',()=>{
 const e=new Engine({meat:'minced',nr:8,nz:12});e.action('oil',10);e.action('add');
 for(let i=0;i<e.T.length;i++)e.T[i]=20+30*i/e.T.length;
 const heat=e.energy(),capacity=Array.from(e.panMesh.capacities),before=e.mesh.area,T=Array.from(e.T);
 e.updateGeometry(1);near(e.energy(),heat);assert.deepEqual(Array.from(e.T),T);assert.deepEqual(Array.from(e.panMesh.capacities),capacity);
 near(e.mesh.area,before*.64*.49);near(sum(e.panMesh.contactArea),e.mesh.area);near(e.panContactTemp,22);
 assert.equal(e.observe().roundness,1);near(e.observe().contactDiameter,2*e.mesh.contactRadius*100);
 const copy=e.clone();copy.mesh.nodes[0].z=9;assert.notEqual(e.mesh.nodes[0].z,9);
});

test('Curved side radiation respects pose symmetry, reciprocity, equilibrium and energy balance',()=>{
 for(const roundness of [.2,1]){const m=buildMesh({...DEFAULTS,meat:'minced',roundness,nr:8,nz:12},MATERIALS.minced),g=buildPanRadiation(m);
 near(g.exposed,Math.PI*.14**2-m.area);
 for(let i=0;i<g.view[0].length;i++){assert.ok(g.view[0][i]>=0&&g.view[0][i]<=1);near(g.view[0][i],g.view[1].at(-1-i),1e-12);}
 assert.ok(g.view[0][0]>g.view[0].at(-1));assert.ok(sum(g.view[0].map((v,i)=>v*m.side[i].area))<g.exposed);
 const T=new Float64Array(m.nodes.length).fill(22),eq=panSideRadiation(m,g,0,T,22,22,.75);near(eq.roomLoss,0,1e-10);near(eq.panFlux,0,1e-10);
 T.fill(70);const hot=panSideRadiation(m,g,0,T,200,22,.75);near(sum(hot.sideFlux)+hot.panFlux+hot.roomLoss,0,1e-10);
 }
});

test('Rounded closed heating remains finite, conserves heat and survives flips on extreme meshes',()=>{
 for(const shape of [{thickness:8,diameter:22},{thickness:60,diameter:8}]){
 const e=new Engine({...shape,meat:'minced',nr:8,nz:12,panInitial:220,losses:false,evaporation:false});e.action('add');e.updateGeometry(1);const energy=e.energy();
 for(let i=0;i<6;i++){e.step(20);e.action('flip');}
 near(e.energy(),energy,1e-6);assert.ok(e.T.every(t=>Number.isFinite(t)&&t>=4.9&&t<=220.1));assert.ok(e.panT.every(t=>Number.isFinite(t)&&t>=4.9&&t<=220.1));
 }
});

// Independent steady manufactured Poisson solution T=r²+z². Axisymmetry gives
// div(grad T)=6. Dirichlet values are imposed on caps/curved side, natural zero
// radial flux on the axis. Solve the assembled interior SPD system by CG.
function manufacturedError(n){
 const m=buildMesh({...DEFAULTS,meat:'minced',roundness:1,nr:n,nz:2*n},MATERIALS.minced),N=m.nodes.length;
 const boundary=m.nodes.map((p,i)=>{const row=Math.floor(i/(m.nr+1)),col=i%(m.nr+1);return row===0||row===m.nz||col===m.nr;});
 const exact=Float64Array.from(m.nodes,p=>p.r*p.r+p.z*p.z),b=Float64Array.from(m.mass,v=>-6*MATERIALS.minced.k*v/(MATERIALS.minced.rho*MATERIALS.minced.cp));
 for(const [i,j,g]of m.edges){if(!boundary[i]&&boundary[j])b[i]+=g*exact[j];if(!boundary[j]&&boundary[i])b[j]+=g*exact[i];}
 for(let i=0;i<N;i++)if(boundary[i])b[i]=0;
 const A=v=>{const out=new Float64Array(N);for(const[i,j,g]of m.edges){if(!boundary[i])out[i]+=g*(v[i]-(boundary[j]?0:v[j]));if(!boundary[j])out[j]+=g*(v[j]-(boundary[i]?0:v[i]));}return out;};
 const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),x=new Float64Array(N),r=Float64Array.from(b),p=Float64Array.from(r);let rr=dot(r,r);
 for(let it=0;it<N*3&&rr>1e-30;it++){const ap=A(p),alpha=rr/dot(p,ap);for(let i=0;i<N;i++){x[i]+=alpha*p[i];r[i]-=alpha*ap[i];}const next=dot(r,r),beta=next/rr;for(let i=0;i<N;i++)p[i]=r[i]+beta*p[i];rr=next;}
 let error=0,volume=0;for(let i=0;i<N;i++)if(!boundary[i]){error+=m.mass[i]*(x[i]-exact[i])**2;volume+=m.mass[i];}
 return Math.sqrt(error/volume);
}
test('Signed curved FEM assembly converges for a nonconstant manufactured Poisson field',()=>{
 const coarse=manufacturedError(6),medium=manufacturedError(12),fine=manufacturedError(24);
 assert.ok(medium<coarse*.65,`${coarse}, ${medium}, ${fine}`);assert.ok(fine<medium*.65,`${coarse}, ${medium}, ${fine}`);
});

test('Smooth interior heat update retains the signed FEM flux when no bound is threatened',()=>{
 const e=new Engine({meat:'minced',nr:12,nz:24,losses:false,evaporation:false});e.action('add');e.action('rest');e.updateGeometry(1);
 for(let i=0;i<e.T.length;i++){const p=e.mesh.nodes[i];e.T[i]=50+10*p.r+5*p.z;}
 const before=Float64Array.from(e.T),flux=new Float64Array(e.T.length),dt=1e-5;
 for(const [i,j,g] of e.mesh.edges){const q=g*(before[j]-before[i]);flux[i]+=q;flux[j]-=q;}
 e.substep(dt);
 for(let j=2;j<e.mesh.nz-1;j++)for(let i=2;i<e.mesh.nr-1;i++){const n=j*(e.mesh.nr+1)+i;near(e.T[n],before[n]+dt*flux[n]/e.mesh.mass[n],1e-12);}
});
