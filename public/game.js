/* global io */
'use strict';

const socket = io();

const CLASS_META = {
  swordsman: { label: 'Мечник', short: 'М', color: '#c9a862', icon: '†', price: 0, description: 'Равновесие скорости, защиты и урона.' },
  greatsword: { label: 'Тяжёлый мечник', short: 'Т', color: '#9f4650', icon: '‡', price: 1800, description: 'Медленные удары с огромной силой.' },
  rogue: { label: 'Вор', short: 'В', color: '#8ba17d', icon: '⋔', price: 2600, description: 'Быстрые кинжалы и дешёвые перекаты.' },
  spearman: { label: 'Копейщик', short: 'К', color: '#7b9ba7', icon: '╂', price: 3800, description: 'Дальние выпады и контроль дистанции.' },
  berserker: { label: 'Берсерк', short: 'Б', color: '#b45c45', icon: '✚', price: 5200, description: 'Высокий урон и сила на грани поражения.' },
  ashmage: { label: 'Пепельный маг', short: 'П', color: '#8d70b1', icon: '●', price: 7500, description: 'Дальние заклинания и большой запас выносливости.' },
};

const WEAPON_META = {
  swordsman_longsword: { classId:'swordsman', name:'Длинный меч', trait:'Равновесие', unlockLevel:1, description:'Надёжный набор быстрых и тяжёлых ударов.' },
  swordsman_katana: { classId:'swordsman', name:'Пепельная катана', trait:'Иай-рывок', unlockLevel:5, description:'Быстрые атаки; тяжёлая атака делает короткий рывок.' },
  swordsman_bulwark: { classId:'swordsman', name:'Меч бастиона', trait:'Широкое парирование', unlockLevel:12, description:'Меньше урона, зато значительно длиннее окно парирования.' },
  greatsword_zweihander: { classId:'greatsword', name:'Цвайхендер', trait:'Колоссальный размах', unlockLevel:1, description:'Огромная дальность и сокрушительный тяжёлый удар.' },
  greatsword_maul: { classId:'greatsword', name:'Молот печатей', trait:'Пролом', unlockLevel:5, description:'Медленные тяжёлые удары ненадолго оглушают босса.' },
  greatsword_cleaver: { classId:'greatsword', name:'Клинок мясника', trait:'Быстрый разруб', unlockLevel:12, description:'Короткая дальность, но значительно быстрее серии.' },
  rogue_twins: { classId:'rogue', name:'Парные кинжалы', trait:'Шквал', unlockLevel:1, description:'Каждая третья лёгкая атака получает большой бонус.' },
  rogue_fang: { classId:'rogue', name:'Клык ночи', trait:'Ассасин', unlockLevel:5, description:'Особенно силён при ударах в спину.' },
  rogue_chakram: { classId:'rogue', name:'Сумрачный чакрам', trait:'Бросок', unlockLevel:12, description:'Тяжёлая атака выпускает дальний режущий снаряд.' },
  spearman_spear: { classId:'spearman', name:'Копьё стража', trait:'Дальний выпад', unlockLevel:1, description:'Самая стабильная дистанция боя.' },
  spearman_halberd: { classId:'spearman', name:'Алебарда разлома', trait:'Двойная волна', unlockLevel:5, description:'Тяжёлая атака посылает волны в обе стороны.' },
  spearman_lance: { classId:'spearman', name:'Лунная пика', trait:'Воздушный таран', unlockLevel:12, description:'Очень дальняя и мощная тяжёлая атака в воздухе.' },
  berserker_axe: { classId:'berserker', name:'Топор ярости', trait:'Натиск', unlockLevel:1, description:'Сбалансированное оружие берсерка.' },
  berserker_maul: { classId:'berserker', name:'Крушитель', trait:'Дробящий удар', unlockLevel:5, description:'Крайне медленный удар с огромным уроном и оглушением.' },
  berserker_claws: { classId:'berserker', name:'Звериные когти', trait:'Безумная серия', unlockLevel:12, description:'Очень быстрые короткие атаки; каждая пятая усилена.' },
  ashmage_staff: { classId:'ashmage', name:'Пепельный посох', trait:'Фокус', unlockLevel:1, description:'Стабильные одиночные заклинания.' },
  ashmage_tome: { classId:'ashmage', name:'Том разлома', trait:'Расщепление', unlockLevel:5, description:'Каждое третье лёгкое заклинание разделяется.' },
  ashmage_censer: { classId:'ashmage', name:'Кадило пустоты', trait:'Веер сфер', unlockLevel:12, description:'Тяжёлое заклинание выпускает широкий веер снарядов.' },
};
const DEFAULT_WEAPON = Object.fromEntries(Object.keys(CLASS_META).map((classId) => [classId, Object.keys(WEAPON_META).find((id) => WEAPON_META[id].classId === classId)]));
const ARMOR_META = {
  ashen:{name:'Пепел',color:'#8c806d'}, ivory:{name:'Кость',color:'#d8ccb3'}, crimson:{name:'Багрянец',color:'#a74450'}, moss:{name:'Мох',color:'#738568'},
  moon:{name:'Луна',color:'#7189b7'}, violet:{name:'Пустота',color:'#8b63a0'}, ember:{name:'Угли',color:'#bc613b'}, void:{name:'Чернота',color:'#38333f'},
};
const AURA_META = { ash:{name:'Пепельный след',color:'#b5aa96'}, sparks:{name:'Искры',color:'#e38a4c'}, mist:{name:'Лунный туман',color:'#8baad2'}, runes:{name:'Руны пустоты',color:'#ae75c4'} };
const ACHIEVEMENTS = [
  {id:'first_seal',name:'Первая печать',description:'Пройди хотя бы одну стадию.',stat:'highestStage',goal:2,reward:250},
  {id:'first_lord',name:'Первый владыка',description:'Доберись до стадии 11.',stat:'highestStage',goal:11,reward:600},
  {id:'deep_run',name:'Глубокий забег',description:'Доберись до стадии 26.',stat:'highestStage',goal:26,reward:1200},
  {id:'half_hundred',name:'Половина сотни',description:'Доберись до стадии 51.',stat:'highestStage',goal:51,reward:2500},
  {id:'ashen_hundred',name:'Пепельная сотня',description:'Победи финального босса.',stat:'highestStage',goal:101,reward:6000},
  {id:'parry_student',name:'Ученик зеркала',description:'Сделай 20 успешных парирований.',stat:'parries',goal:20,reward:500},
  {id:'parry_master',name:'Безупречная гарда',description:'Сделай 150 успешных парирований.',stat:'parries',goal:150,reward:1800},
  {id:'boss_hunter',name:'Охотник на владык',description:'Победи 50 боссов.',stat:'bosses',goal:50,reward:1600},
  {id:'untouched',name:'Без единой царапины',description:'Пройди 10 стадий без полученного урона.',stat:'noHitStages',goal:10,reward:1400},
  {id:'damage_oath',name:'Тяжесть клятвы',description:'Нанеси суммарно 100 000 урона.',stat:'damage',goal:100000,reward:2200},
];

const BOX_PRICE = 20000;
const BOX_OPEN_TIME = 10 * 60 * 1000;
const BOX_SLOT_COUNT = 3;
const BOX_SKILL_VALUES = {
  hp: [1, 1, 1], stamina: [10, 18, 30], staminaRegen: [0.08, 0.14, 0.22],
  speed: [0.04, 0.07, 0.11], jump: [0.05, 0.09, 0.14],
  lightDamage: [0.06, 0.11, 0.18], heavyDamage: [0.07, 0.13, 0.21],
  lightCost: [0.06, 0.11, 0.17], heavyCost: [0.06, 0.11, 0.17], rollCost: [0.06, 0.11, 0.17],
  parryWindow: [0.018, 0.032, 0.05], range: [0.06, 0.11, 0.18],
  rollInvulnerability: [0.025, 0.045, 0.07], classPower: [0.08, 0.14, 0.22],
};

