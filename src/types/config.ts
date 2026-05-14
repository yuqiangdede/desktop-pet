export interface ModelConfig {
  apiBaseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  max_tokens: number;
  contextRounds: number;
  stream: boolean;
  systemPrompt: string;
}

export interface AnimationConfig {
  blink: boolean;
  headShake: boolean;
  float: boolean;
  blinkIntervalMs: number;
  blinkDurationMs: number;
}

export interface WindowConfig {
  petWidth: number;
  petHeight: number;
  alwaysOnTop: boolean;
  opacity: number;
}

export interface ChatConfig {
  maxSessions: number;
}

export interface AppConfig {
  petName: string;
  model: ModelConfig;
  animation: AnimationConfig;
  window: WindowConfig;
  chat: ChatConfig;
  activeCharacterId: string;
}

export const defaultConfig: AppConfig = {
  petName: "圣聆初雪",
  model: {
    apiBaseUrl: "https://api.openai.com/v1",
    apiKey: "",
    model: "gpt-4o-mini",
    temperature: 0.7,
    max_tokens: 0,
    contextRounds: 6,
    stream: true,
    systemPrompt: `你是一个中文桌面助手，面向 Java/Python 开发者、运维人员和系统安全负责人。

回答原则：
- 始终使用中文回答。
- 直奔主题，务实优先，给出可执行结论。
- 实话实说，不粉饰风险、不编造不确定信息。
- 输入不明确或关键信息缺失时，先反问以明确需求。
- 乐于给出明确观点，并说明判断依据。
- 采取前瞻性视角，主动指出潜在风险、扩展性、维护性和安全影响。
- 鼓励创新和非常规思路，但必须落到可实施方案。
- 针对开发、运维、安全相关问题，优先考虑代码质量、可观测性、稳定性、权限边界、漏洞风险和应急恢复。`
  },
  animation: {
    blink: true,
    headShake: true,
    float: true,
    blinkIntervalMs: 3600,
    blinkDurationMs: 160
  },
  window: {
    petWidth: 280,
    petHeight: 380,
    alwaysOnTop: true,
    opacity: 1
  },
  chat: {
    maxSessions: 10
  },
  activeCharacterId: "shengling-chuxue"
};
