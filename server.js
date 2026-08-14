'use strict';

const path = require('node:path');
const http = require('node:http');
const express = require('express');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true }, transports: ['websocket', 'polling'] });

const PORT = Number(process.env.PORT) || 3000;
const TICK_RATE = 30;
const DT = 1 / TICK_RATE;
const MAX_PLAYERS = 4;
const MAX_STAGE = 100;
const WORLD = { width: 2800, height: 720, floor: 640 };
const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const PLATFORMS = [
  { x: 0, y: 640, w: 2800, h: 80 },
  { x: 315, y: 515, w: 265, h: 22 },
  { x: 725, y: 430, w: 255, h: 22 },
  { x: 1120, y: 540, w: 310, h: 22 },
  { x: 1620, y: 455, w: 290, h: 22 },
  { x: 2110, y: 525, w: 270, h: 22 },
];

const CLASSES = {
  swordsman: {
    label: 'Мечник', maxHp: 3, maxStamina: 100, staminaRegen: 27,
    speed: 360, jump: 700, lightDamage: 26, heavyDamage: 58,
    lightCost: 17, heavyCost: 36, rollCost: 29, parryCost: 15,
    lightTime: 0.3, heavyTime: 0.68, attackRange: 116, parryWindow: 0.18,
  },
  greatsword: {
    label: 'Тяжёлый мечник', maxHp: 3, maxStamina: 112, staminaRegen: 23,
    speed: 305, jump: 650, lightDamage: 38, heavyDamage: 88,
    lightCost: 23, heavyCost: 48, rollCost: 34, parryCost: 18,
    lightTime: 0.44, heavyTime: 0.9, attackRange: 142, parryWindow: 0.14,
  },
  rogue: {
    label: 'Вор', maxHp: 3, maxStamina: 128, staminaRegen: 34,
    speed: 425, jump: 735, lightDamage: 18, heavyDamage: 43,
    lightCost: 11, heavyCost: 27, rollCost: 21, parryCost: 12,
    lightTime: 0.2, heavyTime: 0.48, attackRange: 86, parryWindow: 0.23,
  },
};

const SKINS = new Set(['iron', 'ember', 'moon', 'abyss']);
const PERKS = [
  { id: 'vitality', name: 'Сердце титана', description: '+1 к максимуму здоровья.', rarity: 'common', icon: '♥' },
  { id: 'endurance', name: 'Закалённые жилы', description: '+25 к запасу выносливости.', rarity: 'common', icon: '◒' },
  { id: 'sharpened', name: 'Точильный камень', description: '+16% ко всему урону.', rarity: 'common', icon: '†' },
  { id: 'lungs', name: 'Ровное дыхание', description: 'Выносливость восстанавливается на 28% быстрее.', rarity: 'common', icon: '≈' },
  { id: 'quickstep', name: 'Лёгкая поступь', description: '+9% к скорости передвижения.', rarity: 'common', icon: '»' },
  { id: 'feather_roll', name: 'Пепельный перекат', description: 'Перекаты расходуют на 25% меньше выносливости.', rarity: 'rare', icon: '◌' },
  { id: 'parry_master', name: 'Холодная сталь', description: 'Окно парирования становится длиннее.', rarity: 'rare', icon: '◇' },
  { id: 'light_mastery', name: 'Танец клинка', description: 'Лёгкие атаки быстрее и дешевле.', rarity: 'rare', icon: '⌁' },
  { id: 'heavy_mastery', name: 'Сокрушитель', description: 'Тяжёлые атаки наносят на 35% больше урона.', rarity: 'rare', icon: '⬙' },
  { id: 'echo_blade', name: 'Эхо клинка', description: 'Каждая третья лёгкая атака наносит двойной урон.', rarity: 'epic', icon: 'Ⅲ' },
  { id: 'executioner', name: 'Приговор', description: '+70% урона, когда у босса меньше 30% здоровья.', rarity: 'epic', icon: '⌄' },
  { id: 'perfect_guard', name: 'Идеальный ответ', description: 'Парирование удваивает следующую атаку.', rarity: 'epic', icon: '✦' },
  { id: 'ember_step', name: 'След углей', description: 'Перекат сквозь босса наносит урон.', rarity: 'epic', icon: '♨' },
  { id: 'blood_oath', name: 'Клятва охотника', description: 'Каждое восьмое попадание лечит 1 здоровье.', rarity: 'epic', icon: '8' },
  { id: 'last_stand', name: 'Последний рубеж', description: 'При 1 здоровье урон увеличен на 45%.', rarity: 'rare', icon: 'Ⅰ' },
  { id: 'second_wind', name: 'Отказ угасать', description: 'Раз за стадию смертельный удар оставляет 1 здоровье.', rarity: 'legendary', icon: '☼' },
  { id: 'moonlight', name: 'Лунный разрез', description: 'Тяжёлая атака выпускает дальнюю волну.', rarity: 'legendary', icon: '☾' },
  { id: 'thorns', name: 'Шипы возмездия', description: 'Парирование ранит и дольше оглушает босса.', rarity: 'legendary', icon: '✥' },
  { id: 'greed', name: 'Знак алчности', description: '+50% к валюте за следующие стадии.', rarity: 'rare', icon: '¤' },
];

