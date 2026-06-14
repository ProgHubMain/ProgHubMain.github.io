const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = {
  I: '#00f0f0',
  O: '#f0f000',
  T: '#a000f0',
  S: '#00f000',
  Z: '#f00000',
  J: '#0000f0',
  L: '#f0a000',
};

const SHAPES = {
  I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
  O: [[1, 1], [1, 1]],
  T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
  S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
  Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
  J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
  L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
};

const PIECE_TYPES = Object.keys(SHAPES);
const LINE_SCORES = [0, 100, 300, 500, 800];

const boardCanvas = document.getElementById('board');
const nextCanvas = document.getElementById('next');
const boardCtx = boardCanvas.getContext('2d');
const nextCtx = nextCanvas.getContext('2d');

const scoreEl = document.getElementById('score');
const levelEl = document.getElementById('level');
const linesEl = document.getElementById('lines');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayText = document.getElementById('overlay-text');
const overlayBtn = document.getElementById('overlay-btn');
const startBtn = document.getElementById('start-btn');

let board = [];
let current = null;
let next = null;
let score = 0;
let level = 1;
let lines = 0;
let dropInterval = 1000;
let lastDrop = 0;
let animationId = null;
let gameState = 'idle'; // idle | playing | paused | gameover

function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function randomPiece() {
  const type = PIECE_TYPES[Math.floor(Math.random() * PIECE_TYPES.length)];
  return {
    type,
    shape: SHAPES[type].map(row => [...row]),
    x: Math.floor(COLS / 2) - Math.ceil(SHAPES[type][0].length / 2),
    y: 0,
  };
}

function rotateMatrix(matrix) {
  const n = matrix.length;
  const rotated = matrix.map((_, col) => matrix.map(row => row[col]).reverse());
  return rotated;
}

function collides(piece, offsetX = 0, offsetY = 0, shape = piece.shape) {
  for (let y = 0; y < shape.length; y++) {
    for (let x = 0; x < shape[y].length; x++) {
      if (!shape[y][x]) continue;
      const newX = piece.x + x + offsetX;
      const newY = piece.y + y + offsetY;
      if (newX < 0 || newX >= COLS || newY >= ROWS) return true;
      if (newY >= 0 && board[newY][newX]) return true;
    }
  }
  return false;
}

function lockPiece() {
  for (let y = 0; y < current.shape.length; y++) {
    for (let x = 0; x < current.shape[y].length; x++) {
      if (!current.shape[y][x]) continue;
      const boardY = current.y + y;
      const boardX = current.x + x;
      if (boardY >= 0) {
        board[boardY][boardX] = current.type;
      }
    }
  }
}

function clearLines() {
  let cleared = 0;
  for (let y = ROWS - 1; y >= 0; y--) {
    if (board[y].every(cell => cell !== null)) {
      board.splice(y, 1);
      board.unshift(Array(COLS).fill(null));
      cleared++;
      y++;
    }
  }
  if (cleared > 0) {
    lines += cleared;
    score += LINE_SCORES[cleared] * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 80);
    updateStats();
  }
}

function spawnPiece() {
  current = next || randomPiece();
  next = randomPiece();
  if (collides(current)) {
    gameOver();
  }
  drawNext();
}

function move(dx, dy) {
  if (!collides(current, dx, dy)) {
    current.x += dx;
    current.y += dy;
    return true;
  }
  return false;
}

function rotate() {
  const rotated = rotateMatrix(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collides(current, kick, 0, rotated)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function hardDrop() {
  while (move(0, 1)) {}
  settlePiece();
}

function softDrop() {
  if (move(0, 1)) {
    score += 1;
    updateStats();
  } else {
    settlePiece();
  }
}

function settlePiece() {
  lockPiece();
  clearLines();
  spawnPiece();
}

function drawBlock(ctx, x, y, color, size = BLOCK, padding = 2) {
  const px = x * size;
  const py = y * size;
  const inner = size - padding * 2;

  ctx.fillStyle = color;
  ctx.fillRect(px + padding, py + padding, inner, inner);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.fillRect(px + padding, py + padding, inner, 2);
  ctx.fillRect(px + padding, py + padding, 2, inner);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.fillRect(px + padding, py + size - padding - 2, inner, 2);
  ctx.fillRect(px + size - padding - 2, py + padding, 2, inner);
}

function drawGrid(ctx, cols, rows, blockSize) {
  ctx.strokeStyle = '#2a2a4a';
  ctx.lineWidth = 0.5;
  for (let x = 0; x <= cols; x++) {
    ctx.beginPath();
    ctx.moveTo(x * blockSize, 0);
    ctx.lineTo(x * blockSize, rows * blockSize);
    ctx.stroke();
  }
  for (let y = 0; y <= rows; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * blockSize);
    ctx.lineTo(cols * blockSize, y * blockSize);
    ctx.stroke();
  }
}

function drawBoard() {
  boardCtx.fillStyle = '#1a1a2e';
  boardCtx.fillRect(0, 0, boardCanvas.width, boardCanvas.height);
  drawGrid(boardCtx, COLS, ROWS, BLOCK);

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (board[y][x]) {
        drawBlock(boardCtx, x, y, COLORS[board[y][x]]);
      }
    }
  }

  if (current) {
    for (let y = 0; y < current.shape.length; y++) {
      for (let x = 0; x < current.shape[y].length; x++) {
        if (current.shape[y][x]) {
          drawBlock(boardCtx, current.x + x, current.y + y, COLORS[current.type]);
        }
      }
    }

    let ghostY = current.y;
    while (!collides(current, 0, ghostY - current.y + 1)) {
      ghostY++;
    }
    if (ghostY !== current.y) {
      for (let y = 0; y < current.shape.length; y++) {
        for (let x = 0; x < current.shape[y].length; x++) {
          if (!current.shape[y][x]) continue;
          const px = (current.x + x) * BLOCK;
          const py = (ghostY + y) * BLOCK;
          boardCtx.strokeStyle = COLORS[current.type];
          boardCtx.globalAlpha = 0.3;
          boardCtx.strokeRect(px + 2, py + 2, BLOCK - 4, BLOCK - 4);
          boardCtx.globalAlpha = 1;
        }
      }
    }
  }
}

