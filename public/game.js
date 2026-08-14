/* global io */
'use strict';

const socket = io();

const HERO_META = {
  blade: { label: 'Клинок', short: 'КЛ', color: '#65f7ef', ability: 'Разломный вихрь' },
  spark: { label: 'Искра', short: 'ИС', color: '#ff62d4', ability: 'Тройной импульс' },
  bastion: { label: 'Бастион', short: 'БС', color: '#ffc857', ability: 'Кинетический щит' },
};

const dom = {
  homeScreen: document.querySelector('#homeScreen'),
  lobbyScreen: document.querySelector('#lobbyScreen'),
  gameScreen: document.querySelector('#gameScreen'),
  serverState: document.querySelector('#serverState'),
  nameInput: document.querySelector('#nameInput'),
  roomCodeInput: document.querySelector('#roomCodeInput'),
  createRoomButton: document.querySelector('#createRoomButton'),
  joinRoomButton: document.querySelector('#joinRoomButton'),
  homeError: document.querySelector('#homeError'),
  lobbyError: document.querySelector('#lobbyError'),
  lobbyCount: document.querySelector('#lobbyCount'),
  roomCodeText: document.querySelector('#roomCodeText'),
  copyCodeButton: document.querySelector('#copyCodeButton'),
  squadGrid: document.querySelector('#squadGrid'),
  lobbyHint: document.querySelector('#lobbyHint'),
  startGameButton: document.querySelector('#startGameButton'),
  leaveLobbyButton: document.querySelector('#leaveLobbyButton'),
  brandButton: document.querySelector('#brandButton'),
  gameCanvas: document.querySelector('#gameCanvas'),
  hudRoomCode: document.querySelector('#hudRoomCode'),
  timerText: document.querySelector('#timerText'),
  bossPhase: document.querySelector('#bossPhase'),
  bossHealthBar: document.querySelector('#bossHealthBar'),
  bossHealthText: document.querySelector('#bossHealthText'),
  squadHud: document.querySelector('#squadHud'),
  controlsTip: document.querySelector('#controlsTip'),
  toastStack: document.querySelector('#toastStack'),
  resultOverlay: document.querySelector('#resultOverlay'),
  resultKicker: document.querySelector('#resultKicker'),
  resultTitle: document.querySelector('#resultTitle'),
  resultSubtitle: document.querySelector('#resultSubtitle'),
  resultStats: document.querySelector('#resultStats'),
  rematchButton: document.querySelector('#rematchButton'),
  resultExitButton: document.querySelector('#resultExitButton'),
};

const ctx = dom.gameCanvas.getContext('2d');
const screens = [dom.homeScreen, dom.lobbyScreen, dom.gameScreen];
const input = { left: false, right: false, jump: false, attack: false, dash: false, ability: false };

let selectedHero = 'blade';
let playerId = null;
let roomCode = '';
let lobbyState = null;
let gameState = null;
let world = { width: 3200, height: 720, floor: 640 };
let platforms = [];
let cameraX = 0;
let canvasWidth = 1280;
let canvasHeight = 720;
let canvasScale = 1;
let pixelRatio = 1;
let controlTipTimer = null;
let hasPlayedAudio = false;
let audioContext = null;
let previousBossHp = null;

function showScreen(target) {
  for (const screen of screens) screen.classList.toggle('active', screen === target);
}

function setBusy(button, busy, label) {
  if (!button) return;
  button.disabled = busy;
  const text = button.querySelector('span');
  if (text) text.textContent = busy ? 'Подключение...' : label;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (symbol) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[symbol]);
}

function currentName() {
  return dom.nameInput.value.trim().slice(0, 16);
}

function setHero(hero, notifyServer = false) {
  if (!HERO_META[hero]) return;
  selectedHero = hero;
  document.querySelectorAll('.hero-option').forEach((button) => {
    button.classList.toggle('selected', button.dataset.hero === hero);
  });
  if (notifyServer && lobbyState) socket.emit('select-hero', hero);
}

function showError(element, message) {
  element.textContent = message || '';
  if (message) setTimeout(() => {
    if (element.textContent === message) element.textContent = '';
  }, 4200);
}

function toast(text, tone = '') {
  const item = document.createElement('div');
  item.className = `toast ${tone}`;
  item.textContent = text;
  dom.toastStack.appendChild(item);
  setTimeout(() => item.remove(), 3300);
}

