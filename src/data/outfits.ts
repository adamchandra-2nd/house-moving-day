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
export type OutfitItem = {
  label: string;
  node: string;
  /** Picker thumbnail, from the designers' outfit icon set. */
  icon: string;
  /**
   * Designed (it has an icon) but not modelled in the scene yet. Shown only
   * once the loaded scene has a node by this name, so a re-export that adds
   * it puts it in the picker with no code change -- and until then a guest
   * cannot pick clothes the character would not wear.
   */
  upcoming?: true;
};
/** The stored value is the label, so saved progress stays readable. */
export type Outfit = Record<OutfitCategory, string | null>;

const icon = (file: string) => new URL(`../assets/outfits/${file}.webp`, import.meta.url).href;

export const OUTFIT_CATEGORIES: { id: OutfitCategory; label: string; items: OutfitItem[] }[] = [
  {
    id: "baju",
    label: "Atasan",
    items: [
      { label: "Hoodie", node: "Puffy Top - Hoodie 2", icon: icon("atasan-02-hoodie") },
      { label: "Kaos bintang", node: "Puffy Top - Star Tee 2", icon: icon("atasan-01-kaos-bintang") },
      { label: "Kemeja pita", node: "Puffy Top - Shirt Bowtie 2", icon: icon("atasan-03-kemeja-dasi-kupu") },
      { label: "Sweater vest", node: "Puffy Top - Sweater Vest 2", icon: icon("atasan-05-rompi-hijau") },
      { label: "Jaket varsity", node: "Puffy Top - Varsity Jacket 2", icon: icon("atasan-06-jaket-varsity") },
      { label: "Blus pink", node: "Puffy Top - Pink Blouse", icon: icon("atasan-04-blus-pink"), upcoming: true },
    ],
  },
  {
    id: "celana",
    label: "Bawahan",
    items: [
      { label: "Celana hitam", node: "Puffy Bottom - Black Shorts 2", icon: icon("bawahan-01-celana-hitam") },
      { label: "Celana khaki", node: "Puffy Bottom - Khaki Shorts", icon: icon("bawahan-02-celana-khaki") },
      { label: "Overall denim", node: "Puffy Bottom - Denim Overall", icon: icon("bawahan-03-overall-denim") },
      { label: "Rok krem", node: "Puffy Bottom - Cream Skirt", icon: icon("bawahan-06-rok-krem") },
      { label: "Rok kotak", node: "Puffy Bottom - Plaid Skirt", icon: icon("bawahan-04-rok-kotak") },
      { label: "Rok tutu pink", node: "Puffy Bottom - Pink Tutu", icon: icon("bawahan-05-rok-tutu-pink"), upcoming: true },
    ],
  },
  {
    id: "aksesoris",
    label: "Aksesoris",
    items: [
      { label: "Topi navy", node: "Puffy Hat - Navy Cap", icon: icon("aksesori-03-topi-navy") },
      { label: "Bucket hat", node: "Puffy Hat - Bucket Hat", icon: icon("aksesori-04-bucket-hat") },
      { label: "Topi jerami", node: "Puffy Hat - Straw Hat", icon: icon("aksesori-05-topi-jerami") },
      { label: "Beret hitam", node: "Puffy Hat - Black Beret", icon: icon("aksesori-01-baret-hitam") },
      { label: "Beret abu", node: "Puffy Hat - Gray Beret", icon: icon("aksesori-02-baret-abu") },
      { label: "Mahkota", node: "Puffy Hat - Crown", icon: icon("aksesori-06-mahkota"), upcoming: true },
      { label: "Kacamata aviator", node: "Glasses - Aviator", icon: icon("kacamata-03-hitam-emas") },
      { label: "Kacamata oranye", node: "Glasses - Orange Sunnies", icon: icon("kacamata-05-bulat-oranye") },
      { label: "Cat eye pink", node: "Glasses - Pink Cat Eye", icon: icon("kacamata-04-cat-eye-pink") },
      { label: "Kacamata bulat", node: "Glasses - Round", icon: icon("kacamata-01-bulat"), upcoming: true },
      { label: "Kacamata kotak", node: "Glasses - Square", icon: icon("kacamata-02-kotak"), upcoming: true },
      { label: "Kacamata bunga", node: "Glasses - Flower", icon: icon("kacamata-06-bunga"), upcoming: true },
      { label: "Jepit bunga", node: "Puffy Hair - Flower Clip", icon: icon("aksesori-08-jepit-bunga") },
      { label: "Pita oranye", node: "Puffy Hair - Orange Bow", icon: icon("aksesori-07-pita-oranye"), upcoming: true },
    ],
  },
];

export const EMPTY_OUTFIT: Outfit = { baju: null, celana: null, aksesoris: null };

export const outfitSummary = (o: Outfit) => [o.baju, o.celana, o.aksesoris].filter(Boolean) as string[];

/** Nodes the code expects the scene to have today (upcoming ones excluded). */
export const READY_OUTFIT_NODES = OUTFIT_CATEGORIES.flatMap((c) => c.items.filter((i) => !i.upcoming).map((i) => i.node));

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
