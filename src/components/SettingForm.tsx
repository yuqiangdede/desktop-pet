import { Film, Image, RotateCcw, Save, TestTube2, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { AppConfig } from "../types/config";
import type { CharacterInfo } from "../types/character";

interface SettingFormProps {
  config: AppConfig;
  characters: CharacterInfo[];
  status: string | null;
  onSave: (config: AppConfig) => Promise<void>;
  onReset: () => Promise<void>;
  onTest: (config: AppConfig) => Promise<void>;
  onImportVideo: () => Promise<void>;
  onImportImage: () => Promise<void>;
  onDeleteCharacter: (id: string) => Promise<void>;
  onCharacterChange: (id: string) => Promise<void>;
}

export function SettingForm({
  config,
  characters,
  status,
  onSave,
  onReset,
  onTest,
  onImportVideo,
  onImportImage,
  onDeleteCharacter,
  onCharacterChange
}: SettingFormProps) {
  const [draft, setDraft] = useState(config);

  useEffect(() => {
    setDraft(config);
  }, [config]);

  const model = draft.model;
  const windowConfig = draft.window;
  const chatConfig = draft.chat;
  const selectedCharacter = characters.find((character) => character.id === draft.activeCharacterId);
  const canDeleteSelectedCharacter = Boolean(selectedCharacter && !selectedCharacter.builtin);
  const changeCharacter = (id: string) => {
    const selected = characters.find((character) => character.id === id);
    setDraft({ ...draft, activeCharacterId: id, petName: selected?.config.name ?? draft.petName });
    onCharacterChange(id);
  };

  return (
    <div className="settings-layout">
      <section className="settings-section settings-section--model">
        <h2>模型接口</h2>
        <label>
          API Base URL
          <input
            value={model.apiBaseUrl}
            onChange={(event) => setDraft({ ...draft, model: { ...model, apiBaseUrl: event.target.value } })}
            placeholder="https://api.openai.com/v1"
          />
        </label>
        <label>
          API Key
          <input
            type="password"
            value={model.apiKey}
            onChange={(event) => setDraft({ ...draft, model: { ...model, apiKey: event.target.value } })}
            placeholder="sk-..."
          />
        </label>
        <label>
          Model
          <input value={model.model} onChange={(event) => setDraft({ ...draft, model: { ...model, model: event.target.value } })} />
        </label>
        <div className="form-grid">
          <label>
            Temperature
            <input
              type="number"
              min="0"
              max="2"
              step="0.1"
              value={model.temperature}
              onChange={(event) => setDraft({ ...draft, model: { ...model, temperature: Number(event.target.value) } })}
            />
          </label>
          <label>
            Max Tokens
            <input
              type="number"
              min="0"
              max="8192"
              value={model.max_tokens}
              onChange={(event) => setDraft({ ...draft, model: { ...model, max_tokens: Number(event.target.value) } })}
            />
          </label>
        </div>
        <div className="form-grid">
          <label>
            Context Rounds
            <input
              type="number"
              min="0"
              max="50"
              value={model.contextRounds}
              onChange={(event) => setDraft({ ...draft, model: { ...model, contextRounds: Number(event.target.value) } })}
            />
          </label>
          <label>
            Max Sessions
            <input
              type="number"
              min="1"
              max="100"
              value={chatConfig.maxSessions}
              onChange={(event) =>
                setDraft({ ...draft, chat: { ...chatConfig, maxSessions: Number(event.target.value) } })
              }
            />
          </label>
        </div>
        <div className="settings-inline">
          <label className="check-row">
            <input
              type="checkbox"
              checked={model.stream}
              onChange={(event) => setDraft({ ...draft, model: { ...model, stream: event.target.checked } })}
            />
            Stream 流式输出
          </label>
        </div>
        <label>
          System Prompt
          <textarea
            rows={4}
            value={model.systemPrompt}
            onChange={(event) => setDraft({ ...draft, model: { ...model, systemPrompt: event.target.value } })}
          />
        </label>
      </section>

      <section className="settings-section">
        <h2>基础与角色</h2>
        <label>
          桌宠名称
          <input
            value={draft.petName}
            onChange={(event) => setDraft({ ...draft, petName: event.target.value })}
            placeholder="桌宠"
          />
        </label>
        <label>
          当前角色
          <select value={draft.activeCharacterId} onChange={(event) => changeCharacter(event.target.value)}>
            {characters.map((character) => (
              <option key={character.id} value={character.id}>
                {character.name}{character.builtin ? "（默认）" : ""}
              </option>
            ))}
          </select>
        </label>
        <button className="secondary-button" type="button" onClick={onImportVideo}>
          <Film size={16} /> 导入 WebM 文件
        </button>
        <button className="secondary-button" type="button" onClick={onImportImage}>
          <Image size={16} /> 导入 PNG 图片
        </button>
        <button
          className="danger-button"
          type="button"
          disabled={!canDeleteSelectedCharacter}
          onClick={() => onDeleteCharacter(draft.activeCharacterId)}
        >
          <Trash2 size={16} /> 删除当前角色
        </button>
      </section>

      <section className="settings-section">
        <h2>窗口设置</h2>
        <label>
          透明度
          <input
            type="range"
            min="0.3"
            max="1"
            step="0.05"
            value={windowConfig.opacity}
            onChange={(event) => setDraft({ ...draft, window: { ...windowConfig, opacity: Number(event.target.value) } })}
          />
        </label>
      </section>

      <section className="settings-section">
        <h2>动画设置</h2>
        <label>
          <span className="range-label">
            <span>动画速度</span>
            <span className="range-value">{draft.animation.speedMultiplier.toFixed(1)}x</span>
          </span>
          <input
            type="range"
            min="0.5"
            max="2"
            step="0.1"
            value={draft.animation.speedMultiplier}
            onChange={(event) =>
              setDraft({
                ...draft,
                animation: { ...draft.animation, speedMultiplier: Number(event.target.value) }
              })
            }
          />
        </label>
        <div className="settings-inline">
          <small className="settings-hint">控制眨眼、漂浮、摇头和空闲动作的整体运行速度。</small>
        </div>
      </section>

      <div className="settings-actions">
        {status && <div className="settings-status">{status}</div>}
        <button type="button" className="secondary-button" onClick={onReset}>
          <RotateCcw size={16} /> 恢复默认
        </button>
        <button type="button" className="secondary-button" onClick={() => onTest(draft)}>
          <TestTube2 size={16} /> 测试连接
        </button>
        <button type="button" className="primary-button" onClick={() => onSave(draft)}>
          <Save size={16} /> 保存
        </button>
      </div>
    </div>
  );
}