function enterLobby(room) {
  lobbyState = room;
  roomCode = room.code;
  gameState = null;
  dom.resultOverlay.classList.remove('active');
  dom.resultOverlay.setAttribute('aria-hidden', 'true');
  showScreen(dom.lobbyScreen);
  renderLobby(room);
}

function renderLobby(room) {
  lobbyState = room;
  roomCode = room.code;
  dom.roomCodeText.textContent = room.code;
  dom.hudRoomCode.textContent = room.code;
  dom.lobbyCount.textContent = `${room.players.length} / ${room.maxPlayers}`;

  const me = room.players.find((player) => player.id === socket.id);
  if (me) setHero(me.hero, false);

  const cards = [];
  for (let index = 0; index < room.maxPlayers; index += 1) {
    const player = room.players.find((candidate) => candidate.slot === index);
    if (!player) {
      cards.push(`
        <article class="squad-card empty">
          <span class="slot-number">0${index + 1}</span>
          <div><strong>+</strong><span>Свободное место</span></div>
        </article>`);
      continue;
    }

    const meta = HERO_META[player.hero];
    const isMe = player.id === socket.id;
    cards.push(`
      <article class="squad-card ${isMe ? 'me' : ''}" style="--hero-color:${meta.color}">
        <span class="slot-number">0${index + 1}</span>
        ${player.isHost ? '<span class="host-chip">Лидер</span>' : ''}
        <div class="avatar-art"></div>
        <div class="squad-info">
          <strong>${escapeHtml(player.name)}${isMe ? ' · ВЫ' : ''}</strong>
          ${isMe
            ? `<button type="button" data-cycle-hero>Сменить: ${meta.label}</button>`
            : `<button type="button" disabled>${meta.label}</button>`}
        </div>
      </article>`);
  }
  dom.squadGrid.innerHTML = cards.join('');

  const isHost = room.hostId === socket.id;
  const enoughPlayers = room.players.length >= 2;
  dom.startGameButton.style.display = isHost ? 'flex' : 'none';
  dom.startGameButton.disabled = !enoughPlayers;
  dom.lobbyHint.querySelector('i').style.background = enoughPlayers ? '#65f7ef' : '#ffc857';
  dom.lobbyHint.querySelector('span').textContent = enoughPlayers
    ? (isHost ? 'Отряд готов к запуску' : 'Ждём запуска от лидера')
    : 'Ждём ещё одного игрока';

  dom.squadGrid.querySelector('[data-cycle-hero]')?.addEventListener('click', () => {
    const keys = Object.keys(HERO_META);
    const next = keys[(keys.indexOf(selectedHero) + 1) % keys.length];
    setHero(next, true);
  });
}

function createRoom() {
  showError(dom.homeError, '');
  setBusy(dom.createRoomButton, true, 'Создать комнату');
  socket.emit('create-room', { name: currentName(), hero: selectedHero }, (response) => {
    setBusy(dom.createRoomButton, false, 'Создать комнату');
    if (!response?.ok) return showError(dom.homeError, response?.error || 'Не удалось создать комнату');
    playerId = response.playerId;
    enterLobby(response.room);
  });
}

function joinRoom() {
  const code = dom.roomCodeInput.value.trim().toUpperCase();
  if (code.length !== 5) return showError(dom.homeError, 'Введи пятизначный код комнаты');
  showError(dom.homeError, '');
  setBusy(dom.joinRoomButton, true, 'Войти');
  socket.emit('join-room', { code, name: currentName(), hero: selectedHero }, (response) => {
    setBusy(dom.joinRoomButton, false, 'Войти');
    if (!response?.ok) return showError(dom.homeError, response?.error || 'Не удалось войти');
    playerId = response.playerId;
    enterLobby(response.room);
  });
}

function leaveToHome() {
  socket.emit('leave-room');
  roomCode = '';
  lobbyState = null;
  gameState = null;
  previousBossHp = null;
  resetInput();
  dom.resultOverlay.classList.remove('active');
  dom.resultOverlay.setAttribute('aria-hidden', 'true');
  showScreen(dom.homeScreen);
}

