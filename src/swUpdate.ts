/** How often an open tab asks whether a new deploy is out. */
const CHECK_EVERY_MS = 5 * 60 * 1000;

/**
 * Registers the service worker and keeps every open tab on the latest deploy.
 *
 * The app is a PWA, so a tab opened before a deploy keeps running the old
 * build, and the first reload after it is still served the old index.html
 * from the precache. At the event that means a fix shipped at 10.00 does not
 * reach a phone that opened the app at 09.00 -- and the committee kept seeing
 * last week's admin after a hard refresh.
 *
 * A new worker takes over by itself (skipWaiting + clientsClaim in
 * vite.config.ts); this decides when the page reloads onto it. Straight away
 * if nobody has touched the page yet -- the usual case, a stale copy served
 * on open -- otherwise the moment the tab goes to the background. A guest
 * typing a question or the committee writing an announcement is never
 * reloaded mid-sentence.
 */
export function keepUpToDate() {
  if (!("serviceWorker" in navigator) || import.meta.env.DEV) return;

  let touched = false;
  const markTouched = () => (touched = true);
  window.addEventListener("pointerdown", markTouched, { once: true, capture: true });
  window.addEventListener("keydown", markTouched, { once: true, capture: true });

  // A first install also fires controllerchange (clientsClaim); there is
  // nothing newer to reload onto then.
  const hadController = Boolean(navigator.serviceWorker.controller);
  let reloading = false;
  const reload = () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  };
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController) return;
    if (!touched || document.hidden) return reload();
    const onHide = () => {
      if (!document.hidden) return;
      document.removeEventListener("visibilitychange", onHide);
      reload();
    };
    document.addEventListener("visibilitychange", onHide);
  });

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => {
        const check = () => {
          if (navigator.onLine) void registration.update().catch(() => {});
        };
        window.setInterval(check, CHECK_EVERY_MS);
        // Coming back to the tab (from WhatsApp, from another admin tab) is
        // when a newer deploy is most likely waiting.
        document.addEventListener("visibilitychange", () => {
          if (!document.hidden) check();
        });
      })
      .catch((err) => console.warn("[sw] register failed:", err));
  });
}
