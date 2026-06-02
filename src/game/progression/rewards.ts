import type { SimulationEvent, WorldState } from "@/game/core/types";

export type ProgressionReward = {
  unlockedPerks: string[];
  newShardTotal: number;
};

export const applyRunEventProgression = (
  world: WorldState,
  events: SimulationEvent[],
): ProgressionReward => {
  let newShardTotal = world.run.shardsBanked;
  const unlockedPerks: string[] = [];

  for (const event of events) {
    if (event.type === "checkpoint_banked") {
      newShardTotal = event.totalBanked;
      if (newShardTotal >= 100) {
        unlockedPerks.push("dash_mk1");
      }
      if (newShardTotal >= 220) {
        unlockedPerks.push("relic_magnet");
      }
    }
  }

  return {
    unlockedPerks,
    newShardTotal,
  };
};
