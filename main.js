//  CLASSES
class Player {
  constructor() {
    this.gold = 15;
    this.outpostCoords = {x: 0, y: 0};
    this.colour;
    this.defeated = false;
  }

  get getGold () {
    return this.gold;
  }

  set setGold(gold) {
    this.getGold = gold;
  }

  set setUnitColour(colour) {
    this.colour = colour;
  } 

  get getUnitColour() {
    return this.colour;
  }
}

class Units {
  constructor(type, owner = null) {
    this.type = type;
    this.owner = owner;
    this.strength = UNIT_TYPES[type].strength;
    this.health = UNIT_TYPES[type].health;
    this.defence = UNIT_TYPES[type].defence;
    this.pos = {x: 0, y: 0};
    this.unitColour = UNIT_TYPES[type].unitColour;
    this.movement = 0;
    this.maxMovement = UNIT_TYPES[type].maxMovement;
  } 

  get getType()        { return this.type; }
  get getStrength()    { return this.strength; }
  get getHealth()      { return this.health; }
  get getDefence()     { return this.defence; }
  get getPos()         { return this.pos; }
  get getUnitColour()  { return this.unitColour; }
  get getOwner()       { return this.owner; }
  get getMovement()    { return this.movement; }
  get getMaxMovement() { return this.maxMovement; }

  set setPos(pos)       { this.pos = pos; }
  set setHealth(health) { this.health = health; }
  set setOwner(owner)   { this.owner = owner; }
  set setMovement(move) { this.movement = move; }
}

//  CONSTANTS
const COLS = 17;
const ROWS = 12;
const HEX_SIZE = 38; // flat-top: distance from centre to corner

const TILE_TYPES = {
  outpost: { label: 'OpenArmy Barracks',   gold: 10, def: 5,  color: '#273041', sel: '#54778a' },
  plains:  { label: 'AI Data Center Flood Plains',    gold: 1,  def: 0,  color: '#c4ad9e', sel: '#ede9e7' },
  wastes:  { label: 'Vape Zeppelin Factories',    gold: 0,  def: 2,  color: '#596c48', sel: '#86a966' },
  dunes:   { label: "Flying Car Dealerships",     gold: 0,  def: 3,  color: '#813D30', sel: '#b17467' },
  mines:   { label: 'Caffeine Glaciers',     gold: 5,  def: 0,  color: '#9A6546', sel: '#aa8b79' },
  scav:    { label: 'Alien Caverns', gold: 20, def: 0,  color: '#362d27', sel: '#aa8b79' },
};

const UNIT_TYPES = {
  worker:  { label: 'Worker',  cost: 50,  strength: 1, health: 1, defence: 0, unitColour: '#f0c674', maxMovement: 3 },
  soldier: { label: 'Soldier', cost: 100, strength: 3, health: 3, defence: 2, unitColour: '#c94e50', maxMovement: 2 },
};

