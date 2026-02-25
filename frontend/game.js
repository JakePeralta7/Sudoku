'use strict';

// ── State ─────────────────────────────────────────────────────────────────────
const state = {
  sessionId:   null,
  puzzle:      null,        // 9×9 original (0 = empty)
  board:       null,        // 9×9 current user input
  difficulty:  'medium',
  startTime:   null,        // Date.now() adjusted for elapsed time on resume
  timerHandle: null,
  selectedRow: null,
  selectedCol: null,
  solved:      false,
};

// ── DOM refs ──────────────────────────────────────────────────────────────────
const boardEl          = document.getElementById('board');
const timerEl          = document.getElementById('timer');
const overlayEl        = document.getElementById('board-overlay');
const overlayMsgEl     = document.getElementById('overlay-message');
const btnNew           = document.getElementById('btn-new');
const btnCheck         = document.getElementById('btn-check');
const btnOverlayNew    = document.getElementById('btn-overlay-new');
const btnTheme         = document.getElementById('btn-theme');
const btnLeaderboard   = document.getElementById('btn-leaderboard');
const diffBtns         = document.querySelectorAll('.diff-btn');
const numBtns          = document.querySelectorAll('.num-btn');

// Leaderboard modal
const modalLeaderboard = document.getElementById('modal-leaderboard');
const modalBackdrop    = document.getElementById('modal-backdrop');
const btnModalClose    = document.getElementById('btn-modal-close');
const tabBtns          = document.querySelectorAll('.tab-btn');
const leaderboardContent = document.getElementById('leaderboard-content');

// Score modal
const modalScore       = document.getElementById('modal-score');
const scoreForm        = document.getElementById('score-form');
const playerNameInput  = document.getElementById('player-name');
const scoreTimeDisplay = document.getElementById('score-time-display');
const btnSkipScore     = document.getElementById('btn-skip-score');

// ── Theme ─────────────────────────────────────────────────────────────────────
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  btnTheme.textContent = theme === 'dark' ? '☀️' : '🌙';
  localStorage.setItem('theme', theme);
}

function initTheme() {
  const saved = localStorage.getItem('theme');
  if (saved === 'dark' || saved === 'light') {
    applyTheme(saved);
  } else {
    // Respect system preference, update icon accordingly
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    btnTheme.textContent = prefersDark ? '☀️' : '🌙';
  }
}

btnTheme.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  // Determine effective theme
  const effective = current === 'dark' ? 'dark'
    : current === 'light' ? 'light'
    : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  applyTheme(effective === 'dark' ? 'light' : 'dark');
});

// ── Timer ─────────────────────────────────────────────────────────────────────
function formatTime(seconds) {
  const m = String(Math.floor(seconds / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function startTimer(elapsedMs = 0) {
  stopTimer();
  state.startTime = Date.now() - elapsedMs;
  state.timerHandle = setInterval(() => {
    const elapsed = Math.floor((Date.now() - state.startTime) / 1000);
    timerEl.textContent = formatTime(elapsed);
  }, 500);
}

function stopTimer() {
  if (state.timerHandle) { clearInterval(state.timerHandle); state.timerHandle = null; }
}

function getElapsedSeconds() {
  return Math.round((Date.now() - state.startTime) / 1000);
}

// ── Board rendering ───────────────────────────────────────────────────────────
function buildBoard() {
  boardEl.innerHTML = '';
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.row = r;
      cell.dataset.col = c;
      cell.setAttribute('role', 'gridcell');
      cell.setAttribute('tabindex', '0');
      cell.addEventListener('click', () => selectCell(r, c));
      cell.addEventListener('keydown', onCellKeydown);
      boardEl.appendChild(cell);
    }
  }
}

function getCellEl(r, c) {
  return boardEl.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
}

function renderBoard() {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const cell = getCellEl(r, c);
      const given = state.puzzle[r][c] !== 0;
      const val   = given ? state.puzzle[r][c] : state.board[r][c];

      cell.textContent = val || '';
      cell.className = 'cell';
      if (given) cell.classList.add('given');
      else if (val) cell.classList.add('user-input');

      if (r === state.selectedRow && c === state.selectedCol && !state.solved) {
        cell.classList.add('selected');
      }
    }
  }
  highlightRelated();
  highlightConflicts();
  updateNumpadState();
}

