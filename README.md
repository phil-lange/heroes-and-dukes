# Heroes and Dukes

The animated Heroes and Dukes landing page.

**Website:** https://phil-lange.github.io/heroes-and-dukes/

## Local development

Use Node.js 24 (or Node.js 22.13+).

```sh
npm ci
npm run dev
```

`npm run build` creates the static site in `dist/`. `npm run preview` serves that build locally.

## Deployment

GitHub Actions builds and deploys to GitHub Pages after every push to `main`. Pull requests run the build without deploying. The workflow can also be started manually from the Actions tab.

The workflow uses GitHub's temporary deployment token; no personal access tokens or deployment secrets are needed. Pages must use **GitHub Actions** as its publishing source.

## Editing

- `index.html`: page content, navigation, and the original white logo with its background removed.
- `styles.css`: layout, local Inter font, responsive styles, and atmosphere layers.
- `script.js`: navigation, atmosphere transforms and continuous cape animation. The hero's body stays fixed. At widths up to 800px, the adventurer is 18% larger with boots anchored to the ground, the cape has 3.2× the cloth displacement and a 45% quicker wind cycle, and clouds/mist travel more actively. Wind phases blend smoothly across viewport changes. Clouds and mist start independently of character loading; only one atlas frame is processed.
- `motion.js`: a shared animation clock, image-load fallback and playback controls. Page restore, focus and visibility changes recover the clock. Reduced-motion preferences start paused with a visible Play button; an explicit choice is remembered for the browser session.
- `intro.js` / `intro.css`: a gateway entrance tied to artwork readiness. An illuminated arch opens onto the landscape while the original logo moves into the header and the typography rises into place. The logo starts only after decoding, and the sequence counts visible time so background tabs cannot skip it. Resizing updates the logo destination without ending the reveal. Skip intro or Escape opens the page immediately; reduced-motion settings omit the travel. Asset deadlines and a visible-time bootstrap fallback prevent stalled requests or module failures from trapping visitors.
- `public/assets/`: the approved artwork, animation layers, masks, and Inter license.

Set the destination URLs at the top of `script.js` when the Games, Publishing, About, and Contact pages are ready. These currently show an explicit preview notice.

The Inter font license is included in `public/assets/Inter-LICENSE.txt`.

`npm test` checks startup, pause/resume, page restore, reduced-motion overrides, image-load fallbacks, entrance readiness deadlines, delayed logo loading, background-tab entrances and cancellation. These checks also run in GitHub Actions before deployment.
