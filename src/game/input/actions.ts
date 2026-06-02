import { DEFAULT_ACTIONS } from "@/game/core/constants";
import type { ActionState, ActionName } from "@/game/core/types";

const KEY_TO_ACTION: Record<string, ActionName> = {
  ArrowLeft: "move_left",
  ArrowRight: "move_right",
  ArrowUp: "jump",
  KeyA: "move_left",
  KeyD: "move_right",
  KeyW: "jump",
  Space: "jump",
  ShiftLeft: "dash",
  KeyJ: "attack",
  KeyE: "interact",
  Escape: "pause",
};

export const createActionState = (): ActionState => ({ ...DEFAULT_ACTIONS });

export const bindKeyboardInput = (actions: ActionState): (() => void) => {
  const onKeyDown = (event: KeyboardEvent) => {
    const action = KEY_TO_ACTION[event.code];
    if (!action) return;
    actions[action] = true;
  };

  const onKeyUp = (event: KeyboardEvent) => {
    const action = KEY_TO_ACTION[event.code];
    if (!action) return;
    actions[action] = false;
  };

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  return () => {
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
  };
};
