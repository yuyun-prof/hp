(() => {
  "use strict";

  const canvas = document.getElementById("fpCanvas");
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  const soundButton = document.getElementById("fpSoundButton");

  const W = 1200;
  const H = 600;
  const GROUND = 470;
  const BASE = "assets";

  const BGS = [
    ["MIRAE MAIN GATE", "campus_gate.png"],
    ["UNIVERSITY CHURCH", "university_church.png"],
    ["ACADEMIC INFORMATION CENTER", "academic_info.png"],
    ["STUDENT CENTER", "student_center.png"],
    ["OPEN-AIR THEATER", "open_air_theater.png"],
    ["ADMINISTRATION AREA", "administration.png"]
  ];

  const FOODS = {
    burger: [14, true],
    pizza: [11, true],
    kimbap: [9, true],
    apple: [7, true],
    donut: [8, true],
    ramen: [13, true],
    coffee: [5, true],
    lunchbox: [24, true],
    rotten_apple: [-14, false],
    mold_bread: [-12, false],
    chemical: [-20, false],
    pepper_bomb: [-18, false]
  };

  const OBS = ["books", "chair", "trash", "cone"];
  const POWERS = ["magnet", "shield", "star", "coffee_boost"];

  const assets = {
    backgrounds: {},
    character: {},
    foods: {},
    obstacles: {},
    ui: {}
  };

  const rand = (a, b) => Math.random() * (b - a) + a;
  const randi = (a, b) => Math.floor(rand(a, b + 1));
  const choice = arr => arr[Math.floor(Math.random() * arr.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load ${src}`));
      img.src = src;
    });
  }

  async function preload() {
    const tasks = [];

    for (const [, file] of BGS) {
      tasks.push(loadImage(`${BASE}/backgrounds/${file}`).then(img => {
        assets.backgrounds[file] = img;
      }));
    }

    for (let i = 0; i < 6; i++) {
      tasks.push(loadImage(`${BASE}/character/run_${i}.png`).then(img => {
        assets.character[`run_${i}`] = img;
      }));
    }

    for (const name of ["idle", "jump", "double_jump", "hit", "victory"]) {
      tasks.push(loadImage(`${BASE}/character/${name}.png`).then(img => {
        assets.character[name] = img;
      }));
    }

    for (const name of Object.keys(FOODS)) {
      tasks.push(loadImage(`${BASE}/foods/${name}.png`).then(img => {
        assets.foods[name] = img;
      }));
    }

    for (const name of OBS) {
      tasks.push(loadImage(`${BASE}/obstacles/${name}.png`).then(img => {
        assets.obstacles[name] = img;
      }));
    }

    for (const name of [...POWERS, "brick"]) {
      tasks.push(loadImage(`${BASE}/ui/${name}.png`).then(img => {
        assets.ui[name] = img;
      }));
    }

    await Promise.all(tasks);
  }

  class AudioSystem {
    constructor() {
      this.enabled = true;
      this.ctx = null;
    }

    ensure() {
      if (!this.enabled) return null;
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) this.ctx = new AC();
      }
      if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
      return this.ctx;
    }

    tone(freq, duration = 0.12, type = "square", volume = 0.06, endFreq = null) {
      const ac = this.ensure();
      if (!ac) return;
      const now = ac.currentTime;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), now + duration);
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      osc.connect(gain).connect(ac.destination);
      osc.start(now);
      osc.stop(now + duration);
    }

    play(name) {
      if (!this.enabled) return;
      switch (name) {
        case "jump": this.tone(420, 0.13, "square", 0.05, 650); break;
        case "double_jump": this.tone(620, 0.16, "square", 0.05, 980); break;
        case "eat": this.tone(760, 0.10, "sine", 0.06, 1100); break;
        case "bad_food": this.tone(210, 0.18, "sawtooth", 0.07, 100); break;
        case "hit": this.tone(150, 0.15, "square", 0.08, 70); break;
        case "fall": this.tone(370, 0.42, "sawtooth", 0.06, 70); break;
        case "power_up":
          this.tone(480, 0.12, "square", 0.05, 720);
          setTimeout(() => this.tone(760, 0.13, "square", 0.05, 1100), 80);
          break;
        case "game_over": this.tone(280, 0.65, "sine", 0.06, 90); break;
      }
    }
  }

  const audio = new AudioSystem();

  class Particle {
    constructor(x, y, color) {
      this.x = x;
      this.y = y;
      this.vx = rand(-180, 180);
      this.vy = rand(-300, -70);
      this.life = 1;
      this.color = color;
    }
    update(dt) {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.vy += 720 * dt;
      this.life -= dt * 1.7;
    }
    draw() {
      if (this.life <= 0) return;
      ctx.globalAlpha = this.life;
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, Math.max(1, 5 * this.life), 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  class Professor {
    constructor() {
      this.x = 170;
      this.y = GROUND - 128;
      this.w = 96;
      this.h = 128;
      this.vy = 0;
      this.grounded = true;
      this.jumps = 0;
      this.invincibleUntil = 0;
      this.anim = 0;
      this.platform = null;
    }

    rect() {
      return { x: this.x + 16, y: this.y + 9, w: 64, h: 116 };
    }

    jump() {
      if (this.grounded) {
        this.vy = -820;
        this.grounded = false;
        this.jumps = 1;
        this.platform = null;
        return 1;
      }
      if (this.jumps < 2) {
        this.vy = -720;
        this.jumps = 2;
        this.platform = null;
        return 2;
      }
      return 0;
    }

    update(dt, platforms, overPit) {
      const oldBottom = this.rect().y + this.rect().h;
      this.vy += 2100 * dt;
      this.y += this.vy * dt;
      this.grounded = false;
      this.platform = null;

      if (this.vy >= 0) {
        const r = this.rect();
        for (const p of platforms) {
          if (
            r.x + r.w > p.x + 10 &&
            r.x < p.x + p.w - 10 &&
            oldBottom <= p.y + 12 &&
            r.y + r.h >= p.y
          ) {
            this.y = p.y - 124;
            this.vy = 0;
            this.grounded = true;
            this.jumps = 0;
            this.platform = p;
            break;
          }
        }
      }

      if (!this.grounded && !overPit && this.y >= GROUND - 128) {
        this.y = GROUND - 128;
        this.vy = 0;
        this.grounded = true;
        this.jumps = 0;
      }

      this.anim = (this.anim + dt * 13) % 6;
    }

    draw(now, hit) {
      if (now < this.invincibleUntil && Math.floor(now / 85) % 2 === 0) return;
      let img;
      if (hit) img = assets.character.hit;
      else if (!this.grounded && this.jumps === 2) img = assets.character.double_jump;
      else if (!this.grounded) img = assets.character.jump;
      else img = assets.character[`run_${Math.floor(this.anim)}`];

      const bob = this.grounded ? Math.sin(now * 0.018) * 2 : 0;
      ctx.drawImage(img, this.x, this.y + bob, this.w, this.h);
    }
  }

  class Item {
    constructor(kind, x, y, options = {}) {
      this.kind = kind;
      this.x = x;
      this.baseY = y;
      this.y = y;
      this.coin = !!options.coin;
      this.power = options.power || null;
      this.phase = rand(0, Math.PI * 2);
      this.w = this.coin ? 36 : this.power ? 52 : 72;
      this.h = this.w;
      if (this.coin) {
        this.value = 1;
        this.good = true;
      } else if (this.power) {
        this.value = 0;
        this.good = true;
      } else {
        [this.value, this.good] = FOODS[kind];
      }
    }

    rect() {
      return { x: this.x, y: this.y, w: this.w, h: this.h };
    }

    update(dx, dt) {
      this.x -= dx;
      this.phase += dt * 7;
      this.y = this.baseY + Math.sin(this.phase) * 5;
    }

    draw() {
      if (this.coin) {
        ctx.fillStyle = "#ffd023";
        ctx.beginPath();
        ctx.arc(this.x + 18, this.y + 18, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#fff487";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(this.x + 18, this.y + 18, 11, 0, Math.PI * 2);
        ctx.stroke();
        return;
      }

      const img = this.power ? assets.ui[this.power] : assets.foods[this.kind];
      if (!this.power) {
        ctx.save();
        ctx.shadowColor = this.good ? "#32eb64" : "#f5373c";
        ctx.shadowBlur = 16;
        ctx.drawImage(img, this.x + 9, this.y + 9, 54, 54);
        ctx.restore();
      } else {
        ctx.drawImage(img, this.x, this.y, this.w, this.h);
      }
    }
  }

  class Obstacle {
    constructor(kind, x) {
      this.kind = kind;
      this.x = x;
      this.y = GROUND - 66;
      this.w = 68;
      this.h = 68;
    }
    rect() {
      return { x: this.x + 9, y: this.y + 7, w: 50, h: 58 };
    }
    update(dx) { this.x -= dx; }
    draw() { ctx.drawImage(assets.obstacles[this.kind], this.x, this.y, this.w, this.h); }
  }

  class Platform {
    constructor(x, y, count) {
      this.x = x;
      this.y = y;
      this.count = count;
      this.tileW = 64;
      this.tileH = 32;
      this.w = count * this.tileW;
      this.h = this.tileH;
    }
    update(dx) { this.x -= dx; }
    draw() {
      for (let i = 0; i < this.count; i++) {
        ctx.drawImage(assets.ui.brick, this.x + i * this.tileW, this.y, this.tileW, this.tileH);
      }
    }
  }

  function intersects(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  class Game {
    constructor() {
      this.best = Number(localStorage.getItem("fp_best_distance") || 0);
      this.state = "opening";
      this.lastTime = performance.now();
      this.reset(false);
    }

    reset(startImmediately = false) {
      this.state = startImmediately ? "play" : "opening";
      this.dist = 0;
      this.score = 0;
      this.coins = 0;
      this.energy = 100;
      this.level = 1;
      this.combo = 0;
      this.maxCombo = 0;
      this.mult = 1;
      this.player = new Professor();
      this.items = [];
      this.obstacles = [];
      this.platforms = [];
      this.pits = [];
      this.particles = [];
      this.spawnTimer = 1;
      this.pitTimer = 5;
      this.platformTimer = 4;
      this.eventTimer = 9;
      this.bgIndex = 0;
      this.bgX = 0;
      this.hitUntil = 0;
      this.reason = "";
      this.shield = 0;
      this.magnet = 0;
      this.star = 0;
      this.boost = 0;
      this.missions = [
        ["Collect 25 foods", 0, 25],
        ["Reach a 10 combo", 0, 10],
        ["Run 1000 m", 0, 1000]
      ];
      this.achievements = new Set();
      this.toast = "";
      this.toastTimer = 0;
    }

    startOrJump() {
      audio.ensure();
      if (this.state === "opening") {
        this.state = "play";
        return;
      }
      if (this.state === "over") {
        this.reset(true);
        return;
      }
      if (this.state === "play") {
        const jumpType = this.player.jump();
        if (jumpType === 1) audio.play("jump");
        else if (jumpType === 2) audio.play("double_jump");
      }
    }

    toastIt(text) {
      this.toast = text;
      this.toastTimer = 2.5;
    }

    overPit() {
      const center = this.player.rect().x + this.player.rect().w / 2;
      return this.pits.some(([a, b]) => a < center && center < b);
    }

    speed() {
      this.level = 1 + Math.floor(this.dist / 500);
      return Math.min(950, 470 + this.level * 25);
    }

    spawnPattern() {
      const x = W + 100;
      const pat = choice(["food", "coins", "ob", "mixed", "power", "bad"]);

      if (pat === "food") {
        const keys = Object.keys(FOODS);
        const count = randi(3, 6);
        for (let i = 0; i < count; i++) {
          this.items.push(new Item(choice(keys), x + i * 75, GROUND - choice([85, 155, 225])));
        }
      } else if (pat === "coins") {
        for (let i = 0; i < 7; i++) {
          this.items.push(new Item(null, x + i * 62, GROUND - 95 - Math.sin(i / 6 * Math.PI) * 150, { coin: true }));
        }
      } else if (pat === "ob") {
        const count = randi(1, Math.min(3, 1 + Math.floor(this.level / 4)));
        for (let i = 0; i < count; i++) this.obstacles.push(new Obstacle(choice(OBS), x + i * 115));
      } else if (pat === "mixed") {
        this.obstacles.push(new Obstacle(choice(OBS), x + 120));
        for (let i = 0; i < 4; i++) {
          this.items.push(new Item(choice(["burger", "pizza", "kimbap", "apple"]), x + i * 72, GROUND - 165));
        }
      } else if (pat === "power") {
        this.items.push(new Item(null, x, GROUND - 180, { power: choice(POWERS) }));
      } else {
        for (let i = 0; i < 3; i++) {
          this.items.push(new Item(choice(["rotten_apple", "mold_bread", "chemical", "pepper_bomb"]), x + i * 74, GROUND - 90 - choice([0, 80])));
        }
      }
    }

    spawnPit() {
      const minW = 145 + Math.min(200, this.level * 12);
      const maxW = 210 + Math.min(260, this.level * 17);
      const width = randi(minW, maxW);
      this.pits.push([W + 80, W + 80 + width]);
      for (let i = 0; i < 4; i++) {
        this.items.push(new Item(null, W + 100 + i * (width / 4), GROUND - 190 - Math.sin(i / 3 * Math.PI) * 70, { coin: true }));
      }
    }

    spawnPlatform() {
      const count = randi(2, Math.min(6, 3 + Math.floor(this.level / 3)));
      const y = choice([GROUND - 140, GROUND - 210, GROUND - 280]);
      this.platforms.push(new Platform(W + 80, y, count));
      for (let i = 0; i < count; i++) {
        if (Math.random() < 0.7) {
          this.items.push(new Item(choice(Object.keys(FOODS)), W + 90 + i * 64, y - 72));
        }
      }
    }

    damage(amount, reason, fall = false) {
      const now = performance.now();
      if (now < this.player.invincibleUntil || this.star > 0) return;
      if (this.shield) {
        this.shield = 0;
        this.toastIt("SHIELD SAVED YOU!");
        return;
      }

      this.energy -= amount;
      this.combo = 0;
      this.reason = reason;
      this.player.invincibleUntil = now + 1700;
      this.hitUntil = now + 280;
      audio.play(fall ? "fall" : "hit");

      if (fall) {
        this.energy -= 100 / 3;
        this.player.y = GROUND - 128;
        this.player.vy = 0;
      }
      if (this.energy <= 0) this.gameOver();
    }

    gameOver() {
      this.energy = Math.max(0, this.energy);
      this.best = Math.max(this.best, Math.floor(this.dist));
      localStorage.setItem("fp_best_distance", String(this.best));
      this.state = "over";
      audio.play("game_over");
    }

    collect(item) {
      if (item.coin) {
        this.coins++;
        this.score += 10 * this.mult;
      } else if (item.power) {
        if (item.power === "magnet") this.magnet = 8;
        else if (item.power === "shield") this.shield = 1;
        else if (item.power === "star") this.star = 6;
        else this.boost = 5;
        this.toastIt(item.power.replace("_", " ").toUpperCase() + "!");
        audio.play("power_up");
      } else if (item.good) {
        this.energy = Math.min(100, this.energy + item.value);
        this.combo++;
        this.maxCombo = Math.max(this.maxCombo, this.combo);
        this.score += (50 + this.combo * 5) * this.mult;
        audio.play("eat");
        this.missions[0][1]++;
        this.missions[1][1] = Math.max(this.missions[1][1], this.combo);
        for (let i = 0; i < 8; i++) this.particles.push(new Particle(item.x + item.w / 2, item.y + item.h / 2, "#50f078"));
      } else {
        this.energy += item.value;
        this.combo = 0;
        this.reason = "Ate " + item.kind.replaceAll("_", " ");
        audio.play("bad_food");
      }

      this.mult = 1 + Math.min(4, Math.floor(this.combo / 8));
    }

    update(dt) {
      const sp = this.speed() * (this.boost > 0 ? 1.22 : 1);
      const dx = sp * dt;

      this.dist += sp * dt * 0.075;
      this.score += Math.floor(sp * dt * 0.03) * this.mult;
      this.missions[2][1] = Math.floor(this.dist);
      this.bgX = (this.bgX - dx * 0.18) % W;

      const nextBg = Math.floor(this.dist / 900) % BGS.length;
      if (nextBg !== this.bgIndex) {
        this.bgIndex = nextBg;
        this.toastIt(BGS[nextBg][0]);
      }

      this.player.update(dt, this.platforms, this.overPit());
      this.energy -= dt * (0.55 + this.level * 0.035);

      if (this.energy <= 0) {
        this.reason = "Ran out of energy";
        this.gameOver();
        return;
      }

      this.spawnTimer -= dt;
      this.pitTimer -= dt;
      this.platformTimer -= dt;
      this.eventTimer -= dt;

      if (this.spawnTimer <= 0) {
        this.spawnPattern();
        this.spawnTimer = rand(0.55, 1.25) * Math.max(0.55, 1 - this.level * 0.015);
      }
      if (this.pitTimer <= 0) {
        this.spawnPit();
        this.pitTimer = rand(5.2, 8.0) * Math.max(0.7, 1 - this.level * 0.01);
      }
      if (this.platformTimer <= 0) {
        this.spawnPlatform();
        this.platformTimer = rand(4.5, 7.0);
      }
      if (this.eventTimer <= 0) {
        const event = choice(["FOOD RUSH", "COIN RUSH", "DANGER ZONE"]);
        this.toastIt(event);
        if (event === "FOOD RUSH") {
          for (let i = 0; i < 10; i++) {
            this.items.push(new Item(choice(["burger", "pizza", "kimbap", "apple"]), W + 100 + i * 70, GROUND - choice([90, 165, 235])));
          }
        } else if (event === "COIN RUSH") {
          for (let i = 0; i < 14; i++) {
            this.items.push(new Item(null, W + 100 + i * 55, GROUND - 110 - randi(0, 140), { coin: true }));
          }
        } else {
          for (let i = 0; i < 4; i++) this.obstacles.push(new Obstacle(choice(OBS), W + 120 + i * 125));
        }
        this.eventTimer = rand(12, 19);
      }

      for (const p of this.platforms) p.update(dx);
      this.platforms = this.platforms.filter(p => p.x + p.w >= -30);

      for (const pit of this.pits) {
        pit[0] -= dx;
        pit[1] -= dx;
      }
      this.pits = this.pits.filter(pit => pit[1] >= -20);

      for (const item of this.items) {
        item.update(dx, dt);
        if (this.magnet > 0 && (item.coin || (!item.power && item.good))) {
          const vx = this.player.rect().x + this.player.rect().w / 2 - (item.x + item.w / 2);
          const vy = this.player.rect().y + this.player.rect().h / 2 - (item.y + item.h / 2);
          if (Math.abs(vx) < 260) {
            item.x += vx * dt * 4;
            item.baseY += vy * dt * 4;
          }
        }
      }

      for (let i = this.items.length - 1; i >= 0; i--) {
        const item = this.items[i];
        if (item.x + item.w < -50) {
          this.items.splice(i, 1);
        } else if (intersects(this.player.rect(), item.rect())) {
          this.collect(item);
          this.items.splice(i, 1);
        }
      }

      for (const ob of this.obstacles) ob.update(dx);
      for (let i = this.obstacles.length - 1; i >= 0; i--) {
        const ob = this.obstacles[i];
        if (ob.x + ob.w < -30) {
          this.obstacles.splice(i, 1);
        } else if (intersects(this.player.rect(), ob.rect())) {
          this.damage(7 + this.level * 1.3, "Hit campus obstacle");
          this.obstacles.splice(i, 1);
        }
      }

      if (this.overPit() && !this.player.platform && this.player.rect().y + this.player.rect().h > GROUND + 35) {
        this.damage(0, "Fell into a widening campus pit", true);
      }

      for (const p of this.particles) p.update(dt);
      this.particles = this.particles.filter(p => p.life > 0);

      this.magnet = Math.max(0, this.magnet - dt);
      this.star = Math.max(0, this.star - dt);
      this.boost = Math.max(0, this.boost - dt);
      this.toastTimer = Math.max(0, this.toastTimer - dt);

      const checks = [
        ["FIRST 500M", this.dist >= 500],
        ["COMBO MASTER", this.maxCombo >= 20],
        ["COIN HUNTER", this.coins >= 100],
        ["LEVEL 10", this.level >= 10]
      ];
      for (const [name, done] of checks) {
        if (done && !this.achievements.has(name)) {
          this.achievements.add(name);
          this.toastIt("ACHIEVEMENT: " + name);
        }
      }
    }

    drawBackground() {
      // Clear the previous frame so off-screen objects do not leave smearing trails.
      ctx.clearRect(0, 0, W, H);

      const img = assets.backgrounds[BGS[this.bgIndex][1]];

      // JavaScript's % can return a negative value. Normalize it and draw
      // one image on each side so the scrolling background always fills
      // the full canvas without exposing stale pixels at the right edge.
      const x = ((this.bgX % W) + W) % W;
      ctx.drawImage(img, Math.round(x - W), 0, W, H);
      ctx.drawImage(img, Math.round(x), 0, W, H);

      ctx.fillStyle = "rgba(20, 40, 55, 0.12)";
      ctx.fillRect(0, 0, W, H);

      const offset = -((this.dist * 28) % 96);
      ctx.strokeStyle = "#eee1a0";
      ctx.lineWidth = 5;
      for (let gx = offset - 96; gx < W + 96; gx += 96) {
        ctx.beginPath();
        ctx.moveTo(gx, GROUND + 15);
        ctx.lineTo(gx + 48, GROUND + 15);
        ctx.stroke();
      }
    }

    drawPits() {
      for (const [a, b] of this.pits) {
        ctx.fillStyle = "#0c121e";
        ctx.fillRect(a, GROUND - 6, b - a, H - GROUND + 12);
        ctx.strokeStyle = "#263044";
        ctx.lineWidth = 2;
        for (let y = GROUND + 18; y < H; y += 30) {
          ctx.beginPath();
          ctx.moveTo(a, y);
          ctx.lineTo(b, y);
          ctx.stroke();
        }
        ctx.fillStyle = "#ffcd37";
        ctx.beginPath();
        ctx.moveTo(a, GROUND - 6);
        ctx.lineTo(a + 24, GROUND - 6);
        ctx.lineTo(a, GROUND + 18);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(b, GROUND - 6);
        ctx.lineTo(b - 24, GROUND - 6);
        ctx.lineTo(b, GROUND + 18);
        ctx.fill();
      }
    }

    panel(x, y, w, h, radius = 14, fill = "#10182b") {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, radius);
      ctx.fill();
    }

    text(text, x, y, size = 19, color = "#fff", align = "left", weight = "700") {
      ctx.font = `${weight} ${size}px Arial, sans-serif`;
      ctx.textAlign = align;
      ctx.textBaseline = "top";
      ctx.fillStyle = color;
      ctx.fillText(text, x, y);
    }

    drawHud() {
      this.panel(20, 14, 1160, 76, 18, "rgba(16,24,43,0.94)");
      this.panel(112, 45, 300, 22, 11, "#414858");
      const energyColor = this.energy > 40 ? "#46e16e" : this.energy > 18 ? "#f3ad35" : "#ef4848";
      this.panel(112, 45, 300 * clamp(this.energy / 100, 0, 1), 22, 11, energyColor);

      this.text(`ENERGY ${Math.floor(this.energy)}%`, 34, 47, 18);
      this.text(`LV ${this.level}`, 440, 22, 18, "#ffe150");
      this.text(`DIST ${Math.floor(this.dist)} m`, 440, 53, 18);
      this.text(`SCORE ${this.score}`, 595, 22, 18);
      this.text(`COIN ${this.coins}`, 595, 53, 18, "#ffd732");
      this.text(`COMBO ${this.combo}  x${this.mult}`, 760, 22, 18, "#6ef59b");
      this.text(`BEST ${this.best} m`, 760, 53, 18);
      this.text(BGS[this.bgIndex][0], 955, 41, 15, "#bedcff");

      let y = 102;
      for (const [title, value, goal] of this.missions) {
        const done = value >= goal;
        this.panel(20, y, 235, 29, 8, "rgba(18,28,46,0.92)");
        this.text(`${done ? "✓ " : ""}${title}: ${Math.min(value, goal)}/${goal}`, 30, y + 5, 15, done ? "#78f596" : "#fff");
        y += 34;
      }

      if (this.toastTimer > 0) {
        ctx.font = "700 25px Arial, sans-serif";
        const width = ctx.measureText(this.toast).width + 40;
        this.panel(W / 2 - width / 2, 104, width, 45, 13, "rgba(20,28,45,0.95)");
        this.text(this.toast, W / 2, 114, 25, "#ffe650", "center");
      }
    }

    drawWorld() {
      this.drawBackground();
      this.drawPits();
      for (const p of this.platforms) p.draw();
      for (const item of this.items) item.draw();
      for (const ob of this.obstacles) ob.draw();
      for (const p of this.particles) p.draw();
      this.player.draw(performance.now(), performance.now() < this.hitUntil);
      this.drawHud();
    }

    overlay(alpha = 0.65) {
      ctx.fillStyle = `rgba(10,15,28,${alpha})`;
      ctx.fillRect(0, 0, W, H);
    }

    drawOpening() {
      ctx.fillStyle = "#1a2841";
      ctx.fillRect(0, 0, W, H);

      const bg = assets.backgrounds[BGS[0][1]];
      ctx.globalAlpha = 0.45;
      ctx.drawImage(bg, 0, 0, W, H);
      ctx.globalAlpha = 1;
      this.overlay(0.42);

      ctx.drawImage(assets.character.idle, 510, 215, 180, 240);
      this.text("FEED THE PROFESSOR", W / 2, 68, 55, "#ffe146", "center");
      this.text("ENDLESS MIRAE CAMPUS RUN", W / 2, 140, 28, "#6edcff", "center");
      this.text("Double jump · Random events · Missions · Achievements · Infinite levels", W / 2, 185, 18, "#fff", "center");
      this.text("SPACE / CLICK / TOUCH TO START", W / 2, 525, 27, "#fff", "center");
    }

    drawGameOver() {
      this.drawWorld();
      this.overlay(0.66);
      this.panel(280, 82, 640, 435, 24, "#1c2336");
      ctx.strokeStyle = "#be3237";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.roundRect(280, 82, 640, 435, 24);
      ctx.stroke();

      this.text("GAME OVER", W / 2, 112, 55, "#ff5c58", "center");
      this.text(`DISTANCE  ${Math.floor(this.dist)} m`, W / 2, 210, 28, "#ffe146", "center");
      this.text(`SCORE ${this.score} · LEVEL ${this.level} · BEST ${this.best} m`, W / 2, 258, 18, "#fff", "center");
      this.text(`MAX COMBO ${this.maxCombo} · COINS ${this.coins}`, W / 2, 298, 18, "#fff", "center");
      this.text(`CAUSE: ${this.reason}`, W / 2, 342, 18, "#ff917d", "center");
      const ach = this.achievements.size ? [...this.achievements].sort().join(", ") : "None yet";
      this.text(`ACHIEVEMENTS: ${ach}`, W / 2, 383, 16, "#fff", "center");
      this.text("SPACE / CLICK / TOUCH TO RETRY", W / 2, 463, 27, "#69f599", "center");
    }

    draw() {
      if (this.state === "opening") this.drawOpening();
      else if (this.state === "play") this.drawWorld();
      else this.drawGameOver();
    }

    frame(now) {
      const dt = Math.min(0.033, Math.max(0, (now - this.lastTime) / 1000));
      this.lastTime = now;
      if (this.state === "play") this.update(dt);
      this.draw();
      requestAnimationFrame(t => this.frame(t));
    }
  }

  let game = null;

  function inputHandler(event) {
    if (event) event.preventDefault();
    if (game) game.startOrJump();
  }

  window.addEventListener("keydown", event => {
    if (event.code === "Space" || event.code === "ArrowUp") inputHandler(event);
  }, { passive: false });

  canvas.addEventListener("pointerdown", inputHandler, { passive: false });

  soundButton.addEventListener("click", event => {
    event.stopPropagation();
    audio.enabled = !audio.enabled;
    soundButton.textContent = audio.enabled ? "SOUND ON" : "SOUND OFF";
    if (audio.enabled) audio.ensure();
  });

  function loadingScreen(text) {
    ctx.fillStyle = "#101827";
    ctx.fillRect(0, 0, W, H);
    ctx.font = "700 28px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "#fff";
    ctx.fillText(text, W / 2, H / 2);
  }

  loadingScreen("LOADING FEED THE PROFESSOR...");

  preload()
    .then(() => {
      game = new Game();
      requestAnimationFrame(t => {
        game.lastTime = t;
        game.frame(t);
      });
    })
    .catch(error => {
      console.error(error);
      loadingScreen("ASSET LOAD ERROR");
    });
})();
