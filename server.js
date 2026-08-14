'use strict';

const path = require('node:path');
const http = require('node:http');
const express = require('express');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: true, methods: ['GET', 'POST'] },
  transports: ['websocket', 'polling'],
});

const PORT = Number(process.env.PORT) || 3000;
const TICK_RATE = 30;
const DT = 1 / TICK_RATE;
const WORLD = { width: 3200, height: 720, floor: 640 };
const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_PLAYERS = 4;

const PLATFORMS = [
  { x: 0, y: 640, w: 3200, h: 80 },
  { x: 320, y: 520, w: 260, h: 22 },
  { x: 720, y: 430, w: 260, h: 22 },
  { x: 1120, y: 550, w: 320, h: 22 },
  { x: 1570, y: 455, w: 300, h: 22 },
  { x: 2020, y: 535, w: 300, h: 22 },
  { x: 2490, y: 430, w: 260, h: 22 },
];

const HEROES = {
  blade: {
    label: 'Клинок', maxHp: 110, speed: 390, jump: 720,
    attackDamage: 18, attackRange: 122, attackCooldown: 0.34,
    abilityDamage: 62, abilityCooldown: 8,
  },
  spark: {
    label: 'Искра', maxHp: 85, speed: 430, jump: 750,
    attackDamage: 12, attackRange: 520, attackCooldown: 0.46,
    abilityDamage: 18, abilityCooldown: 9,
  },
  bastion: {
    label: 'Бастион', maxHp: 155, speed: 325, jump: 650,
    attackDamage: 24, attackRange: 105, attackCooldown: 0.55,
    abilityDamage: 42, abilityCooldown: 11,
  },
};

const rooms = new Map();
let entitySequence = 1;

app.disable('x-powered-by');
app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (_req, res) => res.json({ ok: true, rooms: rooms.size }));

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function cleanName(value) {
  const name = String(value || '').replace(/[<>\n\r]/g, '').trim().slice(0, 16);
  return name || `Рейдер-${Math.floor(100 + Math.random() * 900)}`;
}

function cleanHero(value) {
  return Object.hasOwn(HEROES, value) ? value : 'blade';
}

function makeRoomCode() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    let code = '';
    for (let i = 0; i < 5; i += 1) {
      code += ROOM_ALPHABET[Math.floor(Math.random() * ROOM_ALPHABET.length)];
    }
    if (!rooms.has(code)) return code;
  }
  return String(Date.now()).slice(-5);
}

function makePlayer(socketId, name, hero, slot) {
  const stats = HEROES[hero];
  return {
    id: socketId,
    name,
    hero,
    slot,
    x: 210 + slot * 85,
    y: WORLD.floor - 58,
    w: 42,
    h: 58,
    vx: 0,
    vy: 0,
    facing: 1,
    hp: stats.maxHp,
    maxHp: stats.maxHp,
    respawns: 3,
    downed: false,
    reviveTimer: 0,
    invulnerable: 0,
    attackCooldown: 0,
    abilityCooldown: 0,
    dashCooldown: 0,
    dashTimer: 0,
    onGround: false,
    input: { left: false, right: false, jump: false, attack: false, dash: false, ability: false },
    jumpHeld: false,
    dashHeld: false,
    abilityHeld: false,
    damageDone: 0,
  };
}

function publicPlayer(player, hostId, inGame = false) {
  const base = {
    id: player.id,
    name: player.name,
    hero: player.hero,
    slot: player.slot,
    isHost: player.id === hostId,
  };
  if (!inGame) return base;
  return {
    ...base,
    x: Math.round(player.x * 10) / 10,
    y: Math.round(player.y * 10) / 10,
    vx: Math.round(player.vx),
    vy: Math.round(player.vy),
    w: player.w,
    h: player.h,
    facing: player.facing,
    hp: Math.max(0, Math.round(player.hp)),
    maxHp: player.maxHp,
    respawns: player.respawns,
    downed: player.downed,
    invulnerable: player.invulnerable > 0,
    attackCooldown: player.attackCooldown,
    abilityCooldown: player.abilityCooldown,
    dashCooldown: player.dashCooldown,
    dashTimer: player.dashTimer,
    damageDone: Math.round(player.damageDone),
  };
}

function makeRoom(hostSocket, name, hero) {
  const code = makeRoomCode();
  const room = {
    code,
    hostId: hostSocket.id,
    status: 'lobby',
    createdAt: Date.now(),
    players: new Map(),
    boss: null,
    projectiles: [],
    waves: [],
    effects: [],
    elapsed: 0,
    resultTimer: 0,
    stateSequence: 0,
  };
  room.players.set(hostSocket.id, makePlayer(hostSocket.id, name, hero, 0));
  rooms.set(code, room);
  return room;
}

