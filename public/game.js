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

const CLASS_SPRITE_IDS = Object.keys(CLASS_META);
const BOSS_SPRITE_IDS = ['grave_knight','ember_colossus','drowned_oracle','bell_inquisitor','crimson_duelist','iron_warden','moon_huntress','storm_sovereign','void_apostle','ashen_king','mirror_saint','rootless_beast','clockwork_mourner','nameless_hunter'];
const classSpriteAtlases = new Map();
const bossSpriteAtlases = new Map();
let effectSpriteAtlas = null;

async function loadSpriteAtlas(basePath) {
  const response = await fetch(`${basePath}/atlas.json`);
  if (!response.ok) throw new Error(`Не удалось загрузить ${basePath}/atlas.json`);
  const data = await response.json();
  const image = new Image();
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = () => reject(new Error(`Не удалось загрузить ${basePath}/atlas.png`));
    image.src = `${basePath}/atlas.png`;
  });
  return { image, data };
}

const spriteAssetsReady = Promise.all([
  ...CLASS_SPRITE_IDS.map(async (classId) => classSpriteAtlases.set(classId, await loadSpriteAtlas(`/assets/sprites/classes/${classId}`))),
  ...BOSS_SPRITE_IDS.map(async (bossId) => bossSpriteAtlases.set(bossId, await loadSpriteAtlas(`/assets/sprites/bosses/${bossId}`))),
]).then(async () => {
  effectSpriteAtlas = await loadSpriteAtlas('/assets/sprites/effects');
  return true;
}).catch((error) => {
  console.warn('Спрайты не загрузились, используется резервная графика.', error);
  return false;
});

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
const LOOT_ITEMS = [
  { id:'armor_ash_guard',type:'armor',rarity:'common',name:'Панцирь угасшей стражи',description:'+1 HP, но скорость ниже на 3%.' },
  { id:'armor_duelist_coat',type:'armor',rarity:'rare',name:'Камзол серого дуэлянта',description:'+14 выносливости и +4% скорости.' },
  { id:'armor_forgeplate',type:'armor',rarity:'rare',name:'Латы расколотой кузни',description:'+1 HP и +10% восстановления выносливости.' },
  { id:'armor_moonveil',type:'armor',rarity:'epic',name:'Лунная завеса',description:'+3% скорости и +40 мс неуязвимости переката.' },
  { id:'armor_stormmail',type:'armor',rarity:'epic',name:'Кольчуга сердца бури',description:'+20 выносливости, +12% её восстановления и +4% урона.' },
  { id:'armor_void_regalia',type:'armor',rarity:'legendary',name:'Регалии пустого трона',description:'+1 HP, +8% урона и +25 мс окна парирования.' },
  { id:'artifact_ember_talisman',type:'artifact',rarity:'common',name:'Талисман тлеющего угля',description:'+4% ко всему урону.' },
  { id:'artifact_iron_lung',type:'artifact',rarity:'common',name:'Железное лёгкое',description:'+12 выносливости.' },
  { id:'artifact_pilgrim_needle',type:'artifact',rarity:'common',name:'Игла пепельного странника',description:'+4% скорости движения.' },
  { id:'artifact_funeral_bell',type:'artifact',rarity:'rare',name:'Малый погребальный колокол',description:'+25 мс к окну парирования.' },
  { id:'artifact_hunter_eye',type:'artifact',rarity:'rare',name:'Око охотника',description:'+8% дальности и +4% тяжёлого урона.' },
  { id:'artifact_ash_hourglass',type:'artifact',rarity:'rare',name:'Часы серого пепла',description:'+10% восстановления выносливости и +4% скорости атак.' },
  { id:'artifact_moon_shard',type:'artifact',rarity:'epic',name:'Осколок мёртвой луны',description:'Перекаты дешевле на 8% и дают +40 мс неуязвимости.' },
  { id:'artifact_colossus_nail',type:'artifact',rarity:'epic',name:'Гвоздь колосса',description:'+10% тяжёлого урона, но скорость ниже на 2%.' },
  { id:'artifact_twin_fang',type:'artifact',rarity:'epic',name:'Парный клык разлома',description:'+9% лёгкого урона и +5% скорости атак.' },
  { id:'artifact_sovereign_seal',type:'artifact',rarity:'legendary',name:'Печать владыки',description:'+8% ко всему урону.' },
  { id:'artifact_last_lantern',type:'artifact',rarity:'legendary',name:'Последний фонарь',description:'+1 HP и +8% восстановления выносливости.' },
  { id:'artifact_rift_compass',type:'artifact',rarity:'legendary',name:'Компас живого разлома',description:'+8% скорости и +10% дальности атак.' },
];
const LOOT_BY_ID = new Map(LOOT_ITEMS.map((item) => [item.id, item]));
const LOOT_RARITY_LABEL = { common:'ОБЫЧНЫЙ',rare:'РЕДКИЙ',epic:'ЭПИЧЕСКИЙ',legendary:'ЛЕГЕНДАРНЫЙ' };
const SPECIALIZATION_META = {
  swordsman: {
    duelist: { name: 'Дуэлянт', description: '+12% урона и +5% скорости.' },
    guardian: { name: 'Страж', description: '+1 HP и более широкое окно парирования.' },
  },
  greatsword: {
    juggernaut: { name: 'Джаггернаут', description: '+1 HP и +12% к тяжёлым атакам.' },
    reaper: { name: 'Жнец', description: '+10% скорости и ускоренные лёгкие атаки.' },
  },
  rogue: {
    assassin: { name: 'Ассасин', description: 'Усиленные удары в спину и +6% общего урона.' },
    thrower: { name: 'Метатель', description: '+25% к снарядам и +12 выносливости.' },
  },
  spearman: {
    sentinel: { name: 'Часовой', description: 'Дальнее оружие и более широкое парирование.' },
    vanguard: { name: 'Авангард', description: 'Сильнее воздушные и тяжёлые атаки.' },
  },
  berserker: {
    fury: { name: 'Ярость', description: 'Сильнее при 1 HP и немного быстрее.' },
    breaker: { name: 'Крушитель', description: 'Больше урона стойкости и тяжёлых атак.' },
  },
  ashmage: {
    flame: { name: 'Пламя', description: 'Сильнее магия и её снаряды.' },
    void: { name: 'Пустота', description: '+18 выносливости и длиннее неуязвимость переката.' },
  },
};
const MASTERY_OPTIONS = {
  5: {
    tempo: { name: 'Темп', description: 'Атаки выполняются быстрее.' },
    force: { name: 'Сила', description: '+10% к урону оружия.' },
  },
  10: {
    reach: { name: 'Дистанция', description: '+12% к дальности атак.' },
    economy: { name: 'Экономия', description: 'Атаки расходуют меньше выносливости.' },
  },
  15: {
    finesse: { name: 'Точность', description: 'Шире окно парирования и безопаснее перекат.' },
    execution: { name: 'Казнь', description: 'Больше урона боссу с низким здоровьем.' },
  },
};
const BOSS_META = [
  { id:'grave_knight', name:'Могильный рыцарь', title:'Хранитель первых врат', hint:'Не жадничай после двойного взмаха.', weakness:'Парирование ближних серий быстро ломает стойкость.' },
  { id:'ember_colossus', name:'Тлеющий колосс', title:'Сердце погасшей кузни', hint:'Покидай отмеченную землю до удара сверху.', weakness:'Долгие замахи дают окно для тяжёлой атаки.' },
  { id:'drowned_oracle', name:'Утонувший оракул', title:'Голос затопленной крипты', hint:'Проходи сквозь кольцо перекатом.', weakness:'Уязвим после луча и вспышки кольца.' },
  { id:'bell_inquisitor', name:'Колокольный инквизитор', title:'Судья погребальной башни', hint:'Следи одновременно за боссом и падающими зонами.', weakness:'Быстрые удары хорошо сбивают стойкость.' },
  { id:'crimson_duelist', name:'Багровый дуэлянт', title:'Клинок без поражений', hint:'Его рывок проще парировать, чем убегать от него.', weakness:'Теряет стойкость от точных парирований.' },
  { id:'iron_warden', name:'Железный надзиратель', title:'Замок безмолвной тюрьмы', hint:'Не оставайся между клинками арены и боссом.', weakness:'Медленно разворачивается после тяжёлых серий.' },
  { id:'moon_huntress', name:'Лунная охотница', title:'Стрела над разломом', hint:'Меняй высоту и не стой на одной платформе.', weakness:'Коротко открывается после залпа.' },
  { id:'storm_sovereign', name:'Владыка бури', title:'Корона громового сердца', hint:'Заранее планируй путь между зонами молний.', weakness:'Тяжёлые атаки эффективны после небесного падения.' },
  { id:'void_apostle', name:'Апостол пустоты', title:'Глашатай последней бездны', hint:'Сохраняй выносливость для телепорта и луча.', weakness:'Метка мага открывает сильные командные комбинации.' },
  { id:'ashen_king', name:'Пепельный король', title:'Последний владыка печатей', hint:'В третьей фазе отвечай на каждую атаку отдельно.', weakness:'Слом стойкости — главное окно для общего натиска.' },
  { id:'mirror_saint', name:'Зеркальный святой', title:'Отражение забытой клятвы', hint:'Не повторяй один и тот же ответ на его серии.', weakness:'Идеальное уклонение открывает короткое окно контратаки.' },
  { id:'rootless_beast', name:'Безкорневой зверь', title:'Голод живых руин', hint:'Держи путь к безопасному краю открытым.', weakness:'Тяжёлые атаки быстрее ломают его стойкость.' },
  { id:'clockwork_mourner', name:'Часовой плакальщик', title:'Последняя минута колокольни', hint:'Слушай ритм телеграфов и не торопись.', weakness:'Парирование двойных атак сбивает его темп.' },
  { id:'nameless_hunter', name:'Безымянный охотник', title:'Тот, кто идёт по следу', hint:'Он повторяет приёмы, которыми закончился прошлый забег.', weakness:'Смена стойки сбивает его адаптацию.' },
];
const BOSS_BY_ID = new Map(BOSS_META.map((boss) => [boss.id, boss]));
const ATTACK_META = {
  random:'Случайная атака', slash:'Одиночный взмах', twin_slash:'Двойной взмах', cleave:'Широкий размах', charge:'Рывок',
  wave:'Волна', volley:'Залп', slam:'Удар по земле', blink:'Телепорт', marked:'Метки', quake:'Землетрясение',
  ring_burst:'Кольцевая вспышка', skyfall:'Небесное падение', beam:'Луч',
};
const DEFAULT_BINDINGS = { left:'KeyA', right:'KeyD', jump:'KeyW', light:'KeyJ', parry:'KeyH', heavy:'KeyK', roll:'KeyL', ability:'KeyV', team:'KeyU', stance:'KeyR', technique:'KeyF', layer:'KeyT', interact:'KeyG', spectral:'KeyX' };
const ACTION_LABELS = { left:'Влево', right:'Вправо', jump:'Прыжок', light:'Лёгкая атака', parry:'Парирование', heavy:'Тяжёлая атака', roll:'Перекат', ability:'Способность класса', team:'Клятва отряда', stance:'Смена стойки', technique:'Украденная техника', layer:'Смена слоя мира', interact:'Механизм арены', spectral:'Спектральная помощь' };
const KEY_LABELS = { Space:'ПРОБЕЛ', ArrowLeft:'←', ArrowRight:'→', ArrowUp:'↑', ArrowDown:'↓' };
const EVOLVING_PERKS = new Set(['vitality','quickstep','safe_roll','sharpened','heavy_mastery','echo_blade','parry_master']);
const reconnectToken = (() => {
  const stored = sessionStorage.getItem('riftRaidReconnectToken');
  if (stored) return stored;
  const value = window.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  sessionStorage.setItem('riftRaidReconnectToken', value);
  return value;
})();
const ACHIEVEMENTS = [
  {id:'first_seal',name:'Первая печать',description:'Пройди хотя бы одну стадию.',stat:'highestStage',goal:2,reward:250},
  {id:'first_lord',name:'Первый владыка',description:'Доберись до стадии 6.',stat:'highestStage',goal:6,reward:600},
  {id:'deep_run',name:'Глубокий забег',description:'Доберись до стадии 13.',stat:'highestStage',goal:13,reward:1200},
  {id:'half_hundred',name:'Половина пути',description:'Доберись до стадии 26.',stat:'highestStage',goal:26,reward:2500},
  {id:'ashen_hundred',name:'Последняя печать',description:'Победи финального босса.',stat:'highestStage',goal:51,reward:6000},
  {id:'parry_student',name:'Ученик зеркала',description:'Сделай 20 успешных парирований.',stat:'parries',goal:20,reward:500},
  {id:'parry_master',name:'Безупречная гарда',description:'Сделай 150 успешных парирований.',stat:'parries',goal:150,reward:1800},
  {id:'boss_hunter',name:'Охотник на владык',description:'Победи 50 боссов.',stat:'bosses',goal:50,reward:1600},
  {id:'untouched',name:'Без единой царапины',description:'Пройди 10 стадий без полученного урона.',stat:'noHitStages',goal:10,reward:1400},
  {id:'damage_oath',name:'Тяжесть клятвы',description:'Нанеси суммарно 100 000 урона.',stat:'damage',goal:100000,reward:2200},
];

const BOX_PRICE = 2000;
const BOX_OPEN_TIME = 30 * 1000;
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
  uiSize: 'normal',
  unlockedClasses: ['swordsman'],
  unlockedSkins: ['iron'],
  selectedSkin: 'iron',
  ownedSkills: [],
  equippedSkills: {},
  boxSlots: [null, null, null],
  unlockedWeapons: Object.values(DEFAULT_WEAPON),
  selectedWeapons: { ...DEFAULT_WEAPON },
  classProgress: Object.fromEntries(Object.keys(CLASS_META).map((classId) => [classId, { xp: 0 }])),
  classRebirths: Object.fromEntries(Object.keys(CLASS_META).map((classId) => [classId, 0])),
  weaponProgress: Object.fromEntries(Object.keys(WEAPON_META).map((weaponId) => [weaponId, { xp: 0, choices: {} }])),
  classSpecializations: {},
  bossTrophies: [],
  bossCodex: Object.fromEntries(BOSS_META.map((boss) => [boss.id, { seen: 0, wins: 0 }])),
  ownedLoot: [],
  gear: { armor:null, artifacts:[] },
  lootPity: 0,
  ngPlusUnlocked: false,
  ngPlusWins: 0,
  appearance: { armor: 'ashen', aura: 'ash', title: 'wanderer' },
  settings: { bindings: { ...DEFAULT_BINDINGS }, effectsVolume: 0.7, musicVolume: 0.45, screenShake: 1, gamepad: true, highContrast:false, reducedFlash:false, telegraphText:true, colorblind:false },
  loadoutPresets: [null,null,null],
  ghosts: {},
  nemesisAttacks:Object.fromEntries(Object.keys(CLASS_META).map((id)=>[id,null])),
  stats: { runs: 0, highestStage: 1, parries: 0, bosses: 0, noHitStages: 0, damage: 0 },
  achievements: [],
  daily: null,
};

const dom = Object.fromEntries([
  'homeScreen', 'lobbyScreen', 'gameScreen', 'serverState', 'nameInput', 'roomCodeInput',
  'createRoomButton', 'joinRoomButton', 'homeError', 'lobbyError', 'lobbyCount', 'roomCodeText',
  'copyCodeButton', 'squadGrid', 'lobbyHint', 'startGameButton', 'leaveLobbyButton', 'brandButton', 'uiSizePicker',
  'gameCanvas', 'hudRoomCode', 'timerText', 'bossName', 'stageText', 'bossHealthBar', 'bossHealthText',
  'squadHud', 'playerVitals', 'heartsBar', 'staminaBar', 'controlsTip', 'toastStack',
  'perkOverlay', 'perkKicker', 'perkSubtitle', 'perkGrid', 'waitingPerks', 'shopButton', 'shopOverlay',
  'closeShopButton', 'currencyCount', 'shopCurrency', 'classShop', 'skinShop', 'boxBuyButton', 'boxSlots',
  'skillClassTabs', 'skillCollection', 'skillCollectionCount', 'equippedSkillCount', 'weaponShop', 'classLevelText', 'appearanceShop', 'lootLoadout', 'lootInventory', 'lootPityText',
  'challengeGrid', 'achievementGrid', 'routeOverlay', 'routeGrid', 'routeSubtitle', 'routeWaiting',
  'fusionOverlay', 'fusionGrid', 'fusionWaiting', 'contractOverlay', 'contractGrid', 'contractWaiting',
  'teamPowerBar', 'teamPowerText', 'modifierText', 'bossPhaseText', 'resultOverlay',
  'resultKicker', 'resultTitle', 'resultSubtitle', 'runSummary', 'resultStats', 'rematchButton', 'resultExitButton',
  'runDifficulty', 'runMode', 'publicRoomToggle', 'presetBar', 'trainingBossSelect', 'trainingAttackSelect', 'trainingPhaseSelect', 'trainingArenaSelect', 'trainingSpeedSelect', 'trainingDamageSelect', 'trainingStaminaToggle', 'startTrainingButton',
  'publicRoomsButton', 'publicRoomsList', 'bossPoiseBar', 'bossStatusText', 'trainingExitButton',
  'dailyBoardButton', 'dailyBoard', 'masteryTree', 'specializationShop', 'rebirthPanel', 'bossCodex', 'settingsPanel',
  'abilityBar', 'abilityLabel', 'spectatorPanel', 'spectatorTarget',
].map((id) => [id, document.querySelector(`#${id}`)]));

