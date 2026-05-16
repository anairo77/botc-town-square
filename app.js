import { db }                                    from './firebase-config.js';
import { ref, set, update, onValue, get }         from 'https://www.gstatic.com/firebasejs/12.13.0/firebase-database.js';
import { renderBoard, computeSeatPositions }       from './board.js';
import { initDrag, updateDragTargets, disableDrag } from './drag.js';
import { buildTravelerSheet, updateTravelerSheetSelection, columnIndexForCount } from './traveler-sheet.js';

// ── Refs ─────────────────────────────────────────────────────────────────────

const gameRef = ref(db, 'game');
const bellRef = ref(db, 'bell');

// ── Audio ─────────────────────────────────────────────────────────────────────

const bellAudio = new Audio('Church Bell, Strikes 12 Times.mp3');

// ── State ────────────────────────────────────────────────────────────────────

let currentState = null;
let undoSnapshot = null;
let currentScale = 1;

// ── Default states ───────────────────────────────────────────────────────────

function defaultState(playerCount) {
  const players = Array.from({ length: playerCount }, (_, i) => ({
    id:           i,
    name:         '',
    status:       'alive',
    isTraveler:   false,
    hasVoteToken: false,
    seatIndex:    i,
  }));
  return {
    phase:               'setup',
    playerCount,
    travelerSheetColumn: columnIndexForCount(playerCount),
    players,
  };
}

function emptySetupState() {
  return { phase: 'setup', playerCount: null, travelerSheetColumn: null, players: [] };
}

// ── Undo ─────────────────────────────────────────────────────────────────────

function captureUndo() {
  undoSnapshot = JSON.parse(JSON.stringify(currentState));
  syncUndoButton();
}

function performUndo() {
  if (!undoSnapshot) return;
  const snap = undoSnapshot;
  undoSnapshot = null;
  set(gameRef, snap);
  syncUndoButton();
}

function syncUndoButton() {
  document.getElementById('btn-undo').disabled = !undoSnapshot;
}

// ── Mutations ────────────────────────────────────────────────────────────────

function flipToken(playerId) {
  if (!currentState || currentState.phase !== 'active') return;
  captureUndo();
  const idx    = currentState.players.findIndex(p => p.id === playerId);
  const player = currentState.players[idx];
  const newStatus = player.status === 'alive' ? 'dead' : 'alive';
  update(gameRef, {
    [`players/${idx}/status`]:       newStatus,
    [`players/${idx}/hasVoteToken`]: newStatus === 'dead',
  });
}

function removeGhostVote(playerId) {
  if (!currentState || currentState.phase !== 'active') return;
  captureUndo();
  const idx = currentState.players.findIndex(p => p.id === playerId);
  update(gameRef, { [`players/${idx}/hasVoteToken`]: false });
}

function updatePlayerName(playerId, name) {
  if (!currentState) return;
  captureUndo();
  const idx = currentState.players.findIndex(p => p.id === playerId);
  update(gameRef, { [`players/${idx}/name`]: name.trim() });
}

function handleDragEnd(playerId, targetSeatIndex) {
  if (!currentState) return;
  captureUndo();
  const dragged    = currentState.players.find(p => p.id === playerId);
  const swapPlayer = currentState.players.find(p => p.seatIndex === targetSeatIndex);
  const draggedIdx = currentState.players.indexOf(dragged);
  const updates    = { [`players/${draggedIdx}/seatIndex`]: targetSeatIndex };
  if (swapPlayer && swapPlayer.id !== playerId) {
    const swapIdx = currentState.players.indexOf(swapPlayer);
    updates[`players/${swapIdx}/seatIndex`] = dragged.seatIndex;
  }
  update(gameRef, updates);
}

function startGame() {
  if (!currentState || !currentState.playerCount) return;
  captureUndo();
  update(gameRef, { phase: 'active' });
}

function selectTravelerColumn(colIndex) {
  if (!currentState || currentState.phase !== 'setup') return;
  const playerCount = colIndex === 10 ? 15 : colIndex + 5;
  captureUndo();
  set(gameRef, { ...defaultState(playerCount), travelerSheetColumn: colIndex });
}

// ── Reset dialog ──────────────────────────────────────────────────────────────

function initiateReset() {
  document.getElementById('reset-overlay').classList.add('visible');
  document.getElementById('btn-reset-cancel').focus();
}

function cancelReset() {
  document.getElementById('reset-overlay').classList.remove('visible');
}