function roomLobbyState(room) {
  return {
    code: room.code,
    status: room.status,
    hostId: room.hostId,
    players: [...room.players.values()].map((player) => publicPlayer(player, room.hostId)),
    maxPlayers: MAX_PLAYERS,
  };
}

function emitLobby(room) {
  io.to(room.code).emit('lobby-state', roomLobbyState(room));
}

function socketRoom(socket) {
  const code = socket.data.roomCode;
  return code ? rooms.get(code) : null;
}

function leaveCurrentRoom(socket) {
  const room = socketRoom(socket);
  if (!room) return;

  room.players.delete(socket.id);
  socket.leave(room.code);
  socket.data.roomCode = null;

  if (room.players.size === 0) {
    rooms.delete(room.code);
    return;
  }

  if (room.hostId === socket.id) {
    room.hostId = room.players.keys().next().value;
  }

  let slot = 0;
  for (const player of room.players.values()) {
    player.slot = slot;
    slot += 1;
  }

  if (room.status === 'lobby') emitLobby(room);
  else io.to(room.code).emit('toast', { text: 'Игрок покинул рейд', tone: 'warn' });
}

function resetPlayerForGame(player) {
  const stats = HEROES[player.hero];
  player.x = 220 + player.slot * 82;
  player.y = WORLD.floor - player.h;
  player.vx = 0;
  player.vy = 0;
  player.hp = stats.maxHp;
  player.maxHp = stats.maxHp;
  player.respawns = 3;
  player.downed = false;
  player.reviveTimer = 0;
  player.invulnerable = 1.4;
  player.attackCooldown = 0;
  player.abilityCooldown = 0;
  player.dashCooldown = 0;
  player.dashTimer = 0;
  player.damageDone = 0;
}

function startRoom(room) {
  room.status = 'playing';
  room.elapsed = 0;
  room.resultTimer = 0;
  room.projectiles = [];
  room.waves = [];
  room.effects = [];
  room.boss = {
    x: 2630,
    y: WORLD.floor - 142,
    w: 116,
    h: 142,
    vx: 0,
    hp: 1800 + Math.max(0, room.players.size - 2) * 500,
    maxHp: 1800 + Math.max(0, room.players.size - 2) * 500,
    phase: 1,
    facing: -1,
    attack: 'idle',
    attackTimer: 1.5,
    moveTimer: 0,
    flash: 0,
  };
  for (const player of room.players.values()) resetPlayerForGame(player);
  io.to(room.code).emit('game-start', { world: WORLD, platforms: PLATFORMS });
}

function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function circleHitsRect(projectile, rect) {
  const closestX = clamp(projectile.x, rect.x, rect.x + rect.w);
  const closestY = clamp(projectile.y, rect.y, rect.y + rect.h);
  const dx = projectile.x - closestX;
  const dy = projectile.y - closestY;
  return dx * dx + dy * dy < projectile.r * projectile.r;
}

function addEffect(room, type, x, y, color = '#ffffff', ttl = 0.35, size = 80) {
  room.effects.push({ id: entitySequence++, type, x, y, color, ttl, maxTtl: ttl, size });
}

function damagePlayer(room, player, damage, knockX = 0, knockY = -240) {
  if (player.downed || player.invulnerable > 0 || room.status !== 'playing') return;
  if (player.hero === 'bastion' && player.abilityCooldown > HEROES.bastion.abilityCooldown - 1.4) {
    damage *= 0.35;
  }
  player.hp -= damage;
  player.vx += knockX;
  player.vy = Math.min(player.vy, knockY);
  player.invulnerable = 0.55;
  addEffect(room, 'hit', player.x + player.w / 2, player.y + player.h / 2, '#ff5470', 0.32, 62);
  if (player.hp <= 0) {
    player.hp = 0;
    player.downed = true;
    player.reviveTimer = 3.5;
    player.vx = 0;
    player.vy = 0;
    io.to(room.code).emit('toast', { text: `${player.name} выведен из строя`, tone: 'danger' });
  }
}

function damageBoss(room, player, damage, x, y, color) {
  const boss = room.boss;
  if (!boss || boss.hp <= 0 || room.status !== 'playing') return;
  boss.hp = Math.max(0, boss.hp - damage);
  boss.flash = 0.12;
  player.damageDone += damage;
  addEffect(room, 'slash', x, y, color, 0.28, 95);
  if (boss.hp === 0) finishRoom(room, 'victory');
}

