# SteakLab

An interactive cooking heat-transfer simulator by Kristian Rauhe Harreby.

**[Run SteakLab](https://krauhe.github.io/steaklab/)** â€” or download `SteakLab.html` and open it locally. No server or installation is needed.

Explore how thickness, shape, moisture, pan material, heat, oil, flipping and resting affect temperature. Drag actions to set their times; click them to change settings. Compare the core, both physical meat sides, and the pan.

## Model

The meat uses axisymmetric finite elements, with contact heat transfer, convection, radiation, evaporation and simplified browning. The pan uses an axisymmetric thin-shell finite-volume model: a central burner heats the bottom, heat conducts through radial rings and up the flared wall, and meat contact removes heat locally. The displayed pan value is a capacity-weighted mean; the drawing shows local temperatures. Temperature through the metal thickness is assumed uniform. Elliptical meat contact uses the existing equal-area circular approximation; pan-to-meat radiation uses an effective exposed-floor temperature. Oil spreading is an illustrative animation, not a fluid solver.

See [pan model details](PAN_MODEL.txt) for assumptions and conservation equations.

This educational model is not calibrated cooking guidance. Consult the food-safety guidance linked in the app.

Minced beef patties use a fixed 75 °C goal at the simulated coldest point. Suggestions require this before removal, without relying on carryover heat. Edited plans can fall short; the interface reports this. Real food still requires thermometer verification.

## Development

Node.js is needed only for development:

```sh
node build.mjs
node --test tests/*.test.cjs
```

Editable code is in `src/`. The build produces the self-contained app and its GitHub Pages entry point. See [README.txt](README.txt) and [model plan](plan.html) for details.

## Support

Optional contributions help with coffee and AI development costs. Thank you!

[Buy Me a Coffee](https://buymeacoffee.com/krauhe) Â· [MobilePay](https://qr.mobilepay.dk/box/0946757d-b34b-4b1e-8302-f0a67fc49c69/pay-in)

## License

Copyright Â© 2026 Kristian Rauhe Harreby. Free software under [GNU GPLv3](LICENSE). Developed with AI assistance.

### Optional stove calibration

Stove settings stores one local profile per pan preset: zone/pan name, highest numbered setting, estimated maximum heat input, and assumed linear or gentler-low-settings power curve. A 1-litre boil test uses the same frying pan without a lid at the highest numbered setting (no Boost). Enter elapsed time, initial water/pan temperature, room temperature and test diameter. The inverse lumped heating model includes the selected preset pan heat capacity and estimated convection/radiation losses; evaporation and hob startup are not resolved. The result is approximate effective input, not an electrical power measurement. One endpoint cannot identify both losses and power or calibrate lower settings. The cooking mesh remains a 28 cm pan; the test diameter only affects the calibration loss estimate. Local storage is browser/origin specific; unavailable storage falls back to the current session.

Minced patties now deform with irreversible temperature history (illustrative upper limits: diameter −20%, thickness +30%). The same geometry drives the scene, profile depth, FEM conductances, boundary areas, contact footprint and radiation. Nodal heat capacities stay fixed, conserving energy during deformation; the associated effective density change is a model approximation, not a drip/fat-loss calculation. The shape remains an elliptical cylinder. Whole-cut deformation, curved bulging and fat-dependent coefficients are not yet modeled. Shape controls specify the raw dimensions.

Manual ratings can also be entered with the number of heat levels. Editable transfer guesses are induction 85%, radiant/solid electric 75%, and gas 35%, informed by ENERGY STAR and NYSERDA broad cooking-efficiency comparisons. These are approximate proxies, not measured pan-input efficiencies. Technology does not yet change the simplified burner spatial distribution or response lag. Manual inputs and chosen technology are saved locally with the profile.

Shape-model context: [Purslow et al., structural basis of cooking loss](https://pubmed.ncbi.nlm.nih.gov/28460973/) documents directional contraction in whole beef; [forming-method study](https://pmc.ncbi.nlm.nih.gov/articles/PMC13361929/) illustrates dependence on patty preparation. These support including deformation, not the numerical coefficients chosen here.
