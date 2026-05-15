const BOARD_CENTER_X = 675;
const BOARD_CENTER_Y = 527;
const BOARD_RADIUS   = 444;
const TOKEN_SIZE     = 100;

export function computeSeatPositions(playerCount) {
  const positions = [];
  for (let i = 0; i < playerCount; i++) {
    const angle = (2 * Math.PI / playerCount) * (i + 0.5) - Math.PI / 2;
    positions.push({
      x: BOARD_CENTER_X + BOARD_RADIUS * Math.cos(angle),
      y: BOARD_CENTER_Y + BOARD_RADIUS * Math.sin(angle),
    });
  }
  return positions;
}

export function renderBoard(state, onTokenClick, onGhostClick, onNameBlur) {
  const board = document.getElementById('board');

  board.querySelectorAll('.player-seat').forEach(el => el.remove());

  if (!state || !state.playerCount || !state.players) return;

  const positions = computeSeatPositions(state.playerCount);

  state.players.forEach(player => {
    const pos = positions[player.seatIndex];
    if (!pos) return;
    board.appendChild(buildSeat(player, pos, state.phase, onTokenClick, onGhostClick, onNameBlur));
  });

  if (state.phase === 'active') {
    board.classList.add('board-active');
  } else {
    board.classList.remove('board-active');
  }
}

function buildSeat(player, pos, phase, onTokenClick, onGhostClick, onNameBlur) {
  const seat = document.createElement('div');
  seat.className = 'player-seat';
  seat.dataset.id = player.id;
  seat.style.left = Math.round(pos.x - TOKEN_SIZE / 2) + 'px';
  seat.style.top  = Math.round(pos.y - TOKEN_SIZE / 2) + 'px';

  if (player.status === 'dead') seat.classList.add('dead');
  if (player.hasVoteToken)      seat.classList.add('has-vote');

  const wrapper = document.createElement('div');
  wrapper.className = 'life-token-wrapper';

  const backing  = document.createElement('div');
  backing.className = 'token-backing';

  const shroud   = document.createElement('div');
  shroud.className = 'shroud-ring';

  const aliveImg = document.createElement('img');
  aliveImg.className = 'token-face alive-img';
  aliveImg.src = 'token-alive.png';
  aliveImg.draggable = false;

  const deadImg  = document.createElement('img');
  deadImg.className = 'token-face dead-img';
  deadImg.src = 'token-dead.png';
  deadImg.draggable = false;

  const ghost    = document.createElement('div');
  ghost.className = 'ghost-token';
  const ghostImg = document.createElement('img');
  ghostImg.src = 'token-ghost.png';
  ghostImg.draggable = false;
  ghost.appendChild(ghostImg);

  wrapper.append(backing, shroud, aliveImg, deadImg, ghost);

  if (phase === 'active') {
    wrapper.addEventListener('click', (e) => {
      if (e.target.closest('.ghost-token')) return;
      onTokenClick(player.id);
    });
    ghost.addEventListener('click', (e) => {
      e.stopPropagation();
      onGhostClick(player.id);
    });
  }

  const banner = document.createElement('div');
  banner.className = 'name-banner';
  const input = document.createElement('input');
  input.type = 'text';
  input.maxLength = 14;
  input.placeholder = 'player';
  input.value = player.name || '';
  input.addEventListener('blur', () => onNameBlur(player.id, input.value));
  banner.appendChild(input);

  seat.append(wrapper, banner);
  return seat;
}
