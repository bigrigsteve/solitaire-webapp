/* ── Constants ── */
const SUITS = ["hearts", "diamonds", "clubs", "spades"];
const SUIT_SYMBOL = { hearts: "♥", diamonds: "♦", clubs: "♣", spades: "♠" };
const RANK_LABEL = { 1: "A", 11: "J", 12: "Q", 13: "K" };

const THEMES = [
  { id: "classic",  name: "Classic",   cardBg: "#ffffff", cardBorder: "#c8c8c8", backA: "#1a3a8f", backB: "#0d1f52", red: "#d0021b", black: "#111111" },
  { id: "midnight", name: "Midnight",  cardBg: "#1e1e2e", cardBorder: "#444466", backA: "#2d1b69", backB: "#11052c", red: "#ff6b9d", black: "#cdd6f4" },
  { id: "forest",   name: "Forest",    cardBg: "#f5f0e8", cardBorder: "#a89070", backA: "#2d5a27", backB: "#1a3317", red: "#8b2020", black: "#1a2e1a" },
  { id: "rose",     name: "Rose Gold", cardBg: "#fff8f8", cardBorder: "#e8c0c0", backA: "#8b1a4a", backB: "#4a0a26", red: "#c0392b", black: "#2c1a2e" },
  { id: "ocean",    name: "Ocean",     cardBg: "#f0f8ff", cardBorder: "#90b8d8", backA: "#003366", backB: "#001833", red: "#c0392b", black: "#003366" },
];

/* ── State ── */
const state = {
  stock: [], waste: [],
  foundations: [[], [], [], []],
  tableau: [[], [], [], [], [], [], []],
  dragging: null,
  moves: 0,
  startTime: null,
  timerInterval: null,
  gameOver: false,
  theme: localStorage.getItem("solitaire-theme") || "classic",
};

/* ── DOM refs ── */
const stockPile     = document.getElementById("stock-pile");
const wastePile     = document.getElementById("waste-pile");
const foundationsEl = document.getElementById("foundations");
const tableauEl     = document.getElementById("tableau");
const newGameBtn    = document.getElementById("new-game-btn");
const statTime      = document.getElementById("stat-time");
const statMoves     = document.getElementById("stat-moves");
const confettiCanvas = document.getElementById("confetti-canvas");

/* ── Timer ── */
function startTimer() {
  if (state.timerInterval) clearInterval(state.timerInterval);
  state.startTime = Date.now();
  state.timerInterval = setInterval(() => {
    statTime.textContent = formatTime(Math.floor((Date.now() - state.startTime) / 1000));
  }, 1000);
}

function stopTimer() {
  clearInterval(state.timerInterval);
  state.timerInterval = null;
}

function getElapsedSeconds() {
  return state.startTime ? Math.floor((Date.now() - state.startTime) / 1000) : 0;
}

function formatTime(secs) {
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
}

/* ── Scoring / Leaderboard ── */
function calcScore(secs, moves) {
  return Math.max(0, 5000 - Math.floor(secs * 2) - Math.floor(moves * 5));
}

function loadScores() {
  try { return JSON.parse(localStorage.getItem("solitaire-scores") || "[]"); }
  catch { return []; }
}

function saveScore(secs, moves) {
  const scores = loadScores();
  const score = calcScore(secs, moves);
  scores.push({ secs, moves, score, date: new Date().toLocaleDateString() });
  scores.sort((a, b) => b.score - a.score);
  localStorage.setItem("solitaire-scores", JSON.stringify(scores.slice(0, 10)));
  return score;
}

/* ── Card helpers ── */
function cardColor(suit) {
  return suit === "hearts" || suit === "diamonds" ? "red" : "black";
}

function rankLabel(rank) {
  return RANK_LABEL[rank] || String(rank);
}

function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 13; rank++) {
      deck.push({ id: `${suit}-${rank}-${Math.random().toString(36).slice(2, 8)}`, suit, rank, color: cardColor(suit), faceUp: false });
    }
  }
  return deck;
}