function finishRoom(room, status) {
  if (room.status !== 'playing') return;
  room.status = status;
  room.resultTimer = 0;
  room.projectiles = [];
  room.waves = [];
  io.to(room.code).emit('game-over', {
    result: status,
    elapsed: room.elapsed,
    players: [...room.players.values()]
      .map((player) => ({ name: player.name, hero: player.hero, damageDone: Math.round(player.damageDone) }))
      .sort((a, b) => b.damageDone - a.damageDone),
  });
}

function updatePlayer(room, player) {
  const stats = HEROES[player.hero];
  player.attackCooldown = Math.max(0, player.attackCooldown - DT);
  player.abilityCooldown = Math.max(0, player.abilityCooldown - DT);
  player.dashCooldown = Math.max(0, player.dashCooldown - DT);
  player.invulnerable = Math.max(0, player.invulnerable - DT);

  if (player.downed) {
    player.reviveTimer -= DT;
    if (player.reviveTimer <= 0 && player.respawns > 0) {
      player.respawns -= 1;
      player.downed = false;
      player.hp = player.maxHp;
      player.x = 250 + player.slot * 70;
      player.y = WORLD.floor - player.h;
      player.invulnerable = 2;
      addEffect(room, 'spawn', player.x + player.w / 2, player.y + player.h / 2, '#64fdf4', 0.65, 130);
    }
    return;
  }

  const input = player.input;
  const direction = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  if (direction !== 0) player.facing = direction;

  if (input.dash && !player.dashHeld && player.dashCooldown <= 0) {
    player.dashTimer = 0.17;
    player.dashCooldown = 1.4;
    player.invulnerable = Math.max(player.invulnerable, 0.22);
    player.vx = player.facing * 900;
    addEffect(room, 'dash', player.x + player.w / 2, player.y + player.h / 2, '#a78bfa', 0.22, 86);
  }
  player.dashHeld = input.dash;

  if (player.dashTimer > 0) {
    player.dashTimer -= DT;
    player.vx = player.facing * 900;
  } else {
    const targetVx = direction * stats.speed;
    player.vx += (targetVx - player.vx) * Math.min(1, 14 * DT);
  }

  if (input.jump && !player.jumpHeld && player.onGround) {
    player.vy = -stats.jump;
    player.onGround = false;
  }
  player.jumpHeld = input.jump;

  if (input.attack && player.attackCooldown <= 0) {
    player.attackCooldown = stats.attackCooldown;
    if (player.hero === 'spark') {
      room.projectiles.push({
        id: entitySequence++, ownerId: player.id, kind: 'player',
        x: player.x + player.w / 2 + player.facing * 28,
        y: player.y + player.h * 0.43,
        vx: player.facing * 820, vy: 0, r: 9, damage: stats.attackDamage, ttl: 0.9,
      });
    } else {
      const hitbox = {
        x: player.facing > 0 ? player.x + player.w - 4 : player.x - stats.attackRange + 4,
        y: player.y - 12,
        w: stats.attackRange,
        h: player.h + 24,
      };
      if (overlaps(hitbox, room.boss)) {
        damageBoss(room, player, stats.attackDamage, room.boss.x + room.boss.w / 2, room.boss.y + 65,
          player.hero === 'blade' ? '#73f7ff' : '#ffc857');
      } else {
        addEffect(room, 'slash', hitbox.x + hitbox.w / 2, player.y + player.h / 2, '#7c8ca5', 0.18, 60);
      }
    }
  }

  if (input.ability && !player.abilityHeld && player.abilityCooldown <= 0) {
    player.abilityCooldown = stats.abilityCooldown;
    if (player.hero === 'spark') {
      for (const angle of [-0.22, 0, 0.22]) {
        room.projectiles.push({
          id: entitySequence++, ownerId: player.id, kind: 'player',
          x: player.x + player.w / 2, y: player.y + player.h * 0.4,
          vx: player.facing * 760, vy: angle * 760, r: 14,
          damage: stats.abilityDamage, ttl: 1.25,
        });
      }
      addEffect(room, 'burst', player.x + player.w / 2, player.y + 24, '#ff62d4', 0.45, 120);
    } else if (player.hero === 'blade') {
      const dx = room.boss.x + room.boss.w / 2 - (player.x + player.w / 2);
      const dy = room.boss.y + room.boss.h / 2 - (player.y + player.h / 2);
      if (Math.abs(dx) < 270 && Math.abs(dy) < 150) {
        damageBoss(room, player, stats.abilityDamage, room.boss.x + room.boss.w / 2, room.boss.y + 60, '#d8b4fe');
      }
      addEffect(room, 'burst', player.x + player.w / 2, player.y + player.h / 2, '#a78bfa', 0.48, 270);
    } else {
      player.invulnerable = Math.max(player.invulnerable, 1.4);
      const dx = room.boss.x + room.boss.w / 2 - (player.x + player.w / 2);
      const dy = room.boss.y + room.boss.h / 2 - (player.y + player.h / 2);
      if (Math.abs(dx) < 170 && Math.abs(dy) < 150) {
        damageBoss(room, player, stats.abilityDamage, room.boss.x + room.boss.w / 2, room.boss.y + 70, '#ffc857');
      }
      addEffect(room, 'shield', player.x + player.w / 2, player.y + player.h / 2, '#ffc857', 1.4, 92);
    }
  }
  player.abilityHeld = input.ability;

  const previousBottom = player.y + player.h;
  player.vy += 1900 * DT;
  player.x += player.vx * DT;
  player.y += player.vy * DT;
  player.x = clamp(player.x, 0, WORLD.width - player.w);
  player.onGround = false;

  if (player.vy >= 0) {
    const currentBottom = player.y + player.h;
    for (const platform of PLATFORMS) {
      const horizontallyInside = player.x + player.w > platform.x + 6 && player.x < platform.x + platform.w - 6;
      if (horizontallyInside && previousBottom <= platform.y + 8 && currentBottom >= platform.y) {
        player.y = platform.y - player.h;
        player.vy = 0;
        player.onGround = true;
        break;
      }
    }
  }

  if (player.y > WORLD.height + 180) {
    player.y = WORLD.floor - player.h;
    player.x = 220;
    damagePlayer(room, player, 28, 0, -200);
  }
}

