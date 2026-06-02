import type {
  ActionState,
  Checkpoint,
  Enemy,
  Hazard,
  Player,
  RelicShard,
  RunState,
  SimulationEvent,
  SimulationResult,
  SimulationTickInput,
  WorldState,
} from "@/game/core/types";

const makePlayer = (): Player => ({
  id: "player-1",
  kind: "player",
  x: 120,
  y: 320,
  w: 40,
  h: 56,
  alive: true,
  velocity: { x: 0, y: 0 },
  grounded: true,
  facing: 1,
  hp: 100,
  maxHp: 100,
  dashCooldownMs: 0,
  attackCooldownMs: 0,
});

const makeEnemies = (): Enemy[] => [
  {
    id: "enemy-1",
    kind: "enemy",
    archetype: "melee_grunt",
    x: 540,
    y: 334,
    w: 38,
    h: 48,
    alive: true,
    velocity: { x: 0, y: 0 },
    hp: 30,
    damage: 12,
    aggroRange: 220,
  },
];

const makeShards = (): RelicShard[] => [
  {
    id: "shard-1",
    kind: "relic_shard",
    x: 480,
    y: 300,
    w: 20,
    h: 20,
    alive: true,
    value: 15,
    collected: false,
  },
];

const makeCheckpoints = (): Checkpoint[] => [
  {
    id: "checkpoint-1",
    kind: "checkpoint",
    x: 760,
    y: 330,
    w: 52,
    h: 58,
    alive: true,
    active: false,
    bankedShards: 0,
  },
];

const makeHazards = (): Hazard[] => [
  {
    id: "hazard-1",
    kind: "hazard",
    x: 980,
    y: 390,
    w: 140,
    h: 40,
    alive: true,
    damage: 999,
    instantKill: true,
  },
];

const makeRunState = (): RunState => ({
  district: "district_1",
  zoneIndex: 0,
  hp: 100,
  maxHp: 100,
  shardsUnbanked: 0,
  shardsBanked: 0,
  scoreMultiplier: 1,
  runTimeMs: 0,
  extracted: false,
  dead: false,
});

export const createInitialWorldState = (): WorldState => ({
  frame: 0,
  nowMs: 0,
  player: makePlayer(),
  enemies: makeEnemies(),
  relicShards: makeShards(),
  checkpoints: makeCheckpoints(),
  hazards: makeHazards(),
  run: makeRunState(),
});

const intersects = (
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

const updatePlayerMovement = (state: WorldState, actions: ActionState) => {
  const speed = 4.2;
  const jumpImpulse = -11;
  const gravity = 0.65;
  const floorY = 390;

  if (actions.move_left) {
    state.player.velocity.x = -speed;
    state.player.facing = -1;
  } else if (actions.move_right) {
    state.player.velocity.x = speed;
    state.player.facing = 1;
  } else {
    state.player.velocity.x = 0;
  }

  if (actions.jump && state.player.grounded) {
    state.player.velocity.y = jumpImpulse;
    state.player.grounded = false;
  }

  state.player.velocity.y += gravity;
  state.player.x += state.player.velocity.x;
  state.player.y += state.player.velocity.y;

  if (state.player.y + state.player.h >= floorY) {
    state.player.y = floorY - state.player.h;
    state.player.velocity.y = 0;
    state.player.grounded = true;
  }
};

export const tickSimulation = (
  prevState: WorldState,
  input: SimulationTickInput,
): SimulationResult => {
  const state: WorldState = structuredClone(prevState);
  const events: SimulationEvent[] = [];

  state.frame += 1;
  state.nowMs += input.dtMs;
  state.run.runTimeMs += input.dtMs;

  updatePlayerMovement(state, input.actions);

  for (const shard of state.relicShards) {
    if (!shard.collected && intersects(state.player, shard)) {
      shard.collected = true;
      state.run.shardsUnbanked += shard.value;
      events.push({ type: "shard_collected", value: shard.value });
    }
  }

  for (const checkpoint of state.checkpoints) {
    if (intersects(state.player, checkpoint) && input.actions.interact && state.run.shardsUnbanked > 0) {
      checkpoint.active = true;
      state.run.shardsBanked += state.run.shardsUnbanked;
      state.run.shardsUnbanked = 0;
      events.push({ type: "checkpoint_banked", totalBanked: state.run.shardsBanked });
    }
  }

  for (const hazard of state.hazards) {
    if (intersects(state.player, hazard)) {
      if (hazard.instantKill) {
        state.player.hp = 0;
      } else {
        state.player.hp = Math.max(0, state.player.hp - hazard.damage);
      }
      events.push({ type: "player_damaged", amount: hazard.damage });
    }
  }

  if (state.player.hp <= 0 && !state.run.dead) {
    state.run.dead = true;
    state.player.alive = false;
    events.push({ type: "player_died" });
  }

  return { state, events };
};