function startGame() {
  showError(dom.lobbyError, '');
  dom.startGameButton.disabled = true;
  socket.emit('start-game', (response) => {
    if (!response?.ok) {
      showError(dom.lobbyError, response?.error || 'Не удалось начать рейд');
      dom.startGameButton.disabled = false;
    }
  });
}

function copyRoomCode() {
  const copied = () => {
    const label = dom.copyCodeButton.querySelector('i');
    label.textContent = 'Скопировано';
    toast('Код комнаты скопирован');
    setTimeout(() => { label.textContent = 'Копировать'; }, 1500);
  };
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(roomCode).then(copied).catch(() => toast(`Код комнаты: ${roomCode}`));
  } else {
    toast(`Код комнаты: ${roomCode}`);
  }
}

function formatTime(seconds) {
  const whole = Math.max(0, Math.floor(seconds || 0));
  return `${String(Math.floor(whole / 60)).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}`;
}

function updateHud(state) {
  if (!state.boss) return;
  const ratio = Math.max(0, state.boss.hp / state.boss.maxHp);
  dom.timerText.textContent = formatTime(state.elapsed);
  dom.bossPhase.textContent = `ФАЗА ${state.boss.phase}`;
  dom.bossHealthBar.style.width = `${ratio * 100}%`;
  dom.bossHealthText.textContent = `${state.boss.hp} / ${state.boss.maxHp}`;

  dom.squadHud.innerHTML = state.players.map((player) => {
    const meta = HERO_META[player.hero];
    const hp = Math.max(0, player.hp / player.maxHp * 100);
    return `
      <div class="hud-player ${player.downed ? 'downed' : ''}" style="--hero-color:${meta.color}">
        <span class="hud-avatar">${meta.short}</span>
        <div><strong>${escapeHtml(player.name)}${player.id === socket.id ? ' · ВЫ' : ''}</strong><span class="hud-hp"><i style="width:${hp}%"></i></span></div>
        <span class="hud-lives">×${player.respawns}</span>
      </div>`;
  }).join('');
}

function showResults(data) {
  const victory = data.result === 'victory';
  dom.resultKicker.textContent = victory ? 'РАЗЛОМ ЗАКРЫТ' : 'СИНХРОНИЗАЦИЯ ПОТЕРЯНА';
  dom.resultKicker.style.color = victory ? '#65f7ef' : '#ff496b';
  dom.resultTitle.textContent = victory ? 'Босс повержен' : 'Рейд провален';
  dom.resultSubtitle.textContent = victory
    ? `Команда справилась за ${formatTime(data.elapsed)}.`
    : 'Соберите отряд и попробуйте ещё раз.';
  dom.resultStats.innerHTML = data.players.map((player, index) => `
    <div class="result-row">
      <span>#${index + 1}</span>
      <strong>${escapeHtml(player.name)} · ${HERO_META[player.hero]?.label || player.hero}</strong>
      <b>${player.damageDone} DMG</b>
    </div>`).join('');

  const isHost = lobbyState?.hostId === socket.id;
  dom.rematchButton.disabled = !isHost;
  dom.rematchButton.querySelector('span').textContent = isHost ? 'Вернуться в комнату' : 'Ждём решения лидера';
  dom.resultOverlay.classList.add('active');
  dom.resultOverlay.setAttribute('aria-hidden', 'false');
  playSound(victory ? 'victory' : 'defeat');
}

function resetInput() {
  Object.keys(input).forEach((key) => { input[key] = false; });
  socket.emit('input', input);
}

const KEY_MAP = {
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  KeyW: 'jump', ArrowUp: 'jump', Space: 'jump',
  KeyJ: 'attack', KeyX: 'attack',
  KeyK: 'dash', ShiftLeft: 'dash', ShiftRight: 'dash',
  KeyE: 'ability', KeyQ: 'ability',
};

function setInputKey(key, pressed) {
  if (!(key in input)) return;
  input[key] = pressed;
  socket.emit('input', input);
  if (pressed && (key === 'attack' || key === 'ability')) playSound('attack');
}

window.addEventListener('keydown', (event) => {
  const mapped = KEY_MAP[event.code];
  if (!mapped || !dom.gameScreen.classList.contains('active')) return;
  event.preventDefault();
  setInputKey(mapped, true);
});

window.addEventListener('keyup', (event) => {
  const mapped = KEY_MAP[event.code];
  if (!mapped) return;
  event.preventDefault();
  setInputKey(mapped, false);
});

