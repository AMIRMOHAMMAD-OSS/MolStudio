/* results-panel.jsx — right-panel "Results" tab: result metadata, vibrational
   mode list, volumetric (orbital/density/ESP) controls, charges & dipole,
   and the plots-layout switch. Relies on Section/Toggle/Slider/Chip globals. */

function KV({ k, v }) { return <div className="kv"><span className="k">{k}</span><span className="v">{v}</span></div>; }

function EmptyResults({ onLoad }) {
  return (
    <div className="sec"><div className="sec-body">
      <p className="empty-hint" style={{ paddingTop: 4 }}>
        No result loaded. Open a <b>Gaussian</b> .fchk/.log, an <b>ORCA</b> .out, a multi-frame <b>XYZ</b>,
        VASP OUTCAR/XDATCAR, or a GROMACS .gro — or pick a sample from the library.
      </p>
      <button className="btn primary" style={{ width: '100%', justifyContent: 'center' }} onClick={onLoad}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 4v12M7 9l5-5 5 5" /><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></svg>
        Load a result file
      </button>
    </div></div>
  );
}

function ModeList({ vib, active, onSelect, playing, setPlaying, amp, setAmp, speed, setSpeed, arrows, setArrows, arrowScale, setArrowScale }) {
  const imax = Math.max.apply(null, vib.modes.map(m => Math.abs(m.ir))) || 1;
  return (
    <Section title="Vibrational modes">
      <div className="mode-list">
        {vib.modes.map((m, i) => {
          const imag = m.freq < 0;
          return (
            <div key={i} className={'mode-row' + (active === i ? ' on' : '')} onClick={() => onSelect(i)}>
              <span className="mode-i">{i + 1}</span>
              <span className={'mode-freq' + (imag ? ' imag' : '')}>{imag ? 'i' : ''}{Math.abs(m.freq).toFixed(0)}<i>cm⁻¹</i></span>
              <span className="mode-bar"><i style={{ width: Math.max(3, Math.abs(m.ir) / imax * 100) + '%' }}></i></span>
              {m.name && <span className="mode-nm">{m.name}</span>}
            </div>
          );
        })}
      </div>
      {active != null && <React.Fragment>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button className="btn primary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setPlaying(p => !p)}>
            {playing ? 'Pause' : 'Animate'}
          </button>
          <button className="btn" style={{ justifyContent: 'center' }} onClick={() => onSelect(null)}>Clear</button>
        </div>
        <div style={{ marginTop: 12 }}>
          <Slider label="Amplitude" value={amp} min={0.1} max={1.4} step={0.05} fmt={v => v.toFixed(2)} onChange={setAmp} />
          <Slider label="Speed" value={speed} min={0.25} max={3} step={0.25} fmt={v => v.toFixed(2) + '×'} onChange={setSpeed} />
          <Toggle label="Displacement arrows" on={arrows} onChange={setArrows} />
          {arrows && <Slider label="Arrow scale" value={arrowScale} min={0.3} max={2.5} step={0.1} fmt={v => v.toFixed(1) + '×'} onChange={setArrowScale} />}
        </div>
      </React.Fragment>}
      {active == null && <p className="empty-hint" style={{ margin: '8px 0 0' }}>Pick a mode (here or on the IR spectrum) to animate it.</p>}
    </Section>
  );
}

