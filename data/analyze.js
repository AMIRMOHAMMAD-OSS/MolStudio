/* analyze.js — real molecular geometry & stereochemistry on live 3D coordinates.
   Operates on plain atom records: { index, elem, x, y, z, bonds:[idx], bondOrder:[n] }.
   No external deps. */
(function () {
  var Z = { H:1, He:2, Li:3, Be:4, B:5, C:6, N:7, O:8, F:9, Ne:10, Na:11, Mg:12, Al:13, Si:14,
    P:15, S:16, Cl:17, Ar:18, K:19, Ca:20, Fe:26, Cu:29, Zn:30, Br:35, I:53 };
  function zof(e) { if (!e) return 0; var s = e[0].toUpperCase() + (e[1] ? e[1].toLowerCase() : ''); return Z[s] || Z[e.toUpperCase()] || 0; }

  // ---- vector helpers ----
  function sub(a, b) { return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }; }
  function add(a, b) { return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }; }
  function scale(a, s) { return { x: a.x * s, y: a.y * s, z: a.z * s }; }
  function dot(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
  function cross(a, b) { return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x }; }
  function len(a) { return Math.sqrt(dot(a, a)); }
  function norm(a) { var l = len(a) || 1; return scale(a, 1 / l); }

  // ---- measurements ----
  function distance(a, b) { return len(sub(a, b)); }
  function angle(a, b, c) { // angle at b
    var u = norm(sub(a, b)), v = norm(sub(c, b));
    var d = Math.max(-1, Math.min(1, dot(u, v)));
    return Math.acos(d) * 180 / Math.PI;
  }
  function dihedral(a, b, c, d) {
    var b1 = sub(b, a), b2 = sub(c, b), b3 = sub(d, c);
    var n1 = cross(b1, b2), n2 = cross(b2, b3);
    var m1 = cross(n1, norm(b2));
    var x = dot(n1, n2), y = dot(m1, n2);
    return Math.atan2(y, x) * 180 / Math.PI;
  }

  // ---- connectivity ----
  function adjacency(atoms) {
    var adj = {};
    atoms.forEach(function (a) { adj[a.index] = (a.bonds || []).slice(); });
    return adj;
  }

  // fragment that moves when rotating bond i->j (the j side). null if i & j are in a ring.
  function rotatableFragment(atoms, i, j) {
    var byIdx = {}; atoms.forEach(function (a) { byIdx[a.index] = a; });
    var visited = {}; visited[j] = true;
    var queue = [j], ring = false;
    while (queue.length) {
      var u = queue.shift();
      var nbrs = (byIdx[u].bonds || []);
      for (var k = 0; k < nbrs.length; k++) {
        var n = nbrs[k];
        if (u === j && n === i) continue;   // skip the bond being rotated
        if (n === i) { ring = true; continue; }
        if (!visited[n]) { visited[n] = true; queue.push(n); }
      }
    }
    if (ring) return null;
    return Object.keys(visited).map(Number);
  }

  // j-side subtree reachable from j without traversing back through i (used for forced ring rotation)
  function sideTree(atoms, i, j) {
    var byIdx = {}; atoms.forEach(function (a) { byIdx[a.index] = a; });
    var visited = {}; visited[j] = true;
    var queue = [j];
    while (queue.length) {
      var u = queue.shift();
      var nbrs = (byIdx[u].bonds || []);
      for (var k = 0; k < nbrs.length; k++) {
        var n = nbrs[k];
        if (u === j && n === i) continue;
        if (n === i) continue;          // don't cross back to the anchor
        if (!visited[n]) { visited[n] = true; queue.push(n); }
      }
    }
    return Object.keys(visited).map(Number);
  }

  function bondOrderBetween(atoms, i, j) {
    var byIdx = {}; atoms.forEach(function (a) { byIdx[a.index] = a; });
    var a = byIdx[i]; if (!a || !a.bonds) return 1;
    var p = a.bonds.indexOf(j);
    return (p >= 0 && a.bondOrder) ? (a.bondOrder[p] || 1) : 1;
  }

  // Rodrigues rotation of point p around axis (through o, direction k unit) by ang(rad)
  function rotateAround(p, o, k, ang) {
    var v = sub(p, o);
    var c = Math.cos(ang), s = Math.sin(ang);
    var term1 = scale(v, c);
    var term2 = scale(cross(k, v), s);
    var term3 = scale(k, dot(k, v) * (1 - c));
    return add(o, add(add(term1, term2), term3));
  }

  // ---- CIP-style priority ranking (approximate) ----
  // Build a hierarchical digraph from `start` (excluding back-edge to `from`) and
  // return a comparable signature: arrays of atomic numbers per BFS sphere.
  function branchSignature(atoms, start, from, maxDepth) {
    var byIdx = {}; atoms.forEach(function (a) { byIdx[a.index] = a; });
    var spheres = [];
    var frontier = [{ node: start, parent: from }];
    var depth = 0;
    while (frontier.length && depth < maxDepth) {
      var zlist = [];
      var next = [];
      frontier.forEach(function (f) {
        var atom = byIdx[f.node];
        zlist.push(zof(atom.elem));
        var nbrs = atom.bonds || [];
        var orders = atom.bondOrder || [];
        for (var k = 0; k < nbrs.length; k++) {
          var n = nbrs[k];
          if (n === f.parent) continue;
          next.push({ node: n, parent: f.node });
          // duplicate atoms for multiple bonds (CIP convention, simplified)
          var ord = orders[k] || 1;
          for (var d = 1; d < ord; d++) next.push({ node: n, parent: f.node, phantom: true });
        }
      });
      zlist.sort(function (a, b) { return b - a; });
      spheres.push(zlist);
      frontier = next;
      depth++;
    }
    return spheres;
  }

  // compare two signatures, return >0 if A higher priority, <0 if B higher, 0 if tie
  function cmpSig(A, B) {
    var d = Math.max(A.length, B.length);
    for (var s = 0; s < d; s++) {
      var a = A[s] || [], b = B[s] || [];
      var m = Math.max(a.length, b.length);
      for (var i = 0; i < m; i++) {
        var av = a[i] || 0, bv = b[i] || 0;
        if (av !== bv) return av - bv;
      }
    }
    return 0;
  }

  // detect tetrahedral stereocenters & assign R/S. Returns [{index, label, neighbors, confident}]
  function stereocenters(atoms) {
    var byIdx = {}; atoms.forEach(function (a) { byIdx[a.index] = a; });
    var out = [];
    atoms.forEach(function (a) {
      if (zof(a.elem) !== 6) return;                 // carbon only (common case)
      var nbrs = (a.bonds || []).slice();
      if (nbrs.length !== 4) return;                 // need 4 substituents (incl. H)
      // rank neighbors by CIP-ish priority via branch signatures
      var ranked = nbrs.map(function (n) {
        return { idx: n, z: zof(byIdx[n].elem), sig: branchSignature(atoms, n, a.index, 6) };
      });
      // first by immediate atomic number, then by deep signature
      ranked.sort(function (p, q) {
        if (q.z !== p.z) return q.z - p.z;
        return -cmpSig(p.sig, q.sig);
      });
      // check all four are distinguishable
      var distinct = true;
      for (var i = 0; i < 3; i++) {
        var pz = ranked[i].z, qz = ranked[i + 1].z;
        if (pz === qz && cmpSig(ranked[i].sig, ranked[i + 1].sig) === 0) { distinct = false; break; }
      }
      if (!distinct) return;
      // p1>p2>p3>p4 ; view with p4 away → p1→p2→p3 clockwise = R
      var c = a;
      var p1 = byIdx[ranked[0].idx], p2 = byIdx[ranked[1].idx], p3 = byIdx[ranked[2].idx], p4 = byIdx[ranked[3].idx];
      // signed volume of (p1-p4, p2-p4, p3-p4)
      var v1 = sub(p1, p4), v2 = sub(p2, p4), v3 = sub(p3, p4);
      var vol = dot(v1, cross(v2, v3));
      // calibrated: vol < 0 → R, vol > 0 → S  (see RS_SIGN)
      var label = (RS_SIGN * vol < 0) ? 'R' : 'S';
      out.push({ index: a.index, label: label, neighbors: ranked.map(function (r) { return r.idx; }), pos: { x: c.x, y: c.y, z: c.z } });
    });
    return out;
  }

  var RS_SIGN = 1; // calibration multiplier

  window.Analyze = {
    zof: zof, distance: distance, angle: angle, dihedral: dihedral,
    adjacency: adjacency, rotatableFragment: rotatableFragment, sideTree: sideTree, bondOrderBetween: bondOrderBetween,
    rotateAround: rotateAround, norm: norm, sub: sub, add: add, cross: cross, dot: dot, len: len, scale: scale,
    stereocenters: stereocenters,
    setRSsign: function (s) { RS_SIGN = s; }
  };
})();