function alivePlayers(room) {
  return [...room.players.values()].filter((player) => !player.downed);
}

function selectTarget(room) {
  const candidates = alivePlayers(room);
  if (!candidates.length) return null;
  return candidates.reduce((best, player) => {
    const distance = Math.abs(player.x - room.boss.x);
    return !best || distance < best.distance ? { player, distance } : best;
  }, null).player;
}

function spawnBossOrb(room, target, speed = 430) {
  const boss = room.boss;
  const startX = boss.x + boss.w / 2;
  const startY = boss.y + 42;
  const targetX = target.x + target.w / 2;
  const targetY = target.y + target.h / 2;
  const distance = Math.max(1, Math.hypot(targetX - startX, targetY - startY));
  room.projectiles.push({
    id: entitySequence++, kind: 'boss', x: startX, y: startY,
    vx: ((targetX - startX) / distance) * speed,
    vy: ((targetY - startY) / distance) * speed,
    r: boss.phase >= 3 ? 18 : 15,
    damage: boss.phase >= 3 ? 20 : 16,
    ttl: 5,
  });
}

function beginBossAttack(room) {
  const boss = room.boss;
  const roll = Math.random();
  if (roll < 0.44) {
    boss.attack = 'orb';
    boss.attackTimer = boss.phase >= 2 ? 0.85 : 1.05;
    const target = selectTarget(room);
    if (target) {
      spawnBossOrb(room, target, 430 + boss.phase * 45);
      if (boss.phase >= 2) setTimeout(() => {
        if (rooms.get(room.code) === room && room.status === 'playing') spawnBossOrb(room, target, 475);
      }, 230);
    }
  } else if (roll < 0.77) {
    boss.attack = 'wave';
    boss.attackTimer = 1.2;
    room.waves.push({
      id: entitySequence++, x: boss.x + boss.w / 2, y: WORLD.floor - 20,
      vx: -500 - boss.phase * 70, w: 76, h: 38,
      damage: 20 + boss.phase * 2, ttl: 5, hit: [],
    });
    if (boss.phase >= 3) {
      room.waves.push({
        id: entitySequence++, x: boss.x + boss.w / 2, y: WORLD.floor - 20,
        vx: 500 + boss.phase * 70, w: 76, h: 38,
        damage: 22, ttl: 5, hit: [],
      });
    }
  } else {
    boss.attack = 'slam';
    boss.attackTimer = 1.05;
    const target = selectTarget(room);
    if (target) {
      const markerX = clamp(target.x + target.w / 2, 90, WORLD.width - 90);
      room.effects.push({
        id: entitySequence++, type: 'warning', x: markerX, y: WORLD.floor,
        color: '#ff355e', ttl: 0.72, maxTtl: 0.72, size: boss.phase >= 3 ? 290 : 230,
        damageAt: 0.08, triggered: false,
      });
    }
  }
}

