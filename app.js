/* ==========================================
   桌面小鱼缸 - 游戏核心逻辑
   ========================================== */

(function () {
  'use strict';

  // ==================== 鱼类型配置 ====================
  const FISH_TYPES = [
    { id: 0, name: '小丑鱼', emoji: '🐟', cost: 0,    coinsPerSec: 0.03, speed: 60, size: 30, tag: 'free' },
    { id: 1, name: '热带鱼', emoji: '🐠', cost: 80,   coinsPerSec: 0.06, speed: 75, size: 32 },
    { id: 2, name: '河豚',   emoji: '🐡', cost: 250,  coinsPerSec: 0.15, speed: 40, size: 34 },
    { id: 3, name: '鱿鱼',   emoji: '🦑', cost: 600,  coinsPerSec: 0.30, speed: 55, size: 36 },
    { id: 4, name: '小鲨鱼', emoji: '🦈', cost: 1500, coinsPerSec: 0.70, speed: 90, size: 40 },
    { id: 5, name: '章鱼',   emoji: '🐙', cost: 3500, coinsPerSec: 1.50, speed: 30, size: 38 },
    { id: 6, name: '海豚',   emoji: '🐬', cost: 8000, coinsPerSec: 3.00, speed: 110, size: 44 },
    { id: 7, name: '小鲸鱼', emoji: '🐳', cost: 20000,coinsPerSec: 7.00, speed: 50, size: 50 },
  ];

  // ==================== 画布与 DOM ====================
  const canvas = document.getElementById('aquarium');
  const ctx = canvas.getContext('2d');

  const elCoinAmount = document.getElementById('coinAmount');
  const elCoinDisplay = document.getElementById('coinDisplay');
  const elShopOverlay = document.getElementById('shopOverlay');
  const elShopItems = document.getElementById('shopItems');
  const elToastContainer = document.getElementById('toastContainer');
  const elOfflineModal = document.getElementById('offlineModal');
  const elOfflineTime = document.getElementById('offlineTime');
  const elOfflineCoins = document.getElementById('offlineCoins');

  // ==================== 游戏状态 ====================
  const state = {
    coins: 0,
    fish: [],           // Fish 实例数组
    bubbles: [],        // Bubble 实例数组
    particles: [],      // Particle 实例数组
    seaweeds: [],       // 海草装饰
    pebbles: [],        // 石子装饰
    lastSaveTime: Date.now(),
    totalEarned: 0,
    totalClicks: 0,
    fishIdCounter: 0,
    bubbleSpawnTimers: {},  // 每种鱼的气泡计时器: { typeId: accumulatedTime }
  };

  let animationId = null;
  let lastFrameTime = performance.now();
  let canvasW = 0;
  let canvasH = 0;
  let waterSurfaceOffset = 0;
  let lightRayPhase = 0;
  let offlineModalOpen = false;

  // ==================== Fish 类 ====================
  class Fish {
    constructor(typeId, x, y) {
      const type = FISH_TYPES[typeId];
      this.typeId = typeId;
      this.id = ++state.fishIdCounter;
      this.x = x || Math.random() * canvasW;
      this.y = y || canvasH * 0.25 + Math.random() * canvasH * 0.5;
      this.direction = Math.random() > 0.5 ? 1 : -1; // 1=右, -1=左
      this.speed = type.speed * (0.85 + Math.random() * 0.3);
      this.targetX = this._pickNewTarget();
      this.bobPhase = Math.random() * Math.PI * 2;
      this.bobSpeed = 1.5 + Math.random() * 2;
      this.bobAmp = 3 + Math.random() * 6;
      this.turnTimer = 0;
      this.turnCooldown = 3 + Math.random() * 8; // 3-11秒转向一次
      this.scale = 1;
      this.scaleTarget = 1;
    }

    _pickNewTarget() {
      const margin = 60;
      return margin + Math.random() * (canvasW - margin * 2);
    }

    update(dt) {
      // 转向计时
      this.turnTimer += dt;
      if (this.turnTimer >= this.turnCooldown) {
        this.turnTimer = 0;
        this.turnCooldown = 3 + Math.random() * 8;
        // 有概率掉头
        if (Math.random() < 0.4) {
          this.direction *= -1;
          this.targetX = this._pickNewTarget();
        }
      }

      // 向目标移动，到达后选新目标
      const dx = this.targetX - this.x;
      const moveDir = Math.sign(dx);
      if (Math.abs(dx) < 2) {
        // 到达，选新目标
        this.targetX = this._pickNewTarget();
        // 自然决定方向
        const toTarget = this.targetX - this.x;
        if (Math.sign(toTarget) !== this.direction && Math.abs(toTarget) > 30) {
          this.direction = Math.sign(toTarget);
        }
      }

      // 如果方向与移动方向不一致，可能需要转向
      if (moveDir !== 0 && moveDir !== this.direction && Math.abs(dx) > 50) {
        this.direction = moveDir;
      }

      // 移动
      this.x += this.speed * this.direction * dt;

      // 上下摆动
      this.bobPhase += this.bobSpeed * dt;
      this.baseY = this.y;
      const displayY = this.y + Math.sin(this.bobPhase) * this.bobAmp;

      // 边界检测
      if (this.x < 20) {
        this.direction = 1;
        this.targetX = this._pickNewTarget();
      } else if (this.x > canvasW - 20) {
        this.direction = -1;
        this.targetX = this._pickNewTarget();
      }

      // 缩放动画
      this.scale += (this.scaleTarget - this.scale) * 5 * dt;

      // 限制 y 在水域范围内
      const minY = canvasH * 0.15;
      const maxY = canvasH * 0.78;
      this.y = Math.max(minY, Math.min(maxY, this.y));
    }

    draw(ctx) {
      const type = FISH_TYPES[this.typeId];
      ctx.save();
      ctx.translate(this.x, this.y + Math.sin(this.bobPhase) * this.bobAmp);
      ctx.scale(this.scale * -this.direction, this.scale);
      ctx.font = `${type.size}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(type.emoji, 0, 0);
      ctx.restore();
    }

    // 获取吐泡泡位置（在鱼前方）
    getBubbleSpawnPos() {
      const offset = FISH_TYPES[this.typeId].size * 0.5;
      return {
        x: this.x + this.direction * offset,
        y: this.y + Math.sin(this.bobPhase) * this.bobAmp - 8,
      };
    }
  }

  // ==================== Bubble 类 ====================
  class Bubble {
    constructor(x, y, value, fishTypeId) {
      this.x = x + (Math.random() - 0.5) * 10;
      this.y = y;
      this.value = value;
      this.fishTypeId = fishTypeId;
      this.radius = 6 + value * 0.5;
      this.maxRadius = this.radius;
      this.riseSpeed = 20 + Math.random() * 25;
      this.wobbleAmp = 8 + Math.random() * 10;
      this.wobbleSpeed = 1.5 + Math.random() * 2;
      this.wobblePhase = Math.random() * Math.PI * 2;
      this.startX = this.x;
      this.opacity = 0.75;
      this.alive = true;
      this.age = 0;
      this.maxAge = 4 + Math.random() * 3; // 浮上去的时间
    }

    update(dt) {
      this.age += dt;
      if (this.age > this.maxAge) {
        this.alive = false;
        return;
      }

      // 上浮
      this.y -= this.riseSpeed * dt;
      // 左右摆动
      this.wobblePhase += this.wobbleSpeed * dt;
      this.x = this.startX + Math.sin(this.wobblePhase) * this.wobbleAmp;

      // 到水面消失
      if (this.y < canvasH * 0.05) {
        this.alive = false;
      }

      // 渐隐
      const lifeRatio = 1 - this.age / this.maxAge;
      this.opacity = 0.3 + lifeRatio * 0.55;
    }

    draw(ctx) {
      const r = this.radius;
      ctx.save();
      ctx.globalAlpha = this.opacity;

      // 气泡主体
      const gradient = ctx.createRadialGradient(this.x - r * 0.3, this.y - r * 0.3, r * 0.1, this.x, this.y, r);
      gradient.addColorStop(0, 'rgba(255,255,255,0.9)');
      gradient.addColorStop(0.5, 'rgba(180,220,255,0.5)');
      gradient.addColorStop(1, 'rgba(100,180,255,0.15)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
      ctx.fill();

      // 高光
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.arc(this.x - r * 0.25, this.y - r * 0.25, r * 0.3, 0, Math.PI * 2);
      ctx.fill();

      // 硬币值
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 10px "Segoe UI", "PingFang SC", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('+' + this.value, this.x, this.y);

      ctx.restore();
    }

    containsPoint(px, py) {
      const dx = px - this.x;
      const dy = py - this.y;
      return Math.sqrt(dx * dx + dy * dy) < this.radius + 6;
    }
  }

  // ==================== Particle 类 ====================
  class Particle {
    constructor(x, y, color) {
      this.x = x;
      this.y = y;
      this.vx = (Math.random() - 0.5) * 120;
      this.vy = -40 - Math.random() * 100;
      this.life = 1;
      this.decay = 1.5 + Math.random() * 2;
      this.color = color || '#ffd700';
      this.size = 2 + Math.random() * 3;
    }

    update(dt) {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.vy += 50 * dt; // 轻微重力
      this.life -= this.decay * dt;
    }

    draw(ctx) {
      if (this.life <= 0) return;
      ctx.save();
      ctx.globalAlpha = this.life;
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // ==================== 初始化 ====================
  function init() {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // 生成装饰物
    generateDecorations();

    // 加载存档
    const loaded = loadGame();
    if (!loaded) {
      // 首次游玩：送一条小丑鱼
      addFish(0);
    }

    // 离线收益
    calculateAndShowOffline();

    // 渲染商店
    renderShop();

    // 事件监听
    canvas.addEventListener('click', handleCanvasClick);
    document.getElementById('btnShop').addEventListener('click', openShop);
    document.getElementById('btnCloseShop').addEventListener('click', closeShop);
    document.getElementById('shopOverlay').addEventListener('click', function (e) {
      if (e.target === this) closeShop();
    });
    document.getElementById('btnCollectOffline').addEventListener('click', collectOffline);

    // 开始游戏循环
    lastFrameTime = performance.now();
    animationId = requestAnimationFrame(gameLoop);
  }

  function resizeCanvas() {
    const wrapper = canvas.parentElement;
    canvasW = wrapper.clientWidth;
    canvasH = wrapper.clientHeight;
    canvas.width = canvasW * (window.devicePixelRatio || 1);
    canvas.height = canvasH * (window.devicePixelRatio || 1);
    canvas.style.width = canvasW + 'px';
    canvas.style.height = canvasH + 'px';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);

    // 重新约束鱼的位置
    state.fish.forEach(f => {
      f.x = Math.min(canvasW - 20, Math.max(20, f.x));
      f.y = Math.min(canvasH * 0.78, Math.max(canvasH * 0.15, f.baseY || f.y));
      f.targetX = f._pickNewTarget();
    });
  }

  function generateDecorations() {
    state.seaweeds = [];
    state.pebbles = [];

    // 海草
    const seaweedCount = Math.floor(canvasW / 120);
    for (let i = 0; i < seaweedCount; i++) {
      state.seaweeds.push({
        x: 40 + i * (canvasW / seaweedCount) + (Math.random() - 0.5) * 50,
        height: 40 + Math.random() * 70,
        width: 4 + Math.random() * 6,
        phase: Math.random() * Math.PI * 2,
        speed: 0.8 + Math.random() * 1.5,
        segments: 4 + Math.floor(Math.random() * 4),
        color: `hsl(${120 + Math.random() * 30}, ${50 + Math.random() * 30}%, ${20 + Math.random() * 20}%)`,
      });
    }

    // 石子
    const pebbleCount = Math.floor(canvasW / 60);
    for (let i = 0; i < pebbleCount; i++) {
      state.pebbles.push({
        x: Math.random() * canvasW,
        rx: 6 + Math.random() * 14,
        ry: 3 + Math.random() * 8,
        color: `hsl(${25 + Math.random() * 15}, ${20 + Math.random() * 20}%, ${35 + Math.random() * 25}%)`,
      });
    }
  }

  // ==================== 游戏循环 ====================
  function gameLoop(timestamp) {
    let dt = (timestamp - lastFrameTime) / 1000;
    lastFrameTime = timestamp;

    // 防止大帧跳跃
    if (dt > 0.1) dt = 0.1;
    if (dt <= 0) dt = 0.016;

    update(dt);
    draw();

    animationId = requestAnimationFrame(gameLoop);
  }

  function update(dt) {
    // 鱼产币 + 吐泡泡
    const now = Date.now();
    state.fish.forEach(fish => {
      const type = FISH_TYPES[fish.typeId];
      // 产币
      state.coins += type.coinsPerSec * dt;
      state.totalEarned += type.coinsPerSec * dt;

      // 吐泡泡
      if (!state.bubbleSpawnTimers[fish.typeId]) {
        state.bubbleSpawnTimers[fish.typeId] = 0;
      }
      state.bubbleSpawnTimers[fish.typeId] += dt;
      const spawnInterval = 8 / (0.5 + type.coinsPerSec * 3); // 越贵的鱼吐泡泡越频繁
      if (state.bubbleSpawnTimers[fish.typeId] >= spawnInterval) {
        state.bubbleSpawnTimers[fish.typeId] = 0;
        const pos = fish.getBubbleSpawnPos();
        const bubbleValue = Math.max(1, Math.round(type.coinsPerSec * 25));
        state.bubbles.push(new Bubble(pos.x, pos.y, bubbleValue, fish.typeId));
      }

      // 更新鱼
      fish.update(dt);
    });

    // 限制泡泡数量
    if (state.bubbles.length > 40) {
      state.bubbles.splice(0, state.bubbles.length - 40);
    }

    // 更新泡泡
    state.bubbles.forEach(b => b.update(dt));
    state.bubbles = state.bubbles.filter(b => b.alive);

    // 更新粒子
    state.particles.forEach(p => p.update(dt));
    state.particles = state.particles.filter(p => p.life > 0);

    // 水面动画
    waterSurfaceOffset += dt * 0.6;
    lightRayPhase += dt * 0.3;

    // 定时存档 (每30秒，离线弹窗期间暂缓)
    if (now - state.lastSaveTime > 30000 && !offlineModalOpen) {
      saveGame();
    }
  }

  // ==================== 渲染 ====================
  function draw() {
    ctx.clearRect(0, 0, canvasW, canvasH);

    drawWaterBackground();
    drawLightRays();
    drawSandBottom();
    drawPebbles();
    drawSeaweeds();
    drawFish();
    drawBubbles();
    drawParticles();
    drawWaterSurface();

    // 更新 UI
    updateCoinDisplay();
  }

  function drawWaterBackground() {
    const grad = ctx.createLinearGradient(0, 0, 0, canvasH);
    grad.addColorStop(0, '#0a3d62');
    grad.addColorStop(0.3, '#0c5e8a');
    grad.addColorStop(0.6, '#0e7aaa');
    grad.addColorStop(0.85, '#1a8fc4');
    grad.addColorStop(1, '#2288aa');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvasW, canvasH);
  }

  function drawLightRays() {
    ctx.save();
    for (let i = 0; i < 5; i++) {
      const x = canvasW * 0.1 + i * canvasW * 0.2 + Math.sin(lightRayPhase + i) * 30;
      const grad = ctx.createLinearGradient(x, 0, x + 60, canvasH * 0.7);
      grad.addColorStop(0, 'rgba(255,255,255,0.04)');
      grad.addColorStop(0.5, 'rgba(255,255,255,0.02)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(x - 15, 0);
      ctx.lineTo(x + 50, canvasH * 0.75);
      ctx.lineTo(x - 30, canvasH * 0.75);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawSandBottom() {
    const sandY = canvasH * 0.8;
    const grad = ctx.createLinearGradient(0, sandY, 0, canvasH);
    grad.addColorStop(0, '#c2a25c');
    grad.addColorStop(0.3, '#b8943e');
    grad.addColorStop(0.7, '#9e7a2e');
    grad.addColorStop(1, '#7a5c1e');
    ctx.fillStyle = grad;

    // 波浪形沙面
    ctx.beginPath();
    ctx.moveTo(0, sandY);
    for (let x = 0; x <= canvasW; x += 20) {
      const waveY = sandY + Math.sin(x * 0.02 + waterSurfaceOffset * 0.3) * 5;
      ctx.lineTo(x, waveY);
    }
    ctx.lineTo(canvasW, canvasH);
    ctx.lineTo(0, canvasH);
    ctx.closePath();
    ctx.fill();
  }

  function drawPebbles() {
    state.pebbles.forEach(p => {
      const sandY = canvasH * 0.8;
      ctx.save();
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.ellipse(p.x, sandY + 3, p.rx, p.ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  function drawSeaweeds() {
    const sandY = canvasH * 0.8;
    state.seaweeds.forEach(sw => {
      ctx.save();
      ctx.strokeStyle = sw.color;
      ctx.lineWidth = sw.width;
      ctx.lineCap = 'round';
      ctx.globalAlpha = 0.7;

      ctx.beginPath();
      const baseY = sandY;
      ctx.moveTo(sw.x, baseY);

      const segHeight = sw.height / sw.segments;
      for (let i = 1; i <= sw.segments; i++) {
        const segX = sw.x + Math.sin(waterSurfaceOffset * sw.speed + sw.phase + i * 0.8) * (6 + i * 3);
        const segY = baseY - segHeight * i;
        ctx.lineTo(segX, segY);
      }
      ctx.stroke();
      ctx.restore();
    });
  }

  function drawFish() {
    // 按 y 排序实现前后遮挡
    const sorted = [...state.fish].sort((a, b) => a.y - b.y);
    sorted.forEach(f => f.draw(ctx));
  }

  function drawBubbles() {
    state.bubbles.forEach(b => b.draw(ctx));
  }

  function drawParticles() {
    state.particles.forEach(p => p.draw(ctx));
  }

  function drawWaterSurface() {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let x = 0; x <= canvasW; x += 8) {
      const y = Math.sin(x * 0.03 + waterSurfaceOffset) * 3 + Math.sin(x * 0.05 + waterSurfaceOffset * 1.3) * 2;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  // ==================== 交互处理 ====================
  function handleCanvasClick(e) {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // 检测点击泡泡
    for (let i = state.bubbles.length - 1; i >= 0; i--) {
      const bubble = state.bubbles[i];
      if (bubble.containsPoint(mx, my)) {
        collectBubble(bubble, i);
        return;
      }
    }
  }

  function collectBubble(bubble, index) {
    const value = bubble.value;
    state.coins += value;
    state.totalEarned += value;
    state.totalClicks++;

    // 粒子特效
    for (let i = 0; i < 8; i++) {
      state.particles.push(new Particle(bubble.x, bubble.y, '#ffd700'));
    }
    for (let i = 0; i < 4; i++) {
      state.particles.push(new Particle(bubble.x, bubble.y, '#ffffff'));
    }

    // 移除泡泡
    state.bubbles.splice(index, 1);

    // 飘字效果
    spawnFloatingText(bubble.x, bubble.y, '+' + value);

    // 弹跳动画
    elCoinDisplay.classList.remove('pop');
    void elCoinDisplay.offsetWidth;
    elCoinDisplay.classList.add('pop');

    // 震动附近鱼
    state.fish.forEach(f => {
      const dx = f.x - bubble.x;
      const dy = f.y - bubble.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 80) {
        f.scaleTarget = 1.3;
        setTimeout(() => { f.scaleTarget = 1; }, 150);
      }
    });
  }

  function spawnFloatingText(x, y, text) {
    // 使用粒子系统模拟飘字
    const startY = y;
    for (let i = 0; i < 5; i++) {
      const p = new Particle(x, y, '#ffd700');
      p.vy = -80 - Math.random() * 60;
      p.vx = (Math.random() - 0.5) * 40;
      p.decay = 1.2;
      p.size = 1.5;
      state.particles.push(p);
    }
  }

  // ==================== 商店系统 ====================
  function openShop() {
    renderShop();
    elShopOverlay.classList.add('open');
  }

  function closeShop() {
    elShopOverlay.classList.remove('open');
  }

  function renderShop() {
    elShopItems.innerHTML = '';

    FISH_TYPES.forEach(type => {
      const ownedCount = state.fish.filter(f => f.typeId === type.id).length;
      const canAfford = state.coins >= type.cost;

      const div = document.createElement('div');
      div.className = 'shop-item';
      if (type.cost === 0) div.classList.add('free');
      if (ownedCount > 0) div.classList.add('owned');
      if (!canAfford && type.cost > 0) div.classList.add('cant-afford');

      div.innerHTML = `
        <span class="fish-emoji">${type.emoji}</span>
        <div class="fish-name">${type.name}</div>
        <div class="fish-stat">🫧 ${(type.coinsPerSec * 60).toFixed(1)}/分钟</div>
        ${ownedCount > 0
          ? `<span class="fish-owned-badge">已拥有 ×${ownedCount}</span>`
          : type.cost === 0
            ? `<span class="fish-cost">免费领取</span>`
            : `<span class="fish-cost">🫧 ${formatNumber(type.cost)}</span>`
        }
      `;

      if (canAfford || type.cost === 0) {
        div.addEventListener('click', () => {
          buyFish(type.id);
          closeShop();
        });
      }

      elShopItems.appendChild(div);
    });
  }

  function buyFish(typeId) {
    const type = FISH_TYPES[typeId];

    if (type.cost > 0 && state.coins < type.cost) {
      showToast('泡泡币不足！💦');
      return;
    }

    if (type.cost > 0) {
      state.coins -= type.cost;
    }

    addFish(typeId);
    showToast(`获得了一只 ${type.emoji} ${type.name}！`);
    saveGame();
  }

  function addFish(typeId) {
    const x = 60 + Math.random() * (canvasW - 120);
    const y = canvasH * 0.2 + Math.random() * canvasH * 0.45;
    const fish = new Fish(typeId, x, y);
    state.fish.push(fish);
    return fish;
  }

  // ==================== 离线收益 ====================
  function calculateAndShowOffline() {
    const now = Date.now();
    const elapsed = (now - state.lastSaveTime) / 1000;

    // 至少离开 30 秒才算离线
    if (elapsed < 30) return;

    // 计算收益
    let earned = 0;
    state.fish.forEach(fish => {
      const type = FISH_TYPES[fish.typeId];
      earned += type.coinsPerSec * Math.min(elapsed, 8 * 3600); // 最多8小时
    });

    earned = Math.floor(earned);

    if (earned < 1) return;

    // 存储离线收益
    state._pendingOfflineCoins = earned;
    state._pendingOfflineSeconds = elapsed;

    // 显示弹窗
    elOfflineTime.textContent = formatTime(elapsed);
    elOfflineCoins.textContent = formatNumber(earned);
    elOfflineModal.classList.add('open');
    offlineModalOpen = true;
  }

  function collectOffline() {
    if (state._pendingOfflineCoins) {
      state.coins += state._pendingOfflineCoins;
      state.totalEarned += state._pendingOfflineCoins;
      state._pendingOfflineCoins = 0;
      state._pendingOfflineSeconds = 0;
    }
    offlineModalOpen = false;
    elOfflineModal.classList.remove('open');
    saveGame();
  }

  // ==================== 存档系统 ====================
  function saveGame() {
    state.lastSaveTime = Date.now();
    const data = {
      coins: state.coins,
      totalEarned: state.totalEarned,
      totalClicks: state.totalClicks,
      fishIdCounter: state.fishIdCounter,
      lastSaveTime: state.lastSaveTime,
      fish: state.fish.map(f => ({
        typeId: f.typeId,
        id: f.id,
        x: f.x,
        y: f.y,
        direction: f.direction,
        bobPhase: f.bobPhase,
      })),
    };
    try {
      localStorage.setItem('fishtank_save', JSON.stringify(data));
    } catch (e) {
      // localStorage 可能满了，静默失败
    }
  }

  function loadGame() {
    try {
      const raw = localStorage.getItem('fishtank_save');
      if (!raw) return false;

      const data = JSON.parse(raw);
      state.coins = data.coins || 0;
      state.totalEarned = data.totalEarned || 0;
      state.totalClicks = data.totalClicks || 0;
      state.fishIdCounter = data.fishIdCounter || 0;
      state.lastSaveTime = data.lastSaveTime || Date.now();
      state.fish = [];

      (data.fish || []).forEach(fd => {
        const fish = new Fish(fd.typeId, fd.x, fd.y);
        fish.id = fd.id;
        fish.direction = fd.direction || 1;
        fish.bobPhase = fd.bobPhase || 0;
        state.fish.push(fish);
      });

      return true;
    } catch (e) {
      return false;
    }
  }

  function resetGame() {
    if (confirm('确定要重置游戏吗？所有数据将丢失！')) {
      localStorage.removeItem('fishtank_save');
      location.reload();
    }
  }

  // ==================== UI 辅助 ====================
  function updateCoinDisplay() {
    const displayCoins = Math.floor(state.coins);
    elCoinAmount.textContent = formatNumber(displayCoins);
  }

  function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    elToastContainer.appendChild(toast);

    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
    }, 2500);
  }

  function formatNumber(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e4) return (n / 1e3).toFixed(1) + 'K';
    return Math.floor(n).toLocaleString();
  }

  function formatTime(seconds) {
    if (seconds < 60) return Math.floor(seconds) + '秒';
    if (seconds < 3600) return Math.floor(seconds / 60) + '分钟';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h + '小时' + (m > 0 ? m + '分钟' : '');
  }

  // ==================== 挂件拖动 ====================
  const elAppContainer = document.getElementById('appContainer');
  const elDragHandle = document.getElementById('dragHandle');
  let isDragging = false;
  let dragStartX = 0, dragStartY = 0;
  let widgetLeft = 0, widgetTop = 0;

  function loadWidgetPosition() {
    try {
      const pos = JSON.parse(localStorage.getItem('fishtank_widget_pos'));
      if (pos) {
        const maxX = window.innerWidth - 100;
        const maxY = window.innerHeight - 50;
        elAppContainer.style.right = 'auto';
        elAppContainer.style.bottom = 'auto';
        elAppContainer.style.left = Math.max(0, Math.min(pos.left, maxX)) + 'px';
        elAppContainer.style.top = Math.max(0, Math.min(pos.top, maxY)) + 'px';
        return true;
      }
    } catch (e) {}
    return false;
  }

  function saveWidgetPosition() {
    const rect = elAppContainer.getBoundingClientRect();
    try {
      localStorage.setItem('fishtank_widget_pos', JSON.stringify({
        left: rect.left,
        top: rect.top,
      }));
    } catch (e) {}
  }

  elDragHandle.addEventListener('mousedown', function (e) {
    // 不拦截按钮点击
    if (e.target.tagName === 'BUTTON') return;
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    const rect = elAppContainer.getBoundingClientRect();
    widgetLeft = rect.left;
    widgetTop = rect.top;
    // 切换到绝对定位
    elAppContainer.style.right = 'auto';
    elAppContainer.style.bottom = 'auto';
    elAppContainer.style.left = widgetLeft + 'px';
    elAppContainer.style.top = widgetTop + 'px';
    elAppContainer.style.transition = 'none';
  });

  document.addEventListener('mousemove', function (e) {
    if (!isDragging) return;
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    const newLeft = widgetLeft + dx;
    const newTop = widgetTop + dy;
    const maxX = window.innerWidth - elAppContainer.offsetWidth;
    const maxY = window.innerHeight - elAppContainer.offsetHeight;
    elAppContainer.style.left = Math.max(0, Math.min(newLeft, maxX)) + 'px';
    elAppContainer.style.top = Math.max(0, Math.min(newTop, maxY)) + 'px';
  });

  document.addEventListener('mouseup', function () {
    if (!isDragging) return;
    isDragging = false;
    elAppContainer.style.transition = '';
    saveWidgetPosition();
  });

  // ==================== 折叠 / 展开 ====================
  let isCollapsed = false;

  function toggleCollapse() {
    isCollapsed = !isCollapsed;
    if (isCollapsed) {
      elAppContainer.classList.add('collapsed');
      document.getElementById('btnCollapse').textContent = '▸';
      document.getElementById('btnCollapse').title = '展开';
      // 记录折叠前的宽高
      elAppContainer.dataset.prevWidth = elAppContainer.style.width || '360px';
      elAppContainer.dataset.prevHeight = elAppContainer.style.height || '220px';
    } else {
      elAppContainer.classList.remove('collapsed');
      document.getElementById('btnCollapse').textContent = '━';
      document.getElementById('btnCollapse').title = '折叠';
      // 延迟 resize 等动画结束
      setTimeout(resizeCanvas, 350);
    }
  }

  document.getElementById('btnCollapse').addEventListener('click', toggleCollapse);

  // ==================== 快捷键 ====================
  document.addEventListener('keydown', function (e) {
    if (e.key === 's' || e.key === 'S') {
      if (!elShopOverlay.classList.contains('open')) {
        openShop();
      } else {
        closeShop();
      }
    }
    if (e.key === 'h' || e.key === 'H') {
      toggleCollapse();
    }
  });

  // 右键菜单重置（方便调试）
  document.addEventListener('contextmenu', function (e) {
    if (e.target === canvas || canvas.contains(e.target)) {
      e.preventDefault();
      resetGame();
    }
  });

  // 页面关闭前存档
  window.addEventListener('beforeunload', function () {
    saveGame();
    saveWidgetPosition();
  });

  // 页面隐藏时存档（切后台）
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      saveGame();
    }
  });

  // ==================== 启动 ====================
  // 恢复挂件位置
  loadWidgetPosition();
  init();

  // 暴露 API 到全局
  window.fishTank = {
    addCoins: (amount) => { state.coins += amount; },
    addFish: (typeId) => addFish(typeId),
    reset: resetGame,
    save: saveGame,
    getState: () => state,
    toggleCollapse: toggleCollapse,
  };

  console.log('🐟 桌面小鱼缸已就绪！');
  console.log('  - 拖动标题栏移动位置');
  console.log('  - 点击泡泡收集金币');
  console.log('  - 按 H 键折叠/展开');
  console.log('  - 按 S 键打开商店');
  console.log('  - 右键画布重置游戏');
  console.log('  🎮 祝你养鱼愉快！');
})();