const ctx = dom.gameCanvas.getContext('2d');
const screens = [dom.homeScreen, dom.lobbyScreen, dom.gameScreen];
const input = { left: false, right: false, jump: false, light: false, heavy: false, parry: false, roll: false, ability: false, team: false, stance:false, technique:false, layer:false, interact:false, spectral:false };
const keyboardInput = { ...input };
const gamepadInput = { ...input };

let profile = loadProfile();
applyUiSize(profile.uiSize);
applyAccessibility();
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
let currentFusionKey = '';
let currentContractKey = '';
let previousMeHp = null;
let screenShake = 0;
let hitStopUntil = 0;
let bossMusicTimer = null;
let bossMusicKey = '';
let bossMusicStep = 0;
let waitingBindingAction = '';
let currentTraining = false;
let resumeInProgress = false;
let gamepadWasConnected = false;
let spectatorIndex = 0;
let ghostRecording = [];
let ghostPlayback = [];
let lastGhostSampleAt = -1;
let ghostPlaybackIndex = 0;
const playerAnimationStates = new Map();

function dateKey() { return new Date().toISOString().slice(0, 10); }
function freshDaily() { return { date: dateKey(), stages: 0, parries: 0, damage: 0, claimed: [] }; }
function xpForLevel(level) { const steps = Math.max(0, level - 1); return steps * 100 + 40 * steps * (steps + 1); }
function levelFromXp(xp) { let level = 1; while (level < 50 && xp >= xpForLevel(level + 1)) level += 1; return level; }
function classLevel(classId) { return levelFromXp(profile.classProgress?.[classId]?.xp || 0); }
function rebirthCount(classId = selectedClass) { return Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.floor(Number(profile.classRebirths?.[classId]) || 0))); }
function rebirthXpMultiplier(classId = selectedClass) { return rebirthCount(classId) >= 53 ? Number.MAX_SAFE_INTEGER : 2 ** rebirthCount(classId); }
function formatRebirthMultiplierCount(count) {
  return count < 20 ? `×${(2 ** count).toLocaleString('ru-RU')}` : `×2^${count.toLocaleString('ru-RU')}`;
}
function formatRebirthMultiplier(classId = selectedClass) { return formatRebirthMultiplierCount(rebirthCount(classId)); }
function masteryXpForLevel(level) { const steps = Math.max(0, level - 1); return steps * 80 + 26 * steps * (steps + 1); }
function masteryLevel(weaponId) { const xp = profile.weaponProgress?.[weaponId]?.xp || 0; let level = 1; while (level < 20 && xp >= masteryXpForLevel(level + 1)) level += 1; return level; }

function applyUiSize(size) {
  const safeSize = ['small', 'normal', 'large'].includes(size) ? size : 'normal';
  profile.uiSize = safeSize;
  document.documentElement.dataset.uiSize = safeSize;
  dom.uiSizePicker?.querySelectorAll('[data-ui-size]').forEach((button) => button.classList.toggle('selected', button.dataset.uiSize === safeSize));
}

function applyAccessibility() {
  if (!profile?.settings) return;
  document.documentElement.dataset.highContrast = String(profile.settings.highContrast === true);
  document.documentElement.dataset.colorblind = String(profile.settings.colorblind === true);
  document.body.classList.toggle('reduced-flash', profile.settings.reducedFlash === true);
}

function loadProfile() {
  try {
    const saved = JSON.parse(localStorage.getItem('riftRaidAshenProfile') || '{}');
    const unlockedClasses = Array.isArray(saved.unlockedClasses) ? saved.unlockedClasses.filter((id) => CLASS_META[id]) : [];
    const unlockedSkins = Array.isArray(saved.unlockedSkins) ? saved.unlockedSkins.filter((id) => SKIN_META[id]) : [];
    const ownedSkills = [...new Set(Array.isArray(saved.ownedSkills) ? saved.ownedSkills.filter((id) => BOX_SKILL_BY_ID.has(id)) : [])];
    const classProgress = Object.fromEntries(Object.keys(CLASS_META).map((classId) => [classId, { xp: Math.max(0, Math.floor(Number(saved.classProgress?.[classId]?.xp) || 0)) }]));
    const classRebirths = Object.fromEntries(Object.keys(CLASS_META).map((classId) => [classId, Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.floor(Number(saved.classRebirths?.[classId]) || 0)))]));
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
      const classId = unlockedClasses.includes(savedSlots[index]?.classId) ? savedSlots[index].classId : (unlockedClasses[0] || 'swordsman');
      return Number.isFinite(endsAt) && endsAt > 0 ? { endsAt, classId } : null;
    });
    const selectedWeapons = {};
    for (const classId of Object.keys(CLASS_META)) {
      const candidate = saved.selectedWeapons?.[classId];
      selectedWeapons[classId] = unlockedWeapons.includes(candidate) && WEAPON_META[candidate]?.classId === classId ? candidate : DEFAULT_WEAPON[classId];
    }
    const weaponProgress = {};
    for (const weaponId of Object.keys(WEAPON_META)) {
      const xp = Math.max(0, Math.floor(Number(saved.weaponProgress?.[weaponId]?.xp) || 0));
      let level = 1;
      while (level < 20 && xp >= masteryXpForLevel(level + 1)) level += 1;
      const choices = {};
      for (const [required, options] of Object.entries(MASTERY_OPTIONS)) {
        const choice = saved.weaponProgress?.[weaponId]?.choices?.[required];
        if (level >= Number(required) && Object.hasOwn(options, choice)) choices[required] = choice;
      }
      weaponProgress[weaponId] = { xp, choices };
    }
    const classSpecializations = {};
    for (const classId of Object.keys(CLASS_META)) {
      const candidate = saved.classSpecializations?.[classId];
      if (classLevelFromProgress(classProgress, classId) >= 10 && Object.hasOwn(SPECIALIZATION_META[classId], candidate)) classSpecializations[classId] = candidate;
    }
    const bossTrophies = [...new Set(Array.isArray(saved.bossTrophies) ? saved.bossTrophies.filter((id) => BOSS_BY_ID.has(id)) : [])];
    const bossCodex = Object.fromEntries(BOSS_META.map((boss) => [boss.id, {
      seen: Math.max(0, Math.floor(Number(saved.bossCodex?.[boss.id]?.seen) || 0)),
      wins: Math.max(0, Math.floor(Number(saved.bossCodex?.[boss.id]?.wins) || 0)),
    }]));
    const ownedLoot = [...new Set(Array.isArray(saved.ownedLoot) ? saved.ownedLoot.map(String).filter((id) => LOOT_BY_ID.has(id)) : [])];
    const equippedArmor = ownedLoot.includes(saved.gear?.armor) && LOOT_BY_ID.get(saved.gear.armor)?.type === 'armor' ? saved.gear.armor : null;
    const equippedArtifacts = [...new Set(Array.isArray(saved.gear?.artifacts) ? saved.gear.artifacts.map(String) : [])]
      .filter((id) => ownedLoot.includes(id) && LOOT_BY_ID.get(id)?.type === 'artifact').slice(0, 2);
    const savedTitle = String(saved.appearance?.title || 'wanderer');
    const appearance = {
      armor: ARMOR_META[saved.appearance?.armor] ? saved.appearance.armor : 'ashen',
      aura: AURA_META[saved.appearance?.aura] ? saved.appearance.aura : 'ash',
      title: savedTitle === 'wanderer' || bossTrophies.some((id) => savedTitle === `title_${id}`) ? savedTitle : 'wanderer',
    };
    const bindings = {};
    for (const [action, fallback] of Object.entries(DEFAULT_BINDINGS)) {
      const candidate = saved.settings?.bindings?.[action];
      bindings[action] = typeof candidate === 'string' && candidate.length <= 32 ? candidate : fallback;
    }
    const settings = {
      bindings,
      effectsVolume: clampNumber(saved.settings?.effectsVolume, 0, 1, 0.7),
      musicVolume: clampNumber(saved.settings?.musicVolume, 0, 1, 0.45),
      screenShake: clampNumber(saved.settings?.screenShake, 0, 1.5, 1),
      gamepad: saved.settings?.gamepad !== false,
      highContrast: saved.settings?.highContrast === true,
      reducedFlash: saved.settings?.reducedFlash === true,
      telegraphText: saved.settings?.telegraphText !== false,
      colorblind: saved.settings?.colorblind === true,
    };
    const loadoutPresets = Array.from({length:3},(_,index)=>{
      const preset=saved.loadoutPresets?.[index];
      return preset && CLASS_META[preset.classId] ? {
        classId:preset.classId, weaponId:WEAPON_META[preset.weaponId]?.classId===preset.classId?preset.weaponId:DEFAULT_WEAPON[preset.classId],
        skin:SKIN_META[preset.skin]?preset.skin:'iron', equippedSkills:Array.isArray(preset.equippedSkills)?preset.equippedSkills.slice(0,3):[],
        specialization:Object.hasOwn(SPECIALIZATION_META[preset.classId]||{},preset.specialization)?preset.specialization:null,
        appearance:preset.appearance||{armor:'ashen',aura:'ash',title:'wanderer'},
      }:null;
    });
    const ghosts = {};
    for (const classId of Object.keys(CLASS_META)) {
      const ghost=saved.ghosts?.[classId];
      if (ghost && Array.isArray(ghost.samples)) ghosts[classId]={stages:Math.max(0,Number(ghost.stages)||0),samples:ghost.samples.slice(0,12000)};
    }
    const stats = {
      runs: Math.max(0, Number(saved.stats?.runs) || 0), highestStage: Math.max(1, Number(saved.stats?.highestStage) || 1),
      parries: Math.max(0, Number(saved.stats?.parries) || 0), bosses: Math.max(0, Number(saved.stats?.bosses) || 0),
      noHitStages: Math.max(0, Number(saved.stats?.noHitStages) || 0), damage: Math.max(0, Number(saved.stats?.damage) || 0),
    };
    const daily = saved.daily?.date === dateKey() ? { ...freshDaily(), ...saved.daily, claimed: Array.isArray(saved.daily.claimed) ? saved.daily.claimed : [] } : freshDaily();
    return {
      currency: Math.max(0, Math.floor(Number(saved.currency) || 0)),
      uiSize: ['small', 'normal', 'large'].includes(saved.uiSize) ? saved.uiSize : 'normal',
      unlockedClasses,
      unlockedSkins,
      selectedSkin: unlockedSkins.includes(saved.selectedSkin) ? saved.selectedSkin : 'iron',
      ownedSkills,
      equippedSkills,
      boxSlots,
      unlockedWeapons,
      selectedWeapons,
      classProgress,
      classRebirths,
      weaponProgress,
      classSpecializations,
      bossTrophies,
      bossCodex,
      ownedLoot,
      gear:{armor:equippedArmor,artifacts:equippedArtifacts},
      lootPity:Math.min(16,Math.max(0,Math.floor(Number(saved.lootPity)||0))),
      ngPlusUnlocked: saved.ngPlusUnlocked === true,
      ngPlusWins: Math.max(0, Math.floor(Number(saved.ngPlusWins) || 0)),
      appearance,
      settings,
      loadoutPresets,
      ghosts,
      nemesisAttacks:Object.fromEntries(Object.keys(CLASS_META).map((id)=>[id,typeof saved.nemesisAttacks?.[id]==='string'?saved.nemesisAttacks[id]:null])),
      stats,
      achievements: [...new Set(Array.isArray(saved.achievements) ? saved.achievements.filter((id) => ACHIEVEMENTS.some((achievement) => achievement.id === id)) : [])],
      daily,
    };
  } catch {
    return structuredClone(DEFAULT_PROFILE);
  }
}

function clampNumber(value, minimum, maximum, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(maximum, Math.max(minimum, number)) : fallback;
}

function classLevelFromProgress(classProgress, classId) {
  return levelFromXp(classProgress?.[classId]?.xp || 0);
}

function saveProfile() {
  localStorage.setItem('riftRaidAshenProfile', JSON.stringify(profile));
  renderProfile();
}

function equippedForClass(classId = selectedClass) { return profile.equippedSkills[classId] || []; }
function classPayload(classId = selectedClass) {
  const weaponId = profile.selectedWeapons[classId] || DEFAULT_WEAPON[classId];
  return {
    classId, skin: profile.selectedSkin, weaponId, appearance: profile.appearance,
    equippedSkills: equippedForClass(classId), specialization: profile.classSpecializations[classId] || null,
    masteryChoices: profile.weaponProgress[weaponId]?.choices || {}, reconnectToken, nemesisAttack:profile.nemesisAttacks?.[classId]||null,
    ownedLoot:profile.ownedLoot,gear:profile.gear,lootPity:profile.lootPity,rebirths:profile.classRebirths[classId]||0,
  };
}

function renderProfile() {
  applyUiSize(profile.uiSize);
  applyAccessibility();
  dom.currencyCount.textContent = profile.currency;
  dom.shopCurrency.textContent = profile.currency;
  if (dom.runDifficulty) {
    const ngOption = dom.runDifficulty.querySelector('option[value="ngplus"]');
    if (ngOption) { ngOption.disabled = !profile.ngPlusUnlocked; ngOption.textContent = profile.ngPlusUnlocked ? 'Новая игра+ · усиленные боссы' : 'Новая игра+ · пройди обычный забег'; }
    if (!profile.ngPlusUnlocked && dom.runDifficulty.value === 'ngplus') dom.runDifficulty.value = 'normal';
  }
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
  renderPresets();
  renderShop();
}

function renderPresets() {
  if (!dom.presetBar) return;
  dom.presetBar.innerHTML = profile.loadoutPresets.map((preset,index)=>`<div class="preset-slot"><button type="button" data-load-preset="${index}" ${preset?'':'disabled'}>${preset?`${index+1} · ${CLASS_META[preset.classId].label}`:`${index+1} · ПУСТО`}</button><button type="button" data-save-preset="${index}" title="Сохранить текущую экипировку">＋</button></div>`).join('');
  dom.presetBar.querySelectorAll('[data-save-preset]').forEach((button)=>button.addEventListener('click',()=>{
    const classId=selectedClass;profile.loadoutPresets[Number(button.dataset.savePreset)]={classId,weaponId:profile.selectedWeapons[classId],skin:profile.selectedSkin,equippedSkills:[...equippedForClass(classId)],specialization:profile.classSpecializations[classId]||null,appearance:{...profile.appearance}};saveProfile();toast(`Пресет ${Number(button.dataset.savePreset)+1} сохранён`,'gold');
  }));
  dom.presetBar.querySelectorAll('[data-load-preset]:not(:disabled)').forEach((button)=>button.addEventListener('click',()=>{
    const preset=profile.loadoutPresets[Number(button.dataset.loadPreset)];if(!preset)return;if(!profile.unlockedClasses.includes(preset.classId))return toast('Класс этого пресета пока закрыт','warn');
    selectedClass=preset.classId;profile.selectedSkin=profile.unlockedSkins.includes(preset.skin)?preset.skin:'iron';if(profile.unlockedWeapons.includes(preset.weaponId))profile.selectedWeapons[preset.classId]=preset.weaponId;profile.equippedSkills[preset.classId]=preset.equippedSkills.filter((id)=>profile.ownedSkills.includes(id)).slice(0,3);if(preset.specialization)profile.classSpecializations[preset.classId]=preset.specialization;profile.appearance={...profile.appearance,...preset.appearance};saveProfile();if(lobbyState)socket.emit('select-class',classPayload());toast(`Пресет ${Number(button.dataset.loadPreset)+1} загружен`,'gold');
  }));
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

function availableBoxSkills(classId = selectedClass) {
  const owned = new Set(profile.ownedSkills);
  return BOX_SKILLS.filter((skill) => skill.classId === classId && !owned.has(skill.id));
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
    const slotClass = CLASS_META[slot.classId] || CLASS_META.swordsman;
    const remaining = slot.endsAt - now;
    const ready = remaining <= 0;
    const progress = Math.max(0, Math.min(1, 1 - remaining / BOX_OPEN_TIME));
    return `<article class="box-slot ${ready ? 'ready' : 'opening'}"><span>0${index + 1}</span><i>◆</i><strong>${ready ? 'КОВЧЕГ ГОТОВ' : formatCountdown(remaining)}</strong>
      <small>${slotClass.label} · ${ready ? 'новый навык готов' : 'распечатывание продолжается'}</small><div class="box-progress"><b style="width:${progress * 100}%"></b></div>
      ${ready ? `<button type="button" data-claim-box="${index}">ЗАБРАТЬ НАВЫК</button>` : ''}</article>`;
  }).join('');
  const freeSlot = profile.boxSlots.some((slot) => !slot);
  const remainingClassSkills = availableBoxSkills(selectedClass).length;
  const hasRewards = remainingClassSkills > 0;
  dom.boxBuyButton.disabled = profile.currency < BOX_PRICE || !freeSlot || !hasRewards;
  dom.boxBuyButton.innerHTML = hasRewards ? `<span>КОВЧЕГ: ${CLASS_META[selectedClass].label}</span><b>${BOX_PRICE} ¤</b>` : `<span>${CLASS_META[selectedClass].label}: СОБРАНО</span><b>36 / 36</b>`;
  dom.boxSlots.querySelectorAll('[data-claim-box]').forEach((button) => button.addEventListener('click', () => claimBox(Number(button.dataset.claimBox))));
}