function highlightRelated() {
  const r = state.selectedRow, c = state.selectedCol;
  if (r === null) return;
  const boxR = Math.floor(r / 3) * 3, boxC = Math.floor(c / 3) * 3;
  for (let i = 0; i < 9; i++) {
    const rowCell = getCellEl(r, i);
    const colCell = getCellEl(i, c);
    const boxCell = getCellEl(boxR + Math.floor(i / 3), boxC + (i % 3));
    if (!rowCell.classList.contains('selected')) rowCell.classList.add('highlight');
    if (!colCell.classList.contains('selected')) colCell.classList.add('highlight');
    if (!boxCell.classList.contains('selected')) boxCell.classList.add('highlight');
  }
}

function highlightConflicts() {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const val = state.board[r][c] || state.puzzle[r][c];
      if (!val) continue;
      if (hasConflict(r, c, val)) {
        getCellEl(r, c).classList.add('conflict');
      }
    }
  }
}

function hasConflict(row, col, num) {
  for (let i = 0; i < 9; i++) {
    if (i !== col) {
      const v = state.board[row][i] || state.puzzle[row][i];
      if (v === num) return true;
    }
    if (i !== row) {
      const v = state.board[i][col] || state.puzzle[i][col];
      if (v === num) return true;
    }
  }
  const bR = Math.floor(row / 3) * 3, bC = Math.floor(col / 3) * 3;
  for (let r = bR; r < bR + 3; r++) {
    for (let c = bC; c < bC + 3; c++) {
      if (r === row && c === col) continue;
      const v = state.board[r][c] || state.puzzle[r][c];
      if (v === num) return true;
    }
  }
  return false;
}

function updateNumpadState() {
  const counts = new Array(10).fill(0);
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const val = state.puzzle[r][c] || state.board[r][c];
      if (val) counts[val]++;
    }
  }
  numBtns.forEach(btn => {
    const num = parseInt(btn.dataset.num);
    if (num >= 1 && num <= 9) {
      btn.classList.toggle('exhausted', counts[num] >= 9);
    }
  });
}

// ── Cell selection & input ────────────────────────────────────────────────────
function selectCell(r, c) {
  if (state.solved) return;
  state.selectedRow = r;
  state.selectedCol = c;
  renderBoard();
  getCellEl(r, c).focus();
}

function inputNumber(num) {
  if (state.solved) return;
  const r = state.selectedRow, c = state.selectedCol;
  if (r === null || state.puzzle[r][c] !== 0) return;
  state.board[r][c] = num;
  renderBoard();
  persistBoard();
  checkAutoComplete();
}

function onCellKeydown(e) {
  const r = parseInt(e.currentTarget.dataset.row);
  const c = parseInt(e.currentTarget.dataset.col);
  const moves = { ArrowUp: [-1,0], ArrowDown: [1,0], ArrowLeft: [0,-1], ArrowRight: [0,1] };
  if (moves[e.key]) {
    e.preventDefault();
    const [dr, dc] = moves[e.key];
    const nr = Math.max(0, Math.min(8, r + dr));
    const nc = Math.max(0, Math.min(8, c + dc));
    selectCell(nr, nc);
    return;
  }
  if (e.key >= '1' && e.key <= '9') { selectCell(r, c); inputNumber(parseInt(e.key)); }
  if (e.key === '0' || e.key === 'Backspace' || e.key === 'Delete') { selectCell(r, c); inputNumber(0); }
}

// ── Auto-complete check ───────────────────────────────────────────────────────
function isBoardFull() {
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++)
      if ((state.board[r][c] || state.puzzle[r][c]) === 0) return false;
  return true;
}