const rooms = new Map();
let entitySequence = 1;

app.disable('x-powered-by');
app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (_req, res) => res.json({ ok: true, rooms: rooms.size }));

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
function cleanName(value) {
  return String(value || '').replace(/[<>\n\r]/g, '').trim().slice(0, 16) || `Странник-${Math.floor(100 + Math.random() * 900)}`;
}
function cleanClass(value) { return Object.hasOwn(CLASSES, value) ? value : 'swordsman'; }
function cleanSkin(value) { return SKINS.has(value) ? value : 'iron'; }
function perkCount(player, id) { return player.perks[id] || 0; }

function makeRoomCode() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    let code = '';
    for (let index = 0; index < 5; index += 1) code += ROOM_ALPHABET[Math.floor(Math.random() * ROOM_ALPHABET.length)];
    if (!rooms.has(code)) return code;
  }
  return String(Date.now()).slice(-5);
}

function derivedStats(player) {
  const base = CLASSES[player.classId];
  return {
    maxHp: base.maxHp + perkCount(player, 'vitality'),
    maxStamina: base.maxStamina + perkCount(player, 'endurance') * 25,
    staminaRegen: base.staminaRegen * Math.pow(1.28, perkCount(player, 'lungs')),
    speed: base.speed * Math.pow(1.09, perkCount(player, 'quickstep')),
    jump: base.jump,
    lightDamage: base.lightDamage * Math.pow(1.16, perkCount(player, 'sharpened')),
    heavyDamage: base.heavyDamage * Math.pow(1.16, perkCount(player, 'sharpened')) * Math.pow(1.35, perkCount(player, 'heavy_mastery')),
    lightCost: base.lightCost * Math.pow(0.82, perkCount(player, 'light_mastery')),
    heavyCost: base.heavyCost,
    rollCost: base.rollCost * Math.pow(0.75, perkCount(player, 'feather_roll')),
    parryCost: base.parryCost,
    lightTime: base.lightTime * Math.pow(0.86, perkCount(player, 'light_mastery')),
    heavyTime: base.heavyTime,
    attackRange: base.attackRange,
    parryWindow: base.parryWindow + perkCount(player, 'parry_master') * 0.055,
  };
}

function makePlayer(id, name, classId, skin, slot) {
  const base = CLASSES[classId];
  return {
    id, name, classId, skin, slot,
    x: 220 + slot * 76, y: WORLD.floor - 60, w: 42, h: 60, vx: 0, vy: 0, facing: 1,
    hp: base.maxHp, maxHp: base.maxHp, stamina: base.maxStamina, maxStamina: base.maxStamina,
    staminaDelay: 0, downed: false, onGround: false, invulnerable: 0,
    action: 'idle', actionTimer: 0, actionDuration: 0, actionHit: false, parryActive: 0, rollHit: false,
    nextHitMultiplier: 1, lightChain: 0, hitsLanded: 0, secondWindUsed: false, damageDone: 0,
    perks: {}, perkOffer: [], perkChosen: false,
    input: { left: false, right: false, jump: false, light: false, heavy: false, parry: false, roll: false },
    held: { jump: false, light: false, heavy: false, parry: false, roll: false },
  };
}

function publicPlayer(player, hostId, inGame = false) {
  const base = { id: player.id, name: player.name, classId: player.classId, skin: player.skin, slot: player.slot, isHost: player.id === hostId };
  if (!inGame) return base;
  return {
    ...base, x: Math.round(player.x * 10) / 10, y: Math.round(player.y * 10) / 10,
    vx: Math.round(player.vx), vy: Math.round(player.vy), w: player.w, h: player.h, facing: player.facing,
    hp: Math.max(0, Math.round(player.hp)), maxHp: player.maxHp,
    stamina: Math.max(0, Math.round(player.stamina)), maxStamina: Math.round(player.maxStamina),
    downed: player.downed, invulnerable: player.invulnerable > 0,
    action: player.action, actionTimer: player.actionTimer, actionDuration: player.actionDuration,
    parryActive: player.parryActive > 0, damageDone: Math.round(player.damageDone),
    perks: player.perks, perkOffer: player.perkOffer, perkChosen: player.perkChosen,
  };
}

function createRoom(socket, name, classId, skin) {
  const code = makeRoomCode();
  const room = {
    code, hostId: socket.id, status: 'lobby', createdAt: Date.now(), players: new Map(),
    stage: 1, stagesCleared: 0, elapsed: 0, boss: null,
    projectiles: [], waves: [], effects: [], stateSequence: 0, nextStageTimer: null,
  };
  room.players.set(socket.id, makePlayer(socket.id, name, classId, skin, 0));
  rooms.set(code, room);
  return room;
}

