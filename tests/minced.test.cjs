const {test}=require('node:test');
const assert=require('node:assert/strict');
require('../src/physics.js');require('../src/runner.js');
const {Engine,MATERIALS}=globalThis.SteakPhysics;
const near=(a,b,tol=1e-8)=>assert.ok(Math.abs(a-b)<=tol,`${a} vs ${b}`);

test('Minced beef patty is a distinct selectable material with illustrative beef constants',()=>{
 const e=new Engine({meat:'minced'});assert.equal(e.config.meat,'minced');assert.equal(e.material.label,'Minced beef patty');
 for(const key of ['k','rho','cp','water'])assert.equal(MATERIALS.minced[key],MATERIALS.beef[key]);
 assert.notEqual(MATERIALS.minced,MATERIALS.beef);
});

test('Minced suggestion overrides target 52 and reaches a current whole-cut minimum of 75 before removal',()=>{
 const config={meat:'minced'},p=SteakRunner.suggest(config,52);
 assert.equal(p.target,75);assert.equal(p.preheat,175);assert.equal(p.guideline,75);assert.equal(p.reached,true);
 assert.ok(p.predicted.minAtRemoval>=75);assert.ok(p.predicted.atRemoval>=p.predicted.minAtRemoval);
 const replay=SteakRunner.run(config,p.events,p.duration),removed=replay.snapshots.find(x=>x.s.time===p.removed);
 assert.equal(replay.warnings.length,0);assert.ok(removed);assert.equal(removed.s.phase,'resting');assert.ok(removed.s.min>=75);
 near(removed.s.min,p.predicted.minAtRemoval,.03);assert.ok(p.events.some(e=>e.type==='rest'&&e.time===p.removed));
 assert.ok(replay.snapshots.every(x=>Number.isFinite(x.s.energyResidual)&&Math.abs(x.s.energyResidual)<1e-5));
});

test('Minced suggestion uses the same fixed criterion even when a higher target is requested',()=>{
 const config={meat:'minced',thickness:15,nr:8,nz:12},low=SteakRunner.suggest(config,52),high=SteakRunner.suggest(config,85);
 assert.equal(high.target,75);assert.equal(low.target,75);assert.deepEqual(high.events,low.events);assert.deepEqual(high.predicted,low.predicted);
 assert.ok(high.reached&&high.predicted.minAtRemoval>=75);
});

test('A thick patty that misses 75 within the planner bound is honestly marked unreached',()=>{
 const config={meat:'minced',thickness:60,diameter:22,aspect:1,initial:0,pan:'grill',contact:.5,nr:8,nz:12},p=SteakRunner.suggest(config,52);
 assert.equal(p.target,75);assert.equal(p.reached,false);assert.ok(p.predicted.minAtRemoval<75);
 assert.equal(p.duration,2700);assert.equal(p.removed+p.restSeconds,2700);assert.ok(p.removed>p.placed);
 const replay=SteakRunner.run(config,p.events,p.duration),last=replay.snapshots.at(-1).s;
 assert.equal(replay.warnings.length,0);assert.ok(Number.isFinite(last.core)&&Number.isFinite(last.pan));near(last.energyResidual,0,1e-5);
});

test('Manual minced-patty timelines retain early-rest freedom and conserve energy',()=>{
 const e=new Engine({meat:'minced',panInitial:230});assert.equal(e.action('add'),true);e.action('power',4);e.step(30);
 assert.ok(e.observe().min<75);assert.equal(e.action('rest','air'),true);e.action('power',0);e.step(90);
 assert.equal(e.phase,'resting');assert.ok(e.T.every(t=>Number.isFinite(t)&&t>=0));assert.ok(e.panT.every(Number.isFinite));near(e.observe().energyResidual,0,1e-5);
});
