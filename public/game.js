/* global io */
'use strict';

const socket = io();

const CLASS_META = {
  swordsman: { label: 'Мечник', short: 'М', color: '#c9a862', icon: '†', price: 0, description: 'Равновесие скорости, защиты и урона.' },
  greatsword: { label: 'Тяжёлый мечник', short: 'Т', color: '#9f4650', icon: '‡', price: 600, description: 'Медленные удары с огромной силой.' },
  rogue: { label: 'Вор', short: 'В', color: '#8ba17d', icon: '⋔', price: 900, description: 'Быстрые кинжалы и дешёвые перекаты.' },
};

const SKIN_META = {
  iron: { label: 'Старая сталь', color: '#c8bfae', price: 0 },
  ember: { label: 'Угольный след', color: '#d85b3d', price: 250 },
  moon: { label: 'Лунное серебро', color: '#9eb7dd', price: 500 },
  abyss: { label: 'Кромка бездны', color: '#9571bd', price: 800 },
};

const DEFAULT_PROFILE = {
  currency: 0,
  unlockedClasses: ['swordsman'],
  unlockedSkins: ['iron'],
  selectedSkin: 'iron',
};

const dom = Object.fromEntries([
  'homeScreen', 'lobbyScreen', 'gameScreen', 'serverState', 'nameInput', 'roomCodeInput',
  'createRoomButton', 'joinRoomButton', 'homeError', 'lobbyError', 'lobbyCount', 'roomCodeText',
  'copyCodeButton', 'squadGrid', 'lobbyHint', 'startGameButton', 'leaveLobbyButton', 'brandButton',
  'gameCanvas', 'hudRoomCode', 'timerText', 'bossName', 'stageText', 'bossHealthBar', 'bossHealthText',
  'squadHud', 'playerVitals', 'heartsBar', 'staminaBar', 'controlsTip', 'toastStack',
  'perkOverlay', 'perkKicker', 'perkSubtitle', 'perkGrid', 'waitingPerks', 'shopButton', 'shopOverlay',
  'closeShopButton', 'currencyCount', 'shopCurrency', 'classShop', 'skinShop', 'resultOverlay',
  'resultKicker', 'resultTitle', 'resultSubtitle', 'runSummary', 'resultStats', 'rematchButton', 'resultExitButton',
].map((id) => [id, document.querySelector(`#${id}`)]));

const ctx = dom.gameCanvas.getContext('2d');
const screens = [dom.homeScreen, dom.lobbyScreen, dom.gameScreen];
const input = { left: false, right: false, jump: false, light: false, heavy: false, parry: false, roll: false };

let profile = loadProfile();
let selectedClass = profile.unlockedClasses.includes('swordsman') ? 'swordsman' : profile.unlockedClasses[0];
let roomCode = '';
let lobbyState = null;
let gameState = null;
let world = { width: 2800, height: 720, floor: 640 };
let platforms = [];
let arena = null;
let cameraX = 0;
let canvasWidth = 1280;
let canvasHeight = 720;
let canvasScale = 1;
let pixelRatio = 1;
let controlsTimer = null;
let currentPerkKey = '';
let audioContext = null;
let previousBossHp = null;

function loadProfile() {
  try {
    const saved = JSON.parse(localStorage.getItem('riftRaidAshenProfile') || '{}');
    const unlockedClasses = Array.isArray(saved.unlockedClasses) ? saved.unlockedClasses.filter((id) => CLASS_META[id]) : [];
    const unlockedSkins = Array.isArray(saved.unlockedSkins) ? saved.unlockedSkins.filter((id) => SKIN_META[id]) : [];
    if (!unlockedClasses.includes('swordsman')) unlockedClasses.unshift('swordsman');
    if (!unlockedSkins.includes('iron')) unlockedSkins.unshift('iron');
    return {
      currency: Math.max(0, Math.floor(Number(saved.currency) || 0)),
      unlockedClasses,
      unlockedSkins,
      selectedSkin: unlockedSkins.includes(saved.selectedSkin) ? saved.selectedSkin : 'iron',
    };
  } catch {
    return structuredClone(DEFAULT_PROFILE);
  }
}

function saveProfile() {
  localStorage.setItem('riftRaidAshenProfile', JSON.stringify(profile));
  renderProfile();
}

function renderProfile() {
  dom.currencyCount.textContent = profile.currency;
  dom.shopCurrency.textContent = profile.currency;
  document.querySelectorAll('.class-option').forEach((button) => {
    const id = button.dataset.class;
    const unlocked = profile.unlockedClasses.includes(id);
    button.classList.toggle('locked', !unlocked);
    button.classList.toggle('selected', selectedClass === id);
    const label = button.querySelector('b');
    if (label) {
      label.textContent = unlocked ? (selectedClass === id ? 'ВЫБРАН' : 'ДОСТУПЕН') : `${CLASS_META[id].price} ¤`;
      label.className = unlocked ? '' : 'lock-label';
    }
  });
  renderShop();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (symbol) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[symbol]);
}

function showScreen(target) {
  for (const screen of screens) screen.classList.toggle('active', screen === target);
}

function showError(element, message) {
  element.textContent = message || '';
  if (message) setTimeout(() => { if (element.textContent === message) element.textContent = ''; }, 4300);
}

function toast(text, tone = '') {
  const item = document.createElement('div');
  item.className = `toast ${tone}`;
  item.textContent = text;
  dom.toastStack.appendChild(item);
  setTimeout(() => item.remove(), 3300);
}

function setBusy(button, busy, normalLabel) {
  button.disabled = busy;
  const label = button.querySelector('span');
  if (label) label.textContent = busy ? 'ОТКРЫВАЕМ...' : normalLabel;
}

function currentName() { return dom.nameInput.value.trim().slice(0, 16); }