function drawNext() {
  nextCtx.fillStyle = '#252545';
  nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);

  if (!next) return;

  const blockSize = 24;
  const shapeW = next.shape[0].length;
  const shapeH = next.shape.length;
  const offsetX = (nextCanvas.width / blockSize - shapeW) / 2;
  const offsetY = (nextCanvas.height / blockSize - shapeH) / 2;

  for (let y = 0; y < next.shape.length; y++) {
    for (let x = 0; x < next.shape[y].length; x++) {
      if (next.shape[y][x]) {
        drawBlock(nextCtx, offsetX + x, offsetY + y, COLORS[next.type], blockSize);
      }
    }
  }
}

function updateStats() {
  scoreEl.textContent = score;
  levelEl.textContent = level;
  linesEl.textContent = lines;
}

function showOverlay(title, text, btnText) {
  overlayTitle.textContent = title;
  overlayText.textContent = text;
  overlayBtn.textContent = btnText;
  overlay.classList.remove('hidden');
}

function hideOverlay() {
  overlay.classList.add('hidden');
}

function gameLoop(timestamp) {
  if (gameState !== 'playing') return;

  if (timestamp - lastDrop >= dropInterval) {
    if (!move(0, 1)) {
      settlePiece();
    }
    lastDrop = timestamp;
  }

  drawBoard();
  animationId = requestAnimationFrame(gameLoop);
}

function startGame() {
  cancelAnimationFrame(animationId);
  board = createBoard();
  score = 0;
  level = 1;
  lines = 0;
  dropInterval = 1000;
  lastDrop = 0;
  next = randomPiece();
  updateStats();
  hideOverlay();
  gameState = 'playing';
  spawnPiece();
  animationId = requestAnimationFrame(gameLoop);
}

function togglePause() {
  if (gameState === 'playing') {
    gameState = 'paused';
    cancelAnimationFrame(animationId);
    showOverlay('Пауза', 'Нажмите P для продолжения', 'Продолжить');
  } else if (gameState === 'paused') {
    gameState = 'playing';
    hideOverlay();
    lastDrop = performance.now();
    animationId = requestAnimationFrame(gameLoop);
  }
}

function gameOver() {
  gameState = 'gameover';
  cancelAnimationFrame(animationId);
  drawBoard();
  showOverlay('Игра окончена', `Счёт: ${score}`, 'Новая игра');
}

document.addEventListener('keydown', (e) => {
  if (gameState === 'idle' || gameState === 'gameover') {
    if (e.code === 'Enter' || e.code === 'Space') {
      e.preventDefault();
      startGame();
    }
    return;
  }

  if (e.code === 'KeyP') {
    togglePause();
    return;
  }

  if (gameState !== 'playing') return;

  switch (e.code) {
    case 'ArrowLeft':
      e.preventDefault();
      move(-1, 0);
      break;
    case 'ArrowRight':
      e.preventDefault();
      move(1, 0);
      break;
    case 'ArrowDown':
      e.preventDefault();
      softDrop();
      break;
    case 'ArrowUp':
      e.preventDefault();
      rotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
});

startBtn.addEventListener('click', startGame);
overlayBtn.addEventListener('click', () => {
  if (gameState === 'paused') {
    togglePause();
  } else if (gameState === 'gameover' || gameState === 'idle') {
    startGame();
  }
});

showOverlay('Тетрис', 'Нажмите «Новая игра» или Enter', 'Новая игра');
drawBoard();
drawNext();