const CLASS_SKILL_FAMILIES = {
  swordsman: [
    ['keen_edge','lightDamage','Острая кромка'], ['royal_weight','heavyDamage','Королевский вес'], ['deep_breath','stamina','Глубокий вдох'],
    ['calm_pulse','staminaRegen','Спокойный пульс'], ['duelist_step','speed','Шаг дуэлянта'], ['swift_cut','lightCost','Быстрый разрез'],
    ['measured_blow','heavyCost','Выверенный удар'], ['ash_dodge','rollCost','Уход в пепел'], ['mirror_guard','parryWindow','Зеркальная защита'],
    ['long_guard','range','Длинная гарда'], ['silver_turn','rollInvulnerability','Серебряный оборот'], ['changing_rhythm','classPower','Меняющийся ритм'],
  ],
  greatsword: [
    ['giant_blood','hp','Кровь великана'], ['iron_lungs','stamina','Железные лёгкие'], ['furnace_breath','staminaRegen','Дыхание горна'],
    ['colossus_stride','speed','Поступь колосса'], ['shoulder_cut','lightDamage','Рубящий толчок'], ['falling_star','heavyDamage','Падающая звезда'],
    ['patient_swing','heavyCost','Терпеливый замах'], ['stone_roll','rollCost','Каменный перекат'], ['anvil_guard','parryWindow','Защита наковальни'],
    ['long_hilt','range','Длинная рукоять'], ['unyielding_turn','rollInvulnerability','Несгибаемый оборот'], ['armor_breaker','classPower','Сокрушитель брони'],
  ],
  rogue: [
    ['hidden_reserve','stamina','Скрытый запас'], ['night_breath','staminaRegen','Дыхание ночи'], ['rat_step','speed','Крысиный шаг'],
    ['roof_runner','jump','Бегущий по крышам'], ['quick_sting','lightDamage','Быстрое жало'], ['deep_stab','heavyDamage','Глубокий прокол'],
    ['economy_cut','lightCost','Экономный надрез'], ['smoke_roll','rollCost','Дымный перекат'], ['dagger_guard','parryWindow','Кинжальная защита'],
    ['extended_grip','range','Удлинённый хват'], ['shadow_phase','rollInvulnerability','Фаза тени'], ['perfect_backstab','classPower','Идеальный удар в спину'],
  ],
  spearman: [
    ['warden_blood','hp','Кровь стража'], ['march_reserve','stamina','Запас марша'], ['steady_march','staminaRegen','Ровный марш'],
    ['long_step','speed','Длинный шаг'], ['first_thrust','lightDamage','Первый выпад'], ['impaling_fall','heavyDamage','Пробивающее падение'],
    ['short_thrust','lightCost','Короткий выпад'], ['balanced_pole','heavyCost','Равновесие древка'], ['shaft_turn','rollCost','Оборот древка'],
    ['cross_guard','parryWindow','Поперечная защита'], ['endless_reach','range','Бесконечная грань'], ['sky_hunter','classPower','Небесный охотник'],
  ],
  berserker: [
    ['scarred_hide','hp','Шкура в шрамах'], ['rage_reserve','stamina','Запас ярости'], ['hot_blood','staminaRegen','Горячая кровь'],
    ['predator_step','speed','Шаг хищника'], ['first_roar','lightDamage','Первый рёв'], ['two_hand_wrath','heavyDamage','Гнев двух рук'],
    ['wild_economy','heavyCost','Экономия зверя'], ['beast_roll','rollCost','Звериный перекат'], ['axe_guard','parryWindow','Защита топорищем'],
    ['wide_arc','range','Широкая дуга'], ['rage_veil','rollInvulnerability','Завеса ярости'], ['last_fury','classPower','Последняя ярость'],
  ],
  ashmage: [
    ['ash_vessel','stamina','Сосуд пепла'], ['ember_current','staminaRegen','Поток углей'], ['mist_step','speed','Шаг сквозь дым'],
    ['levitation','jump','Левитация'], ['spark_word','lightDamage','Слово искры'], ['cinder_orb','heavyDamage','Сфера золы'],
    ['quiet_spell','lightCost','Тихое заклинание'], ['sealed_spell','heavyCost','Запечатанное слово'], ['phase_cost','rollCost','Цена фазы'],
    ['sigil_guard','parryWindow','Защитный сигил'], ['void_phase','rollInvulnerability','Фаза пустоты'], ['concentrated_ash','classPower','Сгущённый пепел'],
  ],
};

const SKILL_RANKS = ['I', 'II', 'III'];
function skillDescription(stat, value, classId) {
  const percent = `${Math.round(value * 100)}%`;
  const descriptions = {
    hp: `+${value} к максимальному здоровью.`, stamina: `+${value} к запасу выносливости.`,
    staminaRegen: `Восстановление выносливости быстрее на ${percent}.`, speed: `Скорость движения выше на ${percent}.`,
    jump: `Высота прыжка выше на ${percent}.`, lightDamage: `Лёгкие атаки сильнее на ${percent}.`,
    heavyDamage: `Тяжёлые атаки сильнее на ${percent}.`, lightCost: `Лёгкие атаки дешевле на ${percent}.`,
    heavyCost: `Тяжёлые атаки дешевле на ${percent}.`, rollCost: `Перекаты дешевле на ${percent}.`,
    parryWindow: `Окно парирования длиннее на ${(value * 1000).toFixed(0)} мс.`, range: `Дальность атак выше на ${percent}.`,
    rollInvulnerability: `Неуязвимость переката длиннее на ${(value * 1000).toFixed(0)} мс.`,
  };
  if (stat !== 'classPower') return descriptions[stat];
  return {
    swordsman: `Чередование лёгкой и тяжёлой атак сильнее на ${percent}.`,
    greatsword: `Тяжёлый удар по оглушённому боссу сильнее на ${percent}.`,
    rogue: `Удар в спину сильнее на ${percent}.`, spearman: `Воздушные атаки сильнее на ${percent}.`,
    berserker: `Урон при 1 HP выше на ${percent}.`, ashmage: `Урон магии выше на ${percent}.`,
  }[classId];
}

const BOX_SKILLS = [];
const BOX_SKILL_BY_ID = new Map();
for (const [classId, families] of Object.entries(CLASS_SKILL_FAMILIES)) {
  for (const [key, stat, name] of families) BOX_SKILL_VALUES[stat].forEach((value, index) => {
    const skill = { id: `${classId}_${key}_${index + 1}`, classId, stat, value, rank: index + 1, name: `${name} ${SKILL_RANKS[index]}`, description: skillDescription(stat, value, classId) };
    BOX_SKILLS.push(skill); BOX_SKILL_BY_ID.set(skill.id, skill);
  });
}

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
  ownedSkills: [],
  equippedSkills: {},
  boxSlots: [null, null, null],
  unlockedWeapons: Object.values(DEFAULT_WEAPON),
  selectedWeapons: { ...DEFAULT_WEAPON },
  classProgress: Object.fromEntries(Object.keys(CLASS_META).map((classId) => [classId, { xp: 0 }])),
  appearance: { armor: 'ashen', aura: 'ash' },
  stats: { runs: 0, highestStage: 1, parries: 0, bosses: 0, noHitStages: 0, damage: 0 },
  achievements: [],
  daily: null,
};

const dom = Object.fromEntries([
  'homeScreen', 'lobbyScreen', 'gameScreen', 'serverState', 'nameInput', 'roomCodeInput',
  'createRoomButton', 'joinRoomButton', 'homeError', 'lobbyError', 'lobbyCount', 'roomCodeText',
  'copyCodeButton', 'squadGrid', 'lobbyHint', 'startGameButton', 'leaveLobbyButton', 'brandButton',
  'gameCanvas', 'hudRoomCode', 'timerText', 'bossName', 'stageText', 'bossHealthBar', 'bossHealthText',
  'squadHud', 'playerVitals', 'heartsBar', 'staminaBar', 'controlsTip', 'toastStack',
  'perkOverlay', 'perkKicker', 'perkSubtitle', 'perkGrid', 'waitingPerks', 'shopButton', 'shopOverlay',
  'closeShopButton', 'currencyCount', 'shopCurrency', 'classShop', 'skinShop', 'boxBuyButton', 'boxSlots',
  'skillClassTabs', 'skillCollection', 'skillCollectionCount', 'equippedSkillCount', 'weaponShop', 'classLevelText', 'appearanceShop',
  'challengeGrid', 'achievementGrid', 'routeOverlay', 'routeGrid', 'routeSubtitle', 'routeWaiting',
  'teamPowerBar', 'teamPowerText', 'modifierText', 'bossPhaseText', 'resultOverlay',
  'resultKicker', 'resultTitle', 'resultSubtitle', 'runSummary', 'resultStats', 'rematchButton', 'resultExitButton',
].map((id) => [id, document.querySelector(`#${id}`)]));

const ctx = dom.gameCanvas.getContext('2d');
const screens = [dom.homeScreen, dom.lobbyScreen, dom.gameScreen];
const input = { left: false, right: false, jump: false, light: false, heavy: false, parry: false, roll: false, team: false };

let profile = loadProfile();
let selectedClass = profile.unlockedClasses.includes('swordsman') ? 'swordsman' : profile.unlockedClasses[0];
let skillFilterClass = selectedClass;
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
let boxTimerInterval = null;
let currentRouteKey = '';
let previousMeHp = null;
let screenShake = 0;
let hitStopUntil = 0;
let bossMusicTimer = null;
let bossMusicKey = '';
let bossMusicStep = 0;

function dateKey() { return new Date().toISOString().slice(0, 10); }
function freshDaily() { return { date: dateKey(), stages: 0, parries: 0, damage: 0, claimed: [] }; }
function xpForLevel(level) { const steps = Math.max(0, level - 1); return steps * 100 + 40 * steps * (steps + 1); }
function levelFromXp(xp) { let level = 1; while (level < 50 && xp >= xpForLevel(level + 1)) level += 1; return level; }
function classLevel(classId) { return levelFromXp(profile.classProgress?.[classId]?.xp || 0); }