function hasAnyConflict() {
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++) {
      const val = state.board[r][c] || state.puzzle[r][c];
      if (val && hasConflict(r, c, val)) return true;
    }
  return false;
}

async function checkAutoComplete() {
  if (!isBoardFull() || hasAnyConflict()) return;
  // Full board, no visual conflicts → validate with server
  await validateBoard(true);
}

// ── Validation ────────────────────────────────────────────────────────────────
async function validateBoard(silent = false) {
  const merged = state.board.map((row, r) =>
    row.map((cell, c) => cell || state.puzzle[r][c])
  );
  try {
    const res  = await fetch('/api/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: state.sessionId, board: merged }),
    });
    const data = await res.json();
    if (!res.ok) { if (!silent) alert(data.error || 'Validation failed.'); return; }
    if (data.correct) {
      onSolved();
    } else if (!silent) {
      showOverlay('❌ Not quite right — keep trying!', false);
    }
  } catch {
    if (!silent) alert('Network error. Please try again.');
  }
}

function onSolved() {
  stopTimer();
  state.solved = true;
  clearSavedSession();
  const elapsed = getElapsedSeconds();
  renderBoard();
  openScoreModal(elapsed);
}

// ── Overlay ───────────────────────────────────────────────────────────────────
function showOverlay(msg, permanent = true) {
  overlayMsgEl.textContent = msg;
  overlayEl.classList.remove('hidden');
  btnOverlayNew.classList.toggle('hidden', !permanent);
  if (!permanent) setTimeout(() => overlayEl.classList.add('hidden'), 1800);
}

btnOverlayNew.addEventListener('click', startNewGame);

// ── Leaderboard modal ─────────────────────────────────────────────────────────
let activeLbDifficulty = 'easy';

btnLeaderboard.addEventListener('click', () => openLeaderboardModal(state.difficulty));
btnModalClose.addEventListener('click', closeLeaderboardModal);
modalBackdrop.addEventListener('click', closeLeaderboardModal);

tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    tabBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeLbDifficulty = btn.dataset.difficulty;
    loadLeaderboard(activeLbDifficulty);
  });
});

function openLeaderboardModal(difficulty = 'easy') {
  activeLbDifficulty = difficulty;
  tabBtns.forEach(b => b.classList.toggle('active', b.dataset.difficulty === difficulty));
  modalLeaderboard.classList.remove('hidden');
  modalBackdrop.classList.remove('hidden');
  loadLeaderboard(difficulty);
}

function closeLeaderboardModal() {
  modalLeaderboard.classList.add('hidden');
  modalBackdrop.classList.add('hidden');
}

async function loadLeaderboard(difficulty) {
  leaderboardContent.innerHTML = '<p class="loading">Loading…</p>';
  try {
    const res  = await fetch(`/api/leaderboard?difficulty=${difficulty}`);
    const data = await res.json();
    if (!res.ok) { leaderboardContent.innerHTML = `<p class="empty-state">Error: ${data.error}</p>`; return; }
    renderLeaderboard(data.scores);
  } catch {
    leaderboardContent.innerHTML = '<p class="empty-state">Failed to load scores.</p>';
  }
}

