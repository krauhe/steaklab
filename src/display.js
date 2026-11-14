/* Display-only coordinates and colors; no change to the thermal solution.
   Focus devotes 84% of the color scale to 40–80 °C. Values outside 0–220 °C
   use the endpoint colors. The legend uses this exact same mapping. */
(() => {
'use strict';
const focusKnots=[[0,0],[40,.08],[80,.92],[220,1]];
const ramp=[
 [0,[44,61,95]],
 [.15,[53,111,155]],
 [.30,[48,156,174]],
 [.45,[109,190,154]],
 [.60,[207,219,132]],
 [.75,[246,186,89]],
 [.88,[235,120,66]],
 [1,[195,55,50]]
];
const clamp=(value,maximum)=>{const n=Number(value);return Number.isNaN(n)?0:Math.max(0,Math.min(maximum,n));};
function modeCheck(mode){if(mode!=='focus'&&mode!=='linear')throw new RangeError('Unknown color scale: '+mode);}
function interpolate(value,knots,from,to){
 let i=0;while(i<knots.length-2&&value>knots[i+1][from])i++;
 const a=knots[i],b=knots[i+1],f=(value-a[from])/(b[from]-a[from]);
 return a[to]+f*(b[to]-a[to]);
}
function scalePosition(temp,mode='focus'){
 modeCheck(mode);const value=clamp(temp,220);
 return mode==='linear'?value/220:interpolate(value,focusKnots,0,1);
}
function temperatureAtPosition(u,mode='focus'){
 modeCheck(mode);const value=clamp(u,1);
 return mode==='linear'?value*220:interpolate(value,focusKnots,1,0);
}
function colorAtPosition(u){
 let i=0;while(i<ramp.length-2&&u>ramp[i+1][0])i++;
 const [pa,a]=ramp[i],[pb,b]=ramp[i+1],f=(u-pa)/(pb-pa);
 return a.map((v,k)=>Math.round(v+f*(b[k]-v)));
}
function heatRGB(temp,mode='focus'){return colorAtPosition(scalePosition(temp,mode));}
function legendStops(mode='focus'){
 modeCheck(mode);
 // Include both color-ramp and temperature-mapping breakpoints. CSS sRGB
 // interpolation between these stops matches heatRGB (within rounding).
 const positions=[...new Set([...ramp.map(stop=>stop[0]),...(mode==='focus'?focusKnots.map(stop=>stop[1]):[0,1])])].sort((a,b)=>a-b);
 return positions.map(position=>({temperature:temperatureAtPosition(position,mode),position,color:colorAtPosition(position)}));
}
function freeActionRow(events,rows,id,time,preferred,width,duration,spacing=48){
 const max=Math.max(0,preferred,...Object.values(rows))+1;
 const candidates=Array.from({length:max+1},(_,i)=>i).sort((a,b)=>Math.abs(a-preferred)-Math.abs(b-preferred)||a-b);
 return candidates.find(row=>!events.some(e=>e.id!==id&&rows[e.id]===row&&Math.abs(e.time-time)*width/duration<spacing))??max+1;
}
globalThis.SteakDisplay=Object.freeze({scalePosition,temperatureAtPosition,heatRGB,legendStops,freeActionRow});
})();
