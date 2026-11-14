/* SteakLab physics v1. SI units internally. Pure model; no DOM or drawing.
   P1 triangular Galerkin FEM, exact axisymmetric row-sum mass lumping,
   conservative edge fluxes and adaptive explicit Euler. Pan is lumped.
   Material values are illustrative constant-property approximations.
   Local enthalpy reservoirs and browning are heuristic, not validated.
*/
(() => {
'use strict';
const PI=Math.PI, SIGMA=5.670374419e-8, LATENT=2.26e6;
const MATERIALS={
 beef:{label:'Beef',k:.45,rho:1050,cp:3500,water:.65},
 pork:{label:'Pork',k:.46,rho:1040,cp:3500,water:.65},
 chicken:{label:'Chicken',k:.48,rho:1050,cp:3550,water:.7},
 fish:{label:'Fish',k:.5,rho:1040,cp:3600,water:.72}
};
// Generic engineering presets, not measurements of a particular commercial pan.
const PANS={iron:{label:'Cast iron',mass:2,cp:460,emissivity:.75},steel:{label:'Stainless steel',mass:1.2,cp:500,emissivity:.35},aluminum:{label:'Aluminum',mass:.8,cp:900,emissivity:.35},nonstick:{label:'Nonstick aluminum',mass:1,cp:900,emissivity:.85,bottomEmissivity:.35},hybrid:{label:'Hybrid steel / aluminum',mass:1.3,cp:650,emissivity:.65,bottomEmissivity:.35},grill:{label:'Grill pan',mass:2.4,cp:460,emissivity:.8}};
// Loose foil is represented only by reduced effective heat loss to the room.
// No foil heat capacity, condensation, moisture trapping or seal is resolved.
const REST_MODES={air:{convection:1,radiation:1},foil:{convection:.4,radiation:.5},pan:{convection:1,radiation:1}};
const DEFAULTS={meat:'beef',thickness:25,diameter:14,aspect:.78,initial:5,pan:'iron',wetness:.5,contact:1,nr:18,nz:24,ambient:22,panInitial:22,losses:true,evaporation:true,panRadiation:true};
const clamp=(v,lo,hi)=>Math.min(hi,Math.max(lo,v));
function number(v,fallback,lo,hi){return Number.isFinite(+v)?clamp(+v,lo,hi):fallback;}
function normalized(input){const c={...DEFAULTS,...input};for(const [key,lo,hi] of [['thickness',8,60],['diameter',8,22],['aspect',.45,1],['initial',0,30],['wetness',0,1],['contact',.5,1.5],['ambient',0,40],['panInitial',0,400],['nr',6,48],['nz',8,64]])c[key]=number(c[key],DEFAULTS[key],lo,hi);c.nr=2*Math.round(c.nr/2);c.nz=2*Math.round(c.nz/2);if(!MATERIALS[c.meat])c.meat='beef';if(!PANS[c.pan])c.pan='iron';return c;}
function buildMesh(c,material){
 const nr=c.nr,nz=c.nz,a=c.diameter/200,b=a*c.aspect,R=Math.sqrt(a*b),H=c.thickness/1000;
 const perimeter=PI*(3*(a+b)-Math.sqrt((3*a+b)*(a+3*b)));
 const nodes=[],triangles=[],mass=new Float64Array((nr+1)*(nz+1)),diag=new Float64Array(mass.length),graph=new Map();
 const id=(i,j)=>j*(nr+1)+i;
 for(let j=0;j<=nz;j++)for(let i=0;i<=nr;i++)nodes.push({r:R*i/nr,z:H*j/nz});
 function tri(ids){
  triangles.push(ids);const [p,q,s]=ids.map(i=>nodes[i]);
  const determinant=(q.r-p.r)*(s.z-p.z)-(s.r-p.r)*(q.z-p.z),A=Math.abs(determinant)/2;
  const rr=[p.r,q.r,s.r],rs=rr[0]+rr[1]+rr[2];
  const grad=[[q.z-s.z,s.r-q.r],[s.z-p.z,p.r-s.r],[p.z-q.z,q.r-p.r]].map(g=>g.map(v=>v/determinant));
  for(let x=0;x<3;x++)mass[ids[x]]+=material.rho*material.cp*2*PI*A*(rs+rr[x])/12;
  for(let x=0;x<3;x++)for(let y=x+1;y<3;y++){
   const conductance=-material.k*2*PI*A*rs/3*(grad[x][0]*grad[y][0]+grad[x][1]*grad[y][1]);
   if(conductance < -1e-10)throw new Error('Mesh violates monotone conduction assumption.');
   if(conductance<=1e-16)continue;
   const i=Math.min(ids[x],ids[y]),j=Math.max(ids[x],ids[y]),key=i*mass.length+j;
   graph.set(key,(graph.get(key)||0)+conductance);
  }
 }
 for(let j=0;j<nz;j++)for(let i=0;i<nr;i++){tri([id(i,j),id(i+1,j),id(i+1,j+1)]);tri([id(i,j),id(i+1,j+1),id(i,j+1)]);}
 const edges=[];for(const [key,g]of graph){const i=Math.floor(key/mass.length),j=key%mass.length;edges.push([i,j,g]);diag[i]+=g;diag[j]+=g;}
 const radialArea=new Float64Array(nr+1),dr=R/nr;
 for(let i=0;i<nr;i++){const r=i*dr,s=(i+1)*dr;radialArea[i]+=2*PI*dr*(2*r+s)/6;radialArea[i+1]+=2*PI*dr*(r+2*s)/6;}
 const faceA=[],faceB=[],side=[],boundaryArea=new Float64Array(mass.length);
 for(let i=0;i<=nr;i++){faceA.push({i:id(i,0),area:radialArea[i]});faceB.push({i:id(i,nz),area:radialArea[i]});boundaryArea[id(i,0)]+=radialArea[i];boundaryArea[id(i,nz)]+=radialArea[i];}
 for(let j=0;j<=nz;j++){const area=perimeter*H/nz*(j===0||j===nz?.5:1);side.push({i:id(nr,j),area});boundaryArea[id(nr,j)]+=area;}
 return{nr,nz,R,H,nodes,triangles,mass,diag,edges,faceA,faceB,side,boundaryArea,area:PI*R*R,perimeter};
}
// Differential view factor from an outward-facing cylinder side to a flat disk.
// Integrating radial distance analytically leaves a smooth azimuth integral.
// R is the existing equal-area radius; pan walls and ellipse-specific rays are
// not resolved. At the lower edge, the visible pan fills half the hemisphere.
function sidePanViewFactor(R,z,panRadius=.14,samples=64){
 if(R<0||R>=panRadius||z<0)throw new Error('Invalid pan radiation geometry.');
 if(z===0)return .5;
 let sum=0;const dphi=PI/(2*samples);
 for(let k=0;k<samples;k++){const phi=(k+.5)*dphi,co=Math.cos(phi),si=Math.sin(phi),L=-R*co+Math.sqrt(panRadius*panRadius-R*R*si*si);sum+=co*(Math.atan2(L,z)-z*L/(L*L+z*z));}
 return clamp(sum*dphi/PI,0,.5);
}
function buildPanRadiation(mesh,panRadius=.14){
 const view=[new Float64Array(mesh.side.length),new Float64Array(mesh.side.length)],offset=1/(2*Math.sqrt(3));
 // Integrate the view factor with linear boundary shape functions, rather than
 // assigning a point value at the zero-height corner. Precompute both poses.
 for(let j=0;j<mesh.side.length-1;j++){
  const z0=mesh.nodes[mesh.side[j].i].z,z1=mesh.nodes[mesh.side[j+1].i].z,dz=z1-z0;
  for(const u of [.5-offset,.5+offset])for(let bottom=0;bottom<2;bottom++){
   const z=z0+u*dz,f=sidePanViewFactor(mesh.R,bottom?mesh.H-z:z,panRadius),weight=mesh.perimeter*dz*.5*f;
   view[bottom][j]+=weight*(1-u);view[bottom][j+1]+=weight*u;
  }
 }
 const exposed=PI*panRadius*panRadius-mesh.area;
 for(const pose of view){let seen=0;for(let j=0;j<pose.length;j++){seen+=pose[j];pose[j]/=mesh.side[j].area;}if(seen>=exposed)throw new Error('Pan-side view factors exceed exposed pan area.');}
 return{view,exposed};
}
// One grey-diffuse pan radiosity coupled to all side rings and a black room.
// Reciprocal exchange areas ensure that pan/meat exchange cancels exactly.
// The scalar solve includes multiple diffuse reflections; room-facing areas
// exclude the pan-facing fractions, avoiding double-counted ambient radiation.
function panSideRadiation(mesh,geometry,bottomSide,T,pan,ambient,panEmissivity,meatEmissivity=.95){
 const view=geometry.view[bottomSide],Ap=geometry.exposed,Ea=SIGMA*(ambient+273.15)**4,Ep=SIGMA*(pan+273.15)**4;
 let seen=0,weightedBase=0,reflections=0;
 const sideFlux=new Float64Array(view.length),base=new Float64Array(view.length);
 for(let j=0;j<view.length;j++){
  const f=view[j],area=mesh.side[j].area,exchange=area*f,Ei=SIGMA*(T[mesh.side[j].i]+273.15)**4;
  base[j]=meatEmissivity*Ei+(1-meatEmissivity)*(1-f)*Ea;
  seen+=exchange;weightedBase+=exchange*base[j];reflections+=exchange*(1-meatEmissivity)*f;
 }
 const Jp=(panEmissivity*Ep+(1-panEmissivity)*((1-seen/Ap)*Ea+weightedBase/Ap))/(1-(1-panEmissivity)*reflections/Ap);
 const panRoom=(Ap-seen)*(Jp-Ea);let pairHeat=0,sideRoom=0;
 for(let j=0;j<view.length;j++){
  const f=view[j],area=mesh.side[j].area,Ji=base[j]+(1-meatEmissivity)*f*Jp,q=area*f*(Jp-Ji),room=area*(1-f)*(Ji-Ea);
  sideFlux[j]=q-room;pairHeat+=q;sideRoom+=room;
 }
 return{sideFlux,pairHeat,panFlux:-pairHeat-panRoom,roomLoss:sideRoom+panRoom,panRoom,sideRoom};
}
class Engine{
 constructor(input={}){
  this.config=normalized(input);this.material=MATERIALS[this.config.meat];this.panMaterial=PANS[this.config.pan];this.mesh=buildMesh(this.config,this.material);
  const n=this.mesh.nodes.length;this.T=new Float64Array(n).fill(this.config.initial);this.flux=new Float64Array(n);this.water=new Float64Array(n);
  this.doses=[new Float64Array(this.mesh.nr+1),new Float64Array(this.mesh.nr+1)];
  this.time=0;this.pan=this.config.panInitial;this.panCapacity=this.panMaterial.mass*this.panMaterial.cp;this.power=0;this.actualWatts=0;this.oil=0;this.bottomSide=0;this.phase='ready';this.restMode=null;this.evaporated=0;
  this.energyInput=0;this.energyLost=0;this.panArea=PI*.14*.14;
  this.panRadiationGeometry=buildPanRadiation(this.mesh);
  // Distributed tissue water plus a mesh-independent superficial film. Vapor
  // is assumed to escape immediately; no pressure/diffusion/shrinkage solve.
  // Keeping heat capacities fixed makes the simplified energy budget explicit.
  for(let i=0;i<n;i++)this.water[i]=this.mesh.mass[i]/this.material.cp*this.material.water+this.mesh.boundaryArea[i]*.12*this.config.wetness;
  this.initialWater=this.water.reduce((a,b)=>a+b,0);this.initialEnergy=this.energy();
  this.edgeI=Int32Array.from(this.mesh.edges,e=>e[0]);this.edgeJ=Int32Array.from(this.mesh.edges,e=>e[1]);this.edgeG=Float64Array.from(this.mesh.edges,e=>e[2]);
 }
 energy(){let result=this.panCapacity*(this.pan-this.config.ambient);for(let i=0;i<this.T.length;i++)result+=this.mesh.mass[i]*(this.T[i]-this.config.ambient);return result;}
 clone(){const copy=Object.assign(Object.create(Engine.prototype),this);copy.T=Float64Array.from(this.T);copy.flux=new Float64Array(this.T.length);copy.water=Float64Array.from(this.water);copy.doses=this.doses.map(d=>Float64Array.from(d));return copy;}
 hasPanContact(){return this.phase==='cooking'||this.phase==='resting'&&this.restMode==='pan';}
 action(type,value){
  if(type==='power'){this.power=number(value,0,0,12);return true;}
  if(type==='oil'){const grams=Math.min(30-this.oil,number(value,10,0,30));const cp=grams/1000*2000;this.pan=(this.pan*this.panCapacity+this.config.ambient*cp)/(this.panCapacity+cp);this.panCapacity+=cp;this.oil+=grams;return grams>0;}
  if(type==='add'&&this.phase==='ready'){this.phase='cooking';return true;}
  if(type==='flip'&&this.hasPanContact()){this.bottomSide=1-this.bottomSide;return true;}
  if(type==='rest'&&this.hasPanContact()){
   const mode=value===undefined?'air':value;
   if(!Object.hasOwn(REST_MODES,mode)||this.phase==='resting'&&this.restMode===mode)return false;
   this.phase='resting';this.restMode=mode;this.restAt=this.time;this.restCore=this.T[(this.mesh.nz/2)*(this.mesh.nr+1)];
   // Switching off sets the target only; the existing 3-second hob lag remains.
   if(mode==='pan')this.power=0;
   return true;
  }
  return false;
 }
 contactH(){return(250+350*(1-Math.exp(-this.oil/4)))*this.config.contact*(this.config.pan==='grill'?.45:1);}
 stabilityStep(){
  let step=.2,maxT=Math.max(this.pan,this.config.ambient);for(const t of this.T)if(t>maxT)maxT=t;
  const radiative=this.config.losses?4*.96*SIGMA*Math.pow(Math.max(273.15,maxT+273.15),3):0;
  const h=Math.max(this.contactH(),this.config.losses?12+radiative:0);
  for(let i=0;i<this.T.length;i++){const d=this.mesh.diag[i]+this.mesh.boundaryArea[i]*h;if(d>0)step=Math.min(step,.78*this.mesh.mass[i]/d);}
  const pd=this.contactH()*this.mesh.area+(this.config.losses?(18+2*radiative)*this.panArea:0);
  if(pd>0)step=Math.min(step,.78*this.panCapacity/pd);
  return step;
 }
 step(seconds){
  if(!Number.isFinite(seconds)||seconds<0)throw new Error('Time increment must be finite and nonnegative.');
  const end=this.time+seconds;
  while(this.time<end-1e-10){const dt=Math.min(end-this.time,this.stabilityStep());this.substep(dt);this.time+=dt;}
  this.time=end;return this;
 }
 substep(dt){
  const c=this.config,m=this.mesh,T=this.T,F=this.flux,ambient=c.ambient,panContact=this.hasPanContact(),coupledRadiation=c.losses&&c.panRadiation&&panContact;F.fill(0);
  const wanted=1800*this.power/12,decay=Math.exp(-dt/3),burnerEnergy=wanted*dt+(this.actualWatts-wanted)*3*(1-decay);
  this.actualWatts=wanted+(this.actualWatts-wanted)*decay;this.energyInput+=burnerEnergy;
  let panFlux=0,lost=0;
  const airFlux=(t,h,epsilon)=>h*(t-ambient)+epsilon*SIGMA*(Math.pow(t+273.15,4)-Math.pow(ambient+273.15,4));
  if(c.losses){const exposed=this.panArea-(panContact?m.area:0);const q=airFlux(this.pan,10,coupledRadiation?0:this.panMaterial.emissivity)*exposed+airFlux(this.pan,8,this.panMaterial.bottomEmissivity??this.panMaterial.emissivity)*this.panArea;panFlux-=q;lost+=q;}
  if(this.phase!=='ready'){
   for(let e=0;e<this.edgeG.length;e++){const i=this.edgeI[e],j=this.edgeJ[e],q=this.edgeG[e]*(T[j]-T[i]);F[i]+=q;F[j]-=q;}
   const faces=[m.faceA,m.faceB],cover=this.phase==='resting'?REST_MODES[this.restMode]||REST_MODES.air:REST_MODES.air;
   for(let side=0;side<2;side++){
    const contact=panContact&&this.bottomSide===side,h=this.contactH();
    for(const node of faces[side]){
     if(contact){const q=h*node.area*(this.pan-T[node.i]);F[node.i]+=q;panFlux-=q;}
     else if(c.losses){const q=airFlux(T[node.i],10*cover.convection,.95*cover.radiation)*node.area;F[node.i]-=q;lost+=q;}
    }
   }
   if(c.losses)for(const node of m.side){const q=airFlux(T[node.i],10*cover.convection,coupledRadiation?0:.95*cover.radiation)*node.area;F[node.i]-=q;lost+=q;}
   if(coupledRadiation){const radiation=panSideRadiation(m,this.panRadiationGeometry,this.bottomSide,T,this.pan,ambient,this.panMaterial.emissivity);for(let j=0;j<m.side.length;j++)F[m.side[j].i]+=radiation.sideFlux[j];panFlux+=radiation.panFlux;lost+=radiation.roomLoss;}
   for(let i=0;i<T.length;i++){
    let energy=F[i]*dt;
    if(c.evaporation&&this.water[i]>0&&energy>0){const excess=energy-Math.max(0,100-T[i])*m.mass[i];if(excess>0){const ev=Math.min(this.water[i],excess/LATENT);this.water[i]-=ev;this.evaporated+=ev;energy-=ev*LATENT;}}
    T[i]+=energy/m.mass[i];
    if(!Number.isFinite(T[i])||T[i]<-273.15)throw new Error('Thermal solver became unstable.');
   }
   for(let side=0;side<2;side++)for(let r=0;r<faces[side].length;r++){const temp=T[faces[side][r].i];if(temp>120)this.doses[side][r]+=dt*Math.exp(Math.min(15,(temp-150)/25))/180;}
  }
  this.pan+=(burnerEnergy+panFlux*dt)/this.panCapacity;this.energyLost+=lost*dt;
 }
 observe(){
  const m=this.mesh,face=nodes=>nodes.reduce((s,n)=>s+this.T[n.i]*n.area,0)/m.area;
  const browns=[],burns=[];
  for(let s=0;s<2;s++){let b=0,c=0;for(let r=0;r<this.doses[s].length;r++){const d=this.doses[s][r],area=m.faceA[r].area;b+=area*(1-Math.exp(-d));c+=area*(1-Math.exp(-Math.max(0,d-3)*.7));}browns.push(100*b/m.area);burns.push(100*c/m.area);}
  return{time:this.time,pan:this.pan,core:this.T[(m.nz/2)*(m.nr+1)],min:Math.min(...this.T),max:Math.max(...this.T),faceA:face(m.faceA),faceB:face(m.faceB),power:this.power,bottomSide:this.bottomSide,phase:this.phase,restMode:this.restMode,oil:this.oil,brownA:browns[0],brownB:browns[1],burnA:burns[0],burnB:burns[1],evaporated:this.evaporated*1000,mass:m.mass.reduce((a,b)=>a+b,0)/this.material.cp*1000,energyResidual:this.energy()-this.initialEnergy-this.energyInput+this.energyLost+this.evaporated*LATENT};
 }
}
globalThis.SteakPhysics={Engine,MATERIALS,PANS,REST_MODES,DEFAULTS,buildMesh,sidePanViewFactor,buildPanRadiation,panSideRadiation};
})();