function chooseClass(id, notify = false) {
  if (!CLASS_META[id]) return;
  if (!profile.unlockedClasses.includes(id)) {
    toast(`${CLASS_META[id].label} ещё не открыт`, 'warn');
    openShop();
    return;
  }
  selectedClass = id;
  renderProfile();
  if (notify && lobbyState) socket.emit('select-class', { classId: selectedClass, skin: profile.selectedSkin });
}

function renderShop() {
  dom.classShop.innerHTML = Object.entries(CLASS_META).filter(([id]) => id !== 'swordsman').map(([id, meta]) => {
    const unlocked = profile.unlockedClasses.includes(id);
    const affordable = profile.currency >= meta.price;
    return `<article class="shop-item">
      <i style="color:${meta.color}">${meta.icon}</i>
      <div><strong>${meta.label}</strong><small>${meta.description}</small></div>
      <button class="buy-button" type="button" data-buy-class="${id}" ${unlocked || !affordable ? 'disabled' : ''}>${unlocked ? 'ОТКРЫТ' : `${meta.price} ¤`}</button>
    </article>`;
  }).join('');

  dom.skinShop.innerHTML = Object.entries(SKIN_META).map(([id, meta]) => {
    const unlocked = profile.unlockedSkins.includes(id);
    const selected = profile.selectedSkin === id;
    const affordable = profile.currency >= meta.price;
    return `<article class="skin-item ${selected ? 'selected' : ''}" style="--skin-color:${meta.color}" data-skin="${id}">
      <span class="weapon-swatch"></span><strong>${meta.label}</strong><small>${unlocked ? (selected ? 'ЭКИПИРОВАНО' : 'ДОСТУПЕН') : `${meta.price} ПЕПЛА`}</small>
      <button class="buy-button" type="button" ${!unlocked && !affordable ? 'disabled' : ''}>${unlocked ? (selected ? 'ВЫБРАН' : 'ВЫБРАТЬ') : `${meta.price} ¤`}</button>
    </article>`;
  }).join('');

  dom.classShop.querySelectorAll('[data-buy-class]').forEach((button) => button.addEventListener('click', () => {
    const id = button.dataset.buyClass;
    const meta = CLASS_META[id];
    if (profile.currency < meta.price || profile.unlockedClasses.includes(id)) return;
    profile.currency -= meta.price;
    profile.unlockedClasses.push(id);
    selectedClass = id;
    saveProfile();
    toast(`${meta.label} открыт`, 'gold');
  }));

  dom.skinShop.querySelectorAll('[data-skin]').forEach((item) => item.addEventListener('click', () => {
    const id = item.dataset.skin;
    const meta = SKIN_META[id];
    if (!profile.unlockedSkins.includes(id)) {
      if (profile.currency < meta.price) return toast('Недостаточно пепла', 'warn');
      profile.currency -= meta.price;
      profile.unlockedSkins.push(id);
    }
    profile.selectedSkin = id;
    saveProfile();
    if (lobbyState) socket.emit('select-class', { classId: selectedClass, skin: profile.selectedSkin });
    toast(`${meta.label} экипировано`, 'gold');
  }));
}

function openShop() {
  renderShop();
  dom.shopOverlay.classList.add('active');
  dom.shopOverlay.setAttribute('aria-hidden', 'false');
}
function closeShop() {
  dom.shopOverlay.classList.remove('active');
  dom.shopOverlay.setAttribute('aria-hidden', 'true');
}

function enterLobby(room) {
  lobbyState = room;
  roomCode = room.code;
  gameState = null;
  dom.resultOverlay.classList.remove('active');
  dom.perkOverlay.classList.remove('active');
  dom.hudRoomCode.textContent = room.code;
  showScreen(dom.lobbyScreen);
  renderLobby(room);
}

function renderLobby(room) {
  lobbyState = room;
  dom.roomCodeText.textContent = room.code;
  dom.lobbyCount.textContent = `${room.players.length} / ${room.maxPlayers}`;
  const me = room.players.find((player) => player.id === socket.id);
  if (me && profile.unlockedClasses.includes(me.classId)) selectedClass = me.classId;

  const cards = [];
  for (let index = 0; index < room.maxPlayers; index += 1) {
    const player = room.players.find((candidate) => candidate.slot === index);
    if (!player) {
      cards.push(`<article class="squad-card empty"><span class="slot-number">0${index + 1}</span><div><strong>+</strong><span>ПУСТОЕ МЕСТО</span></div></article>`);
      continue;
    }
    const meta = CLASS_META[player.classId] || CLASS_META.swordsman;
    const isMe = player.id === socket.id;
    cards.push(`<article class="squad-card ${isMe ? 'me' : ''}" style="--class-color:${meta.color}">
      <span class="slot-number">0${index + 1}</span>${player.isHost ? '<span class="host-chip">ХРАНИТЕЛЬ</span>' : ''}
      <div class="avatar-art"></div><div class="squad-info"><strong>${escapeHtml(player.name)}${isMe ? ' · ВЫ' : ''}</strong>
      <button type="button" ${isMe ? 'data-cycle-class' : 'disabled'}>${meta.label}</button></div></article>`);
  }
  dom.squadGrid.innerHTML = cards.join('');
  const isHost = room.hostId === socket.id;
  dom.startGameButton.style.display = isHost ? 'flex' : 'none';
  dom.startGameButton.disabled = false;
  dom.lobbyHint.querySelector('span').textContent = isHost ? (room.players.length === 1 ? 'МОЖНО НАЧАТЬ В ОДИНОЧКУ' : 'ОТРЯД ГОТОВ') : 'ЖДЁМ ХРАНИТЕЛЯ';
  dom.squadGrid.querySelector('[data-cycle-class]')?.addEventListener('click', () => {
    const unlocked = Object.keys(CLASS_META).filter((id) => profile.unlockedClasses.includes(id));
    chooseClass(unlocked[(unlocked.indexOf(selectedClass) + 1) % unlocked.length], true);
  });
}

