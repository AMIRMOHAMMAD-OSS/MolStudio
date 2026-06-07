/* results.jsx — Results panel (right tab), trajectory timeline, and interactive
   2D plots (energy convergence, RMSD, IR, UV-Vis, MO diagram). Plots are SVG so
   clicking a point/peak jumps the 3D view to that frame or selects that mode. */
const { useState: rS, useRef: rR, useEffect: rE, useMemo: rM } = React;

/* ---------- small helpers ---------- */
function scaleLin(d0, d1, r0, r1) { var s = (r1 - r0) / ((d1 - d0) || 1); return function (v) { return r0 + (v - d0) * s; }; }
function extent(arr) { var lo = Infinity, hi = -Infinity; arr.forEach(function (v) { if (v < lo) lo = v; if (v > hi) hi = v; }); if (lo === hi) { lo -= 1; hi += 1; } return [lo, hi]; }
function rmsdSeries(frames, toFinal) {
  if (!frames || frames.length < 2) return null;
  var ref = toFinal ? frames[frames.length - 1].coords : frames[0].coords;
  if (!ref) return null;
  return frames.map(function (f) {
    var fc = f.coords; if (!fc) return 0;
    var m = Math.min(ref.length, fc.length), s = 0;
    for (var i = 0; i < m; i++) { var a = fc[i], b = ref[i]; if (!a || !b) continue; s += (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y) + (a.z - b.z) * (a.z - b.z); }
    return m ? Math.sqrt(s / m) : 0;
  });
}
function PlotShell({ title, sub, children, w, h, narrow }) {
  return (
    <div className={'plot' + (narrow ? ' narrow' : '')}>
      <div className="plot-head"><span className="pt">{title}</span>{sub && <span className="ps">{sub}</span>}</div>
      <svg viewBox={'0 0 ' + w + ' ' + h} className="plot-svg">{children}</svg>
    </div>
  );
}