function shuffle(cards) {
  const copy = [...cards];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/* ── New game ── */
function newGame() {
  stopTimer();
  closeAllModals();
  stopConfetti();

  const deck = shuffle(createDeck());
  Object.assign(state, {
    stock: [], waste: [],
    foundations: [[], [], [], []],
    tableau: [[], [], [], [], [], [], []],
    dragging: null, moves: 0, startTime: null, gameOver: false,
  });
  statTime.textContent = "0:00";
  statMoves.textContent = "0";

  for (let pile = 0; pile < 7; pile++) {
    for (let i = 0; i <= pile; i++) {
      const card = deck.pop();
      card.faceUp = i === pile;
      state.tableau[pile].push(card);
    }
  }
  while (deck.length) { const c = deck.pop(); c.faceUp = false; state.stock.push(c); }

  render();
}

function incrementMoves() {
  if (!state.startTime) startTimer();
  state.moves++;
  statMoves.textContent = state.moves;
}

/* ── Rules ── */
function canPlaceOnTableau(movingCard, targetCard) {
  if (!targetCard) return movingCard.rank === 13;
  return targetCard.faceUp && movingCard.color !== targetCard.color && movingCard.rank === targetCard.rank - 1;
}

function canPlaceOnFoundation(card, foundationPile) {
  const top = foundationPile[foundationPile.length - 1];
  return top ? card.suit === top.suit && card.rank === top.rank + 1 : card.rank === 1;
}

/* ── Moves ── */
function drawFromStock() {
  if (state.gameOver) return;
  if (state.stock.length) {
    const card = state.stock.pop();
    card.faceUp = true;
    state.waste.push(card);
    incrementMoves();
  } else if (state.waste.length) {
    while (state.waste.length) { const c = state.waste.pop(); c.faceUp = false; state.stock.push(c); }
    incrementMoves();
  }
  render();
}

function maybeAutoMoveToFoundation(from) {
  if (state.gameOver) return false;
  let card = null;
  if (from.type === "waste") card = state.waste[state.waste.length - 1];
  else if (from.type === "tableau") {
    const pile = state.tableau[from.index];
    card = pile[pile.length - 1];
    if (!card?.faceUp) return false;
  } else return false;
  if (!card) return false;

  for (let i = 0; i < state.foundations.length; i++) {
    if (canPlaceOnFoundation(card, state.foundations[i])) {
      if (from.type === "waste") state.waste.pop();
      else {
        state.tableau[from.index].pop();
        const reveal = state.tableau[from.index][state.tableau[from.index].length - 1];
        if (reveal && !reveal.faceUp) reveal.faceUp = true;
      }
      state.foundations[i].push(card);
      incrementMoves();
      render();
      if (checkWin()) triggerWin();
      else afterMove();
      return true;
    }
  }
  return false;
}

function startDrag(from, cards) { state.dragging = { from, cards }; }
function clearDrag() { state.dragging = null; }

function moveToTableau(targetIndex) {
  if (!state.dragging || state.gameOver) return false;
  const { from, cards } = state.dragging;
  if (!cards.length) return false;
  const targetPile = state.tableau[targetIndex];
  if (!canPlaceOnTableau(cards[0], targetPile[targetPile.length - 1] ?? null)) return false;

  if (from.type === "waste") state.waste.pop();
  else if (from.type === "foundation") state.foundations[from.index].pop();
  else if (from.type === "tableau") {
    state.tableau[from.index].splice(from.subIndex);
    const reveal = state.tableau[from.index][state.tableau[from.index].length - 1];
    if (reveal && !reveal.faceUp) reveal.faceUp = true;
  }
  targetPile.push(...cards);
  incrementMoves();
  clearDrag();
  render();
  afterMove();
  return true;
}

function moveToFoundation(targetIndex) {
  if (!state.dragging || state.gameOver) return false;
  const { from, cards } = state.dragging;
  if (cards.length !== 1) return false;
  const card = cards[0];
  const target = state.foundations[targetIndex];
  if (!canPlaceOnFoundation(card, target)) return false;

  if (from.type === "waste") state.waste.pop();
  else if (from.type === "tableau") {
    state.tableau[from.index].splice(from.subIndex);
    const reveal = state.tableau[from.index][state.tableau[from.index].length - 1];
    if (reveal && !reveal.faceUp) reveal.faceUp = true;
  } else if (from.type === "foundation") state.foundations[from.index].pop();

  target.push(card);
  incrementMoves();
  clearDrag();
  render();
  if (checkWin()) triggerWin();
  else afterMove();
  return true;
}

/* ── Win / Lose detection ── */
function checkWin() {
  return state.foundations.every((p) => p.length === 13);
}

function checkNoMoves() {
  if (state.stock.length || state.waste.length) return false;
  const allFaceUpTops = [
    ...state.tableau.map((p) => p[p.length - 1]).filter((c) => c?.faceUp),
    ...state.foundations.map((p) => p[p.length - 1]).filter(Boolean),
  ];
  for (const card of allFaceUpTops) {
    for (const fi of state.foundations) {
      if (canPlaceOnFoundation(card, fi)) return false;
    }
    for (const tp of state.tableau) {
      if (canPlaceOnTableau(card, tp[tp.length - 1] ?? null)) return false;
    }
  }
  return true;
}

function afterMove() {
  if (!state.gameOver && checkNoMoves()) {
    setTimeout(triggerLose, 400);
  }
}

/* ── Win / Lose triggers ── */
function triggerWin() {
  stopTimer();
  state.gameOver = true;
  const secs = getElapsedSeconds();
  const score = saveScore(secs, state.moves);
  document.getElementById("win-time").textContent = formatTime(secs);
  document.getElementById("win-moves").textContent = state.moves;
  document.getElementById("win-score").textContent = score.toLocaleString();
  setTimeout(() => {
    document.getElementById("win-modal").hidden = false;
    startConfetti();
  }, 600);
}

function triggerLose() {
  if (state.gameOver) return;
  stopTimer();
  state.gameOver = true;
  document.getElementById("lose-modal").hidden = false;
}

/* ── Confetti ── */
let confettiRAF = null;

function startConfetti() {
  const canvas = confettiCanvas;
  const ctx = canvas.getContext("2d");
  canvas.classList.add("active");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const colors = ["#f7b731","#e0550a","#2a7a4b","#1a3a8f","#ff6b9d","#fff","#a855f7"];
  const particles = Array.from({ length: 130 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * -canvas.height * 0.5,
    w: Math.random() * 12 + 6,
    h: Math.random() * 6 + 3,
    color: colors[Math.floor(Math.random() * colors.length)],
    rot: Math.random() * Math.PI * 2,
    rotSpeed: (Math.random() - 0.5) * 0.18,
    vx: (Math.random() - 0.5) * 2.5,
    vy: Math.random() * 3.5 + 1.5,
  }));

  function frame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    for (const p of particles) {
      p.x += p.vx; p.y += p.vy; p.rot += p.rotSpeed;
      if (p.y < canvas.height + 20) alive = true;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    if (alive) confettiRAF = requestAnimationFrame(frame);
    else stopConfetti();
  }
  confettiRAF = requestAnimationFrame(frame);
}

