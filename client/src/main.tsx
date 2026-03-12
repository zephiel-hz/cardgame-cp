import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Set title immediately
document.title = 'Card Game Couple ❤️';

const root = document.getElementById("root");
if (!root) {
  throw new Error("Root element #root not found!");
}

createRoot(root).render(<App />);
