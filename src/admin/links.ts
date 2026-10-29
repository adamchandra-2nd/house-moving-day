import type { AdminPage } from "./AdminShell";
import type { Phase } from "./Dashboard";
import type { AdminEvent } from "./data";
import type { LoginScenario } from "./Login";
import type { UndanganDialog } from "./Undangan";

export type Scenario = {
  signedIn: boolean;
  login?: LoginScenario;
  page: AdminPage;
  phase: Phase;
  search?: string;
  selected?: string;
  rundownDraft?: (events: AdminEvent[]) => AdminEvent[];
  rundownEdit?: string;
  failAnnouncement?: boolean;
  feedbackTab?: string;
  /** Review case: every star rating (1–5) has answers. */
  feedbackAll?: boolean;
  sessionExpired?: boolean;
  editScript?: string;
  stageNotices?: boolean;
  offline?: boolean;
  system?: "error" | "404";
  notifOpen?: boolean;
  actionToast?: boolean;
  undangan?: { tab?: "semua" | "belum" | "gagal" | "terkirim" | "dibaca" | "rsvp"; selected?: string[]; dialog?: UndanganDialog; single?: string };
};

const NEW = ["baru-andini", "baru-bagas", "baru-clara", "baru-dewa"];

const live = (page: AdminPage, extra: Partial<Scenario> = {}): Scenario => ({ signedIn: true, page, phase: "live", ...extra });

/** Review links for the admin side: #admin-… */
export const ADMIN_LINKS: Record<string, Scenario> = {
  "admin-login": { signedIn: false, login: "email", page: "dashboard", phase: "live" },
  "admin-pin": { signedIn: false, login: "pin", page: "dashboard", phase: "live" },
  "admin-pin-kedaluwarsa": { signedIn: false, login: "pin-expired", page: "dashboard", phase: "live" },
  "admin-pin-terkunci": { signedIn: false, login: "pin-locked", page: "dashboard", phase: "live" },
  admin: live("dashboard"),
  "admin-sebelum": live("dashboard", { phase: "pre" }),
  "admin-selesai": live("dashboard", { phase: "ended" }),
  "admin-notifikasi": live("dashboard", { notifOpen: true }),
  "admin-toast-aksi": live("dashboard", { actionToast: true }),
  "admin-undangan": live("undangan"),
  "admin-undangan-tambah": live("undangan", { undangan: { dialog: "tambah" } }),
  "admin-undangan-tambah-error": live("undangan", { undangan: { dialog: "tambah-error" } }),
  "admin-undangan-tambah-duplikat": live("undangan", { undangan: { dialog: "tambah-duplikat" } }),
  "admin-undangan-pilih": live("undangan", { undangan: { tab: "belum", selected: NEW } }),
  "admin-undangan-satu": live("undangan", { undangan: { single: "baru-andini" } }),
  "admin-undangan-konfirmasi": live("undangan", { undangan: { selected: NEW, dialog: "bulk-confirm" } }),
  "admin-undangan-mengirim": live("undangan", { undangan: { selected: NEW, dialog: "bulk-progress" } }),
  "admin-undangan-hasil": live("undangan", { undangan: { selected: NEW, dialog: "bulk-result" } }),
  "admin-undangan-pesan": live("undangan", { undangan: { dialog: "template" } }),
  "admin-undangan-csv": live("undangan", { undangan: { dialog: "csv-upload" } }),
  "admin-undangan-csv-periksa": live("undangan", { undangan: { dialog: "csv-review" } }),
  "admin-undangan-csv-format": live("undangan", { undangan: { dialog: "csv-error-format" } }),
  "admin-undangan-csv-kolom": live("undangan", { undangan: { dialog: "csv-error-kolom" } }),
  "admin-undangan-csv-kosong": live("undangan", { undangan: { dialog: "csv-error-kosong" } }),
  "admin-undangan-csv-besar": live("undangan", { undangan: { dialog: "csv-error-besar" } }),
  "admin-tamu": live("tamu"),
  "admin-tamu-detail": live("tamu", { selected: "laras" }),
  "admin-tamu-kosong": live("tamu", { search: "zzz" }),
  "admin-rundown": live("rundown"),
  "admin-rundown-edit": live("rundown", { rundownEdit: "makan" }),
  "admin-rundown-belum-disimpan": live("rundown", {
    rundownDraft: (ev) => ev.map((e) => (e.id === "makan" ? { ...e, start: e.start + 15, end: e.end + 15 } : e)),
  }),
  "admin-rundown-bentrok": live("rundown", {
    rundownDraft: (ev) => ev.map((e) => (e.id === "makan" ? { ...e, start: 12 * 60 + 15, end: 13 * 60 + 15, roomId: "halaman-depan" } : e)),
  }),
  "admin-pengisi": live("pengisi"),
  "admin-notifikasi-panggung": live("dashboard", { notifOpen: true, stageNotices: true }),
  "admin-pengisi-naskah": live("pengisi", { editScript: "talkshow" }),
  "admin-pengumuman": live("pengumuman"),
  "admin-pengumuman-gagal": live("pengumuman", { failAnnouncement: true }),
  "admin-hadiah": live("hadiah"),
  "admin-hadiah-kosong": live("hadiah", { phase: "pre" }),
  "admin-feedback": live("feedback"),
  "admin-feedback-semua-rating": live("feedback", { feedbackAll: true }),
  "admin-feedback-akhir": live("feedback", { phase: "ended", feedbackTab: "akhir" }),
  "admin-feedback-kosong": live("feedback", { phase: "pre" }),
  "admin-pengaturan": live("pengaturan"),
  "admin-sesi-habis": live("dashboard", { sessionExpired: true }),
  "admin-offline": live("dashboard", { offline: true }),
  "admin-error": live("dashboard", { system: "error" }),
  "admin-404": live("dashboard", { system: "404" }),
};