function purchaseBox() {
  const slotIndex = profile.boxSlots.findIndex((slot) => !slot);
  if (slotIndex < 0) return toast('Все три слота уже заняты', 'warn');
  if (profile.currency < BOX_PRICE) return toast('Нужно 2 000 пепла', 'warn');
  if (!availableBoxSkills(selectedClass).length) return toast(`Все навыки класса «${CLASS_META[selectedClass].label}» уже собраны`, 'gold');
  profile.currency -= BOX_PRICE;
  profile.boxSlots[slotIndex] = { endsAt: Date.now() + BOX_OPEN_TIME, classId: selectedClass };
  saveProfile();
  toast(`${CLASS_META[selectedClass].label}: ковчег помещён в слот ${slotIndex + 1}`, 'gold');
}

function claimBox(slotIndex) {
  const slot = profile.boxSlots[slotIndex];
  if (!slot || slot.endsAt > Date.now()) return;
  const candidates = availableBoxSkills(slot.classId);
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
  const rebirths = rebirthCount(selectedClass);
  const xp = profile.classProgress[selectedClass]?.xp || 0;
  const currentFloor = xpForLevel(level);
  const nextFloor = level < 50 ? xpForLevel(level + 1) : currentFloor;
  if (dom.classLevelText) dom.classLevelText.textContent = `${level >= 50 ? `УРОВЕНЬ ${level} · МАКС.` : `УРОВЕНЬ ${level} · ${xp - currentFloor} / ${nextFloor - currentFloor} XP`} · РЕБЕРС ${rebirths.toLocaleString('ru-RU')}`;
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

function renderMastery() {
  if (!dom.masteryTree) return;
  const weaponId = profile.selectedWeapons[selectedClass] || DEFAULT_WEAPON[selectedClass];
  const weapon = WEAPON_META[weaponId];
  const progress = profile.weaponProgress[weaponId];
  const level = masteryLevel(weaponId);
  const floor = masteryXpForLevel(level);
  const ceiling = level < 20 ? masteryXpForLevel(level + 1) : floor;
  dom.masteryTree.innerHTML = `<div class="mastery-head"><div><strong>${weapon.name} · МАСТЕРСТВО ${level}</strong><small>${level >= 20 ? 'Максимальный уровень' : `${progress.xp - floor} / ${ceiling - floor} XP до следующего уровня`}</small></div><div class="mastery-progress"><i style="width:${level >= 20 ? 100 : (progress.xp - floor) / Math.max(1, ceiling - floor) * 100}%"></i></div></div>
    ${Object.entries(MASTERY_OPTIONS).map(([required, options]) => {
      const unlocked = level >= Number(required);
      return `<section class="mastery-node ${unlocked ? 'unlocked' : 'locked'}"><b>УРОВЕНЬ ${required}</b><div>${Object.entries(options).map(([id, option]) => `<button type="button" data-mastery-level="${required}" data-mastery="${id}" class="${progress.choices[required] === id ? 'selected' : ''}" ${unlocked ? '' : 'disabled'}><strong>${option.name}</strong><small>${option.description}</small></button>`).join('')}</div></section>`;
    }).join('')}`;
  dom.masteryTree.querySelectorAll('[data-mastery]:not(:disabled)').forEach((button) => button.addEventListener('click', () => {
    progress.choices[button.dataset.masteryLevel] = button.dataset.mastery;
    saveProfile();
    if (lobbyState) socket.emit('select-class', classPayload());
    toast(`Мастерство: ${MASTERY_OPTIONS[button.dataset.masteryLevel][button.dataset.mastery].name}`, 'gold');
  }));
}

function renderSpecializations() {
  if (!dom.specializationShop) return;
  const level = classLevel(selectedClass);
  const selected = profile.classSpecializations[selectedClass];
  dom.specializationShop.innerHTML = `<div class="specialization-intro"><strong>${CLASS_META[selectedClass].label} · УРОВЕНЬ ${level}</strong><small>${level >= 10 ? 'Можно менять специализацию между забегами.' : `Специализации откроются на 10-м уровне класса.`}</small></div><div class="specialization-grid">${Object.entries(SPECIALIZATION_META[selectedClass]).map(([id, item]) => `<button type="button" class="spec-card ${selected === id ? 'selected' : ''}" data-specialization="${id}" ${level >= 10 ? '' : 'disabled'}><i>${CLASS_META[selectedClass].icon}</i><strong>${item.name}</strong><small>${item.description}</small><b>${selected === id ? 'ВЫБРАНО' : level >= 10 ? 'ВЫБРАТЬ' : 'ЗАКРЫТО'}</b></button>`).join('')}</div>
    <div class="combo-guide"><strong>КОМАНДНЫЕ СВЯЗКИ</strong><span><b>МАГ → ВОР</b> метка Пепла усиливает удар в спину и заряжает клятву</span><span><b>КОПЕЙЩИК → ТЯЖЁЛЫЙ МЕЧНИК</b> пробитая броня усиливает тяжёлый удар</span><span><b>БЕРСЕРК</b> продлевает окно сломанной стойкости тяжёлой атакой</span></div>`;
  dom.specializationShop.querySelectorAll('[data-specialization]:not(:disabled)').forEach((button) => button.addEventListener('click', () => {
    profile.classSpecializations[selectedClass] = button.dataset.specialization;
    saveProfile();
    if (lobbyState) socket.emit('select-class', classPayload());
    toast(`Специализация: ${SPECIALIZATION_META[selectedClass][button.dataset.specialization].name}`, 'gold');
  }));
}

function renderRebirth() {
  if (!dom.rebirthPanel) return;
  const classId = selectedClass;
  const count = rebirthCount(classId);
  const level = classLevel(classId);
  const currentStatBonus = count * 20;
  const nextStatBonus = (count + 1) * 20;
  dom.rebirthPanel.innerHTML = `<div class="rebirth-sigil">${CLASS_META[classId].icon}</div><div class="rebirth-copy">
    <span>${CLASS_META[classId].label} · РЕБЕРС ${count.toLocaleString('ru-RU')}</span><strong>${formatRebirthMultiplier(classId)} XP · +${currentStatBonus.toLocaleString('ru-RU')}% К БАЗОВЫМ СТАТАМ</strong>
    <small>На 50-м уровне можно начать заново. Сбросятся уровень класса, оружие, мастерство, специализация, активные навыки и пресеты этого класса. Купленные классы, найденные навыки, валюта и трофеи сохранятся.</small>
  </div><aside><b>ПОСЛЕ СЛЕДУЮЩЕГО</b><strong>XP ${formatRebirthMultiplierCount(count + 1)} · +${nextStatBonus.toLocaleString('ru-RU')}%</strong><button type="button" data-rebirth="${classId}" ${level >= 50 ? '' : 'disabled'}>${level >= 50 ? 'СДЕЛАТЬ РЕБЕРС' : `НУЖЕН УРОВЕНЬ 50 · СЕЙЧАС ${level}`}</button></aside>`;
  dom.rebirthPanel.querySelector('[data-rebirth]')?.addEventListener('click', () => performRebirth(classId));
}

function performRebirth(classId) {
  if (!CLASS_META[classId] || classLevel(classId) < 50) return toast('Для реберса нужен 50-й уровень класса', 'warn');
  const nextCount = rebirthCount(classId) + 1;
  const confirmed = window.confirm(`Сделать реберс класса «${CLASS_META[classId].label}»?\n\nУровень, оружие, мастерство, специализация, активные навыки и пресеты этого класса будут сброшены. Коллекция найденных навыков, валюта и трофеи сохранятся.`);
  if (!confirmed) return;
  profile.classRebirths[classId] = Math.min(Number.MAX_SAFE_INTEGER, nextCount);
  profile.classProgress[classId] = { xp: 0 };
  for (const [weaponId, weapon] of Object.entries(WEAPON_META)) {
    if (weapon.classId === classId) profile.weaponProgress[weaponId] = { xp: 0, choices: {} };
  }
  profile.selectedWeapons[classId] = DEFAULT_WEAPON[classId];
  profile.equippedSkills[classId] = [];
  delete profile.classSpecializations[classId];
  profile.loadoutPresets = profile.loadoutPresets.map((preset) => preset?.classId === classId ? null : preset);
  profile.unlockedWeapons = Object.entries(WEAPON_META).filter(([, weapon]) => classLevel(weapon.classId) >= weapon.unlockLevel).map(([id]) => id);
  saveProfile();
  if (lobbyState) socket.emit('select-class', classPayload(classId));
  renderShop();
  toast(`${CLASS_META[classId].label}: реберс ${profile.classRebirths[classId]} · ${formatRebirthMultiplier(classId)} XP · +${profile.classRebirths[classId] * 20}% к базовым статам`, 'gold');
}

function renderBossCodex() {
  if (!dom.bossCodex) return;
  dom.bossCodex.innerHTML = BOSS_META.map((boss, index) => {
    const record = profile.bossCodex[boss.id] || { seen: 0, wins: 0 };
    const known = record.seen > 0;
    const trophy = profile.bossTrophies.includes(boss.id);
    return `<article class="codex-card ${known ? 'known' : 'unknown'} ${trophy ? 'complete' : ''}"><span>${String(index + 1).padStart(2, '0')}</span><div><strong>${known ? boss.name : 'НЕИЗВЕСТНЫЙ ВЛАДЫКА'}</strong><b>${known ? boss.title : 'Запись закрыта'}</b><small>${known ? boss.hint : `Встреть босса на стадиях ${index * 5 + 1}–${index * 5 + 5}.`}</small>${known ? `<em>СЛАБОСТЬ: ${boss.weakness}</em>` : ''}</div><aside><b>${record.wins}</b><small>ПОБЕД</small>${trophy ? '<i>ТИТУЛ ПОЛУЧЕН</i>' : ''}</aside></article>`;
  }).join('');
}

function formatKeyCode(code) {
  if (KEY_LABELS[code]) return KEY_LABELS[code];
  return String(code || '?').replace(/^Key/, '').replace(/^Digit/, '');
}

function renderSettings() {
  if (!dom.settingsPanel) return;
  dom.settingsPanel.innerHTML = `<div class="binding-grid">${Object.entries(ACTION_LABELS).map(([action, label]) => `<div><span>${label}</span><button type="button" data-rebind="${action}" class="${waitingBindingAction === action ? 'listening' : ''}">${waitingBindingAction === action ? 'НАЖМИ КЛАВИШУ' : formatKeyCode(profile.settings.bindings[action])}</button></div>`).join('')}</div>
    <div class="settings-sliders"><label><span>ЭФФЕКТЫ <b>${Math.round(profile.settings.effectsVolume * 100)}%</b></span><input type="range" min="0" max="1" step="0.05" value="${profile.settings.effectsVolume}" data-setting-range="effectsVolume"></label><label><span>МУЗЫКА <b>${Math.round(profile.settings.musicVolume * 100)}%</b></span><input type="range" min="0" max="1" step="0.05" value="${profile.settings.musicVolume}" data-setting-range="musicVolume"></label><label><span>ТРЯСКА ЭКРАНА <b>${Math.round(profile.settings.screenShake * 100)}%</b></span><input type="range" min="0" max="1.5" step="0.1" value="${profile.settings.screenShake}" data-setting-range="screenShake"></label></div>
    <div class="access-grid"><label><input type="checkbox" data-access="highContrast" ${profile.settings.highContrast?'checked':''}><span>Высокая контрастность</span></label><label><input type="checkbox" data-access="reducedFlash" ${profile.settings.reducedFlash?'checked':''}><span>Меньше вспышек и анимаций</span></label><label><input type="checkbox" data-access="telegraphText" ${profile.settings.telegraphText?'checked':''}><span>Названия атак над боссом</span></label><label><input type="checkbox" data-access="colorblind" ${profile.settings.colorblind?'checked':''}><span>Различимые цвета опасностей</span></label></div>
    <label class="gamepad-toggle"><input type="checkbox" data-gamepad-toggle ${profile.settings.gamepad ? 'checked' : ''}><span>Геймпад включён · A — прыжок, X/Y — атаки, LB — парирование, RB — перекат, RT — способность</span></label>
    <button type="button" class="reset-bindings" data-reset-bindings>СБРОСИТЬ УПРАВЛЕНИЕ</button>`;
  dom.settingsPanel.querySelectorAll('[data-rebind]').forEach((button) => button.addEventListener('click', () => { waitingBindingAction = button.dataset.rebind; renderSettings(); }));
  dom.settingsPanel.querySelectorAll('[data-setting-range]').forEach((range) => range.addEventListener('change', () => { profile.settings[range.dataset.settingRange] = Number(range.value); saveProfile(); }));
  dom.settingsPanel.querySelector('[data-gamepad-toggle]')?.addEventListener('change', (event) => { profile.settings.gamepad = event.target.checked; resetGamepadInput(); saveProfile(); });
  dom.settingsPanel.querySelectorAll('[data-access]').forEach((box)=>box.addEventListener('change',()=>{profile.settings[box.dataset.access]=box.checked;applyAccessibility();saveProfile();}));
  dom.settingsPanel.querySelector('[data-reset-bindings]')?.addEventListener('click', () => { profile.settings.bindings = { ...DEFAULT_BINDINGS }; waitingBindingAction = ''; saveProfile(); toast('Управление сброшено', 'gold'); });
}

function renderAppearance() {
  if (!dom.appearanceShop) return;
  dom.appearanceShop.innerHTML = `<div class="appearance-group"><strong>ЦВЕТ ДОСПЕХА</strong><div>${Object.entries(ARMOR_META).map(([id, item]) => `<button type="button" class="appearance-swatch ${profile.appearance.armor === id ? 'selected' : ''}" data-armor="${id}" style="--swatch:${item.color}" title="${item.name}"><i></i><span>${item.name}</span></button>`).join('')}</div></div>
    <div class="appearance-group"><strong>СЛЕД ДВИЖЕНИЯ</strong><div>${Object.entries(AURA_META).map(([id, item]) => `<button type="button" class="aura-choice ${profile.appearance.aura === id ? 'selected' : ''}" data-aura="${id}" style="--swatch:${item.color}"><i></i><span>${item.name}</span></button>`).join('')}</div></div>
    <div class="appearance-group title-group"><strong>ТИТУЛ НАД ИМЕНЕМ</strong><div><button type="button" data-title="wanderer" class="aura-choice ${profile.appearance.title === 'wanderer' ? 'selected' : ''}"><i>◇</i><span>Странник</span></button>${profile.bossTrophies.map((id) => { const boss = BOSS_BY_ID.get(id); return `<button type="button" data-title="title_${id}" class="aura-choice ${profile.appearance.title === `title_${id}` ? 'selected' : ''}"><i>♛</i><span>${boss.title}</span></button>`; }).join('')}</div></div>`;
  dom.appearanceShop.querySelectorAll('[data-armor]').forEach((button) => button.addEventListener('click', () => { profile.appearance.armor = button.dataset.armor; saveProfile(); if (lobbyState) socket.emit('select-class', classPayload()); }));
  dom.appearanceShop.querySelectorAll('[data-aura]').forEach((button) => button.addEventListener('click', () => { profile.appearance.aura = button.dataset.aura; saveProfile(); if (lobbyState) socket.emit('select-class', classPayload()); }));
  dom.appearanceShop.querySelectorAll('[data-title]').forEach((button) => button.addEventListener('click', () => { profile.appearance.title = button.dataset.title; saveProfile(); if (lobbyState) socket.emit('select-class', classPayload()); }));
}

function renderLootGear() {
  if (!dom.lootLoadout || !dom.lootInventory) return;
  const armor = LOOT_BY_ID.get(profile.gear.armor);
  const artifacts = profile.gear.artifacts.map((id) => LOOT_BY_ID.get(id)).filter(Boolean);
  const slots = [
    { label:'БРОНЯ',item:armor },
    { label:'АРТЕФАКТ I',item:artifacts[0] },
    { label:'АРТЕФАКТ II',item:artifacts[1] },
  ];
  dom.lootPityText.textContent = `${profile.ownedLoot.length} / ${LOOT_ITEMS.length} · НАКОПЛЕННЫЙ ШАНС +${Math.round(profile.lootPity * 1.25 * 10) / 10}%`;
  dom.lootLoadout.innerHTML = slots.map(({label,item}) => `<article class="loot-slot ${item ? item.rarity : 'empty'}">
    <span>${label}</span><i>${item ? (item.type === 'armor' ? '♜' : '◆') : '◇'}</i><strong>${item?.name || 'ПУСТО'}</strong><small>${item?.description || 'Выберите найденный трофей ниже.'}</small>
  </article>`).join('');
  const owned = LOOT_ITEMS.filter((item) => profile.ownedLoot.includes(item.id));
  dom.lootInventory.innerHTML = owned.length ? owned.map((item) => {
    const equipped = profile.gear.armor === item.id || profile.gear.artifacts.includes(item.id);
    return `<button type="button" class="loot-item ${item.rarity} ${equipped ? 'equipped' : ''}" data-loot-gear="${item.id}">
      <i>${item.type === 'armor' ? '♜' : '◆'}</i><span><b>${item.name}</b><small>${item.description}</small></span><em>${LOOT_RARITY_LABEL[item.rarity]} · ${item.type === 'armor' ? 'БРОНЯ' : 'АРТЕФАКТ'}</em><strong>${equipped ? 'СНЯТЬ' : 'НАДЕТЬ'}</strong>
    </button>`;
  }).join('') : '<div class="loot-empty"><b>ТРОФЕЕВ ПОКА НЕТ</b><span>После победы над любым боссом есть небольшой шанс найти постоянную броню или артефакт. Серия побед постепенно повышает шанс.</span></div>';
  dom.lootInventory.querySelectorAll('[data-loot-gear]').forEach((button) => button.addEventListener('click', () => {
    const id = button.dataset.lootGear;
    const item = LOOT_BY_ID.get(id);
    if (!item || !profile.ownedLoot.includes(id)) return;
    if (item.type === 'armor') profile.gear.armor = profile.gear.armor === id ? null : id;
    else if (profile.gear.artifacts.includes(id)) profile.gear.artifacts = profile.gear.artifacts.filter((ownedId) => ownedId !== id);
    else if (profile.gear.artifacts.length < 2) profile.gear.artifacts.push(id);
    else profile.gear.artifacts = [profile.gear.artifacts[1], id];
    saveProfile();
    if (lobbyState) socket.emit('select-class', classPayload());
    toast(`${item.name}: ${profile.gear.armor === id || profile.gear.artifacts.includes(id) ? 'экипировано' : 'снято'}`, 'gold');
  }));
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
  profile.stats.highestStage = Math.max(profile.stats.highestStage, data.result === 'victory' ? 51 : data.stageReached);
  profile.stats.parries += me.parries || 0;
  profile.stats.bosses += me.bossesDefeated || 0;
  profile.stats.noHitStages += me.noHitStages || 0;
  profile.stats.damage += me.damageDone || 0;
  profile.daily.stages += me.bossesDefeated || 0;
  profile.daily.parries += me.parries || 0;
  profile.daily.damage += me.damageDone || 0;
  if(me.lastDamageAttack)profile.nemesisAttacks[me.classId]=me.lastDamageAttack;
  for (const id of Array.isArray(me.lootDrops) ? me.lootDrops : []) if (LOOT_BY_ID.has(id) && !profile.ownedLoot.includes(id)) profile.ownedLoot.push(id);
  profile.lootPity = Math.min(16,Math.max(0,Math.floor(Number(me.lootPity) || 0)));
  const oldLevel = classLevel(me.classId);
  const xpMultiplier = rebirthXpMultiplier(me.classId);
  const baseXpEarned = (me.bossesDefeated || 0) * 180 + Math.floor((me.damageDone || 0) / 125) + (data.result === 'victory' ? 500 : 0);
  const xpEarned = Math.min(Number.MAX_SAFE_INTEGER, baseXpEarned * xpMultiplier);
  profile.classProgress[me.classId].xp = Math.min(Number.MAX_SAFE_INTEGER, profile.classProgress[me.classId].xp + xpEarned);
  const newLevel = classLevel(me.classId);
  const weaponId = WEAPON_META[me.weaponId] ? me.weaponId : DEFAULT_WEAPON[me.classId];
  const oldMastery = masteryLevel(weaponId);
  const baseMasteryXp = (me.bossesDefeated || 0) * 115 + Math.floor((me.damageDone || 0) / 175) + (data.result === 'victory' ? 350 : 0);
  const masteryXp = Math.min(Number.MAX_SAFE_INTEGER, baseMasteryXp * xpMultiplier);
  profile.weaponProgress[weaponId].xp = Math.min(Number.MAX_SAFE_INTEGER, profile.weaponProgress[weaponId].xp + masteryXp);
  const newMastery = masteryLevel(weaponId);
  if (data.result === 'victory' && data.difficulty === 'normal') profile.ngPlusUnlocked = true;
  if (data.result === 'victory' && data.difficulty === 'ngplus') profile.ngPlusWins += 1;
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
  toast(`${CLASS_META[me.classId].label}: +${xpEarned.toLocaleString('ru-RU')} XP · ${formatRebirthMultiplier(me.classId)}${newLevel > oldLevel ? ` · УРОВЕНЬ ${newLevel}` : ''}`, 'gold');
  toast(`${WEAPON_META[weaponId].name}: +${masteryXp.toLocaleString('ru-RU')} мастерства${newMastery > oldMastery ? ` · УРОВЕНЬ ${newMastery}` : ''}`, 'gold');
  if (data.result === 'victory' && data.difficulty === 'normal') toast('Открыта «Новая игра+»', 'gold');
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
  renderMastery();
  renderSpecializations();
  renderRebirth();
  renderLootGear();
  renderAppearance();
  renderProgression();
  renderBoxSlots();
  renderSkillCollection();
  renderBossCodex();
  renderSettings();
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
  currentTraining = false;
  sessionStorage.setItem('riftRaidActiveRoom', room.code);
  gameState = null;
  dom.resultOverlay.classList.remove('active');
  dom.perkOverlay.classList.remove('active');
  dom.routeOverlay.classList.remove('active');
  dom.fusionOverlay?.classList.remove('active');dom.contractOverlay?.classList.remove('active');dom.spectatorPanel?.classList.remove('active');
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
    const title = player.appearance?.title && player.appearance.title !== 'wanderer' ? BOSS_BY_ID.get(player.appearance.title.replace(/^title_/, ''))?.title : '';
    cards.push(`<article class="squad-card ${isMe ? 'me' : ''}" style="--class-color:${meta.color}">
      <span class="slot-number">0${index + 1}</span>${player.isHost ? '<span class="host-chip">ХРАНИТЕЛЬ</span>' : ''}
      <div class="avatar-art"></div><div class="squad-info"><strong>${escapeHtml(player.name)}${isMe ? ' · ВЫ' : ''}</strong>
      ${title ? `<small>${escapeHtml(title)}</small>` : ''}<button type="button" ${isMe ? 'data-cycle-class' : 'disabled'}>${meta.label} · ${weapon.name}${player.specialization ? ` · ${SPECIALIZATION_META[player.classId]?.[player.specialization]?.name || ''}` : ''}</button></div></article>`);
  }
  dom.squadGrid.innerHTML = cards.join('');
  const isHost = room.hostId === socket.id;
  dom.startGameButton.style.display = isHost ? 'flex' : 'none';
  dom.startGameButton.disabled = false;
  const mode = `${room.mode==='daily'?' · ЕЖЕДНЕВНЫЙ РАЗЛОМ':room.difficulty === 'ngplus' ? ' · NG+' : ''}${room.isPublic?' · ОТКРЫТАЯ':''}`;
  dom.lobbyHint.querySelector('span').textContent = `${isHost ? (room.players.length === 1 ? 'МОЖНО НАЧАТЬ В ОДИНОЧКУ' : 'ОТРЯД ГОТОВ') : 'ЖДЁМ ХРАНИТЕЛЯ'}${mode}`;
  dom.squadGrid.querySelector('[data-cycle-class]')?.addEventListener('click', () => {
    const unlocked = Object.keys(CLASS_META).filter((id) => profile.unlockedClasses.includes(id));
    chooseClass(unlocked[(unlocked.indexOf(selectedClass) + 1) % unlocked.length], true);
  });
}

