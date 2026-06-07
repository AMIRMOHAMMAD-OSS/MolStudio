/* panels.jsx — left library + right control panels + load modal */
const { useState: useStateP } = React;

function Section({ title, children, defaultOpen = true, right }) {
  const [open, setOpen] = useStateP(defaultOpen);
  return (
    <div className="sec">
      <div className="sec-head" onClick={() => setOpen(o => !o)}>
        <h3>{title}</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {right}
          <svg className={'chev' + (open ? ' open' : '')} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 6l6 6-6 6" /></svg>
        </div>
      </div>
      {open && <div className="sec-body">{children}</div>}
    </div>
  );
}

function Library({ current, onPick, onLoadCustom, extra }) {
  const [q, setQ] = useStateP('');
  const all = [];
  (extra || []).forEach(m => all.push(Object.assign({ remote: !!(m.pdb || m.cid) }, m)));
  Object.keys(MOLECULES.LOCAL).forEach(k => all.push(Object.assign({ key: k, remote: false }, MOLECULES.LOCAL[k])));
  Object.keys(MOLECULES.REMOTE).forEach(k => all.push(Object.assign({ key: k, remote: true }, MOLECULES.REMOTE[k])));
  const filtered = all.filter(m => (m.name + ' ' + m.formula + ' ' + m.cat).toLowerCase().includes(q.toLowerCase()));
  const cats = [];
  filtered.forEach(m => { if (!cats.includes(m.cat)) cats.push(m.cat); });

  return (
    <div className="panel left">
      <div style={{ padding: '12px 14px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)' }}>Library</span>
      </div>
      <div className="lib-search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></svg>
        <input placeholder="Search molecules…" value={q} onChange={e => setQ(e.target.value)} />
      </div>
      {cats.map(cat => (
        <div key={cat}>
          <div className="cat-label">{cat}</div>
          {filtered.filter(m => m.cat === cat).map(m => (
            <div key={m.key} className={'mol-item' + (current === m.key ? ' active' : '')} onClick={() => onPick(m)}>
              <div className="mol-thumb">{m.formula.replace(/[₀-₉]/g, '').slice(0, 4) || '•'}</div>
              <div className="mol-meta">
                <div className="mol-name">{m.name}</div>
                <div className="mol-formula">{m.formula}</div>
              </div>
              {m.remote && <span className="tag-remote">{m.pdb || 'PubChem'}</span>}
            </div>
          ))}
        </div>
      ))}
      <div style={{ padding: '14px' }}>
        <button className="btn" style={{ width: '100%', justifyContent: 'center' }} onClick={onLoadCustom}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
          Load your own
        </button>
      </div>
    </div>
  );
}

function Chip({ active, onClick, children, dot }) {
  return <button className={'chip' + (active ? ' active' : '')} onClick={onClick}>{dot && <span className="dot" style={{ background: dot }}></span>}{children}</button>;
}

function Slider({ label, value, min, max, step, fmt, onChange }) {
  return (
    <div className="field">
      <div className="row-between"><label style={{ margin: 0 }}>{label}</label><span className="val">{fmt ? fmt(value) : value}</span></div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(parseFloat(e.target.value))} />
    </div>
  );
}

function Toggle({ label, on, onChange }) {
  return (
    <div className="toggle" onClick={() => onChange(!on)}>
      <span className="lbl">{label}</span>
      <div className={'sw' + (on ? ' on' : '')}></div>
    </div>
  );
}

const SINGLE_SWATCHES = ['#7aa2e3', '#bcdcff', '#ff7a90', '#7ad6a8', '#f5c265', '#c9a3f0', '#e8e8e8', '#2b3a55'];