/* ---------- Energy vs frame (opt convergence / MD energy) ---------- */
function EnergyPlot({ result, frame, onPick }) {
  const frames = result.frames || [];
  const evs = frames.map(f => f.energy).filter(e => e != null);
  if (evs.length < 2) return null;
  const W = 520, H = 150, mL = 56, mR = 12, mT = 14, mB = 26;
  const isOpt = result.frameKind !== 'md';
  const unit = result.energyUnit || (isOpt ? 'Ha' : 'kcal/mol');
  let ys = frames.map(f => f.energy);
  let label = 'Energy / ' + unit, ref = null;
  if (isOpt) { ref = Math.min.apply(null, evs); ys = frames.map(f => (f.energy - ref) * 627.509); label = 'ΔE / kcal·mol⁻¹'; }
  const [ylo, yhi] = extent(ys);
  const x = scaleLin(0, frames.length - 1, mL, W - mR);
  const y = scaleLin(ylo, yhi, H - mB, mT);
  const path = frames.map((f, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(ys[i]).toFixed(1)).join(' ');
  return (
    <PlotShell title={isOpt ? 'Energy convergence' : 'Potential energy'} sub={frames.length + ' frames'} w={W} h={H}>
      <line x1={mL} y1={mT} x2={mL} y2={H - mB} className="ax" />
      <line x1={mL} y1={H - mB} x2={W - mR} y2={H - mB} className="ax" />
      <text x={6} y={mT + 8} className="axlbl">{label}</text>
      <text x={W - mR} y={H - 6} className="axlbl" textAnchor="end">frame →</text>
      <path d={path} className="eline" />
      {frames.map((f, i) => <circle key={i} cx={x(i)} cy={y(ys[i])} r={i === frame ? 5 : 3} className={i === frame ? 'edot cur' : 'edot'} onClick={() => onPick(i)} />)}
      <line x1={x(frame)} y1={mT} x2={x(frame)} y2={H - mB} className="cursorln" />
    </PlotShell>
  );
}

/* ---------- RMSD vs frame ---------- */
function RMSDPlot({ result, frame, onPick, toFinal }) {
  const series = rM(() => rmsdSeries(result.frames, toFinal), [result.key, toFinal]);
  if (!series) return null;
  const W = 520, H = 140, mL = 50, mR = 12, mT = 14, mB = 26;
  const [ylo, yhi] = extent(series);
  const x = scaleLin(0, series.length - 1, mL, W - mR);
  const y = scaleLin(0, yhi, H - mB, mT);
  const path = series.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join(' ');
  const area = path + ' L' + x(series.length - 1) + ' ' + (H - mB) + ' L' + x(0) + ' ' + (H - mB) + ' Z';
  return (
    <PlotShell title={toFinal ? 'RMSD to final sample' : 'RMSD from frame 0'} sub={'max ' + yhi.toFixed(2) + ' Å'} w={W} h={H}>
      <line x1={mL} y1={mT} x2={mL} y2={H - mB} className="ax" />
      <line x1={mL} y1={H - mB} x2={W - mR} y2={H - mB} className="ax" />
      <text x={6} y={mT + 8} className="axlbl">RMSD/Å</text>
      <path d={area} className="rarea" />
      <path d={path} className="eline" />
      <rect x={mL} y={mT} width={W - mR - mL} height={H - mB - mT} fill="transparent"
        onClick={e => { const r = e.currentTarget.getBoundingClientRect(); const fx = (e.clientX - r.left) / r.width; onPick(Math.round(fx * (series.length - 1))); }} />
      <line x1={x(frame)} y1={mT} x2={x(frame)} y2={H - mB} className="cursorln" />
      <circle cx={x(frame)} cy={y(series[frame] || 0)} r={5} className="edot cur" />
    </PlotShell>
  );
}

/* ---------- noise schedule σ(t) for generative trajectories ---------- */
function SigmaPlot({ result, frame, onPick }) {
  const frames = result.frames || [];
  if (!frames.length || frames[0].sigma == null) return null;
  const W = 520, H = 140, mL = 46, mR = 12, mT = 14, mB = 26;
  const ys = frames.map(f => f.sigma);
  const [ylo, yhi] = extent(ys);
  const x = scaleLin(0, frames.length - 1, mL, W - mR);
  const y = scaleLin(0, yhi, H - mB, mT);
  const path = frames.map((f, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(ys[i]).toFixed(1)).join(' ');
  const area = path + ' L' + x(frames.length - 1) + ' ' + (H - mB) + ' L' + x(0) + ' ' + (H - mB) + ' Z';
  return (
    <PlotShell title="Noise schedule σ(t)" sub="noise → clean sample" w={W} h={H}>
      <line x1={mL} y1={mT} x2={mL} y2={H - mB} className="ax" />
      <line x1={mL} y1={H - mB} x2={W - mR} y2={H - mB} className="ax" />
      <text x={6} y={mT + 8} className="axlbl">σ / Å</text>
      <text x={W - mR} y={H - 6} className="axlbl" textAnchor="end">denoising step →</text>
      <path d={area} className="sigarea" />
      <path d={path} className="sigline" />
      <rect x={mL} y={mT} width={W - mR - mL} height={H - mB - mT} fill="transparent"
        onClick={e => { const r = e.currentTarget.getBoundingClientRect(); const fx = (e.clientX - r.left) / r.width; onPick(Math.round(fx * (frames.length - 1))); }} />
      <line x1={x(frame)} y1={mT} x2={x(frame)} y2={H - mB} className="cursorln" />
      <circle cx={x(frame)} cy={y(ys[frame] || 0)} r={5} className="edot cur" />
    </PlotShell>
  );
}

/* ---------- IR / Raman stick spectrum ---------- */
function IRPlot({ vib, activeMode, onPick }) {
  const modes = vib.modes;
  const W = 520, H = 160, mL = 14, mR = 12, mT = 14, mB = 28;
  const fmax = Math.max.apply(null, modes.map(m => m.freq)) * 1.05 + 100;
  const imax = Math.max.apply(null, modes.map(m => m.ir)) || 1;
  const x = scaleLin(0, fmax, W - mR, mL);          // wavenumber axis reversed (high→low left→right is conventional reversed); keep low-left
  const xf = scaleLin(0, fmax, mL, W - mR);
  const y = scaleLin(0, imax, H - mB, mT);
  // Lorentzian broadened curve
  const N = 220, hw = 22;
  let curve = '';
  for (let i = 0; i < N; i++) {
    const wn = (i / (N - 1)) * fmax;
    let v = 0; modes.forEach(m => { v += m.ir * (hw * hw) / ((wn - m.freq) * (wn - m.freq) + hw * hw); });
    curve += (i ? 'L' : 'M') + xf(wn).toFixed(1) + ' ' + y(v).toFixed(1) + ' ';
  }
  return (
    <PlotShell title="IR spectrum" sub="click a band → animate mode" w={W} h={H}>
      <line x1={mL} y1={H - mB} x2={W - mR} y2={H - mB} className="ax" />
      <path d={curve} className="irband" />
      {modes.map((m, i) => (
        <g key={i} onClick={() => onPick(i)} className="irstickg">
          <line x1={xf(m.freq)} y1={H - mB} x2={xf(m.freq)} y2={y(m.ir)} className={activeMode === i ? 'irstick on' : 'irstick'} />
          <circle cx={xf(m.freq)} cy={y(m.ir)} r={activeMode === i ? 5 : 3.2} className={activeMode === i ? 'edot cur' : 'edot'} />
          <rect x={xf(m.freq) - 9} y={mT} width={18} height={H - mT} fill="transparent" />
        </g>
      ))}
      {[0, 1000, 2000, 3000, 4000].filter(t => t <= fmax).map(t => <text key={t} x={xf(t)} y={H - 8} className="axlbl" textAnchor="middle">{t}</text>)}
      <text x={W - mR} y={H - 8} className="axlbl" textAnchor="end" style={{ opacity: .6 }}>cm⁻¹</text>
    </PlotShell>
  );
}

/* ---------- UV-Vis absorption ---------- */
function UVVisPlot({ exc }) {
  const W = 520, H = 160, mL = 16, mR = 12, mT = 14, mB = 28;
  const lo = 150, hi = Math.max.apply(null, exc.map(e => e.nm)) * 1.12;
  const fmax = Math.max.apply(null, exc.map(e => e.f)) || 1;
  const x = scaleLin(lo, hi, mL, W - mR);
  const y = scaleLin(0, fmax * 1.1, H - mB, mT);
  const N = 240, sig = 14;
  let curve = '';
  for (let i = 0; i < N; i++) {
    const nm = lo + (i / (N - 1)) * (hi - lo);
    let v = 0; exc.forEach(e => { v += e.f * Math.exp(-((nm - e.nm) * (nm - e.nm)) / (2 * sig * sig)); });
    curve += (i ? 'L' : 'M') + x(nm).toFixed(1) + ' ' + y(v).toFixed(1) + ' ';
  }
  const area = curve + ' L' + x(hi) + ' ' + (H - mB) + ' L' + x(lo) + ' ' + (H - mB) + ' Z';
  return (
    <PlotShell title="UV-Vis absorption" sub={exc.length + ' excited states'} w={W} h={H}>
      <line x1={mL} y1={H - mB} x2={W - mR} y2={H - mB} className="ax" />
      <path d={area} className="uvarea" />
      <path d={curve} className="uvline" />
      {exc.map((e, i) => (
        <g key={i}>
          <line x1={x(e.nm)} y1={H - mB} x2={x(e.nm)} y2={y(e.f)} className="irstick on" />
          <text x={x(e.nm)} y={y(e.f) - 6} className="axlbl" textAnchor="middle">{e.nm}</text>
        </g>
      ))}
      {[200, 300, 400, 500].filter(t => t >= lo && t <= hi).map(t => <text key={t} x={x(t)} y={H - 8} className="axlbl" textAnchor="middle">{t}</text>)}
      <text x={W - mR} y={H - 8} className="axlbl" textAnchor="end" style={{ opacity: .6 }}>nm</text>
    </PlotShell>
  );
}

/* ---------- MO energy-level diagram ---------- */
function MOPlot({ orbitals }) {
  const HA2EV = 27.211386;
  const homo = orbitals.homo;
  // window around the gap
  const lo = Math.max(0, homo - 7), hi = Math.min(orbitals.energies.length - 1, homo + 8);
  const levels = [];
  for (let i = lo; i <= hi; i++) levels.push({ i, e: orbitals.energies[i] * HA2EV, occ: i <= homo });
  const W = 280, H = 300, mT = 18, mB = 18, cx = W / 2;
  const [elo, ehi] = extent(levels.map(l => l.e));
  const pad = (ehi - elo) * 0.08 || 1;
  const y = scaleLin(elo - pad, ehi + pad, H - mB, mT);
  const gapEV = (orbitals.energies[homo + 1] - orbitals.energies[homo]) * HA2EV;
  return (
    <PlotShell title="MO energy levels" sub={'gap ' + gapEV.toFixed(2) + ' eV'} w={W} h={H} narrow>
      {levels.map((l, k) => {
        const isFront = l.i === homo || l.i === homo + 1;
        return (
          <g key={l.i}>
            <line x1={cx - 54} y1={y(l.e)} x2={cx + 54} y2={y(l.e)} className={'molevel ' + (l.occ ? 'occ' : 'virt') + (isFront ? ' front' : '')} />
            {l.occ && <text x={cx - 30} y={y(l.e) + 3.5} className="moe" textAnchor="middle">↑↓</text>}
            {isFront && <text x={cx + 78} y={y(l.e) + 3.5} className="molbl">{l.i === homo ? 'HOMO' : 'LUMO'}</text>}
            <text x={cx - 70} y={y(l.e) + 3.5} className="moe2" textAnchor="end">{l.e.toFixed(2)}</text>
          </g>
        );
      })}
      <line x1={cx + 46} y1={y(levels.find(l => l.i === homo).e)} x2={cx + 46} y2={y(levels.find(l => l.i === homo + 1).e)} className="gapln" />
    </PlotShell>
  );
}

/* ---------- timeline / playback bar ---------- */
function Timeline({ result, frame, setFrame, playing, setPlaying, speed, setSpeed, bounce, setBounce, onExport, onExportGIF, gifState }) {
  const n = result.frames.length;
  const f = result.frames[frame] || {};
  const eUnit = result.energyUnit || (result.frameKind === 'md' ? 'kcal/mol' : 'Ha');
  return (
    <div className="timeline">
      <button className="tbtn play" onClick={() => setPlaying(p => !p)} title={playing ? 'Pause' : 'Play'}>
        {playing
          ? <svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
          : <svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 5l12 7-12 7z" /></svg>}
      </button>
      <button className="tbtn" onClick={() => setFrame(0)} title="First frame"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 5v14M16 12L8 6v12z" /></svg></button>
      <input type="range" className="scrub" min={0} max={n - 1} step={1} value={frame} onChange={e => setFrame(parseInt(e.target.value, 10))} />
      <div className="tinfo">
        <span className="tf">{(frame + 1)}<span className="tn">/{n}</span></span>
        {f.sigma != null && <span className="te diff">t={f.step} · σ {f.sigma.toFixed(2)}</span>}
        {f.energy != null && <span className="te">{result.frameKind === 'md' ? f.energy.toFixed(2) : f.energy.toFixed(5)} <i>{eUnit}</i></span>}
        {f.phi != null && <span className="te">φ {f.phi.toFixed(0)}°</span>}
      </div>
      <div className="seg tspeed">
        {[1, 2, 4, 10, 20].map(s => <button key={s} className={speed === s ? 'active' : ''} onClick={() => setSpeed(s)}>{s}×</button>)}
      </div>
      <button className={'tbtn wide' + (bounce ? ' on' : '')} onClick={() => setBounce(b => !b)} title="Loop mode">
        {bounce ? '⇌ bounce' : '↻ loop'}
      </button>
      <button className="tbtn wide" onClick={onExport} title="Export frames as a montage PNG"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v12M7 10l5 5 5-5M5 21h14" /></svg>frames</button>
      <button className={'tbtn wide gif' + (gifState != null ? ' busy' : '')} onClick={onExportGIF} disabled={gifState != null} title="Export the whole trajectory as an animated GIF">
        {gifState == null ? <React.Fragment><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M10 9l5 3-5 3z" fill="currentColor" /></svg>GIF</React.Fragment>
          : (gifState === 'capturing' ? 'capturing…' : typeof gifState === 'number' ? gifState + '%' : 'encoding…')}
      </button>
    </div>
  );
}

/* ---------- plots area (used in dock OR rail) ---------- */
function PlotsArea({ result, frame, setFrame, activeMode, onPickMode, layout }) {
  const hasEnergy = (result.frames || []).filter(f => f.energy != null).length > 1;
  const isMD = result.frameKind === 'md';
  const isDiff = result.frameKind === 'diffusion';
  return (
    <div className={'plots ' + layout}>
      {isDiff && <SigmaPlot result={result} frame={frame} onPick={setFrame} />}
      {isDiff && <RMSDPlot result={result} frame={frame} onPick={setFrame} toFinal={true} />}
      {hasEnergy && <EnergyPlot result={result} frame={frame} onPick={setFrame} />}
      {isMD && <RMSDPlot result={result} frame={frame} onPick={setFrame} />}
      {result.vib && <IRPlot vib={result.vib} activeMode={activeMode} onPick={onPickMode} />}
      {result.excitations && <UVVisPlot exc={result.excitations} />}
      {result.orbitals && !result.orbitals.sparse && <MOPlot orbitals={result.orbitals} />}
    </div>
  );
}

Object.assign(window, { EnergyPlot, RMSDPlot, SigmaPlot, IRPlot, UVVisPlot, MOPlot, Timeline, PlotsArea, rmsdSeries });
