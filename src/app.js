(() => {
'use strict';
const $=id=>document.getElementById(id),clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const icons={play:'M7 4l13 8-13 8Z',pause:'M8 5v14M16 5v14',reset:'M4 10a8 8 0 1 1 1 8M4 4v6h6',layers:'m12 3 10 6-10 6L2 9Zm-10 12 10 6 10-6M2 15l10 6 10-6',drop:'M12 2C9 7 5 11 5 15a7 7 0 0 0 14 0c0-4-4-8-7-13Z',plus:'M12 5v14M5 12h14',flip:'M5 8a8 8 0 0 1 14-2l2 3M21 3v6h-6M19 16a8 8 0 0 1-14 2l-2-3M3 21v-6h6',rest:'M3 17h18M5 17a7 7 0 0 1 14 0M12 7V5M9 21h6',heat:'M7 21c-8-6 5-9 1-17 9 6-1 8 4 12 0-4 4-5 4-9 9 9 2 15-9 14'};
function icon(name){return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${icons[name]||icons.plus}"/></svg>`;}
function fillIcons(root=document){root.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));}
const fmt=(v,n=0)=>Number(v).toLocaleString(SteakI18n.locale,{minimumFractionDigits:n,maximumFractionDigits:n});
const timeText=t=>`${Math.floor(Math.max(0,t)/60).toString().padStart(2,'0')}:${Math.floor(Math.max(0,t)%60).toString().padStart(2,'0')}`;
const palette={pan:'#f1bd71',faceA:'#f18b77',core:'#dcf589',faceB:'#8fc9ba',grid:'#333d30',text:'#9eac94'};
const FOOD_URL='https://www.foodsafety.gov/food-safety-charts/safe-minimum-internal-temperatures';
const DK_URL='https://www.foedevarestyrelsen.dk/kost-og-foedevarer/alt-om-mad/god-koekkenhygiejne/fem-raad-til-god-koekkenhygiejne/varm-mad-ordentligt-op';
const t=(key,values)=>SteakI18n.t(key,values);
const HELP=new Proxy({}, {get:(_,key)=>SteakI18n.help[key]});
let config={...SteakPhysics.DEFAULTS},duration=780,target=56,events=[],eventID=1,result=null,reference=null,current=0,running=false,view='heat',worker=null,generation=0,computeTimer=null,pending=false,lastFrame=0,lastPaint=0,toastTimer=null;
let frame=null,drawField=null,mesh=null,suggestion=null;
let colorMode='focus',actionMotion=null,motionQueue=[],manualAnimation=null,primePlayback=false;
let timelineRows={},timelineWidth=0,clearUndo=null,editorAnchor=null,editorApplyTimer=null;
const ACTION_ROW_HEIGHT=46;
icons.steak='M4 8c3-5 13-5 16 1s-1 11-7 11S1 14 4 8Zm3 1 2 6m3-8 2 9m3-6 1 4';
icons.spark='m12 2 2.8 7.2L22 12l-7.2 2.8L12 22l-2.8-7.2L2 12l7.2-2.8Z';
const DONENESS={minced:[[75,'Cooked through']],beef:[[52,'Rare'],[56,'Medium-rare'],[63,'Medium'],[71,'Well-done']],pork:[[63,'Juicy / medium'],[71,'Well-done']],chicken:[[75,'Cooked through'],[80,'Firm finish']],fish:[[63,'Cooked through'],[68,'Firm finish']]};
function planKey(){return JSON.stringify({config,target,events,duration});}
const eventNames={power:'Stove',oil:'Oil',add:'Add to pan',flip:'Flip',rest:'Rest'},eventIcons={power:'heat',oil:'drop',add:'steak',flip:'flip',rest:'rest'};
function showInfo(title,body,isHTML=false){$('infoTitle').textContent=t(title);$('infoBody').innerHTML=isHTML?body:`<p>${body}</p>`;if(SteakI18n.locale!=='en')SteakI18n.localize();if(!$('infoDialog').open)$('infoDialog').showModal();}
function modelInfo(){const rows=Object.values(SteakPhysics.MATERIALS).map(m=>`<tr><td>${t(m.label)}</td><td>${fmt(m.k,2)}</td><td>${m.rho}</td><td>${m.cp}</td></tr>`).join('');showInfo(t('Model assumptions and methods'),SteakI18n.model.replace('{materialRows}',rows)+SteakI18n.sources,true);}
function toast(message){$('toast').textContent=t(message);$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),3600);}
function rangeFill(el){el.style.setProperty('--fill',100*(+el.value-+el.min)/(+el.max-+el.min)+'%');}
const fields=[
 {id:'thickness',name:'Thickness',min:8,max:60,step:1,unit:'mm',ends:['Thin','Thick']},
 {id:'diameter',name:'Diameter · major axis',min:8,max:22,step:.5,unit:'cm',ends:['Small','Large']},
 {id:'aspect',name:'Shape · ellipse',min:.45,max:1,step:.01,unit:'',ends:['Oval','Round']},
 {id:'initial',name:'Initial temperature',min:0,max:30,step:1,unit:'°C',ends:['Fridge-cold','Warmer start']},
 {id:'contact',name:'Contact heat transfer',min:.5,max:1.5,step:.05,unit:'×',ends:['Loose / uneven','Good contact']}
];
function fieldValue(f){return f.id==='wetness'?`${fmt(config[f.id]*100)} %`:f.id==='aspect'?`${fmt(config[f.id],2)} · ${fmt(config.diameter*config.aspect,1)} cm`:fmt(config[f.id],f.step<1?f.id==='contact'?2:f.id==='diameter'?1:0:0)+' '+f.unit;}
function makeFields(){for(const [parent,group]of[[$('geometryFields'),fields.slice(0,4)],[$('physicalFields'),fields.slice(4)]])parent.innerHTML=group.map(f=>`<div class="field"><div class="field-label"><label for="${f.id}">${f.name} <button class="info" data-help="${f.id}" aria-label="About: ${f.name}">i</button></label><output id="${f.id}Value" for="${f.id}">${fieldValue(f)}</output></div><input id="${f.id}" type="range" min="${f.min}" max="${f.max}" step="${f.step}" value="${config[f.id]}"><div class="range-labels"><span>${f.ends[0]}</span><span>${f.ends[1]}</span></div></div>`).join('');}
function syncInputs(){for(const f of fields){$(f.id).value=config[f.id];$(f.id+'Value').textContent=fieldValue(f);rangeFill($(f.id));}$('panType').value=config.pan;$('duration').value=(duration/60).toFixed(2);$('target').value=target;rangeFill($('target'));document.querySelectorAll('[data-meat]').forEach(b=>{b.classList.toggle('selected',b.dataset.meat===config.meat);b.setAttribute('aria-pressed',b.dataset.meat===config.meat);});updateTarget();}
function updateTarget(){
 const minced=config.meat==='minced';if(minced)target=75;$('target').disabled=minced;$('donenessSelect').disabled=minced;$('target').value=target;rangeFill($('target'));$('targetLabel').textContent=minced?'Minimum throughout':'Your core target';
 $('donenessSelect').innerHTML=DONENESS[config.meat].map(([value,label])=>`<option value="${value}" ${target===value?'selected':''}>${t(label)}</option>`).join('')+(minced?'':`<option value="custom" ${!DONENESS[config.meat].some(([value])=>value===target)?'selected':''}>${t('Custom target')}</option>`);
 $('targetValue').textContent=target+' °C';$('coreTarget').textContent='Target: '+target+' °C';
 const bands=DONENESS[config.meat].find(([value])=>value===target)?.[1]||(config.meat==='beef'?(target<54?'Rare':target<59?'Medium-rare':target<65?'Medium':target<70?'Medium-well':'Well-done'):'Custom target');$('doneness').textContent=bands;
 const note=minced?'Minced beef patties must be cooked through. The model requires 75 °C at the coldest point before removal; verify real food with a thermometer.':config.meat==='chicken'?'Poultry: cook thoroughly; Danish guidance uses 75 °C.':config.meat==='fish'?'Fish: FoodSafety.gov gives 63 °C as minimum-temperature guidance.':'Whole cuts: FoodSafety.gov gives 63 °C and at least a 3-minute rest.';
 $('safetyNote').innerHTML=t(note)+' '+t('A modeled core target is not a food-safety test. Check real food at its coldest point with a thermometer.')+' <a href="'+(['chicken','minced'].includes(config.meat)?DK_URL:FOOD_URL)+'" target="_blank" rel="noopener">'+t('Read the guidance')+' ↗</a>';
 if(result)render();
}
function preset(name,initial=false){
 clearMotion();$('scenarioSelect').value=name;
 const add=(time,type,value)=>({id:eventID++,time,type,value});
 if(name==='cold')events=[add(0,'oil',10),add(0,'add'),add(0,'power',6),add(180,'flip'),add(240,'power',3),add(300,'flip'),add(420,'flip'),add(540,'flip'),add(600,'rest'),add(600,'power',0)];
 else{events=[add(0,'power',12),add(100,'oil',10),add(105,'add'),add(110,'power',5),add(200,'power',3)];const flips=name==='frequent'?Array.from({length:14},(_,i)=>135+i*30):[195,315,435];events.push(...flips.map(t=>add(t,'flip')),add(555,'rest'),add(555,'power',0));}
 duration=780;events.sort((a,b)=>a.time-b.time||a.id-b.id);current=initial?0:clamp(current,0,duration);running=false;syncPlay();$('duration').value=13;document.querySelectorAll('[data-preset]').forEach(b=>b.classList.toggle('selected',b.dataset.preset===name));renderEvents();if(!initial)compute();
}
const restNames={air:'Open air',foil:'Foil tent',pan:'On pan · heat off'};
function eventDescription(e){return eventNames[e.type]+(e.type==='rest'?' · '+(restNames[e.value]||restNames.air):'')+(e.type==='power'?' '+Math.round(stoveWatts(e.value))+' W':e.type==='oil'?' '+e.value+' g':'');}
function markerLabel(e){return e.type==='power'?Math.round(stoveWatts(e.value))+' W':e.type==='oil'?'Oil · '+e.value+' g':e.type==='add'?'Add':eventNames[e.type];}
function freeActionRow(id,time,preferred=0){return SteakDisplay.freeActionRow(events,timelineRows,id,time,preferred,$('eventTrack').clientWidth||420,duration);}
function setDragGuide(time,row){const guide=$('timelineDragGuide');if(!guide)return;guide.hidden=false;guide.style.left=100*time/duration+'%';guide.querySelector('span').textContent=timeText(time);$('eventTrack').style.setProperty('--drop-row',row);}
function hideDragGuide(){if($('timelineDragGuide'))$('timelineDragGuide').hidden=true;$('eventTrack').style.removeProperty('--drop-row');}
function layoutEvents(){
 const track=$('eventTrack'),scroll=$('timelineScroll'),canvas=$('timelineCanvas');canvas.style.width=Math.max(350,scroll.clientWidth)+'px';
 const width=track.clientWidth||420,previous=timelineRows;
 if(Math.abs(width-timelineWidth)>1){timelineRows={};for(const e of events)timelineRows[e.id]=freeActionRow(e.id,e.time,previous[e.id]??0);}
 timelineWidth=width;for(const e of events)if(timelineRows[e.id]===undefined)timelineRows[e.id]=freeActionRow(e.id,e.time);
 const count=Math.max(3,...events.map(e=>timelineRows[e.id]+1));track.style.setProperty('--track-height',count*ACTION_ROW_HEIGHT+'px');
 const tickStep=duration/Math.max(1,Math.floor(width/55)),niceStep=[15,30,60,120,300,600].find(v=>v>=tickStep)||900,ticks=[];
 for(let time=0;time<=duration;time+=niceStep)ticks.push(time);if(ticks.at(-1)!==duration){if((duration-ticks.at(-1))*width/duration<55)ticks.pop();ticks.push(duration);}
 $('timelineAxis').innerHTML=ticks.map(time=>`<button type="button" data-time="${time}" style="left:${100*time/duration}%" aria-label="${t('View at')} ${timeText(time)}">${timeText(time)}</button>`).join('');
 track.style.setProperty('--tick-width',niceStep/duration*width+'px');
 track.innerHTML='<div id="timelineCursor" class="timeline-cursor" aria-hidden="true" style="left:'+100*current/duration+'%"></div><div id="timelineDragGuide" class="timeline-drag-guide" hidden><span></span></div>'+(events.length?'':'<p class="empty-plan">'+t('Drag a tool here to start your plan.')+'</p>')+events.map(e=>{
  const disabled=e.enabled===false,name=t('Edit')+' '+eventDescription(e)+' '+t('at')+' '+timeText(e.time)+(disabled?' · '+t('Disabled'):'');
  return `<button class="event-marker event-${e.type} ${disabled?'muted-event':''}" data-event-id="${e.id}" data-event-ids="${e.id}" data-seek="${e.time}" style="left:${100*e.time/duration}%;top:${timelineRows[e.id]*ACTION_ROW_HEIGHT+3}px" title="${name}" aria-label="${name}" aria-haspopup="dialog"><span class="event-dot">${icon(eventIcons[e.type])}</span><span class="marker-label">${t(e.type==='oil'?e.value+' g':markerLabel(e))}</span></button>`;
 }).join('');$('clearPlan').disabled=!events.length;const palette=document.querySelector('.plan-workspace .toolbox'),workspace=document.querySelector('.plan-workspace');const toolOffset=palette.querySelector('[data-tool]').getBoundingClientRect().top-palette.getBoundingClientRect().top;palette.style.marginTop=Math.max(0,track.getBoundingClientRect().top+3-workspace.getBoundingClientRect().top-toolOffset)+'px';
}
function renderEvents(){
 $('eventRows').innerHTML=events.map(e=>`<div class="event-row ${e.enabled===false?'muted-event':''}" data-id="${e.id}"><input class="event-enabled" type="checkbox" ${e.enabled===false?'':'checked'} aria-label="Include ${eventDescription(e)} at ${timeText(e.time)}"><span class="event-time-readout">${timeText(e.time)}</span><button type="button" class="event-kind event-${e.type}" data-edit-event="${e.id}">${icon(eventIcons[e.type])}<span>${t(eventDescription(e))}</span></button><button class="remove-event" aria-label="Remove action at ${timeText(e.time)}">×</button></div>`).join('');
 $('scrub').max=duration;$('endClock').textContent='/ '+timeText(duration);layoutEvents();
 if(SteakI18n.locale!=='en')SteakI18n.localize();
}
let editedEvent=null,dragEvent=null,suppressTimelineClickUntil=0,lastDraggedId=null;
function eventEditorType(resetValue=false){
 const type=$('editActionType').value,numeric=['power','oil'].includes(type);
 $('editAmountField').hidden=!numeric;$('editRestField').hidden=type!=='rest';$('editAmountLabel').textContent=t(type==='power'?'Power':'Amount');$('editActionAmount').setAttribute('aria-label',t(type==='power'?'Heat input (watts)':'Oil (grams)'));$('editActionAmount').max=type==='power'?config.maxHeatWatts:30;$('editActionAmount').step=1;
 if(resetValue)$('editActionAmount').value=type==='power'?Math.round(stoveWatts(6)):10;
 const hints={power:'Set the stove power from this moment onward. It stays there until the next stove action.',oil:'Add this amount of oil at the chosen time.',add:'Place the ingredient on the pan, with side A facing down.',flip:'Turn the meat over once. Its temperature and crust stay with each physical side.',rest:'Choose how the meat rests. Open air and foil remove it from the pan; staying on the pan switches the stove off while the hot metal keeps transferring heat.'};
 $('editActionHint').textContent=t(hints[type]);$('editActionSymbol').innerHTML=icon(eventIcons[type]);$('editActionSymbol').className='event-editor-symbol event-'+type;updateEditorAmount();
}
function updateEditorAmount(){const input=$('editActionAmount');rangeFill(input);$('editAmountValue').textContent=input.value+($('editActionType').value==='power'?' W · '+fmt(stoveSetting(+input.value)/12*stoveProfile.maxStep,1)+'/'+stoveProfile.maxStep:' g');}
function openEventEditor(id=null,type='flip',atTime=null){
 closeActionEditor();$('planDialog').close();editedEvent=events.find(e=>e.id===id)||null;if(!editedEvent&&events.length>=80){toast('A plan can contain up to 80 actions.');return;}
 const entry=editedEvent||{id:eventID++,time:atTime??Math.round(current),type,enabled:true,value:type==='power'?6:type==='oil'?10:type==='rest'?'air':undefined};if(!editedEvent){events.push(entry);editedEvent=entry;manualAnimation=entry.id;changedEvents();}
 running=false;clearMotion();syncPlay();$('eventDialogTitle').textContent=t(eventNames[entry.type]);$('saveAction').hidden=true;
 $('editActionType').value=entry.type;$('editActionName').textContent=t(eventNames[entry.type]);$('editRestMode').value=restNames[entry.value]?entry.value:'air';$('editActionTime').value=entry.time;$('editActionAmount').max=entry.type==='power'?config.maxHeatWatts:30;$('editActionAmount').step=1;$('editActionAmount').value=Number.isFinite(entry.value)?(entry.type==='power'?Math.round(stoveWatts(entry.value)):entry.value):10;$('editActionEnabled').checked=entry.enabled!==false;$('deleteAction').hidden=!editedEvent;$('actionError').hidden=true;eventEditorType();
 editorAnchor=editedEvent?document.querySelector('[data-event-id="'+editedEvent.id+'"]'):document.querySelector('[data-tool="'+type+'"]');
 if(SteakI18n.locale!=='en')SteakI18n.localize();if(!$('eventDialog').open)$('eventDialog').show();positionEventEditor();if(['power','oil'].includes(entry.type))$('editActionAmount').focus();else $('cancelAction').focus();
}
function positionEventEditor(){
 const dialog=$('eventDialog');if(!dialog.open||!editorAnchor)return;const a=editorAnchor.getBoundingClientRect(),r=dialog.getBoundingClientRect(),above=a.top>=r.height+12;
 dialog.style.left=clamp(a.left+a.width/2-r.width/2,8,innerWidth-r.width-8)+'px';dialog.style.top=clamp(above?a.top-r.height-8:a.bottom+8,8,innerHeight-r.height-8)+'px';
}
function changedEvents(){clearMotion();$('scenarioSelect').value='custom';events.sort((a,b)=>a.time-b.time||a.id-b.id);renderEvents();compute();}
function moveEvent(entry,time,row){entry.time=clamp(Math.round(time),0,duration);timelineRows[entry.id]=row??freeActionRow(entry.id,entry.time,timelineRows[entry.id]??0);changedEvents();}
async function compute(){
 const id=++generation;clearMotion();pending=true;running=false;syncPlay();$('computeStatus').textContent=t('Calculating heat flow …');$('computeStatus').hidden=false;$('suggestPlan').disabled=true;if(worker){worker.terminate();worker=null;}
 const complete=r=>{if(id!==generation)return;result=r;mesh=r.mesh;current=clamp(current,0,duration);pending=false;$('computeStatus').hidden=true;$('planWarnings').hidden=!r.warnings.length;$('planWarnings').textContent=r.warnings.length?'Not performed in this sequence: '+r.warnings.map(a=>eventNames[a.type]+' at '+timeText(a.time)).join(', ')+'. Edit the cooking plan.':'';render();if(manualAnimation){const a=events.find(e=>e.id===manualAnimation);manualAnimation=null;if(a&&Math.abs(a.time-current)<=.5&&!r.warnings.some(w=>w.type===a.type&&w.time===a.time))queueMotions([a],performance.now());}if(r.warnings.length)toast(`${r.warnings.length} action(s) could not run in this sequence. Check the cooking plan.`);};
 const fallback=async()=>{try{const j=SteakRunner.prepare(config,events,duration);while(j.engine.time<j.end){if(id!==generation)return;SteakRunner.advance(j,Math.min(j.end,j.engine.time+30));await new Promise(resolve=>setTimeout(resolve,0));}complete(SteakRunner.finish(j));}catch(err){fail(err);}};
 const fail=err=>{if(id!==generation)return;pending=false;$('computeStatus').hidden=true;$('suggestPlan').disabled=false;toast('Calculation stopped: '+err.message);console.error(err);};
 try{
  const source=$('physics-code').textContent+'\n'+$('runner-code').textContent+'\nonmessage=e=>{try{postMessage({result:SteakRunner.run(e.data.config,e.data.events,e.data.duration)});}catch(error){postMessage({error:error.message});}};';
  const url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));worker=new Worker(url);URL.revokeObjectURL(url);
  worker.onmessage=e=>{if(id!==generation)return;if(e.data.error){fail(new Error(e.data.error));}else complete(e.data.result);worker?.terminate();worker=null;};
  worker.onerror=()=>{if(id!==generation)return;worker?.terminate();worker=null;fallback();};worker.postMessage({config,events,duration});
 }catch{fallback();}
}
async function suggestPlan(){
 if(pending)return;clearMotion();clearTimeout(computeTimer);const id=++generation,signature=JSON.stringify({config,target});pending=true;running=false;syncPlay();$('suggestPlan').disabled=true;$('computeStatus').textContent=t('Testing a cooking plan and its carryover heat …');$('computeStatus').hidden=false;
 const finish=p=>{if(id!==generation||!p)return;if(signature!==JSON.stringify({config,target})){pending=false;$('suggestPlan').disabled=false;$('computeStatus').hidden=true;toast('Settings changed. Request a new suggestion.');return;}events=p.events.map(e=>({...e,id:eventID++}));duration=p.duration;current=clamp(current,0,duration);$('duration').value=(duration/60).toFixed(2);suggestion={...p,key:planKey()};$('scenarioSelect').value='custom';document.querySelectorAll('[data-preset]').forEach(b=>b.classList.remove('selected'));renderEvents();renderSuggestion();compute();toast(p.reached?'A plan for your cut is ready. Play it, then experiment.':'The target was not reached within 45 minutes. Review the trial plan.');};
 const fail=err=>{if(id!==generation)return;pending=false;$('computeStatus').hidden=true;$('suggestPlan').disabled=false;toast('Plan calculation stopped: '+err.message);};
 const fallback=()=>SteakRunner.suggestAsync(config,target,()=>id!==generation).then(finish).catch(fail);
 try{if(worker)worker.terminate();const source=$('physics-code').textContent+'\n'+$('runner-code').textContent+'\nonmessage=e=>{try{postMessage({proposal:SteakRunner.suggest(e.data.config,e.data.target)});}catch(error){postMessage({error:error.message});}};';const url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));worker=new Worker(url);URL.revokeObjectURL(url);worker.onmessage=e=>{if(id!==generation)return;worker.terminate();worker=null;if(e.data.error)fail(new Error(e.data.error));else finish(e.data.proposal);};worker.onerror=()=>{if(id!==generation)return;worker.terminate();worker=null;fallback();};worker.postMessage({config,target});}catch{fallback();}
}
function renderSuggestion(){const box=$('suggestionSummary'),chip=$('planSummaryChip');if(!suggestion||suggestion.key!==planKey()){box.hidden=true;chip.hidden=true;return;}box.hidden=false;chip.hidden=false;const p=suggestion;chip.textContent=config.meat==='minced'?t('Coldest point at removal: {temp} °C',{temp:fmt(p.predicted.minAtRemoval,1)}):t('Suggested: rest at {time} · peak core {temp} °C',{time:timeText(p.removed),temp:fmt(p.predicted.peak,1)});box.innerHTML=`<strong>${t(p.reached?'YOUR MODEL-BASED PLAN':'TARGET NOT REACHED IN 45 MIN')}</strong><div>${t('Preheat contact area to {temp} °C',{temp:p.preheat})} · ${t('add at {time}',{time:timeText(p.placed)})}</div><div>${t('Flip every minute · rest from {time}',{time:timeText(p.removed)})}</div><div>${t('Rest for {time}',{time:timeText(p.restSeconds)})}</div><p>${t('Predicted peak core: {temp} °C',{temp:fmt(p.predicted.peak,1)})}<br>${t('Core when removed: {temp} °C',{temp:fmt(p.predicted.atRemoval,1)})}<br>${t('Coldest point when removed: {temp} °C',{temp:fmt(p.predicted.minAtRemoval,1)})}</p><small>${t(config.meat==='minced'?'This targets 75 °C at the simulated coldest point before removal. Verify real food with a thermometer.':'This targets the simulated center, not proven safe cooking. Use a real thermometer and the guidance below.')}</small>`;}
function requestCompute(){clearTimeout(computeTimer);running=false;syncPlay();computeTimer=setTimeout(compute,120);}
function snapshotAt(t){const list=result.snapshots;let lo=0,hi=list.length-1;while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(list[mid].s.time<=t)lo=mid;else hi=mid-1;}const a=list[lo],b=list[Math.min(lo+1,list.length-1)],f=b.s.time>a.s.time?clamp((t-a.s.time)/(b.s.time-a.s.time),0,1):0;const s={...a.s};for(const key of ['pan','panContactTemp','burnerWatts','core','min','max','faceA','faceB','brownA','brownB','burnA','burnB','evaporated'])s[key]=a.s[key]+(b.s[key]-a.s[key])*f;s.time=t;const T=new Float32Array(a.T.length);for(let i=0;i<T.length;i++)T[i]=a.T[i]+(b.T[i]-a.T[i])*f;s.min=Math.min(...T);s.max=Math.max(...T);if(a.s.panField?.length){s.panField=Float32Array.from(a.s.panField,(value,i)=>value+((b.s.panField?.[i]??value)-value)*f);s.panMin=Math.min(...s.panField);s.panMax=Math.max(...s.panField);s.panRim=s.panField[s.panField.length-1];}return{s,T,dA:a.dA,dB:a.dB};}
function syncPlay(){$('play').innerHTML=icon(running?'pause':'play')+(running?'Pause':current>=duration?'Play again':current>0?'Continue':'Start experiment');}
function seek(t){clearMotion();current=clamp(t,0,duration);running=false;syncPlay();render();}
function scheduleNow(type,value){if(!result||pending)return;const phase=frame.s.phase;if(type==='add'&&phase!=='ready'||['flip','rest'].includes(type)&&phase!=='cooking'){toast(type==='add'?'The ingredient is already on the pan.':'Add the ingredient to the pan first.');return;}const t=Math.round(current);if(type==='power')events=events.filter(e=>!(e.type==='power'&&e.time===t));const event={id:eventID++,time:t,type,value};events.push(event);manualAnimation=event.id;$('scenarioSelect').value='custom';events.sort((a,b)=>a.time-b.time||a.id-b.id);renderEvents();compute();toast(eventDescription({type,value})+' at '+timeText(t)+' was added to the plan.');}
function render(){
 if(!result)return;frame=snapshotAt(current);drawField=frame.T;const s=frame.s;
 for(const [id,key]of[['panTemp','pan'],['faceATemp','faceA'],['coreTemp','core'],['faceBTemp','faceB']])$(id).innerHTML=fmt(s[key])+'<span>°C</span>';
 if($('panRange')){$('panRange').textContent=Number.isFinite(s.panMin)?fmt(s.panMin)+'–'+fmt(s.panMax)+' °C':'';$('panRange').title=t('Local pan range')+' · '+t('Rim')+': '+fmt(s.panRim??s.pan)+' °C';$('panTemp').title=t('Capacity-weighted mean pan temperature');}
 $('massLabel').textContent='approx. '+fmt(s.mass)+' g';$('clock').textContent=timeText(current);$('scrub').value=current;rangeFill($('scrub'));
 $('phaseBadge').innerHTML='<span class="status-dot"></span>'+(s.phase==='ready'?'Preheating · ingredient waiting':s.phase==='resting'?'Resting · '+(s.restMode==='pan'?'on the pan':s.restMode==='foil'?'under loose foil':'open air / rack'):'Cooking · side '+(s.bottomSide===0?'A':'B')+' against the pan');
 $('coldest').textContent=fmt(s.min,1)+' °C';$('gradient').textContent=fmt(s.max-s.min)+' °C';$('targetStatus').textContent=config.meat==='minced'?(s.min>=75||result.snapshots.some(p=>p.s.time<=current&&p.s.min>=75)?'75 °C reached':'Not cooked through'):s.core>=target?'Core target reached':'To go: '+fmt(target-s.core)+' °C';
 document.querySelectorAll('.event-marker').forEach(b=>b.classList.toggle('past',+b.dataset.seek<=current));
 if($('timelineCursor'))$('timelineCursor').style.left=100*current/duration+'%';
 document.querySelectorAll('[data-action]').forEach(b=>b.disabled=pending||(b.dataset.action==='add'?s.phase!=='ready':['flip','rest'].includes(b.dataset.action)?s.phase!=='cooking':false));
 $('suggestPlan').disabled=pending;renderSuggestion();drawScene();drawHistory();drawProfile();if(SteakI18n.locale!=='en')SteakI18n.localize();
}
function canvasSetup(id){const canvas=$(id),rect=canvas.getBoundingClientRect(),w=rect.width,h=rect.height,dpr=Math.min(window.devicePixelRatio||1,2);if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);return{ctx,w,h,canvas};}
function sample(r,z,T=drawField){r=clamp(r,0,1)*mesh.nr;z=clamp(z,0,1)*mesh.nz;const i=Math.min(Math.floor(r),mesh.nr-1),j=Math.min(Math.floor(z),mesh.nz-1),x=r-i,y=z-j,n=j*(mesh.nr+1)+i,a=T[n],b=T[n+1],c=T[n+mesh.nr+2],d=T[n+mesh.nr+1];return y<=x?a*(1-x)+b*(x-y)+c*y:a*(1-y)+c*x+d*(y-x);}
function heatRGB(value){return SteakDisplay.heatRGB(value,colorMode);}
function updateColorScale(){
 const stops=SteakDisplay.legendStops(colorMode);$('scaleGradient').style.background='linear-gradient(var(--scale-direction,90deg),'+stops.map(s=>'rgb('+s.color.join(',')+') '+100*s.position+'%').join(',')+')';
 const ticks=colorMode==='focus'?[0,40,50,60,70,80,220]:[0,50,100,150,220];$('scaleTicks').innerHTML=ticks.map(temp=>'<span data-edge="'+(temp===0?'min':temp===220?'max':'')+'" style="--position:'+100*SteakDisplay.scalePosition(temp,colorMode)+'%">'+temp+(temp===220?'+':'')+'</span>').join('');
}
function heatColor(t){return' rgb('+heatRGB(t).join(',')+')';}
const mix=(a,b,f)=>a.map((v,i)=>v+(b[i]-v)*clamp(f,0,1));
function texture(r,x,y,side){
 const doses=side===0?frame.dA:frame.dB;const p=clamp(r,0,.9999)*(doses.length-1),i=Math.floor(p),dose=doses[i]+(doses[i+1]-doses[i])*(p-i);
 const brown=1-Math.exp(-dose),burn=1-Math.exp(-Math.max(0,dose-3)*.7),temp=sample(r,side);
 const raw=config.meat==='fish'?[215,135,99]:config.meat==='chicken'?[216,176,155]:config.meat==='pork'?[192,121,115]:[161,65,65];
 const cooked=['beef','minced'].includes(config.meat)?[168,127,98]:[215,192,156];let rgb=mix(raw,cooked,clamp((temp-40)/45,0,1)*.9);rgb=mix(rgb,[133,74,32],brown);rgb=mix(rgb,[45,32,21],burn);
 const hash=Math.sin(x*12.9898+y*78.233)*43758.5453,noise=2*(hash-Math.floor(hash))-1,fleck=noise*11+Math.sin(x*.17+3*Math.sin(y*.37))*Math.sin(y*.27+2*Math.sin(x*.29))*7; if(config.meat==='beef'&&Math.abs(Math.sin(x*.08+1.8*Math.sin(y*.06)))<.08)rgb=mix(rgb,[225,204,164],.3*(1-brown*.8));
 if(config.pan==='grill'){const stripe=Math.cos((x+y*.24)*.17);if(stripe>.57)rgb=mix(rgb,[49,30,18],brown*.86);else rgb=mix(raw,rgb,.55);}
 return rgb.map(v=>clamp(v+fleck,0,255));
}
const offscreen=document.createElement('canvas');
function rasterEllipse(ctx,cx,cy,rx,ry,side,heat=false){
 const iw=Math.max(60,Math.round(rx*2)),ih=Math.max(40,Math.round(ry*2));offscreen.width=iw;offscreen.height=ih;const oc=offscreen.getContext('2d'),im=oc.createImageData(iw,ih);
 for(let y=0;y<ih;y++)for(let x=0;x<iw;x++){const xx=(x/iw-.5)*2,yy=(y/ih-.5)*2,r=Math.sqrt(xx*xx+yy*yy);if(r>1)continue;let rgb=heat?heatRGB(sample(r,side)):texture(r,x,y,side);const shade=.86+.14*Math.sqrt(1-r*r)+.06*(1-yy);const n=4*(y*iw+x);im.data[n]=rgb[0]*shade;im.data[n+1]=rgb[1]*shade;im.data[n+2]=rgb[2]*shade;im.data[n+3]=255;}
 oc.putImageData(im,0,0);ctx.drawImage(offscreen,cx-rx,cy-ry,rx*2,ry*2);ctx.beginPath();ctx.ellipse(cx,cy,rx,ry,0,0,Math.PI*2);ctx.strokeStyle=heat?'#c7e4b144':'#e4c29a66';ctx.lineWidth=1.5;ctx.stroke();
 if(heat){ctx.lineWidth=.8;for(const level of [40,55,65,100,140,180]){let prev=sample(0,side)-level;for(let k=1;k<=100;k++){const v=sample(k/100,side)-level;if(v*prev<0){ctx.beginPath();ctx.ellipse(cx,cy,rx*k/100,ry*k/100,0,0,Math.PI*2);ctx.strokeStyle='#eff8e8a0';ctx.stroke();}prev=v;}}}
}
function label(ctx,text,x,y,color='#9caa91',size=11,align='left'){ctx.fillStyle=color;ctx.font=`${Math.max(11,size)}px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif`;ctx.textAlign=align;ctx.fillText(t(text),x,y);}
function drawScene(){
 const width=$('scene').getBoundingClientRect().width,compact=matchMedia('(min-width:1100px) and (min-height:620px)').matches,sectionHeight=width*.66*config.thickness/(config.diameter*10);
 $('scene').parentElement.style.height=compact?'':(width<560?384+sectionHeight:350)+'px';
 const {ctx,w,h}=canvasSetup('scene');
 SteakScene.draw({ctx,w,h,compact,config,frame,mesh,panMesh:result.panMesh,T:drawField,sample,heatRGB,texture,rasterEllipse,label,fmt,mode:view,t,motion:actionMotion});
}
function axes(ctx,w,h,ymax,xmax,xlabel){const l=42,r=19,t=22,b=31;const X=v=>l+v/xmax*(w-l-r),Y=v=>h-b-v/ymax*(h-t-b);ctx.lineWidth=1;for(let i=0;i<=4;i++){const v=i*ymax/4,y=Y(v);ctx.beginPath();ctx.moveTo(l,y);ctx.lineTo(w-r,y);ctx.strokeStyle=palette.grid;ctx.stroke();label(ctx,fmt(v),l-9,y+3,palette.text,9,'right');}for(let i=0;i<=4;i++)label(ctx,fmt(i*xmax/4,i*xmax/4%1?1:0),X(i*xmax/4),h-12,palette.text,9,'center');label(ctx,'°C',l-12,12,palette.text,9,'right');return{X,Y,l,r,t,b};}
function temperatureGradient(ctx,x0,y0,x1,y1,maxT){
 const gradient=ctx.createLinearGradient(x0,y0,x1,y1);
 // Positions follow the graph's temperature coordinate, never uniform palette spacing.
 for(const stop of SteakDisplay.legendStops(colorMode))if(stop.temperature<maxT)gradient.addColorStop(stop.temperature/maxT,'rgb('+stop.color.join(',')+')');
 gradient.addColorStop(1,heatColor(maxT));return gradient;
}
function drawHistory(){const{ctx,w,h}=canvasSetup('history');let maximum=target;for(const p of result.snapshots)maximum=Math.max(maximum,p.s.pan,p.s.faceA,p.s.faceB);const ymax=Math.max(100,Math.ceil(maximum/50)*50),{X,Y,l,r}=axes(ctx,w,h,ymax,duration/60);ctx.fillStyle=temperatureGradient(ctx,0,Y(0),0,Y(ymax),ymax);ctx.fillRect(l-6,Y(ymax),5,Y(0)-Y(ymax));ctx.save();ctx.beginPath();ctx.rect(l,20,w-l-r,h-50);ctx.clip();ctx.setLineDash([4,5]);ctx.strokeStyle='#dcf58966';ctx.beginPath();ctx.moveTo(l,Y(target));ctx.lineTo(w-r,Y(target));ctx.stroke();ctx.setLineDash([]);for(const e of events.filter(e=>e.enabled!==false&&['add','flip','rest'].includes(e.type))){ctx.beginPath();ctx.moveTo(X(e.time/60),22);ctx.lineTo(X(e.time/60),h-31);ctx.strokeStyle='#c9d0b21b';ctx.stroke();}
 if(reference){ctx.setLineDash([5,5]);ctx.strokeStyle='#e8e9db70';ctx.lineWidth=1.5;ctx.beginPath();reference.snapshots.forEach((p,i)=>{const x=X(p.time/60),y=Y(p.core);i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.stroke();ctx.setLineDash([]);}
 for(const key of ['pan','faceA','faceB','core']){ctx.beginPath();result.snapshots.forEach((p,i)=>{const x=X(p.s.time/60),y=Y(p.s[key]);i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.strokeStyle=palette[key];ctx.lineWidth=key==='core'?2.2:1.4;ctx.stroke();}
 ctx.beginPath();ctx.moveTo(X(current/60),22);ctx.lineTo(X(current/60),h-31);ctx.strokeStyle='#e8efdd88';ctx.lineWidth=1;ctx.stroke();for(const key of ['pan','faceA','faceB','core']){ctx.beginPath();ctx.arc(X(current/60),Y(frame.s[key]),3,0,Math.PI*2);ctx.fillStyle=palette[key];ctx.fill();}ctx.restore();label(ctx,'TARGET '+target+'°',w-r-4,Y(target)-5,'#dcf58999',8,'right');}
function drawProfile(){
 // Material coordinates stay fixed: B at the top, A at the bottom, even after a flip.
 // One temperature range for the complete run prevents rescaling during playback.
 let maximum=Math.max(100,target);for(const p of result.snapshots)maximum=Math.max(maximum,p.s.max);
 const {ctx,w,h}=canvasSetup('profile'),maxT=Math.ceil(maximum/25)*25,l=52,r=17,top=38,bottom=17,H=config.thickness;
 const X=temp=>l+temp/maxT*(w-l-r),Y=depth=>top+depth/H*(h-top-bottom);
 for(let i=0;i<=4;i++){const value=i*maxT/4,x=X(value);ctx.beginPath();ctx.moveTo(x,top);ctx.lineTo(x,h-bottom);ctx.strokeStyle=palette.grid;ctx.lineWidth=.7;ctx.stroke();label(ctx,fmt(value),x,top-11,palette.text,10,'center');}
 for(let i=0;i<=4;i++){const depth=i*H/4,y=Y(depth);ctx.beginPath();ctx.moveTo(l,y);ctx.lineTo(w-r,y);ctx.strokeStyle=palette.grid;ctx.stroke();label(ctx,fmt(depth,depth%1?1:0),l-8,y+3,palette.text,9,'right');}
 label(ctx,'mm',l-8,11,palette.text,9,'right');label(ctx,'°C',w-r,11,palette.text,10,'right');
 ctx.fillStyle=temperatureGradient(ctx,l,0,w-r,0,maxT);ctx.fillRect(l,top-7,w-l-r,4);
 ctx.save();ctx.beginPath();ctx.rect(l,top,w-l-r,h-top-bottom);ctx.clip();
 ctx.fillStyle='#d9f0920c';ctx.fillRect(l,Y(H*.45),w-l-r,Y(H*.55)-Y(H*.45));
 ctx.beginPath();ctx.setLineDash([3,4]);ctx.moveTo(X(target),top);ctx.lineTo(X(target),h-bottom);ctx.strokeStyle='#d3ee8077';ctx.stroke();ctx.setLineDash([]);
 const points=[];for(let j=0;j<=mesh.nz;j++){const index=mesh.nz-j;points.push([X(drawField[index*(mesh.nr+1)]),Y(j/mesh.nz*H)]);}
 const gradient=ctx.createLinearGradient(l,0,w-r,0);gradient.addColorStop(0,'#dff18900');gradient.addColorStop(1,'#dff18932');ctx.beginPath();ctx.moveTo(l,top);points.forEach(p=>ctx.lineTo(...p));ctx.lineTo(l,h-bottom);ctx.closePath();ctx.fillStyle=gradient;ctx.fill();
 ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.strokeStyle=palette.core;ctx.lineWidth=2;ctx.stroke();ctx.beginPath();ctx.arc(X(frame.s.core),Y(H/2),3,0,Math.PI*2);ctx.fillStyle=palette.core;ctx.fill();ctx.restore();
 // Boundary colors match the A/B temperature-history curves and remain attached
 // to the physical sides when the meat is flipped.
 for(const [name,y,color,endpoint] of [['B',top,palette.faceB,points[0]],['A',h-bottom,palette.faceA,points.at(-1)]]){
  ctx.beginPath();ctx.moveTo(l,y);ctx.lineTo(w-r,y);ctx.strokeStyle=color;ctx.lineWidth=2.2;ctx.stroke();
  ctx.beginPath();ctx.arc(15,y,10,0,Math.PI*2);ctx.fillStyle=color+'24';ctx.fill();ctx.strokeStyle=color;ctx.lineWidth=1.3;ctx.stroke();label(ctx,name,15,y+4,color,14,'center');
  ctx.beginPath();ctx.arc(endpoint[0],endpoint[1],3.5,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();
 }

}

// All controls change model inputs or the deterministic action schedule.

const stoveStorageKey='steaklab.stove-profiles.v1';
let stoveProfiles={},stoveProfile={maxStep:12,maxHeatWatts:1800,powerExponent:1,name:'Model defaults'};
try{stoveProfiles=JSON.parse(localStorage.getItem(stoveStorageKey)||'{}')||{};if(typeof stoveProfiles!=='object'||Array.isArray(stoveProfiles))stoveProfiles={};}catch{}
function stoveWatts(level){return config.maxHeatWatts*Math.pow(clamp(level/12,0,1),config.powerExponent);}
function stoveSetting(watts){return 12*Math.pow(clamp(watts/config.maxHeatWatts,0,1),1/config.powerExponent);}
function loadStoveProfile(){const p=stoveProfiles[config.pan]||{};const n=new SteakPhysics.Engine({maxHeatWatts:p.maxHeatWatts??1800,powerExponent:p.powerExponent??1}).config;stoveProfile={name:typeof p.name==='string'?p.name:'Model defaults',maxStep:Number.isInteger(p.maxStep)&&p.maxStep>=1&&p.maxStep<=20?p.maxStep:12,maxHeatWatts:n.maxHeatWatts,powerExponent:n.powerExponent,boil:p.boil||null,manual:p.manual||null};config.maxHeatWatts=n.maxHeatWatts;config.powerExponent=n.powerExponent;}
function updateStoveNote(){const p=+$('stoveCurve').value,w=+$('stoveWatts').value;$('stoveCurveNote').textContent='At half the numbered scale: '+Math.round(w*Math.pow(.5,p))+' W ('+Math.round(100*Math.pow(.5,p))+'%). Curve is assumed, not measured by the boiling test.';}
function openStove(){pendingBoil=stoveProfile.boil;pendingManual=stoveProfile.manual;closeActionEditor();$('stoveName').value=stoveProfile.name;$('stoveSteps').value=stoveProfile.maxStep;$('stoveWatts').value=Math.round(config.maxHeatWatts);$('stoveCurve').value=config.powerExponent===2?'2':'1';$('calibrationPan').textContent='Selected pan: '+SteakPhysics.PANS[config.pan].label+' · '+SteakPhysics.PANS[config.pan].mass+' kg';const b=stoveProfile.boil;if(b){$('boilMinutes').value=b.seconds/60;$('boilStart').value=b.startTemperature;$('boilRoom').value=b.ambient;$('boilDiameter').value=b.diameter;}if(pendingManual){$('ratedWatts').value=pendingManual.ratedWatts;$('transferPercent').value=pendingManual.transferPercent;$('hobTechnology').value=pendingManual.technology||'induction';}$('manualResult').textContent='';$('boilResult').textContent='';$('stoveError').textContent='';updateStoveNote();$('stoveDialog').showModal();}
loadStoveProfile();
$('stoveSettings').onclick=openStove;$('closeStove').onclick=()=>$('stoveDialog').close();
$('stoveCurve').onchange=updateStoveNote;$('stoveWatts').oninput=()=>{pendingBoil=null;pendingManual=null;$('boilResult').textContent='';$('manualResult').textContent='';updateStoveNote();};
let pendingBoil=null,pendingManual=null;
$('hobTechnology').onchange=()=>{$('transferPercent').value={induction:85,radiant:75,solid:75,gas:35}[$('hobTechnology').value];$('manualResult').textContent='Technology estimate selected. Use manual rating to apply.';};
$('useManualRating').onclick=()=>{const rated=+$('ratedWatts').value,fraction=+$('transferPercent').value/100;if(!Number.isFinite(rated)||rated<100||rated>10000||!Number.isFinite(fraction)||fraction<.1||fraction>1||rated*fraction<100||rated*fraction>6000){$('stoveError').textContent='Check rating and transfer: estimated input must be 100–6000 W.';return;}pendingManual={ratedWatts:rated,transferPercent:fraction*100,technology:$('hobTechnology').value};pendingBoil=null;$('stoveWatts').value=Math.round(rated*fraction);if($('stoveName').value==='Model defaults')$('stoveName').value='My stove / zone / pan';$('manualResult').textContent=rated+' W rated × '+Math.round(fraction*100)+'% assumed transfer = '+Math.round(rated*fraction)+' W into pan.';$('boilResult').textContent='';$('stoveError').textContent='';updateStoveNote();};
$('estimateBoil').onclick=()=>{try{const b={seconds:+$('boilMinutes').value*60,startTemperature:+$('boilStart').value,ambient:+$('boilRoom').value,diameter:+$('boilDiameter').value,pan:config.pan};const r=SteakPhysics.estimateBoilCalibration(b);if(r.watts<100||r.watts>6000)throw new Error('Estimate outside supported 100–6000 W. Check time, temperature and pan.');pendingBoil=b;pendingManual=null;$('manualResult').textContent='';if($('stoveName').value==='Model defaults')$('stoveName').value='My stove / zone / pan';$('stoveWatts').value=Math.round(r.watts);$('boilResult').textContent='Approx. '+Math.round(r.watts)+' W = '+Math.round(r.storedWatts)+' W heating water + pan, plus '+Math.round(r.lossWatts)+' W average estimated losses.';updateStoveNote();$('stoveError').textContent='';}catch(e){$('stoveError').textContent=e.message;pendingBoil=null;}};
$('defaultStove').onclick=()=>{$('stoveWatts').value=1800;$('stoveSteps').value=12;$('stoveCurve').value=1;$('stoveName').value='Model defaults';pendingBoil=null;pendingManual=null;$('manualResult').textContent='';$('boilResult').textContent='Defaults selected. Save to apply.';updateStoveNote();};
$('stoveForm').onsubmit=e=>{e.preventDefault();if(!$('stoveForm').reportValidity())return;stoveProfiles[config.pan]={name:$('stoveName').value.trim()||'My stove / zone / pan',maxStep:+$('stoveSteps').value,maxHeatWatts:+$('stoveWatts').value,powerExponent:+$('stoveCurve').value,boil:pendingBoil,manual:pendingManual};let saved=true;try{localStorage.setItem(stoveStorageKey,JSON.stringify(stoveProfiles));}catch{saved=false;}loadStoveProfile();suggestion=null;renderSuggestion();renderEvents();requestCompute();$('stoveDialog').close();toast(saved?'Stove profile saved and applied.':'Stove settings applied for this session; browser storage is unavailable.');};

makeFields();fillIcons();updateColorScale();preset('classic',true);syncInputs();
$('scaleMode').onchange=()=>{colorMode=$('scaleMode').value;updateColorScale();if(result){drawScene();drawHistory();drawProfile();}};
$('scenarioSelect').onchange=()=>preset($('scenarioSelect').value);
$('openPlan').onclick=()=>$('planDialog').showModal();$('closePlan').onclick=()=>$('planDialog').close();
$('clearPlan').onclick=()=>{clearUndo={events:events.map(e=>({...e})),rows:{...timelineRows},duration};events=[];timelineRows={};suggestion=null;$('eventDialog').close();$('undoClear').hidden=false;changedEvents();toast('Cooking plan cleared. Undo restores the actions.');};
$('undoClear').onclick=()=>{if(!clearUndo)return;events=clearUndo.events;timelineRows=clearUndo.rows;duration=clearUndo.duration;$('duration').value=duration/60;clearUndo=null;$('undoClear').hidden=true;changedEvents();toast('Cooking plan restored.');};
$('timelineAxis').onclick=e=>{const tick=e.target.closest('[data-time]');if(tick)seek(+tick.dataset.time);};
$('foodGuidance').onclick=()=>showInfo('Cooking temperatures & food guidance',$('safetyNote').innerHTML,true);
$('suggestPlan').onclick=suggestPlan;
$('donenessSelect').onchange=()=>{const value=$('donenessSelect').value;if(value==='custom'){$('target').focus();return;}target=config.meat==='minced'?75:+value;$('target').value=target;rangeFill($('target'));updateTarget();};
$('languageSelect').onchange=()=>SteakI18n.setLocale($('languageSelect').value);
function languageOptions(){$('languageSelect').innerHTML=SteakI18n.listLocales().map(l=>`<option value="${l.code}" ${l.code===SteakI18n.locale?'selected':''}>${l.code.toUpperCase()}</option>`).join('');}
document.addEventListener('localesavailable',languageOptions);document.addEventListener('languagechange',()=>{languageOptions();syncInputs();renderEvents();syncPlay();if(result)render();});
document.addEventListener('click',e=>{const b=e.target.closest('[data-help]');if(b){e.preventDefault();const h=HELP[b.dataset.help];if(h)showInfo(h[0],h[1]);}});
$('modelInfo').onclick=modelInfo;$('sources').onclick=modelInfo;$('closeDialog').onclick=()=>$('infoDialog').close();$('infoDialog').addEventListener('click',e=>{if(e.target===$('infoDialog')){const r=$('infoDialog').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('infoDialog').close();}});
for(const f of fields)$(f.id).addEventListener('input',()=>{config[f.id]=+$(f.id).value;$(f.id+'Value').textContent=fieldValue(f);if(f.id==='diameter')$('aspectValue').textContent=fieldValue(fields[2]);rangeFill($(f.id));requestCompute();});
$('panType').onchange=()=>{config.pan=$('panType').value;loadStoveProfile();renderEvents();requestCompute();};
document.querySelectorAll('[data-meat]').forEach(b=>b.onclick=()=>{config.meat=b.dataset.meat;target={minced:75,beef:56,pork:63,chicken:75,fish:63}[config.meat];syncInputs();requestCompute();});
$('target').oninput=()=>{target=config.meat==='minced'?75:+$('target').value;rangeFill($('target'));updateTarget();};
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{view=b.dataset.view;document.querySelectorAll('[data-view]').forEach(x=>{x.classList.toggle('selected',x===b);x.setAttribute('aria-pressed',x===b);});if(result)drawScene();});
$('play').onclick=()=>{if(pending){toast('The experiment is being calculated.');return;}if(current>=duration)current=0;if(running)clearMotion();running=!running;primePlayback=running&&current===0;lastFrame=performance.now();syncPlay();};
$('restart').onclick=()=>seek(0);$('scrub').oninput=()=>seek(+$('scrub').value);
document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>scheduleNow(b.dataset.action,b.dataset.action==='oil'?10:undefined));
$('eventTrack').onclick=e=>{const b=e.target.closest('[data-event-id]');if(b){if(performance.now()<suppressTimelineClickUntil&&+b.dataset.eventId===lastDraggedId)return;openEventEditor(+b.dataset.eventId);}};
$('eventTrack').onkeydown=e=>{const b=e.target.closest('[data-event-id]');if(!b||!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();const entry=events.find(a=>a.id===+b.dataset.eventId);moveEvent(entry,entry.time+(e.key==='ArrowLeft'?-1:1)*(e.shiftKey?30:5));$('eventTrack').querySelector('[data-event-id="'+entry.id+'"]')?.focus();};
$('eventTrack').onpointerdown=e=>{const b=e.target.closest('[data-event-id]');if(!b||e.button!==0)return;closeActionEditor();const entry=events.find(a=>a.id===+b.dataset.eventId);running=false;syncPlay();dragEvent={entry,button:b,x:e.clientX,y:e.clientY,time:entry.time,next:entry.time,row:timelineRows[entry.id],moved:false,width:$('eventTrack').clientWidth,pointer:e.pointerId};b.setPointerCapture(e.pointerId);};
$('eventTrack').onpointermove=e=>{if(!dragEvent||e.pointerId!==dragEvent.pointer)return;const d=dragEvent,dx=e.clientX-d.x;if(!d.moved&&Math.hypot(dx,e.clientY-d.y)<5)return;d.moved=true;d.next=clamp(Math.round((d.time+dx/d.width*duration)/5)*5,0,duration);const y=e.clientY-$('eventTrack').getBoundingClientRect().top;d.row=freeActionRow(d.entry.id,d.next,Math.max(0,Math.min(Math.floor(y/ACTION_ROW_HEIGHT),Math.max(2,...Object.values(timelineRows))+1)));$('eventTrack').style.setProperty('--track-height',Math.max(3,d.row+1,...events.map(a=>timelineRows[a.id]+1))*ACTION_ROW_HEIGHT+'px');d.button.classList.add('dragging');d.button.style.left=100*d.next/duration+'%';d.button.style.top=d.row*ACTION_ROW_HEIGHT+3+'px';setDragGuide(d.next,d.row);};
$('eventTrack').onpointerup=e=>{if(!dragEvent||e.pointerId!==dragEvent.pointer)return;const d=dragEvent;dragEvent=null;if(d.button.hasPointerCapture(e.pointerId))d.button.releasePointerCapture(e.pointerId);hideDragGuide();if(d.moved){suppressTimelineClickUntil=performance.now()+400;lastDraggedId=d.entry.id;moveEvent(d.entry,d.next,d.row);toast(eventDescription(d.entry)+' moved to '+timeText(d.next));}};
$('eventTrack').onpointercancel=()=>{if(!dragEvent)return;dragEvent=null;suppressTimelineClickUntil=performance.now()+400;renderEvents();};

function closeActionEditor(){if(editedEvent&&$('eventDialog').open)applyActionEditor();$('eventDialog').close();}
$('cancelAction').onclick=closeActionEditor;
$('deleteAction').onclick=()=>{if(!editedEvent)return;clearTimeout(editorApplyTimer);events=events.filter(e=>e.id!==editedEvent.id);editedEvent=null;$('eventDialog').close();changedEvents();toast('Action removed from the cooking plan.');};
function applyActionEditor(close=false){clearTimeout(editorApplyTimer);const type=editedEvent?.type||$('editActionType').value,value=type==='rest'?$('editRestMode').value:(type==='power'?stoveSetting(+$('editActionAmount').value):+$('editActionAmount').value),time=+$('editActionTime').value,numeric=['power','oil'].includes(type);
 let error=!Number.isFinite(time)||time>duration?'Use mm:ss within the experiment duration.':numeric&&(!Number.isFinite(value)||value<0||value>(type==='power'?12:30))?'Enter a whole number within the shown range.':'';
 $('actionError').hidden=!error;$('actionError').textContent=t(error);if(error)return;
 const entry=editedEvent||{id:eventID++},before=JSON.stringify(entry);Object.assign(entry,{time,type,value:numeric||type==='rest'?value:undefined,enabled:$('editActionEnabled').checked});if(!editedEvent){events.push(entry);manualAnimation=entry.id;editedEvent=entry;}$('saveAction').textContent=t('Done');$('deleteAction').hidden=false;
 if(before!==JSON.stringify(entry)){timelineRows[entry.id]=freeActionRow(entry.id,time,timelineRows[entry.id]??0);changedEvents();editorAnchor=document.querySelector('[data-event-id="'+entry.id+'"]');}
 if(close)$('eventDialog').close();else positionEventEditor();
}
$('actionForm').onsubmit=e=>{e.preventDefault();applyActionEditor(true);};
$('actionForm').onchange=()=>{updateEditorAmount();if(editedEvent)applyActionEditor();};
$('editActionAmount').oninput=()=>{updateEditorAmount();clearTimeout(editorApplyTimer);if(editedEvent)editorApplyTimer=setTimeout(()=>applyActionEditor(),90);};
$('eventDialog').onkeydown=e=>{if(e.key==='Escape'){closeActionEditor();editorAnchor?.focus();}};
document.addEventListener('pointerdown',e=>{if($('eventDialog').open&&!$('eventDialog').contains(e.target)&&!e.target.closest('[data-event-id],[data-tool]'))closeActionEditor();});
$('eventRows').onchange=e=>{const row=e.target.closest('[data-id]');if(!row||!e.target.classList.contains('event-enabled'))return;const entry=events.find(a=>a.id===+row.dataset.id);entry.enabled=e.target.checked;changedEvents();};
$('eventRows').onclick=e=>{const edit=e.target.closest('[data-edit-event]');if(edit){openEventEditor(+edit.dataset.editEvent);return;}if(!e.target.closest('.remove-event'))return;const row=e.target.closest('[data-id]');events=events.filter(a=>a.id!==+row.dataset.id);changedEvents();};

$('duration').onchange=()=>{const next=Math.round(clamp(+$('duration').value||13,3,45)*60);if(events.some(e=>e.time>next)){toast('Move or remove actions after '+timeText(next)+' first.');$('duration').value=duration/60;return;}duration=next;timelineWidth=0;current=Math.min(current,duration);renderEvents();compute();};
document.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>preset(b.dataset.preset));
$('saveReference').onclick=()=>{if(!result||pending)return;reference={config:{...config},snapshots:result.snapshots.map(p=>({time:p.s.time,core:p.s.core}))};$('referenceLabel').hidden=false;toast('Core curve saved. Change a parameter or try a different technique.');drawHistory();};$('clearReference').onclick=()=>{reference=null;$('referenceLabel').hidden=true;drawHistory();};
$('reset').onclick=()=>{config={...SteakPhysics.DEFAULTS};loadStoveProfile();target=56;reference=null;$('referenceLabel').hidden=true;preset('classic',true);syncInputs();compute();toast('A fresh experiment is ready.');};
$('history').onclick=e=>{if(!result)return;const r=$('history').getBoundingClientRect();seek(clamp((e.clientX-r.left-42)/(r.width-61),0,1)*duration);};
$('history').onpointermove=e=>{if(!result)return;const r=$('history').getBoundingClientRect(),t=clamp((e.clientX-r.left-42)/(r.width-61),0,1)*duration,s=snapshotAt(t).s;$('historyReadout').textContent=`${timeText(t)} · Pan ${fmt(s.pan)}° · A ${fmt(s.faceA)}° · Core ${fmt(s.core,1)}° · B ${fmt(s.faceB)}°`;};
$('history').onpointerleave=()=>$('historyReadout').textContent='Click the chart to explore. Dashed lines show the target and saved core curve.';
$('exportCsv').onclick=()=>{if(!result||pending)return;const rows=['# SteakLab;simulated data;approximate stove settings;not validated','# Configuration;'+JSON.stringify(config),'# Actions;'+JSON.stringify(events),'time_s;pan_mean_C;side_A_C;core_C;side_B_C;coldest_C;browning_A_pct;browning_B_pct;evaporated_g;heat_input_W;phase',...result.snapshots.map(p=>[p.s.time,p.s.pan,p.s.faceA,p.s.core,p.s.faceB,p.s.min,p.s.brownA,p.s.brownB,p.s.evaporated,p.s.burnerWatts].map(v=>Number(v).toFixed(3)).join(';')+';'+p.s.phase)];const url=URL.createObjectURL(new Blob(['\ufeff'+rows.join('\r\n')],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='SteakLab-experiment.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
window.addEventListener('resize',()=>{layoutEvents();if(result)render();positionEventEditor();});
$('timelineScroll').addEventListener('scroll',()=>{if($('eventDialog').open)closeActionEditor();});
function clearMotion(){actionMotion=null;motionQueue=[];if($('actionCue'))$('actionCue').hidden=true;document.querySelectorAll('.active-action').forEach(b=>b.classList.remove('active-action'));}
function nextMotion(now){
 const action=motionQueue.shift();if(!action){clearMotion();if(result)drawScene();return;}
 actionMotion={...action,progress:0,started:now,ms:{power:550,oil:1800,add:800,flip:1000,rest:1000}[action.type]||700};
 $('actionCue').hidden=false;$('actionCue').innerHTML=icon(eventIcons[action.type])+t(eventDescription(action));
 document.querySelectorAll('[data-event-ids]').forEach(b=>b.classList.toggle('active-action',b.dataset.eventIds.split(',').includes(String(action.id))));
}
function queueMotions(actions,now){if(!actions.length)return;motionQueue.push(...actions.filter(e=>e.enabled!==false));if(!actionMotion)nextMotion(now);}
function validMotion(e){return e.enabled!==false&&!result.warnings.some(w=>w.type===e.type&&Math.abs(w.time-e.time)<1e-6);}
function animate(now){
 if(actionMotion&&!pending){actionMotion.progress=clamp((now-actionMotion.started)/actionMotion.ms,0,1);drawScene();if(actionMotion.progress>=1)nextMotion(now);}
 if(running&&!pending&&result&&!actionMotion){
  const delta=Math.min((now-lastFrame)/1000,.2),until=Math.min(duration,current+delta*+$('speed').value);
  const crossing=events.filter(e=>validMotion(e)&&((e.time>current+1e-8&&e.time<=until)||(primePlayback&&e.time===0)));
  primePlayback=false;
  if(crossing.length){current=crossing[0].time;render();queueMotions(crossing.filter(e=>Math.abs(e.time-current)<1e-8),now);}
  else{current=until;if(now-lastPaint>45){render();lastPaint=now;}}
  if(current>=duration){running=false;syncPlay();render();}
 }
 lastFrame=now;requestAnimationFrame(animate);
}
let toolDrag=null,suppressToolClick=0;
function cleanToolDrag(){document.querySelector('.tool-drag-ghost')?.remove();$('eventTrack').classList.remove('tool-drop-target');hideDragGuide();toolDrag=null;}
document.querySelectorAll('[data-tool]').forEach(button=>{
 button.onclick=()=>{if(performance.now()>=suppressToolClick)openEventEditor(null,button.dataset.tool,Math.round(current));};
 button.onpointerdown=e=>{if(e.button!==0)return;closeActionEditor();toolDrag={type:button.dataset.tool,x:e.clientX,y:e.clientY,pointer:e.pointerId,moved:false,inside:false,time:current,row:0};button.setPointerCapture(e.pointerId);};
 button.onpointermove=e=>{const d=toolDrag;if(!d||e.pointerId!==d.pointer)return;if(!d.moved&&Math.hypot(e.clientX-d.x,e.clientY-d.y)<5)return;d.moved=true;let ghost=document.querySelector('.tool-drag-ghost');if(!ghost){ghost=document.createElement('div');ghost.className='tool-drag-ghost';document.body.append(ghost);}const r=$('eventTrack').getBoundingClientRect();d.inside=e.clientX>=r.left-15&&e.clientX<=r.right+15&&e.clientY>=r.top-20&&e.clientY<=r.bottom+15;d.time=clamp(Math.round((e.clientX-r.left)/r.width*duration/5)*5,0,duration);d.row=freeActionRow(-1,d.time,Math.max(0,Math.min(Math.floor((e.clientY-r.top)/ACTION_ROW_HEIGHT),Math.max(2,...Object.values(timelineRows))+1)));ghost.innerHTML=icon(eventIcons[d.type])+t(eventNames[d.type])+' · '+timeText(d.time);ghost.style.left=(e.clientX+12)+'px';ghost.style.top=(e.clientY-20)+'px';$('eventTrack').classList.toggle('tool-drop-target',d.inside);if(d.inside)setDragGuide(d.time,d.row);else hideDragGuide();};
 button.onpointerup=e=>{const d=toolDrag;if(!d||e.pointerId!==d.pointer)return;if(button.hasPointerCapture(e.pointerId))button.releasePointerCapture(e.pointerId);if(d.moved){suppressToolClick=performance.now()+400;if(d.inside){if(events.length>=80)toast('A plan can contain up to 80 actions.');else{const entry={id:eventID++,time:d.time,type:d.type,value:d.type==='power'?6:d.type==='oil'?10:d.type==='rest'?'air':undefined};events.push(entry);timelineRows[entry.id]=d.row;manualAnimation=entry.id;changedEvents();toast(eventDescription(entry)+' at '+timeText(entry.time)+' was added to the plan.');}}}cleanToolDrag();};
 button.onpointercancel=cleanToolDrag;
});

// Minimal read-only QA surface. No network or filesystem access.
globalThis.SteakLab={getState:()=>({config:{...config},events:events.map(e=>({...e})),duration,current,pending,running,snapshot:frame?{...frame.s}:null}),getResult:()=>result,seek};
compute();requestAnimationFrame(animate);
})();