function renderLeaderboard(scores) {
  if (!scores.length) {
    leaderboardContent.innerHTML = '<p class="empty-state">No scores yet — be the first!</p>';
    return;
  }
  const medal = ['🥇','🥈','🥉'];
  const rows = scores.map((s, i) => `
    <tr>
      <td class="rank ${i < 3 ? `rank-${i+1}` : ''}">${medal[i] || i+1}</td>
      <td>${escHtml(s.player_name)}</td>
      <td>${formatTime(s.time_seconds)}</td>
    </tr>
  `).join('');
  leaderboardContent.innerHTML = `
    <table class="leaderboard-table">
      <thead><tr><th>#</th><th>Player</th><th>Time</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Score submit modal ────────────────────────────────────────────────────────
let pendingElapsed = 0;

function openScoreModal(elapsed) {
  pendingElapsed = elapsed;
  scoreTimeDisplay.textContent = `You solved it in ${formatTime(elapsed)}! 🎉`;
  playerNameInput.value = localStorage.getItem('lastPlayerName') || '';
  modalScore.classList.remove('hidden');
  modalBackdrop.classList.remove('hidden');
  playerNameInput.focus();
}

function closeScoreModal() {
  modalScore.classList.add('hidden');
  modalBackdrop.classList.add('hidden');
}

scoreForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = playerNameInput.value.trim();
  if (!name) return;
  localStorage.setItem('lastPlayerName', name);
  await submitScore(name, pendingElapsed);
  closeScoreModal();
  openLeaderboardModal(state.difficulty);
});

btnSkipScore.addEventListener('click', () => {
  closeScoreModal();
  showOverlay('🎉 Puzzle Solved!', true);
});

async function submitScore(playerName, elapsed) {
  try {
    await fetch('/api/leaderboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        player_name:  playerName,
        time_seconds: elapsed,
        difficulty:   state.difficulty,
        session_id:   state.sessionId,
      }),
    });
  } catch {
    // Non-fatal: score simply not saved
    console.warn('Score submission failed.');
  }
}

// ── Persistence (session resume) ──────────────────────────────────────────────
function persistSession() {
  localStorage.setItem('sessionId', state.sessionId);
  localStorage.setItem('difficulty', state.difficulty);
}

function persistBoard() {
  localStorage.setItem('board', JSON.stringify(state.board));
}

function clearSavedSession() {
  localStorage.removeItem('sessionId');
  localStorage.removeItem('board');
  localStorage.removeItem('difficulty');
}

async function tryResumeSession() {
  const savedId   = localStorage.getItem('sessionId');
  const savedBoard = localStorage.getItem('board');
  if (!savedId) return false;

  try {
    const res  = await fetch(`/api/puzzle/${savedId}`);
    if (!res.ok) { clearSavedSession(); return false; }
    const data = await res.json();
    state.sessionId  = data.session_id;
    state.puzzle     = data.puzzle;
    state.difficulty = data.difficulty;
    state.board      = savedBoard ? JSON.parse(savedBoard) : emptyUserBoard(data.puzzle);
    state.solved     = false;

    // Set active diff button
    diffBtns.forEach(b => b.classList.toggle('active', b.dataset.difficulty === state.difficulty));

    const elapsed = Date.now() - data.started_at;
    buildBoard();
    renderBoard();
    startTimer(elapsed);
    persistSession();
    return true;
  } catch {
    clearSavedSession();
    return false;
  }
}

function emptyUserBoard(puzzle) {
  return puzzle.map(row => row.map(() => 0));
}

// ── New game ──────────────────────────────────────────────────────────────────
async function startNewGame() {
  overlayEl.classList.add('hidden');
  stopTimer();
  timerEl.textContent = '00:00';
  state.solved = false;
  state.selectedRow = null;
  state.selectedCol = null;

  try {
    const res  = await fetch('/api/puzzle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ difficulty: state.difficulty }),
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error || 'Failed to start new game.'); return; }

    state.sessionId = data.session_id;
    state.puzzle    = data.puzzle;
    state.board     = emptyUserBoard(data.puzzle);

    buildBoard();
    renderBoard();
    startTimer(0);
    persistSession();
    persistBoard();
  } catch {
    alert('Network error. Is the server running?');
  }
}

// ── Controls ──────────────────────────────────────────────────────────────────
btnNew.addEventListener('click', startNewGame);
btnCheck.addEventListener('click', () => validateBoard(false));
btnOverlayNew.addEventListener('click', startNewGame);

diffBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    diffBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.difficulty = btn.dataset.difficulty;
    startNewGame();
  });
});

numBtns.forEach(btn => {
  btn.addEventListener('click', () => inputNumber(parseInt(btn.dataset.num)));
});

// ── Init ──────────────────────────────────────────────────────────────────────
(async () => {
  initTheme();
  const resumed = await tryResumeSession();
  if (!resumed) await startNewGame();
})();
