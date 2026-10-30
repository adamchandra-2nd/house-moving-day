import { Component, type ErrorInfo, type ReactNode } from "react";
import { isStaleChunk, reloadForStaleChunk } from "../swUpdate";
import { SystemState } from "./SystemState";

type Props = { children: ReactNode; label?: string };
type State = { message: string | null; reloading: boolean };

/**
 * Catches a render crash and says so.
 *
 * Without one of these, a single bad assumption -- a field that is not where
 * the code thought it was -- unmounts the whole tree and leaves a white page
 * with nothing on it and nothing in the UI to go on. That is what happened
 * to the committee's admin: `Object.entries(undefined)` threw while drawing
 * one panel, and took every other page with it.
 *
 * A page whose code is gone from the server is not a crash, though. A tab
 * opened before a deploy still asks for the old build's file names (the
 * admin, the stage), and after the deploy those are gone: the lazy import
 * fails and used to land here as "Failed to fetch dynamically imported
 * module". Vite's own vite:preloadError only covers the files a page pulls
 * in, not the page itself, so it is handled here too: reload once onto the
 * current deploy, which has the file.
 *
 * This cannot be a hook. Error boundaries are the one thing React still only
 * offers to class components.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { message: null, reloading: false };

  static getDerivedStateFromError(error: unknown): State {
    return { message: error instanceof Error ? error.message : "Terjadi kesalahan", reloading: isStaleChunk(error) };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Guarded: a file that is really broken shows the error below instead of
    // reloading forever.
    if (isStaleChunk(error) && reloadForStaleChunk()) return;
    if (this.state.reloading) this.setState({ reloading: false });
    // The console is where this is actually diagnosed; the screen only needs
    // to stop being blank.
    console.error(`[${this.props.label ?? "app"}] render gagal`, error, info.componentStack);
  }

  render() {
    if (this.state.message === null) return this.props.children;
    if (this.state.reloading) return <SystemState type="loading" title="Memuat versi terbaru…" sub="Aplikasi baru saja diperbarui." />;
    return (
      <SystemState
        type="error"
        title="Halaman ini gagal ditampilkan"
        sub={`${this.state.message}. Muat ulang halaman; kalau tetap gagal, kabari yang menyiapkan aplikasi ini.`}
        onRetry={() => window.location.reload()}
      />
    );
  }
}