function loadProfile() {
  try {
    const saved = JSON.parse(localStorage.getItem('riftRaidAshenProfile') || '{}');
    const unlockedClasses = Array.isArray(saved.unlockedClasses) ? saved.unlockedClasses.filter((id) => CLASS_META[id]) : [];
    const unlockedSkins = Array.isArray(saved.unlockedSkins) ? saved.unlockedSkins.filter((id) => SKIN_META[id]) : [];
    const ownedSkills = [...new Set(Array.isArray(saved.ownedSkills) ? saved.ownedSkills.filter((id) => BOX_SKILL_BY_ID.has(id)) : [])];
    const classProgress = Object.fromEntries(Object.keys(CLASS_META).map((classId) => [classId, { xp: Math.max(0, Math.floor(Number(saved.classProgress?.[classId]?.xp) || 0)) }]));
    const unlockedWeapons = Object.entries(WEAPON_META).filter(([, weapon]) => levelFromXp(classProgress[weapon.classId].xp) >= weapon.unlockLevel).map(([id]) => id);
    if (!unlockedClasses.includes('swordsman')) unlockedClasses.unshift('swordsman');
    if (!unlockedSkins.includes('iron')) unlockedSkins.unshift('iron');
    const equippedSkills = {};
    for (const classId of Object.keys(CLASS_META)) {
      equippedSkills[classId] = [...new Set(Array.isArray(saved.equippedSkills?.[classId]) ? saved.equippedSkills[classId] : [])]
        .filter((id) => ownedSkills.includes(id) && BOX_SKILL_BY_ID.get(id)?.classId === classId).slice(0, 3);
    }
    const savedSlots = Array.isArray(saved.boxSlots) ? saved.boxSlots : [];
    const boxSlots = Array.from({ length: BOX_SLOT_COUNT }, (_, index) => {
      const endsAt = Number(savedSlots[index]?.endsAt);
      return Number.isFinite(endsAt) && endsAt > 0 ? { endsAt } : null;
    });
    const selectedWeapons = {};
    for (const classId of Object.keys(CLASS_META)) {
      const candidate = saved.selectedWeapons?.[classId];
      selectedWeapons[classId] = unlockedWeapons.includes(candidate) && WEAPON_META[candidate]?.classId === classId ? candidate : DEFAULT_WEAPON[classId];
    }
    const appearance = {
      armor: ARMOR_META[saved.appearance?.armor] ? saved.appearance.armor : 'ashen',
      aura: AURA_META[saved.appearance?.aura] ? saved.appearance.aura : 'ash',
    };
    const stats = {
      runs: Math.max(0, Number(saved.stats?.runs) || 0), highestStage: Math.max(1, Number(saved.stats?.highestStage) || 1),
      parries: Math.max(0, Number(saved.stats?.parries) || 0), bosses: Math.max(0, Number(saved.stats?.bosses) || 0),
      noHitStages: Math.max(0, Number(saved.stats?.noHitStages) || 0), damage: Math.max(0, Number(saved.stats?.damage) || 0),
    };
    const daily = saved.daily?.date === dateKey() ? { ...freshDaily(), ...saved.daily, claimed: Array.isArray(saved.daily.claimed) ? saved.daily.claimed : [] } : freshDaily();
    return {
      currency: Math.max(0, Math.floor(Number(saved.currency) || 0)),
      unlockedClasses,
      unlockedSkins,
      selectedSkin: unlockedSkins.includes(saved.selectedSkin) ? saved.selectedSkin : 'iron',
      ownedSkills,
      equippedSkills,
      boxSlots,
      unlockedWeapons,
      selectedWeapons,
      classProgress,
      appearance,
      stats,
      achievements: [...new Set(Array.isArray(saved.achievements) ? saved.achievements.filter((id) => ACHIEVEMENTS.some((achievement) => achievement.id === id)) : [])],
      daily,
    };
  } catch {
    return structuredClone(DEFAULT_PROFILE);
  }
}

function saveProfile() {
  localStorage.setItem('riftRaidAshenProfile', JSON.stringify(profile));
  renderProfile();
}

function equippedForClass(classId = selectedClass) { return profile.equippedSkills[classId] || []; }
function classPayload(classId = selectedClass) {
  return { classId, skin: profile.selectedSkin, weaponId: profile.selectedWeapons[classId] || DEFAULT_WEAPON[classId], appearance: profile.appearance, equippedSkills: equippedForClass(classId) };
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
  skillFilterClass = id;
  renderProfile();
  if (notify && lobbyState) socket.emit('select-class', classPayload());
}

function availableBoxSkills() {
  const owned = new Set(profile.ownedSkills);
  return BOX_SKILLS.filter((skill) => profile.unlockedClasses.includes(skill.classId) && !owned.has(skill.id));
}

function formatCountdown(milliseconds) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function renderBoxSlots() {
  if (!dom.boxSlots || !dom.boxBuyButton) return;
  const now = Date.now();
  dom.boxSlots.innerHTML = profile.boxSlots.map((slot, index) => {
    if (!slot) return `<article class="box-slot empty"><span>0${index + 1}</span><i>◇</i><strong>СВОБОДНЫЙ СЛОТ</strong><small>Ковчег можно открыть здесь</small></article>`;
    const remaining = slot.endsAt - now;
    const ready = remaining <= 0;
    const progress = Math.max(0, Math.min(1, 1 - remaining / BOX_OPEN_TIME));
    return `<article class="box-slot ${ready ? 'ready' : 'opening'}"><span>0${index + 1}</span><i>◆</i><strong>${ready ? 'КОВЧЕГ ГОТОВ' : formatCountdown(remaining)}</strong>
      <small>${ready ? 'Внутри гарантирован новый навык' : 'Распечатывание продолжается'}</small><div class="box-progress"><b style="width:${progress * 100}%"></b></div>
      ${ready ? `<button type="button" data-claim-box="${index}">ЗАБРАТЬ НАВЫК</button>` : ''}</article>`;
  }).join('');
  const freeSlot = profile.boxSlots.some((slot) => !slot);
  const hasRewards = availableBoxSkills().length > 0;
  dom.boxBuyButton.disabled = profile.currency < BOX_PRICE || !freeSlot || !hasRewards;
  dom.boxBuyButton.innerHTML = hasRewards ? `<span>КУПИТЬ КОВЧЕГ</span><b>${BOX_PRICE} ¤</b>` : '<span>КОЛЛЕКЦИЯ СОБРАНА</span><b>216 / 216</b>';
  dom.boxSlots.querySelectorAll('[data-claim-box]').forEach((button) => button.addEventListener('click', () => claimBox(Number(button.dataset.claimBox))));
}

function purchaseBox() {
  const slotIndex = profile.boxSlots.findIndex((slot) => !slot);
  if (slotIndex < 0) return toast('Все три слота уже заняты', 'warn');
  if (profile.currency < BOX_PRICE) return toast('Нужно 20 000 пепла', 'warn');
  if (!availableBoxSkills().length) return toast('Все доступные навыки уже собраны', 'gold');
  profile.currency -= BOX_PRICE;
  profile.boxSlots[slotIndex] = { endsAt: Date.now() + BOX_OPEN_TIME };
  saveProfile();
  toast(`Ковчег помещён в слот ${slotIndex + 1}`, 'gold');
}

function claimBox(slotIndex) {
  const slot = profile.boxSlots[slotIndex];
  if (!slot || slot.endsAt > Date.now()) return;
  const candidates = availableBoxSkills();
  profile.boxSlots[slotIndex] = null;
  if (!candidates.length) {
    profile.currency += BOX_PRICE;
    saveProfile();
    return toast('Новых навыков не осталось — стоимость возвращена', 'gold');
  }
  const randomValue = new Uint32Array(1);
  window.crypto.getRandomValues(randomValue);
  const skill = candidates[Math.floor((randomValue[0] / 4294967296) * candidates.length)];
  profile.ownedSkills.push(skill.id);
  const equipped = profile.equippedSkills[skill.classId] || (profile.equippedSkills[skill.classId] = []);
  if (equipped.length < 3) equipped.push(skill.id);
  skillFilterClass = skill.classId;
  saveProfile();
  if (lobbyState && selectedClass === skill.classId) socket.emit('select-class', classPayload());
  toast(`${CLASS_META[skill.classId].label}: ${skill.name}`, 'gold');
}

