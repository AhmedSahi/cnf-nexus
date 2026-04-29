// ─── Splash Logic ─────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    const splash = document.getElementById('splash');
    splash.classList.add('fade-out');
    setTimeout(() => {
      splash.style.display = 'none';
      document.getElementById('app').classList.add('visible');
    }, 800);
  }, 2600);
});

// ─── State ────────────────────────────────────────────────
let R, C, PITS_SET, WUMPUS_CELL, agent, visited, safeSet, dangerSet, KB, percepts,
    inferSteps, cnfCount, autoTimer, episodeActive, breezeMap, stenchMap;

const ck  = (r, c) => r + ',' + c;
const nb  = (r, c) => {
  const n = [];
  if (r > 0)   n.push([r - 1, c]);
  if (r < R-1) n.push([r + 1, c]);
  if (c > 0)   n.push([r, c - 1]);
  if (c < C-1) n.push([r, c + 1]);
  return n;
};

// ─── Logging ─────────────────────────────────────────────
function log(msg, cls) {
  const el = document.getElementById('kb-log');
  const d  = document.createElement('div');
  d.textContent = msg;
  if (cls) d.className = cls;
  el.appendChild(d);
  el.scrollTop = el.scrollHeight;
}

// ─── New Episode ─────────────────────────────────────────
function newEpisode() {
  clearInterval(autoTimer);
  autoTimer = null;
  document.getElementById('btn-auto').textContent = 'Auto-Run';

  R = Math.max(3, +document.getElementById('inp-rows').value || 4);
  C = Math.max(3, +document.getElementById('inp-cols').value || 4);
  const maxPits = Math.min(+document.getElementById('inp-pits').value || 3, R * C - 4);

  visited   = new Set();
  safeSet   = new Set();
  dangerSet = new Set();
  KB        = [];
  breezeMap = {};
  stenchMap = {};
  percepts  = { breeze: false, stench: false };
  inferSteps   = 0;
  cnfCount     = 0;
  episodeActive = true;
  document.getElementById('kb-log').innerHTML = '';

  // Place hazards randomly (not on start cell)
  const cells = [];
  for (let r = 0; r < R; r++)
    for (let c = 0; c < C; c++)
      if (!(r === R - 1 && c === 0)) cells.push([r, c]);
  shuffle(cells);

  const pitList    = cells.slice(0, maxPits);
  const wumpusCell = cells[maxPits];
  PITS_SET    = new Set(pitList.map(([r, c]) => ck(r, c)));
  WUMPUS_CELL = ck(wumpusCell[0], wumpusCell[1]);

  agent = [R - 1, 0];
  safeSet.add(ck(R - 1, 0));

  log(`[SYSTEM] New episode: ${R}x${C} grid, ${maxPits} pits, 1 Wumpus`, 'log-sys');
  log(`[SYSTEM] Agent starts at (${R-1},0). KB initialized.`, 'log-sys');

  perceiveAndTell();
  render();
  ['btn-step', 'btn-auto', 'btn-reveal'].forEach(id => document.getElementById(id).disabled = false);
  updateMetrics();
}

// ─── Percept + TELL ──────────────────────────────────────
function perceiveAndTell() {
  const [r, c] = agent;
  const key    = ck(r, c);
  visited.add(key);
  safeSet.add(key);

  const nbs    = nb(r, c);
  const breeze = nbs.some(([nr, nc]) => PITS_SET.has(ck(nr, nc)));
  const stench = nbs.some(([nr, nc]) => ck(nr, nc) === WUMPUS_CELL);

  percepts = { breeze, stench };
  breezeMap[key] = breeze;
  stenchMap[key] = stench;

  // TELL KB
  if (breeze) {
    KB.push({ type: 'breeze', cell: [r, c], nbs });
    log(`TELL  B(${r},${c}) <=> vP{ ${nbs.map(([a, b]) => `(${a},${b})`).join(' ')} }`, 'log-tell');
    cnfCount += nbs.length + 1;
    log(`CNF   (NOT B(${r},${c}) v P(n1) v ...) ^ for-all-ni(B(${r},${c}) v NOT P(ni))`, 'log-tell');
  } else {
    KB.push({ type: 'no_breeze', cell: [r, c], nbs });
    nbs.forEach(([nr, nc]) => safeSet.add(ck(nr, nc)));
    cnfCount += nbs.length;
    log(`TELL  NOT B(${r},${c}) => NOT P-all{ ${nbs.map(([a, b]) => `(${a},${b})`).join(' ')} }`, 'log-tell');
    log(`CNF   ${nbs.map(([a, b]) => `(NOT P(${a},${b}))`).join(' ^ ')}`, 'log-tell');
  }

  if (stench) {
    KB.push({ type: 'stench', cell: [r, c], nbs });
    cnfCount += nbs.length + 1;
    log(`TELL  S(${r},${c}) <=> W in{ ${nbs.map(([a, b]) => `(${a},${b})`).join(' ')} }`, 'log-tell');
  } else {
    KB.push({ type: 'no_stench', cell: [r, c], nbs });
    nbs.forEach(([nr, nc]) => safeSet.add(ck(nr, nc)));
    cnfCount += nbs.length;
    log(`TELL  NOT S(${r},${c}) => NOT W-all{ ${nbs.map(([a, b]) => `(${a},${b})`).join(' ')} }`, 'log-tell');
  }

  runResolution();
}