const GAME_STATE = {
  turn: 1,
  currentPlayerIndex: 0,
  players: [
    {id: 1, playerName: 'The Spinnaker Scalers', data: (() => { let p = new Player(); p.setUnitColour = '#0010f7'; return p; })()},
    {id: 2, playerName: "So'ton & Slimes", data: (() => { let p = new Player(); p.setUnitColour = '#e100ff'; return p; })()},
    {id: 3, playerName: 'M27 ghouls', data: (() => { let p = new Player(); p.setUnitColour = '#00ac0e'; return p; })()},
    // {id: 4, playerName: 'The Hovercraft Heretics', data: (() => { let p = new Player(); p.setUnitColour = '#ffee00'; return p; })()},
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

function generateMap(seed = 42, numPlayers = 3) {
  const rand = seededRand(seed);
  const tiles = [];
  const citySet = new Set();
  const cityCols = [2, 14, 14, 2];
  const cityRows = [2, 9,  2,  9];

  for (let i = 0; i < numPlayers; i++) {
    const citycol = cityCols[i] + Math.floor((Math.random() - 0.5) * 3);
    const cityrow = cityRows[i] + Math.floor((Math.random() - 0.5) * 3);
    const key = `${citycol},${cityrow}`;
    GAME_STATE.players[i].data.outpostCoords = {x: citycol, y: cityrow};
    citySet.add(key);
  }

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      let type;
      let playerName = null;
      const key = `${c},${r}`;
      if (citySet.has(key)) {
        type = 'outpost';
        GAME_STATE.players.forEach(player => {
          if (player.data.outpostCoords.x === c && player.data.outpostCoords.y === r) {
            playerName = player.playerName;
          }
        });
      } else {
        const v = rand();
        const isEdge = c === 0 || c === COLS-1 || r === 0 || r === ROWS-1;
        if      (isEdge)   type = 'plains';
        else if (v < 0.35) type = 'plains';
        else if (v < 0.60) type = 'wastes';
        else if (v < 0.80) type = 'dunes';
        else if (v < 0.90) type = 'mines';
        else if (v < 0.95) type = 'scav';
        else               type = 'plains';
      }
      tiles.push({ col: c, row: r, type, owner: playerName, units: [], buildings: [] });
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

function pointInPolygon(x, y, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function pixelToHex(px, py, size, zoom, offsetX, offsetY) {
  const wx = (px - offsetX) / (size * zoom);
  const wy = (py - offsetY) / (size * zoom);

  // Exact hex containment test first.
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const ctr = hexCenter(c, r, 1);
      const corners = hexCorners(ctr.x, ctr.y, 1);
      if (pointInPolygon(wx, wy, corners)) {
        return { col: c, row: r };
      }
    }
  }

  // Fallback to closest center (handling precision or boundaries).
  let bestCol = 0, bestRow = 0, bestDist = Infinity;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const ctr = hexCenter(c, r, 1);
      const dx = wx - ctr.x;
      const dy = wy - ctr.y;
      const d = dx*dx + dy*dy;
      if (d < bestDist) { bestDist = d; bestCol = c; bestRow = r; }
    }
  }
  return { col: bestCol, row: bestRow };
}

function getTileNeighbours(col, row) {
  // Returns up to 6 neighbouring tiles in a flat-top hex grid.
  // Edge tiles (borders) may have fewer than 6 valid neighbours.
  // With even columns shifted down in y, diagonal moves invert parity.
  const dirs = col % 2 === 0
    ? [[1,0],[-1,0],[0,-1],[0,1],[1,1],[-1,1]]
    : [[1,0],[-1,0],[0,-1],[0,1],[1,-1],[-1,-1]];
  return dirs
    .map(([dc, dr]) => ({ col: col + dc, row: row + dr }))
    .filter(n => n.col >= 0 && n.col < COLS && n.row >= 0 && n.row < ROWS);
}

function getReachableTiles(startCol, startRow, movement) {
  const reachable = new Set();
  if (movement <= 0) return reachable;

  const visited = new Set([`${startCol},${startRow}`]);
  const queue = [{col: startCol, row: startRow, dist: 0}];

  while (queue.length) {
    const {col, row, dist} = queue.shift();
    if (dist >= movement) continue;

    for (const n of getTileNeighbours(col, row)) {
      const key = `${n.col},${n.row}`;
      if (visited.has(key)) continue;
      reachable.add(key);
      visited.add(key);
      queue.push({col: n.col, row: n.row, dist: dist + 1});
    }
  }

  return reachable;
}

function getAdjacentReachableTiles(col, row) {
  return new Set(getTileNeighbours(col, row).map(n => `${n.col},${n.row}`));
}

function isAdjacentTile(fromCol, fromRow, toCol, toRow) {
  return getTileNeighbours(fromCol, fromRow).some(n => n.col === toCol && n.row === toRow);
}

function bfsDistance(fromCol, fromRow, toCol, toRow) {
  const queue = [{ col: fromCol, row: fromRow, dist: 0 }];
  const visited = new Set();
  while (queue.length) {
    const { col, row, dist } = queue.shift();
    if (col === toCol && row === toRow) return dist;
    const key = `${col},${row}`;
    if (visited.has(key)) continue;
    visited.add(key);
    for (const n of getTileNeighbours(col, row))
      queue.push({ col: n.col, row: n.row, dist: dist + 1 });
  }
  return Infinity;
}

