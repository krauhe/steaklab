# SteakLab

An interactive cooking heat-transfer simulator by Kristian Rauhe Harreby.

**[Run SteakLab](https://krauhe.github.io/steaklab/)** — or download `SteakLab.html` and open it locally. No server or installation is needed.

Explore how thickness, shape, moisture, pan material, heat, oil, flipping and resting affect temperature. Drag actions to set their times; click them to change settings. Compare the core, both physical meat sides, and the pan.

## Model

The meat uses axisymmetric finite elements, with contact heat transfer, convection, radiation, evaporation and simplified browning. The pan is a single thermal mass: floor and wall colors show its lumped temperature, not an independently resolved wall gradient. Oil spreading is an illustrative animation, not a fluid solver.

This educational model is not calibrated cooking guidance. Consult the food-safety guidance linked in the app.

## Development

Node.js is needed only for development:

```sh
node build.mjs
node --test tests/*.test.cjs
```

Editable code is in `src/`. The build produces the self-contained app and its GitHub Pages entry point. See [README.txt](README.txt) and [model plan](plan.html) for details.

## Support

Optional contributions help with coffee and AI development costs. Thank you!

[Buy Me a Coffee](https://buymeacoffee.com/krauhe) · [MobilePay](https://qr.mobilepay.dk/box/0946757d-b34b-4b1e-8302-f0a67fc49c69/pay-in)

## License

Copyright © 2026 Kristian Rauhe Harreby. Free software under [GNU GPLv3](LICENSE). Developed with AI assistance.