function createRoom() {
  setBusy(dom.createRoomButton, true, 'ОТКРЫТЬ РАЗЛОМ');
  socket.emit('create-room', { name: currentName(), classId: selectedClass, skin: profile.selectedSkin }, (response) => {
    setBusy(dom.createRoomButton, false, 'ОТКРЫТЬ РАЗЛОМ');
    if (!response?.ok) return showError(dom.homeError, response?.error || 'Не удалось открыть комнату');
    enterLobby(response.room);
  });
}

function joinRoom() {
  const code = dom.roomCodeInput.value.trim().toUpperCase();
  if (code.length !== 5) return showError(dom.homeError, 'Нужен пятизначный код');
  dom.joinRoomButton.disabled = true;
  socket.emit('join-room', { code, name: currentName(), classId: selectedClass, skin: profile.selectedSkin }, (response) => {
    dom.joinRoomButton.disabled = false;
    if (!response?.ok) return showError(dom.homeError, response?.error || 'Не удалось войти');
    enterLobby(response.room);
  });
}

function startGame() {
  dom.startGameButton.disabled = true;
  socket.emit('start-game', (response) => {
    if (!response?.ok) {
      dom.startGameButton.disabled = false;
      showError(dom.lobbyError, response?.error || 'Не удалось начать');
    }
  });
}

function leaveHome() {
  socket.emit('leave-room');
  roomCode = '';
  lobbyState = gameState = null;
  resetInput();
  dom.resultOverlay.classList.remove('active');
  dom.perkOverlay.classList.remove('active');
  showScreen(dom.homeScreen);
}

function copyCode() {
  navigator.clipboard?.writeText(roomCode).then(() => toast('Код комнаты скопирован', 'gold')).catch(() => toast(`Код: ${roomCode}`));
}

function formatTime(seconds) {
  const value = Math.max(0, Math.floor(seconds || 0));
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}

function updateHud(state) {
  dom.timerText.textContent = formatTime(state.elapsed);
  dom.stageText.textContent = `СТАДИЯ ${state.stage} / ${state.maxStage}${state.arena?.name ? ` · ${state.arena.name}` : ''}`;
  dom.bossName.textContent = `СТРАЖ ПЕПЛА · ОБЛИК ${state.boss?.tier || Math.ceil(state.stage / 10)}`;
  if (state.boss) {
    const ratio = Math.max(0, state.boss.hp / state.boss.maxHp);
    dom.bossHealthBar.style.width = `${ratio * 100}%`;
    dom.bossHealthText.textContent = `${state.boss.hp} / ${state.boss.maxHp}`;
  }
  const me = state.players.find((player) => player.id === socket.id);
  if (me) {
    dom.heartsBar.innerHTML = Array.from({ length: me.maxHp }, (_, index) => `<span class="heart ${index >= me.hp ? 'empty' : ''}">♥</span>`).join('');
    dom.staminaBar.style.width = `${Math.max(0, me.stamina / me.maxStamina * 100)}%`;
  }
  dom.squadHud.innerHTML = state.players.map((player) => {
    const meta = CLASS_META[player.classId];
    return `<div class="hud-player ${player.downed ? 'downed' : ''}" style="--class-color:${meta.color}">
      <span class="hud-avatar">${meta.short}</span><div><strong>${escapeHtml(player.name)}${player.id === socket.id ? ' · ВЫ' : ''}</strong>
      <span class="mini-bars"><span><i style="width:${player.hp / player.maxHp * 100}%"></i></span><span><i style="width:${player.stamina / player.maxStamina * 100}%"></i></span></span></div></div>`;
  }).join('');
}

function showPerks(state) {
  const me = state.players.find((player) => player.id === socket.id);
  if (!me) return;
  const key = `${state.stage}:${me.perkChosen}:${me.perkOffer.map((perk) => perk.id).join(',')}`;
  dom.perkOverlay.classList.add('active');
  dom.perkOverlay.setAttribute('aria-hidden', 'false');
  dom.perkKicker.textContent = `СТАДИЯ ${state.stage} ПРОЙДЕНА`;
  resetInput();
  if (key === currentPerkKey) return;
  currentPerkKey = key;
  if (me.perkChosen) {
    dom.perkGrid.innerHTML = '';
    dom.perkSubtitle.textContent = 'Твой дар принят.';
    dom.waitingPerks.textContent = 'ЖДЁМ ВЫБОР ОСТАЛЬНЫХ СТРАННИКОВ';
    return;
  }
  dom.perkSubtitle.textContent = 'Остальные карты обратятся в пепел.';
  dom.waitingPerks.textContent = 'СДЕЛАЙ ВЫБОР';
  const rarityNames = { common: 'Обычный', rare: 'Редкий', epic: 'Эпический', legendary: 'Легендарный' };
  dom.perkGrid.innerHTML = me.perkOffer.map((perk) => `<button class="perk-card ${perk.rarity}" type="button" data-perk="${perk.id}">
    <span class="perk-rarity">${rarityNames[perk.rarity]}</span><span class="perk-icon">${perk.icon}</span>
    <h3>${perk.name}</h3><p>${perk.description}</p>${me.perks[perk.id] ? `<span class="perk-stack">УЖЕ: ×${me.perks[perk.id]}</span>` : ''}</button>`).join('');
  dom.perkGrid.querySelectorAll('[data-perk]').forEach((button) => button.addEventListener('click', () => {
    dom.perkGrid.querySelectorAll('button').forEach((item) => { item.disabled = true; });
    socket.emit('choose-perk', button.dataset.perk, (response) => {
      if (!response?.ok) { toast(response?.error || 'Не удалось выбрать карту', 'danger'); currentPerkKey = ''; }
      else playSound('perk');
    });
  }));
}

