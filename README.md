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
- `styles.css`: layout, local Inter font, responsive styles, cloud and mist motion.
- `script.js`: navigation and continuous cape animation. The hero's body stays fixed. One control pauses all motion, and reduced-motion preferences are respected.
- `public/assets/`: the approved artwork, animation layers, masks, and Inter license.

Set the destination URLs at the top of `script.js` when the Games, Publishing, About, and Contact pages are ready. These currently show an explicit preview notice.

The Inter font license is included in `public/assets/Inter-LICENSE.txt`.