function createRoom() {
  setBusy(dom.createRoomButton, true, 'ОТКРЫТЬ РАЗЛОМ');
  const difficulty = dom.runDifficulty?.value === 'ngplus' && profile.ngPlusUnlocked ? 'ngplus' : 'normal';
  const mode = dom.runMode?.value === 'daily' ? 'daily' : 'standard';
  socket.emit('create-room', { name: currentName(), difficulty, mode, isPublic: dom.publicRoomToggle?.checked === true, ...classPayload() }, (response) => {
    setBusy(dom.createRoomButton, false, 'ОТКРЫТЬ РАЗЛОМ');
    if (!response?.ok) return showError(dom.homeError, response?.error || 'Не удалось открыть комнату');
    enterLobby(response.room);
  });
}

function joinRoom(requestedCode = '') {
  const code = String(requestedCode || dom.roomCodeInput.value).trim().toUpperCase();
  if (code.length !== 5) return showError(dom.homeError, 'Нужен пятизначный код');
  dom.joinRoomButton.disabled = true;
  socket.emit('join-room', { code, name: currentName(), ...classPayload() }, (response) => {
    dom.joinRoomButton.disabled = false;
    if (!response?.ok) return showError(dom.homeError, response?.error || 'Не удалось войти');
    enterLobby(response.room);
  });
}

function startTraining() {
  currentTraining = true;
  dom.startTrainingButton.disabled = true;
  socket.emit('start-training', {
    name: currentName(), bossIndex: Number(dom.trainingBossSelect.value) || 0,
    attack: dom.trainingAttackSelect.value || 'random', phase:Number(dom.trainingPhaseSelect?.value)||1,
    arenaIndex:Number(dom.trainingArenaSelect?.value)||0, speed:Number(dom.trainingSpeedSelect?.value)||1,
    damageMode:dom.trainingDamageSelect?.value||'normal', infiniteStamina:dom.trainingStaminaToggle?.checked===true,
    ...classPayload(),
  }, (response) => {
    dom.startTrainingButton.disabled = false;
    if (!response?.ok) { currentTraining = false; return showError(dom.homeError, response?.error || 'Не удалось запустить тренировку'); }
    roomCode = response.code;
    dom.hudRoomCode.textContent = 'ТРЕН.';
    sessionStorage.setItem('riftRaidActiveRoom', response.code);
  });
}

function populateTraining() {
  if (!dom.trainingBossSelect || !dom.trainingAttackSelect) return;
  dom.trainingBossSelect.innerHTML = BOSS_META.map((boss, index) => `<option value="${index}">${index + 1}. ${boss.name}</option>`).join('');
  dom.trainingAttackSelect.innerHTML = Object.entries(ATTACK_META).map(([id, name]) => `<option value="${id}">${name}</option>`).join('');
  if(dom.trainingArenaSelect)dom.trainingArenaSelect.innerHTML=['Пепельные врата','Зал углей','Расколотая кузня','Затопленная крипта','Колокольня','Багровый ров','Безмолвная тюрьма','Лунный разлом','Сердце бури','Трон Пустоты'].map((name,index)=>`<option value="${index}">${index+1}. ${name}</option>`).join('');
}

function loadDailyBoard() {
  if(!dom.dailyBoard)return;
  dom.dailyBoard.innerHTML='<small>Загружаем лучшие попытки дня…</small>';
  Promise.all([1,2,3,4].map((size)=>new Promise((resolve)=>socket.emit('daily-leaderboard',size,resolve)))).then((boards)=>{
    const rows=boards.flatMap((board)=>(board?.entries||[]).slice(0,3).map((entry,index)=>`<article><b>${board.teamSize}ИГР · #${index+1}</b><strong>${escapeHtml(entry.names)}</strong><span>${entry.stages} стадий · ${formatTime(entry.elapsed)}</span></article>`));
    dom.dailyBoard.innerHTML=rows.length?rows.join(''):`<small>${boards[0]?.key||dateKey()} · сегодня завершённых попыток пока нет.</small>`;
  });
}

