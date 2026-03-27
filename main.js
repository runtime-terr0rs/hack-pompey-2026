//  CLASSES
class Player {
  constructor() {
    this.gold = 200;
    this.playerName;
    this.outpostCoords = {x: 0, y: 0}
  }

  get getGold () {
    return this.gold;
  }

  set setGold(gold) {
    this.getGold = gold;
  }
}

class Units {
  constructor(type) {
    this.type = type;
    this.strength = UNIT_TYPES[type].strength;
    this.health = UNIT_TYPES[type].health;
    this.defence = UNIT_TYPES[type].defence;
    this.pos = {x: 0, y: 0};
    this.unitColour = UNIT_TYPES[type].unitColour;
  } 

  get getType() {
    return this.type;
  }

  get getStrength() {
    return this.strength;
  }

  get getHealth() {
    return this.health;
  } 

  get getDefence() {
    return this.defence;
  }

  get getPos() {
    return this.pos;
  }

  get getUnitColour() {
    return this.unitColour;
  }

  set setPos(pos) {
    this.pos = pos;
  }

  set setHealth(health) {
    this.health = health;
  }
}

//  CONSTANTS
const COLS = 17;
const ROWS = 12;
const HEX_SIZE = 38; // flat-top: distance from centre to corner

const TILE_TYPES = {
  outpost: { label: 'Outpost',   gold: 10, def: 5,  color: '#273041', sel: '#54778a' },
  plains:  { label: 'Plains',    gold: 1,  def: 0,  color: '#c4ad9e', sel: '#ede9e7' },
  wastes:  { label: 'Wastes',    gold: 0,  def: 2,  color: '#596c48', sel: '#86a966' },
  dunes:   { label: 'Dunes',     gold: 0,  def: 3,  color: '#813D30', sel: '#b17467' },
  mines:   { label: 'Mines',     gold: 5,  def: 0,  color: '#9A6546', sel: '#aa8b79' },
  scav:    { label: 'Scav Site', gold: 20, def: 0,  color: '#362d27', sel: '#aa8b79' },
};

const UNIT_TYPES = {
  worker: { label: 'Worker', cost: 50, strength: 1, health: 1, defence: 0, unitColour: '#f0c674' },
  soldier: { label: 'Soldier', cost: 100, strength: 3, health: 3, defence: 2, unitColour: '#c94e50' },
};

const GAME_STATE = {
  turn: 1,
  currentPlayerIndex: 0,
  players: [
    {id: 1, playerName: 'Player 1', data: new Player()},
    {id: 2, playerName: 'Player 2', data: new Player()},
    {id: 3, playerName: 'Player 3', data: new Player()},
    {id: 4, playerName: 'Player 4', data: new Player()},
  ]
};
//  MAP GENERATION

function seededRand(seed) {
    let s = seed;
    return () => {
        s = (s * 1664525 + 1013904223) & 0xffffffff;
        return (s >>> 0) / 0xffffffff;
    };
}

function generateMap(seed = 42, numPlayers = 4) {
  const rand = seededRand(seed);
  const tiles = [];
  const citySet = new Set();
  const cityCols = [2, 14, 14, 2,];
  const cityRows = [2, 9, 2, 9];

  
  for (let i = 0; i < numPlayers; i++) {
    const citycol = cityCols[i] + Math.floor((Math.random() - 0.5) * 3);
    const cityrow = cityRows[i] + Math.floor((Math.random() - 0.5) * 3);;
    const key = `${citycol},${cityrow}`;
    GAME_STATE.players[i].data.outpostCoords = {x: citycol, y: cityrow};
    citySet.add(key);
  }


    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        let type;
        let playerId = null;
        const key = `${c},${r}`;
        // Weighted random terrain for mainland
        if (citySet.has(key)) {
          type = 'outpost';
          GAME_STATE.players.forEach(player => {
            if (player.data.outpostCoords.x === c && player.data.outpostCoords.y === r) {
              playerId = player.id;
            }
          });
        }
        else {
          const v = rand();
          const isEdge = c === 0 || c === COLS-1 || r === 0 || r === ROWS-1;
          if (isEdge) {
              type = 'plains';
          } else if (v < 0.35) {
              type = 'plains';
          } else if (v < 0.60) {
              type = 'wastes';
          } else if (v < 0.80) {
              type = 'dunes';
          } else if (v < 0.90) {
              type = 'mines';
          } else if (v < 0.95) {
              type = 'scav';
          } else {
              type = 'plains';
          }
        }
          tiles.push({ col: c, row: r, type, owner: playerId, units: [], buildings: [] });

      }
    }
    return tiles;
}

