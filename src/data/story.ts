/**
 * Potara's story for the opening slides.
 * DUMMY: a made-up but realistic history (Purwokerto, three founders, Perumahan Grand Lavali) so the flow reads
 * well in demos. Replace years, places and milestones with Potara's real history before launch or the final pitch.
 */
export type StoryChapter = { chapter: string; title: string; body: string; say: string; room: number };

export const STORY: StoryChapter[] = [
  {
    chapter: "Bab 1 · 2017",
    title: "Awal mula",
    body: "Potara berawal dari obrolan panjang di sebuah kamar kos di Grendeng, dekat kampus Unsoed: bagaimana kalau karya digital dari Purwokerto bisa dipakai orang di mana saja?",
    say: "Duduk dulu, aku ceritain ya!",
    room: 0,
  },
  {
    chapter: "Bab 2 · 2018",
    title: "Tiga pendiri",
    body: "Tiga orang memutuskan untuk serius. Mereka mendirikan Potara dan mengerjakan proyek pertamanya bersama.",
    say: "Bertiga aja dulu!",
    room: 2,
  },
  {
    chapter: "Bab 3 · 2019",
    title: "Kantor pertama",
    body: "Rumah pertama kami sebuah rumah di Perumahan Grand Lavali. Ruang tamunya jadi ruang kerja, dapurnya jadi ruang rapat.",
    say: "Ruang tamu jadi kantor!",
    room: 1,
  },
  {
    chapter: "Bab 4 · 2021",
    title: "Momen besar",
    body: "Proyek kami makin banyak datang dari luar negeri. Dari Purwokerto, Potara mengerjakan produk untuk klien di berbagai negara.",
    say: "Sampai ke luar negeri!",
    room: 3,
  },
  {
    chapter: "Bab 5 · 2024",
    title: "Tumbuh bareng",
    body: "Tim makin besar. Rumah lama di Grand Lavali mulai terasa sesak.",
    say: "Makin rame, makin sempit…",
    room: 4,
  },
  {
    chapter: "Bab 6 · 2026",
    title: "Saatnya pindah",
    body: "Kami butuh rumah yang muat semua cerita berikutnya. Masih di Grand Lavali, Purwokerto: rumah baru dengan lima ruangan, lengkap dengan Ruang Omakase untuk makan bareng.",
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
