/* Central language layer. Add a complete pack with registerLocale(code, pack),
   then call setLocale(code). English message templates are stable fallback keys.
   Static DOM text/attributes and canvas/dynamic messages use this same layer. */
(() => {
const packs = {en: {
  "name": "English",
  "strings": {},
  "help": {
    "thickness": [
      "Thickness — the major time factor",
      "Heat must travel from the surface toward the center. The characteristic diffusion time grows roughly with the square of the thickness. A steak twice as thick therefore requires far more time, even on the same pan. Thickness is used directly in the FEM mesh. Both the angled view and the center section use the real thickness-to-diameter ratio. The camera foreshortens depth, but height is not exaggerated."
    ],
    "diameter": [
      "Diameter and mass",
      "The diameter is the longest dimension of the ellipse. A larger piece of meat has more mass and a larger contact area, and therefore draws more energy out of the pan. The mass estimate is calculated from volume and the assumed density of the raw ingredient."
    ],
    "aspect": [
      "Ellipse — from round to oval",
      "The ratio between the minor and major diameters. 1.00 is a circle; 0.50 gives half as much width as length. With a fixed major diameter, both mass and contact area change. The physics uses a circle of equivalent area and corrects the lateral surface area. The exact three-dimensional temperature field of a strongly oval steak is therefore not calculated."
    ],
    "initial": [
      "Initial meat temperature",
      "The uniform temperature of the meat before cooking. In the model, the meat is held at this temperature until “Add to pan”. The model does not calculate bacterial growth during storage or tempering on the kitchen counter."
    ],
    "wetness": [
      "Surface moisture — energy before crust",
      "Before a wet surface can get much hotter than 100 °C, water must evaporate. This costs energy and delays browning. The slider varies an extra water film of 0–0.12 kg/m². In addition, all nodes contain tissue water, which absorbs latent heat of vaporization around 100 °C. Even “patted dry” contains water. Steam is assumed to escape immediately; pressure and transport through the meat are simplified. Internal moisture transport, juice loss, and shrinkage are not included in this version."
    ],
    "contact": [
      "Contact — how easily heat enters",
      "Surface irregularities and air pockets limit heat flow between pan and meat. Here you can vary contact effectiveness by a factor of 0.5–1.5. Oil fills some gaps and increases heat transfer. This parameter is an overall model assumption, not a direct specification of pressure or oil volume."
    ],
    "pan": [
      "The pan — a thermal reservoir",
      "A heavy pan stores more energy and drops less in temperature when you place cold meat on it. The material's heat capacity and assumed surface thermal radiation are included. The exposed hot pan floor also radiates toward the vertical sides of the meat. This uses geometric view factors and an effective exposed-area radiating temperature, rather than resolving every pair of surface patches. Emissivity controls the exchange. The pan is an axisymmetric shell: concentric bottom annuli and rising wall bands exchange heat by conduction. The burner heats a circular footprint of 9 cm radius. Each shell cell is uniform through the metal thickness; it can differ from neighboring cells. The contact footprint of elliptical meat is approximated by its equal-area circle. Nonstick is a generic coated-aluminum preset (1.0 kg, 900 J/kg/K); hybrid is a generic steel/aluminum preset (1.3 kg, 650 J/kg/K). Their assumed top/bottom emissivities are 0.85/0.35 and 0.65/0.35. These are illustrative model inputs, not measured specifications for HexClad, ONYX or SCANPAN. Coating and hybrid texture are not resolved as separate thermal layers. The grill pan has lower effective contact; the stripes are a qualitative illustration."
    ],
    "panTemperature": [
      "Spatial pan temperature",
      "PAN MEAN is the heat-capacity-weighted mean of all pan-floor and wall cells. The range underneath is the local minimum and maximum; hover over it to see the rim temperature. The colored floor rings and wall bands show the calculated local field. A 9 cm-radius burner heats the center, heat conducts outward and upward, and meat draws energy from its contact footprint. The metal is uniform through its thickness, and the geometry is axisymmetric. A real burner, handle, pan construction and contact pattern can differ."
    ],
    "surface": [
      "Two physical sides — A and B",
      "A is the side placed against the pan first. B is the opposite side. The labels follow the meat when flipped. The value is an area-weighted average across the side; the temperature in the center of the side may differ. Whichever side is facing down is in contact with the pan."
    ],
    "core": [
      "Center and coldest point",
      "“Core” is the temperature at the geometric center. With one-sided heating, the coldest point may lie elsewhere. Therefore, “Coldest point” is also shown below the profile graph. The model cannot determine whether a real piece of meat is safe to eat."
    ],
    "target": [
      "A learning target, not a safety test",
      "The target adds a guide line to the graphs and shows when the calculated center reaches that temperature. For beef, you can explore approximate culinary targets: rare 50–53 °C, medium-rare 54–58 °C, medium 59–64 °C, and well-done around 70 °C. This is not documentation of food safety. Chicken starts at 75 °C, fish at 63 °C, and pork at 63 °C. Use a real thermometer and relevant official food safety guidelines."
    ],
    "speed": [
      "Playback without altered physics",
      "30× means that 30 seconds of the experiment play back in one second. The entire temperature history is computed using small, stable time steps. Speed only changes playback. You can pause and scrub freely."
    ],
    "duration": [
      "Experiment duration",
      "Total time including preheating and resting, between 3 and 45 minutes. A shorter duration may cut an experiment short; therefore, actions are not automatically moved or deleted. Adjust any actions outside the time window before recalculating."
    ],
    "actions": [
      "Actions become part of your plan",
      "Drag an action card to move it in 5-second steps, or focus it and use the left/right arrow keys (Shift moves 30 seconds). Click a card to edit its exact time, type and amount, or turn it off without deleting it. “Add action” opens a new card. “Act now” inserts an action at the displayed time. Moving the stove slider likewise inserts a power change. In a prepared plan, later actions still apply. Open “Edit cooking plan” to modify, add, or remove them. The entire experiment is recalculated; temperatures do not reset when flipping."
    ],
    "power": [
      "Heat input in watts",
      "The steps scale an assumed maximum net power delivered to the pan of 1,800 W, distributed over a circular burner footprint of 9 cm radius. Step 6 gives 900 W. A 3-second lag mimics a responsive hob. There is no thermostat, so an empty pan can become very hot. Real stoves vary, and a ceramic hob often responds more slowly."
    ],
    "oil": [
      "Oil and heat transfer",
      "An oil action adds 10 g of room-temperature oil unless you choose a different amount in the plan. The oil initially lowers the pan temperature slightly and then improves heat transfer. Total oil is capped at 30 g. Oil type, smoke point, and degradation are not modeled."
    ],
    "browning": [
      "Crust and grill marks",
      "The browning index accumulates time spent at high surface temperatures. It tracks each side individually and does not artificially continue on a cold side. 100% indicates a saturated color index, not a measured quantity of Maillard products. Overheating produces a separate darkening index. Grill stripes illustrate reduced contact; the temperature of each ridge is not calculated separately."
    ],
    "evaporation": [
      "Water carrying heat away",
      "One gram of evaporated water requires about 2,260 joules in the model. The value shows evaporation from assumed tissue water and the surface water film. It is not the steak's total weight loss and cannot be translated directly into juiciness. There are local water reservoirs throughout the meat, but no fluid transport between them. Heat capacity and volume are kept constant, even as water leaves the model."
    ],
    "gradient": [
      "A cross-section tells more than a single number",
      "The graph shows the temperature through the center of the steak. A steep curve means a large difference between a hot surface and a colder interior. Flipping and resting change the shape of the curve. “Difference, hot–cold” is calculated across the entire two-dimensional temperature field."
    ],
    "rest": [
      "Carryover cooking during rest",
      "When the meat is taken off the pan, contact stops. Heat in the outer layers can still travel toward the center. The displayed carryover heat is the rise above the center temperature at the moment resting began — not a fixed number of degrees. The model lets both sides cool in air; a warm plate or foil would change the progression."
    ],
    "suggestion": [
      "A plan calculated for your cut",
      "The planner uses the selected meat, geometry, moisture, pan and contact settings. It simulates preheating the pan contact footprint, adding oil and meat, reducing power, flipping every minute and a size-dependent rest. The preheat trigger is the contact-area-weighted pan temperature under the future meat footprint, not the whole-pan mean. It tests a prospective rest and aims for your selected peak core temperature during that rest. Predicted temperatures are model estimates, not validated cooking instructions or proof of food safety. The coldest point can be elsewhere. Check real food with a thermometer and follow the official guidance shown for the selected meat. If no plan reaches the target within 45 minutes, the interface says so."
    ],
    "doneness": [
      "Choose the result you want",
      "Doneness selects a temperature target for the model. Beef offers rare, medium-rare, medium and well-done; the other meats have their own presets. You can also choose a custom core target. Culinary preferences and official minimum-temperature guidance are different: low culinary targets do not certify food safety. 'Suggest cooking plan' uses the target to search for a model-based sequence, including carryover heat."
    ]
  },
  "sources": "<p><a href=\"https://www.foedevarestyrelsen.dk/kost-og-foedevarer/alt-om-mad/god-koekkenhygiejne/fem-raad-til-god-koekkenhygiejne/varm-mad-ordentligt-op\" target=\"_blank\" rel=\"noopener\">Danish Veterinary and Food Administration (Fødevarestyrelsen): Heat food properly</a> — thorough cooking, and the difference between whole cuts of meat and minced meat.</p><p><a href=\"https://www.foodsafety.gov/food-safety-charts/safe-minimum-internal-temperatures\" target=\"_blank\" rel=\"noopener\">FoodSafety.gov: Safe Minimum Internal Temperatures</a> — 63 °C and a 3-minute rest for whole cuts of beef and pork, 74 °C for poultry, and 63 °C for fish. U.S. consumer guidance.</p><p><a href=\"https://www.food.dtu.dk/nyheder/nyhed?id=9bfa54ee-c186-4b32-8d5d-ffa1cf05055f\" target=\"_blank\" rel=\"noopener\">DTU National Food Institute: Why slow cooking works</a> — at least 75 °C for poultry, minced meat, and diced/cubed meat.</p><p><a href=\"https://jsdokken.com/dolfinx-tutorial/main/chapter2/heat_equation.html\" target=\"_blank\" rel=\"noopener\">FEniCSx: The heat equation</a> — background on FEM and transient heat conduction; this app uses explicit time integration.</p><p><a href=\"https://arxiv.org/abs/1908.10787\" target=\"_blank\" rel=\"noopener\">Shehadeh et al.: A Mathematical Model for Meat Cooking</a> — example of a more advanced model with moisture transport and shrinkage; that model is not implemented here.</p><p class=\"small\">Sources verified November 13, 2026. Physical constants and browning parameters here are illustrative modeling choices, not a calibration against a specific cut of meat.</p>"
}};
packs.en.model="<p>SteakLab is a place to experiment. <b>864 linear triangular elements</b> resolve an axisymmetric section through the meat, including radial heat flow and conduction through its thickness. A separate axisymmetric pan shell resolves concentric floor annuli and rising wall bands.</p><h3>From stove to center</h3><p><code>M · dT/dt + K · T = Q</code></p><p>A lumped mass matrix and conservative heat fluxes couple the nodes. The pan loses exactly the heat transferred to the meat. Explicit time steps are at most 0.2 seconds and are reduced further by a stability bound.</p><h3>Included</h3><p>Geometry, local pan conduction, a circular 9 cm-radius burner footprint, thermal mass, contact resistance over an equal-area circular meat footprint, oil, convection, radiation between the exposed pan floor, meat sides and room, local tissue-water reservoirs, a surface water film, flipping and carryover heat. Isotherms come from the actual FEM field. Browning is a separate empirical thermal-dose calculation.</p><h3>Simplifications</h3><p>The pan shell has spatial floor and wall temperatures but remains uniform through its metal thickness. The ellipse becomes an equal-area circle with corrected side area, including its contact footprint on the pan. Pan-side radiation uses geometric view factors, grey-diffuse exchange and an exposed-area effective emitting temperature; it does not resolve radiation between every pair of pan cells and meat patches. The handle, local angular variation and rising hot-air flow are not resolved. Material properties are constant. There is no internal liquid transport, shrinkage, fat rendering, anatomy, full 3D thermal geometry or bacterial-inactivation model. Rest can be in open air, under loosely tented foil, or on the pan with the stove off. Foil uses illustrative convection/radiation factors of 0.4/0.5 without resolving condensation. Vapor is assumed to escape immediately. Heat capacity and volume stay fixed as water is lost. The model has not been calibrated against a particular stove or cut.</p><table><tr><th>Ingredient</th><th>k · W/(m·K)</th><th>ρ · kg/m³</th><th>c · J/(kg·K)</th></tr>{materialRows}</table><h3>Suggested cooking plans</h3><p>The planner simulates preheating the future contact footprint, power reductions, minute-by-minute flips and a prospective rest. Preheat refers to the contact-area-weighted pan temperature, not its whole-pan mean. It searches for the selected peak <b>center</b> temperature during that rest. It does not prove that every part of real food has reached a safe temperature. Review the coldest-point display and use a real thermometer.</p><h3>Food safety</h3><p>Color and crust do not establish food safety. These geometry presets represent whole, non-mechanically-tenderized cuts. Ground, injected or mechanically tenderized meat needs a different assessment. Follow official guidance for the actual food.</p><h3>Sources and further reading</h3>";
packs.en.sources += '<p><a href="https://doc.comsol.com/6.4/doc/com.comsol.help.heat/heat_ug_theory.07.056.html" target="_blank" rel="noopener">COMSOL: surface radiation and geometric view factors</a> — background for pan-to-side radiation; SteakLab uses its own simplified geometry and implementation.</p>';
packs.en.help.colorScale=['A non-linear temperature color scale','Focus mode gives 84% of the color range to 40–80 °C, so small cooking-temperature differences are easier to see. The temperature labels follow this non-linear mapping. It changes only the colors, never the computed temperatures. Choose Linear to spread the colors evenly across 0–220 °C. Values outside the range use the endpoint colors.'];
packs.en.help.contact=['Contact heat transfer — a multiplier','This is a multiplier of the assumed heat-transfer coefficient between pan and meat, not a fraction of area. 1.00× is the reference; 1.50× transfers 50% more heat for the same temperature difference. The range represents uncertainty and variations in surface contact. Oil separately improves the reference coefficient.'];
packs.en.help.actions=['Drag for time, click for settings','Each action stays separate. Its horizontal position sets the time; the vertical guide shows that time while dragging. Click an icon for options beside it. Heat and oil use sliders that apply immediately. Flip and placement have no extra numeric settings. Existing action types stay fixed. Editing keeps the viewing time fixed. Clear removes the actions; Undo restores them. Arrow keys move a focused card by 5 seconds; Shift uses 30 seconds.'];
packs.en.help.rest=['Three ways to rest','Open air removes the meat from the pan and lets all surfaces cool. Loose foil also removes it, then reduces modeled convection to 40% and radiation to 50%; these are illustrative coefficients, with no condensation or moisture trapping calculation. Stay on the pan switches the stove target to zero but keeps thermal contact and the hob’s 3-second lag. The pan’s stored heat can continue cooking the meat. You can flip it during pan rest or later move it to open air or foil. A later stove action can switch the heat back on.'];
packs.en.help.gradient=['Depth through the steak','The spatial axis is vertical, in millimetres from side B toward side A. B always stays at the top and A at the bottom of this graph, even when the actual steak flips. Temperature is horizontal, with a fixed range for the whole cooking plan. The dot marks the geometric center. The coldest-point value is calculated across the full mesh. The vertical outer edge receives radiation from the exposed pan floor while losing heat to the room; it may still be cooler than the interior.'];
let locale='en';
const nodeKeys=new WeakMap(),attrKeys=new WeakMap();
const api={
 get locale(){return locale;},get model(){return packs[locale].model||packs.en.model;},get help(){return packs[locale].help||packs.en.help;},get sources(){return packs[locale].sources||packs.en.sources;},
 t(key,values={}){let template=packs[locale].strings?.[key]??key;let vars=values;if(locale!=='en'&&template===key){for(const[source,translation]of Object.entries(packs[locale].strings||{})){if(!source.includes('{'))continue;const names=[];const pattern=source.split(/(\{\w+\})/).map(part=>{if(/^\{\w+\}$/.test(part)){names.push(part.slice(1,-1));return'(.*?)';}return part.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}).join('');const match=key.match(new RegExp('^'+pattern+'$'));if(match){vars={...values};names.forEach((name,i)=>vars[name]=match[i+1]);template=translation;break;}}}return template.replace(/\{(\w+)\}/g,(_,k)=>vars[k]??'{'+k+'}');},
 registerLocale(code,pack){if(!/^[a-z]{2}(-[A-Z]{2})?$/.test(code)||!pack.name)throw new Error('Invalid locale pack');packs[code]=pack;document.dispatchEvent(new CustomEvent('localesavailable'));},
 listLocales(){return Object.entries(packs).map(([code,p])=>({code,name:p.name}));},
 localize(root=document.body){const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;while(node=walker.nextNode()){if(node.parentElement?.closest('script,style,canvas'))continue;let key=nodeKeys.get(node);if(key===undefined){key=node.nodeValue;nodeKeys.set(node,key);}const trimmed=key.trim();if(trimmed)node.nodeValue=key.replace(trimmed,api.t(trimmed));}
 root.querySelectorAll('[aria-label],[title],[placeholder]').forEach(el=>{let keys=attrKeys.get(el);if(!keys){keys={};for(const a of ['aria-label','title','placeholder'])if(el.hasAttribute(a))keys[a]=el.getAttribute(a);attrKeys.set(el,keys);}for(const[a,key]of Object.entries(keys))el.setAttribute(a,api.t(key));});},
 setLocale(code){if(!packs[code])throw new Error('Locale not installed: '+code);locale=code;document.documentElement.lang=code;document.title=api.t('SteakLab — your virtual cooking lab');api.localize();document.dispatchEvent(new CustomEvent('languagechange',{detail:code}));}
};globalThis.SteakI18n=api;
})();
