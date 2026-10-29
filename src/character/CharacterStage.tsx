import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Application } from "@splinetool/runtime";
import { ALL_OUTFIT_NODES, outfitNodes, type Outfit } from "../data/outfits";
import { CharacterStageContext, type CharacterStageValue, type StageStatus } from "./characterStageContext";
import { capture as captureCanvas } from "./capture";
import { SCENE } from "./scene";
import "./CharacterStage.css";

/**
 * One Spline instance for the whole guest app.
 *
 * The character appears on nearly every guest screen, so mounting Spline per
 * screen would re-parse 459 meshes on every navigation. Instead a single
 * canvas and a single Application live here for the session, and the canvas is
 * re-parented into whichever <Character> slot is on screen — moving a canvas in
 * the DOM keeps its WebGL context, so the scene is built exactly once.
 *
 * It also never blocks the guest: every screen paints the 2D sprite first and
 * the scene loads in the background, swapping in when it is ready.
 */
export function CharacterStage({ outfit, children }: { outfit: Outfit; children: React.ReactNode }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const appRef = useRef<Application | null>(null);

  const [status, setStatus] = useState<StageStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [activeSlot, setActiveSlot] = useState<HTMLElement | null>(null);
  const [preview, setPreview] = useState<Outfit | null>(null);
  /** Whether this scene actually carries the clothes -- detected, not configured. */
  const [wardrobe, setWardrobe] = useState(false);
  const slots = useRef<HTMLElement[]>([]);
  const forced = useRef(false);

  // ---------- the shared canvas ----------
  if (!canvasRef.current && typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.className = "character-stage__canvas";
    canvas.setAttribute("aria-label", "Karaktermu");
    /**
     * A WebGL canvas is cleared after each paint, so toDataURL() would read
     * back an empty image. Forcing preserveDrawingBuffer on this one canvas
     * keeps the last frame readable for the sprite capture.
     */
    const getContext = canvas.getContext.bind(canvas);
    canvas.getContext = ((type: string, attrs?: Record<string, unknown>) =>
      getContext(type as "webgl2", { ...attrs, preserveDrawingBuffer: true })) as typeof canvas.getContext;
    canvasRef.current = canvas;
  }

  // ---------- background load ----------
  const start = useCallback(() => {
    if (status !== "idle" && status !== "skipped") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    setStatus("loading");

    void (async () => {
      try {
        // Dynamic: keeps Spline's ~90 chunks out of the entry bundle.
        const { Application: App } = await import("@splinetool/runtime");

        // Fetched by hand so there is a real progress number; this also fills
        // the service worker cache that app.load() then reads from.
        const res = await fetch(SCENE.url, { cache: "force-cache" });
        if (!res.ok) throw new Error(`scene ${res.status}`);
        const total = Number(res.headers.get("content-length")) || 0;
        const reader = res.body?.getReader();
        if (reader && total) {
          let got = 0;
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            got += value?.length ?? 0;
            setProgress(Math.min(99, Math.round((got / total) * 100)));
          }
        }

        const app = new App(canvas);
        await app.load(SCENE.url);
        appRef.current = app;
        applySceneFixes(app);
        setWardrobe(reportWardrobe(app));
        setProgress(100);
        setStatus("ready");
      } catch (err) {
        console.warn("[CharacterStage] scene failed to load:", err);
        setStatus("failed");
      }
    })();
  }, [status]);

  /**
   * Autoloading is held back on connections where 9 MB would hurt more than a
   * 3D character helps. The guest still gets the full app; /karakter offers to
   * load it anyway.
   */
  useEffect(() => {
    if (status !== "idle") return;
    if (!forced.current && !autoLoadAllowed()) {
      setStatus("skipped");
      return;
    }
    const idle = whenIdle(() => start());
    return idle;
    // start() is stable for a given status; re-running on every render would
    // queue the load repeatedly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const loadAnyway = useCallback(() => {
    forced.current = true;
    setStatus("idle");
  }, []);

  useEffect(
    () => () => {
      appRef.current?.dispose();
      appRef.current = null;
    },
    [],
  );

  // ---------- which slot holds the canvas ----------
  const claim = useCallback((slot: HTMLElement) => {
    slots.current = [...slots.current.filter((s) => s !== slot), slot];
    setActiveSlot(slots.current[slots.current.length - 1] ?? null);
    return () => {
      slots.current = slots.current.filter((s) => s !== slot);
      setActiveSlot(slots.current[slots.current.length - 1] ?? null);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const app = appRef.current;
    if (!canvas) return;
    if (status !== "ready" || !activeSlot) {
      canvas.remove();
      app?.stop();
      return;
    }
    activeSlot.appendChild(canvas);
    app?.play();

    /**
     * Spline watches the canvas's *original* parent with its own
     * ResizeObserver, which stops being the right element once the canvas is
     * re-parented — and setSize() pins the viewport mode, switching that
     * observer off for good. So the size is tracked here instead, per slot.
     *
     * Sizes are CSS pixels: Spline multiplies by the scene's own pixel ratio
     * setting (Export → Pixel Ratio), so doing it here too would double it.
     */
    const resize = () => {
      const { width, height } = activeSlot.getBoundingClientRect();
      if (width && height) app?.setSize(width, height);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(activeSlot);
    return () => observer.disconnect();
  }, [activeSlot, status]);

  // Nothing on screen needs it, or the tab is in the background: stop drawing.
  useEffect(() => {
    const onVisibility = () => {
      const app = appRef.current;
      if (!app) return;
      if (document.hidden || !activeSlot) app.stop();
      else app.play();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [activeSlot]);

  // ---------- dressing ----------
  const worn = preview ?? outfit;
  useEffect(() => {
    const app = appRef.current;
    if (!app || status !== "ready" || !wardrobe) return;
    const wanted = new Set(outfitNodes(worn));
    for (const node of ALL_OUTFIT_NODES) {
      const obj = app.findObjectByName(node);
      if (obj) obj.visible = wanted.has(node);
    }
    app.requestRender();
  }, [worn, status, wardrobe]);

  const previewOutfit = useCallback((next: Outfit | null) => setPreview(next), []);
  const capture = useCallback(() => {
    const canvas = canvasRef.current;
    return status === "ready" && canvas ? captureCanvas(canvas) : null;
  }, [status]);

  const value = useMemo<CharacterStageValue>(
    () => ({ status, progress, claim, activeSlot, previewOutfit, capture, loadAnyway }),
    [status, progress, claim, activeSlot, previewOutfit, capture, loadAnyway],
  );

  return <CharacterStageContext.Provider value={value}>{children}</CharacterStageContext.Provider>;
}

/**
 * Corrects what the published scene does that this app does not want: its own
 * opaque background, its framing, and the extra presets it has on display.
 */
function applySceneFixes(app: Application) {
  app.setBackgroundColor(SCENE.background);
  if (SCENE.zoom !== null) app.setZoom(SCENE.zoom);
  if (!SCENE.hide.length && !SCENE.show.length) return;

  // Prefix match: one entry covers a whole group, parts included.
  const unmatched = new Set([...SCENE.hide, ...SCENE.show]);
  for (const obj of app.getAllObjects()) {
    const hidden = SCENE.hide.find((h) => obj.name === h || obj.name.startsWith(h));
    const shown = SCENE.show.find((h) => obj.name === h || obj.name.startsWith(h));
    if (hidden) {
      unmatched.delete(hidden);
      obj.visible = false;
    }
    // `show` wins: it is the correction, `hide` the broad sweep.
    if (shown) {
      unmatched.delete(shown);
      obj.visible = true;
    }
  }
  if (unmatched.size) {
    console.warn(`[CharacterStage] scene.show/hide matched nothing for: ${[...unmatched].join(", ")}`);
  }
}

/** Skip the 9 MB on the connections where it would hurt most. */
function autoLoadAllowed(): boolean {
  const conn = (navigator as { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (!conn) return true;
  if (conn.saveData) return false;
  return conn.effectiveType !== "slow-2g" && conn.effectiveType !== "2g";
}

/** Waits for the browser to be idle, so the first screen paints first. */
function whenIdle(fn: () => void): () => void {
  const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number })
    .requestIdleCallback;
  if (ric) {
    const id = ric(fn, { timeout: 3000 });
    const cic = (window as unknown as { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback;
    return () => cic?.(id);
  }
  const t = window.setTimeout(fn, 1200);
  return () => clearTimeout(t);
}

/**
 * Reports what the scene brought, and installs the console helpers.
 *
 * Returns whether this scene has a wardrobe at all. That is detected rather
 * than configured, so the moment a re-export with the clothes in it lands on
 * src/assets/characters/pota.splinecode the dressing starts working with no
 * code change. A renamed node would be a silent bug otherwise.
 */
function reportWardrobe(app: Application): boolean {
  const missing = ALL_OUTFIT_NODES.filter((n) => !app.findObjectByName(n));
  const found = ALL_OUTFIT_NODES.length - missing.length;

  if (!found) {
    console.info(
      "[CharacterStage] this scene carries no wardrobe, so outfit choices are recorded but not shown. " +
        "Add the clothes in Spline, parented to the character and named as in src/data/outfits.ts, then " +
        "re-export over src/assets/characters/pota.splinecode — no code change is needed, they are " +
        "picked up on the next load. Run splineObjects() in the console for the names this scene has.",
    );
  } else if (missing.length) {
    console.warn(
      `[CharacterStage] ${missing.length}/${ALL_OUTFIT_NODES.length} outfit nodes not found in the scene:\n` +
        missing.map((m) => `  · ${m}`).join("\n") +
        "\nFix the `node` values in src/data/outfits.ts. " +
        "Run splineObjects() in the console for the names this scene actually has.",
    );
  }

  /**
   * Installed either way: with no wardrobe yet, these are exactly what is
   * needed to find out what the next export should be called.
   */
  const win = window as unknown as Record<string, unknown>;

  /**
   * Position and visibility included: that is what distinguishes a wardrobe
   * prop sitting in the display grid from a part worn by the character.
   */
  win.splineObjects = () =>
    app.getAllObjects().map((o) => ({
      name: o.name,
      visible: o.visible,
      x: Math.round(o.position.x),
      y: Math.round(o.position.y),
      z: Math.round(o.position.z),
    }));

  /**
   * The scene's own interactions. If the wardrobe is wired as "click an item to
   * try it on", the app should emit those events instead of toggling
   * visibility — that is what actually dresses the character.
   */
  win.splineEvents = () => app.getSplineEvents();

  /**
   * Flip visibility live, by substring or regex, to find which objects make up
   * a pose without rebuilding:
   *   splineSet("Pota Mouth", true)
   *   splineSet(/Smile/, false)
   * Returns what it changed. Once the right combination is found, put it in
   * `show` / `hide` in scene.ts to make it stick.
   */
  win.splineSet = (pattern: string | RegExp, visible: boolean) => {
    const match = (n: string) => (typeof pattern === "string" ? n.includes(pattern) : pattern.test(n));
    const hit = app.getAllObjects().filter((o) => match(o.name));
    for (const o of hit) o.visible = visible;
    app.requestRender();
    return hit.map((o) => o.name);
  };

  return found > 0;
}
