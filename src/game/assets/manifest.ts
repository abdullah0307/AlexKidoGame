export type ManifestGroup = "characters" | "environment" | "ui" | "audio" | "fx";

export type ManifestAsset = {
  key: string;
  path: string;
  group: ManifestGroup;
};

export const GAME_ASSET_MANIFEST: ManifestAsset[] = [
  { key: "player_idle", path: "/assets/sprites/player_idle.png", group: "characters" },
  { key: "enemy_grunt", path: "/assets/sprites/enemy_grunt.png", group: "characters" },
  { key: "district_1_tiles", path: "/assets/sprites/district_1_tiles.png", group: "environment" },
  { key: "ui_hud_frame", path: "/assets/sprites/ui_hud_frame.png", group: "ui" },
  { key: "sfx_shard", path: "/assets/audio/mixkit/coin.wav", group: "audio" },
  { key: "sfx_checkpoint", path: "/assets/audio/mixkit/checkpoint.wav", group: "audio" },
  { key: "fx_hit", path: "/assets/sprites/fx_hit.png", group: "fx" },
];

export const listManifestByGroup = (group: ManifestGroup): ManifestAsset[] =>
  GAME_ASSET_MANIFEST.filter((asset) => asset.group === group);