function confirmReset() {
  document.getElementById('reset-overlay').classList.remove('visible');
  undoSnapshot = null;
  syncUndoButton();
  set(gameRef, emptySetupState());
}

// ── Scale ─────────────────────────────────────────────────────────────────────

const LEFT_BAR_WIDTH = 0;

function updateScale() {
  currentScale = (window.innerWidth - LEFT_BAR_WIDTH) / 1920;
  document.getElementById('board').style.transform        = `scale(${currentScale})`;
  document.getElementById('board-wrapper').style.height   = `${1080 * currentScale}px`;
  if (currentState?.playerCount) {
    updateDragTargets(computeSeatPositions(currentState.playerCount), currentScale);
  }
}

// ── Render ────────────────────────────────────────────────────────────────────

function render(state) {
  updateTravelerSheetSelection(state.travelerSheetColumn);

  const sheet = document.getElementById('traveler-table');
  if (sheet) {
    sheet.style.pointerEvents = state.phase === 'setup' ? 'auto' : 'none';
    sheet.style.cursor        = state.phase === 'setup' ? 'pointer' : 'default';
  }

  renderBoard(state, flipToken, removeGhostVote, updatePlayerName);

  if (state.phase === 'active' && state.playerCount) {
    updateDragTargets(computeSeatPositions(state.playerCount), currentScale);
  } else {
    disableDrag();
  }

  const btnStart = document.getElementById('btn-start');
  const btnReset = document.getElementById('btn-reset');
  const btnUndo  = document.getElementById('btn-undo');

  if (state.phase === 'setup') {
    btnStart.style.display = 'flex';
    btnReset.style.display = 'none';
    btnUndo.style.display  = 'none';
    btnStart.disabled      = !state.playerCount;
  } else {
    btnStart.style.display = 'none';
    btnReset.style.display = 'flex';
    btnUndo.style.display  = 'flex';
  }
}

// ── Edition panel ──────────────────────────────────────────────────────────────

const TROUBLE_BREWING = {
  townsfolk: [
    { name: 'Washerwoman',    icon: 'washerwoman.svg',    desc: 'You start knowing that 1 of 2 players is a particular Townsfolk.' },
    { name: 'Librarian',      icon: 'librarian.svg',      desc: 'You start knowing that 1 of 2 players is a particular Outsider. (Or that 0 are in play.)' },
    { name: 'Investigator',   icon: 'Investigator.svg',   desc: 'You start knowing that 1 of 2 players is a particular Minion.' },
    { name: 'Chef',           icon: 'chef.svg',           desc: 'You start knowing how many pairs of evil players there are.' },
    { name: 'Empath',         icon: 'empath.svg',         desc: 'Each night, you learn how many of your 2 alive neighbours are evil.' },
    { name: 'Fortune Teller', icon: 'fortune-teller.svg', desc: 'Each night, choose 2 players: you learn if either is the Demon. A good player registers as a Demon to you.' },
    { name: 'Undertaker',     icon: 'undertaker.svg',     desc: 'Each night*, you learn which character died by execution today.' },
    { name: 'Monk',           icon: 'monk.svg',           desc: 'Each night*, choose a player (not yourself): they are safe from the Demon tonight.' },
    { name: 'Ravenkeeper',    icon: 'ravenkeeper.svg',    desc: 'If you die at night, choose a player: you learn their character.' },
    { name: 'Virgin',         icon: 'virgin.svg',         desc: 'The 1st time you are nominated, if the nominator is a Townsfolk, they are immediately executed.' },
    { name: 'Slayer',         icon: 'slayer.svg',         desc: 'Once per game, during the day, publicly choose a player: if they are the Demon, they die.' },
    { name: 'Soldier',        icon: 'soldier.svg',        desc: 'You are safe from the Demon.' },
    { name: 'Mayor',          icon: 'mayor.svg',          desc: 'If only 3 players live & no execution occurs, your team wins. If you die at night, another player might die instead.' },
  ],
  outsiders: [
    { name: 'Butler',  icon: 'butler.svg',  desc: 'Each night, choose a player (not yourself): tomorrow, you may only vote if they are voting too.' },
    { name: 'Drunk',   icon: 'drunk.svg',   desc: 'You do not know you are the Drunk. You think you are a Townsfolk, but your ability malfunctions.' },
    { name: 'Recluse', icon: 'recluse.svg', desc: 'You might register as evil & as a Minion or Demon, even if dead.' },
    { name: 'Saint',   icon: 'saint.svg',   desc: 'If you die by execution, your team loses.' },
  ],
  minions: [
    { name: 'Poisoner',      icon: 'poisoner.svg',      desc: 'Each night, choose a player: they are poisoned tonight and tomorrow day.' },
    { name: 'Spy',           icon: 'spy.svg',           desc: 'Each night, you see the Grimoire. You might register as good & as a Townsfolk or Outsider, even if dead.' },
    { name: 'Scarlet Woman', icon: 'scarlet-woman.svg', desc: 'If there are 5+ players alive & the Demon dies, you become the Demon.' },
    { name: 'Baron',         icon: 'baron.svg',         desc: 'There are extra 2 Outsiders in this game.' },
  ],
  demon: [
    { name: 'Imp', icon: 'Imp.svg', desc: 'Each night*, choose a player: they die. If you kill yourself this way, a Minion becomes the Imp.' },
  ],
};