function showResults(data) {
  const victory = data.result === 'victory';
  dom.resultKicker.textContent = victory ? 'СОТНЯ ЗАВЕРШЕНА' : 'ЗАБЕГ ОКОНЧЕН';
  dom.resultTitle.textContent = victory ? 'Страж повержен' : 'Пламя погасло';
  dom.resultSubtitle.textContent = victory ? 'Все сто печатей разрушены.' : `Отряд достиг стадии ${data.stageReached}.`;
  dom.runSummary.innerHTML = `<div class="summary-box"><strong>${data.stagesCleared}</strong><span>СТАДИЙ ПРОЙДЕНО</span></div><div class="summary-box"><strong>${formatTime(data.elapsed)}</strong><span>ВРЕМЯ ЗАБЕГА</span></div>`;
  dom.resultStats.innerHTML = data.players.map((player, index) => `<div class="result-row"><span>#${index + 1}</span><strong>${escapeHtml(player.name)} · ${CLASS_META[player.classId].label}</strong><b>${player.damageDone} УРОНА · ${player.perkCount} ПЕРКОВ</b></div>`).join('');
  const host = lobbyState?.hostId === socket.id;
  dom.rematchButton.disabled = !host;
  dom.rematchButton.querySelector('span').textContent = host ? 'ВЕРНУТЬСЯ К КОСТРУ' : 'ЖДЁМ ХРАНИТЕЛЯ';
  dom.resultOverlay.classList.add('active');
  dom.resultOverlay.setAttribute('aria-hidden', 'false');
  playSound(victory ? 'victory' : 'defeat');
}

const KEY_MAP = {
  KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', KeyW: 'jump', ArrowUp: 'jump', Space: 'jump',
  KeyJ: 'light', KeyH: 'parry', KeyK: 'heavy', KeyL: 'roll',
};

function setInput(key, pressed) {
  if (!(key in input)) return;
  input[key] = pressed;
  socket.emit('input', input);
  if (pressed && ['light', 'heavy', 'parry', 'roll'].includes(key)) playSound(key);
}
function resetInput() { Object.keys(input).forEach((key) => { input[key] = false; }); socket.emit('input', input); }

window.addEventListener('keydown', (event) => {
  const key = KEY_MAP[event.code];
  if (!key || !dom.gameScreen.classList.contains('active') || dom.perkOverlay.classList.contains('active')) return;
  event.preventDefault(); setInput(key, true);
});
window.addEventListener('keyup', (event) => { const key = KEY_MAP[event.code]; if (key) { event.preventDefault(); setInput(key, false); } });
window.addEventListener('blur', resetInput);
dom.gameCanvas.addEventListener('pointerdown', (event) => { if (event.pointerType !== 'touch') setInput(event.button === 2 ? 'heavy' : 'light', true); });
window.addEventListener('pointerup', (event) => { if (event.pointerType !== 'touch') setInput(event.button === 2 ? 'heavy' : 'light', false); });
dom.gameCanvas.addEventListener('contextmenu', (event) => event.preventDefault());
document.querySelectorAll('[data-input]').forEach((button) => {
  const key = button.dataset.input;
  const release = (event) => { event.preventDefault(); setInput(key, false); button.classList.remove('pressed'); };
  button.addEventListener('pointerdown', (event) => { event.preventDefault(); button.setPointerCapture(event.pointerId); setInput(key, true); button.classList.add('pressed'); });
  button.addEventListener('pointerup', release); button.addEventListener('pointercancel', release);
});

function ensureAudio() {
  if (!audioContext) { const AudioCtx = window.AudioContext || window.webkitAudioContext; if (AudioCtx) audioContext = new AudioCtx(); }
  if (audioContext?.state === 'suspended') audioContext.resume();
}
function tone(frequency, duration, volume, type = 'sine', offset = 0) {
  if (!audioContext) return;
  const oscillator = audioContext.createOscillator(); const gain = audioContext.createGain(); const start = audioContext.currentTime + offset;
  oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, start); oscillator.frequency.exponentialRampToValueAtTime(Math.max(40, frequency * .62), start + duration);
  gain.gain.setValueAtTime(volume, start); gain.gain.exponentialRampToValueAtTime(.001, start + duration);
  oscillator.connect(gain).connect(audioContext.destination); oscillator.start(start); oscillator.stop(start + duration);
}
function playSound(kind) {
  ensureAudio(); if (!audioContext) return;
  if (kind === 'light') tone(190,.07,.022,'sawtooth');
  if (kind === 'heavy') tone(120,.13,.033,'square');
  if (kind === 'parry') tone(620,.08,.018,'triangle');
  if (kind === 'roll') tone(80,.08,.012,'sine');
  if (kind === 'hit') tone(85,.1,.025,'square');
  if (kind === 'perk') [330,440,660].forEach((f,i) => tone(f,.25,.025,'triangle',i*.07));
  if (kind === 'victory') [261,329,392,523].forEach((f,i) => tone(f,.32,.03,'triangle',i*.1));
  if (kind === 'defeat') [160,125,90].forEach((f,i) => tone(f,.35,.02,'sawtooth',i*.13));
}

function resizeCanvas() {
  const rect = dom.gameCanvas.getBoundingClientRect();
  pixelRatio = Math.min(window.devicePixelRatio || 1, 1.6);
  canvasWidth = Math.max(1, rect.width); canvasHeight = Math.max(1, rect.height);
  dom.gameCanvas.width = Math.round(canvasWidth * pixelRatio); dom.gameCanvas.height = Math.round(canvasHeight * pixelRatio);
  ctx.setTransform(pixelRatio,0,0,pixelRatio,0,0);
}

function applyArena(nextArena) {
  if(!nextArena)return;
  arena={...(arena||{}),...nextArena};
  if(Array.isArray(nextArena.platforms))platforms=nextArena.platforms;
}