//  GEOMETRY
function hexCenter(col, row, size) {
  const w = 2 * size;
  const h = Math.sqrt(3) * size;
  const x = col * (w * 0.75) + size;
  const y = row * h + (col % 2 === 0 ? h / 2 : 0) + h / 2;
  return { x, y };
}

function hexCorners(cx, cy, size) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i;
    pts.push({ x: cx + size * Math.cos(angle), y: cy + size * Math.sin(angle) });
  }
  return pts;
}

function pixelToHex(px, py, size, offsetX, offsetY) {
  // Invert the camera transform first
  const wx = (px - offsetX) / size;
  const wy = (py - offsetY) / size;

  // Brute-force nearest hex (fine for this grid size)
  let bestCol = 0, bestRow = 0, bestDist = Infinity;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const ctr = hexCenter(c, r, 1); // normalised
      const dx = wx - ctr.x;
      const dy = wy - ctr.y;
      const d = dx*dx + dy*dy;
      if (d < bestDist) { bestDist = d; bestCol = c; bestRow = r; }
    }
  }
  return { col: bestCol, row: bestRow };
}

//  TURN STATE
function advanceTurn() {
  GAME_STATE.currentPlayerIndex = (GAME_STATE.currentPlayerIndex + 1) % GAME_STATE.players.length;
  
  if (GAME_STATE.currentPlayerIndex === 0) {
    GAME_STATE.turn++;
  }
  
  document.querySelector('#turn-number').textContent = GAME_STATE.turn;
  document.querySelector('#player-name').textContent = GAME_STATE.players[GAME_STATE.currentPlayerIndex].playerName;
}

//  CAMERA STATE
const cam = {
  x: 0, y: 0,
  zoom: 1,
  dragging: false,
  dragStartX: 0, dragStartY: 0,
  camStartX: 0, camStartY: 0,
  hasDragged: false,
};

//  RENDER
const canvas = document.getElementById('map');
const ctx = canvas.getContext('2d');

let tiles = generateMap(Date.now());
let selectedTile = null;

function resize() {
  canvas.width  = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;

  // Centre map on first load
  const mapW = COLS * HEX_SIZE * 1.5 + HEX_SIZE * 0.5;
  const mapH = (ROWS + 0.5) * Math.sqrt(3) * HEX_SIZE;
  cam.x = (canvas.width  - mapW) / 2;
  cam.y = (canvas.height - mapH) / 2;

  draw();
}

function drawHex(ctx, cx, cy, size, fillColor, strokeColor, strokeWidth = 1) {
  const pts = hexCorners(cx, cy, size - 1);
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < 6; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.fillStyle = fillColor;
  ctx.fill();
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = strokeWidth;
  ctx.stroke();
}

function drawUnits(ctx, units, x, y) {
  const unitSize = 10;
  const radius = 15;
  const angleStep = (2 * Math.PI) / units.length;
  let angle = 0;
  for (const unit of units) {
    const unitX = x + radius * Math.cos(angle);
    const unitY = y + radius * Math.sin(angle);
    ctx.fillStyle = unit.getUnitColour;
    ctx.beginPath();
    ctx.arc(unitX, unitY, unitSize / 2, 0, 2 * Math.PI);
    ctx.fill();
    angle += angleStep;
  }
}

