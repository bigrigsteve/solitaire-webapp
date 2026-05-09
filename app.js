const SUITS = ["hearts", "diamonds", "clubs", "spades"];
const SUIT_SYMBOL = {
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
  spades: "♠",
};
const RANK_LABEL = {
  1: "A",
  11: "J",
  12: "Q",
  13: "K",
};

const state = {
  stock: [],
  waste: [],
  foundations: [[], [], [], []],
  tableau: [[], [], [], [], [], [], []],
  dragging: null,
};

const stockPile = document.getElementById("stock-pile");
const wastePile = document.getElementById("waste-pile");
const foundationsEl = document.getElementById("foundations");
const tableauEl = document.getElementById("tableau");
const statusText = document.getElementById("status-text");
const newGameBtn = document.getElementById("new-game-btn");

function cardColor(suit) {
  return suit === "hearts" || suit === "diamonds" ? "red" : "black";
}

function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 13; rank += 1) {
      deck.push({
        id: `${suit}-${rank}-${Math.random().toString(36).slice(2, 8)}`,
        suit,
        rank,
        color: cardColor(suit),
        faceUp: false,
      });
    }
  }
  return deck;
}

function shuffle(cards) {
  const copy = [...cards];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function newGame() {
  const deck = shuffle(createDeck());
  state.stock = [];
  state.waste = [];
  state.foundations = [[], [], [], []];
  state.tableau = [[], [], [], [], [], [], []];
  state.dragging = null;

  for (let pile = 0; pile < 7; pile += 1) {
    for (let i = 0; i <= pile; i += 1) {
      const card = deck.pop();
      card.faceUp = i === pile;
      state.tableau[pile].push(card);
    }
  }

  while (deck.length) {
    const card = deck.pop();
    card.faceUp = false;
    state.stock.push(card);
  }

  statusText.textContent = "Build all foundations from Ace to King.";
  render();
}

function rankLabel(rank) {
  return RANK_LABEL[rank] || String(rank);
}

function canPlaceOnTableau(movingCard, targetCard) {
  if (!targetCard) {
    return movingCard.rank === 13;
  }
  return targetCard.faceUp && movingCard.color !== targetCard.color && movingCard.rank === targetCard.rank - 1;
}

function canPlaceOnFoundation(card, foundationPile) {
  const top = foundationPile[foundationPile.length - 1];
  if (!top) {
    return card.rank === 1;
  }
  return card.suit === top.suit && card.rank === top.rank + 1;
}

function drawFromStock() {
  if (state.stock.length) {
    const card = state.stock.pop();
    card.faceUp = true;
    state.waste.push(card);
  } else if (state.waste.length) {
    while (state.waste.length) {
      const card = state.waste.pop();
      card.faceUp = false;
      state.stock.push(card);
    }
  }
  render();
}

function maybeAutoMoveToFoundation(from) {
  let card = null;
  if (from.type === "waste") {
    card = state.waste[state.waste.length - 1];
  } else if (from.type === "tableau") {
    const pile = state.tableau[from.index];
    card = pile[pile.length - 1];
    if (!card || !card.faceUp) return false;
  } else if (from.type === "foundation") {
    return false;
  }

  if (!card) return false;

  for (let i = 0; i < state.foundations.length; i += 1) {
    if (canPlaceOnFoundation(card, state.foundations[i])) {
      if (from.type === "waste") {
        state.waste.pop();
      } else if (from.type === "tableau") {
        state.tableau[from.index].pop();
        const reveal = state.tableau[from.index][state.tableau[from.index].length - 1];
        if (reveal && !reveal.faceUp) reveal.faceUp = true;
      }
      state.foundations[i].push(card);
      render();
      return true;
    }
  }

  return false;
}

function startDrag(from, cards) {
  state.dragging = { from, cards };
}

function clearDrag() {
  state.dragging = null;
}

function moveToTableau(targetIndex) {
  if (!state.dragging) return false;
  const { from, cards } = state.dragging;
  if (!cards.length) return false;

  const targetPile = state.tableau[targetIndex];
  const targetTop = targetPile[targetPile.length - 1];
  const movingCard = cards[0];

  if (!canPlaceOnTableau(movingCard, targetTop)) return false;

  if (from.type === "waste") {
    state.waste.pop();
  } else if (from.type === "foundation") {
    state.foundations[from.index].pop();
  } else if (from.type === "tableau") {
    state.tableau[from.index].splice(from.subIndex);
    const reveal = state.tableau[from.index][state.tableau[from.index].length - 1];
    if (reveal && !reveal.faceUp) reveal.faceUp = true;
  }

  targetPile.push(...cards);
  clearDrag();
  render();
  return true;
}

function moveToFoundation(targetIndex) {
  if (!state.dragging) return false;
  const { from, cards } = state.dragging;
  if (cards.length !== 1) return false;
  const card = cards[0];
  const target = state.foundations[targetIndex];

  if (!canPlaceOnFoundation(card, target)) return false;

  if (from.type === "waste") {
    state.waste.pop();
  } else if (from.type === "tableau") {
    state.tableau[from.index].splice(from.subIndex);
    const reveal = state.tableau[from.index][state.tableau[from.index].length - 1];
    if (reveal && !reveal.faceUp) reveal.faceUp = true;
  } else if (from.type === "foundation") {
    state.foundations[from.index].pop();
  }

  target.push(card);
  clearDrag();
  render();
  return true;
}

function checkWin() {
  return state.foundations.every((pile) => pile.length === 13);
}

function makeCardEl(card) {
  const el = document.createElement("div");
  el.className = `card ${card.faceUp ? card.color : "face-down"}`;
  if (!card.faceUp) {
    el.classList.add("face-down");
    return el;
  }
  el.innerHTML = `<span>${rankLabel(card.rank)} ${SUIT_SYMBOL[card.suit]}</span>
    <span class="bottom">${rankLabel(card.rank)} ${SUIT_SYMBOL[card.suit]}</span>`;
  return el;
}

function renderStock() {
  stockPile.innerHTML = "";
  stockPile.classList.remove("pile--highlight");
  if (state.stock.length) {
    const back = document.createElement("div");
    back.className = "card face-down";
    stockPile.appendChild(back);
  }
}

function renderWaste() {
  wastePile.innerHTML = "";
  wastePile.classList.remove("pile--highlight");
  const top = state.waste[state.waste.length - 1];
  if (!top) return;

  const cardEl = makeCardEl(top);
  cardEl.draggable = true;
  cardEl.addEventListener("dragstart", (event) => {
    startDrag({ type: "waste" }, [top]);
    event.dataTransfer?.setData("text/plain", "waste");
  });
  cardEl.addEventListener("dblclick", () => {
    maybeAutoMoveToFoundation({ type: "waste" });
  });
  wastePile.appendChild(cardEl);
}

function renderFoundations() {
  foundationsEl.innerHTML = "";
  state.foundations.forEach((pile, foundationIndex) => {
    const foundationEl = document.createElement("div");
    foundationEl.className = "pile";
    foundationEl.addEventListener("dragover", (e) => e.preventDefault());
    foundationEl.addEventListener("drop", (e) => {
      e.preventDefault();
      moveToFoundation(foundationIndex);
    });

    const top = pile[pile.length - 1];
    if (top) {
      const cardEl = makeCardEl(top);
      cardEl.draggable = true;
      cardEl.addEventListener("dragstart", (event) => {
        startDrag({ type: "foundation", index: foundationIndex }, [top]);
        event.dataTransfer?.setData("text/plain", "foundation");
      });
      foundationEl.appendChild(cardEl);
    }

    foundationsEl.appendChild(foundationEl);
  });
}

function renderTableau() {
  tableauEl.innerHTML = "";
  state.tableau.forEach((pile, pileIndex) => {
    const pileEl = document.createElement("div");
    pileEl.className = "pile tableau-pile";
    pileEl.addEventListener("dragover", (e) => e.preventDefault());
    pileEl.addEventListener("drop", (e) => {
      e.preventDefault();
      moveToTableau(pileIndex);
    });

    pile.forEach((card, cardIndex) => {
      const cardEl = makeCardEl(card);
      cardEl.classList.add("tableau-card");
      cardEl.style.top = `${cardIndex * 28}px`;

      if (card.faceUp) {
        cardEl.draggable = true;
        cardEl.addEventListener("dragstart", (event) => {
          const moving = pile.slice(cardIndex);
          startDrag({ type: "tableau", index: pileIndex, subIndex: cardIndex }, moving);
          event.dataTransfer?.setData("text/plain", "tableau");
        });
        cardEl.addEventListener("dblclick", () => {
          const isTop = cardIndex === pile.length - 1;
          if (isTop) {
            maybeAutoMoveToFoundation({ type: "tableau", index: pileIndex });
          }
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
  if (checkWin()) {
    statusText.textContent = "You win! Start a new game to play again.";
  }
}

stockPile.addEventListener("click", drawFromStock);
newGameBtn.addEventListener("click", newGame);
document.addEventListener("dragend", () => clearDrag());

newGame();
