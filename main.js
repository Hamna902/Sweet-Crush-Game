// main.js — fixed syntax errors + special candies + level progression + candy theme + sound effects + reversed striped candy logic + dynamic move limit
// Game settings
const ROWS = 8;
const COLS = 8;
const CANDIES = ["🍬", "🍭", "🧁", "🍫", "🍪", "🍯"];
const TYPES = CANDIES.length;

// Special identifiers
const STRIPED_H = "striped-h";
const STRIPED_V = "striped-v";
const WRAPPED = "wrapped";
const COLOR_BOMB = "colorbomb";

// State
let board = [];
let score = 0;
let movesLeft = 0; // Will be set dynamically per level
let level = 1;
let goalScore = 500; // Dynamic goal, updated per level
let firstPick = null;

// Sound effects
const sounds = {
  match: new Audio('sounds/match.mp3'),
  striped: new Audio('sounds/striped.mp3'),
  wrapped: new Audio('sounds/wrapped.mp3'),
  colorbomb: new Audio('sounds/colorbomb.mp3'),
  win: new Audio('sounds/win.mp3'),
  lose: new Audio('sounds/lose.mp3')
};

// Preload sounds and set volume
function preloadSounds() {
  Object.values(sounds).forEach(sound => {
    sound.preload = 'auto';
    sound.volume = 0.5; // Adjust volume (0.0 to 1.0)
    sound.load();
  });
}

// Play sound with error handling
function playSound(soundKey) {
  const sound = sounds[soundKey];
  if (sound) {
    sound.currentTime = 0; // Reset to start
    sound.play().catch(error => {
      console.warn(`Failed to play ${soundKey} sound:`, error);
    });
  }
}

// Calculate move limit for the current level
function getMoveLimit(level) {
  return 20 + Math.floor(level * 1.5) + (level >= 3 ? level : 0);
}

// Calculate goal score for the current level
function getGoalScore(level) {
  return 500 + 100 * (level - 1); // Increase by 100 per level
}

// DOM
const boardEl = document.getElementById("board");
const scoreEl = document.getElementById("score");
const movesEl = document.getElementById("moves");
const goalEl = document.getElementById("goal");
const levelEl = document.getElementById("level");

// Helpers
function randType() {
  return { type: CANDIES[Math.floor(Math.random() * TYPES)], special: null, removing: false };
}

function sleep(ms) {
  return new Promise(res => setTimeout(res, ms));
}

// Initialize new level
function initLevel() {
  score = 0;
  movesLeft = getMoveLimit(level); // Set dynamic move limit
  goalScore = getGoalScore(level);
  firstPick = null;
  board = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, randType)
  );
  removeInitialMatches();
  updateHUD();
  render();
}

// Build initial board without pre-existing matches
function removeInitialMatches() {
  let attempts = 0;
  while (true) {
    const runs = findRuns();
    if (runs.length === 0) break;
    const positions = getUniquePositionsFromRuns(runs);
    positions.forEach(p => {
      let newType;
      do {
        newType = randType().type;
      } while (createsMatch(p.r, p.c, newType));
      board[p.r][p.c] = { type: newType, special: null, removing: false };
    });
    attempts++;
    if (attempts > 1000) {
      console.warn("Reached max attempts in removeInitialMatches");
      break;
    }
  }
}

function createsMatch(r, c, type) {
  if (c >= 2 && board[r][c-1]?.type === type && board[r][c-2]?.type === type) return true;
  if (c <= COLS-3 && board[r][c+1]?.type === type && board[r][c+2]?.type === type) return true;
  if (c >= 1 && c <= COLS-2 && board[r][c-1]?.type === type && board[r][c+1]?.type === type) return true;
  if (r >= 2 && board[r-1][c]?.type === type && board[r-2][c]?.type === type) return true;
  if (r <= ROWS-3 && board[r+1][c]?.type === type && board[r+2][c]?.type === type) return true;
  if (r >= 1 && r <= ROWS-2 && board[r-1][c]?.type === type && board[r+1][c]?.type === type) return true;
  return false;
}

function updateHUD() {
  levelEl.textContent = "Level: " + level;
  scoreEl.textContent = "Score: " + score;
  movesEl.textContent = "Moves: " + movesLeft;
  goalEl.textContent = "Goal: " + goalScore;
}