//  MOVEMENT STATE
let selectedUnit = null;
let selectedAction = null;
let reachableTiles = new Set();

//  TURN STATE
function getNextActivePlayerIndex(startIndex) {
  let nextIndex = (startIndex + 1) % GAME_STATE.players.length;
  let attempts = 0;
  while (GAME_STATE.players[nextIndex].data.defeated && attempts < GAME_STATE.players.length) {
    nextIndex = (nextIndex + 1) % GAME_STATE.players.length;
    attempts++;
  }
  return nextIndex;
}

function advanceTurn() {
  selectedUnit = null;
  selectedAction = null;
  reachableTiles = new Set();
  const player = GAME_STATE.players[GAME_STATE.currentPlayerIndex];
  const passiveGold = 3;
  player.data.gold += passiveGold;
  
  for (const tile of tiles) {
    for (const unit of tile.units) {
      unit.setMovement = unit.getMaxMovement;

      if (unit.getOwner === GAME_STATE.players[GAME_STATE.currentPlayerIndex].playerName) {
        const tileGold = TILE_TYPES[tile.type].gold || 0;
        if (unit.getType === 'worker' && tileGold > 0) {
          player.data.gold += tileGold;
        }
      }
    }
  }

  GAME_STATE.currentPlayerIndex = getNextActivePlayerIndex(GAME_STATE.currentPlayerIndex);
  if (GAME_STATE.currentPlayerIndex === 0) GAME_STATE.turn++;


  document.querySelector('#turn-number').textContent = GAME_STATE.turn;
  document.querySelector('#player-name').textContent = GAME_STATE.players[GAME_STATE.currentPlayerIndex].playerName;
  updatePanel(selectedTile);
  draw();
  updateStatsPanel();
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

  const mapW = COLS * HEX_SIZE * 1.5 + HEX_SIZE * 0.5;
  const mapH = (ROWS + 0.5) * Math.sqrt(3) * HEX_SIZE;
  cam.x = (canvas.width  - mapW) / 2;
  cam.y = (canvas.height - mapH) / 2;

  draw();
}

function drawHex(ctx, cx, cy, size, fillColor, strokeColor, strokeWidth = 1, tile = null) {
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
  
  if (tile && tile.owner) {
    const ownerPlayer = GAME_STATE.players.find(p => p.playerName === tile.owner);
    if (ownerPlayer) {
      const pts = hexCorners(cx, cy, size - 3);
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < 6; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.closePath();
      ctx.strokeStyle = ownerPlayer.data.getUnitColour;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }
}

function drawUnits(ctx, tile, x, y) {
  const unitSize = 10;
  const radius = 15;
  const angleStep = (2 * Math.PI) / tile.units.length;
  let angle = 0;
  for (const unit of tile.units) {
    const unitX = x + radius * Math.cos(angle);
    const unitY = y + radius * Math.sin(angle);

    ctx.globalAlpha = unit.getMovement === 0 ? 0.4 : 1.0;
    ctx.fillStyle = unit.getUnitColour;
    
    // Draw ASCII character instead of circle
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const char = unit.getType === 'soldier' ? '⚔' : '🛠';
    const ownerPlayer = GAME_STATE.players.find(p => p.playerName === unit.getOwner);
    ctx.fillStyle = ownerPlayer ? ownerPlayer.data.getUnitColour : '#ffffff';
    
    // Draw black outline
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.strokeText(char, unitX, unitY);
    
    ctx.fillText(char, unitX, unitY);


    // White ring around the currently selected unit
    if (unit === selectedUnit) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(unitX, unitY, unitSize / 2 + 3, 0, 2 * Math.PI);
      ctx.stroke();
    }

    ctx.globalAlpha = 1.0;
    const tileKey = `${tile.col},${tile.row}`;
    if (selectedAction === 'attack' && selectedUnit && reachableTiles.has(tileKey) && unit.getOwner !== selectedUnit.getOwner) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(unitX, unitY, unitSize / 2 + 3, 0, 2 * Math.PI);
      ctx.stroke();
    }
    angle += angleStep;
  }
}

