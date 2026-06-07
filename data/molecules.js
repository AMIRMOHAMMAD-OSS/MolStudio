/* molecules.js — molecule library for the figure studio.
   Small molecules are generated with accurate geometry (XYZ, Angstrom).
   Larger molecules / proteins are fetched on demand (PubChem CID / RCSB PDB). */
(function () {
  function xyz(name, atoms) {
    var lines = [String(atoms.length), name];
    atoms.forEach(function (a) {
      lines.push(a[0] + ' ' + a[1].toFixed(4) + ' ' + a[2].toFixed(4) + ' ' + a[3].toFixed(4));
    });
    return lines.join('\n') + '\n';
  }
  var DEG = Math.PI / 180;

  // ---- Water ----
  var water = (function () {
    var r = 0.9584, a = 104.5 * DEG / 2;
    return [['O', 0, 0, 0],
      ['H', r * Math.sin(a), r * Math.cos(a), 0],
      ['H', -r * Math.sin(a), r * Math.cos(a), 0]];
  })();

  // ---- Methane ----
  var methane = (function () {
    var r = 1.087, d = r / Math.sqrt(3);
    return [['C', 0, 0, 0],
      ['H', d, d, d], ['H', d, -d, -d], ['H', -d, d, -d], ['H', -d, -d, d]];
  })();

  // ---- Ammonia ----
  var ammonia = (function () {
    var r = 1.012, ang = 106.7 * DEG;
    var cz = Math.cos(ang), proj = Math.sqrt(1 - cz * cz);
    var atoms = [['N', 0, 0, 0]];
    for (var i = 0; i < 3; i++) {
      var t = i * 120 * DEG;
      atoms.push(['H', r * proj * Math.cos(t), r * proj * Math.sin(t), r * cz]);
    }
    return atoms;
  })();

  // ---- Carbon dioxide ----
  var co2 = [['C', 0, 0, 0], ['O', 1.16, 0, 0], ['O', -1.16, 0, 0]];

  // ---- Benzene ----
  var benzene = (function () {
    var rc = 1.39, rh = rc + 1.09, atoms = [];
    for (var i = 0; i < 6; i++) {
      var t = i * 60 * DEG;
      atoms.push(['C', rc * Math.cos(t), rc * Math.sin(t), 0]);
    }
    for (var j = 0; j < 6; j++) {
      var u = j * 60 * DEG;
      atoms.push(['H', rh * Math.cos(u), rh * Math.sin(u), 0]);
    }
    return atoms;
  })();

  // ---- Ethylene ----
  var ethylene = (function () {
    var cc = 1.339, ch = 1.087, ang = 121.3 * DEG;
    var dx = ch * Math.cos(ang - 90 * DEG), dy = ch * Math.sin(ang - 90 * DEG);
    var x = cc / 2;
    return [
      ['C', x, 0, 0], ['C', -x, 0, 0],
      ['H', x + ch * Math.sin((180 - 121.3) * DEG), ch * Math.cos((180 - 121.3) * DEG), 0],
      ['H', x + ch * Math.sin((180 - 121.3) * DEG), -ch * Math.cos((180 - 121.3) * DEG), 0],
      ['H', -x - ch * Math.sin((180 - 121.3) * DEG), ch * Math.cos((180 - 121.3) * DEG), 0],
      ['H', -x - ch * Math.sin((180 - 121.3) * DEG), -ch * Math.cos((180 - 121.3) * DEG), 0]
    ];
  })();

  // ---- Cyclohexane (chair) ----
  var cyclohexane = (function () {
    var r = 1.46, dz = 0.25, atoms = [];
    for (var i = 0; i < 6; i++) {
      var t = i * 60 * DEG;
      atoms.push(['C', r * Math.cos(t), r * Math.sin(t), (i % 2 ? dz : -dz)]);
    }
    return atoms;
  })();

  // MOL/SDF V2000 builder (carries explicit bond orders for CIP perception)
  function molblock(name, atoms, bonds) {
    function f(n) { return n.toFixed(4).padStart(10); }
    var L = [name, '  MolStudio', ''];
    L.push(String(atoms.length).padStart(3) + String(bonds.length).padStart(3) + '  0  0  0  0  0  0  0  0999 V2000');
    atoms.forEach(function (a) { L.push(f(a[1]) + f(a[2]) + f(a[3]) + ' ' + (a[0] + '  ').slice(0, 3) + ' 0  0  0  0  0  0  0  0  0  0  0  0'); });
    bonds.forEach(function (b) { L.push(String(b[0]).padStart(3) + String(b[1]).padStart(3) + String(b[2]).padStart(3) + '  0'); });
    L.push('M  END');
    return L.join('\n') + '\n';
  }
  // D-glyceraldehyde, hand-built 3D coords verified to be the R (D) configuration.
  var dGlyceraldehyde = molblock('D-glyceraldehyde', [
    ['C',  0.0000,  0.0000,  0.0000],  // C2 stereocenter
    ['O',  0.8256,  0.8256,  0.8256],  // hydroxyl O
    ['C', -0.8776,  0.8776, -0.8776],  // C1 (CHO)
    ['C',  0.8776, -0.8776, -0.8776],  // C3 (CH2OH)
    ['H', -0.6351, -0.6351,  0.6351],  // H on C2
    ['H',  1.1292,  1.7364,  0.8256],  // hydroxyl H
    ['O', -1.9612,  1.1184, -1.3592],  // aldehyde =O
    ['H', -1.2042,  1.9119, -0.9865],  // aldehyde H
    ['O',  2.0332, -1.3109, -1.5999],  // CH2OH O
    ['H',  1.4428, -1.7818, -0.6515],  // CH2 H
    ['H',  1.1994, -1.0921, -1.8966],  // CH2 H
    ['H',  2.6438, -1.5144, -2.3122]   // CH2OH O-H
  ], [
    [1, 2, 1], [1, 3, 1], [1, 4, 1], [1, 5, 1], [2, 6, 1],
    [3, 7, 2], [3, 8, 1], [4, 9, 1], [4, 10, 1], [4, 11, 1], [9, 12, 1]
  ]);

  var LOCAL = {
    water:       { name: 'Water',          formula: 'H₂O',     cat: 'Small molecule', data: xyz('water', water), format: 'xyz' },
    methane:     { name: 'Methane',        formula: 'CH₄',     cat: 'Small molecule', data: xyz('methane', methane), format: 'xyz' },
    ammonia:     { name: 'Ammonia',        formula: 'NH₃',     cat: 'Small molecule', data: xyz('ammonia', ammonia), format: 'xyz' },
    co2:         { name: 'Carbon dioxide', formula: 'CO₂',     cat: 'Small molecule', data: xyz('co2', co2), format: 'xyz' },
    benzene:     { name: 'Benzene',        formula: 'C₆H₆',    cat: 'Ring system',    data: xyz('benzene', benzene), format: 'xyz' },
    ethylene:    { name: 'Ethylene',       formula: 'C₂H₄',    cat: 'Small molecule', data: xyz('ethylene', ethylene), format: 'xyz' },
    cyclohexane: { name: 'Cyclohexane',    formula: 'C₆H₁₂',   cat: 'Ring system',    data: xyz('cyclohexane', cyclohexane), format: 'xyz' },
    glyceraldehyde: { name: 'D-Glyceraldehyde', formula: 'C₃H₆O₃', cat: 'Chiral', data: dGlyceraldehyde, format: 'sdf' }
  };

  // Fetched on demand. cid = PubChem; pdb = RCSB.
  var REMOTE = {
    caffeine:   { name: 'Caffeine',     formula: 'C₈H₁₀N₄O₂', cat: 'Drug-like',  cid: 2519 },
    aspirin:    { name: 'Aspirin',      formula: 'C₉H₈O₄',    cat: 'Drug-like',  cid: 2244 },
    ibuprofen:  { name: 'Ibuprofen',    formula: 'C₁₃H₁₈O₂',  cat: 'Drug-like',  cid: 3672 },
    dopamine:   { name: 'Dopamine',     formula: 'C₈H₁₁NO₂',  cat: 'Drug-like',  cid: 681 },
    glucose:    { name: 'β-D-Glucose',  formula: 'C₆H₁₂O₆',   cat: 'Biomolecule',cid: 64689 },
    alanine:    { name: 'L-Alanine',    formula: 'C₃H₇NO₂',   cat: 'Chiral',     cid: 5950 },
    serine:     { name: 'L-Serine',     formula: 'C₃H₇NO₃',   cat: 'Chiral',     cid: 5951 },
    limonene:   { name: 'R-Limonene',   formula: 'C₁₀H₁₆',    cat: 'Chiral',     cid: 440917 },
    paclitaxel: { name: 'Paclitaxel',   formula: 'C₄₇H₅₁NO₁₄',cat: 'Drug-like',  cid: 36314 },
    porphyrin:  { name: 'Heme B',       formula: 'C₃₄H₃₂FeN₄O₄', cat: 'Biomolecule', cid: 26945 },
    crambin:    { name: 'Crambin',      formula: '46 residues',  cat: 'Protein', pdb: '1CRN' },
    ubiquitin:  { name: 'Ubiquitin',   formula: '76 residues',  cat: 'Protein', pdb: '1UBQ' },
    lysozyme:   { name: 'Lysozyme',    formula: '129 residues', cat: 'Protein', pdb: '2LYZ' },
    dna:        { name: 'B-DNA dodecamer', formula: 'Drew–Dickerson', cat: 'Nucleic acid', pdb: '1BNA' },
    insulin:    { name: 'Insulin',     formula: '2 chains',    cat: 'Protein', pdb: '4INS' }
  };

  window.MOLECULES = { LOCAL: LOCAL, REMOTE: REMOTE };
})();