function stopConfetti() {
  if (confettiRAF) { cancelAnimationFrame(confettiRAF); confettiRAF = null; }
  confettiCanvas.classList.remove("active");
}

/* ── Theme ── */
function applyTheme(id) {
  state.theme = id;
  localStorage.setItem("solitaire-theme", id);
  document.body.className = `theme-${id}`;
  document.querySelectorAll(".theme-option").forEach((el) => el.classList.toggle("active", el.dataset.theme === id));
}

function buildThemeGrid() {
  const grid = document.getElementById("theme-grid");
  grid.innerHTML = "";
  for (const theme of THEMES) {
    const el = document.createElement("div");
    el.className = "theme-option" + (theme.id === state.theme ? " active" : "");
    el.dataset.theme = theme.id;
    el.innerHTML = `
      <div class="theme-option__preview">
        <div class="theme-mini-card" style="background:${theme.cardBg};border-color:${theme.cardBorder};color:${theme.red}">A♥</div>
        <div class="theme-mini-card" style="background:${theme.cardBg};border-color:${theme.cardBorder};color:${theme.black}">K♠</div>
        <div class="theme-mini-back" style="background:linear-gradient(135deg,${theme.backA},${theme.backB})"></div>
      </div>
      <div class="theme-option__name">${theme.name}</div>`;
    el.addEventListener("click", () => { applyTheme(theme.id); grid.querySelectorAll(".theme-option").forEach((o) => o.classList.toggle("active", o.dataset.theme === theme.id)); });
    grid.appendChild(el);
  }
}

/* ── Modals ── */
function closeAllModals() {
  document.querySelectorAll(".modal-backdrop").forEach((m) => (m.hidden = true));
}