function renderSkillCollection() {
  if (!dom.skillCollection || !dom.skillClassTabs) return;
  if (!profile.unlockedClasses.includes(skillFilterClass)) skillFilterClass = profile.unlockedClasses[0] || 'swordsman';
  const owned = new Set(profile.ownedSkills);
  const equipped = equippedForClass(skillFilterClass);
  dom.skillCollectionCount.textContent = `${profile.ownedSkills.length} / ${BOX_SKILLS.length}`;
  dom.equippedSkillCount.textContent = `${equipped.length} / 3 · ${CLASS_META[skillFilterClass].label}`;
  dom.skillClassTabs.innerHTML = profile.unlockedClasses.map((classId) => `<button type="button" class="${classId === skillFilterClass ? 'active' : ''}" data-skill-class="${classId}" style="--tab-color:${CLASS_META[classId].color}">${CLASS_META[classId].icon} ${CLASS_META[classId].label}</button>`).join('');
  dom.skillCollection.innerHTML = BOX_SKILLS.filter((skill) => skill.classId === skillFilterClass).map((skill) => {
    const isOwned = owned.has(skill.id);
    const isEquipped = equipped.includes(skill.id);
    return `<article class="legacy-skill ${isOwned ? 'owned' : 'unknown'} ${isEquipped ? 'equipped' : ''}" style="--skill-color:${CLASS_META[skill.classId].color}">
      <span class="legacy-rank">${SKILL_RANKS[skill.rank - 1]}</span><i>${isOwned ? CLASS_META[skill.classId].icon : '?'}</i>
      <div><strong>${isOwned ? skill.name : 'НЕИЗВЕСТНОЕ НАСЛЕДИЕ'}</strong><small>${isOwned ? skill.description : 'Открывается из Пепельного ковчега'}</small></div>
      <button type="button" data-toggle-skill="${skill.id}" ${isOwned ? '' : 'disabled'}>${isEquipped ? 'СНЯТЬ' : isOwned ? 'ЭКИПИРОВАТЬ' : 'ЗАКРЫТО'}</button></article>`;
  }).join('');
  dom.skillClassTabs.querySelectorAll('[data-skill-class]').forEach((button) => button.addEventListener('click', () => { skillFilterClass = button.dataset.skillClass; renderSkillCollection(); }));
  dom.skillCollection.querySelectorAll('[data-toggle-skill]:not(:disabled)').forEach((button) => button.addEventListener('click', () => toggleSkill(button.dataset.toggleSkill)));
}

function toggleSkill(id) {
  const skill = BOX_SKILL_BY_ID.get(id);
  if (!skill || !profile.ownedSkills.includes(id)) return;
  const equipped = profile.equippedSkills[skill.classId] || (profile.equippedSkills[skill.classId] = []);
  const index = equipped.indexOf(id);
  if (index >= 0) equipped.splice(index, 1);
  else {
    if (equipped.length >= 3) return toast('Можно экипировать только три навыка на класс', 'warn');
    equipped.push(id);
  }
  saveProfile();
  if (lobbyState && selectedClass === skill.classId) socket.emit('select-class', classPayload());
}

function renderWeapons() {
  if (!dom.weaponShop) return;
  const level = classLevel(selectedClass);
  const xp = profile.classProgress[selectedClass]?.xp || 0;
  const currentFloor = xpForLevel(level);
  const nextFloor = level < 50 ? xpForLevel(level + 1) : currentFloor;
  if (dom.classLevelText) dom.classLevelText.textContent = level >= 50 ? `УРОВЕНЬ ${level} · МАКС.` : `УРОВЕНЬ ${level} · ${xp - currentFloor} / ${nextFloor - currentFloor} XP`;
  dom.weaponShop.innerHTML = Object.entries(WEAPON_META).filter(([, weapon]) => weapon.classId === selectedClass).map(([id, weapon]) => {
    const unlocked = level >= weapon.unlockLevel;
    const selected = profile.selectedWeapons[selectedClass] === id;
    return `<article class="weapon-item ${selected ? 'selected' : ''} ${unlocked ? '' : 'locked'}" data-weapon="${id}"><span>†</span><div><strong>${weapon.name}</strong><b>${weapon.trait}</b><small>${weapon.description}</small></div><button type="button" ${unlocked ? '' : 'disabled'}>${selected ? 'ВЫБРАНО' : unlocked ? 'ВЫБРАТЬ' : `НУЖЕН УРОВЕНЬ ${weapon.unlockLevel}`}</button></article>`;
  }).join('');
  dom.weaponShop.querySelectorAll('[data-weapon]').forEach((item) => item.addEventListener('click', () => {
    const id = item.dataset.weapon;
    const weapon = WEAPON_META[id];
    if (classLevel(weapon.classId) < weapon.unlockLevel) return toast(`Нужен ${weapon.unlockLevel}-й уровень класса`, 'warn');
    profile.selectedWeapons[weapon.classId] = id;
    saveProfile();
    if (lobbyState && selectedClass === weapon.classId) socket.emit('select-class', classPayload());
  }));
}

function renderAppearance() {
  if (!dom.appearanceShop) return;
  dom.appearanceShop.innerHTML = `<div class="appearance-group"><strong>ЦВЕТ ДОСПЕХА</strong><div>${Object.entries(ARMOR_META).map(([id, item]) => `<button type="button" class="appearance-swatch ${profile.appearance.armor === id ? 'selected' : ''}" data-armor="${id}" style="--swatch:${item.color}" title="${item.name}"><i></i><span>${item.name}</span></button>`).join('')}</div></div>
    <div class="appearance-group"><strong>СЛЕД ДВИЖЕНИЯ</strong><div>${Object.entries(AURA_META).map(([id, item]) => `<button type="button" class="aura-choice ${profile.appearance.aura === id ? 'selected' : ''}" data-aura="${id}" style="--swatch:${item.color}"><i></i><span>${item.name}</span></button>`).join('')}</div></div>`;
  dom.appearanceShop.querySelectorAll('[data-armor]').forEach((button) => button.addEventListener('click', () => { profile.appearance.armor = button.dataset.armor; saveProfile(); if (lobbyState) socket.emit('select-class', classPayload()); }));
  dom.appearanceShop.querySelectorAll('[data-aura]').forEach((button) => button.addEventListener('click', () => { profile.appearance.aura = button.dataset.aura; saveProfile(); if (lobbyState) socket.emit('select-class', classPayload()); }));
}

function dailyTasks() {
  return [
    { id:'stages', name:'Разрушитель печатей', description:'Пройди суммарно 8 стадий сегодня.', goal:8, value:profile.daily.stages, reward:500 },
    { id:'parries', name:'Зеркальная смена', description:'Сделай 12 успешных парирований сегодня.', goal:12, value:profile.daily.parries, reward:650 },
    { id:'damage', name:'Тяжёлая работа', description:'Нанеси 10 000 урона сегодня.', goal:10000, value:profile.daily.damage, reward:800 },
  ];
}

function renderProgression() {
  if (!dom.challengeGrid || !dom.achievementGrid) return;
  if (profile.daily.date !== dateKey()) profile.daily = freshDaily();
  dom.challengeGrid.innerHTML = dailyTasks().map((task) => {
    const complete = task.value >= task.goal;
    const claimed = profile.daily.claimed.includes(task.id);
    return `<article class="progress-item ${complete ? 'complete' : ''}"><div><strong>${task.name}</strong><small>${task.description}</small></div><b>${Math.min(task.value, task.goal)} / ${task.goal}</b><span>${claimed ? 'ПОЛУЧЕНО' : complete ? `+${task.reward} ¤` : 'В ПРОЦЕССЕ'}</span></article>`;
  }).join('');
  dom.achievementGrid.innerHTML = ACHIEVEMENTS.map((achievement) => {
    const value = profile.stats[achievement.stat] || 0;
    const unlocked = profile.achievements.includes(achievement.id);
    return `<article class="progress-item achievement ${unlocked ? 'complete' : ''}"><div><strong>${achievement.name}</strong><small>${achievement.description}</small></div><b>${Math.min(value, achievement.goal)} / ${achievement.goal}</b><span>${unlocked ? 'ВЫПОЛНЕНО' : `+${achievement.reward} ¤`}</span></article>`;
  }).join('');
}

function applyRunProgress(data) {
  const me = data.players.find((player) => player.id === socket.id);
  if (!me) return;
  if (profile.daily.date !== dateKey()) profile.daily = freshDaily();
  profile.stats.runs += 1;
  profile.stats.highestStage = Math.max(profile.stats.highestStage, data.result === 'victory' ? 101 : data.stageReached);
  profile.stats.parries += me.parries || 0;
  profile.stats.bosses += me.bossesDefeated || 0;
  profile.stats.noHitStages += me.noHitStages || 0;
  profile.stats.damage += me.damageDone || 0;
  profile.daily.stages += me.bossesDefeated || 0;
  profile.daily.parries += me.parries || 0;
  profile.daily.damage += me.damageDone || 0;
  const oldLevel = classLevel(me.classId);
  const xpEarned = (me.bossesDefeated || 0) * 90 + Math.floor((me.damageDone || 0) / 250) + (data.result === 'victory' ? 500 : 0);
  profile.classProgress[me.classId].xp += xpEarned;
  const newLevel = classLevel(me.classId);
  profile.unlockedWeapons = Object.entries(WEAPON_META).filter(([, weapon]) => classLevel(weapon.classId) >= weapon.unlockLevel).map(([id]) => id);
  const unlockedNow = [];
  for (const achievement of ACHIEVEMENTS) {
    if (!profile.achievements.includes(achievement.id) && (profile.stats[achievement.stat] || 0) >= achievement.goal) {
      profile.achievements.push(achievement.id); profile.currency += achievement.reward; unlockedNow.push(achievement.name);
    }
  }
  for (const task of dailyTasks()) {
    if (task.value >= task.goal && !profile.daily.claimed.includes(task.id)) { profile.daily.claimed.push(task.id); profile.currency += task.reward; }
  }
  saveProfile();
  toast(`${CLASS_META[me.classId].label}: +${xpEarned} XP${newLevel > oldLevel ? ` · УРОВЕНЬ ${newLevel}` : ''}`, 'gold');
  if (unlockedNow.length) toast(`Достижение: ${unlockedNow.join(', ')}`, 'gold');
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
    skillFilterClass = id;
    saveProfile();
    if (lobbyState) socket.emit('select-class', classPayload());
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
    if (lobbyState) socket.emit('select-class', classPayload());
    toast(`${meta.label} экипировано`, 'gold');
  }));
  renderWeapons();
  renderAppearance();
  renderProgression();
  renderBoxSlots();
  renderSkillCollection();
}

