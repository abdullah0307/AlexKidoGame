"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useCoreLoop } from "@/game/core/use-core-loop";

type ButtonKey = "left" | "right" | "jump" | "kick" | "fire";
type Entity = { x: number; y: number; w: number; h: number };
type Coin = Entity & { taken?: boolean; pulse?: number };
type PowerUp = Entity & { taken?: boolean; kind: "fire" };
type LifePoint = Entity & { taken?: boolean; pulse?: number };
type BossDiamond = Entity & { active: boolean; taken?: boolean; pulse: number };
type Hazard = Entity;
type Projectile = Entity & { vx: number; life: number };
type BossProjectile = Entity & { vx: number; vy: number; life: number; kind: "shard" | "wave" };
type BossPillar = Entity & { life: number };
type MovingLift = Entity & { minX: number; maxX: number; speed: number; dir: 1 | -1 };
type Checkpoint = Entity & { active?: boolean };
type EnvironmentProp = Entity & { src: string; flip?: boolean; alpha?: number };
type FlyingEnemy = Entity & {
  alive: boolean;
  dir: number;
  baseY: number;
  patrolMin: number;
  patrolMax: number;
  flap: number;
  hurt: number;
  dead: number;
  puff: number;
};
type Enemy = Entity & {
  alive: boolean;
  dir: number;
  hurt: number;
  dead: number;
  blood: number;
  squash: number;
  pause: number;
  wander: number;
  deathKind?: "kick" | "stomp";
  chase: boolean;
  patrolMin: number;
  patrolMax: number;
};
type Boss = Entity & {
  active: boolean;
  alive: boolean;
  defeated: boolean;
  phase: "idle" | "entering" | "chasing" | "clawing" | "jumping" | "vulnerable" | "defeated";
  health: number;
  maxHealth: number;
  attackTimer: number;
  vulnerable: number;
  slam: number;
  hurt: number;
  intro: number;
  vx: number;
  vy: number;
  groundY: number;
  targetX: number;
  targetY: number;
  dissolve: number;
  biome: Biome;
  face: number;
  deathFrame: number;
  jumpFrames: number;
  meleeWindup: number;
  meleeCooldown: number;
};
type Player = Entity & {
  vx: number;
  vy: number;
  face: number;
  grounded: boolean;
  attack: number;
  hurt: number;
  land: number;
  fire: number;
  fireCooldown: number;
  power: number;
  dropping: number;
  dead: number;
  deadFall: boolean;
  longJump: number;
  freeze: number;
};
type AudioWindow = Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext };
type GameScreen = "menu" | "loading" | "playing";
type MenuScreen = "main" | "levels";
type LoadingInfo = {
  level: string;
  world: string;
  status: string;
  progress: number;
  coins: number;
  lives: number;
  fire: number;
  power: number;
};
type SoundName = "jump" | "kick" | "hit" | "coin" | "hurt" | "win" | "laser" | "powerup" | "checkpoint" | "blood" | "lose";
type Biome = "forest" | "ice" | "volcano" | "desert" | "haunted" | "clockwork" | "ocean" | "storm" | "void" | "shadow";
type AnimName =
  | "idle"
  | "run"
  | "kick"
  | "jump"
  | "fall"
  | "hurt"
  | "dead"
  | "slimeIdle"
  | "slimeMove"
  | "slimeAttack"
  | "slimeHurt"
  | "slimeDead";
type BossAnimName = "idle" | "run" | "jump" | "slam" | "attack" | "hurt" | "dead";
type Level = {
  id: string;
  name: string;
  intro: string;
  biome: Biome;
  finalCastle: boolean;
  skyTop: string;
  skyMid: string;
  groundTint: string;
  platforms: Entity[];
  bridges: Entity[];
  water: Entity[];
  coins: Coin[];
  powerUps: PowerUp[];
  lifePoints: LifePoint[];
  checkpoints: Checkpoint[];
  enemies: Enemy[];
  flyingEnemies: FlyingEnemy[];
  hazards: Hazard[];
  environmentProps: EnvironmentProp[];
  goal: Entity;
  bossDiamond?: BossDiamond;
};

const WIDTH = 960;
const HEIGHT = 540;
const GRAVITY = 0.75;
const LEVEL_END = 5200;
const MAX_POWER = 100;
const ENEMY_DAMAGE = 25;
const WALK_SPEED = 4.4;
const RUN_JUMP_SPEED = 7.2;
const RUN_JUMP_FRAMES = 38;
const FOREST_BOSS_DRAW_W = 232;
const FOREST_BOSS_DRAW_H = 260;
const FOREST_BOSS_DRAW_X_OFFSET = -58;
const FOREST_BOSS_DRAW_Y_OFFSET = -72;
const BOSS_ARENA_LEFT = 4300;
const BOSS_ARENA_RIGHT = LEVEL_END - 18;
const FOREST_BOSS_PATROL_MIN = BOSS_ARENA_LEFT;
const FOREST_BOSS_PATROL_MAX = BOSS_ARENA_RIGHT;
const FOREST_BOSS_WALK_SPEED = 1.55;
const FOREST_BOSS_WALK_VARIANCE = 0.34;
const FOREST_BOSS_JUMP_TRAVEL_FRAMES = 40;
const bossFacing = (bossState: Boss, playerX: number) => {
  return bossState.x < playerX ? -1 : 1;
};
const clampBossArenaX = (x: number, width = 0) => Math.max(BOSS_ARENA_LEFT, Math.min(BOSS_ARENA_RIGHT - width, x));
const makeBoss = (biome: Biome): Boss => ({
  x: 4880,
  y: biome === "forest" ? -210 : 332,
  w: biome === "forest" ? 142 : 118,
  h: biome === "forest" ? 158 : 138,
  active: false,
  alive: true,
  defeated: false,
  phase: "idle",
  health: biome === "forest" ? 8 : biome === "ice" ? 8 : 5,
  maxHealth: biome === "forest" ? 8 : biome === "ice" ? 8 : 5,
  attackTimer: 110,
  vulnerable: 0,
  slam: 0,
  hurt: 0,
  intro: 0,
  vx: 0,
  vy: 0,
  groundY: biome === "forest" ? 312 : 332,
  targetX: 4880,
  targetY: biome === "forest" ? 312 : 332,
  dissolve: 0,
  biome,
  face: 1,
  deathFrame: 0,
  jumpFrames: 0,
  meleeWindup: 0,
  meleeCooldown: 0,
});
const SPRITE_ROOT = "/assets/sprites/Free%20RPG%20Sprites/PNG_";
const pad = (value: number) => value.toString().padStart(3, "0");
const pad2 = (value: number) => value.toString().padStart(2, "0");
const pad4 = (value: number) => value.toString().padStart(4, "0");
const sequence = (folder: string, prefix: string, count: number) =>
  Array.from({ length: count }, (_, index) => `${SPRITE_ROOT}/${folder}/${prefix}_${pad(index)}.png`);
const numberedSequence = (folder: string, count: number) =>
  Array.from({ length: count }, (_, index) => `${SPRITE_ROOT}/${folder}/${pad2(index + 1)}.png`);
const numberedSequence4 = (folder: string, count: number) =>
  Array.from({ length: count }, (_, index) => `${SPRITE_ROOT}/${folder}/${pad4(index + 1)}.png`);
const frames = (...items: string[]) => items.map((item) => `${SPRITE_ROOT}/${item}`);
const AUDIO_ROOT = "/assets/audio/mixkit";
const AUDIO: Record<SoundName | "music", string> = {
  jump: `${AUDIO_ROOT}/jump.wav`,
  kick: `${AUDIO_ROOT}/punch.wav`,
  hit: `${AUDIO_ROOT}/punch.wav`,
  coin: `${AUDIO_ROOT}/coin.wav`,
  hurt: `${AUDIO_ROOT}/lose.wav`,
  win: `${AUDIO_ROOT}/win.wav`,
  laser: `${AUDIO_ROOT}/laser.wav`,
  powerup: `${AUDIO_ROOT}/powerup.wav`,
  checkpoint: `${AUDIO_ROOT}/checkpoint.wav`,
  blood: `${AUDIO_ROOT}/blood.wav`,
  lose: `${AUDIO_ROOT}/lose.wav`,
  music: `${AUDIO_ROOT}/music.wav`,
};
const WORLD_MUSIC: string[] = [
  "/assets/audio/flowerbed_fields.wav",
  "/assets/audio/snow_stage_bpm162.mp3",
  "/assets/audio/happy_adveture.mp3",
  "/assets/audio/desert-travel.ogg",
  "/assets/audio/ominous_place.mp3",
  "/assets/audio/Chiptune%20Loops/Fly.ogg",
  "/assets/audio/Underwater-Ambient-Pad-isaiah658.wav",
  "/assets/audio/techno_stargazev2.1loop.ogg",
  "/assets/audio/a_wish_to_fulfill_3.ogg",
  "/assets/audio/select_plains_bpm100.mp3",
];

const noise = (value: number) => {
  const wave = Math.sin(value * 12.9898) * 43758.5453;
  return wave - Math.floor(wave);
};
type WorldLevel = {
  id: string;
  name: string;
  intro: string;
  biome: Biome;
  finalCastle: boolean;
  skyTop: string;
  skyMid: string;
  groundTint: string;
};
type WorldDefinition = {
  world: number;
  biome: Biome;
  name: string;
  boss: string;
  skyTop: string;
  skyMid: string;
  groundTint: string;
  levels: [string, string, string, string, string];
  intros: [string, string, string, string, string];
};
const WORLD_DEFINITIONS: WorldDefinition[] = [
  { world: 1, biome: "forest", name: "Forest Kingdom", boss: "Root Guardian", skyTop: "#63b8ff", skyMid: "#d8f3ff", groundTint: "#2f7b42", levels: ["Forest Falls", "Deep Forest Ravine", "Misty Swamp Forest", "Ancient Tree Ruins", "Forest Castle Gate"], intros: ["Reach the forest castle gate", "Cross the ravine outpost", "Escape the swamp path", "Climb through the old ruins", "Enter the castle and clear World 1"] },
  { world: 2, biome: "ice", name: "Ice Fortress", boss: "Frost Warden", skyTop: "#9fd4ff", skyMid: "#eef9ff", groundTint: "#83b3c9", levels: ["Snowy Mountain Pass", "Frozen River Cavern", "Blizzard Peaks", "Crystal Mine", "Ice Fortress"], intros: ["Cross the snowy mountain pass", "Follow the frozen river through the cave", "Push through the blizzard peaks", "Use the crystal platforms to climb", "Enter the ice fortress and clear World 2"] },
  { world: 3, biome: "volcano", name: "Volcanic Ruins", boss: "Magma Golem", skyTop: "#b54732", skyMid: "#ffb36b", groundTint: "#5a241f", levels: ["Ashfall Trail", "Cinder Bridges", "Ember Quarry", "Molten Ruins", "Magma Core Gate"], intros: ["Cross the ashfall trail", "Time jumps over cinder bridges", "Escape the ember quarry", "Climb the ruined magma halls", "Face the Magma Golem"] },
  { world: 4, biome: "desert", name: "Desert Sky Temple", boss: "Sand Serpent", skyTop: "#f0b25d", skyMid: "#ffe1a1", groundTint: "#b87937", levels: ["Dune Road", "Mirage Wells", "Sunstone Lift", "Temple Winds", "Serpent Pyramid"], intros: ["Run across the dune road", "Avoid mirage gaps", "Ride the sunstone lifts", "Push through temple winds", "Enter the serpent pyramid"] },
  { world: 5, biome: "haunted", name: "Haunted Moonwood", boss: "Moon Wraith", skyTop: "#3d315f", skyMid: "#8b6fa8", groundTint: "#24384a", levels: ["Lantern Hollow", "Ghost Fern Path", "Cursed Cemetery", "Moonlit Canopy", "Wraith Manor"], intros: ["Follow the lanterns through the hollow", "Watch for fading paths", "Cross the cursed cemetery", "Climb the moonlit canopy", "Enter the Wraith Manor"] },
  { world: 6, biome: "clockwork", name: "Clockwork City", boss: "Gear Tyrant", skyTop: "#6e7f87", skyMid: "#d1b06a", groundTint: "#5d5142", levels: ["Brass Gate", "Conveyor Works", "Steam Foundry", "Piston Tower", "Clockwork Citadel"], intros: ["Enter the brass gate", "Keep pace with the conveyors", "Dodge steam vents", "Climb the piston tower", "Confront the Gear Tyrant"] },
  { world: 7, biome: "ocean", name: "Sunken Coral Realm", boss: "Abyss Leviathan", skyTop: "#2f9fc4", skyMid: "#8be1dc", groundTint: "#206c78", levels: ["Coral Shore", "Bubble Tunnels", "Pearl Reef", "Tide Palace", "Abyss Gate"], intros: ["Cross the coral shore", "Use bubbles to stay above danger", "Climb the pearl reef", "Survive the tide palace", "Face the Abyss Leviathan"] },
  { world: 8, biome: "storm", name: "Storm Peak", boss: "Thunder Roc", skyTop: "#53698d", skyMid: "#c6d2e5", groundTint: "#596063", levels: ["Windbreak Cliffs", "Cloud Steps", "Lightning Ridge", "Thunder Nest", "Storm Crown"], intros: ["Climb the windbreak cliffs", "Hop across cloud steps", "Avoid lightning on the ridge", "Enter the thunder nest", "Challenge the Thunder Roc"] },
  { world: 9, biome: "void", name: "Crystal Void", boss: "Void Sorcerer", skyTop: "#1c1235", skyMid: "#7055b7", groundTint: "#28204a", levels: ["Shattered Islands", "Prism Gates", "Gravity Shards", "Starlit Labyrinth", "Void Spire"], intros: ["Jump through shattered islands", "Use prism gates", "Survive gravity shards", "Find the starlit path", "Climb the Void Spire"] },
  { world: 10, biome: "shadow", name: "Shadow Crown Castle", boss: "Shadow King", skyTop: "#16141f", skyMid: "#5b2539", groundTint: "#22151d", levels: ["Broken Kingdom", "Dark Gauntlet", "Crown Siege", "Mirror Hall", "Shadow Throne"], intros: ["Enter the broken kingdom", "Survive the dark gauntlet", "Break the crown siege", "Cross the mirror hall", "End the Shadow King's reign"] },
];
const WORLD_LEVELS: WorldLevel[] = WORLD_DEFINITIONS.flatMap((world) =>
  world.levels.map((name, index) => ({
    id: index === 4 ? `${world.world} Final` : `${world.world}.${index + 1}`,
    name,
    intro: world.intros[index],
    biome: world.biome,
    finalCastle: index === 4,
    skyTop: world.skyTop,
    skyMid: world.skyMid,
    groundTint: world.groundTint,
  })),
);
const BIOME_STYLES: Record<
  Biome,
  {
    cap: string;
    dirt: string;
    grassA: string;
    grassB: string;
    shine: string;
    stone: string;
    ridge: string;
    boss: string;
    bossBody: string;
    bossHead: string;
    bossCore: string;
    bossStroke: string;
  }
> = {
  forest: { cap: "#48a447", dirt: "#7b4b2b", grassA: "#5ccf62", grassB: "#2f8f49", shine: "rgba(255,255,255,.14)", stone: "rgba(104,59,31,.55)", ridge: "rgba(68,142,82,.28)", boss: "Root Guardian", bossBody: "#6d3f21", bossHead: "#2f8f49", bossCore: "#3b2415", bossStroke: "#8d542c" },
  ice: { cap: "#b9dceb", dirt: "#52788d", grassA: "#e6f7ff", grassB: "#67b8d7", shine: "rgba(255,255,255,.2)", stone: "rgba(55,91,110,.48)", ridge: "rgba(81,128,151,.24)", boss: "Frost Warden", bossBody: "#84d8f4", bossHead: "#d8f7ff", bossCore: "#4d90b5", bossStroke: "#eafaff" },
  volcano: { cap: "#2b2524", dirt: "#74322b", grassA: "#ff6b3d", grassB: "#c43f2f", shine: "rgba(255,142,74,.24)", stone: "rgba(255,91,42,.35)", ridge: "rgba(92,35,28,.36)", boss: "Magma Golem", bossBody: "#8a2d25", bossHead: "#ff7a3d", bossCore: "#ffd166", bossStroke: "#3b1d18" },
  desert: { cap: "#e0bc68", dirt: "#a86b34", grassA: "#f2d487", grassB: "#c99048", shine: "rgba(255,245,190,.28)", stone: "rgba(117,76,39,.42)", ridge: "rgba(183,126,56,.25)", boss: "Sand Serpent", bossBody: "#b5793a", bossHead: "#f1c76d", bossCore: "#5c3b24", bossStroke: "#6f4928" },
  haunted: { cap: "#3e6f5d", dirt: "#343047", grassA: "#77c7a0", grassB: "#596d86", shine: "rgba(190,255,220,.18)", stone: "rgba(28,25,42,.5)", ridge: "rgba(56,44,85,.34)", boss: "Moon Wraith", bossBody: "#47355f", bossHead: "#a9d7d0", bossCore: "#c7f7ff", bossStroke: "#1f1a31" },
  clockwork: { cap: "#b68a3a", dirt: "#5f5140", grassA: "#d7b15a", grassB: "#8f6a30", shine: "rgba(255,214,115,.25)", stone: "rgba(48,43,39,.48)", ridge: "rgba(97,82,63,.32)", boss: "Gear Tyrant", bossBody: "#6c5a42", bossHead: "#c19a42", bossCore: "#69d2ff", bossStroke: "#2b2927" },
  ocean: { cap: "#54c3b5", dirt: "#236d76", grassA: "#8bf1d9", grassB: "#2fa59d", shine: "rgba(185,255,247,.25)", stone: "rgba(25,83,92,.45)", ridge: "rgba(39,127,145,.3)", boss: "Abyss Leviathan", bossBody: "#225e78", bossHead: "#45c5d8", bossCore: "#b6fff4", bossStroke: "#123d4a" },
  storm: { cap: "#b8c7d1", dirt: "#626a70", grassA: "#eef6ff", grassB: "#9fb0bd", shine: "rgba(255,255,255,.28)", stone: "rgba(60,70,80,.45)", ridge: "rgba(86,105,135,.34)", boss: "Thunder Roc", bossBody: "#4e5f78", bossHead: "#d3e1ff", bossCore: "#ffe66d", bossStroke: "#252b3a" },
  void: { cap: "#6650b8", dirt: "#2b204b", grassA: "#a88cff", grassB: "#58e0d2", shine: "rgba(194,169,255,.24)", stone: "rgba(25,16,50,.5)", ridge: "rgba(83,56,150,.32)", boss: "Void Sorcerer", bossBody: "#2b204b", bossHead: "#765dde", bossCore: "#7dffe8", bossStroke: "#111024" },
  shadow: { cap: "#5c2438", dirt: "#23151d", grassA: "#e24b6a", grassB: "#73314a", shine: "rgba(255,90,130,.18)", stone: "rgba(18,12,18,.58)", ridge: "rgba(73,28,48,.35)", boss: "Shadow King", bossBody: "#241721", bossHead: "#7b2748", bossCore: "#ff4d7d", bossStroke: "#08070a" },
};
const biomeStyle = (biome: Biome) => BIOME_STYLES[biome];
const worldIndexForStage = (stage: number) => Math.floor(stage / 5);
const localIndexForStage = (stage: number) => stage % 5;

const SPRITES: Record<AnimName, string[]> = {
  idle: sequence("ADVENTURER/01-Idle/Normal", "FR_Adventurer_Idle", 12),
  run: sequence("ADVENTURER/02-Run", "FR_Adventurer_Run", 10),
  kick: sequence("ADVENTURER/03-Slash", "FR_Adventurer_Slash", 8),
  jump: frames(
    "ADVENTURER/04-Jump%26Fall/FR_Adventurer_JumpUp_000.png",
    "ADVENTURER/04-Jump%26Fall/FR_Adventurer_JumpUp_000.png",
  ),
  fall: frames(
    "ADVENTURER/04-Jump%26Fall/FR_Adventurer_JumpFall_000.png",
    "ADVENTURER/04-Jump%26Fall/FR_Adventurer_JumpFall_000.png",
  ),
  hurt: sequence("ADVENTURER/06-Hurt", "FR_Adventurer_Hurt", 6),
  dead: sequence("ADVENTURER/07-Dead", "FR_Adventurer_Dead", 9),
  slimeIdle: sequence("SLIME04/01-Idle", "FR_Slime4_Idle", 12),
  slimeMove: sequence("SLIME04/02-Move", "FR_Slime4_Move", 10),
  slimeAttack: sequence("SLIME04/03-Attack", "FR_Slime4_Attack", 8),
  slimeHurt: sequence("SLIME04/04-Hurt", "FR_Slime4_Hurt", 6),
  slimeDead: sequence("SLIME04/05-Dead", "FR_Slime4_Dead", 6),
};
const ROOT_GUARDIAN_SPRITES: Record<BossAnimName, string[]> = {
  idle: numberedSequence("ROOT_GUARDIAN/10-Idle_Custom", 24),
  run: numberedSequence4("ROOT_GUARDIAN/11-Run_Custom_Full", 59),
  jump: numberedSequence("ROOT_GUARDIAN/04-Jump", 18),
  slam: numberedSequence("ROOT_GUARDIAN/09-Air_Attack", 16),
  attack: numberedSequence("ROOT_GUARDIAN/07-Claw_Attack", 14),
  hurt: numberedSequence("ROOT_GUARDIAN/08-Wing_Flap", 12),
  dead: numberedSequence("ROOT_GUARDIAN/06-Dead", 22),
};
const FROST_WARDEN_SPRITES: Record<BossAnimName, string[]> = {
  idle: numberedSequence("FROST_WARDEN_CUSTOM/01-Idle", 17),
  run: numberedSequence("FROST_WARDEN_CUSTOM/02-Run", 17),
  jump: numberedSequence("FROST_WARDEN_CUSTOM/03-Jump", 17),
  slam: numberedSequence("FROST_WARDEN_CUSTOM/04-Slam", 17),
  attack: numberedSequence("FROST_WARDEN_CUSTOM/05-Attack", 17),
  hurt: numberedSequence("FROST_WARDEN_CUSTOM/06-Hurt", 17),
  dead: numberedSequence("FROST_WARDEN_CUSTOM/07-Dead", 17),
};
const VILLAIN_ROOT = "/assets/sprites/villains";
const VILLAIN_BOSS_SPRITES: Partial<Record<Biome, { src: string; w: number; h: number; y: number; glow: string }>> = {
  forest: { src: `${VILLAIN_ROOT}/WORLD_02_MAGMA_GOLEM/boss.png`, w: 142, h: 158, y: 0, glow: "rgba(255, 239, 110, .8)" },
  volcano: { src: `${VILLAIN_ROOT}/WORLD_03_MAGMA_GOLEM/boss.png`, w: 122, h: 122, y: 16, glow: "rgba(255, 112, 38, .46)" },
  desert: { src: `${VILLAIN_ROOT}/WORLD_04_SAND_SERPENT/boss.png`, w: 148, h: 148, y: 8, glow: "rgba(241, 199, 109, .42)" },
  haunted: { src: `${VILLAIN_ROOT}/WORLD_05_MOON_WRAITH/boss.png`, w: 150, h: 150, y: 8, glow: "rgba(190, 230, 255, .34)" },
  clockwork: { src: `${VILLAIN_ROOT}/WORLD_06_GEAR_TYRANT/boss.png`, w: 138, h: 138, y: 12, glow: "rgba(105, 210, 255, .36)" },
  ocean: { src: `${VILLAIN_ROOT}/WORLD_07_ABYSS_LEVIATHAN/boss.png`, w: 128, h: 168, y: -8, glow: "rgba(92, 241, 217, .34)" },
  storm: { src: `${VILLAIN_ROOT}/WORLD_08_THUNDER_ROC/boss.png`, w: 170, h: 138, y: 4, glow: "rgba(255, 230, 109, .38)" },
  void: { src: `${VILLAIN_ROOT}/WORLD_09_VOID_SORCERER/boss.png`, w: 112, h: 148, y: 2, glow: "rgba(126, 255, 232, .34)" },
  shadow: { src: `${VILLAIN_ROOT}/WORLD_10_SHADOW_KING/boss.png`, w: 118, h: 156, y: -4, glow: "rgba(255, 77, 125, .34)" },
};
const ENVIRONMENT_ROOT = "/assets/environment/curated";
const ENVIRONMENT_ASSETS: Record<Biome, { src: string; w: number; h: number }[]> = {
  forest: [
    { src: `${ENVIRONMENT_ROOT}/trees/kenney-tree.png`, w: 86, h: 116 },
    { src: `${ENVIRONMENT_ROOT}/trees/kenney-tree-long.png`, w: 82, h: 148 },
    { src: `${ENVIRONMENT_ROOT}/bushes/kenney-bush-1.png`, w: 54, h: 28 },
    { src: `${ENVIRONMENT_ROOT}/bushes/kenney-plant.png`, w: 36, h: 44 },
    { src: `${ENVIRONMENT_ROOT}/rocks/kenney-rock.png`, w: 42, h: 28 },
    { src: `${ENVIRONMENT_ROOT}/boxes/spriteattack-crate-001.png`, w: 42, h: 42 },
  ],
  ice: [
    { src: `${ENVIRONMENT_ROOT}/trees/kenney-tree-snow.png`, w: 86, h: 116 },
    { src: `${ENVIRONMENT_ROOT}/trees/kenney-tree-frozen.png`, w: 82, h: 118 },
    { src: `${ENVIRONMENT_ROOT}/rocks/kenney-ice-rock.png`, w: 46, h: 34 },
    { src: `${ENVIRONMENT_ROOT}/rocks/kenney-ice-rock-alt.png`, w: 46, h: 34 },
    { src: `${ENVIRONMENT_ROOT}/breakables/reactorcore-crate-metal.png`, w: 44, h: 44 },
  ],
  volcano: [
    { src: `${ENVIRONMENT_ROOT}/rocks/reactorcore-stone-boulder.png`, w: 58, h: 52 },
    { src: `${ENVIRONMENT_ROOT}/breakables/reactorcore-barrel-metal.png`, w: 40, h: 52 },
    { src: `${ENVIRONMENT_ROOT}/breakables/reactorcore-barrel-wood.png`, w: 40, h: 52 },
    { src: `${ENVIRONMENT_ROOT}/breakables/kenney-box-warning.png`, w: 44, h: 44 },
    { src: `${ENVIRONMENT_ROOT}/breakables/kenney-box-explosive.png`, w: 44, h: 44 },
  ],
  desert: [
    { src: `${ENVIRONMENT_ROOT}/desert/kenney-cactus-1.png`, w: 40, h: 78 },
    { src: `${ENVIRONMENT_ROOT}/desert/kenney-cactus-2.png`, w: 34, h: 64 },
    { src: `${ENVIRONMENT_ROOT}/trees/kenney-tree-palm.png`, w: 98, h: 128 },
    { src: `${ENVIRONMENT_ROOT}/rocks/kenney-rock.png`, w: 42, h: 28 },
    { src: `${ENVIRONMENT_ROOT}/boxes/spriteattack-box-002.png`, w: 44, h: 44 },
  ],
  haunted: [
    { src: `${ENVIRONMENT_ROOT}/trees/kenney-tree-dead.png`, w: 82, h: 118 },
    { src: `${ENVIRONMENT_ROOT}/bushes/kenney-plant-purple.png`, w: 38, h: 46 },
    { src: `${ENVIRONMENT_ROOT}/rocks/reactorcore-stone-boulder.png`, w: 54, h: 48 },
    { src: `${ENVIRONMENT_ROOT}/breakables/reactorcore-crate-wood.png`, w: 44, h: 44 },
  ],
  clockwork: [
    { src: `${ENVIRONMENT_ROOT}/breakables/reactorcore-crate-metal.png`, w: 44, h: 44 },
    { src: `${ENVIRONMENT_ROOT}/breakables/reactorcore-barrel-metal.png`, w: 40, h: 52 },
    { src: `${ENVIRONMENT_ROOT}/signs/kenney-sign.png`, w: 42, h: 54 },
    { src: `${ENVIRONMENT_ROOT}/misc/reactorcore-wood-log-1.png`, w: 78, h: 30 },
  ],
  ocean: [
    { src: `${ENVIRONMENT_ROOT}/bushes/kenney-bush-alt-1.png`, w: 54, h: 28 },
    { src: `${ENVIRONMENT_ROOT}/bushes/kenney-plant.png`, w: 36, h: 44 },
    { src: `${ENVIRONMENT_ROOT}/misc/reactorcore-wood-log-2.png`, w: 78, h: 30 },
    { src: `${ENVIRONMENT_ROOT}/boxes/spriteattack-crate-002.png`, w: 42, h: 42 },
  ],
  storm: [
    { src: `${ENVIRONMENT_ROOT}/trees/kenney-tree-pine.png`, w: 76, h: 128 },
    { src: `${ENVIRONMENT_ROOT}/rocks/reactorcore-stone-boulder.png`, w: 58, h: 52 },
    { src: `${ENVIRONMENT_ROOT}/breakables/reactorcore-crate-wood.png`, w: 44, h: 44 },
    { src: `${ENVIRONMENT_ROOT}/signs/kenney-sign-right.png`, w: 42, h: 54 },
  ],
  void: [
    { src: `${ENVIRONMENT_ROOT}/bushes/kenney-plant-purple.png`, w: 38, h: 46 },
    { src: `${ENVIRONMENT_ROOT}/breakables/reactorcore-crate-metal.png`, w: 44, h: 44 },
    { src: `${ENVIRONMENT_ROOT}/rocks/kenney-stone.png`, w: 48, h: 34 },
    { src: `${ENVIRONMENT_ROOT}/breakables/kenney-box-item.png`, w: 44, h: 44 },
  ],
  shadow: [
    { src: `${ENVIRONMENT_ROOT}/trees/kenney-tree-dead.png`, w: 82, h: 118 },
    { src: `${ENVIRONMENT_ROOT}/breakables/reactorcore-barrel-wood.png`, w: 40, h: 52 },
    { src: `${ENVIRONMENT_ROOT}/breakables/kenney-box-warning.png`, w: 44, h: 44 },
    { src: `${ENVIRONMENT_ROOT}/rocks/reactorcore-stone-boulder.png`, w: 54, h: 48 },
  ],
};

