const SVG_NS = 'http://www.w3.org/2000/svg';

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

// Arc follows the banner ribbon's own downward bow
const BANNER_ARC = 'M10,19 C30,22 60,22 80,19';

function buildNameBanner(player, onNameBlur) {
  const banner = document.createElement('div');
  banner.className = 'name-banner';

  // Thin SVG overlay — only provides the curved textPath; banner graphic comes from CSS background-image
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', '90');
  svg.setAttribute('height', '29');
  svg.setAttribute('viewBox', '0 0 90 29');
  svg.classList.add('name-text-svg');

  const defs = document.createElementNS(SVG_NS, 'defs');
  const arcId = `arc-${player.id}`;
  const arcDef = document.createElementNS(SVG_NS, 'path');
  arcDef.setAttribute('id', arcId);
  arcDef.setAttribute('d', BANNER_ARC);
  arcDef.setAttribute('fill', 'none');
  defs.appendChild(arcDef);
  svg.appendChild(defs);

  const textEl = document.createElementNS(SVG_NS, 'text');
  textEl.setAttribute('font-family', "'libra-mn', Georgia, serif");
  textEl.setAttribute('font-size', '11');

  const textPathEl = document.createElementNS(SVG_NS, 'textPath');
  textPathEl.setAttribute('href', `#${arcId}`);
  textPathEl.setAttribute('startOffset', '50%');
  textPathEl.setAttribute('text-anchor', 'middle');
  textPathEl.setAttribute('fill', player.name ? '#F4EFDC' : 'rgba(244,239,220,0.45)');
  textPathEl.textContent = player.name || 'player';
  textEl.appendChild(textPathEl);
  svg.appendChild(textEl);

  const input = document.createElement('input');
  input.type = 'text';
  input.maxLength = 14;
  input.value = player.name || '';
  input.className = 'name-banner-input';

  banner.addEventListener('click', () => input.focus());

  input.addEventListener('focus', () => {
    textEl.setAttribute('visibility', 'hidden');
    input.style.opacity = '1';
    input.style.pointerEvents = 'auto';
  });

  input.addEventListener('blur', () => {
    textPathEl.textContent = input.value || 'player';
    textPathEl.setAttribute('fill', input.value ? '#F4EFDC' : 'rgba(244,239,220,0.45)');
    textEl.setAttribute('visibility', 'visible');
    input.style.opacity = '0';
    input.style.pointerEvents = 'none';
    onNameBlur(player.id, input.value);
  });

  banner.append(svg, input);
  return banner;
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

  seat.append(wrapper, buildNameBanner(player, onNameBlur));
  return seat;
}
