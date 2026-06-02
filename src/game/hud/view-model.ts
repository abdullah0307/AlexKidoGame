import type { RenderSnapshot } from "@/game/render/contracts";

export type HudViewModel = {
  hpLabel: string;
  shardLabel: string;
  multiplierLabel: string;
  zoneLabel: string;
  runTimeLabel: string;
  statusLabel: string;
};

const toClock = (ms: number) => {
  const total = Math.floor(ms / 1000);
  const minutes = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (total % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
};

export const projectHud = (snapshot: RenderSnapshot): HudViewModel => {
  const { run, player } = snapshot.world;

  return {
    hpLabel: `HP ${player.hp}/${player.maxHp}`,
    shardLabel: `Shards ${run.shardsUnbanked} (+${run.shardsBanked} banked)`,
    multiplierLabel: `x${run.scoreMultiplier.toFixed(1)}`,
    zoneLabel: `District ${run.district.replace("district_", "")} - Zone ${run.zoneIndex + 1}`,
    runTimeLabel: `Time ${toClock(run.runTimeMs)}`,
    statusLabel: run.dead ? "Run Failed" : run.extracted ? "Extracted" : "In Run",
  };
};