function loadPublicRooms() {
  if (!dom.publicRoomsList) return;
  dom.publicRoomsButton.disabled = true;
  dom.publicRoomsList.innerHTML = '<small>Ищем открытые комнаты...</small>';
  const startedAt = performance.now();
  socket.emit('ping-check', () => {
    const ping = Math.round(performance.now() - startedAt);
    socket.emit('list-public-rooms', (rooms = []) => {
      dom.publicRoomsButton.disabled = false;
      if (!rooms.length) { dom.publicRoomsList.innerHTML = '<small>Сейчас нет свободных открытых комнат.</small>'; return; }
      dom.publicRoomsList.innerHTML = rooms.map((room) => `<article class="public-room"><div><strong>${room.code}</strong><small>${room.region} · ${room.mode==='daily'?'ЕЖЕДНЕВНЫЙ':room.difficulty === 'ngplus' ? 'NG+' : 'ОБЫЧНЫЙ'} · ~${ping} мс</small></div><b>${room.players} / ${room.maxPlayers}</b><button type="button" data-public-code="${room.code}">ВОЙТИ</button></article>`).join('');
      dom.publicRoomsList.querySelectorAll('[data-public-code]').forEach((button) => button.addEventListener('click', () => { dom.roomCodeInput.value = button.dataset.publicCode; joinRoom(button.dataset.publicCode); }));
    });
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
  currentTraining = false;
  sessionStorage.removeItem('riftRaidActiveRoom');
  lobbyState = gameState = null;
  resetInput();
  dom.resultOverlay.classList.remove('active');
  dom.perkOverlay.classList.remove('active');
  dom.routeOverlay.classList.remove('active');
  dom.fusionOverlay?.classList.remove('active');dom.contractOverlay?.classList.remove('active');dom.spectatorPanel?.classList.remove('active');
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
  const objectiveProgress=state.objective?.id==='survive'?` · ${Math.ceil(state.objectiveTimer||0)}С`:state.objective?.id==='seals'?` · ${state.objectiveSeals||0}/${state.objective.seals||3}`:state.objective?.id==='parallel'?` · ${state.parallelCharge||0}%`:'';
  dom.stageText.textContent = `СТАДИЯ ${state.stage} / ${state.maxStage}${state.arena?.name ? ` · ${state.arena.name}` : ''} · ${state.objective?.name||'СРАЖЕНИЕ'}${objectiveProgress}`;
  dom.bossName.textContent = state.boss ? `${state.boss.name} · УРОН ${state.boss.damage}` : 'ПУТЬ МЕЖДУ ПЕЧАТЯМИ';
  dom.bossPhaseText.textContent = `ФАЗА ${['I','II','III'][(state.boss?.phase || 1) - 1]}${state.arena?.layered?` · СЛОЙ ${(state.boss?.worldLayer||0)+1}`:''}${state.boss?.languageRune?` · ${state.boss.languageRune}`:''}`;
  dom.modifierText.textContent = state.training ? 'ТРЕНИРОВКА' : `${state.mode==='daily'?'ДЕНЬ · ':''}${state.difficulty === 'ngplus' ? 'NG+ · ' : ''}${state.stageLaw?.name||state.contractEffect?.name||state.modifier?.name||'БЕЗ МОДИФИКАТОРА'}`;
  dom.trainingExitButton.style.display = state.training ? 'block' : 'none';
  dom.teamPowerText.textContent = `${state.teamPower || 0}%`;
  dom.teamPowerBar.style.width = `${state.teamPower || 0}%`;
  if (state.boss) {
    const ratio = Math.max(0, state.boss.hp / state.boss.maxHp);
    dom.bossHealthBar.style.width = `${ratio * 100}%`;
    dom.bossHealthText.textContent = `${state.boss.hp} / ${state.boss.maxHp}`;
    dom.bossPoiseBar.style.width = `${Math.max(0, state.boss.poise / state.boss.maxPoise * 100)}%`;
    const statuses = [];
    if (state.boss.exposed) statuses.push('СТОЙКОСТЬ СЛОМАНА · +35% УРОНА');
    if (state.boss.synergies?.arcaneMark) statuses.push('МЕТКА ПЕПЛА');
    if (state.boss.synergies?.breached) statuses.push('БРОНЯ ПРОБИТА');
    if(state.boss.armorParts)statuses.push(`ЖИВАЯ БРОНЯ ×${state.boss.armorParts}`);
    if(state.boss.modules?.length)statuses.push(state.boss.modules.map((item)=>item.name).join(' + '));
    if(state.boss.copiedPerk)statuses.push(`КОПИЯ ДАРА: ${state.boss.copiedPerk}`);
    if (state.boss.mutations?.length) statuses.push(state.boss.mutations.map((item)=>item.name).join(' + '));
    if(state.teamVow){const progress=state.teamVow.id==='parry'?`${state.vowProgress?.parries||0}/${state.teamVow.target}`:state.teamVow.id==='mercy'?`${state.vowProgress?.hits||0}/${state.teamVow.target} ПОПАДАНИЙ`:`${Math.round(state.vowProgress?.time||0)}/${state.teamVow.target}С`;statuses.push(`${state.teamVow.name} · ${progress}`);}
    const bond=Object.entries(state.bonds||{}).sort((a,b)=>b[1]-a[1])[0];if(bond)statuses.push(`СВЯЗЬ ${bond[0]} · УРОВЕНЬ ${Math.min(5,Math.floor(bond[1]/4)+1)}`);
    dom.bossStatusText.textContent = statuses.join(' · ');
  }
  const me = state.players.find((player) => player.id === socket.id);
  if (me) {
    dom.heartsBar.innerHTML = Array.from({ length: me.maxHp }, (_, index) => `<span class="heart ${index >= me.hp ? 'empty' : ''}">♥</span>`).join('');
    dom.staminaBar.style.width = `${Math.max(0, me.stamina / me.maxStamina * 100)}%`;
    const abilityReady=Math.max(0,1-me.abilityCooldown/Math.max(.1,me.abilityMaxCooldown));dom.abilityBar.style.width=`${abilityReady*100}%`;const wounds=Object.values(me.wounds||{}).reduce((sum,value)=>sum+value,0);dom.abilityLabel.textContent=`V · ${me.abilityName}${me.abilityCooldown>0?` · ${me.abilityCooldown.toFixed(1)}С`:' · ГОТОВО'} · R ${me.stance?.name||'БЫСТРАЯ'} · ФОРМА ${String(me.weaponEvolution||'unformed').toUpperCase()}${me.stolenTechnique&&!me.stolenTechniqueUsed?` · F ${ATTACK_META[me.stolenTechnique]||me.stolenTechnique}`:''}${wounds?` · РАНЕНИЯ ${wounds}`:''}`;
    const alive=state.players.filter((player)=>!player.downed&&player.id!==socket.id);dom.spectatorPanel?.classList.toggle('active',me.downed&&alive.length>0);
    if(me.downed&&alive.length){spectatorIndex=((spectatorIndex%alive.length)+alive.length)%alive.length;dom.spectatorTarget.textContent=`Наблюдение: ${alive[spectatorIndex].name} · сигналов ${me.pingsRemaining} · помощь ${me.spectralCooldown>0?`${me.spectralCooldown.toFixed(1)}с`:'готова'}`;}else spectatorIndex=0;
  }
  dom.squadHud.innerHTML = state.players.map((player) => {
    const meta = CLASS_META[player.classId];
    const color = ARMOR_META[player.appearance?.armor]?.color || meta.color;
    const targeted = state.boss?.targetId === player.id;
    return `<div class="hud-player ${player.downed ? 'downed' : ''} ${player.connected === false ? 'disconnected' : ''}" style="--class-color:${color}">
      <span class="hud-avatar">${targeted ? '!' : meta.short}</span><div><strong>${escapeHtml(player.name)}${player.id === socket.id ? ' · ВЫ' : ''}${targeted ? ' · ЦЕЛЬ' : ''}</strong>
      ${player.connected === false ? '<small>ПЕРЕПОДКЛЮЧЕНИЕ…</small>' : `<small>${state.arena?.layered?`СЛОЙ ${(player.worldLayer||0)+1} · `:''}${player.echoResonance?'ЭХО · ':''}${player.weaponEvolution&&player.weaponEvolution!=='unformed'?player.weaponEvolution.toUpperCase():player.focus?`ФОКУС ${player.focus}/3${player.riposteReady?' · КОНТРАТАКА':''}`:''}</small>`}<span class="mini-bars"><span><i style="width:${player.hp / player.maxHp * 100}%"></i></span><span><i style="width:${player.stamina / player.maxStamina * 100}%"></i></span></span></div></div>`;
  }).join('');
}

function showRoutes(state) {
  if (!dom.routeOverlay) return;
  dom.perkOverlay.classList.remove('active');
  dom.perkOverlay.setAttribute('aria-hidden', 'true');
  dom.fusionOverlay?.classList.remove('active');dom.contractOverlay?.classList.remove('active');
  dom.routeOverlay.classList.add('active');
  dom.routeOverlay.setAttribute('aria-hidden', 'false');
  const myVote = state.routeVotes?.[socket.id];
  const key = `${state.stage}:${myVote || ''}:${(state.routeOffer || []).map((route) => route.id).join(',')}:${Object.keys(state.routeVotes || {}).length}`;
  if (key === currentRouteKey) return;
  currentRouteKey = key;
  resetInput();
  dom.routeSubtitle.textContent=`Голос большинства определит путь. Ближайшие законы: ${(state.fatePreview||[]).map((law)=>law.name).join(' → ')||'неизвестны'}.`;
  const voteCounts = {};
  for (const routeId of Object.values(state.routeVotes || {})) voteCounts[routeId] = (voteCounts[routeId] || 0) + 1;
  const icons = { sanctuary:'♨', elite:'⚔', curse:'◇', forge:'⌁', oath:'✦', ruins:'⌂', healing:'✚',merchant:'¤',trial:'◆',ambush:'!',debt:'⌛',phase_theft:'◐',corruption:'※',fate_shift:'⁂',law_haste:'»',law_weight:'▰',law_mirror:'◇',law_scarcity:'∅',law_rift:'◑' };
  dom.routeGrid.innerHTML = (state.routeOffer || []).map((route) => `<button class="route-card ${route.special === 'healing' ? 'healing' : ''} ${myVote === route.id ? 'voted' : ''}" type="button" data-route="${route.id}" ${myVote ? 'disabled' : ''}><i>${icons[route.id] || '◇'}</i><h3>${route.name}</h3><p>${route.description}</p><b>${voteCounts[route.id] || 0} ГОЛОСОВ</b></button>`).join('');
  dom.routeWaiting.textContent = myVote ? 'ЖДЁМ РЕШЕНИЕ ОТРЯДА' : 'ВЫБЕРИ ОДИН ИЗ ТРЁХ ПУТЕЙ';
  dom.routeGrid.querySelectorAll('[data-route]:not(:disabled)').forEach((button) => button.addEventListener('click', () => {
    dom.routeGrid.querySelectorAll('button').forEach((item) => { item.disabled = true; });
    socket.emit('choose-route', button.dataset.route, (response) => { if (!response?.ok) { currentRouteKey = ''; toast(response?.error || 'Не удалось выбрать путь', 'danger'); } });
  }));
}

function showFusions(state) {
  const me=state.players.find((player)=>player.id===socket.id);if(!me||!dom.fusionOverlay)return;
  dom.perkOverlay.classList.remove('active');dom.routeOverlay.classList.remove('active');dom.contractOverlay?.classList.remove('active');dom.fusionOverlay.classList.add('active');dom.fusionOverlay.setAttribute('aria-hidden','false');
  const offers=state.fusionOffers?.[socket.id]||[];const key=`${state.stage}:${me.perkChosen}:${offers.map((item)=>item.id).join(',')}`;if(key===currentFusionKey)return;currentFusionKey=key;resetInput();
  if(me.perkChosen){dom.fusionGrid.innerHTML='';dom.fusionWaiting.textContent='СПЛАВ ЗАВЕРШЁН · ЖДЁМ ОТРЯД';return;}
  const cards=offers.map((fusion)=>`<button class="choice-card" type="button" data-fusion="${fusion.id}"><i>⌁</i><h3>${escapeHtml(fusion.name)}</h3><p>${escapeHtml(fusion.description)}</p><b>ПОГЛОТИТ: ${fusion.requires.join(' + ')}</b></button>`).join('');
  dom.fusionGrid.innerHTML=`${cards}<button class="choice-card" type="button" data-fusion="skip"><i>→</i><h3>Пройти мимо</h3><p>Сохрани текущие карты без изменений.</p><b>БЕЗ СПЛАВА</b></button>`;dom.fusionWaiting.textContent=offers.length?'ВЫБЕРИ СПЛАВ ИЛИ ПРОЙДИ МИМО':'ПОДХОДЯЩИХ СОЧЕТАНИЙ ПОКА НЕТ';
  dom.fusionGrid.querySelectorAll('[data-fusion]').forEach((button)=>button.addEventListener('click',()=>{dom.fusionGrid.querySelectorAll('button').forEach((item)=>{item.disabled=true;});socket.emit('choose-fusion',button.dataset.fusion,(response)=>{if(!response?.ok){currentFusionKey='';toast(response?.error||'Кузня не ответила','danger');}});}));
}

function showContracts(state) {
  if(!dom.contractOverlay)return;dom.perkOverlay.classList.remove('active');dom.routeOverlay.classList.remove('active');dom.fusionOverlay?.classList.remove('active');dom.contractOverlay.classList.add('active');dom.contractOverlay.setAttribute('aria-hidden','false');
  const myVote=state.contractVotes?.[socket.id];const offers=state.contractOffer||[];const key=`${state.stage}:${myVote||''}:${offers.map((item)=>item.id).join(',')}:${Object.keys(state.contractVotes||{}).length}`;if(key===currentContractKey)return;currentContractKey=key;resetInput();
  const votes={};for(const id of Object.values(state.contractVotes||{}))votes[id]=(votes[id]||0)+1;
  dom.contractGrid.innerHTML=offers.map((contract)=>`<button class="choice-card ${myVote===contract.id?'voted':''}" type="button" data-contract="${contract.id}" ${myVote?'disabled':''}><i>${contract.id==='none'?'◇':'!'}</i><h3>${escapeHtml(contract.name)}</h3><p>${escapeHtml(contract.description)}</p><b>${votes[contract.id]||0} ГОЛОСОВ · ×${contract.reward||1} ПЕПЛА</b></button>`).join('');dom.contractWaiting.textContent=myVote?'ЖДЁМ РЕШЕНИЕ ОТРЯДА':'ПРИМИТЕ ОДНО УСЛОВИЕ';
  dom.contractGrid.querySelectorAll('[data-contract]:not(:disabled)').forEach((button)=>button.addEventListener('click',()=>{dom.contractGrid.querySelectorAll('button').forEach((item)=>{item.disabled=true;});socket.emit('choose-contract',button.dataset.contract,(response)=>{if(!response?.ok){currentContractKey='';toast(response?.error||'Контракт закрыт','danger');}});}));
}

function showPerks(state) {
  const me = state.players.find((player) => player.id === socket.id);
  if (!me) return;
  const key = `${state.stage}:${me.perkChosen}:${me.perkOffer.map((perk) => perk.id).join(',')}`;
  dom.perkOverlay.classList.add('active');
  dom.fusionOverlay?.classList.remove('active');dom.contractOverlay?.classList.remove('active');
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
  dom.perkGrid.innerHTML = me.perkOffer.map((perk) => {
    const next=(me.perks[perk.id]||0)+1;
    return `<button class="perk-card ${perk.rarity}${perk.classId ? ' class-perk' : ''}" type="button" data-perk="${perk.id}">
      <span class="perk-topline"><span class="perk-rarity">${next===3&&EVOLVING_PERKS.has(perk.id)?'ЭВОЛЮЦИЯ · ':''}${rarityNames[perk.rarity]}</span>${perk.classId ? `<span class="perk-class">ТОЛЬКО: ${CLASS_META[perk.classId].label}</span>` : ''}</span><span class="perk-icon">${perk.icon}</span>
      <h3>${perk.name}</h3><p>${perk.description}</p>${me.perks[perk.id] ? `<span class="perk-stack">УЖЕ: ×${me.perks[perk.id]}</span>` : ''}</button>`;
  }).join('');
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
  sessionStorage.removeItem('riftRaidActiveRoom');
  applyRunProgress(data);
  const myResult=data.players.find((player)=>player.id===socket.id);
  if(myResult&&!currentTraining&&ghostRecording.length&&(data.stagesCleared>(profile.ghosts?.[myResult.classId]?.stages||0))){profile.ghosts[myResult.classId]={stages:data.stagesCleared,samples:ghostRecording};saveProfile();toast('Призрак лучшего забега сохранён','gold');}
  const victory = data.result === 'victory';
  dom.resultKicker.textContent = victory ? (data.difficulty === 'ngplus' ? 'NG+ ЗАВЕРШЕНА' : 'ПОСЛЕДНЯЯ ПЕЧАТЬ') : 'ЗАБЕГ ОКОНЧЕН';
  dom.resultTitle.textContent = victory ? (data.ending?.title||'Пепельный король повержен') : 'Пламя погасло';
  dom.resultSubtitle.textContent = victory ? `${data.ending?.description||'Все 50 печатей разрушены.'}${data.difficulty === 'ngplus' ? ' Новая игра+ завершена.' : ''}` : `Отряд достиг стадии ${data.stageReached}. Ниже — разбор попытки.`;
  dom.runSummary.innerHTML = `<div class="summary-box"><strong>${data.stagesCleared}</strong><span>СТАДИЙ ПРОЙДЕНО</span></div><div class="summary-box"><strong>${formatTime(data.elapsed)}</strong><span>ВРЕМЯ ЗАБЕГА</span></div><div class="summary-box"><strong>${data.mode==='daily'?'ДЕНЬ':data.difficulty === 'ngplus' ? 'NG+' : 'I'}</strong><span>СЛОЖНОСТЬ</span></div>`;
  dom.resultStats.innerHTML = data.players.map((player, index) => {
    const parryRate = player.parryAttempts ? Math.round((player.parries || 0) / player.parryAttempts * 100) : 0;
    return `<div class="result-row postmortem"><span>#${index + 1}</span><strong>${escapeHtml(player.name)} · ${CLASS_META[player.classId].label}</strong><div><b>${player.damageDone} УРОНА · ФОРМА ${String(player.weaponEvolution||'unformed').toUpperCase()}</b><small>${player.parries || 0}/${player.parryAttempts || 0} ПАРИРОВАНИЙ · ${parryRate}% · ${player.perfectDodges||0} ИДЕАЛЬНЫХ УКЛОНЕНИЙ</small><small>${player.poiseDamage || 0} УРОНА СТОЙКОСТИ · ${player.hitsTaken || 0} ПОПАДАНИЙ ПОЛУЧЕНО · ${(player.fusions||[]).length} СПЛАВОВ · ${(player.lootDrops||[]).length} ТРОФЕЕВ</small><em>ПОСЛЕДНЯЯ ОПАСНОСТЬ: ${escapeHtml(player.lastDamageSource || 'неизвестно')}</em></div></div>`;
  }).join('')+(data.dailyLeaderboard?.length?`<h3>ЛУЧШИЕ ПОПЫТКИ ДНЯ · ${data.teamSize} ИГР.</h3>${data.dailyLeaderboard.map((entry,index)=>`<div class="result-row"><span>#${index+1}</span><strong>${escapeHtml(entry.names)}</strong><b>${entry.stages} · ${formatTime(entry.elapsed)}</b></div>`).join('')}`:'');
  const host = lobbyState?.hostId === socket.id;
  dom.rematchButton.disabled = !host;
  dom.rematchButton.querySelector('span').textContent = host ? 'ВЕРНУТЬСЯ К КОСТРУ' : 'ЖДЁМ ХРАНИТЕЛЯ';
  dom.resultOverlay.classList.add('active');
  dom.resultOverlay.setAttribute('aria-hidden', 'false');
  playSound(victory ? 'victory' : 'defeat');
}

function actionForCode(code) {
  const configured = Object.entries(profile.settings.bindings).find(([, keyCode]) => keyCode === code)?.[0];
  if (configured) return configured;
  return ({ ArrowLeft:'left', ArrowRight:'right', ArrowUp:'jump', Space:'jump' })[code];
}

function choiceOverlayActive(){return [dom.perkOverlay,dom.routeOverlay,dom.fusionOverlay,dom.contractOverlay].some((item)=>item?.classList.contains('active'));}

function emitCombinedInput() {
  let changed = false;
  for (const key of Object.keys(input)) {
    const next = keyboardInput[key] || gamepadInput[key];
    if (input[key] !== next) { input[key] = next; changed = true; if (next && ['light', 'heavy', 'parry', 'roll', 'ability', 'team','stance','technique','layer','interact','spectral'].includes(key)) playSound(['stance','technique','layer','interact','spectral'].includes(key)?'phase':key); }
  }
  if (changed) socket.emit('input', input);
}

function setInput(key, pressed, source = 'keyboard') {
  if (!(key in input)) return;
  const target = source === 'gamepad' ? gamepadInput : keyboardInput;
  target[key] = pressed;
  emitCombinedInput();
}
function resetGamepadInput() { Object.keys(gamepadInput).forEach((key) => { gamepadInput[key] = false; }); emitCombinedInput(); }
function resetInput() {
  Object.keys(input).forEach((key) => { keyboardInput[key] = false; gamepadInput[key] = false; input[key] = false; });
  socket.emit('input', input);
}

function pollGamepad() {
  if (!profile.settings.gamepad || !navigator.getGamepads) { if (gamepadWasConnected) { gamepadWasConnected = false; resetGamepadInput(); } return; }
  const pad = [...navigator.getGamepads()].find(Boolean);
  if (!pad) { if (gamepadWasConnected) { gamepadWasConnected = false; resetGamepadInput(); } return; }
  if (!gamepadWasConnected) { gamepadWasConnected = true; toast(`Геймпад подключён: ${pad.id.slice(0, 34)}`, 'gold'); }
  const blocked = !dom.gameScreen.classList.contains('active') || choiceOverlayActive();
  const values = blocked ? Object.fromEntries(Object.keys(gamepadInput).map((key)=>[key,false])) : {
    left:(pad.axes[0] || 0) < -0.35, right:(pad.axes[0] || 0) > 0.35,
    jump:pad.buttons[0]?.pressed === true, light:pad.buttons[2]?.pressed === true,
    heavy:pad.buttons[3]?.pressed === true, parry:pad.buttons[4]?.pressed === true,
    roll:pad.buttons[5]?.pressed === true, ability:pad.buttons[7]?.pressed === true, team:pad.buttons[8]?.pressed === true,
    stance:pad.buttons[6]?.pressed===true,technique:pad.buttons[1]?.pressed===true,layer:pad.buttons[9]?.pressed===true,interact:pad.buttons[10]?.pressed===true,spectral:pad.buttons[1]?.pressed===true,
  };
  for (const [key, pressed] of Object.entries(values)) if (gamepadInput[key] !== pressed) setInput(key, pressed, 'gamepad');
}

window.addEventListener('keydown', (event) => {
  if (waitingBindingAction) {
    event.preventDefault();
    if (event.code === 'Escape') { waitingBindingAction = ''; renderSettings(); return; }
    for (const action of Object.keys(profile.settings.bindings)) if (profile.settings.bindings[action] === event.code) profile.settings.bindings[action] = profile.settings.bindings[waitingBindingAction];
    profile.settings.bindings[waitingBindingAction] = event.code;
    const label = ACTION_LABELS[waitingBindingAction];
    waitingBindingAction = '';
    saveProfile();
    toast(`${label}: ${formatKeyCode(event.code)}`, 'gold');
    return;
  }
  if(dom.gameScreen.classList.contains('active')&&!choiceOverlayActive()){
    const me=gameState?.players?.find((player)=>player.id===socket.id);
    if(me?.downed&&['KeyQ','KeyE'].includes(event.code)){event.preventDefault();spectatorIndex+=event.code==='KeyE'?1:-1;updateHud(gameState);return;}
    const pingType=({Digit1:'attack',Digit2:'retreat',Digit3:'poise',Digit4:'heal'})[event.code];if(pingType){event.preventDefault();socket.emit('team-ping',pingType,(response)=>{if(!response?.ok&&response?.error)toast(response.error,'warn');});return;}
  }
  const key = actionForCode(event.code);
  if (!key || !dom.gameScreen.classList.contains('active') || choiceOverlayActive()) return;
  event.preventDefault(); setInput(key, true);
});
window.addEventListener('keyup', (event) => { const key = actionForCode(event.code); if (key) { event.preventDefault(); setInput(key, false); } });
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
function tone(frequency, duration, volume, type = 'sine', offset = 0, channel = 'effects') {
  if (!audioContext) return;
  const oscillator = audioContext.createOscillator(); const gain = audioContext.createGain(); const start = audioContext.currentTime + offset;
  oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, start); oscillator.frequency.exponentialRampToValueAtTime(Math.max(40, frequency * .62), start + duration);
  const channelVolume = channel === 'music' ? profile.settings.musicVolume : profile.settings.effectsVolume;
  gain.gain.setValueAtTime(Math.max(.0001, volume * channelVolume), start); gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
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
  const danger=boss.hp/Math.max(1,boss.maxHp)<.25?'last':boss.poise/Math.max(1,boss.maxPoise)<.3?'break':'steady';
  const key = `${boss.bossId}:${boss.phase}:${danger}:${boss.worldLayer||0}`;
  if (key === bossMusicKey) return;
  stopBossMusic(); bossMusicKey = key; bossMusicStep = 0;
  const roots = [82,87,92,98,104,110,117,123,131,139];
  const root = roots[Math.max(0,(boss.tier||1)-1)];
  const pattern = danger==='last'?[1,1.5,2,1.25,2.5,1.75]:danger==='break'?[1,1.25,1.01,1.5]:boss.phase === 3 ? [1,1.5,1.25,2,1.5,2.5] : boss.phase === 2 ? [1,1.25,1.5,2] : [1,1.5,1.25,1];
  const pulse = () => { if (!dom.gameScreen.classList.contains('active')) return; const multiplier = pattern[bossMusicStep++ % pattern.length]; tone(root*multiplier,.18,danger==='last'?.013:.009,boss.phase===3?'square':'triangle',0,'music'); if(boss.worldLayer===1&&bossMusicStep%2===0)tone(root*.5,.22,.005,'sine',.04,'music'); };
  pulse(); bossMusicTimer = setInterval(pulse, danger==='last'?270:boss.phase === 3 ? 330 : boss.phase === 2 ? 430 : 560);
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

function drawArenaBackdropDetails(state,time,theme){
  const tier=state?.arena?.tier||1;const baseY=canvasHeight*.8;const offset=(factor,span)=>-((cameraX*factor)%span+span)%span;ctx.save();ctx.lineWidth=3;
  if(tier===1){
    const start=offset(.1,360)-180;ctx.fillStyle='rgba(8,8,7,.76)';ctx.strokeStyle='rgba(202,174,115,.16)';for(let x=start;x<canvasWidth+220;x+=360){ctx.fillRect(x,baseY-260,66,260);ctx.fillRect(x+236,baseY-260,66,260);ctx.beginPath();ctx.moveTo(x+55,baseY-220);ctx.quadraticCurveTo(x+151,baseY-365,x+247,baseY-220);ctx.lineTo(x+247,baseY);ctx.lineTo(x+55,baseY);ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle='rgba(121,82,42,.14)';ctx.fillRect(x+135,baseY-305,32,180);ctx.fillStyle='rgba(8,8,7,.76)';}
  }else if(tier===2){
    const start=offset(.13,300)-120;for(let x=start;x<canvasWidth+200;x+=300){ctx.fillStyle='rgba(7,5,4,.78)';ctx.fillRect(x,baseY-245,215,245);ctx.fillStyle='rgba(208,139,85,.13)';for(let row=0;row<3;row++)ctx.fillRect(x+32,baseY-210+row*63,150,33);ctx.fillStyle='rgba(255,103,37,.1)';ctx.fillRect(x+45,baseY-201,124,16);ctx.strokeStyle='rgba(208,139,85,.22)';ctx.beginPath();ctx.moveTo(x+18,0);ctx.lineTo(x+18,baseY-85);ctx.stroke();for(let y=22;y<baseY-85;y+=24)ctx.strokeRect(x+12,y,12,14);}
  }else if(tier===3){
    const start=offset(.16,390)-160;ctx.strokeStyle='rgba(208,154,100,.22)';for(let x=start;x<canvasWidth+250;x+=390){ctx.fillStyle='rgba(8,6,5,.75)';ctx.fillRect(x+30,baseY-205,270,205);for(const [gx,gy,r] of [[85,-155,54],[215,-115,72]]){ctx.beginPath();for(let i=0;i<24;i++){const a=i*Math.PI/12,rr=i%2?r:r+10;const px=x+gx+Math.cos(a)*rr,py=baseY+gy+Math.sin(a)*rr;i?ctx.lineTo(px,py):ctx.moveTo(px,py);}ctx.closePath();ctx.stroke();ctx.beginPath();ctx.arc(x+gx,baseY+gy,r*.42,0,Math.PI*2);ctx.stroke();}ctx.fillStyle='rgba(235,83,31,.12)';ctx.fillRect(x,baseY-20,330,18);}
  }else if(tier===4){
    const start=offset(.09,310)-100;ctx.fillStyle='rgba(5,10,11,.78)';for(let x=start;x<canvasWidth+180;x+=310){ctx.fillRect(x,baseY-285,50,285);ctx.fillRect(x+205,baseY-285,50,285);ctx.beginPath();ctx.arc(x+127,baseY-190,76,Math.PI,0);ctx.lineTo(x+203,baseY);ctx.lineTo(x+51,baseY);ctx.closePath();ctx.fill();}ctx.fillStyle='rgba(63,142,150,.09)';ctx.fillRect(0,baseY-66,canvasWidth,115);ctx.strokeStyle='rgba(114,163,155,.26)';for(let y=baseY-58;y<baseY+38;y+=19){ctx.beginPath();for(let x=-20;x<canvasWidth+30;x+=42)ctx.lineTo(x,y+Math.sin(x*.018+time*1.4+y)*5);ctx.stroke();}
  }else if(tier===5){
    const start=offset(.12,330)-120;ctx.strokeStyle='rgba(169,155,182,.22)';ctx.fillStyle='rgba(8,7,11,.8)';for(let x=start;x<canvasWidth+200;x+=330){ctx.fillRect(x+125,0,9,baseY-225);ctx.beginPath();ctx.moveTo(x+58,baseY-230);ctx.quadraticCurveTo(x+129,baseY-315,x+200,baseY-230);ctx.lineTo(x+184,baseY-175);ctx.lineTo(x+74,baseY-175);ctx.closePath();ctx.fill();ctx.stroke();ctx.fillRect(x+121,baseY-175,16,82);ctx.beginPath();ctx.arc(x+129,baseY-82,15,0,Math.PI*2);ctx.fill();}
  }else if(tier===6){
    const start=offset(.1,420)-180;ctx.fillStyle='rgba(10,4,6,.8)';for(let x=start;x<canvasWidth+250;x+=420){ctx.fillRect(x,baseY-235,340,235);for(let b=0;b<7;b++)ctx.fillRect(x+b*52,baseY-272,30,42);ctx.fillStyle='rgba(182,50,70,.15)';ctx.beginPath();ctx.moveTo(x+104,baseY-225);ctx.lineTo(x+215,baseY-205);ctx.lineTo(x+195,baseY-78);ctx.lineTo(x+118,baseY-112);ctx.closePath();ctx.fill();ctx.fillStyle='rgba(10,4,6,.8)';}ctx.strokeStyle='rgba(182,107,114,.18)';for(let x=offset(.25,180);x<canvasWidth+180;x+=180){ctx.beginPath();ctx.moveTo(x,baseY);ctx.lineTo(x+23,baseY-70);ctx.lineTo(x+46,baseY);ctx.stroke();}
  }else if(tier===7){
    const start=offset(.08,280)-80;ctx.fillStyle='rgba(4,5,6,.82)';ctx.strokeStyle='rgba(137,148,159,.18)';for(let x=start;x<canvasWidth+160;x+=280){ctx.fillRect(x,baseY-270,225,270);ctx.strokeRect(x+24,baseY-230,174,177);for(let bar=0;bar<8;bar++)ctx.fillRect(x+35+bar*21,baseY-222,7,165);ctx.fillRect(x+24,baseY-146,174,8);ctx.beginPath();ctx.moveTo(x+210,0);ctx.lineTo(x+177,baseY-70);ctx.stroke();for(let y=35;y<baseY-70;y+=27)ctx.strokeRect(x+170,y,13,15);}
  }else if(tier===8){
    const moonX=canvasWidth*.72-cameraX*.025;const moonY=canvasHeight*.22;ctx.fillStyle='rgba(142,154,209,.14)';ctx.beginPath();ctx.arc(moonX,moonY,Math.min(150,canvasHeight*.2),0,Math.PI*2);ctx.fill();ctx.fillStyle='rgba(8,9,17,.88)';const start=offset(.16,330)-150;for(let x=start;x<canvasWidth+220;x+=330){ctx.fillRect(x+148,baseY-205,13,205);ctx.fillRect(x+96,baseY-165,118,11);ctx.fillRect(x+116,baseY-215,10,75);ctx.fillRect(x+180,baseY-235,9,94);for(let i=0;i<4;i++)ctx.fillRect(x+50+i*55,baseY-275-i%2*35,24,12);}ctx.fillStyle='rgba(126,139,204,.13)';for(let i=0;i<11;i++){const x=(i*173-cameraX*.22)%(canvasWidth+120);ctx.fillRect(x,90+(i*71)%260,30+i%3*13,8);}
  }else if(tier===9){
    ctx.fillStyle='rgba(28,56,79,.18)';for(let band=0;band<4;band++){const y=70+band*92;for(let x=offset(.04+band*.025,250)-100;x<canvasWidth+180;x+=250){ctx.beginPath();ctx.ellipse(x,y,130,35+band*4,0,0,Math.PI*2);ctx.fill();}}ctx.fillStyle='rgba(5,8,12,.82)';const start=offset(.15,360)-150;for(let x=start;x<canvasWidth+220;x+=360){ctx.beginPath();ctx.moveTo(x,baseY);ctx.lineTo(x+90,baseY-310);ctx.lineTo(x+180,baseY);ctx.closePath();ctx.fill();ctx.fillRect(x+83,baseY-370,14,75);}if(Math.sin(time*2.7)> .92){ctx.strokeStyle='rgba(160,211,241,.35)';ctx.beginPath();ctx.moveTo(canvasWidth*.42,0);ctx.lineTo(canvasWidth*.39,120);ctx.lineTo(canvasWidth*.46,185);ctx.lineTo(canvasWidth*.4,310);ctx.stroke();}
  }else{
    const center=canvasWidth*.58-cameraX*.035;ctx.fillStyle='rgba(5,2,7,.84)';ctx.beginPath();ctx.moveTo(center-165,baseY);ctx.lineTo(center-116,baseY-255);ctx.lineTo(center-56,baseY-320);ctx.lineTo(center+56,baseY-320);ctx.lineTo(center+116,baseY-255);ctx.lineTo(center+165,baseY);ctx.closePath();ctx.fill();ctx.fillRect(center-72,baseY-215,144,215);ctx.strokeStyle='rgba(170,120,176,.22)';ctx.beginPath();ctx.ellipse(center,baseY-175,42,116,0,0,Math.PI*2);ctx.stroke();ctx.fillStyle='rgba(123,44,131,.14)';ctx.beginPath();ctx.ellipse(center,baseY-175,18+Math.sin(time*1.8)*5,102,0,0,Math.PI*2);ctx.fill();for(let i=0;i<9;i++){const x=offset(.18,190)+i*190;const y=95+(i%3)*68+Math.sin(time+i)*8;ctx.fillRect(x,y,28,82);}}
  ctx.restore();
}

function drawBackdrop(state,time=0) {
  const tier = state?.boss?.tier || 1;
  const theme = state?.arena?.theme || arena?.theme || { sky: '#11100d', horizon: '#19140f', ground: '#080806', glow: '#79522a', fog: '#877b64' };
  const gradient = ctx.createLinearGradient(0,0,0,canvasHeight); gradient.addColorStop(0,theme.sky); gradient.addColorStop(.58,theme.horizon); gradient.addColorStop(1,theme.ground);
  ctx.fillStyle = gradient; ctx.fillRect(0,0,canvasWidth,canvasHeight);
  const glow = ctx.createRadialGradient(canvasWidth*.72,canvasHeight*.53,0,canvasWidth*.72,canvasHeight*.53,canvasWidth*.48); glow.addColorStop(0,theme.glow); glow.addColorStop(1,'rgba(0,0,0,0)'); ctx.save(); ctx.globalAlpha=.16; ctx.fillStyle=glow; ctx.fillRect(0,0,canvasWidth,canvasHeight); ctx.restore();
  ctx.fillStyle='rgba(221,205,174,.25)';
  for(let i=0;i<65+tier*3;i++){ const x=((i*227-cameraX*(.025+(i%3)*.02))%(canvasWidth+80)+canvasWidth+80)%(canvasWidth+80)-40; const y=60+(i*97)%Math.max(180,canvasHeight*.65); ctx.globalAlpha=.16+(i%5)*.07; ctx.fillRect(x,y,i%11===0?1.7:.7,i%11===0?1.7:.7); } ctx.globalAlpha=1;
  drawArenaBackdropDetails(state,time,theme);
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
  const active=hazard.live;const accessible=profile.settings.colorblind;const color=accessible?(hazard.type==='storm'?'#36d1ff':hazard.type==='rune'?'#ffcc33':hazard.type==='fall'?'#f4f4f4':'#ff5c8a'):(hazard.type==='storm'?'#8fc7e8':hazard.type==='rune'?'#a47bd0':hazard.type==='fall'?'#c7b9dc':'#d3543c');
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

function drawArenaHistory(state,time){
  for(const scar of state.arena?.scars||[]){ctx.save();ctx.translate(scar.x,world.floor-3);ctx.globalAlpha=.28;ctx.strokeStyle=scar.type==='rift'?'#a978c0':'#c19a64';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-34,0);ctx.lineTo(-18,-12);ctx.lineTo(-4,-3);ctx.lineTo(11,-17);ctx.lineTo(34,0);ctx.stroke();ctx.restore();}
  for(const mechanism of state.arena?.mechanisms||[]){const pulse=.65+Math.sin(time*4+mechanism.x)*.18;ctx.save();ctx.translate(mechanism.x,mechanism.y);ctx.globalAlpha=mechanism.active?1:pulse;ctx.strokeStyle=mechanism.active?'#f2d18a':'#8a7551';ctx.fillStyle='#17130e';ctx.lineWidth=3;ctx.fillRect(-17,-17,34,34);ctx.strokeRect(-17,-17,34,34);ctx.rotate(Math.PI/4);ctx.strokeRect(-8,-8,16,16);ctx.restore();}
}

function drawStageEchoes(state){
  for(const echo of state.echoes||[]){ctx.save();ctx.globalAlpha=echo.mode==='ally'?.22:.16;ctx.fillStyle=echo.mode==='ally'?'#79d1d8':'#b06a91';ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=13;ctx.translate(echo.x+21,echo.y+30);ctx.fillRect(-15,-26,30,25);ctx.fillRect(-19,0,38,24);ctx.fillRect(-13,24,10,17);ctx.fillRect(4,24,10,17);ctx.restore();}
}

function drawFallbackPlayer(player,time) {
  const meta=CLASS_META[player.classId]; const skin=SKIN_META[player.skin]||SKIN_META.iron; const armor=ARMOR_META[player.appearance?.armor]?.color||meta.color;const aura=AURA_META[player.appearance?.aura]?.color||'#b5aa96';const weaponId=player.weaponId||DEFAULT_WEAPON[player.classId]; const isMe=player.id===socket.id; const bob=Math.round(Math.sin(time*8+player.slot)*Math.min(2,Math.abs(player.vx)/190));const prediction=isMe?(Number(input.right)-Number(input.left))*Math.min(14,Math.abs(player.vx)*.04):0;const renderX=player.x+prediction;
  ctx.save(); ctx.translate(Math.round(renderX+21),Math.round(player.y+30+bob)); ctx.scale(player.facing||1,1);if(gameState?.arena?.layered)ctx.globalAlpha=player.worldLayer===0?.92:.68;
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
  ctx.textAlign='center';ctx.fillStyle=isMe?'#eee3cf':'rgba(225,217,201,.7)';ctx.font=`${isMe?700:600} 9px monospace`;ctx.fillText(player.downed?`${player.name} · ПАЛ`:player.connected===false?`${player.name} · СВЯЗЬ`:player.name,Math.round(renderX+21),Math.round(player.y-18));
  const titleId=player.appearance?.title?.replace(/^title_/,'');const title=titleId&&titleId!=='wanderer'?BOSS_BY_ID.get(titleId)?.title:'';if(title){ctx.fillStyle='rgba(211,180,111,.78)';ctx.font='600 7px monospace';ctx.fillText(title.toUpperCase(),Math.round(player.x+21),Math.round(player.y-29));}
  if(gameState?.boss?.targetId===player.id&&!player.downed){ctx.fillStyle='#d65c69';ctx.fillRect(Math.round(player.x+16),Math.round(player.y-34),10,4);ctx.fillRect(Math.round(player.x+19),Math.round(player.y-39),4,4);}
}

function selectPlayerAnimation(player, animationState) {
  if (player.visualAction) return player.visualAction;
  if (player.downed) return 'knockdown';
  if (player.action === 'roll') return 'roll';
  if (player.action === 'light') {
    if (animationState.previousAction !== 'light') animationState.lightCombo = (animationState.lightCombo % 3) + 1;
    return `light_${animationState.lightCombo}`;
  }
  if (player.action === 'heavy') {
    const progress = 1 - player.actionTimer / Math.max(0.01, player.actionDuration);
    return progress < 0.38 ? 'heavy_charge' : progress < 0.8 ? 'heavy_attack' : 'heavy_recover';
  }
  if (player.action === 'parry') {
    const progress = 1 - player.actionTimer / Math.max(0.01, player.actionDuration);
    return progress < 0.3 ? 'parry_start' : 'parry_hold';
  }
  if (player.action === 'parry_success') return 'parry_success';
  if (player.action === 'hurt') return 'hit';
  if (player.stamina <= Math.max(4, player.maxStamina * 0.07)) return 'exhausted';
  if (player.vy < -45) return 'jump_up';
  if (player.vy > 45) return 'fall';
  if (Math.abs(player.vx) > 45) return 'run';
  return 'idle';
}

function drawPlayerLabels(player, isMe, renderX) {
  ctx.globalAlpha=1;ctx.textAlign='center';ctx.fillStyle=isMe?'#eee3cf':'rgba(225,217,201,.7)';ctx.font=`${isMe?700:600} 9px monospace`;ctx.fillText(player.downed?`${player.name} · ПАЛ`:player.connected===false?`${player.name} · СВЯЗЬ`:player.name,Math.round(renderX+21),Math.round(player.y-43));
  const titleId=player.appearance?.title?.replace(/^title_/,'');const title=titleId&&titleId!=='wanderer'?BOSS_BY_ID.get(titleId)?.title:'';if(title){ctx.fillStyle='rgba(211,180,111,.78)';ctx.font='600 7px monospace';ctx.fillText(title.toUpperCase(),Math.round(player.x+21),Math.round(player.y-54));}
  if(gameState?.boss?.targetId===player.id&&!player.downed){ctx.fillStyle='#d65c69';ctx.fillRect(Math.round(player.x+16),Math.round(player.y-59),10,4);ctx.fillRect(Math.round(player.x+19),Math.round(player.y-64),4,4);}
}

function drawPlayer(player,time) {
  const atlas = classSpriteAtlases.get(player.classId);
  if (!atlas) return drawFallbackPlayer(player,time);
  const meta=CLASS_META[player.classId];const armor=ARMOR_META[player.appearance?.armor]?.color||meta.color;const aura=AURA_META[player.appearance?.aura]?.color||'#b5aa96';const isMe=player.id===socket.id;const bob=Math.round(Math.sin(time*8+player.slot)*Math.min(2,Math.abs(player.vx)/190));const prediction=isMe?(Number(input.right)-Number(input.left))*Math.min(14,Math.abs(player.vx)*.04):0;const renderX=player.x+prediction;
  let animationState = playerAnimationStates.get(player.id);
  if (!animationState) {
    animationState = { animation:'idle', startedAt:time, previousAction:'idle', lightCombo:0 };
    playerAnimationStates.set(player.id, animationState);
  }
  const animationId = selectPlayerAnimation(player, animationState);
  if (animationId !== animationState.animation) {
    animationState.animation = animationId;
    animationState.startedAt = time;
  }
  animationState.previousAction = player.action;
  const animation = atlas.data.animations[animationId] || atlas.data.animations.idle;
  const elapsed = Math.max(0, time - animationState.startedAt);
  let frame = Math.floor(elapsed * animation.fps);
  if (animation.loop) frame %= animation.frames;
  else frame = Math.min(animation.frames - 1, frame);
  const frameWidth = animation.atlas.frameWidth || atlas.data.frameWidth || 32;
  const frameHeight = animation.atlas.frameHeight || atlas.data.frameHeight || 32;
  const spriteScale = 3;
  const drawWidth = frameWidth * spriteScale;
  const drawHeight = frameHeight * spriteScale;
  ctx.save();ctx.translate(Math.round(renderX+21),Math.round(player.y+player.h+bob));ctx.scale(player.facing||1,1);
  if(gameState?.arena?.layered)ctx.globalAlpha=player.worldLayer===0?.94:.68;
  if(Math.abs(player.vx)>90||player.action==='roll'){ctx.fillStyle=aura;ctx.globalAlpha*=.18;for(let i=0;i<4;i++)ctx.fillRect(-25-i*10-(Math.floor(time*18+i*3)%7),-20+i*5,5+i%2*3,5+i%2*3);ctx.globalAlpha=gameState?.arena?.layered&&player.worldLayer!==0?.68:1;}
  if(player.invulnerable&&Math.floor(time*18)%2===0)ctx.globalAlpha*=.42;
  if(isMe){const currentAlpha=ctx.globalAlpha;ctx.globalAlpha=.2;ctx.fillStyle=armor;ctx.fillRect(-28,1,56,4);ctx.fillRect(-20,-3,40,4);ctx.globalAlpha=currentAlpha;}
  ctx.drawImage(atlas.image,animation.atlas.x+frame*frameWidth,animation.atlas.y,frameWidth,frameHeight,-drawWidth/2,-drawHeight,drawWidth,drawHeight);
  ctx.restore();
  drawPlayerLabels(player,isMe,renderX);
}

function drawFallbackBoss(boss,time) {
  ctx.save();ctx.translate(Math.round(boss.x+61),Math.round(boss.y+75));ctx.scale(boss.facing||-1,1);if(gameState?.arena?.layered)ctx.globalAlpha=boss.worldLayer===0?.96:.7;const armor=boss.flash?'#eee1c8':boss.color||'#786143';const eye=boss.eye||'#dbad58';
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
  if(boss.armorParts){ctx.strokeStyle='#d9bd83';ctx.lineWidth=5;for(let i=0;i<boss.armorParts;i++)ctx.strokeRect(-70+i*18,-47-i*4,20,76);}
  for(const module of boss.modules||[]){ctx.fillStyle=eye;if(module.id==='wings'){ctx.fillRect(-96,-54,34,9);ctx.fillRect(62,-54,34,9);}if(module.id==='lens')ctx.fillRect(-9,-74,18,18);if(module.id==='chains'){ctx.fillRect(-75,5,14,70);ctx.fillRect(62,5,14,70);}if(module.id==='claws'){ctx.fillRect(99,-23,28,5);ctx.fillRect(99,-8,31,5);}if(module.id==='bulwark')ctx.strokeRect(-68,-48,133,94);}
  if(boss.stagger){ctx.fillStyle='#e7cf91';for(const [x,y] of [[-70,-60],[-82,-15],[-72,38],[-15,-88],[42,-76],[72,-40],[78,25],[35,70]])ctx.fillRect(x,y,7,7);}
  ctx.restore();
}

const bossAnimationState = { bossId:'', actionKey:'', animation:'idle', startedAt:0 };

function selectBossAnimation(boss) {
  if (boss.phaseFlash) return { id:'phase_change', key:`phase:${boss.phase}` };
  if (boss.stagger || boss.exposed) return { id:'poise_break', key:'poise' };
  if (boss.flash) return { id:'hurt', key:'hurt' };
  const attack=boss.currentAttack;
  if(attack){
    const ranged=['wave','volley','beam','ring_burst','marked','skyfall'];
    const slams=['slam','quake'];
    let id;
    if(attack.phase==='telegraph')id=ranged.includes(attack.type)?'attack_ranged':slams.includes(attack.type)?'attack_slam':'attack_heavy';
    else if(attack.type==='blink')id='blink';
    else if(attack.type==='charge')id='dash';
    else if(ranged.includes(attack.type))id='attack_ranged';
    else if(slams.includes(attack.type))id='attack_slam';
    else id=attack.type==='cleave'?'attack_heavy':'attack_slash';
    return {id,key:`${attack.type}:${attack.phase}`};
  }
  if(Math.abs(boss.vy||0)>45)return {id:'jump',key:'jump'};
  if(Math.abs(boss.vx||0)>35)return {id:'walk',key:'walk'};
  return {id:'idle',key:'idle'};
}

function drawBossSpriteModules(boss,accent,time){
  ctx.save();ctx.globalAlpha=.9;ctx.strokeStyle=accent;ctx.fillStyle=accent;ctx.lineWidth=3;
  if(boss.armorParts){ctx.globalAlpha=.38+.08*boss.armorParts;ctx.strokeRect(-61,-139,122,132);ctx.globalAlpha=.9;for(let i=0;i<boss.armorParts;i++)ctx.fillRect(-55+i*18,-133-i*3,12,4);}
  for(const module of boss.modules||[]){
    if(module.id==='wings'){ctx.fillRect(-91,-111,31,5);ctx.fillRect(60,-111,31,5);ctx.fillRect(-99,-96,38,4);ctx.fillRect(61,-96,38,4);}
    if(module.id==='lens'){ctx.fillRect(-7,-154,14,14);ctx.globalAlpha=.35;ctx.fillRect(-15,-162,30,30);ctx.globalAlpha=.9;}
    if(module.id==='chains'){for(let y=-118;y<-22;y+=14){ctx.fillRect(-72,y,7,7);ctx.fillRect(66,y+7,7,7);}}
    if(module.id==='claws'){ctx.fillRect(67,-73,34,4);ctx.fillRect(70,-59,38,4);ctx.fillRect(68,-45,31,4);}
    if(module.id==='bulwark'){ctx.strokeRect(-70,-143,140,139);ctx.strokeRect(-64,-137,128,127);}
  }
  if(boss.stagger||boss.exposed){for(let i=0;i<10;i++){const a=time*4+i*.63;ctx.fillRect(Math.round(Math.cos(a)*(67+i%3*7))-3,Math.round(-74+Math.sin(a)*(58+i%2*9))-3,6,6);}}
  ctx.restore();
}

function drawBoss(boss,time) {
  const atlas=bossSpriteAtlases.get(boss.bossId);
  if(!atlas)return drawFallbackBoss(boss,time);
  const selection=selectBossAnimation(boss);
  if(bossAnimationState.bossId!==boss.bossId||bossAnimationState.actionKey!==selection.key){bossAnimationState.bossId=boss.bossId;bossAnimationState.actionKey=selection.key;bossAnimationState.animation=selection.id;bossAnimationState.startedAt=time;}
  const animation=atlas.data.animations[selection.id]||atlas.data.animations.idle;const elapsed=Math.max(0,time-bossAnimationState.startedAt);let frame=Math.floor(elapsed*animation.fps);if(animation.loop)frame%=animation.frames;else frame=Math.min(animation.frames-1,frame);
  const frameWidth=animation.atlas.frameWidth||64,frameHeight=animation.atlas.frameHeight||64;const size=192;const accent=atlas.data.accent||boss.eye||'#d7b46a';
  ctx.save();ctx.translate(Math.round(boss.x+61),Math.round(boss.y+boss.h));ctx.scale(boss.facing||-1,1);if(gameState?.arena?.layered)ctx.globalAlpha=boss.worldLayer===0?.97:.67;
  if(boss.phaseFlash){ctx.fillStyle=accent;ctx.globalAlpha*=.18;ctx.fillRect(-105,-198,210,205);ctx.globalAlpha=gameState?.arena?.layered&&boss.worldLayer!==0?.67:1;}
  ctx.drawImage(atlas.image,animation.atlas.x+frame*frameWidth,animation.atlas.y,frameWidth,frameHeight,-size/2,-size,size,size);
  drawBossSpriteModules(boss,accent,time);ctx.restore();
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
  if(attack.decoys?.length){ctx.globalAlpha=.22;ctx.strokeStyle='#c39ad7';for(const x of attack.decoys){ctx.beginPath();ctx.arc(x,world.floor-12,72,0,Math.PI*2);ctx.stroke();}}
  if(profile.settings.telegraphText){ctx.setLineDash([]);ctx.globalAlpha=.95;ctx.fillStyle='#ffe8b6';ctx.font='800 13px monospace';ctx.textAlign='center';ctx.fillText((ATTACK_META[attack.type]||attack.type).toUpperCase(),centerX,boss.y-25);}
  if(attack.rune){ctx.font='800 23px monospace';ctx.fillStyle='#e8c989';ctx.fillText(attack.rune,centerX,boss.y-47);}
  ctx.setLineDash([]);ctx.restore();
}

function drawGhost(state){
  if(!ghostPlayback.length||state.training)return;while(ghostPlaybackIndex<ghostPlayback.length-1&&ghostPlayback[ghostPlaybackIndex+1].t<=state.elapsed)ghostPlaybackIndex+=1;const sample=ghostPlayback[ghostPlaybackIndex];if(!sample||sample.s!==state.stage||Math.abs(sample.t-state.elapsed)>.7)return;
  ctx.save();ctx.globalAlpha=.22;ctx.fillStyle='#80d8df';ctx.shadowColor='#80d8df';ctx.shadowBlur=14;ctx.translate(sample.x+21,sample.y+30);ctx.fillRect(-16,-24,32,24);ctx.fillRect(-20,0,40,24);ctx.fillRect(-14,24,11,17);ctx.fillRect(4,24,11,17);ctx.fillStyle='#d6ffff';ctx.fillRect(sample.f>0?3:-13,-15,10,4);ctx.restore();ctx.save();ctx.fillStyle='rgba(128,216,223,.55)';ctx.font='700 7px monospace';ctx.textAlign='center';ctx.fillText('ЛУЧШИЙ ПРИЗРАК',sample.x+21,sample.y-16);ctx.restore();
}

function drawPings(state){
  const labels={attack:'АТАКА',retreat:'ОТХОД',poise:'ЛОМАЕМ СТОЙКОСТЬ',heal:'НУЖНО ЛЕЧЕНИЕ'};const colors={attack:'#e96b73',retreat:'#e9c36b',poise:'#9dc5e8',heal:'#8fc587'};
  for(const ping of state.pings||[]){const pulse=1+Math.sin((3-ping.ttl)*12)*.12;ctx.save();ctx.translate(ping.x,ping.y);ctx.scale(pulse,pulse);ctx.strokeStyle=colors[ping.type];ctx.fillStyle=colors[ping.type];ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,18,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(0,23);ctx.lineTo(-7,12);ctx.lineTo(7,12);ctx.closePath();ctx.fill();ctx.font='800 9px monospace';ctx.textAlign='center';ctx.fillText(labels[ping.type],0,-27);ctx.restore();}
}

function drawProjectile(projectile){const playerOwned=projectile.kind!=='boss';const color=projectile.style==='magic'?'#b58bd6':playerOwned?'#9eb7dd':projectile.style==='sky'?'#a98ac2':projectile.style==='ring'?'#d06a7b':'#a93445';const size=Math.max(8,Math.round(projectile.r*1.5));ctx.save();ctx.translate(Math.round(projectile.x),Math.round(projectile.y));ctx.rotate(Math.PI/4);ctx.fillStyle=color;ctx.fillRect(-size/2,-size/2,size,size);ctx.globalAlpha=.35;ctx.fillRect(-size*1.4,-size/4,size,size/2);ctx.restore();}
function drawWave(wave,time){ctx.save();ctx.translate(Math.round(wave.x),Math.round(wave.y));ctx.fillStyle='#8f2d3a';for(let x=-wave.w/2;x<wave.w/2;x+=12){const h=Math.max(8,Math.round(wave.h*(1-Math.abs(x)/(wave.w/2))));ctx.fillRect(Math.round(x),-h,10,h);}ctx.restore();}
function drawAtlasEffect(effect){
  if(!effectSpriteAtlas||effect.value||effect.type==='beam')return false;
  const mapping={parry:'parry_flash',perfect_dodge:'roll_dust',hit:'hit_flash',ward:'ability_aura',second_wind:'revive_ash',phase:'spectral_pulse',oath:'team_oath',blink:'spawn_ash',dash:'roll_dust',ground_slam:'shockwave',slam:'shockwave'};
  const animation=effectSpriteAtlas.data.animations[mapping[effect.type]||'metal_sparks'];if(!animation)return false;
  const progress=1-Math.max(0,effect.ttl/Math.max(.01,effect.maxTtl||1));const frame=Math.min(animation.frames-1,Math.floor(progress*animation.frames));const frameWidth=animation.atlas.frameWidth||32;const frameHeight=animation.atlas.frameHeight||32;const size=Math.max(64,Math.min(192,(effect.size||80)*1.35));
  ctx.save();ctx.translate(Math.round(effect.x),Math.round(effect.y));ctx.globalAlpha=Math.min(1,(effect.ttl/Math.max(.01,effect.maxTtl||1))*2.5);ctx.drawImage(effectSpriteAtlas.image,animation.atlas.x+frame*frameWidth,animation.atlas.y,frameWidth,frameHeight,-size/2,-size/2,size,size);ctx.restore();return true;
}

function drawEffect(effect){
  if(drawAtlasEffect(effect))return;
  const p=Math.max(0,effect.ttl/(effect.maxTtl||1));ctx.save();ctx.translate(effect.x,effect.y);ctx.globalAlpha=Math.min(1,p*2.6);ctx.strokeStyle=effect.color;ctx.fillStyle=effect.color;ctx.shadowColor=effect.color;ctx.shadowBlur=8;ctx.lineWidth=effect.type==='parry'?6:4;
  if(effect.type==='beam'){ctx.globalAlpha=Math.min(.72,p*1.4);ctx.fillRect(0,0,effect.width,effect.height);ctx.globalAlpha=Math.min(1,p*2);ctx.strokeRect(0,0,effect.width,effect.height);}
  else if(['ground_slam','slam'].includes(effect.type)){for(let x=-effect.size/2;x<effect.size/2;x+=18)ctx.fillRect(Math.round(x),-Math.round((1-p)*28+4),12,5);}
  else if(['phase','oath'].includes(effect.type)){const radius=effect.size*(1-p*.7);for(let i=0;i<16;i++){const a=Math.PI*2*i/16;ctx.fillRect(Math.round(Math.cos(a)*radius),Math.round(Math.sin(a)*radius),7,7);}}
  else{ctx.beginPath();ctx.arc(0,0,effect.size*(1-p*.5),effect.type.includes('slash')?-1.4:0,effect.type.includes('slash')?1.1:Math.PI*2);ctx.stroke();}
  if(effect.value){ctx.shadowBlur=0;ctx.globalAlpha=Math.min(1,p*3);ctx.fillStyle='#f2e5c8';ctx.font='700 12px monospace';ctx.textAlign='center';ctx.fillText(String(effect.value),0,-28-(1-p)*24);}
  ctx.restore();
}

function renderFrame(timeMs) {
  pollGamepad();
  if(timeMs<hitStopUntil){requestAnimationFrame(renderFrame);return;}
  const time=timeMs/1000;const state=gameState;drawBackdrop(state,time);
  if(state?.boss){canvasScale=canvasHeight/world.height;const visible=canvasWidth/canvasScale;const local=state.players.find((p)=>p.id===socket.id)||state.players[0];const living=state.players.filter((p)=>!p.downed&&p.id!==socket.id);const me=local?.downed&&living.length?living[((spectatorIndex%living.length)+living.length)%living.length]:local;const target=Math.max(0,Math.min(world.width-visible,(me?.x||0)-visible*.42));cameraX+=(target-cameraX)*.1;const shakeX=screenShake?(Math.random()-.5)*screenShake:0;const shakeY=screenShake?(Math.random()-.5)*screenShake*.55:0;screenShake*=.82;if(screenShake<.2)screenShake=0;ctx.save();ctx.setTransform(canvasScale*pixelRatio,0,0,canvasScale*pixelRatio,(-cameraX+shakeX)*canvasScale*pixelRatio,shakeY*canvasScale*pixelRatio);
    const left=cameraX-150,right=cameraX+visible+150;drawAbyss(state.arena?.bounds,state.arena?.gaps,time);for(const platform of platforms)if(platform.x+platform.w>left&&platform.x<right)drawPlatform(platform);drawArenaHistory(state,time);for(const hazard of state.arena?.hazards||[])if(hazard.x+hazard.w>left&&hazard.x<right)drawArenaHazard(hazard,time);drawTelegraph(state.boss,state);for(const wave of state.waves||[])drawWave(wave,time);drawStageEchoes(state);drawBoss(state.boss,time);drawGhost(state);for(const player of state.players)drawPlayer(player,time);for(const projectile of state.projectiles||[])drawProjectile(projectile);for(const effect of state.effects||[])drawEffect(effect);drawPings(state);ctx.restore();}
  requestAnimationFrame(renderFrame);
}

document.querySelectorAll('.class-option').forEach((button) => button.addEventListener('click', () => chooseClass(button.dataset.class)));
dom.createRoomButton.addEventListener('click', createRoom); dom.joinRoomButton.addEventListener('click', joinRoom);
dom.roomCodeInput.addEventListener('input', () => { dom.roomCodeInput.value = dom.roomCodeInput.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,5); });
dom.roomCodeInput.addEventListener('keydown', (event) => { if(event.key==='Enter')joinRoom(); }); dom.nameInput.addEventListener('keydown', (event) => { if(event.key==='Enter')createRoom(); });
dom.copyCodeButton.addEventListener('click', copyCode); dom.startGameButton.addEventListener('click', startGame); dom.leaveLobbyButton.addEventListener('click', leaveHome);
dom.brandButton.addEventListener('click', () => { if(!dom.gameScreen.classList.contains('active'))leaveHome(); });
dom.shopButton.addEventListener('click', openShop); dom.closeShopButton.addEventListener('click', closeShop); dom.shopOverlay.addEventListener('click', (event) => { if(event.target===dom.shopOverlay)closeShop(); });
dom.uiSizePicker?.querySelectorAll('[data-ui-size]').forEach((button) => button.addEventListener('click', () => {
  applyUiSize(button.dataset.uiSize);
  saveProfile();
  toast(`Размер интерфейса: ${button.dataset.uiSize === 'small' ? 'маленький' : button.dataset.uiSize === 'large' ? 'крупный' : 'обычный'}`, 'gold');
}));
dom.boxBuyButton.addEventListener('click', purchaseBox);
dom.resultExitButton.addEventListener('click', leaveHome); dom.rematchButton.addEventListener('click', () => socket.emit('return-lobby', (response) => { if(!response?.ok)toast(response?.error||'Не удалось вернуться','danger'); }));
dom.startTrainingButton?.addEventListener('click', startTraining);
dom.publicRoomsButton?.addEventListener('click', loadPublicRooms);
dom.dailyBoardButton?.addEventListener('click', loadDailyBoard);
dom.trainingExitButton?.addEventListener('click', leaveHome);
dom.spectatorPanel?.querySelectorAll('[data-ping]').forEach((button)=>button.addEventListener('click',()=>socket.emit('team-ping',button.dataset.ping,(response)=>{if(!response?.ok&&response?.error)toast(response.error,'warn');})));

function restoreActiveRoom() {
  const activeCode = sessionStorage.getItem('riftRaidActiveRoom');
  if (!activeCode || resumeInProgress) return;
  resumeInProgress = true;
  dom.serverState.querySelector('span').textContent = 'Восстанавливаем забег...';
  socket.emit('resume-room', { code: activeCode, reconnectToken }, (response) => {
    resumeInProgress = false;
    if (!response?.ok) {
      sessionStorage.removeItem('riftRaidActiveRoom');
      if (roomCode) toast('Срок восстановления комнаты истёк', 'warn');
      roomCode = ''; lobbyState = gameState = null; currentTraining = false;
      showScreen(dom.homeScreen);
      return;
    }
    roomCode = response.room.code; lobbyState = response.room; dom.hudRoomCode.textContent = roomCode;
    if (response.status === 'lobby') return enterLobby(response.room);
    if (!response.game) { sessionStorage.removeItem('riftRaidActiveRoom'); showScreen(dom.homeScreen); return toast('Этот забег уже завершён', 'warn'); }
    const state = response.game;
    currentTraining = Boolean(state.training);
    const restoredMe=state.players.find((player)=>player.id===socket.id);ghostPlayback=profile.ghosts?.[restoredMe?.classId||selectedClass]?.samples||[];ghostPlaybackIndex=0;while(ghostPlaybackIndex<ghostPlayback.length-1&&ghostPlayback[ghostPlaybackIndex+1].t<=state.elapsed)ghostPlaybackIndex+=1;ghostRecording=[];lastGhostSampleAt=state.elapsed;
    if (state.arena) applyArena(state.arena);
    gameState = state; previousBossHp = state.boss?.hp ?? null;
    previousMeHp = state.players.find((player) => player.id === socket.id)?.hp ?? null;
    showScreen(dom.gameScreen); resizeCanvas(); updateHud(state); syncBossMusic(state.boss);
    if (state.status === 'perk') showPerks(state); else if (state.status === 'route') showRoutes(state); else if(state.status==='fusion')showFusions(state);else if(state.status==='contract')showContracts(state);
    toast('Соединение восстановлено — ты снова в забеге', 'gold');
  });
}

socket.on('connect',()=>{
  dom.serverState.className='server-state online';dom.serverState.querySelector('span').textContent='Сервер доступен';
  restoreActiveRoom();
});
socket.on('disconnect',()=>{dom.serverState.className='server-state offline';dom.serverState.querySelector('span').textContent='Связь потеряна';if(dom.gameScreen.classList.contains('active'))toast('Соединение потеряно','danger');});
socket.on('session-replaced',()=>{sessionStorage.removeItem('riftRaidActiveRoom');roomCode='';lobbyState=gameState=null;resetInput();showScreen(dom.homeScreen);toast('Забег открыт в другой вкладке','warn');});
socket.on('lobby-state',enterLobby);
socket.on('game-start',(config)=>{
  world=config.world;applyArena(config.arena);gameState=null;playerAnimationStates.clear();bossAnimationState.bossId='';bossAnimationState.actionKey='';previousBossHp=null;previousMeHp=null;currentRouteKey='';currentFusionKey='';currentContractKey='';currentTraining=Boolean(config.training);ghostRecording=[];lastGhostSampleAt=-1;ghostPlaybackIndex=0;ghostPlayback=profile.ghosts?.[selectedClass]?.samples||[];
  dom.trainingExitButton.style.display=currentTraining?'block':'none';dom.resultOverlay.classList.remove('active');dom.perkOverlay.classList.remove('active');dom.routeOverlay.classList.remove('active');dom.fusionOverlay?.classList.remove('active');dom.contractOverlay?.classList.remove('active');
  showScreen(dom.gameScreen);resizeCanvas();clearTimeout(controlsTimer);dom.controlsTip.classList.remove('hide');controlsTimer=setTimeout(()=>dom.controlsTip.classList.add('hide'),9500);ensureAudio();
  toast(currentTraining?'Тренировка началась':`${config.mode==='daily'?'ЕЖЕДНЕВНЫЙ РАЗЛОМ · ':''}${config.difficulty==='ngplus'?'NG+ · ':''}Модификатор: ${config.modifier?.name||'нет'}`,'gold');
});
socket.on('stage-start',({stage,arena:nextArena,boss})=>{
  applyArena(nextArena);bossAnimationState.bossId='';bossAnimationState.actionKey='';currentPerkKey='';currentRouteKey='';currentFusionKey='';currentContractKey='';dom.perkOverlay.classList.remove('active');dom.perkOverlay.setAttribute('aria-hidden','true');dom.routeOverlay.classList.remove('active');dom.routeOverlay.setAttribute('aria-hidden','true');dom.fusionOverlay?.classList.remove('active');dom.contractOverlay?.classList.remove('active');
  if (boss?.id && profile.bossCodex[boss.id]) { profile.bossCodex[boss.id].seen += 1; saveProfile(); }
  toast(`${stage>1&&(stage-1)%5===0?'НОВЫЙ ВЛАДЫКА · ':''}${nextArena?.name||`Стадия ${stage}`}`,'gold');
});
socket.on('state',(state)=>{
  if(!dom.gameScreen.classList.contains('active'))showScreen(dom.gameScreen);if(state.arena)applyArena(state.arena);
  const bossDelta=previousBossHp!==null&&state.boss?previousBossHp-state.boss.hp:0;const me=state.players.find((player)=>player.id===socket.id);
  if(bossDelta>0){playSound('hit');screenShake=Math.min(16,3+bossDelta*.035)*profile.settings.screenShake;hitStopUntil=performance.now()+Math.min(58,18+bossDelta*.08);}
  if(previousMeHp!==null&&me?.hp<previousMeHp){screenShake=18*profile.settings.screenShake;hitStopUntil=performance.now()+48;}
  previousBossHp=state.boss?.hp??null;previousMeHp=me?.hp??null;gameState=state;for(const playerId of playerAnimationStates.keys())if(!state.players.some((player)=>player.id===playerId))playerAnimationStates.delete(playerId);updateHud(state);syncBossMusic(state.boss);
  if(!state.training&&me&&state.elapsed-lastGhostSampleAt>=.1&&ghostRecording.length<12000){ghostRecording.push({t:Math.round(state.elapsed*10)/10,s:state.stage,x:Math.round(me.x),y:Math.round(me.y),f:me.facing,a:me.action});lastGhostSampleAt=state.elapsed;}
  if(state.status==='perk')showPerks(state);else if(state.status==='route')showRoutes(state);else if(state.status==='fusion')showFusions(state);else if(state.status==='contract')showContracts(state);else{dom.perkOverlay.classList.remove('active');dom.routeOverlay.classList.remove('active');dom.fusionOverlay?.classList.remove('active');dom.contractOverlay?.classList.remove('active');}
});
socket.on('stage-cleared',({stage,bossId})=>{if(bossId&&profile.bossCodex[bossId]){profile.bossCodex[bossId].wins+=1;saveProfile();}toast(`Печать ${stage} разрушена`,'gold');});
socket.on('boss-reward',(reward)=>{
  const first = !profile.bossTrophies.includes(reward.bossId);
  if(first)profile.bossTrophies.push(reward.bossId);
  profile.currency += Math.max(0,Math.floor(reward.currency||0));
  saveProfile();
  toast(`${first?'Новый титул':'Награда владыки'}: ${reward.name} · +${reward.currency} пепла`,'gold');
});
socket.on('route-chosen',(route)=>{toast(`Путь выбран: ${route.name}`,'gold');if(route.special==='healing')toast(route.restoredHp>0?`Тихий свет восстановил ${route.restoredHp} HP отряду`:'Здоровье живых странников уже заполнено','gold');});
socket.on('contract-chosen',(contract)=>toast(`Контракт принят: ${contract.name} · ×${contract.reward||1} пепла`,'warn'));
socket.on('perfect-dodge',({playerId,name,focus,riposteReady})=>{if(playerId===socket.id){playSound('parry');toast(riposteReady?'ИДЕАЛЬНОЕ УКЛОНЕНИЕ · КОНТРАТАКА ГОТОВА':`ИДЕАЛЬНОЕ УКЛОНЕНИЕ · ФОКУС ${focus}/3`,'gold');}else toast(`${name}: идеальное уклонение`,'gold');});
socket.on('ability-used',({playerId,name})=>{if(playerId===socket.id)toast(`${name} активирован`,'gold');});
socket.on('boss-phase',({phase,name})=>{screenShake=20*profile.settings.screenShake;playSound('phase');toast(`${name} · ФАЗА ${phase}`,'danger');});
socket.on('loot-pity',({value})=>{profile.lootPity=Math.min(16,Math.max(0,Math.floor(Number(value)||0)));saveProfile();});
socket.on('boss-loot',({item,pity})=>{
  if(!item||!LOOT_BY_ID.has(item.id))return;
  if(!profile.ownedLoot.includes(item.id))profile.ownedLoot.push(item.id);
  profile.lootPity=Math.min(16,Math.max(0,Math.floor(Number(pity)||0)));
  saveProfile();playSound('phase');
  toast(`ТРОФЕЙ ${LOOT_RARITY_LABEL[item.rarity]}: ${item.name}`,'gold');
});
socket.on('currency-earned',({amount,stage})=>{profile.currency+=Math.max(0,Math.floor(amount));saveProfile();toast(`+${amount} пепла за стадию ${stage}`,'gold');});
socket.on('training-reset',(payload)=>toast(payload.text||'Тренировка перезапущена','gold'));
socket.on('toast',(payload)=>toast(payload.text,payload.tone));socket.on('game-over',showResults);

window.addEventListener('resize',resizeCanvas);populateTraining();renderProfile();resizeCanvas();requestAnimationFrame(renderFrame);