function lobbyState(room) {
  return { code: room.code, status: room.status, hostId: room.hostId, maxPlayers: MAX_PLAYERS, players: [...room.players.values()].map((p) => publicPlayer(p, room.hostId)) };
}
function emitLobby(room) { io.to(room.code).emit('lobby-state', lobbyState(room)); }
function socketRoom(socket) { return rooms.get(socket.data.roomCode); }

function leaveCurrentRoom(socket) {
  const room = socketRoom(socket);
  if (!room) return;
  room.players.delete(socket.id);
  socket.leave(room.code);
  socket.data.roomCode = null;
  if (!room.players.size) {
    if (room.nextStageTimer) clearTimeout(room.nextStageTimer);
    rooms.delete(room.code);
    return;
  }
  if (room.hostId === socket.id) room.hostId = room.players.keys().next().value;
  let slot = 0;
  for (const player of room.players.values()) player.slot = slot++;
  if (room.status === 'lobby') emitLobby(room);
  else if (room.status === 'perk') checkPerkSelections(room);
  else checkTeamWipe(room);
}

function addEffect(room, type, x, y, color = '#c8a86b', ttl = 0.35, size = 80) {
  room.effects.push({ id: entitySequence++, type, x, y, color, ttl, maxTtl: ttl, size });
}

function resetPlayerForStage(player) {
  const stats = derivedStats(player);
  Object.assign(player, {
    maxHp: stats.maxHp, maxStamina: stats.maxStamina, hp: stats.maxHp, stamina: stats.maxStamina,
    x: 225 + player.slot * 78, y: WORLD.floor - player.h, vx: 0, vy: 0, facing: 1,
    downed: false, onGround: false, invulnerable: 1, staminaDelay: 0,
    action: 'idle', actionTimer: 0, parryActive: 0,
    secondWindUsed: false, perkOffer: [], perkChosen: false,
    input: { left: false, right: false, jump: false, light: false, heavy: false, parry: false, roll: false },
    held: { jump: false, light: false, heavy: false, parry: false, roll: false },
  });
}

function resetPlayerForRun(player) {
  player.perks = {};
  player.damageDone = 0;
  player.nextHitMultiplier = 1;
  player.lightChain = 0;
  player.hitsLanded = 0;
  resetPlayerForStage(player);
}

function bossHealth(stage, count) {
  const base = 250 + count * 115;
  const step = stage - 1;
  return Math.round(base * (1 + step * 0.082 + Math.pow(step / 12, 1.55) * 0.22));
}

function spawnBoss(room) {
  const maxHp = bossHealth(room.stage, room.players.size);
  room.boss = {
    x: 2250, y: WORLD.floor - 150, w: 122, h: 150, vx: 0,
    hp: maxHp, maxHp, facing: -1, tier: Math.min(10, Math.ceil(room.stage / 10)),
    attackCooldown: Math.max(0.68, 2.05 - room.stage * 0.014), currentAttack: null,
    stagger: 0, flash: 0,
  };
}

function startRun(room) {
  Object.assign(room, { status: 'playing', stage: 1, stagesCleared: 0, elapsed: 0, projectiles: [], waves: [], effects: [] });
  for (const player of room.players.values()) resetPlayerForRun(player);
  spawnBoss(room);
  io.to(room.code).emit('game-start', { world: WORLD, platforms: PLATFORMS, maxStage: MAX_STAGE });
  io.to(room.code).emit('stage-start', { stage: 1 });
}

function startNextStage(room) {
  if (room.status !== 'perk' || !rooms.has(room.code)) return;
  room.status = 'playing';
  room.stage += 1;
  room.projectiles = [];
  room.waves = [];
  room.effects = [];
  for (const player of room.players.values()) resetPlayerForStage(player);
  spawnBoss(room);
  io.to(room.code).emit('stage-start', { stage: room.stage });
}

function alivePlayers(room) { return [...room.players.values()].filter((player) => !player.downed); }
function nearestPlayer(room) {
  if (!room.boss) return null;
  return alivePlayers(room).reduce((best, player) => {
    const distance = Math.abs(player.x - room.boss.x);
    return !best || distance < best.distance ? { player, distance } : best;
  }, null)?.player || null;
}

function onParry(room, player, sourceX, projectile) {
  const boss = room.boss;
  player.parryActive = 0;
  player.action = 'parry_success';
  player.actionTimer = player.actionDuration = 0.36;
  player.stamina = Math.min(player.maxStamina, player.stamina + 28);
  if (perkCount(player, 'perfect_guard')) player.nextHitMultiplier = Math.max(2, player.nextHitMultiplier);
  if (boss) {
    boss.currentAttack = null;
    boss.stagger = Math.max(boss.stagger, 1.25 + perkCount(player, 'thorns') * 0.55);
    if (perkCount(player, 'thorns')) damageBoss(room, player, 28 * perkCount(player, 'thorns'), boss.x + boss.w / 2, boss.y + 70, '#d7b46a', true);
  }
  if (projectile) projectile.ttl = 0;
  addEffect(room, 'parry', sourceX, player.y + 25, '#f0d28d', 0.48, 125);
  io.to(room.code).emit('toast', { text: `${player.name}: ИДЕАЛЬНОЕ ПАРИРОВАНИЕ`, tone: 'gold' });
}

