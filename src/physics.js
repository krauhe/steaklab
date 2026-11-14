/* SteakLab physics v1. SI units internally. Pure model; no DOM or drawing.
   P1 triangular Galerkin FEM, exact axisymmetric row-sum mass lumping,
   conservative edge fluxes and adaptive explicit Euler. The pan is an
   axisymmetric finite-volume thin shell: radial bottom + a flared wall.
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
const PANS={iron:{label:'Cast iron',mass:2,cp:460,k:55,rho:7200,emissivity:.75},steel:{label:'Stainless steel',mass:1.2,cp:500,k:16,rho:7900,emissivity:.35},aluminum:{label:'Aluminum',mass:.8,cp:900,k:205,rho:2700,emissivity:.35},nonstick:{label:'Nonstick aluminum',mass:1,cp:900,k:170,rho:2700,emissivity:.85,bottomEmissivity:.35},hybrid:{label:'Hybrid steel / aluminum',mass:1.3,cp:650,k:75,rho:4500,emissivity:.65,bottomEmissivity:.35},grill:{label:'Grill pan',mass:2.4,cp:460,k:55,rho:7200,emissivity:.8}};
// Loose foil is represented only by reduced effective heat loss to the room.
// No foil heat capacity, condensation, moisture trapping or seal is resolved.
const REST_MODES={air:{convection:1,radiation:1},foil:{convection:.4,radiation:.5},pan:{convection:1,radiation:1}};
const DEFAULTS={meat:'beef',thickness:25,diameter:14,aspect:.78,initial:5,pan:'iron',wetness:.5,contact:1,nr:18,nz:24,panNr:14,panNw:4,ambient:22,panInitial:22,losses:true,evaporation:true,panRadiation:true};
const clamp=(v,lo,hi)=>Math.min(hi,Math.max(lo,v));
function number(v,fallback,lo,hi){return Number.isFinite(+v)?clamp(+v,lo,hi):fallback;}
function normalized(input){const c={...DEFAULTS,...input};for(const [key,lo,hi] of [['thickness',8,60],['diameter',8,22],['aspect',.45,1],['initial',0,30],['wetness',0,1],['contact',.5,1.5],['ambient',0,40],['panInitial',0,400],['nr',6,48],['nz',8,64],['panNr',6,64],['panNw',2,16]])c[key]=number(c[key],DEFAULTS[key],lo,hi);c.nr=2*Math.round(c.nr/2);c.nz=2*Math.round(c.nz/2);c.panNr=Math.round(c.panNr);c.panNw=Math.round(c.panNw);if(!MATERIALS[c.meat])c.meat='beef';if(!PANS[c.pan])c.pan='iron';return c;}
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
// Through-thickness temperature is lumped, but conduction along the pan shell
// is resolved. Effective k/rho (especially hybrid/coated presets) are illustrative.
// One uniform effective thickness preserves each preset's stated total mass.
// Fourier shell conduction: https://doc.comsol.com/6.3/doc/com.comsol.help.heat/heat_ug_theory.07.030.html
function buildPanMesh(c,material,meat){
 const R=.14,outerRadius=.154,wallHeight=.02,burnerRadius=.09,bottomCount=c.panNr,wallCount=c.panNw;
 const slant=Math.hypot(outerRadius-R,wallHeight),slope=(outerRadius-R)/slant,nodes=[];
 for(let i=0;i<bottomCount;i++){const r0=R*i/bottomCount,r1=R*(i+1)/bottomCount;nodes.push({r:2*(r1*r1*r1-r0*r0*r0)/(3*(r1*r1-r0*r0)),z:0,r0,r1,z0:0,z1:0,area:PI*(r1*r1-r0*r0),part:'bottom'});}
 for(let j=0;j<wallCount;j++){
  const s0=slant*j/wallCount,s1=slant*(j+1)/wallCount,weight=R*(s1-s0)+slope*(s1*s1-s0*s0)/2,center=(R*(s1*s1-s0*s0)/2+slope*(s1*s1*s1-s0*s0*s0)/3)/weight;
  nodes.push({r:R+slope*center,z:wallHeight*center/slant,r0:R+slope*s0,r1:R+slope*s1,z0:wallHeight*j/wallCount,z1:wallHeight*(j+1)/wallCount,area:2*PI*weight,part:'wall'});
 }
 const area=PI*R*R,shellArea=nodes.reduce((s,n)=>s+n.area,0),thickness=material.mass/(material.rho*shellArea),masses=Float64Array.from(nodes,n=>material.mass*n.area/shellArea),capacities=Float64Array.from(masses,m=>m*material.cp),diag=new Float64Array(nodes.length),edges=[];
 const factor=2*PI*material.k*thickness;
 for(let i=0;i<nodes.length-1;i++){
  const a=nodes[i],b=nodes[i+1];
  // Integrate dr/(2πktr) on the bottom and ds/(2πktr) on the wall.
  // The joint combines the last bottom half-cell and first wall half-cell.
  const resistance=i<bottomCount-1?Math.log(b.r/a.r)/factor:i===bottomCount-1?(Math.log(R/a.r)+Math.log(b.r/R)/slope)/factor:Math.log(b.r/a.r)/(factor*slope),g=1/resistance;
  edges.push([i,i+1,g]);diag[i]+=g;diag[i+1]+=g;
 }
 const contact=[],contactArea=new Float64Array(nodes.length),burnerWeights=new Float64Array(nodes.length);let cumulative=0;
 // Equal-area circular footprint: nodal face weights become contiguous annuli.
 // Their exact overlap areas conserve both the FEM face weights and pan flux.
 for(let r=0;r<meat.faceA.length;r++){
  const lo=cumulative/PI; cumulative+=meat.faceA[r].area;const hi=cumulative/PI;
  for(let i=0;i<bottomCount;i++){const n=nodes[i],overlap=PI*Math.max(0,Math.min(hi,n.r1*n.r1)-Math.max(lo,n.r0*n.r0));if(overlap>0){contact.push([r,i,overlap]);contactArea[i]+=overlap;}}
 }
 for(let i=0;i<bottomCount;i++){const n=nodes[i];burnerWeights[i]=Math.max(0,Math.min(n.r1,burnerRadius)**2-Math.min(n.r0,burnerRadius)**2)/(burnerRadius*burnerRadius);}
 const burnerSum=burnerWeights.reduce((s,x)=>s+x,0);for(let i=0;i<bottomCount;i++)burnerWeights[i]/=burnerSum;
 return{R,outerRadius,wallHeight,burnerRadius,bottomCount,wallCount,area,shellArea,thickness,nodes,masses,capacities,edges,diag,contact,contactArea,burnerWeights};
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
  this.config=normalized(input);this.material=MATERIALS[this.config.meat];this.panMaterial=PANS[this.config.pan];this.mesh=buildMesh(this.config,this.material);this.panMesh=buildPanMesh(this.config,this.panMaterial,this.mesh);
  const n=this.mesh.nodes.length;this.T=new Float64Array(n).fill(this.config.initial);this.flux=new Float64Array(n);this.water=new Float64Array(n);
  this.doses=[new Float64Array(this.mesh.nr+1),new Float64Array(this.mesh.nr+1)];
  this.panT=new Float64Array(this.panMesh.nodes.length).fill(this.config.panInitial);this.panFlux=new Float64Array(this.panT.length);this.panCapacity=this.panMesh.capacities.reduce((s,x)=>s+x,0);
  this.time=0;this.power=0;this.actualWatts=0;this.oil=0;this.bottomSide=0;this.phase='ready';this.restMode=null;this.evaporated=0;
  this.energyInput=0;this.energyLost=0;this.panArea=this.panMesh.area;
  this.panRadiationGeometry=buildPanRadiation(this.mesh);
  // Distributed tissue water plus a mesh-independent superficial film. Vapor
  // is assumed to escape immediately; no pressure/diffusion/shrinkage solve.
  // Keeping heat capacities fixed makes the simplified energy budget explicit.
  for(let i=0;i<n;i++)this.water[i]=this.mesh.mass[i]/this.material.cp*this.material.water+this.mesh.boundaryArea[i]*.12*this.config.wetness;
  this.initialWater=this.water.reduce((a,b)=>a+b,0);this.initialEnergy=this.energy();
  this.edgeI=Int32Array.from(this.mesh.edges,e=>e[0]);this.edgeJ=Int32Array.from(this.mesh.edges,e=>e[1]);this.edgeG=Float64Array.from(this.mesh.edges,e=>e[2]);
 }
 // Backward-compatible mean/setter: assigning pan initializes every shell cell.
 get pan(){let heat=0;for(let i=0;i<this.panT.length;i++)heat+=this.panMesh.capacities[i]*this.panT[i];return heat/this.panCapacity;}
 set pan(value){if(!Number.isFinite(value)||value< -273.15)throw new Error('Invalid pan temperature.');this.panT.fill(value);}
 get panContactTemp(){let heat=0;for(let i=0;i<this.panMesh.bottomCount;i++)heat+=this.panMesh.contactArea[i]*this.panT[i];return heat/this.mesh.area;}
 energy(){let result=0;for(let i=0;i<this.panT.length;i++)result+=this.panMesh.capacities[i]*(this.panT[i]-this.config.ambient);for(let i=0;i<this.T.length;i++)result+=this.mesh.mass[i]*(this.T[i]-this.config.ambient);return result;}
 clone(){
  const copy=Object.assign(Object.create(Engine.prototype),this);copy.config={...this.config};copy.T=Float64Array.from(this.T);copy.flux=new Float64Array(this.T.length);copy.water=Float64Array.from(this.water);copy.doses=this.doses.map(d=>Float64Array.from(d));
  copy.panT=Float64Array.from(this.panT);copy.panFlux=new Float64Array(this.panT.length);copy.panMesh={...this.panMesh,nodes:this.panMesh.nodes.map(n=>({...n})),edges:this.panMesh.edges.map(e=>e.slice()),contact:this.panMesh.contact.map(e=>e.slice())};
  for(const key of ['masses','capacities','diag','contactArea','burnerWeights'])copy.panMesh[key]=Float64Array.from(this.panMesh[key]);return copy;
 }
 hasPanContact(){return this.phase==='cooking'||this.phase==='resting'&&this.restMode==='pan';}
 action(type,value){
  if(type==='power'){this.power=number(value,0,0,12);return true;}
  if(type==='oil'){
   const grams=Math.min(30-this.oil,number(value,10,0,30)),capacity=grams/1000*2000;
   // Oil is an immediately equilibrated uniform bottom film; its radial fluid
   // motion and through-film temperature are not solved. Room-temperature oil
   // adds capacity locally without adding energy relative to the room.
   for(let i=0;i<this.panMesh.bottomCount;i++){const added=capacity*this.panMesh.nodes[i].area/this.panArea,old=this.panMesh.capacities[i];this.panT[i]=(old*this.panT[i]+added*this.config.ambient)/(old+added);this.panMesh.capacities[i]+=added;}
   this.panCapacity+=capacity;this.oil+=grams;return grams>0;
  }
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
  let step=.2,maxT=this.config.ambient;for(const t of this.panT)if(t>maxT)maxT=t;for(const t of this.T)if(t>maxT)maxT=t;
  const radiative=this.config.losses?4*.96*SIGMA*Math.pow(Math.max(273.15,maxT+273.15),3):0;
  const h=Math.max(this.contactH(),this.config.losses?12+radiative:0);
  for(let i=0;i<this.T.length;i++){const d=this.mesh.diag[i]+this.mesh.boundaryArea[i]*h;if(d>0)step=Math.min(step,.78*this.mesh.mass[i]/d);}
  const pm=this.panMesh,contact=this.hasPanContact()?this.contactH():0;
  for(let i=0;i<this.panT.length;i++){const d=pm.diag[i]+contact*pm.contactArea[i]+(this.config.losses?(18+2*radiative)*pm.nodes[i].area:0);if(d>0)step=Math.min(step,.78*pm.capacities[i]/d);}
  return step;
 }
 step(seconds){
  if(!Number.isFinite(seconds)||seconds<0)throw new Error('Time increment must be finite and nonnegative.');
  const end=this.time+seconds;
  while(this.time<end-1e-10){const dt=Math.min(end-this.time,this.stabilityStep());this.substep(dt);this.time+=dt;}
  this.time=end;return this;
 }
 substep(dt){
  const c=this.config,m=this.mesh,pm=this.panMesh,T=this.T,F=this.flux,PT=this.panT,PF=this.panFlux,ambient=c.ambient,panContact=this.hasPanContact(),coupledRadiation=c.losses&&c.panRadiation&&panContact;F.fill(0);PF.fill(0);
  const wanted=1800*this.power/12,decay=Math.exp(-dt/3),burnerEnergy=wanted*dt+(this.actualWatts-wanted)*3*(1-decay);
  this.actualWatts=wanted+(this.actualWatts-wanted)*decay;this.energyInput+=burnerEnergy;
  let lost=0;
  const airFlux=(t,h,epsilon)=>h*(t-ambient)+epsilon*SIGMA*(Math.pow(t+273.15,4)-Math.pow(ambient+273.15,4));
  for(const [i,j,g] of pm.edges){const q=g*(PT[j]-PT[i]);PF[i]+=q;PF[j]-=q;}
  if(c.losses)for(let i=0;i<PT.length;i++){
   const node=pm.nodes[i],bottom=i<pm.bottomCount,exposed=node.area-(bottom&&panContact?pm.contactArea[i]:0);
   // Both shell faces lose heat locally. The wall has no invented burner input
   // or meat contact; wall-to-meat enclosure view factors remain unresolved.
   const q=airFlux(PT[i],10,bottom&&coupledRadiation?0:this.panMaterial.emissivity)*exposed+airFlux(PT[i],8,this.panMaterial.bottomEmissivity??this.panMaterial.emissivity)*node.area;
   PF[i]-=q;lost+=q;
  }
  if(this.phase!=='ready'){
   for(let e=0;e<this.edgeG.length;e++){const i=this.edgeI[e],j=this.edgeJ[e],q=this.edgeG[e]*(T[j]-T[i]);F[i]+=q;F[j]-=q;}
   const faces=[m.faceA,m.faceB],cover=this.phase==='resting'?REST_MODES[this.restMode]||REST_MODES.air:REST_MODES.air;
   for(let side=0;side<2;side++){
    const contact=panContact&&this.bottomSide===side,h=this.contactH();
    if(contact)for(const [r,j,area] of pm.contact){const i=faces[side][r].i,q=h*area*(PT[j]-T[i]);F[i]+=q;PF[j]-=q;}
    else if(c.losses)for(const node of faces[side]){const q=airFlux(T[node.i],10*cover.convection,.95*cover.radiation)*node.area;F[node.i]-=q;lost+=q;}
   }
   if(c.losses)for(const node of m.side){const q=airFlux(T[node.i],10*cover.convection,coupledRadiation?0:.95*cover.radiation)*node.area;F[node.i]-=q;lost+=q;}
   if(coupledRadiation){
    let exposed=0,emission=0;for(let i=0;i<pm.bottomCount;i++){const area=pm.nodes[i].area-pm.contactArea[i];exposed+=area;emission+=area*(PT[i]+273.15)**4;}
    const fourth=emission/exposed,effective=Math.pow(fourth,.25)-273.15,radiation=panSideRadiation(m,this.panRadiationGeometry,this.bottomSide,T,effective,ambient,this.panMaterial.emissivity);
    for(let j=0;j<m.side.length;j++)F[m.side[j].i]+=radiation.sideFlux[j];
    // Approximation: retain one diffuse irradiation field for the exposed
    // bottom, driven by its area-weighted T^4. Each cell keeps its own emitted
    // T^4; the zero-sum correction below prevents cold rings losing heat as if
    // they had the mean temperature. Pan/meat/room exchange remains conservative.
    for(let i=0;i<pm.bottomCount;i++){const area=pm.nodes[i].area-pm.contactArea[i];PF[i]+=area/exposed*radiation.panFlux+this.panMaterial.emissivity*SIGMA*area*(fourth-(PT[i]+273.15)**4);}
    lost+=radiation.roomLoss;
   }
   for(let i=0;i<T.length;i++){
    let energy=F[i]*dt;
    if(c.evaporation&&this.water[i]>0&&energy>0){const excess=energy-Math.max(0,100-T[i])*m.mass[i];if(excess>0){const ev=Math.min(this.water[i],excess/LATENT);this.water[i]-=ev;this.evaporated+=ev;energy-=ev*LATENT;}}
    T[i]+=energy/m.mass[i];
    if(!Number.isFinite(T[i])||T[i]<-273.15)throw new Error('Thermal solver became unstable.');
   }
   for(let side=0;side<2;side++)for(let r=0;r<faces[side].length;r++){const temp=T[faces[side][r].i];if(temp>120)this.doses[side][r]+=dt*Math.exp(Math.min(15,(temp-150)/25))/180;}
  }
  for(let i=0;i<PT.length;i++){PT[i]+=(burnerEnergy*pm.burnerWeights[i]+PF[i]*dt)/pm.capacities[i];if(!Number.isFinite(PT[i])||PT[i]< -273.15)throw new Error('Pan thermal solver became unstable.');}
  this.energyLost+=lost*dt;
 }
 observe(){
  const m=this.mesh,face=nodes=>nodes.reduce((s,n)=>s+this.T[n.i]*n.area,0)/m.area;
  const browns=[],burns=[];
  for(let s=0;s<2;s++){let b=0,c=0;for(let r=0;r<this.doses[s].length;r++){const d=this.doses[s][r],area=m.faceA[r].area;b+=area*(1-Math.exp(-d));c+=area*(1-Math.exp(-Math.max(0,d-3)*.7));}browns.push(100*b/m.area);burns.push(100*c/m.area);}
  return{time:this.time,burnerWatts:this.actualWatts,pan:this.pan,panContactTemp:this.panContactTemp,panField:Array.from(this.panT),panMin:Math.min(...this.panT),panMax:Math.max(...this.panT),panRim:this.panT[this.panT.length-1],core:this.T[(m.nz/2)*(m.nr+1)],min:Math.min(...this.T),max:Math.max(...this.T),faceA:face(m.faceA),faceB:face(m.faceB),power:this.power,bottomSide:this.bottomSide,phase:this.phase,restMode:this.restMode,oil:this.oil,brownA:browns[0],brownB:browns[1],burnA:burns[0],burnB:burns[1],evaporated:this.evaporated*1000,mass:m.mass.reduce((a,b)=>a+b,0)/this.material.cp*1000,energyResidual:this.energy()-this.initialEnergy-this.energyInput+this.energyLost+this.evaporated*LATENT};
 }
}
globalThis.SteakPhysics={Engine,MATERIALS,PANS,REST_MODES,DEFAULTS,buildMesh,buildPanMesh,sidePanViewFactor,buildPanRadiation,panSideRadiation};
})();
