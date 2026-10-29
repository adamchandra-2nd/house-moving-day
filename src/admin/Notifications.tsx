import { useEffect, useRef, useState } from "react";
import { Button } from "../components/Button";
import { Icon } from "../components/Icon";
import { IconBadge, type IconTone } from "../components/IconBadge";
import type { IconName } from "../components/iconPaths";
import { formatTime } from "../data/agenda";
import type { AdminPage } from "./AdminShell";
import { Empty } from "./ui";

export type AdminNotice = {
  id: string;
  kind: "action" | "info";
  icon: IconName;
  tone: IconTone;
  title: string;
  body: string;
  at: number;
  read: boolean;
  /** Where clicking it takes you. */
  page: AdminPage;
  guestId?: string;
};

type Props = {
  notices: AdminNotice[];
  now: number;
  onOpen: (n: AdminNotice) => void;
  onReadAll: () => void;
  /** Review case: start with the panel open. */
  initialOpen?: boolean;
};

/** Bell + dropdown panel. "Perlu tindakan" items also show as a toast when they arrive (see AdminApp). */
export function Notifications({ notices, now, onOpen, onReadAll, initialOpen }: Props) {
  const [open, setOpen] = useState(!!initialOpen);
  const [tab, setTab] = useState<"semua" | "aksi">("semua");
  const ref = useRef<HTMLDivElement>(null);
  const unread = notices.filter((n) => !n.read).length;
  const list = [...notices].filter((n) => tab === "semua" || n.kind === "action").sort((a, b) => b.at - a.at);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div className={`admin-bell${open ? " is-open" : ""}`} ref={ref}>
      <button type="button" className="icon-btn clay clay-light" aria-label={`Notifikasi, ${unread} belum dibaca`} aria-expanded={open} onClick={() => setOpen(!open)}>
        <Icon name="Bell" />
      </button>
      {unread > 0 && <span className="admin-bell__count t-p-h5-bold">{unread}</span>}
      {open && <div className="notif-scrim" aria-hidden="true" />}
      {open && (
        <div className="notif-pop clay clay-light" role="dialog" aria-label="Notifikasi">
          <header className="notif-pop__head">
            <IconBadge icon="Bell" tone="ink" size="S" />
            <h2 className="t-p-h3-bold admin-panel__title">Notifikasi</h2>
            <Button size="small" style="tertiary" disabled={!unread} onClick={onReadAll}>
              Tandai semua dibaca
            </Button>
          </header>
          <div className="notif-pop__tabs pill-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={tab === "semua"} className={`pill-tab t-p-h5-bold${tab === "semua" ? " is-active clay clay-dark" : ""}`} onClick={() => setTab("semua")}>
              Semua <span className="pill-tab__count">{notices.length}</span>
            </button>
            <button type="button" role="tab" aria-selected={tab === "aksi"} className={`pill-tab t-p-h5-bold${tab === "aksi" ? " is-active clay clay-dark" : ""}`} onClick={() => setTab("aksi")}>
              Perlu tindakan <span className="pill-tab__count">{notices.filter((n) => n.kind === "action").length}</span>
            </button>
          </div>
          {list.length === 0 ? (
            <Empty icon="Bell" tone="green" title="Semua beres!" body="Belum ada notifikasi baru." />
          ) : (
            <ul className="notif-list scroll-fade">
              {list.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className={`notif-item${n.read ? "" : " is-unread"}`}
                    onClick={() => {
                      setOpen(false);
                      onOpen(n);
                    }}
                  >
                    <IconBadge icon={n.icon} tone={n.tone} size="S" />
                    <span className="notif-item__text">
                      <span className="t-p-h4-bold">{n.title}</span>
                      <span className="t-p-h5 admin-muted">{n.body}</span>
                      <span className="t-p-h5 notif-item__time">
                        {n.kind === "action" && <span className="notif-item__tag">Perlu tindakan · </span>}
                        {formatTime(n.at)} · {Math.max(0, now - n.at)} menit lalu
                      </span>
                    </span>
                    {!n.read && <span className="notif-item__dot" aria-label="Belum dibaca" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
