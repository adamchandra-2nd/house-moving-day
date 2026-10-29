import "./QrCode.css";

const SIZE = 25;

/** Deterministic QR-style pattern for the prototype (not scannable). Replace with a real QR from the backend token. */
function cells(seed: string) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const rand = () => ((h = Math.imul(h ^ (h >>> 13), 1274126177)) >>> 0) / 4294967296;
  const inFinder = (x: number, y: number) =>
    (x < 8 && y < 8) || (x >= SIZE - 8 && y < 8) || (x < 8 && y >= SIZE - 8);
  const out: [number, number][] = [];
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) if (!inFinder(x, y) && rand() > 0.5) out.push([x, y]);
  return out;
}

const Finder = ({ x, y }: { x: number; y: number }) => (
  <>
    <rect x={x} y={y} width={7} height={7} rx={1.5} />
    <rect x={x + 1} y={y + 1} width={5} height={5} rx={1} style={{ fill: "var(--white)" }} />
    <rect x={x + 2} y={y + 2} width={3} height={3} rx={0.6} />
  </>
);

/** Figma: QR — personal code shown to another guest or the committee. */
export function QrCode({ value, label }: { value: string; label: string }) {
  return (
    <svg className="qr" viewBox={`-2 -2 ${SIZE + 4} ${SIZE + 4}`} role="img" aria-label={label}>
      <rect x={-2} y={-2} width={SIZE + 4} height={SIZE + 4} rx={3} style={{ fill: "var(--white)" }} />
      <g style={{ fill: "var(--ink)" }}>
        {cells(value).map(([x, y]) => (
          <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} />
        ))}
        <Finder x={0} y={0} />
        <Finder x={SIZE - 7} y={0} />
        <Finder x={0} y={SIZE - 7} />
      </g>
    </svg>
  );
}
