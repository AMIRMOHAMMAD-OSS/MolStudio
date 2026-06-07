/* builder-ui.jsx — left palette (elements, modes, templates) and right inspector for the sketcher. */
const { useState: uiS } = React;

function BuilderPalette({ el, setEl, mode, setMode, order, setOrder, tpl, setTpl, openPT, onUndo, onRedo, onClear, canUndo, canRedo }) {
  const D = window.BUILDER_DATA;
  function pickEl(s) { setEl(s); setTpl(null); setMode('draw'); }
  return (
    <div className="bld-palette">
      <div className="bld-sec">
        <div className="bld-label">Tool</div>
        <div className="seg" style={{ width: '100%' }}>
          {[['draw', 'Draw'], ['move', 'Move'], ['erase', 'Erase']].map(m => (
            <button key={m[0]} className={mode === m[0] && !tpl ? 'active' : ''} style={{ flex: 1, justifyContent: 'center' }} onClick={() => { setMode(m[0]); setTpl(null); }}>{m[1]}</button>
          ))}
        </div>
      </div>

      <div className="bld-sec">
        <div className="bld-label">Bond</div>
        <div className="seg" style={{ width: '100%' }}>
          {[[1, '— single'], [2, '═ double'], [3, '≡ triple']].map(o => (
            <button key={o[0]} className={order === o[0] ? 'active' : ''} style={{ flex: 1, justifyContent: 'center' }} onClick={() => { setOrder(o[0]); setMode('draw'); setTpl(null); }}>{o[1]}</button>
          ))}
        </div>
      </div>

      <div className="bld-sec">
        <div className="bld-row"><div className="bld-label">Element</div><button className="bld-pt-btn" onClick={openPT}>Periodic table →</button></div>
        <div className="el-grid">
          {D.QUICK.map(s => (
            <button key={s} className={'el-btn' + (el === s && !tpl ? ' active' : '')} style={{ '--elc': D.ELEMENTS[s].col }} onClick={() => pickEl(s)}>{s}</button>
          ))}
          <button className={'el-btn cur' + (!D.QUICK.includes(el) && !tpl ? ' active' : '')} style={{ '--elc': (D.ELEMENTS[el] || {}).col }} onClick={openPT} title="Current element">{el}</button>
        </div>
      </div>

      <div className="bld-sec">
        <div className="bld-label">Rings</div>
        <div className="tpl-row">
          {Object.keys(D.TEMPLATES).map(k => (
            <button key={k} className={'tpl-btn' + (tpl && tpl.key === k ? ' active' : '')} onClick={() => setTpl({ kind: 'ring', key: k })} title={D.TEMPLATES[k].name}>
              <RingIcon k={k} />
            </button>
          ))}
        </div>
      </div>

      <div className="bld-sec">
        <div className="bld-label">Groups</div>
        <div className="grp-list">
          {Object.keys(D.GROUPS).map(k => (
            <button key={k} className={'grp-btn' + (tpl && tpl.key === k ? ' active' : '')} onClick={() => setTpl({ kind: 'group', key: k })}>{D.GROUPS[k].name}</button>
          ))}
        </div>
      </div>

      <div className="bld-sec bld-actions">
        <button className="btn" disabled={!canUndo} onClick={onUndo} title="Undo (⌘Z)"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 14L4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 0 10h-3" /></svg></button>
        <button className="btn" disabled={!canRedo} onClick={onRedo} title="Redo (⌘⇧Z)"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 14l5-5-5-5" /><path d="M20 9H9a5 5 0 0 0 0 10h3" /></svg></button>
        <button className="btn" style={{ flex: 1, justifyContent: 'center' }} onClick={onClear}>Clear</button>
      </div>
      {tpl && <div className="bld-tip">{tpl.kind === 'ring' ? 'Click the canvas to place the ring.' : 'Click an atom to attach the group.'}</div>}
    </div>
  );
}

function RingIcon({ k }) {
  const map = { benzene: [6, true], cyclohexane: [6, false], cyclopentane: [5, false], cyclopropane: [3, false], cyclobutane: [4, false], cycloheptane: [7, false], naphthalene: [0, false] };
  const [n, arom] = map[k] || [6, false];
  if (k === 'naphthalene') return <svg viewBox="-16 -12 32 24"><polygon points="-10,-6 -3,-6 0,0 -3,6 -10,6 -13,0" className="ri" /><polygon points="-3,-6 4,-6 7,0 4,6 -3,6 0,0" className="ri" /></svg>;
  const pts = []; for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + i * 2 * Math.PI / n; pts.push((9 * Math.cos(a)).toFixed(1) + ',' + (9 * Math.sin(a)).toFixed(1)); }
  return <svg viewBox="-12 -12 24 24"><polygon points={pts.join(' ')} className="ri" />{arom && <circle r="5" className="ri" fill="none" />}</svg>;
}

function BuilderInspector({ formula, mw, smiles, nErr, onSend, onClose, atomCount, relax, setRelax }) {
  const [copied, setCopied] = uiS(false);
  function copy() { try { navigator.clipboard.writeText(smiles); setCopied(true); setTimeout(() => setCopied(false), 1200); } catch (e) {} }
  return (
    <div className="bld-inspector">
      <div className="bld-isec">
        <div className="bld-label">Molecule</div>
        <div className="formula-big">{formula}</div>
        <div className="kv"><span className="k">Mol. weight</span><span className="v">{atomCount ? mw.toFixed(2) + ' g/mol' : '—'}</span></div>
        <div className="kv"><span className="k">Atoms (heavy)</span><span className="v">{atomCount}</span></div>
        <div className="kv"><span className="k">Valence</span><span className="v" style={{ color: nErr ? '#d4380d' : 'var(--good)' }}>{nErr ? nErr + ' issue' + (nErr > 1 ? 's' : '') : 'OK'}</span></div>
        {nErr > 0 && <div className="warn" style={{ marginTop: 8 }}>Atoms circled in red exceed their typical valence. Reduce a bond order or remove a bond.</div>}
      </div>

      <div className="bld-isec">
        <div className="bld-row"><div className="bld-label">SMILES</div>{smiles && <button className="bld-pt-btn" onClick={copy}>{copied ? 'Copied ✓' : 'Copy'}</button>}</div>
        <div className="smiles-box">{smiles || <span style={{ color: 'var(--muted)' }}>draw a molecule…</span>}</div>
      </div>

      <div className="bld-isec bld-send">
        <div className="toggle" style={{ marginBottom: 10, cursor: 'pointer' }} onClick={() => setRelax(!relax)}>
          <span style={{ fontSize: 12.5 }}>Relax to stable conformer</span>
          <span className={'sw' + (relax ? ' on' : '')}></span>
        </div>
        <button className="btn primary" style={{ width: '100%', justifyContent: 'center' }} disabled={!atomCount} onClick={onSend}>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          Send to 3D viewer
        </button>
        <p className="export-note">{relax
          ? 'Hydrogens are added and the geometry is energy-minimised into a clean, clash-free 3D conformer before it opens in the viewer.'
          : 'Hydrogens are added to satisfy valence and a flat 3D structure is generated. Refine it with the viewer’s Move / Twist tools.'}</p>
      </div>
    </div>
  );
}

Object.assign(window, { BuilderPalette, BuilderInspector });
