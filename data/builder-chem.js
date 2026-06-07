/* builder-chem.js — chemistry helpers for the sketcher.
   Graph model: atoms=[{el,x,y}], bonds=[{a,b,order}] (a,b are atom indices). */
(function () {
  var E = function () { return window.BUILDER_DATA.ELEMENTS; };
  var ORGANIC = { B: 1, C: 1, N: 1, O: 1, P: 1, S: 1, F: 1, Cl: 1, Br: 1, I: 1 };

  function bondSum(i, bonds) { var s = 0; bonds.forEach(function (b) { if (b.a === i || b.b === i) s += b.order; }); return s; }
  function valenceOf(el) { var e = E()[el]; return e ? e.val : 0; }
  function implicitH(i, atoms, bonds) {
    var v = valenceOf(atoms[i].el); if (!v) return 0;
    return Math.max(0, v - bondSum(i, bonds));
  }
  function valenceErrors(atoms, bonds) {
    var bad = [];
    atoms.forEach(function (a, i) { var v = valenceOf(a.el); if (v && bondSum(i, bonds) > v) bad.push(i); });
    return bad;
  }
  function neighbors(i, bonds) { var ns = []; bonds.forEach(function (b) { if (b.a === i) ns.push(b.b); else if (b.b === i) ns.push(b.a); }); return ns; }

  // ---- formula (Hill) + molecular weight ----
  function counts(atoms, bonds) {
    var c = {}, hImpl = 0;
    atoms.forEach(function (a, i) { c[a.el] = (c[a.el] || 0) + 1; hImpl += implicitH(i, atoms, bonds); });
    c.H = (c.H || 0) + hImpl;
    return c;
  }
  var SUB = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉' };
  function sub(n) { return n > 1 ? String(n).replace(/\d/g, function (d) { return SUB[d]; }) : ''; }
  function formula(atoms, bonds) {
    if (!atoms.length) return '—';
    var c = counts(atoms, bonds), keys = Object.keys(c).filter(function (k) { return c[k] > 0; });
    var order = keys.sort(function (a, b) {
      if (a === 'C') return -1; if (b === 'C') return 1; if (a === 'H') return -1; if (b === 'H') return 1; return a.localeCompare(b);
    });
    return order.map(function (k) { return k + sub(c[k]); }).join('');
  }
  function molWeight(atoms, bonds) {
    var c = counts(atoms, bonds), w = 0, el = E();
    Object.keys(c).forEach(function (k) { var e = el[k]; if (e) w += e.mass * c[k]; });
    return w;
  }

  // ---- 2D → 3D (planar embed + hydrogens) ----
  // Emits a MOL (V2000) block so the viewer uses the EXPLICIT bond table we drew,
  // instead of re-guessing connectivity from interatomic distance (which dropped real
  // bonds and invented phantom ones between atoms that happened to land close).
  var CHLEN = { C: 1.09, N: 1.01, O: 0.96, S: 1.34, P: 1.42, B: 1.19, default: 1.0 };
  function padL(s, n) { s = String(s); while (s.length < n) s = ' ' + s; return s; }
  function f10(x) { return padL(x.toFixed(4), 10); }
  function elPad(el) { el = String(el); while (el.length < 3) el += ' '; return el; }
  // build the full 3D atom list (heavy + added H) from the 2D sketch, planar embed
  function embed(atoms, bonds) {
    var ds = bonds.map(function (b) { var p = atoms[b.a], q = atoms[b.b]; return Math.hypot(p.x - q.x, p.y - q.y); }).filter(function (d) { return d > 0; }).sort(function (a, b) { return a - b; });
    var med = ds.length ? ds[Math.floor(ds.length / 2)] : 1;
    var sc = 1.5 / (med || 1);
    var coords = atoms.map(function (a) { return { el: a.el, x: a.x * sc, y: -a.y * sc, z: 0 }; });
    var allBonds = bonds.map(function (b) { return { a: b.a, b: b.b, order: b.order || 1 }; });
    atoms.forEach(function (a, i) {
      var nH = implicitH(i, atoms, bonds); if (!nH) return;
      var ns = neighbors(i, bonds);
      var here = coords[i];
      var ax = 0, ay = 0;
      ns.forEach(function (j) { var d = norm2(coords[j].x - here.x, coords[j].y - here.y); ax += d[0]; ay += d[1]; });
      var away = norm2(-ax, -ay); if (ns.length === 0) away = [1, 0];
      var baseAng = Math.atan2(away[1], away[0]);
      var spread = ns.length >= 2 ? 50 : (ns.length === 1 ? 60 : 109.5);
      var len = CHLEN[a.el] || CHLEN.default;
      for (var k = 0; k < nH; k++) {
        var off = (k - (nH - 1) / 2) * spread * Math.PI / 180;
        var ang = baseAng + off;
        var zk = (ns.length <= 2 && valenceOf(a.el) >= 4) ? ((k % 2 === 0 ? 1 : -1) * 0.55 * len) : 0;
        var hIdx = coords.length;
        coords.push({ el: 'H', x: here.x + Math.cos(ang) * len, y: here.y + Math.sin(ang) * len, z: here.z + zk });
        allBonds.push({ a: i, b: hIdx, order: 1 });
      }
    });
    return { coords: coords, bonds: allBonds };
  }

  // serialize a coords+bonds set to a V2000 MOL block (centered)
  function molBlock(coords, allBonds) {
    var cx = 0, cy = 0, cz = 0; coords.forEach(function (c) { cx += c.x; cy += c.y; cz += c.z; });
    var n = coords.length || 1; cx /= n; cy /= n; cz /= n;
    var L = ['', '  MolStudio  2D->3D', ''];
    L.push(padL(coords.length, 3) + padL(allBonds.length, 3) + '  0  0  0  0  0  0  0  0999 V2000');
    coords.forEach(function (c) {
      L.push(f10(c.x - cx) + f10(c.y - cy) + f10(c.z - cz) + ' ' + elPad(c.el) + ' 0  0  0  0  0  0  0  0  0  0  0  0');
    });
    allBonds.forEach(function (b) {
      var o = Math.min(3, Math.max(1, b.order || 1));
      L.push(padL(b.a + 1, 3) + padL(b.b + 1, 3) + padL(o, 3) + '  0  0  0  0');
    });
    L.push('M  END');
    return L.join('\n') + '\n';
  }

  // ---- geometry relaxation (distance-geometry force field) ----
  // Restraints: ideal 1–2 bond lengths, ideal 1–3 distances (from hybridisation
  // angle), and soft steric repulsion on far pairs. Minimised by adaptive gradient
  // descent — pulls the flat sketch into a sensible, clash-free stable conformer.
  var COV = { H: 0.31, B: 0.84, C: 0.76, N: 0.71, O: 0.66, F: 0.57, Si: 1.11, P: 1.07, S: 1.05, Cl: 1.02, Br: 1.20, I: 1.39, Se: 1.20, Sn: 1.39, Ge: 1.20, As: 1.19, Te: 1.38, Na: 1.66, K: 2.03, Li: 1.28, Mg: 1.41, Ca: 1.76, Al: 1.21, Zn: 1.22, Fe: 1.32, Cu: 1.32, Ni: 1.24 };
  var VDW = { H: 1.10, B: 1.92, C: 1.70, N: 1.55, O: 1.52, F: 1.47, Si: 2.10, P: 1.80, S: 1.80, Cl: 1.75, Br: 1.85, I: 1.98, Se: 1.90 };
  function cov(el) { return COV[el] || 0.85; }
  function vdw(el) { return VDW[el] || 1.7; }
  function bondLen(ea, eb, order) { var d = cov(ea) + cov(eb); if (order === 2) d -= 0.15; else if (order === 3) d -= 0.24; return d; }
  function angleAt(j, allBonds) {
    var maxO = 1, dbl = 0, trp = 0;
    allBonds.forEach(function (b) { if (b.a === j || b.b === j) { if (b.order > maxO) maxO = b.order; if (b.order === 2) dbl++; if (b.order === 3) trp++; } });
    if (trp > 0 || dbl >= 2) return Math.PI;                 // sp  → 180°
    if (dbl === 1) return 120 * Math.PI / 180;                // sp2 → 120°
    return 109.47 * Math.PI / 180;                            // sp3 → 109.5°
  }
  function relax(coords, allBonds, iters) {
    var n = coords.length; if (n < 2) return;
    // adjacency + neighbour bond orders
    var adj = []; for (var i = 0; i < n; i++) adj.push([]);
    allBonds.forEach(function (b) { adj[b.a].push({ to: b.b, order: b.order }); adj[b.b].push({ to: b.a, order: b.order }); });
    var restr = [];          // {i,j,d0,k}
    var pairKey = {};        // mark 1-2 / 1-3 pairs to exclude from non-bonded
    function mark(i, j) { pairKey[(i < j ? i + '_' + j : j + '_' + i)] = 1; }
    // 1–2 bonds
    allBonds.forEach(function (b) {
      var d0 = bondLen(coords[b.a].el, coords[b.b].el, b.order);
      restr.push({ i: b.a, j: b.b, d0: d0, k: 1.0 }); mark(b.a, b.b);
    });
    // 1–3 (angle) distances
    for (var j = 0; j < n; j++) {
      var ns = adj[j]; var th = angleAt(j, allBonds);
      for (var p = 0; p < ns.length; p++) for (var q = p + 1; q < ns.length; q++) {
        var a = ns[p], b = ns[q];
        var b1 = bondLen(coords[j].el, coords[a.to].el, a.order);
        var b2 = bondLen(coords[j].el, coords[b.to].el, b.order);
        var d0 = Math.sqrt(Math.max(0.01, b1 * b1 + b2 * b2 - 2 * b1 * b2 * Math.cos(th)));
        restr.push({ i: a.to, j: b.to, d0: d0, k: 0.55 }); mark(a.to, b.to);
      }
    }
    // non-bonded steric repulsion (far pairs only)
    var nb = [];
    for (var x = 0; x < n; x++) for (var y = x + 1; y < n; y++) {
      if (pairKey[x + '_' + y]) continue;
      nb.push({ i: x, j: y, s: 0.80 * (vdw(coords[x].el) + vdw(coords[y].el)) });
    }
    // planarity (improper) restraints: each double bond + its substituents must stay
    // coplanar (zero tetrahedron volume) → keeps C=C units & aromatic rings flat,
    // while leaving sp3 rings free to pucker.
    var imp = [];
    allBonds.forEach(function (b) {
      if (b.order !== 2) return;
      var ni = adj[b.a].filter(function (e) { return e.to !== b.b; });
      var nj = adj[b.b].filter(function (e) { return e.to !== b.a; });
      ni.forEach(function (p) { nj.forEach(function (q) { imp.push({ c: b.a, a: b.b, b: p.to, d: q.to }); }); });
    });
    // break planarity so sp3 centres can pucker out of the sketch plane
    for (var z = 0; z < n; z++) { var r = Math.sin((z + 1) * 12.9898) * 43758.5453; coords[z].z += ((r - Math.floor(r)) - 0.5) * 1.6; }

    function energyGrad(C) {
      var g = new Float64Array(n * 3); var E = 0;
      for (var t = 0; t < restr.length; t++) {
        var R = restr[t], A = C[R.i], B = C[R.j];
        var dx = A.x - B.x, dy = A.y - B.y, dz = A.z - B.z;
        var r = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
        var diff = r - R.d0, f = R.k * diff / r; E += 0.5 * R.k * diff * diff;
        g[3 * R.i] += f * dx; g[3 * R.i + 1] += f * dy; g[3 * R.i + 2] += f * dz;
        g[3 * R.j] -= f * dx; g[3 * R.j + 1] -= f * dy; g[3 * R.j + 2] -= f * dz;
      }
      for (var u = 0; u < nb.length; u++) {
        var P = nb[u], a2 = C[P.i], b2 = C[P.j];
        var ddx = a2.x - b2.x, ddy = a2.y - b2.y, ddz = a2.z - b2.z;
        var rr = Math.sqrt(ddx * ddx + ddy * ddy + ddz * ddz) || 1e-6;
        if (rr >= P.s) continue;
        var df = rr - P.s, kf = 0.5, ff = kf * df / rr; E += 0.5 * kf * df * df;
        g[3 * P.i] += ff * ddx; g[3 * P.i + 1] += ff * ddy; g[3 * P.i + 2] += ff * ddz;
        g[3 * P.j] -= ff * ddx; g[3 * P.j + 1] -= ff * ddy; g[3 * P.j + 2] -= ff * ddz;
      }
      // improper: penalise tetrahedron volume of (centre, n1, n2, n3) → 0 = planar
      var kp = 1.4;
      for (var v = 0; v < imp.length; v++) {
        var I = imp[v], O = C[I.c], N1 = C[I.a], N2 = C[I.b], N3 = C[I.d];
        var ax = N1.x - O.x, ay = N1.y - O.y, az = N1.z - O.z;
        var bx = N2.x - O.x, by = N2.y - O.y, bz = N2.z - O.z;
        var cx2 = N3.x - O.x, cy2 = N3.y - O.y, cz2 = N3.z - O.z;
        // cross products
        var bc = [by * cz2 - bz * cy2, bz * cx2 - bx * cz2, bx * cy2 - by * cx2];
        var ca = [cy2 * az - cz2 * ay, cz2 * ax - cx2 * az, cx2 * ay - cy2 * ax];
        var ab = [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx];
        var vol = (ax * bc[0] + ay * bc[1] + az * bc[2]) / 6;
        E += 0.5 * kp * vol * vol;
        var kv = kp * vol / 6;
        g[3 * I.a] += kv * bc[0]; g[3 * I.a + 1] += kv * bc[1]; g[3 * I.a + 2] += kv * bc[2];
        g[3 * I.b] += kv * ca[0]; g[3 * I.b + 1] += kv * ca[1]; g[3 * I.b + 2] += kv * ca[2];
        g[3 * I.d] += kv * ab[0]; g[3 * I.d + 1] += kv * ab[1]; g[3 * I.d + 2] += kv * ab[2];
        g[3 * I.c] -= kv * (bc[0] + ca[0] + ab[0]); g[3 * I.c + 1] -= kv * (bc[1] + ca[1] + ab[1]); g[3 * I.c + 2] -= kv * (bc[2] + ca[2] + ab[2]);
      }
      return { E: E, g: g };
    }

    var lr = 0.02, cur = energyGrad(coords), maxIt = iters || 900;
    for (var it = 0; it < maxIt; it++) {
      // clamp step so a single iteration can't move an atom more than 0.25 Å
      var gmax = 0; for (var m = 0; m < cur.g.length; m++) { var av = Math.abs(cur.g[m]); if (av > gmax) gmax = av; }
      var step = lr; if (gmax * step > 0.25) step = 0.25 / (gmax || 1);
      var trial = coords.map(function (c, idx) { return { el: c.el, x: c.x - step * cur.g[3 * idx], y: c.y - step * cur.g[3 * idx + 1], z: c.z - step * cur.g[3 * idx + 2] }; });
      var next = energyGrad(trial);
      if (next.E < cur.E) {
        for (var w = 0; w < n; w++) { coords[w].x = trial[w].x; coords[w].y = trial[w].y; coords[w].z = trial[w].z; }
        cur = next; lr = Math.min(lr * 1.2, 0.08);
        if (cur.E < 1e-5) break;
      } else { lr *= 0.5; if (lr < 1e-5) break; }
    }
  }

  function to3D(atoms, bonds, doRelax) {
    if (!atoms.length) return null;
    var g = embed(atoms, bonds);
    if (doRelax) relax(g.coords, g.bonds);
    return molBlock(g.coords, g.bonds);
  }
  function norm2(x, y) { var l = Math.hypot(x, y) || 1; return [x / l, y / l]; }

  // ---- SMILES export (Kekulé, organic subset) ----
  function toSMILES(atoms, bonds) {
    if (!atoms.length) return '';
    var n = atoms.length, adj = []; for (var i = 0; i < n; i++) adj.push([]);
    bonds.forEach(function (b) { adj[b.a].push({ to: b.b, order: b.order }); adj[b.b].push({ to: b.a, order: b.order }); });
    var visited = [], ringNo = {}, nextRing = 1, parentEdge = {};
    var order = {};
    // assign ring-closure pairs via DFS detecting back-edges
    var seen = []; var rings = [];
    function dfsRings(u, parent) {
      seen[u] = 1; visited.push(u);
      adj[u].forEach(function (e) {
        if (e.to === parent && !parentEdge[u + '_' + e.to]) { parentEdge[u + '_' + e.to] = parentEdge[e.to + '_' + u] = 1; return; }
        if (seen[e.to] === 1 && !ringClosed(u, e.to)) { var r = nextRing++; rings.push([u, e.to, r, e.order]); markClosed(u, e.to); }
        else if (!seen[e.to]) dfsRings(e.to, u);
      });
    }
    var closedSet = {};
    function ringClosed(a, b) { return closedSet[a + '_' + b]; }
    function markClosed(a, b) { closedSet[a + '_' + b] = closedSet[b + '_' + a] = 1; }
    // pick start = atom 0
    for (var s = 0; s < n; s++) if (!seen[s]) dfsRings(s, -1);
    // map ring digits per atom
    var ringDigits = {}; rings.forEach(function (r) { (ringDigits[r[0]] = ringDigits[r[0]] || []).push([r[2], r[3]]); (ringDigits[r[1]] = ringDigits[r[1]] || []).push([r[2], r[3]]); });
    var bsym = { 1: '', 2: '=', 3: '#' };
    var out = [], wrote = [];
    function atomStr(i) { var el = atoms[i].el; return ORGANIC[el] ? el : '[' + el + ']'; }
    function write(u, parent, inOrder) {
      wrote[u] = 1;
      out.push((inOrder ? bsym[inOrder] : '') + atomStr(u));
      (ringDigits[u] || []).forEach(function (rd) { out.push((rd[1] > 1 ? bsym[rd[1]] : '') + (rd[0] < 10 ? rd[0] : '%' + rd[0])); });
      var kids = adj[u].filter(function (e) { return e.to !== parent && !wrote[e.to] && !isRingEdge(u, e.to); });
      kids.forEach(function (e, idx) {
        var last = idx === kids.length - 1;
        if (!last) out.push('(');
        write(e.to, u, e.order);
        if (!last) out.push(')');
      });
    }
    function isRingEdge(a, b) { return rings.some(function (r) { return (r[0] === a && r[1] === b) || (r[0] === b && r[1] === a); }); }
    var startWrote = [];
    for (var st = 0; st < n; st++) if (!wrote[st]) { if (out.length) out.push('.'); write(st, -1, 0); }
    return out.join('');
  }

  window.BUILDER_CHEM = {
    implicitH: implicitH, valenceErrors: valenceErrors, neighbors: neighbors, bondSum: bondSum,
    formula: formula, molWeight: molWeight, to3D: to3D, toSMILES: toSMILES
  };
})();
