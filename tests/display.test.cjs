const {test}=require('node:test');
const assert=require('node:assert/strict');
require('../src/display.js');
const d=globalThis.SteakDisplay;
const near=(a,b,tolerance=1e-10)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} vs ${b}`);

test('Focused scale is monotone, invertible, and devotes 84% to 40–80 °C',()=>{
 for(const [temp,u] of [[0,0],[40,.08],[80,.92],[220,1]])near(d.scalePosition(temp),u);
 near(d.scalePosition(80)-d.scalePosition(40),.84);
 let previous=-1;
 for(let temp=0;temp<=220;temp+=.25){const u=d.scalePosition(temp);assert.ok(u>previous);near(d.temperatureAtPosition(u),temp);previous=u;}
 for(const temp of [40,50,60,70])assert.notDeepEqual(d.heatRGB(temp),d.heatRGB(temp+10));
});

test('Both scales clamp out-of-range values and preserve their endpoints',()=>{
 for(const mode of ['focus','linear']){
  assert.equal(d.scalePosition(-50,mode),0);assert.equal(d.scalePosition(Infinity,mode),1);
  assert.equal(d.temperatureAtPosition(-Infinity,mode),0);assert.equal(d.temperatureAtPosition(8,mode),220);
  assert.deepEqual(d.heatRGB(-50,mode),d.heatRGB(0,mode));assert.deepEqual(d.heatRGB(300,mode),d.heatRGB(220,mode));
  assert.equal(d.scalePosition(NaN,mode),0);
  for(let temp=0;temp<=220;temp+=2){const u=d.scalePosition(temp,mode);near(d.temperatureAtPosition(u,mode),temp);assert.ok(d.heatRGB(temp,mode).every(v=>Number.isInteger(v)&&v>=0&&v<=255));}
 }
 near(d.scalePosition(55,'linear'),.25);near(d.temperatureAtPosition(.5,'linear'),110);
 assert.throws(()=>d.scalePosition(50,'unknown'),RangeError);
});

test('Legend interpolation reproduces field colors for both scale modes',()=>{
 for(const mode of ['focus','linear']){
  const stops=d.legendStops(mode);assert.equal(stops[0].position,0);assert.equal(stops.at(-1).position,1);
  for(let i=0;i<stops.length;i++){
   const s=stops[i];near(d.scalePosition(s.temperature,mode),s.position);assert.deepEqual(d.heatRGB(s.temperature,mode),s.color);
   if(i)assert.ok(s.position>stops[i-1].position&&s.temperature>stops[i-1].temperature);
  }
  if(mode==='focus')for(const position of [0,.08,.92,1])assert.ok(stops.some(s=>s.position===position));
  for(let j=0;j<=400;j++){
   const u=j/400;let i=0;while(i<stops.length-2&&u>stops[i+1].position)i++;
   const a=stops[i],b=stops[i+1],f=(u-a.position)/(b.position-a.position);
   const css=a.color.map((v,k)=>Math.round(v+f*(b.color[k]-v))),field=d.heatRGB(d.temperatureAtPosition(u,mode),mode);
   css.forEach((v,k)=>near(v,field[k],1));
  }
  // A UI modifying returned colors must not modify the shared palette.
  const original=d.heatRGB(0,mode);stops[0].color[0]=255;assert.deepEqual(d.heatRGB(0,mode),original);
 }
});

test('Close and simultaneous actions remain distinct without card collisions',()=>{
 const events=[0,100,105,110,195,200,315,435,555,555].map((time,id)=>({id,time})),rows={};
 for(const e of events)rows[e.id]=d.freeActionRow(events,rows,e.id,e.time,0,402,780);
 assert.equal(Object.keys(rows).length,events.length);assert.ok(Math.max(...Object.values(rows))<3);
 for(const a of events)for(const b of events)if(a.id!==b.id&&rows[a.id]===rows[b.id])assert.ok(Math.abs(a.time-b.time)*402/780>=48);
});

test('A drag preview reserves a free row without moving any other action',()=>{
 const events=[{id:1,time:100},{id:2,time:300},{id:3,time:100}],rows={1:0,2:0,3:1},before={...rows};
 const selected=d.freeActionRow(events,rows,2,100,0,400,780);
 assert.equal(selected,2);assert.deepEqual(rows,before);
 events[1].time=100;rows[2]=selected;assert.equal(d.freeActionRow(events,rows,2,100,selected,400,780),selected);
 assert.equal(rows[1],before[1]);assert.equal(rows[3],before[3]);
});

test('All 80 coincident actions get individual selectable positions',()=>{
 const events=Array.from({length:80},(_,id)=>({id,time:60})),rows={};
 for(const e of events)rows[e.id]=d.freeActionRow(events,rows,e.id,e.time,0,400,780);
 assert.equal(new Set(Object.values(rows)).size,80);
});
