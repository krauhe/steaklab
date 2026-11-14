STEAKLAB — OFFLINE COOKING LAB

Open SteakLab.html in a modern browser by double-clicking it.
That single file contains the interface, styles, physics, textures and charts.
No installation, server or internet connection is needed to run the model.
Links to official guidance naturally require internet access when clicked.

QUICK START
1. Use the controls on the left to select the ingredient and geometry.
2. Choose a doneness target, then click "Suggest cooking plan" if desired.
3. Drag tools onto the time axis. Every action remains a separate icon.
   Horizontal position sets time; the vertical drag guide shows the exact time.
4. Click an icon for a small popup beside it. Heat (0–1,800 W) and oil use sliders.
   Changes apply directly. Toggle inclusion or remove the action there.
   No separate time field or Save step is needed.
5. Clear removes all cooking actions; Undo restores the cleared plan.
6. Editing preserves the viewing time, including at the end of the run.
The meat waits visibly above the pan until Add. The hob label shows current
net heat input, including its response lag; this is not electrical rated power.

7. "Temperature profile" stays fixed with B up and A down. Its temperature range
   is fixed for the whole run. The 3D camera stays fixed during flips too.
8. The vertical color scale between the pan and section gives 84% of its
   color range to 40–80 C. Linear remains optional. Colors never alter physics.
9. Oil pours onto the pan and spreads under the meat. Nonstick and hybrid
   are generic pan presets, not calibrated commercial product models.
10. Save a comparison or export CSV. Details shows the plan and run duration.

RESTING METHODS
Open air / rack: the ingredient leaves the pan and cools in room air.
Loose foil: off-pan, with convection x0.4 and radiation x0.5.
These foil coefficients are illustrative; condensation is not modeled.
On pan: switches the stove target off while retaining thermal contact and
the 3-second hob lag. Later explicitly scheduled stove actions still apply.
A pan-resting cut can be flipped or subsequently moved off the pan.

DISPLAY
Desktop controls, scene, plan and both graphs fit on one screen at 1280 x 720
and 1920 x 1080 CSS viewports. Small screens retain a scrolling layout.
The pan handle and the separate browning/carryover cards have been removed.
The actual steak still shows material-side A/B labels and browning.
The thermal solver remains axisymmetric; the angled drawing is a 3D view
of that simplified geometry, not a new 3D heat solver.

Suggested plans target the simulated center and include a prospective rest.
They are not calibrated real-world cooking instructions or safety certificates.
The angled pan/steak view uses a 28-degree orthographic camera with millimetre
coordinates. Thickness is not exaggerated; the section has the same x/z scale.
The pan uses radial bottom cells and flared-wall cells with conservative heat
conduction, a central burner footprint and local meat contact. The metal
temperature is uniform through its thickness. The displayed pan value is a
capacity-weighted mean. The meat uses 2D axisymmetric finite elements.
The exposed pan floor radiates to the meat sides through geometric view factors
and a conservative grey-diffuse radiosity calculation. Pan walls and hot-air
plumes are not resolved. The equal-area cylinder approximation is retained.
Developer comparisons can use panRadiation:false for the previous boundary
model; losses:false disables all radiation for isolated numerical benchmarks.
Moisture, browning and grill stripes include substantial simplifications.
Read "About the model" and the linked official guidance for details.

DELIVERABLES
SteakLab.html        Self-contained application; this is the file to share.
plan.html            Consolidated plan, model decisions, validation and next steps.
src/                 Editable source modules.
tests/               Automated numerical, language and bundle checks.
build.mjs            Rebuilds the HTML from the source modules.
preview.mjs          Optional local development preview; serves only HTML deliverables.
private-review/      Private model briefs/results; excluded by .gitignore.
test-output/         Local screenshots and QA artifacts; excluded by .gitignore.

DEVELOPMENT
Node.js is only needed for development, not for opening the finished simulator.
  node build.mjs
  node --test tests/*.test.cjs

The physics engine is independent of the DOM. The event runner and suggested-plan
search use the same Engine, including moisture and carryover. Rendering never
invents a radial correction to its temperature contours.

ADDING A LANGUAGE
The current delivery contains English only. src/i18n.js exposes:
  SteakI18n.registerLocale('da', {
    name: 'Dansk',
    strings: {
      'Start experiment': 'Start forsøg',
      'Predicted peak core: {temp} °C': 'Forventet maksimal kerne: {temp} °C'
    },
    help: { ...all translated help entries... },
    model: '...translated model HTML, preserving {materialRows}...',
    sources: '...translated source labels, preserving the verified links...'
  });

The language selector updates when a pack is registered. Missing messages fall
back to English. Static DOM text, accessible labels, dynamic templates, canvas
labels and number formatting have language hooks. Complete a pack and check its
actual layout before describing that language as supported. Include the pack in
src/i18n.js or extend build.mjs to embed it; avoid fetching it if offline operation
is to remain self-contained.

VERIFICATION
Numerical validation includes spatial pan conservation/refinement checks and an
analytical insulated diffusion mode, conservation and mesh refinement. It does
not establish accuracy against physical steaks. Browser testing uses the same
bundled file over loopback: the automation tool does not permit file: navigation.
