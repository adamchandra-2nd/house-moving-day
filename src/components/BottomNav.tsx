import { Icon } from "./Icon";
import type { IconName } from "./iconPaths";
import "./BottomNav.css";

export type NavTab = "ruangan" | "agenda" | "kenalan" | "galeri" | "feedback";

const TABS: { id: NavTab; label: string; icon: IconName }[] = [
  { id: "ruangan", label: "Ruangan", icon: "Home" },
  { id: "agenda", label: "Agenda", icon: "Calendar" },
  { id: "kenalan", label: "Kenalan", icon: "UserPlus" },
  { id: "galeri", label: "Galeri", icon: "Image" },
  { id: "feedback", label: "Feedback", icon: "Message" },
];

type BottomNavProps = {
  active: NavTab;
  feedbackLocked?: boolean;
  /** Orange dot on a tab with something new (e.g. new photos in Galeri). */
  dots?: Partial<Record<NavTab, boolean>>;
  onChange: (tab: NavTab) => void;
  /** Feedback looks like any other tab; before it opens, tapping it explains when it will. */
  onLockedTap?: () => void;
};

/** Figma: Bottom Nav — floating Ink pill; active tab expands into an Orange Splash pill with label. */
export function BottomNav({ active, feedbackLocked, dots, onChange, onLockedTap }: BottomNavProps) {
  return (
    <nav className="bottom-nav clay clay-dark" aria-label="Navigasi utama">
      {TABS.map((tab) => {
        const isActive = tab.id === active;
        const locked = tab.id === "feedback" && feedbackLocked;
        return (
          <button
            key={tab.id}
            type="button"
            className={`nav-item clay ${isActive ? "nav-item--active clay-accent" : "clay-grey"}`}
            aria-current={isActive ? "page" : undefined}
            aria-label={dots?.[tab.id] && !isActive ? `${tab.label}, ada yang baru` : tab.label}
            onClick={() => (locked ? onLockedTap?.() : onChange(tab.id))}
          >
            <Icon name={tab.icon} />
            {dots?.[tab.id] && !isActive && <span className="nav-item__dot" />}
            {isActive && <span className="t-p-h4-bold">{tab.label}</span>}
          </button>
        );
      })}
    </nav>
  );
}