window.addEventListener('blur', resetInput);

dom.gameCanvas.addEventListener('pointerdown', (event) => {
  if (event.pointerType === 'touch') return;
  setInputKey('attack', true);
});
window.addEventListener('pointerup', (event) => {
  if (event.pointerType === 'touch') return;
  setInputKey('attack', false);
});

document.querySelectorAll('[data-input]').forEach((button) => {
  const key = button.dataset.input;
  const release = (event) => {
    event.preventDefault();
    setInputKey(key, false);
    button.classList.remove('pressed');
  };
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    setInputKey(key, true);
    button.classList.add('pressed');
  });
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
});

function ensureAudio() {
  if (!audioContext) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) audioContext = new AudioCtx();
  }
  if (audioContext?.state === 'suspended') audioContext.resume();
}

function tone(frequency, duration, volume, type = 'sine', offset = 0) {
  if (!audioContext) return;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const start = audioContext.currentTime + offset;
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(40, frequency * 0.62), start + duration);
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start(start);
  oscillator.stop(start + duration);
}

function playSound(kind) {
  ensureAudio();
  if (!audioContext) return;
  if (kind === 'attack') tone(210, 0.07, 0.025, 'sawtooth');
  if (kind === 'hit') tone(95, 0.1, 0.035, 'square');
  if (kind === 'victory') {
    [261, 329, 392, 523].forEach((frequency, index) => tone(frequency, 0.3, 0.035, 'triangle', index * 0.1));
  }
  if (kind === 'defeat') [180, 145, 110].forEach((frequency, index) => tone(frequency, 0.35, 0.025, 'sawtooth', index * 0.13));
}

function resizeCanvas() {
  const rect = dom.gameCanvas.getBoundingClientRect();
  pixelRatio = Math.min(window.devicePixelRatio || 1, 1.6);
  canvasWidth = Math.max(1, rect.width);
  canvasHeight = Math.max(1, rect.height);
  dom.gameCanvas.width = Math.round(canvasWidth * pixelRatio);
  dom.gameCanvas.height = Math.round(canvasHeight * pixelRatio);
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
}