// Safe render — handles null / removing flags
function render() {
  boardEl.innerHTML = "";
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = document.createElement("div");
      cell.className = "cell";

      const candy = document.createElement("div");
      candy.className = "candy";
      candy.dataset.r = r;
      candy.dataset.c = c;

      const cellData = board[r][c];

      if (!cellData) {
        candy.classList.add("empty");
        candy.textContent = "";
      } else {
        candy.dataset.type = cellData.type; // For CSS styling
        if (cellData.special === COLOR_BOMB) {
          candy.textContent = "🌟";
          candy.classList.add("special", "colorbomb");
        } else if (cellData.special === WRAPPED) {
          candy.textContent = "🎁";
          candy.classList.add("special", "wrapped");
        } else if (cellData.special === STRIPED_H) {
          candy.textContent = "➡️";
          candy.classList.add("special", "striped-h");
        } else if (cellData.special === STRIPED_V) {
          candy.textContent = "⬇️";
          candy.classList.add("special", "striped-v");
        } else {
          candy.textContent = cellData.type;
        }
        if (cellData.removing) candy.classList.add("removing");
        else if (cellData.new) {
          candy.classList.add("drop");
          setTimeout(() => candy.classList.remove("drop"), 400); // Match drop animation duration
        }
      }

      candy.addEventListener("click", onClickCell);
      cell.appendChild(candy);
      boardEl.appendChild(cell);
    }
  }

  updateHUD();
  if (firstPick) {
    const el = document.querySelector(`.candy[data-r="${firstPick.r}"][data-c="${firstPick.c}"]`);
    if (el) el.classList.add("selected");
  }
}

// Click logic & swapping
async function onClickCell(e) {
  const r = Number(this.dataset.r);
  const c = Number(this.dataset.c);

  if (!firstPick) {
    firstPick = { r, c };
    this.classList.add("selected");
    return;
  }

  const prevEl = document.querySelector(".candy.selected");
  if (prevEl) prevEl.classList.remove("selected");

  const prev = firstPick;
  firstPick = null;

  if (Math.abs(prev.r - r) + Math.abs(prev.c - c) !== 1) {
    firstPick = { r, c };
    const el = document.querySelector(`.candy[data-r="${r}"][data-c="${c}"]`);
    if (el) el.classList.add("selected");
    return;
  }

  if (movesLeft <= 0) {
    alert("No moves left!");
    return;
  }

  swap(prev, { r, c });
  render();

  const a = board[prev.r][prev.c];
  const b = board[r][c];

  if (a && a.special === COLOR_BOMB || b && b.special === COLOR_BOMB) {
    const handled = await handleColorBombSwap(prev, { r, c });
    if (handled) {
      playSound('colorbomb');
      movesLeft--;
      updateHUD();
      checkWinLose();
      return;
    }
  }

  const specialHandled = await handleSpecialSwap(prev, { r, c });
  if (specialHandled) {
    if ((a && a.special === STRIPED_H) || (b && b.special === STRIPED_H)) {
      playSound('striped');
    } else if ((a && a.special === STRIPED_V) || (b && b.special === STRIPED_V)) {
      playSound('striped');
    } else if ((a && a.special === WRAPPED) || (b && b.special === WRAPPED)) {
      playSound('wrapped');
    }
    movesLeft--;
    updateHUD();
    checkWinLose();
    return;
  }

  const runs = findRuns();
  if (runs.length === 0) {
    await sleep(160);
    swap(prev, { r, c });
    render();
    return;
  }

  playSound('match');
  movesLeft--;
  updateHUD();
  await processMatches(runs, prev, { r, c });
  checkWinLose();
}

// Swap helper
function swap(a, b) {
  const tmp = board[a.r][a.c];
  board[a.r][a.c] = board[b.r][b.c];
  board[b.r][b.c] = tmp;
}

// Find runs (horizontal + vertical) of length >= 3
function findRuns() {
  const runs = [];

  for (let r = 0; r < ROWS; r++) {
    let run = [{ r, c: 0 }];
    for (let c = 1; c <= COLS; c++) {
      const cur = c < COLS && board[r][c] ? board[r][c] : null;
      const start = run[0];
      const startCell = start.c < COLS && board[start.r][start.c] ? board[start.r][start.c] : null;
      if (c < COLS && cur && startCell && cur.type === startCell.type) {
        run.push({ r, c });
      } else {
        if (run.length >= 3 && startCell) {
          runs.push({ dir: "h", type: startCell.type, cells: run.slice() });
        }
        run = [{ r, c }];
      }
    }
  }

  for (let c = 0; c < COLS; c++) {
    let run = [{ r: 0, c }];
    for (let r = 1; r <= ROWS; r++) {
      const cur = r < ROWS && board[r][c] ? board[r][c] : null;
      const start = run[0];
      const startCell = start.r < ROWS && board[start.r][start.c] ? board[start.r][start.c] : null;
      if (r < ROWS && cur && startCell && cur.type === startCell.type) {
        run.push({ r, c });
      } else {
        if (run.length >= 3 && startCell) {
          runs.push({ dir: "v", type: startCell.type, cells: run.slice() });
        }
        run = [{ r, c }];
      }
    }
  }

  return runs;
}

