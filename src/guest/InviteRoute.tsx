import { useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { SystemState } from "../components/SystemState";
import { api } from "../data/adapters";
import { ApiError } from "../data/http";
import { FLOW, tabPath } from "../routing/paths";
import { useGuest } from "./guestContext";
import { clearToken, tokenFromPath } from "./session";

/**
 * Where a personal invite link lands.
 *
 * It renders nothing of its own. Its whole job is to turn a link into a
 * session: read the token out of the path, bank it, ask the server who it
 * belongs to, and forward to wherever that guest actually is. A guest who has
 * already checked in should not be shown the RSVP screen again because they
 * reopened the link from their chat history.
 *
 * This runs before the guest app, so it is also the only place that can tell
 * a stale or revoked link apart from a working one and say so plainly.
 */
export function InviteRoute() {
  const { token: raw } = useParams<{ token: string }>();
  const token = tokenFromPath(raw ?? "");

  const [to, setTo] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const { startSession } = useGuest();

  useEffect(() => {
    if (!token) return;
    // Not just saveToken(): a different guest's link on this phone must not
    // inherit the previous guest's progress.
    startSession(token);

    let live = true;
    api
      .invite()
      .then((invite) => {
        if (!live) return;
        setTo(stageFor(invite));
      })
      .catch((err: unknown) => {
        if (!live) return;
        const e = err instanceof ApiError ? err : new ApiError(0, "network", "Tidak bisa menghubungi server");
        // A token the server rejects is worse than useless: keeping it would
        // make every later request fail too. A network error keeps it, because
        // the link is probably fine and the connection is not.
        if (e.unauthorized || e.revoked) clearToken();
        setError(e);
      });
    return () => {
      live = false;
    };
  }, [token, startSession]);

  if (!token) return <SystemState type="error" title="Link tidak valid" sub="Cek lagi link undangan yang kamu terima." />;
  if (error) {
    // Only a connection problem is worth retrying; a dead link stays dead.
    const retry = error.revoked || error.unauthorized ? undefined : () => window.location.reload();
    return <SystemState {...messageFor(error)} onRetry={retry} />;
  }
  if (to) return <Navigate to={to} replace />;
  return <SystemState type="loading" />;
}

type Invite = Awaited<ReturnType<typeof api.invite>>;

/**
 * The guest's place in the flow, decided by the server's answer rather than by
 * whatever this browser happens to remember. That is the point of storing
 * progress against the guest: opening the link on a second phone continues
 * where the first one left off.
 */
function stageFor(invite: Invite): string {
  if (invite.rsvp === "belum") return FLOW.rsvp;
  if (invite.rsvp === "tidak") return FLOW.thanks;
  if (!invite.checkedIn) return FLOW.start;
  if (!invite.hadir) return FLOW.narasi;
  return tabPath("ruangan");
}

function messageFor(e: ApiError) {
  if (e.revoked) {
    return {
      type: "error" as const,
      title: "Link sudah tidak berlaku",
      sub: "Panitia menonaktifkan link ini. Hubungi panitia untuk link baru.",
    };
  }
  if (e.unauthorized) {
    return {
      type: "error" as const,
      title: "Link tidak dikenal",
      sub: "Pastikan kamu membuka link yang dikirim panitia, lengkap sampai karakter terakhir.",
    };
  }
  return {
    type: "offline" as const,
    title: "Tidak bisa menghubungi server",
    sub: "Cek koneksimu, lalu buka lagi linknya.",
  };
}
