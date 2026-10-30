import { useEffect, useState } from "react";
import { Button } from "../components/Button";
import { Character } from "../components/Character";
import { Dialog } from "../components/Dialog";
import { Icon } from "../components/Icon";
import { OUTFIT_CATEGORIES, outfitSummary, type Outfit, type OutfitCategory } from "../data/outfits";
import { ROOMS } from "../data/rooms";
import { useCharacterStage } from "../character/characterStageContext";
import { storeSprite } from "../character/sprite";
import { api } from "../data/adapters";
import "./Customize.css";


const WARN_AFTER_MS = 3000;

type Props = {
  /** From the invitation; guests can't rename themselves. */
  name: string;
  initialOutfit: Outfit;
  onConfirm: (outfit: Outfit) => void;
};

/** Character customisation: outfit only (the dragon stays orange). Confirming here marks the guest "hadir". */
export function Customize({ name, initialOutfit, onConfirm }: Props) {
  const [outfit, setOutfit] = useState<Outfit>(initialOutfit);
  const [cat, setCat] = useState<OutfitCategory>("baju");
  const category = OUTFIT_CATEGORIES.find((c) => c.id === cat)!;
  const worn = outfitSummary(outfit);

  const [idle, setIdle] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const stage = useCharacterStage();
  // Clothes the character can actually wear: upcoming ones wait for the scene.
  const items = category.items.filter((i) => (stage.available ? stage.available.has(i.node) : !i.upcoming));

  // After a few quiet seconds, the character reminds the guest that the outfit is final.
  useEffect(() => {
    setIdle(false);
    const t = window.setTimeout(() => setIdle(true), WARN_AFTER_MS);
    return () => clearTimeout(t);
  }, [outfit, cat]);

  const pick = (item: string | null) => setOutfit({ ...outfit, [cat]: item });

  /** Dress the shared character as the guest picks, without committing it. */
  useEffect(() => {
    stage.previewOutfit(outfit);
    return () => stage.previewOutfit(null);
  }, [outfit, stage]);

  let bubble: string;
  if (idle) bubble = "Pilih yang pas ya! Nanti nggak bisa ganti 🙈";
  else if (worn.length) bubble = `Pakai ${worn.join(", ")}!`;
  else bubble = `Halo, aku ${name}!`;

  /**
   * Keep the look the guest just made, then go in. A failed capture is not
   * worth blocking check-in over — the 2D character stands in.
   */
  const finish = () => {
    // Taken now, stored when ready: the capture grabs the frame before
    // onConfirm navigates away and moves the canvas.
    void stage.capture().then((sprite) => {
      if (!sprite) return;
      void storeSprite(sprite);
      // For the other guests: their kenalan cards show this picture. In a
      // review case there is no invite token and the upload is simply refused.
      void api.uploadSprite(sprite).catch(() => undefined);
    });
    onConfirm(outfit);
  };

  return (
    <main className="flow customize screen-enter">
      <div className="flow__bg" style={{ backgroundImage: `url(${ROOMS[0].image})` }} />
      <div className="flow__top">
        <section className="panel glass">
          <h1 className="t-display-h6 panel__title">Buat karaktermu</h1>
          <p className="t-p-h5 panel__body">Pilih pakaian untuk karaktermu, {name}.</p>
        </section>
      </div>
      <div className="flow__stage">
        <Character say={bubble} plain />
        {/* Only here: while the scene is still coming, outfit picks would not
            show on the flat sprite, so say so rather than look broken. */}
        {stage.status === "loading" && (
          <span className="character-stage__progress t-p-h5" role="status">
            Menyiapkan 3D…
            <span className="character-stage__bar">
              <span className="character-stage__fill" style={{ width: `${stage.progress}%` }} />
            </span>
          </span>
        )}
        {stage.status === "skipped" && (
          <button type="button" className="character-stage__progress t-p-h5" onClick={stage.loadAnyway}>
            Koneksi lemah — muat karakter 3D?
          </button>
        )}
        {stage.status === "failed" && (
          <button type="button" className="character-stage__progress t-p-h5" onClick={stage.loadAnyway}>
            3D gagal dimuat — coba lagi
            {stage.error && <span className="character-stage__error">{stage.error.slice(0, 80)}</span>}
          </button>
        )}
      </div>
      <div className="flow__bottom">
        <section className="panel glass customize__panel">
          <div className="customize__tabs" role="tablist" aria-label="Kategori pakaian">
            {OUTFIT_CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={c.id === cat}
                className={`customize__tab t-p-h5-bold${c.id === cat ? " is-active clay clay-dark" : ""}`}
                onClick={() => setCat(c.id)}
              >
                {c.label}
                {outfit[c.id] && <span className="customize__tab-dot" aria-label="dipilih" />}
              </button>
            ))}
          </div>
          <div className="customize__items" role="radiogroup" aria-label={category.label}>
            {[null, ...items].map((entry) => {
              const item = entry?.label ?? null;
              const selected = outfit[cat] === item;
              return (
                <button
                  key={item ?? "none"}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={`customize__item clay clay-light${selected ? " is-selected" : ""}`}
                  onClick={() => pick(item)}
                >
                  <span className={`customize__thumb${entry ? " has-icon" : ""}`}>
                    {entry ? <img src={entry.icon} alt="" loading="lazy" decoding="async" /> : <Icon name="Close" size={20} />}
                  </span>
                  <span className="t-p-h5-bold customize__item-label">{item ?? "Tanpa"}</span>
                  {selected && (
                    <span className="customize__check">
                      <Icon name="Check" size={12} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>
        <Button block onClick={() => setConfirm(true)}>
          Selesai, aku masuk!
        </Button>
      </div>
      {confirm && (
        <Dialog
          title="Yakin sama gayamu?"
          onClose={() => setConfirm(false)}
          actions={
            <>
              <Button block onClick={finish}>
                Yakin, masuk!
              </Button>
              <Button block style="tertiary" onClick={() => setConfirm(false)}>
                Pilih lagi
              </Button>
            </>
          }
        >
          Nanti nggak bisa ganti baju lagi. Malu kalau ada yang lihat!
        </Dialog>
      )}
    </main>
  );
}