function damagePlayer(room, player, damage = 1, knockX = 0, knockY = -220, parryable = false, sourceX = 0, projectile = null) {
  if (player.downed || player.invulnerable > 0 || room.status !== 'playing') return 'ignored';
  if (parryable && player.parryActive > 0) {
    onParry(room, player, sourceX, projectile);
    return 'parried';
  }
  if (player.hp - damage <= 0 && perkCount(player, 'second_wind') && !player.secondWindUsed) {
    player.secondWindUsed = true;
    player.hp = 1;
    player.invulnerable = 1.1;
    addEffect(room, 'second_wind', player.x + 21, player.y + 30, '#e7c477', 0.75, 150);
    return 'saved';
  }
  player.hp -= damage;
  player.vx += knockX;
  player.vy = Math.min(player.vy, knockY);
  player.invulnerable = 0.72;
  player.action = 'hurt';
  player.actionTimer = player.actionDuration = 0.35;
  addEffect(room, 'hit', player.x + 21, player.y + 30, '#8f2638', 0.35, 65);
  if (player.hp <= 0) {
    player.hp = 0;
    player.downed = true;
    player.vx = player.vy = 0;
    player.action = 'downed';
    io.to(room.code).emit('toast', { text: `${player.name} пал. Победа команды вернёт его.`, tone: 'danger' });
    checkTeamWipe(room);
  }
  return 'hit';
}

function damageBoss(room, player, rawDamage, x, y, color = '#d7b46a', bypass = false) {
  const boss = room.boss;
  if (!boss || boss.hp <= 0 || room.status !== 'playing') return;
  let damage = rawDamage;
  if (!bypass) {
    if (boss.hp / boss.maxHp < 0.3 && perkCount(player, 'executioner')) damage *= 1.7;
    if (player.hp === 1 && perkCount(player, 'last_stand')) damage *= 1.45;
    damage *= player.nextHitMultiplier;
    player.nextHitMultiplier = 1;
  }
  if (boss.stagger > 0) damage *= 1.45;
  damage = Math.max(1, Math.round(damage));
  boss.hp = Math.max(0, boss.hp - damage);
  boss.flash = 0.12;
  player.damageDone += damage;
  player.hitsLanded += 1;
  if (perkCount(player, 'blood_oath') && player.hitsLanded % 8 === 0) {
    player.hp = Math.min(player.maxHp, player.hp + 1);
    addEffect(room, 'heal', player.x + 21, player.y, '#8faa72', 0.45, 70);
  }
  addEffect(room, 'slash', x, y, color, 0.3, 95);
  if (boss.hp === 0) clearStage(room);
}

function attackBoss(room, player, type) {
  const boss = room.boss;
  if (!boss) return;
  const stats = derivedStats(player);
  const range = stats.attackRange + (type === 'heavy' ? 30 : 0);
  const hitbox = { x: player.facing > 0 ? player.x + 36 : player.x - range + 6, y: player.y - 14, w: range, h: player.h + 28 };
  let damage = type === 'heavy' ? stats.heavyDamage : stats.lightDamage;
  if (type === 'light') {
    player.lightChain += 1;
    if (perkCount(player, 'echo_blade') && player.lightChain % 3 === 0) damage *= 2;
  }
  const colors = { iron: '#d7b46a', ember: '#e25f3f', moon: '#9eb7dd', abyss: '#9a70c5' };
  if (overlaps(hitbox, boss)) damageBoss(room, player, damage, boss.x + 61, boss.y + 65, colors[player.skin]);
  else addEffect(room, type === 'heavy' ? 'heavy_slash' : 'slash', hitbox.x + hitbox.w / 2, player.y + 25, '#817562', 0.22, range * 0.65);

  if (room.status === 'playing' && type === 'heavy' && perkCount(player, 'moonlight')) {
    room.projectiles.push({
      id: entitySequence++, kind: 'player_wave', ownerId: player.id,
      x: player.x + 21 + player.facing * 30, y: player.y + 28,
      vx: player.facing * 620, vy: 0, r: 18, damage: Math.round(stats.heavyDamage * 0.55), ttl: 1.6,
    });
  }
}

