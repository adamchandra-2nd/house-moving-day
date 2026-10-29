/**
 * Outfit options, mirrored from the "Pota Wardrobe v2" group in the Spline
 * scene. `node` is the Spline object toggled on the 3D character; `label` is
 * what the guest reads. Keep them together so the two can't drift apart.
 *
 * If the scene is re-exported and a name changes, SplineStage reports the
 * unresolved node in the console instead of failing silently — see
 * `src/character/SplineStage.tsx`.
 */
export type OutfitCategory = "baju" | "celana" | "aksesoris";
export type OutfitItem = { label: string; node: string };
/** The stored value is the label, so saved progress stays readable. */
export type Outfit = Record<OutfitCategory, string | null>;

export const OUTFIT_CATEGORIES: { id: OutfitCategory; label: string; items: OutfitItem[] }[] = [
  {
    id: "baju",
    label: "Atasan",
    items: [
      { label: "Hoodie", node: "Puffy Top - Hoodie 2" },
      { label: "Kaos bintang", node: "Puffy Top - Star Tee 2" },
      { label: "Kemeja pita", node: "Puffy Top - Shirt Bowtie 2" },
      { label: "Sweater vest", node: "Puffy Top - Sweater Vest 2" },
      { label: "Jaket varsity", node: "Puffy Top - Varsity Jacket 2" },
    ],
  },
  {
    id: "celana",
    label: "Bawahan",
    items: [
      { label: "Celana hitam", node: "Puffy Bottom - Black Shorts 2" },
      { label: "Celana khaki", node: "Puffy Bottom - Khaki Shorts" },
      { label: "Overall denim", node: "Puffy Bottom - Denim Overall" },
      { label: "Rok krem", node: "Puffy Bottom - Cream Skirt" },
      { label: "Rok kotak", node: "Puffy Bottom - Plaid Skirt" },
    ],
  },
  {
    id: "aksesoris",
    label: "Aksesoris",
    items: [
      { label: "Topi navy", node: "Puffy Hat - Navy Cap" },
      { label: "Bucket hat", node: "Puffy Hat - Bucket Hat" },
      { label: "Topi jerami", node: "Puffy Hat - Straw Hat" },
      { label: "Beret hitam", node: "Puffy Hat - Black Beret" },
      { label: "Beret abu", node: "Puffy Hat - Gray Beret" },
      { label: "Kacamata aviator", node: "Glasses - Aviator" },
      { label: "Kacamata oranye", node: "Glasses - Orange Sunnies" },
      { label: "Cat eye pink", node: "Glasses - Pink Cat Eye" },
      { label: "Jepit bunga", node: "Puffy Hair - Flower Clip" },
    ],
  },
];

export const EMPTY_OUTFIT: Outfit = { baju: null, celana: null, aksesoris: null };

export const outfitSummary = (o: Outfit) => [o.baju, o.celana, o.aksesoris].filter(Boolean) as string[];

/** Every wearable node, so the stage can hide the whole wardrobe before dressing. */
export const ALL_OUTFIT_NODES = OUTFIT_CATEGORIES.flatMap((c) => c.items.map((i) => i.node));

/** The nodes for one chosen outfit. */
export function outfitNodes(outfit: Outfit): string[] {
  return OUTFIT_CATEGORIES.flatMap((c) => {
    const chosen = outfit[c.id];
    const item = chosen ? c.items.find((i) => i.label === chosen) : undefined;
    return item ? [item.node] : [];
  });
}
