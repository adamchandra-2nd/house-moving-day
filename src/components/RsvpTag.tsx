import "./RsvpTag.css";

export type RsvpAnswer = "ya" | "tidak" | "belum";
const LABEL: Record<RsvpAnswer, string> = { ya: "Akan datang", belum: "Belum jawab", tidak: "Tidak bisa" };

/** Figma: Tag RSVP — white outlined pill with a coloured dot. Kept visually apart from the filled attendance tags. */
export function RsvpTag({ answer }: { answer: RsvpAnswer }) {
  return (
    <span className={`rsvp-tag rsvp-tag--${answer} clay clay-light t-p-h5-bold`}>
      <span className="rsvp-tag__dot" />
      {LABEL[answer]}
    </span>
  );
}