// ─── Resolution Refutation (CNF-based) ───────────────────
function runResolution() {
  inferSteps++;
  log(`-- Resolution pass #${inferSteps} --`, 'log-sys');

  for (let r = 0; r < R; r++) {
    for (let c = 0; c < C; c++) {
      const key = ck(r, c);
      if (visited.has(key) || dangerSet.has(key)) continue;

      const pitSafe  = askSafe_pit(r, c);
      const wumpSafe = askSafe_wumpus(r, c);

      if (pitSafe && wumpSafe && !safeSet.has(key)) {
        safeSet.add(key);
        log(`ASK   NOT P(${r},${c}) ^ NOT W(${r},${c}) => PROVED SAFE`, 'log-ask');
      }

      if (!safeSet.has(key)) {
        const isDangerPit = askDanger_pit(r, c);
        if (isDangerPit && !dangerSet.has(key)) {
          dangerSet.add(key);
          log(`ASK   P(${r},${c}) => DANGER CONFIRMED (pit likely)`, 'log-unsafe');
        }
      }
    }
  }
  updateMetrics();
}

function askSafe_pit(r, c) {
  const nbs_of_rc = nb(r, c);
  return nbs_of_rc.some(([vr, vc]) => {
    const vk = ck(vr, vc);
    return visited.has(vk) && breezeMap[vk] === false;
  });
}

function askSafe_wumpus(r, c) {
  const nbs_of_rc = nb(r, c);
  return nbs_of_rc.some(([vr, vc]) => {
    const vk = ck(vr, vc);
    return visited.has(vk) && stenchMap[vk] === false;
  });
}

function askDanger_pit(r, c) {
  const breezyVisNbs = nb(r, c).filter(([vr, vc]) =>
    visited.has(ck(vr, vc)) && breezeMap[ck(vr, vc)] === true
  );
  if (!breezyVisNbs.length) return false;
  return breezyVisNbs.every(([br, bc]) => {
    const otherNbs = nb(br, bc).filter(([nr, nc]) => !(nr === r && nc === c));
    return otherNbs.every(([nr, nc]) => {
      const k = ck(nr, nc);
      return safeSet.has(k) || visited.has(k);
    });
  });
}

// ─── Agent Step ──────────────────────────────────────────
function agentStep() {
  if (!episodeActive) return;

  const [r, c] = agent;
  const key    = ck(r, c);

  if (PITS_SET.has(key) || key === WUMPUS_CELL) {
    setStatus('Agent fell into danger at (' + r + ',' + c + '). Episode over.');
    episodeActive = false;
    document.getElementById('btn-step').disabled = true;
    clearInterval(autoTimer); autoTimer = null;
    document.getElementById('btn-auto').textContent = 'Auto-Run';
    render();
    return;
  }

  const nbs  = nb(r, c);
  let moved  = false;

  // Priority 1: unvisited safe adjacent
  for (const [nr, nc] of nbs) {
    const nk = ck(nr, nc);
    if (!visited.has(nk) && safeSet.has(nk) && !dangerSet.has(nk)) {
      log(`STEP  -> (${nr},${nc}) [safe-adjacent]`, 'log-step');
      agent = [nr, nc];
      perceiveAndTell();
      moved = true;
      break;
    }
  }

  // Priority 2: BFS to any unvisited safe cell
  if (!moved) {
    const target = bfsSafe();
    if (target) {
      const [tr, tc] = target;
      log(`STEP  -> (${tr},${tc}) [BFS to unvisited safe]`, 'log-step');
      agent = [tr, tc];
      perceiveAndTell();
      moved = true;
    }
  }

  // Priority 3: risk unknown neighbor
  if (!moved) {
    const unkNbs = nbs.filter(([nr, nc]) => {
      const k = ck(nr, nc);
      return !visited.has(k) && !safeSet.has(k) && !dangerSet.has(k);
    });
    if (unkNbs.length > 0) {
      const [nr, nc] = unkNbs[0];
      log(`STEP  -> (${nr},${nc}) [RISK: unknown cell]`, 'log-unsafe');
      agent = [nr, nc];
      perceiveAndTell();
      moved = true;
    }
  }

  if (!moved) {
    setStatus('Agent explored all reachable safe cells. Episode complete.');
    episodeActive = false;
    document.getElementById('btn-step').disabled = true;
    clearInterval(autoTimer); autoTimer = null;
    document.getElementById('btn-auto').textContent = 'Auto-Run';
  } else {
    const [ar, ac] = agent;
    if (PITS_SET.has(ck(ar, ac)) || ck(ar, ac) === WUMPUS_CELL) {
      setStatus('Agent walked into danger at (' + ar + ',' + ac + ').');
      episodeActive = false;
      document.getElementById('btn-step').disabled = true;
      clearInterval(autoTimer); autoTimer = null;
      document.getElementById('btn-auto').textContent = 'Auto-Run';
    } else {
      setStatus(
        `Agent at (${ar},${ac}).` +
        (percepts.breeze ? ' Breeze detected.' : '') +
        (percepts.stench ? ' Stench detected.' : '')
      );
    }
  }

  render();
  updateMetrics();
}

