import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Disable HMR (Hot Module Replacement) WebSocket to avoid errors
if (import.meta.hot) {
  import.meta.hot.on('vite:beforeUpdate', () => {
    console.log('Update detected, but WebSocket connections disabled');
    return false;
  });
}

createRoot(document.getElementById("root")!).render(<App />);
