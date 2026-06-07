/* studio.jsx — main application */
const { useState: uS, useRef: uR, useCallback } = React;

const DEFAULT_STYLE = {
  rep: 'ballstick', palette: 'jmol', colorMode: 'element', single: '#7aa2e3',
  bg: 'white', atomScale: 0.9, bondRadius: 0.15, surfaceOpacity: 0.85,
  showH: true, showLabels: false, outline: false, spin: false
};

function bgObj(key) {
  const b = PRESETS.BACKGROUNDS.find(x => x.key === key) || PRESETS.BACKGROUNDS[0];
  return { color: b.color, alpha: b.alpha };
}

function LoadModal({ onClose, onLoad, onLoadResult }) {
  const [mode, setMode] = uS('file');
  const [data, setData] = uS('');
  const [fmt, setFmt] = uS('xyz');
  const [id, setId] = uS('');
  const [dragOver, setDragOver] = uS(false);
  const [fileErr, setFileErr] = uS(null);
  const fileInputRef = uR(null);
  const folderInputRef = uR(null);

  const EXT_FMT = { xyz: 'xyz', pdb: 'pdb', ent: 'pdb', sdf: 'sdf', mol: 'sdf', mol2: 'mol2',
    cif: 'cif', mmcif: 'cif', cube: 'cube', cub: 'cube', pqr: 'pqr', gro: 'gro' };
  const RESULT_EXT = ['fchk', 'fck', 'log', 'out', 'gro', 'xdatcar', 'outcar', 'trj', 'xmol'];

  function loadFile(file) {
    if (!file) return;
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const isResultName = RESULT_EXT.indexOf(ext) >= 0 || /outcar|xdatcar/i.test(file.name);
    const format = EXT_FMT[ext];
    if (!format && !isResultName) { setFileErr('Unsupported file type “.' + ext + '”. Try XYZ, PDB, SDF/MOL, MOL2, CIF, GRO, CUBE — or a Gaussian .fchk/.log, ORCA .out, VASP OUTCAR/XDATCAR result.'); return; }
    const reader = new FileReader();
    reader.onload = function () {
      const text = String(reader.result);
      // try to parse as a rich computational result first
      if ((isResultName || ext === 'xyz' || ext === 'pdb' || ext === 'ent') && window.RESULTS) {
        const res = window.RESULTS.parseFile(file.name, text);
        const rich = res && ((res.frames && res.frames.length > 1) || res.vib || res.cubes || res.orbitals || res.charges || res.excitations || isResultName);
        if (rich) { onLoadResult(res); onClose(); return; }
      }
      onLoad({ key: 'file-' + Date.now(), name: file.name.replace(/\.[^.]+$/, ''), formula: (format || 'data').toUpperCase() + ' file', cat: 'My structures', data: text, format: format || 'xyz' });
      onClose();
    };
    reader.onerror = function () { setFileErr('Could not read that file.'); };
    reader.readAsText(file);
  }

  // multiple files / a whole folder → combine per-frame structures into one trajectory
  function loadFiles(fileList) {
    var files = Array.prototype.slice.call(fileList || []);
    var keep = files.filter(function (f) { var e = (f.name.split('.').pop() || '').toLowerCase(); return ['gro', 'pdb', 'ent', 'pdbqt', 'xyz'].indexOf(e) >= 0; });
    if (keep.length <= 1) { loadFile(keep[0] || files[0]); return; }
    Promise.all(keep.map(function (f) { return f.text().then(function (t) { return { name: f.name, text: t }; }); }))
      .then(function (arr) {
        var res = window.RESULTS && window.RESULTS.combineFrames(arr);
        if (res && res.frames && res.frames.length > 1) { onLoadResult(res); onClose(); }
        else setFileErr('Could not build a trajectory from those ' + keep.length + ' files (they may have different atom counts).');
      })
      .catch(function () { setFileErr('Could not read those files.'); });
  }

  function submit() {
    if (mode === 'paste') {
      if (!data.trim()) return;
      onLoad({ key: 'custom-' + Date.now(), name: 'Custom structure', formula: fmt.toUpperCase(), cat: 'Custom', data: data, format: fmt });
    } else if (mode === 'pdb') {
      if (!id.trim()) return;
      onLoad({ key: 'pdb-' + id, name: id.toUpperCase(), formula: 'PDB ' + id.toUpperCase(), cat: 'Custom', pdb: id.trim().toUpperCase() });
    } else if (mode === 'cid') {
      if (!id.trim()) return;
      onLoad({ key: 'cid-' + id, name: 'CID ' + id, formula: 'PubChem ' + id, cat: 'Custom', cid: id.trim() });
    } else { return; }
    onClose();
  }

  return (
    <div className="modal-veil" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Load a structure</h3>
          <button className="close-x" onClick={onClose}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
        </div>
        <div className="modal-body">
          <div className="seg" style={{ marginBottom: 16 }}>
            <button className={mode === 'file' ? 'active' : ''} onClick={() => setMode('file')}>Upload file</button>
            <button className={mode === 'paste' ? 'active' : ''} onClick={() => setMode('paste')}>Paste text</button>
            <button className={mode === 'pdb' ? 'active' : ''} onClick={() => setMode('pdb')}>PDB ID</button>
            <button className={mode === 'cid' ? 'active' : ''} onClick={() => setMode('cid')}>PubChem CID</button>
          </div>
          {mode === 'file' && <React.Fragment>
            <input ref={fileInputRef} type="file" multiple accept=".xyz,.pdb,.ent,.sdf,.mol,.mol2,.cif,.mmcif,.cube,.cub,.pqr,.gro,.fchk,.fck,.log,.out" style={{ display: 'none' }}
              onChange={e => { setFileErr(null); loadFiles(e.target.files); }} />
            <input ref={folderInputRef} type="file" webkitdirectory="" directory="" multiple style={{ display: 'none' }}
              onChange={e => { setFileErr(null); loadFiles(e.target.files); }} />
            <div className={'dropzone' + (dragOver ? ' over' : '')}
              onClick={() => fileInputRef.current && fileInputRef.current.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); setFileErr(null); loadFiles(e.dataTransfer.files); }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></svg>
              <div className="dz-title">Click to choose file(s), or drag &amp; drop</div>
              <div className="dz-sub">structures &amp; trajectories · .xyz · .pdb · .gro · .sdf · .cif &nbsp;|&nbsp; results · .fchk · .log · .out · OUTCAR · XDATCAR</div>
              <div className="dz-sub" style={{ marginTop: 3, opacity: .8 }}>multi-model PDB / multi-frame XYZ &amp; .gro animate as trajectories</div>
            </div>
            <button className="btn" style={{ width: '100%', justifyContent: 'center', marginTop: 10 }}
              onClick={() => folderInputRef.current && folderInputRef.current.click()}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>
              Open a folder of frames (GROMACS movie)
            </button>
            <div className="dz-sub" style={{ marginTop: 8, opacity: .8, textAlign: 'center' }}>a folder of per-frame files (conf0.gro, conf1.gro …) animates as one trajectory</div>
            {fileErr && <div className="warn" style={{ marginTop: 12, marginBottom: 0 }}>{fileErr}</div>}
          </React.Fragment>}
          {mode === 'paste' && <React.Fragment>
            <textarea placeholder="Paste XYZ, PDB, MOL/SDF or MOL2 text…" value={data} onChange={e => setData(e.target.value)} />
            <div className="fmt-row">
              <label>Format</label>
              <select value={fmt} onChange={e => setFmt(e.target.value)}>
                <option value="xyz">XYZ</option><option value="pdb">PDB</option>
                <option value="sdf">SDF / MOL</option><option value="mol2">MOL2</option><option value="cube">Gaussian CUBE</option>
              </select>
              <span style={{ color: 'var(--muted)', fontSize: 12 }}>Multi-frame files load as a trajectory.</span>
            </div>
          </React.Fragment>}
          {mode === 'pdb' && <div className="fmt-row"><label>4-character PDB ID</label><input type="text" placeholder="e.g. 1CRN" value={id} onChange={e => setId(e.target.value)} maxLength={4} /></div>}
          {mode === 'cid' && <div className="fmt-row"><label>PubChem CID</label><input type="text" placeholder="e.g. 2519" value={id} onChange={e => setId(e.target.value)} /></div>}
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onClose}>Cancel</button>
          {mode !== 'file' && <button className="btn primary" onClick={submit}>Load structure</button>}
        </div>
      </div>
    </div>
  );
}