function bfsSafe() {
  const queue = [[...agent]];
  const seen  = new Set([ck(agent[0], agent[1])]);
  while (queue.length) {
    const [r, c] = queue.shift();
    for (const [nr, nc] of nb(r, c)) {
      const k = ck(nr, nc);
      if (seen.has(k)) continue;
      seen.add(k);
      if (dangerSet.has(k)) continue;
      if (safeSet.has(k)) {
        if (!visited.has(k)) return [nr, nc];
        queue.push([nr, nc]);
      }
    }
  }
  return null;
}

function toggleAuto() {
  if (autoTimer) {
    clearInterval(autoTimer);
    autoTimer = null;
    document.getElementById('btn-auto').textContent = 'Auto-Run';
  } else {
    document.getElementById('btn-auto').textContent = 'Stop';
    const speed = +document.getElementById('inp-speed').value || 700;
    autoTimer = setInterval(() => {
      if (!episodeActive) {
        clearInterval(autoTimer);
        autoTimer = null;
        document.getElementById('btn-auto').textContent = 'Auto-Run';
      } else {
        agentStep();
      }
    }, speed);
  }
}

function revealAll() {
  PITS_SET.forEach(k => { dangerSet.add(k); });
  dangerSet.add(WUMPUS_CELL);
  log('[REVEAL] All hazard locations disclosed.', 'log-sys');
  render();
  updateMetrics();
}

// ─── Render ───────────────────────────────────────────────
function render() {
  const t      = document.getElementById('grid');
  t.innerHTML  = '';
  const [ar, ac] = agent;

  for (let r = 0; r < R; r++) {
    const tr = document.createElement('tr');
    for (let c = 0; c < C; c++) {
      const td  = document.createElement('td');
      const key = ck(r, c);

      const isAgent = r === ar && c === ac;
      const isVis   = visited.has(key);
      const isDng   = dangerSet.has(key);
      const isSafe  = safeSet.has(key) && !isDng;

      let label = '?';
      let cls   = 'unknown';

      if (isDng)       { cls = 'danger';    label = PITS_SET.has(key) ? 'PIT' : 'WMP'; }
      else if (isVis)  { cls = 'visited';   label = 'VIS'; }
      else if (isSafe) { cls = 'safe-inf';  label = 'SAFE'; }

      if (isAgent && !isDng) cls += ' agent';
      if (isAgent && isDng)  { cls = 'danger dead'; label = 'X'; }

      td.className = cls;
      td.innerHTML =
        `<span class="cell-icon">${label}</span>` +
        `<span class="cell-coord">(${r},${c})</span>`;

      // Percept badge on visited cells
      if (isVis && !isDng) {
        const b = breezeMap[key];
        const s = stenchMap[key];
        if (b || s) {
          const bd = document.createElement('span');
          bd.className  = 'cell-badge ' + (b && s ? 'badge-bs' : b ? 'badge-b' : 'badge-s');
          bd.textContent = b && s ? 'B+S' : b ? 'B' : 'S';
          td.appendChild(bd);
        }
      }

      tr.appendChild(td);
    }
    t.appendChild(tr);
  }

  // Percept tags
  const pt = document.getElementById('percept-tags');
  pt.innerHTML = '';
  if (!episodeActive || (!percepts.breeze && !percepts.stench)) {
    pt.innerHTML = '<span class="ptag ptag-n">None</span>';
  } else {
    if (percepts.breeze) pt.innerHTML += '<span class="ptag ptag-b">Breeze</span>';
    if (percepts.stench) pt.innerHTML += '<span class="ptag ptag-s">Stench</span>';
    if (!PITS_SET.has(ck(ar, ac)) && ck(ar, ac) !== WUMPUS_CELL)
      pt.innerHTML += '<span class="ptag ptag-g">Safe</span>';
  }
}

function updateMetrics() {
  document.getElementById('m-steps').textContent   = inferSteps;
  document.getElementById('m-visited').textContent = visited ? visited.size : 0;
  document.getElementById('m-safe').textContent    = safeSet && visited ? Math.max(0, safeSet.size - visited.size) : 0;
  document.getElementById('m-clauses').textContent = KB ? KB.length : 0;
  document.getElementById('m-dangers').textContent = dangerSet ? dangerSet.size : 0;
  document.getElementById('m-cnf').textContent     = cnfCount;
}

function setStatus(text) {
  document.getElementById('status-text').textContent = text;
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
}