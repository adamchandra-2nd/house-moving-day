/** WhatsApp invitation helpers (prototype: sending is simulated; production goes through the WhatsApp Business API). */
export const DEFAULT_TEMPLATE =
  "Halo {nama}! 👋\n\nPotara pindah rumah dan kami ingin merayakannya bareng kamu di House Moving Day, Minggu 8 November 2026.\n\nKonfirmasi kehadiranmu di sini:\n{link}\n\nSampai ketemu di rumah baru!";

export const inviteLink = (name: string) => `hmd.potara.id/u/${name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "tamu"}`;
export const fillTemplate = (t: string, name: string) => t.split("{nama}").join(name).split("{link}").join(inviteLink(name));

/** Strips spaces/dashes and turns +62 into 0. Returns null if it can't be a WhatsApp number. */
export function normalizePhone(raw: string): string | null {
  const s = raw.replace(/[\s-]/g, "").replace(/^\+62/, "0").replace(/^62/, "0");
  return /^08\d{8,11}$/.test(s) ? s : null;
}

/** Simulated delivery result: numbers ending in 3 aren't on WhatsApp. */
export const simulateSend = (phone: string): { ok: true } | { ok: false; error: string } =>
  phone.endsWith("3") ? { ok: false, error: "Nomor tidak terdaftar di WhatsApp" } : { ok: true };

export type CsvRow = { line: number; name: string; phone: string; include: boolean };
export type CsvIssue = "ok" | "nama" | "nomor" | "duplikat" | "terdaftar";

export type CsvParse = { ok: true; rows: CsvRow[] } | { ok: false; error: string };

export function parseCsv(text: string, fileName: string, size: number): CsvParse {
  if (!/\.csv$/i.test(fileName)) return { ok: false, error: "File harus berformat .csv. Simpan dari Excel/Sheets sebagai CSV dulu." };
  if (size > 1024 * 1024) return { ok: false, error: "File terlalu besar (maks. 1 MB atau sekitar 5.000 tamu)." };
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { ok: false, error: "File kosong. Isi minimal satu tamu di bawah baris judul." };
  const head = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const iName = head.indexOf("nama");
  const iPhone = head.indexOf("nomor_wa");
  if (iName < 0 || iPhone < 0) return { ok: false, error: "Kolom tidak sesuai. Baris pertama harus: nama,nomor_wa (pakai template)." };
  if (lines.length === 1) return { ok: false, error: "Belum ada tamu. Isi minimal satu baris di bawah judul kolom." };
  const rows = lines.slice(1).map((l, i) => {
    const c = l.split(",");
    return { line: i + 2, name: (c[iName] ?? "").trim(), phone: (c[iPhone] ?? "").trim(), include: true };
  });
  return { ok: true, rows };
}

/** Problems per row, in the order they're shown. */
export function issueOf(row: CsvRow, all: CsvRow[], existingPhones: Set<string>): CsvIssue {
  if (!row.name) return "nama";
  const p = normalizePhone(row.phone);
  if (!p) return "nomor";
  const firstSame = all.find((r) => r.include && normalizePhone(r.phone) === p);
  if (firstSame && firstSame.line !== row.line) return "duplikat";
  if (existingPhones.has(p)) return "terdaftar";
  return "ok";
}