function buildEditionPanel() {
  const panel = document.getElementById('edition-panel');

  const bg  = document.createElement('img');
  bg.id     = 'edition-panel-bg';
  bg.src    = 'edition-panel-bg.png';
  bg.draggable = false;

  const content = document.createElement('div');
  content.id = 'edition-panel-content';

  const title = document.createElement('div');
  title.className   = 'edition-title';
  title.textContent = 'Trouble Brewing';
  content.appendChild(title);

  const chars = document.createElement('div');
  chars.className = 'edition-chars';

  function addSection(heading, cls, characters) {
    const h = document.createElement('div');
    h.className   = `edition-section-heading ${cls}`;
    h.textContent = heading;
    chars.appendChild(h);
    characters.forEach(char => {
      const row = document.createElement('div');
      row.className = 'edition-char-row';

      const nameEl = document.createElement('div');
      nameEl.className   = `char-name ${cls}`;
      nameEl.textContent = char.name;

      const iconEl = document.createElement('img');
      iconEl.className = 'char-icon';
      iconEl.src       = `icons/${char.icon}`;
      iconEl.alt       = '';
      iconEl.draggable = false;

      const descEl = document.createElement('div');
      descEl.className   = 'char-desc';
      descEl.textContent = char.desc;

      row.append(nameEl, iconEl, descEl);
      chars.appendChild(row);
    });
  }

  addSection('Townsfolk', 'tf', TROUBLE_BREWING.townsfolk);
  addSection('Outsiders', 'os', TROUBLE_BREWING.outsiders);
  addSection('Minions',   'mn', TROUBLE_BREWING.minions);
  addSection('Demon',     'dm', TROUBLE_BREWING.demon);

  const footer = document.createElement('div');
  footer.className   = 'edition-footer';
  footer.textContent = '*Not the first night';

  content.append(chars, footer);
  panel.append(bg, content);
}

// ── Boot ──────────────────────────────────────────────────────────────────────

function init() {
  buildTravelerSheet(selectTravelerColumn);
  buildEditionPanel();

  document.getElementById('btn-start').addEventListener('click', startGame);
  document.getElementById('btn-reset').addEventListener('click', initiateReset);
  document.getElementById('btn-undo').addEventListener('click', performUndo);
  document.getElementById('btn-reset-confirm').addEventListener('click', confirmReset);
  document.getElementById('btn-reset-cancel').addEventListener('click', cancelReset);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cancelReset(); });

  document.getElementById('clock-face-btn').addEventListener('click', () => {
    set(bellRef, Date.now());
  });

  // Unlock audio on first interaction so Firebase-triggered plays work cross-client
  document.addEventListener('click', () => {
    bellAudio.muted = true;
    bellAudio.play().then(() => {
      bellAudio.pause();
      bellAudio.currentTime = 0;
      bellAudio.muted = false;
    }).catch(() => {});
  }, { once: true });

  let bellReady = false;
  onValue(bellRef, () => {
    if (!bellReady) { bellReady = true; return; }
    bellAudio.currentTime = 0;
    bellAudio.play().catch(() => {});
  });

  window.addEventListener('resize', updateScale);
  updateScale();

  initDrag(handleDragEnd);

  // Seed empty state if database is empty, then subscribe
  get(gameRef).then(snapshot => {
    if (!snapshot.val()) set(gameRef, emptySetupState());
  });

  onValue(gameRef, (snapshot) => {
    currentState = snapshot.val() || emptySetupState();
    if (!currentState.phase) currentState = emptySetupState();
    render(currentState);
    syncUndoButton();
  });
}

document.addEventListener('DOMContentLoaded', init);
