/* builder-data.js — periodic table data + sketcher templates.
   ELEMENTS: symbol -> { z, mass, val (typical valence), col (CPK hex) }.
   PT_LAYOUT: rows of {sym, col(1-18)} for the periodic-table grid (gaps = null). */
(function () {
  // atomic masses indexed by Z (1..118)
  var MASS = [0,
    1.008, 4.003, 6.94, 9.012, 10.81, 12.011, 14.007, 15.999, 18.998, 20.18,
    22.99, 24.305, 26.982, 28.085, 30.974, 32.06, 35.45, 39.948, 39.098, 40.078,
    44.956, 47.867, 50.942, 51.996, 54.938, 55.845, 58.933, 58.693, 63.546, 65.38,
    69.723, 72.63, 74.922, 78.971, 79.904, 83.798, 85.468, 87.62, 88.906, 91.224,
    92.906, 95.95, 98, 101.07, 102.906, 106.42, 107.868, 112.414, 114.818, 118.71,
    121.76, 127.6, 126.904, 131.293, 132.905, 137.327, 138.905, 140.116, 140.908, 144.242,
    145, 150.36, 151.964, 157.25, 158.925, 162.5, 164.93, 167.259, 168.934, 173.045,
    174.967, 178.49, 180.948, 183.84, 186.207, 190.23, 192.217, 195.084, 196.967, 200.592,
    204.38, 207.2, 208.98, 209, 210, 222, 223, 226, 227, 232.038,
    231.036, 238.029, 237, 244, 243, 247, 247, 251, 252, 257,
    258, 259, 262, 267, 270, 269, 270, 270, 278, 281,
    282, 285, 286, 289, 289, 293, 294, 294];

  // common valence (main group); transition metals default 0 (no implicit H)
  var VAL = { H: 1, He: 0, Li: 1, Be: 2, B: 3, C: 4, N: 3, O: 2, F: 1, Ne: 0,
    Na: 1, Mg: 2, Al: 3, Si: 4, P: 3, S: 2, Cl: 1, Ar: 0, K: 1, Ca: 2,
    Ga: 3, Ge: 4, As: 3, Se: 2, Br: 1, Kr: 0, Rb: 1, Sr: 2, In: 3, Sn: 4,
    Sb: 3, Te: 2, I: 1, Xe: 0, Cs: 1, Ba: 2, Tl: 3, Pb: 4, Bi: 3, Po: 2, At: 1, Rn: 0 };

  // CPK colors for common elements; others gray
  var COL = { H: '#ffffff', He: '#d9ffff', Li: '#cc80ff', Be: '#c2ff00', B: '#ffb5b5', C: '#909090',
    N: '#3050f8', O: '#ff0d0d', F: '#90e050', Ne: '#b3e3f5', Na: '#ab5cf2', Mg: '#8aff00',
    Al: '#bfa6a6', Si: '#f0c8a0', P: '#ff8000', S: '#ffff30', Cl: '#1ff01f', Ar: '#80d1e3',
    K: '#8f40d4', Ca: '#3dff00', Sc: '#e6e6e6', Ti: '#bfc2c7', V: '#a6a6ab', Cr: '#8a99c7',
    Mn: '#9c7ac7', Fe: '#e06633', Co: '#f090a0', Ni: '#50d050', Cu: '#c88033', Zn: '#7d80b0',
    Ga: '#c28f8f', Ge: '#668f8f', As: '#bd80e3', Se: '#ffa100', Br: '#a62929', Kr: '#5cb8d1',
    Rb: '#702eb0', Sr: '#00ff00', Y: '#94ffff', Zr: '#94e0e0', Mo: '#54b5b5', Ru: '#248f8f',
    Rh: '#0a7d8c', Pd: '#006985', Ag: '#c0c0c0', Cd: '#ffd98f', In: '#a67573', Sn: '#668080',
    Sb: '#9e63b5', Te: '#d47a00', I: '#940094', Xe: '#429eb0', Cs: '#57178f', Ba: '#00c900',
    Pt: '#d0d0e0', Au: '#ffd123', Hg: '#b8b8d0', Pb: '#575961', Bi: '#9e4fb5', U: '#008fff' };

  // build ELEMENTS map from the layout symbols
  var SYMS = ['H','He','Li','Be','B','C','N','O','F','Ne','Na','Mg','Al','Si','P','S','Cl','Ar',
    'K','Ca','Sc','Ti','V','Cr','Mn','Fe','Co','Ni','Cu','Zn','Ga','Ge','As','Se','Br','Kr',
    'Rb','Sr','Y','Zr','Nb','Mo','Tc','Ru','Rh','Pd','Ag','Cd','In','Sn','Sb','Te','I','Xe',
    'Cs','Ba','La','Ce','Pr','Nd','Pm','Sm','Eu','Gd','Tb','Dy','Ho','Er','Tm','Yb','Lu',
    'Hf','Ta','W','Re','Os','Ir','Pt','Au','Hg','Tl','Pb','Bi','Po','At','Rn',
    'Fr','Ra','Ac','Th','Pa','U','Np','Pu','Am','Cm','Bk','Cf','Es','Fm','Md','No','Lr',
    'Rf','Db','Sg','Bh','Hs','Mt','Ds','Rg','Cn','Nh','Fl','Mc','Lv','Ts','Og'];
  var ELEMENTS = {};
  SYMS.forEach(function (s, i) { var z = i + 1; ELEMENTS[s] = { z: z, mass: MASS[z] || 0, val: VAL[s] != null ? VAL[s] : 0, col: COL[s] || '#b8b8c0' }; });

  // periodic-table grid: each row is an array of 18 cells (sym or null)
  function row() { return [null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]; }
  function place(grid, sym, r, c) { while (grid.length <= r) grid.push(row()); grid[r][c - 1] = sym; }
  var GRID = [];
  // main periods
  place(GRID,'H',0,1); place(GRID,'He',0,18);
  ['Li','Be'].forEach(function(s,i){place(GRID,s,1,i+1);}); ['B','C','N','O','F','Ne'].forEach(function(s,i){place(GRID,s,1,i+13);});
  ['Na','Mg'].forEach(function(s,i){place(GRID,s,2,i+1);}); ['Al','Si','P','S','Cl','Ar'].forEach(function(s,i){place(GRID,s,2,i+13);});
  ['K','Ca','Sc','Ti','V','Cr','Mn','Fe','Co','Ni','Cu','Zn','Ga','Ge','As','Se','Br','Kr'].forEach(function(s,i){place(GRID,s,3,i+1);});
  ['Rb','Sr','Y','Zr','Nb','Mo','Tc','Ru','Rh','Pd','Ag','Cd','In','Sn','Sb','Te','I','Xe'].forEach(function(s,i){place(GRID,s,4,i+1);});
  ['Cs','Ba','La','Hf','Ta','W','Re','Os','Ir','Pt','Au','Hg','Tl','Pb','Bi','Po','At','Rn'].forEach(function(s,i){place(GRID,s, 5, i===2? 3 : (i<3? i+1 : i+1));});
  // fix period 6: La then gap of f-block then Hf.. — place explicitly
  GRID[5] = row(); ['Cs','Ba','La'].forEach(function(s,i){GRID[5][i]=s;}); ['Hf','Ta','W','Re','Os','Ir','Pt','Au','Hg','Tl','Pb','Bi','Po','At','Rn'].forEach(function(s,i){GRID[5][i+3]=s;});
  GRID[6] = row(); ['Fr','Ra','Ac'].forEach(function(s,i){GRID[6][i]=s;}); ['Rf','Db','Sg','Bh','Hs','Mt','Ds','Rg','Cn','Nh','Fl','Mc','Lv','Ts','Og'].forEach(function(s,i){GRID[6][i+3]=s;});
  // f-block (two extra rows, offset)
  var LAN = ['Ce','Pr','Nd','Pm','Sm','Eu','Gd','Tb','Dy','Ho','Er','Tm','Yb','Lu'];
  var ACT = ['Th','Pa','U','Np','Pu','Am','Cm','Bk','Cf','Es','Fm','Md','No','Lr'];
  var FROW1 = row(); LAN.forEach(function(s,i){FROW1[i+3]=s;});
  var FROW2 = row(); ACT.forEach(function(s,i){FROW2[i+3]=s;});
  GRID.push(row()); GRID.push(FROW1); GRID.push(FROW2);

  // full element names indexed by Z (1..118), for tooltips + legend
  var NAMES = ['',
    'Hydrogen','Helium','Lithium','Beryllium','Boron','Carbon','Nitrogen','Oxygen','Fluorine','Neon',
    'Sodium','Magnesium','Aluminium','Silicon','Phosphorus','Sulfur','Chlorine','Argon','Potassium','Calcium',
    'Scandium','Titanium','Vanadium','Chromium','Manganese','Iron','Cobalt','Nickel','Copper','Zinc',
    'Gallium','Germanium','Arsenic','Selenium','Bromine','Krypton','Rubidium','Strontium','Yttrium','Zirconium',
    'Niobium','Molybdenum','Technetium','Ruthenium','Rhodium','Palladium','Silver','Cadmium','Indium','Tin',
    'Antimony','Tellurium','Iodine','Xenon','Caesium','Barium','Lanthanum','Cerium','Praseodymium','Neodymium',
    'Promethium','Samarium','Europium','Gadolinium','Terbium','Dysprosium','Holmium','Erbium','Thulium','Ytterbium',
    'Lutetium','Hafnium','Tantalum','Tungsten','Rhenium','Osmium','Iridium','Platinum','Gold','Mercury',
    'Thallium','Lead','Bismuth','Polonium','Astatine','Radon','Francium','Radium','Actinium','Thorium',
    'Protactinium','Uranium','Neptunium','Plutonium','Americium','Curium','Berkelium','Californium','Einsteinium','Fermium',
    'Mendelevium','Nobelium','Lawrencium','Rutherfordium','Dubnium','Seaborgium','Bohrium','Hassium','Meitnerium','Darmstadtium',
    'Roentgenium','Copernicium','Nihonium','Flerovium','Moscovium','Livermorium','Tennessine','Oganesson'];

  // element category for the periodic-table colouring (classroom style)
  var CATEGORY = {};
  function setCat(list, c) { list.forEach(function (s) { CATEGORY[s] = c; }); }
  setCat(['Li','Na','K','Rb','Cs','Fr'], 'alkali');
  setCat(['Be','Mg','Ca','Sr','Ba','Ra'], 'alkaline');
  setCat(['Sc','Ti','V','Cr','Mn','Fe','Co','Ni','Cu','Zn','Y','Zr','Nb','Mo','Tc','Ru','Rh','Pd','Ag','Cd',
    'Hf','Ta','W','Re','Os','Ir','Pt','Au','Hg','Rf','Db','Sg','Bh','Hs','Mt','Ds','Rg','Cn'], 'transition');
  setCat(['Al','Ga','In','Sn','Tl','Pb','Bi','Nh','Fl','Mc','Lv'], 'post');
  setCat(['B','Si','Ge','As','Sb','Te','Po'], 'metalloid');
  setCat(['H','C','N','O','P','S','Se'], 'nonmetal');
  setCat(['F','Cl','Br','I','At','Ts'], 'halogen');
  setCat(['He','Ne','Ar','Kr','Xe','Rn','Og'], 'noble');
  setCat(['La','Ce','Pr','Nd','Pm','Sm','Eu','Gd','Tb','Dy','Ho','Er','Tm','Yb','Lu'], 'lanthanide');
  setCat(['Ac','Th','Pa','U','Np','Pu','Am','Cm','Bk','Cf','Es','Fm','Md','No','Lr'], 'actinide');

  // category metadata: order, label, fill colour (text is a shared dark slate)
  var CAT_META = [
    { key: 'alkali',     label: 'Alkali metal',        fill: '#F6CDB7' },
    { key: 'alkaline',   label: 'Alkaline earth',      fill: '#F7E0AE' },
    { key: 'transition', label: 'Transition metal',    fill: '#C9DAF1' },
    { key: 'post',       label: 'Post-transition',     fill: '#DBE1E9' },
    { key: 'metalloid',  label: 'Metalloid',           fill: '#BFE3D0' },
    { key: 'nonmetal',   label: 'Reactive nonmetal',   fill: '#CDE9B6' },
    { key: 'halogen',    label: 'Halogen',             fill: '#EDE7A6' },
    { key: 'noble',      label: 'Noble gas',           fill: '#D7C9EE' },
    { key: 'lanthanide', label: 'Lanthanide',          fill: '#F4CBDF' },
    { key: 'actinide',   label: 'Actinide',            fill: '#F1C7CC' }
  ];
  var CAT_FILL = {}; CAT_META.forEach(function (m) { CAT_FILL[m.key] = m.fill; });

  var QUICK = ['C','H','N','O','S','P','F','Cl','Br','I','B','Si'];

  // ---- templates: 2D fragments. coords in bond-length units (L=1). attach: index of atom that fuses. ----
  var DEG = Math.PI / 180;
  function ring(n, startAng) {
    var a = [], r = 0.5 / Math.sin(Math.PI / n);
    for (var i = 0; i < n; i++) { var t = (startAng || 0) + i * 360 / n * DEG; a.push({ el: 'C', x: r * Math.cos(t), y: r * Math.sin(t) }); }
    var b = []; for (var k = 0; k < n; k++) b.push({ a: k, b: (k + 1) % n, order: 1 });
    return { atoms: a, bonds: b };
  }
  function benzene() { var g = ring(6, 90); [0, 2, 4].forEach(function (i) { g.bonds[i].order = 2; }); return g; }
  function naphthalene() {
    var L = 1, h = Math.sqrt(3) / 2;
    var pts = [[0,1],[h,0.5],[h,-0.5],[0,-1],[-h,-0.5],[-h,0.5],[2*h,1],[3*h,0.5],[3*h,-0.5],[2*h,-1]];
    var atoms = pts.map(function (p) { return { el: 'C', x: p[0], y: p[1] }; });
    var bonds = [[0,1,2],[1,2,1],[2,3,2],[3,4,1],[4,5,2],[5,0,1],[1,6,1],[6,7,2],[7,8,1],[8,9,2],[9,2,1]].map(function (b) { return { a: b[0], b: b[1], order: b[2] }; });
    return { atoms: atoms, bonds: bonds };
  }
  var TEMPLATES = {
    benzene: { name: 'Benzene', build: benzene },
    cyclohexane: { name: 'Cyclohexane', build: function () { return ring(6, 90); } },
    cyclopentane: { name: 'Cyclopentane', build: function () { return ring(5, 90); } },
    cyclopropane: { name: 'Cyclopropane', build: function () { return ring(3, 90); } },
    cyclobutane: { name: 'Cyclobutane', build: function () { return ring(4, 45); } },
    cycloheptane: { name: 'Cycloheptane', build: function () { return ring(7, 90); } },
    naphthalene: { name: 'Naphthalene', build: naphthalene }
  };
  // functional groups: a chain stamped from a clicked atom (first atom = attach point on existing atom)
  var GROUPS = {
    methyl:   { name: 'Methyl –CH₃', atoms: [{ el: 'C', x: 1, y: 0 }], bonds: [] },
    hydroxyl: { name: 'Hydroxyl –OH', atoms: [{ el: 'O', x: 1, y: 0 }], bonds: [] },
    amine:    { name: 'Amine –NH₂', atoms: [{ el: 'N', x: 1, y: 0 }], bonds: [] },
    carbonyl: { name: 'Carbonyl =O', atoms: [{ el: 'O', x: 1, y: 0 }], bonds: [], order: 2 },
    nitrile:  { name: 'Nitrile –C≡N', atoms: [{ el: 'C', x: 1, y: 0 }, { el: 'N', x: 2, y: 0 }], bonds: [[0, 1, 3]] },
    carboxyl: { name: 'Carboxyl –COOH', atoms: [{ el: 'C', x: 1, y: 0 }, { el: 'O', x: 1.7, y: 0.7 }, { el: 'O', x: 1.7, y: -0.7 }], bonds: [[0, 1, 2], [0, 2, 1]] },
    nitro:    { name: 'Nitro –NO₂', atoms: [{ el: 'N', x: 1, y: 0 }, { el: 'O', x: 1.7, y: 0.7 }, { el: 'O', x: 1.7, y: -0.7 }], bonds: [[0, 1, 2], [0, 2, 1]] }
  };

  window.BUILDER_DATA = { ELEMENTS: ELEMENTS, GRID: GRID, QUICK: QUICK, TEMPLATES: TEMPLATES, GROUPS: GROUPS, MASS: MASS,
    NAMES: NAMES, CATEGORY: CATEGORY, CAT_META: CAT_META, CAT_FILL: CAT_FILL };
})();