function startAction(player, action) {
  const stats = derivedStats(player);
  const cost = { light: stats.lightCost, heavy: stats.heavyCost, parry: stats.parryCost, roll: stats.rollCost }[action];
  if (player.stamina < cost || player.action !== 'idle') return false;
  player.stamina -= cost;
  player.staminaDelay = 0.72;
  player.action = action;
  player.actionHit = false;
  player.actionDuration = { light: stats.lightTime, heavy: stats.heavyTime, parry: 0.62, roll: 0.46 }[action];
  player.actionTimer = player.actionDuration;
  if (action === 'parry') player.parryActive = stats.parryWindow;
  if (action === 'roll') {
    player.invulnerable = 0.3;
    player.rollHit = false;
    player.vx = player.facing * 710;
  }
  return true;
}

function updatePlayerAction(room, player) {
  if (player.action === 'idle' || player.action === 'downed') return;
  player.actionTimer -= DT;
  player.parryActive = Math.max(0, player.parryActive - DT);
  if (player.action === 'light' && !player.actionHit && player.actionTimer <= player.actionDuration * 0.56) {
    player.actionHit = true;
    attackBoss(room, player, 'light');
  }
  if (player.action === 'heavy' && !player.actionHit && player.actionTimer <= player.actionDuration * 0.34) {
    player.actionHit = true;
    attackBoss(room, player, 'heavy');
  }
  if (player.action === 'roll') {
    player.vx = player.facing * 710;
    if (!player.rollHit && perkCount(player, 'ember_step') && room.boss && overlaps(player, room.boss)) {
      player.rollHit = true;
      damageBoss(room, player, 24 * perkCount(player, 'ember_step'), room.boss.x + 61, room.boss.y + 75, '#d95d3e', true);
    }
  }
  if (player.actionTimer <= 0) {
    player.action = 'idle';
    player.actionTimer = 0;
    player.parryActive = 0;
  }
}

function updatePlayer(room, player) {
  const stats = derivedStats(player);
  player.maxHp = stats.maxHp;
  player.maxStamina = stats.maxStamina;
  player.invulnerable = Math.max(0, player.invulnerable - DT);
  player.staminaDelay = Math.max(0, player.staminaDelay - DT);
  if (player.downed) return;
  const input = player.input;
  const direction = Number(input.right) - Number(input.left);
  if (direction) player.facing = direction;
  for (const action of ['light', 'heavy', 'parry', 'roll']) {
    if (input[action] && !player.held[action]) startAction(player, action);
    player.held[action] = input[action];
  }
  if (input.jump && !player.held.jump && player.onGround && player.action !== 'roll') {
    player.vy = -stats.jump;
    player.onGround = false;
  }
  player.held.jump = input.jump;
  updatePlayerAction(room, player);

  if (player.action !== 'roll') {
    const factor = player.action === 'idle' || player.action === 'parry' ? 1 : 0.3;
    const targetVx = direction * stats.speed * factor;
    player.vx += (targetVx - player.vx) * Math.min(1, 13 * DT);
  }
  if (player.staminaDelay <= 0 && player.action === 'idle') player.stamina = Math.min(player.maxStamina, player.stamina + stats.staminaRegen * DT);

  const previousBottom = player.y + player.h;
  player.vy += 1880 * DT;
  player.x = clamp(player.x + player.vx * DT, 0, WORLD.width - player.w);
  player.y += player.vy * DT;
  player.onGround = false;
  if (player.vy >= 0) {
    const currentBottom = player.y + player.h;
    for (const platform of PLATFORMS) {
      const inside = player.x + player.w > platform.x + 6 && player.x < platform.x + platform.w - 6;
      if (inside && previousBottom <= platform.y + 8 && currentBottom >= platform.y) {
        player.y = platform.y - player.h;
        player.vy = 0;
        player.onGround = true;
        break;
      }
    }
  }
  if (player.y > WORLD.height + 150) {
    player.x = 225;
    player.y = WORLD.floor - player.h;
    damagePlayer(room, player, 1);
  }
}

function telegraphTime(stage, type) {
  const base = { slash: 0.58, cleave: 0.85, slam: 0.88, volley: 0.72, wave: 0.76, charge: 0.68 }[type];
  return Math.max(0.26, base - Math.min(0.48, stage * 0.0042));
}

function chooseBossAttack(room, target) {
  const distance = Math.abs(target.x - room.boss.x);
  const available = distance < 185 ? ['slash', 'cleave', 'slam'] : ['charge', 'volley', 'slam'];
  if (room.stage >= 4) available.push('wave');
  const type = available[Math.floor(Math.random() * available.length)];
  const duration = telegraphTime(room.stage, type);
  room.boss.currentAttack = { type, phase: 'telegraph', timer: duration, duration, targetId: target.id, targetX: target.x + 21 };
}

function bossMelee(room, radius, parryable) {
  const centerX = room.boss.x + 61;
  for (const player of alivePlayers(room)) {
    const playerCenter = player.x + 21;
    if (Math.abs(playerCenter - centerX) <= radius && Math.abs(player.y - room.boss.y) < 145) {
      damagePlayer(room, player, 1, Math.sign(playerCenter - centerX) * 380, -300, parryable, centerX);
    }
  }
  addEffect(room, parryable ? 'boss_slash' : 'slam', centerX, room.boss.y + 82, parryable ? '#a52d3d' : '#6f2630', 0.42, radius * 1.7);
}

