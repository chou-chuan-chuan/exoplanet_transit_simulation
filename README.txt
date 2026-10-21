EXOPLANET TRANSIT VISUAL SIMULATOR
==================================

Files
-----
index.html  Main webpage
style.css   Black-and-gray responsive styling and local webfont
app.js      Transit geometry, numerical integration, plotting, and controls

How to run
----------
1. Extract the ZIP file.
2. Open index.html in Chrome, Edge, Firefox, or Safari.
3. No installation or web server is required.

Reset behavior
--------------
The Reset selected case button:
- stops a running animation;
- restores the selected case's a/Rs, P, Rp/Rs, u1, and u2;
- restores inclination to 88 degrees;
- restores Annuli N to 300;
- restores the time range to 0.08 d;
- restores frame time to 0 d;
- recalculates and redraws every plot.

The Visual transit geometry and Transit light curve canvases are kept at a
1:1 display ratio on desktop and mobile layouts.

Model assumptions and safeguards
--------------------------------
- The orbit is circular and t = 0 is inferior conjunction (mid-transit).
- Projected overlap while the planet is behind the star is not counted as a
  stellar transit.
- Annulus integration samples radial midpoints to reduce edge bias.
- The time grid contains an exact t = 0 sample.
- Non-negative quadratic limb-darkening coefficients are constrained so
  u1 + u2 <= 1, keeping the intensity at the stellar limb non-negative.
- T14 is the first-to-fourth-contact duration for the circular-orbit model.

Font
----
The interface and canvas labels use QuanFangwei Supplement Web, served locally
from assets/fonts/quanfangwei-supplement/.