function roundedRect(context, x, y, width, height, radius) {
  const r = Math.min(radius, Math.abs(width) / 2, Math.abs(height) / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
}

function drawBackdrop(state) {
  const phase = state?.boss?.phase || 1;
  const gradient = ctx.createLinearGradient(0, 0, 0, canvasHeight);
  gradient.addColorStop(0, phase >= 3 ? '#17071d' : '#0b0b1d');
  gradient.addColorStop(0.58, '#12102a');
  gradient.addColorStop(1, '#080912');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  const glow = ctx.createRadialGradient(canvasWidth * 0.78, canvasHeight * 0.34, 0, canvasWidth * 0.78, canvasHeight * 0.34, canvasWidth * 0.38);
  glow.addColorStop(0, phase >= 3 ? 'rgba(255,45,123,.15)' : 'rgba(121,76,255,.17)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  ctx.fillStyle = 'rgba(220,225,255,.55)';
  for (let index = 0; index < 72; index += 1) {
    const seedX = (index * 233 + 91) % 1700;
    const x = ((seedX - cameraX * (0.03 + (index % 3) * 0.02)) % (canvasWidth + 80) + canvasWidth + 80) % (canvasWidth + 80) - 40;
    const y = 72 + ((index * 83) % Math.max(180, canvasHeight * 0.58));
    const size = index % 9 === 0 ? 1.6 : 0.7;
    ctx.globalAlpha = 0.25 + (index % 5) * 0.1;
    ctx.fillRect(x, y, size, size);
  }
  ctx.globalAlpha = 1;

  const skylineY = canvasHeight * 0.72;
  ctx.fillStyle = 'rgba(19,20,43,.8)';
  for (let index = 0; index < 24; index += 1) {
    const width = 58 + (index * 19) % 65;
    const height = 65 + (index * 43) % 145;
    let x = index * 128 - (cameraX * 0.12) % 128;
    x -= 130;
    ctx.fillRect(x, skylineY - height, width, height + canvasHeight - skylineY);
    ctx.fillStyle = index % 4 === 0 ? 'rgba(101,247,239,.09)' : 'rgba(153,114,255,.06)';
    for (let w = 12; w < width - 8; w += 19) {
      for (let h = 14; h < height - 10; h += 25) ctx.fillRect(x + w, skylineY - height + h, 4, 7);
    }
    ctx.fillStyle = 'rgba(19,20,43,.8)';
  }

  ctx.fillStyle = 'rgba(101,247,239,.035)';
  const horizon = canvasHeight * 0.82;
  for (let line = 0; line < 8; line += 1) {
    const y = horizon + line * line * 5;
    ctx.fillRect(0, y, canvasWidth, 1);
  }
}

function drawPlatform(platform) {
  const topGradient = ctx.createLinearGradient(0, platform.y, 0, platform.y + platform.h);
  topGradient.addColorStop(0, '#30324d');
  topGradient.addColorStop(0.12, '#1c1e34');
  topGradient.addColorStop(1, '#10111e');
  ctx.fillStyle = topGradient;
  ctx.fillRect(platform.x, platform.y, platform.w, platform.h);
  ctx.fillStyle = 'rgba(101,247,239,.28)';
  ctx.fillRect(platform.x, platform.y, platform.w, 2);
  ctx.fillStyle = 'rgba(255,255,255,.035)';
  for (let x = platform.x + 18; x < platform.x + platform.w; x += 62) {
    ctx.beginPath();
    ctx.moveTo(x, platform.y + 10);
    ctx.lineTo(x + 17, platform.y + 10);
    ctx.lineTo(x + 27, platform.y + 30);
    ctx.lineTo(x + 10, platform.y + 30);
    ctx.closePath();
    ctx.fill();
  }
}

function drawHealthBar(x, y, width, ratio, color) {
  ctx.fillStyle = 'rgba(2,3,9,.68)';
  roundedRect(ctx, x, y, width, 5, 3);
  ctx.fill();
  if (ratio > 0) {
    ctx.fillStyle = color;
    roundedRect(ctx, x + 1, y + 1, (width - 2) * ratio, 3, 2);
    ctx.fill();
  }
}

function drawPlayer(player, time) {
  const meta = HERO_META[player.hero] || HERO_META.blade;
  const isMe = player.id === socket.id;
  const bob = player.downed ? 0 : Math.sin(time * 8 + player.slot) * Math.min(2.5, Math.abs(player.vx) / 180);
  const blink = player.invulnerable && Math.floor(time * 15) % 2 === 0;
  if (blink) ctx.globalAlpha = 0.43;

  ctx.save();
  ctx.translate(player.x + player.w / 2, player.y + player.h / 2 + bob);
  ctx.scale(player.facing || 1, 1);

  if (isMe) {
    const halo = ctx.createRadialGradient(0, 15, 2, 0, 15, 52);
    halo.addColorStop(0, `${meta.color}24`);
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(-56, -42, 112, 112);
  }

  if (player.downed) {
    ctx.rotate(Math.PI / 2.2);
    ctx.globalAlpha = 0.55;
  }

  ctx.strokeStyle = '#050712';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-9, 18); ctx.lineTo(-12, 31);
  ctx.moveTo(9, 18); ctx.lineTo(14, 31);
  ctx.stroke();

  const body = ctx.createLinearGradient(-18, -5, 20, 28);
  body.addColorStop(0, meta.color);
  body.addColorStop(1, '#20233a');
  ctx.fillStyle = body;
  roundedRect(ctx, -18, -7, 36, 37, 9);
  ctx.fill();

  ctx.fillStyle = '#101323';
  roundedRect(ctx, -16, -26, 32, 28, 9);
  ctx.fill();
  ctx.strokeStyle = meta.color;
  ctx.lineWidth = 2.5;
  roundedRect(ctx, -16, -26, 32, 28, 9);
  ctx.stroke();

  ctx.fillStyle = meta.color;
  ctx.shadowColor = meta.color;
  ctx.shadowBlur = 9;
  roundedRect(ctx, 2, -15, 11, 4, 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  if (player.hero === 'spark') {
    ctx.fillStyle = meta.color;
    ctx.beginPath();
    ctx.arc(28, 5, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#f8f0ff';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(18, 5); ctx.lineTo(28, 5); ctx.stroke();
  } else if (player.hero === 'bastion') {
    ctx.fillStyle = '#2d2d37';
    ctx.strokeStyle = meta.color;
    ctx.lineWidth = 3;
    roundedRect(ctx, 18, -3, 17, 32, 6);
    ctx.fill(); ctx.stroke();
  } else {
    ctx.strokeStyle = meta.color;
    ctx.lineWidth = 4;
    ctx.shadowColor = meta.color;
    ctx.shadowBlur = 11;
    ctx.beginPath(); ctx.moveTo(19, 10); ctx.lineTo(43, -12); ctx.stroke();
    ctx.shadowBlur = 0;
  }
  ctx.restore();
  ctx.globalAlpha = 1;

  if (!player.downed) drawHealthBar(player.x - 4, player.y - 17, player.w + 8, player.hp / player.maxHp, meta.color);
  ctx.fillStyle = isMe ? '#ffffff' : 'rgba(235,238,248,.72)';
  ctx.font = `${isMe ? 700 : 600} 10px Manrope, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(player.downed ? `${player.name} · ВОЗВРАТ` : player.name, player.x + player.w / 2, player.y - 24);
}

function drawBoss(boss, time) {
  ctx.save();
  ctx.translate(boss.x + boss.w / 2, boss.y + boss.h / 2);
  ctx.scale(boss.facing || -1, 1);
  const pulse = 1 + Math.sin(time * (boss.phase + 2)) * 0.025;
  ctx.scale(pulse, pulse);

  const aura = ctx.createRadialGradient(0, 8, 10, 0, 8, 125);
  aura.addColorStop(0, boss.phase >= 3 ? 'rgba(255,53,94,.22)' : 'rgba(154,114,255,.22)');
  aura.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = aura;
  ctx.fillRect(-130, -130, 260, 260);

  ctx.fillStyle = 'rgba(0,0,0,.35)';
  ctx.beginPath();
  ctx.ellipse(0, boss.h / 2 - 2, 65, 15, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#080712';
  ctx.lineWidth = 16;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-25, 38); ctx.lineTo(-34, 66);
  ctx.moveTo(23, 38); ctx.lineTo(33, 66);
  ctx.stroke();

  const armor = ctx.createLinearGradient(-55, -45, 55, 58);
  armor.addColorStop(0, boss.flash ? '#ffffff' : (boss.phase >= 3 ? '#ff496b' : '#9a72ff'));
  armor.addColorStop(0.38, '#37304d');
  armor.addColorStop(1, '#111322');
  ctx.fillStyle = armor;
  ctx.beginPath();
  ctx.moveTo(-45, -37);
  ctx.lineTo(18, -44);
  ctx.lineTo(51, -12);
  ctx.lineTo(39, 48);
  ctx.lineTo(-35, 50);
  ctx.lineTo(-54, 5);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#111321';
  ctx.strokeStyle = boss.phase >= 3 ? '#ff496b' : '#a67cff';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-39, -58); ctx.lineTo(-10, -78); ctx.lineTo(32, -63); ctx.lineTo(42, -28); ctx.lineTo(1, -13); ctx.lineTo(-38, -27); ctx.closePath();
  ctx.fill(); ctx.stroke();

  const eyeColor = boss.phase >= 3 ? '#ff355e' : '#ff62d4';
  ctx.fillStyle = eyeColor;
  ctx.shadowColor = eyeColor;
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.moveTo(-2, -48); ctx.lineTo(30, -52); ctx.lineTo(13, -40); ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.strokeStyle = eyeColor;
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(35, -8); ctx.lineTo(71, 13); ctx.lineTo(83, 36);
  ctx.stroke();
  ctx.fillStyle = '#181824';
  ctx.strokeStyle = eyeColor;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(82, 39, 19, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();

  ctx.restore();

  ctx.fillStyle = boss.phase >= 3 ? '#ff8097' : '#c8b5ff';
  ctx.font = '700 11px Space Grotesk, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`СТРАЖ · ФАЗА ${boss.phase}`, boss.x + boss.w / 2, boss.y - 23);
}

function drawProjectile(projectile) {
  const playerOwned = projectile.kind === 'player';
  const color = playerOwned ? '#ff62d4' : '#ff355e';
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 20;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(projectile.x, projectile.y, projectile.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = .35;
  ctx.strokeStyle = color;
  ctx.lineWidth = projectile.r * .7;
  ctx.beginPath();
  ctx.moveTo(projectile.x, projectile.y);
  ctx.lineTo(projectile.x - projectile.vx * .045, projectile.y - projectile.vy * .045);
  ctx.stroke();
  ctx.restore();
}

function drawWave(wave, time) {
  ctx.save();
  ctx.translate(wave.x, wave.y);
  ctx.fillStyle = 'rgba(255,73,107,.18)';
  ctx.strokeStyle = '#ff496b';
  ctx.lineWidth = 3;
  ctx.shadowColor = '#ff496b';
  ctx.shadowBlur = 15;
  ctx.beginPath();
  ctx.moveTo(-wave.w / 2, 0);
  ctx.lineTo(-wave.w * .25, -wave.h * (0.6 + Math.sin(time * 10) * .12));
  ctx.lineTo(0, -wave.h);
  ctx.lineTo(wave.w * .25, -wave.h * .55);
  ctx.lineTo(wave.w / 2, 0);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.restore();
}

function drawEffect(effect) {
  const progress = Math.max(0, effect.ttl / (effect.maxTtl || 1));
  ctx.save();
  ctx.translate(effect.x, effect.y);
  ctx.globalAlpha = Math.min(1, progress * 2.5);

  if (effect.type === 'warning') {
    const radius = effect.size / 2;
    ctx.fillStyle = `rgba(255,53,94,${0.06 + (1 - progress) * .13})`;
    ctx.strokeStyle = '#ff496b';
    ctx.lineWidth = 3;
    ctx.setLineDash([12, 9]);
    ctx.beginPath();
    ctx.ellipse(0, -4, radius, 24, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#ff8097';
    ctx.font = '800 11px Space Grotesk, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ОПАСНОСТЬ', 0, -35);
  } else if (effect.type === 'slam') {
    ctx.fillStyle = 'rgba(255,73,107,.18)';
    ctx.fillRect(-effect.size / 2, -70 * progress, effect.size, 70 * progress);
    ctx.strokeStyle = '#ff496b';
    ctx.lineWidth = 5;
    for (let x = -effect.size / 2; x <= effect.size / 2; x += 35) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 16, -55 * progress); ctx.stroke();
    }
  } else if (effect.type === 'slash') {
    ctx.strokeStyle = effect.color;
    ctx.lineWidth = 8 * progress;
    ctx.shadowColor = effect.color;
    ctx.shadowBlur = 17;
    ctx.beginPath();
    ctx.arc(0, 0, effect.size * (1 - progress * .25), -1.15, 1.15);
    ctx.stroke();
  } else if (effect.type === 'dash') {
    ctx.strokeStyle = effect.color;
    ctx.lineWidth = 9;
    ctx.beginPath(); ctx.moveTo(-effect.size, 0); ctx.lineTo(effect.size * .25, 0); ctx.stroke();
  } else {
    ctx.strokeStyle = effect.color;
    ctx.lineWidth = effect.type === 'shield' ? 6 : 4;
    ctx.shadowColor = effect.color;
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(0, 0, effect.size * (1 - progress * .45), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawAbilityPanel(me) {
  if (!me) return;
  const meta = HERO_META[me.hero];
  const max = me.hero === 'blade' ? 8 : me.hero === 'spark' ? 9 : 11;
  const ratio = 1 - Math.min(1, me.abilityCooldown / max);
  const width = 170;
  const x = 24;
  const y = canvasHeight - 81;
  ctx.save();
  ctx.fillStyle = 'rgba(6,7,15,.7)';
  roundedRect(ctx, x, y, width, 42, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.1)';
  ctx.stroke();
  ctx.fillStyle = meta.color;
  roundedRect(ctx, x + 7, y + 7, 28, 28, 6);
  ctx.fill();
  ctx.fillStyle = '#07100f';
  ctx.font = '800 9px Space Grotesk, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('E', x + 21, y + 25);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#eef0f7';
  ctx.font = '700 8px Manrope, sans-serif';
  ctx.fillText(meta.ability.toUpperCase(), x + 43, y + 17);
  ctx.fillStyle = '#272b3e';
  ctx.fillRect(x + 43, y + 25, width - 52, 4);
  ctx.fillStyle = meta.color;
  ctx.fillRect(x + 43, y + 25, (width - 52) * ratio, 4);
  ctx.restore();
}

function renderFrame(timeMs) {
  const time = timeMs / 1000;
  const state = gameState;
  drawBackdrop(state);

  if (state?.boss) {
    canvasScale = canvasHeight / world.height;
    const visibleWidth = canvasWidth / canvasScale;
    const me = state.players.find((player) => player.id === socket.id) || state.players[0];
    const targetCamera = Math.max(0, Math.min(world.width - visibleWidth, (me?.x || 0) - visibleWidth * .42));
    cameraX += (targetCamera - cameraX) * Math.min(1, 6 / 60);

    ctx.save();
    ctx.setTransform(
      canvasScale * pixelRatio,
      0,
      0,
      canvasScale * pixelRatio,
      -cameraX * canvasScale * pixelRatio,
      0,
    );

    const left = cameraX - 150;
    const right = cameraX + visibleWidth + 150;
    for (const platform of platforms) {
      if (platform.x + platform.w > left && platform.x < right) drawPlatform(platform);
    }

    for (const effect of state.effects || []) if (effect.type === 'warning') drawEffect(effect);
    for (const wave of state.waves || []) drawWave(wave, time);
    drawBoss(state.boss, time);
    for (const player of state.players) drawPlayer(player, time);
    for (const projectile of state.projectiles || []) drawProjectile(projectile);
    for (const effect of state.effects || []) if (effect.type !== 'warning') drawEffect(effect);
    ctx.restore();

    drawAbilityPanel(me);
  }

  requestAnimationFrame(renderFrame);
}

document.querySelectorAll('.hero-option').forEach((button) => {
  button.addEventListener('click', () => setHero(button.dataset.hero));
});
dom.createRoomButton.addEventListener('click', createRoom);
dom.joinRoomButton.addEventListener('click', joinRoom);
dom.roomCodeInput.addEventListener('input', () => {
  dom.roomCodeInput.value = dom.roomCodeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
});
dom.roomCodeInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') joinRoom();
});
dom.nameInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') createRoom();
});
dom.copyCodeButton.addEventListener('click', copyRoomCode);
dom.startGameButton.addEventListener('click', startGame);
dom.leaveLobbyButton.addEventListener('click', leaveToHome);
dom.brandButton.addEventListener('click', () => {
  if (!dom.gameScreen.classList.contains('active')) leaveToHome();
});
dom.resultExitButton.addEventListener('click', leaveToHome);
dom.rematchButton.addEventListener('click', () => {
  socket.emit('return-lobby', (response) => {
    if (!response?.ok) toast(response?.error || 'Не удалось вернуться в комнату', 'danger');
  });
});

socket.on('connect', () => {
  playerId = socket.id;
  dom.serverState.className = 'server-state online';
  dom.serverState.querySelector('span').textContent = 'Сервер доступен';
});

socket.on('disconnect', () => {
  dom.serverState.className = 'server-state offline';
  dom.serverState.querySelector('span').textContent = 'Связь потеряна';
  if (dom.gameScreen.classList.contains('active')) toast('Соединение с сервером потеряно', 'danger');
});

socket.on('lobby-state', (room) => enterLobby(room));

socket.on('game-start', (config) => {
  world = config.world;
  platforms = config.platforms;
  gameState = null;
  previousBossHp = null;
  dom.hudRoomCode.textContent = roomCode;
  dom.resultOverlay.classList.remove('active');
  showScreen(dom.gameScreen);
  resizeCanvas();
  clearTimeout(controlTipTimer);
  dom.controlsTip.classList.remove('hide');
  controlTipTimer = setTimeout(() => dom.controlsTip.classList.add('hide'), 8500);
  hasPlayedAudio = true;
  ensureAudio();
  toast('Рейд начался. Держитесь вместе!');
});

socket.on('state', (state) => {
  if (!dom.gameScreen.classList.contains('active')) showScreen(dom.gameScreen);
  if (previousBossHp !== null && state.boss?.hp < previousBossHp - 25 && hasPlayedAudio) playSound('hit');
  previousBossHp = state.boss?.hp ?? null;
  gameState = state;
  updateHud(state);
});

socket.on('toast', (payload) => toast(payload.text, payload.tone));
socket.on('game-over', showResults);

window.addEventListener('resize', resizeCanvas);
resizeCanvas();
requestAnimationFrame(renderFrame);
