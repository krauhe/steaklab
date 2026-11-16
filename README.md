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