function getUnitsFromSelectedTile() {
  if (!selectedTile) return [];
  return selectedTile.units;
}

function draw() {
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  ctx.fillStyle = '#080e14';
  ctx.fillRect(0, 0, W, H);

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
    const isSelected   = selectedTile && selectedTile.col === tile.col && selectedTile.row === tile.row;
    const key          = `${tile.col},${tile.row}`;
    const isReachable  = reachableTiles.has(key);
    const isUnitOrigin = selectedUnit && selectedUnit.getPos.x === tile.col && selectedUnit.getPos.y === tile.row;

    const fill =
        isUnitOrigin ? '#4a7a9b'
      : (selectedAction === 'attack' && isReachable) ? '#9a2a2a'
      : isReachable  ? '#2a5a3a'
      : isSelected   ? tdata.sel
      :                tdata.color;

    const stroke =
        isUnitOrigin ? '#7ec8e3'
      : (selectedAction === 'attack' && isReachable) ? '#ffffff'
      : isReachable  ? '#5aad7a'
      : isSelected   ? '#e8d5a0'
      :                '#1a2a1a';

    const sw = (isReachable || isUnitOrigin) ? 2 : isSelected ? 2.5 : 1;

    drawHex(ctx, x, y, size, fill, stroke, sw, tile);

    if (tile.units.length > 0) drawUnits(ctx, tile, x, y);

    // Selected glow ring — only when not in move mode
    if (isSelected && !selectedUnit) {
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
      <span> ${['worker', 'soldier'].map(type => {
        const count = tile.units.filter(u => u.getType === type).length;
        return count > 0 ? `<span class="unit-badge badge-${type}">${type} (${count}/1)</span> \n` : '';
      }).join('')}</span>
     
    </div>
    <div class="info-row">
      
    </div>
  `;

  // Unit action buttons
  const worker  = tile.units.find(u => u.getType === 'worker');
  const soldier = tile.units.find(u => u.getType === 'soldier');

  if ((worker || soldier) && tile.owner === GAME_STATE.players[GAME_STATE.currentPlayerIndex].playerName) {
    panel.innerHTML += `<div class="panel-header">Unit Actions</div>`;

    if (worker) {
      const isMoving = selectedUnit === worker && selectedAction === 'move';
      const canMove  = worker.getMovement > 0;
      panel.innerHTML += `
        <div class="info-row">
          <span class="info-label">Worker (${worker.getMovement}/${worker.getMaxMovement} actions)</span>
          <span class="info-val">
            ${isMoving
              ? `<button class="info-btn" disabled>Moving…</button>`
              : `<button class="info-btn" ${canMove ? `onclick="startMove('worker')"` : 'disabled'}>${worker.getMovement > 0 ? 'Move' : 'Move'}</button>`}
          </span>
        </div>`;
    }

    if (soldier) {
      const isMoving = selectedUnit === soldier;
      const canMove  = soldier.getMovement > 0;
      const enemyAdjacent = getTileNeighbours(tile.col, tile.row).some(n => {
        const neighbourTile = tiles.find(t => t.col === n.col && t.row === n.row);
        return neighbourTile && neighbourTile.units.some(u => u.getOwner && u.getOwner !== soldier.getOwner);
      });
      const canAttack = soldier.getMovement >= 2 && enemyAdjacent;
      const isMovingAttack = selectedUnit === soldier && selectedAction === 'move';
      panel.innerHTML += `
        <div class="info-row">
          <span class="info-label">Soldier (${soldier.getMovement}/${soldier.getMaxMovement} actions)</span>
          <span class="info-val">
            ${selectedUnit === soldier && selectedAction === 'attack'
              ? `<button class="info-btn" disabled>Attacking…</button>`
              : isMovingAttack
                ? `<button class="info-btn" disabled>Moving…</button>`
                : `<button class="info-btn" ${canMove ? `onclick="startMove('soldier')"` : 'disabled'}>${isMoving ? 'Moving…' : 'Move'}</button>`}
          </span>
        </div>`;
      if (selectedAction !== 'move' && !(selectedUnit === soldier && selectedAction === 'attack')) {
        panel.innerHTML += `
          <div class="info-row">
            <span class="info-label">&nbsp;</span>
            <span class="info-val">
              <button class="info-btn" ${canAttack ? 'onclick="startAttack()"' : 'disabled'}>
                Attack
              </button>
            </span>
          </div>`;
      }
    }

    if (selectedUnit && (selectedUnit === worker || selectedUnit === soldier)) {
      panel.innerHTML += `
        <div class="info-row">
          <span class="info-label"></span>
          <span class="info-val">
            <button class="info-btn" onclick="cancelMove()">Cancel</button>
          </span>
        </div>`;
    }
  }

  // Outpost operations
  if (tile.type === 'outpost' && tile.owner === GAME_STATE.players[GAME_STATE.currentPlayerIndex].playerName) {
    const player = GAME_STATE.players[GAME_STATE.currentPlayerIndex];
    const soldierExists = tile.units.some(u => u.getType === 'soldier');
    const workerExists  = tile.units.some(u => u.getType === 'worker');
    const canAffordSoldier = player.data.gold >= 10;
    const canAffordWorker  = player.data.gold >= 5;

    panel.innerHTML += `
      <div class="panel-header">Outpost Operations</div>
      <div class="info-row">
        <span class="info-label">train troops</span>
        <span class="info-val">
          <button class="info-btn" id="train-troops-btn" ${soldierExists || !canAffordSoldier ? 'disabled' : 'onclick="addTroops()"'}>Train</button>
          <span class="info-val">-10g</span>
        </span>
      </div>
      <div class="info-row">
        <span class="info-label">create workers</span>
        <span class="info-val">
          <button class="info-btn" id="create-workers-btn" ${workerExists || !canAffordWorker ? 'disabled' : 'onclick="createWorkers()"'}>Create</button>
          <span class="info-val">-5g</span>
        </span>
      </div>
    `;
  }
}

//  MOVEMENT ACTIONS
function isTileOccupiedBySameType(tile, unitType) {
  return tile.units.some(u => u.getType === unitType);
}

function startMove(unitType) {
  if (!selectedTile) return;
  const unit = selectedTile.units.find(u => u.getType === unitType && u.getMovement > 0);
  if (!unit) return;
  selectedUnit = unit;
  selectedAction = 'move';
  selectedUnit.setPos = { x: selectedTile.col, y: selectedTile.row };

  // Only immediately adjacent tiles are valid move targets.
  reachableTiles = getReachableTiles(selectedTile.col, selectedTile.row, 1);
  reachableTiles = new Set([...reachableTiles].filter(key => {
    const [col, row] = key.split(',').map(Number);
    const tile = tiles.find(t => t.col === col && t.row === row);
    return tile && !isTileOccupiedBySameType(tile, unitType);
  }));
  updatePanel(selectedTile);
  draw();
}

function startAttack() {
  if (!selectedTile) return;
  const unit = selectedTile.units.find(u => u.getType === 'soldier' && u.getMovement >= 2);
  if (!unit) return;
  selectedUnit = unit;
  selectedAction = 'attack';
  selectedUnit.setPos = { x: selectedTile.col, y: selectedTile.row };

  reachableTiles = getAdjacentReachableTiles(selectedTile.col, selectedTile.row);
  reachableTiles = new Set([...reachableTiles].filter(key => {
    const [col, row] = key.split(',').map(Number);
    const tile = tiles.find(t => t.col === col && t.row === row);
    return tile && tile.units.some(u => u.getOwner && u.getOwner !== selectedUnit.getOwner);
  }));
  updatePanel(selectedTile);
  draw();
}

function cancelMove() {
  selectedUnit = null;
  selectedAction = null;
  reachableTiles = new Set();
  updatePanel(selectedTile);
  draw();
}

function executeMove(toCol, toRow) {
  const fromTile = tiles.find(t => t.col === selectedUnit.getPos.x && t.row === selectedUnit.getPos.y);
  const toTile   = tiles.find(t => t.col === toCol && t.row === toRow);

  if (!fromTile || !toTile || !isAdjacentTile(fromTile.col, fromTile.row, toCol, toRow)) {
    cancelMove();
    return;
  }

  if (isTileOccupiedBySameType(toTile, selectedUnit.getType)) {
    cancelMove();
    return;
  }

  selectedUnit.setMovement = selectedUnit.getMovement - 1;
  selectedUnit.setPos = { x: toCol, y: toRow };
  fromTile.units = fromTile.units.filter(u => u !== selectedUnit);

  // Clear ownership of fromTile if no units belonging to its owner remain,
  // and it isn't an outpost (outposts keep their owner until invaded).
  if (fromTile.type !== 'outpost') {
    const ownerStillPresent = fromTile.units.some(u => u.getOwner === fromTile.owner);
    if (!ownerStillPresent) fromTile.owner = null;
  }

  toTile.units.push(selectedUnit);

  // Claim the destination tile for the moving unit's owner.
  if (toTile.type !== 'outpost') {
    toTile.owner = selectedUnit.getOwner;
  }

  handleOutpostInvasion(toTile, selectedUnit);

  selectedUnit = null;
  selectedAction = null;
  reachableTiles = new Set();
  selectedTile = toTile;

  updatePanel(selectedTile);
  draw();
}

function executeAttack(toCol, toRow) {
  if (!selectedUnit) {
    cancelMove();
    return;
  }

  const fromCol = selectedUnit.getPos.x;
  const fromRow = selectedUnit.getPos.y;
  if (!isAdjacentTile(fromCol, fromRow, toCol, toRow)) {
    cancelMove();
    return;
  }

  const fromTile = tiles.find(t => t.col === selectedUnit.getPos.x && t.row === selectedUnit.getPos.y);
  const targetTile = tiles.find(t => t.col === toCol && t.row === toRow);
  if (!fromTile || !targetTile || !targetTile.units.some(u => u.getOwner && u.getOwner !== selectedUnit.getOwner)) {
    cancelMove();
    return;
  }

  const enemyIndex = targetTile.units.findIndex(u => u.getOwner && u.getOwner !== selectedUnit.getOwner);
  if (enemyIndex === -1) {
    cancelMove();
    return;
  }

  const enemyUnit = targetTile.units[enemyIndex];
  let attackSucceeded = true;

  if (enemyUnit.getType === 'soldier') {
    const roll = Math.floor(Math.random() * 20) + 1;
    attackSucceeded = roll > enemyUnit.getDefence + TILE_TYPES[targetTile.type].def;
  }

  selectedUnit.setMovement = Math.max(0, selectedUnit.getMovement - 2);

  if (!attackSucceeded) {
    selectedUnit = null;
    selectedAction = null;
    reachableTiles = new Set();
    selectedTile = fromTile;
    updatePanel(selectedTile);
    draw();
    return;
  }

  targetTile.units.splice(enemyIndex, 1);

  // Remove the unit from the origin tile before moving it.
  fromTile.units = fromTile.units.filter(u => u !== selectedUnit);

  // Clear ownership of the origin tile if no friendly units remain.
  if (fromTile.type !== 'outpost') {
    const ownerStillPresent = fromTile.units.some(u => u.getOwner === fromTile.owner);
    if (!ownerStillPresent) fromTile.owner = null;
  }

  selectedUnit.setPos = { x: toCol, y: toRow };
  targetTile.units.push(selectedUnit);
  if (targetTile.type !== 'outpost') {
    targetTile.owner = selectedUnit.getOwner;
  }

  if (targetTile.type === 'outpost') {
    handleOutpostInvasion(targetTile, selectedUnit);
  }

  selectedUnit = null;
  selectedAction = null;
  reachableTiles = new Set();
  selectedTile = targetTile;

  updatePanel(selectedTile);
  draw();
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
    const { col, row } = pixelToHex(px, py, HEX_SIZE, cam.zoom, cam.x, cam.y);
    const tile = tiles.find(t => t.col === col && t.row === row);
    if (tile) {
      const key = `${col},${row}`;
      if (selectedUnit && reachableTiles.has(key)) {
        if (selectedAction === 'attack') {
          executeAttack(col, row);
        } else {
          executeMove(col, row);
        }
      } else {
        cancelMove();
        selectedTile = (selectedTile && selectedTile.col === col && selectedTile.row === row) ? null : tile;
        updatePanel(selectedTile);
        draw();
      }
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

function defeatPlayer(playerName) {
  const player = GAME_STATE.players.find(p => p.playerName === playerName);
  if (!player || player.data.defeated) return;
  player.data.defeated = true;
  alert(`${playerName} has been defeated!`);
}

function handleOutpostInvasion(tile, unit) {
  if (!tile || tile.type !== 'outpost' || !unit || unit.getType !== 'soldier') return;
  if (!tile.owner || tile.owner === unit.getOwner) return;
  defeatPlayer(tile.owner);
  tile.owner = unit.getOwner;
}

function addTroops() {
  const player = GAME_STATE.players[GAME_STATE.currentPlayerIndex];
  if (selectedTile.units.some(u => u.getType === 'soldier')) return;
  if (player.data.gold < 10) return;
  player.data.gold -= 10;
  let unit = new Units('soldier', player.playerName);
  unit.setPos = {x: selectedTile.col, y: selectedTile.row};
  selectedTile.units.push(unit);
  handleOutpostInvasion(selectedTile, unit);
  updatePanel(selectedTile);
  updateStatsPanel();
  draw();
}

function createWorkers() {
  const player = GAME_STATE.players[GAME_STATE.currentPlayerIndex];
  if (selectedTile.units.some(u => u.getType === 'worker')) return;
  if (player.data.gold < 5) return;
  player.data.gold -= 5;
  let unit = new Units('worker', player.playerName);
  unit.setPos = {x: selectedTile.col, y: selectedTile.row};
  selectedTile.units.push(unit);
  updatePanel(selectedTile);
  updateStatsPanel();
  draw();
}

function updateStatsPanel() {
    const body = document.getElementById('stats-body');
    body.innerHTML = GAME_STATE.players.map(p => {
        const soldierCount = tiles.filter(t => t.units.some(u => u.getOwner === p.playerName)).reduce((sum, t) => sum + t.units.filter(u => u.getOwner === p.playerName && u.getType === 'soldier').length, 0);
        const workerCount = tiles.filter(t => t.units.some(u => u.getOwner === p.playerName)).reduce((sum, t) => sum + t.units.filter(u => u.getOwner === p.playerName && u.getType === 'worker').length, 0);
        return `
        <div class="player-stat-row">
            <div class="player-colour-dot" style="background:${p.data.getUnitColour}"></div>
            <span class="player-stat-name">${p.playerName}</span>
            ${p.data.defeated
                ? '<span class="player-stat-defeated">Defeated</span>'
                : `<span class="player-stat-gold">${p.data.gold}g</span>
                   <span class="player-stat-units">⚔ ${soldierCount}</span>`}
                   <span class="player-stat-units">🛠 ${workerCount}</span>
        </div>
    `}).join('');
}

// Event listeners
document.querySelector('#end-turn-btn').addEventListener('click', () => {
  advanceTurn();
});

document.getElementById('stats-toggle').addEventListener('click', () => {
    const body = document.getElementById('stats-body');
    const arrow = document.getElementById('stats-arrow');
    body.classList.toggle('collapsed');
    arrow.classList.toggle('collapsed');
});

//  INIT
window.addEventListener('resize', () => { resize(); });
resize();
updateStatsPanel();
document.querySelector('#player-name').textContent = GAME_STATE.players[0].playerName;