function templatePreview(t) {
  const bg = PRESETS.BACKGROUNDS.find(b => b.key === t.style.bg);
  const pal = PRESETS.PALETTES[t.style.palette];
  return (
    <div className="pic" style={{ background: bg.color }}>
      <svg width="46" height="40" viewBox="0 0 46 40">
        <line x1="14" y1="20" x2="32" y2="13" stroke={t.style.rep === 'line' ? (t.style.single || pal.swatch[0]) : '#888'} strokeWidth={t.style.rep === 'line' ? 1.4 : 2.4} />
        <line x1="14" y1="20" x2="30" y2="30" stroke={t.style.rep === 'line' ? (t.style.single || pal.swatch[0]) : '#888'} strokeWidth={t.style.rep === 'line' ? 1.4 : 2.4} />
        {t.style.rep !== 'line' && t.style.rep !== 'cartoon' && <>
          <circle cx="14" cy="20" r={t.style.rep === 'sphere' ? 9 : 5} fill={pal.swatch[0]} stroke={t.style.outline ? '#000' : 'none'} strokeWidth="0.8" />
          <circle cx="32" cy="13" r={t.style.rep === 'sphere' ? 8 : 4.5} fill={pal.swatch[2]} stroke={t.style.outline ? '#000' : 'none'} strokeWidth="0.8" />
          <circle cx="30" cy="30" r={t.style.rep === 'sphere' ? 7 : 4} fill={pal.swatch[3]} stroke={t.style.outline ? '#000' : 'none'} strokeWidth="0.8" />
        </>}
        {t.style.rep === 'cartoon' && <path d="M8 28 Q18 8 26 22 T40 14" fill="none" stroke={pal.swatch[3]} strokeWidth="4" strokeLinecap="round" />}
      </svg>
    </div>
  );
}