const makePlayer = (): Player => ({
  x: 75,
  y: 260,
  w: 42,
  h: 58,
  vx: 0,
  vy: 0,
  face: 1,
  grounded: false,
  attack: 0,
  hurt: 0,
  land: 0,
  fire: 0,
  fireCooldown: 0,
  power: MAX_POWER,
  dropping: 0,
  dead: 0,
  deadFall: false,
  longJump: 0,
  freeze: 0,
});

const makeEnemy = (x: number, dir: number, patrolMin: number, patrolMax: number, chase = false, y = 431): Enemy => ({
  x,
  y,
  w: 44,
  h: 44,
  alive: true,
  dir,
  hurt: 0,
  dead: 0,
  blood: 0,
  squash: 0,
  pause: Math.floor(noise(x * 0.37) * 24),
  wander: 60 + Math.floor(noise(x * 0.19) * 90),
  chase,
  patrolMin,
  patrolMax,
});

const makeFlyingEnemy = (x: number, y: number, dir: number, patrolMin: number, patrolMax: number): FlyingEnemy => ({
  x,
  y,
  w: 42,
  h: 30,
  alive: true,
  dir,
  baseY: y,
  patrolMin,
  patrolMax,
  flap: noise(x * 0.07) * 10,
  hurt: 0,
  dead: 0,
  puff: 0,
});

const biomeStageGrounds: Record<Exclude<Biome, "forest" | "ice">, Entity[][]> = {
  volcano: [
    [{ x: 0, y: 480, w: 620, h: 60 }, { x: 820, y: 438, w: 310, h: 102 }, { x: 1320, y: 500, w: 360, h: 40 }, { x: 1860, y: 410, w: 280, h: 130 }, { x: 2320, y: 472, w: 340, h: 68 }, { x: 2920, y: 390, w: 300, h: 150 }, { x: 3480, y: 500, w: 300, h: 40 }, { x: 3980, y: 420, w: 360, h: 120 }, { x: 4540, y: 462, w: 720, h: 78 }],
    [{ x: 0, y: 468, w: 520, h: 72 }, { x: 740, y: 502, w: 320, h: 38 }, { x: 1260, y: 430, w: 300, h: 110 }, { x: 1800, y: 500, w: 250, h: 40 }, { x: 2280, y: 392, w: 285, h: 148 }, { x: 2820, y: 458, w: 310, h: 82 }, { x: 3380, y: 372, w: 260, h: 168 }, { x: 3980, y: 492, w: 300, h: 48 }, { x: 4540, y: 438, w: 720, h: 102 }],
    [{ x: 0, y: 486, w: 600, h: 54 }, { x: 860, y: 422, w: 240, h: 118 }, { x: 1360, y: 354, w: 230, h: 186 }, { x: 1880, y: 476, w: 330, h: 64 }, { x: 2500, y: 388, w: 260, h: 152 }, { x: 3100, y: 454, w: 280, h: 86 }, { x: 3680, y: 338, w: 240, h: 202 }, { x: 4260, y: 472, w: 320, h: 68 }, { x: 4820, y: 420, w: 440, h: 120 }],
    [{ x: 0, y: 470, w: 540, h: 70 }, { x: 760, y: 430, w: 260, h: 110 }, { x: 1220, y: 470, w: 250, h: 70 }, { x: 1680, y: 392, w: 250, h: 148 }, { x: 2140, y: 338, w: 230, h: 202 }, { x: 2620, y: 438, w: 300, h: 102 }, { x: 3180, y: 500, w: 240, h: 40 }, { x: 3700, y: 394, w: 310, h: 146 }, { x: 4560, y: 456, w: 700, h: 84 }],
    [{ x: 0, y: 482, w: 700, h: 58 }, { x: 790, y: 452, w: 410, h: 88 }, { x: 1280, y: 420, w: 380, h: 120 }, { x: 1740, y: 470, w: 360, h: 70 }, { x: 2240, y: 430, w: 390, h: 110 }, { x: 2840, y: 390, w: 360, h: 150 }, { x: 3440, y: 486, w: 380, h: 54 }, { x: 3960, y: 420, w: 420, h: 120 }, { x: 4560, y: 445, w: 700, h: 95 }],
  ],
  desert: [
    [{ x: 0, y: 488, w: 780, h: 52 }, { x: 880, y: 468, w: 520, h: 72 }, { x: 1520, y: 500, w: 620, h: 40 }, { x: 2280, y: 450, w: 410, h: 90 }, { x: 2850, y: 492, w: 460, h: 48 }, { x: 3480, y: 460, w: 370, h: 80 }, { x: 4020, y: 500, w: 360, h: 40 }, { x: 4560, y: 470, w: 700, h: 70 }],
    [{ x: 0, y: 476, w: 650, h: 64 }, { x: 820, y: 496, w: 320, h: 44 }, { x: 1340, y: 438, w: 290, h: 102 }, { x: 1800, y: 500, w: 430, h: 40 }, { x: 2440, y: 458, w: 290, h: 82 }, { x: 2960, y: 498, w: 430, h: 42 }, { x: 3580, y: 438, w: 300, h: 102 }, { x: 4540, y: 466, w: 720, h: 74 }],
    [{ x: 0, y: 490, w: 610, h: 50 }, { x: 790, y: 440, w: 280, h: 100 }, { x: 1260, y: 370, w: 240, h: 170 }, { x: 1700, y: 455, w: 310, h: 85 }, { x: 2240, y: 384, w: 270, h: 156 }, { x: 2800, y: 456, w: 300, h: 84 }, { x: 3380, y: 386, w: 260, h: 154 }, { x: 3940, y: 462, w: 320, h: 78 }, { x: 4560, y: 430, w: 700, h: 110 }],
    [{ x: 0, y: 486, w: 560, h: 54 }, { x: 720, y: 430, w: 250, h: 110 }, { x: 1140, y: 500, w: 280, h: 40 }, { x: 1600, y: 430, w: 250, h: 110 }, { x: 2040, y: 500, w: 280, h: 40 }, { x: 2500, y: 430, w: 250, h: 110 }, { x: 2960, y: 500, w: 290, h: 40 }, { x: 3520, y: 430, w: 300, h: 110 }, { x: 4560, y: 458, w: 700, h: 82 }],
    [{ x: 0, y: 480, w: 760, h: 60 }, { x: 805, y: 458, w: 260, h: 82 }, { x: 1140, y: 430, w: 300, h: 110 }, { x: 1540, y: 395, w: 310, h: 145 }, { x: 1960, y: 455, w: 330, h: 85 }, { x: 2410, y: 405, w: 330, h: 135 }, { x: 2880, y: 455, w: 360, h: 85 }, { x: 3340, y: 500, w: 420, h: 40 }, { x: 3940, y: 458, w: 360, h: 82 }, { x: 4540, y: 435, w: 720, h: 105 }],
  ],
  haunted: [
    [{ x: 0, y: 475, w: 650, h: 65 }, { x: 810, y: 465, w: 300, h: 75 }, { x: 1280, y: 502, w: 360, h: 38 }, { x: 1850, y: 430, w: 330, h: 110 }, { x: 2420, y: 486, w: 300, h: 54 }, { x: 2940, y: 420, w: 280, h: 120 }, { x: 3480, y: 498, w: 350, h: 42 }, { x: 4040, y: 448, w: 310, h: 92 }, { x: 4540, y: 470, w: 720, h: 70 }],
    [{ x: 0, y: 485, w: 520, h: 55 }, { x: 700, y: 430, w: 230, h: 110 }, { x: 1120, y: 505, w: 260, h: 35 }, { x: 1540, y: 430, w: 230, h: 110 }, { x: 1960, y: 505, w: 260, h: 35 }, { x: 2380, y: 430, w: 230, h: 110 }, { x: 2800, y: 505, w: 260, h: 35 }, { x: 3400, y: 430, w: 260, h: 110 }, { x: 4540, y: 460, w: 720, h: 80 }],
    [{ x: 0, y: 470, w: 580, h: 70 }, { x: 780, y: 410, w: 250, h: 130 }, { x: 1240, y: 355, w: 230, h: 185 }, { x: 1700, y: 432, w: 260, h: 108 }, { x: 2180, y: 370, w: 230, h: 170 }, { x: 2680, y: 450, w: 280, h: 90 }, { x: 3260, y: 382, w: 260, h: 158 }, { x: 3860, y: 470, w: 280, h: 70 }, { x: 4540, y: 426, w: 720, h: 114 }],
    [{ x: 0, y: 482, w: 600, h: 58 }, { x: 780, y: 438, w: 270, h: 102 }, { x: 1220, y: 394, w: 240, h: 146 }, { x: 1660, y: 350, w: 230, h: 190 }, { x: 2120, y: 398, w: 240, h: 142 }, { x: 2580, y: 445, w: 280, h: 95 }, { x: 3200, y: 500, w: 300, h: 40 }, { x: 3760, y: 430, w: 280, h: 110 }, { x: 4540, y: 455, w: 720, h: 85 }],
    [{ x: 0, y: 475, w: 620, h: 65 }, { x: 800, y: 462, w: 300, h: 78 }, { x: 1280, y: 405, w: 270, h: 135 }, { x: 1780, y: 470, w: 290, h: 70 }, { x: 2300, y: 405, w: 280, h: 135 }, { x: 2820, y: 468, w: 300, h: 72 }, { x: 3400, y: 500, w: 300, h: 40 }, { x: 4540, y: 432, w: 720, h: 108 }],
  ],
  clockwork: [
    [{ x: 0, y: 470, w: 720, h: 70 }, { x: 830, y: 470, w: 310, h: 70 }, { x: 1260, y: 410, w: 360, h: 130 }, { x: 1760, y: 410, w: 360, h: 130 }, { x: 2280, y: 470, w: 330, h: 70 }, { x: 2780, y: 360, w: 310, h: 180 }, { x: 3300, y: 470, w: 360, h: 70 }, { x: 3840, y: 410, w: 340, h: 130 }, { x: 4540, y: 450, w: 720, h: 90 }],
    [{ x: 0, y: 500, w: 620, h: 40 }, { x: 760, y: 440, w: 360, h: 100 }, { x: 1280, y: 380, w: 320, h: 160 }, { x: 1760, y: 440, w: 360, h: 100 }, { x: 2300, y: 500, w: 320, h: 40 }, { x: 2780, y: 440, w: 360, h: 100 }, { x: 3340, y: 380, w: 320, h: 160 }, { x: 3880, y: 440, w: 360, h: 100 }, { x: 4540, y: 460, w: 720, h: 80 }],
    [{ x: 0, y: 468, w: 560, h: 72 }, { x: 720, y: 414, w: 280, h: 126 }, { x: 1160, y: 360, w: 260, h: 180 }, { x: 1580, y: 306, w: 240, h: 234 }, { x: 2040, y: 360, w: 260, h: 180 }, { x: 2500, y: 414, w: 280, h: 126 }, { x: 3060, y: 468, w: 320, h: 72 }, { x: 3680, y: 385, w: 300, h: 155 }, { x: 4540, y: 446, w: 720, h: 94 }],
    [{ x: 0, y: 470, w: 620, h: 70 }, { x: 760, y: 500, w: 240, h: 40 }, { x: 1160, y: 430, w: 240, h: 110 }, { x: 1560, y: 500, w: 240, h: 40 }, { x: 1960, y: 430, w: 240, h: 110 }, { x: 2360, y: 500, w: 240, h: 40 }, { x: 2900, y: 390, w: 260, h: 150 }, { x: 3480, y: 470, w: 330, h: 70 }, { x: 4540, y: 438, w: 720, h: 102 }],
    [{ x: 0, y: 482, w: 650, h: 58 }, { x: 780, y: 440, w: 300, h: 100 }, { x: 1220, y: 382, w: 290, h: 158 }, { x: 1700, y: 440, w: 300, h: 100 }, { x: 2180, y: 382, w: 290, h: 158 }, { x: 2660, y: 440, w: 300, h: 100 }, { x: 3240, y: 500, w: 320, h: 40 }, { x: 4540, y: 425, w: 720, h: 115 }],
  ],
  ocean: [
    [{ x: 0, y: 478, w: 620, h: 62 }, { x: 840, y: 450, w: 300, h: 90 }, { x: 1320, y: 490, w: 310, h: 50 }, { x: 1840, y: 420, w: 270, h: 120 }, { x: 2360, y: 470, w: 320, h: 70 }, { x: 2920, y: 400, w: 270, h: 140 }, { x: 3500, y: 490, w: 310, h: 50 }, { x: 4060, y: 430, w: 300, h: 110 }, { x: 4540, y: 462, w: 720, h: 78 }],
    [{ x: 0, y: 500, w: 540, h: 40 }, { x: 720, y: 440, w: 250, h: 100 }, { x: 1120, y: 500, w: 250, h: 40 }, { x: 1520, y: 440, w: 250, h: 100 }, { x: 1920, y: 500, w: 250, h: 40 }, { x: 2360, y: 440, w: 260, h: 100 }, { x: 2840, y: 500, w: 270, h: 40 }, { x: 3460, y: 420, w: 300, h: 120 }, { x: 4540, y: 455, w: 720, h: 85 }],
    [{ x: 0, y: 488, w: 610, h: 52 }, { x: 800, y: 430, w: 260, h: 110 }, { x: 1260, y: 370, w: 240, h: 170 }, { x: 1740, y: 430, w: 260, h: 110 }, { x: 2220, y: 370, w: 240, h: 170 }, { x: 2700, y: 430, w: 260, h: 110 }, { x: 3260, y: 488, w: 300, h: 52 }, { x: 3900, y: 410, w: 300, h: 130 }, { x: 4540, y: 440, w: 720, h: 100 }],
    [{ x: 0, y: 470, w: 580, h: 70 }, { x: 780, y: 500, w: 250, h: 40 }, { x: 1200, y: 455, w: 230, h: 85 }, { x: 1580, y: 410, w: 230, h: 130 }, { x: 1960, y: 455, w: 230, h: 85 }, { x: 2340, y: 500, w: 250, h: 40 }, { x: 2920, y: 420, w: 280, h: 120 }, { x: 3500, y: 470, w: 310, h: 70 }, { x: 4540, y: 432, w: 720, h: 108 }],
    [{ x: 0, y: 480, w: 620, h: 60 }, { x: 820, y: 438, w: 300, h: 102 }, { x: 1320, y: 490, w: 320, h: 50 }, { x: 1900, y: 420, w: 290, h: 120 }, { x: 2440, y: 488, w: 320, h: 52 }, { x: 3020, y: 392, w: 280, h: 148 }, { x: 3600, y: 500, w: 300, h: 40 }, { x: 4540, y: 425, w: 720, h: 115 }],
  ],
  storm: [
    [{ x: 0, y: 470, w: 600, h: 70 }, { x: 820, y: 420, w: 280, h: 120 }, { x: 1340, y: 500, w: 300, h: 40 }, { x: 1900, y: 380, w: 260, h: 160 }, { x: 2440, y: 470, w: 300, h: 70 }, { x: 3020, y: 340, w: 240, h: 200 }, { x: 3560, y: 500, w: 300, h: 40 }, { x: 4120, y: 420, w: 300, h: 120 }, { x: 4540, y: 452, w: 720, h: 88 }],
    [{ x: 0, y: 485, w: 540, h: 55 }, { x: 720, y: 430, w: 250, h: 110 }, { x: 1140, y: 365, w: 230, h: 175 }, { x: 1560, y: 430, w: 250, h: 110 }, { x: 2000, y: 500, w: 260, h: 40 }, { x: 2500, y: 430, w: 260, h: 110 }, { x: 3040, y: 365, w: 250, h: 175 }, { x: 3600, y: 430, w: 270, h: 110 }, { x: 4540, y: 450, w: 720, h: 90 }],
    [{ x: 0, y: 472, w: 620, h: 68 }, { x: 820, y: 402, w: 250, h: 138 }, { x: 1260, y: 332, w: 220, h: 208 }, { x: 1700, y: 402, w: 250, h: 138 }, { x: 2180, y: 472, w: 280, h: 68 }, { x: 2740, y: 380, w: 260, h: 160 }, { x: 3320, y: 472, w: 290, h: 68 }, { x: 3920, y: 350, w: 260, h: 190 }, { x: 4540, y: 430, w: 720, h: 110 }],
    [{ x: 0, y: 490, w: 560, h: 50 }, { x: 760, y: 442, w: 240, h: 98 }, { x: 1160, y: 394, w: 230, h: 146 }, { x: 1560, y: 346, w: 220, h: 194 }, { x: 1980, y: 394, w: 230, h: 146 }, { x: 2400, y: 442, w: 240, h: 98 }, { x: 2960, y: 490, w: 280, h: 50 }, { x: 3560, y: 410, w: 280, h: 130 }, { x: 4540, y: 450, w: 720, h: 90 }],
    [{ x: 0, y: 475, w: 610, h: 65 }, { x: 820, y: 430, w: 290, h: 110 }, { x: 1320, y: 350, w: 260, h: 190 }, { x: 1840, y: 430, w: 290, h: 110 }, { x: 2380, y: 500, w: 310, h: 40 }, { x: 3020, y: 390, w: 300, h: 150 }, { x: 3640, y: 470, w: 300, h: 70 }, { x: 4540, y: 420, w: 720, h: 120 }],
  ],
  void: [
    [{ x: 0, y: 480, w: 560, h: 60 }, { x: 790, y: 430, w: 250, h: 110 }, { x: 1280, y: 360, w: 230, h: 180 }, { x: 1780, y: 470, w: 260, h: 70 }, { x: 2280, y: 388, w: 240, h: 152 }, { x: 2800, y: 455, w: 260, h: 85 }, { x: 3380, y: 332, w: 220, h: 208 }, { x: 3980, y: 468, w: 280, h: 72 }, { x: 4540, y: 430, w: 720, h: 110 }],
    [{ x: 0, y: 488, w: 500, h: 52 }, { x: 700, y: 430, w: 220, h: 110 }, { x: 1080, y: 370, w: 210, h: 170 }, { x: 1480, y: 310, w: 200, h: 230 }, { x: 1880, y: 370, w: 210, h: 170 }, { x: 2300, y: 430, w: 220, h: 110 }, { x: 2860, y: 488, w: 260, h: 52 }, { x: 3500, y: 360, w: 250, h: 180 }, { x: 4540, y: 438, w: 720, h: 102 }],
    [{ x: 0, y: 470, w: 540, h: 70 }, { x: 760, y: 405, w: 230, h: 135 }, { x: 1180, y: 475, w: 230, h: 65 }, { x: 1600, y: 345, w: 210, h: 195 }, { x: 2040, y: 415, w: 230, h: 125 }, { x: 2500, y: 285, w: 200, h: 255 }, { x: 3040, y: 440, w: 250, h: 100 }, { x: 3640, y: 340, w: 260, h: 200 }, { x: 4540, y: 420, w: 720, h: 120 }],
    [{ x: 0, y: 486, w: 520, h: 54 }, { x: 720, y: 435, w: 220, h: 105 }, { x: 1120, y: 384, w: 210, h: 156 }, { x: 1520, y: 333, w: 200, h: 207 }, { x: 1920, y: 384, w: 210, h: 156 }, { x: 2320, y: 435, w: 220, h: 105 }, { x: 2860, y: 486, w: 260, h: 54 }, { x: 3500, y: 360, w: 260, h: 180 }, { x: 4540, y: 432, w: 720, h: 108 }],
    [{ x: 0, y: 475, w: 560, h: 65 }, { x: 760, y: 410, w: 260, h: 130 }, { x: 1240, y: 345, w: 240, h: 195 }, { x: 1740, y: 410, w: 260, h: 130 }, { x: 2260, y: 475, w: 280, h: 65 }, { x: 2900, y: 350, w: 270, h: 190 }, { x: 3540, y: 500, w: 310, h: 40 }, { x: 4540, y: 420, w: 720, h: 120 }],
  ],
  shadow: [
    [{ x: 0, y: 470, w: 620, h: 70 }, { x: 800, y: 470, w: 280, h: 70 }, { x: 1240, y: 410, w: 300, h: 130 }, { x: 1720, y: 500, w: 280, h: 40 }, { x: 2200, y: 410, w: 300, h: 130 }, { x: 2700, y: 470, w: 300, h: 70 }, { x: 3300, y: 390, w: 300, h: 150 }, { x: 3920, y: 470, w: 320, h: 70 }, { x: 4540, y: 430, w: 720, h: 110 }],
    [{ x: 0, y: 490, w: 540, h: 50 }, { x: 720, y: 430, w: 230, h: 110 }, { x: 1100, y: 500, w: 240, h: 40 }, { x: 1500, y: 430, w: 230, h: 110 }, { x: 1900, y: 500, w: 240, h: 40 }, { x: 2340, y: 430, w: 240, h: 110 }, { x: 2900, y: 500, w: 250, h: 40 }, { x: 3540, y: 390, w: 270, h: 150 }, { x: 4540, y: 430, w: 720, h: 110 }],
    [{ x: 0, y: 470, w: 560, h: 70 }, { x: 760, y: 402, w: 240, h: 138 }, { x: 1180, y: 334, w: 220, h: 206 }, { x: 1600, y: 402, w: 240, h: 138 }, { x: 2040, y: 470, w: 260, h: 70 }, { x: 2560, y: 402, w: 240, h: 138 }, { x: 3080, y: 334, w: 220, h: 206 }, { x: 3660, y: 420, w: 280, h: 120 }, { x: 4540, y: 420, w: 720, h: 120 }],
    [{ x: 0, y: 485, w: 540, h: 55 }, { x: 700, y: 440, w: 220, h: 100 }, { x: 1060, y: 395, w: 210, h: 145 }, { x: 1420, y: 350, w: 200, h: 190 }, { x: 1800, y: 395, w: 210, h: 145 }, { x: 2200, y: 440, w: 220, h: 100 }, { x: 2780, y: 485, w: 250, h: 55 }, { x: 3420, y: 380, w: 270, h: 160 }, { x: 4540, y: 410, w: 720, h: 130 }],
    [{ x: 0, y: 470, w: 620, h: 70 }, { x: 820, y: 405, w: 280, h: 135 }, { x: 1300, y: 340, w: 260, h: 200 }, { x: 1820, y: 405, w: 280, h: 135 }, { x: 2380, y: 500, w: 300, h: 40 }, { x: 3060, y: 375, w: 300, h: 165 }, { x: 3700, y: 470, w: 320, h: 70 }, { x: 4540, y: 400, w: 720, h: 140 }],
  ],
};

const upperRouteFor = (biome: Biome, localIndex: number): Entity[] => {
  const temple = biome === "desert";
  const lift = biome === "storm" || biome === "void";
  const tight = biome === "shadow" || biome === "clockwork";
  const offset = localIndex * 8;
  if (temple) {
    return [
      { x: 690, y: 330 - offset, w: 130, h: 24 },
      { x: 1120, y: 270, w: 120, h: 24 },
      { x: 1530, y: 310, w: 145, h: 24 },
      { x: 2200, y: 250, w: 135, h: 24 },
      { x: 3020, y: 280, w: 145, h: 24 },
      { x: 3880, y: 250, w: 135, h: 24 },
    ];
  }
  if (lift) {
    return [
      { x: 640, y: 330, w: 115, h: 22 },
      { x: 980, y: 270, w: 110, h: 22 },
      { x: 1370, y: 210, w: 105, h: 22 },
      { x: 2020, y: 260, w: 120, h: 22 },
      { x: 2660, y: 205, w: 110, h: 22 },
      { x: 3440, y: 250, w: 120, h: 22 },
      { x: 4200, y: 220, w: 115, h: 22 },
    ];
  }
  return [
    { x: 650, y: 330 - offset, w: tight ? 118 : 150, h: 24 },
    { x: 1080, y: 285 + (localIndex % 2) * 18, w: tight ? 112 : 150, h: 24 },
    { x: 1560, y: 250, w: tight ? 106 : 145, h: 24 },
    { x: 2140, y: 300, w: tight ? 120 : 160, h: 24 },
    { x: 2760, y: 245 + offset, w: tight ? 112 : 150, h: 24 },
    { x: 3460, y: 285, w: tight ? 118 : 160, h: 24 },
    { x: 4140, y: 255, w: tight ? 112 : 145, h: 24 },
  ];
};

