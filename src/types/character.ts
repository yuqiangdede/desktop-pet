export interface CharacterLayer {
  file: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CharacterIdleAction {
  id: string;
  name: string;
  path: string;
  frameCount: number;
  fps: number;
  weight: number;
  loop?: boolean;
}

export interface CharacterConfig {
  id: string;
  name: string;
  version: string;
  canvas: {
    width: number;
    height: number;
  };
  layers: {
    body: CharacterLayer;
    head: CharacterLayer;
    eyeOpen: CharacterLayer;
    eyeClose: CharacterLayer;
  };
  animation: {
    blink: boolean;
    headShake: boolean;
    float: boolean;
    idleActions?: CharacterIdleAction[];
  };
}

export interface CharacterInfo {
  id: string;
  name: string;
  path: string;
  assetBaseUrl: string;
  config: CharacterConfig;
  builtin: boolean;
}
