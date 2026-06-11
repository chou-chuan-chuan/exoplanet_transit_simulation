# Exoplanet Transit Visual Simulator Website

This is a browser-based version of the MATLAB exoplanet transit visual app.

## Files

- `index.html` — webpage structure
- `style.css` — responsive layout and visual design
- `app.js` — transit physics, sliders, animation, and plotting

## How to run locally

Open `index.html` in a browser.

For a cleaner local test, you can also run a small local server:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## How to publish

Upload these three files to GitHub Pages, Netlify, Vercel, or any static web hosting service.

## Notes

This version does not require MATLAB. It uses pure HTML, CSS, and JavaScript.
The numerical model uses quadratic limb darkening and annulus integration.


Update note: The Visual transit geometry panel uses a 1:1 square canvas, and the star/planet are drawn with equal x-y scaling so circles remain circular.


Update notes:
- Visual transit geometry keeps a true 1:1 square ratio.
- Transit light curve canvas keeps a fixed 16:9 wide ratio instead of being stretched by the layout.