function openShop() {
  renderShop();
  dom.shopOverlay.classList.add('active');
  dom.shopOverlay.setAttribute('aria-hidden', 'false');
  clearInterval(boxTimerInterval);
  boxTimerInterval = setInterval(renderBoxSlots, 1000);
}
function closeShop() {
  dom.shopOverlay.classList.remove('active');
  dom.shopOverlay.setAttribute('aria-hidden', 'true');
  clearInterval(boxTimerInterval);
  boxTimerInterval = null;
}

function enterLobby(room) {
  stopBossMusic();
  lobbyState = room;
  roomCode = room.code;
  gameState = null;
  dom.resultOverlay.classList.remove('active');
  dom.perkOverlay.classList.remove('active');
  dom.routeOverlay.classList.remove('active');
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
    const weapon = WEAPON_META[player.weaponId] || WEAPON_META[DEFAULT_WEAPON[player.classId]];
    const isMe = player.id === socket.id;
    cards.push(`<article class="squad-card ${isMe ? 'me' : ''}" style="--class-color:${meta.color}">
      <span class="slot-number">0${index + 1}</span>${player.isHost ? '<span class="host-chip">ХРАНИТЕЛЬ</span>' : ''}
      <div class="avatar-art"></div><div class="squad-info"><strong>${escapeHtml(player.name)}${isMe ? ' · ВЫ' : ''}</strong>
      <button type="button" ${isMe ? 'data-cycle-class' : 'disabled'}>${meta.label} · ${weapon.name}</button></div></article>`);
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
  socket.emit('create-room', { name: currentName(), ...classPayload() }, (response) => {
    setBusy(dom.createRoomButton, false, 'ОТКРЫТЬ РАЗЛОМ');
    if (!response?.ok) return showError(dom.homeError, response?.error || 'Не удалось открыть комнату');
    enterLobby(response.room);
  });
}

function joinRoom() {
  const code = dom.roomCodeInput.value.trim().toUpperCase();
  if (code.length !== 5) return showError(dom.homeError, 'Нужен пятизначный код');
  dom.joinRoomButton.disabled = true;
  socket.emit('join-room', { code, name: currentName(), ...classPayload() }, (response) => {
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
  stopBossMusic();
  socket.emit('leave-room');
  roomCode = '';
  lobbyState = gameState = null;
  resetInput();
  dom.resultOverlay.classList.remove('active');
  dom.perkOverlay.classList.remove('active');
  dom.routeOverlay.classList.remove('active');
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
  dom.bossName.textContent = state.boss ? `${state.boss.name} · УРОН ${state.boss.damage}` : 'ПУТЬ МЕЖДУ ПЕЧАТЯМИ';
  dom.bossPhaseText.textContent = `ФАЗА ${['I','II','III'][(state.boss?.phase || 1) - 1]}`;
  dom.modifierText.textContent = state.modifier?.name || '—';
  dom.teamPowerText.textContent = `${state.teamPower || 0}%`;
  dom.teamPowerBar.style.width = `${state.teamPower || 0}%`;
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
    const color = ARMOR_META[player.appearance?.armor]?.color || meta.color;
    const targeted = state.boss?.targetId === player.id;
    return `<div class="hud-player ${player.downed ? 'downed' : ''}" style="--class-color:${color}">
      <span class="hud-avatar">${targeted ? '!' : meta.short}</span><div><strong>${escapeHtml(player.name)}${player.id === socket.id ? ' · ВЫ' : ''}${targeted ? ' · ЦЕЛЬ' : ''}</strong>
      <span class="mini-bars"><span><i style="width:${player.hp / player.maxHp * 100}%"></i></span><span><i style="width:${player.stamina / player.maxStamina * 100}%"></i></span></span></div></div>`;
  }).join('');
}

function showRoutes(state) {
  if (!dom.routeOverlay) return;
  dom.perkOverlay.classList.remove('active');
  dom.perkOverlay.setAttribute('aria-hidden', 'true');
  dom.routeOverlay.classList.add('active');
  dom.routeOverlay.setAttribute('aria-hidden', 'false');
  const myVote = state.routeVotes?.[socket.id];
  const key = `${state.stage}:${myVote || ''}:${(state.routeOffer || []).map((route) => route.id).join(',')}:${Object.keys(state.routeVotes || {}).length}`;
  if (key === currentRouteKey) return;
  currentRouteKey = key;
  resetInput();
  const voteCounts = {};
  for (const routeId of Object.values(state.routeVotes || {})) voteCounts[routeId] = (voteCounts[routeId] || 0) + 1;
  const icons = { sanctuary:'♨', elite:'⚔', curse:'◇', forge:'⌁', oath:'✦', ruins:'⌂' };
  dom.routeGrid.innerHTML = (state.routeOffer || []).map((route) => `<button class="route-card ${myVote === route.id ? 'voted' : ''}" type="button" data-route="${route.id}" ${myVote ? 'disabled' : ''}><i>${icons[route.id] || '◇'}</i><h3>${route.name}</h3><p>${route.description}</p><b>${voteCounts[route.id] || 0} ГОЛОСОВ</b></button>`).join('');
  dom.routeWaiting.textContent = myVote ? 'ЖДЁМ РЕШЕНИЕ ОТРЯДА' : 'ВЫБЕРИ ОДИН ИЗ ТРЁХ ПУТЕЙ';
  dom.routeGrid.querySelectorAll('[data-route]:not(:disabled)').forEach((button) => button.addEventListener('click', () => {
    dom.routeGrid.querySelectorAll('button').forEach((item) => { item.disabled = true; });
    socket.emit('choose-route', button.dataset.route, (response) => { if (!response?.ok) { currentRouteKey = ''; toast(response?.error || 'Не удалось выбрать путь', 'danger'); } });
  }));
}

