const {test}=require('node:test');
const assert=require('node:assert/strict');
require('../src/physics.js');require('../src/display.js');
const {buildMesh,MATERIALS,DEFAULTS,shapeRadius}=SteakPhysics;
test('Curved display interpolation reproduces an affine physical temperature field',()=>{
 for(const q of [0,.37,1]){
  const m=buildMesh({...DEFAULTS,nr:8,nz:12,roundness:q},MATERIALS.minced),T=Float64Array.from(m.nodes,n=>13+320*n.r+170*n.z);
  for(let j=0;j<=30;j++)for(let i=0;i<=30;i++){
   const u=i/30,v=j/30,row=Math.min(m.nz-1,Math.floor(v*m.nz)),f=v*m.nz-row,radius=shapeRadius(row/m.nz,q)*(1-f)+shapeRadius((row+1)/m.nz,q)*f;
   const expected=13+320*u*m.R*radius+170*v*m.H;
   assert.ok(Math.abs(SteakDisplay.sampleDeformedField(m,T,u,v,q,shapeRadius)-expected)<1e-10);
  }
 }
});
test('Curved display sampling preserves material node values and constant fields',()=>{
 const q=.8,m=buildMesh({...DEFAULTS,nr:8,nz:12,roundness:q},MATERIALS.minced),T=Float64Array.from(m.nodes,(_,i)=>Math.sin(i)*30+50);
 for(let j=0;j<=m.nz;j++)for(let i=0;i<=m.nr;i++)assert.ok(Math.abs(SteakDisplay.sampleDeformedField(m,T,i/m.nr,j/m.nz,q,shapeRadius)-T[j*(m.nr+1)+i])<1e-10);
 T.fill(57);assert.ok(Math.abs(SteakDisplay.sampleDeformedField(m,T,.37,.68,q,shapeRadius)-57)<1e-10);
});
