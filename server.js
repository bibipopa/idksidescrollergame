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
const GROUND = { x: 0, y: 640, w: 2800, h: 80 };
const ARENAS = [
  {
    name: 'Пепельные врата',
    theme: { sky: '#11100d', horizon: '#19140f', ground: '#080806', glow: '#79522a', stone: '#342d24', trim: '#caae73', fog: '#877b64' },
    platforms: [GROUND, { x: 315, y: 515, w: 265, h: 22 }, { x: 725, y: 430, w: 255, h: 22 }, { x: 1120, y: 540, w: 310, h: 22 }, { x: 1620, y: 455, w: 290, h: 22 }, { x: 2110, y: 525, w: 270, h: 22 }],
    hazards: [],
  },
  {
    name: 'Зал тлеющих углей',
    theme: { sky: '#160d09', horizon: '#24150d', ground: '#090705', glow: '#a34d24', stone: '#3a2920', trim: '#d08b55', fog: '#9a6546' },
    platforms: [GROUND, { x: 360, y: 500, w: 230, h: 22 }, { x: 810, y: 450, w: 215, h: 22 }, { x: 1240, y: 525, w: 240, h: 22 }, { x: 1685, y: 425, w: 225, h: 22 }, { x: 2180, y: 500, w: 240, h: 22 }],
    hazards: [{ id: 'ember-1', type: 'vent', x: 1320, w: 150, period: 4.8, warning: 0.9, active: 0.7, offset: 0 }],
  },
  {
    name: 'Расколотая кузня',
    theme: { sky: '#17100b', horizon: '#2b1710', ground: '#090706', glow: '#bd5529', stone: '#422d23', trim: '#d09a64', fog: '#a36d4c' },
    platforms: [GROUND, { x: 285, y: 510, w: 205, h: 22 }, { x: 650, y: 415, w: 185, h: 22 }, { x: 1040, y: 515, w: 210, h: 22 }, { x: 1490, y: 440, w: 190, h: 22 }, { x: 1885, y: 525, w: 210, h: 22 }, { x: 2300, y: 420, w: 185, h: 22 }],
    hazards: [{ id: 'forge-1', type: 'vent', x: 890, w: 135, period: 4.3, warning: 0.85, active: 0.75, offset: 0 }, { id: 'forge-2', type: 'vent', x: 1770, w: 135, period: 4.3, warning: 0.85, active: 0.75, offset: 2.15 }],
  },
  {
    name: 'Затопленная крипта',
    theme: { sky: '#091315', horizon: '#102326', ground: '#05090a', glow: '#2d7272', stone: '#26383a', trim: '#72a39b', fog: '#668c8a' },
    platforms: [GROUND, { x: 330, y: 535, w: 190, h: 22 }, { x: 690, y: 455, w: 175, h: 22 }, { x: 1065, y: 390, w: 190, h: 22 }, { x: 1440, y: 500, w: 175, h: 22 }, { x: 1815, y: 430, w: 190, h: 22 }, { x: 2240, y: 515, w: 175, h: 22 }],
    hazards: [{ id: 'crypt-1', type: 'rune', x: 745, w: 170, period: 4.1, warning: 1, active: 0.8, offset: 0 }, { id: 'crypt-2', type: 'rune', x: 1660, w: 185, period: 4.1, warning: 1, active: 0.8, offset: 2.05 }],
  },
  {
    name: 'Погребальная колокольня',
    theme: { sky: '#111017', horizon: '#1b1925', ground: '#07070a', glow: '#6c587f', stone: '#35313e', trim: '#a99bb6', fog: '#777286' },
    platforms: [GROUND, { x: 300, y: 480, w: 170, h: 22 }, { x: 620, y: 380, w: 165, h: 22 }, { x: 950, y: 500, w: 170, h: 22 }, { x: 1340, y: 405, w: 165, h: 22 }, { x: 1720, y: 520, w: 170, h: 22 }, { x: 2070, y: 390, w: 165, h: 22 }, { x: 2400, y: 490, w: 170, h: 22 }],
    hazards: [{ id: 'bell-1', type: 'fall', x: 560, w: 105, period: 5, warning: 1.15, active: 0.45, offset: 0 }, { id: 'bell-2', type: 'fall', x: 1370, w: 105, period: 5, warning: 1.15, active: 0.45, offset: 1.7 }, { id: 'bell-3', type: 'fall', x: 2180, w: 105, period: 5, warning: 1.15, active: 0.45, offset: 3.4 }],
  },
  {
    name: 'Багровый ров',
    theme: { sky: '#19090d', horizon: '#2c0e15', ground: '#090406', glow: '#9b263b', stone: '#40242b', trim: '#b66b72', fog: '#8d555d' },
    platforms: [GROUND, { x: 355, y: 515, w: 155, h: 22 }, { x: 730, y: 410, w: 150, h: 22 }, { x: 1120, y: 530, w: 155, h: 22 }, { x: 1530, y: 390, w: 150, h: 22 }, { x: 1940, y: 520, w: 155, h: 22 }, { x: 2320, y: 425, w: 150, h: 22 }],
    hazards: [{ id: 'moat-1', type: 'vent', x: 600, w: 125, period: 3.8, warning: 0.8, active: 0.75, offset: 0 }, { id: 'moat-2', type: 'rune', x: 1285, w: 155, period: 4.2, warning: 0.9, active: 0.8, offset: 1.4 }, { id: 'moat-3', type: 'vent', x: 2075, w: 125, period: 3.8, warning: 0.8, active: 0.75, offset: 2.2 }],
  },
  {
    name: 'Безмолвная тюрьма',
    theme: { sky: '#0c0d10', horizon: '#16191d', ground: '#050607', glow: '#59636e', stone: '#30343a', trim: '#89949f', fog: '#67717a' },
    platforms: [GROUND, { x: 300, y: 525, w: 145, h: 22 }, { x: 610, y: 445, w: 140, h: 22 }, { x: 930, y: 365, w: 145, h: 22 }, { x: 1280, y: 490, w: 140, h: 22 }, { x: 1640, y: 385, w: 145, h: 22 }, { x: 2010, y: 505, w: 140, h: 22 }, { x: 2340, y: 410, w: 145, h: 22 }],
    hazards: [{ id: 'prison-1', type: 'blade', x: 520, w: 95, period: 3.5, warning: 0.75, active: 0.6, offset: 0 }, { id: 'prison-2', type: 'blade', x: 1210, w: 95, period: 3.5, warning: 0.75, active: 0.6, offset: 1.15 }, { id: 'prison-3', type: 'blade', x: 1900, w: 95, period: 3.5, warning: 0.75, active: 0.6, offset: 2.3 }],
  },
  {
    name: 'Лунный разлом',
    theme: { sky: '#090b18', horizon: '#141832', ground: '#05050a', glow: '#5262aa', stone: '#2d3048', trim: '#8e9ad1', fog: '#626b99' },
    platforms: [GROUND, { x: 310, y: 455, w: 135, h: 22 }, { x: 590, y: 345, w: 130, h: 22 }, { x: 900, y: 490, w: 135, h: 22 }, { x: 1240, y: 370, w: 130, h: 22 }, { x: 1580, y: 500, w: 135, h: 22 }, { x: 1920, y: 350, w: 130, h: 22 }, { x: 2250, y: 470, w: 135, h: 22 }],
    hazards: [{ id: 'moon-1', type: 'rune', x: 500, w: 135, period: 3.6, warning: 0.85, active: 0.7, offset: 0 }, { id: 'moon-2', type: 'fall', x: 1080, w: 95, period: 4.5, warning: 1, active: 0.45, offset: 1.2 }, { id: 'moon-3', type: 'rune', x: 1660, w: 135, period: 3.6, warning: 0.85, active: 0.7, offset: 1.8 }, { id: 'moon-4', type: 'fall', x: 2240, w: 95, period: 4.5, warning: 1, active: 0.45, offset: 3.1 }],
  },
  {
    name: 'Сердце бури',
    theme: { sky: '#080d15', horizon: '#101c2b', ground: '#040609', glow: '#326c9a', stone: '#263440', trim: '#78a8c5', fog: '#587b91' },
    platforms: [GROUND, { x: 330, y: 500, w: 125, h: 22 }, { x: 620, y: 390, w: 120, h: 22 }, { x: 925, y: 510, w: 125, h: 22 }, { x: 1240, y: 360, w: 120, h: 22 }, { x: 1575, y: 500, w: 125, h: 22 }, { x: 1905, y: 380, w: 120, h: 22 }, { x: 2240, y: 510, w: 125, h: 22 }],
    hazards: [{ id: 'storm-1', type: 'storm', x: 470, w: 90, period: 3.9, warning: 0.9, active: 0.35, offset: 0 }, { id: 'storm-2', type: 'storm', x: 925, w: 90, period: 3.9, warning: 0.9, active: 0.35, offset: 0.8 }, { id: 'storm-3', type: 'storm', x: 1380, w: 90, period: 3.9, warning: 0.9, active: 0.35, offset: 1.6 }, { id: 'storm-4', type: 'storm', x: 1835, w: 90, period: 3.9, warning: 0.9, active: 0.35, offset: 2.4 }, { id: 'storm-5', type: 'storm', x: 2290, w: 90, period: 3.9, warning: 0.9, active: 0.35, offset: 3.2 }],
  },
  {
    name: 'Трон Пустоты',
    theme: { sky: '#120815', horizon: '#250d2b', ground: '#050306', glow: '#7b2c83', stone: '#39273e', trim: '#aa78b0', fog: '#74517a' },
    platforms: [GROUND, { x: 315, y: 480, w: 115, h: 22 }, { x: 575, y: 350, w: 110, h: 22 }, { x: 850, y: 520, w: 115, h: 22 }, { x: 1130, y: 390, w: 110, h: 22 }, { x: 1420, y: 505, w: 115, h: 22 }, { x: 1710, y: 345, w: 110, h: 22 }, { x: 2010, y: 500, w: 115, h: 22 }, { x: 2310, y: 385, w: 110, h: 22 }],
    hazards: [{ id: 'void-1', type: 'blade', x: 470, w: 85, period: 3.2, warning: 0.7, active: 0.55, offset: 0 }, { id: 'void-2', type: 'storm', x: 850, w: 85, period: 3.8, warning: 0.8, active: 0.35, offset: 0.65 }, { id: 'void-3', type: 'rune', x: 1230, w: 120, period: 3.3, warning: 0.75, active: 0.65, offset: 1.25 }, { id: 'void-4', type: 'storm', x: 1610, w: 85, period: 3.8, warning: 0.8, active: 0.35, offset: 2 }, { id: 'void-5', type: 'blade', x: 1990, w: 85, period: 3.2, warning: 0.7, active: 0.55, offset: 2.55 }, { id: 'void-6', type: 'fall', x: 2370, w: 90, period: 4.2, warning: 0.9, active: 0.4, offset: 3.2 }],
  },
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
  { id: 'iron_skin', name: 'Пепельный оберег', description: 'Поглощает первый удар на каждой стадии. Максимум 2 заряда.', rarity: 'epic', icon: '◈', maxStacks: 2 },
  { id: 'glass_edge', name: 'Стеклянная кромка', description: '+35% урона, но −1 к максимуму здоровья.', rarity: 'epic', icon: '♢', maxStacks: 2 },
  { id: 'precision', name: 'Пятая печать', description: 'Каждое пятое попадание наносит на 75% больше урона.', rarity: 'rare', icon: 'Ⅴ' },
  { id: 'momentum', name: 'Неослабевающий натиск', description: 'Быстрые последовательные попадания постепенно усиливают урон.', rarity: 'rare', icon: '↟' },
  { id: 'battle_trance', name: 'Боевой транс', description: 'Успешное парирование восстанавливает ещё 35 выносливости.', rarity: 'rare', icon: '◎', maxStacks: 2 },
  { id: 'long_roll', name: 'Длинный перекат', description: '+12% к дальности и скорости переката.', rarity: 'common', icon: '➟', maxStacks: 4 },
  { id: 'aerial_hunter', name: 'Охотник над землёй', description: 'Атаки в воздухе наносят на 30% больше урона.', rarity: 'rare', icon: '⌃' },
  { id: 'stamina_strike', name: 'Ритм стали', description: 'Каждое попадание возвращает 4 выносливости.', rarity: 'common', icon: '∿' },
  { id: 'stagger_bane', name: 'Разрушитель стойки', description: '+30% урона по оглушённому боссу.', rarity: 'epic', icon: '✸' },
  { id: 'revenge', name: 'Ответный гнев', description: 'После полученного удара следующая атака наносит на 45% больше урона.', rarity: 'rare', icon: '↶' },
  { id: 'curse_bearer', name: 'Печать истощения', description: 'Уменьшает здоровье босса на 4%, но отнимает 10 максимальной выносливости.', rarity: 'epic', icon: '⊘', maxStacks: 4 },
  { id: 'fellowship', name: 'Клятва отряда', description: '+8% урона за каждого живого союзника.', rarity: 'rare', icon: '♧' },
  { id: 'full_focus', name: 'Чистый разум', description: '+22% урона, пока заполнено не меньше 85% выносливости.', rarity: 'rare', icon: '◉' },
  { id: 'safe_roll', name: 'Между ударами', description: 'Окно неуязвимости переката становится длиннее на 0,08 секунды.', rarity: 'epic', icon: '◌', maxStacks: 3 },
  { id: 'high_jump', name: 'Лёгкость пепла', description: '+12% к высоте прыжка.', rarity: 'common', icon: '↑', maxStacks: 4 },

  { id: 'sword_flow', classId: 'swordsman', name: 'Переменный ритм', description: 'Чередование лёгкой и тяжёлой атак даёт +30% урона.', rarity: 'rare', icon: '⇄' },
  { id: 'sword_riposte', classId: 'swordsman', name: 'Рипост', description: 'Успешное парирование немедленно наносит боссу 32 урона.', rarity: 'epic', icon: '⟲' },
  { id: 'sword_discipline', classId: 'swordsman', name: 'Школа клинка', description: 'Лёгкие и тяжёлые атаки расходуют на 12% меньше выносливости.', rarity: 'common', icon: '⌁' },
  { id: 'sword_wind', classId: 'swordsman', name: 'Четвёртый разрез', description: 'Каждая четвёртая лёгкая атака выпускает режущую волну.', rarity: 'legendary', icon: 'Ⅳ', maxStacks: 3 },
  { id: 'sword_duelist', classId: 'swordsman', name: 'Дистанция дуэли', description: '+18% урона в ближнем бою с боссом.', rarity: 'rare', icon: '⚔' },
  { id: 'sword_guard', classId: 'swordsman', name: 'Стойка мастера', description: 'Увеличивает окно парирования и даёт краткую защиту после успеха.', rarity: 'epic', icon: '⛊' },

  { id: 'great_mass', classId: 'greatsword', name: 'Чудовищная масса', description: '+30% урона тяжёлой атаки, но −5% скорости движения.', rarity: 'rare', icon: '▰' },
  { id: 'great_endurance', classId: 'greatsword', name: 'Обратная отдача', description: 'Попадание тяжёлой атакой возвращает 18 выносливости.', rarity: 'common', icon: '↲' },
  { id: 'great_quake', classId: 'greatsword', name: 'Раскол земли', description: 'Каждая тяжёлая атака выпускает короткую ударную волну.', rarity: 'legendary', icon: '≋', maxStacks: 3 },
  { id: 'great_unshaken', classId: 'greatsword', name: 'Неостановимый замах', description: 'Полученный удар больше не прерывает подготовку тяжёлой атаки.', rarity: 'epic', icon: '■', maxStacks: 1 },
  { id: 'great_crusher', classId: 'greatsword', name: 'Крушитель доспехов', description: 'Тяжёлые атаки наносят ещё +55% урона оглушённому боссу.', rarity: 'epic', icon: '✹' },
  { id: 'great_colossus', classId: 'greatsword', name: 'Шаг колосса', description: '+1 здоровье, но −8% скорости движения.', rarity: 'rare', icon: '▣', maxStacks: 2 },

  { id: 'rogue_backstab', classId: 'rogue', name: 'Удар в спину', description: 'Атака со спины босса наносит на 60% больше урона.', rarity: 'rare', icon: '☽' },
  { id: 'rogue_flurry', classId: 'rogue', name: 'Шквал кинжалов', description: 'Каждая четвёртая лёгкая атака наносит дополнительный удар.', rarity: 'epic', icon: '⁙' },
  { id: 'rogue_smoke', classId: 'rogue', name: 'Дымный след', description: 'После переката следующая атака наносит на 45% больше урона.', rarity: 'epic', icon: '☁' },
  { id: 'rogue_lightfeet', classId: 'rogue', name: 'Беззвучный шаг', description: 'Перекат дешевле на 20%, скорость движения выше на 5%.', rarity: 'common', icon: '⋔' },
  { id: 'rogue_venom', classId: 'rogue', name: 'Седьмой надрез', description: 'Каждое седьмое попадание наносит 40 дополнительного урона.', rarity: 'rare', icon: 'Ⅶ' },
  { id: 'rogue_gambit', classId: 'rogue', name: 'Грязный приём', description: 'Даёт 12% шанс нанести двойной урон.', rarity: 'legendary', icon: '※', maxStacks: 4 },
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
function arenaForStage(stage) { return ARENAS[Math.min(ARENAS.length - 1, Math.floor((stage - 1) / 10))]; }

function setArena(room) {
  const source = arenaForStage(room.stage);
  room.arenaTime = 0;
  room.arena = {
    tier: Math.min(10, Math.floor((room.stage - 1) / 10) + 1),
    name: source.name,
    theme: { ...source.theme },
    platforms: source.platforms.map((platform) => ({ ...platform })),
    hazards: source.hazards.map((hazard) => ({ ...hazard, live: false, warningNow: false })),
  };
}

function publicArena(room, includePlatforms = false) {
  if (!room.arena) return null;
  return {
    tier: room.arena.tier,
    name: room.arena.name,
    theme: room.arena.theme,
    ...(includePlatforms ? { platforms: room.arena.platforms } : {}),
    hazards: room.arena.hazards.map((hazard) => ({ id: hazard.id, type: hazard.type, x: hazard.x, w: hazard.w, live: hazard.live, warning: hazard.warningNow })),
  };
}

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
  const isSwordsman = player.classId === 'swordsman';
  const isGreatsword = player.classId === 'greatsword';
  const isRogue = player.classId === 'rogue';
  const damageScale = Math.pow(1.16, perkCount(player, 'sharpened')) * Math.pow(1.35, perkCount(player, 'glass_edge'));
  const discipline = isSwordsman ? Math.pow(0.88, perkCount(player, 'sword_discipline')) : 1;
  const rogueRoll = isRogue ? Math.pow(0.8, perkCount(player, 'rogue_lightfeet')) : 1;
  const speedScale = Math.pow(1.09, perkCount(player, 'quickstep'))
    * (isRogue ? Math.pow(1.05, perkCount(player, 'rogue_lightfeet')) : 1)
    * (isGreatsword ? Math.pow(0.95, perkCount(player, 'great_mass')) * Math.pow(0.92, perkCount(player, 'great_colossus')) : 1);
  return {
    maxHp: Math.max(1, base.maxHp + perkCount(player, 'vitality') - perkCount(player, 'glass_edge') + (isGreatsword ? perkCount(player, 'great_colossus') : 0)),
    maxStamina: Math.max(45, base.maxStamina + perkCount(player, 'endurance') * 25 - perkCount(player, 'curse_bearer') * 10),
    staminaRegen: base.staminaRegen * Math.pow(1.28, perkCount(player, 'lungs')),
    speed: base.speed * speedScale,
    jump: base.jump * Math.pow(1.12, perkCount(player, 'high_jump')),
    lightDamage: base.lightDamage * damageScale,
    heavyDamage: base.heavyDamage * damageScale * Math.pow(1.35, perkCount(player, 'heavy_mastery')) * (isGreatsword ? Math.pow(1.3, perkCount(player, 'great_mass')) : 1),
    lightCost: base.lightCost * Math.pow(0.82, perkCount(player, 'light_mastery')) * discipline,
    heavyCost: base.heavyCost * discipline,
    rollCost: base.rollCost * Math.pow(0.75, perkCount(player, 'feather_roll')) * rogueRoll,
    parryCost: base.parryCost,
    lightTime: base.lightTime * Math.pow(0.86, perkCount(player, 'light_mastery')),
    heavyTime: base.heavyTime,
    attackRange: base.attackRange,
    parryWindow: base.parryWindow + perkCount(player, 'parry_master') * 0.055 + (isSwordsman ? perkCount(player, 'sword_guard') * 0.04 : 0),
    rollSpeed: 710 * Math.pow(1.12, perkCount(player, 'long_roll')),
    rollInvulnerability: 0.3 + perkCount(player, 'safe_roll') * 0.08,
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
    nextHitMultiplier: 1, lightChain: 0, hitsLanded: 0, weaponHits: 0,
    momentum: 0, momentumTimer: 0, wardCharges: 0, rollBuff: 1, lastAttackType: null,
    secondWindUsed: false, damageDone: 0,
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
    projectiles: [], waves: [], effects: [], bossEvents: [], arena: null, arenaTime: 0,
    stateSequence: 0, nextStageTimer: null,
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
    secondWindUsed: false, wardCharges: Math.min(2, perkCount(player, 'iron_skin')),
    momentum: 0, momentumTimer: 0, rollBuff: 1, lastAttackType: null,
    perkOffer: [], perkChosen: false,
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
  player.weaponHits = 0;
  player.momentum = 0;
  player.momentumTimer = 0;
  player.rollBuff = 1;
  player.lastAttackType = null;
  resetPlayerForStage(player);
}

function bossHealth(stage, count) {
  const base = 250 + count * 115;
  const step = stage - 1;
  return Math.round(base * (1 + step * 0.082 + Math.pow(step / 12, 1.55) * 0.22));
}

function spawnBoss(room) {
  const curseStacks = [...room.players.values()].reduce((sum, player) => sum + perkCount(player, 'curse_bearer'), 0);
  const maxHp = Math.max(1, Math.round(bossHealth(room.stage, room.players.size) * (1 - Math.min(0.32, curseStacks * 0.04))));
  room.boss = {
    x: 2250, y: WORLD.floor - 150, w: 122, h: 150, vx: 0,
    hp: maxHp, maxHp, facing: -1, tier: Math.min(10, Math.ceil(room.stage / 10)),
    attackCooldown: Math.max(0.68, 2.05 - room.stage * 0.014), currentAttack: null,
    lastAttack: null, stagger: 0, flash: 0,
  };
}

function startRun(room) {
  Object.assign(room, { status: 'playing', stage: 1, stagesCleared: 0, elapsed: 0, projectiles: [], waves: [], effects: [], bossEvents: [] });
  setArena(room);
  for (const player of room.players.values()) resetPlayerForRun(player);
  spawnBoss(room);
  io.to(room.code).emit('game-start', { world: WORLD, arena: publicArena(room, true), maxStage: MAX_STAGE });
  io.to(room.code).emit('stage-start', { stage: 1, arena: publicArena(room, true) });
}

function startNextStage(room) {
  if (room.status !== 'perk' || !rooms.has(room.code)) return;
  room.status = 'playing';
  room.stage += 1;
  room.projectiles = [];
  room.waves = [];
  room.effects = [];
  room.bossEvents = [];
  setArena(room);
  for (const player of room.players.values()) resetPlayerForStage(player);
  spawnBoss(room);
  io.to(room.code).emit('stage-start', { stage: room.stage, arena: publicArena(room, true) });
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
  player.stamina = Math.min(player.maxStamina, player.stamina + 28 + perkCount(player, 'battle_trance') * 35);
  if (player.classId === 'swordsman' && perkCount(player, 'sword_guard')) player.invulnerable = Math.max(player.invulnerable, 0.48 + perkCount(player, 'sword_guard') * 0.08);
  if (perkCount(player, 'perfect_guard')) player.nextHitMultiplier = Math.max(2, player.nextHitMultiplier);
  if (boss) {
    boss.currentAttack = null;
    boss.stagger = Math.max(boss.stagger, 1.25 + perkCount(player, 'thorns') * 0.55);
    if (perkCount(player, 'thorns')) damageBoss(room, player, 28 * perkCount(player, 'thorns'), boss.x + boss.w / 2, boss.y + 70, '#d7b46a', true);
    if (room.status === 'playing' && room.boss && player.classId === 'swordsman' && perkCount(player, 'sword_riposte')) damageBoss(room, player, 32 * perkCount(player, 'sword_riposte'), boss.x + boss.w / 2, boss.y + 70, '#e8d19a', true);
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
  if (player.wardCharges > 0) {
    player.wardCharges -= 1;
    player.invulnerable = 0.55;
    if (projectile) projectile.ttl = 0;
    addEffect(room, 'ward', player.x + 21, player.y + 28, '#a9c8d6', 0.55, 105);
    return 'warded';
  }
  player.momentum = 0;
  player.momentumTimer = 0;
  if (perkCount(player, 'revenge')) player.nextHitMultiplier = Math.max(player.nextHitMultiplier, 1 + perkCount(player, 'revenge') * 0.45);
  if (player.hp - damage <= 0 && perkCount(player, 'second_wind') && !player.secondWindUsed) {
    player.secondWindUsed = true;
    player.hp = 1;
    player.invulnerable = 1.1;
    addEffect(room, 'second_wind', player.x + 21, player.y + 30, '#e7c477', 0.75, 150);
    return 'saved';
  }
  const unshaken = player.classId === 'greatsword' && player.action === 'heavy' && perkCount(player, 'great_unshaken');
  player.hp -= damage;
  player.vx += knockX * (unshaken ? 0.25 : 1);
  player.vy = Math.min(player.vy, knockY * (unshaken ? 0.35 : 1));
  player.invulnerable = 0.72;
  if (!unshaken) {
    player.action = 'hurt';
    player.actionTimer = player.actionDuration = 0.35;
  }
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
    const momentum = player.momentumTimer > 0 ? player.momentum : 0;
    damage *= 1 + momentum * 0.07 * perkCount(player, 'momentum');
    damage *= player.nextHitMultiplier;
    player.nextHitMultiplier = 1;
  }
  if (boss.stagger > 0) damage *= 1.45 * Math.pow(1.3, perkCount(player, 'stagger_bane'));
  damage = Math.max(1, Math.round(damage));
  boss.hp = Math.max(0, boss.hp - damage);
  boss.flash = 0.12;
  player.damageDone += damage;
  player.hitsLanded += 1;
  if (!bypass && perkCount(player, 'momentum')) {
    player.momentum = Math.min(6, (player.momentumTimer > 0 ? player.momentum : 0) + 1);
    player.momentumTimer = 2.2;
  }
  if (perkCount(player, 'blood_oath') && player.hitsLanded % 8 === 0) {
    player.hp = Math.min(player.maxHp, player.hp + 1);
    addEffect(room, 'heal', player.x + 21, player.y, '#8faa72', 0.45, 70);
  }
  addEffect(room, 'slash', x, y, color, 0.3, 95);
  if (boss.hp === 0) clearStage(room);
}

function spawnPlayerWave(room, player, damage, options = {}) {
  room.projectiles.push({
    id: entitySequence++, kind: options.kind || 'player_wave', ownerId: player.id,
    x: player.x + 21 + player.facing * 30, y: player.y + 28,
    vx: player.facing * (options.speed || 620), vy: 0, r: options.r || 18,
    damage: Math.max(1, Math.round(damage)), ttl: options.ttl || 1.6,
  });
}

function isBackstab(player, boss) {
  return (player.x + player.w / 2 < boss.x + boss.w / 2 && boss.facing > 0)
    || (player.x + player.w / 2 > boss.x + boss.w / 2 && boss.facing < 0);
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
  if (!player.onGround && perkCount(player, 'aerial_hunter')) damage *= Math.pow(1.3, perkCount(player, 'aerial_hunter'));
  if (player.stamina >= player.maxStamina * 0.85 && perkCount(player, 'full_focus')) damage *= Math.pow(1.22, perkCount(player, 'full_focus'));
  const livingAllies = Math.max(0, alivePlayers(room).length - 1);
  if (livingAllies && perkCount(player, 'fellowship')) damage *= 1 + livingAllies * 0.08 * perkCount(player, 'fellowship');

  if (player.classId === 'swordsman') {
    if (player.lastAttackType && player.lastAttackType !== type && perkCount(player, 'sword_flow')) damage *= Math.pow(1.3, perkCount(player, 'sword_flow'));
    if (Math.abs(player.x + 21 - (boss.x + 61)) <= 190 && perkCount(player, 'sword_duelist')) damage *= Math.pow(1.18, perkCount(player, 'sword_duelist'));
  }
  if (player.classId === 'greatsword' && type === 'heavy' && boss.stagger > 0 && perkCount(player, 'great_crusher')) damage *= Math.pow(1.55, perkCount(player, 'great_crusher'));
  if (player.classId === 'rogue') {
    if (isBackstab(player, boss) && perkCount(player, 'rogue_backstab')) damage *= Math.pow(1.6, perkCount(player, 'rogue_backstab'));
    if (type === 'light' && player.lightChain % 4 === 0 && perkCount(player, 'rogue_flurry')) damage *= 1 + perkCount(player, 'rogue_flurry') * 0.55;
    if (perkCount(player, 'rogue_gambit') && Math.random() < Math.min(0.48, perkCount(player, 'rogue_gambit') * 0.12)) damage *= 2;
  }
  damage *= player.rollBuff;

  const colors = { iron: '#d7b46a', ember: '#e25f3f', moon: '#9eb7dd', abyss: '#9a70c5' };
  const hit = overlaps(hitbox, boss);
  if (hit) {
    player.weaponHits += 1;
    if (perkCount(player, 'precision') && player.weaponHits % 5 === 0) damage *= 1 + perkCount(player, 'precision') * 0.75;
    if (player.classId === 'rogue' && perkCount(player, 'rogue_venom') && player.weaponHits % 7 === 0) damage += perkCount(player, 'rogue_venom') * 40;
    damageBoss(room, player, damage, boss.x + 61, boss.y + 65, colors[player.skin]);
    if (room.status === 'playing') {
      player.stamina = Math.min(player.maxStamina, player.stamina + perkCount(player, 'stamina_strike') * 4);
      if (player.classId === 'greatsword' && type === 'heavy') player.stamina = Math.min(player.maxStamina, player.stamina + perkCount(player, 'great_endurance') * 18);
    }
  } else addEffect(room, type === 'heavy' ? 'heavy_slash' : 'slash', hitbox.x + hitbox.w / 2, player.y + 25, '#817562', 0.22, range * 0.65);

  player.lastAttackType = type;
  player.rollBuff = 1;

  if (room.status === 'playing' && player.classId === 'swordsman' && type === 'light' && perkCount(player, 'sword_wind') && player.lightChain % 4 === 0) {
    spawnPlayerWave(room, player, stats.lightDamage * 0.42 * perkCount(player, 'sword_wind'), { speed: 690, r: 13, ttl: 1.25 });
  }

  if (room.status === 'playing' && type === 'heavy' && perkCount(player, 'moonlight')) {
    spawnPlayerWave(room, player, stats.heavyDamage * 0.55, { speed: 620, r: 18, ttl: 1.6 });
  }
  if (room.status === 'playing' && player.classId === 'greatsword' && type === 'heavy' && perkCount(player, 'great_quake')) {
    spawnPlayerWave(room, player, stats.heavyDamage * 0.34 * perkCount(player, 'great_quake'), { kind: 'player_quake', speed: 510, r: 22, ttl: 1.8 });
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
    player.invulnerable = stats.rollInvulnerability;
    player.rollHit = false;
    player.rollSpeed = stats.rollSpeed;
    player.vx = player.facing * stats.rollSpeed;
    if (player.classId === 'rogue' && perkCount(player, 'rogue_smoke')) player.rollBuff = Math.max(player.rollBuff, 1 + perkCount(player, 'rogue_smoke') * 0.45);
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
    player.vx = player.facing * (player.rollSpeed || 710);
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
  player.momentumTimer = Math.max(0, player.momentumTimer - DT);
  if (player.momentumTimer === 0) player.momentum = 0;
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
    for (const platform of room.arena?.platforms || [GROUND]) {
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

function arenaHazardBox(hazard) {
  if (hazard.type === 'rune') return { x: hazard.x, y: WORLD.floor - 30, w: hazard.w, h: 34 };
  if (hazard.type === 'blade') return { x: hazard.x, y: WORLD.floor - 118, w: hazard.w, h: 122 };
  if (hazard.type === 'vent') return { x: hazard.x, y: WORLD.floor - 145, w: hazard.w, h: 149 };
  return { x: hazard.x, y: 0, w: hazard.w, h: WORLD.floor + 4 };
}

function updateArena(room) {
  if (!room.arena) return;
  room.arenaTime += DT;
  for (const hazard of room.arena.hazards) {
    const phase = (room.arenaTime + hazard.offset) % hazard.period;
    const dangerStart = hazard.period - hazard.active;
    const warningStart = dangerStart - hazard.warning;
    hazard.live = phase >= dangerStart;
    hazard.warningNow = !hazard.live && phase >= warningStart;
    if (!hazard.live) continue;
    const box = arenaHazardBox(hazard);
    for (const player of alivePlayers(room)) {
      if (!overlaps(box, player)) continue;
      const direction = Math.sign(player.x + player.w / 2 - (hazard.x + hazard.w / 2)) || 1;
      damagePlayer(room, player, 1, direction * 270, hazard.type === 'rune' ? -360 : -260);
    }
  }
}

function telegraphTime(stage, type) {
  const base = {
    slash: 0.58, cleave: 0.85, slam: 0.88, volley: 0.72, wave: 0.76, charge: 0.68,
    twin_slash: 0.82, skyfall: 1.05, blink: 0.72, ring_burst: 0.9,
    beam: 1.08, quake: 0.96, marked: 1.15,
  }[type] || 0.8;
  return Math.max(0.26, base - Math.min(0.48, stage * 0.0042));
}

function buildBossAttack(room, target, type) {
  const duration = telegraphTime(room.stage, type);
  const attack = { type, phase: 'telegraph', timer: duration, duration, targetId: target.id, targetX: target.x + 21 };
  if (['skyfall', 'marked'].includes(type)) attack.targetXs = alivePlayers(room).map((player) => player.x + 21);
  if (type === 'skyfall' && room.stage >= 55) attack.targetXs.push(clamp(target.x - 170, 80, WORLD.width - 80), clamp(target.x + 210, 80, WORLD.width - 80));
  if (type === 'beam') attack.direction = Math.sign(target.x - room.boss.x) || room.boss.facing;
  return attack;
}

function chooseBossAttack(room, target) {
  const distance = Math.abs(target.x - room.boss.x);
  const available = distance < 185 ? ['slash', 'cleave', 'slam'] : ['charge', 'volley', 'slam'];
  if (room.stage >= 4) available.push('wave');
  if (room.stage >= 8) available.push('twin_slash');
  if (room.stage >= 15) available.push('skyfall');
  if (room.stage >= 25) available.push('blink');
  if (room.stage >= 35) available.push('ring_burst');
  if (room.stage >= 45) available.push('beam');
  if (room.stage >= 60) available.push('quake');
  if (room.stage >= 75) available.push('marked');
  const choices = available.length > 1 ? available.filter((item) => item !== room.boss.lastAttack) : available;
  const type = choices[Math.floor(Math.random() * choices.length)];
  room.boss.currentAttack = buildBossAttack(room, target, type);
  room.boss.lastAttack = type;
}

function bossMelee(room, radius, parryable) {
  const centerX = room.boss.x + 61;
  let parried = false;
  for (const player of alivePlayers(room)) {
    const playerCenter = player.x + 21;
    if (Math.abs(playerCenter - centerX) <= radius && Math.abs(player.y - room.boss.y) < 145) {
      const result = damagePlayer(room, player, 1, Math.sign(playerCenter - centerX) * 380, -300, parryable, centerX);
      if (result === 'parried') { parried = true; break; }
    }
  }
  addEffect(room, parryable ? 'boss_slash' : 'slam', centerX, room.boss.y + 82, parryable ? '#a52d3d' : '#6f2630', 0.42, radius * 1.7);
  return parried;
}

function spawnBossOrb(room, target, offset = 0, options = {}) {
  const boss = room.boss;
  const x = options.x ?? boss.x + 61;
  const y = options.y ?? boss.y + 42;
  const angle = options.angle ?? Math.atan2(target.y + 30 - y, target.x + 21 - x) + offset;
  const speed = options.speed ?? 390 + Math.min(300, room.stage * 4.2);
  room.projectiles.push({
    id: entitySequence++, kind: 'boss', style: options.style || 'orb', x, y,
    vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
    r: options.r || 14 + Math.min(7, Math.floor(room.stage / 25)), damage: 1,
    parryable: options.parryable !== false, ttl: options.ttl || 5,
  });
}

function queueBossEvent(room, delay, type, data = {}) {
  room.bossEvents.push({ id: entitySequence++, delay, type, ...data });
}

function updateBossEvents(room) {
  for (const event of room.bossEvents) {
    event.delay -= DT;
    if (event.delay > 0) continue;
    event.done = true;
    if (!room.boss || room.boss.hp <= 0 || room.boss.stagger > 0) continue;
    if (event.type === 'melee') bossMelee(room, event.radius, event.parryable);
  }
  room.bossEvents = room.bossEvents.filter((event) => !event.done);
}

function executeBossAttack(room, attack) {
  const boss = room.boss;
  const target = room.players.get(attack.targetId) || nearestPlayer(room);
  if (attack.type === 'slash') bossMelee(room, 155, true);
  if (attack.type === 'cleave') bossMelee(room, 245, true);
  if (attack.type === 'twin_slash') {
    const parried = bossMelee(room, 175, true);
    if (!parried) queueBossEvent(room, 0.28, 'melee', { radius: 225, parryable: true });
  }
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
  if (attack.type === 'skyfall') {
    for (const [index, targetX] of (attack.targetXs || []).entries()) {
      room.projectiles.push({
        id: entitySequence++, kind: 'boss', style: 'sky', x: targetX, y: -25 - index * 28,
        vx: index % 2 ? 35 : -35, vy: 570 + Math.min(260, room.stage * 3.2),
        r: 17, damage: 1, parryable: false, ttl: 2.2,
      });
    }
  }
  if (attack.type === 'ring_burst') {
    const count = room.stage >= 80 ? 16 : room.stage >= 55 ? 12 : 8;
    for (let index = 0; index < count; index += 1) {
      spawnBossOrb(room, target, 0, { angle: (Math.PI * 2 * index) / count, speed: 330 + room.stage * 2.2, style: 'ring', r: 12 });
    }
  }
  if (attack.type === 'beam') {
    const direction = attack.direction || boss.facing;
    const length = 760 + Math.min(420, room.stage * 4);
    const box = { x: direction > 0 ? boss.x + boss.w : boss.x - length, y: boss.y + 18, w: length, h: 94 };
    for (const player of alivePlayers(room)) {
      if (overlaps(box, player)) damagePlayer(room, player, 1, direction * 510, -240);
    }
    room.effects.push({ id: entitySequence++, type: 'beam', x: box.x, y: box.y, width: box.w, height: box.h, direction, color: '#b33754', ttl: 0.42, maxTtl: 0.42, size: box.w });
  }
  if (attack.type === 'blink' && target) {
    const side = target.facing || 1;
    boss.x = clamp(target.x - side * 135, 70, WORLD.width - boss.w - 70);
    boss.facing = target.x < boss.x ? -1 : 1;
    addEffect(room, 'blink', boss.x + 61, boss.y + 75, '#9a63b7', 0.38, 120);
    bossMelee(room, 150, true);
  }
  if (attack.type === 'marked') {
    const radius = 128 + Math.min(42, room.stage * 0.35);
    for (const targetX of attack.targetXs || []) {
      for (const player of alivePlayers(room)) {
        const center = player.x + 21;
        if (Math.abs(center - targetX) < radius && player.y + player.h > WORLD.floor - 125) damagePlayer(room, player, 1, Math.sign(center - targetX) * 360, -420);
      }
      addEffect(room, 'ground_slam', targetX, WORLD.floor, '#93406f', 0.5, radius * 2);
    }
  }
  if (attack.type === 'wave') {
    const count = room.stage >= 70 ? 3 : room.stage >= 25 ? 2 : 1;
    const direction = target ? Math.sign(target.x - boss.x) || -1 : -1;
    for (let index = 0; index < count; index += 1) room.waves.push({
      id: entitySequence++, x: boss.x + 61, y: WORLD.floor - 6,
      vx: direction * (470 + room.stage * 2.4 + index * 45), w: 72, h: 38 + index * 6, damage: 1, ttl: 5, hit: [],
    });
  }
  if (attack.type === 'quake') {
    const count = room.stage >= 85 ? 2 : 1;
    for (const direction of [-1, 1]) for (let index = 0; index < count; index += 1) room.waves.push({
      id: entitySequence++, x: boss.x + 61 + direction * 30, y: WORLD.floor - 6,
      vx: direction * (505 + room.stage * 2.7 + index * 70), w: 82, h: 48 + index * 7, damage: 1, ttl: 5, hit: [],
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
  boss.facing = target.x < boss.x ? -1 : 1;
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
          if (damagePlayer(room, player, 1, Math.sign(projectile.vx || 1) * 260, -240, projectile.parryable !== false, projectile.x, projectile) !== 'ignored') projectile.ttl = 0;
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
  const candidates = PERKS.filter((perk) => (!perk.classId || perk.classId === player.classId) && perkCount(player, perk.id) < (perk.maxStacks || Infinity));
  const selected = [];
  const pickFrom = (pool) => {
    const weighted = pool.map((perk) => ({ perk, weight: weights[perk.rarity] / (1 + perkCount(player, perk.id) * 0.7) }));
    const total = weighted.reduce((sum, item) => sum + item.weight, 0);
    let roll = Math.random() * total;
    let chosen = weighted[0].perk;
    for (const item of weighted) { roll -= item.weight; if (roll <= 0) { chosen = item.perk; break; } }
    selected.push(chosen);
  };
  const classPool = candidates.filter((perk) => perk.classId === player.classId);
  if (classPool.length) pickFrom(classPool);
  while (selected.length < 3) {
    pickFrom(candidates.filter((perk) => !selected.includes(perk)));
  }
  return selected.sort(() => Math.random() - 0.5);
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
  room.bossEvents = [];
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
  room.bossEvents = [];
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
    arena: publicArena(room),
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
  updateArena(room);
  updateBoss(room);
  updateBossEvents(room);
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
    socket.on('debug-set-stage', (value) => {
      const room = socketRoom(socket);
      if (room?.status !== 'playing') return;
      room.stage = clamp(Math.floor(Number(value) || 1), 1, MAX_STAGE);
      room.projectiles = []; room.waves = []; room.effects = []; room.bossEvents = [];
      setArena(room);
      for (const player of room.players.values()) resetPlayerForStage(player);
      spawnBoss(room);
      io.to(room.code).emit('stage-start', { stage: room.stage, arena: publicArena(room, true) });
    });
    socket.on('debug-force-attack', (type) => {
      const room = socketRoom(socket);
      const target = room && nearestPlayer(room);
      if (!room?.boss || !target || room.status !== 'playing') return;
      const attack = buildBossAttack(room, target, String(type));
      room.boss.currentAttack = attack;
      executeBossAttack(room, attack);
      if (room.boss) room.boss.currentAttack = null;
    });
    socket.on('debug-grant-perk', (id) => {
      const room = socketRoom(socket);
      const player = room?.players.get(socket.id);
      const perk = PERKS.find((item) => item.id === id);
      if (!player || !perk || (perk.classId && perk.classId !== player.classId)) return;
      if (perkCount(player, perk.id) >= (perk.maxStacks || Infinity)) return;
      applyPerk(player, perk.id);
    });
    socket.on('debug-place-player', (x) => {
      const room = socketRoom(socket);
      const player = room?.players.get(socket.id);
      if (!player || room.status !== 'playing') return;
      player.x = clamp(Number(x) || 0, 0, WORLD.width - player.w);
      player.y = WORLD.floor - player.h;
      player.vx = player.vy = 0;
      player.facing = room.boss && player.x < room.boss.x ? 1 : -1;
    });
    socket.on('debug-player-attack', (type) => {
      const room = socketRoom(socket);
      const player = room?.players.get(socket.id);
      if (!player || room.status !== 'playing' || !['light', 'heavy'].includes(type)) return;
      attackBoss(room, player, type);
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
    Object.assign(room, { status: 'lobby', boss: null, projectiles: [], waves: [], effects: [], bossEvents: [], arena: null, arenaTime: 0 });
    emitLobby(room);
    return reply({ ok: true });
  });
  socket.on('leave-room', () => leaveCurrentRoom(socket));
  socket.on('disconnect', () => leaveCurrentRoom(socket));
});

setInterval(() => { for (const room of rooms.values()) tickRoom(room); }, 1000 / TICK_RATE);
server.listen(PORT, '0.0.0.0', () => console.log(`RIFT//RAID: ASHEN HUNDRED is running at http://localhost:${PORT}`));
