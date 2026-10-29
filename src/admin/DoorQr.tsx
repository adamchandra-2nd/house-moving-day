import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Button } from "../components/Button";
import { request } from "../data/http";
import { loadSession } from "./api";

type Door = { url: string; code: string };

/**
 * The QR for the entrance, printed by the committee.
 *
 * Its URL comes from the server (APP_BASE_URL), not from this laptop's
 * address bar: the committee may be on localhost while guests open the app
 * somewhere else, and a QR pointing at the committee's laptop opens nothing on
 * a guest's phone. The code under it is the same door code, so a guest whose
 * camera will not cooperate can still type it.
 *
 * `code` is the saved door code; changing it re-reads the URL, and the old
 * poster stops working -- which is the point of changing it.
 */
export function DoorQr({ code }: Readonly<{ code: string }>) {
  const [door, setDoor] = useState<Door | null>(null);
  const [svg, setSvg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    request<Door>("/api/admin/door", { token: loadSession() })
      .then(async (d) => {
        const markup = await QRCode.toString(d.url, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
        if (!alive) return;
        setDoor(d);
        setSvg(markup);
        setError("");
      })
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : "QR pintu gagal dimuat."));
    return () => void (alive = false);
  }, [code]);

  /** A plain page with nothing but the poster, so the browser's print dialog is all there is to it. */
  const print = () => {
    if (!door) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!doctype html><html lang="id"><head><meta charset="utf-8"><title>QR pintu · House Moving Day</title>
<style>
  body{font-family:system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;text-align:center;color:#1d1b19}
  h1{font-size:40px;margin:0 0 8px} p{font-size:20px;margin:0 0 24px}
  .qr{width:min(80vw,520px)} .qr svg{width:100%;height:auto}
  .code{font-size:56px;font-weight:700;letter-spacing:.3em;margin-top:24px}
  small{font-size:16px;color:#6b645d}
</style></head><body>
<h1>Selamat datang di Potara!</h1>
<p>Buka aplikasi dari link undanganmu, lalu scan QR ini untuk check-in.</p>
<div class="qr">${svg}</div>
<div class="code">${door.code}</div>
<small>Kamera tidak bisa? Ketik kode di atas di layar check-in.</small>
<script>window.onload=()=>window.print()</script>
</body></html>`);
    w.document.close();
  };

  if (error) return <span className="t-p-h5 field__hint field__hint--error">{error}</span>;
  if (!door) return <span className="t-p-h5 akses-hero__note">Memuat QR pintu…</span>;
  return (
    <div className="akses-code">
      <span className="akses-code__label">
        <span className="t-p-h4-bold">QR pintu</span>
        <span className="t-p-h5 akses-hero__note">Tempel di pintu masuk. Tamu scan dari layar check-in.</span>
      </span>
      <div style={{ width: 160, background: "#fff", borderRadius: 12, padding: 8 }} dangerouslySetInnerHTML={{ __html: svg }} />
      <span className="t-p-h5 akses-hero__note" style={{ wordBreak: "break-all" }}>
        {door.url}
      </span>
      <div className="akses-hero__actions">
        <Button size="small" icon="Download" onClick={print}>
          Cetak poster
        </Button>
      </div>
    </div>
  );
}
