import type { WorldState } from "@/game/core/types";

export type CameraState = {
  x: number;
  y: number;
  zoom: number;
};

export type RenderSnapshot = {
  world: WorldState;
  camera: CameraState;
};

export const createDefaultCamera = (): CameraState => ({
  x: 0,
  y: 0,
  zoom: 1,
});

export const makeRenderSnapshot = (world: WorldState, camera: CameraState): RenderSnapshot => ({
  world,
  camera,
});