function StageToolbar({ viewerRef, st, set }) {
  const rot = (axis, ang) => () => viewerRef.current && viewerRef.current.rotate(axis, ang);
  return (
    <div className="stage-toolbar">
      <button title="Reset view" onClick={() => viewerRef.current && viewerRef.current.resetView()}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>
      </button>
      <button title="Rotate left" onClick={rot('y', -30)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 5L4 10l5 5" /><path d="M4 10h11a5 5 0 0 1 0 10h-3" /></svg>
      </button>
      <button title="Rotate right" onClick={rot('y', 30)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 5l5 5-5 5" /><path d="M20 10H9a5 5 0 0 0 0 10h3" /></svg>
      </button>
      <div className="div"></div>
      <button title="Auto-spin" className={st.spin ? 'on' : ''} onClick={() => set({ spin: !st.spin })}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 4v5h-5" /></svg>
      </button>
    </div>
  );
}

const DEMOS = (window.RESULTS && window.GLYCEROL_RAW) ? window.RESULTS.buildDemos(window.GLYCEROL_RAW) : [];

function RightPanel(props) {
  const { tab, setTab } = props;
  return (
    <div className="panel right">
      <div className="right-tabs">
        <div className="seg" style={{ width: '100%' }}>
          <button className={tab === 'style' ? 'active' : ''} style={{ flex: 1, justifyContent: 'center' }} onClick={() => setTab('style')}>Style</button>
          <button className={tab === 'analyze' ? 'active' : ''} style={{ flex: 1, justifyContent: 'center' }} onClick={() => setTab('analyze')}>Analyze</button>
          <button className={tab === 'results' ? 'active' : ''} style={{ flex: 1, justifyContent: 'center' }} onClick={() => setTab('results')}>Results</button>
        </div>
      </div>
      {tab === 'style' && <StyleControls {...props.style} />}
      {tab === 'analyze' && <AnalyzePanel {...props.analyze} />}
      {tab === 'results' && <ResultsPanel {...props.results} />}
    </div>
  );
}

const MEASURE_NEED = { distance: 2, angle: 3, dihedral: 4 };

function App() {
  const [st, setSt] = uS(DEFAULT_STYLE);
  const [molecule, setMolecule] = uS(Object.assign({ key: 'caffeine', remote: true }, MOLECULES.REMOTE.caffeine));
  const [activeTpl, setActiveTpl] = uS('pub');
  const [loading, setLoading] = uS(false);
  const [err, setErr] = uS(null);
  const [showModal, setShowModal] = uS(false);
  const [appMode, setAppMode] = uS('view');   // 'view' | 'build'
  const [exportScale, setExportScale] = uS(2);
  const viewerRef = uR(null);

  // analysis state
  const [rightTab, setRightTab] = uS('style');
  const [tool, setToolRaw] = uS('orbit');
  const [measureType, setMeasureType] = uS('distance');
  const [picks, setPicks] = uS([]);
  const [measurements, setMeasurements] = uS([]);
  const [modelAtoms, setModelAtoms] = uS([]);
  const [twist, setTwist] = uS(null);
  const [twistInfo, setTwistInfo] = uS(null);
  const [twistAngle, setTwistAngle] = uS(0);
  const [stereocenters, setStereocenters] = uS([]);
  const [customMols, setCustomMols] = uS([]);
  const [highlightColor, setHighlightColor] = uS('#ffcc00');
  const [moveSel, setMoveSel] = uS(null);
  const [nudgeStep, setNudgeStep] = uS(0.1);
  const [twistForce, setTwistForce] = uS(false);
  const measureIdRef = uR(1);

  // ---- computational results state ----
  const [result, setResult] = uS(null);
  const [frame, setFrame] = uS(0);
  const [playing, setPlaying] = uS(false);
  const [speed, setSpeed] = uS(1);
  const [bounce, setBounce] = uS(false);
  const [plotLayout, setPlotLayout] = uS('dock');
  const [activeMode, setActiveMode] = uS(null);
  const [vibPlaying, setVibPlaying] = uS(true);
  const [vibAmp, setVibAmp] = uS(0.6);
  const [vibSpeed, setVibSpeed] = uS(1);
  const [showModeArrows, setShowModeArrows] = uS(true);
  const [activeCube, setActiveCube] = uS(null);
  const [isoValue, setIsoValue] = uS(0.04);
  const [isoOpacity, setIsoOpacity] = uS(0.9);
  const [espRange, setEspRange] = uS(0.08);
  const [colorByCharge, setColorByCharge] = uS(false);
  const [showChargeLabels, setShowChargeLabels] = uS(false);
  const [showDipole, setShowDipole] = uS(false);
  const [solventMode, setSolventMode] = uS('show');
  const [customResults, setCustomResults] = uS([]);
  const [isoColors, setIsoColors] = uS({ pos: '#3b6fe0', neg: '#e0457b' });
  const [arrowScale, setArrowScale] = uS(1);
  const dirRef = uR(1);

  // restore last demo selection on mount (survives refresh during iteration)
  React.useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('molstudio.result') || 'null');
      if (saved && saved.key) {
        const d = DEMOS.find(x => x.key === saved.key);
        if (d) {
          activateResult(d);
          if (saved.frame != null) setFrame(saved.frame);
          if (saved.cube != null) setActiveCube(saved.cube);
          if (saved.mode != null) setActiveMode(saved.mode);
          return;
        }
      }
      // first visit: showcase the real DFT result
      const gly = DEMOS.find(x => x.key === 'glycerol-fchk');
      if (gly) activateResult(gly);
    } catch (e) {}
  }, []);
  React.useEffect(() => {
    if (result) localStorage.setItem('molstudio.result', JSON.stringify({ key: result.key, frame, cube: activeCube, mode: activeMode }));
  }, [result, frame, activeCube, activeMode]);

  // reflow the 3D canvas after the dock / rail layout changes the stage size
  React.useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => {
      if (viewerRef.current && viewerRef.current.resize) viewerRef.current.resize();
    }));
    return () => cancelAnimationFrame(id);
  }, [result, plotLayout]);

  function loadResult(r) {
    setCustomResults(prev => (prev.find(x => x.key === r.key) || DEMOS.find(x => x.key === r.key)) ? prev : prev.concat([r]));
    activateResult(r);
  }
  function activateResult(r) {
    setResult(r);
    setMolecule({ key: r.key, name: r.name, formula: r.formula, cat: r.cat, data: r.baseXYZ, format: r.format || 'xyz' });
    setFrame(0); setPlaying(false); setActiveMode(null); setActiveCube(null);
    setColorByCharge(false); setShowChargeLabels(false); setShowDipole(false);
    setSolventMode(r.hasSolvent ? 'dim' : 'show');
    setPicks([]); setMeasurements([]); setTwist(null);
    setRightTab('results');
  }
  function loadPlainMolecule(m) {
    setResult(null); setActiveMode(null); setActiveCube(null); setColorByCharge(false); setShowChargeLabels(false); setShowDipole(false);
    setMolecule(m); setPicks([]); setMeasurements([]); setTwist(null);
  }
  function onPickLibrary(m) {
    if (m.isResult || m.frames || m.cubes || m.vib || m.excitations) activateResult(m);
    else loadPlainMolecule(m);
  }
  function selectMode(i) {
    if (i == null || i === activeMode) { setActiveMode(null); return; }
    setActiveMode(i); setVibPlaying(true);
  }

  // playback loop for trajectories
  React.useEffect(() => {
    if (!playing || !result || !result.frames || result.frames.length < 2) return;
    let raf, last = performance.now(), acc = 0;
    const fps = 6 * speed;
    const step = (now) => {
      acc += (now - last) / 1000; last = now;
      let steps = Math.floor(acc * fps);
      if (steps >= 1) {
        acc -= steps / fps;
        if (steps > 30) steps = 30;
        setFrame(f => {
          const n = result.frames.length;
          if (bounce) {
            let nf = f, d = dirRef.current;
            for (let k = 0; k < steps; k++) { nf += d; if (nf >= n - 1) { nf = n - 1; d = -1; } else if (nf <= 0) { nf = 0; d = 1; } }
            dirRef.current = d; return nf;
          }
          return (f + steps) % n;
        });
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, bounce, result]);

  const vibMode = (result && result.vib && activeMode != null)
    ? { id: result.key + '-' + activeMode, disp: result.vib.modes[activeMode].disp } : null;
  const cubeObj = (result && result.cubes && activeCube != null) ? result.cubes[activeCube] : null;
  const framesCoords = (result && result.frames) ? result.frames.map(f => f.coords) : null;
  const hasPlots = !!(result && ((result.frames && result.frames.length > 1) || result.vib || result.excitations || (result.orbitals && !result.orbitals.sparse)));

  function exportFrames() {
    const p = viewerRef.current && viewerRef.current.exportFrames(6);
    if (!p) return;
    Promise.resolve(p).then(uri => {
      if (!uri) return;
      const a = document.createElement('a'); a.href = uri;
      a.download = (result.name || 'trajectory').replace(/[^a-z0-9]+/gi, '_').toLowerCase() + '_frames.png';
      document.body.appendChild(a); a.click(); a.remove();
    });
  }

  const [gifState, setGifState] = uS(null);   // null | 'capturing' | 'encoding' | percent
  const gifWorkerRef = uR(null);
  function getGifWorkerURL() {
    if (gifWorkerRef.current) return Promise.resolve(gifWorkerRef.current);
    return fetch('https://unpkg.com/gif.js@0.2.0/dist/gif.worker.js').then(r => r.text())
      .then(t => { gifWorkerRef.current = URL.createObjectURL(new Blob([t], { type: 'application/javascript' })); return gifWorkerRef.current; });
  }
  function exportGIF() {
    if (gifState != null || !result || !window.GIF) return;
    setGifState('capturing');
    const cap = viewerRef.current && viewerRef.current.captureFrames(150, 520);
    if (!cap) { setGifState(null); return; }
    const delay = Math.max(40, Math.round(1000 / (6 * speed)));   // GIF frame delay follows the chosen speed
    Promise.all([Promise.resolve(cap), getGifWorkerURL()]).then(([canvases, workerURL]) => {
      if (!canvases || !canvases.length) { setGifState(null); return; }
      setGifState('encoding');
      const gif = new window.GIF({ workers: 2, quality: 10, workerScript: workerURL, width: canvases[0].width, height: canvases[0].height, repeat: 0 });
      canvases.forEach(cv => gif.addFrame(cv, { delay: delay, copy: true }));
      gif.on('progress', pr => setGifState(Math.round(pr * 100)));
      gif.on('finished', blob => {
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
        a.download = (result.name || 'trajectory').replace(/[^a-z0-9]+/gi, '_').toLowerCase() + '.gif';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        setGifState(null);
      });
      gif.render();
    }).catch(() => setGifState(null));
  }

  function loadCustom(mol) {
    const m = Object.assign({}, mol, { cat: 'My structures' });
    setCustomMols(prev => prev.find(x => x.key === m.key) ? prev : prev.concat([m]));
    setMolecule(m); setPicks([]); setMeasurements([]); setTwist(null);
  }

  function setTool(t) { setToolRaw(t); setPicks([]); if (t !== 'twist') { setTwist(null); setTwistAngle(0); } if (t !== 'move' && viewerRef.current) viewerRef.current.clearMoveSelection(); }

  function bonded(i, j) {
    const a = modelAtoms.find(x => x.index === i);
    return a && a.bonds && a.bonds.indexOf(j) >= 0;
  }

  function onPickAtom(atom) {
    if (tool === 'measure') {
      setPicks(prev => {
        if (prev.length && prev[prev.length - 1].index === atom.index) return prev; // ignore repeat
        const next = prev.concat([atom]);
        const need = MEASURE_NEED[measureType];
        if (next.length >= need) {
          const m = { id: measureIdRef.current++, type: measureType, atoms: next.slice(0, need).map(a => a.index) };
          setMeasurements(ms => ms.concat([m]));
          return [];
        }
        return next;
      });
    } else if (tool === 'twist') {
      setPicks(prev => {
        const next = prev.concat([atom]);
        if (next.length >= 2) {
          const i = next[0].index, j = next[1].index;
          if (i !== j && bonded(i, j)) { setTwistAngle(0); setTwist({ i, j, token: Date.now(), force: twistForce }); }
          return [];
        }
        return next;
      });
    }
  }

  function keepTwist() { setTwist(null); setTwistAngle(0); setToolRaw('twist'); }
  function cancelTwist() { if (viewerRef.current) viewerRef.current.cancelTwist(); setTwist(null); setTwistAngle(0); }
  function toggleTwistForce() {
    setTwistForce(f => {
      const nf = !f;
      if (twist) setTwist(Object.assign({}, twist, { force: nf, token: Date.now() }));
      return nf;
    });
  }
  function nudge(axis, delta) { if (viewerRef.current) viewerRef.current.nudge(axis, delta); }
  function resetGeometry() { if (viewerRef.current) viewerRef.current.resetGeometry(); setMoveSel(s => s); }

  function removeMeasurement(id) { setMeasurements(ms => ms.filter(m => m.id !== id)); }
  function clearMeasurements() { setMeasurements([]); setPicks([]); }

  const set = useCallback((patch) => {
    setSt(s => Object.assign({}, s, patch));
    if (Object.keys(patch).some(k => ['rep', 'palette', 'colorMode', 'bg', 'single'].includes(k))) setActiveTpl(null);
  }, []);

  function applyTemplate(t) {
    setSt(s => Object.assign({}, s, t.style));
    setActiveTpl(t.key);
  }

  function switchTab(t) {
    setRightTab(t);
    if (t === 'style' || t === 'results') setTool('orbit');
    else setTool('measure');
  }

  function onLoading(isL, e) { setLoading(isL); setErr(e); }

  function doExport() {
    const uri = viewerRef.current && viewerRef.current.exportPNG(exportScale);
    if (!uri) return;
    const a = document.createElement('a');
    a.href = uri;
    a.download = (molecule.name || 'figure').replace(/[^a-z0-9]+/gi, '_').toLowerCase() + '_' + exportScale + 'x.png';
    document.body.appendChild(a); a.click(); a.remove();
  }

  const styleForViewer = {
    rep: st.rep, palette: st.palette, colorMode: st.colorMode, single: st.single,
    atomScale: st.atomScale, bondRadius: st.bondRadius, surfaceOpacity: st.surfaceOpacity,
    showH: st.showH, showLabels: st.showLabels, outline: st.outline
  };

  function receiveBuilt(xyz, formula) {
    const r = { key: 'built-' + Date.now(), name: 'Sketch', formula: formula, cat: 'My structures', data: xyz, format: 'sdf' };
    loadPlainMolecule(r);
    setCustomMols(prev => prev.concat([r]));
    setAppMode('view');
  }

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">
          <span className="mark"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><circle cx="12" cy="5" r="2.4" fill="#fff" stroke="none" /><circle cx="5" cy="17" r="2.4" fill="#fff" stroke="none" /><circle cx="19" cy="17" r="2.4" fill="#fff" stroke="none" /><path d="M12 5L5 17M12 5l7 12M5 17h14" /></svg></span>
          <span>Mol<span style={{ color: 'var(--accent)' }}>Studio</span></span>
          <span className="sub">· figure &amp; pose lab</span>
        </div>
        <div className="mode-switch">
          <button className={appMode === 'view' ? 'active' : ''} onClick={() => setAppMode('view')}>View &amp; analyze</button>
          <button className={appMode === 'build' ? 'active' : ''} onClick={() => setAppMode('build')}>Build</button>
        </div>
        <div className="spacer"></div>
        {appMode === 'view' && <React.Fragment>
          <span style={{ fontSize: 12, color: 'var(--muted)', marginRight: 4 }}>Drag to rotate · scroll to zoom · right-drag to pan</span>
          <button className="btn" onClick={() => setShowModal(true)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /><path d="M12 4v12M7 9l5-5 5 5" /></svg>
            Load
          </button>
          <button className="btn primary" onClick={doExport}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v12M7 10l5 5 5-5M5 21h14" /></svg>
            Export PNG
          </button>
        </React.Fragment>}
        {appMode === 'build' && <span style={{ fontSize: 12, color: 'var(--muted)' }}>Sketch a molecule, then send it to the 3D viewer</span>}
      </div>

      {appMode === 'build' && <Builder onSend={receiveBuilt} onClose={() => setAppMode('view')} />}
      {appMode === 'view' && <React.Fragment>
      <Library current={molecule.key} extra={DEMOS.concat(customResults).concat(customMols)} onPick={onPickLibrary} onLoadCustom={() => setShowModal(true)} />

      <div className="center">
        {tool !== 'orbit' && rightTab !== 'results' && <div className="mode-banner">
          <span className="dot"></span>
          {tool === 'measure' && <span><b>Measure</b> · click atoms to read {measureType === 'distance' ? 'a distance' : measureType === 'angle' ? 'an angle' : 'a torsion'}</span>}
          {tool === 'twist' && <span><b>Twist bond</b> · {twist ? 'drag the Rotation slider' : 'click two bonded atoms'}</span>}
          {tool === 'move' && <span><b>Move atom</b> · {moveSel ? 'drag it, or nudge X/Y/Z' : 'click or drag any atom'}</span>}
          {tool === 'chirality' && <span><b>Chirality</b> · detected stereocenters are labelled R / S</span>}
        </div>}
        {result && rightTab === 'results' && <div className="mode-banner result">
          <span className="dot"></span>
          <span><b>{result.name}</b> · {result.source}</span>
          {vibMode && <span style={{ marginLeft: 'auto' }}>animating mode {activeMode + 1} · {Math.abs(result.vib.modes[activeMode].freq).toFixed(0)} cm⁻¹</span>}
          {cubeObj && <span style={{ marginLeft: 'auto' }}>{cubeObj.name}</span>}
        </div>}
        <div className="stage-wrap">
          <div className={'stage' + (tool !== 'orbit' ? ' picking' : '')}>
            <Viewer ref={viewerRef} molecule={molecule} style={styleForViewer} bg={bgObj(st.bg)} spin={st.spin} onLoading={onLoading}
              tool={tool} picks={picks} measurements={measurements} showChirality={tool === 'chirality'} highlightColor={highlightColor}
              twist={twist} twistAngle={twistAngle} onMoveSelect={setMoveSel}
              onPickAtom={onPickAtom} onModelReady={setModelAtoms} onStereocenters={setStereocenters} onTwistReady={setTwistInfo}
              frames={framesCoords} frameIndex={frame}
              vibMode={vibMode} vibAmp={vibAmp} vibSpeed={vibSpeed} vibPlaying={vibPlaying} showModeArrows={showModeArrows}
              cube={cubeObj} isoValue={isoValue} isoOpacity={isoOpacity} espRange={espRange} isoColors={isoColors}
              colorByCharge={colorByCharge} chargeData={result && result.charges ? result.charges.values : null} showChargeLabels={showChargeLabels}
              showDipole={showDipole} dipole={result ? result.dipole : null} arrowScale={arrowScale}
              fixedBonds={result ? result.fixedBonds : null}
              solventMask={result ? result.solventMask : null} solventMode={solventMode} />
            <div className="stage-badge">
              <div className="t">{molecule.name}</div>
              <div className="f">{molecule.formula}</div>
            </div>
            {loading && <div className="loading-veil"><div className="spinner"></div></div>}
            {err && <div className="loading-veil"><div className="veil-err">{err}</div></div>}
          </div>
          <StageToolbar viewerRef={viewerRef} st={st} set={set} />
        </div>
        {result && plotLayout === 'dock' && (result.frames.length > 1 || hasPlots) && (
          <div className="dock">
            {result.frames.length > 1 && <Timeline result={result} frame={frame} setFrame={setFrame}
              playing={playing} setPlaying={setPlaying} speed={speed} setSpeed={setSpeed}
              bounce={bounce} setBounce={setBounce} onExport={exportFrames} onExportGIF={exportGIF} gifState={gifState} />}
            {hasPlots && <PlotsArea result={result} frame={frame} setFrame={setFrame} activeMode={activeMode} onPickMode={selectMode} layout="dock" />}
          </div>
        )}
      </div>

      <RightPanel tab={rightTab} setTab={switchTab}
        style={{ st, set, applyTemplate, activeTemplate: activeTpl, onExport: doExport, exportScale, setExportScale, molMeta: molecule }}
        analyze={{ tool, setTool, measureType, setMeasureType, picks, measurements, removeMeasurement, clearMeasurements,
          modelAtoms, twist, twistInfo, twistAngle, setTwistAngle, keepTwist, cancelTwist, stereocenters, atomCount: modelAtoms.length,
          highlightColor, setHighlightColor, twistForce, toggleTwistForce,
          moveSel, nudgeStep, setNudgeStep, nudge, resetGeometry }}
        results={{ result, onLoad: () => setShowModal(true), frame, setFrame, plotLayout, setPlotLayout, hasPlots,
          activeMode, onSelectMode: selectMode, vibPlaying, setVibPlaying, vibAmp, setVibAmp, vibSpeed, setVibSpeed, showModeArrows, setShowModeArrows,
          activeCube, setActiveCube, isoValue, setIsoValue, isoOpacity, setIsoOpacity, espRange, setEspRange, isoColors, setIsoColors,
          colorByCharge, setColorByCharge, showChargeLabels, setShowChargeLabels, showDipole, setShowDipole, arrowScale, setArrowScale,
          solventMode, setSolventMode }} />

      {showModal && <LoadModal onClose={() => setShowModal(false)} onLoad={loadCustom} onLoadResult={loadResult} />}
      </React.Fragment>}
    </div>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err: err }; }
  componentDidCatch(err, info) { try { console.error('Studio error:', err, info); } catch (e) {} }
  render() {
    if (this.state.err) {
      return (
        <div style={{ height: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg)', padding: 24 }}>
          <div style={{ maxWidth: 460, background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 14, padding: 24, boxShadow: 'var(--shadow-md)', textAlign: 'center' }}>
            <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 8 }}>Something went wrong rendering this file</div>
            <div style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.5, marginBottom: 16 }}>
              The last file may be malformed or unusually large. Your other work is safe — reload to get back to the studio.
            </div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)', background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', marginBottom: 16, wordBreak: 'break-word' }}>
              {String(this.state.err && this.state.err.message || this.state.err)}
            </div>
            <button className="btn primary" style={{ justifyContent: 'center' }}
              onClick={() => { try { localStorage.removeItem('molstudio.result'); } catch (e) {} location.reload(); }}>Reload studio</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(<ErrorBoundary><App /></ErrorBoundary>);
