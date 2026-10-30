import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Application } from "@splinetool/runtime";
import { ALL_OUTFIT_NODES, READY_OUTFIT_NODES, outfitNodes, type Outfit } from "../data/outfits";
import { CharacterStageContext, type CharacterStageValue, type StageStatus } from "./characterStageContext";
import { capture as captureCanvas, characterRows } from "./capture";
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
  const [error, setError] = useState<string | null>(null);
  const [activeSlot, setActiveSlot] = useState<HTMLElement | null>(null);
  const [preview, setPreview] = useState<Outfit | null>(null);
  /** Whether this scene actually carries the clothes -- detected, not configured. */
  const [wardrobe, setWardrobe] = useState(false);
  const [available, setAvailable] = useState<ReadonlySet<string> | null>(null);
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
    setError(null);

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
        // Spline leaves hidden objects out of a code export, so the clothes
        // are exported visible -- all of them at once. Undressed here, before
        // the canvas is ever on screen; the dressing effect below puts on
        // whatever this guest chose.
        for (const node of ALL_OUTFIT_NODES) {
          const obj = app.findObjectByName(node);
          if (obj) obj.visible = false;
        }
        setWardrobe(reportWardrobe(app));
        setAvailable(new Set(ALL_OUTFIT_NODES.filter((n) => app.findObjectByName(n))));
        setProgress(100);
        setStatus("ready");
      } catch (err) {
        console.warn("[CharacterStage] scene failed to load:", err);
        // Kept for /karakter to show: a phone has no console to read, and
        // "it shows 2D" alone does not say whether WebGL, the network or the
        // scene file was the problem.
        setError(err instanceof Error ? err.message : String(err));
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
    const stopGrounding = { current: () => {} };
    const resize = () => {
      const { width, height } = activeSlot.getBoundingClientRect();
      if (!width || !height) return;
      app?.setSize(width, height);
      stopGrounding.current();
      stopGrounding.current = ground(canvas, height);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(activeSlot);
    return () => {
      observer.disconnect();
      stopGrounding.current();
      // The 2D sprite that takes over this slot is cropped tight: its head is
      // at the top of the box, so the 3D head position must not linger.
      activeSlot.closest<HTMLElement>(".character")?.style.removeProperty("--head-gap");
    };
  }, [activeSlot, status]);

  useLookAt(appRef.current, status === "ready" ? activeSlot : null);

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
    return status === "ready" && canvas ? captureCanvas(canvas) : Promise.resolve(null);
  }, [status]);

  const value = useMemo<CharacterStageValue>(
    () => ({ status, progress, error, available, claim, activeSlot, previewOutfit, capture, loadAnyway }),
    [status, progress, error, available, claim, activeSlot, previewOutfit, capture, loadAnyway],
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

/**
 * Moves the canvas down until the character's feet meet the bottom of its slot.
 *
 * The scene's camera frames the character with empty space under the feet,
 * so with the canvas filling the slot the character floated above the floor
 * shadow -- by a different amount in every room, since only the shadow and the
 * slot are placed per screen. The gap is read off a rendered frame rather than
 * hard-coded, so a re-exported scene with another framing still lands.
 *
 * Keeps reading for a few seconds and goes by the lowest feet it has seen.
 * Right after setSize() the buffer can be empty, and a scene that streams in
 * draws the character in pieces: a frame with the legs still missing put the
 * feet 80px too high, and two of those in a row agreed with each other. An
 * unfinished frame can only ever show the feet higher than they are, never
 * lower, so the lowest reading is the real one.
 *
 * The clock only starts once the character has been seen at all: a 1.6 MB
 * scene can take longer than any fixed window to draw on a slow phone, and a
 * window that ran out first left the character floating for the whole visit.
 * Each reading is also capped, because decoding a frame stalls while the tab
 * is in the background -- a guest switching to WhatsApp mid-load -- and one
 * stalled reading used to end the whole loop.
 * Returns a cancel function.
 */
/** Empty space under the feet and above the horns, as a share of the slot height. */
const FALLBACK_FEET = 0.169;
const FALLBACK_TOP = 0.178;

function setGaps(canvas: HTMLCanvasElement, feet: number, top: number) {
  canvas.style.setProperty("--feet-gap", `${feet}px`);
  // Where the head is inside the <Character> box once moved down, for the
  // speech bubble: it sits on the horns, not on the canvas edge.
  canvas.closest<HTMLElement>(".character")?.style.setProperty("--head-gap", `${top + feet}px`);
}

function ground(canvas: HTMLCanvasElement, cssHeight: number): () => void {
  // Start from where this scene's feet and horns sit (measured in Chromium),
  // so the character stands on the floor even where the frame cannot be
  // read back at all; the readings below then correct it to the pixel.
  setGaps(canvas, Math.round(FALLBACK_FEET * cssHeight), Math.round(FALLBACK_TOP * cssHeight));
  let timer = 0;
  let waiting = 0; // readings before the character first showed up
  let settling = 0; // readings since
  let lowest = -1;
  let cancelled = false;
  const reading = () =>
    Promise.race([characterRows(canvas), new Promise<null>((done) => window.setTimeout(() => done(null), 1500))]);
  const attempt = () => {
    void reading().then((rows) => {
      if (cancelled) return;
      if (rows !== null && rows.bottom > lowest) {
        lowest = rows.bottom;
        const gap = Math.max(0, Math.round(((canvas.height - 1 - rows.bottom) / canvas.height) * cssHeight));
        setGaps(canvas, gap, Math.round((rows.top / canvas.height) * cssHeight));
      }
      // Up to a minute for the character to appear, then ~6s more to catch
      // the parts that stream in after the first frame.
      const more = lowest < 0 ? ++waiting < 120 : ++settling < 20;
      if (more) timer = window.setTimeout(attempt, lowest < 0 ? 500 : 300);
    });
  };
  timer = window.setTimeout(attempt, 200);
  return () => {
    cancelled = true;
    clearTimeout(timer);
  };
}

/** The objects that turn toward a tap, and how far at most, in radians. */
const LOOK = [
  // Positive y turns toward the right of the screen, positive x looks down.
  { name: "Head Pivot", yaw: 0.3, pitch: 0.15 },
  { name: "Eye Open R Pivot", yaw: 0.55, pitch: 0.35 },
  { name: "Eye Open R Pivot 2", yaw: 0.55, pitch: 0.35 },
];
/** How long the character keeps looking at a tap before turning back. */
const LOOK_HOLD_MS = 2200;

/**
 * The character looks at wherever the guest taps on the room around it.
 *
 * Tapping is how a guest plays with it, and a character that ignores the
 * finger reads as a picture, not a pet. Head and eyes ease toward the tap,
 * hold for a moment, then ease back to the scene's own pose. Driven from the
 * page rather than the scene's own controls, which are switched off (see the
 * canvas CSS) because they could orbit the character out of view.
 */
function useLookAt(app: Application | null, slot: HTMLElement | null) {
  useEffect(() => {
    if (!app || !slot) return;
    const parts = LOOK.map((l) => ({ ...l, obj: app.findObjectByName(l.name) })).filter((p) => p.obj);
    if (!parts.length) return;
    const base = parts.map((p) => ({ x: p.obj!.rotation.x, y: p.obj!.rotation.y }));

    // -1..1 on each axis: where the tap is, relative to the character's head.
    const target = { x: 0, y: 0 };
    const now = { x: 0, y: 0 };
    let frame = 0;
    let release = 0;

    const step = () => {
      now.x += (target.x - now.x) * 0.18;
      now.y += (target.y - now.y) * 0.18;
      parts.forEach((p, i) => {
        p.obj!.rotation.y = base[i].y + now.x * p.yaw;
        p.obj!.rotation.x = base[i].x + now.y * p.pitch;
      });
      app.requestRender();
      const settled = Math.abs(target.x - now.x) < 0.002 && Math.abs(target.y - now.y) < 0.002;
      frame = settled ? 0 : requestAnimationFrame(step);
    };
    const run = () => {
      if (!frame) frame = requestAnimationFrame(step);
    };

    const onTap = (e: PointerEvent) => {
      // The room, not the controls: a character that looks down at the
      // bottom nav on every tab change -- or at "Selesai" in the instant its
      // portrait is taken on /karakter -- is following the wrong thing.
      if (e.target instanceof Element && e.target.closest("button, a, input, textarea, select, [role=button]")) return;
      const r = slot.getBoundingClientRect();
      if (!r.width) return;
      const headX = r.left + r.width / 2;
      const headY = r.top + r.height * 0.35;
      const clamp = (v: number) => Math.max(-1, Math.min(1, v));
      target.x = clamp((e.clientX - headX) / (window.innerWidth / 2));
      target.y = clamp((e.clientY - headY) / (window.innerHeight / 2));
      run();
      clearTimeout(release);
      release = window.setTimeout(() => {
        target.x = 0;
        target.y = 0;
        run();
      }, LOOK_HOLD_MS);
    };

    document.addEventListener("pointerdown", onTap, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", onTap);
      cancelAnimationFrame(frame);
      clearTimeout(release);
      parts.forEach((p, i) => {
        p.obj!.rotation.x = base[i].x;
        p.obj!.rotation.y = base[i].y;
      });
    };
  }, [app, slot]);
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
  // Upcoming items are expected to be missing until the scene gains them.
  const missing = READY_OUTFIT_NODES.filter((n) => !app.findObjectByName(n));
  const found = READY_OUTFIT_NODES.length - missing.length;

  if (!found) {
    console.info(
      "[CharacterStage] this scene carries no wardrobe, so outfit choices are recorded but not shown. " +
        "Add the clothes in Spline, parented to the character and named as in src/data/outfits.ts, then " +
        "re-export over src/assets/characters/pota.splinecode — no code change is needed, they are " +
        "picked up on the next load. Run splineObjects() in the console for the names this scene has.",
    );
  } else if (missing.length) {
    console.warn(
      `[CharacterStage] ${missing.length}/${READY_OUTFIT_NODES.length} outfit nodes not found in the scene:\n` +
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

  /** The Application itself, for poking at objects' rotation and the like. */
  win.splineApp = app;

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