function showPerks(state) {
  const me = state.players.find((player) => player.id === socket.id);
  if (!me) return;
  const key = `${state.stage}:${me.perkChosen}:${me.perkOffer.map((perk) => perk.id).join(',')}`;
  dom.perkOverlay.classList.add('active');
  dom.perkOverlay.setAttribute('aria-hidden', 'false');
  dom.perkKicker.textContent = `СТАДИЯ ${state.stage} ПРОЙДЕНА`;
  if (key === currentPerkKey) return;
  currentPerkKey = key;
  resetInput();
  if (me.perkChosen) {
    dom.perkGrid.innerHTML = '';
    dom.perkSubtitle.textContent = 'Твой дар принят.';
    dom.waitingPerks.textContent = 'ЖДЁМ ВЫБОР ОСТАЛЬНЫХ СТРАННИКОВ';
    return;
  }
  dom.perkSubtitle.textContent = 'Остальные карты обратятся в пепел.';
  dom.waitingPerks.textContent = 'СДЕЛАЙ ВЫБОР';
  const rarityNames = { common: 'Обычный', rare: 'Редкий', epic: 'Эпический', legendary: 'Легендарный' };
  dom.perkGrid.innerHTML = me.perkOffer.map((perk) => `<button class="perk-card ${perk.rarity}${perk.classId ? ' class-perk' : ''}" type="button" data-perk="${perk.id}">
    <span class="perk-topline"><span class="perk-rarity">${rarityNames[perk.rarity]}</span>${perk.classId ? `<span class="perk-class">ТОЛЬКО: ${CLASS_META[perk.classId].label}</span>` : ''}</span><span class="perk-icon">${perk.icon}</span>
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
  stopBossMusic();
  applyRunProgress(data);
  const victory = data.result === 'victory';
  dom.resultKicker.textContent = victory ? 'СОТНЯ ЗАВЕРШЕНА' : 'ЗАБЕГ ОКОНЧЕН';
  dom.resultTitle.textContent = victory ? 'Пепельный король повержен' : 'Пламя погасло';
  dom.resultSubtitle.textContent = victory ? 'Все сто печатей разрушены.' : `Отряд достиг стадии ${data.stageReached}.`;
  dom.runSummary.innerHTML = `<div class="summary-box"><strong>${data.stagesCleared}</strong><span>СТАДИЙ ПРОЙДЕНО</span></div><div class="summary-box"><strong>${formatTime(data.elapsed)}</strong><span>ВРЕМЯ ЗАБЕГА</span></div>`;
  dom.resultStats.innerHTML = data.players.map((player, index) => `<div class="result-row"><span>#${index + 1}</span><strong>${escapeHtml(player.name)} · ${CLASS_META[player.classId].label}</strong><b>${player.damageDone} УРОНА · ${player.parries || 0} ПАРИРОВАНИЙ</b></div>`).join('');
  const host = lobbyState?.hostId === socket.id;
  dom.rematchButton.disabled = !host;
  dom.rematchButton.querySelector('span').textContent = host ? 'ВЕРНУТЬСЯ К КОСТРУ' : 'ЖДЁМ ХРАНИТЕЛЯ';
  dom.resultOverlay.classList.add('active');
  dom.resultOverlay.setAttribute('aria-hidden', 'false');
  playSound(victory ? 'victory' : 'defeat');
}

const KEY_MAP = {
  KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', KeyW: 'jump', ArrowUp: 'jump', Space: 'jump',
  KeyJ: 'light', KeyH: 'parry', KeyK: 'heavy', KeyL: 'roll', KeyU: 'team',
};

function setInput(key, pressed) {
  if (!(key in input)) return;
  input[key] = pressed;
  socket.emit('input', input);
  if (pressed && ['light', 'heavy', 'parry', 'roll', 'team'].includes(key)) playSound(key);
}
function resetInput() { Object.keys(input).forEach((key) => { input[key] = false; }); socket.emit('input', input); }

window.addEventListener('keydown', (event) => {
  const key = KEY_MAP[event.code];
  if (!key || !dom.gameScreen.classList.contains('active') || dom.perkOverlay.classList.contains('active') || dom.routeOverlay.classList.contains('active')) return;
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
  if (kind === 'team') [220,330,495].forEach((f,i) => tone(f,.22,.025,'triangle',i*.04));
  if (kind === 'phase') [150,110,82].forEach((f,i) => tone(f,.3,.03,'sawtooth',i*.06));
  if (kind === 'hit') tone(85,.1,.025,'square');
  if (kind === 'perk') [330,440,660].forEach((f,i) => tone(f,.25,.025,'triangle',i*.07));
  if (kind === 'victory') [261,329,392,523].forEach((f,i) => tone(f,.32,.03,'triangle',i*.1));
  if (kind === 'defeat') [160,125,90].forEach((f,i) => tone(f,.35,.02,'sawtooth',i*.13));
}

function stopBossMusic() { clearInterval(bossMusicTimer); bossMusicTimer = null; bossMusicKey = ''; }
function syncBossMusic(boss) {
  if (!boss) return stopBossMusic();
  const key = `${boss.bossId}:${boss.phase}`;
  if (key === bossMusicKey) return;
  stopBossMusic(); bossMusicKey = key; bossMusicStep = 0;
  const roots = [82,87,92,98,104,110,117,123,131,139];
  const root = roots[Math.max(0,(boss.tier||1)-1)];
  const pattern = boss.phase === 3 ? [1,1.5,1.25,2,1.5,2.5] : boss.phase === 2 ? [1,1.25,1.5,2] : [1,1.5,1.25,1];
  const pulse = () => { if (!dom.gameScreen.classList.contains('active')) return; const multiplier = pattern[bossMusicStep++ % pattern.length]; tone(root*multiplier,.18,.006,boss.phase===3?'square':'triangle'); };
  pulse(); bossMusicTimer = setInterval(pulse, boss.phase === 3 ? 330 : boss.phase === 2 ? 430 : 560);
}

function resizeCanvas() {
  const rect = dom.gameCanvas.getBoundingClientRect();
  canvasWidth = Math.max(1, rect.width); canvasHeight = Math.max(1, rect.height);
  pixelRatio = Math.min(1, 360 / canvasHeight);
  dom.gameCanvas.width = Math.round(canvasWidth * pixelRatio); dom.gameCanvas.height = Math.round(canvasHeight * pixelRatio);
  ctx.setTransform(pixelRatio,0,0,pixelRatio,0,0);
  ctx.imageSmoothingEnabled = false;
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
  ctx.fillStyle='#0b0a09';ctx.fillRect(Math.round(platform.x),Math.round(platform.y),Math.round(platform.w),Math.round(platform.h));
  ctx.fillStyle=theme.stone;ctx.fillRect(Math.round(platform.x),Math.round(platform.y),Math.round(platform.w),Math.min(18,platform.h));
  ctx.globalAlpha=.58;ctx.fillStyle=theme.trim;ctx.fillRect(Math.round(platform.x),Math.round(platform.y),Math.round(platform.w),4);ctx.globalAlpha=1;
  for(let x=Math.round(platform.x);x<platform.x+platform.w;x+=48){ctx.fillStyle='rgba(0,0,0,.24)';ctx.fillRect(x,platform.y+12,4,Math.min(18,platform.h-12));ctx.fillStyle='rgba(255,255,255,.035)';ctx.fillRect(x+6,platform.y+8,22,4);}
}

function drawAbyss(bounds,gaps,time) {
  if(!bounds)return;
  const zones=[{x:0,w:bounds.left},{x:bounds.right,w:world.width-bounds.right},...(gaps||[])];
  for(const zone of zones){if(zone.w<=0)continue;const g=ctx.createLinearGradient(0,world.floor-35,0,world.height);g.addColorStop(0,'rgba(7,5,9,.25)');g.addColorStop(.18,'rgba(3,2,5,.88)');g.addColorStop(1,'#010102');ctx.fillStyle=g;ctx.fillRect(zone.x,world.floor-35,zone.w,world.height-world.floor+35);ctx.strokeStyle='rgba(160,113,178,.38)';ctx.lineWidth=3;for(const edge of [zone.x,zone.x+zone.w]){ctx.beginPath();ctx.moveTo(edge,world.floor-2);ctx.lineTo(edge,world.height);ctx.stroke();}ctx.fillStyle='rgba(126,93,145,.09)';for(let i=0;i<5;i++){const y=world.floor+8+i*17+Math.sin(time*1.8+i)*5;ctx.beginPath();ctx.ellipse(zone.x+zone.w/2,y,Math.max(18,zone.w*.55),8+i*2,0,0,Math.PI*2);ctx.fill();}}
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
  const meta=CLASS_META[player.classId]; const skin=SKIN_META[player.skin]||SKIN_META.iron; const armor=ARMOR_META[player.appearance?.armor]?.color||meta.color;const aura=AURA_META[player.appearance?.aura]?.color||'#b5aa96';const weaponId=player.weaponId||DEFAULT_WEAPON[player.classId]; const isMe=player.id===socket.id; const bob=Math.round(Math.sin(time*8+player.slot)*Math.min(2,Math.abs(player.vx)/190));
  ctx.save(); ctx.translate(Math.round(player.x+21),Math.round(player.y+30+bob)); ctx.scale(player.facing||1,1);
  if(Math.abs(player.vx)>90||player.action==='roll'){ctx.fillStyle=aura;ctx.globalAlpha=.16;for(let i=0;i<4;i++)ctx.fillRect(-25-i*10-(Math.floor(time*18+i*3)%7),10+i*5,5+i%2*3,5+i%2*3);ctx.globalAlpha=1;}
  if(player.invulnerable&&Math.floor(time*18)%2===0)ctx.globalAlpha=.42;
  if(isMe){ctx.globalAlpha*=.18;ctx.fillStyle=armor;ctx.fillRect(-28,31,56,4);ctx.fillRect(-20,27,40,4);ctx.globalAlpha=player.invulnerable&&Math.floor(time*18)%2===0?.42:1;}
  if(player.downed){ctx.rotate(Math.PI/2.2);ctx.globalAlpha=.45;}
  if(player.action==='roll'){ctx.translate(0,9);ctx.rotate(Math.round((1-player.actionTimer/Math.max(.01,player.actionDuration))*4)*Math.PI/2);}
  ctx.fillStyle='#090807';ctx.fillRect(-15,17,12,17);ctx.fillRect(5,17,12,17);ctx.fillStyle='#332b22';ctx.fillRect(-17,29,15,5);ctx.fillRect(4,29,15,5);
  ctx.fillStyle='#15120f';ctx.fillRect(-20,-7,40,31);ctx.fillStyle=armor;ctx.fillRect(-16,-5,32,25);ctx.fillStyle='rgba(0,0,0,.34)';ctx.fillRect(-16,13,32,7);ctx.fillRect(-20,-1,6,17);ctx.fillRect(14,-1,6,17);
  ctx.fillStyle='#0e0d0b';ctx.fillRect(-17,-28,34,25);ctx.fillStyle=armor;ctx.fillRect(-14,-25,28,4);ctx.fillRect(-17,-19,4,12);ctx.fillRect(13,-19,4,12);ctx.fillStyle='#ded2b9';ctx.fillRect(3,-16,10,4);
  if(weaponId==='swordsman_bulwark'){ctx.fillStyle='#24201b';ctx.fillRect(-31,-10,17,27);ctx.fillStyle=skin.color;ctx.fillRect(-28,-7,11,20);}
  ctx.fillStyle=skin.color;
  if(weaponId.includes('chakram')){
    ctx.save();ctx.translate(31,-3);ctx.rotate(Math.PI/4);ctx.fillRect(-10,-10,20,4);ctx.fillRect(-10,6,20,4);ctx.fillRect(-10,-6,4,12);ctx.fillRect(6,-6,4,12);ctx.restore();
  }else if(weaponId.includes('claws')){
    for(let y=-12;y<=8;y+=9){ctx.fillRect(17,y,27,3);ctx.fillRect(-44,y,27,3);}
  }else if(weaponId.includes('maul')){
    ctx.fillStyle='#49382a';ctx.fillRect(16,-2,48,7);ctx.fillStyle=skin.color;ctx.fillRect(54,-20,25,37);
  }else if(weaponId==='ashmage_tome'){
    ctx.fillRect(23,-17,24,28);ctx.fillStyle='#171219';ctx.fillRect(27,-13,7,20);ctx.fillRect(37,-13,7,20);
  }else if(weaponId==='ashmage_censer'){
    ctx.fillStyle='#49382a';ctx.fillRect(17,-4,34,4);ctx.fillStyle=skin.color;ctx.fillRect(46,-12,18,21);ctx.fillRect(51,-18,8,6);
  }else if(player.classId==='spearman'){
    ctx.fillRect(17,-1,58,4);ctx.fillRect(70,-6,10,14);ctx.fillRect(80,-2,6,6);
  }else if(player.classId==='berserker'){
    ctx.fillStyle='#49382a';ctx.fillRect(16,-2,42,6);ctx.fillStyle=skin.color;ctx.fillRect(49,-17,22,25);ctx.fillRect(66,-12,10,15);
  }else if(player.classId==='ashmage'){
    ctx.fillStyle='#44372f';ctx.fillRect(18,-2,5,43);ctx.fillStyle=skin.color;ctx.fillRect(13,-10,15,12);ctx.fillRect(17,-15,7,5);ctx.fillStyle='#e0c8ef';ctx.fillRect(17,-6,7,4);
  }else{
    const length=player.classId==='greatsword'?62:player.classId==='rogue'?30:weaponId.includes('katana')?55:45;const width=player.classId==='greatsword'?8:weaponId.includes('katana')?3:4;ctx.fillRect(17,-9,length,width);ctx.fillStyle='#3b3025';ctx.fillRect(12,-7,10,width+4);if(player.classId==='rogue'){ctx.fillStyle=skin.color;ctx.fillRect(-45,-7,29,4);ctx.fillStyle='#3b3025';ctx.fillRect(-20,-9,8,8);}
  }
  if(player.action==='parry'||player.action==='parry_success'){ctx.fillStyle=player.parryActive?'#f1d58d':'#756542';ctx.fillRect(24,-18,4,36);ctx.fillRect(28,-12,4,24);}
  if(player.action==='light'||player.action==='heavy'){ctx.globalAlpha=.5;ctx.fillStyle=skin.color;const size=player.action==='heavy'?8:5;for(let i=0;i<6;i++)ctx.fillRect(28+i*8,-28+i*7,size,size);}
  ctx.restore();ctx.globalAlpha=1;
  ctx.textAlign='center';ctx.fillStyle=isMe?'#eee3cf':'rgba(225,217,201,.7)';ctx.font=`${isMe?700:600} 9px monospace`;ctx.fillText(player.downed?`${player.name} · ПАЛ`:player.name,Math.round(player.x+21),Math.round(player.y-18));
  if(gameState?.boss?.targetId===player.id&&!player.downed){ctx.fillStyle='#d65c69';ctx.fillRect(Math.round(player.x+16),Math.round(player.y-34),10,4);ctx.fillRect(Math.round(player.x+19),Math.round(player.y-39),4,4);}
}

function drawBoss(boss,time) {
  ctx.save();ctx.translate(Math.round(boss.x+61),Math.round(boss.y+75));ctx.scale(boss.facing||-1,1);const armor=boss.flash?'#eee1c8':boss.color||'#786143';const eye=boss.eye||'#dbad58';
  if(boss.phaseFlash){ctx.globalAlpha=.35;ctx.fillStyle=eye;ctx.fillRect(-92,-92,184,184);ctx.globalAlpha=1;}
  ctx.globalAlpha=.16;ctx.fillStyle=eye;ctx.fillRect(-76,-72,152,144);ctx.globalAlpha=1;ctx.fillStyle='rgba(0,0,0,.45)';ctx.fillRect(-66,68,132,12);
  ctx.fillStyle='#090706';ctx.fillRect(-44,42,25,31);ctx.fillRect(20,42,25,31);ctx.fillStyle='#201b17';ctx.fillRect(-50,65,35,10);ctx.fillRect(17,65,35,10);
  ctx.fillStyle='#15120f';ctx.fillRect(-58,-30,112,79);ctx.fillStyle=armor;ctx.fillRect(-49,-38,80,78);ctx.fillRect(31,-23,28,57);ctx.fillStyle='#302720';ctx.fillRect(-49,25,108,16);ctx.fillRect(-58,-15,13,46);
  ctx.fillStyle='#0f0d0b';ctx.fillRect(-44,-69,81,38);ctx.fillStyle=armor;ctx.fillRect(-38,-64,69,7);ctx.fillRect(-44,-57,8,24);ctx.fillRect(31,-55,9,22);ctx.fillRect(-25,-80,12,14);ctx.fillRect(19,-77,11,14);
  ctx.fillStyle=eye;ctx.fillRect(3,-52,25,7);ctx.fillStyle='#17100e';ctx.fillRect(10,-50,7,3);
  ctx.fillStyle='#4c392a';ctx.fillRect(45,-5,55,9);ctx.fillStyle=eye;ctx.fillRect(90,-18,14,40);ctx.fillRect(101,-11,16,25);
  ctx.fillStyle=armor;
  if(boss.bossId==='grave_knight'){ctx.fillRect(-41,-86,8,20);ctx.fillRect(28,-86,8,20);}
  if(boss.bossId==='ember_colossus'){ctx.fillRect(-72,-31,18,58);ctx.fillRect(54,-31,20,58);ctx.fillStyle=eye;ctx.fillRect(-62,18,12,12);}
  if(boss.bossId==='drowned_oracle'){ctx.fillRect(-38,-87,72,5);ctx.fillRect(-30,-94,6,11);ctx.fillRect(-4,-99,7,16);ctx.fillRect(23,-94,6,11);}
  if(boss.bossId==='bell_inquisitor'){ctx.fillRect(-53,-82,95,9);ctx.fillStyle=eye;ctx.fillRect(-9,47,18,23);}
  if(boss.bossId==='crimson_duelist'){ctx.fillRect(-57,-46,10,105);ctx.fillRect(-67,50,20,14);}
  if(boss.bossId==='iron_warden'){ctx.fillRect(-76,-45,25,29);ctx.fillRect(48,-45,25,29);ctx.fillRect(-70,33,123,8);}
  if(boss.bossId==='moon_huntress'){ctx.fillRect(-37,-91,8,26);ctx.fillRect(29,-91,8,26);ctx.fillStyle=eye;ctx.fillRect(-46,-88,11,7);ctx.fillRect(36,-88,11,7);}
  if(boss.bossId==='storm_sovereign'){for(let x=-48;x<=42;x+=18)ctx.fillRect(x,-84-Math.abs(x%36),8,22);}
  if(boss.bossId==='void_apostle'){ctx.fillStyle=eye;for(const [x,y] of [[-75,-58],[-82,8],[-58,61],[59,-63],[78,-2],[61,52]])ctx.fillRect(x,y,10,10);}
  if(boss.bossId==='ashen_king'){ctx.fillRect(-38,-91,75,7);for(let x=-35;x<=29;x+=16)ctx.fillRect(x,-103,8,15);ctx.fillStyle=eye;ctx.fillRect(-31,-108,9,8);ctx.fillRect(1,-111,9,11);ctx.fillRect(27,-108,9,8);}
  if((boss.phase||1)>=2){ctx.fillStyle=eye;ctx.fillRect(-52,39,105,5);}if((boss.phase||1)>=3){for(const [x,y] of [[-61,-66],[-68,4],[-50,62],[49,-69],[66,1],[51,60]])ctx.fillRect(x,y,6,6);}
  if(boss.stagger){ctx.fillStyle='#e7cf91';for(const [x,y] of [[-70,-60],[-82,-15],[-72,38],[-15,-88],[42,-76],[72,-40],[78,25],[35,70]])ctx.fillRect(x,y,7,7);}
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

function drawProjectile(projectile){const playerOwned=projectile.kind!=='boss';const color=projectile.style==='magic'?'#b58bd6':playerOwned?'#9eb7dd':projectile.style==='sky'?'#a98ac2':projectile.style==='ring'?'#d06a7b':'#a93445';const size=Math.max(8,Math.round(projectile.r*1.5));ctx.save();ctx.translate(Math.round(projectile.x),Math.round(projectile.y));ctx.rotate(Math.PI/4);ctx.fillStyle=color;ctx.fillRect(-size/2,-size/2,size,size);ctx.globalAlpha=.35;ctx.fillRect(-size*1.4,-size/4,size,size/2);ctx.restore();}
function drawWave(wave,time){ctx.save();ctx.translate(Math.round(wave.x),Math.round(wave.y));ctx.fillStyle='#8f2d3a';for(let x=-wave.w/2;x<wave.w/2;x+=12){const h=Math.max(8,Math.round(wave.h*(1-Math.abs(x)/(wave.w/2))));ctx.fillRect(Math.round(x),-h,10,h);}ctx.restore();}
function drawEffect(effect){
  const p=Math.max(0,effect.ttl/(effect.maxTtl||1));ctx.save();ctx.translate(effect.x,effect.y);ctx.globalAlpha=Math.min(1,p*2.6);ctx.strokeStyle=effect.color;ctx.fillStyle=effect.color;ctx.shadowColor=effect.color;ctx.shadowBlur=8;ctx.lineWidth=effect.type==='parry'?6:4;
  if(effect.type==='beam'){ctx.globalAlpha=Math.min(.72,p*1.4);ctx.fillRect(0,0,effect.width,effect.height);ctx.globalAlpha=Math.min(1,p*2);ctx.strokeRect(0,0,effect.width,effect.height);}
  else if(['ground_slam','slam'].includes(effect.type)){for(let x=-effect.size/2;x<effect.size/2;x+=18)ctx.fillRect(Math.round(x),-Math.round((1-p)*28+4),12,5);}
  else if(['phase','oath'].includes(effect.type)){const radius=effect.size*(1-p*.7);for(let i=0;i<16;i++){const a=Math.PI*2*i/16;ctx.fillRect(Math.round(Math.cos(a)*radius),Math.round(Math.sin(a)*radius),7,7);}}
  else{ctx.beginPath();ctx.arc(0,0,effect.size*(1-p*.5),effect.type.includes('slash')?-1.4:0,effect.type.includes('slash')?1.1:Math.PI*2);ctx.stroke();}
  if(effect.value){ctx.shadowBlur=0;ctx.globalAlpha=Math.min(1,p*3);ctx.fillStyle='#f2e5c8';ctx.font='700 12px monospace';ctx.textAlign='center';ctx.fillText(String(effect.value),0,-28-(1-p)*24);}
  ctx.restore();
}

function renderFrame(timeMs) {
  if(timeMs<hitStopUntil){requestAnimationFrame(renderFrame);return;}
  const time=timeMs/1000;const state=gameState;drawBackdrop(state);
  if(state?.boss){canvasScale=canvasHeight/world.height;const visible=canvasWidth/canvasScale;const me=state.players.find((p)=>p.id===socket.id)||state.players[0];const target=Math.max(0,Math.min(world.width-visible,(me?.x||0)-visible*.42));cameraX+=(target-cameraX)*.1;const shakeX=screenShake?(Math.random()-.5)*screenShake:0;const shakeY=screenShake?(Math.random()-.5)*screenShake*.55:0;screenShake*=.82;if(screenShake<.2)screenShake=0;ctx.save();ctx.setTransform(canvasScale*pixelRatio,0,0,canvasScale*pixelRatio,(-cameraX+shakeX)*canvasScale*pixelRatio,shakeY*canvasScale*pixelRatio);
    const left=cameraX-150,right=cameraX+visible+150;drawAbyss(state.arena?.bounds,state.arena?.gaps,time);for(const platform of platforms)if(platform.x+platform.w>left&&platform.x<right)drawPlatform(platform);for(const hazard of state.arena?.hazards||[])if(hazard.x+hazard.w>left&&hazard.x<right)drawArenaHazard(hazard,time);drawTelegraph(state.boss,state);for(const wave of state.waves||[])drawWave(wave,time);drawBoss(state.boss,time);for(const player of state.players)drawPlayer(player,time);for(const projectile of state.projectiles||[])drawProjectile(projectile);for(const effect of state.effects||[])drawEffect(effect);ctx.restore();}
  requestAnimationFrame(renderFrame);
}

document.querySelectorAll('.class-option').forEach((button) => button.addEventListener('click', () => chooseClass(button.dataset.class)));
dom.createRoomButton.addEventListener('click', createRoom); dom.joinRoomButton.addEventListener('click', joinRoom);
dom.roomCodeInput.addEventListener('input', () => { dom.roomCodeInput.value = dom.roomCodeInput.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,5); });
dom.roomCodeInput.addEventListener('keydown', (event) => { if(event.key==='Enter')joinRoom(); }); dom.nameInput.addEventListener('keydown', (event) => { if(event.key==='Enter')createRoom(); });
dom.copyCodeButton.addEventListener('click', copyCode); dom.startGameButton.addEventListener('click', startGame); dom.leaveLobbyButton.addEventListener('click', leaveHome);
dom.brandButton.addEventListener('click', () => { if(!dom.gameScreen.classList.contains('active'))leaveHome(); });
dom.shopButton.addEventListener('click', openShop); dom.closeShopButton.addEventListener('click', closeShop); dom.shopOverlay.addEventListener('click', (event) => { if(event.target===dom.shopOverlay)closeShop(); });
dom.boxBuyButton.addEventListener('click', purchaseBox);
dom.resultExitButton.addEventListener('click', leaveHome); dom.rematchButton.addEventListener('click', () => socket.emit('return-lobby', (response) => { if(!response?.ok)toast(response?.error||'Не удалось вернуться','danger'); }));

socket.on('connect',()=>{dom.serverState.className='server-state online';dom.serverState.querySelector('span').textContent='Сервер доступен';});
socket.on('disconnect',()=>{dom.serverState.className='server-state offline';dom.serverState.querySelector('span').textContent='Связь потеряна';if(dom.gameScreen.classList.contains('active'))toast('Соединение потеряно','danger');});
socket.on('lobby-state',enterLobby);
socket.on('game-start',(config)=>{world=config.world;applyArena(config.arena);gameState=null;previousBossHp=null;previousMeHp=null;currentRouteKey='';dom.resultOverlay.classList.remove('active');dom.perkOverlay.classList.remove('active');dom.routeOverlay.classList.remove('active');showScreen(dom.gameScreen);resizeCanvas();clearTimeout(controlsTimer);dom.controlsTip.classList.remove('hide');controlsTimer=setTimeout(()=>dom.controlsTip.classList.add('hide'),9500);ensureAudio();toast(`Модификатор: ${config.modifier?.name||'нет'}`,'gold');});
socket.on('stage-start',({stage,arena:nextArena})=>{applyArena(nextArena);currentPerkKey='';currentRouteKey='';dom.perkOverlay.classList.remove('active');dom.perkOverlay.setAttribute('aria-hidden','true');dom.routeOverlay.classList.remove('active');dom.routeOverlay.setAttribute('aria-hidden','true');toast(`${stage>1&&(stage-1)%10===0?'НОВЫЙ ВЛАДЫКА · ':''}${nextArena?.name||`Стадия ${stage}`}`,'gold');});
socket.on('state',(state)=>{
  if(!dom.gameScreen.classList.contains('active'))showScreen(dom.gameScreen);if(state.arena)applyArena(state.arena);
  const bossDelta=previousBossHp!==null&&state.boss?previousBossHp-state.boss.hp:0;const me=state.players.find((player)=>player.id===socket.id);
  if(bossDelta>0){playSound('hit');screenShake=Math.min(16,3+bossDelta*.035);hitStopUntil=performance.now()+Math.min(58,18+bossDelta*.08);}
  if(previousMeHp!==null&&me?.hp<previousMeHp){screenShake=18;hitStopUntil=performance.now()+48;}
  previousBossHp=state.boss?.hp??null;previousMeHp=me?.hp??null;gameState=state;updateHud(state);syncBossMusic(state.boss);
  if(state.status==='perk')showPerks(state);else if(state.status==='route')showRoutes(state);else{dom.perkOverlay.classList.remove('active');dom.routeOverlay.classList.remove('active');}
});
socket.on('stage-cleared',({stage})=>toast(`Печать ${stage} разрушена`,'gold'));
socket.on('route-chosen',(route)=>toast(`Путь выбран: ${route.name}`,'gold'));
socket.on('boss-phase',({phase,name})=>{screenShake=20;playSound('phase');toast(`${name} · ФАЗА ${phase}`,'danger');});
socket.on('currency-earned',({amount,stage})=>{profile.currency+=Math.max(0,Math.floor(amount));saveProfile();toast(`+${amount} пепла за стадию ${stage}`,'gold');});
socket.on('toast',(payload)=>toast(payload.text,payload.tone));socket.on('game-over',showResults);

window.addEventListener('resize',resizeCanvas);renderProfile();resizeCanvas();requestAnimationFrame(renderFrame);
