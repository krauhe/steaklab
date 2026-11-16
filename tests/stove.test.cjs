const {test}=require('node:test');
const assert=require('node:assert/strict');
require('../src/physics.js');
const {Engine,PANS,estimateBoilCalibration}=globalThis.SteakPhysics;
const near=(a,b,tol=1e-8)=>assert.ok(Math.abs(a-b)<=tol,`${a} vs ${b}`);

test('Default stove retains the 1800 W linear curve and three-second lag',()=>{
 for(const level of [0,3,6,12]){
  const e=new Engine({losses:false,evaporation:false});e.action('power',level);e.step(9);
  const wanted=1800*level/12;
  near(e.actualWatts,wanted*(1-Math.exp(-3)));
  near(e.energyInput,wanted*(9-3*(1-Math.exp(-3))));
  near(e.observe().energyResidual,0,1e-6);
 }
});

test('Quadratic stove curve gives quarter maximum input at half setting',()=>{
 const half=new Engine({maxHeatWatts:2400,powerExponent:2}),full=new Engine({maxHeatWatts:2400,powerExponent:2});
 half.action('power',6);full.action('power',12);half.step(12);full.step(12);
 near(half.actualWatts,full.actualWatts/4);near(half.energyInput,full.energyInput/4);
});

test('Custom maximum and nonlinear curve conserve energy during cooking and switch-off',()=>{
 const e=new Engine({maxHeatWatts:3200,powerExponent:1.6});e.action('oil',10);e.action('add');
 for(const level of [12,5,0]){e.action('power',level);e.step(45);near(e.observe().energyResidual,0,1e-5);}
 assert.ok(e.T.every(Number.isFinite));assert.ok(e.panT.every(Number.isFinite));
 const clone=e.clone();assert.equal(clone.config.maxHeatWatts,3200);assert.equal(clone.config.powerExponent,1.6);
});

test('Stove parameters have bounded normalization and safe nonfinite defaults',()=>{
 const low=new Engine({maxHeatWatts:-100,powerExponent:0}),high=new Engine({maxHeatWatts:10000,powerExponent:10}),bad=new Engine({maxHeatWatts:NaN,powerExponent:Infinity});
 assert.equal(low.config.maxHeatWatts,100);assert.equal(low.config.powerExponent,.5);
 assert.equal(high.config.maxHeatWatts,6000);assert.equal(high.config.powerExponent,3);
 assert.equal(bad.config.maxHeatWatts,1800);assert.equal(bad.config.powerExponent,1);
});

test('One-litre estimate accounts separately for stored energy and estimated losses',()=>{
 const fast=estimateBoilCalibration({seconds:240}),slow=estimateBoilCalibration({seconds:480});
 near(fast.storedWatts,1700);near(slow.storedWatts,850);
 near(estimateBoilCalibration({seconds:240,pan:'aluminum',startTemperature:10,boilingTemperature:95}).storedWatts,(4180+PANS.aluminum.mass*PANS.aluminum.cp)*85/240);
 assert.ok(estimateBoilCalibration({seconds:30}).watts>6000,'UI must flag estimates outside model bounds rather than silently clamp');
 assert.ok(fast.watts>fast.storedWatts&&fast.lossWatts>0);near(fast.watts,fast.storedWatts+fast.lossWatts);
 assert.ok(slow.lossWatts/slow.watts>fast.lossWatts/fast.watts);
});

test('Inferred boil power reproduces measured time in an independent fine-step forward integration',()=>{
 for(const pan of ['iron','aluminum']){
  const seconds=300,ambient=18,startTemperature=12,boilingTemperature=98;
  const estimated=estimateBoilCalibration({seconds,ambient,startTemperature,boilingTemperature,pan});
  const waterArea=Math.PI*.14**2,panArea=waterArea+Math.PI*.294*Math.hypot(.014,.02),capacity=4180+PANS[pan].mass*PANS[pan].cp;
  let T=startTemperature;
  for(let i=0;i<seconds*100;i++){
   const loss=8*(waterArea+panArea)*(T-ambient)+5.670374419e-8*(.96*waterArea+PANS[pan].emissivity*panArea)*((T+273.15)**4-(ambient+273.15)**4);
   T+=(estimated.watts-loss)*.01/capacity;
  }
  near(T,boilingTemperature,.001);
 }
});

test('Wider test pans increase estimated area losses while preserving sensible heat storage',()=>{
 const small=estimateBoilCalibration({seconds:300,diameter:16}),large=estimateBoilCalibration({seconds:300,diameter:40});
 near(small.storedWatts,large.storedWatts);assert.ok(large.lossWatts>small.lossWatts);assert.ok(large.watts>small.watts);
});

test('One-litre estimate rejects missing, nonnumeric and out-of-range measurements',()=>{
 for(const input of [{},{seconds:NaN},{seconds:Infinity},{seconds:'240'},{seconds:null},{seconds:29},{seconds:1801},{seconds:240,startTemperature:-1},{seconds:240,startTemperature:61},{seconds:240,startTemperature:null},{seconds:240,boilingTemperature:79},{seconds:240,boilingTemperature:101},{seconds:240,ambient:41},{seconds:240,ambient:-1},{seconds:240,diameter:15},{seconds:240,diameter:41},{seconds:240,pan:'unknown'},{seconds:240,pan:'toString'}])assert.throws(()=>estimateBoilCalibration(input),RangeError);
});