function roundedRect(context,x,y,w,h,r) {
  r = Math.min(r,Math.abs(w)/2,Math.abs(h)/2); context.beginPath(); context.moveTo(x+r,y); context.arcTo(x+w,y,x+w,y+h,r); context.arcTo(x+w,y+h,x,y+h,r); context.arcTo(x,y+h,x,y,r); context.arcTo(x,y,x+w,y,r); context.closePath();
}

function drawBackdrop(state) {
  const tier = state?.boss?.tier || 1;
  const theme = state?.arena?.theme || arena?.theme || { sky: '#11100d', horizon: '#19140f', ground: '#080806', glow: '#79522a', fog: '#877b64' };
  const gradient = ctx.createLinearGradient(0,0,0,canvasHeight); gradient.addColorStop(0,theme.sky); gradient.addColorStop(.58,theme.horizon); gradient.addColorStop(1,theme.ground);
  ctx.fillStyle = gradient; ctx.fillRect(0,0,canvasWidth,canvasHeight);
  const glow = ctx.createRadialGradient(canvasWidth*.72,canvasHeight*.53,0,canvasWidth*.72,canvasHeight*.53,canvasWidth*.48); glow.addColorStop(0,theme.glow); glow.addColorStop(1,'rgba(0,0,0,0)'); ctx.save(); ctx.globalAlpha=.16; ctx.fillStyle=glow; ctx.fillRect(0,0,canvasWidth,canvasHeight); ctx.restore();
  ctx.fillStyle='rgba(221,205,174,.25)';
  for(let i=0;i<65+tier*3;i++){ const x=((i*227-cameraX*(.025+(i%3)*.02))%(canvasWidth+80)+canvasWidth+80)%(canvasWidth+80)-40; const y=60+(i*97)%Math.max(180,canvasHeight*.65); ctx.globalAlpha=.16+(i%5)*.07; ctx.fillRect(x,y,i%11===0?1.7:.7,i%11===0?1.7:.7); } ctx.globalAlpha=1;
  const baseY=canvasHeight*.79; ctx.fillStyle='rgba(8,8,7,.72)';
  for(let i=0;i<10;i++){ const x=i*210-(cameraX*.1)%210-100; const w=115+(i%3)*28; const h=130+(i*47+tier*13)%190; ctx.beginPath(); ctx.moveTo(x,baseY); ctx.lineTo(x,baseY-h+45); ctx.quadraticCurveTo(x+w/2,baseY-h-35,x+w,baseY-h+45); ctx.lineTo(x+w,baseY); ctx.closePath(); ctx.fill(); if(tier%2)ctx.fillRect(x+w/2-5,baseY-h-70,10,75); }
  const fog=ctx.createLinearGradient(0,canvasHeight*.66,0,canvasHeight); fog.addColorStop(0,'rgba(0,0,0,0)'); fog.addColorStop(.6,theme.fog); fog.addColorStop(1,'rgba(0,0,0,.3)'); ctx.save(); ctx.globalAlpha=.075; ctx.fillStyle=fog; ctx.fillRect(0,0,canvasWidth,canvasHeight); ctx.restore();
}

function drawPlatform(platform) {
  const theme=gameState?.arena?.theme||arena?.theme||{stone:'#342d24',trim:'#caae73'};
  const g=ctx.createLinearGradient(0,platform.y,0,platform.y+platform.h); g.addColorStop(0,theme.stone); g.addColorStop(.13,'#211d18'); g.addColorStop(1,'#0d0c0a'); ctx.fillStyle=g; ctx.fillRect(platform.x,platform.y,platform.w,platform.h);
  ctx.save();ctx.globalAlpha=.35;ctx.fillStyle=theme.trim;ctx.fillRect(platform.x,platform.y,platform.w,2);ctx.restore();ctx.fillStyle='rgba(255,255,255,.025)';
  for(let x=platform.x+15;x<platform.x+platform.w;x+=55){ctx.beginPath();ctx.moveTo(x,platform.y+8);ctx.lineTo(x+22,platform.y+8);ctx.lineTo(x+31,platform.y+29);ctx.lineTo(x+8,platform.y+29);ctx.closePath();ctx.fill();}
}

function drawArenaHazard(hazard,time) {
  if(!hazard.live&&!hazard.warning)return;
  const active=hazard.live;const color=hazard.type==='storm'?'#8fc7e8':hazard.type==='rune'?'#a47bd0':hazard.type==='fall'?'#c7b9dc':'#d3543c';
  ctx.save();ctx.globalAlpha=active ? 0.82 : 0.32;ctx.strokeStyle=color;ctx.fillStyle=color;ctx.shadowColor=color;ctx.shadowBlur=active?24:10;ctx.lineWidth=active?5:2;ctx.setLineDash(active?[]:[10,8]);
  if(hazard.type==='rune'){
    ctx.beginPath();ctx.ellipse(hazard.x+hazard.w/2,world.floor-8,hazard.w/2,18,0,0,Math.PI*2);ctx.stroke();
    for(let x=hazard.x+20;x<hazard.x+hazard.w;x+=34){ctx.beginPath();ctx.moveTo(x,world.floor-22);ctx.lineTo(x+10,world.floor-5);ctx.lineTo(x-7,world.floor-5);ctx.closePath();ctx.stroke();}
  }else if(hazard.type==='fall'||hazard.type==='storm'){
    ctx.globalAlpha=active ? 0.38 : 0.13;ctx.fillRect(hazard.x,0,hazard.w,world.floor);ctx.globalAlpha=active ? 0.9 : 0.4;
    const center=hazard.x+hazard.w/2;ctx.beginPath();ctx.moveTo(center,0);for(let y=0;y<world.floor;y+=70)ctx.lineTo(center+(Math.sin(time*18+y)*hazard.w*.3),y);ctx.stroke();
    ctx.strokeRect(hazard.x,4,hazard.w,world.floor-8);
  }else{
    const height=hazard.type==='blade'?112:142;ctx.beginPath();ctx.rect(hazard.x,world.floor-height,hazard.w,height);ctx.stroke();
    for(let x=hazard.x+8;x<hazard.x+hazard.w;x+=22){ctx.beginPath();ctx.moveTo(x,world.floor);ctx.lineTo(x+10,world.floor-height*(active ? 0.9 : 0.32));ctx.lineTo(x+20,world.floor);ctx.closePath();if(active)ctx.fill();else ctx.stroke();}
  }
  ctx.setLineDash([]);ctx.restore();
}

