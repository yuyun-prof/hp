(() => {
  "use strict";

  const COLS = 10;
  const ROWS = 20;
  const CELL_SIZE = 30;

  const SHAPES = {
    I: [
      [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
      [[0,0,1,0],[0,0,1,0],[0,0,1,0],[0,0,1,0]]
    ],
    O: [
      [[1,1],[1,1]]
    ],
    T: [
      [[0,1,0],[1,1,1],[0,0,0]],
      [[0,1,0],[0,1,1],[0,1,0]],
      [[0,0,0],[1,1,1],[0,1,0]],
      [[0,1,0],[1,1,0],[0,1,0]]
    ],
    S: [
      [[0,1,1],[1,1,0],[0,0,0]],
      [[0,1,0],[0,1,1],[0,0,1]]
    ],
    Z: [
      [[1,1,0],[0,1,1],[0,0,0]],
      [[0,0,1],[0,1,1],[0,1,0]]
    ],
    J: [
      [[1,0,0],[1,1,1],[0,0,0]],
      [[0,1,1],[0,1,0],[0,1,0]],
      [[0,0,0],[1,1,1],[0,0,1]],
      [[0,1,0],[0,1,0],[1,1,0]]
    ],
    L: [
      [[0,0,1],[1,1,1],[0,0,0]],
      [[0,1,0],[0,1,0],[0,1,1]],
      [[0,0,0],[1,1,1],[1,0,0]],
      [[1,1,0],[0,1,0],[0,1,0]]
    ]
  };

  const COLORS = {
    I: "#00D9FF",
    O: "#FFD93D",
    T: "#B65CFF",
    S: "#58D68D",
    Z: "#FF5C5C",
    J: "#4D7CFE",
    L: "#FF9F43"
  };

  const BASE_LINE_SCORE = 100;
  const LINE_MULTIPLIERS = { 1: 1, 2: 1.5, 3: 2, 4: 4 };

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const nextCanvas = document.getElementById("nextCanvas");
  const nextCtx = nextCanvas.getContext("2d");

  const scoreEl = document.getElementById("score");
  const levelEl = document.getElementById("level");
  const linesEl = document.getElementById("lines");
  const comboEl = document.getElementById("combo");
  const comboBadge = document.getElementById("comboBadge");
  const scorePop = document.getElementById("scorePop");
  const pauseButton = document.getElementById("pauseButton");
  const restartButton = document.getElementById("restartButton");
  const overlayRestartButton = document.getElementById("overlayRestartButton");
  const overlay = document.getElementById("gameOverlay");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlayText = document.getElementById("overlayText");

  let board;
  let score;
  let level;
  let linesCleared;
  let dropInterval;
  let currentPiece;
  let nextPiece;
  let isPaused;
  let gameOver;
  let dropTimer;
  let comboStreak;
  let isClearing;

  function emptyBoard() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  }

  function randomPiece() {
    const types = Object.keys(SHAPES);
    return {
      type: types[Math.floor(Math.random() * types.length)],
      rotation: 0,
      x: 0,
      y: 0
    };
  }

  function getShape(piece = currentPiece, rotation = piece.rotation) {
    const rotations = SHAPES[piece.type];
    return rotations[((rotation % rotations.length) + rotations.length) % rotations.length];
  }

  function startNewGame() {
    clearTimeout(dropTimer);

    board = emptyBoard();
    score = 0;
    level = 1;
    linesCleared = 0;
    dropInterval = 800;
    comboStreak = 0;
    isClearing = false;
    currentPiece = null;
    nextPiece = randomPiece();
    isPaused = false;
    gameOver = false;

    hideOverlay();
    pauseButton.textContent = "일시정지 (P)";
    spawnPiece();
    updateLabels();
    drawGame();
    scheduleDrop();
    window.focus();
  }

  function spawnPiece() {
    currentPiece = nextPiece;
    nextPiece = randomPiece();

    const shape = getShape();
    currentPiece.x = Math.floor(COLS / 2) - Math.floor(shape[0].length / 2);
    currentPiece.y = -1;

    if (!isValidPosition(currentPiece.x, currentPiece.y, currentPiece.rotation)) {
      endGame();
    }
  }

  function isValidPosition(newX, newY, newRotation) {
    const shape = getShape(currentPiece, newRotation);

    for (let row = 0; row < shape.length; row += 1) {
      for (let col = 0; col < shape[row].length; col += 1) {
        if (!shape[row][col]) continue;

        const boardX = newX + col;
        const boardY = newY + row;

        if (boardX < 0 || boardX >= COLS || boardY >= ROWS) return false;
        if (boardY >= 0 && board[boardY][boardX] !== null) return false;
      }
    }

    return true;
  }

  function movePiece(dx, dy) {
    if (gameOver || isPaused || isClearing) return false;

    const newX = currentPiece.x + dx;
    const newY = currentPiece.y + dy;

    if (isValidPosition(newX, newY, currentPiece.rotation)) {
      currentPiece.x = newX;
      currentPiece.y = newY;
      drawGame();
      return true;
    }

    return false;
  }

  function softDrop() {
    if (gameOver || isPaused || isClearing) return;

    if (movePiece(0, 1)) {
      score += level;
      updateLabels();
    } else {
      lockPiece();
    }
  }

  function hardDrop() {
    if (gameOver || isPaused || isClearing) return;

    let droppedCells = 0;
    while (movePiece(0, 1)) droppedCells += 1;

    score += droppedCells * 2 * level;
    lockPiece();
  }

  function rotatePiece(direction) {
    if (gameOver || isPaused || isClearing) return;

    const rotationCount = SHAPES[currentPiece.type].length;
    const newRotation =
      (currentPiece.rotation + direction + rotationCount) % rotationCount;

    for (const offsetX of [0, -1, 1, -2, 2]) {
      const newX = currentPiece.x + offsetX;
      if (isValidPosition(newX, currentPiece.y, newRotation)) {
        currentPiece.x = newX;
        currentPiece.rotation = newRotation;
        drawGame();
        return;
      }
    }
  }

  function lockPiece() {
    if (gameOver) return;

    const shape = getShape();

    for (let row = 0; row < shape.length; row += 1) {
      for (let col = 0; col < shape[row].length; col += 1) {
        if (!shape[row][col]) continue;

        const boardX = currentPiece.x + col;
        const boardY = currentPiece.y + row;

        if (boardY < 0) {
          endGame();
          return;
        }

        board[boardY][boardX] = currentPiece.type;
      }
    }

    const completedRows = findCompletedLines();

    if (completedRows.length > 0) {
      isClearing = true;
      clearTimeout(dropTimer);
      animateLineClear(completedRows, () => {
        removeCompletedLines(completedRows);
        comboStreak += 1;

        const lineMultiplier = LINE_MULTIPLIERS[completedRows.length] || 1;
        const comboMultiplier = Math.min(comboStreak, 4);
        const gained = Math.round(
          BASE_LINE_SCORE * lineMultiplier * comboMultiplier * level
        );

        score += gained;
        showScorePop(completedRows.length, comboMultiplier, gained);
        updateLevelAndSpeed();
        isClearing = false;
        spawnPiece();
        updateLabels();
        drawGame();
        scheduleDrop();
      });
      return;
    }

    comboStreak = 0;
    updateLevelAndSpeed();
    spawnPiece();
    updateLabels();
    drawGame();
    scheduleDrop();
  }

  function findCompletedLines() {
    const rows = [];
    board.forEach((row, index) => {
      if (row.every(cell => cell !== null)) rows.push(index);
    });
    return rows;
  }

  function removeCompletedLines(completedRows) {
    const rowSet = new Set(completedRows);
    board = board.filter((_, index) => !rowSet.has(index));
    while (board.length < ROWS) board.unshift(Array(COLS).fill(null));
    linesCleared += completedRows.length;
  }

  function animateLineClear(rows, done) {
    const duration = 420;
    const startTime = performance.now();

    function frame(now) {
      const progress = Math.min(1, (now - startTime) / duration);
      drawGame();

      rows.forEach(row => {
        const y = row * CELL_SIZE;
        const flash = Math.sin(progress * Math.PI * 5) > 0;
        ctx.save();
        ctx.globalAlpha = 0.35 + (1 - progress) * 0.65;
        ctx.fillStyle = flash ? "#FFFFFF" : "#FFD93D";
        ctx.fillRect(0, y, canvas.width, CELL_SIZE);

        const gap = progress * canvas.width * 0.5;
        ctx.globalCompositeOperation = "destination-out";
        ctx.fillRect(canvas.width / 2 - gap, y, gap * 2, CELL_SIZE);
        ctx.restore();

        for (let i = 0; i < 12; i += 1) {
          const direction = i % 2 === 0 ? -1 : 1;
          const px = canvas.width / 2 + direction * progress * (30 + i * 11);
          const py = y + CELL_SIZE / 2 + Math.sin(i * 2.2) * progress * 18;
          ctx.fillStyle = i % 3 === 0 ? "#FFFFFF" : "#FFD93D";
          ctx.globalAlpha = 1 - progress;
          ctx.fillRect(px, py, 5, 5);
        }
        ctx.globalAlpha = 1;
      });

      if (progress < 1) requestAnimationFrame(frame);
      else done();
    }

    requestAnimationFrame(frame);
  }

  function showScorePop(lineCount, comboMultiplier, gained) {
    const names = { 1: "SINGLE", 2: "DOUBLE", 3: "TRIPLE", 4: "Block Drop!" };
    scorePop.textContent = `${names[lineCount]}  +${gained}${comboMultiplier > 1 ? `\nCOMBO ×${comboMultiplier}` : ""}`;
    scorePop.classList.remove("show");
    void scorePop.offsetWidth;
    scorePop.classList.add("show");
  }

  function updateLevelAndSpeed() {
    level = Math.floor(linesCleared / 10) + 1;
    dropInterval = Math.max(80, Math.floor(800 * (0.88 ** (level - 1))));
  }

  function scheduleDrop() {
    clearTimeout(dropTimer);
    if (gameOver) return;
    dropTimer = setTimeout(gameTick, dropInterval);
  }

  function gameTick() {
    if (gameOver) return;

    if (!isPaused && !movePiece(0, 1)) {
      lockPiece();
      return;
    }

    scheduleDrop();
  }

  function togglePause() {
    if (gameOver) return;

    isPaused = !isPaused;
    pauseButton.textContent = isPaused ? "계속하기 (P)" : "일시정지 (P)";

    if (isPaused) {
      clearTimeout(dropTimer);
      showOverlay("PAUSED", "P 키 또는 버튼을 눌러 계속하세요.", false);
    } else {
      hideOverlay();
      scheduleDrop();
    }

    drawGame();
  }

  function endGame() {
    gameOver = true;
    clearTimeout(dropTimer);
    drawGame();
    showOverlay(
      "GAME OVER",
      `최종 점수: ${score}\n레벨: ${level}`,
      true
    );
  }

  function updateLabels() {
    scoreEl.textContent = String(score);
    levelEl.textContent = String(level);
    linesEl.textContent = String(linesCleared);
    const multiplier = Math.max(1, Math.min(comboStreak, 4));
    comboEl.textContent = `×${multiplier}`;
    comboBadge.textContent = `COMBO ×${multiplier}`;
    comboBadge.classList.toggle("active", comboStreak > 1);
  }

  function showOverlay(title, text, showRestart) {
    overlayTitle.textContent = title;
    overlayText.textContent = text;
    overlayRestartButton.hidden = !showRestart;
    overlay.hidden = false;
  }

  function hideOverlay() {
    overlay.hidden = true;
  }

  function drawGame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid();
    drawFixedBlocks();

    if (currentPiece && !gameOver) {
      drawGhostPiece();
      drawCurrentPiece();
    }

    drawNextPiece();
  }

  function drawGrid() {
    ctx.fillStyle = "#10121A";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#202638";
    ctx.lineWidth = 1;

    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        ctx.strokeRect(col * CELL_SIZE, row * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      }
    }
  }

  function drawFixedBlocks() {
    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        const type = board[row][col];
        if (type) drawBlock(ctx, col, row, COLORS[type], CELL_SIZE);
      }
    }
  }

  function drawCurrentPiece() {
    const shape = getShape();
    const color = COLORS[currentPiece.type];

    shape.forEach((row, rowIndex) => {
      row.forEach((value, colIndex) => {
        const boardY = currentPiece.y + rowIndex;
        if (value && boardY >= 0) {
          drawBlock(
            ctx,
            currentPiece.x + colIndex,
            boardY,
            color,
            CELL_SIZE
          );
        }
      });
    });
  }

  function drawGhostPiece() {
    let ghostY = currentPiece.y;

    while (isValidPosition(currentPiece.x, ghostY + 1, currentPiece.rotation)) {
      ghostY += 1;
    }

    const shape = getShape();
    ctx.strokeStyle = "#718096";
    ctx.lineWidth = 2;

    shape.forEach((row, rowIndex) => {
      row.forEach((value, colIndex) => {
        if (!value) return;

        const boardX = currentPiece.x + colIndex;
        const boardY = ghostY + rowIndex;

        if (boardY >= 0) {
          ctx.strokeRect(
            boardX * CELL_SIZE + 5,
            boardY * CELL_SIZE + 5,
            CELL_SIZE - 10,
            CELL_SIZE - 10
          );
        }
      });
    });
  }

  function drawBlock(context, col, row, color, size) {
    const x = col * size + 2;
    const y = row * size + 2;
    const blockSize = size - 4;

    context.fillStyle = color;
    context.fillRect(x, y, blockSize, blockSize);
    context.strokeStyle = "#F7FAFC";
    context.lineWidth = 1;
    context.strokeRect(x, y, blockSize, blockSize);

    context.strokeStyle = "rgba(255,255,255,0.85)";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(x + 2, y + blockSize - 2);
    context.lineTo(x + 2, y + 2);
    context.lineTo(x + blockSize - 2, y + 2);
    context.stroke();

    context.strokeStyle = "#2D3748";
    context.beginPath();
    context.moveTo(x + 2, y + blockSize - 2);
    context.lineTo(x + blockSize - 2, y + blockSize - 2);
    context.lineTo(x + blockSize - 2, y + 2);
    context.stroke();
  }

  function drawNextPiece() {
    nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
    nextCtx.fillStyle = "#10121A";
    nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);

    const shape = SHAPES[nextPiece.type][0];
    const previewSize = 24;
    const shapeWidth = shape[0].length * previewSize;
    const shapeHeight = shape.length * previewSize;
    const offsetX = (nextCanvas.width - shapeWidth) / 2;
    const offsetY = (nextCanvas.height - shapeHeight) / 2;

    shape.forEach((row, rowIndex) => {
      row.forEach((value, colIndex) => {
        if (!value) return;

        const x = offsetX + colIndex * previewSize + 2;
        const y = offsetY + rowIndex * previewSize + 2;
        nextCtx.fillStyle = COLORS[nextPiece.type];
        nextCtx.fillRect(x, y, previewSize - 4, previewSize - 4);
        nextCtx.strokeStyle = "#FFFFFF";
        nextCtx.strokeRect(x, y, previewSize - 4, previewSize - 4);
      });
    });
  }

  function handleKeydown(event) {
    const controlledKeys = [
      "ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp",
      "Control", " ", "p", "P", "x", "X", "z", "Z"
    ];

    if (controlledKeys.includes(event.key)) event.preventDefault();

    switch (event.key) {
      case "ArrowLeft":
        movePiece(-1, 0);
        break;
      case "ArrowRight":
        movePiece(1, 0);
        break;
      case "ArrowDown":
        softDrop();
        break;
      case "ArrowUp":
      case "x":
      case "X":
        rotatePiece(1);
        break;
      case "Control":
      case "z":
      case "Z":
        rotatePiece(-1);
        break;
      case " ":
        hardDrop();
        break;
      case "p":
      case "P":
        togglePause();
        break;
      default:
        break;
    }
  }

  document.addEventListener("keydown", handleKeydown);
  pauseButton.addEventListener("click", togglePause);
  restartButton.addEventListener("click", startNewGame);
  overlayRestartButton.addEventListener("click", startNewGame);

  document.querySelectorAll("[data-action]").forEach(button => {
    button.addEventListener("click", () => {
      const action = button.dataset.action;
      if (action === "left") movePiece(-1, 0);
      if (action === "right") movePiece(1, 0);
      if (action === "down") softDrop();
      if (action === "rotate") rotatePiece(1);
      if (action === "drop") hardDrop();
    });
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && !gameOver && !isPaused) togglePause();
  });

  startNewGame();
})();
