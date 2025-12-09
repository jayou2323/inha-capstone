import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

function updateScale() {
  const root = document.getElementById("root");
  if (!root) return;

  const designWidth = 720;
  const designHeight = 1280;

  const windowWidth = window.innerWidth;
  const windowHeight = window.innerHeight;

  const scaleX = windowWidth / designWidth;
  const scaleY = windowHeight / designHeight;
  const scale = Math.min(scaleX, scaleY, 1);

  root.style.setProperty("--scale", scale.toString());
}

createRoot(document.getElementById("root")!).render(<App />);

setTimeout(updateScale, 0);

window.addEventListener("resize", updateScale);
