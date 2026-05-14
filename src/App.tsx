import { ChatPanel } from "./pages/ChatPanel";
import { PetWindow } from "./pages/PetWindow";
import { SettingsWindow } from "./pages/SettingsWindow";

function getWindowName() {
  return new URLSearchParams(window.location.search).get("window") ?? "pet";
}

export default function App() {
  const windowName = getWindowName();
  if (windowName === "chat") return <ChatPanel />;
  if (windowName === "settings") return <SettingsWindow />;
  return <PetWindow />;
}
