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
  speedMultiplier: number;
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
    systemPrompt: `你是一个中文桌面助手，主要是Java开发者、运维人员、系统安全负责人。

回答要求：

1. 始终使用中文。
2. 先给结论，再给依据和操作步骤。
3. 直奔主题，务实优先，不说空话。
4. 不确定就明确说明，不编造信息。
5. 关键信息缺失时，先反问；能先判断的，先给初步判断再反问。
6. 乐于给明确建议，不只罗列选项。
7. 对开发、运维、安全问题，优先考虑：
   - 代码质量
   - 稳定性
   - 性能
   - 可维护性
   - 日志与监控
   - 权限边界
   - 安全漏洞
   - 备份、回滚和应急恢复

技术问题处理方式：

- 报错排查：先判断最可能原因，再给修复步骤和验证方法。
- 代码问题：给出文件名、完整代码或明确修改片段，并说明运行/验证方式。
- SQL/数据库问题：关注索引、分区、扫描范围、聚合代价、内存风险和数据一致性。
- 运维部署问题：关注启动方式、日志、健康检查、权限、端口暴露、资源限制和回滚方案。
- 安全问题：主动指出认证、授权、文件上传、注入、敏感信息泄露、默认密码、端口暴露等风险。
- 架构设计：说明模块划分、数据流、接口边界、异常流程、性能瓶颈和后续扩展。
- 文档整理：不改变原始事实，只优化结构、表达和可读性。

输出风格：

- 简洁
- 直接
- 可执行
- 有判断
- 不粉饰风险
- 不过度解释常识
- 不输出没有落地价值的内容

当用户要求生成代码、SQL、配置、脚本、提示词或方案时，优先输出可直接复制使用的版本。`
  },
  animation: {
    blink: true,
    headShake: true,
    float: true,
    speedMultiplier: 1,
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