function spawnBossOrb(room, target, offset = 0) {
  const boss = room.boss;
  const x = boss.x + 61;
  const y = boss.y + 42;
  const angle = Math.atan2(target.y + 30 - y, target.x + 21 - x) + offset;
  const speed = 390 + Math.min(300, room.stage * 4.2);
  room.projectiles.push({ id: entitySequence++, kind: 'boss', x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, r: 14 + Math.min(7, Math.floor(room.stage / 25)), damage: 1, ttl: 5 });
}

function executeBossAttack(room, attack) {
  const boss = room.boss;
  const target = room.players.get(attack.targetId) || nearestPlayer(room);
  if (attack.type === 'slash') bossMelee(room, 155, true);
  if (attack.type === 'cleave') bossMelee(room, 245, true);
  if (attack.type === 'slam') {
    const radius = 145 + Math.min(90, room.stage * 0.7);
    for (const player of alivePlayers(room)) {
      const center = player.x + 21;
      if (Math.abs(center - attack.targetX) < radius && player.y + player.h > WORLD.floor - 100) damagePlayer(room, player, 1, Math.sign(center - attack.targetX) * 420, -390);
    }
    addEffect(room, 'ground_slam', attack.targetX, WORLD.floor, '#7c2935', 0.48, radius * 2);
  }
  if (attack.type === 'volley' && target) {
    for (const player of alivePlayers(room)) spawnBossOrb(room, player);
    if (room.stage >= 35) { spawnBossOrb(room, target, -0.18); spawnBossOrb(room, target, 0.18); }
  }
  if (attack.type === 'wave') {
    const count = room.stage >= 70 ? 3 : room.stage >= 25 ? 2 : 1;
    for (let index = 0; index < count; index += 1) room.waves.push({
      id: entitySequence++, x: boss.x + 61, y: WORLD.floor - 6,
      vx: -470 - room.stage * 2.4 - index * 45, w: 72, h: 38 + index * 6, damage: 1, ttl: 5, hit: [],
    });
  }
  if (attack.type === 'charge' && target) {
    const direction = Math.sign(target.x - boss.x) || boss.facing;
    boss.x = clamp(boss.x + direction * (240 + Math.min(220, room.stage * 2)), 70, WORLD.width - boss.w - 70);
    bossMelee(room, 125, true);
  }
}

function updateBoss(room) {
  const boss = room.boss;
  if (!boss || boss.hp <= 0) return;
  boss.flash = Math.max(0, boss.flash - DT);
  if (boss.stagger > 0) { boss.stagger -= DT; boss.vx *= 0.82; return; }
  const target = nearestPlayer(room);
  if (!target) return;
  boss.facing = target.x < boss.x ? -1 : 1;
  if (boss.currentAttack) {
    const attack = boss.currentAttack;
    attack.timer -= DT;
    if (attack.phase === 'telegraph' && attack.timer <= 0) {
      executeBossAttack(room, attack);
      attack.phase = 'recovery';
      attack.timer = attack.duration = Math.max(0.28, 0.7 - room.stage * 0.0035);
    } else if (attack.phase === 'recovery' && attack.timer <= 0) {
      boss.currentAttack = null;
      boss.attackCooldown = Math.max(0.55, 1.5 - room.stage * 0.008);
    }
    return;
  }
  boss.attackCooldown -= DT;
  const distance = target.x - boss.x;
  if (Math.abs(distance) > 150) {
    boss.vx = Math.sign(distance) * (75 + Math.min(155, room.stage * 1.65));
    boss.x = clamp(boss.x + boss.vx * DT, 70, WORLD.width - boss.w - 70);
  } else boss.vx *= 0.75;
  if (boss.attackCooldown <= 0) chooseBossAttack(room, target);
}

function circleHitsRect(circle, rect) {
  const x = clamp(circle.x, rect.x, rect.x + rect.w);
  const y = clamp(circle.y, rect.y, rect.y + rect.h);
  return (circle.x - x) ** 2 + (circle.y - y) ** 2 < circle.r ** 2;
}

function updateProjectiles(room) {
  for (const projectile of room.projectiles) {
    projectile.x += projectile.vx * DT;
    projectile.y += projectile.vy * DT;
    projectile.ttl -= DT;
    if (projectile.kind === 'boss') {
      for (const player of alivePlayers(room)) {
        if (circleHitsRect(projectile, player)) {
          if (damagePlayer(room, player, 1, Math.sign(projectile.vx) * 260, -240, true, projectile.x, projectile) !== 'ignored') projectile.ttl = 0;
          break;
        }
      }
    } else if (room.boss && circleHitsRect(projectile, room.boss)) {
      const owner = room.players.get(projectile.ownerId);
      if (owner) damageBoss(room, owner, projectile.damage, projectile.x, projectile.y, '#9eb7dd');
      projectile.ttl = 0;
    }
    if (projectile.x < -100 || projectile.x > WORLD.width + 100 || projectile.y < -130 || projectile.y > WORLD.height + 130) projectile.ttl = 0;
  }
  room.projectiles = room.projectiles.filter((projectile) => projectile.ttl > 0);
}

