// Curated Bangladesh Drug Reference (BDDrugBank / MedIndex Patterns)
export type CoughRiskLevel = 'HIGH' | 'MODERATE' | 'LOW' | 'UNKNOWN';

export interface DrugReferenceEntry {
  match: string[];
  generic: string;
  cls: string;
  coughRisk: CoughRiskLevel;
  note: string;
}

export const BD_DRUG_DB: DrugReferenceEntry[] = [
  {
    match: ['ripril', 'রিপ্রিল', 'ramoril', 'র‍্যামোরিল', 'ramipril', 'র‍্যামিপ্রিল', 'primace', 'প্রাইমেস', 'r-pil', 'আর-পিল'],
    generic: 'Ramipril (র‍্যামিপ্রিল)',
    cls: 'ACE Inhibitor',
    coughRisk: 'HIGH',
    note: 'এই শ্রেণির রক্তচাপের ওষুধ প্রায়ই দীর্ঘস্থায়ী শুকনো, গলা সুড়সুড়ে কাশি সৃষ্টি করে।',
  },
  {
    match: ['aceril', 'এসেরিল', 'enam', 'এনাম', 'angiten', 'এনজিটেন', 'enalapril', 'এনালাপ্রিল', 'neopril', 'নিওপ্রিল'],
    generic: 'Enalapril (এনালাপ্রিল)',
    cls: 'ACE Inhibitor',
    coughRisk: 'HIGH',
    note: 'এসিই-ইনহিবিটর শ্রেণির ওষুধ; এটি শুকনো কাশির একটি অতি পরিচিত কারণ।',
  },
  {
    match: ['lipril', 'লিপ্রিল', 'lisinopril', 'লিসিনোপ্রিল'],
    generic: 'Lisinopril (লিসিনোপ্রিল)',
    cls: 'ACE Inhibitor',
    coughRisk: 'HIGH',
    note: 'এসিই-ইনহিবিটর শ্রেণির ওষুধ; কাশির সিরাপে এটি সারে না, ডাক্তার বিকল্প ওষুধ দিতে পারেন।',
  },
  {
    match: ['coversyl', 'কোভারসিল', 'perindopril', 'পেরিন্ডোপ্রিল'],
    generic: 'Perindopril (পেরিন্ডোপ্রিল)',
    cls: 'ACE Inhibitor',
    coughRisk: 'HIGH',
    note: 'এসিই-ইনহিবিটর শ্রেণির ওষুধ; শুকনো কাশির সাথে সম্পর্কিত হতে পারে।',
  },
  {
    match: ['losartil', 'লোসার্টিল', 'losartan', 'লোসার্টান', 'osartil', 'ওসার্টিল', 'angilock', 'এনজিলক', 'losacar'],
    generic: 'Losartan (লোসার্টান)',
    cls: 'ARB (রক্তচাপের ওষুধ)',
    coughRisk: 'LOW',
    note: 'সাধারণত শুকনো কাশি তৈরি করে না; অনেক সময় এসিই-ইনহিবিটরের বিকল্প হিসেবে ডাক্তার দেন।',
  },
  {
    match: ['bizoran', 'বিজোরান', 'amlocard', 'অ্যাম্লোকার্ড', 'amlodipine', 'অ্যাম্লোডিপিন', 'camlodin', 'amlong'],
    generic: 'Amlodipine (অ্যাম্লোডিপিন)',
    cls: 'Calcium Channel Blocker',
    coughRisk: 'MODERATE',
    note: 'সরাসরি কাশি না করলেও কারও কারও ক্ষেত্রে অ্যাসিডিটি/রিফ্লাক্স বাড়িয়ে কাশিতে ভূমিকা রাখতে পারে ও পা ফোলাতে পারে।',
  },
  {
    match: ['seclo', 'সেকলো', 'omeprazole', 'ওমিপ্রাজল', 'sergel', 'সার্জেল', 'esomeprazole', 'maxpro', 'ম্যাক্সপ্রো'],
    generic: 'Proton Pump Inhibitor (PPI)',
    cls: 'অ্যাসিডিটি / জিইআরডি ওষুধ',
    coughRisk: 'LOW',
    note: 'পাকস্থলীর অ্যাসিড কমাতে ব্যবহৃত হয়; কাশির কারণ নয়।',
  },
  {
    match: ['monas', 'মোনাস', 'montelukast', 'মন্টেলুকাস্ট', 'provair', 'প্রোভায়ার'],
    generic: 'Montelukast (মন্টেলুকাস্ট)',
    cls: 'Leukotriene Receptor Antagonist',
    coughRisk: 'LOW',
    note: 'শ্বাসনালীর অ্যালার্জি বা হাঁপানিজনিত কাশি নিয়ন্ত্রণে চিকিৎসক দিয়ে থাকেন।',
  },
  {
    match: ['metfo', 'মেটফো', 'comet', 'কমেট', 'metformin', 'মেটফর্মিন'],
    generic: 'Metformin (মেটফর্মিন)',
    cls: 'ডায়াবেটিস নিয়ন্ত্রণের ওষুধ',
    coughRisk: 'LOW',
    note: 'রক্তে শর্করা নিয়ন্ত্রণের ওষুধ; সাধারণত কাশি সৃষ্টি করে না।',
  },
  {
    match: ['lasix', 'furosemide', 'ফিউরোসেমাইড'],
    generic: 'Furosemide (ফিউরোসেমাইড)',
    cls: 'Loop Diuretic',
    coughRisk: 'LOW',
    note: 'শরীর থেকে অতিরিক্ত পানি বের করার ওষুধ। হার্ট ফেইলিউর বা পা ফোলার ক্ষেত্রে ব্যবহৃত হয়।',
  },
  {
    match: ['napa', 'নাপা', 'paracetamol', 'প্যারাসিটামল', 'ace'],
    generic: 'Paracetamol (প্যারাসিটামল)',
    cls: 'Analgesic / Antipyretic',
    coughRisk: 'LOW',
    note: 'জ্বর ও ব্যথার ওষুধ। সাধারণত নিরাপদ।',
  },
  {
    match: ['cefspan', 'cefixime', 'সেফিক্সিম'],
    generic: 'Cefixime (সেফিক্সিম)',
    cls: 'Cephalosporin Antibiotic',
    coughRisk: 'LOW',
    note: 'ব্যাকটেরিয়াল ইনফেকশনের অ্যান্টিবায়োটিক। ডাক্তারের পরামর্শ ছাড়া ব্যবহার করবেন না।',
  },
];

export const BD_DRUG_SUGGESTIONS: string[] = [
  'Ripril (Ramipril)',
  'Ramoril (Ramipril)',
  'Aceril (Enalapril)',
  'Primace (Ramipril)',
  'R-Pil (Ramipril)',
  'Neopril (Lisinopril)',
  'Lipril (Lisinopril)',
  'Coversyl (Perindopril)',
  'Angiten (Enalapril)',
  'Losartil (Losartan)',
  'Amlocard (Amlodipine)',
  'Bizoran (Amlodipine + Olmesartan)',
  'Seclo (Omeprazole)',
  'Sergel (Esomeprazole)',
  'Monas (Montelukast)',
  'Metfo (Metformin)',
];

export function lookupDrugMatch(query: string): DrugReferenceEntry | null {
  const lower = query.trim().toLowerCase();
  if (!lower) return null;
  for (const entry of BD_DRUG_DB) {
    for (const token of entry.match) {
      if (lower.includes(token.toLowerCase())) {
        return entry;
      }
    }
  }
  return null;
}