function updateBoss(room) {
  const boss = room.boss;
  if (!boss || boss.hp <= 0) return;
  boss.flash = Math.max(0, boss.flash - DT);
  const healthRatio = boss.hp / boss.maxHp;
  boss.phase = healthRatio > 0.66 ? 1 : healthRatio > 0.32 ? 2 : 3;

  const target = selectTarget(room);
  if (!target) return;
  boss.facing = target.x < boss.x ? -1 : 1;
  const distance = target.x - boss.x;

  boss.moveTimer -= DT;
  if (boss.moveTimer <= 0) {
    const preferred = 250 + boss.phase * 20;
    boss.vx = Math.abs(distance) > preferred ? Math.sign(distance) * (78 + boss.phase * 20) : 0;
    boss.moveTimer = 0.2;
  }
  boss.x = clamp(boss.x + boss.vx * DT, 90, WORLD.width - boss.w - 90);

  for (const player of alivePlayers(room)) {
    if (overlaps({ x: boss.x + 18, y: boss.y + 28, w: boss.w - 36, h: boss.h - 28 }, player)) {
      damagePlayer(room, player, 12 + boss.phase * 2, Math.sign(player.x - boss.x) * 360, -300);
    }
  }

  boss.attackTimer -= DT;
  if (boss.attackTimer <= 0) {
    beginBossAttack(room);
    boss.attackTimer += Math.max(0.65, 1.75 - boss.phase * 0.2);
  }
}

function updateProjectiles(room) {
  for (const projectile of room.projectiles) {
    projectile.x += projectile.vx * DT;
    projectile.y += projectile.vy * DT;
    projectile.ttl -= DT;

    if (projectile.kind === 'boss') {
      for (const player of alivePlayers(room)) {
        if (circleHitsRect(projectile, player)) {
          damagePlayer(room, player, projectile.damage, Math.sign(projectile.vx) * 240, -230);
          projectile.ttl = 0;
          addEffect(room, 'burst', projectile.x, projectile.y, '#ff355e', 0.32, 70);
          break;
        }
      }
    } else if (circleHitsRect(projectile, room.boss)) {
      const owner = room.players.get(projectile.ownerId);
      if (owner) damageBoss(room, owner, projectile.damage, projectile.x, projectile.y, '#ff62d4');
      projectile.ttl = 0;
    }

    if (projectile.x < -100 || projectile.x > WORLD.width + 100 || projectile.y < -150 || projectile.y > WORLD.height + 150) {
      projectile.ttl = 0;
    }
  }
  room.projectiles = room.projectiles.filter((projectile) => projectile.ttl > 0);
}

function updateWaves(room) {
  for (const wave of room.waves) {
    wave.x += wave.vx * DT;
    wave.ttl -= DT;
    const hitbox = { x: wave.x - wave.w / 2, y: wave.y - wave.h, w: wave.w, h: wave.h };
    for (const player of alivePlayers(room)) {
      if (!wave.hit.includes(player.id) && overlaps(hitbox, player)) {
        wave.hit.push(player.id);
        damagePlayer(room, player, wave.damage, Math.sign(wave.vx) * 430, -320);
      }
    }
  }
  room.waves = room.waves.filter((wave) => wave.ttl > 0 && wave.x > -150 && wave.x < WORLD.width + 150);
}

function updateEffects(room) {
  for (const effect of room.effects) {
    effect.ttl -= DT;
    if (effect.type === 'warning' && !effect.triggered && effect.ttl <= effect.damageAt) {
      effect.triggered = true;
      effect.type = 'slam';
      effect.ttl = 0.38;
      effect.maxTtl = 0.38;
      const radius = effect.size / 2;
      for (const player of alivePlayers(room)) {
        const center = player.x + player.w / 2;
        if (Math.abs(center - effect.x) < radius && player.y + player.h > WORLD.floor - 95) {
          damagePlayer(room, player, 28 + room.boss.phase * 3, Math.sign(center - effect.x) * 460, -420);
        }
      }
    }
  }
  room.effects = room.effects.filter((effect) => effect.ttl > 0);
}

