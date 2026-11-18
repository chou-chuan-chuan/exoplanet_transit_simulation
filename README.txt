Transit & Binary Star Visual Simulator
=====================================

Static HTML/JavaScript educational simulator. Serve this folder with any HTTP
server, for example python3 -m http.server 8765, then open localhost:8765.
MathJax 3.2.2 loads from jsDelivr for LaTeX rendering (network required).
No backend, telemetry, accounts, or build step.

Planetary Transit retains the original circular transit model and controls.
Binary Star Orbit opens the shared two-body engine at 60 degrees; Eclipsing
Binary opens it edge-on. Either view permits all binary presets and options.
Changing mode does not imply a different force law. All interface text is English.

Binary model
------------
Masses and period determine the semimajor axis through Kepler's third law.
Spherical stars follow barycentric circular or eccentric Keplerian trajectories.
Sky-plane positions, foreground ordering, light curves and receding-positive
radial velocities use the same orbit. Phase zero is periastron; omega belongs
to the relative vector from star 1 to star 2. Eclipse centers and contacts are
computed from projected separation, rather than fixed quarter-period phases.
Primary is the deeper instantaneous eclipse; equal-depth events are labeled.

Advanced Physics (binary modes)
-------------------------------
Independent controls: eccentricity/omega, inclination, third light, Gaussian
photometric noise, exposure integration, and uniform/linear/quadratic limb
profiles separately for both stars. Default: circular, uniform, no third
light, noise or finite exposure. Presets: unequal brightness, equal-mass twins,
grazing, eccentric, and non-eclipsing.

Bolometric luminosity is R^2(T/5772 K)^4 in solar units. Limb profiles preserve
this total luminosity. Uniform occultation uses analytic disk overlap; limb
profiles use 256 midpoint-intensity annuli with exact occulted annulus areas.
Exposure integration uses 32 midpoint samples per segment, splitting at
contacts and centers; contact-aware curve sampling resolves narrow eclipses.
Noise is fixed-seed Gaussian synthetic observations, not a physical variability
model. The orbit and RV display the exposure midpoint, not integrated RV.

Radii that collide at periastron invalidate photometry. Roche-overflow warnings
use Eggleton's formula, with periastron separation as a heuristic for eccentric
systems. No Roche geometry, ellipsoidal variations, reflection, Doppler beaming,
spots, stellar evolution constraints, relativity or light-travel time is modeled.
Colors identify stars; rendered disks are schematic, while photometry includes
selected limb darkening. This is not a calibrated observational fitting tool.

Physics & Equations is visible above the simulator and expands to show the
active equations, definitions, numerical methods, assumptions and source links:
NASA binary dynamics and Kepler equation; Mandel & Agol (2002); Kreidberg (2015);
Householder & Weiss (2023); IAU Resolution B3; Eggleton (1983).

Validation
----------
Run with Node.js:
  node tests/binary-model.test.cjs
  node tests/advanced.test.cjs

20 tests cover circular regressions, overlap, barycenter, scaling, eclipse
classification, narrow events, Kepler residuals, RV finite differences,
eccentric contacts, dilution, linear analytic occultation, quadratic convergence,
exposure convergence/wrapping, collision guards, validation, and noise moments.
Quadratic 256-ring versus 4096-ring comparisons: absolute fraction tolerance
6e-5; exposure 32 versus 256 samples per segment: flux tolerance 2e-5 on tested
cases. These are tested examples, not a global accuracy guarantee.

The original planetary app.js is unchanged. Browser QA includes mode switching,
eccentric preset, optional effects, and MathJax rendering with no console errors.
Deployment is intentionally separate: do not merge or deploy without review.