function draw() {
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  // Background
  ctx.fillStyle = '#080e14';
  ctx.fillRect(0, 0, W, H);

  // Subtle grid-paper texture
  ctx.save();
  ctx.globalAlpha = 0.03;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 0.5;
  for (let x = 0; x < W; x += 20) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
  for (let y = 0; y < H; y += 20) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
  ctx.restore();

  ctx.save();
  ctx.translate(cam.x, cam.y);
  ctx.scale(cam.zoom, cam.zoom);

  const size = HEX_SIZE;

  for (const tile of tiles) {
    const { x, y } = hexCenter(tile.col, tile.row, size);
    const tdata = TILE_TYPES[tile.type];
    const isSelected = selectedTile && selectedTile.col === tile.col && selectedTile.row === tile.row;

    const fill   = isSelected ? tdata.sel : tdata.color;
    const stroke = isSelected ? '#e8d5a0' : '#1a2a1a';
    const sw     = isSelected ? 2.5 : 1;

    drawHex(ctx, x, y, size, fill, stroke, sw);

    // Draw units on tile
    if (tile.units.length > 0) {
      drawUnits(ctx, tile.units, x, y);
    }

    // Selected glow ring
    if (isSelected) {
      const pts = hexCorners(x, y, size - 1);
      ctx.save();
      ctx.shadowColor = '#e8d5a0';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < 6; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.closePath();
      ctx.strokeStyle = '#e8d5a0';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
  }

  ctx.restore();
}

//  INFO PANEL

function updatePanel(tile) {
  const panel = document.getElementById('tile-info');
  if (!tile) {
    panel.innerHTML = '<p class="no-selection">Click a tile to inspect it.</p>';
    return;
  }
  const td = TILE_TYPES[tile.type];
  panel.innerHTML = `
    <div class="coord-display">${tile.col}, ${tile.row}</div>
    <span class="tile-type-badge badge-${tile.type}">${td.label}</span>
    <div class="info-row">
      <span class="info-label">Gold / turn</span>
      <span class="info-val">${td.gold > 0 ? '+' + td.gold + 'g' : '—'}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Defence bonus</span>
      <span class="info-val">${td.def > 0 ? '+' + td.def : '—'}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Passable</span>
      <span class="info-val">${tile.type === 'water' ? 'Water only' : 'Yes'}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Owner</span>
      <span class="info-val">${tile.owner || 'Neutral'}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Units</span>
      <span class="info-val">${tile.units.length || '—'}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Buildings</span>
      <span class="info-val">${tile.buildings.length || '—'}</span>
    </div>
  `;

  if (tile.type.toLowerCase() === TILE_TYPES.outpost.label.toLowerCase()) {
    panel.innerHTML += `
      <div class="panel-header">Outpost Operations</div>
      <div class="info-row">
        <span class="info-label">train troops</span>
        <span class="info-val">
        <button class="info-btn" id="train-troops-btn" onclick="addTroops()">Train</button>
        </span>
      </div>
      <div class="info-row">
        <span class="info-label">create workers</span>
        <span class="info-val">
        <button class="info-btn" id="create-workers-btn" onclick="createWorkers()">Create</button>
        </span>
      </div>
    `;
    
  }
}

//  INPUT
canvas.addEventListener('mousedown', e => {
  cam.dragging   = true;
  cam.hasDragged = false;
  cam.dragStartX = e.clientX;
  cam.dragStartY = e.clientY;
  cam.camStartX  = cam.x;
  cam.camStartY  = cam.y;
  canvas.classList.add('dragging');
});

canvas.addEventListener('mousemove', e => {
  if (!cam.dragging) return;
  const dx = e.clientX - cam.dragStartX;
  const dy = e.clientY - cam.dragStartY;
  if (Math.abs(dx) > 3 || Math.abs(dy) > 3) cam.hasDragged = true;
  cam.x = cam.camStartX + dx;
  cam.y = cam.camStartY + dy;
  draw();
});

canvas.addEventListener('mouseup', e => {
  canvas.classList.remove('dragging');
  if (!cam.hasDragged) {
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const { col, row } = pixelToHex(px, py, HEX_SIZE * cam.zoom, cam.x, cam.y);
    const tile = tiles.find(t => t.col === col && t.row === row);
    if (tile) {
      selectedTile = (selectedTile && selectedTile.col === col && selectedTile.row === row) ? null : tile;
      updatePanel(selectedTile);
      draw();
    }
  }
  cam.dragging = false;
});

canvas.addEventListener('mouseleave', () => {
  cam.dragging = false;
  canvas.classList.remove('dragging');
});

canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const factor = e.deltaY < 0 ? 1.1 : 0.91;
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  cam.x = mx - (mx - cam.x) * factor;
  cam.y = my - (my - cam.y) * factor;
  cam.zoom = Math.max(0.35, Math.min(3, cam.zoom * factor));
  draw();
}, { passive: false });

function addTroops() {
  let unit = new Units('soldier');
  unit.setPos = {x: selectedTile.col, y: selectedTile.row};
  selectedTile.units.push(unit);
  updatePanel(selectedTile);
  draw();
}

function createWorkers() {
  let unit = new Units('worker');
  unit.setPos = {x: selectedTile.col, y: selectedTile.row};
  selectedTile.units.push(unit);
  updatePanel(selectedTile);
  draw();
};

// Event listeners
document.querySelector('#end-turn-btn').addEventListener('click', () => {
  advanceTurn();
});

//  INIT
window.addEventListener('resize', () => { resize(); });
resize();

document.querySelector('#player-name').textContent = GAME_STATE.players[0].playerName;