function snapshot(room) {
  const boss = room.boss;
  return {
    sequence: ++room.stateSequence,
    status: room.status,
    elapsed: Math.round(room.elapsed * 10) / 10,
    players: [...room.players.values()].map((player) => publicPlayer(player, room.hostId, true)),
    boss: boss ? {
      x: Math.round(boss.x * 10) / 10,
      y: boss.y,
      w: boss.w,
      h: boss.h,
      hp: Math.round(boss.hp),
      maxHp: boss.maxHp,
      phase: boss.phase,
      facing: boss.facing,
      attack: boss.attack,
      flash: boss.flash > 0,
    } : null,
    projectiles: room.projectiles,
    waves: room.waves,
    effects: room.effects,
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

  const stillFighting = [...room.players.values()].some((player) => !player.downed || player.respawns > 0);
  if (!stillFighting) finishRoom(room, 'defeat');
  io.to(room.code).emit('state', snapshot(room));
}

io.on('connection', (socket) => {
  socket.data.roomCode = null;

  socket.on('create-room', (payload, reply = () => {}) => {
    leaveCurrentRoom(socket);
    const hero = cleanHero(payload?.hero);
    const room = makeRoom(socket, cleanName(payload?.name), hero);
    socket.data.roomCode = room.code;
    socket.join(room.code);
    reply({ ok: true, room: roomLobbyState(room), playerId: socket.id });
    emitLobby(room);
  });

  socket.on('join-room', (payload, reply = () => {}) => {
    const code = String(payload?.code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
    const room = rooms.get(code);
    if (!room) return reply({ ok: false, error: 'Комната с таким кодом не найдена' });
    if (room.status !== 'lobby') return reply({ ok: false, error: 'Битва в этой комнате уже началась' });
    if (room.players.size >= MAX_PLAYERS) return reply({ ok: false, error: 'В комнате уже 4 игрока' });

    leaveCurrentRoom(socket);
    const hero = cleanHero(payload?.hero);
    room.players.set(socket.id, makePlayer(socket.id, cleanName(payload?.name), hero, room.players.size));
    socket.data.roomCode = room.code;
    socket.join(room.code);
    reply({ ok: true, room: roomLobbyState(room), playerId: socket.id });
    emitLobby(room);
  });

  socket.on('select-hero', (heroValue) => {
    const room = socketRoom(socket);
    if (!room || room.status !== 'lobby') return;
    const player = room.players.get(socket.id);
    if (!player) return;
    player.hero = cleanHero(heroValue);
    emitLobby(room);
  });

  socket.on('start-game', (reply = () => {}) => {
    const room = socketRoom(socket);
    if (!room) return reply({ ok: false, error: 'Комната не найдена' });
    if (room.hostId !== socket.id) return reply({ ok: false, error: 'Начать бой может только создатель комнаты' });
    if (room.players.size < 2) return reply({ ok: false, error: 'Для рейда нужно минимум 2 игрока' });
    if (room.status !== 'lobby') return reply({ ok: false, error: 'Бой уже начался' });
    startRoom(room);
    return reply({ ok: true });
  });

  socket.on('input', (input) => {
    const room = socketRoom(socket);
    const player = room?.players.get(socket.id);
    if (!room || room.status !== 'playing' || !player || !input) return;
    player.input = {
      left: input.left === true,
      right: input.right === true,
      jump: input.jump === true,
      attack: input.attack === true,
      dash: input.dash === true,
      ability: input.ability === true,
    };
  });

  socket.on('return-lobby', (reply = () => {}) => {
    const room = socketRoom(socket);
    if (!room) return reply({ ok: false, error: 'Комната закрыта' });
    if (room.hostId !== socket.id) return reply({ ok: false, error: 'Только создатель может запустить реванш' });
    room.status = 'lobby';
    room.boss = null;
    room.projectiles = [];
    room.waves = [];
    room.effects = [];
    emitLobby(room);
    return reply({ ok: true });
  });

  socket.on('leave-room', () => leaveCurrentRoom(socket));
  socket.on('disconnect', () => leaveCurrentRoom(socket));
});

setInterval(() => {
  for (const room of rooms.values()) tickRoom(room);
}, 1000 / TICK_RATE);

setInterval(() => {
  const cutoff = Date.now() - 6 * 60 * 60 * 1000;
  for (const [code, room] of rooms.entries()) {
    if (room.createdAt < cutoff && room.players.size === 0) rooms.delete(code);
  }
}, 60_000).unref();

server.listen(PORT, '0.0.0.0', () => {
  console.log(`RIFT//RAID is running at http://localhost:${PORT}`);
});