function drawPlayer(player,time) {
  const meta=CLASS_META[player.classId]; const skin=SKIN_META[player.skin]||SKIN_META.iron; const isMe=player.id===socket.id; const bob=Math.sin(time*8+player.slot)*Math.min(2,Math.abs(player.vx)/190);
  ctx.save(); ctx.translate(player.x+21,player.y+30+bob); ctx.scale(player.facing||1,1);
  if(player.invulnerable&&Math.floor(time*18)%2===0)ctx.globalAlpha=.42;
  if(isMe){const a=ctx.createRadialGradient(0,10,2,0,10,50);a.addColorStop(0,`${meta.color}20`);a.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=a;ctx.fillRect(-55,-50,110,110);}
  if(player.downed){ctx.rotate(Math.PI/2.2);ctx.globalAlpha=.45;}
  if(player.action==='roll')ctx.rotate((1-player.actionTimer/Math.max(.01,player.actionDuration))*Math.PI*2*player.facing);
  ctx.strokeStyle='#080705';ctx.lineWidth=6;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-9,18);ctx.lineTo(-12,31);ctx.moveTo(9,18);ctx.lineTo(13,31);ctx.stroke();
  const body=ctx.createLinearGradient(-18,-7,18,30);body.addColorStop(0,meta.color);body.addColorStop(1,'#1b1814');ctx.fillStyle=body;roundedRect(ctx,-18,-7,36,38,7);ctx.fill();
  ctx.fillStyle='#15120f';ctx.strokeStyle=meta.color;ctx.lineWidth=2.5;roundedRect(ctx,-16,-27,32,29,8);ctx.fill();ctx.stroke();
  ctx.fillStyle='#ded2b9';ctx.shadowColor='#d7b46a';ctx.shadowBlur=8;ctx.fillRect(3,-15,10,2.5);ctx.shadowBlur=0;
  const weaponScale=player.classId==='greatsword'?1.35:player.classId==='rogue'?.72:1;
  ctx.strokeStyle=skin.color;ctx.lineWidth=player.classId==='greatsword'?6:3.5;ctx.shadowColor=skin.color;ctx.shadowBlur=10;ctx.beginPath();ctx.moveTo(19,12);ctx.lineTo(19+28*weaponScale,-10-19*weaponScale);ctx.stroke();
  if(player.classId==='rogue'){ctx.beginPath();ctx.moveTo(-18,12);ctx.lineTo(-38,-12);ctx.stroke();}
  ctx.shadowBlur=0;
  if(player.action==='parry'||player.action==='parry_success'){ctx.strokeStyle=player.parryActive?'#f1d58d':'rgba(201,168,98,.45)';ctx.lineWidth=4;ctx.beginPath();ctx.arc(23,1,25,-1.2,1.2);ctx.stroke();}
  if(player.action==='light'||player.action==='heavy'){const p=1-player.actionTimer/Math.max(.01,player.actionDuration);ctx.strokeStyle=skin.color;ctx.globalAlpha=.5;ctx.lineWidth=player.action==='heavy'?9:5;ctx.beginPath();ctx.arc(5,0,player.action==='heavy'?55:43,-1.4+p,0.8+p);ctx.stroke();}
  ctx.restore();ctx.globalAlpha=1;
  ctx.textAlign='center';ctx.fillStyle=isMe?'#eee3cf':'rgba(225,217,201,.7)';ctx.font=`${isMe?700:600} 9px Manrope`;ctx.fillText(player.downed?`${player.name} · ПАЛ`:player.name,player.x+21,player.y-18);
}