function updateWaves(room) {
  for (const wave of room.waves) {
    wave.x += wave.vx * DT;
    wave.ttl -= DT;
    const box = { x: wave.x - wave.w / 2, y: wave.y - wave.h, w: wave.w, h: wave.h };
    for (const player of alivePlayers(room)) {
      if (!wave.hit.includes(player.id) && overlaps(box, player)) {
        wave.hit.push(player.id);
        damagePlayer(room, player, 1, Math.sign(wave.vx) * 390, -330);
      }
    }
  }
  room.waves = room.waves.filter((wave) => wave.ttl > 0 && wave.x > -150 && wave.x < WORLD.width + 150);
}

function updateEffects(room) {
  for (const effect of room.effects) effect.ttl -= DT;
  room.effects = room.effects.filter((effect) => effect.ttl > 0);
}

function randomPerkOffer(player) {
  const weights = { common: 48, rare: 31, epic: 16, legendary: 5 };
  const candidates = [...PERKS];
  const selected = [];
  while (selected.length < 3) {
    const weighted = candidates.map((perk) => ({ perk, weight: weights[perk.rarity] / (1 + perkCount(player, perk.id) * 0.7) }));
    const total = weighted.reduce((sum, item) => sum + item.weight, 0);
    let roll = Math.random() * total;
    let chosen = weighted[0].perk;
    for (const item of weighted) { roll -= item.weight; if (roll <= 0) { chosen = item.perk; break; } }
    selected.push(chosen);
    candidates.splice(candidates.findIndex((perk) => perk.id === chosen.id), 1);
  }
  return selected;
}

function applyPerk(player, id) {
  player.perks[id] = (player.perks[id] || 0) + 1;
  const stats = derivedStats(player);
  player.maxHp = stats.maxHp;
  player.maxStamina = stats.maxStamina;
  player.hp = stats.maxHp;
  player.stamina = stats.maxStamina;
}

function clearStage(room) {
  if (room.status !== 'playing') return;
  room.stagesCleared = room.stage;
  if (room.stage >= MAX_STAGE) return finishRun(room, 'victory');
  room.status = 'perk';
  room.projectiles = [];
  room.waves = [];
  room.boss = null;
  for (const player of room.players.values()) {
    player.perkOffer = randomPerkOffer(player);
    player.perkChosen = false;
    player.downed = false;
    player.action = 'idle';
    const reward = Math.round((7 + room.stage * 1.45) * (1 + perkCount(player, 'greed') * 0.5));
    io.to(player.id).emit('currency-earned', { amount: reward, stage: room.stage });
  }
  io.to(room.code).emit('stage-cleared', { stage: room.stage });
  io.to(room.code).emit('state', snapshot(room));
}

function checkPerkSelections(room) {
  if (room.status !== 'perk' || !room.players.size) return;
  if ([...room.players.values()].every((player) => player.perkChosen)) {
    if (room.nextStageTimer) clearTimeout(room.nextStageTimer);
    room.nextStageTimer = setTimeout(() => { room.nextStageTimer = null; startNextStage(room); }, 900);
  }
}

function checkTeamWipe(room) {
  if (room.status === 'playing' && room.players.size && [...room.players.values()].every((player) => player.downed)) finishRun(room, 'defeat');
}

function finishRun(room, result) {
  if (!['playing', 'perk'].includes(room.status)) return;
  room.status = result;
  room.projectiles = [];
  room.waves = [];
  io.to(room.code).emit('game-over', {
    result, stageReached: room.stage, stagesCleared: room.stagesCleared, elapsed: room.elapsed,
    players: [...room.players.values()].map((player) => ({
      name: player.name, classId: player.classId, damageDone: Math.round(player.damageDone),
      perkCount: Object.values(player.perks).reduce((sum, count) => sum + count, 0),
    })).sort((a, b) => b.damageDone - a.damageDone),
  });
}

function snapshot(room) {
  const boss = room.boss;
  return {
    sequence: ++room.stateSequence, status: room.status, stage: room.stage, maxStage: MAX_STAGE,
    stagesCleared: room.stagesCleared, elapsed: Math.round(room.elapsed * 10) / 10,
    players: [...room.players.values()].map((player) => publicPlayer(player, room.hostId, true)),
    boss: boss ? {
      x: Math.round(boss.x * 10) / 10, y: boss.y, w: boss.w, h: boss.h,
      hp: Math.round(boss.hp), maxHp: boss.maxHp, facing: boss.facing, tier: boss.tier,
      flash: boss.flash > 0, stagger: boss.stagger > 0, currentAttack: boss.currentAttack,
    } : null,
    projectiles: room.projectiles, waves: room.waves, effects: room.effects,
  };
}

