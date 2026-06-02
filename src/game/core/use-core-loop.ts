import { useEffect, useMemo, useRef, useState } from "react";

import { FIXED_DT_MS, MAX_FRAME_DT_MS } from "@/game/core/constants";
import type { ActionState, WorldState } from "@/game/core/types";
import { projectHud, type HudViewModel } from "@/game/hud/view-model";
import { bindKeyboardInput, createActionState } from "@/game/input/actions";
import { applyRunEventProgression } from "@/game/progression/rewards";
import { createDefaultCamera, makeRenderSnapshot } from "@/game/render/contracts";
import { createInitialWorldState, tickSimulation } from "@/game/sim/world";

export type CoreLoopState = {
  world: WorldState;
  hud: HudViewModel;
};

export const useCoreLoop = (enabled: boolean): CoreLoopState => {
  const [world, setWorld] = useState<WorldState>(() => createInitialWorldState());
  const actionsRef = useRef<ActionState>(createActionState());
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const accRef = useRef(0);
  const camera = useMemo(() => createDefaultCamera(), []);

  useEffect(() => {
    if (!enabled) return;
    const unbind = bindKeyboardInput(actionsRef.current);
    return () => unbind();
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    const loop = (now: number) => {
      const last = lastTimeRef.current ?? now;
      const frameDt = Math.min(MAX_FRAME_DT_MS, now - last);
      lastTimeRef.current = now;
      accRef.current += frameDt;

      setWorld((previous) => {
        let next = previous;
        while (accRef.current >= FIXED_DT_MS) {
          const result = tickSimulation(next, {
            dtMs: FIXED_DT_MS,
            actions: actionsRef.current,
          });
          applyRunEventProgression(result.state, result.events);
          next = result.state;
          accRef.current -= FIXED_DT_MS;
        }
        return next;
      });

      rafRef.current = window.requestAnimationFrame(loop);
    };

    rafRef.current = window.requestAnimationFrame(loop);
    return () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
      }
    };
  }, [enabled]);

  const hud = useMemo(() => projectHud(makeRenderSnapshot(world, camera)), [world, camera]);

  return { world, hud };
};
