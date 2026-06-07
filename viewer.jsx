/* viewer.jsx — 3Dmol.js viewport with styling, atom-picking tools,
   measurement/stereo overlays, and manual bond rotation. */
const { useRef, useEffect, useImperativeHandle, forwardRef } = React;

const CHAIN_COLORS = [0x2563eb, 0xff6b6b, 0x15924d, 0xf59e0b, 0xa855f7, 0x14b8a6, 0xec4899, 0x84cc16];
const CARBON_SCHEME = { jmol: 'greenCarbon', neon: 'cyanCarbon', mono: 'blueCarbon', pastel: 'purpleCarbon', earth: 'orangeCarbon', grayscale: 'whiteCarbon' };
const MEASURE_COLOR = { distance: '#0f9d58', angle: '#f59e0b', dihedral: '#a855f7' };

// marker radius must exceed the atom's own visual radius so the halo is visible in every rep
function markerRadius(s) {
  if (s.rep === 'sphere') return Math.max(1.0, s.atomScale * 1.9) + 0.28;
  if (s.rep === 'ballstick') return s.atomScale * 0.32 * 1.8 + 0.32;
  if (s.rep === 'stick' || s.rep === 'surface') return 0.5;
  if (s.rep === 'line') return 0.42;
  return 0.62; // cartoon
}

function colorSpec(s) {
  if (s.colorMode === 'element') return { colorscheme: { prop: 'elem', map: PRESETS.PALETTES[s.palette].map } };
  if (s.colorMode === 'carbon') return { colorscheme: CARBON_SCHEME[s.palette] || 'greenCarbon' };
  if (s.colorMode === 'spectrum') return { colorscheme: 'spectrum' };
  if (s.colorMode === 'chain') return { colorfunc: function (atom) { var c = (atom.chain || 'A').charCodeAt(0); return CHAIN_COLORS[c % CHAIN_COLORS.length]; } };
  if (s.colorMode === 'single') return { color: s.single || '#7aa2e3' };
  return {};
}

function repStyle(s) {
  var c = colorSpec(s);
  var bond = s.bondRadius, scale = s.atomScale;
  switch (s.rep) {
    case 'stick':   return { stick: Object.assign({ radius: bond * 1.3 }, c) };
    case 'sphere':  return { sphere: Object.assign({ scale: scale }, c) };
    case 'line':    return { line: Object.assign({ linewidth: 2.0 }, c) };
    case 'cartoon': return { cartoon: Object.assign({ thickness: 0.5, arrows: true }, s.colorMode === 'spectrum' ? { color: 'spectrum' } : c) };
    case 'surface': return { stick: Object.assign({ radius: bond * 0.6 }, c) };
    case 'ballstick':
    default:        return { stick: Object.assign({ radius: bond }, c), sphere: Object.assign({ scale: scale * 0.32 }, c) };
  }
}

function chargeColorFunc(q, qmax) {
  return function (atom) {
    var c = q[atom.index] || 0, t = Math.max(-1, Math.min(1, c / (qmax || 1))), r, g, b;
    if (t < 0) { r = 255; g = Math.round(255 * (1 + t * 0.9)); b = Math.round(255 * (1 + t * 0.9)); }
    else { r = Math.round(255 * (1 - t * 0.9)); g = Math.round(255 * (1 - t * 0.9)); b = 255; }
    return (r << 16) | (g << 8) | b;
  };
}
function chargeStyle(s, q) {
  var qmax = Math.max.apply(null, q.map(Math.abs)) || 1;
  var cf = { colorfunc: chargeColorFunc(q, qmax) };
  switch (s.rep) {
    case 'stick': return { stick: Object.assign({ radius: s.bondRadius * 1.3 }, cf) };
    case 'sphere': return { sphere: Object.assign({ scale: s.atomScale }, cf) };
    case 'line': return { line: Object.assign({ linewidth: 2.0 }, cf) };
    case 'surface': return { stick: Object.assign({ radius: s.bondRadius * 0.6 }, cf) };
    default: return { stick: Object.assign({ radius: s.bondRadius }, cf), sphere: Object.assign({ scale: s.atomScale * 0.32 }, cf) };
  }
}

