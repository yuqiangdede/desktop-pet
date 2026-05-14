import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { AppConfig } from "../types/config";
import type { CharacterIdleAction, CharacterInfo, CharacterLayer } from "../types/character";

interface CharacterRendererProps {
  character: CharacterInfo;
  config: AppConfig;
}

function layerStyle(layer: CharacterLayer): CSSProperties {
  return {
    left: layer.x,
    top: layer.y,
    width: layer.width,
    height: layer.height
  };
}

function weightedIdleAction(actions: CharacterIdleAction[]) {
  const totalWeight = actions.reduce((sum, action) => sum + Math.max(0, action.weight), 0);
  if (totalWeight <= 0) return actions[Math.floor(Math.random() * actions.length)];

  let cursor = Math.random() * totalWeight;
  for (const action of actions) {
    cursor -= Math.max(0, action.weight);
    if (cursor <= 0) return action;
  }
  return actions[actions.length - 1];
}

function idleFrameFile(action: CharacterIdleAction, frameIndex: number) {
  return `${action.path}/frame-${String(frameIndex).padStart(3, "0")}.png`;
}

const SIMPLE_IDLE_CHARACTER_IDS = new Set(["default-girl", "default-boy", "golden-dog", "ragdoll-cat"]);

export function CharacterRenderer({ character, config }: CharacterRendererProps) {
  const { canvas, layers } = character.config;
  const animation = config.animation;
  const src = (file: string) => `${character.assetBaseUrl}/${file}?v=${encodeURIComponent(character.config.version)}`;
  const usableWidth = Math.max(1, config.window.petWidth - 8);
  const usableHeight = Math.max(1, config.window.petHeight - 8);
  const scale = Math.min(usableWidth / canvas.width, usableHeight / canvas.height);
  const idleActions = useMemo(
    () =>
      SIMPLE_IDLE_CHARACTER_IDS.has(character.config.id)
        ? []
        : (character.config.animation.idleActions ?? []).filter((action) => action.frameCount > 0 && action.fps > 0),
    [character.config.id, character.config.animation.idleActions]
  );
  const idleEnabled = idleActions.length > 0;
  const [idleState, setIdleState] = useState<{ action: CharacterIdleAction; frameIndex: number; loopCount: number } | null>(null);
  const idleStateRef = useRef(idleState);
  const hasScheduledIdleRef = useRef(false);

  useEffect(() => {
    idleStateRef.current = idleState;
  }, [idleState]);

  useEffect(() => {
    if (!idleEnabled) return;

    const imageCache: HTMLImageElement[] = [];
    for (const action of idleActions) {
      for (let index = 0; index < action.frameCount; index += 1) {
        const image = new Image();
        image.src = src(idleFrameFile(action, index));
        imageCache.push(image);
      }
    }
  }, [character.assetBaseUrl, idleActions, idleEnabled]);

  useEffect(() => {
    if (!idleEnabled) {
      setIdleState(null);
      hasScheduledIdleRef.current = false;
      return;
    }

    let startTimer: number | undefined;
    let frameTimer: number | undefined;
    let cancelled = false;

    const clearFrameTimer = () => {
      if (frameTimer !== undefined) {
        window.clearTimeout(frameTimer);
        frameTimer = undefined;
      }
    };

    const scheduleNextAction = (initial = false) => {
      if (cancelled) return;
      const delay = initial ? 700 : 1800 + Math.random() * 2600;
      startTimer = window.setTimeout(() => {
        const action = weightedIdleAction(idleActions);
        setIdleState({ action, frameIndex: 0, loopCount: 0 });
      }, delay);
    };

    const tickFrame = () => {
      const current = idleStateRef.current;
      if (!current || cancelled) return;

      const frameDelay = Math.max(40, Math.round(1000 / current.action.fps));
      frameTimer = window.setTimeout(() => {
        setIdleState((latest) => {
          if (!latest) return latest;
          if (latest.frameIndex < latest.action.frameCount - 1) {
            return { ...latest, frameIndex: latest.frameIndex + 1 };
          }
          if (latest.action.loop && latest.loopCount < 1) {
            return { ...latest, frameIndex: 0, loopCount: latest.loopCount + 1 };
          }
          scheduleNextAction();
          return null;
        });
      }, frameDelay);
    };

    if (idleState) {
      tickFrame();
    } else {
      const initial = !hasScheduledIdleRef.current;
      hasScheduledIdleRef.current = true;
      scheduleNextAction(initial);
    }

    return () => {
      cancelled = true;
      if (startTimer !== undefined) window.clearTimeout(startTimer);
      clearFrameTimer();
    };
  }, [idleActions, idleEnabled, idleState]);

  const idleFrameSrc = idleState ? src(idleFrameFile(idleState.action, idleState.frameIndex)) : null;

  return (
    <div className="character-stage">
      <div
        className={[
          "character",
          idleFrameSrc ? "character--idle-frame" : "",
          animation.float ? "character--float" : "",
          animation.headShake ? "character--shake" : ""
        ].join(" ")}
        style={{
          width: canvas.width,
          height: canvas.height,
          transform: `scale(${scale})`,
          ["--blink-interval" as string]: `${animation.blinkIntervalMs}ms`,
          ["--blink-duration" as string]: `${animation.blinkDurationMs}ms`
        }}
      >
        <img className="character__layer" style={layerStyle(layers.body)} src={src(layers.body.file)} alt="" draggable={false} />
        <img className="character__layer character__head" style={layerStyle(layers.head)} src={src(layers.head.file)} alt="" draggable={false} />
        <img
          className={["character__layer", "character__eyes", animation.blink ? "character__eyes--open" : ""].join(" ")}
          style={layerStyle(layers.eyeOpen)}
          src={src(layers.eyeOpen.file)}
          alt=""
          draggable={false}
        />
        <img
          className={["character__layer", "character__eyes", animation.blink ? "character__eyes--closed" : "is-hidden"].join(" ")}
          style={layerStyle(layers.eyeClose)}
          src={src(layers.eyeClose.file)}
          alt=""
          draggable={false}
        />
        {idleFrameSrc && (
          <img
            className="character__layer character__idle-frame"
            style={{ left: 0, top: 0, width: canvas.width, height: canvas.height }}
            src={idleFrameSrc}
            alt=""
            draggable={false}
          />
        )}
      </div>
    </div>
  );
}
