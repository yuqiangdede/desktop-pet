import { useEffect, useState } from "react";
import { SettingForm } from "../components/SettingForm";
import { characterService } from "../services/characterService";
import { openaiClient } from "../services/openaiClient";
import { useAppStore } from "../store/appStore";
import { useConfigStore } from "../store/configStore";
import type { AppConfig } from "../types/config";

export function SettingsWindow() {
  const { config, error: configError, load, save, reset } = useConfigStore();
  const { characters, error: characterError, loadCharacters, importCharacter } = useAppStore();
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    load();
    loadCharacters();
  }, [load, loadCharacters]);

  const saveConfig = async (draft: AppConfig) => {
    if (draft.activeCharacterId) {
      await characterService.setActive(draft.activeCharacterId);
    }
    await save(draft);
    setStatus("配置已保存");
  };

  const changeCharacter = async (id: string) => {
    await characterService.setActive(id);
    setStatus("角色已切换");
  };

  const resetAll = async () => {
    await reset();
    await characterService.restoreDefault();
    setStatus("已恢复默认配置");
  };

  const testConnection = async (draft: AppConfig) => {
    setStatus("正在测试连接...");
    const result = await openaiClient.testConnection(draft);
    setStatus(result.message);
  };

  const importRole = async () => {
    await importCharacter();
    await loadCharacters();
    setStatus("角色列表已更新");
  };

  if (!config) {
    return <main className="settings-shell">加载设置中</main>;
  }

  return (
    <main className="settings-shell">
      <header className="settings-header">
        <div>
          <h1>Desktop Pet 设置</h1>
          <p>模型、角色、动画和窗口参数</p>
        </div>
      </header>
      {(configError || characterError) && <div className="error-banner">{configError || characterError}</div>}
      <SettingForm
        config={config}
        characters={characters}
        status={status}
        onSave={saveConfig}
        onReset={resetAll}
        onTest={testConnection}
        onImport={importRole}
        onCharacterChange={changeCharacter}
      />
    </main>
  );
}
