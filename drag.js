// interact is loaded as a global via the plain <script> tag in index.html
/* global interact */

let currentScale     = 1;
let currentPositions = [];
let onDragEnd        = null;

export function initDrag(onEnd) {
  onDragEnd = onEnd;
}

export function updateDragTargets(seatPositions, scale) {
  currentScale     = scale;
  currentPositions = seatPositions;

  const snapTargets = seatPositions.map(p => ({
    x: p.x * scale,
    y: p.y * scale,
  }));

  interact('.player-seat').draggable({
    listeners: {
      start(event) {
        event.target.classList.add('dragging');
      },
      move(event) {
        const seat = event.target;
        const dx   = (parseFloat(seat.dataset.dx) || 0) + event.dx;
        const dy   = (parseFloat(seat.dataset.dy) || 0) + event.dy;
        seat.dataset.dx = dx;
        seat.dataset.dy = dy;
        seat.style.transform = `translate(${dx}px, ${dy}px)`;
      },
      end(event) {
        const seat    = event.target;
        const baseX   = parseFloat(seat.style.left);
        const baseY   = parseFloat(seat.style.top);
        const dx      = parseFloat(seat.dataset.dx) || 0;
        const dy      = parseFloat(seat.dataset.dy) || 0;
        const boardX  = baseX + 50 + dx / currentScale;
        const boardY  = baseY + 50 + dy / currentScale;

        let nearest  = 0;
        let minDist  = Infinity;
        currentPositions.forEach((p, i) => {
          const d = Math.hypot(p.x - boardX, p.y - boardY);
          if (d < minDist) { minDist = d; nearest = i; }
        });

        seat.classList.remove('dragging');
        seat.style.transform = '';
        seat.dataset.dx = 0;
        seat.dataset.dy = 0;

        if (onDragEnd) {
          onDragEnd(parseInt(seat.dataset.id, 10), nearest);
        }
      },
    },
    modifiers: [
      interact.modifiers.snap({
        targets: snapTargets,
        range:   Infinity,
        relativePoints: [{ x: 0.5, y: 0.5 }],
        offset: 'startCoords',
      }),
      interact.modifiers.restrict({
        restriction: '#board-wrapper',
        endOnly:     true,
      }),
    ],
  });
}

export function disableDrag() {
  interact('.player-seat').draggable(false);
}
