/* demos.js — baked real result (glycerol .fchk) + generated demo datasets that
   exercise every visualization: optimization path, vibrational modes + IR,
   MD trajectory + RMSD, TD-DFT UV-Vis, and real volumetric cubes (orbital lobes,
   density, ESP from actual partial charges). Attaches to window.RESULTS.DEMOS. */
(function () {
  var R = window.RESULTS, HA2EV = 27.211386;
  var A2B = 1 / 0.529177210903;

  // ---------------- cube generation (real volumetric grids) ----------------
  // atoms: [{el,x,y,z}] Angstrom; fn(x,y,z)->scalar (Angstrom in). Returns Gaussian cube text.
  function makeCube(atoms, fn, pad, step) {
    pad = pad || 3.0; step = step || 0.26;
    var lo = { x: Infinity, y: Infinity, z: Infinity }, hi = { x: -Infinity, y: -Infinity, z: -Infinity };
    atoms.forEach(function (a) {
      lo.x = Math.min(lo.x, a.x); lo.y = Math.min(lo.y, a.y); lo.z = Math.min(lo.z, a.z);
      hi.x = Math.max(hi.x, a.x); hi.y = Math.max(hi.y, a.y); hi.z = Math.max(hi.z, a.z);
    });
    var ox = lo.x - pad, oy = lo.y - pad, oz = lo.z - pad;
    var nx = Math.ceil((hi.x - lo.x + 2 * pad) / step);
    var ny = Math.ceil((hi.y - lo.y + 2 * pad) / step);
    var nz = Math.ceil((hi.z - lo.z + 2 * pad) / step);
    var out = ['CUBE generated', 'scalar field'];
    function f(n) { return (n >= 0 ? ' ' : '') + n.toFixed(6) + 'E+00'.replace('E+00', ''); }
    // header (Bohr units)
    out.push(pad6(atoms.length) + sci(ox * A2B) + sci(oy * A2B) + sci(oz * A2B));
    out.push(pad6(nx) + sci(step * A2B) + sci(0) + sci(0));
    out.push(pad6(ny) + sci(0) + sci(step * A2B) + sci(0));
    out.push(pad6(nz) + sci(0) + sci(0) + sci(step * A2B));
    var Z = R.constants ? null : null;
    var ZMAP = { H: 1, C: 6, N: 7, O: 8, F: 9, P: 15, S: 16, Cl: 17 };
    atoms.forEach(function (a) {
      var z = ZMAP[a.el] || 6;
      out.push(pad6(z) + sci(z) + sci(a.x * A2B) + sci(a.y * A2B) + sci(a.z * A2B));
    });
    var row = [], buf = [];
    for (var ix = 0; ix < nx; ix++) {
      var x = ox + ix * step;
      for (var iy = 0; iy < ny; iy++) {
        var y = oy + iy * step;
        for (var iz = 0; iz < nz; iz++) {
          var z2 = oz + iz * step;
          row.push(sci(fn(x, y, z2)));
          if (row.length === 6) { buf.push(row.join('')); row = []; }
        }
        if (row.length) { buf.push(row.join('')); row = []; }
      }
    }
    return out.join('\n') + '\n' + buf.join('\n') + '\n';
  }
  function pad6(n) { var s = String(n); return '          '.slice(0, Math.max(0, 5 - s.length)) + s; }
  function sci(v) {
    var s = v.toExponential(5);
    if (v >= 0) s = ' ' + s;
    return ' ' + s.replace('e', 'E');
  }

  function gridAtoms(els, coords) { return els.map(function (e, i) { return { el: e, x: coords[i].x, y: coords[i].y, z: coords[i].z }; }); }

  // ---------------- small-molecule geometries (Angstrom) ----------------
  function P(x, y, z) { return { x: x, y: y, z: z }; }
  var ETHYLENE = {
    els: ['C', 'C', 'H', 'H', 'H', 'H'],
    xyz: [P(-0.667, 0, 0), P(0.667, 0, 0), P(-1.232, 0.923, 0), P(-1.232, -0.923, 0), P(1.232, 0.923, 0), P(1.232, -0.923, 0)]
  };
  var WATER = { els: ['O', 'H', 'H'], xyz: [P(0, 0, 0.119), P(0, 0.763, -0.477), P(0, -0.763, -0.477)] };
  var FORMALDEHYDE = { els: ['C', 'O', 'H', 'H'], xyz: [P(0, 0, -0.53), P(0, 0, 0.66), P(0, 0.94, -1.11), P(0, -0.94, -1.11)] };

  // ---------------- 1. real glycerol from .fchk ----------------
  function glycerol(raw) {
    var els = raw.atoms.map(function (a) { return a[0]; });
    var coords = raw.atoms.map(function (a) { return P(a[1], a[2], a[3]); });
    var dipAU = raw.dipoleAU, dipDebye = Math.hypot(dipAU[0], dipAU[1], dipAU[2]) * 2.541746;
    // density + ESP cubes from real Mulliken charges
    var at = gridAtoms(els, coords);
    var alpha = { H: 2.4, C: 1.7, O: 1.9 };
    function dens(x, y, z) {
      var s = 0; for (var i = 0; i < at.length; i++) { var a = at[i], r2 = (x - a.x) * (x - a.x) + (y - a.y) * (y - a.y) + (z - a.z) * (z - a.z); s += Math.exp(-(alpha[a.el] || 1.8) * Math.sqrt(r2) * 2); } return s;
    }
    function esp(x, y, z) {
      var v = 0; for (var i = 0; i < at.length; i++) { var a = at[i], r = Math.sqrt((x - a.x) * (x - a.x) + (y - a.y) * (y - a.y) + (z - a.z) * (z - a.z)) + 0.4; v += raw.mulliken[i] / r; } return v;
    }
    var densCube = makeCube(at, dens, 2.6, 0.30);
    var espCube = makeCube(at, esp, 2.6, 0.30);
    return {
      key: 'glycerol-fchk', name: 'Glycerol', formula: 'C₃H₈O₃', cat: 'Sample results', source: 'B3LYP/6-31++G(d,p) · real .fchk',
      elements: els, frames: [{ coords: coords, energy: raw.scfHartree, label: 'optimized' }],
      baseXYZ: R.xyzText(els, coords, 'glycerol'),
      orbitals: { energies: raw.orbE, nOcc: raw.nOcc, homo: raw.nOcc - 1 },
      charges: { kind: 'Mulliken', values: raw.mulliken },
      dipole: { x: dipAU[0], y: dipAU[1], z: dipAU[2], debye: dipDebye },
      cubes: [
        { name: 'Electron density', kind: 'density', text: densCube, isoDefault: 0.02 },
        { name: 'ESP (Mulliken)', kind: 'esp', text: espCube, espText: espCube, isoDefault: 0.02 }
      ],
      scalars: {
        'SCF energy': raw.scfHartree.toFixed(6) + ' Ha',
        'HOMO–LUMO gap': ((raw.orbE[raw.nOcc] - raw.orbE[raw.nOcc - 1]) * HA2EV).toFixed(3) + ' eV',
        'Dipole': dipDebye.toFixed(3) + ' D', 'Atoms': '14', 'Basis functions': '162'
      }
    };
  }

  // ---------------- 2. orbital cubes on ethylene (π / π*) ----------------
  function ethyleneOrbitals() {
    var at = gridAtoms(ETHYLENE.els, ETHYLENE.xyz);
    function pz(cx, cy, cz, x, y, z) { var dx = x - cx, dy = y - cy, dz = z - cz; var r = Math.sqrt(dx * dx + dy * dy + dz * dz); return dz * Math.exp(-1.55 * r); }
    var c1 = ETHYLENE.xyz[0], c2 = ETHYLENE.xyz[1];
    function piBond(x, y, z) { return pz(c1.x, c1.y, c1.z, x, y, z) + pz(c2.x, c2.y, c2.z, x, y, z); }
    function piStar(x, y, z) { return pz(c1.x, c1.y, c1.z, x, y, z) - pz(c2.x, c2.y, c2.z, x, y, z); }
    return {
      key: 'ethylene-mo', name: 'Ethylene π system', formula: 'C₂H₄', cat: 'Sample results', source: 'Frontier orbitals (analytic)',
      elements: ETHYLENE.els, frames: [{ coords: ETHYLENE.xyz, energy: -78.5874, label: 'eq' }],
      baseXYZ: R.xyzText(ETHYLENE.els, ETHYLENE.xyz, 'ethylene'),
      cubes: [
        { name: 'HOMO (π)', kind: 'mo', text: makeCube(at, piBond, 3.2, 0.24), isoDefault: 0.04 },
        { name: 'LUMO (π*)', kind: 'mo', text: makeCube(at, piStar, 3.2, 0.24), isoDefault: 0.04 }
      ],
      orbitals: { energies: [-0.376, -0.018], nOcc: 1, homo: 0, sparse: true },
      scalars: { 'System': 'Ethylene', 'Shown': 'HOMO (π) / LUMO (π*)', 'Note': 'Analytic 2p_z lobes for isosurface demo' }
    };
  }

  // ---------------- 3. geometry optimization (ethanol relaxing) ----------------
  function optDemo() {
    var els = ['C', 'C', 'O', 'H', 'H', 'H', 'H', 'H', 'H'];
    var eq = [P(1.16, -0.18, 0), P(-0.05, 0.72, 0), P(-1.20, -0.10, 0), P(2.07, 0.42, 0), P(1.16, -0.82, 0.88), P(1.16, -0.82, -0.88),
      P(-0.07, 1.36, 0.88), P(-0.07, 1.36, -0.88), P(-1.95, 0.47, 0)];
    var n = 14, frames = [], Emin = -154.0759;
    var seed = 7; function rnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280 - 0.5; }
    var pert = eq.map(function () { return P(rnd(), rnd(), rnd()); });
    for (var k = 0; k < n; k++) {
      var decay = Math.pow(0.62, k);
      var coords = eq.map(function (p, i) { return P(p.x + pert[i].x * decay * 1.4, p.y + pert[i].y * decay * 1.4, p.z + pert[i].z * decay * 1.4); });
      var energy = Emin + 0.085 * decay * decay + 0.0006 * rnd() * decay;
      frames.push({ coords: coords, energy: energy, label: 'step ' + (k + 1) });
    }
    R.recenterFrames(frames);
    return {
      key: 'opt-ethanol', name: 'Ethanol optimization', formula: 'C₂H₆O', cat: 'Sample results', source: 'Geometry opt · ' + n + ' steps',
      elements: els, frames: frames, frameKind: 'opt', baseXYZ: R.xyzText(els, frames[0].coords, 'step 1'),
      scalars: { 'Steps': String(n), 'ΔE converged': ((frames[0].energy - Emin) * HA2EV * 23.06).toFixed(1) + ' kcal/mol', 'Final E': Emin.toFixed(5) + ' Ha' }
    };
  }

  // ---------------- 4. vibrational modes + IR (water, exact mode shapes) ----------------
  function vibDemo() {
    var els = WATER.els, xyz = WATER.xyz;
    // exact textbook normal-mode directions for C2v water (O heavier → small O motion)
    var modes = [
      { freq: 1595, ir: 67, raman: 5, name: 'bend (ν₂)', disp: [P(0, 0, 0.07), P(0, 0.43, -0.56), P(0, -0.43, -0.56)] },
      { freq: 3657, ir: 5, raman: 80, name: 'symm. stretch (ν₁)', disp: [P(0, 0, -0.07), P(0, 0.58, 0.40), P(0, -0.58, 0.40)] },
      { freq: 3756, ir: 45, raman: 12, name: 'asymm. stretch (ν₃)', disp: [P(0, 0.07, 0), P(0, 0.55, -0.43), P(0, 0.55, 0.43)] }
    ];
    return {
      key: 'vib-water', name: 'Water vibrations', formula: 'H₂O', cat: 'Sample results', source: '3 normal modes + IR',
      elements: els, frames: [{ coords: xyz, energy: -76.4089, label: 'eq' }], baseXYZ: R.xyzText(els, xyz, 'water'),
      vib: { modes: modes }, scalars: { 'Modes': '3', 'Imaginary': '0', 'Point group': 'C₂ᵥ' }
    };
  }

  // ---------------- 5. MD trajectory (butane torsion + thermal) ----------------
  function mdDemo() {
    var els = ['C', 'C', 'C', 'C', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H'];
    // vector helpers
    function vsub(a, b) { return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }; }
    function vadd(a, b) { return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }; }
    function vsc(a, s) { return { x: a.x * s, y: a.y * s, z: a.z * s }; }
    function vdot(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
    function vcross(a, b) { return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x }; }
    function vlen(a) { return Math.hypot(a.x, a.y, a.z); }
    function vnorm(a) { var l = vlen(a) || 1; return vsc(a, 1 / l); }
    function rodrigues(p, o, k, ang) { var v = vsub(p, o), c = Math.cos(ang), s = Math.sin(ang); return vadd(o, vadd(vadd(vsc(v, c), vsc(vcross(k, v), s)), vsc(k, vdot(k, v) * (1 - c)))); }
    var DEG = Math.PI / 180, CC = 1.54, CH = 1.09, TET = 109.47 * DEG;
    // build a proper anti (all-staggered) butane skeleton in the xy-plane
    var C2 = P(0, 0, 0), C3 = P(CC, 0, 0);
    var C1 = vadd(C2, vsc(P(Math.cos(111.5 * DEG), Math.sin(111.5 * DEG), 0), CC));
    var C4 = vadd(C3, vsc(P(Math.cos(68.5 * DEG), Math.sin(68.5 * DEG), 0), CC));
    function methylH(c, nb) {                       // 3 tetrahedral H around terminal carbon c (heavy neighbour nb)
      var b = vnorm(vsub(nb, c));
      var ref = Math.abs(b.x) < 0.9 ? P(1, 0, 0) : P(0, 1, 0);
      var u = vnorm(vcross(b, ref)), v = vnorm(vcross(b, u)), out = [];
      for (var i = 0; i < 3; i++) {
        var ph = (i * 120 + 60) * DEG;
        var perp = vadd(vsc(u, Math.cos(ph)), vsc(v, Math.sin(ph)));
        var dir = vadd(vsc(b, Math.cos(TET)), vsc(perp, Math.sin(TET)));
        out.push(vadd(c, vsc(vnorm(dir), CH)));
      }
      return out;
    }
    function ch2H(c, n1, n2) {                       // 2 tetrahedral H on a CH2 carbon
      var a = vnorm(vsub(n1, c)), b = vnorm(vsub(n2, c));
      var bis = vnorm(vadd(a, b)), perp = vnorm(vcross(a, b)), out = [];
      [1, -1].forEach(function (sgn) {
        var dir = vadd(vsc(bis, -Math.cos(54.75 * DEG)), vsc(perp, sgn * Math.sin(54.75 * DEG)));
        out.push(vadd(c, vsc(vnorm(dir), CH)));
      });
      return out;
    }
    var h1 = methylH(C1, C2), h2 = ch2H(C2, C1, C3), h3 = ch2H(C3, C2, C4), h4 = methylH(C4, C3);
    // atom order: C1 C2 C3 C4  H1a H1b H1c  H2a H2b  H3a H3b  H4a H4b H4c
    var ref = [C1, C2, C3, C4, h1[0], h1[1], h1[2], h2[0], h2[1], h3[0], h3[1], h4[0], h4[1], h4[2]];
    var rotIdx = [3, 11, 12, 13];                    // C4 methyl rotates about the C2–C3 bond → changes the C1–C2–C3–C4 dihedral
    var axisK = vnorm(vsub(C3, C2));
    var nF = 90, frames = [], seed = 17; function rnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280 - 0.5; }
    for (var k = 0; k < nF; k++) {
      var t = k / nF;
      var phi = 180 + 92 * Math.sin(t * Math.PI * 2.0) + 16 * Math.sin(t * Math.PI * 6.3);   // dihedral wanders around anti
      var dphi = (phi - 180) * DEG;
      var coords = ref.map(function (p, i) {
        var q = rotIdx.indexOf(i) >= 0 ? rodrigues(p, C3, axisK, -dphi) : { x: p.x, y: p.y, z: p.z };
        return P(q.x + rnd() * 0.05, q.y + rnd() * 0.05, q.z + rnd() * 0.05);                 // gentle thermal jiggle
      });
      var pr = phi * DEG;
      var V = 1.45 * (1 + Math.cos(3 * pr)) + 0.9 * (1 - Math.cos(pr)) + 0.4;                  // realistic butane torsion profile
      frames.push({ coords: coords, energy: V, label: 'frame ' + (k + 1), phi: ((phi % 360) + 360) % 360 });
    }
    R.recenterFrames(frames);
    return {
      key: 'md-butane', name: 'Butane dynamics', formula: 'C₄H₁₀', cat: 'Sample results', source: nF + '-frame MD (300 K)',
      elements: els, frames: frames, frameKind: 'md', energyUnit: 'kcal/mol', baseXYZ: R.xyzText(els, frames[0].coords, 'frame 1'),
      scalars: { 'Frames': String(nF), 'Ensemble': 'NVT 300 K', 'Coordinate': 'C–C–C–C dihedral' }
    };
  }

  // ---------------- 6. TD-DFT UV-Vis (hexatriene-like chromophore) ----------------
  function uvvisDemo() {
    var els = ['C', 'C', 'C', 'C', 'C', 'C', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H'];
    var c = [P(-3.05, 0.3, 0), P(-1.85, -0.3, 0), P(-0.62, 0.32, 0), P(0.62, -0.32, 0), P(1.85, 0.3, 0), P(3.05, -0.3, 0)];
    var h = [P(-3.05, 1.39, 0), P(-3.93, -0.29, 0), P(-1.85, -1.39, 0), P(-0.62, 1.41, 0), P(0.62, -1.41, 0), P(1.85, 1.39, 0), P(3.05, -1.39, 0), P(3.93, 0.29, 0)];
    var coords = c.concat(h);
    var exc = [
      { eV: 4.93, nm: 251, f: 1.02 }, { eV: 5.74, nm: 216, f: 0.08 },
      { eV: 6.10, nm: 203, f: 0.31 }, { eV: 6.52, nm: 190, f: 0.02 }, { eV: 7.01, nm: 177, f: 0.18 }
    ];
    return {
      key: 'uvvis-hexatriene', name: 'Hexatriene UV-Vis', formula: 'C₆H₈', cat: 'Sample results', source: 'TD-DFT · 5 states',
      elements: els, frames: [{ coords: coords, energy: -232.04, label: 'eq' }], baseXYZ: R.xyzText(els, coords, 'hexatriene'),
      excitations: exc, scalars: { 'States': '5', 'λmax': '251 nm', 'Strongest f': '1.02' }
    };
  }

  R.buildDemos = function (rawGlycerol) {
    return [glycerol(rawGlycerol), ethyleneOrbitals(), optDemo(), vibDemo(), mdDemo(), uvvisDemo(), geodiffDemo(rawGlycerol), rfdiffDemo()];
  };

  // ---------------- 7. generative: reverse-diffusion conformer (GeoDiff-style) ----------------
  function diffuseFrames(clean, nSteps, sigMax, seed) {
    var st = seed || 12345;
    function rnd() { st = (st * 1103515245 + 12345) & 0x7fffffff; return st / 0x7fffffff; }
    function randn() { return Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(2 * Math.PI * rnd()); }
    var eps = clean.map(function () { return P(randn(), randn(), randn()); });   // persistent noise direction
    var frames = [];
    for (var k = 0; k < nSteps; k++) {
      var u = k / (nSteps - 1);
      var sigma = sigMax * Math.pow(1 - u, 1.7);                                  // variance schedule → 0 at the clean sample
      var jit = sigma * 0.32;
      var coords = clean.map(function (c, i) {
        return P(c.x + eps[i].x * sigma + randn() * jit, c.y + eps[i].y * sigma + randn() * jit, c.z + eps[i].z * sigma + randn() * jit);
      });
      frames.push({ coords: coords, sigma: +sigma.toFixed(3), step: nSteps - 1 - k, label: 't=' + (nSteps - 1 - k) });
    }
    return frames;   // frame 0 = pure noise, last = clean sample
  }

  function geodiffDemo(raw) {
    var els = raw.atoms.map(function (a) { return a[0]; });
    var clean = raw.atoms.map(function (a) { return P(a[1], a[2], a[3]); });
    var nSteps = 60;
    var frames = diffuseFrames(clean, nSteps, 1.9, 271);
    R.recenterFrames(frames);
    return {
      key: 'geodiff-glycerol', name: 'GeoDiff conformer', formula: 'C₃H₈O₃', cat: 'Generative models', source: 'Reverse diffusion · ' + nSteps + ' steps',
      elements: els, frames: frames, frameKind: 'diffusion', genKind: 'diffusion',
      baseXYZ: R.xyzText(els, clean, 'denoised sample'),    // bonds perceived from the CLEAN structure, then carried through the noise
      scalars: { 'Sampler': 'DDPM (illustrative)', 'Steps T': String(nSteps), 'Atoms': String(els.length), 'Connectivity': 'fixed graph' }
    };
  }

  // ---------------- 8. generative: RFdiffusion-style backbone generation ----------------
  function rfdiffDemo() {
    var DEG = Math.PI / 180, ca = [];
    // helix 1 (rise ~1.5 Å/res, ~100°/turn, radius 2.3 → Cα–Cα ≈ 3.8 Å)
    for (var i = 0; i < 13; i++) { var th = i * 100 * DEG; ca.push(P(2.3 * Math.cos(th) - 5, 1.5 * i - 9, 2.3 * Math.sin(th))); }
    // turn (4 residues bending across)
    var last = ca[ca.length - 1];
    for (var j = 1; j <= 4; j++) ca.push(P(last.x + j * 1.4, last.y + j * 0.4, last.z + j * 0.9));
    // helix 2 antiparallel, offset in x, descending in y
    var s = ca[ca.length - 1];
    for (var m = 0; m < 13; m++) { var th2 = m * 100 * DEG; ca.push(P(2.3 * Math.cos(th2) + 5, s.y - 1.5 * m, 2.3 * Math.sin(th2))); }
    // center
    var cx = 0, cy = 0, cz = 0; ca.forEach(function (p) { cx += p.x; cy += p.y; cz += p.z; }); cx /= ca.length; cy /= ca.length; cz /= ca.length;
    ca = ca.map(function (p) { return P(p.x - cx, p.y - cy, p.z - cz); });
    var n = ca.length, els = ca.map(function () { return 'C'; });
    var fixedBonds = []; for (var b = 0; b < n - 1; b++) fixedBonds.push([b, b + 1]);
    var nSteps = 72;
    var frames = diffuseFrames(ca, nSteps, 5.0, 99);
    R.recenterFrames(frames);
    return {
      key: 'rfdiff-backbone', name: 'RFdiffusion backbone', formula: n + ' residues', cat: 'Generative models', source: 'Backbone diffusion · ' + nSteps + ' steps',
      elements: els, frames: frames, frameKind: 'diffusion', genKind: 'diffusion',
      baseXYZ: R.xyzText(els, ca, 'designed backbone'), fixedBonds: fixedBonds, traceStyle: true,
      scalars: { 'Method': 'SE(3) diffusion (illustrative)', 'Steps T': String(nSteps), 'Length': n + ' residues', 'Representation': 'Cα trace' }
    };
  }
})();