const Viewer = forwardRef(function Viewer(props, ref) {
  const hostRef = useRef(null);
  const viewerRef = useRef(null);
  const modelRef = useRef(null);
  const atomsRef = useRef([]);          // live atom references from the model
  const propsRef = useRef(props);
  const twistBaseRef = useRef(null);    // { i, j, frag:[idx], base:{idx:{x,y,z}}, origin:{x,y,z}, axis:{x,y,z} }
  const vibRef = useRef(null);          // { raf, t0, baseByIndex:{idx:{x,y,z}} }
  const frameBaseRef = useRef(null);    // equilibrium/current-frame coords by atom index
  const isoShapesRef = useRef([]);      // isosurface shape handles (cubes are shapes, not surfaces)
  const overlayShapesRef = useRef([]);  // overlay shape handles drawn by drawAll
  propsRef.current = props;

  function liteAtoms() {
    return atomsRef.current.map(function (a) {
      return { index: a.index, elem: a.elem, x: a.x, y: a.y, z: a.z, bonds: (a.bonds || []).slice(), bondOrder: (a.bondOrder || []).slice() };
    });
  }
  function atomByIndex(idx) {
    var arr = atomsRef.current;
    for (var i = 0; i < arr.length; i++) if (arr[i].index === idx) return arr[i];
    return null;
  }

  // ---------- geometry / styling ----------
  function restyle() {
    const v = viewerRef.current; if (!v) return;
    const s = propsRef.current.style, p = propsRef.current;
    v.setStyle({}, repStyle(s));
    if (s.rep === 'cartoon') v.setStyle({ hetflag: true }, { stick: Object.assign({ radius: s.bondRadius }, colorSpec(s)) });
    if (p.colorByCharge && p.chargeData) v.setStyle({}, chargeStyle(s, p.chargeData));
    if (!s.showH) v.setStyle({ elem: 'H' }, {});
    if (p.solventMask && p.solventMode && p.solventMode !== 'show') {
      var sol = []; for (var si = 0; si < p.solventMask.length; si++) if (p.solventMask[si]) sol.push(si);
      if (sol.length) {
        if (p.solventMode === 'hide') v.setStyle({ index: sol }, {});
        else v.setStyle({ index: sol }, { stick: { radius: 0.04, opacity: 0.28, color: '#9fb0c8' }, sphere: { scale: 0.1, opacity: 0.28, color: '#9fb0c8' } });
      }
    }
    v.setViewStyle({ style: 'outline', color: 'black', width: s.outline ? 0.06 : 0.0 });
    applyClickable();
    drawAll();
  }

  // surfaces (molecular VDW + volumetric cube) are managed OUTSIDE restyle to avoid
  // wiping async marching-cubes results on every micro-restyle (vib frames, resizes).
  function refreshSurfaces() {
    const v = viewerRef.current; if (!v) return;
    v.removeAllSurfaces();
    isoShapesRef.current.forEach(function (sh) { try { v.removeShape(sh); } catch (e) {} });
    isoShapesRef.current = [];
    renderSurfaces();
  }

  // molecular VDW surface (surface rep) + active volumetric cube (orbital / density / ESP)
  function renderSurfaces() {
    const v = viewerRef.current; if (!v) return;
    const p = propsRef.current, s = p.style;
    if (s.rep === 'surface') {
      var surfSpec = s.colorMode === 'single'
        ? { opacity: s.surfaceOpacity, color: s.single }
        : (s.colorMode === 'element'
          ? { opacity: s.surfaceOpacity, colorscheme: { prop: 'elem', map: PRESETS.PALETTES[s.palette].map } }
          : { opacity: s.surfaceOpacity, colorscheme: 'whiteCarbon' });
      v.addSurface($3Dmol.SurfaceType.VDW, surfSpec, {}).then(function () { v.render(); });
    }
    var cube = p.cube;
    if (cube && cube.text) {
      try {
        var vd = new $3Dmol.VolumeData(cube.text, 'cube');
        var op = p.isoOpacity != null ? p.isoOpacity : 0.9;
        var col = p.isoColors || { pos: '#3b6fe0', neg: '#e0457b' };
        if (cube.kind === 'esp') {
          var rng = p.espRange || 0.08;
          v.addSurface($3Dmol.SurfaceType.VDW, { opacity: op, voldata: vd, volscheme: new $3Dmol.Gradient.RWB(-rng, rng) }, {}).then(function () { v.render(); });
        } else if (cube.kind === 'density') {
          isoShapesRef.current.push(v.addIsosurface(vd, { isoval: p.isoValue || cube.isoDefault || 0.02, color: col.pos, opacity: op, smoothness: 6 }));
        } else {
          var iv = p.isoValue || cube.isoDefault || 0.04;
          isoShapesRef.current.push(v.addIsosurface(vd, { isoval: iv, color: col.pos, opacity: op, smoothness: 6 }));
          isoShapesRef.current.push(v.addIsosurface(vd, { isoval: -iv, color: col.neg, opacity: op, smoothness: 6 }));
        }
        v.render();
      } catch (e) {}
    }
  }

  // ---------- trajectory frames ----------
  function applyFrame(idx) {
    var frames = propsRef.current.frames; if (!frames || !frames[idx]) return;
    var fc = frames[idx];
    atomsRef.current.forEach(function (a) { var c = fc[a.index]; if (c) { a.x = c.x; a.y = c.y; a.z = c.z; } });
    snapshotFrameBase();
    restyle();
  }
  function snapshotFrameBase() {
    var m = {}; atomsRef.current.forEach(function (a) { m[a.index] = { x: a.x, y: a.y, z: a.z }; });
    frameBaseRef.current = m;
  }

  // ---------- vibrational animation ----------
  function stopVib() {
    if (vibRef.current && vibRef.current.raf) cancelAnimationFrame(vibRef.current.raf);
    if (vibRef.current && frameBaseRef.current) {
      atomsRef.current.forEach(function (a) { var b = frameBaseRef.current[a.index]; if (b) { a.x = b.x; a.y = b.y; a.z = b.z; } });
    }
    vibRef.current = null;
  }
  function startVib() {
    var p = propsRef.current; if (!p.vibMode || !p.vibMode.disp) return;
    if (!frameBaseRef.current) snapshotFrameBase();
    stopVibRaf();
    var t0 = performance.now();
    vibRef.current = { raf: 0, t0: t0 };
    var tick = function (now) {
      var pp = propsRef.current;
      if (!pp.vibMode) { stopVib(); restyle(); return; }
      var amp = (pp.vibAmp != null ? pp.vibAmp : 0.6);
      var spd = (pp.vibSpeed != null ? pp.vibSpeed : 1) * 0.006;
      var phase = pp.vibPlaying === false ? 1 : Math.sin((now - t0) * spd);
      var disp = pp.vibMode.disp, base = frameBaseRef.current;
      atomsRef.current.forEach(function (a, i) {
        var b = base[a.index], d = disp[a.index]; if (!b || !d) return;
        a.x = b.x + d.x * amp * phase; a.y = b.y + d.y * amp * phase; a.z = b.z + d.z * amp * phase;
      });
      restyle();
      vibRef.current.raf = requestAnimationFrame(tick);
    };
    vibRef.current.raf = requestAnimationFrame(tick);
  }
  function stopVibRaf() { if (vibRef.current && vibRef.current.raf) cancelAnimationFrame(vibRef.current.raf); }

  function applyClickable() { /* picking handled by our own mouse listeners (see mount effect) */ }

  // pick the atom nearest to a viewport (client) coordinate; modelToScreen returns client-space px
  function pickAt(clientX, clientY) {
    const v = viewerRef.current; if (!v) return;
    const s = propsRef.current.style;
    var arr = atomsRef.current, best = null, bestD = Infinity, thresh = 26;
    for (var i = 0; i < arr.length; i++) {
      var a = arr[i];
      if (!s.showH && a.elem === 'H') continue;
      var sc; try { sc = v.modelToScreen(a); } catch (e) { continue; }
      var dx = sc.x - clientX, dy = sc.y - clientY, d = Math.sqrt(dx * dx + dy * dy);
      if (d < bestD) { bestD = d; best = a; }
    }
    if (best && bestD <= thresh && propsRef.current.onPickAtom) {
      propsRef.current.onPickAtom({ index: best.index, elem: best.elem, x: best.x, y: best.y, z: best.z });
    }
  }

  // ---------- overlays ----------
  function drawAll() {
    const v = viewerRef.current; if (!v) return;
    const p = propsRef.current, s = p.style;
    overlayShapesRef.current.forEach(function (sh) { try { v.removeShape(sh); } catch (e) {} });
    overlayShapesRef.current = [];
    v.removeAllLabels();
    var shapeStart = v.shapes.length;

    // atom labels
    if (s.showLabels) {
      var atoms = atomsRef.current;
      if (atoms.length <= 80) {
        atoms.forEach(function (a) {
          if (a.elem === 'H') return;
          v.addLabel(a.elem, { position: { x: a.x, y: a.y, z: a.z }, fontSize: 11, fontColor: 'white',
            backgroundColor: '#161c2a', backgroundOpacity: 0.7, borderThickness: 0, inFront: true, alignment: 'center' });
        });
      }
    }

    // partial-charge labels
    if (p.showChargeLabels && p.chargeData && atomsRef.current.length <= 120) {
      atomsRef.current.forEach(function (a) {
        var c = p.chargeData[a.index]; if (c == null) return;
        v.addLabel((c >= 0 ? '+' : '') + c.toFixed(2), { position: { x: a.x, y: a.y, z: a.z }, fontSize: 10, fontColor: 'white',
          backgroundColor: c >= 0 ? '#2563eb' : '#e0457b', backgroundOpacity: 0.92, borderThickness: 0, inFront: true, alignment: 'center' });
      });
    }

    // chirality R/S labels
    if (p.showChirality && atomsRef.current.length && atomsRef.current.length <= 200) {
      var centers = Analyze.stereocenters(liteAtoms());
      if (p.onStereocenters) p.onStereocenters(centers);
      centers.forEach(function (c) {
        var col = c.label === 'R' ? '#2563eb' : '#e0457b';
        v.addLabel('(' + c.label + ')', { position: c.pos, fontSize: 13, fontColor: 'white',
          backgroundColor: col, backgroundOpacity: 0.95, borderThickness: 1.5, borderColor: 'white', inFront: true });
        v.addSphere({ center: c.pos, radius: 0.55, color: col, alpha: 0.28 });
      });
    } else if (p.showChirality && p.onStereocenters) {
      p.onStereocenters([]);
    }

    // in-progress picks — conspicuous halo (sized above the atom) + numbered tag
    var hl = p.highlightColor || '#ffcc00';
    var R = markerRadius(s);
    (p.picks || []).forEach(function (pk, i) {
      var a = atomByIndex(pk.index); if (!a) return;
      var c = { x: a.x, y: a.y, z: a.z };
      v.addSphere({ center: c, radius: R, color: hl, alpha: 0.42 });
      v.addSphere({ center: c, radius: R, color: hl, wireframe: true, linewidth: 2.5 });
      v.addLabel(String(i + 1), { position: c, fontSize: 13, fontColor: '#161c2a',
        backgroundColor: hl, backgroundOpacity: 1, borderThickness: 1.5, borderColor: '#161c2a', inFront: true, alignment: 'center' });
    });

    // committed measurements (computed live from current coords)
    (p.measurements || []).forEach(function (m) {
      var pts = m.atoms.map(function (idx) { var a = atomByIndex(idx); return a ? { x: a.x, y: a.y, z: a.z } : null; });
      if (pts.some(function (x) { return !x; })) return;
      var col = MEASURE_COLOR[m.type];
      // mark each participating atom with a highlight halo so it stays distinguishable
      pts.forEach(function (pt) {
        v.addSphere({ center: pt, radius: R, color: hl, alpha: 0.38 });
        v.addSphere({ center: pt, radius: R, color: hl, wireframe: true, linewidth: 2 });
      });
      for (var k = 0; k < pts.length - 1; k++) v.addCylinder({ start: pts[k], end: pts[k + 1], radius: 0.035, color: col, fromCap: 1, toCap: 1, dashed: true });
      var val, lbl, anchor;
      if (m.type === 'distance') { val = Analyze.distance(pts[0], pts[1]); lbl = val.toFixed(3) + ' Å'; anchor = mid(pts[0], pts[1]); }
      else if (m.type === 'angle') { val = Analyze.angle(pts[0], pts[1], pts[2]); lbl = val.toFixed(1) + '°'; anchor = pts[1]; }
      else { val = Analyze.dihedral(pts[0], pts[1], pts[2], pts[3]); lbl = val.toFixed(1) + '°'; anchor = mid(pts[1], pts[2]); }
      v.addLabel(lbl, { position: anchor, fontSize: 12, fontColor: 'white', backgroundColor: col, backgroundOpacity: 0.95, borderThickness: 0, inFront: true });
    });

    // twist bond highlight
    var tb = twistBaseRef.current;
    if (tb) {
      var ai = atomByIndex(tb.i), aj = atomByIndex(tb.j);
      if (ai && aj) v.addCylinder({ start: { x: ai.x, y: ai.y, z: ai.z }, end: { x: aj.x, y: aj.y, z: aj.z }, radius: 0.12, color: '#f59e0b', alpha: 0.6, fromCap: 2, toCap: 2 });
    }
    // move-tool selected atom highlight (with little XYZ axis gizmo)
    if (p.tool === 'move' && moveSelRef.current != null) {
      var ma = atomByIndex(moveSelRef.current);
      if (ma) {
        var mc = { x: ma.x, y: ma.y, z: ma.z }, RR = markerRadius(s);
        v.addSphere({ center: mc, radius: RR, color: hl, alpha: 0.4 });
        v.addSphere({ center: mc, radius: RR, color: hl, wireframe: true, linewidth: 2.5 });
        var L = 1.4;
        v.addArrow({ start: mc, end: { x: mc.x + L, y: mc.y, z: mc.z }, radius: 0.04, color: '#e8453c' });
        v.addArrow({ start: mc, end: { x: mc.x, y: mc.y + L, z: mc.z }, radius: 0.04, color: '#3cae4f' });
        v.addArrow({ start: mc, end: { x: mc.x, y: mc.y, z: mc.z + L }, radius: 0.04, color: '#3b7fe0' });
      }
    }
    // dipole-moment arrow (from centroid)
    if (p.showDipole && p.dipole) {
      var ce = centroidLive(), sc = (p.arrowScale != null ? p.arrowScale : 1);
      var dl = Math.hypot(p.dipole.x, p.dipole.y, p.dipole.z) || 1;
      var u = { x: p.dipole.x / dl, y: p.dipole.y / dl, z: p.dipole.z / dl };
      var L = 1.0 + (p.dipole.debye || 1) * 0.7 * sc;
      var end = { x: ce.x + u.x * L, y: ce.y + u.y * L, z: ce.z + u.z * L };
      v.addArrow({ start: ce, end: end, radius: 0.09 * sc, color: '#7c3aed', mid: 0.85 });
      v.addLabel('µ ' + (p.dipole.debye || 0).toFixed(2) + ' D', { position: end, fontSize: 12, fontColor: 'white', backgroundColor: '#7c3aed', backgroundOpacity: 0.95, inFront: true });
    }
    // vibrational-mode displacement arrows (shown when a mode is selected)
    if (p.vibMode && p.vibMode.disp && p.showModeArrows !== false) {
      var sc2 = (p.arrowScale != null ? p.arrowScale : 1), base = frameBaseRef.current;
      atomsRef.current.forEach(function (a) {
        var d = p.vibMode.disp[a.index]; if (!d) return;
        var b = base && base[a.index] ? base[a.index] : a;
        var m = Math.hypot(d.x, d.y, d.z); if (m < 0.02) return;
        var k = 1.6 * sc2;
        v.addArrow({ start: { x: b.x, y: b.y, z: b.z }, end: { x: b.x + d.x * k, y: b.y + d.y * k, z: b.z + d.z * k }, radius: 0.055 * sc2, color: '#0ea5a0' });
      });
    }
    overlayShapesRef.current = v.shapes.slice(shapeStart);
    v.render();
  }
  function centroidLive() { var c = { x: 0, y: 0, z: 0 }, arr = atomsRef.current; arr.forEach(function (a) { c.x += a.x; c.y += a.y; c.z += a.z; }); var n = arr.length || 1; return { x: c.x / n, y: c.y / n, z: c.z / n }; }  function mid(a, b) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 }; }

  function applyBg() {
    const v = viewerRef.current; if (!v) return;
    v.setBackgroundColor(propsRef.current.bg.color, propsRef.current.bg.alpha); v.render();
  }

  // ---------- twist ----------
  function beginTwist(i, j) {
    const v = viewerRef.current; if (!v) return { ok: false };
    var lite = liteAtoms();
    var force = !!(propsRef.current.twist && propsRef.current.twist.force);
    var frag = Analyze.rotatableFragment(lite, i, j);
    var ring = false;
    if (!frag) {
      ring = true;
      if (!force) { twistBaseRef.current = null; drawAll(); return { ok: false, ring: true }; }
      frag = Analyze.sideTree(lite, i, j);   // forced: rotate j-side subtree, distorting the ring
    }
    // rotate the smaller fragment for nicer feel (only when not a forced ring cut)
    if (!ring && frag.length > lite.length / 2) { var alt = Analyze.rotatableFragment(lite, j, i); if (alt && alt.length < frag.length) { var t = i; i = j; j = t; frag = alt; } }
    var ai = atomByIndex(i), aj = atomByIndex(j);
    var base = {};
    frag.forEach(function (idx) { var a = atomByIndex(idx); base[idx] = { x: a.x, y: a.y, z: a.z }; });
    var axis = Analyze.norm(Analyze.sub({ x: aj.x, y: aj.y, z: aj.z }, { x: ai.x, y: ai.y, z: ai.z }));
    twistBaseRef.current = { i: i, j: j, frag: frag, base: base, origin: { x: ai.x, y: ai.y, z: ai.z }, axis: axis };
    var order = Analyze.bondOrderBetween(lite, i, j);
    drawAll();
    return { ok: true, ring: ring, forced: ring, doubleBond: order > 1, fragmentSize: frag.length };
  }
  function applyTwist(deg) {
    var tb = twistBaseRef.current; if (!tb) return;
    var ang = deg * Math.PI / 180;
    tb.frag.forEach(function (idx) {
      var a = atomByIndex(idx); if (!a) return;
      var np = Analyze.rotateAround(tb.base[idx], tb.origin, tb.axis, ang);
      a.x = np.x; a.y = np.y; a.z = np.z;
    });
    restyle();
  }
  function endTwist() { twistBaseRef.current = null; drawAll(); }

  // ---------- structural editing: move atoms ----------
  var origCoordsRef = useRef(null);   // {index:{x,y,z}} snapshot of loaded geometry
  var moveSelRef = useRef(null);      // selected atom index in Move tool
  var dragRef = useRef(null);         // active drag {index, pinv, startWorld, startClient}

  function snapshotOriginal() {
    var m = {}; atomsRef.current.forEach(function (a) { m[a.index] = { x: a.x, y: a.y, z: a.z }; });
    origCoordsRef.current = m;
  }
  // 3x2 pseudo-inverse of the world→screen Jacobian at atom a (keeps depth: min-norm => camera plane)
  function moveBasis(a) {
    const v = viewerRef.current;
    var eps = 0.6;
    var s0 = v.modelToScreen({ x: a.x, y: a.y, z: a.z });
    var sx = v.modelToScreen({ x: a.x + eps, y: a.y, z: a.z });
    var sy = v.modelToScreen({ x: a.x, y: a.y + eps, z: a.z });
    var sz = v.modelToScreen({ x: a.x, y: a.y, z: a.z + eps });
    // M (2x3): columns are d(screen)/d(world axis)
    var M = [[(sx.x - s0.x) / eps, (sy.x - s0.x) / eps, (sz.x - s0.x) / eps],
             [(sx.y - s0.y) / eps, (sy.y - s0.y) / eps, (sz.y - s0.y) / eps]];
    // MMt (2x2)
    var a11 = M[0][0] * M[0][0] + M[0][1] * M[0][1] + M[0][2] * M[0][2];
    var a12 = M[0][0] * M[1][0] + M[0][1] * M[1][1] + M[0][2] * M[1][2];
    var a22 = M[1][0] * M[1][0] + M[1][1] * M[1][1] + M[1][2] * M[1][2];
    var det = a11 * a22 - a12 * a12; if (Math.abs(det) < 1e-9) det = 1e-9;
    var i11 = a22 / det, i12 = -a12 / det, i22 = a11 / det;   // inverse of MMt
    // pinv = M^T * inv(MMt)  → 3x2
    var pinv = [];
    for (var r = 0; r < 3; r++) pinv.push([M[0][r] * i11 + M[1][r] * i12, M[0][r] * i12 + M[1][r] * i22]);
    return pinv;
  }
  function nearestAtom(clientX, clientY, thresh) {
    const v = viewerRef.current, s = propsRef.current.style;
    var arr = atomsRef.current, best = null, bestD = Infinity;
    for (var i = 0; i < arr.length; i++) {
      var a = arr[i]; if (!s.showH && a.elem === 'H') continue;
      var sc; try { sc = v.modelToScreen(a); } catch (e) { continue; }
      var d = Math.hypot(sc.x - clientX, sc.y - clientY);
      if (d < bestD) { bestD = d; best = a; }
    }
    return (best && bestD <= (thresh || 26)) ? best : null;
  }
  function selectMove(idx) { moveSelRef.current = idx; var a = atomByIndex(idx); if (propsRef.current.onMoveSelect) propsRef.current.onMoveSelect(a ? { index: a.index, elem: a.elem } : null); drawAll(); }
  function beginDrag(a, clientX, clientY) {
    dragRef.current = { index: a.index, pinv: moveBasis(a), startWorld: { x: a.x, y: a.y, z: a.z }, startClient: { x: clientX, y: clientY } };
    moveSelRef.current = a.index;
    if (propsRef.current.onMoveSelect) propsRef.current.onMoveSelect({ index: a.index, elem: a.elem });
  }
  function doDrag(clientX, clientY) {
    var d = dragRef.current; if (!d) return;
    var dsx = clientX - d.startClient.x, dsy = clientY - d.startClient.y;
    var dwx = d.pinv[0][0] * dsx + d.pinv[0][1] * dsy;
    var dwy = d.pinv[1][0] * dsx + d.pinv[1][1] * dsy;
    var dwz = d.pinv[2][0] * dsx + d.pinv[2][1] * dsy;
    var a = atomByIndex(d.index); if (!a) return;
    a.x = d.startWorld.x + dwx; a.y = d.startWorld.y + dwy; a.z = d.startWorld.z + dwz;
    restyle();
  }
  function endDrag() { dragRef.current = null; }
  function nudgeMove(axis, delta) {
    var idx = moveSelRef.current; if (idx == null) return;
    var a = atomByIndex(idx); if (!a) return;
    a[axis] += delta; restyle();
  }
  function resetGeometry() {
    var orig = origCoordsRef.current; if (!orig) return;
    atomsRef.current.forEach(function (a) { var o = orig[a.index]; if (o) { a.x = o.x; a.y = o.y; a.z = o.z; } });
    twistBaseRef.current = null; restyle();
  }

  // ---------- load ----------
  function captureModel() {
    const v = viewerRef.current;
    modelRef.current = v.getModel();
    atomsRef.current = modelRef.current ? modelRef.current.selectedAtoms({}) : [];
    applyFixedBonds();
    if (propsRef.current.onModelReady) propsRef.current.onModelReady(liteAtoms());
  }
  // override perceived connectivity with an explicit bond list (generative backbones, fixed graphs)
  function applyFixedBonds() {
    var fb = propsRef.current.fixedBonds; if (!fb) return;
    var byIdx = {};
    atomsRef.current.forEach(function (a) { a.bonds = []; a.bondOrder = []; byIdx[a.index] = a; });
    fb.forEach(function (pair) {
      var a = byIdx[pair[0]], b = byIdx[pair[1]];
      if (a && b) { a.bonds.push(b.index); a.bondOrder.push(1); b.bonds.push(a.index); b.bondOrder.push(1); }
    });
  }
  function load() {
    const v = viewerRef.current; if (!v) return;
    twistBaseRef.current = null; stopVibRaf(); vibRef.current = null;
    v.removeAllModels(); v.removeAllSurfaces(); v.removeAllLabels(); v.removeAllShapes();
    isoShapesRef.current = []; overlayShapesRef.current = [];
    const mol = propsRef.current.molecule;
    if (!mol) { v.render(); return; }
    propsRef.current.onLoading(true, null);
    const finish = () => {
      try {
        captureModel(); snapshotOriginal();
        var fi = propsRef.current.frameIndex || 0;
        if (propsRef.current.frames && propsRef.current.frames[fi]) applyFrame(fi); else { snapshotFrameBase(); restyle(); }
        refreshSurfaces(); v.zoomTo(); applyBg(); v.spin(propsRef.current.spin ? 'y' : false); propsRef.current.onLoading(false, null);
      }
      catch (e) { propsRef.current.onLoading(false, 'Could not render this structure.'); }
    };
    if (mol.data) {
      try { v.addModel(mol.data, mol.format); finish(); }
      catch (e) { propsRef.current.onLoading(false, 'Could not parse molecule data.'); }
    } else if (mol.cid) {
      $3Dmol.download('cid:' + mol.cid, v, {}, function () { if (v.getModel() == null) { propsRef.current.onLoading(false, 'Could not reach PubChem. Check your connection.'); return; } finish(); });
    } else if (mol.pdb) {
      $3Dmol.download('pdb:' + mol.pdb, v, { doAssembly: false }, function () { if (v.getModel() == null) { propsRef.current.onLoading(false, 'Could not reach the PDB. Check your connection.'); return; } finish(); });
    }
  }

  // ---------- lifecycle ----------
  useEffect(() => {
    const v = $3Dmol.createViewer(hostRef.current, { backgroundColor: props.bg.color, antialias: true });
    viewerRef.current = v;
    load();
    // mouse handling: click-pick (measure/twist/chirality) and drag-to-move (move tool)
    let down = null, didDrag = false;
    const onDown = (e) => {
      down = { x: e.clientX, y: e.clientY, t: Date.now() }; didDrag = false;
      if (propsRef.current.tool === 'move') {
        const a = nearestAtom(e.clientX, e.clientY, 26);
        if (a) { beginDrag(a, e.clientX, e.clientY); e.stopPropagation(); e.preventDefault(); }  // block camera rotate
      }
    };
    const onMove = (e) => {
      if (dragRef.current) { didDrag = true; doDrag(e.clientX, e.clientY); e.stopPropagation(); }
    };
    const onUp = (e) => {
      if (dragRef.current) {
        const moved = down ? Math.hypot(e.clientX - down.x, e.clientY - down.y) : 0;
        endDrag(); down = null;
        if (moved <= 4) selectMove(propsRef.current.tool === 'move' ? nearestSelIndex(e) : null); // a tap selects
        else drawAll();
        return;
      }
      if (!down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), dt = Date.now() - down.t;
      down = null;
      const tool = propsRef.current.tool;
      if (tool === 'orbit') return;
      if (moved > 5 || dt > 700) return;
      if (tool === 'move') { const a = nearestAtom(e.clientX, e.clientY, 26); if (a) selectMove(a.index); return; }
      pickAt(e.clientX, e.clientY);
    };
    function nearestSelIndex(e) { const a = nearestAtom(e.clientX, e.clientY, 26); return a ? a.index : moveSelRef.current; }
    const hostEl = hostRef.current;
    hostEl.addEventListener('mousedown', onDown, true);   // capture: run before 3Dmol's own handler
    hostEl.addEventListener('mousemove', onMove, true);
    window.addEventListener('mouseup', onUp, true);
    const onResize = () => { try { v.resize(); v.render(); } catch (e) {} };
    window.addEventListener('resize', onResize);
    let ro = null;
    if (window.ResizeObserver) { ro = new ResizeObserver(() => onResize()); ro.observe(hostEl); }
    return () => { stopVibRaf(); if (ro) ro.disconnect(); window.removeEventListener('resize', onResize); hostEl.removeEventListener('mousedown', onDown, true); hostEl.removeEventListener('mousemove', onMove, true); window.removeEventListener('mouseup', onUp, true); };
  }, []);

  const molKey = props.molecule ? (props.molecule.key || '') : '';
  useEffect(() => { load(); }, [molKey]);
  useEffect(() => { restyle(); }, [JSON.stringify(props.style)]);
  useEffect(() => { drawAll(); }, [JSON.stringify(props.picks), JSON.stringify(props.measurements), props.showChirality, props.tool, props.highlightColor]);
  useEffect(() => { applyClickable(); }, [props.tool]);
  useEffect(() => { applyBg(); }, [props.bg.color, props.bg.alpha]);
  useEffect(() => { const v = viewerRef.current; if (v) v.spin(props.spin ? 'y' : false); }, [props.spin]);

  // twist begin/clear
  const twistKey = props.twist ? (props.twist.i + '-' + props.twist.j + '-' + props.twist.token + '-' + (props.twist.force ? 1 : 0)) : '';
  useEffect(() => {
    if (!props.twist) { if (twistBaseRef.current) endTwist(); return; }
    const r = beginTwist(props.twist.i, props.twist.j);
    if (props.onTwistReady) props.onTwistReady(r);
  }, [twistKey]);
  useEffect(() => { if (twistBaseRef.current) applyTwist(props.twistAngle || 0); }, [props.twistAngle]);

  // trajectory frame change
  useEffect(() => { if (propsRef.current.frames) applyFrame(props.frameIndex || 0); }, [props.frameIndex]);
  // vibration: start/stop when selected mode or play state changes
  const vibKey = props.vibMode ? (props.vibMode.id + '|' + (props.vibPlaying ? 1 : 0)) : '';
  useEffect(() => {
    stopVib();
    if (props.vibMode) startVib(); else { restyle(); }
  }, [vibKey]);
  // live amplitude/speed handled inside the rAF via propsRef; redraw arrows on cube/iso/dipole change
  useEffect(() => { refreshSurfaces(); }, [props.style.rep, props.style.colorMode, props.style.palette, props.style.single, props.style.surfaceOpacity, JSON.stringify(props.cube ? { n: props.cube.name, kind: props.cube.kind } : null), props.isoValue, props.isoOpacity, props.espRange, JSON.stringify(props.isoColors)]);
  useEffect(() => { restyle(); }, [props.colorByCharge, JSON.stringify(props.chargeData ? props.chargeData.length : 0), props.solventMode]);
  useEffect(() => { drawAll(); }, [props.showDipole, props.showModeArrows, props.arrowScale, props.showChargeLabels]);

  useImperativeHandle(ref, () => ({
    resize() { const v = viewerRef.current; if (v) { try { v.resize(); v.render(); } catch (e) {} } },
    resetView() { const v = viewerRef.current; if (v) { v.zoomTo(); v.render(); } },
    rotate(axis, ang) { const v = viewerRef.current; if (v) { v.rotate(ang, axis); v.render(); } },
    bakeTwist() {
      // make current coords the new baseline (so further edits stack)
      var tb = twistBaseRef.current; if (!tb) return;
      tb.frag.forEach(function (idx) { var a = atomByIndex(idx); tb.base[idx] = { x: a.x, y: a.y, z: a.z }; });
    },
    cancelTwist() { if (twistBaseRef.current) { applyTwist(0); endTwist(); } },
    nudge(axis, delta) { nudgeMove(axis, delta); },
    clearMoveSelection() { moveSelRef.current = null; if (propsRef.current.onMoveSelect) propsRef.current.onMoveSelect(null); drawAll(); },
    resetGeometry() { resetGeometry(); },
    captureFrames(maxN, scaleW) {
      const v = viewerRef.current, frames = propsRef.current.frames; if (!v || !frames) return null;
      const n = frames.length, count = Math.min(n, maxN || 150);
      const pick = []; for (var i = 0; i < count; i++) pick.push(Math.round(i * (n - 1) / Math.max(1, count - 1)));
      const host = hostRef.current, w = host.clientWidth, h = host.clientHeight;
      const wasSpin = propsRef.current.spin; if (wasSpin) v.spin(false);
      const saveFrame = propsRef.current.frameIndex;
      const uris = pick.map(function (fi) {
        var fc = frames[fi]; atomsRef.current.forEach(function (a) { var c = fc[a.index]; if (c) { a.x = c.x; a.y = c.y; a.z = c.z; } });
        restyle(); v.render(); return v.pngURI();
      });
      var fc0 = frames[saveFrame] || frames[0]; atomsRef.current.forEach(function (a) { var c = fc0[a.index]; if (c) { a.x = c.x; a.y = c.y; a.z = c.z; } });
      restyle(); if (wasSpin) v.spin('y'); v.render();
      const W = scaleW || Math.min(w, 540), H = Math.round(W * h / w);
      const bg = propsRef.current.bg.alpha ? propsRef.current.bg.color : '#ffffff';
      return Promise.all(uris.map(function (u) { return new Promise(function (res) { var im = new Image(); im.onload = function () { res(im); }; im.onerror = function () { res(null); }; im.src = u; }); }))
        .then(function (imgs) {
          return imgs.map(function (img) {
            var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
            var cx = cv.getContext('2d'); cx.fillStyle = bg; cx.fillRect(0, 0, W, H);
            if (img) cx.drawImage(img, 0, 0, W, H);
            return cv;
          });
        });
    },
    exportFrames(cols) {
      const v = viewerRef.current, frames = propsRef.current.frames; if (!v || !frames) return null;
      cols = cols || 6;
      const n = frames.length, maxN = Math.min(n, 24);
      const pick = []; for (var i = 0; i < maxN; i++) pick.push(Math.round(i * (n - 1) / (maxN - 1)));
      const host = hostRef.current, w = host.clientWidth, h = host.clientHeight;
      const wasSpin = propsRef.current.spin; if (wasSpin) v.spin(false);
      const saveFrame = propsRef.current.frameIndex;
      // capture each frame's PNG data URL synchronously
      const uris = pick.map(function (fi) {
        var fc = frames[fi]; atomsRef.current.forEach(function (a) { var c = fc[a.index]; if (c) { a.x = c.x; a.y = c.y; a.z = c.z; } });
        restyle(); v.render(); return v.pngURI();
      });
      var fc0 = frames[saveFrame] || frames[0]; atomsRef.current.forEach(function (a) { var c = fc0[a.index]; if (c) { a.x = c.x; a.y = c.y; a.z = c.z; } });
      restyle(); if (wasSpin) v.spin('y'); v.render();
      // compose montage once all images decode
      const cw = 360, ch = Math.round(cw * h / w), rows = Math.ceil(pick.length / cols);
      const canvas = document.createElement('canvas'); canvas.width = cw * cols; canvas.height = ch * rows;
      const ctx = canvas.getContext('2d'); ctx.fillStyle = propsRef.current.bg.alpha ? propsRef.current.bg.color : '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      return Promise.all(uris.map(function (u) { return new Promise(function (res) { var im = new Image(); im.onload = function () { res(im); }; im.onerror = function () { res(null); }; im.src = u; }); }))
        .then(function (imgs) {
          imgs.forEach(function (img, k) {
            var col = k % cols, row = Math.floor(k / cols);
            if (img) ctx.drawImage(img, col * cw, row * ch, cw, ch);
            ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(col * cw + 6, row * ch + 6, 38, 18);
            ctx.fillStyle = '#fff'; ctx.font = '12px monospace'; ctx.fillText('#' + (pick[k] + 1), col * cw + 10, row * ch + 19);
          });
          return canvas.toDataURL('image/png');
        });
    },
    exportPNG(scale) {
      const v = viewerRef.current; if (!v) return null;
      const host = hostRef.current, w = host.clientWidth, h = host.clientHeight;
      host.style.width = (w * scale) + 'px'; host.style.height = (h * scale) + 'px';
      v.resize();
      const wasSpin = propsRef.current.spin; if (wasSpin) v.spin(false);
      v.render();
      const uri = v.pngURI();
      host.style.width = ''; host.style.height = '';
      v.resize(); if (wasSpin) v.spin('y'); v.render();
      return uri;
    }
  }));

  return <div className="viewer-host" ref={hostRef}></div>;
});

window.Viewer = Viewer;