function CubeControls({ cubes, activeIdx, setActive, isoValue, setIsoValue, isoOpacity, setIsoOpacity, espRange, setEspRange, isoColors, setIsoColors }) {
  const active = activeIdx != null ? cubes[activeIdx] : null;
  return (
    <Section title="Volumetric data">
      <div className="grid2">
        <Chip active={activeIdx == null} onClick={() => setActive(null)}>None</Chip>
        {cubes.map((c, i) => <Chip key={i} active={activeIdx === i} onClick={() => setActive(i)}>{c.name}</Chip>)}
      </div>
      {active && <div style={{ marginTop: 12 }}>
        {active.kind !== 'esp' && <React.Fragment>
          <Slider label="Isovalue" value={isoValue} min={0.005} max={0.09} step={0.002} fmt={v => v.toFixed(3)} onChange={setIsoValue} />
          <div className="iso-legend">
            {active.kind === 'mo'
              ? <React.Fragment><span><i style={{ background: isoColors.pos }}></i>+ lobe</span><span><i style={{ background: isoColors.neg }}></i>− lobe</span></React.Fragment>
              : <span><i style={{ background: isoColors.pos }}></i>density shell</span>}
          </div>
          <div className="iso-swatches">
            <label>{active.kind === 'mo' ? '+ lobe' : 'shell'}</label>
            <input type="color" value={isoColors.pos} onChange={e => setIsoColors(Object.assign({}, isoColors, { pos: e.target.value }))} />
            {active.kind === 'mo' && <React.Fragment>
              <label>− lobe</label>
              <input type="color" value={isoColors.neg} onChange={e => setIsoColors(Object.assign({}, isoColors, { neg: e.target.value }))} />
            </React.Fragment>}
          </div>
        </React.Fragment>}
        {active.kind === 'esp' && <React.Fragment>
          <Slider label="ESP range" value={espRange} min={0.02} max={0.2} step={0.01} fmt={v => '±' + v.toFixed(2)} onChange={setEspRange} />
          <div className="iso-legend esp"><span><i style={{ background: '#e0457b' }}></i>negative</span><span style={{ marginLeft: 'auto' }}><i style={{ background: '#3b6fe0' }}></i>positive</span></div>
        </React.Fragment>}
        <Slider label="Opacity" value={isoOpacity} min={0.3} max={1} step={0.05} fmt={v => Math.round(v * 100) + '%'} onChange={setIsoOpacity} />
      </div>}
      {!active && <p className="empty-hint" style={{ margin: '8px 0 0' }}>Show an orbital, the electron density, or the electrostatic potential mapped on the surface.</p>}
    </Section>
  );
}

function ChargePanel({ charges, dipole, colorByCharge, setColorByCharge, showChargeLabels, setShowChargeLabels, showDipole, setShowDipole, arrowScale, setArrowScale }) {
  return (
    <Section title="Charges & dipole">
      {charges && <React.Fragment>
        <Toggle label={'Color by ' + charges.kind + ' charge'} on={colorByCharge} onChange={setColorByCharge} />
        <Toggle label="Charge labels" on={showChargeLabels} onChange={setShowChargeLabels} />
        {colorByCharge && <div className="iso-legend esp" style={{ marginTop: 4 }}><span><i style={{ background: '#e0457b' }}></i>δ−</span><span style={{ marginLeft: 'auto' }}><i style={{ background: '#2563eb' }}></i>δ+</span></div>}
      </React.Fragment>}
      {dipole && <div style={{ marginTop: charges ? 12 : 0 }}>
        <Toggle label="Dipole vector" on={showDipole} onChange={setShowDipole} />
        <KV k="|µ|" v={dipole.debye.toFixed(3) + ' D'} />
        {showDipole && <Slider label="Arrow scale" value={arrowScale} min={0.3} max={2.5} step={0.1} fmt={v => v.toFixed(1) + '×'} onChange={setArrowScale} />}
      </div>}
    </Section>
  );
}