function buildLeaderboard() {
  const scores = loadScores();
  const el = document.getElementById("leaderboard-content");
  if (!scores.length) { el.innerHTML = '<p class="leaderboard-empty">No wins yet — play a game!</p>'; return; }
  const medals = ["🥇", "🥈", "🥉"];
  el.innerHTML = scores.map((s, i) => `
    <div class="lb-row">
      <div class="lb-rank">${medals[i] ?? `#${i + 1}`}</div>
      <div class="lb-info">
        <div class="lb-time">${formatTime(s.secs)}</div>
        <div class="lb-moves">${s.moves} moves &bull; ${s.date}</div>
      </div>
      <div class="lb-score">${s.score.toLocaleString()}</div>
    </div>`).join("");
}

/* ── Card element factory ── */
function makeCardEl(card) {
  const el = document.createElement("div");
  el.className = `card ${card.faceUp ? card.color : "face-down"}`;
  if (!card.faceUp) return el;
  const sym = SUIT_SYMBOL[card.suit];
  const rl = rankLabel(card.rank);
  el.innerHTML = `
    <div class="corner-top"><span class="rank">${rl}</span><span class="suit-small">${sym}</span></div>
    <div class="center-suit">${sym}</div>
    <div class="corner-bot"><span class="rank">${rl}</span><span class="suit-small">${sym}</span></div>`;
  return el;
}

/* ── Mouse drag & drop ── */
function attachDragHandlers(el, from, cards) {
  el.draggable = true;
  el.addEventListener("dragstart", (e) => {
    startDrag(from, cards);
    e.dataTransfer?.setData("text/plain", from.type);
    setTimeout(() => el.classList.add("dragging"), 0);
  });
  el.addEventListener("dragend", () => { el.classList.remove("dragging"); clearDrag(); });
}

function attachDropHandlers(el, onDrop) {
  el.addEventListener("dragover", (e) => { e.preventDefault(); el.classList.add("pile--highlight"); });
  el.addEventListener("dragleave", () => el.classList.remove("pile--highlight"));
  el.addEventListener("drop", (e) => { e.preventDefault(); el.classList.remove("pile--highlight"); onDrop(); });
}

/* ── Touch drag & drop (mobile) ── */
let activeTouchFrom = null;
let activeTouchCards = null;
let touchGhost = null;
let touchOffsetX = 0;
let touchOffsetY = 0;
let lastTouchDropZone = null;

function setupTouchDrag(el, from, cards) {
  el.addEventListener("touchstart", (e) => {
    if (state.gameOver) return;
    const touch = e.touches[0];
    const rect = el.getBoundingClientRect();
    touchOffsetX = touch.clientX - rect.left;
    touchOffsetY = touch.clientY - rect.top;
    activeTouchFrom = from;
    activeTouchCards = cards;

    const ghost = el.cloneNode(true);
    ghost.classList.add("touch-dragging");
    ghost.style.width = rect.width + "px";
    ghost.style.height = rect.height + "px";
    ghost.style.left = (touch.clientX - touchOffsetX) + "px";
    ghost.style.top = (touch.clientY - touchOffsetY) + "px";
    document.body.appendChild(ghost);
    touchGhost = ghost;
    e.preventDefault();
  }, { passive: false });

  el.addEventListener("touchmove", (e) => {
    if (!touchGhost) return;
    const touch = e.touches[0];
    touchGhost.style.left = (touch.clientX - touchOffsetX) + "px";
    touchGhost.style.top = (touch.clientY - touchOffsetY) + "px";

    touchGhost.style.visibility = "hidden";
    const elBelow = document.elementFromPoint(touch.clientX, touch.clientY);
    touchGhost.style.visibility = "";

    const zone = elBelow?.closest("[data-pile-type]");
    if (zone !== lastTouchDropZone) {
      lastTouchDropZone?.classList.remove("pile--highlight");
      zone?.classList.add("pile--highlight");
      lastTouchDropZone = zone;
    }
    e.preventDefault();
  }, { passive: false });

  el.addEventListener("touchend", (e) => {
    if (!touchGhost) return;
    const touch = e.changedTouches[0];

    touchGhost.style.visibility = "hidden";
    const elBelow = document.elementFromPoint(touch.clientX, touch.clientY);
    touchGhost.style.visibility = "";

    lastTouchDropZone?.classList.remove("pile--highlight");
    lastTouchDropZone = null;
    touchGhost.remove();
    touchGhost = null;

    const zone = elBelow?.closest("[data-pile-type]");
    if (zone && activeTouchFrom && activeTouchCards) {
      startDrag(activeTouchFrom, activeTouchCards);
      const pileType = zone.dataset.pileType;
      const pileIdx = parseInt(zone.dataset.pileIndex ?? "-1", 10);
      if (pileType === "tableau") moveToTableau(pileIdx);
      else if (pileType === "foundation") moveToFoundation(pileIdx);
      else clearDrag();
    }

    activeTouchFrom = null;
    activeTouchCards = null;
    e.preventDefault();
  }, { passive: false });
}

/* ── Render ── */
function renderStock() {
  stockPile.innerHTML = "";
  if (state.stock.length) {
    const back = document.createElement("div");
    back.className = "card face-down";
    stockPile.appendChild(back);
  }
}

function renderWaste() {
  wastePile.innerHTML = "";
  const top = state.waste[state.waste.length - 1];
  if (!top) return;
  const cardEl = makeCardEl(top);
  attachDragHandlers(cardEl, { type: "waste" }, [top]);
  setupTouchDrag(cardEl, { type: "waste" }, [top]);
  cardEl.addEventListener("dblclick", () => maybeAutoMoveToFoundation({ type: "waste" }));
  wastePile.appendChild(cardEl);
}

function renderFoundations() {
  foundationsEl.innerHTML = "";
  state.foundations.forEach((pile, i) => {
    const el = document.createElement("div");
    el.className = "pile";
    el.dataset.pileType = "foundation";
    el.dataset.pileIndex = i;
    if (!pile.length) {
      el.classList.add("foundation-placeholder");
      el.textContent = SUIT_SYMBOL[SUITS[i]];
    }
    attachDropHandlers(el, () => moveToFoundation(i));
    const top = pile[pile.length - 1];
    if (top) {
      const cardEl = makeCardEl(top);
      attachDragHandlers(cardEl, { type: "foundation", index: i }, [top]);
      setupTouchDrag(cardEl, { type: "foundation", index: i }, [top]);
      el.appendChild(cardEl);
    }
    foundationsEl.appendChild(el);
  });
}

function getOffset() {
  const w = window.innerWidth;
  if (w <= 380) return 14;
  if (w <= 520) return 16;
  if (w <= 720) return 20;
  if (w <= 900) return 26;
  return 30;
}

function renderTableau() {
  tableauEl.innerHTML = "";
  state.tableau.forEach((pile, pileIndex) => {
    const pileEl = document.createElement("div");
    pileEl.className = "pile tableau-pile";
    pileEl.dataset.pileType = "tableau";
    pileEl.dataset.pileIndex = pileIndex;
    attachDropHandlers(pileEl, () => moveToTableau(pileIndex));

    pile.forEach((card, cardIndex) => {
      const cardEl = makeCardEl(card);
      cardEl.classList.add("tableau-card");
      cardEl.style.top = `${cardIndex * getOffset()}px`;
      if (card.faceUp) {
        const movingCards = pile.slice(cardIndex);
        const from = { type: "tableau", index: pileIndex, subIndex: cardIndex };
        attachDragHandlers(cardEl, from, movingCards);
        setupTouchDrag(cardEl, from, movingCards);
        cardEl.addEventListener("dblclick", () => {
          if (cardIndex === pile.length - 1) maybeAutoMoveToFoundation({ type: "tableau", index: pileIndex });
        });
      }
      pileEl.appendChild(cardEl);
    });
    tableauEl.appendChild(pileEl);
  });
}

function render() {
  renderStock();
  renderWaste();
  renderFoundations();
  renderTableau();
}

/* ── Event wiring ── */
stockPile.addEventListener("click", drawFromStock);
stockPile.addEventListener("touchend", (e) => {
  if (!touchGhost) { drawFromStock(); e.preventDefault(); }
}, { passive: false });

newGameBtn.addEventListener("click", newGame);
document.addEventListener("dragend", clearDrag);

document.getElementById("theme-btn").addEventListener("click", () => {
  buildThemeGrid();
  document.getElementById("theme-modal").hidden = false;
});
document.getElementById("theme-close").addEventListener("click", () => document.getElementById("theme-modal").hidden = true);
document.getElementById("theme-modal").addEventListener("click", (e) => { if (e.target === e.currentTarget) e.currentTarget.hidden = true; });

document.getElementById("leaderboard-btn").addEventListener("click", () => {
  buildLeaderboard();
  document.getElementById("leaderboard-modal").hidden = false;
});
document.getElementById("leaderboard-close").addEventListener("click", () => document.getElementById("leaderboard-modal").hidden = true);
document.getElementById("leaderboard-modal").addEventListener("click", (e) => { if (e.target === e.currentTarget) e.currentTarget.hidden = true; });
document.getElementById("clear-scores-btn").addEventListener("click", () => {
  localStorage.removeItem("solitaire-scores");
  buildLeaderboard();
});

document.getElementById("win-new-game").addEventListener("click", () => {
  document.getElementById("win-modal").hidden = true;
  stopConfetti();
  newGame();
});
document.getElementById("win-leaderboard").addEventListener("click", () => {
  document.getElementById("win-modal").hidden = true;
  stopConfetti();
  buildLeaderboard();
  document.getElementById("leaderboard-modal").hidden = false;
});
document.getElementById("lose-new-game").addEventListener("click", () => {
  document.getElementById("lose-modal").hidden = true;
  newGame();
});

/* ── Boot ── */
applyTheme(state.theme);
newGame();
