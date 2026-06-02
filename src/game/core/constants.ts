import type { ActionState } from "./types";

export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;
export const TARGET_FPS = 60;
export const FIXED_DT_MS = 1000 / TARGET_FPS;
export const MAX_FRAME_DT_MS = 100;

export const SESSION_TARGET_MIN_MS = 8 * 60 * 1000;
export const SESSION_TARGET_MAX_MS = 12 * 60 * 1000;

export const DEFAULT_ACTIONS: ActionState = {
  move_left: false,
  move_right: false,
  jump: false,
  dash: false,
  attack: false,
  interact: false,
  pause: false,
};
