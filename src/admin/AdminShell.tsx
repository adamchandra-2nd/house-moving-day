import type { ReactNode } from "react";
import { Avatar } from "../components/Avatar";
import { Icon } from "../components/Icon";
import type { IconName } from "../components/iconPaths";
import { formatTime } from "../data/agenda";
import "./admin.css";
import potaraLogo from "../assets/potara-logo.png";

export type AdminPage =
  | "dashboard"
  | "undangan"
  | "tamu"
  | "rundown"
  | "pengumuman"
  | "pengisi"
  | "hadiah"
  | "galeri"
  | "feedback"
  | "pengaturan";

const NAV: {
  group: string;
  items: { id: AdminPage; label: string; icon: IconName }[];
}[] = [
  {
    group: "Acara",
    items: [
      { id: "dashboard", label: "Dashboard", icon: "Grid" },
      { id: "rundown", label: "Rundown", icon: "Calendar" },
      { id: "pengumuman", label: "Pengumuman", icon: "Megaphone" },
      { id: "pengisi", label: "Pengisi acara", icon: "Sparkle" },
    ],
  },
  {
    group: "Tamu",
    items: [
      { id: "undangan", label: "Undangan", icon: "Mail" },
      { id: "tamu", label: "Daftar tamu", icon: "Users" },
      { id: "hadiah", label: "Hadiah", icon: "Gift" },
      { id: "galeri", label: "Galeri", icon: "Image" },
    ],
  },
  {
    group: "Hasil",
    items: [
      { id: "feedback", label: "Feedback", icon: "Star" },
      { id: "pengaturan", label: "Pengaturan", icon: "Sliders" },
    ],
  },
];

type Props = {
  page: AdminPage;
  onNavigate: (p: AdminPage) => void;
  now: number;
  search: string;
  onSearch: (q: string) => void;
  counts: Partial<Record<AdminPage, number>>;
  email: string;
  onLogout: () => void;
  banner?: ReactNode;
  bell: ReactNode;
  children: ReactNode;
};

/** Admin frame: Ink sidebar (Bottom Nav language), top bar with guest search + live clock, scrolling content. */
export function AdminShell({
  page,
  onNavigate,
  now,
  search,
  onSearch,
  counts,
  email,
  onLogout,
  banner,
  bell,
  children,
}: Props) {
  return (
    <div className="admin">
      <aside className="admin-sidebar clay clay-dark">
        <div className="admin-brand">
          <span className="admin-brand__mark">
            <img src={potaraLogo} alt="Potara" />
          </span>
          <span className="admin-brand__text">
            <span className="t-p-h4-bold">HMD Admin</span>
            <span className="t-p-h5 admin-brand__sub">House Moving Day</span>
          </span>
        </div>
        {NAV.map((g) => (
          <nav key={g.group} className="admin-nav" aria-label={g.group}>
            <span className="t-p-h5-bold admin-nav__label">{g.group}</span>
            {g.items.map((it) => (
              <button
                key={it.id}
                type="button"
                className={`admin-nav__item t-p-h4-bold${page === it.id ? " is-active clay clay-accent" : ""}`}
                aria-current={page === it.id ? "page" : undefined}
                onClick={() => onNavigate(it.id)}
              >
                <Icon name={it.icon} size={20} />
                {it.label}
                {counts[it.id] ? (
                  <span className="admin-nav__count clay clay-accent t-p-h5-bold">
                    {counts[it.id]}
                  </span>
                ) : null}
              </button>
            ))}
          </nav>
        ))}
        <div className="admin-sidebar__foot">
          <div className="admin-me clay clay-grey">
            <Avatar initial="A" size="M" character />
            <span className="admin-me__text">
              <span className="t-p-h5-bold">Admin</span>
              <span className="t-p-h5 admin-me__email">{email}</span>
            </span>
            <button
              type="button"
              className="icon-btn clay clay-grey"
              onClick={onLogout}
              aria-label="Keluar"
            >
              <Icon name="Logout" size={20} />
            </button>
          </div>
        </div>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <label className="admin-search">
            <Icon name="Search" size={20} />
            <input
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              placeholder="Cari tamu…"
              aria-label="Cari tamu"
              className="t-p-h4"
            />
          </label>
          <div className="admin-topbar__right">
            <span className="admin-clock t-p-h4-bold" title="Jam rundown">
              <span className="admin-clock__dot" />
              Minggu, 8 Nov · {formatTime(now)}
            </span>
            {bell}
          </div>
        </header>
        {banner}
        <div className="admin-content">{children}</div>
      </div>
    </div>
  );
}