const applyBiomeVariation = (level: Level, stage: number) => {
  const worldIndex = worldIndexForStage(stage);
  const localIndex = localIndexForStage(stage);
  if (worldIndex < 2) return;

  const wave = worldIndex + localIndex;
  const authoredGrounds = biomeStageGrounds[level.biome as Exclude<Biome, "forest" | "ice">]?.[localIndex];
  if (authoredGrounds) {
    level.platforms = [...authoredGrounds, ...upperRouteFor(level.biome, localIndex)];
    level.bridges = [];
    level.water = [];
    level.hazards = [];
  } else {
    level.platforms = level.platforms.map((plat, index) =>
      index < 8
        ? {
            ...plat,
            y: Math.max(240, Math.min(515, plat.y + (index % 3 - 1) * (10 + worldIndex) + (localIndex % 2 === 0 ? -8 : 10))),
            w: Math.max(220, plat.w - worldIndex * 9 - localIndex * 6),
          }
        : { ...plat, y: Math.max(185, plat.y - worldIndex * 3 + (index % 2) * 12) },
    );
    level.bridges = level.bridges.map((bridge, index) => ({ ...bridge, y: bridge.y - 4 + (index % 2) * (8 + localIndex), w: Math.max(32, bridge.w - worldIndex) }));
    level.water = level.water.map((water, index) => ({
      ...water,
      y: water.y - 8,
      w: water.w + 10 + worldIndex * 5 + index * 3,
    }));
  }
  level.coins = level.platforms.slice(8, 16).map((plat, index) => ({ x: plat.x + plat.w / 2 - 11, y: plat.y - 42, w: 22, h: 22, pulse: index % 3 }));
  level.powerUps = [
    { x: 690, y: 250, w: 28, h: 28, kind: "fire" },
    { x: 2460, y: 285, w: 28, h: 28, kind: "fire" },
    { x: 3920, y: 250, w: 28, h: 28, kind: "fire" },
  ];
  level.lifePoints = [
    { x: 1120, y: 310 - localIndex * 8, w: 28, h: 28, pulse: 0 },
    { x: 2865, y: 310 - (worldIndex % 3) * 12, w: 28, h: 28, pulse: 1 },
    { x: 4620, y: 238, w: 28, h: 28, pulse: 2 },
  ];
  level.enemies = [
    makeEnemy(540, -1, 430, 730, false, 421),
    makeEnemy(1140, 1, 980, 1260, worldIndex >= 4, 381),
    makeEnemy(1710, -1, 1530, 1900, false, 447),
    makeEnemy(2320, 1, 2180, 2500, worldIndex >= 5, 370),
    makeEnemy(2920, -1, 2810, 3100, false, 442),
    makeEnemy(3510, 1, 3400, 3720, worldIndex >= 6, 350),
    makeEnemy(4710, -1, 4590, 5140, true, 397),
  ];
  if (worldIndex >= 3) level.enemies.push(makeEnemy(4050, wave % 2 ? 1 : -1, 3920, 4240, true, 456));
  level.flyingEnemies = [
    makeFlyingEnemy(920, 190 - worldIndex * 2, 1, 760, 1270),
    makeFlyingEnemy(1600, 205 - localIndex * 4, -1, 1440, 1910),
    makeFlyingEnemy(2360, 180, 1, 2120, 2620),
    makeFlyingEnemy(3260, 195 - worldIndex, -1, 3000, 3540),
    makeFlyingEnemy(4320, 185 - localIndex * 3, 1, 4040, 4680),
    makeFlyingEnemy(4900, 160, -1, 4620, 5180),
  ];
  if (worldIndex >= 5) level.flyingEnemies.push(makeFlyingEnemy(3680, 140, wave % 2 ? 1 : -1, 3320, 4120));
  if (level.biome === "volcano") {
    level.water = [
      { x: 620, y: 500, w: 210 + localIndex * 20, h: 40 },
      { x: 1120, y: 492, w: 210, h: 48 },
      { x: 1680, y: 504, w: 180 + localIndex * 18, h: 36 },
      { x: 2660, y: 492, w: 240, h: 48 },
      { x: 3800, y: 496, w: 250, h: 44 },
    ];
    level.hazards = [];
    level.intro = localIndex === 4 ? "Climb the lava core and face the Magma Golem" : level.intro;
  } else if (level.biome === "desert") {
    level.water = [];
    level.hazards = localIndex >= 2 ? [{ x: 1720, y: 500, w: 230, h: 40 }, { x: 3300, y: 500, w: 250, h: 40 }] : [];
    level.intro = localIndex === 4 ? "Enter the dry serpent pyramid" : level.intro;
  } else if (level.biome === "ocean") {
    level.water = [
      { x: 720, y: 486, w: 240 + worldIndex * 8, h: 54 },
      { x: 1280, y: 486, w: 260 + worldIndex * 6, h: 54 },
      { x: 1960, y: 490, w: 280, h: 50 },
      { x: 3000, y: 486, w: 310, h: 54 },
      { x: 4240, y: 492, w: 300, h: 48 },
    ];
    level.platforms.push({ x: 960, y: 300, w: 120, h: 22 }, { x: 1860, y: 270, w: 115, h: 22 }, { x: 2760, y: 300, w: 120, h: 22 }, { x: 3820, y: 270, w: 115, h: 22 });
  } else if (level.biome === "haunted") {
    level.water = localIndex === 1 ? [{ x: 560, y: 505, w: 150, h: 35 }, { x: 1380, y: 505, w: 160, h: 35 }, { x: 3060, y: 505, w: 160, h: 35 }] : [];
    level.hazards = localIndex >= 2 ? [{ x: 930, y: 502, w: 150, h: 38 }, { x: 2360, y: 502, w: 150, h: 38 }] : [];
  } else if (level.biome === "clockwork") {
    level.water = [];
    level.hazards = [{ x: 1000, y: 512, w: 160, h: 28 }, { x: 2620, y: 512, w: 150, h: 28 }, { x: 4180, y: 512, w: 160, h: 28 }];
  } else if (level.biome === "storm") {
    level.water = [];
    level.hazards = localIndex >= 1 ? [{ x: 1120, y: 500, w: 140, h: 40 }, { x: 2760, y: 500, w: 150, h: 40 }, { x: 3960, y: 500, w: 150, h: 40 }] : [];
  } else if (level.biome === "void") {
    level.water = [];
    level.hazards = [{ x: 560, y: 510, w: 180, h: 30 }, { x: 2520, y: 510, w: 190, h: 30 }, { x: 3980, y: 510, w: 210, h: 30 }];
  } else if (level.biome === "shadow") {
    level.water = [];
    level.hazards = [{ x: 620, y: 508, w: 180, h: 32 }, { x: 2000, y: 508, w: 190, h: 32 }, { x: 4020, y: 508, w: 180, h: 32 }];
  } else if (localIndex === 1) {
    level.water = [
      { x: 720, y: 486, w: 240 + worldIndex * 8, h: 54 },
      { x: 1280, y: 486, w: 260 + worldIndex * 6, h: 54 },
      { x: 1960, y: 490, w: 280, h: 50 },
      { x: 3000, y: 486, w: 310, h: 54 },
      { x: 4240, y: 492, w: 300, h: 48 },
    ];
  }
  if (localIndex === 2 || ["storm", "void"].includes(level.biome)) {
    level.platforms.push({ x: 1020, y: 260, w: 180, h: 24 }, { x: 2650, y: 260, w: 170, h: 24 }, { x: 4040, y: 285, w: 190, h: 24 });
  }
  if (localIndex === 3 || ["clockwork", "shadow"].includes(level.biome)) {
    level.platforms.push(
      { x: 1180, y: 240, w: 150, h: 24 },
      { x: 1510, y: 230, w: 160, h: 24 },
      { x: 2200, y: 235, w: 170, h: 24 },
      { x: 3920, y: 230, w: 170, h: 24 },
      { x: 4380, y: 245, w: 155, h: 24 },
    );
    level.coins.push({ x: 1220, y: 190, w: 22, h: 22, pulse: 1 }, { x: 3965, y: 185, w: 22, h: 22, pulse: 2 });
  }
  if (level.finalCastle) {
    if (level.biome === "volcano") {
      level.platforms.push(
        { x: 720, y: 430, w: 190, h: 24 },
        { x: 1160, y: 392, w: 180, h: 24 },
        { x: 1620, y: 438, w: 190, h: 24 },
      );
    }
    level.flyingEnemies.push(makeFlyingEnemy(1010, 145, 1, 760, 1360), makeFlyingEnemy(2140, 145, -1, 1840, 2520), makeFlyingEnemy(3540, 135, 1, 3260, 3920));
    level.enemies.push(makeEnemy(4380, 1, 4200, 4540, false, 397), makeEnemy(5000, -1, 4740, 5200, false, 397));
    level.goal = { x: 5050, y: 245, w: 175, h: 210 };
  }
};

const playablePlatforms = (level: Level) =>
  level.platforms
    .filter((platform) => platform.w >= 240 && platform.h >= 35 && platform.y <= 510)
    .sort((a, b) => a.x - b.x);

const supportPlatforms = (level: Level) =>
  level.platforms
    .filter((platform) => platform.w >= 95 && platform.y <= 510)
    .sort((a, b) => a.x - b.x);

const nearestPlatform = (platforms: Entity[], x: number) =>
  platforms.reduce((best, platform) => {
    const platformCenter = platform.x + platform.w / 2;
    const bestCenter = best.x + best.w / 2;
    return Math.abs(platformCenter - x) < Math.abs(bestCenter - x) ? platform : best;
  }, platforms[0]);

const intersects = (a: Entity, b: Entity, padding = 0) =>
  a.x < b.x + b.w + padding && a.x + a.w > b.x - padding && a.y < b.y + b.h + padding && a.y + a.h > b.y - padding;

const spreadOnPlatforms = <T extends Entity>(items: T[], platforms: Entity[], yOffset: number, inset = 28) =>
  items.map((item, index) => {
    const platform = platforms[(index * 3 + 1) % platforms.length];
    const slots = Math.max(2, Math.floor(platform.w / 115));
    const slot = index % slots;
    const usable = Math.max(20, platform.w - inset * 2 - item.w);
    const x = platform.x + inset + (usable * (slot + 0.5)) / slots;
    return { ...item, x, y: platform.y - yOffset };
  });

const removeCrowdedSmallPlatforms = (level: Level) => {
  const ground = playablePlatforms(level);
  level.platforms = level.platforms.filter((platform) => {
    if (platform.w >= 170 || platform.h >= 35) return true;
    return !ground.some((base) => platform.x + platform.w > base.x - 20 && platform.x < base.x + base.w + 20 && platform.y > base.y - 185);
  });
};

const filterFloatingBridges = (level: Level) => {
  const solids = playablePlatforms(level);
  level.bridges = level.bridges.filter((bridge) => {
    const left = solids.find((platform) => Math.abs(platform.x + platform.w - bridge.x) <= 90 && Math.abs(platform.y - bridge.y) <= 70);
    const right = solids.find((platform) => Math.abs(platform.x - (bridge.x + bridge.w)) <= 90 && Math.abs(platform.y - bridge.y) <= 70);
    return Boolean(left && right);
  });
};

const sanitizeHazardsAndFluids = (level: Level) => {
  level.hazards = level.hazards.filter((hazard) => !level.platforms.some((platform) => intersects(hazard, platform, -2)));
  level.water = level.water.filter((water) => !level.platforms.some((platform) => intersects(water, platform, -4)));
};

const sanitizeIceBossArena = (level: Level, stage: number) => {
  if (stage !== 9 || level.biome !== "ice" || !level.finalCastle) return;
  const arenaStart = 4260;
  const arenaGroundY = 430;
  const arenaGroundH = 110;
  level.water = level.water.filter((water) => water.x + water.w < arenaStart);
  level.hazards = level.hazards.filter((hazard) => hazard.x + hazard.w < arenaStart);
  level.platforms = level.platforms.filter((platform) => !(platform.x + platform.w > arenaStart && platform.y >= 470));
  level.platforms.push({ x: arenaStart, y: arenaGroundY, w: LEVEL_END - arenaStart + 80, h: arenaGroundH });
};

const enforceDedicatedBossArena = (level: Level) => {
  if (!level.finalCastle) return;
  const arenaLeft = BOSS_ARENA_LEFT - 160;
  const arenaRight = LEVEL_END + 120;
  const arenaGroundY = 430;
  // Forest boss uses strict ground-combat arena to avoid hovering/altitude desync.
  if (level.biome === "forest") {
    level.platforms = [{ x: arenaLeft, y: arenaGroundY, w: arenaRight - arenaLeft, h: 110 }];
  } else {
    level.platforms = [
      { x: arenaLeft, y: arenaGroundY, w: arenaRight - arenaLeft, h: 110 },
      { x: BOSS_ARENA_LEFT + 120, y: 318, w: 300, h: 24 },
      { x: BOSS_ARENA_LEFT + 600, y: 268, w: 320, h: 24 },
      { x: BOSS_ARENA_LEFT + 1060, y: 318, w: 300, h: 24 },
    ];
  }
  level.bridges = [];
  level.water = [];
  level.hazards = [];
  level.coins = [];
  level.powerUps = [];
  level.lifePoints = [];
  level.checkpoints = [{ x: BOSS_ARENA_LEFT + 34, y: arenaGroundY - 65, w: 42, h: 65 }];
  level.enemies = [];
  level.flyingEnemies = [];
  level.environmentProps = [];
  level.goal = { x: BOSS_ARENA_LEFT + 90, y: 225, w: 150, h: 205 };
  level.bossDiamond = undefined;
};

const sanitizeLevelOnePlainGround = (level: Level, stage: number) => {
  if (stage !== 0) return;
  const plainY = 470;
  const plainH = 70;
  level.water = [];
  level.hazards = [];
  level.bridges = [];
  // Keep upper gameplay route, replace fragmented bottom chunks with one continuous floor.
  level.platforms = level.platforms.filter((platform) => platform.y < 430);
  level.platforms.push({ x: 0, y: plainY, w: LEVEL_END + 120, h: plainH });
};

const snapStageActorsToGround = (level: Level) => {
  removeCrowdedSmallPlatforms(level);
  filterFloatingBridges(level);
  sanitizeHazardsAndFluids(level);
  const ground = playablePlatforms(level);
  if (!ground.length) return;
  const supports = supportPlatforms(level);

  level.checkpoints = level.checkpoints.map((point) => {
    const platform = nearestPlatform(ground, point.x + point.w / 2);
    const x = Math.max(platform.x + 18, Math.min(platform.x + platform.w - point.w - 18, point.x));
    return { ...point, x, y: platform.y - point.h };
  });

  const goalPlatform = nearestPlatform(ground, level.goal.x + level.goal.w / 2);
  level.goal = {
    ...level.goal,
    x: Math.max(goalPlatform.x + 24, Math.min(goalPlatform.x + goalPlatform.w - level.goal.w - 24, level.goal.x)),
    y: goalPlatform.y - level.goal.h,
  };

  level.enemies = level.enemies.map((enemy, index) => {
    const preferred = nearestPlatform(ground, enemy.x + enemy.w / 2);
    const platform = preferred.w >= 260 ? preferred : ground[index % ground.length];
    const patrolMin = platform.x + 18;
    const patrolMax = platform.x + platform.w - enemy.w - 18;
    const x = Math.max(patrolMin, Math.min(patrolMax, enemy.x));
    return {
      ...enemy,
      x,
      y: platform.y - enemy.h,
      patrolMin,
      patrolMax: Math.max(patrolMin + 140, patrolMax),
    };
  });

  if (supports.length) {
    const safeSupports = supports.filter((platform) => !level.hazards.some((hazard) => intersects(platform, hazard, 18)) && !level.water.some((water) => intersects(platform, water, 18)));
    const pickupSupports = safeSupports.length ? safeSupports : supports;
    level.coins = spreadOnPlatforms(level.coins, pickupSupports, 46, 24);
    level.powerUps = spreadOnPlatforms(level.powerUps, pickupSupports, 48, 34);
    level.lifePoints = spreadOnPlatforms(level.lifePoints, pickupSupports, 62, 36);
  }
};

const makeEnvironmentProps = (level: Level, stage: number): EnvironmentProp[] => {
  const assets = ENVIRONMENT_ASSETS[level.biome];
  const surfaces = playablePlatforms(level).filter((platform) => platform.w >= 280 && platform.y >= 385);
  if (!assets.length || !surfaces.length) return [];
  const props: EnvironmentProp[] = [];
  const count = Math.min(18, 8 + localIndexForStage(stage) * 2 + Math.floor(stage / 10));
  for (let index = 0; index < count; index += 1) {
    const platform = surfaces[(index * 2 + stage) % surfaces.length];
    const asset = assets[(index + stage + Math.floor(noise(stage * 4.7 + index) * assets.length)) % assets.length];
    const margin = 38 + (index % 3) * 20;
    if (platform.w <= asset.w + margin * 2) continue;
    const slotCount = Math.max(2, Math.floor(platform.w / 145));
    const slot = (index + stage) % slotCount;
    const usable = platform.w - margin * 2 - asset.w;
    const jitter = (noise(stage * 19.1 + index * 7.3) - 0.5) * Math.min(48, usable / slotCount);
    const x = platform.x + margin + (usable * (slot + 0.5)) / slotCount + jitter;
    const entity = { x, y: platform.y - asset.h, w: asset.w, h: asset.h };
    const crowded =
      level.checkpoints.some((point) => intersects(entity, point, 18)) ||
      level.enemies.some((enemy) => intersects(entity, enemy, 22)) ||
      level.powerUps.some((powerUp) => intersects(entity, powerUp, 18)) ||
      level.lifePoints.some((life) => intersects(entity, life, 18)) ||
      intersects(entity, level.goal, 28) ||
      props.some((prop) => intersects(entity, prop, 18));
    if (!crowded) {
      props.push({
        ...entity,
        src: asset.src,
        flip: noise(stage * 11.7 + index * 5.1) > 0.5,
        alpha: level.biome === "void" || level.biome === "shadow" ? 0.92 : 1,
      });
    }
  }
  return props;
};

const makeLevel = (stage = 0): Level => {
  const theme = WORLD_LEVELS[stage] ?? WORLD_LEVELS[0];
  const level: Level = {
  id: theme.id,
  name: theme.name,
  intro: theme.intro,
  biome: theme.biome,
  finalCastle: theme.finalCastle,
  skyTop: theme.skyTop,
  skyMid: theme.skyMid,
  groundTint: theme.groundTint,
  platforms: [
    { x: 0, y: 475, w: 760, h: 65 },
    { x: 900, y: 445, w: 420, h: 95 },
    { x: 1440, y: 505, w: 520, h: 35 },
    { x: 2120, y: 430, w: 440, h: 110 },
    { x: 2760, y: 500, w: 400, h: 40 },
    { x: 3360, y: 410, w: 400, h: 130 },
    { x: 3980, y: 500, w: 320, h: 40 },
    { x: 4540, y: 455, w: 720, h: 85 },
    { x: 270, y: 370, w: 175, h: 24 },
    { x: 625, y: 305, w: 185, h: 24 },
    { x: 1040, y: 360, w: 185, h: 24 },
    { x: 1345, y: 365, w: 120, h: 24 },
    { x: 1625, y: 405, w: 190, h: 24 },
    { x: 1945, y: 330, w: 175, h: 24 },
    { x: 2310, y: 335, w: 190, h: 24 },
    { x: 2605, y: 365, w: 135, h: 24 },
    { x: 2890, y: 405, w: 190, h: 24 },
    { x: 3190, y: 325, w: 150, h: 24 },
    { x: 3465, y: 305, w: 190, h: 24 },
    { x: 3775, y: 350, w: 165, h: 24 },
    { x: 4205, y: 375, w: 170, h: 24 },
    { x: 4465, y: 330, w: 135, h: 24 },
    { x: 4710, y: 305, w: 200, h: 24 },
    { x: 4995, y: 260, w: 150, h: 24 },
  ],
  bridges: [
    { x: 805, y: 452, w: 45, h: 18 },
    { x: 1355, y: 470, w: 45, h: 18 },
    { x: 2020, y: 464, w: 45, h: 18 },
    { x: 2655, y: 462, w: 42, h: 18 },
    { x: 3250, y: 456, w: 42, h: 18 },
    { x: 3850, y: 458, w: 42, h: 18 },
    { x: 4385, y: 478, w: 46, h: 18 },
  ],
  water: [
    { x: 760, y: 500, w: 140, h: 40 },
    { x: 1320, y: 490, w: 120, h: 50 },
    { x: 1960, y: 500, w: 160, h: 40 },
    { x: 2560, y: 490, w: 200, h: 50 },
    { x: 3160, y: 485, w: 200, h: 55 },
    { x: 3760, y: 485, w: 220, h: 55 },
    { x: 4300, y: 498, w: 240, h: 42 },
  ],
  coins: [
    { x: 315, y: 325, w: 22, h: 22, pulse: 0 },
    { x: 380, y: 325, w: 22, h: 22, pulse: 1 },
    { x: 680, y: 260, w: 22, h: 22, pulse: 2 },
    { x: 1090, y: 315, w: 22, h: 22, pulse: 1 },
    { x: 1180, y: 315, w: 22, h: 22, pulse: 0 },
    { x: 1385, y: 320, w: 22, h: 22, pulse: 2 },
    { x: 1685, y: 360, w: 22, h: 22, pulse: 1 },
    { x: 2005, y: 285, w: 22, h: 22, pulse: 0 },
    { x: 2375, y: 290, w: 22, h: 22, pulse: 2 },
    { x: 2650, y: 320, w: 22, h: 22, pulse: 0 },
    { x: 2945, y: 360, w: 22, h: 22, pulse: 1 },
    { x: 3235, y: 280, w: 22, h: 22, pulse: 2 },
    { x: 3520, y: 260, w: 22, h: 22, pulse: 0 },
    { x: 3835, y: 305, w: 22, h: 22, pulse: 1 },
    { x: 4250, y: 330, w: 22, h: 22, pulse: 2 },
    { x: 4520, y: 285, w: 22, h: 22, pulse: 0 },
    { x: 4780, y: 260, w: 22, h: 22, pulse: 1 },
    { x: 5050, y: 215, w: 22, h: 22, pulse: 2 },
  ],
  powerUps: [
    { x: 690, y: 262, w: 28, h: 28, kind: "fire" },
    { x: 3508, y: 267, w: 28, h: 28, kind: "fire" },
  ],
  lifePoints: [
    { x: 1220, y: 392, w: 28, h: 28, pulse: 0 },
    { x: 2860, y: 360, w: 28, h: 28, pulse: 1 },
    { x: 4740, y: 260, w: 28, h: 28, pulse: 2 },
  ],
  checkpoints: [
    { x: 1690, y: 440, w: 42, h: 65 },
    { x: 3515, y: 345, w: 42, h: 65 },
  ],
  enemies: [
    makeEnemy(550, -1, 460, 760),
    makeEnemy(1095, 1, 960, 1260, true, 401),
    makeEnemy(1255, -1, 990, 1280, true, 401),
    makeEnemy(1655, 1, 1500, 1900, false, 461),
    makeEnemy(1845, -1, 1540, 1920, true, 461),
    makeEnemy(2265, 1, 2180, 2500, true, 386),
    makeEnemy(2495, -1, 2200, 2520, true, 386),
    makeEnemy(2915, 1, 2810, 3100, true, 456),
    makeEnemy(3440, 1, 3400, 3710, true, 366),
    makeEnemy(3670, -1, 3410, 3720, false, 366),
    makeEnemy(4075, -1, 4020, 4240, true, 456),
    makeEnemy(4680, 1, 4590, 4930, true, 411),
    makeEnemy(4890, -1, 4610, 5130, true, 411),
    makeEnemy(5080, -1, 4810, 5190, true, 411),
  ],
  flyingEnemies: [
    makeFlyingEnemy(980, 230, 1, 930, 1290),
    makeFlyingEnemy(1560, 255, -1, 1450, 1880),
    makeFlyingEnemy(2230, 225, 1, 2140, 2520),
    makeFlyingEnemy(3030, 245, -1, 2820, 3330),
    makeFlyingEnemy(3630, 205, 1, 3400, 3890),
    makeFlyingEnemy(4330, 240, -1, 4110, 4520),
    makeFlyingEnemy(4860, 210, 1, 4620, 5140),
  ],
  hazards: [],
  environmentProps: [],
  goal: { x: 5080, y: 280, w: 140, h: 175 },
  bossDiamond: undefined,
  };

  if (stage === 1) {
    level.platforms = level.platforms.map((plat, index) => (index < 8 ? { ...plat, y: plat.y + (index % 2 === 0 ? -18 : 22), w: Math.max(220, plat.w - 80) } : { ...plat, y: plat.y - 12 }));
    level.water = level.water.map((water, index) => ({ ...water, w: water.w + 35 + index * 8 }));
    level.bridges = level.bridges.map((bridge) => ({ ...bridge, w: Math.max(34, bridge.w - 8) }));
    level.flyingEnemies.push(makeFlyingEnemy(720, 185, -1, 520, 840), makeFlyingEnemy(2700, 185, 1, 2500, 3040));
    level.coins.push({ x: 2580, y: 260, w: 22, h: 22, pulse: 1 }, { x: 3115, y: 275, w: 22, h: 22, pulse: 2 });
    level.lifePoints.push({ x: 1710, y: 360, w: 28, h: 28, pulse: 1 });
  }

  if (stage === 2) {
    level.platforms = level.platforms.map((plat, index) => (index < 8 ? { ...plat, y: Math.min(510, plat.y + 24), h: Math.max(35, plat.h - 14) } : { ...plat, y: plat.y + 18 }));
    level.water = [
      { x: 690, y: 498, w: 260, h: 42 },
      { x: 1280, y: 495, w: 210, h: 45 },
      { x: 1880, y: 500, w: 260, h: 40 },
      { x: 2490, y: 498, w: 290, h: 42 },
      { x: 3090, y: 492, w: 300, h: 48 },
      { x: 3710, y: 492, w: 300, h: 48 },
      { x: 4250, y: 498, w: 280, h: 42 },
    ];
    level.flyingEnemies = level.flyingEnemies.map((enemy) => ({ ...enemy, baseY: enemy.baseY + 28, y: enemy.y + 28 }));
    level.enemies.push(makeEnemy(980, 1, 920, 1260, false, 425), makeEnemy(3385, -1, 3370, 3720, false, 390));
    level.lifePoints.push({ x: 2020, y: 455, w: 28, h: 28, pulse: 2 }, { x: 3480, y: 350, w: 28, h: 28, pulse: 0 });
    level.intro = "Move carefully through the swamp fog";
  }

  if (stage === 3) {
    level.platforms.push(
      { x: 1160, y: 255, w: 160, h: 24 },
      { x: 1510, y: 245, w: 180, h: 24 },
      { x: 2220, y: 240, w: 170, h: 24 },
      { x: 3940, y: 260, w: 170, h: 24 },
      { x: 4360, y: 275, w: 165, h: 24 },
    );
    level.bridges.push({ x: 1720, y: 318, w: 54, h: 18 }, { x: 2460, y: 300, w: 52, h: 18 }, { x: 4145, y: 340, w: 50, h: 18 });
    level.enemies.push(makeEnemy(1195, 1, 1170, 1280, false, 211), makeEnemy(3980, -1, 3950, 4070, false, 216));
    level.flyingEnemies.push(makeFlyingEnemy(1745, 170, 1, 1500, 2020), makeFlyingEnemy(4050, 175, -1, 3820, 4410));
    level.coins.push({ x: 1220, y: 210, w: 22, h: 22, pulse: 0 }, { x: 3995, y: 215, w: 22, h: 22, pulse: 1 });
    level.lifePoints.push({ x: 1545, y: 200, w: 28, h: 28, pulse: 1 }, { x: 4365, y: 230, w: 28, h: 28, pulse: 2 });
    level.intro = "Find the upper route through the ruins";
  }

  if (stage === 4) {
    level.platforms = level.platforms.map((plat, index) => (index < 8 ? { ...plat, y: plat.y + (index % 2 ? -10 : 8) } : plat));
    level.flyingEnemies.push(
      makeFlyingEnemy(1120, 175, 1, 900, 1360),
      makeFlyingEnemy(2090, 170, -1, 1880, 2440),
      makeFlyingEnemy(3150, 170, 1, 2920, 3480),
      makeFlyingEnemy(4560, 165, -1, 4240, 4960),
    );
    level.enemies.push(makeEnemy(4230, 1, 4150, 4510, false, 411), makeEnemy(4980, -1, 4720, 5180, false, 411));
    level.lifePoints.push({ x: 3150, y: 280, w: 28, h: 28, pulse: 1 }, { x: 4920, y: 260, w: 28, h: 28, pulse: 2 });
    level.goal = { x: 5060, y: 250, w: 165, h: 205 };
    level.intro = "Break through the guarded castle gate";
  }

  if (stage >= 5 && stage <= 9) {
    const iceStage = stage - 5;
    level.platforms = level.platforms.map((plat, index) =>
      index < 8
        ? { ...plat, y: plat.y + (iceStage % 2 === 0 ? -10 : 14) + (index % 3 - 1) * 18, w: Math.max(230, plat.w - 40 - iceStage * 10) }
        : { ...plat, y: plat.y - 16 + (index % 2) * 26 },
    );
    level.bridges = level.bridges.map((bridge, index) => ({ ...bridge, y: bridge.y - 10 + (index % 2) * 16, w: Math.max(32, bridge.w - iceStage * 2) }));
    level.water = level.water.map((water, index) => ({ ...water, y: water.y - 8, w: water.w + 20 + iceStage * 12 + index * 4 }));
    level.coins = level.coins.map((coin, index) => ({ ...coin, y: coin.y - 10 + (index % 3) * 8 }));
    level.powerUps = [
      { x: 690, y: 250, w: 28, h: 28, kind: "fire" },
      { x: 2460, y: 285, w: 28, h: 28, kind: "fire" },
      { x: 3920, y: 250, w: 28, h: 28, kind: "fire" },
    ];
    level.lifePoints = [
      { x: 1120, y: 310, w: 28, h: 28, pulse: 0 },
      { x: 2865, y: 310, w: 28, h: 28, pulse: 1 },
      { x: 4620, y: 238, w: 28, h: 28, pulse: 2 },
    ];
    level.enemies = [
      makeEnemy(540, -1, 430, 730, false, 421),
      makeEnemy(1140, 1, 980, 1260, false, 381),
      makeEnemy(1710, -1, 1530, 1900, false, 447),
      makeEnemy(2320, 1, 2180, 2500, false, 370),
      makeEnemy(2920, -1, 2810, 3100, false, 442),
      makeEnemy(3510, 1, 3400, 3720, false, 350),
      makeEnemy(4710, -1, 4590, 5140, false, 397),
    ];
    level.flyingEnemies = [
      makeFlyingEnemy(920, 190, 1, 760, 1270),
      makeFlyingEnemy(1600, 205, -1, 1440, 1910),
      makeFlyingEnemy(2360, 180, 1, 2120, 2620),
      makeFlyingEnemy(3260, 195, -1, 3000, 3540),
      makeFlyingEnemy(4320, 185, 1, 4040, 4680),
      makeFlyingEnemy(4900, 160, -1, 4620, 5180),
    ];
    level.goal = stage === 9 ? { x: 5050, y: 245, w: 175, h: 210 } : { x: 5080, y: 286, w: 140, h: 170 };
  }

  if (stage === 6) {
    level.platforms.push({ x: 1020, y: 260, w: 180, h: 24 }, { x: 2650, y: 260, w: 170, h: 24 }, { x: 4040, y: 285, w: 190, h: 24 });
    level.water = [
      { x: 720, y: 486, w: 240, h: 54 },
      { x: 1280, y: 486, w: 260, h: 54 },
      { x: 1960, y: 490, w: 280, h: 50 },
      { x: 3000, y: 486, w: 310, h: 54 },
      { x: 4240, y: 492, w: 300, h: 48 },
    ];
    level.intro = "Frozen river gaps are wider here";
  }

  if (stage === 7) {
    level.platforms = level.platforms.map((plat, index) => ({ ...plat, y: plat.y + (index % 2 === 0 ? -24 : 18) }));
    level.flyingEnemies.push(makeFlyingEnemy(720, 150, 1, 520, 980), makeFlyingEnemy(2840, 145, -1, 2500, 3300), makeFlyingEnemy(3900, 150, 1, 3600, 4400));
    level.lifePoints.push({ x: 2220, y: 250, w: 28, h: 28, pulse: 1 });
    level.intro = "Blizzard winds hide the safest route";
  }

  if (stage === 8) {
    level.platforms.push(
      { x: 1180, y: 240, w: 150, h: 24 },
      { x: 1510, y: 230, w: 160, h: 24 },
      { x: 2200, y: 235, w: 170, h: 24 },
      { x: 3920, y: 230, w: 170, h: 24 },
      { x: 4380, y: 245, w: 155, h: 24 },
    );
    level.coins.push({ x: 1220, y: 190, w: 22, h: 22, pulse: 1 }, { x: 3965, y: 185, w: 22, h: 22, pulse: 2 });
    level.enemies.push(makeEnemy(1220, 1, 1190, 1300, false, 196), makeEnemy(3980, -1, 3940, 4060, false, 186));
    level.intro = "Use the crystal platforms to climb";
  }

  if (stage === 9) {
    level.flyingEnemies.push(makeFlyingEnemy(1010, 145, 1, 760, 1360), makeFlyingEnemy(2140, 145, -1, 1840, 2520), makeFlyingEnemy(3540, 135, 1, 3260, 3920));
    level.enemies.push(makeEnemy(4380, 1, 4200, 4540, false, 397), makeEnemy(5000, -1, 4740, 5200, false, 397));
  }
  applyBiomeVariation(level, stage);
  sanitizeLevelOnePlainGround(level, stage);
  snapStageActorsToGround(level);
  sanitizeIceBossArena(level, stage);
  enforceDedicatedBossArena(level);
  level.environmentProps = stage === 9 && level.biome === "ice" && level.finalCastle ? [] : makeEnvironmentProps(level, stage);

  return level;
};

