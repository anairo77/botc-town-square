const TRAVELER_DATA = [
  { players: 5,     townsfolk: 3, outsiders: 0, minions: 1, demons: 1 },
  { players: 6,     townsfolk: 3, outsiders: 1, minions: 1, demons: 1 },
  { players: 7,     townsfolk: 5, outsiders: 0, minions: 1, demons: 1 },
  { players: 8,     townsfolk: 5, outsiders: 1, minions: 1, demons: 1 },
  { players: 9,     townsfolk: 5, outsiders: 2, minions: 1, demons: 1 },
  { players: 10,    townsfolk: 7, outsiders: 0, minions: 2, demons: 1 },
  { players: 11,    townsfolk: 7, outsiders: 1, minions: 2, demons: 1 },
  { players: 12,    townsfolk: 7, outsiders: 2, minions: 2, demons: 1 },
  { players: 13,    townsfolk: 9, outsiders: 0, minions: 3, demons: 1 },
  { players: 14,    townsfolk: 9, outsiders: 1, minions: 3, demons: 1 },
  { players: '15+', townsfolk: 9, outsiders: 2, minions: 3, demons: 1 },
];

export function columnIndexForCount(playerCount) {
  if (playerCount >= 15) return 10;
  return playerCount - 5;
}

export function buildTravelerSheet(onColumnClick) {
  const container = document.getElementById('traveler-sheet');

  const bg  = document.createElement('img');
  bg.id     = 'traveler-sheet-bg';
  bg.src    = 'traveler-sheet-bg.png';
  bg.draggable = false;

  const inner = document.createElement('div');
  inner.id = 'traveler-sheet-inner';

  const content = document.createElement('div');
  content.id = 'traveler-content';

  const highlight = document.createElement('div');
  highlight.className = 'col-highlight';
  highlight.id = 'col-highlight';

  const table = document.createElement('table');
  table.id = 'traveler-table';

  // Give the row-label column enough room for "townsfolk" / "outsiders"
  const colgroup = document.createElement('colgroup');
  const labelCol = document.createElement('col');
  labelCol.style.width = '68px';
  colgroup.appendChild(labelCol);
  table.appendChild(colgroup);

  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  headerRow.appendChild(document.createElement('th')); // label cell
  TRAVELER_DATA.forEach((row, i) => {
    const th = document.createElement('th');
    th.textContent   = row.players;
    th.dataset.colIndex = i;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  [
    { key: 'townsfolk', label: 'townsfolk', cls: 'tf' },
    { key: 'outsiders', label: 'outsiders', cls: 'os' },
    { key: 'minions',   label: 'minions',   cls: 'mn' },
    { key: 'demons',    label: 'demons',    cls: 'dm' },
  ].forEach(({ key, label, cls }) => {
    const tr = document.createElement('tr');
    const labelTd = document.createElement('td');
    labelTd.className   = 'row-label';
    labelTd.textContent = label;
    tr.appendChild(labelTd);
    TRAVELER_DATA.forEach((row, i) => {
      const td = document.createElement('td');
      td.className        = cls;
      td.textContent      = row[key];
      td.dataset.colIndex = i;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  table.addEventListener('click', (e) => {
    const col = e.target.dataset.colIndex;
    if (col !== undefined) onColumnClick(parseInt(col, 10));
  });

  content.append(highlight, table);
  container.append(bg, inner, content);
}

export function updateTravelerSheetSelection(selectedColIndex) {
  const table     = document.getElementById('traveler-table');
  const highlight = document.getElementById('col-highlight');
  if (!table) return;

  if (selectedColIndex === null || selectedColIndex === undefined) {
    highlight.classList.remove('visible');
    return;
  }

  // +1 skips the label <th> in the header row
  const headerCells = table.querySelectorAll('thead th');
  const targetCell  = headerCells[selectedColIndex + 1];
  if (!targetCell) return;

  // Both highlight and table are inside #traveler-content, so
  // table.offsetLeft + targetCell.offsetLeft gives position within that container
  highlight.style.left  = (table.offsetLeft + targetCell.offsetLeft) + 'px';
  highlight.style.width = targetCell.offsetWidth + 'px';
  highlight.classList.add('visible');
}
