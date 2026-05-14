import { useEffect, useMemo, useRef, useState } from "react";
import { Settings } from "lucide-react";
import { CharacterRenderer } from "../components/CharacterRenderer";
import { useAppStore } from "../store/appStore";
import { useConfigStore } from "../store/configStore";

export function PetWindow() {
  const { config, load, subscribeToChanges } = useConfigStore();
  const { characters, loadCharacters } = useAppStore();
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const lastMissingCharacterReloadId = useRef<string | null>(null);
  const moved = useRef(false);

  useEffect(() => {
    subscribeToChanges();
    load();
    loadCharacters();
  }, [load, loadCharacters, subscribeToChanges]);

  useEffect(() => {
    if (!config?.activeCharacterId) return;
    if (characters.some((item) => item.id === config.activeCharacterId)) {
      lastMissingCharacterReloadId.current = null;
      return;
    }
    if (lastMissingCharacterReloadId.current === config.activeCharacterId) return;
    lastMissingCharacterReloadId.current = config.activeCharacterId;
    loadCharacters();
  }, [characters, config?.activeCharacterId, loadCharacters]);

  const activeCharacter = useMemo(() => {
    return characters.find((item) => item.id === config?.activeCharacterId) ?? characters[0];
  }, [characters, config?.activeCharacterId]);

  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      if ((!dragging && !resizing) || !lastPoint.current) return;
      const delta = { x: event.screenX - lastPoint.current.x, y: event.screenY - lastPoint.current.y };
      if (Math.abs(delta.x) > 1 || Math.abs(delta.y) > 1) moved.current = true;
      lastPoint.current = { x: event.screenX, y: event.screenY };
      if (resizing) {
        window.desktopPet.window.resizePet(delta).then((nextConfig) => {
          if (nextConfig) useConfigStore.setState({ config: nextConfig });
        });
      } else {
        window.desktopPet.window.dragMove(delta);
      }
    };
    const onUp = () => {
      setDragging(false);
      setResizing(false);
      lastPoint.current = null;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging, resizing]);

  if (!config || !activeCharacter) {
    return (
      <main className="pet-shell pet-shell--loading">
        <div className="pet-fallback">加载桌宠中</div>
      </main>
    );
  }

  return (
    <main
      className="pet-shell"
      onMouseDown={(event) => {
        if (event.button !== 0) return;
        moved.current = false;
        lastPoint.current = { x: event.screenX, y: event.screenY };
        setDragging(true);
      }}
      onClick={() => {
        if (!moved.current) window.desktopPet.window.toggleChat();
      }}
    >
      <button
        className="pet-settings"
        title="设置"
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          window.desktopPet.window.openSettings();
        }}
      >
        <Settings size={16} />
      </button>
      <CharacterRenderer character={activeCharacter} config={config} />
      <button
        className="pet-resize-handle"
        title="拖动调整大小"
        onMouseDown={(event) => {
          event.stopPropagation();
          moved.current = true;
          lastPoint.current = { x: event.screenX, y: event.screenY };
          setResizing(true);
        }}
        onClick={(event) => event.stopPropagation()}
      />
    </main>
  );
}