const overlaps = (a: Entity, b: Entity) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export default function Home() {
  const enableNewCoreLoop = process.env.NEXT_PUBLIC_NEW_CORE_LOOP === "1";
  const coreLoop = useCoreLoop(enableNewCoreLoop);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const keys = useRef<Record<ButtonKey, boolean>>({ left: false, right: false, jump: false, kick: false, fire: false });
  const player = useRef<Player>(makePlayer());
  const level = useRef(makeLevel());
  const boss = useRef<Boss | null>(null);
  const projectiles = useRef<Projectile[]>([]);
  const bossProjectiles = useRef<BossProjectile[]>([]);
  const bossPillars = useRef<BossPillar[]>([]);
  const movingLifts = useRef<MovingLift[]>([]);
  const checkpoint = useRef({ x: 75, y: 260 });
  const currentLevel = useRef(0);
  const levelTransition = useRef(false);
  const loadingTimers = useRef<number[]>([]);
  const camera = useRef(0);
  const raf = useRef(0);
  const images = useRef<Partial<Record<AnimName, HTMLImageElement[]>>>({});
  const bossImages = useRef<Partial<Record<BossAnimName, HTMLImageElement[]>>>({});
  const frostBossImages = useRef<Partial<Record<BossAnimName, HTMLImageElement[]>>>({});
  const villainBossImages = useRef<Partial<Record<Biome, HTMLImageElement>>>({});
  const environmentImages = useRef<Record<string, HTMLImageElement>>({});
  const sounds = useRef<Partial<Record<SoundName, HTMLAudioElement>>>({});
  const music = useRef<HTMLAudioElement | null>(null);
  const musicSrc = useRef("");
  const audio = useRef<{ ctx: AudioContext; master: GainNode; music?: number; bossMusic?: number } | null>(null);
  const titleAudio = useRef<{ ctx: AudioContext; master: GainNode; music: number } | null>(null);
  const [hud, setHud] = useState({ coins: 0, lives: 3, message: "Reach the castle gate" });
  const hudRef = useRef(hud);
  const [assetsReady, setAssetsReady] = useState(false);
  const [won, setWon] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const [titleMusicOn, setTitleMusicOn] = useState(false);
  const [screen, setScreen] = useState<GameScreen>("menu");
  const [menuScreen, setMenuScreen] = useState<MenuScreen>("main");
  const [gameOver, setGameOver] = useState(false);
  const [hasProgress, setHasProgress] = useState(false);
  const [levelLabel, setLevelLabel] = useState(`${WORLD_LEVELS[0].id}: ${WORLD_LEVELS[0].name}`);
  const [loadingInfo, setLoadingInfo] = useState<LoadingInfo>({
    level: `${WORLD_LEVELS[0].id}: ${WORLD_LEVELS[0].name}`,
    world: WORLD_DEFINITIONS[0].name,
    status: "Preparing adventure",
    progress: 0,
    coins: 0,
    lives: 3,
    fire: 0,
    power: MAX_POWER,
  });

  useEffect(() => {
    hudRef.current = hud;
  }, [hud]);

  const beep = useCallback((frequency: number, duration: number, type: OscillatorType, volume = 0.1, slide = 0) => {
    const engine = audio.current;
    if (!engine) return;
    const now = engine.ctx.currentTime;
    const oscillator = engine.ctx.createOscillator();
    const gain = engine.ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    if (slide) oscillator.frequency.exponentialRampToValueAtTime(Math.max(40, frequency + slide), now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(engine.master);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }, []);

  const playSound = useCallback(
    (name: SoundName) => {
      if (name === "coin") {
        const source = sounds.current.coin;
        if (source) {
          const sound = source.cloneNode() as HTMLAudioElement;
          sound.volume = 0.5;
          sound.playbackRate = 1.18;
          void sound.play().catch(() => undefined);
        }
        beep(1320, 0.055, "sine", 0.075, 360);
        window.setTimeout(() => beep(1760, 0.07, "triangle", 0.055, 240), 42);
        window.setTimeout(() => beep(2360, 0.05, "sine", 0.04, -180), 92);
        return;
      }
      const source = sounds.current[name];
      if (source) {
        const sound = source.cloneNode() as HTMLAudioElement;
        sound.volume = name === "laser" ? 0.26 : 0.38;
        void sound.play().catch(() => undefined);
        return;
      }
      if (name === "jump") beep(420, 0.14, "square", 0.08, 320);
      if (name === "kick") beep(180, 0.09, "sawtooth", 0.09, -80);
      if (name === "hit") {
        beep(95, 0.12, "square", 0.11, -45);
        beep(520, 0.08, "triangle", 0.06, -150);
      }
      if (name === "hurt") beep(150, 0.22, "sawtooth", 0.1, -80);
      if (name === "laser") beep(980, 0.16, "sawtooth", 0.08, -520);
      if (name === "powerup" || name === "checkpoint") beep(740, 0.2, "triangle", 0.09, 280);
      if (name === "blood" || name === "lose") beep(120, 0.16, "square", 0.08, -40);
      if (name === "win") {
        [523, 659, 784, 1046].forEach((note, index) => window.setTimeout(() => beep(note, 0.14, "triangle", 0.08), index * 90));
      }
    },
    [beep],
  );

  const stopTitleMusic = useCallback(() => {
    const title = titleAudio.current;
    if (!title) return;
    window.clearInterval(title.music);
    void title.ctx.close();
    titleAudio.current = null;
    setTitleMusicOn(false);
  }, []);

  const stopBossMusic = useCallback(() => {
    const engine = audio.current;
    if (!engine?.bossMusic) return;
    window.clearInterval(engine.bossMusic);
    engine.bossMusic = undefined;
    if (music.current && soundOn) void music.current.play().catch(() => undefined);
  }, [soundOn]);

  const startBossMusic = useCallback(() => {
    const engine = audio.current;
    if (!engine || engine.bossMusic) return;
    if (music.current) music.current.pause();
    const bass = [82, 98, 110, 73];
    const lead = [330, 392, 370, 294, 330, 247];
    let step = 0;
    engine.bossMusic = window.setInterval(() => {
      beep(bass[step % bass.length], 0.18, "sawtooth", 0.075, -18);
      if (step % 2 === 0) beep(lead[(step / 2) % lead.length], 0.11, "square", 0.04, -55);
      if (step % 4 === 0) beep(55, 0.08, "square", 0.06);
      step += 1;
    }, 180);
  }, [beep]);

  const startTitleMusic = useCallback(() => {
    if (titleAudio.current) {
      void titleAudio.current.ctx.resume();
      setTitleMusicOn(true);
      return;
    }
    const AudioContextClass = window.AudioContext || (window as AudioWindow).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const master = ctx.createGain();
    master.gain.value = 0.12;
    master.connect(ctx.destination);
    const notes = [196, 247, 294, 330, 294, 247, 220, 262];
    let step = 0;
    const playTitleNote = () => {
      const now = ctx.currentTime;
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = step % 4 === 0 ? "triangle" : "sine";
      oscillator.frequency.setValueAtTime(notes[step % notes.length], now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.24, now + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);
      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start(now);
      oscillator.stop(now + 0.42);
      step += 1;
    };
    playTitleNote();
    titleAudio.current = { ctx, master, music: window.setInterval(playTitleNote, 360) };
    setTitleMusicOn(true);
  }, []);

  const setWorldMusic = useCallback((stage: number, playNow = soundOn) => {
    const nextSrc = WORLD_MUSIC[worldIndexForStage(stage)] ?? WORLD_MUSIC[0];
    if (!music.current) {
      const track = new Audio(nextSrc);
      track.loop = true;
      track.volume = 0.42;
      track.preload = "auto";
      music.current = track;
      musicSrc.current = nextSrc;
    } else if (musicSrc.current !== nextSrc) {
      music.current.pause();
      music.current.src = nextSrc;
      music.current.currentTime = 0;
      musicSrc.current = nextSrc;
    }
    if (playNow && !audio.current?.bossMusic) void music.current.play().catch(() => undefined);
  }, [soundOn]);

  const startAudio = useCallback(() => {
    stopTitleMusic();
    if (audio.current) {
      void audio.current.ctx.resume();
      setWorldMusic(currentLevel.current, true);
      setSoundOn(true);
      return;
    }

    Object.entries(AUDIO).forEach(([name, src]) => {
      if (name === "music") return;
      if (!sounds.current[name as SoundName]) {
        const sound = new Audio(src);
        sound.preload = "auto";
        sounds.current[name as SoundName] = sound;
      }
    });

    setWorldMusic(currentLevel.current, true);

    const AudioContextClass = window.AudioContext || (window as AudioWindow).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const master = ctx.createGain();
    master.gain.value = 0.28;
    master.connect(ctx.destination);
    audio.current = { ctx, master };
    setSoundOn(true);

    if (music.current) return;

    const melody = [523, 659, 784, 659, 587, 698, 880, 784, 659, 784, 988, 784, 698, 659, 587, 523];
    const harmony = [262, 330, 392, 330, 294, 349, 440, 349];
    let step = 0;
    audio.current.music = window.setInterval(() => {
      const note = melody[step % melody.length];
      beep(note, 0.18, "triangle", 0.04);
      if (step % 2 === 0) beep(harmony[(step / 2) % harmony.length], 0.13, "sine", 0.025);
      if (step % 4 === 0) beep(98, 0.07, "square", 0.028);
      step += 1;
    }, 245);
  }, [beep, setWorldMusic, stopTitleMusic]);

  const stopAudio = useCallback(() => {
    const engine = audio.current;
    if (engine) {
      if (engine.music) window.clearInterval(engine.music);
      if (engine.bossMusic) window.clearInterval(engine.bossMusic);
      void engine.ctx.close();
      audio.current = null;
    }
    if (music.current) {
      music.current.pause();
      music.current.currentTime = 0;
    }
    setSoundOn(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadImage = (src: string) =>
      new Promise<HTMLImageElement>((resolve) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => resolve(image);
        image.src = src;
      });

    Promise.all([
      ...(Object.keys(SPRITES) as AnimName[]).map(async (name) => {
        images.current[name] = await Promise.all(SPRITES[name].map(loadImage));
      }),
      ...(Object.keys(ROOT_GUARDIAN_SPRITES) as BossAnimName[]).map(async (name) => {
        bossImages.current[name] = await Promise.all(ROOT_GUARDIAN_SPRITES[name].map(loadImage));
      }),
      ...(Object.keys(FROST_WARDEN_SPRITES) as BossAnimName[]).map(async (name) => {
        frostBossImages.current[name] = await Promise.all(FROST_WARDEN_SPRITES[name].map(loadImage));
      }),
      ...(Object.keys(VILLAIN_BOSS_SPRITES) as Biome[]).map(async (biome) => {
        const sprite = VILLAIN_BOSS_SPRITES[biome];
        if (sprite) villainBossImages.current[biome] = await loadImage(sprite.src);
      }),
      ...Array.from(new Set(Object.values(ENVIRONMENT_ASSETS).flatMap((items) => items.map((item) => item.src)))).map(async (src) => {
        environmentImages.current[src] = await loadImage(src);
      }),
    ]).then(() => {
      if (!cancelled) setAssetsReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const loadLevel = useCallback((stage: number, keepProgress = true) => {
    stopBossMusic();
    setGameOver(false);
    const nextStage = Math.max(0, Math.min(WORLD_LEVELS.length - 1, stage));
    const nextLevel = makeLevel(nextStage);
    const previousFire = player.current.fire;
    const previousLives = hudRef.current.lives;
    const previousCoins = hudRef.current.coins;
    currentLevel.current = nextStage;
    level.current = nextLevel;
    boss.current = nextLevel.finalCastle ? makeBoss(nextLevel.biome) : null;
    player.current = { ...makePlayer(), fire: keepProgress ? previousFire : 0 };
    projectiles.current = [];
    bossProjectiles.current = [];
    bossPillars.current = [];
    movingLifts.current = [];
    if (nextStage === 11) {
      // 3.2 Cinder Bridges: moving lifts for long-gap traversal.
      movingLifts.current = [
        { x: 860, y: 452, w: 126, h: 18, minX: 760, maxX: 1200, speed: 1.35, dir: 1 },
        { x: 2050, y: 468, w: 126, h: 18, minX: 1860, maxX: 2400, speed: 1.55, dir: -1 },
        { x: 3380, y: 444, w: 126, h: 18, minX: 3220, maxX: 3760, speed: 1.42, dir: 1 },
      ];
      setHud((value) => ({ ...value, message: "Ride the moving lifts to cross the lava gaps." }));
    }
    checkpoint.current = { x: 75, y: 260 };
    if (nextLevel.finalCastle) checkpoint.current = { x: BOSS_ARENA_LEFT + 30, y: 260 };
    player.current.x = checkpoint.current.x;
    player.current.y = checkpoint.current.y;
    camera.current = 0;
    if (nextLevel.finalCastle) camera.current = BOSS_ARENA_LEFT - 120;
    levelTransition.current = false;
    setWon(false);
    setLevelLabel(`${nextLevel.id}: ${nextLevel.name}`);
    setHud({ coins: keepProgress ? previousCoins : 0, lives: keepProgress ? previousLives : 3, message: nextLevel.intro });
    setWorldMusic(nextStage);
  }, [setWorldMusic, stopBossMusic]);

  const clearLoadingTimers = useCallback(() => {
    loadingTimers.current.forEach((timer) => window.clearTimeout(timer));
    loadingTimers.current = [];
  }, []);

  const startLevelLoading = useCallback(
    (stage: number, keepProgress = true) => {
      clearLoadingTimers();
      setGameOver(false);
      const nextStage = Math.max(0, Math.min(WORLD_LEVELS.length - 1, stage));
      const nextLevel = WORLD_LEVELS[nextStage] ?? WORLD_LEVELS[0];
      const world = WORLD_DEFINITIONS[worldIndexForStage(nextStage)] ?? WORLD_DEFINITIONS[0];
      keys.current = { left: false, right: false, jump: false, kick: false, fire: false };
      setWon(false);
      setScreen("loading");
      setLoadingInfo({
        level: `${nextLevel.id}: ${nextLevel.name}`,
        world: world.name,
        status: "Saving current score",
        progress: 18,
        coins: keepProgress ? hudRef.current.coins : 0,
        lives: keepProgress ? hudRef.current.lives : 3,
        fire: keepProgress ? player.current.fire : 0,
        power: player.current.power,
      });
      loadingTimers.current = [
        window.setTimeout(() => setLoadingInfo((value) => ({ ...value, status: "Preparing world assets", progress: 48 })), 280),
        window.setTimeout(() => setLoadingInfo((value) => ({ ...value, status: "Placing enemies and platforms", progress: 74 })), 620),
        window.setTimeout(() => {
          loadLevel(nextStage, keepProgress);
          setLoadingInfo((value) => ({ ...value, status: "Ready", progress: 100 }));
        }, 980),
        window.setTimeout(() => {
          setScreen("playing");
          loadingTimers.current = [];
        }, 1240),
      ];
    },
    [clearLoadingTimers, loadLevel],
  );

  const restart = useCallback(() => {
    setGameOver(false);
    startAudio();
    setHasProgress(true);
    startLevelLoading(0, false);
  }, [startAudio, startLevelLoading]);

  const restartLevel = useCallback(() => {
    setGameOver(false);
    startAudio();
    startLevelLoading(currentLevel.current, false);
  }, [startAudio, startLevelLoading]);

  const startNewGame = useCallback(() => {
    restart();
  }, [restart]);

  const continueGame = useCallback(() => {
    if (!hasProgress) return;
    startAudio();
    startLevelLoading(currentLevel.current, true);
  }, [hasProgress, startAudio, startLevelLoading]);

  const startSelectedLevel = useCallback(
    (stage: number) => {
      startAudio();
      setHasProgress(true);
      startLevelLoading(stage, false);
    },
    [startAudio, startLevelLoading],
  );

  const returnToMenu = useCallback(() => {
    clearLoadingTimers();
    setGameOver(false);
    keys.current = { left: false, right: false, jump: false, kick: false, fire: false };
    stopAudio();
    setScreen("menu");
    setMenuScreen("main");
    startTitleMusic();
  }, [clearLoadingTimers, startTitleMusic, stopAudio]);

  const toggleTitleMusic = useCallback(() => {
    if (titleAudio.current) {
      stopTitleMusic();
      return;
    }
    startTitleMusic();
  }, [startTitleMusic, stopTitleMusic]);

  const toggleAudio = useCallback(() => {
    if (audio.current) {
      stopAudio();
      return;
    }
    startAudio();
  }, [startAudio, stopAudio]);

  const loseLife = useCallback(() => {
    const p = player.current;
    const nextLives = Math.max(0, hudRef.current.lives - 1);
    const previousFire = p.fire;
    const shouldGameOver = nextLives === 0;
    playSound(shouldGameOver ? "lose" : "hurt");
    setGameOver(shouldGameOver);
    setHud((value) => ({
      ...value,
      lives: nextLives,
      message: shouldGameOver
        ? "Game over. Restart level or quit to menu."
        : `Careful. ${nextLives} heart${nextLives === 1 ? "" : "s"} left.`,
    }));
    if (shouldGameOver) {
      p.dead = 1;
      p.deadFall = !p.grounded;
      p.vx = 0;
      p.vy = p.deadFall ? Math.max(2, p.vy) : 0;
      p.attack = 0;
      p.hurt = 0;
      p.fireCooldown = 0;
      p.longJump = 0;
      p.freeze = 0;
      p.dropping = 0;
      p.grounded = !p.deadFall;
    } else {
      player.current = {
        ...makePlayer(),
        x: checkpoint.current.x,
        y: checkpoint.current.y,
        fire: previousFire,
        hurt: 70,
      };
    }
    keys.current = { left: false, right: false, jump: false, kick: false, fire: false };
    projectiles.current = [];
  }, [playSound]);

  const dropAndRespawn = useCallback(() => {
    loseLife();
  }, [loseLife]);

  const damagePlayer = useCallback(
    (amount = ENEMY_DAMAGE, sourceX?: number) => {
      const p = player.current;
      if (p.hurt > 0 || p.dropping > 0 || p.dead > 0) return;
      p.power = Math.max(0, p.power - amount);
      p.hurt = 48;
      const playerCenter = p.x + p.w / 2;
      const knockbackDir = sourceX === undefined ? -p.face : playerCenter < sourceX ? -1 : 1;
      p.vx = knockbackDir * 9.5;
      p.vy = -9;
      p.grounded = false;
      playSound("hurt");
      if (p.power <= 0) {
        dropAndRespawn();
        return;
      }
      setHud((value) => ({ ...value, message: `Power decreased to ${p.power}` }));
    },
    [dropAndRespawn, playSound],
  );

  useEffect(() => {
    const setKey = (key: ButtonKey, value: boolean) => {
      keys.current[key] = value;
    };
    const resetKeys = () => {
      keys.current = { left: false, right: false, jump: false, kick: false, fire: false };
    };
    const down = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const controlKey = ["arrowleft", "arrowright", "arrowup", " ", "a", "d", "w", "k", "x", "f", "c", "r", "m"].includes(key);
      if (controlKey) event.preventDefault();

      if (screen === "menu") {
        if (key === "enter" || key === " ") startNewGame();
        if (key === "c") continueGame();
        if (key === "m" && !event.repeat) toggleTitleMusic();
        return;
      }
      if (screen === "playing" && gameOver) {
        if (key === "r" && !event.repeat) restartLevel();
        if (key === "escape" || key === "q") returnToMenu();
        return;
      }
      if (screen === "loading") {
        if (key === "r" && !event.repeat) restart();
        return;
      }

      if (["arrowleft", "a"].includes(key)) setKey("left", true);
      if (["arrowright", "d"].includes(key)) setKey("right", true);
      if (["arrowup", "w", " "].includes(key)) {
        setKey("jump", true);
        startAudio();
      }
      if (["k", "x"].includes(key)) {
        setKey("kick", true);
        startAudio();
      }
      if (["f", "c"].includes(key)) {
        setKey("fire", true);
        startAudio();
      }
      if (key === "r" && !event.repeat) restart();
      if (key === "m" && !event.repeat) toggleAudio();
    };
    const up = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (["arrowleft", "a"].includes(key)) setKey("left", false);
      if (["arrowright", "d"].includes(key)) setKey("right", false);
      if (["arrowup", "w", " "].includes(key)) setKey("jump", false);
      if (["k", "x"].includes(key)) setKey("kick", false);
      if (["f", "c"].includes(key)) setKey("fire", false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", resetKeys);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", resetKeys);
    };
  }, [continueGame, gameOver, restart, restartLevel, returnToMenu, screen, startAudio, startNewGame, toggleAudio, toggleTitleMusic]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const drawRect = (x: number, y: number, w: number, h: number, color: string) => {
      ctx.fillStyle = color;
      ctx.fillRect(Math.round(x - camera.current), Math.round(y), w, h);
    };
    const drawSprite = (anim: AnimName, frame: number, x: number, y: number, w: number, h: number, face = 1, freezeLastFrame = false) => {
      const loadedFrames = images.current[anim]?.filter((image) => image.complete && image.naturalWidth);
      const image = loadedFrames?.[freezeLastFrame ? loadedFrames.length - 1 : frame % loadedFrames.length];
      if (!image) return false;

      ctx.save();
      if (face < 0) {
        ctx.translate(Math.round(x - camera.current + w), Math.round(y));
        ctx.scale(-1, 1);
        ctx.drawImage(image, 0, 0, w, h);
      } else {
        ctx.drawImage(image, Math.round(x - camera.current), Math.round(y), w, h);
      }
      ctx.restore();
      return true;
    };
    const drawEnvironmentProp = (prop: EnvironmentProp) => {
      const image = environmentImages.current[prop.src];
      if (!image?.complete || !image.naturalWidth) return false;
      const x = Math.round(prop.x - camera.current);
      if (x > WIDTH + 80 || x + prop.w < -80) return true;
      ctx.save();
      ctx.globalAlpha = prop.alpha ?? 1;
      if (prop.flip) {
        ctx.translate(x + prop.w, Math.round(prop.y));
        ctx.scale(-1, 1);
        ctx.drawImage(image, 0, 0, prop.w, prop.h);
      } else {
        ctx.drawImage(image, x, Math.round(prop.y), prop.w, prop.h);
      }
      ctx.restore();
      return true;
    };
    const drawBossSprite = (source: Partial<Record<BossAnimName, HTMLImageElement[]>>, anim: BossAnimName, frame: number, x: number, y: number, w: number, h: number, face = 1, frameStep = 7, freezeLastFrame = false, forcedFrameIndex?: number) => {
      const loadedFrames = source[anim]?.filter((image) => image.complete && image.naturalWidth);
      const frameIndex =
        forcedFrameIndex !== undefined && loadedFrames
          ? Math.max(0, Math.min(loadedFrames.length - 1, Math.floor(forcedFrameIndex)))
          : freezeLastFrame && loadedFrames
            ? loadedFrames.length - 1
            : loadedFrames
              ? Math.floor(frame / frameStep) % loadedFrames.length
              : 0;
      const image = loadedFrames?.[frameIndex];
      if (!image) return false;

      ctx.save();
      if (face < 0) {
        ctx.translate(Math.round(x + w), Math.round(y));
        ctx.scale(-1, 1);
        ctx.drawImage(image, 0, 0, w, h);
      } else {
        ctx.drawImage(image, Math.round(x), Math.round(y), w, h);
      }
      ctx.restore();
      return true;
    };
    const drawCoin = (coin: Coin, frame: number) => {
      const shimmer = 1 + Math.sin(frame * 0.35 + (coin.pulse ?? 0)) * 0.18;
      ctx.save();
      ctx.translate(Math.round(coin.x + 11 - camera.current), Math.round(coin.y + 11));
      ctx.scale(shimmer, 1);
      ctx.fillStyle = "#ffd34e";
      ctx.beginPath();
      ctx.ellipse(0, 0, 11, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#9d6b00";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,.55)";
      ctx.fillRect(-4, -8, 3, 16);
      ctx.restore();
    };
    const drawLifePoint = (life: LifePoint, frame: number) => {
      const beat = 1 + Math.sin(frame * 0.38 + (life.pulse ?? 0)) * 0.12;
      const x = life.x + life.w / 2 - camera.current;
      const y = life.y + life.h / 2;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(beat, beat);
      ctx.fillStyle = "rgba(255,255,255,.28)";
      ctx.beginPath();
      ctx.arc(0, 1, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ff4d58";
      ctx.beginPath();
      ctx.moveTo(0, 14);
      ctx.bezierCurveTo(-28, -5, -10, -24, 0, -10);
      ctx.bezierCurveTo(10, -24, 28, -5, 0, 14);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.55)";
      ctx.beginPath();
      ctx.ellipse(-7, -8, 5, 8, -0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };
    const drawBossDiamond = (diamond: BossDiamond, frame: number) => {
      const pulse = 1 + Math.sin(frame * 0.25 + diamond.pulse) * 0.08;
      const x = diamond.x + diamond.w / 2 - camera.current;
      const y = diamond.y + diamond.h / 2 + Math.sin(frame * 0.16 + diamond.pulse) * 5;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(pulse, pulse);
      ctx.fillStyle = "rgba(119,255,232,.22)";
      ctx.beginPath();
      ctx.arc(0, 0, 25, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#7dffe8";
      ctx.beginPath();
      ctx.moveTo(0, -24);
      ctx.lineTo(20, -4);
      ctx.lineTo(0, 26);
      ctx.lineTo(-20, -4);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,.72)";
      ctx.beginPath();
      ctx.moveTo(0, -18);
      ctx.lineTo(8, -4);
      ctx.lineTo(0, 8);
      ctx.lineTo(-8, -4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };
    const drawCloud = (x: number, y: number, scale: number) => {
      ctx.save();
      ctx.translate(Math.round(x - camera.current * 0.24), y);
      ctx.scale(scale, scale);
      ctx.fillStyle = "rgba(255,255,255,.92)";
      ctx.beginPath();
      ctx.ellipse(0, 16, 34, 18, 0, 0, Math.PI * 2);
      ctx.ellipse(32, 10, 30, 22, 0, 0, Math.PI * 2);
      ctx.ellipse(66, 18, 38, 18, 0, 0, Math.PI * 2);
      ctx.ellipse(38, -4, 24, 20, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(210,235,255,.42)";
      ctx.fillRect(-18, 22, 112, 7);
      ctx.restore();
    };
    const drawBird = (x: number, y: number, scale: number, frame: number) => {
      const flap = Math.sin(frame * 0.55 + x * 0.02) * 5;
      ctx.save();
      ctx.translate(Math.round(x - camera.current * 0.16), y);
      ctx.scale(scale, scale);
      ctx.strokeStyle = "rgba(31, 55, 71, .78)";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-14, 0);
      ctx.quadraticCurveTo(-5, -9 - flap, 0, 0);
      ctx.quadraticCurveTo(7, -9 + flap, 16, 0);
      ctx.stroke();
      ctx.restore();
    };
    const drawBalloon = (x: number, y: number, scale: number, color: string, frame: number) => {
      const screenX = Math.round(x - camera.current * 0.11);
      const bob = Math.sin(frame * 0.08 + x) * 5;
      ctx.save();
      ctx.translate(screenX, y + bob);
      ctx.scale(scale, scale);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(0, 0, 18, 24, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.35)";
      ctx.beginPath();
      ctx.ellipse(-6, -9, 5, 10, -0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(36,45,48,.55)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, 23);
      ctx.lineTo(-5, 43);
      ctx.moveTo(0, 23);
      ctx.lineTo(5, 43);
      ctx.stroke();
      ctx.fillStyle = "#8d542c";
      ctx.fillRect(-7, 42, 14, 9);
      ctx.restore();
    };
    const drawFlyingEnemy = (enemy: FlyingEnemy, frame: number) => {
      const x = enemy.x - camera.current;
      if (!enemy.alive) {
        const progress = 1 - Math.max(0, Math.min(1, enemy.dead / 34));
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - progress);
        for (let i = 0; i < 9; i += 1) {
          const angle = i * 0.7;
          const distance = 8 + progress * (20 + i * 2);
          const puffX = x + enemy.w / 2 + Math.cos(angle) * distance;
          const puffY = enemy.y + enemy.h / 2 + Math.sin(angle) * distance * 0.65;
          const radius = 7 + noise(enemy.x + i) * 8 + progress * 7;
          ctx.fillStyle = i % 2 === 0 ? "rgba(244, 248, 255, .78)" : "rgba(183, 208, 222, .62)";
          ctx.beginPath();
          ctx.arc(puffX, puffY, radius, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
        return;
      }
      const wing = Math.sin(frame * 0.9 + enemy.flap) * 9;
      ctx.save();
      ctx.translate(x + enemy.w / 2, enemy.y + enemy.h / 2);
      if (enemy.dir < 0) ctx.scale(-1, 1);
      ctx.fillStyle = enemy.hurt > 0 ? "#ff78a5" : "#5b3377";
      ctx.beginPath();
      ctx.ellipse(0, 2, 17, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#2e1d44";
      ctx.beginPath();
      ctx.moveTo(-8, 0);
      ctx.quadraticCurveTo(-30, -18 - wing, -38, 2);
      ctx.quadraticCurveTo(-24, 10, -8, 7);
      ctx.closePath();
      ctx.moveTo(8, 0);
      ctx.quadraticCurveTo(30, -18 + wing, 38, 2);
      ctx.quadraticCurveTo(24, 10, 8, 7);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#f4f7ff";
      ctx.beginPath();
      ctx.arc(7, -3, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#111";
      ctx.beginPath();
      ctx.arc(9, -3, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#d94735";
      ctx.beginPath();
      ctx.moveTo(16, 1);
      ctx.lineTo(27, 5);
      ctx.lineTo(16, 9);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };
    const drawTree = (x: number, y: number, scale: number) => {
      const screenX = Math.round(x - camera.current * 0.58);
      ctx.save();
      ctx.translate(screenX, y);
      ctx.scale(scale, scale);
      ctx.fillStyle = "#8d542c";
      ctx.fillRect(-11, -64, 22, 64);
      ctx.fillStyle = "#6d3f21";
      ctx.fillRect(3, -58, 5, 55);
      ctx.fillStyle = "#2f8f49";
      ctx.beginPath();
      ctx.ellipse(-22, -72, 34, 30, 0, 0, Math.PI * 2);
      ctx.ellipse(18, -82, 38, 34, 0, 0, Math.PI * 2);
      ctx.ellipse(0, -112, 34, 31, 0, 0, Math.PI * 2);
      ctx.ellipse(42, -55, 28, 24, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#44b55d";
      ctx.beginPath();
      ctx.ellipse(-10, -92, 20, 17, 0, 0, Math.PI * 2);
      ctx.ellipse(30, -76, 19, 15, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };
    const drawGrassTuft = (x: number, y: number, height: number, tint = "#2f8f49") => {
      ctx.strokeStyle = tint;
      ctx.lineWidth = 1.5 + noise(x * 0.17) * 1.2;
      ctx.beginPath();
      ctx.moveTo(x - camera.current, y);
      ctx.lineTo(x + 3 + noise(x) * 5 - camera.current, y - height);
      ctx.lineTo(x + 8 - camera.current, y - noise(x * 1.9) * 3);
      ctx.moveTo(x + 5 - camera.current, y + 1);
      ctx.lineTo(x + 10 + noise(x * 2.3) * 6 - camera.current, y - height * (0.5 + noise(x * 0.61) * 0.55));
      if (height > 12) {
        ctx.moveTo(x + 2 - camera.current, y);
        ctx.lineTo(x - 4 + noise(x * 3.1) * 7 - camera.current, y - height * 0.7);
      }
      ctx.stroke();
    };
    const drawGrassCap = (plat: Entity, biome: Level["biome"]) => {
      const start = Math.floor(plat.x / 12) * 12;
      const end = plat.x + plat.w;
      const style = biomeStyle(biome);
      if (biome === "ice") {
        ctx.fillStyle = "#7fa6ba";
        ctx.fillRect(plat.x - camera.current, plat.y + 19, plat.w, 7);
      }
      ctx.fillStyle = style.cap;
      ctx.beginPath();
      ctx.moveTo(plat.x - camera.current, plat.y + 22);
      for (let x = start; x <= end + 12; x += 10) {
        const clampedX = Math.max(plat.x, Math.min(end, x));
        const roughY = plat.y + 2 + noise(x * 0.08) * 12 + Math.sin(x * 0.045) * 3;
        ctx.lineTo(clampedX - camera.current, roughY);
      }
      ctx.lineTo(end - camera.current, plat.y + 24);
      ctx.lineTo(plat.x - camera.current, plat.y + 24);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = style.shine;
      for (let x = plat.x + 5; x < end; x += 18) {
        const bladeY = plat.y + 5 + noise(x * 0.13) * 8;
        ctx.fillRect(x - camera.current, bladeY, 9 + noise(x * 0.47) * 18, 2);
      }

      for (let x = plat.x + 8; x < end; x += 18 + noise(x * 0.19) * 16) {
        const height = 7 + noise(x * 0.31) * 16;
        const color = noise(x * 0.53) > 0.55 ? style.grassA : style.grassB;
        drawGrassTuft(x, plat.y + 5 + noise(x * 0.41) * 6, height, color);
      }
    };
    const drawPlatformDirt = (plat: Entity, biome: Level["biome"]) => {
      const start = Math.floor(plat.x / 16) * 16;
      const end = plat.x + plat.w;
      const style = biomeStyle(biome);
      ctx.fillStyle = style.dirt;
      ctx.beginPath();
      ctx.moveTo(plat.x - camera.current, plat.y + plat.h);
      ctx.lineTo(plat.x - camera.current, plat.y + 12);
      for (let x = start; x <= end + 16; x += 16) {
        const clampedX = Math.max(plat.x, Math.min(end, x));
        const roughY = plat.y + 10 + noise(x * 0.11) * 14 + Math.sin(x * 0.033) * 4;
        ctx.lineTo(clampedX - camera.current, roughY);
      }
      ctx.lineTo(end - camera.current, plat.y + plat.h);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = style.stone;
      for (let x = plat.x + 8; x < end; x += 20) {
        const stoneY = plat.y + 28 + noise(x * 0.29) * Math.max(12, plat.h - 40);
        ctx.fillRect(x - camera.current, stoneY, 7 + noise(x * 0.7) * 15, 3 + noise(x * 0.9) * 5);
      }
    };
    const drawWaterfallSprite = (water: Entity, frame: number, platforms: Entity[], biome: Level["biome"]) => {
      const x = water.x - camera.current;
      const leftSource = platforms.find((plat) => Math.abs(plat.x + plat.w - water.x) < 70);
      const rightSource = platforms.find((plat) => Math.abs(plat.x - (water.x + water.w)) < 70);
      const sourceY = Math.min(leftSource?.y ?? water.y, rightSource?.y ?? water.y);
      const fallTop = sourceY + 6;
      const fallBottom = water.y + water.h + 18;
      const fallHeight = fallBottom - fallTop;
      const tileHeight = 34;
      const isLava = biome === "volcano";
      const hasDropSource = Boolean((leftSource || rightSource) && sourceY + 58 < water.y);
      const drawPoolOnly = () => {
        const poolY = water.y + water.h / 2;
        const poolGradient = ctx.createRadialGradient(x + water.w / 2, poolY, 8, x + water.w / 2, poolY, water.w * 0.68);
        poolGradient.addColorStop(0, isLava ? "rgba(255, 232, 84, .78)" : "rgba(235, 253, 255, .62)");
        poolGradient.addColorStop(0.45, isLava ? "rgba(255, 92, 31, .72)" : "rgba(76, 190, 231, .5)");
        poolGradient.addColorStop(1, isLava ? "rgba(83, 17, 13, .2)" : "rgba(12, 87, 137, .14)");
        ctx.fillStyle = poolGradient;
        ctx.beginPath();
        ctx.ellipse(x + water.w / 2, poolY, water.w * 0.48, Math.max(10, water.h * 0.34), 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = isLava ? "rgba(255, 225, 90, .68)" : "rgba(242,253,255,.62)";
        ctx.lineWidth = 2;
        for (let i = 12; i < water.w; i += 34) {
          ctx.beginPath();
          ctx.ellipse(x + i + ((frame * 2) % 18), poolY - 3 + (i % 3), 16, 4, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      };

      if (!hasDropSource) {
        drawPoolOnly();
        return;
      }

      ctx.save();
      ctx.beginPath();
      ctx.rect(x, fallTop, water.w, fallHeight);
      ctx.clip();

      const backGradient = ctx.createLinearGradient(0, fallTop, 0, fallBottom);
      backGradient.addColorStop(0, isLava ? "rgba(255, 212, 76, .9)" : "rgba(157, 229, 255, .72)");
      backGradient.addColorStop(0.42, isLava ? "rgba(255, 102, 38, .94)" : "rgba(50, 166, 221, .88)");
      backGradient.addColorStop(1, isLava ? "rgba(128, 31, 24, .96)" : "rgba(13, 83, 132, .96)");
      ctx.fillStyle = backGradient;
      ctx.fillRect(x, fallTop, water.w, fallHeight);

      ctx.fillStyle = isLava ? "rgba(66, 18, 16, .36)" : "rgba(4, 33, 57, .24)";
      ctx.fillRect(x, fallTop, 10, fallHeight);
      ctx.fillRect(x + water.w - 10, fallTop, 10, fallHeight);

      for (let column = 0; column < water.w; column += 18) {
        const columnSeed = water.x * 0.021 + column;
        const ribbonX = x + column + noise(columnSeed) * 8 - 4;
        const ribbonW = 6 + noise(columnSeed * 1.7) * 13;
        const speed = 3 + Math.floor(noise(columnSeed * 2.1) * 4);
        const offset = (frame * speed + column * 3) % tileHeight;

        for (let y = fallTop - tileHeight; y < fallBottom; y += tileHeight) {
          const tileY = y + offset;
          const shade = noise((tileY + columnSeed) * 0.19);
          ctx.fillStyle = isLava
            ? shade > 0.62
              ? "rgba(255, 231, 83, .82)"
              : "rgba(255, 90, 32, .52)"
            : shade > 0.62
              ? "rgba(238, 252, 255, .72)"
              : "rgba(126, 219, 255, .38)";
          ctx.beginPath();
          ctx.moveTo(ribbonX, tileY);
          ctx.bezierCurveTo(ribbonX + ribbonW * 0.8, tileY + 8, ribbonX - ribbonW * 0.25, tileY + 18, ribbonX + ribbonW, tileY + tileHeight);
          ctx.lineTo(ribbonX + ribbonW + 5, tileY + tileHeight);
          ctx.bezierCurveTo(ribbonX + ribbonW * 0.4, tileY + 19, ribbonX + ribbonW * 1.25, tileY + 8, ribbonX + 4, tileY);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = isLava ? "rgba(255, 243, 132, .46)" : "rgba(255, 255, 255, .36)";
          ctx.fillRect(ribbonX + ribbonW * 0.55, tileY + 5, 2, 12 + shade * 10);
        }
      }

      for (let i = 0; i < 18; i += 1) {
        const mistX = x + noise(water.x * 0.13 + i) * water.w;
        const mistY = water.y + 16 + ((frame * 2 + i * 17) % 58);
        const radius = 2 + noise(i * 9.3 + water.x) * 5;
        ctx.fillStyle = isLava ? `rgba(255, 132, 40, ${0.18 + noise(i * 2.4) * 0.22})` : `rgba(226, 249, 255, ${0.16 + noise(i * 2.4) * 0.2})`;
        ctx.beginPath();
        ctx.arc(mistX, mistY, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      ctx.fillStyle = isLava ? "rgba(55, 16, 14, .58)" : "rgba(14, 47, 58, .45)";
      ctx.fillRect(x - 5, fallTop + 8, 7, fallHeight - 8);
      ctx.fillRect(x + water.w - 2, fallTop + 8, 7, fallHeight - 8);

      ctx.fillStyle = isLava ? "rgba(255, 224, 80, .88)" : "rgba(241, 253, 255, .82)";
      ctx.beginPath();
      for (let i = 0; i <= water.w; i += 18) {
        const crestY = fallTop - 3 + Math.sin((frame + i) * 0.35) * 3;
        if (i === 0) ctx.moveTo(x + i, crestY);
        else ctx.lineTo(x + i, crestY);
      }
      ctx.lineTo(x + water.w, fallTop + 10);
      ctx.lineTo(x, fallTop + 10);
      ctx.closePath();
      ctx.fill();

      const poolY = water.y + water.h - 5;
      const poolGradient = ctx.createRadialGradient(x + water.w / 2, poolY, 8, x + water.w / 2, poolY, water.w * 0.72);
      poolGradient.addColorStop(0, isLava ? "rgba(255, 237, 94, .82)" : "rgba(238, 253, 255, .7)");
      poolGradient.addColorStop(0.36, isLava ? "rgba(255, 91, 30, .7)" : "rgba(76, 190, 231, .58)");
      poolGradient.addColorStop(1, isLava ? "rgba(83, 17, 13, .18)" : "rgba(12, 87, 137, .12)");
      ctx.fillStyle = poolGradient;
      ctx.beginPath();
      ctx.ellipse(x + water.w / 2, poolY, water.w * 0.62, 20, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = isLava ? "rgba(255, 232, 92, .68)" : "rgba(255, 255, 255, .58)";
      ctx.lineWidth = 2;
      for (let i = 0; i < water.w; i += 24) {
        ctx.beginPath();
        ctx.ellipse(x + i + ((frame * 3) % 24), poolY - 12, 14, 4, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    };
    const drawCastle = (goal: Entity) => {
      const x = goal.x - camera.current;
      const y = goal.y;
      ctx.fillStyle = "#b8bec9";
      ctx.fillRect(x, y + 42, goal.w, goal.h - 42);
      ctx.fillStyle = "#8e97a6";
      ctx.fillRect(x + 10, y + 55, goal.w - 20, 12);
      ctx.fillRect(x + 10, y + 92, goal.w - 20, 12);
      ctx.fillStyle = "#d5dae2";
      ctx.fillRect(x - 28, y + 8, 42, goal.h - 8);
      ctx.fillRect(x + goal.w - 14, y + 8, 42, goal.h - 8);
      ctx.fillStyle = "#7d8797";
      for (let i = 0; i < 4; i += 1) {
        ctx.fillRect(x + 12 + i * 31, y + 42, 16, 16);
      }
      ctx.fillStyle = "#546173";
      ctx.fillRect(x + 42, y + 95, 56, 80);
      ctx.beginPath();
      ctx.arc(x + 70, y + 96, 28, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = "#f2c75c";
      ctx.fillRect(x + 63, y - 35, 12, 42);
      ctx.fillStyle = "#f05c4f";
      ctx.beginPath();
      ctx.moveTo(x + 75, y - 34);
      ctx.lineTo(x + 124, y - 18);
      ctx.lineTo(x + 75, y - 4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#9a4350";
      ctx.beginPath();
      ctx.moveTo(x - 34, y + 8);
      ctx.lineTo(x - 7, y - 38);
      ctx.lineTo(x + 20, y + 8);
      ctx.closePath();
      ctx.moveTo(x + goal.w - 20, y + 8);
      ctx.lineTo(x + goal.w + 7, y - 38);
      ctx.lineTo(x + goal.w + 34, y + 8);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#394457";
      ctx.fillRect(x - 14, y + 45, 14, 30);
      ctx.fillRect(x + goal.w, y + 45, 14, 30);
    };
    const drawBossHealth = (bossState: Boss) => {
      const style = biomeStyle(bossState.biome);
      ctx.fillStyle = "rgba(0,0,0,.55)";
      ctx.fillRect(300, 64, 360, 18);
      ctx.fillStyle = style.bossHead;
      ctx.fillRect(304, 68, Math.max(0, (bossState.health / bossState.maxHealth) * 352), 10);
      ctx.strokeStyle = "rgba(255,255,255,.6)";
      ctx.strokeRect(300, 64, 360, 18);
      ctx.fillStyle = "#fff";
      ctx.font = "800 16px Arial";
      ctx.textAlign = "center";
      ctx.fillText(style.boss, 480, 58);
      ctx.textAlign = "left";
    };
    const drawBoss = (bossState: Boss, frame: number, playerX: number) => {
      if (!bossState.active) return;
      const x = bossState.x - camera.current;
      const defeatedPose = bossState.phase === "defeated";
      const hovering = !defeatedPose && (bossState.phase === "jumping" || bossState.phase === "entering");
      const y = bossState.y + (hovering ? Math.sin(frame * 0.18) * 2 : 0);
      const renderFace = defeatedPose ? bossState.face : bossFacing(bossState, playerX);
      const weak = bossState.vulnerable > 0;
      const drawDownloadedVillain = () => {
        const sprite = VILLAIN_BOSS_SPRITES[bossState.biome];
        const image = villainBossImages.current[bossState.biome];
        if (!sprite || !image?.complete || !image.naturalWidth) return false;
        const drawX = x + bossState.w / 2 - sprite.w / 2;
        const drawY = y + bossState.h - sprite.h + sprite.y;
        const face = renderFace;
        ctx.save();
        ctx.globalAlpha = 1;
        ctx.imageSmoothingEnabled = false;
        if (face < 0) {
          ctx.translate(drawX + sprite.w, drawY);
          ctx.scale(-1, 1);
          ctx.drawImage(image, 0, 0, sprite.w, sprite.h);
        } else {
          ctx.drawImage(image, drawX, drawY, sprite.w, sprite.h);
        }
        ctx.restore();
        drawBossHealth(bossState);
        return true;
      };
      if (bossState.biome === "forest") {
        const forcedFrame = bossState.phase === "defeated" ? bossState.deathFrame : undefined;
        const clawing = bossState.meleeWindup > 0;
        const forestBossGrounded =
          bossState.phase !== "jumping" &&
          bossState.phase !== "entering" &&
          Math.abs(bossState.y - bossState.groundY) <= 1.5;
        const forestMoveIntent = Math.abs((bossState.targetX ?? bossState.x) - bossState.x);
        const stationaryForestBoss = Math.abs(bossState.vx) < 0.08 && forestMoveIntent < 14 && forestBossGrounded && bossState.hurt <= 0;
        const forestShouldRun = bossState.phase === "chasing" && forestBossGrounded && bossState.hurt <= 0 && !clawing && (Math.abs(bossState.vx) > 0.06 || forestMoveIntent >= 14);
        const anim: BossAnimName =
          bossState.phase === "defeated"
            ? "dead"
            : bossState.hurt > 0
              ? "hurt"
              : bossState.phase === "jumping" || bossState.phase === "entering"
                ? "jump"
                : bossState.phase === "clawing" || clawing || bossState.slam > 0
                  ? "attack"
                : stationaryForestBoss
                  ? "idle"
                : weak
                  ? bossState.slam > 0
                    ? "slam"
                    : "attack"
                  : forestShouldRun
                    ? "run"
                    : "idle";
        // Use slower cadence for long 30+ frame strips to avoid jitter and repeated micro-motions.
        const forestFrameStep =
          anim === "idle"
            ? 3
            : anim === "run"
              ? 2
              : anim === "jump"
                ? 2
                : anim === "attack" || anim === "slam"
                  ? 2
                  : anim === "hurt"
                    ? 2
                    : 3;
        ctx.save();
        ctx.globalAlpha = 1;
        const drewBoss = drawBossSprite(
          bossImages.current,
          anim,
          frame,
          x + FOREST_BOSS_DRAW_X_OFFSET,
          y + FOREST_BOSS_DRAW_Y_OFFSET,
          FOREST_BOSS_DRAW_W,
          FOREST_BOSS_DRAW_H,
          renderFace,
          forestFrameStep,
          bossState.phase === "defeated" && forcedFrame === undefined,
          forcedFrame,
        );
        ctx.restore();
        if (drewBoss) {
          drawBossHealth(bossState);
          return;
        }
      }
      // World 2 (ice) boss intentionally avoids sprite-sheet rendering.
      if (drawDownloadedVillain()) return;
      if (bossState.biome === "ice") {
        ctx.save();
        ctx.globalAlpha = 1;
        const centerX = x + bossState.w / 2;
        const isHurtPose = bossState.hurt > 0;
        const isAttackPose = bossState.phase === "jumping" || bossState.slam > 0;
        const poseLean = isAttackPose ? (renderFace < 0 ? -10 : 10) : isHurtPose ? (renderFace < 0 ? 7 : -7) : 0;
        const armSwing = isAttackPose ? 16 : isHurtPose ? 12 : 7;
        const icePulse = 1 + Math.sin(frame * 0.14) * 0.05;
        const bodyY = y + (isAttackPose ? 16 : isHurtPose ? 24 : 20);
        const bodyH = 122;
        const aura = ctx.createRadialGradient(centerX, y + 82, 14, centerX, y + 82, 96);
        aura.addColorStop(0, weak ? "rgba(204,255,255,.34)" : "rgba(140,220,255,.24)");
        aura.addColorStop(1, "rgba(120,205,255,0)");
        ctx.fillStyle = aura;
        ctx.beginPath();
        ctx.ellipse(centerX, y + 84, 108, 84, 0, 0, Math.PI * 2);
        ctx.fill();

        const torso = ctx.createLinearGradient(0, bodyY, 0, bodyY + bodyH);
        torso.addColorStop(0, isHurtPose ? "#f7ffff" : "#effcff");
        torso.addColorStop(0.45, isHurtPose ? "#b3ecff" : "#9edcf7");
        torso.addColorStop(1, isHurtPose ? "#63b7df" : "#4b95c0");
        ctx.fillStyle = torso;
        ctx.beginPath();
        ctx.roundRect(centerX - 42 + poseLean * 0.25, bodyY + 12, 84, bodyH, 28);
        ctx.fill();

        ctx.fillStyle = "#d5f4ff";
        ctx.beginPath();
        ctx.moveTo(centerX - 48 + poseLean * 0.25, bodyY + 14);
        ctx.lineTo(centerX - 82, bodyY + 44);
        ctx.lineTo(centerX - 46 + poseLean * 0.2, bodyY + 56);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(centerX + 48 + poseLean * 0.25, bodyY + 14);
        ctx.lineTo(centerX + 82, bodyY + 44);
        ctx.lineTo(centerX + 46 + poseLean * 0.2, bodyY + 56);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = "#c6efff";
        ctx.beginPath();
        ctx.ellipse(centerX + poseLean * 0.5, y + 28, 44, 30, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#79c0dd";
        ctx.beginPath();
        ctx.ellipse(centerX + poseLean * 0.5, y + 30, 30, 20, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(226,252,255,.95)";
        ctx.beginPath();
        ctx.moveTo(centerX - 18 + poseLean * 0.5, y + 8);
        ctx.lineTo(centerX - 38, y - 18);
        ctx.lineTo(centerX - 8 + poseLean * 0.5, y + 2);
        ctx.closePath();
        ctx.moveTo(centerX + 18 + poseLean * 0.5, y + 8);
        ctx.lineTo(centerX + 38, y - 18);
        ctx.lineTo(centerX + 8 + poseLean * 0.5, y + 2);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = "#0d3a52";
        ctx.beginPath();
        ctx.arc(centerX - 14 + poseLean * 0.5, y + 30, 5, 0, Math.PI * 2);
        ctx.arc(centerX + 14 + poseLean * 0.5, y + 30, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(11,58,79,.85)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(centerX - 12 + poseLean * 0.5, y + 44);
        ctx.lineTo(centerX + 12 + poseLean * 0.5, y + (isHurtPose ? 41 : 44));
        ctx.stroke();

        ctx.fillStyle = weak ? "#f5ffff" : "#8ef0ff";
        ctx.beginPath();
        ctx.ellipse(centerX + poseLean * 0.25, y + 86, 16 * icePulse, 21 * icePulse, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,.9)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(centerX + poseLean * 0.25, y + 64);
        ctx.lineTo(centerX + 12 + poseLean * 0.25, y + 86);
        ctx.lineTo(centerX + poseLean * 0.25, y + 108);
        ctx.lineTo(centerX - 12 + poseLean * 0.25, y + 86);
        ctx.closePath();
        ctx.stroke();

        ctx.fillStyle = "#9cdcf4";
        ctx.beginPath();
        ctx.roundRect(centerX - 56, y + 124, 26, 36, 8);
        ctx.roundRect(centerX + 30, y + 124, 26, 36, 8);
        ctx.fill();

        ctx.strokeStyle = "rgba(214,247,255,.95)";
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.moveTo(centerX - 24 + poseLean * 0.3, y + 62);
        ctx.lineTo(centerX - 66 - Math.sin(frame * 0.16) * armSwing + poseLean * 0.35, y + (isAttackPose ? 98 : 104));
        ctx.moveTo(centerX + 24 + poseLean * 0.3, y + 62);
        ctx.lineTo(centerX + 66 + Math.sin(frame * 0.16) * armSwing + poseLean * 0.35, y + (isAttackPose ? 98 : 104));
        ctx.stroke();
        ctx.fillStyle = "rgba(226,252,255,.9)";
        ctx.beginPath();
        ctx.moveTo(centerX - 74, y + 92);
        ctx.lineTo(centerX - 92, y + 114);
        ctx.lineTo(centerX - 64, y + 110);
        ctx.closePath();
        ctx.moveTo(centerX + 74, y + 92);
        ctx.lineTo(centerX + 92, y + 114);
        ctx.lineTo(centerX + 64, y + 110);
        ctx.closePath();
        ctx.fill();

        drawBossHealth(bossState);
        ctx.restore();
        return;
      }
      ctx.save();
      const style = biomeStyle(bossState.biome);
      ctx.globalAlpha = 1;
      ctx.fillStyle = style.bossBody;
      ctx.beginPath();
      ctx.ellipse(x + bossState.w / 2, y + 68, 54, 68, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = style.bossHead;
      ctx.beginPath();
      ctx.ellipse(x + 36, y + 22, 32, 32, 0, 0, Math.PI * 2);
      ctx.ellipse(x + 82, y + 24, 34, 34, 0, 0, Math.PI * 2);
      ctx.ellipse(x + 58, y + 8, 40, 30, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = weak ? "rgba(214,248,255,.95)" : style.bossCore;
      ctx.beginPath();
      ctx.ellipse(x + bossState.w / 2, y + 70, weak ? 20 : 13, weak ? 24 : 15, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#111";
      ctx.beginPath();
      ctx.arc(x + 42, y + 48, 5, 0, Math.PI * 2);
      ctx.arc(x + 76, y + 48, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = style.bossStroke;
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.moveTo(x + 12, y + 82);
      ctx.lineTo(x - 20, y + 118 + Math.sin(frame * 0.3) * 8);
      ctx.moveTo(x + bossState.w - 12, y + 82);
      ctx.lineTo(x + bossState.w + 22, y + 118 - Math.sin(frame * 0.3) * 8);
      ctx.stroke();
      drawBossHealth(bossState);
      ctx.restore();
    };
    const drawForestExit = (goal: Entity, levelId: string) => {
      const x = goal.x - camera.current;
      const y = goal.y;
      ctx.fillStyle = "#8d542c";
      ctx.fillRect(x + 18, y + 48, 18, goal.h - 48);
      ctx.fillRect(x + goal.w - 36, y + 48, 18, goal.h - 48);
      ctx.fillStyle = "#5f351e";
      ctx.fillRect(x + 6, y + 58, goal.w - 12, 18);
      ctx.fillRect(x + 10, y + 92, goal.w - 20, 16);
      ctx.fillStyle = "#2f8f49";
      ctx.beginPath();
      ctx.ellipse(x + 28, y + 48, 34, 26, 0, 0, Math.PI * 2);
      ctx.ellipse(x + goal.w - 28, y + 46, 36, 28, 0, 0, Math.PI * 2);
      ctx.ellipse(x + goal.w / 2, y + 30, 48, 34, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#44b55d";
      ctx.beginPath();
      ctx.ellipse(x + goal.w / 2 - 22, y + 28, 18, 14, 0, 0, Math.PI * 2);
      ctx.ellipse(x + goal.w / 2 + 26, y + 40, 22, 15, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#f2c75c";
      ctx.fillRect(x + 30, y + 82, goal.w - 60, 34);
      ctx.strokeStyle = "#6d3f21";
      ctx.lineWidth = 3;
      ctx.strokeRect(x + 30, y + 82, goal.w - 60, 34);
      ctx.fillStyle = "#3a2a20";
      ctx.font = "800 16px Arial";
      ctx.textAlign = "center";
      ctx.fillText(levelId === "1.4" ? "CASTLE" : "NEXT", x + goal.w / 2, y + 105);
      ctx.textAlign = "left";
      ctx.fillStyle = "rgba(22, 14, 9, .35)";
      ctx.beginPath();
      ctx.ellipse(x + goal.w / 2, y + goal.h - 4, goal.w * 0.38, 8, 0, 0, Math.PI * 2);
      ctx.fill();
    };
    const drawBloodBurst = (enemy: Enemy) => {
      if (enemy.blood <= 0) return;
      const centerX = enemy.x + enemy.w / 2 - camera.current;
      const baseY = enemy.y + enemy.h - 4;
      const strength = Math.min(1, enemy.blood / 30);
      ctx.save();
      ctx.globalAlpha = 0.35 + strength * 0.55;
      ctx.fillStyle = "#b20f22";
      ctx.beginPath();
      ctx.ellipse(centerX, baseY, 28 + strength * 10, 6 + strength * 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#e21d32";
      for (let i = 0; i < 8; i += 1) {
        const angle = i * 0.78;
        const distance = 12 + i * 3 + strength * 14;
        const x = centerX + Math.cos(angle) * distance;
        const y = baseY - 18 + Math.sin(angle) * 12 - strength * (i % 3) * 9;
        ctx.beginPath();
        ctx.ellipse(x, y, 3 + (i % 3), 4 + (i % 2), 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    };
    const drawHudIcon = (x: number, y: number, type: "coin" | "heart" | "fire" | "sound") => {
      ctx.save();
      ctx.translate(x, y);
      if (type === "coin") {
        ctx.fillStyle = "#ffd34e";
        ctx.beginPath();
        ctx.ellipse(0, 0, 12, 15, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#9d6b00";
        ctx.stroke();
      }
      if (type === "heart") {
        ctx.fillStyle = "#ff4d58";
        ctx.beginPath();
        ctx.moveTo(0, 12);
        ctx.bezierCurveTo(-26, -6, -8, -20, 0, -8);
        ctx.bezierCurveTo(8, -20, 26, -6, 0, 12);
        ctx.fill();
      }
      if (type === "sound") {
        ctx.fillStyle = soundOn ? "#7af0a5" : "#d7e6ee";
        ctx.fillRect(-13, -8, 8, 16);
        ctx.beginPath();
        ctx.moveTo(-5, -9);
        ctx.lineTo(8, -17);
        ctx.lineTo(8, 17);
        ctx.lineTo(-5, 9);
        ctx.closePath();
        ctx.fill();
      }
      if (type === "fire") {
        ctx.fillStyle = "#ffef6e";
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ff6b35";
        ctx.beginPath();
        ctx.moveTo(0, -10);
        ctx.bezierCurveTo(12, -2, 5, 12, 0, 12);
        ctx.bezierCurveTo(-9, 7, -3, -2, 0, -10);
        ctx.fill();
      }
      ctx.restore();
    };
    const drawFallbackHero = (p: Player) => {
      if (p.attack > 0) drawRect(p.x + (p.face > 0 ? p.w - 2 : -28), p.y + 19, 30, 17, "#f7c08a");
      drawRect(p.x, p.y + 16, p.w, p.h - 16, p.hurt % 8 < 4 ? "#e9414f" : "#265bd6");
      drawRect(p.x + 8, p.y, p.w - 16, 24, "#f4b37a");
      drawRect(p.x + (p.face > 0 ? 26 : 10), p.y + 9, 7, 7, "#111");
      drawRect(p.x + 6, p.y + p.h - 8, 13, 8, "#242424");
      drawRect(p.x + 25, p.y + p.h - 8, 13, 8, "#242424");
    };
    const drawScreenRect = (x: number, y: number, w: number, h: number, color: string) => {
      ctx.fillStyle = color;
      ctx.fillRect(Math.round(x), Math.round(y), w, h);
    };
    const drawScreenCircle = (x: number, y: number, radius: number, color: string) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(Math.round(x), Math.round(y), radius, 0, Math.PI * 2);
      ctx.fill();
    };
    const parallaxX = (worldX: number, factor: number, span = 1600) => ((worldX - camera.current * factor) % span) - 180;
    const drawCrystalCluster = (x: number, y: number, scale: number, color: string) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(scale, scale);
      ctx.fillStyle = color;
      [0, 1, 2].forEach((_, index) => {
        const offset = (index - 1) * 24;
        const height = 58 - index * 10;
        ctx.beginPath();
        ctx.moveTo(offset, -height);
        ctx.lineTo(offset + 15, -18);
        ctx.lineTo(offset + 7, 0);
        ctx.lineTo(offset - 14, -12);
        ctx.closePath();
        ctx.fill();
      });
      ctx.fillStyle = "rgba(255,255,255,.36)";
      ctx.fillRect(-5, -48, 5, 32);
      ctx.restore();
    };
    const drawGear = (x: number, y: number, radius: number, frame: number, color: string) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(frame * 0.01 + x * 0.002);
      ctx.fillStyle = color;
      for (let tooth = 0; tooth < 10; tooth += 1) {
        ctx.rotate((Math.PI * 2) / 10);
        ctx.fillRect(radius - 4, -5, 15, 10);
      }
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(55,45,35,.45)";
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.42, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };
    const drawBiomeBackdrop = (map: Level, frame: number) => {
      if (map.biome === "forest") return;
      if (map.biome === "ice") {
        ctx.fillStyle = "rgba(223,247,255,.58)";
        for (let i = 0; i < 6; i += 1) {
          const x = parallaxX(i * 310, 0.13, 1900);
          ctx.beginPath();
          ctx.moveTo(x, 390);
          ctx.lineTo(x + 150, 155 + (i % 2) * 35);
          ctx.lineTo(x + 320, 390);
          ctx.closePath();
          ctx.fill();
        }
        drawScreenRect(parallaxX(760, 0.18, 1800), 210, 130, 155, "rgba(207,239,250,.72)");
        drawScreenRect(parallaxX(795, 0.18, 1800), 165, 60, 72, "rgba(235,252,255,.78)");
        drawCrystalCluster(parallaxX(420, 0.28), 420, 0.85, "rgba(143,222,255,.72)");
        drawCrystalCluster(parallaxX(1160, 0.28), 430, 0.62, "rgba(207,248,255,.78)");
      }
      if (map.biome === "volcano") {
        const glow = ctx.createRadialGradient(460, 360, 20, 460, 360, 360);
        glow.addColorStop(0, "rgba(255,117,45,.38)");
        glow.addColorStop(1, "rgba(255,117,45,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
        for (let i = 0; i < 5; i += 1) {
          const x = parallaxX(i * 410, 0.16, 2100);
          ctx.fillStyle = i % 2 ? "rgba(66,36,35,.58)" : "rgba(48,32,32,.62)";
          ctx.beginPath();
          ctx.moveTo(x - 110, 410);
          ctx.lineTo(x + 95, 170 + (i % 2) * 44);
          ctx.lineTo(x + 295, 410);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = "rgba(255,103,40,.78)";
          ctx.beginPath();
          ctx.moveTo(x + 80, 205 + (i % 2) * 44);
          ctx.lineTo(x + 118, 310);
          ctx.lineTo(x + 66, 310);
          ctx.closePath();
          ctx.fill();
        }
      }
      if (map.biome === "desert") {
        ctx.fillStyle = "rgba(255,224,149,.42)";
        for (let i = 0; i < 5; i += 1) {
          const x = parallaxX(i * 420, 0.1, 2100);
          ctx.beginPath();
          ctx.ellipse(x + 180, 410, 260, 52 + (i % 2) * 18, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        const templeX = parallaxX(680, 0.2, 1700);
        ctx.fillStyle = "rgba(155,103,48,.55)";
        ctx.beginPath();
        ctx.moveTo(templeX, 380);
        ctx.lineTo(templeX + 150, 210);
        ctx.lineTo(templeX + 300, 380);
        ctx.closePath();
        ctx.fill();
        for (let i = 0; i < 5; i += 1) drawScreenRect(templeX + 34 + i * 46, 305, 20, 75, "rgba(116,78,43,.5)");
      }
      if (map.biome === "haunted") {
        for (let i = 0; i < 8; i += 1) {
          const x = parallaxX(i * 260, 0.22, 2100);
          ctx.strokeStyle = "rgba(31,28,48,.62)";
          ctx.lineWidth = 13;
          ctx.beginPath();
          ctx.moveTo(x, 440);
          ctx.bezierCurveTo(x - 22, 340, x + 52, 300, x + 25, 220);
          ctx.stroke();
          ctx.lineWidth = 7;
          ctx.beginPath();
          ctx.moveTo(x + 18, 290);
          ctx.lineTo(x - 52, 250);
          ctx.moveTo(x + 22, 270);
          ctx.lineTo(x + 86, 230);
          ctx.stroke();
        }
        for (let i = 0; i < 6; i += 1) drawScreenRect(parallaxX(i * 330 + 120, 0.35), 405, 28, 38, "rgba(185,194,201,.42)");
      }
      if (map.biome === "clockwork") {
        for (let i = 0; i < 7; i += 1) {
          const x = parallaxX(i * 210, 0.14, 1600);
          drawScreenRect(x, 230 - (i % 3) * 34, 112, 210, "rgba(83,69,54,.48)");
          drawScreenRect(x + 18, 210 - (i % 3) * 34, 34, 38, "rgba(189,143,57,.46)");
        }
        drawGear(parallaxX(360, 0.24), 185, 38, frame, "rgba(205,151,55,.55)");
        drawGear(parallaxX(850, 0.2), 285, 52, frame, "rgba(117,95,70,.55)");
        drawGear(parallaxX(1270, 0.28), 150, 30, frame, "rgba(231,177,70,.46)");
      }
      if (map.biome === "ocean") {
        ctx.strokeStyle = "rgba(216,255,250,.22)";
        ctx.lineWidth = 18;
        for (let i = 0; i < 6; i += 1) {
          const x = 80 + i * 170 - ((frame + i * 17) % 50);
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x - 90, 470);
          ctx.stroke();
        }
        for (let i = 0; i < 12; i += 1) {
          const x = parallaxX(i * 155, 0.27, 1900);
          const h = 44 + (i % 4) * 18;
          ctx.fillStyle = i % 3 === 0 ? "rgba(255,126,139,.62)" : i % 3 === 1 ? "rgba(255,207,91,.62)" : "rgba(92,224,184,.62)";
          ctx.beginPath();
          ctx.ellipse(x, 430, 20, h, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = "rgba(230,255,255,.55)";
        for (let i = 0; i < 42; i += 1) {
          ctx.beginPath();
          ctx.arc((i * 91 - frame * 2 - camera.current * 0.08) % (WIDTH + 60), 90 + ((i * 53 + frame * 2) % 330), 2 + (i % 4), 0, Math.PI * 2);
          ctx.fill();
        }
      }
      if (map.biome === "storm") {
        for (let i = 0; i < 6; i += 1) {
          const x = parallaxX(i * 310, 0.17, 1900);
          ctx.fillStyle = "rgba(65,78,96,.5)";
          ctx.beginPath();
          ctx.moveTo(x - 130, 430);
          ctx.lineTo(x + 110, 175 + (i % 2) * 40);
          ctx.lineTo(x + 330, 430);
          ctx.closePath();
          ctx.fill();
        }
        if (frame % 48 < 9) {
          ctx.strokeStyle = "rgba(255,246,122,.82)";
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(665, 70);
          ctx.lineTo(630, 155);
          ctx.lineTo(670, 145);
          ctx.lineTo(625, 245);
          ctx.stroke();
        }
      }
      if (map.biome === "void") {
        for (let i = 0; i < 9; i += 1) {
          drawCrystalCluster(parallaxX(i * 245, 0.18, 1900), 210 + (i % 4) * 55 + Math.sin(frame * 0.05 + i) * 8, 0.48 + (i % 3) * 0.12, i % 2 ? "rgba(122,255,232,.58)" : "rgba(168,140,255,.62)");
        }
      }
      if (map.biome === "shadow") {
        drawScreenCircle(780 - camera.current * 0.04, 92, 48, "rgba(255,88,119,.45)");
        const castleX = parallaxX(620, 0.16, 1800);
        ctx.fillStyle = "rgba(17,13,20,.72)";
        drawScreenRect(castleX, 210, 300, 220, "rgba(17,13,20,.72)");
        drawScreenRect(castleX + 40, 145, 58, 285, "rgba(17,13,20,.78)");
        drawScreenRect(castleX + 198, 120, 62, 310, "rgba(17,13,20,.8)");
        ctx.beginPath();
        ctx.moveTo(castleX + 40, 145);
        ctx.lineTo(castleX + 69, 90);
        ctx.lineTo(castleX + 98, 145);
        ctx.moveTo(castleX + 198, 120);
        ctx.lineTo(castleX + 229, 58);
        ctx.lineTo(castleX + 260, 120);
        ctx.fill();
      }
    };
    const drawBiomeForeground = (map: Level) => {
      if (map.biome === "forest") {
        drawScreenRect(0, 447, WIDTH, 34, "#58b84f");
        for (let i = 0; i < 90; i += 1) {
          const x = ((i * 73 - camera.current) % 1200) + camera.current;
          drawGrassTuft(x, 475 + noise(i * 0.4) * 5, 8 + noise(i * 1.7) * 18, noise(i) > 0.5 ? "#5ccf62" : "#2f8f49");
        }
        return;
      }
      map.platforms
        .filter((platform) => platform.w >= 220 && platform.y >= 420)
        .slice(0, 9)
        .forEach((platform, platformIndex) => {
          for (let i = 0; i < 5; i += 1) {
            const x = platform.x + 28 + i * Math.max(36, platform.w / 6);
            if (x > platform.x + platform.w - 24) return;
            if (map.biome === "ice") drawCrystalCluster(x - camera.current, platform.y + 1, 0.16 + (i % 2) * 0.04, "rgba(223,250,255,.62)");
            else if (map.biome === "volcano") drawScreenRect(x - camera.current, platform.y - 8 + (i % 3) * 3, 28, 4, "rgba(255,104,36,.58)");
            else if (map.biome === "desert") drawGrassTuft(x, platform.y + 3, 7 + (i % 4) * 4, "#d09a4c");
            else if (map.biome === "haunted") drawGrassTuft(x, platform.y + 3, 10 + (i % 4) * 5, platformIndex % 2 ? "#a83d58" : "#6fa68d");
            else if (map.biome === "clockwork") drawScreenRect(x - camera.current, platform.y - 6, 30, 6, i % 2 ? "rgba(143,102,43,.5)" : "rgba(84,72,56,.5)");
            else if (map.biome === "ocean") drawGrassTuft(x, platform.y + 3, 16 + (i % 5) * 7, i % 2 ? "#57dfc2" : "#ff8d9d");
            else if (map.biome === "storm") drawScreenRect(x - camera.current, platform.y - 6, 34, 5, "rgba(235,244,255,.36)");
            else if (map.biome === "void") drawScreenCircle(x - camera.current, platform.y - 5, 3 + (i % 3), i % 2 ? "rgba(122,255,232,.62)" : "rgba(168,140,255,.56)");
            else drawGrassTuft(x, platform.y + 3, 11 + (i % 4) * 5, "#a83d58");
          }
        });
    };

    const draw = () => {
      const p = player.current;
      const map = level.current;
      const frame = Math.floor(performance.now() / 85);
      const style = biomeStyle(map.biome);
      const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
      gradient.addColorStop(0, map.skyTop);
      gradient.addColorStop(0.48, map.skyMid);
      gradient.addColorStop(0.64, style.cap);
      gradient.addColorStop(1, map.groundTint);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      ctx.fillStyle = "rgba(255, 233, 128, .9)";
      ctx.beginPath();
      ctx.arc(835 - camera.current * 0.05, 82, 38, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 248, 188, .45)";
      ctx.beginPath();
      ctx.arc(835 - camera.current * 0.05, 82, 54, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = style.ridge;
      for (let ridge = 0; ridge < 6; ridge += 1) {
        const base = 390 + (ridge % 2) * 24;
        ctx.beginPath();
        ctx.moveTo(-80, HEIGHT);
        for (let x = -80; x <= WIDTH + 160; x += 160) {
          ctx.lineTo(x, base + Math.sin((x + camera.current * 0.18 + ridge * 100) / 180) * 18);
        }
        ctx.lineTo(WIDTH + 160, HEIGHT);
        ctx.closePath();
        ctx.fill();
      }
      drawBiomeBackdrop(map, frame);

      if (map.biome === "forest" || map.biome === "ice" || map.biome === "storm") {
        const cloudCount = map.biome === "forest" ? 12 : map.biome === "ice" ? 5 : 18;
        for (let i = 0; i < cloudCount; i += 1) {
          const x = ((i * 520 - camera.current * 0.24) % 2500) + camera.current * 0.24 - 220;
          const y = map.biome === "storm" ? 48 + (i % 5) * 28 : 78 + (i % 4) * 34;
          const scale = map.biome === "storm" ? 1 + (i % 4) * 0.14 : map.biome === "ice" ? 0.62 + (i % 3) * 0.08 : 0.78 + (i % 3) * 0.12;
          ctx.save();
          if (map.biome === "ice") ctx.globalAlpha = 0.58;
          if (map.biome === "storm") ctx.globalAlpha = 0.72;
          drawCloud(x, y, scale);
          ctx.restore();
        }
      }
      if (map.biome === "forest") {
        for (let i = 0; i < 10; i += 1) {
          const x = ((i * 380 - camera.current * 0.18) % 1800) + camera.current * 0.18 - 140;
          drawBird(x, 118 + (i % 5) * 28, 0.7 + (i % 3) * 0.22, frame);
        }
      }
      if (map.biome === "ice") {
        ctx.fillStyle = "rgba(255,255,255,.46)";
        for (let i = 0; i < 46; i += 1) {
          const snowX = (i * 137 + frame * (1 + (i % 3)) - camera.current * 0.08) % (WIDTH + 80);
          const snowY = (i * 59 + frame * (2 + (i % 4))) % HEIGHT;
          ctx.beginPath();
          ctx.arc(snowX - 40, snowY, 1 + (i % 3) * 0.45, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      if (map.biome === "volcano") {
        ctx.fillStyle = "rgba(255,92,38,.62)";
        for (let i = 0; i < 34; i += 1) {
          const emberX = (i * 173 - frame * (1 + (i % 3)) - camera.current * 0.12) % (WIDTH + 100);
          const emberY = HEIGHT - ((i * 67 + frame * (2 + (i % 4))) % 360);
          ctx.fillRect(emberX - 50, emberY, 2 + (i % 3), 2 + (i % 2));
        }
      }
      if (map.biome === "desert" || map.biome === "storm") {
        ctx.strokeStyle = map.biome === "desert" ? "rgba(255,232,165,.34)" : "rgba(238,246,255,.28)";
        ctx.lineWidth = 2;
        for (let i = 0; i < 22; i += 1) {
          const gustX = (i * 220 - frame * (5 + (i % 4)) - camera.current * 0.18) % (WIDTH + 160);
          const gustY = 95 + (i * 37) % 310;
          ctx.beginPath();
          ctx.moveTo(gustX - 80, gustY);
          ctx.quadraticCurveTo(gustX - 20, gustY - 12, gustX + 70, gustY + 6);
          ctx.stroke();
        }
      }
      if (map.biome === "void" || map.biome === "shadow" || map.biome === "haunted") {
        ctx.fillStyle = map.biome === "shadow" ? "rgba(255,95,130,.55)" : "rgba(190,230,255,.5)";
        for (let i = 0; i < 48; i += 1) {
          const starX = (i * 197 - camera.current * 0.05) % WIDTH;
          const starY = 45 + (i * 83 + frame) % 285;
          ctx.fillRect(starX, starY, 1 + (i % 2), 1 + (i % 2));
        }
      }
      if (map.biome === "forest") {
        drawBalloon(1220, 142, 0.8, "#e8584f", frame);
        drawBalloon(2910, 102, 0.65, "#f2c75c", frame);
        drawBalloon(4380, 160, 0.72, "#47a6d8", frame);
        [180, 520, 980, 1420, 1910, 2320, 2860, 3330, 3820, 4310, 4740, 5140].forEach((x, index) => {
          drawTree(x, 475, 0.85 + (index % 3) * 0.12);
        });
      }
      drawBiomeForeground(map);

      map.platforms.forEach((plat) => {
        drawPlatformDirt(plat, map.biome);
        drawGrassCap(plat, map.biome);
        ctx.fillStyle = "rgba(46, 25, 13, .2)";
        for (let x = plat.x + 10; x < plat.x + plat.w; x += 26) {
          const rootY = plat.y + 18 + noise(x * 0.2) * 14;
          ctx.fillRect(x - camera.current, rootY, 1 + noise(x * 0.44) * 3, 10 + noise(x * 0.72) * 18);
        }
      });
      map.environmentProps.forEach(drawEnvironmentProp);
      map.water.forEach((water) => {
        drawWaterfallSprite(water, frame, map.platforms, map.biome);
      });
      map.bridges.forEach((bridge) => {
        drawRect(bridge.x, bridge.y, bridge.w, bridge.h, "#9a6134");
        for (let x = bridge.x + 6; x < bridge.x + bridge.w; x += 16) {
          drawRect(x, bridge.y, 4, bridge.h, "#5f351e");
        }
        drawRect(bridge.x, bridge.y + 7, bridge.w, 3, "#4f2f1d");
      });
      movingLifts.current.forEach((lift) => {
        const xLift = lift.x - camera.current;
        const grad = ctx.createLinearGradient(0, lift.y, 0, lift.y + lift.h);
        grad.addColorStop(0, "rgba(150,190,210,.95)");
        grad.addColorStop(1, "rgba(68,109,126,.95)");
        ctx.fillStyle = grad;
        ctx.fillRect(xLift, lift.y, lift.w, lift.h);
        ctx.strokeStyle = "rgba(210,240,255,.8)";
        ctx.lineWidth = 2;
        ctx.strokeRect(xLift + 1, lift.y + 1, lift.w - 2, lift.h - 2);
      });
      map.hazards.forEach((hazard) => {
        if (map.biome === "volcano") {
          const lavaGlow = ctx.createLinearGradient(0, hazard.y, 0, hazard.y + hazard.h);
          lavaGlow.addColorStop(0, "rgba(255,230,84,.86)");
          lavaGlow.addColorStop(0.42, "rgba(255,95,31,.9)");
          lavaGlow.addColorStop(1, "rgba(102,26,20,.86)");
          ctx.fillStyle = lavaGlow;
          ctx.fillRect(hazard.x - camera.current, hazard.y, hazard.w, hazard.h);
          ctx.fillStyle = "rgba(255,238,124,.58)";
          for (let i = 0; i < hazard.w; i += 12) {
            ctx.fillRect(hazard.x + i - camera.current, hazard.y + ((frame * 4 + i * 5) % 34), 4, hazard.h - 12);
          }
          return;
        }
        if (map.biome === "desert") {
          ctx.fillStyle = "rgba(191,126,46,.72)";
          ctx.beginPath();
          ctx.ellipse(hazard.x + hazard.w / 2 - camera.current, hazard.y + hazard.h / 2, hazard.w / 2, hazard.h / 2, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "rgba(255,225,146,.68)";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.ellipse(hazard.x + hazard.w / 2 - camera.current, hazard.y + hazard.h / 2, hazard.w / 2 - 8, hazard.h / 2 - 8, 0, 0, Math.PI * 2);
          ctx.stroke();
          return;
        }
        const pitX = hazard.x - camera.current;
        const pitGradient = ctx.createLinearGradient(0, hazard.y, 0, hazard.y + hazard.h);
        pitGradient.addColorStop(0, map.biome === "storm" ? "rgba(255,233,109,.34)" : map.biome === "void" ? "rgba(119,90,235,.34)" : map.biome === "shadow" ? "rgba(255,72,114,.22)" : "rgba(255,255,255,.18)");
        pitGradient.addColorStop(1, map.biome === "clockwork" ? "rgba(73,54,35,.72)" : map.biome === "shadow" ? "rgba(8,5,8,.84)" : "rgba(8,12,22,.72)");
        ctx.fillStyle = pitGradient;
        ctx.fillRect(pitX, hazard.y, hazard.w, hazard.h);
        ctx.fillStyle = map.biome === "storm" ? "rgba(255,237,104,.62)" : map.biome === "void" ? "rgba(126,255,232,.48)" : "rgba(255,255,255,.28)";
        for (let i = 10; i < hazard.w; i += 28) {
          ctx.fillRect(pitX + i, hazard.y + 8 + ((frame + i) % 12), 12, 3);
        }
      });
      bossPillars.current.forEach((pillar) => {
        const x = pillar.x - camera.current;
        const glow = Math.max(0.2, Math.min(0.78, pillar.life / 260));
        const grad = ctx.createLinearGradient(x, pillar.y, x, pillar.y + pillar.h);
        grad.addColorStop(0, `rgba(216,245,255,${glow})`);
        grad.addColorStop(1, `rgba(76,173,222,${glow})`);
        ctx.fillStyle = grad;
        ctx.fillRect(x, pillar.y, pillar.w, pillar.h);
        ctx.strokeStyle = "rgba(235,255,255,.72)";
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 1, pillar.y + 1, pillar.w - 2, pillar.h - 2);
      });
      map.coins.forEach((coin) => {
        if (!coin.taken) drawCoin(coin, frame);
      });
      map.lifePoints.forEach((life) => {
        if (!life.taken) drawLifePoint(life, frame);
      });
      if (map.bossDiamond?.active && !map.bossDiamond.taken) drawBossDiamond(map.bossDiamond, frame);
      map.powerUps.forEach((powerUp) => {
        if (powerUp.taken) return;
        const x = powerUp.x + powerUp.w / 2 - camera.current;
        const y = powerUp.y + powerUp.h / 2 + Math.sin(frame * 0.3) * 4;
        ctx.fillStyle = "#ffef6e";
        ctx.beginPath();
        ctx.arc(x, y, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ff6b35";
        ctx.beginPath();
        ctx.moveTo(x, y - 15);
        ctx.bezierCurveTo(x + 18, y - 2, x + 7, y + 15, x, y + 15);
        ctx.bezierCurveTo(x - 14, y + 8, x - 4, y - 4, x, y - 15);
        ctx.fill();
      });
      map.checkpoints.forEach((point) => {
        const poleX = point.x - camera.current + 13;
        drawRect(point.x + 13, point.y, 7, point.h, "#f2d06b");
        ctx.fillStyle = point.active ? "#47d86c" : "#f05c4f";
        ctx.beginPath();
        ctx.moveTo(poleX + 7, point.y + 5);
        ctx.lineTo(poleX + 52, point.y + 19);
        ctx.lineTo(poleX + 7, point.y + 34);
        ctx.closePath();
        ctx.fill();
      });
      projectiles.current.forEach((shot) => {
        const x = shot.x - camera.current;
        ctx.fillStyle = "#ffef6e";
        ctx.beginPath();
        ctx.ellipse(x + shot.w / 2, shot.y + shot.h / 2, shot.w, shot.h, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255,107,53,.55)";
        ctx.fillRect(x - (shot.vx > 0 ? 18 : -shot.w), shot.y + 4, 18, 4);
      });
      bossProjectiles.current.forEach((shot) => {
        const x = shot.x - camera.current;
        if (shot.kind === "wave") {
          ctx.fillStyle = "rgba(160,237,255,.65)";
          ctx.fillRect(x, shot.y, shot.w, shot.h);
          return;
        }
        ctx.fillStyle = "#b6f3ff";
        ctx.beginPath();
        ctx.moveTo(x + shot.w / 2, shot.y);
        ctx.lineTo(x + shot.w, shot.y + shot.h / 2);
        ctx.lineTo(x + shot.w / 2, shot.y + shot.h);
        ctx.lineTo(x, shot.y + shot.h / 2);
        ctx.closePath();
        ctx.fill();
      });
      map.enemies.forEach((enemy) => {
        if (!enemy.alive && enemy.dead <= 0) return;
        drawBloodBurst(enemy);
        const anim: AnimName = !enemy.alive ? "slimeDead" : enemy.hurt > 0 ? "slimeHurt" : Math.abs(enemy.x - p.x) < 58 ? "slimeAttack" : "slimeMove";
        const squash = !enemy.alive ? enemy.squash : 0;
        const stompDissolve = !enemy.alive ? 1 - Math.max(0, Math.min(1, enemy.dead / 56)) : 0;
        const sink = stompDissolve * 48;
        const spriteHeight = Math.max(6, 78 - squash - sink * 0.45);
        const spriteY = enemy.y - 25 + squash + sink;
        ctx.save();
        ctx.globalAlpha = !enemy.alive ? Math.max(0, 1 - stompDissolve * 1.15) : 1;
        const enemyFrame = !enemy.alive ? Math.min(5, Math.floor((999999 - enemy.dead) / 9)) : Math.floor(frame / 2);
        const drawn = drawSprite(anim, enemyFrame, enemy.x - 20, spriteY, 88, spriteHeight, -enemy.dir);
        if (!drawn) {
          drawRect(enemy.x, enemy.y + 12 + squash, enemy.w, Math.max(12, enemy.h - 12 - squash), enemy.hurt > 0 ? "#ff78a5" : "#8b3f9f");
          drawRect(enemy.x + 8, enemy.y + squash, enemy.w - 16, Math.max(8, 20 - squash / 2), "#b761c9");
        }
        ctx.restore();
        if (!enemy.alive) {
          ctx.fillStyle = `rgba(62, 41, 27, ${0.32 * (1 - stompDissolve)})`;
          ctx.beginPath();
          ctx.ellipse(enemy.x + enemy.w / 2 - camera.current, enemy.y + enemy.h - 1, 26 + stompDissolve * 12, 5, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      });
      map.flyingEnemies.forEach((enemy) => {
        if (enemy.alive || enemy.dead > 0) drawFlyingEnemy(enemy, frame);
      });

      if (!map.finalCastle) drawForestExit(map.goal, map.id);
      if (boss.current) drawBoss(boss.current, frame, p.x);

      const playerAnim: AnimName =
        p.dead > 0 || gameOver
          ? "dead"
          : p.hurt > 0
            ? "hurt"
            : p.attack > 0
              ? "kick"
              : !p.grounded && p.vy < 0
                ? "jump"
                : !p.grounded
                  ? "fall"
                  : Math.abs(p.vx) > 0
                    ? "run"
                    : "idle";
      const playerDrawn = drawSprite(playerAnim, frame, p.x - 35, p.y - 32, 114, 104, -p.face, playerAnim === "dead");
      if (!playerDrawn) drawFallbackHero(p);
      if (p.freeze > 0) {
        ctx.fillStyle = "rgba(169,238,255,.22)";
        ctx.fillRect(Math.round(p.x - 5 - camera.current), Math.round(p.y - 4), p.w + 10, p.h + 8);
      }

      if (p.land > 0) {
        ctx.fillStyle = `rgba(255,255,255,${p.land / 18})`;
        ctx.beginPath();
        ctx.ellipse(p.x + p.w / 2 - camera.current, p.y + p.h, 30 - p.land, 6, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = "rgba(8,14,20,.62)";
      ctx.fillRect(0, 0, WIDTH, 54);
      drawHudIcon(28, 28, "coin");
      drawHudIcon(160, 28, "heart");
      drawHudIcon(292, 28, "fire");
      drawHudIcon(372, 28, "sound");
      ctx.fillStyle = "#fff";
      ctx.font = "800 23px Arial";
      ctx.fillText(`${hud.coins}`, 49, 36);
      ctx.fillText(`${hud.lives}`, 181, 36);
      ctx.font = "700 18px Arial";
      ctx.fillText(`${p.fire}`, 314, 35);
      ctx.fillText(soundOn ? "Music" : "Muted", 390, 35);
      ctx.fillStyle = "rgba(255,255,255,.22)";
      ctx.fillRect(465, 18, 118, 18);
      ctx.fillStyle = p.power > 55 ? "#7af0a5" : p.power > 25 ? "#ffd34e" : "#ff4d58";
      ctx.fillRect(468, 21, Math.max(0, (p.power / MAX_POWER) * 112), 12);
      ctx.strokeStyle = "rgba(255,255,255,.55)";
      ctx.lineWidth = 2;
      ctx.strokeRect(465, 18, 118, 18);
      ctx.fillStyle = "#fff";
      ctx.font = "700 13px Arial";
      ctx.fillText("Power", 503, 32);
      const activeBoss = boss.current;
      if (activeBoss?.active && activeBoss.biome === "ice" && activeBoss.health <= Math.ceil(activeBoss.maxHealth * 0.3) && activeBoss.alive) {
        ctx.fillStyle = "rgba(229,249,255,.1)";
        for (let i = 0; i < 72; i += 1) {
          const sx = ((frame * 7 + i * 53) % (WIDTH + 140)) - 70;
          const sy = (i * 37 + frame * 3) % HEIGHT;
          ctx.fillRect(sx, sy, 2, 8);
        }
      }

      if (won || gameOver) {
        if (won) {
          ctx.fillStyle = "rgba(0,0,0,.58)";
          ctx.fillRect(0, 0, WIDTH, HEIGHT);
        }
        ctx.fillStyle = "#fff";
        ctx.font = "800 44px Arial";
        ctx.textAlign = "center";
        ctx.fillText(won ? "Castle Cleared" : "Game Over", WIDTH / 2, 245);
        ctx.font = "600 21px Arial";
        ctx.fillText(won ? "Press Restart to play again" : "Use Restart Level or Quit", WIDTH / 2, 285);
        ctx.textAlign = "left";
      }
    };

    const tick = () => {
      if (screen === "playing" && !won) {
        const p = player.current;
        const map = level.current;
        const wasGrounded = p.grounded;
        if (gameOver) {
          if (p.dead > 0 && p.deadFall) {
            p.vy += GRAVITY;
            p.y += p.vy;
            p.x = Math.max(0, Math.min(LEVEL_END, p.x));

            const allSolids = [...map.platforms, ...map.bridges, ...bossPillars.current, ...movingLifts.current];
            let landed = false;
            allSolids.forEach((plat) => {
              if (!landed && overlaps(p, plat) && p.vy >= 0 && p.y + p.h - p.vy <= plat.y + 8) {
                p.y = plat.y - p.h;
                p.vy = 0;
                p.grounded = true;
                p.deadFall = false;
                landed = true;
              }
            });
            if (!landed && p.y + p.h >= HEIGHT - 56) {
              p.y = HEIGHT - 56 - p.h;
              p.vy = 0;
              p.grounded = true;
              p.deadFall = false;
            }
          }
          draw();
          raf.current = requestAnimationFrame(tick);
          return;
        }
        const moveDir = (keys.current.right ? 1 : 0) - (keys.current.left ? 1 : 0);
        const freezeSlow = p.freeze > 0 ? 0.56 : 1;
        const carriedLongJump = p.longJump > 0 && moveDir === p.face && !p.grounded;
        p.vx = moveDir * (carriedLongJump ? RUN_JUMP_SPEED : WALK_SPEED) * freezeSlow;
        if (p.vx !== 0) p.face = p.vx > 0 ? 1 : -1;
        if (keys.current.jump && p.grounded) {
          const runningJump = moveDir !== 0;
          p.vy = runningJump ? -15.6 : -15;
          p.grounded = false;
          p.longJump = runningJump ? RUN_JUMP_FRAMES : 0;
          if (runningJump) p.vx = moveDir * RUN_JUMP_SPEED;
          playSound("jump");
        }
        if (keys.current.kick && p.attack <= 0) {
          p.attack = 18;
          playSound("kick");
        }
        if (keys.current.fire && p.fire > 0 && p.fireCooldown <= 0) {
          projectiles.current.push({
            x: p.x + (p.face > 0 ? p.w : -22),
            y: p.y + 22,
            w: 18,
            h: 10,
            vx: p.face * 9,
            life: 70,
          });
          p.fire -= 1;
          p.fireCooldown = 18;
          playSound("laser");
        }
        p.attack = Math.max(0, p.attack - 1);
        p.hurt = Math.max(0, p.hurt - 1);
        p.land = Math.max(0, p.land - 1);
        p.fireCooldown = Math.max(0, p.fireCooldown - 1);
        p.longJump = Math.max(0, p.longJump - 1);
        p.freeze = Math.max(0, p.freeze - 1);
        p.vy += GRAVITY;
        const previousY = p.y;
        const previousX = p.x;
        const wasFalling = p.vy > 0;
        p.x = Math.max(0, Math.min(LEVEL_END, p.x + p.vx));
        const activeBoss = boss.current;
        const bossFightLocked = Boolean(map.finalCastle && activeBoss?.active && activeBoss.alive && !activeBoss.defeated && activeBoss.biome !== "forest");
        if (bossFightLocked) p.x = clampBossArenaX(p.x, p.w);
        p.y += p.vy;
        p.grounded = false;

        movingLifts.current.forEach((lift) => {
          lift.x += lift.speed * lift.dir;
          if (lift.x <= lift.minX) {
            lift.x = lift.minX;
            lift.dir = 1;
          } else if (lift.x >= lift.maxX) {
            lift.x = lift.maxX;
            lift.dir = -1;
          }
        });

        const allSolids = [...map.platforms, ...map.bridges, ...bossPillars.current, ...movingLifts.current];
        allSolids.forEach((plat) => {
          if (overlaps(p, plat) && p.vy >= 0 && p.y + p.h - p.vy <= plat.y + 8) {
            p.y = plat.y - p.h;
            p.vy = 0;
            p.grounded = true;
            if (!wasGrounded) p.land = 18;
          }
        });
        // Carry player with moving lift when standing on it.
        movingLifts.current.forEach((lift) => {
          const standingOnLift =
            p.grounded &&
            p.y + p.h >= lift.y - 2 &&
            p.y + p.h <= lift.y + 8 &&
            p.x + p.w > lift.x + 8 &&
            p.x < lift.x + lift.w - 8;
          if (standingOnLift) {
            p.x += lift.speed * lift.dir;
          }
        });
        p.x = Math.max(0, Math.min(LEVEL_END, p.x));

        map.checkpoints.forEach((point) => {
          if (!point.active && overlaps(p, point)) {
            map.checkpoints.forEach((item) => {
              item.active = false;
            });
            point.active = true;
            checkpoint.current = { x: point.x - 4, y: point.y - p.h };
            playSound("checkpoint");
            setHud((value) => ({ ...value, message: "Checkpoint saved" }));
          }
        });

        map.coins.forEach((coin) => {
          if (!coin.taken && overlaps(p, coin)) {
            coin.taken = true;
            playSound("coin");
            setHud((value) => ({ ...value, coins: value.coins + 1, message: "Coin collected" }));
          }
        });

        map.powerUps.forEach((powerUp) => {
          if (!powerUp.taken && overlaps(p, powerUp)) {
            powerUp.taken = true;
            p.fire += 18;
            playSound("powerup");
            setHud((value) => ({ ...value, message: "Fire power ready" }));
          }
        });

        map.lifePoints.forEach((life) => {
          if (!life.taken && overlaps(p, life)) {
            life.taken = true;
            playSound("powerup");
            setHud((value) => ({ ...value, lives: Math.min(3, value.lives + 1), message: "Life restored" }));
          }
        });

        projectiles.current = projectiles.current
          .map((shot) => ({ ...shot, x: shot.x + shot.vx, life: shot.life - 1 }))
          .filter((shot) => shot.life > 0 && shot.x > camera.current - 80 && shot.x < camera.current + WIDTH + 120);

        const kickBox: Entity = { x: p.x + (p.face > 0 ? p.w - 2 : -34), y: p.y + 15, w: 36, h: 25 };
        const completeLevel = () => {
          if (levelTransition.current) return;
          const currentBoss = boss.current;
          if (map.finalCastle && currentBoss && !currentBoss.defeated) return;
          if (map.finalCastle && currentBoss && (!map.bossDiamond || !map.bossDiamond.taken)) {
            setHud((value) => ({ ...value, message: "Collect the guardian diamond to open the next stage" }));
            return;
          }
          levelTransition.current = true;
          playSound("win");
          setWon(true);
          const nextStage = currentLevel.current + 1;
          if (nextStage < WORLD_LEVELS.length) {
            const message = map.finalCastle ? `${WORLD_DEFINITIONS[worldIndexForStage(currentLevel.current)].name} complete. Entering ${WORLD_LEVELS[nextStage].id}.` : `${map.id} exit reached. Entering ${WORLD_LEVELS[nextStage].id}.`;
            setHud((value) => ({ ...value, message }));
            window.setTimeout(() => startLevelLoading(nextStage), 1200);
          } else {
            setHud((value) => ({ ...value, message: "Shadow Crown Castle cleared. Alex wins." }));
          }
        };
        if (map.bossDiamond?.active && !map.bossDiamond.taken && overlaps(p, map.bossDiamond)) {
          map.bossDiamond.taken = true;
          playSound("coin");
          setHud((value) => ({ ...value, coins: value.coins + 5, message: "Guardian diamond collected" }));
          completeLevel();
        }
        const bossState = boss.current;
        if (bossState?.active && bossState.alive) {
          if (bossState.biome === "forest") {
            const clampForestBossX = (x: number) => Math.max(0, Math.min(LEVEL_END - bossState.w, x));
            const platformLandingY = (platform: Entity) => platform.y - bossState.h;
            const platformContainsBoss = (platform: Entity, inset = 0) =>
              bossState.x + bossState.w / 2 >= platform.x + inset && bossState.x + bossState.w / 2 <= platform.x + platform.w - inset;
            const clampBossToPlatform = (platform: Entity, x = bossState.x) =>
              Math.max(
                Math.max(0, platform.x + 6),
                Math.min(Math.min(LEVEL_END - bossState.w, platform.x + platform.w - bossState.w - 6), x),
              );
            const settleBossToPlatformX = (platform: Entity, maxStep = 10) => {
              const clamped = clampBossToPlatform(platform);
              const delta = clamped - bossState.x;
              if (Math.abs(delta) <= maxStep) return clamped;
              return bossState.x + Math.sign(delta) * maxStep;
            };
            const platformIsSafeForBoss = (platform: Entity) => {
              const landingZone = {
                x: platform.x + 28,
                y: platform.y - bossState.h - 6,
                w: Math.max(0, platform.w - 56),
                h: bossState.h + platform.h + 10,
              };
              return (
                platform.w >= bossState.w + 48 &&
                platform.y >= 180 &&
                !map.water.some((water) => intersects(landingZone, water, 8)) &&
                !map.hazards.some((hazard) => intersects(landingZone, hazard, 8))
              );
            };
            const forestBossPlatforms = map.platforms.filter((platform) => platformIsSafeForBoss(platform)).sort((a, b) => a.y - b.y);
            const defaultBossPlatform =
              forestBossPlatforms
                .slice()
                .sort((a, b) => Math.abs(a.x + a.w / 2 - (bossState.x + bossState.w / 2)) - Math.abs(b.x + b.w / 2 - (bossState.x + bossState.w / 2)))[0] ?? null;
            const defaultBossGroundY = defaultBossPlatform ? platformLandingY(defaultBossPlatform) : bossState.groundY;
            const currentBossPlatform =
              forestBossPlatforms
                .filter((platform) => platformContainsBoss(platform, -20))
                .sort((a, b) => Math.abs(bossState.y + bossState.h - a.y) - Math.abs(bossState.y + bossState.h - b.y))[0] ?? null;
            const playerSupportPlatform =
              forestBossPlatforms
                .filter((platform) => p.x + p.w / 2 >= platform.x - 16 && p.x + p.w / 2 <= platform.x + platform.w + 16)
                .sort((a, b) => Math.abs(a.y - (p.y + p.h)) - Math.abs(b.y - (p.y + p.h)))[0] ?? null;
            const chooseForestBossJumpTarget = () => {
              const playerCenter = p.x + p.w / 2;
              const predictedPlayerCenter = playerCenter + p.vx * 14;
              const playerFeet = p.y + p.h;
              const candidates = forestBossPlatforms.filter((platform) => {
                const landingY = platformLandingY(platform);
                const reachableHeight = landingY >= bossState.y - 360 && landingY <= bossState.y + 360;
                return reachableHeight;
              });
              const playerBelowBoss = playerSupportPlatform && platformLandingY(playerSupportPlatform) - bossState.y > 130;
              if (playerBelowBoss) {
                bossState.targetX = clampBossToPlatform(playerSupportPlatform, predictedPlayerCenter - bossState.w / 2);
                bossState.targetY = platformLandingY(playerSupportPlatform);
                return;
              }
              if (playerSupportPlatform) {
                const supportLandingY = platformLandingY(playerSupportPlatform);
                if (supportLandingY >= bossState.y - 360 && supportLandingY <= bossState.y + 360) {
                  bossState.targetX = clampBossToPlatform(playerSupportPlatform, predictedPlayerCenter - bossState.w / 2);
                  bossState.targetY = supportLandingY;
                  return;
                }
              }
              const targetPlatform =
                candidates.sort((a, b) => {
                  const aCenter = a.x + a.w / 2;
                  const bCenter = b.x + b.w / 2;
                  const ax = Math.abs(aCenter - predictedPlayerCenter);
                  const bx = Math.abs(bCenter - predictedPlayerCenter);
                  const ay = Math.abs(a.y - playerFeet);
                  const by = Math.abs(b.y - playerFeet);
                  const aNearBias = Math.abs(aCenter - (bossState.x + bossState.w / 2)) * 0.35;
                  const bNearBias = Math.abs(bCenter - (bossState.x + bossState.w / 2)) * 0.35;
                  return ax + ay * 0.6 + aNearBias - (bx + by * 0.6 + bNearBias);
                })[0] ??
                currentBossPlatform ??
                forestBossPlatforms[forestBossPlatforms.length - 1];
              if (!targetPlatform) {
                bossState.targetX = clampForestBossX(playerCenter - bossState.w / 2);
                bossState.targetY = bossState.groundY;
                return;
              }
              bossState.targetX = clampBossToPlatform(targetPlatform, playerCenter - bossState.w / 2);
              bossState.targetY = platformLandingY(targetPlatform);
            };
            const launchForestJump = () => {
              const dx = bossState.targetX - bossState.x;
              const dy = bossState.targetY - bossState.y;
              const distance = Math.abs(dx);
              const aggressive = bossState.health <= Math.ceil(bossState.maxHealth * 0.55);
              const shortHop = distance < 120 && Math.abs(dy) < 70;
              const jumpFrames = shortHop ? 20 : Math.max(22, Math.min(44, Math.floor(distance / 8) + (aggressive ? 14 : 18)));
              const baseVy =
                dy > 70
                  ? -5.8 // drop-pursuit jump
                  : dy > 30
                    ? -6.6 // jump to lower platform: smaller hop so boss can come down naturally
                  : dy > -40
                    ? -7.8 // same-height or slight up/down
                    : dy > -120
                      ? -9.8 // medium climb
                      : -12.4; // high climb
              bossState.vx = dx / jumpFrames;
              bossState.vy = baseVy;
              bossState.jumpFrames = jumpFrames + (aggressive ? 54 : 48);
            };
            bossState.vulnerable = Math.max(0, bossState.vulnerable - 1);
            bossState.slam = Math.max(0, bossState.slam - 1);
            bossState.meleeWindup = Math.max(0, bossState.meleeWindup - 1);
            bossState.meleeCooldown = Math.max(0, bossState.meleeCooldown - 1);
            bossState.hurt = Math.max(0, bossState.hurt - 1);
            if (bossState.phase === "entering") {
              bossState.vy += 0.95;
              bossState.y += bossState.vy;
              if (defaultBossPlatform) bossState.x = settleBossToPlatformX(defaultBossPlatform, 8);
              bossState.groundY = defaultBossGroundY;
              if (bossState.y >= defaultBossGroundY) {
                bossState.y = defaultBossGroundY;
                bossState.vy = 0;
                bossState.phase = "chasing";
                bossState.attackTimer = 48;
                bossState.vx = 0;
                bossState.intro = 45;
                bossState.slam = 34;
                beep(72, 0.22, "sawtooth", 0.13, -28);
                window.setTimeout(() => beep(46, 0.18, "square", 0.12, -12), 80);
                setHud((value) => ({ ...value, message: "Root Guardian landed. Keep moving." }));
              }
            } else if (bossState.phase === "chasing") {
              bossState.attackTimer = Math.max(0, bossState.attackTimer - 1);
              bossState.intro = Math.max(0, bossState.intro - 1);
              const playerCenter = p.x + p.w / 2;
              const predictedPlayerCenter = playerCenter + p.vx * 10;
              const centerDistance = Math.abs(bossState.x + bossState.w / 2 - playerCenter);
              const visualBossCenter = bossState.x + FOREST_BOSS_DRAW_X_OFFSET + FOREST_BOSS_DRAW_W / 2;
              const visualDistance = Math.abs(visualBossCenter - playerCenter);
              const verticalDistance = Math.abs(p.y + p.h / 2 - (bossState.y + bossState.h / 2));
              const targetPlayerY = playerSupportPlatform ? platformLandingY(playerSupportPlatform) : bossState.targetY;
              const needsLevelChange = Math.abs(targetPlayerY - bossState.y) > 42;
              const aggression = bossState.health <= Math.ceil(bossState.maxHealth * 0.5) ? 1.25 : 1;
              const canClawSwipe =
                (centerDistance <= 200 || visualDistance <= 220) &&
                verticalDistance <= 140 &&
                bossState.meleeWindup <= 0 &&
                bossState.meleeCooldown <= 0 &&
                bossState.hurt <= 0;
              const closeThreat = visualDistance <= 230 && verticalDistance <= 170;
              if (canClawSwipe) {
                bossState.phase = "clawing";
                bossState.meleeWindup = 20;
                bossState.meleeCooldown = 34;
                bossState.attackTimer = Math.max(bossState.attackTimer, 26);
                bossState.vx = 0;
                bossState.targetX = bossState.x;
                bossState.face = bossFacing(bossState, playerCenter);
                beep(118, 0.08, "sawtooth", 0.1, -30);
                setHud((value) => ({ ...value, message: "Root Guardian swings its claws!" }));
              }
              if (bossState.meleeWindup > 0) {
                bossState.vx = 0;
              } else {
                const shouldCloseJumpAttack =
                  centerDistance <= 170 &&
                  verticalDistance <= 120 &&
                  bossState.attackTimer <= 18 &&
                  bossState.intro <= 0;
                if (needsLevelChange && bossState.attackTimer > 18) bossState.attackTimer = 18;
                const readyForJump = bossState.intro <= 0 && bossState.attackTimer <= 0 && (needsLevelChange || centerDistance > 230);
                const shouldPounce =
                  bossState.intro <= 0 &&
                  bossState.attackTimer <= 12 &&
                  centerDistance > 130 &&
                  centerDistance < 320 &&
                  verticalDistance <= 160 &&
                  !needsLevelChange &&
                  !closeThreat;
                if (shouldCloseJumpAttack) {
                  bossState.phase = "jumping";
                  const jumpDir = playerCenter >= bossState.x + bossState.w / 2 ? 1 : -1;
                  bossState.targetX = clampForestBossX(playerCenter - bossState.w / 2);
                  bossState.targetY = bossState.groundY;
                  bossState.vx = jumpDir * 3.6;
                  bossState.vy = -12.6;
                  bossState.jumpFrames = 64;
                  bossState.attackTimer = 46;
                  bossState.slam = 20;
                  setHud((value) => ({ ...value, message: "Root Guardian leap attack!" }));
                } else if (readyForJump) {
                  bossState.phase = "jumping";
                  chooseForestBossJumpTarget();
                  launchForestJump();
                  beep(96, 0.18, "sawtooth", 0.11, 34);
                  window.setTimeout(() => beep(164, 0.12, "square", 0.07, -70), 70);
                  setHud((value) => ({ ...value, message: "Root Guardian commits to a jump. Dodge the landing." }));
                } else if (shouldPounce) {
                  bossState.phase = "jumping";
                  bossState.targetX = clampForestBossX(playerCenter - bossState.w / 2);
                  bossState.targetY = bossState.groundY;
                  launchForestJump();
                  bossState.attackTimer = 44;
                  beep(102, 0.16, "sawtooth", 0.1, 28);
                  setHud((value) => ({ ...value, message: "Root Guardian pounces forward!" }));
                } else {
                  const walkPlatform = currentBossPlatform ?? defaultBossPlatform;
                  const canClampWalk = Boolean(walkPlatform && platformContainsBoss(walkPlatform, -28));
                  const desiredOffset = closeThreat ? 0 : centerDistance < 140 ? (bossState.x + bossState.w / 2 < playerCenter ? -170 : 170) : 0;
                  const strafeTarget = predictedPlayerCenter + desiredOffset - bossState.w / 2;
                  bossState.targetX = walkPlatform && canClampWalk ? clampBossToPlatform(walkPlatform, strafeTarget) : clampForestBossX(strafeTarget);
                  const delta = bossState.targetX - bossState.x;
                  const desiredDir = Math.abs(delta) < 8 ? 0 : delta > 0 ? 1 : -1;
                  const desiredSpeed =
                    desiredDir === 0 ? 0 : desiredDir * ((FOREST_BOSS_WALK_SPEED + noise(bossState.x * 0.017 + bossState.attackTimer * 0.03) * FOREST_BOSS_WALK_VARIANCE) * aggression);
                  const accel = 0.13;
                  bossState.vx += (desiredSpeed - bossState.vx) * accel;
                  if (Math.abs(desiredSpeed) < 0.01) bossState.vx *= 0.84;
                  const nextX = bossState.x + bossState.vx;
                  bossState.x = walkPlatform && canClampWalk ? clampBossToPlatform(walkPlatform, nextX) : clampForestBossX(nextX);
                  if (Math.abs(delta) < 12 && centerDistance < 190 && bossState.attackTimer < 8) bossState.attackTimer = 10;
                }
              }
            } else if (bossState.phase === "clawing") {
              bossState.vx = 0;
              const playerCenter = p.x + p.w / 2;
              bossState.face = bossFacing(bossState, playerCenter);
              // Active strike window across multiple frames for reliable contact.
              if (bossState.meleeWindup <= 14 && bossState.meleeWindup >= 8) {
                const face = bossState.face || bossFacing(bossState, playerCenter);
                const visualLeft = bossState.x + FOREST_BOSS_DRAW_X_OFFSET;
                const visualRight = visualLeft + FOREST_BOSS_DRAW_W;
                const clawBox: Entity = {
                  x: face < 0 ? visualRight - 84 : visualLeft - 34,
                  y: bossState.y + 2,
                  w: 128,
                  h: 96,
                };
                if (overlaps(p, clawBox)) {
                  damagePlayer(26, bossState.x + bossState.w / 2);
                  bossState.meleeWindup = 0;
                }
              }
              if (bossState.meleeWindup <= 0) {
                bossState.phase = "chasing";
                bossState.attackTimer = Math.max(bossState.attackTimer, 18);
              }
            } else if (bossState.phase === "jumping") {
              const previousBossBottom = bossState.y + bossState.h;
              bossState.jumpFrames = Math.max(0, bossState.jumpFrames - 1);
              bossState.x = clampForestBossX(bossState.x + bossState.vx);
              bossState.vy += 0.66;
              bossState.y += bossState.vy;
              const bossCenter = bossState.x + bossState.w / 2;
              const landingPlatform = forestBossPlatforms
                .filter((platform) => bossCenter >= platform.x + 12 && bossCenter <= platform.x + platform.w - 12 && previousBossBottom <= platform.y + 10 && bossState.y + bossState.h >= platform.y)
                .sort((a, b) => Math.abs(platformLandingY(a) - bossState.targetY) - Math.abs(platformLandingY(b) - bossState.targetY))[0];
              if (landingPlatform) {
                bossState.groundY = platformLandingY(landingPlatform);
                bossState.x = settleBossToPlatformX(landingPlatform, 14);
                bossState.y = bossState.groundY;
                bossState.vx = 0;
                bossState.vy = 0;
                bossState.jumpFrames = 0;
                bossState.phase = "vulnerable";
                bossState.vulnerable = 105;
                bossState.slam = 44;
                beep(52, 0.2, "square", 0.14, -18);
                window.setTimeout(() => beep(118, 0.09, "sawtooth", 0.08, -22), 55);
                setHud((value) => ({ ...value, message: "Weakness open: hit the glowing core." }));
              } else if (defaultBossPlatform && bossState.y >= defaultBossGroundY) {
                bossState.groundY = defaultBossGroundY;
                bossState.x = settleBossToPlatformX(defaultBossPlatform, 14);
                bossState.y = defaultBossGroundY;
                bossState.vx = 0;
                bossState.vy = 0;
                bossState.jumpFrames = 0;
                bossState.phase = "vulnerable";
                bossState.vulnerable = 105;
                bossState.slam = 44;
                beep(52, 0.2, "square", 0.14, -18);
                window.setTimeout(() => beep(118, 0.09, "sawtooth", 0.08, -22), 55);
                setHud((value) => ({ ...value, message: "Weakness open: hit the glowing core." }));
              } else if (bossState.jumpFrames <= 0 || bossState.y > HEIGHT + 220) {
                const rescuePlatform =
                  forestBossPlatforms
                    .slice()
                    .sort((a, b) => Math.abs(a.x + a.w / 2 - bossCenter) - Math.abs(b.x + b.w / 2 - bossCenter))[0] ?? defaultBossPlatform;
                if (rescuePlatform) {
                  bossState.groundY = platformLandingY(rescuePlatform);
                  bossState.x = settleBossToPlatformX(rescuePlatform, 16);
                  bossState.y = bossState.groundY;
                } else {
                  bossState.groundY = 312;
                  bossState.y = bossState.groundY;
                  bossState.x = clampForestBossX(bossState.x);
                }
                bossState.vx = 0;
                bossState.vy = 0;
                bossState.jumpFrames = 0;
                bossState.phase = "chasing";
                bossState.attackTimer = 12;
                bossState.intro = 0;
                setHud((value) => ({ ...value, message: "Root Guardian recovered and resumes the chase." }));
              }
            } else if (bossState.phase === "vulnerable") {
              if (bossState.vulnerable <= 0) {
                bossState.phase = "chasing";
                bossState.attackTimer = 16;
                bossState.vx = 0;
                bossState.intro = 10;
                setHud((value) => ({ ...value, message: "Core closed. Dragon returns to hunt." }));
              }
            }
            bossState.x = clampForestBossX(bossState.x);
          } else if (bossState.biome === "ice") {
            const enrage = bossState.health <= Math.ceil(bossState.maxHealth * 0.3);
            const bossGrounds = [...map.platforms, ...map.bridges, ...bossPillars.current]
              .filter((platform) => platform.w >= bossState.w - 20 && platform.y >= 210)
              .sort((a, b) => a.y - b.y);
            const landingY = (platform: Entity) => platform.y - bossState.h;
            const baseGround = bossGrounds[bossGrounds.length - 1];
            const currentGround =
              bossGrounds
                .filter((platform) => bossState.x + bossState.w / 2 >= platform.x - 10 && bossState.x + bossState.w / 2 <= platform.x + platform.w + 10)
                .sort((a, b) => Math.abs(bossState.y + bossState.h - a.y) - Math.abs(bossState.y + bossState.h - b.y))[0] ?? baseGround;
            const spawnIceShardBarrage = (count: number) => {
              for (let i = 0; i < count; i += 1) {
                const spread = (i - (count - 1) / 2) * 1.25;
                bossProjectiles.current.push({
                  x: bossState.x + bossState.w / 2 - 8,
                  y: bossState.y + 32,
                  w: 16,
                  h: 16,
                  vx: (bossFacing(bossState, p.x + p.w / 2) < 0 ? -1 : 1) * (4.3 + Math.abs(spread) * 0.55),
                  vy: -2.4 + spread,
                  life: 74,
                  kind: "shard",
                });
              }
              beep(320, 0.08, "triangle", 0.09, -60);
            };
            const summonIcePillars = () => {
              const center = p.x + p.w / 2;
              const leftX = Math.max(4280, Math.min(LEVEL_END - 180, center - 150));
              const rightX = Math.max(4280, Math.min(LEVEL_END - 180, center + 90));
              const sourceGround = currentGround ?? baseGround;
              if (!sourceGround) return;
              const y = sourceGround.y - 96;
              bossPillars.current.push({ x: leftX, y, w: 52, h: 96, life: 240 });
              bossPillars.current.push({ x: rightX, y, w: 52, h: 96, life: 240 });
              beep(210, 0.14, "square", 0.1, -70);
            };
            bossState.attackTimer = Math.max(0, bossState.attackTimer - 1);
            bossState.vulnerable = Math.max(0, bossState.vulnerable - 1);
            bossState.slam = Math.max(0, bossState.slam - 1);
            bossState.hurt = Math.max(0, bossState.hurt - 1);
            if (bossState.phase === "jumping") {
              const prevBottom = bossState.y + bossState.h;
              bossState.x += bossState.vx;
              bossState.vy += 0.72;
              bossState.y += bossState.vy;
              const center = bossState.x + bossState.w / 2;
              const land = bossGrounds
                .filter((platform) => center >= platform.x + 8 && center <= platform.x + platform.w - 8 && prevBottom <= platform.y + 8 && bossState.y + bossState.h >= platform.y)
                .sort((a, b) => a.y - b.y)[0];
              if (land) {
                bossState.y = landingY(land);
                bossState.groundY = bossState.y;
                bossState.vx = 0;
                bossState.vy = 0;
                bossState.phase = "vulnerable";
                bossState.vulnerable = enrage ? 80 : 105;
                bossState.slam = 34;
                bossProjectiles.current.push({ x: bossState.x + 10, y: bossState.y + bossState.h - 12, w: 38, h: 12, vx: -4.8, vy: 0, life: 82, kind: "wave" });
                bossProjectiles.current.push({ x: bossState.x + bossState.w - 48, y: bossState.y + bossState.h - 12, w: 38, h: 12, vx: 4.8, vy: 0, life: 82, kind: "wave" });
                setHud((value) => ({ ...value, message: "Ice armor cracked. Attack now." }));
              } else if (bossState.y > HEIGHT + 120) {
                // Fail-safe: if the ice boss falls into a pit, recover to a valid arena ground.
                const recoverGround = currentGround ?? baseGround ?? map.platforms[map.platforms.length - 1];
                if (recoverGround) {
                  const minX = recoverGround.x + 8;
                  const maxX = recoverGround.x + recoverGround.w - bossState.w - 8;
                  bossState.x = Math.max(minX, Math.min(maxX, recoverGround.x + recoverGround.w / 2 - bossState.w / 2));
                  bossState.y = landingY(recoverGround);
                  bossState.groundY = bossState.y;
                } else {
                  bossState.y = 332;
                  bossState.groundY = 332;
                }
                bossState.vx = 0;
                bossState.vy = 0;
                bossState.phase = "chasing";
                bossState.attackTimer = enrage ? 120 : 150;
              }
            } else {
              const playerCenter = p.x + p.w / 2;
              const bossCenter = bossState.x + bossState.w / 2;
              const chaseDir = playerCenter >= bossCenter ? 1 : -1;
              const walkSpeed = enrage ? 1.46 : 1.1;
              bossState.vx = chaseDir * walkSpeed;
              bossState.x += bossState.vx;
              if (currentGround) {
                bossState.x = Math.max(currentGround.x + 8, Math.min(currentGround.x + currentGround.w - bossState.w - 8, bossState.x));
                bossState.y = landingY(currentGround);
                bossState.groundY = bossState.y;
              }
              if (bossState.attackTimer === 150 || (enrage && bossState.attackTimer === 138)) {
                const breathBox: Entity = {
                  x: chaseDir > 0 ? bossState.x + bossState.w - 4 : bossState.x - 140,
                  y: bossState.y + 26,
                  w: 144,
                  h: 56,
                };
                if (overlaps(p, breathBox)) {
                  p.freeze = Math.max(p.freeze, enrage ? 95 : 70);
                  damagePlayer(22, bossState.x + bossState.w / 2);
                }
                beep(280, 0.15, "sawtooth", 0.1, -90);
              }
              if (bossState.attackTimer === 120 || (enrage && bossState.attackTimer === 108)) spawnIceShardBarrage(enrage ? 5 : 3);
              if (bossState.attackTimer === 90 && !enrage) summonIcePillars();
              if (bossState.attackTimer <= (enrage ? 32 : 48)) {
                bossState.phase = "jumping";
                bossState.vx = chaseDir * (enrage ? 3.5 : 2.8);
                bossState.vy = enrage ? -13.3 : -12;
                bossState.attackTimer = enrage ? 138 : 170;
                setHud((value) => ({ ...value, message: "Glacier Tyrant leaps. Keep moving." }));
              }
            }
          } else {
            bossState.attackTimer = Math.max(0, bossState.attackTimer - 1);
            bossState.vulnerable = Math.max(0, bossState.vulnerable - 1);
            bossState.slam = Math.max(0, bossState.slam - 1);
            bossState.hurt = Math.max(0, bossState.hurt - 1);
            if (bossState.attackTimer <= 0) {
              bossState.slam = 28;
              bossState.vulnerable = 95;
              bossState.attackTimer = 165;
              setHud((value) => ({ ...value, message: "Weakness: fire during the cracked armor window" }));
            }
          }
          const hitShot = projectiles.current.find((shot) => overlaps(shot, bossState));
          const swordHit = p.attack > 5 && overlaps(kickBox, bossState);
          const stompHit = wasFalling && previousY + p.h <= bossState.y + 18 && overlaps(p, bossState);
          const canDamageWithSword = bossState.biome === "ice" ? swordHit && bossState.vulnerable > 0 : swordHit;
          const canDamageWithStomp = bossState.biome === "ice" ? stompHit && bossState.vulnerable > 0 : stompHit;
          const canDamageWithFire = Boolean(hitShot) && (bossState.biome === "forest" || bossState.biome === "ice" || bossState.vulnerable > 0);
          const bossWasHit = canDamageWithSword || canDamageWithStomp || canDamageWithFire;
          if (bossWasHit && bossState.hurt <= 0) {
            if (hitShot) hitShot.life = 0;
            if (canDamageWithStomp) {
              p.y = bossState.y - p.h - 4;
              p.vy = -13;
              p.grounded = false;
              p.land = 12;
            }
            const damage = bossState.biome === "ice" ? (canDamageWithFire ? 2 : 1) : 1;
            bossState.health -= damage;
            bossState.hurt = bossState.biome === "ice" ? 28 : 35;
            bossState.vulnerable = Math.max(0, bossState.vulnerable - (bossState.biome === "ice" ? 12 : 18));
            playSound("hit");
            setHud((value) => ({ ...value, message: `${bossState.biome === "forest" ? "Weak core hit" : bossState.biome === "ice" ? "Ice armor fractured" : "Armor cracked"} ${Math.max(0, bossState.health)}/${bossState.maxHealth}` }));
            if (bossState.health <= 0) {
              bossState.face = bossFacing(bossState, p.x + p.w / 2);
              bossState.alive = false;
              bossState.defeated = true;
              bossState.phase = "defeated";
              bossState.deathFrame = 0;
              bossState.dissolve = 70;
              map.bossDiamond = {
                x: bossState.x + bossState.w / 2 - 18,
                y: Math.max(90, bossState.y + bossState.h / 2 - 22),
                w: 36,
                h: 44,
                active: true,
                taken: false,
                pulse: performance.now() * 0.01,
              };
              stopBossMusic();
              beep(46, 0.34, "sawtooth", 0.14, -18);
              window.setTimeout(() => beep(34, 0.28, "square", 0.1, -8), 130);
              setHud((value) => ({ ...value, message: `${biomeStyle(bossState.biome).boss} defeated. Collect the diamond.` }));
              window.setTimeout(() => {
                if (!map.bossDiamond?.taken) setHud((value) => ({ ...value, message: "Take the guardian diamond to clear the stage" }));
              }, bossState.biome === "forest" ? 1800 : 900);
            }
          } else if (hitShot && bossState.vulnerable <= 0) {
            hitShot.life = 0;
            setHud((value) => ({ ...value, message: bossState.biome === "ice" ? "Fire melts armor. Keep shooting." : "No damage. Wait for the weak point." }));
          }
          const forestClawActive = bossState.biome === "forest" && bossState.meleeWindup > 0;
          if (overlaps(p, bossState) && bossState.hurt <= 0 && !bossWasHit && !forestClawActive) damagePlayer(20, bossState.x + bossState.w / 2);
        }
        if (bossState?.active && bossState.phase === "defeated") {
          const maxDeathFrame = bossState.biome === "forest" ? ROOT_GUARDIAN_SPRITES.dead.length - 1 : FROST_WARDEN_SPRITES.dead.length - 1;
          if (bossState.deathFrame < maxDeathFrame) {
            const frameAdvance = bossState.biome === "forest" ? 0.32 : 0.26;
            bossState.deathFrame = Math.min(maxDeathFrame, bossState.deathFrame + frameAdvance);
          }
          bossState.dissolve = 70;
        }
        bossPillars.current = bossPillars.current
          .map((pillar) => ({ ...pillar, life: pillar.life - 1 }))
          .filter((pillar) => pillar.life > 0);
        bossProjectiles.current = bossProjectiles.current
          .map((shot) => ({ ...shot, x: shot.x + shot.vx, y: shot.y + shot.vy, life: shot.life - 1, vy: shot.kind === "shard" ? shot.vy + 0.2 : 0 }))
          .filter((shot) => shot.life > 0 && shot.x > camera.current - 120 && shot.x < camera.current + WIDTH + 140 && shot.y < HEIGHT + 120);
        for (const shot of bossProjectiles.current) {
          if (overlaps(p, shot) && p.hurt <= 0) {
            if (shot.kind === "wave") p.freeze = Math.max(p.freeze, 75);
            damagePlayer(shot.kind === "wave" ? 20 : 16, shot.x + shot.w / 2);
            shot.life = 0;
          }
        }
        bossProjectiles.current = bossProjectiles.current.filter((shot) => shot.life > 0);
        const defeatEnemy = (enemy: Enemy, deathKind: "kick" | "stomp") => {
          enemy.hurt = 8;
          enemy.alive = false;
          enemy.dead = 56;
          enemy.blood = deathKind === "kick" ? 36 : 18;
          enemy.squash = 42;
          enemy.deathKind = deathKind;
          playSound("hit");
          window.setTimeout(() => playSound(deathKind === "stomp" ? "blood" : "blood"), 80);
          setHud((value) => ({ ...value, message: deathKind === "stomp" ? "Enemy squeezed" : "Enemy crushed" }));
        };
        map.enemies.forEach((enemy) => {
          enemy.blood = Math.max(0, enemy.blood - 1);
          if (!enemy.alive) {
            if (enemy.dead < 999999) enemy.dead = Math.max(0, enemy.dead - 1);
            enemy.squash = Math.min(72, enemy.squash + 0.75);
            return;
          }
          if (!enemy.alive) return;
          enemy.hurt = Math.max(0, enemy.hurt - 1);
          enemy.pause = Math.max(0, enemy.pause - 1);
          enemy.wander = Math.max(0, enemy.wander - 1);
          if (enemy.wander <= 0) {
            if (noise(performance.now() * 0.001 + enemy.x * 0.017) > 0.58) enemy.dir *= -1;
            enemy.pause = Math.floor(noise(enemy.x * 0.07 + performance.now() * 0.002) * 28);
            enemy.wander = 70 + Math.floor(noise(enemy.x * 0.11 + performance.now() * 0.003) * 115);
          }
          const solidGround = [...map.platforms, ...map.bridges];
          const enemyFeet = enemy.y + enemy.h;
          const enemyCenter = enemy.x + enemy.w / 2;
          const ground = solidGround
            .filter((plat) => enemyCenter >= plat.x && enemyCenter <= plat.x + plat.w)
            .sort((a, b) => Math.abs(enemyFeet - a.y) - Math.abs(enemyFeet - b.y))[0];
          if (ground && Math.abs(enemyFeet - ground.y) <= 90) enemy.y = ground.y - enemy.h;
          const supportedFeet = ground ? enemy.y + enemy.h : enemyFeet;
          const patrolMin = ground ? ground.x + 8 : enemy.patrolMin;
          const patrolMax = ground ? ground.x + ground.w - enemy.w - 8 : enemy.patrolMax;
          const enemySpeed = enemy.pause > 0 ? 0 : 0.72 + noise(enemy.x * 0.13 + enemy.wander * 0.021) * 0.28;
          const nextEnemyX = enemy.x + enemy.dir * enemySpeed;
          const nextLeftFoot = nextEnemyX + 8;
          const nextRightFoot = nextEnemyX + enemy.w - 8;
          const nextStillSupported = ground
            ? nextLeftFoot >= ground.x &&
              nextRightFoot <= ground.x + ground.w &&
              supportedFeet >= ground.y - 6 &&
              supportedFeet <= ground.y + 14
            : false;
          if (!nextStillSupported || nextEnemyX <= patrolMin || nextEnemyX >= patrolMax || patrolMax <= patrolMin) {
            enemy.dir *= -1;
            enemy.pause = 8 + Math.floor(noise(enemy.x * 0.29 + supportedFeet * 0.013) * 18);
            enemy.x = Math.max(patrolMin, Math.min(patrolMax, enemy.x));
          } else {
            enemy.x = nextEnemyX;
          }
          const hitShot = projectiles.current.find((shot) => overlaps(shot, enemy));
          if (hitShot) {
            hitShot.life = 0;
            defeatEnemy(enemy, "kick");
            return;
          }
          const stomped = wasFalling && previousY + p.h <= enemy.y + 14 && overlaps(p, enemy);
          if (stomped) {
            defeatEnemy(enemy, "stomp");
            p.y = enemy.y - p.h - 2;
            p.vy = -10.5;
            p.grounded = false;
            p.land = 12;
          } else if (p.attack > 5 && overlaps(kickBox, enemy)) {
            defeatEnemy(enemy, "kick");
          } else if (overlaps(p, enemy)) {
            damagePlayer(ENEMY_DAMAGE, enemy.x + enemy.w / 2);
          }
        });
        const poofFlyingEnemy = (enemy: FlyingEnemy) => {
          enemy.alive = false;
          enemy.dead = 34;
          enemy.puff = 34;
          playSound("hit");
          setHud((value) => ({ ...value, message: "Phooffff" }));
        };
        map.flyingEnemies.forEach((enemy) => {
          if (!enemy.alive) {
            enemy.dead = Math.max(0, enemy.dead - 1);
            enemy.puff = Math.max(0, enemy.puff - 1);
            return;
          }
          enemy.hurt = Math.max(0, enemy.hurt - 1);
          enemy.x += enemy.dir * 1.45;
          enemy.y = enemy.baseY + Math.sin(performance.now() / 260 + enemy.flap) * 18;
          if (enemy.x <= enemy.patrolMin || enemy.x + enemy.w >= enemy.patrolMax) enemy.dir *= -1;
          const hitShot = projectiles.current.find((shot) => overlaps(shot, enemy));
          if (hitShot) {
            hitShot.life = 0;
            poofFlyingEnemy(enemy);
            return;
          }
          const stomped = wasFalling && previousY + p.h <= enemy.y + 14 && overlaps(p, enemy);
          if (stomped) {
            poofFlyingEnemy(enemy);
            p.y = enemy.y - p.h - 2;
            p.vy = -10.5;
            p.grounded = false;
            p.land = 12;
            return;
          }
          if (overlaps(p, enemy)) damagePlayer(ENEMY_DAMAGE, enemy.x + enemy.w / 2);
        });
        projectiles.current = projectiles.current.filter((shot) => shot.life > 0);

        const inWaterPot = map.water.some((water) =>
          overlaps(p, { x: water.x + 8, y: water.y + water.h - 16, w: Math.max(8, water.w - 16), h: 22 }),
        );
        if ((map.hazards.some((hazard) => overlaps(p, hazard)) || inWaterPot || p.y > HEIGHT + 120) && p.hurt === 0) loseLife();
        if (overlaps(p, map.goal) && !levelTransition.current) {
          const bossState = boss.current;
          if (map.finalCastle && bossState && (!bossState.defeated || bossState.alive)) {
            startAudio();
            startBossMusic();
            if (bossState.alive) {
              bossState.active = true;
              if (bossState.biome === "forest" && bossState.phase === "idle") {
                bossState.phase = "entering";
                bossState.y = -170;
                bossState.x = Math.max(0, Math.min(LEVEL_END - bossState.w, p.x + 240));
                bossState.vx = 0;
                bossState.vy = 0;
              } else if (bossState.phase === "idle") {
                bossState.phase = "chasing";
              }
              bossState.intro = 45;
              bossState.attackTimer = bossState.biome === "forest" ? 95 : 80;
              bossState.jumpFrames = 0;
              camera.current = 4260;
              beep(58, 0.26, "sawtooth", 0.13, -18);
              window.setTimeout(() => beep(116, 0.2, "square", 0.08, -36), 120);
              setHud((value) => ({ ...value, message: bossState.biome === "forest" ? "Root Guardian is falling from above" : `${biomeStyle(bossState.biome).boss} blocks the gate` }));
            }
          } else {
            completeLevel();
          }
        }
        const cameraBoss = boss.current;
        if (map.finalCastle && cameraBoss?.active && cameraBoss.alive && !cameraBoss.defeated && cameraBoss.biome !== "forest") {
          camera.current = Math.max(BOSS_ARENA_LEFT - 40, Math.min(BOSS_ARENA_RIGHT - WIDTH + 120, p.x - 280));
        } else {
          camera.current = Math.max(0, Math.min(LEVEL_END - WIDTH + 140, p.x - 280));
        }
      }

      draw();
      raf.current = requestAnimationFrame(tick);
    };

    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [assetsReady, damagePlayer, gameOver, hud, loseLife, playSound, screen, soundOn, startBossMusic, startLevelLoading, stopBossMusic, won]);

  const press = (key: ButtonKey, active: boolean) => {
    if (screen !== "playing") return;
    startAudio();
    keys.current[key] = active;
  };
  const clickFire = () => {
    if (screen !== "playing") return;
    startAudio();
    keys.current.fire = true;
    window.setTimeout(() => {
      keys.current.fire = false;
    }, 90);
  };

  return (
    <main className="game-shell">
      <section className="game-stage" aria-label="Alex Kido Remake platform game" onClick={clickFire}>
        <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} />
        {screen === "playing" && !gameOver && (
          <div className="top-actions" onClick={(event) => event.stopPropagation()}>
            <h1>{levelLabel}</h1>
            <div className="top-buttons">
              <button onClick={soundOn ? stopAudio : startAudio}>{soundOn ? "Sound On" : "Sound Off"}</button>
              <button onClick={returnToMenu}>Menu</button>
              <button onClick={restart}>Restart</button>
            </div>
          </div>
        )}
        {enableNewCoreLoop && (
          <aside className="core-loop-panel" onClick={(event) => event.stopPropagation()} aria-label="New core loop status">
            <strong>New Loop (Preview)</strong>
            <span>{coreLoop.hud.statusLabel}</span>
            <span>{coreLoop.hud.hpLabel}</span>
            <span>{coreLoop.hud.shardLabel}</span>
            <span>{coreLoop.hud.multiplierLabel}</span>
            <span>{coreLoop.hud.zoneLabel}</span>
            <span>{coreLoop.hud.runTimeLabel}</span>
          </aside>
        )}
        {screen === "playing" && !gameOver && (
          <div className="controls" aria-label="Touch controls" onClick={(event) => event.stopPropagation()}>
            <div className="move-pad">
              <button onPointerDown={() => press("left", true)} onPointerUp={() => press("left", false)} onPointerLeave={() => press("left", false)}>
                Left
              </button>
              <button onPointerDown={() => press("right", true)} onPointerUp={() => press("right", false)} onPointerLeave={() => press("right", false)}>
                Right
              </button>
            </div>
            <div className="action-pad">
              <button onPointerDown={() => press("fire", true)} onPointerUp={() => press("fire", false)} onPointerLeave={() => press("fire", false)}>
                Fire
              </button>
              <button onPointerDown={() => press("kick", true)} onPointerUp={() => press("kick", false)} onPointerLeave={() => press("kick", false)}>
                Kick
              </button>
              <button onPointerDown={() => press("jump", true)} onPointerUp={() => press("jump", false)} onPointerLeave={() => press("jump", false)}>
                Jump
              </button>
            </div>
          </div>
        )}
        {screen === "playing" && gameOver && (
          <div className="game-over-screen" onClick={(event) => event.stopPropagation()}>
            <div className="game-over-panel">
              <span>Game Over</span>
              <h1>{levelLabel}</h1>
              <p>Restart the stage or quit to the main menu.</p>
              <div className="game-over-actions">
                <button onClick={restartLevel}>Restart Level</button>
                <button onClick={returnToMenu}>Quit</button>
              </div>
            </div>
          </div>
        )}
        {screen === "loading" && (
          <div className="loading-screen" onClick={(event) => event.stopPropagation()}>
            <div className="loading-panel">
              <span>{loadingInfo.world}</span>
              <h1>{loadingInfo.level}</h1>
              <div className="loading-meter" aria-label="Loading progress">
                <div style={{ width: `${loadingInfo.progress}%` }} />
              </div>
              <p>{loadingInfo.status}</p>
              <div className="loading-stats">
                <strong>Coins {loadingInfo.coins}</strong>
                <strong>Lives {loadingInfo.lives}</strong>
                <strong>Fire {loadingInfo.fire}</strong>
                <strong>Power {loadingInfo.power}</strong>
              </div>
            </div>
          </div>
        )}
        {screen === "menu" && (
          <div className="title-screen" onClick={(event) => event.stopPropagation()}>
            {menuScreen === "main" && (
              <>
                <div className="title-copy">
                  <span>Castle Run</span>
                  <h1>Alex Kido Remake</h1>
                  <p>{hasProgress ? `Continue from ${levelLabel} or start over from 1.1.` : "Journey through 10 worlds, from forest gates to the Shadow Crown Castle."}</p>
                </div>
                <div className="title-menu" aria-label="Start menu">
                  <button onClick={startNewGame}>New Game</button>
                  <button onClick={continueGame} disabled={!hasProgress}>
                    Continue
                  </button>
                  <button onClick={() => setMenuScreen("levels")}>Level Select</button>
                  <button onClick={toggleTitleMusic}>{titleMusicOn ? "Title Music On" : "Title Music Off"}</button>
                </div>
              </>
            )}
            {menuScreen === "levels" && (
              <div className="level-select level-select-screen" aria-label="World and level selection">
                <div className="level-select-heading">
                  <div>
                    <span>World Select</span>
                    <h1>Choose Level</h1>
                  </div>
                  <button onClick={() => setMenuScreen("main")}>Back</button>
                </div>
                <div className="world-level-list">
                  {WORLD_DEFINITIONS.map((world, worldIndex) => (
                    <section className="world-level-card" key={world.world}>
                      <div className="world-level-title">
                        <span>World {world.world}</span>
                        <h2>{world.name}</h2>
                        <p>{world.boss}</p>
                      </div>
                      <div className="world-stage-grid">
                        {WORLD_LEVELS.slice(worldIndex * 5, worldIndex * 5 + 5).map((worldLevel, localIndex) => (
                          <button key={worldLevel.id} onClick={() => startSelectedLevel(worldIndex * 5 + localIndex)}>
                            <span>{worldLevel.id}</span>
                            {worldLevel.name}
                            {worldLevel.finalCastle ? " - Boss" : ""}
                          </button>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
