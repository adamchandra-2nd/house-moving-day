/**
 * Potara's story for the opening slides.
 * TODO: replace every [bracketed] part with Potara's real history (years, people, offices, milestones).
 */
export type StoryChapter = { chapter: string; title: string; body: string; say: string; room: number };

export const STORY: StoryChapter[] = [
  {
    chapter: "Bab 1 · [Tahun berdiri]",
    title: "Awal mula",
    body: "Potara lahir dari [cerita singkat awal mula: siapa, di mana, berawal dari apa].",
    say: "Duduk dulu, aku ceritain ya!",
    room: 0,
  },
  {
    chapter: "Bab 2 · [Tahun]",
    title: "Tim pertama",
    body: "[Jumlah] orang, satu mimpi: [mimpi awal tim Potara].",
    say: "Masih kecil banget dulu!",
    room: 2,
  },
  {
    chapter: "Bab 3 · [Tahun]",
    title: "Kantor pertama",
    body: "Rumah pertama kami di [lokasi kantor pertama]. [Satu kenangan khas dari kantor itu].",
    say: "Sempit, tapi seru!",
    room: 1,
  },
  {
    chapter: "Bab 4 · [Tahun]",
    title: "Momen besar",
    body: "[Proyek atau pencapaian penting yang mengubah perjalanan Potara].",
    say: "Ini momen favoritku!",
    room: 3,
  },
  {
    chapter: "Bab 5 · [Tahun]",
    title: "Tumbuh bareng",
    body: "Tim bertambah jadi [jumlah] orang. Ruangan lama mulai terasa sesak.",
    say: "Makin rame, makin sempit…",
    room: 4,
  },
  {
    chapter: "Bab 6 · 2026",
    title: "Saatnya pindah",
    body: "Kami butuh rumah yang bisa menampung semua cerita berikutnya. [Alasan memilih kantor baru].",
    say: "Akhirnya pindah juga!",
    room: 0,
  },
  {
    chapter: "Hari ini · 8 November 2026",
    title: "Selamat datang di rumah baru!",
    body: "Dan kamu jadi bagian dari bab barunya. Yuk, buat karaktermu lalu masuk.",
    say: "Selamat datang!",
    room: 0,
  },
];
