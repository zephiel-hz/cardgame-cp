import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Set title immediately
document.title = 'Card Game Couple ❤️';

createRoot(document.getElementById("root")!).render(<App />);
