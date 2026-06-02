export type Vec2 = {
  x: number;
  y: number;
};

export type EntityId = string;

export type Rect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type EntityBase = Rect & {
  id: EntityId;
  alive: boolean;
};

export type ActionName =
  | "move_left"
  | "move_right"
  | "jump"
  | "dash"
  | "attack"
  | "interact"
  | "pause";

export type ActionState = Record<ActionName, boolean>;

export type Player = EntityBase & {
  kind: "player";
  velocity: Vec2;
  grounded: boolean;
  facing: -1 | 1;
  hp: number;
  maxHp: number;
  dashCooldownMs: number;
  attackCooldownMs: number;
};

export type EnemyArchetype = "melee_grunt" | "ranged_harrier" | "chaser";

export type Enemy = EntityBase & {
  kind: "enemy";
  archetype: EnemyArchetype;
  velocity: Vec2;
  hp: number;
  damage: number;
  aggroRange: number;
};

export type RelicShard = EntityBase & {
  kind: "relic_shard";
  value: number;
  collected: boolean;
};

export type Checkpoint = EntityBase & {
  kind: "checkpoint";
  active: boolean;
  bankedShards: number;
};

export type Hazard = EntityBase & {
  kind: "hazard";
  damage: number;
  instantKill: boolean;
};

export type DistrictId = "district_1" | "district_2" | "district_3";

export type RunState = {
  district: DistrictId;
  zoneIndex: number;
  hp: number;
  maxHp: number;
  shardsUnbanked: number;
  shardsBanked: number;
  scoreMultiplier: number;
  runTimeMs: number;
  extracted: boolean;
  dead: boolean;
};

export type WorldState = {
  frame: number;
  nowMs: number;
  player: Player;
  enemies: Enemy[];
  relicShards: RelicShard[];
  checkpoints: Checkpoint[];
  hazards: Hazard[];
  run: RunState;
};

export type SimulationTickInput = {
  dtMs: number;
  actions: ActionState;
};

export type SimulationResult = {
  state: WorldState;
  events: SimulationEvent[];
};

export type SimulationEvent =
  | { type: "player_damaged"; amount: number }
  | { type: "player_died" }
  | { type: "enemy_defeated"; id: EntityId }
  | { type: "shard_collected"; value: number }
  | { type: "checkpoint_banked"; totalBanked: number }
  | { type: "run_extracted"; banked: number };