function StyleControls({ st, set, applyTemplate, activeTemplate, onExport, exportScale, setExportScale, molMeta }) {
  return (
    <React.Fragment>
      <Section title="Templates">
        <div className="tpl-grid">
          {PRESETS.TEMPLATES.map(t => (
            <div key={t.key} className={'tpl' + (activeTemplate === t.key ? ' active' : '')} onClick={() => applyTemplate(t)}>
              {templatePreview(t)}
              <div className="meta"><div className="nm">{t.name}</div><div className="hn">{t.hint}</div></div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Representation">
        <div className="grid2">
          {PRESETS.REPS.map(r => <Chip key={r.key} active={st.rep === r.key} onClick={() => set({ rep: r.key })}>{r.label}</Chip>)}
        </div>
      </Section>

      <Section title="Coloring">
        <div className="field">
          <div className="grid2">
            {PRESETS.COLOR_MODES.map(c => <Chip key={c.key} active={st.colorMode === c.key} onClick={() => set({ colorMode: c.key })}>{c.label}</Chip>)}
          </div>
        </div>
        {(st.colorMode === 'element' || st.colorMode === 'carbon') && (
          <div className="field">
            <label>Palette</label>
            <div className="grid2">
              {Object.keys(PRESETS.PALETTES).map(p => (
                <Chip key={p} active={st.palette === p} onClick={() => set({ palette: p })}>
                  <span className="swatches">{PRESETS.PALETTES[p].swatch.slice(0, 4).map((s, i) => <i key={i} style={{ background: s }}></i>)}</span>
                </Chip>
              ))}
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>{PRESETS.PALETTES[st.palette].label}</div>
          </div>
        )}
        {st.colorMode === 'single' && (
          <div className="field">
            <label>Color</label>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
              {SINGLE_SWATCHES.map(c => (
                <div key={c} onClick={() => set({ single: c })} style={{ width: 26, height: 26, borderRadius: 7, background: c, cursor: 'pointer', border: st.single === c ? '2px solid var(--accent)' : '1px solid var(--border-strong)', boxShadow: st.single === c ? '0 0 0 2px var(--accent-soft)' : 'none' }}></div>
              ))}
              <input type="color" value={st.single} onChange={e => set({ single: e.target.value })} style={{ width: 26, height: 26, border: '1px solid var(--border-strong)', borderRadius: 7, padding: 0, background: 'none', cursor: 'pointer' }} />
            </div>
          </div>
        )}
      </Section>

      <Section title="Background">
        <div className="bg-grid">
          {PRESETS.BACKGROUNDS.map(b => {
            const dark = ['slate', 'navy', 'blueprint', 'black'].includes(b.key);
            return (
              <div key={b.key} className={'bg-cell' + (dark ? ' dark' : '') + (b.key === 'clear' ? ' clear' : '') + (st.bg === b.key ? ' active' : '')}
                style={b.key === 'clear' ? {} : { background: b.color }} onClick={() => set({ bg: b.key })}>
                <span className="lbl">{b.label}</span>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Geometry & detail">
        {(st.rep === 'ballstick' || st.rep === 'sphere') && <Slider label="Atom size" value={st.atomScale} min={0.2} max={1.4} step={0.02} fmt={v => v.toFixed(2)} onChange={v => set({ atomScale: v })} />}
        {(st.rep === 'ballstick' || st.rep === 'stick' || st.rep === 'surface') && <Slider label="Bond radius" value={st.bondRadius} min={0.05} max={0.4} step={0.01} fmt={v => v.toFixed(2) + ' Å'} onChange={v => set({ bondRadius: v })} />}
        {st.rep === 'surface' && <Slider label="Surface opacity" value={st.surfaceOpacity} min={0.2} max={1} step={0.05} fmt={v => Math.round(v * 100) + '%'} onChange={v => set({ surfaceOpacity: v })} />}
        <Toggle label="Show hydrogens" on={st.showH} onChange={v => set({ showH: v })} />
        <Toggle label="Atom labels" on={st.showLabels} onChange={v => set({ showLabels: v })} />
        <Toggle label="Cartoon outline" on={st.outline} onChange={v => set({ outline: v })} />
        <Toggle label="Auto-spin" on={st.spin} onChange={v => set({ spin: v })} />
      </Section>

      <Section title="Export figure">
        <div className="field">
          <label>Resolution</label>
          <div className="seg" style={{ width: '100%' }}>
            {[1, 2, 4].map(s => <button key={s} className={exportScale === s ? 'active' : ''} style={{ flex: 1, justifyContent: 'center' }} onClick={() => setExportScale(s)}>{s}×</button>)}
          </div>
        </div>
        <button className="btn primary" style={{ width: '100%', justifyContent: 'center' }} onClick={onExport}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v12M7 10l5 5 5-5M5 21h14" /></svg>
          Download PNG
        </button>
        <p className="export-note">Exports the current view with your background ({PRESETS.BACKGROUNDS.find(b => b.key === st.bg).label.toLowerCase()}) at {exportScale}× the viewport — transparent PNG if “Transparent” is selected.</p>
      </Section>
    </React.Fragment>
  );
}

/* ---------- Analyze panel ---------- */
const MEASURE_TYPES = [
  { key: 'distance', label: 'Distance', need: 2, unit: 'Å' },
  { key: 'angle', label: 'Angle', need: 3, unit: '°' },
  { key: 'dihedral', label: 'Torsion', need: 4, unit: '°' }
];
const TOOLS = [
  { key: 'orbit', label: 'Orbit' },
  { key: 'measure', label: 'Measure' },
  { key: 'twist', label: 'Twist bond' },
  { key: 'move', label: 'Move atom' },
  { key: 'chirality', label: 'Chirality' }
];

function ToolBtn({ active, onClick, children }) {
  return <button className={'chip' + (active ? ' active' : '')} style={{ justifyContent: 'center' }} onClick={onClick}>{children}</button>;
}

function Hint({ children }) { return <p className="empty-hint" style={{ margin: '2px 0 10px' }}>{children}</p>; }

function measureLabel(m, modelAtoms) {
  const byIdx = {}; modelAtoms.forEach(a => byIdx[a.index] = a);
  const pts = m.atoms.map(i => byIdx[i]);
  if (pts.some(p => !p)) return { els: '—', val: '—' };
  const els = pts.map(p => p.elem).join(m.type === 'distance' ? '–' : '–');
  let val;
  if (m.type === 'distance') val = Analyze.distance(pts[0], pts[1]).toFixed(3) + ' Å';
  else if (m.type === 'angle') val = Analyze.angle(pts[0], pts[1], pts[2]).toFixed(1) + '°';
  else val = Analyze.dihedral(pts[0], pts[1], pts[2], pts[3]).toFixed(1) + '°';
  return { els, val };
}

function AnalyzePanel(p) {
  const { tool, setTool, measureType, setMeasureType, picks, measurements, removeMeasurement, clearMeasurements,
    modelAtoms, twist, twistInfo, twistAngle, setTwistAngle, keepTwist, cancelTwist, stereocenters, atomCount,
    highlightColor, setHighlightColor, twistForce, toggleTwistForce, moveSel, nudgeStep, setNudgeStep, nudge, resetGeometry } = p;
  const HL_SWATCHES = ['#ffcc00', '#22d3ee', '#ff3bac', '#84cc16', '#ff5630', '#ffffff'];
  const mt = MEASURE_TYPES.find(t => t.key === measureType) || MEASURE_TYPES[0];
  return (
    <React.Fragment>
      <Section title="Tool">
        <div className="grid2">
          {TOOLS.map(t => <ToolBtn key={t.key} active={tool === t.key} onClick={() => setTool(t.key)}>{t.label}</ToolBtn>)}
        </div>
        {tool !== 'orbit' && tool !== 'chirality' && <div className="field" style={{ marginTop: 14, marginBottom: 0 }}>
          <label>Highlight color for selected atoms</label>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
            {HL_SWATCHES.map(c => (
              <div key={c} onClick={() => setHighlightColor(c)} title={c}
                style={{ width: 26, height: 26, borderRadius: 7, background: c, cursor: 'pointer',
                  border: highlightColor === c ? '2px solid var(--accent)' : '1px solid var(--border-strong)',
                  boxShadow: highlightColor === c ? '0 0 0 2px var(--accent-soft)' : 'none' }}></div>
            ))}
            <input type="color" value={highlightColor} onChange={e => setHighlightColor(e.target.value)}
              style={{ width: 26, height: 26, border: '1px solid var(--border-strong)', borderRadius: 7, padding: 0, background: 'none', cursor: 'pointer' }} />
          </div>
        </div>}
      </Section>

      {tool === 'orbit' && <Section title="Inspect"><Hint>Drag to rotate, scroll to zoom, right-drag to pan. Pick a tool above to measure geometry, move atoms, rotate bonds, or reveal stereocenters.</Hint></Section>}

      {tool === 'measure' && <Section title="Measure geometry">
        <div className="field">
          <div className="seg" style={{ width: '100%' }}>
            {MEASURE_TYPES.map(t => <button key={t.key} className={measureType === t.key ? 'active' : ''} style={{ flex: 1, justifyContent: 'center' }} onClick={() => setMeasureType(t.key)}>{t.label}</button>)}
          </div>
        </div>
        <div className="pick-progress">
          {Array.from({ length: mt.need }).map((_, i) => <span key={i} className={'pip' + (i < picks.length ? ' on' : '')}>{i + 1}</span>)}
          <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--muted)' }}>Click {mt.need} atoms{picks.length ? ` · ${picks.length}/${mt.need}` : ''}</span>
        </div>
        {measurements.length === 0 && <Hint>No measurements yet. Click atoms in the viewport — values appear here and as labels in 3D, updating live if you twist bonds.</Hint>}
        <div className="measure-list">
          {measurements.map(m => {
            const info = measureLabel(m, modelAtoms);
            const col = { distance: '#0f9d58', angle: '#f59e0b', dihedral: '#a855f7' }[m.type];
            return (
              <div key={m.id} className="measure-row">
                <span className="mtag" style={{ background: col }}>{m.type === 'distance' ? 'd' : m.type === 'angle' ? '∠' : 'τ'}</span>
                <span className="mels">{info.els}</span>
                <span className="mval">{info.val}</span>
                <button className="close-x" onClick={() => removeMeasurement(m.id)}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
              </div>
            );
          })}
        </div>
        {measurements.length > 0 && <button className="btn" style={{ width: '100%', justifyContent: 'center', marginTop: 10 }} onClick={clearMeasurements}>Clear all</button>}
      </Section>}

      {tool === 'twist' && <Section title="Rotate around bond">
        {!twist && <Hint>Click <b>two bonded atoms</b> to set the rotation axis. The smaller fragment rotates around the bond.</Hint>}
        <Toggle label="Force-rotate ring bonds (distort ring)" on={twistForce} onChange={toggleTwistForce} />
        {twist && twistInfo && twistInfo.ring && !twistInfo.ok && <div className="warn">That bond is part of a ring. Turn on <b>Force-rotate</b> above to twist it anyway (this intentionally distorts the ring).</div>}
        {twist && twistInfo && twistInfo.ok && <React.Fragment>
          {twistInfo.forced && <div className="warn">Ring bond — forced rotation will distort ring geometry. Use “Reset geometry” to undo.</div>}
          {twistInfo.doubleBond && <div className="warn">Heads up: this looks like a double bond — rotating it is geometrically possible here but not physically free.</div>}
          <Slider label="Rotation" value={twistAngle} min={-180} max={180} step={1} fmt={v => v.toFixed(0) + '°'} onChange={setTwistAngle} />
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <button className="btn primary" style={{ flex: 1, justifyContent: 'center' }} onClick={keepTwist}>Keep</button>
            <button className="btn" style={{ flex: 1, justifyContent: 'center' }} onClick={cancelTwist}>Cancel</button>
          </div>
          <Hint>{twistInfo.fragmentSize} atoms move. “Keep” bakes the new geometry — measurements and chirality update accordingly.</Hint>
        </React.Fragment>}
      </Section>}

      {tool === 'move' && <Section title="Move atom">
        {!moveSel && <Hint>Click an atom to select it, then <b>drag it freely</b> in the view plane — or nudge it precisely along X / Y / Z below. Bonds follow the atom live.</Hint>}
        {moveSel && <React.Fragment>
          <div className="sel-atom"><span className="sel-dot" style={{ background: highlightColor }}></span>Selected: <b>{moveSel.elem}</b> <span style={{ color: 'var(--muted)' }}>#{moveSel.index}</span></div>
          <div className="field" style={{ marginTop: 12 }}>
            <label>Nudge step</label>
            <div className="seg" style={{ width: '100%' }}>
              {[0.05, 0.1, 0.25, 0.5].map(s => <button key={s} className={Math.abs(nudgeStep - s) < 1e-6 ? 'active' : ''} style={{ flex: 1, justifyContent: 'center' }} onClick={() => setNudgeStep(s)}>{s} Å</button>)}
            </div>
          </div>
          {[['x', '#e8453c', 'X'], ['y', '#3cae4f', 'Y'], ['z', '#3b7fe0', 'Z']].map(ax => (
            <div key={ax[0]} className="nudge-row">
              <span className="nudge-axis" style={{ color: ax[1] }}>{ax[2]}</span>
              <button className="btn" onClick={() => nudge(ax[0], -nudgeStep)}>−</button>
              <button className="btn" onClick={() => nudge(ax[0], nudgeStep)}>+</button>
            </div>
          ))}
        </React.Fragment>}
        <button className="btn" style={{ width: '100%', justifyContent: 'center', marginTop: 14 }} onClick={resetGeometry}>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>
          Reset geometry
        </button>
      </Section>}

      {tool === 'chirality' && <Section title="Stereocenters (R / S)">
        {atomCount > 200 && <div className="warn">Structure too large for automatic stereo perception ({atomCount} atoms).</div>}
        {atomCount <= 200 && stereocenters.length === 0 && <Hint>No tetrahedral stereocenters detected on this structure.</Hint>}
        {stereocenters.map((c, i) => (
          <div key={i} className="stereo-row">
            <span className={'rs-badge ' + c.label}>{c.label}</span>
            <span style={{ fontSize: 12.5 }}>Center at atom #{c.index}</span>
          </div>
        ))}
        {stereocenters.length > 0 && <Hint>CIP priorities are assigned by a hierarchical atomic-number rule (handles common cases). Verify unusual centers against a reference.</Hint>}
      </Section>}
    </React.Fragment>
  );
}

Object.assign(window, { Section, Library, StyleControls, AnalyzePanel, Chip, Slider, Toggle });