function tickRoom(room) {
  if (room.status !== 'playing') return;
  room.elapsed += DT;
  for (const player of room.players.values()) updatePlayer(room, player);
  updateBoss(room);
  updateProjectiles(room);
  updateWaves(room);
  updateEffects(room);
  io.to(room.code).emit('state', snapshot(room));
}

io.on('connection', (socket) => {
  socket.data.roomCode = null;
  socket.on('create-room', (payload, reply = () => {}) => {
    leaveCurrentRoom(socket);
    const room = createRoom(socket, cleanName(payload?.name), cleanClass(payload?.classId), cleanSkin(payload?.skin));
    socket.data.roomCode = room.code;
    socket.join(room.code);
    reply({ ok: true, room: lobbyState(room), playerId: socket.id });
    emitLobby(room);
  });
  socket.on('join-room', (payload, reply = () => {}) => {
    const code = String(payload?.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
    const room = rooms.get(code);
    if (!room) return reply({ ok: false, error: 'Комната с таким кодом не найдена' });
    if (room.status !== 'lobby') return reply({ ok: false, error: 'Забег уже начался' });
    if (room.players.size >= MAX_PLAYERS) return reply({ ok: false, error: 'В комнате уже 4 игрока' });
    leaveCurrentRoom(socket);
    room.players.set(socket.id, makePlayer(socket.id, cleanName(payload?.name), cleanClass(payload?.classId), cleanSkin(payload?.skin), room.players.size));
    socket.data.roomCode = room.code;
    socket.join(room.code);
    reply({ ok: true, room: lobbyState(room), playerId: socket.id });
    emitLobby(room);
  });
  socket.on('select-class', (payload) => {
    const room = socketRoom(socket);
    const player = room?.players.get(socket.id);
    if (!room || room.status !== 'lobby' || !player) return;
    player.classId = cleanClass(payload?.classId);
    player.skin = cleanSkin(payload?.skin);
    emitLobby(room);
  });
  socket.on('start-game', (reply = () => {}) => {
    const room = socketRoom(socket);
    if (!room) return reply({ ok: false, error: 'Комната не найдена' });
    if (room.hostId !== socket.id) return reply({ ok: false, error: 'Начать забег может только создатель' });
    if (room.status !== 'lobby') return reply({ ok: false, error: 'Забег уже начался' });
    startRun(room);
    return reply({ ok: true });
  });
  socket.on('input', (value) => {
    const room = socketRoom(socket);
    const player = room?.players.get(socket.id);
    if (!room || room.status !== 'playing' || !player || !value) return;
    player.input = Object.fromEntries(['left', 'right', 'jump', 'light', 'heavy', 'parry', 'roll'].map((key) => [key, value[key] === true]));
  });
  socket.on('choose-perk', (id, reply = () => {}) => {
    const room = socketRoom(socket);
    const player = room?.players.get(socket.id);
    if (!room || room.status !== 'perk' || !player || player.perkChosen) return reply({ ok: false, error: 'Выбор закрыт' });
    if (!player.perkOffer.some((perk) => perk.id === id)) return reply({ ok: false, error: 'Такой карты нет' });
    applyPerk(player, id);
    player.perkChosen = true;
    io.to(room.code).emit('state', snapshot(room));
    checkPerkSelections(room);
    return reply({ ok: true });
  });
  if (process.env.NODE_ENV === 'test') {
    socket.on('debug-clear-stage', () => {
      const room = socketRoom(socket);
      if (room?.status === 'playing' && room.boss) {
        room.boss.hp = 0;
        clearStage(room);
      }
    });
    socket.on('debug-down-player', (playerId) => {
      const room = socketRoom(socket);
      const player = room?.players.get(playerId);
      if (room?.status === 'playing' && player) {
        player.hp = 0;
        player.downed = true;
        player.action = 'downed';
        checkTeamWipe(room);
      }
    });
  }
  socket.on('return-lobby', (reply = () => {}) => {
    const room = socketRoom(socket);
    if (!room) return reply({ ok: false, error: 'Комната закрыта' });
    if (room.hostId !== socket.id) return reply({ ok: false, error: 'Только создатель может запустить новый забег' });
    Object.assign(room, { status: 'lobby', boss: null, projectiles: [], waves: [], effects: [] });
    emitLobby(room);
    return reply({ ok: true });
  });
  socket.on('leave-room', () => leaveCurrentRoom(socket));
  socket.on('disconnect', () => leaveCurrentRoom(socket));
});

setInterval(() => { for (const room of rooms.values()) tickRoom(room); }, 1000 / TICK_RATE);
server.listen(PORT, '0.0.0.0', () => console.log(`RIFT//RAID: ASHEN HUNDRED is running at http://localhost:${PORT}`));
