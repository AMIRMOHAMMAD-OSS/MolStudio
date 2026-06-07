/* presets.js — element palettes, backgrounds, and figure templates. */
(function () {
  // Element color palettes (hex numbers for 3Dmol colorscheme maps).
  var PALETTES = {
    jmol: {
      label: 'Jmol classic',
      swatch: ['#909090', '#ffffff', '#ff0d0d', '#3050f8', '#ffff30'],
      map: { C: 0x909090, H: 0xffffff, O: 0xff0d0d, N: 0x3050f8, S: 0xffff30, P: 0xff8000,
             F: 0x90e050, Cl: 0x1ff01f, Br: 0xa62929, I: 0x940094, Fe: 0xe06633,
             Ca: 0x3dff00, Na: 0xab5cf2, Mg: 0x8aff00, Zn: 0x7d80b0 }
    },
    pastel: {
      label: 'Pastel',
      swatch: ['#9aa0a8', '#fbfbfb', '#ff9aa2', '#a7c4f2', '#ffe6a7'],
      map: { C: 0x9aa0a8, H: 0xfbfbfb, O: 0xff9aa2, N: 0xa7c4f2, S: 0xffe6a7, P: 0xffc09a,
             F: 0xb8e6c2, Cl: 0xb8e6b8, Br: 0xd6a8a8, I: 0xcaa8d6, Fe: 0xe6b89a,
             Ca: 0xb8e6a0, Na: 0xd6c2f2, Mg: 0xcdf2a0, Zn: 0xc2c4d6 }
    },
    mono: {
      label: 'Monochrome blue',
      swatch: ['#5b7fa6', '#dce7f2', '#102a43', '#2c5d8c', '#84a9cf'],
      map: { C: 0x5b7fa6, H: 0xdce7f2, O: 0x102a43, N: 0x2c5d8c, S: 0x84a9cf, P: 0x486fa0,
             F: 0xa9c4e0, Cl: 0x6e92ba, Br: 0x32507a, I: 0x1d3a5f, Fe: 0x244a72,
             Ca: 0x9bbad9, Na: 0xbdd3ec, Mg: 0xa9c4e0, Zn: 0x6e92ba }
    },
    neon: {
      label: 'Neon',
      swatch: ['#22d3ee', '#f0f9ff', '#ff2d78', '#a855f7', '#facc15'],
      map: { C: 0x22d3ee, H: 0xf0f9ff, O: 0xff2d78, N: 0xa855f7, S: 0xfacc15, P: 0xfb923c,
             F: 0x4ade80, Cl: 0x34d399, Br: 0xf472b6, I: 0xc084fc, Fe: 0xfb7185,
             Ca: 0x86efac, Na: 0xd8b4fe, Mg: 0xbef264, Zn: 0x93c5fd }
    },
    earth: {
      label: 'Earth tones',
      swatch: ['#6b5d4f', '#f2ece1', '#b5502c', '#4f6b52', '#c99a3f'],
      map: { C: 0x6b5d4f, H: 0xf2ece1, O: 0xb5502c, N: 0x4f6b52, S: 0xc99a3f, P: 0xc97f3f,
             F: 0x8aa06b, Cl: 0x7a9462, Br: 0x9c5a3c, I: 0x6e4a6b, Fe: 0xa8622e,
             Ca: 0x9aa06b, Na: 0x9c8ab0, Mg: 0xa8b06b, Zn: 0x8a8c98 }
    },
    grayscale: {
      label: 'Grayscale',
      swatch: ['#4a4a4a', '#ffffff', '#1a1a1a', '#7a7a7a', '#aeaeae'],
      map: { C: 0x4a4a4a, H: 0xfafafa, O: 0x1a1a1a, N: 0x6a6a6a, S: 0x9a9a9a, P: 0x808080,
             F: 0xc0c0c0, Cl: 0xb0b0b0, Br: 0x505050, I: 0x303030, Fe: 0x707070,
             Ca: 0xc8c8c8, Na: 0xd8d8d8, Mg: 0xc0c0c0, Zn: 0x888888 }
    }
  };

  // Backgrounds. alpha:0 => transparent export.
  var BACKGROUNDS = [
    { key: 'white',     label: 'White',     color: '#ffffff', alpha: 1 },
    { key: 'paper',     label: 'Paper',     color: '#f4f1ea', alpha: 1 },
    { key: 'mist',      label: 'Mist',      color: '#eef1f5', alpha: 1 },
    { key: 'slate',     label: 'Slate',     color: '#1e2530', alpha: 1 },
    { key: 'navy',      label: 'Midnight',  color: '#0a1530', alpha: 1 },
    { key: 'blueprint', label: 'Blueprint', color: '#0d2b4d', alpha: 1 },
    { key: 'black',     label: 'Black',     color: '#000000', alpha: 1 },
    { key: 'clear',     label: 'Transparent', color: '#ffffff', alpha: 0 }
  ];

  // Representations.
  var REPS = [
    { key: 'ballstick', label: 'Ball & stick' },
    { key: 'stick',     label: 'Stick' },
    { key: 'sphere',    label: 'Space-filling' },
    { key: 'line',      label: 'Wireframe' },
    { key: 'cartoon',   label: 'Cartoon' },
    { key: 'surface',   label: 'Surface' }
  ];

  // Coloring modes.
  var COLOR_MODES = [
    { key: 'element',  label: 'By element' },
    { key: 'carbon',   label: 'Carbon accent' },
    { key: 'spectrum', label: 'Spectrum' },
    { key: 'chain',    label: 'By chain' },
    { key: 'single',   label: 'Single color' }
  ];

  // Figure templates — one-click looks.
  var TEMPLATES = [
    { key: 'pub',       name: 'Publication',  hint: 'Clean ball & stick on white',
      style: { rep: 'ballstick', palette: 'jmol', bg: 'white', colorMode: 'element', outline: false } },
    { key: 'slide',     name: 'Dark slide',   hint: 'High-contrast for presentations',
      style: { rep: 'ballstick', palette: 'neon', bg: 'navy', colorMode: 'element', outline: true } },
    { key: 'pastel',    name: 'Pastel paper', hint: 'Soft tones on warm paper',
      style: { rep: 'ballstick', palette: 'pastel', bg: 'paper', colorMode: 'element', outline: false } },
    { key: 'blueprint', name: 'Blueprint',    hint: 'Wireframe schematic',
      style: { rep: 'line', palette: 'mono', bg: 'blueprint', colorMode: 'single', single: '#bcdcff', outline: false } },
    { key: 'cpk',       name: 'CPK space-fill', hint: 'Solid van der Waals spheres',
      style: { rep: 'sphere', palette: 'jmol', bg: 'mist', colorMode: 'element', outline: false } },
    { key: 'glow',      name: 'Neon glow',    hint: 'Vivid sticks on black',
      style: { rep: 'stick', palette: 'neon', bg: 'black', colorMode: 'element', outline: true } },
    { key: 'ribbon',    name: 'Protein ribbon', hint: 'Cartoon spectrum (proteins)',
      style: { rep: 'cartoon', palette: 'jmol', bg: 'white', colorMode: 'spectrum', outline: false } },
    { key: 'surf',      name: 'Molecular surface', hint: 'Translucent surface shell',
      style: { rep: 'surface', palette: 'jmol', bg: 'mist', colorMode: 'element', outline: false } }
  ];

  window.PRESETS = { PALETTES: PALETTES, BACKGROUNDS: BACKGROUNDS, REPS: REPS, COLOR_MODES: COLOR_MODES, TEMPLATES: TEMPLATES };
})();
