import { useEffect, useState } from "react";
import { SettingForm } from "../components/SettingForm";
import { characterService } from "../services/characterService";
import { openaiClient } from "../services/openaiClient";
import { useAppStore } from "../store/appStore";
import { useConfigStore } from "../store/configStore";
import type { AppConfig } from "../types/config";

export function SettingsWindow() {
  const { config, error: configError, load, save, reset, subscribeToChanges } = useConfigStore();
  const {
    characters,
    error: characterError,
    loadCharacters,
    importVideoCharacter,
    importImageCharacter,
    deleteCharacter
  } = useAppStore();
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    subscribeToChanges();
    load();
    loadCharacters();
  }, [load, loadCharacters, subscribeToChanges]);

  const saveConfig = async (draft: AppConfig) => {
    if (draft.activeCharacterId) {
      await characterService.setActive(draft.activeCharacterId);
    }
    await save(draft);
    setStatus("配置已保存");
  };

  const changeCharacter = async (id: string) => {
    useConfigStore.setState({ config: await characterService.setActive(id) });
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

  const importVideoRole = async () => {
    const imported = await importVideoCharacter();
    if (imported) {
      useConfigStore.setState({ config: await characterService.setActive(imported.id) });
    }
    await load();
    await loadCharacters();
    setStatus(imported ? "WebM 角色已导入并切换" : "已取消导入");
  };

  const importImageRole = async () => {
    const imported = await importImageCharacter();
    if (imported) {
      useConfigStore.setState({ config: await characterService.setActive(imported.id) });
    }
    await load();
    await loadCharacters();
    setStatus(imported ? "PNG 角色已导入并切换" : "已取消导入");
  };

  const deleteRole = async (id: string) => {
    const selected = characters.find((character) => character.id === id);
    if (!selected) {
      setStatus("未找到要删除的角色");
      return;
    }
    if (selected.builtin) {
      setStatus("内置角色不能删除");
      return;
    }
    const confirmed = window.confirm(`确定删除角色「${selected.name}」吗？`);
    if (!confirmed) {
      setStatus("已取消删除");
      return;
    }

    const deleted = await deleteCharacter(id);
    await load();
    await loadCharacters();
    setStatus(deleted ? "角色已删除" : "删除角色失败");
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
        onImportVideo={importVideoRole}
        onImportImage={importImageRole}
        onDeleteCharacter={deleteRole}
        onCharacterChange={changeCharacter}
      />
    </main>
  );
}
