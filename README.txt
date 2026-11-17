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

BINARY STAR MODE / 雙星與食雙星模式
=================================
在頁面上方選擇「Binary stars · 雙星與食雙星」。原有行星凌日模式、
Case A–D、臨邊昏暗控制和數值積分仍保留；切換模式會暫停動畫並保留參數。

操作
----
- 調整兩星質量（M☉）、半徑（R☉）、有效溫度（K）、週期（日）、傾角。
- 拖曳相位或播放動畫，兩張軌道圖與光變曲線的紅點同步移動。
  動畫每 12 秒播放一個軌道週期；這是展示速度，物理時間仍為 t = phase × P。
- 「主食中心／次食中心」跳至兩次食；等深食改標為第一次／第二次食。
- 範例包含不同溫度、相同雙星、掠食與 60° 無食。
- 「重設範例」停止動畫並恢復所選範例的所有參數及相位。
- 不需安裝套件，仍可直接開啟 index.html（script 使用傳統載入，非 ES modules）。

物理定義
--------
a³ = G(M₁ + M₂)P² / (4π²)，a 是相對軌道半長軸（圓軌道星間距）。
a₁ = a M₂/(M₁+M₂)，a₂ = a M₁/(M₁+M₂)。長度以太陽半徑表示。
使用 nominal GM☉ = 1.3271244e20 m³/s²、R☉ = 6.957e8 m。
軌道平面的相對位置 = (a cos θ, a sin θ)，θ = 2π phase。
投影 y = a sin θ cos i，視線 z = a sin θ sin i，+z 朝觀測者。
星 1 和星 2 依質量比例分別在相對位置的負向和正向。
因此 phase 0.25 星 2 在前；phase 0.75 星 1 在前。

均勻表面亮度 S ∝ T⁴；光度 L/L☉ = (R/R☉)²(T/5772 K)⁴。
利用解析兩圓交疊面積 A，扣除後方恆星的光：
F = 1 - A × S_back / [π(R₁²S₁ + R₂²S₂)]。
食外通量歸一化為 1；前方恆星本身的發光仍計入。
圓軌道兩次合相的最小投影距離相同：a cos i。
只有 a cos i < R₁+R₂ 時會有食，較熱表面被遮蔽時為較深的主食。
相同溫度（即使半徑不同）會有等深食，不以質量或總光度指定主食。
T14 是每次食第一至第四接觸的時間；兩次食在本模型中等長。
曲線在兩次食附近補上密集取樣與精確合相點，避免漏掉窄食。

範圍與限制
----------
第一階段僅有 e = 0；圓軌道沒有獨立有意義的近心點幅角。
未加入雙星外的環雙星行星或三體動力學。
球形、不透明、均勻亮度、全波段黑體近似；未含臨邊昏暗、反照、
潮汐形變、重力昏暗、星斑、都卜勒增亮、光行時或第三光。
可獨立選擇質量、半徑、溫度；未套用恆星演化／質量光度關係。
圖中顏色用於區分星別，並非亮度或溫度校色；幾何大小使用真實比例。
若 a <= R₁+R₂，停止有效光變與播放並要求調整參數。
Eggleton Roche 瓣體積等效半徑用於提醒球形近似失效，並不模擬質量轉移。

程式結構與測試
--------------
binary-model.js       無 DOM 依賴的物理核心（瀏覽器及 CommonJS 可用）
binary-ui.js          雙星參數、模式切換、動畫及繪圖
app.js                原有凌日模型；僅加上隱藏模式不繪圖的保護
index.html/style.css  沿用原有黑灰配色、字型及響應式卡片

若有 Node.js，可執行：node tests/binary-model.test.cjs
涵蓋 Kepler 比例、質心、交疊邊界、主次食深度、溫度反轉、等深食、
無食、接觸時間、無效組合、Roche 提示與短食取樣。

物理參考
--------
NASA, Deriving Kepler's Formula for Binary Stars:
https://imagine.gsfc.nasa.gov/features/yba/CygX1_mass/binary/equation_derive.html
University of Nebraska–Lincoln, Luminosity of Eclipsing Binary Systems:
https://astro.unl.edu/naap/ebs/luminosity.html
Eggleton (1983), Approximations to the radii of Roche lobes:
https://doi.org/10.1086/160960
