import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import "./styles/global.css";
import App from "./App.tsx";
import { initSprite } from "./character/sprite";
import { registerMutationDefaults } from "./data/queries";
import { persister, queryClient } from "./data/queryClient";
import { keepUpToDate } from "./swUpdate";

registerMutationDefaults();
keepUpToDate();
// Read the captured 3D character before first paint, so <Character> does not
// flash the placeholder for a guest who has already dressed theirs.
void initSprite();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: 24 * 60 * 60 * 1000 }}
      /** Cache is back from IndexedDB: send anything that was queued offline. */
      onSuccess={() => {
        void queryClient.resumePausedMutations();
      }}
    >
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </PersistQueryClientProvider>
  </StrictMode>,
);