function ResultsPanel(p) {
  const r = p.result;
  if (!r) return <EmptyResults onLoad={p.onLoad} />;
  const nFrames = (r.frames || []).length;
  return (
    <React.Fragment>
      <Section title="Result">
        <div className="res-head">
          <div className="res-name">{r.name}</div>
          <div className="res-src">{r.source}</div>
        </div>
        <div style={{ marginTop: 6 }}>
          {Object.keys(r.scalars || {}).map(k => <KV key={k} k={k} v={r.scalars[k]} />)}
        </div>
      </Section>

      {nFrames > 1 && <Section title={r.frameKind === 'diffusion' ? 'Generative trajectory' : 'Trajectory'}>
        <KV k="Frames" v={String(nFrames)} />
        <KV k="Type" v={r.frameKind === 'md' ? 'Molecular dynamics' : r.frameKind === 'diffusion' ? 'Reverse diffusion sampling' : 'Optimization / scan'} />
        {r.fixedBonds && <KV k="Bonds" v="Fixed (graph)" />}
        <p className="empty-hint" style={{ margin: '6px 0 0' }}>{r.frameKind === 'diffusion'
          ? 'Play to watch the sample denoise from noise (t=T) to the final structure (t=0). Connectivity is held fixed so bonds are meaningful at every step.'
          : 'Use the timeline below the structure to play, scrub, and read per-frame values. Click any point on a plot to jump there.'}</p>
      </Section>}

      {r.hasSolvent && <Section title="Solvent">
        <div className="seg" style={{ width: '100%' }}>
          <button className={p.solventMode === 'show' ? 'active' : ''} style={{ flex: 1, justifyContent: 'center' }} onClick={() => p.setSolventMode('show')}>Show</button>
          <button className={p.solventMode === 'dim' ? 'active' : ''} style={{ flex: 1, justifyContent: 'center' }} onClick={() => p.setSolventMode('dim')}>Transparent</button>
          <button className={p.solventMode === 'hide' ? 'active' : ''} style={{ flex: 1, justifyContent: 'center' }} onClick={() => p.setSolventMode('hide')}>Hide</button>
        </div>
        <p className="empty-hint" style={{ margin: '8px 0 0' }}>Water &amp; ions are detected automatically so the solute stands out. Bonds are built per-residue, so no spurious cross-molecule bonds.</p>
      </Section>}

      {r.vib && <ModeList vib={r.vib} active={p.activeMode} onSelect={p.onSelectMode}
        playing={p.vibPlaying} setPlaying={p.setVibPlaying} amp={p.vibAmp} setAmp={p.setVibAmp}
        speed={p.vibSpeed} setSpeed={p.setVibSpeed} arrows={p.showModeArrows} setArrows={p.setShowModeArrows}
        arrowScale={p.arrowScale} setArrowScale={p.setArrowScale} />}

      {r.cubes && <CubeControls cubes={r.cubes} activeIdx={p.activeCube} setActive={p.setActiveCube}
        isoValue={p.isoValue} setIsoValue={p.setIsoValue} isoOpacity={p.isoOpacity} setIsoOpacity={p.setIsoOpacity}
        espRange={p.espRange} setEspRange={p.setEspRange} isoColors={p.isoColors} setIsoColors={p.setIsoColors} />}

      {(r.charges || r.dipole) && <ChargePanel charges={r.charges} dipole={r.dipole}
        colorByCharge={p.colorByCharge} setColorByCharge={p.setColorByCharge}
        showChargeLabels={p.showChargeLabels} setShowChargeLabels={p.setShowChargeLabels}
        showDipole={p.showDipole} setShowDipole={p.setShowDipole} arrowScale={p.arrowScale} setArrowScale={p.setArrowScale} />}

      {p.hasPlots && <Section title="Plots layout">
        <div className="seg" style={{ width: '100%' }}>
          <button className={p.plotLayout === 'dock' ? 'active' : ''} style={{ flex: 1, justifyContent: 'center' }} onClick={() => p.setPlotLayout('dock')}>Bottom dock</button>
          <button className={p.plotLayout === 'rail' ? 'active' : ''} style={{ flex: 1, justifyContent: 'center' }} onClick={() => p.setPlotLayout('rail')}>Side rail</button>
        </div>
        {p.plotLayout === 'rail' && <div className="rail-plots"><PlotsArea result={r} frame={p.frame} setFrame={p.setFrame} activeMode={p.activeMode} onPickMode={p.onSelectMode} layout="rail" /></div>}
      </Section>}
    </React.Fragment>
  );
}

Object.assign(window, { ResultsPanel });