function getUniquePositionsFromRuns(runs) {
  const map = new Map();
  runs.forEach(run => {
    run.cells.forEach(pt => {
      const key = `${pt.r},${pt.c}`;
      map.set(key, { r: pt.r, c: pt.c });
    });
  });
  return Array.from(map.values());
}

// Process matches (runs)
async function processMatches(runs, swapA, swapB) {
  if (!runs || runs.length === 0) return;

  const matched = getUniquePositionsFromRuns(runs);

  let specialToCreate = null;
  let longRun = runs.find(run => run.cells.length >= 5);
  if (longRun) {
    const mid = Math.floor(longRun.cells.length / 2);
    const pos = longRun.cells[mid];
    specialToCreate = { r: pos.r, c: pos.c, kind: COLOR_BOMB, baseType: longRun.type };
  } else {
    let wrappedCandidate = null;
    const hRuns = runs.filter(rn => rn.dir === "h");
    const vRuns = runs.filter(rn => rn.dir === "v");
    outer: for (const hr of hRuns) {
      for (const vr of vRuns) {
        for (const hc of hr.cells) {
          for (const vc of vr.cells) {
            if (hc.r === vc.r && hc.c === vc.c) {
              const combinedMap = new Map();
              hr.cells.concat(vr.cells).forEach(p => combinedMap.set(`${p.r},${p.c}`, p));
              if (combinedMap.size >= 5) {
                wrappedCandidate = { r: hc.r, c: hc.c, kind: WRAPPED, baseType: hr.type };
                break outer;
              }
            }
          }
        }
      }
    }
    if (wrappedCandidate) specialToCreate = wrappedCandidate;
    else {
      const run4 = runs.find(run => run.cells.length === 4);
      if (run4) {
        // Choose the swapped position that is part of the run
        const swapPositions = [swapA, swapB];
        let pos = run4.cells[0]; // Default to first cell if no swap position is in the run
        for (const swapPos of swapPositions) {
          if (run4.cells.some(cell => cell.r === swapPos.r && cell.c === swapPos.c)) {
            pos = swapPos; // Use the swapped position if it's in the run
            break;
          }
        }
        // Reversed logic: horizontal match creates vertical striped candy, vertical match creates horizontal striped candy
        const kind = run4.dir === "h" ? STRIPED_V : STRIPED_H;
        specialToCreate = { r: pos.r, c: pos.c, kind, baseType: run4.type };
      }
    }
  }

  const specialKey = specialToCreate ? `${specialToCreate.r},${specialToCreate.c}` : null;
  matched.forEach(p => {
    if (`${p.r},${p.c}` === specialKey) return;
    if (board[p.r] && board[p.r][p.c]) board[p.r][p.c].removing = true;
  });

  render();
  await sleep(300);

  matched.forEach(p => {
    if (`${p.r},${p.c}` === specialKey) return;
    board[p.r][p.c] = null;
  });

  if (specialToCreate) {
    board[specialToCreate.r][specialToCreate.c] = {
      type: specialToCreate.baseType,
      special: specialToCreate.kind,
      removing: false
    };
  }

  score += matched.length * 10;
  collapse();
  refill();
  render();

  await sleep(160);
  const nextRuns = findRuns();
  console.log("Cascade matches found:", nextRuns);
  if (nextRuns.length > 0) {
    playSound('match');
    await processMatches(nextRuns);
  }
}

