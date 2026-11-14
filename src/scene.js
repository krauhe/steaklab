/* Orthographic rendering only. Every world coordinate is in millimetres;
   the same scale projects x, y and thickness. This does not alter the solver. */
(() => {
'use strict';
const sectionCanvas=document.createElement('canvas');
function draw(o){
 const {ctx,w,h,config:c,frame,mesh,panMesh=null,T,sample,heatRGB,texture,rasterEllipse,label,fmt,showMesh,mode,t,compact=false,motion=null}=o;
 const s=frame.s,small=!compact&&w<560,elevation=28*Math.PI/180,se=Math.sin(elevation),ce=Math.cos(elevation);
 const a=c.diameter*5,b=a*c.aspect,H=c.thickness,topSide=s.bottomSide===0?1:0,p=motion?.progress??1,ease=p*p*(3-2*p),rotating=motion?.type==='flip';
 const theta=(s.bottomSide===0?0:Math.PI)-Math.PI+Math.PI*ease;
 // Reserve the entire turn/lift envelope once per geometry. Neither the scale
 // nor the camera center depends on the action, its progress, or the meat side.
 const halfH=H/2,flipLift=Math.max(0,b-halfH);
 const flipTop=Math.hypot(b*se-halfH*ce,b*ce+halfH*se+flipLift*ce)+(halfH+16)*ce;
 const frameAbove=Math.max(154*se+20*ce,flipTop,b*se+(H+78)*ce),frameBelow=Math.max(150*se+6*ce,Math.hypot(b*se+halfH*ce,Math.min(b,halfH)*ce+halfH*se)-halfH*ce);
 const frameTop=compact?12:84,frameBottom=small?221:compact?h-29:h-89;
 const scale=Math.min(small?(w-48)/330:w*.43/310,(frameBottom-frameTop)/(frameAbove+frameBelow)),cx=small?w*.50:w*(compact?.28:.25),cy=(frameTop+frameBottom+(frameAbove-frameBelow)*scale)/2;
 const project=(x,y,z=0)=>[cx+x*scale,cy+(y*se-z*ce)*scale];
 // Local temperatures come from the solver's axisymmetric shell. The node
 // chain follows the bottom from center to edge, then continues up the wall.
 const panNodes=panMesh?.nodes||[],panField=s.panField||[],panRGB=mode==='heat'?heatRGB(s.pan):null;
 function panAt(r,z){
  if(!panNodes.length||panField.length!==panNodes.length)return s.pan;
  let nearest=Infinity,value=panField[0];
  for(let i=0;i<panNodes.length-1;i++){
   const a=panNodes[i],b=panNodes[i+1],dr=b.r-a.r,dz=b.z-a.z,den=dr*dr+dz*dz;
   const f=Math.max(0,Math.min(1,den?((r-a.r)*dr+(z-a.z)*dz)/den:0)),distance=(r-a.r-f*dr)**2+(z-a.z-f*dz)**2;
   if(distance<nearest){nearest=distance;value=panField[i]+(panField[i+1]-panField[i])*f;}
  }return value;
 }
 const rimR=panMesh?.outerRadius??.154,wallH=panMesh?.wallHeight??.02,floorR=panMesh?.R??.14;
 const panTone=(shade=1,temp=panAt(rimR,wallH))=>'rgb('+heatRGB(temp).map(v=>Math.round(v*shade)).join(',')+')';
 const polygon=(points,fill,stroke)=>{ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=.7;ctx.stroke();}};
 const ring=(r,z,fill,stroke)=>{const p=project(0,0,z);ctx.beginPath();ctx.ellipse(...p,r*scale,r*scale*se,0,0,Math.PI*2);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();}};
 function wall(r1,z1,r2,z2,start,end,front=false){
  // Split the drawn wall into height bands, sampling the physical shell path.
  // Both sides of the metal share a temperature through its thickness.
  const bands=panRGB?12:1;
  for(let band=0;band<bands;band++){
   const f0=band/bands,f1=(band+1)/bands,ra=r1+(r2-r1)*f0,rb=r1+(r2-r1)*f1,za=z1+(z2-z1)*f0,zb=z1+(z2-z1)*f1;
   const z=Math.max(0,Math.min(wallH,(za+zb)/2000)),r=floorR+(rimR-floorR)*(wallH?z/wallH:0),temp=panAt(r,z);
   for(let i=0;i<64;i++){const p=start+(end-start)*i/64,q=start+(end-start)*(i+1)/64,light=front?28+12*Math.sin(p):37+11*Math.cos(p+.6),shade=front?.91+.06*Math.sin(p):.95+.035*Math.cos(p+.6);
    polygon([project(ra*Math.cos(p),ra*Math.sin(p),za),project(ra*Math.cos(q),ra*Math.sin(q),za),project(rb*Math.cos(q),rb*Math.sin(q),zb),project(rb*Math.cos(p),rb*Math.sin(p),zb)],panRGB?panTone(shade,temp):'rgb('+[light,light+6,light+2].join(',')+')');
   }
  }
 }
 const resting=s.phase==='resting'&&s.restMode!=='pan',takingOff=motion?.type==='rest'&&motion.value!=='pan';
 const pouring=motion?.type==='oil'&&!resting&&!takingOff,oilGap=140-a,oilX=-(a+oilGap*.55),oilY=16;
 const oilHeight=small?Math.min(48,(cy+oilY*se*scale-113)/(ce*scale)):56;
 // The neck and every part of the falling stream share this exact world point.
 const oilPoint=u=>project(oilX-4+4*u,oilY,1+oilHeight*(1-.35*u-.65*u*u));
 function drawOilPool(){
  const growth=Math.max(0,Math.min(1,(p-.22)/.58));if(!growth)return;
  const q=project(oilX,oilY,.2),radius=5+63*Math.sqrt(growth);
  ctx.save();ctx.globalAlpha=Math.min(1,growth*5)*Math.min(1,(1-p)/.2);
  const floor=project(0,0);ctx.beginPath();ctx.ellipse(...floor,139*scale,139*scale*se,0,0,Math.PI*2);ctx.clip();
  // Spread equally in floor coordinates from the stationary impact point.
  // The pan clip and later meat drawing provide the only directional boundaries.
  ctx.translate(...q);ctx.scale(scale,scale*se);
  const pool=ctx.createRadialGradient(0,0,0,0,0,radius*1.04);pool.addColorStop(0,'#ffe6a174');pool.addColorStop(.6,'#d9bb6260');pool.addColorStop(.93,'#e4ca7650');pool.addColorStop(1,'#d9bb6200');
  ctx.beginPath();for(let i=0;i<=72;i++){const angle=i/72*Math.PI*2,r=radius*(1+.018*Math.sin(3*angle)+.012*Math.cos(5*angle)),x=r*Math.cos(angle),y=r*Math.sin(angle);i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.closePath();ctx.fillStyle=pool;ctx.fill();
  ctx.strokeStyle='#ead38b40';ctx.lineWidth=1;ctx.stroke();ctx.restore();
 }
 function drawOilPour(){
  const start=Math.max(0,Math.min(1,(p-.8)/.14)),end=Math.max(0,Math.min(1,(p-.1)/.12));
  const stream=(from,to)=>{ctx.beginPath();for(let i=0;i<=24;i++){const q=oilPoint(from+(to-from)*i/24);i?ctx.lineTo(...q):ctx.moveTo(...q);}};
  ctx.save();ctx.lineCap='round';
  if(end>start){
   stream(start,end);ctx.strokeStyle='#d8b350b8';ctx.lineWidth=Math.max(1.7,2.7*scale);ctx.stroke();
   ctx.strokeStyle='#fff0b7bd';ctx.lineWidth=Math.max(.65,scale);ctx.stroke();
   for(let i=0;i<3;i++){const u=(p*3+i/3)%1;if(u>start&&u<end){stream(Math.max(start,u-.05),u);ctx.strokeStyle='#fff1bc';ctx.lineWidth=Math.max(1,1.4*scale);ctx.stroke();}}
  }
  const lip=oilPoint(0),bottleScale=Math.max(.68,Math.min(1,scale));
  ctx.globalAlpha=Math.min(1,p/.09,(1-p)/.1);ctx.translate(...lip);ctx.rotate(-.65-.1*Math.sin(Math.PI*p));ctx.scale(bottleScale,bottleScale);
  ctx.beginPath();ctx.moveTo(-4,0);ctx.lineTo(-4,-10);ctx.lineTo(-8,-15);ctx.lineTo(-8,-34);ctx.quadraticCurveTo(-8,-38,-4,-38);ctx.lineTo(4,-38);ctx.quadraticCurveTo(8,-38,8,-34);ctx.lineTo(8,-15);ctx.lineTo(4,-10);ctx.lineTo(4,0);ctx.closePath();ctx.fillStyle='#798449';ctx.strokeStyle='#c4cd91';ctx.lineWidth=1;ctx.fill();ctx.stroke();
  ctx.fillStyle='#d9c16c88';ctx.fillRect(-5,-25,10,12);ctx.fillStyle='#3e4c32';ctx.fillRect(-5,-29,10,7);
  ctx.beginPath();ctx.moveTo(-4,0);ctx.lineTo(4,0);ctx.strokeStyle='#f3dda0';ctx.lineWidth=1.5;ctx.stroke();ctx.restore();
 }
 function drawPan(){
  ctx.save();ctx.shadowColor='#0009';ctx.shadowBlur=19;ctx.shadowOffsetY=10;ring(151,-5,'#0c100c');ctx.restore();
  wall(154,20,150,-6,0,Math.PI,true);ring(154,20,panRGB?panTone():'#273027');wall(154,20,140,0,Math.PI,Math.PI*2);
  const coating=c.pan==='nonstick'?['#262c29','#161c19','#2c332e']:c.pan==='hybrid'?['#2b312e','#1a201d','#303832']:['#303930','#252e25','#354032'];
  if(panRGB){
   const floorNodes=panNodes.map((node,index)=>({node,index})).filter(({node})=>node.part==='bottom');
   if(floorNodes.length){for(let j=floorNodes.length-1;j>=0;j--){const {node,index}=floorNodes[j];ring(node.r1*1000,0,panTone(1,panField[index]));}}
   else for(let j=35;j>=0;j--)ring(floorR*1000*(j+1)/36,0,panTone(1,panAt(floorR*(j+.5)/36,0)));
  }else{const floor=ctx.createLinearGradient(cx,cy-80*scale,cx,cy+70*scale);floor.addColorStop(0,coating[0]);floor.addColorStop(.6,coating[1]);floor.addColorStop(1,coating[2]);ring(140,0,floor);}
  if(!panRGB&&c.pan==='hybrid'){
   ctx.save();const q=project(0,0);ctx.beginPath();ctx.ellipse(...q,139*scale,139*scale*se,0,0,Math.PI*2);ctx.clip();ctx.beginPath();
   const r=6,stepY=Math.sqrt(3)*r;for(let col=-16;col<=16;col++)for(let row=-15;row<=15;row++){const x=col*r*1.5,y=(row+(col%2)/2)*stepY;for(let k=0;k<6;k++){const v=project(x+r*Math.cos(k*Math.PI/3),y+r*Math.sin(k*Math.PI/3));k?ctx.lineTo(...v):ctx.moveTo(...v);}ctx.closePath();}
   ctx.strokeStyle='#a9b3aa42';ctx.lineWidth=Math.max(.38,.55*scale);ctx.stroke();ctx.restore();
  }
  // A thin sheen on the existing floor, not another circular pool/ring.
  if(s.oil>0&&!panRGB){const oil=ctx.createLinearGradient(cx-130*scale,cy-30*scale,cx+130*scale,cy+30*scale);oil.addColorStop(0,'#ddc46d03');oil.addColorStop(.45,'#e1c66e27');oil.addColorStop(.7,'#f4d88f0c');oil.addColorStop(1,'#d1b96216');ring(139,0,oil);}
  if(pouring)drawOilPool();
  if(!panRGB&&c.pan==='grill'){ctx.save();const p=project(0,0);ctx.beginPath();ctx.ellipse(...p,139*scale,139*scale*se,0,0,Math.PI*2);ctx.clip();for(let x=-130;x<=130;x+=17){ctx.beginPath();ctx.moveTo(...project(x,-140));ctx.lineTo(...project(x,140));ctx.strokeStyle='#111910';ctx.lineWidth=5*scale;ctx.stroke();ctx.strokeStyle='#69715a55';ctx.lineWidth=1;ctx.stroke();}ctx.restore();}
 }
 function drawRack(){
  for(let y=-100;y<=100;y+=25){ctx.beginPath();ctx.moveTo(...project(-130,y));ctx.lineTo(...project(130,y));ctx.strokeStyle='#73816b';ctx.lineWidth=2*scale;ctx.stroke();}
  for(const x of [-100,100]){ctx.beginPath();ctx.moveTo(...project(x,-110));ctx.lineTo(...project(x,110));ctx.strokeStyle='#45513f';ctx.lineWidth=3*scale;ctx.stroke();}
 }
 if(motion?.type==='power'||(motion?.type==='rest'&&motion.value==='pan')){ctx.save();ctx.globalAlpha=.5*Math.sin(Math.PI*p);ctx.shadowColor='#e5a042';ctx.shadowBlur=28;ring(140,-9,'#e2a23c55');ctx.restore();}
 if(takingOff){ctx.save();ctx.globalAlpha=1-ease;drawPan();ctx.globalAlpha=ease;drawRack();ctx.restore();}else if(resting)drawRack();else drawPan();
 if(pouring)drawOilPour();
 // Lift the ingredient preview while it is waiting; dimensions stay unchanged.
 const base=(s.phase==='ready'?8:.7)+(motion?.type==='add'?70*(1-ease):takingOff?30*Math.sin(Math.PI*p):0),top=project(0,0,base+H),bottom=project(0,0,base);
 ctx.save();ctx.shadowColor='#0009';ctx.shadowBlur=11;ctx.shadowOffsetY=5;ctx.beginPath();ctx.ellipse(...project(0,0,1),a*scale,b*scale*se,0,0,Math.PI*2);ctx.fillStyle='#11160e77';ctx.fill();ctx.restore();
 let physicalPoint=null;
 if(rotating){
  const cos=Math.cos(theta),sin=Math.sin(theta),lift=Math.max(0,b-H/2)*Math.abs(sin)+8*Math.sin(Math.PI*p);
  physicalPoint=(x,y,z)=>{const yy=y*cos-(z-H/2)*sin,zz=y*sin+(z-H/2)*cos+H/2+base+lift;return{screen:project(x,yy,zz),depth:yy*ce+zz*se};};
  const faces=[],addFace=(pts,rgb,shade=1)=>{const v=pts.map(v=>physicalPoint(...v));faces.push({points:v.map(v=>v.screen),depth:v.reduce((sum,v)=>sum+v.depth,0)/v.length,color:'rgb('+rgb.map(v=>Math.round(v*shade)).join(',')+')'});};
  for(let i=0;i<48;i++){const u=i/48*Math.PI*2,v=(i+1)/48*Math.PI*2;for(let j=0;j<8;j++){const z0=j/8*H,z1=(j+1)/8*H,temp=sample(1,(j+.5)/8),f=Math.max(0,Math.min(1,(temp-35)/65)),raw=c.meat==='beef'?[148,65,60]:[200,146,125],rgb=mode==='heat'?heatRGB(temp):raw.map((v,k)=>v+([147,110,77][k]-v)*f);addFace([[a*Math.cos(u),b*Math.sin(u),z0],[a*Math.cos(v),b*Math.sin(v),z0],[a*Math.cos(v),b*Math.sin(v),z1],[a*Math.cos(u),b*Math.sin(u),z1]],rgb,.8);}
   for(const side of [0,1])for(let j=0;j<10;j++){const r0=j/10,r1=(j+1)/10,r=(r0+r1)/2,ang=(u+v)/2,rgb=mode==='heat'?heatRGB(sample(r,side)):texture(r,(Math.cos(ang)*r+1)*70,(Math.sin(ang)*r+1)*55,side);addFace([[a*r0*Math.cos(u),b*r0*Math.sin(u),side*H],[a*r1*Math.cos(u),b*r1*Math.sin(u),side*H],[a*r1*Math.cos(v),b*r1*Math.sin(v),side*H],[a*r0*Math.cos(v),b*r0*Math.sin(v),side*H]],rgb,.94);}
  }
  faces.sort((a,b)=>a.depth-b.depth);for(const f of faces)polygon(f.points,f.color,f.color);
 }else{ for(let j=0;j<16;j++)for(let i=0;i<70;i++){
  const p=i/70*Math.PI,q=(i+1)/70*Math.PI,z0=base+j/16*H,z1=base+(j+1)/16*H,z=s.bottomSide===0?(j+.5)/16:1-(j+.5)/16;
  let rgb;if(mode==='heat')rgb=heatRGB(sample(1,z));else{const raw=c.meat==='beef'?[148,65,60]:c.meat==='pork'?[190,121,110]:[214,171,140],cooked=[147,110,77],f=Math.max(0,Math.min(1,(sample(1,z)-35)/65));rgb=raw.map((v,k)=>v+(cooked[k]-v)*f);}
  const shade=.65+.25*Math.sin(p+.35)+.04*Math.sin(i*4+j*7);polygon([project(a*Math.cos(p),b*Math.sin(p),z0),project(a*Math.cos(q),b*Math.sin(q),z0),project(a*Math.cos(q),b*Math.sin(q),z1),project(a*Math.cos(p),b*Math.sin(p),z1)],`rgb(${rgb.map(v=>Math.round(v*shade)).join(',')})`);
 }
 rasterEllipse(ctx,top[0],top[1],a*scale,b*scale*se,topSide,mode==='heat');
 }

 if(!resting&&!takingOff){wall(140,0,154,20,0,Math.PI);ring(154,20,null,'#707c6355');}
 // Persistent material-side labels are attached to the actual faces.
 function badge(side,x,y){const color=side===0?'#f18b77':'#8fc9ba';ctx.beginPath();ctx.arc(x,y,8,0,Math.PI*2);ctx.fillStyle='#111a13e8';ctx.fill();ctx.strokeStyle=color;ctx.lineWidth=1;ctx.stroke();label(ctx,side===0?'A':'B',x,y+3,color,9,'center');}
 if(physicalPoint){for(const side of [0,1]){const q=physicalPoint(0,0,side*H).screen;badge(side,q[0]+(side?-12:12),q[1]);}}
 else{badge(topSide,top[0],top[1]);const q=project(-a*.4,b*.78,base+H*.15);badge(s.bottomSide,q[0],q[1]);}
 if(s.phase==='resting'&&s.restMode==='foil'){
  ctx.save();ctx.globalAlpha=motion?.type==='rest'?ease:.55;polygon([project(-a*1.2,-b,base),project(0,-b,base+H+25),project(a*1.2,-b,base),project(a*1.2,b,base),project(0,b,base+H+25),project(-a*1.2,b,base)],'#b9c8c34d','#c8d7ce88');ctx.restore();
 }
 // Thin leaders identify the meat, its thickness and the actual pan floor.
 const leadX=cx+a*scale+15,tip=project(a,0,base+H/2);
 ctx.strokeStyle='#d8e8b58c';ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(...tip);ctx.lineTo(leadX,tip[1]);ctx.moveTo(leadX,top[1]);ctx.lineTo(leadX,bottom[1]);for(const y of [top[1],bottom[1]]){ctx.moveTo(leadX-3,y);ctx.lineTo(leadX+3,y);}ctx.stroke();
 label(ctx,fmt(H)+' mm',leadX+7,tip[1]+3,'#e0edca',10);
 label(ctx,t('{diameter} cm × {width} cm',{diameter:fmt(c.diameter,1),width:fmt(c.diameter*c.aspect,1)}),cx,small?241:compact?h-10:h-68,'#d8e5c9',11,'center');
 label(ctx,s.phase==='ready'?'INGREDIENT PREVIEW · WAITING ABOVE THE PAN':resting?'RESTING ON A VIRTUAL RACK':'PAN BASE · 28 cm',cx,small?257:compact?h+20:h-51,'#90a082',small?8:9,'center');
 if(!compact)label(ctx,'28° VIEW · PROPORTIONS TO SCALE',small?16:24,small?53:55,'#788b6d',8);
 if(!compact&&!resting&&s.oil>0)label(ctx,'Oil · thin surface film',small?16:24,small?69:71,'#bdb080',9);
 // Front elevation: x and z use one scale. Never exaggerate the height.
 const desiredSW=small?w*.66:w*.28,sw=compact?Math.min(desiredSW,Math.max(25,h-78)*c.diameter*10/H):desiredSW,sx=small?w*.15:w*(compact?.79:.78)-sw/2,sh=sw*H/(c.diameter*10),sy=small?311:compact?(h-sh)/2-6:h*.51-sh/2;
 if(!compact)label(ctx,compact?'CENTER SECTION':'CENTER SECTION · TRUE PROPORTIONS',sx,sy-(compact?25:43),'#bdcbae',small?8:9);
 if(!compact)label(ctx,'Same scale for diameter and thickness',sx,sy-27,'#788b6d',8);
 const surface=sectionCanvas;surface.width=240;surface.height=Math.max(12,Math.ceil(sh*2));const oc=surface.getContext('2d'),im=oc.createImageData(surface.width,surface.height);
 for(let y=0;y<surface.height;y++)for(let x=0;x<240;x++){const r=Math.abs(x/239*2-1),z=s.bottomSide===0?1-y/(surface.height-1):y/(surface.height-1),rgb=heatRGB(sample(r,z)),i=4*(y*240+x);im.data[i]=rgb[0];im.data[i+1]=rgb[1];im.data[i+2]=rgb[2];im.data[i+3]=255;}oc.putImageData(im,0,0);
 const xy=(r,z,sign=1)=>[sx+sw/2+sign*r/mesh.R*sw/2,sy+(s.bottomSide===0?1-z/mesh.H:z/mesh.H)*sh];
 ctx.save();ctx.beginPath();ctx.rect(sx,sy,sw,sh);ctx.clip();ctx.drawImage(surface,sx,sy,sw,sh);
 if(showMesh){ctx.strokeStyle='#fff4';ctx.lineWidth=.45;for(const tri of mesh.triangles)for(const sign of [-1,1]){ctx.beginPath();tri.forEach((idx,k)=>{const n=mesh.nodes[idx],p=xy(n.r,n.z,sign);k?ctx.lineTo(...p):ctx.moveTo(...p);});ctx.closePath();ctx.stroke();}}
 for(const level of [40,55,65,100,140,180]){ctx.beginPath();for(const tri of mesh.triangles){const points=[];for(let k=0;k<3;k++){const a=tri[k],b=tri[(k+1)%3],ta=T[a],tb=T[b];if((ta<=level&&tb>level)||(tb<=level&&ta>level)){const f=(level-ta)/(tb-ta),na=mesh.nodes[a],nb=mesh.nodes[b];points.push({r:na.r+(nb.r-na.r)*f,z:na.z+(nb.z-na.z)*f});}}if(points.length===2)for(const sign of [-1,1])points.forEach((p,k)=>k?ctx.lineTo(...xy(p.r,p.z,sign)):ctx.moveTo(...xy(p.r,p.z,sign)));}ctx.strokeStyle='#f5f7d7b0';ctx.lineWidth=.85;ctx.stroke();}
 ctx.restore();ctx.strokeStyle='#c6dca077';ctx.lineWidth=.8;ctx.strokeRect(sx,sy,sw,sh);
 const labels=[];for(const level of [40,55,65,100,140,180]){let prev=sample(.55,s.bottomSide===0?1:0)-level;for(let k=1;k<=100;k++){const v=sample(.55,s.bottomSide===0?1-k/100:k/100)-level;if(prev*v<0){const y=sy+sh*k/100;if(y>sy+5&&y<sy+sh-5&&!labels.some(a=>Math.abs(a-y)<11)){labels.push(y);ctx.fillStyle='#102016b0';ctx.fillRect(sx+sw*.75-12,y-5,25,10);label(ctx,level+'°',sx+sw*.75,y+3,'#eff7df',8,'center');}}prev=v;}}
 label(ctx,topSide===0?'A':'B',sx,sy-8,topSide===0?'#f18b77':'#8fc9ba',11);label(ctx,s.bottomSide===0?'A':'B',sx,sy+sh+14,s.bottomSide===0?'#f18b77':'#8fc9ba',11);
 const centerY=sy+sh/2;ctx.beginPath();ctx.arc(sx+sw/2,centerY,2.7,0,Math.PI*2);ctx.fillStyle='#effadf';ctx.fill();ctx.beginPath();ctx.moveTo(sx+sw/2+5,centerY);ctx.lineTo(sx+sw+6,centerY);ctx.strokeStyle='#e0efb9a0';ctx.stroke();label(ctx,fmt(s.core)+'°',sx+sw+9,centerY+3,'#e1f3b5',10);
 // Dimension lines provide an unambiguous check against the geometry controls.
 const dy=sy+sh+(compact?20:31);ctx.strokeStyle='#839578';ctx.beginPath();ctx.moveTo(sx,dy);ctx.lineTo(sx+sw,dy);for(const x of [sx,sx+sw]){ctx.moveTo(x,dy-3);ctx.lineTo(x,dy+3);}ctx.moveTo(sx-11,sy);ctx.lineTo(sx-11,sy+sh);for(const y of [sy,sy+sh]){ctx.moveTo(sx-14,y);ctx.lineTo(sx-8,y);}ctx.stroke();
 label(ctx,fmt(c.diameter,1)+' cm',sx+sw/2,dy+(compact?10:14),'#c7d7b9',9,'center');ctx.save();ctx.translate(sx-21,centerY);ctx.rotate(-Math.PI/2);label(ctx,fmt(H)+' mm',0,0,'#c7d7b9',9,'center');ctx.restore();
 if(s.phase==='cooking'||s.phase==='resting'&&s.restMode==='pan'){ctx.fillStyle='#b4b99b77';ctx.fillRect(sx,sy+sh+3,sw,2);}
}
globalThis.SteakScene={draw};
})();