function drawBoss(boss,time) {
  ctx.save();ctx.translate(boss.x+61,boss.y+75);ctx.scale(boss.facing||-1,1);const pulse=1+Math.sin(time*(2+boss.tier*.2))*.02;ctx.scale(pulse,pulse);
  const aura=ctx.createRadialGradient(0,0,10,0,0,135);aura.addColorStop(0,boss.tier>=7?'rgba(153,39,54,.24)':'rgba(144,91,41,.19)');aura.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=aura;ctx.fillRect(-140,-140,280,280);
  ctx.fillStyle='rgba(0,0,0,.4)';ctx.beginPath();ctx.ellipse(0,73,70,14,0,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#090706';ctx.lineWidth=17;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-27,40);ctx.lineTo(-36,68);ctx.moveTo(25,40);ctx.lineTo(34,68);ctx.stroke();
  const armor=ctx.createLinearGradient(-55,-50,55,55);armor.addColorStop(0,boss.flash?'#eee1c8':boss.tier>=7?'#812f3d':'#786143');armor.addColorStop(.4,'#393029');armor.addColorStop(1,'#11100d');ctx.fillStyle=armor;ctx.beginPath();ctx.moveTo(-48,-36);ctx.lineTo(18,-47);ctx.lineTo(53,-9);ctx.lineTo(40,51);ctx.lineTo(-37,52);ctx.lineTo(-57,4);ctx.closePath();ctx.fill();
  ctx.fillStyle='#11100e';ctx.strokeStyle=boss.tier>=7?'#a73a48':'#b28e4d';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(-42,-57);ctx.lineTo(-10,-82);ctx.lineTo(34,-65);ctx.lineTo(44,-27);ctx.lineTo(0,-12);ctx.lineTo(-40,-28);ctx.closePath();ctx.fill();ctx.stroke();
  const eye=boss.tier>=7?'#d14b5c':'#dbad58';ctx.fillStyle=eye;ctx.shadowColor=eye;ctx.shadowBlur=18;ctx.beginPath();ctx.moveTo(-2,-49);ctx.lineTo(31,-53);ctx.lineTo(14,-40);ctx.closePath();ctx.fill();ctx.shadowBlur=0;
  ctx.strokeStyle=eye;ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(35,-7);ctx.lineTo(74,17);ctx.lineTo(83,41);ctx.stroke();
  if(boss.stagger){ctx.strokeStyle='#e7cf91';ctx.lineWidth=3;ctx.setLineDash([6,5]);ctx.beginPath();ctx.arc(0,-6,82,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);}
  ctx.restore();
}

function drawTelegraph(boss,state) {
  const attack=boss.currentAttack;if(!attack||attack.phase!=='telegraph')return;const progress=1-attack.timer/Math.max(.01,attack.duration);const centerX=boss.x+61;const centerY=boss.y+75;ctx.save();ctx.globalAlpha=.35+progress*.55;ctx.strokeStyle='#b43b4b';ctx.fillStyle='rgba(159,53,67,.09)';ctx.lineWidth=3;ctx.setLineDash([10,7]);
  if(attack.type==='slam'){ctx.beginPath();ctx.ellipse(attack.targetX,world.floor-4,150+boss.tier*7,24,0,0,Math.PI*2);ctx.fill();ctx.stroke();}
  else if(attack.type==='marked')for(const x of attack.targetXs||[]){ctx.beginPath();ctx.ellipse(x,world.floor-5,145+boss.tier*4,28,0,0,Math.PI*2);ctx.fill();ctx.stroke();}
  else if(attack.type==='skyfall')for(const x of attack.targetXs||[]){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,world.floor);ctx.stroke();ctx.beginPath();ctx.ellipse(x,world.floor-5,55,14,0,0,Math.PI*2);ctx.fill();ctx.stroke();}
  else if(attack.type==='beam'){
    const direction=attack.direction||boss.facing;const length=760+Math.min(420,(state?.stage||1)*4);const x=direction>0?boss.x+boss.w:boss.x-length;ctx.fillRect(x,boss.y+18,length,94);ctx.strokeRect(x,boss.y+18,length,94);
  }
  else if(attack.type==='ring_burst'){ctx.beginPath();ctx.arc(centerX,boss.y+42,48+progress*58,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.arc(centerX,boss.y+42,25+progress*28,0,Math.PI*2);ctx.stroke();}
  else if(attack.type==='blink'){ctx.beginPath();ctx.moveTo(centerX,centerY);ctx.lineTo(attack.targetX,world.floor-70);ctx.stroke();ctx.beginPath();ctx.arc(attack.targetX,world.floor-70,62,0,Math.PI*2);ctx.fill();ctx.stroke();}
  else if(attack.type==='quake'){ctx.beginPath();ctx.moveTo(centerX-620,world.floor-9);ctx.lineTo(centerX+620,world.floor-9);ctx.stroke();for(let x=centerX-560;x<centerX+560;x+=95){ctx.beginPath();ctx.moveTo(x,world.floor);ctx.lineTo(x+26,world.floor-52);ctx.lineTo(x+52,world.floor);ctx.stroke();}}
  else if(['slash','cleave','charge','twin_slash'].includes(attack.type)){const radius=attack.type==='cleave'?245:attack.type==='twin_slash'?225:155;ctx.beginPath();ctx.arc(centerX,centerY,radius,-1.15,1.15);ctx.stroke();if(attack.type==='twin_slash'){ctx.beginPath();ctx.arc(centerX,centerY,radius*.72,2,4.2);ctx.stroke();}}
  else if(attack.type==='wave'){ctx.beginPath();ctx.moveTo(centerX,world.floor-8);ctx.lineTo(attack.targetX,world.floor-8);ctx.stroke();}
  else {ctx.beginPath();ctx.arc(centerX,boss.y+42,30+progress*20,0,Math.PI*2);ctx.stroke();}
  ctx.setLineDash([]);ctx.restore();
}

function drawProjectile(projectile) {const playerOwned=projectile.kind!=='boss';const color=playerOwned?'#9eb7dd':projectile.style==='sky'?'#a98ac2':projectile.style==='ring'?'#d06a7b':'#a93445';ctx.save();ctx.translate(projectile.x,projectile.y);ctx.shadowColor=color;ctx.shadowBlur=20;ctx.fillStyle=color;if(projectile.style==='sky'){ctx.rotate(Math.atan2(projectile.vy,projectile.vx)+Math.PI/2);ctx.beginPath();ctx.moveTo(0,-projectile.r*1.45);ctx.lineTo(projectile.r*.7,0);ctx.lineTo(0,projectile.r*1.45);ctx.lineTo(-projectile.r*.7,0);ctx.closePath();ctx.fill();}else{ctx.beginPath();ctx.arc(0,0,projectile.r,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=.3;ctx.strokeStyle=color;ctx.lineWidth=projectile.r*.65;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(-projectile.vx*.05,-projectile.vy*.05);ctx.stroke();ctx.restore();}
function drawWave(wave,time){ctx.save();ctx.translate(wave.x,wave.y);ctx.fillStyle='rgba(138,42,53,.15)';ctx.strokeStyle='#8f2d3a';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-wave.w/2,0);ctx.lineTo(-wave.w*.24,-wave.h*(.6+Math.sin(time*10)*.12));ctx.lineTo(0,-wave.h);ctx.lineTo(wave.w*.28,-wave.h*.5);ctx.lineTo(wave.w/2,0);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();}
function drawEffect(effect){const p=Math.max(0,effect.ttl/(effect.maxTtl||1));ctx.save();ctx.translate(effect.x,effect.y);ctx.globalAlpha=Math.min(1,p*2.6);ctx.strokeStyle=effect.color;ctx.fillStyle=effect.color;ctx.shadowColor=effect.color;ctx.shadowBlur=15;ctx.lineWidth=effect.type==='parry'?6:4;if(effect.type==='beam'){ctx.globalAlpha=Math.min(.72,p*1.4);ctx.fillRect(0,0,effect.width,effect.height);ctx.globalAlpha=Math.min(1,p*2);ctx.strokeRect(0,0,effect.width,effect.height);}else if(['ground_slam','slam'].includes(effect.type)){ctx.beginPath();ctx.ellipse(0,0,effect.size/2*(1-p*.25),20,0,0,Math.PI*2);ctx.stroke();}else{ctx.beginPath();ctx.arc(0,0,effect.size*(1-p*.5),effect.type.includes('slash')?-1.4:0,effect.type.includes('slash')?1.1:Math.PI*2);ctx.stroke();}ctx.restore();}

function renderFrame(timeMs) {
  const time=timeMs/1000;const state=gameState;drawBackdrop(state);
  if(state?.boss){canvasScale=canvasHeight/world.height;const visible=canvasWidth/canvasScale;const me=state.players.find((p)=>p.id===socket.id)||state.players[0];const target=Math.max(0,Math.min(world.width-visible,(me?.x||0)-visible*.42));cameraX+=(target-cameraX)*.1;ctx.save();ctx.setTransform(canvasScale*pixelRatio,0,0,canvasScale*pixelRatio,-cameraX*canvasScale*pixelRatio,0);
    const left=cameraX-150,right=cameraX+visible+150;for(const platform of platforms)if(platform.x+platform.w>left&&platform.x<right)drawPlatform(platform);for(const hazard of state.arena?.hazards||[])if(hazard.x+hazard.w>left&&hazard.x<right)drawArenaHazard(hazard,time);drawTelegraph(state.boss,state);for(const wave of state.waves||[])drawWave(wave,time);drawBoss(state.boss,time);for(const player of state.players)drawPlayer(player,time);for(const projectile of state.projectiles||[])drawProjectile(projectile);for(const effect of state.effects||[])drawEffect(effect);ctx.restore();}
  requestAnimationFrame(renderFrame);
}

document.querySelectorAll('.class-option').forEach((button) => button.addEventListener('click', () => chooseClass(button.dataset.class)));
dom.createRoomButton.addEventListener('click', createRoom); dom.joinRoomButton.addEventListener('click', joinRoom);
dom.roomCodeInput.addEventListener('input', () => { dom.roomCodeInput.value = dom.roomCodeInput.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,5); });
dom.roomCodeInput.addEventListener('keydown', (event) => { if(event.key==='Enter')joinRoom(); }); dom.nameInput.addEventListener('keydown', (event) => { if(event.key==='Enter')createRoom(); });
dom.copyCodeButton.addEventListener('click', copyCode); dom.startGameButton.addEventListener('click', startGame); dom.leaveLobbyButton.addEventListener('click', leaveHome);
dom.brandButton.addEventListener('click', () => { if(!dom.gameScreen.classList.contains('active'))leaveHome(); });
dom.shopButton.addEventListener('click', openShop); dom.closeShopButton.addEventListener('click', closeShop); dom.shopOverlay.addEventListener('click', (event) => { if(event.target===dom.shopOverlay)closeShop(); });
dom.resultExitButton.addEventListener('click', leaveHome); dom.rematchButton.addEventListener('click', () => socket.emit('return-lobby', (response) => { if(!response?.ok)toast(response?.error||'Не удалось вернуться','danger'); }));

socket.on('connect',()=>{dom.serverState.className='server-state online';dom.serverState.querySelector('span').textContent='Сервер доступен';});
socket.on('disconnect',()=>{dom.serverState.className='server-state offline';dom.serverState.querySelector('span').textContent='Связь потеряна';if(dom.gameScreen.classList.contains('active'))toast('Соединение потеряно','danger');});
socket.on('lobby-state',enterLobby);
socket.on('game-start',(config)=>{world=config.world;applyArena(config.arena);gameState=null;previousBossHp=null;dom.resultOverlay.classList.remove('active');dom.perkOverlay.classList.remove('active');showScreen(dom.gameScreen);resizeCanvas();clearTimeout(controlsTimer);dom.controlsTip.classList.remove('hide');controlsTimer=setTimeout(()=>dom.controlsTip.classList.add('hide'),9500);ensureAudio();toast('Забег начался. Смотри на движения босса.','gold');});
socket.on('stage-start',({stage,arena:nextArena})=>{applyArena(nextArena);currentPerkKey='';dom.perkOverlay.classList.remove('active');dom.perkOverlay.setAttribute('aria-hidden','true');toast(`${stage>1&&(stage-1)%10===0?'НОВАЯ АРЕНА · ':''}${nextArena?.name||`Стадия ${stage}`}`,'gold');});
socket.on('state',(state)=>{if(!dom.gameScreen.classList.contains('active'))showScreen(dom.gameScreen);if(state.arena)applyArena(state.arena);if(previousBossHp!==null&&state.boss?.hp<previousBossHp-20)playSound('hit');previousBossHp=state.boss?.hp??null;gameState=state;updateHud(state);if(state.status==='perk')showPerks(state);});
socket.on('stage-cleared',({stage})=>toast(`Печать ${stage} разрушена`,'gold'));
socket.on('currency-earned',({amount,stage})=>{profile.currency+=Math.max(0,Math.floor(amount));saveProfile();toast(`+${amount} пепла за стадию ${stage}`,'gold');});
socket.on('toast',(payload)=>toast(payload.text,payload.tone));socket.on('game-over',showResults);

window.addEventListener('resize',resizeCanvas);renderProfile();resizeCanvas();requestAnimationFrame(renderFrame);