// Handle special candy swaps (striped/wrapped)
async function handleSpecialSwap(aPos, bPos) {
  const a = board[aPos.r][aPos.c];
  const b = board[bPos.r][bPos.c];
  if (!a || !b) return false;

  if (a.special === STRIPED_H || b.special === STRIPED_H) {
    const row = a.special === STRIPED_H ? aPos.r : bPos.r;
    for (let c = 0; c < COLS; c++) {
      if (board[row][c]) board[row][c].removing = true;
    }
    render();
    await sleep(320);
    let count = 0;
    for (let c = 0; c < COLS; c++) {
      if (board[row][c]) {
        count++;
        board[row][c] = null;
      }
    }
    score += count * 10;
    collapse();
    refill();
    render();
    await sleep(160);
    const next = findRuns();
    if (next.length > 0) {
      playSound('match');
      await processMatches(next);
    }
    return true;
  }

  if (a.special === STRIPED_V || b.special === STRIPED_V) {
    const col = a.special === STRIPED_V ? aPos.c : bPos.c;
    for (let r = 0; r < ROWS; r++) {
      if (board[r][col]) board[r][col].removing = true;
    }
    render();
    await sleep(320);
    let count = 0;
    for (let r = 0; r < ROWS; r++) {
      if (board[r][col]) {
        count++;
        board[r][col] = null;
      }
    }
    score += count * 10;
    collapse();
    refill();
    render();
    await sleep(160);
    const next = findRuns();
    if (next.length > 0) {
      playSound('match');
      await processMatches(next);
    }
    return true;
  }

  if (a.special === WRAPPED || b.special === WRAPPED) {
    const pos = a.special === WRAPPED ? aPos : bPos;
    const r = pos.r;
    const c = pos.c;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && board[nr][nc]) {
          board[nr][nc].removing = true;
        }
      }
    }
    render();
    await sleep(320);
    let count = 0;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && board[nr][nc]) {
          count++;
          board[nr][nc] = null;
        }
      }
    }
    score += count * 10;
    collapse();
    refill();
    render();
    await sleep(160);
    const next = findRuns();
    if (next.length > 0) {
      playSound('match');
      await processMatches(next);
    }
    return true;
  }

  return false;
}

// Color bomb swap handling
async function handleColorBombSwap(aPos, bPos) {
  const a = board[aPos.r][aPos.c];
  const b = board[bPos.r][bPos.c];
  if (!a && !b) return false;

  if (a && a.special === COLOR_BOMB && b && b.special === COLOR_BOMB) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (board[r][c]) board[r][c].removing = true;
      }
    }
    render();
    await sleep(300);
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        board[r][c] = null;
      }
    }
    score += ROWS * COLS * 10;
    collapse();
    refill();
    render();
    await sleep(160);
    const next = findRuns();
    if (next.length > 0) {
      playSound('match');
      await processMatches(next);
    }
    return true;
  }

  if (a && a.special === COLOR_BOMB && b && !b.special) {
    const targetType = b.type;
    const count = countType(targetType);
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (board[r][c] && board[r][c].type === targetType) board[r][c].removing = true;
      }
    }
    board[aPos.r][aPos.c].removing = true;
    render();
    await sleep(320);
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (board[r][c] && (board[r][c].type === targetType || board[r][c].special === COLOR_BOMB)) {
          board[r][c] = null;
        }
      }
    }
    score += count * 10;
    collapse();
    refill();
    render();
    await sleep(160);
    const next = findRuns();
    if (next.length > 0) {
      playSound('match');
      await processMatches(next);
    }
    return true;
  }

  if (b && b.special === COLOR_BOMB && a && !a.special) {
    const targetType = a.type;
    const count = countType(targetType);
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (board[r][c] && board[r][c].type === targetType) board[r][c].removing = true;
      }
    }
    board[bPos.r][bPos.c].removing = true;
    render();
    await sleep(320);
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (board[r][c] && (board[r][c].type === targetType || board[r][c].special === COLOR_BOMB)) {
          board[r][c] = null;
        }
      }
    }
    score += count * 10;
    collapse();
    refill();
    render();
    await sleep(160);
    const next = findRuns();
    if (next.length > 0) {
      playSound('match');
      await processMatches(next);
    }
    return true;
  }

  return false;
}

function countType(t) {
  let cnt = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r][c] && board[r][c].type === t) cnt++;
    }
  }
  return cnt;
}

function collapse() {
  for (let c = 0; c < COLS; c++) {
    let writeRow = ROWS - 1;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r][c] !== null && board[r][c] !== undefined) {
        board[writeRow][c] = board[r][c];
        board[writeRow][c].new = true; // Mark for drop animation
        if (writeRow !== r) board[r][c] = null;
        writeRow--;
      }
    }
    for (let r = writeRow; r >= 0; r--) {
      board[r][c] = null;
    }
  }
}

function refill() {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r][c] === null || board[r][c] === undefined) {
        board[r][c] = randType();
        board[r][c].new = true; // Mark for drop animation
      }
      if (board[r][c] && board[r][c].removing) board[r][c].removing = false;
      else if (board[r][c] && board[r][c].new) board[r][c].new = false;
    }
  }
}

function checkWinLose() {
  if (score >= goalScore) {
    setTimeout(() => {
      playSound('win');
      alert(`🎉 Level ${level} Complete! Score: ${score}`);
      level++;
      initLevel();
    }, 200);
  } else if (movesLeft <= 0) {
    setTimeout(() => {
      playSound('lose');
      alert(`💀 Out of moves! Score: ${score}`);
      initLevel(); // Reset to same level
    }, 200);
  }
}

// UI hooks
document.getElementById("reset").addEventListener("click", initLevel);

// Start
preloadSounds();
initLevel();