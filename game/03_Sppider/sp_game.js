(() => {
  "use strict";

  const SUITS = {
    S: { symbol: "♠", red: false, name: "스페이드" },
    H: { symbol: "♥", red: true, name: "하트" },
    D: { symbol: "♦", red: true, name: "다이아" },
    C: { symbol: "♣", red: false, name: "클로버" }
  };
  const RANK_LABEL = {1:"A",11:"J",12:"Q",13:"K"};
  const MODE_NAMES = {1:"쉬움", 2:"중간", 4:"어려움"};
  const SCORE_KEY = "Sppider 97";

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const el = {
    tableau: $("#tableau"), score: $("#score"), combo: $("#combo"), moves: $("#moves"),
    timer: $("#timer"), modeLabel: $("#modeLabel"), message: $("#message"),
    progress: $("#progressBar"), setProgress: $("#setProgress"), foundations: $("#foundations"),
    stockPile: $("#stockPile"), stockRounds: $("#stockRounds"), comboBurst: $("#comboBurst"),
    difficultyModal: $("#difficultyModal"), closeDifficulty: $("#closeDifficulty"),
    rulesModal: $("#rulesModal"), confirmModal: $("#confirmModal"), winModal: $("#winModal"),
    sideMenu: $("#sideMenu"), menuShade: $("#menuShade"), soundBtn: $("#soundBtn")
  };

  let state = null;
  let timerId = null;
  let audioCtx = null;
  let keyboard = { col: 0, card: 0, carrying: false };
  let dragData = null;
  let dragGhost = null;
  let inactivityTimer = null;

  const clone = obj => JSON.parse(JSON.stringify(obj));
  const uid = (() => { let n = 0; return () => `c${Date.now().toString(36)}${n++}`; })();

  function buildDeck(suitCount, level) {
    const totalDecks = level + 1; // 2/3/4벌 = 104/156/208장
    const suitList = suitCount === 1 ? ["S"] : suitCount === 2 ? ["S","H"] : ["S","H","D","C"];
    const cards = [];
    for (let deck = 0; deck < totalDecks; deck++) {
      for (const suit of ["S","H","D","C"]) {
        const mappedSuit = suitList[(["S","H","D","C"].indexOf(suit)) % suitList.length];
        for (let rank = 1; rank <= 13; rank++) {
          cards.push({ id: uid(), suit: mappedSuit, rank, faceUp: false });
        }
      }
    }
    return shuffle(cards);
  }

  function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  function initialDealCount(level) {
    return ({1:54, 2:76, 3:98})[level];
  }

  function newGame(suitCount = state?.suitCount || 1, level = state?.level || 1) {
    clearInterval(timerId);
    const deck = buildDeck(suitCount, level);
    const initial = initialDealCount(level);
    const columns = Array.from({length:10}, () => []);
    for (let i = 0; i < initial; i++) columns[i % 10].push(deck.pop());
    columns.forEach(col => { if (col.length) col[col.length - 1].faceUp = true; });

    state = {
      suitCount, level, columns, stock: deck, completed: [],
      score: 500 * level, moves: 0, combo: 1, maxCombo: 1,
      startedAt: Date.now(), elapsed: 0, paused: false, won: false,
      selected: null, history: [], sound: localStorage.getItem("spSound") !== "off", animating: false
    };
    keyboard = { col: 0, card: Math.max(0, columns[0].length - 1), carrying: false };
    el.difficultyModal.classList.remove("open");
    el.closeDifficulty.classList.remove("hidden");
    el.winModal.classList.remove("open");
    updateSoundIcon();
    startTimer();
    render();
    setMessage("카드를 선택한 뒤 목적지를 클릭하세요.");
    sound("start");
    registerActivity();
  }

  function startTimer() {
    timerId = setInterval(() => {
      if (!state || state.paused || state.won) return;
      state.elapsed = Math.floor((Date.now() - state.startedAt) / 1000);
      el.timer.textContent = formatTime(state.elapsed);
    }, 1000);
  }

  function formatTime(sec) {
    const m = Math.floor(sec / 60).toString().padStart(2,"0");
    const s = (sec % 60).toString().padStart(2,"0");
    return `${m}:${s}`;
  }

  function rankText(rank) { return RANK_LABEL[rank] || String(rank); }

  function cardTop(col, index) {
    let top = 0;
    for (let i = 0; i < index; i++) top += col[i].faceUp ? getStep("face") : getStep("back");
    return top;
  }

  function getStep(type) {
    const root = getComputedStyle(document.documentElement);
    return parseFloat(root.getPropertyValue(type === "face" ? "--face-step" : "--back-step")) || (type === "face" ? 36 : 19);
  }

  function render(animateIds = []) {
    if (!state) return;
    el.tableau.innerHTML = "";
    const frag = document.createDocumentFragment();

    state.columns.forEach((col, colIndex) => {
      const columnEl = document.createElement("div");
      columnEl.className = "column" + (col.length ? "" : " empty") + (keyboard.col === colIndex ? " keyboard-focus" : "");
      columnEl.dataset.col = colIndex;
      const height = col.length ? cardTop(col, col.length - 1) + parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--card-h")) : 150;
      columnEl.style.height = `${Math.max(150, height)}px`;
      columnEl.addEventListener("click", e => {
        if (e.target === columnEl) handleColumnClick(colIndex);
      });
      columnEl.addEventListener("dragover", e => { e.preventDefault(); columnEl.classList.add("drop-target"); });
      columnEl.addEventListener("dragleave", () => columnEl.classList.remove("drop-target"));
      columnEl.addEventListener("drop", e => {
        e.preventDefault(); columnEl.classList.remove("drop-target");
        if (dragData) tryMove(dragData.col, dragData.index, colIndex);
      });

      col.forEach((card, cardIndex) => {
        const c = document.createElement("div");
        c.className = `card ${card.faceUp ? "face-up" : "face-down"} ${SUITS[card.suit].red ? "red" : ""}`;
        c.dataset.col = colIndex; c.dataset.index = cardIndex; c.dataset.id = card.id;
        c.style.top = `${cardTop(col, cardIndex)}px`;
        c.style.zIndex = cardIndex + 1;
        c.tabIndex = -1;
        if (animateIds.includes(card.id)) c.classList.add("dealing");
        if (state.selected && state.selected.col === colIndex && cardIndex >= state.selected.index) c.classList.add("selected");
        if (keyboard.col === colIndex && keyboard.card === cardIndex) c.classList.add("keyboard-card");

        if (card.faceUp) {
          c.innerHTML = `<span class="corner">${rankText(card.rank)}<small>${SUITS[card.suit].symbol}</small></span><span class="pip">${SUITS[card.suit].symbol}</span>`;
          c.draggable = true;
          c.addEventListener("dragstart", e => {
            registerActivity();
            if (!isMovableSequence(col, cardIndex)) { e.preventDefault(); invalidFeedback(c, "같은 무늬의 내림차순 묶음만 옮길 수 있습니다."); return; }
            dragData = { col: colIndex, index: cardIndex };
            state.selected = dragData;
            createDragGhost(col.slice(cardIndex), e);
            requestAnimationFrame(() => {
              el.tableau.querySelectorAll(`.card[data-col="${colIndex}"]`).forEach(node => {
                if (+node.dataset.index >= cardIndex) node.classList.add("drag-source");
              });
            });
          });
          c.addEventListener("dragend", () => { cleanupDragGhost(); dragData = null; state.selected = null; render(); });
          c.addEventListener("dblclick", e => {
            e.preventDefault(); e.stopPropagation(); registerActivity(); autoMoveFrom(colIndex, cardIndex);
          });
        }
        c.addEventListener("click", e => {
          e.stopPropagation();
          handleCardClick(colIndex, cardIndex, c);
        });
        frag.appendChild(document.createTextNode(""));
        columnEl.appendChild(c);
      });
      frag.appendChild(columnEl);
    });
    el.tableau.appendChild(frag);
    updateHUD();
  }

  function updateHUD() {
    const totalSets = (state.level + 1) * 4;
    el.score.textContent = Math.max(0, Math.floor(state.score)).toLocaleString();
    el.combo.textContent = `×${state.combo}`;
    el.moves.textContent = state.moves;
    el.timer.textContent = formatTime(state.elapsed);
    el.modeLabel.textContent = `${MODE_NAMES[state.suitCount]} ${state.level} · ${state.suitCount}무늬 · ${(state.level + 1) * 52}장`;
    el.setProgress.textContent = `${state.completed.length} / ${totalSets}`;
    el.progress.style.width = `${(state.completed.length / totalSets) * 100}%`;
    el.foundations.innerHTML = "";
    for (let i = 0; i < totalSets; i++) {
      const f = document.createElement("div");
      f.className = "foundation" + (i < state.completed.length ? " done" : "");
      f.textContent = i < state.completed.length ? SUITS[state.completed[i]].symbol : "";
      el.foundations.appendChild(f);
    }
    const rounds = Math.ceil(state.stock.length / 10);
    el.stockRounds.textContent = `${rounds}회 남음`;
    el.stockPile.disabled = state.stock.length === 0;
  }

  function registerActivity() {
    cancelAutoHint();
    clearTimeout(inactivityTimer);
    if (!state || state.won || state.paused) return;
    inactivityTimer = setTimeout(showAutoHint, 10000);
  }

  function getBestHint(randomAmongValid = false, fromOnly = null) {
    const candidates = [];
    for (let from = 0; from < 10; from++) {
      if (fromOnly !== null && from !== fromOnly.col) continue;
      const col = state.columns[from];
      for (let i = 0; i < col.length; i++) {
        if (fromOnly !== null && i !== fromOnly.index) continue;
        if (!isMovableSequence(col, i)) continue;
        for (let to = 0; to < 10; to++) {
          if (to === from || !canPlace(col[i], state.columns[to])) continue;
          const target = state.columns[to];
          let value = 0;
          if (target.length && target[target.length - 1].suit === col[i].suit) value += 12;
          if (i > 0 && !col[i-1].faceUp) value += 9;
          if (!target.length) value -= 2;
          candidates.push({from, i, to, value});
        }
      }
    }
    if (!candidates.length) return null;
    if (randomAmongValid) return candidates[Math.floor(Math.random() * candidates.length)];
    candidates.sort((a,b) => b.value - a.value);
    const bestValue = candidates[0].value;
    const best = candidates.filter(x => x.value === bestValue);
    return best[Math.floor(Math.random() * best.length)];
  }

  function showAutoHint() {
    if (!state || state.won || state.paused || state.selected) return;
    const hint = getBestHint(false);
    if (!hint) return;
    cancelAutoHint();
    const source = el.tableau.querySelector(`.card[data-col="${hint.from}"][data-index="${hint.i}"]`);
    const target = el.tableau.querySelector(`.column[data-col="${hint.to}"]`);
    source?.classList.add("auto-hint-card");
    target?.classList.add("auto-hint-target");
    setMessage(`${hint.from + 1}번 열의 빛나는 카드를 ${hint.to + 1}번 열로 옮길 수 있습니다.`);
    sound("hint");
  }

  function cancelAutoHint() {
    $$(".auto-hint-card").forEach(x => x.classList.remove("auto-hint-card"));
    $$(".auto-hint-target").forEach(x => x.classList.remove("auto-hint-target"));
  }

  function autoMoveFrom(col, index) {
    if (!state.columns[col][index]?.faceUp || !isMovableSequence(state.columns[col], index)) {
      invalidFeedback(el.tableau.querySelector(`.card[data-col="${col}"][data-index="${index}"]`), "이 카드 묶음은 자동 이동할 수 없습니다.");
      return;
    }

    const movingCard = state.columns[col][index];
    const cardTargets = [];
    const emptyTargets = [];

    // 더블클릭 자동 이동 우선순위:
    // 1) 숫자가 맞는 카드 위(여러 곳이면 무작위)
    // 2) 위 위치가 하나도 없을 때만 빈 열(여러 곳이면 무작위)
    for (let to = 0; to < state.columns.length; to++) {
      if (to === col) continue;
      const target = state.columns[to];
      if (!canPlace(movingCard, target)) continue;
      (target.length ? cardTargets : emptyTargets).push(to);
    }

    const targets = cardTargets.length ? cardTargets : emptyTargets;
    if (!targets.length) {
      invalidFeedback(el.tableau.querySelector(`.card[data-col="${col}"][data-index="${index}"]`), "이동 가능한 위치가 없습니다.");
      return;
    }

    const to = targets[Math.floor(Math.random() * targets.length)];
    tryMove(col, index, to);
  }

  function createDragGhost(cards, event) {
    cleanupDragGhost();
    dragGhost = document.createElement("div");
    dragGhost.className = "drag-ghost";
    cards.forEach((card, i) => {
      const node = document.createElement("div");
      node.className = `ghost-card ${SUITS[card.suit].red ? "red" : ""}`;
      node.style.top = `${i * 27}px`;
      node.innerHTML = `${rankText(card.rank)} ${SUITS[card.suit].symbol}`;
      dragGhost.appendChild(node);
    });
    dragGhost.style.height = `${parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--card-h")) + (cards.length - 1) * 27}px`;
    document.body.appendChild(dragGhost);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setDragImage(dragGhost, 24, 20);
  }

  function cleanupDragGhost() {
    dragGhost?.remove(); dragGhost = null;
    $$(".drag-source").forEach(x => x.classList.remove("drag-source"));
  }

  function handleCardClick(col, index, cardEl) {
    if (state?.animating) return;
    registerActivity();
    const card = state.columns[col][index];
    keyboard = { col, card: index, carrying: !!state.selected };
    if (!card.faceUp) return;

    if (!state.selected) {
      if (!isMovableSequence(state.columns[col], index)) {
        invalidFeedback(cardEl, "같은 무늬의 내림차순 묶음만 한 번에 옮길 수 있습니다.");
        return;
      }
      state.selected = { col, index };
      keyboard.carrying = true;
      sound("select");
      render();
      return;
    }
    if (state.selected.col === col && state.selected.index === index) {
      cancelSelection();
      return;
    }
    tryMove(state.selected.col, state.selected.index, col);
  }

  function handleColumnClick(col) {
    if (state?.animating) return;
    registerActivity();
    keyboard.col = col;
    keyboard.card = Math.max(0, state.columns[col].length - 1);
    if (state.selected) tryMove(state.selected.col, state.selected.index, col);
    else render();
  }

  function isMovableSequence(col, start) {
    if (!col[start]?.faceUp) return false;
    for (let i = start; i < col.length - 1; i++) {
      if (!col[i+1].faceUp || col[i].rank !== col[i+1].rank + 1 || col[i].suit !== col[i+1].suit) return false;
    }
    return true;
  }

  function canPlace(movingCard, targetCol) {
    if (!targetCol.length) return true;
    const top = targetCol[targetCol.length - 1];
    return top.faceUp && top.rank === movingCard.rank + 1;
  }

  function snapshot() {
    state.history.push({
      columns: clone(state.columns), stock: clone(state.stock), completed: clone(state.completed),
      score: state.score, moves: state.moves, combo: state.combo, maxCombo: state.maxCombo,
      selected: null
    });
    if (state.history.length > 80) state.history.shift();
  }

  function tryMove(fromCol, fromIndex, toCol) {
    if (state?.animating) return false;
    registerActivity();
    if (fromCol === toCol) { cancelSelection(); return false; }
    const source = state.columns[fromCol], target = state.columns[toCol];
    if (!source[fromIndex] || !isMovableSequence(source, fromIndex) || !canPlace(source[fromIndex], target)) {
      const targetEl = el.tableau.querySelector(`.column[data-col="${toCol}"]`);
      invalidFeedback(targetEl, "그 위치에는 놓을 수 없습니다.");
      return false;
    }

    snapshot();
    const moving = source.splice(fromIndex);
    const sameSuitBonus = target.length && target[target.length - 1].suit === moving[0].suit;
    target.push(...moving);
    state.moves++;
    state.score = Math.max(0, state.score - 1);
    state.selected = null;
    keyboard = { col: toCol, card: target.length - moving.length, carrying: false };
    rewardMove(sameSuitBonus ? 8 : 2);
    flipTop(fromCol);
    sound("move");
    render(moving.map(c => c.id));
    setTimeout(() => checkCompletedChains([fromCol, toCol]), 190);
    return true;
  }

  function flipTop(colIndex) {
    const col = state.columns[colIndex];
    if (col.length && !col[col.length - 1].faceUp) {
      col[col.length - 1].faceUp = true;
      state.score += 5 * state.combo;
      sound("flip");
    }
  }

  async function checkCompletedChains(preferredCols = [...Array(10).keys()]) {
    if (state.animating) return;
    let removedAny = false;
    state.animating = true;
    try {
      for (const colIndex of preferredCols) {
        let col = state.columns[colIndex];
        let loop = true;
        while (loop && col.length >= 13) {
          loop = false;
          const seq = col.slice(-13);
          const suit = seq[0].suit;
          const complete = seq.every((c, i) => c.faceUp && c.suit === suit && c.rank === 13 - i);
          if (complete) {
            if (!removedAny) snapshot();

            await animateCompletedSequence(colIndex, seq, suit);

            col.splice(-13);
            state.completed.push(suit);
            state.combo = Math.min(10, state.combo + 1);
            state.maxCombo = Math.max(state.maxCombo, state.combo);
            const bonus = 100 * Math.pow(2, state.combo - 1);
            state.score += bonus;
            removedAny = true;
            loop = true;
            flipTop(colIndex);
            burst(`SEQUENCE CLEAR!\nCOMBO ×${state.combo}  +${bonus.toLocaleString()}`);
            sound("complete");
            render();
            await wait(260);
          }
        }
      }
    } finally {
      state.animating = false;
    }
    if (removedAny) checkWin();
  }

  function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function animateCompletedSequence(colIndex, seq, suit) {
    const totalBefore = state.completed.length;
    const target = el.foundations.children[totalBefore] || el.foundations.lastElementChild;
    const targetRect = target?.getBoundingClientRect();
    const sourceEls = seq.map(card => el.tableau.querySelector(`.card[data-id="${card.id}"]`));
    if (!targetRect || sourceEls.some(node => !node)) return;

    setMessage(`${SUITS[suit].name} K–A 완성! 카드가 보관함으로 이동합니다.`);
    el.tableau.classList.add("sequence-clearing");

    // 완성된 13장을 한 번에 금빛으로 강조한 뒤, A부터 K까지 연속 이동시킨다.
    sourceEls.forEach((node, i) => {
      node.classList.add("sequence-ready");
      node.style.setProperty("--ready-delay", `${i * 22}ms`);
    });
    sound("sequenceStart");
    await wait(430);

    for (let i = sourceEls.length - 1; i >= 0; i--) {
      const node = sourceEls[i];
      const rect = node.getBoundingClientRect();
      const ghost = node.cloneNode(true);
      ghost.className = node.className.replace("sequence-ready", "") + " sequence-fly-card";
      ghost.style.left = `${rect.left}px`;
      ghost.style.top = `${rect.top}px`;
      ghost.style.width = `${rect.width}px`;
      ghost.style.height = `${rect.height}px`;
      ghost.style.setProperty("--fly-x", `${targetRect.left + targetRect.width/2 - (rect.left + rect.width/2)}px`);
      ghost.style.setProperty("--fly-y", `${targetRect.top + targetRect.height/2 - (rect.top + rect.height/2)}px`);
      ghost.style.setProperty("--fly-rot", `${((12-i)%2 ? -1 : 1) * (5 + (12-i)*.45)}deg`);
      document.body.appendChild(ghost);
      node.style.visibility = "hidden";

      createSparkTrail(rect.left + rect.width/2, rect.top + rect.height/2, suit);
      requestAnimationFrame(() => ghost.classList.add("fly"));
      soundCardTick(12 - i);
      await wait(72);
      setTimeout(() => ghost.remove(), 620);
    }

    await wait(520);
    target?.classList.add("foundation-impact");
    createCompletionBurst(targetRect.left + targetRect.width/2, targetRect.top + targetRect.height/2, suit);
    sound("sequenceLand");
    await wait(330);
    target?.classList.remove("foundation-impact");
    el.tableau.classList.remove("sequence-clearing");
  }

  function soundCardTick(step) {
    if (!state?.sound) return;
    playPaperSound({ duration: .055, intensity: .28, pitch: 1 + step * .018 });
  }

  function createNoiseBuffer(duration = .12) {
    const sampleRate = audioCtx.sampleRate;
    const length = Math.max(1, Math.floor(sampleRate * duration));
    const buffer = audioCtx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i++) {
      // 종이가 미끄러질 때 나는 부드러운 마찰음을 위한 상관 잡음
      const white = Math.random() * 2 - 1;
      last = last * .72 + white * .28;
      data[i] = last;
    }
    return buffer;
  }

  function playPaperSound({duration = .1, intensity = .55, pitch = 1, snap = false} = {}) {
    if (!state?.sound) return;
    try {
      audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === "suspended") audioCtx.resume();
      const now = audioCtx.currentTime;
      const source = audioCtx.createBufferSource();
      const highpass = audioCtx.createBiquadFilter();
      const lowpass = audioCtx.createBiquadFilter();
      const gain = audioCtx.createGain();

      source.buffer = createNoiseBuffer(duration + .035);
      source.playbackRate.setValueAtTime(pitch, now);
      highpass.type = "highpass";
      highpass.frequency.setValueAtTime(550, now);
      lowpass.type = "lowpass";
      lowpass.frequency.setValueAtTime(4200, now);
      lowpass.frequency.exponentialRampToValueAtTime(1450, now + duration);

      gain.gain.setValueAtTime(.0001, now);
      gain.gain.exponentialRampToValueAtTime(.075 * intensity, now + .008);
      gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
      source.connect(highpass).connect(lowpass).connect(gain).connect(audioCtx.destination);
      source.start(now);
      source.stop(now + duration + .04);

      if (snap) {
        const click = audioCtx.createOscillator();
        const clickGain = audioCtx.createGain();
        click.type = "triangle";
        click.frequency.setValueAtTime(185 * pitch, now);
        click.frequency.exponentialRampToValueAtTime(95, now + .025);
        clickGain.gain.setValueAtTime(.025 * intensity, now);
        clickGain.gain.exponentialRampToValueAtTime(.0001, now + .035);
        click.connect(clickGain).connect(audioCtx.destination);
        click.start(now); click.stop(now + .04);
      }
    } catch (_) {}
  }

  function createSparkTrail(x, y, suit) {
    for (let i = 0; i < 3; i++) {
      const spark = document.createElement("i");
      spark.className = `sequence-spark ${SUITS[suit].red ? "warm" : "cool"}`;
      spark.style.left = `${x + (Math.random()-.5)*20}px`;
      spark.style.top = `${y + (Math.random()-.5)*18}px`;
      spark.style.setProperty("--spark-x", `${(Math.random()-.5)*70}px`);
      spark.style.setProperty("--spark-y", `${-25-Math.random()*55}px`);
      document.body.appendChild(spark);
      setTimeout(() => spark.remove(), 650);
    }
  }

  function createCompletionBurst(x, y, suit) {
    const ring = document.createElement("div");
    ring.className = `completion-ring ${SUITS[suit].red ? "warm" : "cool"}`;
    ring.style.left = `${x}px`; ring.style.top = `${y}px`;
    document.body.appendChild(ring);
    setTimeout(() => ring.remove(), 900);
    for (let i = 0; i < 18; i++) {
      const star = document.createElement("i");
      star.className = "completion-star";
      const a = (Math.PI * 2 * i / 18) + Math.random()*.15;
      const r = 45 + Math.random()*55;
      star.style.left = `${x}px`; star.style.top = `${y}px`;
      star.style.setProperty("--star-x", `${Math.cos(a)*r}px`);
      star.style.setProperty("--star-y", `${Math.sin(a)*r}px`);
      document.body.appendChild(star);
      setTimeout(() => star.remove(), 950);
    }
  }

  function rewardMove(base) {
    const gain = base * Math.pow(2, Math.max(0, state.combo - 1));
    state.score += gain;
  }

  function dealStock() {
    if (state?.animating) return;
    registerActivity();
    if (!state || state.stock.length === 0) return;
    if (state.columns.some(c => c.length === 0)) {
      setMessage("빈 열을 먼저 채워야 새 카드를 배분할 수 있습니다.", true);
      sound("error");
      return;
    }
    snapshot();
    const dealt = [];
    for (let i = 0; i < 10 && state.stock.length; i++) {
      const card = state.stock.pop();
      card.faceUp = true;
      state.columns[i].push(card);
      dealt.push(card.id);
    }
    state.moves++;
    state.score = Math.max(0, state.score - 5);
    state.combo = 1;
    state.selected = null;
    sound("deal");
    render(dealt);
    setMessage("새 카드가 배분되었습니다. 콤보가 초기화됩니다.");
    setTimeout(() => checkCompletedChains(), 280);
  }

  function undo() {
    if (state?.animating) return;
    registerActivity();
    if (!state?.history.length) {
      setMessage("되돌릴 수 있는 이동이 없습니다.", true); sound("error"); return;
    }
    const prev = state.history.pop();
    Object.assign(state, prev);
    state.score = Math.max(0, state.score - 10);
    keyboard.carrying = false;
    sound("undo");
    render();
    setMessage("이전 이동으로 되돌렸습니다. (-10점)");
  }

  function cancelSelection() {
    state.selected = null;
    keyboard.carrying = false;
    sound("cancel");
    render();
  }

  function findHint() {
    if (state?.animating) return;
    registerActivity();
    cancelHint();
    const best = getBestHint(false);
    if (!best) {
      if (state.stock.length) setMessage("가능한 이동이 적습니다. 새 카드를 배분해 보세요.");
      else setMessage("가능한 이동을 찾지 못했습니다.", true);
      sound("error");
      return;
    }
    const sourceCard = el.tableau.querySelector(`.card[data-col="${best.from}"][data-index="${best.i}"]`);
    const targetCol = el.tableau.querySelector(`.column[data-col="${best.to}"]`);
    sourceCard?.classList.add("hint-card");
    targetCol?.classList.add("drop-target");
    setMessage(`${best.from + 1}번 열의 ${rankText(state.columns[best.from][best.i].rank)} 카드를 ${best.to + 1}번 열로 옮겨 보세요.`);
    sound("hint");
    setTimeout(() => { sourceCard?.classList.remove("hint-card"); targetCol?.classList.remove("drop-target"); registerActivity(); }, 2200);
  }

  function cancelHint() {
    $$(".hint-card").forEach(x => x.classList.remove("hint-card"));
    $$(".drop-target").forEach(x => x.classList.remove("drop-target"));
  }

  function checkWin() {
    const totalSets = (state.level + 1) * 4;
    if (state.completed.length < totalSets) return;
    state.won = true;
    clearInterval(timerId);
    const timeBonus = Math.max(0, 6000 - state.elapsed * 4);
    const moveBonus = Math.max(0, 4000 - state.moves * 8);
    state.score += timeBonus + moveBonus;
    render();
    const key = `${state.suitCount}-${state.level}`;
    const records = JSON.parse(localStorage.getItem(SCORE_KEY) || "{}");
    const isBest = !records[key] || state.score > records[key].score;
    if (isBest) {
      records[key] = {score: Math.floor(state.score), time: state.elapsed, moves: state.moves, date: new Date().toISOString()};
      localStorage.setItem(SCORE_KEY, JSON.stringify(records));
    }
    $("#finalScore").textContent = Math.floor(state.score).toLocaleString();
    $("#finalTime").textContent = formatTime(state.elapsed);
    $("#finalMoves").textContent = state.moves;
    $("#finalCombo").textContent = `×${state.maxCombo}`;
    $("#recordBadge").classList.toggle("hidden", !isBest);
    setTimeout(() => el.winModal.classList.add("open"), 500);
    sound("win");
    confetti();
  }

  function setMessage(text, warn = false) {
    el.message.textContent = text;
    el.message.classList.toggle("warn", warn);
    if (warn) setTimeout(() => el.message.classList.remove("warn"), 500);
  }

  function invalidFeedback(node, text) {
    node?.classList.add("invalid");
    setTimeout(() => node?.classList.remove("invalid"), 350);
    setMessage(text, true); sound("error");
  }

  function burst(text) {
    el.comboBurst.innerHTML = text.replace("\n","<br>");
    el.comboBurst.classList.remove("show");
    void el.comboBurst.offsetWidth;
    el.comboBurst.classList.add("show");
  }

  function sound(type) {
    if (!state?.sound) return;

    // 카드 조작음은 외부 음원 없이 Web Audio로 만든 종이/트럼프 마찰음이다.
    const paperPresets = {
      select: {duration:.045, intensity:.22, pitch:1.22},
      move: {duration:.115, intensity:.68, pitch:1.0, snap:true},
      flip: {duration:.09, intensity:.55, pitch:1.35, snap:true},
      deal: {duration:.16, intensity:.82, pitch:.9, snap:true},
      undo: {duration:.13, intensity:.52, pitch:.78},
      cancel: {duration:.04, intensity:.18, pitch:.8},
      sequenceStart: {duration:.18, intensity:.7, pitch:.92},
      sequenceLand: {duration:.2, intensity:.9, pitch:.75, snap:true}
    };
    if (paperPresets[type]) {
      playPaperSound(paperPresets[type]);
      return;
    }

    try {
      audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
      const map = {
        hint:[760,.12,"sine"], error:[120,.12,"sawtooth"], start:[500,.16,"triangle"],
        complete:[880,.28,"sine"], win:[1040,.5,"sine"]
      };
      const [freq,dur,wave] = map[type] || map.hint;
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = wave; osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(.045, now);
      gain.gain.exponentialRampToValueAtTime(.001, now + dur);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(now); osc.stop(now + dur);
      if (type === "complete" || type === "win") {
        [1.25,1.5,2].slice(0, type === "win" ? 3 : 2).forEach((ratio, idx) => {
          const o = audioCtx.createOscillator(), g = audioCtx.createGain();
          o.type = "sine"; o.frequency.value = freq * ratio;
          g.gain.setValueAtTime(.03, now + .08*(idx+1));
          g.gain.exponentialRampToValueAtTime(.001, now + dur + .08*(idx+1));
          o.connect(g).connect(audioCtx.destination);
          o.start(now + .08*(idx+1)); o.stop(now + dur + .1*(idx+1));
        });
      }
    } catch (_) {}
  }

  function toggleSound() {
    state.sound = !state.sound;
    localStorage.setItem("spSound", state.sound ? "on" : "off");
    updateSoundIcon();
    if (state.sound) sound("select");
  }

  function updateSoundIcon() { el.soundBtn.textContent = state?.sound === false ? "🔇" : "🔊"; }

  function confetti() {
    for (let i = 0; i < 70; i++) {
      const p = document.createElement("i");
      p.style.cssText = `position:fixed;z-index:850;left:${Math.random()*100}vw;top:-20px;width:8px;height:14px;background:hsl(${Math.random()*360} 85% 60%);transform:rotate(${Math.random()*360}deg);transition:transform ${2+Math.random()*2}s linear,top ${2+Math.random()*2}s linear;`;
      document.body.appendChild(p);
      requestAnimationFrame(() => { p.style.top = "110vh"; p.style.transform += ` translateX(${(Math.random()-.5)*300}px) rotate(900deg)`; });
      setTimeout(() => p.remove(), 4300);
    }
  }

  function openDifficulty() {
    updateBestLine();
    el.difficultyModal.classList.add("open");
    if (state) state.paused = true;
  }
  function closeDifficulty() {
    if (!state) return;
    el.difficultyModal.classList.remove("open");
    state.paused = false;
    state.startedAt = Date.now() - state.elapsed * 1000;
  }
  function updateBestLine() {
    const records = JSON.parse(localStorage.getItem(SCORE_KEY) || "{}");
    const entries = Object.values(records);
    if (!entries.length) $("#bestLine").textContent = "최고 기록이 아직 없습니다.";
    else {
      const best = entries.sort((a,b)=>b.score-a.score)[0];
      $("#bestLine").textContent = `전체 최고 점수 ${best.score.toLocaleString()}점 · ${formatTime(best.time)} · ${best.moves}회 이동`;
    }
  }

  function openMenu() {
    el.sideMenu.classList.add("open"); el.sideMenu.setAttribute("aria-hidden","false");
    el.menuShade.classList.remove("hidden");
  }
  function closeMenu() {
    el.sideMenu.classList.remove("open"); el.sideMenu.setAttribute("aria-hidden","true");
    el.menuShade.classList.add("hidden");
  }
  function showRules() { el.rulesModal.classList.add("open"); closeMenu(); }
  function askNew() { el.confirmModal.classList.add("open"); closeMenu(); }

  function keyboardMove(dx, dy) {
    registerActivity();
    keyboard.col = Math.max(0, Math.min(9, keyboard.col + dx));
    const col = state.columns[keyboard.col];
    if (!col.length) keyboard.card = 0;
    else {
      const firstFaceUp = Math.max(0, col.findIndex(c => c.faceUp));
      if (dx !== 0) keyboard.card = col.length - 1;
      if (dy < 0) keyboard.card = Math.max(firstFaceUp, keyboard.card - 1);
      if (dy > 0) keyboard.card = Math.min(col.length - 1, keyboard.card + 1);
      keyboard.card = Math.max(firstFaceUp, Math.min(keyboard.card, col.length - 1));
    }
    render();
    const node = el.tableau.querySelector(`.card[data-col="${keyboard.col}"][data-index="${keyboard.card}"]`);
    node?.scrollIntoView({block:"nearest", inline:"nearest"});
  }

  function keyboardSpace() {
    registerActivity();
    const col = state.columns[keyboard.col];
    if (!state.selected) {
      if (!col.length) return;
      handleCardClick(keyboard.col, keyboard.card, el.tableau.querySelector(`.card[data-col="${keyboard.col}"][data-index="${keyboard.card}"]`));
    } else {
      tryMove(state.selected.col, state.selected.index, keyboard.col);
    }
  }

  // UI events
  $$(".level-buttons button").forEach(btn => btn.addEventListener("click", () => newGame(+btn.dataset.suits, +btn.dataset.level)));
  $("#stockPile").addEventListener("click", dealStock);
  $("#undoBtn").addEventListener("click", undo);
  $("#hintBtn").addEventListener("click", findHint);
  $("#newBtn").addEventListener("click", askNew);
  $("#menuBtn").addEventListener("click", openMenu);
  $("#closeMenuBtn").addEventListener("click", closeMenu);
  $("#menuShade").addEventListener("click", closeMenu);
  $("#soundBtn").addEventListener("click", toggleSound);
  $("#menuNewGame").addEventListener("click", askNew);
  $("#menuDifficulty").addEventListener("click", () => { closeMenu(); openDifficulty(); });
  $("#menuUndo").addEventListener("click", () => { closeMenu(); undo(); });
  $("#menuHint").addEventListener("click", () => { closeMenu(); findHint(); });
  $("#menuRules").addEventListener("click", showRules);
  $$(".close-rules").forEach(b => b.addEventListener("click", () => el.rulesModal.classList.remove("open")));
  $("#cancelNew").addEventListener("click", () => el.confirmModal.classList.remove("open"));
  $("#confirmNew").addEventListener("click", () => { el.confirmModal.classList.remove("open"); newGame(); });
  $("#closeDifficulty").addEventListener("click", closeDifficulty);
  $("#playAgain").addEventListener("click", () => newGame());
  $("#changeMode").addEventListener("click", () => { el.winModal.classList.remove("open"); openDifficulty(); });

  document.addEventListener("keydown", e => {
    if (!state || state.animating || el.difficultyModal.classList.contains("open") || el.winModal.classList.contains("open")) return;
    const tag = document.activeElement?.tagName;
    if (["INPUT","TEXTAREA","SELECT"].includes(tag)) return;
    if (e.key === "ArrowLeft") { e.preventDefault(); keyboardMove(-1,0); }
    else if (e.key === "ArrowRight") { e.preventDefault(); keyboardMove(1,0); }
    else if (e.key === "ArrowUp") { e.preventDefault(); keyboardMove(0,-1); }
    else if (e.key === "ArrowDown") { e.preventDefault(); keyboardMove(0,1); }
    else if (e.code === "Space" || e.key === "Enter") { e.preventDefault(); keyboardSpace(); }
    else if (e.key === "Backspace") { e.preventDefault(); undo(); }
    else if (e.key.toLowerCase() === "h") findHint();
    else if (e.key.toLowerCase() === "d") dealStock();
    else if (e.key.toLowerCase() === "n") askNew();
    else if (e.key === "Escape") { cancelSelection(); closeMenu(); }
  });

  window.addEventListener("resize", () => { if (state) render(); });
  ["pointerdown","wheel","touchstart"].forEach(type => document.addEventListener(type, () => { if (state) registerActivity(); }, {passive:true}));
  updateBestLine();
})();