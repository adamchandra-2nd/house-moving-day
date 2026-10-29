import { Component, type ErrorInfo, type ReactNode } from "react";
import { SystemState } from "./SystemState";

type Props = { children: ReactNode; label?: string };
type State = { message: string | null };

/**
 * Catches a render crash and says so.
 *
 * Without one of these, a single bad assumption -- a field that is not where
 * the code thought it was -- unmounts the whole tree and leaves a white page
 * with nothing on it and nothing in the UI to go on. That is what happened
 * to the committee's admin: `Object.entries(undefined)` threw while drawing
 * one panel, and took every other page with it.
 *
 * This cannot be a hook. Error boundaries are the one thing React still only
 * offers to class components.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { message: null };

  static getDerivedStateFromError(error: unknown): State {
    return { message: error instanceof Error ? error.message : "Terjadi kesalahan" };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // The console is where this is actually diagnosed; the screen only needs
    // to stop being blank.
    console.error(`[${this.props.label ?? "app"}] render gagal`, error, info.componentStack);
  }

  render() {
    if (this.state.message === null) return this.props.children;
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
