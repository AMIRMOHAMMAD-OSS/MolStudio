/* builder.jsx — 2D molecule sketcher with skeletal (publication-style) rendering.
   Draw / move / erase, bond orders, element palette + periodic table, templates.
   Emits a 3D structure (XYZ) to the viewer. */
const { useState: bS, useRef: bR, useEffect: bE, useMemo: bMemo } = React;

const BL = 46;                  // bond length in canvas units
const SNAP = 30;                // angle snap (deg)
function bd() { return window.BUILDER_DATA; }
function bc() { return window.BUILDER_CHEM; }

function fmtMass(m) {
  if (!m) return '';
  if (m >= 100) return String(Math.round(m));
  if (m >= 10) return m.toFixed(2);
  return m.toFixed(3);
}
const PT_GROUPS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];

function PeriodicTable({ onPick, onClose }) {
  const D = bd();
  const { GRID, ELEMENTS, NAMES, CATEGORY, CAT_META, CAT_FILL } = D;
  const main = GRID.slice(0, 7);          // periods 1–7
  const lan = GRID[8], act = GRID[9];     // f-block rows

  function cell(sym, gridRow, gridColumn, key) {
    if (!sym) return null;
    const e = ELEMENTS[sym];
    const cat = CATEGORY[sym] || 'post';
    const fill = CAT_FILL[cat] || '#e4e4ea';
    return (
      <button key={key} className="pt-cell" data-cat={cat}
        style={{ gridRow, gridColumn, '--fill': fill }}
        title={(e ? '#' + e.z + '  ' : '') + (NAMES[e ? e.z : 0] || sym) + (e && e.mass ? '  ·  ' + e.mass : '')}
        onClick={() => { onPick(sym); onClose(); }}>
        <span className="pt-n">{e ? e.z : ''}</span>
        <span className="pt-sym">{sym}</span>
        <span className="pt-mass">{e ? fmtMass(e.mass) : ''}</span>
      </button>
    );
  }

  return (
    <div className="modal-veil" onClick={onClose}>
      <div className="pt-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h3>Periodic table</h3>
            <p className="pt-sub">Click an element to draw with it</p>
          </div>
          <button className="close-x" onClick={onClose}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
        </div>

        <div className="pt-grid">
          {/* group-number header */}
          {PT_GROUPS.map((g, i) => (
            <div key={'g' + g} className="pt-grouphead" style={{ gridRow: 1, gridColumn: i + 2 }}>{g}</div>
          ))}
          {/* period labels + main blocks */}
          {main.map((r, ri) => (
            <React.Fragment key={'p' + ri}>
              <div className="pt-periodhead" style={{ gridRow: ri + 2, gridColumn: 1 }}>{ri + 1}</div>
              {r.map((sym, ci) => cell(sym, ri + 2, ci + 2, ri + '-' + ci))}
            </React.Fragment>
          ))}
          {/* f-block, offset below with a gap */}
          <div className="pt-fnote" style={{ gridRow: 10, gridColumn: '2 / 4' }}>57–71</div>
          <div className="pt-fnote" style={{ gridRow: 11, gridColumn: '2 / 4' }}>89–103</div>
          {lan.map((sym, ci) => cell(sym, 10, ci + 2, 'l-' + ci))}
          {act.map((sym, ci) => cell(sym, 11, ci + 2, 'a-' + ci))}
        </div>

        <div className="pt-legend">
          {CAT_META.map(m => (
            <div key={m.key} className="pt-leg"><span className="sw" style={{ background: m.fill }}></span>{m.label}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Builder({ onSend, onClose }) {
  const [atoms, setAtoms] = bS([]);
  const [bonds, setBonds] = bS([]);
  const [mode, setMode] = bS('draw');     // draw | move | erase
  const [el, setEl] = bS('C');
  const [order, setOrder] = bS(1);
  const [tpl, setTpl] = bS(null);          // {kind:'ring'|'group', key}
  const [showPT, setShowPT] = bS(false);
  const [relax, setRelax] = bS(true);
  const [drag, setDrag] = bS(null);
  const [hist, setHist] = bS([]);
  const [redo, setRedo] = bS([]);
  const svgRef = bR(null);
  const D = bd(), C = bc();

  function snapshot() { setHist(h => h.concat([{ atoms: atoms, bonds: bonds }]).slice(-40)); setRedo([]); }
  function undo() { setHist(h => { if (!h.length) return h; const last = h[h.length - 1]; setRedo(r => r.concat([{ atoms, bonds }])); setAtoms(last.atoms); setBonds(last.bonds); return h.slice(0, -1); }); }
  function redoFn() { setRedo(r => { if (!r.length) return r; const last = r[r.length - 1]; setHist(h => h.concat([{ atoms, bonds }])); setAtoms(last.atoms); setBonds(last.bonds); return r.slice(0, -1); }); }
  function clearAll() { snapshot(); setAtoms([]); setBonds([]); }

  bE(() => {
    function key(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
      else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); redoFn(); }
    }
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  });

  function toSvg(e) {
    const svg = svgRef.current; const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse()); return { x: p.x, y: p.y };
  }
  function atomAt(p, exclude) {
    let best = -1, bd2 = 22 * 22;
    atoms.forEach((a, i) => { if (i === exclude) return; const d = (a.x - p.x) * (a.x - p.x) + (a.y - p.y) * (a.y - p.y); if (d < bd2) { bd2 = d; best = i; } });
    return best;
  }
  function bondAt(p) {
    let best = -1, bd2 = 10 * 10;
    bonds.forEach((b, i) => { const A = atoms[b.a], B = atoms[b.b]; const d = ptSeg(p, A, B); if (d < bd2) { bd2 = d; best = i; } });
    return best;
  }
  function growAngle(i) {
    const ns = C.neighbors(i, bonds).map(j => Math.atan2(atoms[j].y - atoms[i].y, atoms[j].x - atoms[i].x));
    if (!ns.length) return -30 * Math.PI / 180;
    if (ns.length === 1) return ns[0] + 120 * Math.PI / 180;
    let ax = 0, ay = 0; ns.forEach(a => { ax += Math.cos(a); ay += Math.sin(a); });
    return Math.atan2(-ay, -ax);
  }
  function snapPos(from, p) {
    let ang = Math.atan2(p.y - atoms[from].y, p.x - atoms[from].x);
    ang = Math.round(ang / (SNAP * Math.PI / 180)) * (SNAP * Math.PI / 180);
    return { x: atoms[from].x + Math.cos(ang) * BL, y: atoms[from].y + Math.sin(ang) * BL };
  }
  function addBond(na, a, b, ord) {
    const ex = na ? null : bonds.find(x => (x.a === a && x.b === b) || (x.a === b && x.b === a));
    if (ex) { setBonds(bs => bs.map(x => x === ex ? { a: x.a, b: x.b, order: ord } : x)); }
    else setBonds(bs => bs.concat([{ a, b, order: ord }]));
  }

  function onDown(e) {
    e.preventDefault();
    const p = toSvg(e), hitA = atomAt(p), hitB = hitA < 0 ? bondAt(p) : -1;
    if (tpl) { snapshot(); stamp(tpl, p, hitA); return; }
    if (mode === 'erase') { if (hitA >= 0) deleteAtom(hitA); else if (hitB >= 0) { snapshot(); setBonds(bs => bs.filter((_, i) => i !== hitB)); } return; }
    if (mode === 'move') { if (hitA >= 0) setDrag({ type: 'move', i: hitA }); return; }
    // draw
    if (hitA >= 0) { setDrag({ type: 'bond', from: hitA, down: p, cur: p }); }
    else if (hitB >= 0) { snapshot(); setBonds(bs => bs.map((x, i) => i === hitB ? { a: x.a, b: x.b, order: order } : x)); }
    else { setDrag({ type: 'place', down: p }); }
  }
  function onMove(e) {
    if (!drag) return; const p = toSvg(e);
    if (drag.type === 'move') { setAtoms(as => as.map((a, i) => i === drag.i ? { el: a.el, x: p.x, y: p.y } : a)); }
    else if (drag.type === 'bond') { setDrag(d => ({ ...d, cur: p, target: atomAt(p, d.from) })); }
  }
  function onUp(e) {
    if (!drag) return; const p = toSvg(e);
    if (drag.type === 'place') { snapshot(); setAtoms(as => as.concat([{ el, x: drag.down.x, y: drag.down.y }])); }
    else if (drag.type === 'bond') {
      const moved = Math.hypot(p.x - drag.down.x, p.y - drag.down.y) > 7;
      const target = atomAt(p, drag.from);
      if (!moved) {
        snapshot();
        if (atoms[drag.from].el !== el) setAtoms(as => as.map((a, i) => i === drag.from ? { el, x: a.x, y: a.y } : a));
        else { const ang = growAngle(drag.from); const np = { el, x: atoms[drag.from].x + Math.cos(ang) * BL, y: atoms[drag.from].y + Math.sin(ang) * BL }; const ni = atoms.length; setAtoms(as => as.concat([np])); setBonds(bs => bs.concat([{ a: drag.from, b: ni, order }])); }
      } else if (target >= 0 && target !== drag.from) { snapshot(); addBond(false, drag.from, target, order); }
      else { snapshot(); const np = snapPos(drag.from, p); const ni = atoms.length; setAtoms(as => as.concat([{ el, x: np.x, y: np.y }])); setBonds(bs => bs.concat([{ a: drag.from, b: ni, order }])); }
    }
    setDrag(null);
  }
  function deleteAtom(i) {
    snapshot();
    setBonds(bs => bs.filter(b => b.a !== i && b.b !== i).map(b => ({ a: b.a > i ? b.a - 1 : b.a, b: b.b > i ? b.b - 1 : b.b, order: b.order })));
    setAtoms(as => as.filter((_, k) => k !== i));
  }
  function stamp(t, p, hitA) {
    let frag = t.kind === 'ring' ? D.TEMPLATES[t.key].build() : D.GROUPS[t.key];
    let fa = frag.atoms.map(a => ({ el: a.el, x: a.x, y: a.y }));
    let fb = (frag.bonds || []).map(b => Array.isArray(b) ? { a: b[0], b: b[1], order: b[2] } : { a: b.a, b: b.b, order: b.order });
    const base = atoms.length;
    if (t.kind === 'group' && hitA >= 0) {
      // attach group to the clicked atom along a free direction
      const ang = growAngle(hitA);
      fa = fa.map(a => ({ el: a.el, x: atoms[hitA].x + (a.x * Math.cos(ang) - a.y * Math.sin(ang)) * BL, y: atoms[hitA].y + (a.x * Math.sin(ang) + a.y * Math.cos(ang)) * BL }));
      setAtoms(as => as.concat(fa));
      setBonds(bs => bs.concat([{ a: hitA, b: base, order: frag.order || 1 }]).concat(fb.map(b => ({ a: b.a + base, b: b.b + base, order: b.order }))));
    } else {
      fa = fa.map(a => ({ el: a.el, x: p.x + a.x * BL, y: p.y + a.y * BL }));
      setAtoms(as => as.concat(fa));
      setBonds(bs => bs.concat(fb.map(b => ({ a: b.a + base, b: b.b + base, order: b.order }))));
    }
    setTpl(null);
  }

  const errors = bMemo(() => new Set(C.valenceErrors(atoms, bonds)), [atoms, bonds]);
  const formula = C.formula(atoms, bonds);
  const mw = C.molWeight(atoms, bonds);
  const smiles = bMemo(() => { try { return C.toSMILES(atoms, bonds); } catch (e) { return ''; } }, [atoms, bonds]);
  const centroid = bMemo(() => { if (!atoms.length) return { x: 500, y: 350 }; let x = 0, y = 0; atoms.forEach(a => { x += a.x; y += a.y; }); return { x: x / atoms.length, y: y / atoms.length }; }, [atoms]);

  function send() { const xyz = C.to3D(atoms, bonds, relax); if (xyz) onSend(xyz, formula); }

  return (
    <div className="builder">
      <BuilderPalette el={el} setEl={setEl} mode={mode} setMode={setMode} order={order} setOrder={setOrder}
        tpl={tpl} setTpl={setTpl} openPT={() => setShowPT(true)} onUndo={undo} onRedo={redoFn} onClear={clearAll}
        canUndo={hist.length > 0} canRedo={redo.length > 0} />
      <div className="builder-stage">
        <svg ref={svgRef} className="sketch" viewBox="0 0 1000 700" preserveAspectRatio="xMidYMid meet"
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}>
          <SketchRender atoms={atoms} bonds={bonds} errors={errors} centroid={centroid} chem={C} />
          {drag && drag.type === 'bond' && <PreviewBond from={atoms[drag.from]} cur={drag.cur} target={drag.target != null && drag.target >= 0 ? atoms[drag.target] : null} />}
        </svg>
        {!atoms.length && <div className="sketch-hint">Click to place an atom · drag from an atom to grow a bond · tap an atom to change its element</div>}
      </div>
      <BuilderInspector formula={formula} mw={mw} smiles={smiles} nErr={errors.size} onSend={send} onClose={onClose} atomCount={atoms.length} relax={relax} setRelax={setRelax} />
      {showPT && <PeriodicTable onPick={setEl} onClose={() => setShowPT(false)} />}
    </div>
  );
}

function PreviewBond({ from, cur, target }) {
  const to = target || cur;
  return <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={target ? '#2563eb' : '#9aa6b8'} strokeWidth="2" strokeDasharray={target ? '' : '5 4'} />;
}

// ---- skeletal rendering ----
function SketchRender({ atoms, bonds, errors, centroid, chem }) {
  function labeled(i) { const a = atoms[i]; if (a.el !== 'C') return true; return chem.bondSum(i, bonds) === 0; }
  function trim(p, q, qi) { if (!labeled(qi)) return q; const d = Math.hypot(q.x - p.x, q.y - p.y) || 1; const t = 13 / d; return { x: q.x - (q.x - p.x) * t, y: q.y - (q.y - p.y) * t }; }
  return (
    <g>
      {bonds.map((b, i) => {
        const A = atoms[b.a], B = atoms[b.b];
        const a = trim(B, A, b.a), c = trim(A, B, b.b);
        const dx = c.x - a.x, dy = c.y - a.y, len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len, ny = dx / len;                        // perpendicular
        // offset double/triple toward centroid
        const mx = (a.x + c.x) / 2, my = (a.y + c.y) / 2;
        const side = ((centroid.x - mx) * nx + (centroid.y - my) * ny) >= 0 ? 1 : -1;
        const o = 4.5;
        if (b.order === 1) return <line key={i} x1={a.x} y1={a.y} x2={c.x} y2={c.y} className="bond" />;
        if (b.order === 2) return <g key={i}>
          <line x1={a.x} y1={a.y} x2={c.x} y2={c.y} className="bond" />
          <line x1={a.x + nx * o * side + dx * 0.12} y1={a.y + ny * o * side + dy * 0.12} x2={c.x + nx * o * side - dx * 0.12} y2={c.y + ny * o * side - dy * 0.12} className="bond" />
        </g>;
        return <g key={i}>
          <line x1={a.x} y1={a.y} x2={c.x} y2={c.y} className="bond" />
          <line x1={a.x + nx * o} y1={a.y + ny * o} x2={c.x + nx * o} y2={c.y + ny * o} className="bond" />
          <line x1={a.x - nx * o} y1={a.y - ny * o} x2={c.x - nx * o} y2={c.y - ny * o} className="bond" />
        </g>;
      })}
      {atoms.map((a, i) => {
        if (!labeled(i)) return errors.has(i) ? <circle key={i} cx={a.x} cy={a.y} r="11" className="atom-err" /> : null;
        const nH = chem.implicitH(i, atoms, bonds);
        const col = bd().ELEMENTS[a.el] ? bd().ELEMENTS[a.el].col : '#909090';
        const dark = ['#ffffff', '#fbfbfb', '#f0c8a0', '#ffff30', '#c2ff00'].indexOf(col) >= 0;
        return (
          <g key={i}>
            {errors.has(i) && <circle cx={a.x} cy={a.y} r="14" className="atom-err" />}
            <text x={a.x} y={a.y} className="atom-label" textAnchor="middle" dominantBaseline="central"
              style={{ fill: a.el === 'C' ? '#1a1a1a' : col, stroke: '#fff' }}>
              {a.el}{nH > 0 ? 'H' : ''}{nH > 1 ? sub2(nH) : ''}
            </text>
          </g>
        );
      })}
    </g>
  );
}
function sub2(n) { const S = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉' }; return String(n).replace(/\d/g, d => S[d]); }
function ptSeg(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy || 1;
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2; t = Math.max(0, Math.min(1, t));
  const cx = a.x + t * dx, cy = a.y + t * dy; return (p.x - cx) * (p.x - cx) + (p.y - cy) * (p.y - cy);
}

window.Builder = Builder;
