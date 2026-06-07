/* results.js — computational-chemistry result model + file parsers.
   A "result" extends a molecule with optional rich payloads:
     frames      : [{ coords:[{x,y,z}], energy, label }]  (opt / scan / md)
     frameKind   : 'opt' | 'scan' | 'md'
     elements    : ['C','H',...]  (atom order, shared by all frames)
     baseXYZ     : XYZ text of frame 0 (what the viewer loads)
     vib         : { modes:[{ freq, ir, raman, disp:[{x,y,z}] }] }
     orbitals    : { energies:[Ha], nOcc, homo }
     cubes       : [{ name, kind:'mo'|'density'|'esp', text, isoDefault }]
     charges     : { kind, values:[..] }
     dipole      : { x,y,z, debye }
     excitations : [{ eV, nm, f }]
     scalars     : { Energy, Method, Basis, ... }   (key/value readout)
   All coordinates are Angstrom. */
(function () {
  var B2A = 0.529177210903, HA2EV = 27.211386, AU2DEBYE = 2.541746;
  var SYM = ['n','H','He','Li','Be','B','C','N','O','F','Ne','Na','Mg','Al','Si','P','S','Cl','Ar','K','Ca',
    'Sc','Ti','V','Cr','Mn','Fe','Co','Ni','Cu','Zn','Ga','Ge','As','Se','Br','Kr','Rb','Sr','Y','Zr'];
  var ZOF = {}; SYM.forEach(function (s, i) { if (i) ZOF[s] = i; });

  function elemFromZ(z) { return SYM[z] || 'X'; }

  function xyzText(elements, coords, comment) {
    var lines = [String(elements.length), comment || ''];
    for (var i = 0; i < elements.length; i++) {
      var c = coords[i];
      lines.push(elements[i] + ' ' + c.x.toFixed(5) + ' ' + c.y.toFixed(5) + ' ' + c.z.toFixed(5));
    }
    return lines.join('\n') + '\n';
  }
  function centroid(coords) {
    var c = { x: 0, y: 0, z: 0 };
    coords.forEach(function (p) { c.x += p.x; c.y += p.y; c.z += p.z; });
    var n = coords.length || 1; c.x /= n; c.y /= n; c.z /= n; return c;
  }
  function recenterFrames(frames) {
    if (!frames.length) return;
    var c = centroid(frames[0].coords);
    frames.forEach(function (f) {
      f.coords = f.coords.map(function (p) { return { x: p.x - c.x, y: p.y - c.y, z: p.z - c.z }; });
    });
  }

  // ---------- Gaussian formatted checkpoint (.fchk / .fck) ----------
  function parseFchk(text) {
    var lines = text.split('\n');
    function vec(label, count) {
      for (var i = 0; i < lines.length; i++) {
        if (lines[i].indexOf(label) === 0) {
          var out = [], j = i + 1;
          while (out.length < count && j < lines.length) {
            var nums = lines[j].trim().split(/\s+/).filter(function (s) { return s.length; });
            for (var k = 0; k < nums.length && out.length < count; k++) out.push(parseFloat(nums[k]));
            j++;
          }
          return out;
        }
      }
      return null;
    }
    function scal(label) {
      for (var i = 0; i < lines.length; i++) {
        if (lines[i].indexOf(label) === 0) { var m = lines[i].trim().split(/\s+/); return parseFloat(m[m.length - 1]); }
      }
      return null;
    }
    function ival(label) {
      for (var i = 0; i < lines.length; i++) { if (lines[i].indexOf(label) === 0) { var m = lines[i].trim().split(/\s+/); return parseInt(m[m.length - 1], 10); } }
      return null;
    }
    var nAtoms = ival('Number of atoms');
    if (!nAtoms) return null;
    var Z = vec('Atomic numbers', nAtoms);
    var coordsB = vec('Current cartesian coordinates', nAtoms * 3);
    if (!Z || !coordsB) return null;
    var elements = Z.map(elemFromZ);
    var coords = [];
    for (var i = 0; i < nAtoms; i++) coords.push({ x: coordsB[3 * i] * B2A, y: coordsB[3 * i + 1] * B2A, z: coordsB[3 * i + 2] * B2A });
    var frames = [{ coords: coords, energy: scal('Total Energy'), label: 'structure' }];
    recenterFrames(frames);

    var nElec = ival('Number of electrons') || 0;
    var nA = ival('Number of alpha electrons') || Math.round(nElec / 2);
    var orbE = vec('Alpha Orbital Energies', ival('Number of basis functions') || 0);
    var orbitals = (orbE && orbE.length) ? { energies: orbE, nOcc: nA, homo: nA - 1 } : null;
    var mull = vec('Mulliken Charges', nAtoms);
    var charges = mull ? { kind: 'Mulliken', values: mull } : null;
    var dip = vec('Dipole Moment', 3);
    var dipole = dip ? { x: dip[0], y: dip[1], z: dip[2], debye: Math.hypot(dip[0], dip[1], dip[2]) * AU2DEBYE } : null;
    var scf = scal('SCF Energy');

    // route/method line
    var method = null, basis = null;
    for (var r = 0; r < lines.length; r++) {
      if (lines[r].indexOf('Route') === 0) { method = (lines[r + 1] || '').trim(); break; }
    }
    var scalars = {};
    if (scf != null) scalars['SCF energy'] = scf.toFixed(6) + ' Ha';
    if (orbitals) scalars['HOMO–LUMO gap'] = ((orbE[nA] - orbE[nA - 1]) * HA2EV).toFixed(3) + ' eV';
    if (dipole) scalars['Dipole'] = dipole.debye.toFixed(3) + ' D';
    scalars['Atoms'] = String(nAtoms);
    if (method) scalars['Route'] = method;

    return {
      name: 'FCHK structure', formula: formulaOf(elements), cat: 'Loaded results', source: 'Gaussian .fchk',
      elements: elements, frames: frames, baseXYZ: xyzText(elements, frames[0].coords, 'fchk'),
      orbitals: orbitals, charges: charges, dipole: dipole, scalars: scalars
    };
  }

  // ---------- multi-frame XYZ (trajectories / scans / opt) ----------
  function parseMultiXYZ(text) {
    var lines = text.split(/\r?\n/);
    var frames = [], elements = null, i = 0;
    while (i < lines.length) {
      var n = parseInt((lines[i] || '').trim(), 10);
      if (!(n > 0)) { i++; continue; }
      var comment = (lines[i + 1] || '');
      var coords = [], els = [];
      for (var a = 0; a < n; a++) {
        var parts = (lines[i + 2 + a] || '').trim().split(/\s+/);
        if (parts.length < 4) break;
        var el = parts[0]; if (/^\d+$/.test(el)) el = elemFromZ(parseInt(el, 10));
        els.push(el.charAt(0).toUpperCase() + el.slice(1).toLowerCase());
        coords.push({ x: parseFloat(parts[1]), y: parseFloat(parts[2]), z: parseFloat(parts[3]) });
      }
      if (coords.length !== n) break;
      if (!elements) elements = els;
      var energy = parseEnergyFromComment(comment);
      frames.push({ coords: coords, energy: energy, label: comment.trim() });
      i += n + 2;
    }
    if (!frames.length) return null;
    recenterFrames(frames);
    var kind = frames.length > 1 ? (frames.every(function (f) { return f.energy != null; }) ? 'opt' : 'md') : 'opt';
    return {
      name: 'XYZ ' + (frames.length > 1 ? 'trajectory' : 'structure'), formula: formulaOf(elements),
      cat: 'Loaded results', source: frames.length + '-frame XYZ',
      elements: elements, frames: frames, frameKind: kind,
      baseXYZ: xyzText(elements, frames[0].coords, 'frame 0'),
      scalars: { Frames: String(frames.length), Atoms: String(elements.length) }
    };
  }
  function parseEnergyFromComment(c) {
    if (!c) return null;
    var m = c.match(/(?:energy|E|scf done|=)\s*[:=]?\s*(-?\d+\.\d+)/i) || c.match(/(-?\d+\.\d{4,})/);
    return m ? parseFloat(m[1]) : null;
  }

  // ---------- Gaussian / ORCA output log (.log / .out) ----------
  function parseGaussianLog(text) {
    var lines = text.split(/\r?\n/);
    var isOrca = /\* O   R   C   A \*/.test(text) || /Program Version .* ORCA/i.test(text);
    var elements = null, frames = [], energies = [];
    // SCF energies
    for (var i = 0; i < lines.length; i++) {
      var m = lines[i].match(/SCF Done:\s+E\([^)]+\)\s*=\s*(-?\d+\.\d+)/);
      if (m) energies.push(parseFloat(m[1]));
      var mo = lines[i].match(/FINAL SINGLE POINT ENERGY\s+(-?\d+\.\d+)/);
      if (mo) energies.push(parseFloat(mo[1]));
    }
    // standard-orientation geometries (Gaussian)
    for (var i = 0; i < lines.length; i++) {
      if (/(Standard|Input) orientation:/.test(lines[i]) || /CARTESIAN COORDINATES \(ANGSTROEM\)/.test(lines[i])) {
        var gauss = /orientation:/.test(lines[i]);
        var start = i + (gauss ? 5 : 2), coords = [], els = [], j = start;
        while (j < lines.length) {
          var ln = lines[j].trim();
          if (gauss) {
            if (/^-+$/.test(ln)) break;
            var p = ln.split(/\s+/); if (p.length < 6) break;
            els.push(elemFromZ(parseInt(p[1], 10)));
            coords.push({ x: parseFloat(p[3]), y: parseFloat(p[4]), z: parseFloat(p[5]) });
          } else {
            var p2 = ln.split(/\s+/); if (p2.length < 4 || /^-+$/.test(ln) || ln === '') break;
            els.push(p2[0]); coords.push({ x: parseFloat(p2[1]), y: parseFloat(p2[2]), z: parseFloat(p2[3]) });
          }
          j++;
        }
        if (coords.length) { if (!elements) elements = els; frames.push({ coords: coords, energy: null, label: 'step ' + (frames.length + 1) }); }
        i = j;
      }
    }
    if (!frames.length) return null;
    // attach energies to frames (best effort, align tail)
    var off = Math.max(0, energies.length - frames.length);
    frames.forEach(function (f, k) { f.energy = energies[off + k] != null ? energies[off + k] : energies[k]; });
    recenterFrames(frames);

    // vibrational frequencies + normal modes (Gaussian "Frequencies --")
    var vib = parseGaussianFreq(lines, elements.length);
    // TD excitations
    var exc = parseExcitations(lines);

    var kind = frames.length > 1 ? 'opt' : 'opt';
    var scalars = { Frames: String(frames.length), Atoms: String(elements.length), Program: isOrca ? 'ORCA' : 'Gaussian' };
    if (energies.length) scalars['Final energy'] = energies[energies.length - 1].toFixed(6) + ' Ha';
    return {
      name: (isOrca ? 'ORCA' : 'Gaussian') + ' job', formula: formulaOf(elements),
      cat: 'Loaded results', source: (isOrca ? 'ORCA' : 'Gaussian') + ' .out',
      elements: elements, frames: frames, frameKind: frames.length > 1 ? 'opt' : 'opt',
      baseXYZ: xyzText(elements, frames[frames.length - 1].coords, 'final'),
      vib: vib, excitations: exc.length ? exc : null, scalars: scalars
    };
  }
  function parseGaussianFreq(lines, nAtoms) {
    var modes = [];
    for (var i = 0; i < lines.length; i++) {
      if (/^\s*Frequencies --/.test(lines[i])) {
        var freqs = lines[i].replace(/.*Frequencies --/, '').trim().split(/\s+/).map(parseFloat);
        var irLine = null;
        for (var k = i; k < i + 8 && k < lines.length; k++) if (/IR Inten/.test(lines[k])) irLine = lines[k];
        var irs = irLine ? irLine.replace(/.*IR Inten\s+--/, '').trim().split(/\s+/).map(parseFloat) : freqs.map(function () { return 0; });
        // find the "Atom AN X Y Z" displacement block
        var ds = i;
        while (ds < lines.length && !/Atom\s+AN\s+X\s+Y\s+Z/.test(lines[ds])) ds++;
        var disp = freqs.map(function () { return []; });
        for (var a = 0; a < nAtoms; a++) {
          var row = (lines[ds + 1 + a] || '').trim().split(/\s+/).map(parseFloat);
          for (var c = 0; c < freqs.length; c++) {
            disp[c].push({ x: row[2 + 3 * c] || 0, y: row[3 + 3 * c] || 0, z: row[4 + 3 * c] || 0 });
          }
        }
        for (var c2 = 0; c2 < freqs.length; c2++) modes.push({ freq: freqs[c2], ir: irs[c2] || 0, raman: 0, disp: disp[c2] });
        i = ds + nAtoms;
      }
    }
    return modes.length ? { modes: modes } : null;
  }
  function parseExcitations(lines) {
    var exc = [];
    for (var i = 0; i < lines.length; i++) {
      var m = lines[i].match(/Excited State\s+\d+:\s+\S+\s+(-?\d+\.\d+)\s*eV\s+(-?\d+\.\d+)\s*nm\s+f=\s*(-?\d+\.\d+)/);
      if (m) exc.push({ eV: parseFloat(m[1]), nm: parseFloat(m[2]), f: parseFloat(m[3]) });
    }
    return exc;
  }

  // ---------- VASP ----------
  function parseXdatcar(text) {
    var lines = text.split(/\r?\n/);
    var scale = parseFloat(lines[1]);
    var lat = [1, 2, 3].map(function (k) { return lines[k + 1].trim().split(/\s+/).map(Number).map(function (v) { return v * scale; }); });
    var elNames = lines[5].trim().split(/\s+/);
    var elCounts = lines[6].trim().split(/\s+/).map(Number);
    var elements = []; elNames.forEach(function (e, k) { for (var c = 0; c < elCounts[k]; c++) elements.push(e); });
    var nAt = elements.length, frames = [], i = 7;
    while (i < lines.length) {
      if (/configuration/i.test(lines[i] || '') || /Direct/i.test(lines[i] || '')) {
        var coords = [];
        for (var a = 0; a < nAt; a++) {
          var f = (lines[i + 1 + a] || '').trim().split(/\s+/).map(Number);
          coords.push({
            x: f[0] * lat[0][0] + f[1] * lat[1][0] + f[2] * lat[2][0],
            y: f[0] * lat[0][1] + f[1] * lat[1][1] + f[2] * lat[2][1],
            z: f[0] * lat[0][2] + f[1] * lat[1][2] + f[2] * lat[2][2]
          });
        }
        if (coords.length === nAt) frames.push({ coords: coords, energy: null, label: 'config ' + (frames.length + 1) });
        i += nAt + 1;
      } else i++;
    }
    if (!frames.length) return null;
    recenterFrames(frames);
    return { name: 'VASP XDATCAR', formula: formulaOf(elements), cat: 'Loaded results', source: frames.length + '-step MD',
      elements: elements, frames: frames, frameKind: 'md', baseXYZ: xyzText(elements, frames[0].coords, 'config 1'),
      scalars: { Frames: String(frames.length), Atoms: String(nAt) } };
  }
  function parseOutcar(text) {
    var lines = text.split(/\r?\n/);
    var elements = [], energies = [], frames = [];
    for (var i = 0; i < lines.length; i++) {
      var pm = lines[i].match(/VRHFIN\s*=\s*([A-Za-z]+)/); if (pm) elements.__pot = (elements.__pot || []).concat([pm[1]]);
      var im = lines[i].match(/ions per type\s*=\s*(.+)/); if (im) elements.__counts = im[1].trim().split(/\s+/).map(Number);
      var em = lines[i].match(/free  energy   TOTEN\s*=\s*(-?\d+\.\d+)/); if (em) energies.push(parseFloat(em[1]));
      if (/POSITION\s+TOTAL-FORCE/.test(lines[i])) {
        var coords = [], j = i + 2;
        while (j < lines.length && !/^\s*-+\s*$/.test(lines[j])) {
          var p = lines[j].trim().split(/\s+/).map(Number);
          if (p.length >= 3) coords.push({ x: p[0], y: p[1], z: p[2] });
          j++;
        }
        if (coords.length) frames.push({ coords: coords, energy: null });
        i = j;
      }
    }
    if (!frames.length) return null;
    if (elements.__pot && elements.__counts) { var els = []; elements.__pot.forEach(function (e, k) { for (var c = 0; c < elements.__counts[k]; c++) els.push(e); }); elements = els; }
    else elements = frames[0].coords.map(function () { return 'C'; });
    frames.forEach(function (f, k) { f.energy = energies[k]; f.label = 'ionic step ' + (k + 1); });
    recenterFrames(frames);
    return { name: 'VASP OUTCAR', formula: formulaOf(elements), cat: 'Loaded results', source: frames.length + '-step relax',
      elements: elements, frames: frames, frameKind: 'opt', baseXYZ: xyzText(elements, frames[frames.length - 1].coords, 'final'),
      scalars: { Frames: String(frames.length), Atoms: String(elements.length) } };
  }

  // element guess for atoms with no element column (CA→C not Ca, NA→Na, etc.)
  var ORGANIC = { H: 1, C: 1, N: 1, O: 1, P: 1, S: 1, F: 1, B: 1 };
  var TWO_EL = { Na: 1, Cl: 1, Mg: 1, Zn: 1, Fe: 1, Ca: 1, Br: 1, Mn: 1, Cu: 1, Ni: 1, Co: 1, Se: 1, Li: 1, Al: 1, Si: 1, Ar: 1, Ne: 1, He: 1, Be: 1, Kr: 1, Hg: 1, Cd: 1, Pt: 1, Au: 1, Ag: 1, Cr: 1, Mo: 1 };
  function guessElem(name) {
    var s = (name || '').replace(/[^A-Za-z]/g, '');
    if (!s) return 'C';
    var one = s.charAt(0).toUpperCase();
    var two = one + (s.charAt(1) ? s.charAt(1).toLowerCase() : '');
    if (ORGANIC[one]) return one;        // protein/lipid/water heavy atoms use the leading element
    if (TWO_EL[two]) return two;          // genuine ions / metals
    return ZOF[two] ? two : one;
  }

  // ---------- multi-MODEL PDB trajectory (e.g. GROMACS `gmx trjconv ... -o traj.pdb`) ----------
  function parsePDB(text) {
    var lines = text.split(/\r?\n/);
    var frames = [], elements = null, cur = null, curEls = [], tmpl = [];
    var n0 = 0;
    function flush() {
      if (cur && cur.length) {
        if (!elements) { elements = curEls; n0 = cur.length; }
        // only keep frames whose atom count matches the reference model (RFdiffusion etc. can be inconsistent)
        if (cur.length === n0) frames.push({ coords: cur, energy: null, label: 'model ' + (frames.length + 1) });
      }
      cur = null; curEls = [];
    }
    for (var i = 0; i < lines.length; i++) {
      var ln = lines[i];
      if (/^MODEL(\s|$)/.test(ln)) { flush(); cur = []; curEls = []; }
      else if (/^ENDMDL/.test(ln)) { flush(); }
      else if (/^(ATOM|HETATM)/.test(ln)) {
        if (cur == null) cur = [];
        var px = parseFloat(ln.substring(30, 38)), py = parseFloat(ln.substring(38, 46)), pz = parseFloat(ln.substring(46, 54));
        cur.push({ x: isFinite(px) ? px : 0, y: isFinite(py) ? py : 0, z: isFinite(pz) ? pz : 0 });
        if (!elements) {
          tmpl.push(ln);                 // remember the first model's atom records (names/residues) for a clean base structure
          var elc = ln.substring(76, 78).trim();
          curEls.push(elc ? (elc.charAt(0).toUpperCase() + (elc.charAt(1) ? elc.charAt(1).toLowerCase() : '')) : guessElem(ln.substring(12, 16).trim()));
        }
      }
    }
    flush();
    if (!frames.length || !elements || !elements.length) return null;
    if (frames.length > 600) { var st = Math.ceil(frames.length / 600); frames = frames.filter(function (_, i) { return i % st === 0; }); }
    recenterFrames(frames);
    var multi = frames.length > 1;
    // detect a denoising trajectory (one end is far more spread out than the other) and orient it noise → clean
    var sFirst = spreadOf(frames[0].coords), sLast = spreadOf(frames[frames.length - 1].coords);
    var isDiffusion = multi && Math.max(sFirst, sLast) > 1.5 * Math.min(sFirst, sLast);
    if (isDiffusion && sFirst < sLast) frames.reverse();   // RFdiffusion etc. store clean→noise; play noise→clean
    // pick the most COMPACT frame for the base structure / initial zoom
    var refIdx = 0, best = Infinity;
    frames.forEach(function (f, i) { var s = spreadOf(f.coords); if (s < best) { best = s; refIdx = i; } });
    var rc = frames[refIdx].coords;
    // protein/residue connectivity from atom names + solvent classification (avoids dense-box over-bonding)
    var fixedBonds = null, solventMask = null, hasSolvent = false;
    if (tmpl.length === elements.length) {
      var meta = tmpl.map(pdbMeta);
      var cb = classifyAndBond(meta, elements, rc);
      fixedBonds = cb.fixedBonds; solventMask = cb.solventMask; hasSolvent = cb.hasSolvent;
    }
    var basePDB;
    if (tmpl.length === elements.length) {
      basePDB = 'MODEL        1\n' + tmpl.map(function (line, i) { return setPDBxyz(line, rc[i] || { x: 0, y: 0, z: 0 }); }).join('\n') + '\nENDMDL\nEND\n';
    } else {
      basePDB = xyzText(elements, rc, 'frame');   // fallback
    }
    return {
      name: multi ? (isDiffusion ? 'Generated trajectory' : 'PDB trajectory') : 'PDB structure', formula: formulaOf(elements), cat: 'Loaded results',
      source: multi ? frames.length + (isDiffusion ? '-step generation (PDB)' : '-frame PDB trajectory') : 'PDB structure',
      elements: elements, frames: frames, frameKind: isDiffusion ? 'diffusion' : 'md', genKind: isDiffusion ? 'diffusion' : undefined,
      format: tmpl.length === elements.length ? 'pdb' : 'xyz', baseXYZ: basePDB, fixedBonds: fixedBonds, solventMask: solventMask, hasSolvent: hasSolvent,
      scalars: { Frames: String(frames.length), Atoms: String(elements.length) }
    };
  }
  // backbone bonds from {name,res,chain} records: N–CA–C–O, CA–CB, and peptide C(i)–N(i+1)
  function backboneBonds(meta) {
    var idx = {}; meta.forEach(function (m, i) { idx[m.chain + '|' + m.res + '|' + m.name] = i; });
    var bonds = [], resByChain = {};
    function add(a, b) { if (a != null && b != null) bonds.push([a, b]); }
    meta.forEach(function (m) { var c = resByChain[m.chain] = resByChain[m.chain] || []; if (c.indexOf(m.res) < 0) c.push(m.res); });
    Object.keys(resByChain).forEach(function (ch) {
      var rs = resByChain[ch].sort(function (a, b) { return a - b; });
      rs.forEach(function (r, ri) {
        var N = idx[ch + '|' + r + '|N'], CA = idx[ch + '|' + r + '|CA'], C = idx[ch + '|' + r + '|C'], O = idx[ch + '|' + r + '|O'], CB = idx[ch + '|' + r + '|CB'];
        add(N, CA); add(CA, C); add(C, O); add(CA, CB);
        if (ri > 0) add(idx[ch + '|' + rs[ri - 1] + '|C'], N);
      });
    });
    return bonds.length ? bonds : null;
  }
  function spreadOf(coords) {
    var cx = 0, cy = 0, cz = 0, n = coords.length || 1;
    coords.forEach(function (c) { cx += c.x; cy += c.y; cz += c.z; }); cx /= n; cy /= n; cz /= n;
    var s = 0; coords.forEach(function (c) { var dx = c.x - cx, dy = c.y - cy, dz = c.z - cz; s += dx * dx + dy * dy + dz * dz; }); return s / n;
  }
  function setPDBxyz(line, c) {
    function f(v) { var s = (isFinite(v) ? v : 0).toFixed(3); while (s.length < 8) s = ' ' + s; return s.slice(-8); }
    var L = line.length < 54 ? line + '                                                      ' : line;
    return L.slice(0, 30) + f(c.x) + f(c.y) + f(c.z) + L.slice(54);
  }

  // ---------- residue-aware connectivity + solvent classification (fixes dense-box over-bonding) ----------
  var COV = { H: 0.31, C: 0.76, N: 0.71, O: 0.66, F: 0.57, P: 1.07, S: 1.05, Cl: 1.02, Br: 1.20, I: 1.39, Na: 1.66, Mg: 1.41, K: 2.03, Ca: 1.76, Fe: 1.32, Zn: 1.22, Li: 1.28, Mn: 1.39, Cu: 1.32 };
  function covr(e) { return COV[e] || COV[(e || '').charAt(0).toUpperCase() + ((e || '')[1] ? e[1].toLowerCase() : '')] || 0.77; }
  var SOLV_RES = { SOL: 1, WAT: 1, HOH: 1, TIP: 1, TIP3: 1, TIP4: 1, TIP5: 1, SPC: 1, SPCE: 1, T3P: 1, T4P: 1, T5P: 1, H2O: 1, OPC: 1, OW: 1 };
  var ION_RES = { NA: 1, 'NA+': 1, CL: 1, 'CL-': 1, K: 1, 'K+': 1, MG: 1, CA: 1, ZN: 1, SOD: 1, CLA: 1, POT: 1, CAL: 1, MG2: 1, FE: 1, MN: 1, CU: 1, LI: 1, CS: 1, BR: 1, IB: 1, NA1: 1, CL1: 1, ION: 1 };
  function classifyAndBond(meta, elements, coords) {
    var groups = {}, order = [];
    meta.forEach(function (m, i) { var k = (m.chain || ' ') + '|' + m.res + '|' + (m.resn || ''); if (!groups[k]) { groups[k] = []; order.push({ key: k, resn: (m.resn || '').toUpperCase(), chain: m.chain || ' ', res: m.res }); } groups[k].push(i); });
    var bonds = [], solventMask = [], hasSolvent = false, nsolv = 0;
    for (var z = 0; z < meta.length; z++) solventMask[z] = false;
    function within(i, j) { var a = coords[i], b = coords[j]; if (!a || !b) return false; var dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z, d2 = dx * dx + dy * dy + dz * dz, t = (covr(elements[i]) + covr(elements[j])) * 1.3; return d2 > 0.16 && d2 < t * t; }
    order.forEach(function (o) {
      var g = groups[o.key];
      var sol = SOLV_RES[o.resn] || (g.length <= 3 && !!ION_RES[o.resn]);
      if (sol) { g.forEach(function (i) { solventMask[i] = true; nsolv++; }); hasSolvent = true; }
      for (var a = 0; a < g.length; a++) for (var b = a + 1; b < g.length; b++) if (within(g[a], g[b])) bonds.push([g[a], g[b]]);   // intra-residue only
    });
    // inter-residue backbone links (peptide C–N, nucleic O3'–P) for consecutive residues
    var byname = {}; meta.forEach(function (m, i) { byname[(m.chain || ' ') + '|' + m.res + '|' + m.name] = i; });
    var chres = {}; order.forEach(function (o) { (chres[o.chain] = chres[o.chain] || []).push(o.res); });
    Object.keys(chres).forEach(function (ch) {
      var rs = chres[ch].slice().sort(function (a, b) { return a - b; });
      for (var r = 1; r < rs.length; r++) {
        if (rs[r] - rs[r - 1] > 2) continue;
        var Cp = byname[ch + '|' + rs[r - 1] + '|C'], Nn = byname[ch + '|' + rs[r] + '|N'];
        if (Cp != null && Nn != null && within(Cp, Nn)) bonds.push([Cp, Nn]);
        var O3 = byname[ch + '|' + rs[r - 1] + "|O3'"]; if (O3 == null) O3 = byname[ch + '|' + rs[r - 1] + '|O3*'];
        var Pn = byname[ch + '|' + rs[r] + '|P'];
        if (O3 != null && Pn != null && within(O3, Pn)) bonds.push([O3, Pn]);
      }
    });
    return { fixedBonds: bonds.length ? bonds : null, solventMask: hasSolvent ? solventMask : null, hasSolvent: hasSolvent, nSolvent: nsolv };
  }
  function groMeta(ln) { return { name: ln.substring(10, 15).trim(), resn: ln.substring(5, 10).trim(), res: parseInt(ln.substring(0, 5), 10) || 0, chain: ' ' }; }
  function pdbMeta(ln) { return { name: ln.substring(12, 16).trim(), resn: ln.substring(17, 20).trim(), res: parseInt(ln.substring(22, 26), 10) || 0, chain: ln.substring(21, 22) }; }

  // ---------- GROMACS .gro (single or multi-frame) ----------
  function parseGro(text) {
    var lines = text.split(/\r?\n/);
    var frames = [], elements = null, meta = null, i = 0;
    while (i < lines.length) {
      var n = parseInt((lines[i + 1] || '').trim(), 10);
      if (!(n > 0)) { i++; continue; }
      var coords = [], els = [], mt = [];
      for (var a = 0; a < n; a++) {
        var ln = lines[i + 2 + a]; if (ln == null) break;
        els.push(guessElem(ln.substring(10, 15).trim()));
        if (!elements) mt.push(groMeta(ln));
        coords.push({ x: parseFloat(ln.substring(20, 28)) * 10, y: parseFloat(ln.substring(28, 36)) * 10, z: parseFloat(ln.substring(36, 44)) * 10 });
      }
      if (coords.length !== n) break;
      if (!elements) { elements = els; meta = mt; }
      frames.push({ coords: coords, energy: null, label: 'frame ' + (frames.length + 1) });
      i += n + 3;                       // title + count + n atoms + box line
    }
    if (!frames.length) return null;
    if (frames.length > 600) { var stp = Math.ceil(frames.length / 600); frames = frames.filter(function (_, i) { return i % stp === 0; }); }
    recenterFrames(frames);
    var multi = frames.length > 1;
    var cb = classifyAndBond(meta, elements, frames[0].coords);
    return { name: multi ? 'GROMACS trajectory' : 'GROMACS frame', formula: formulaOf(elements), cat: 'Loaded results',
      source: multi ? frames.length + '-frame .gro trajectory' : '.gro snapshot',
      elements: elements, frames: frames, frameKind: 'md', baseXYZ: xyzText(elements, frames[0].coords, 'gro'),
      fixedBonds: cb.fixedBonds, solventMask: cb.solventMask, hasSolvent: cb.hasSolvent,
      scalars: multi ? { Frames: String(frames.length), Atoms: String(elements.length) }
        : { Atoms: String(elements.length), Note: '.xtc/.trr are binary — export to multi-frame .pdb or .gro to animate' } };
  }

  // ---------- combine a folder of per-frame files (conf0.gro, conf1.gro, … or *.pdb) into one trajectory ----------
  function rawSingle(name, text) {
    var ext = (name.split('.').pop() || '').toLowerCase();
    if (ext === 'gro') {
      var L = text.split(/\r?\n/), n = parseInt((L[1] || '').trim(), 10); if (!(n > 0)) return null;
      var els = [], co = [], mt = [];
      for (var a = 0; a < n; a++) { var ln = L[2 + a]; if (ln == null) break; els.push(guessElem(ln.substring(10, 15).trim())); mt.push(groMeta(ln)); co.push({ x: parseFloat(ln.substring(20, 28)) * 10, y: parseFloat(ln.substring(28, 36)) * 10, z: parseFloat(ln.substring(36, 44)) * 10 }); }
      return co.length === n ? { elements: els, coords: co, meta: mt } : null;
    }
    if (ext === 'pdb' || ext === 'ent' || ext === 'pdbqt' || /^(ATOM  |HETATM|MODEL)/m.test(text)) {
      var ls = text.split(/\r?\n/), e2 = [], c2 = [], m2 = [];
      for (var i = 0; i < ls.length; i++) {
        var l = ls[i]; if (/^ENDMDL/.test(l)) break;
        if (/^(ATOM|HETATM)/.test(l)) {
          var px = parseFloat(l.substring(30, 38)), py = parseFloat(l.substring(38, 46)), pz = parseFloat(l.substring(46, 54));
          c2.push({ x: isFinite(px) ? px : 0, y: isFinite(py) ? py : 0, z: isFinite(pz) ? pz : 0 });
          m2.push(pdbMeta(l));
          var ec = l.substring(76, 78).trim(); e2.push(ec ? (ec.charAt(0).toUpperCase() + (ec.charAt(1) ? ec.charAt(1).toLowerCase() : '')) : guessElem(l.substring(12, 16).trim()));
        }
      }
      return c2.length ? { elements: e2, coords: c2, meta: m2 } : null;
    }
    // xyz (first frame)
    var X = text.split(/\r?\n/), nn = parseInt((X[0] || '').trim(), 10); if (!(nn > 0)) return null;
    var e3 = [], c3 = [];
    for (var k = 0; k < nn; k++) { var p = (X[2 + k] || '').trim().split(/\s+/); if (p.length < 4) break; var el = p[0]; if (/^\d+$/.test(el)) el = elemFromZ(parseInt(el, 10)); e3.push(el.charAt(0).toUpperCase() + el.slice(1).toLowerCase()); c3.push({ x: parseFloat(p[1]), y: parseFloat(p[2]), z: parseFloat(p[3]) }); }
    return c3.length === nn ? { elements: e3, coords: c3, meta: null } : null;
  }
  function natCompare(a, b) { return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' }); }
  function combineFrames(files) {
    var fs = files.slice().sort(function (a, b) { return natCompare(a.name, b.name); });
    var frames = [], elements = null, meta = null;
    fs.forEach(function (f) {
      var s = rawSingle(f.name, f.text); if (!s) return;
      if (!elements) { elements = s.elements; meta = s.meta; }
      if (s.coords.length === elements.length) frames.push({ coords: s.coords, energy: null, label: f.name });
    });
    if (!frames.length || !elements) return null;
    if (frames.length > 600) { var st = Math.ceil(frames.length / 600); frames = frames.filter(function (_, i) { return i % st === 0; }); }
    recenterFrames(frames);
    var refIdx = 0, best = Infinity; frames.forEach(function (f, i) { var sp = spreadOf(f.coords); if (sp < best) { best = sp; refIdx = i; } });
    var baseXYZ = xyzText(elements, frames[refIdx].coords, 'frame');
    var cb = meta ? classifyAndBond(meta, elements, frames[refIdx].coords) : { fixedBonds: null, solventMask: null, hasSolvent: false };
    return {
      name: 'Trajectory (folder)', formula: formulaOf(elements), cat: 'Loaded results',
      source: frames.length + '-frame trajectory · ' + fs.length + ' files', elements: elements, frames: frames, frameKind: 'md',
      format: 'xyz', baseXYZ: baseXYZ, fixedBonds: cb.fixedBonds, solventMask: cb.solventMask, hasSolvent: cb.hasSolvent,
      scalars: { Frames: String(frames.length), Atoms: String(elements.length), Files: String(fs.length) }
    };
  }

  function formulaOf(elements) {
    var counts = {}; elements.forEach(function (e) { counts[e] = (counts[e] || 0) + 1; });
    var order = ['C', 'H', 'N', 'O'];
    var keys = Object.keys(counts).sort(function (a, b) {
      var ia = order.indexOf(a), ib = order.indexOf(b);
      if (ia < 0) ia = 99; if (ib < 0) ib = 99; return ia - ib || a.localeCompare(b);
    });
    var sub = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉' };
    return keys.map(function (k) { var c = counts[k]; return k + (c > 1 ? String(c).replace(/\d/g, function (d) { return sub[d]; }) : ''); }).join('');
  }

  // ---------- dispatcher ----------
  function parseFile(name, text) {
    var ext = (name.split('.').pop() || '').toLowerCase();
    try {
      if (ext === 'fchk' || ext === 'fck' || /Number of atoms\s+I/.test(text.slice(0, 400))) return tag(parseFchk(text), name);
      if (ext === 'xdatcar' || /XDATCAR/i.test(name)) return tag(parseXdatcar(text), name);
      if (/outcar/i.test(name)) return tag(parseOutcar(text), name);
      if (ext === 'gro') return tag(parseGro(text), name);
      if (ext === 'pdb' || ext === 'ent' || ext === 'pdbqt') return tag(parsePDB(text), name);
      if (ext === 'log' || ext === 'out') return tag(parseGaussianLog(text), name);
      if (ext === 'xyz' || ext === 'trj' || ext === 'xmol') return tag(parseMultiXYZ(text), name);
      // fallbacks by sniffing
      if (/SCF Done|FINAL SINGLE POINT ENERGY|Standard orientation/.test(text)) return tag(parseGaussianLog(text), name);
      if (/^MODEL\s|^ATOM  |^HETATM/m.test(text)) return tag(parsePDB(text), name);
      return tag(parseMultiXYZ(text), name);
    } catch (e) { return null; }
  }
  function tag(res, name) { if (res) { res.name = name.replace(/\.[^.]+$/, ''); res.key = 'res-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6); } return res; }

  window.RESULTS = {
    parseFile: parseFile, parseFchk: parseFchk, parseMultiXYZ: parseMultiXYZ, parseGaussianLog: parseGaussianLog,
    xyzText: xyzText, recenterFrames: recenterFrames, formulaOf: formulaOf, elemFromZ: elemFromZ, combineFrames: combineFrames,
    constants: { B2A: B2A, HA2EV: HA2EV, AU2DEBYE: AU2DEBYE }
  };
})();
