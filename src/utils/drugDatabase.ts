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
    match: ['ripril', 'রিপ্রিল', 'ramoril', 'র‍্যামোরিল', 'ramipril', 'র‍্যামিপ্রিল', 'primace', 'প্রাইমেস', 'r-pil', 'আর-পিল', 'tritace'],
    generic: 'Ramipril (র‍্যামিপ্রিল)',
    cls: 'ACE Inhibitor',
    coughRisk: 'HIGH',
    note: 'এই শ্রেণির রক্তচাপের ওষুধ প্রায়ই দীর্ঘস্থায়ী শুকনো, গলা সুড়সুড়ে কাশি সৃষ্টি করে। নিজে বন্ধ করবেন না; ডাক্তারকে বিকল্প ARB সম্পর্কে জিজ্ঞাসা করুন।',
  },
  {
    match: ['aceril', 'এসেরিল', 'enam', 'এনাম', 'angiten', 'এনজিটেন', 'enalapril', 'এনালাপ্রিল', 'neopril', 'নিওপ্রিল', 'cardopril'],
    generic: 'Enalapril (এনালাপ্রিল)',
    cls: 'ACE Inhibitor',
    coughRisk: 'HIGH',
    note: 'এসিই-ইনহিবিটর শ্রেণির ওষুধ; এটি শুকনো কাশির একটি অতি পরিচিত কারণ। ডাক্তারের পরামর্শ ছাড়া বন্ধ করবেন না।',
  },
  {
    match: ['lipril', 'লিপ্রিল', 'lisinopril', 'লিসিনোপ্রিল', 'zestril'],
    generic: 'Lisinopril (লিসিনোপ্রিল)',
    cls: 'ACE Inhibitor',
    coughRisk: 'HIGH',
    note: 'এসিই-ইনহিবিটর শ্রেণির ওষুধ; কাশির সিরাপে এটি সারে না, ডাক্তার বিকল্প ওষুধ দিতে পারেন।',
  },
  {
    match: ['coversyl', 'কোভারসিল', 'perindopril', 'পেরিন্ডোপ্রিল', 'prexum'],
    generic: 'Perindopril (পেরিন্ডোপ্রিল)',
    cls: 'ACE Inhibitor',
    coughRisk: 'HIGH',
    note: 'এসিই-ইনহিবিটর শ্রেণির ওষুধ; শুকনো কাশির সাথে সম্পর্কিত হতে পারে।',
  },
  {
    match: ['losartil', 'লোসার্টিল', 'losartan', 'লোসার্টান', 'osartil', 'ওসার্টিল', 'angilock', 'এনজিলক', 'losacar', 'larb'],
    generic: 'Losartan (লোসার্টান)',
    cls: 'ARB (রক্তচাপের ওষুধ)',
    coughRisk: 'LOW',
    note: 'সাধারণত শুকনো কাশি তৈরি করে না; অনেক সময় এসিই-ইনহিবিটরের বিকল্প হিসেবে ডাক্তার দেন।',
  },
  {
    match: ['olmesan', 'ওলমেসান', 'ransart', 'র‍্যানসার্ট', 'olmesartan', 'ওলমেসার্টান', 'telma', 'টেলমা', 'telmisartan', 'valsartan', 'diovan'],
    generic: 'ARB (Olmesartan / Telmisartan / Valsartan)',
    cls: 'ARB (রক্তচাপের ওষুধ)',
    coughRisk: 'LOW',
    note: 'ARB শ্রেণির রক্তচাপের ওষুধ সাধারণত শুকনো কাশি সৃষ্টি করে না।',
  },
  {
    match: ['bizoran', 'বিজোরান', 'amlocard', 'অ্যাম্লোকার্ড', 'amlodipine', 'অ্যাম্লোডিপিন', 'camlodin', 'amlong', 'amdocal'],
    generic: 'Amlodipine (অ্যাম্লোডিপিন)',
    cls: 'Calcium Channel Blocker',
    coughRisk: 'MODERATE',
    note: 'সরাসরি কাশি না করলেও কারও কারও ক্ষেত্রে অ্যাসিডিটি/রিফ্লাক্স বাড়িয়ে কাশিতে ভূমিকা রাখতে পারে ও গোড়ালি/পা ফোলাতে পারে।',
  },
  {
    match: ['bisocor', 'বিসোকর', 'concor', 'কনকর', 'bisoprolol', 'বিসোপ্রোলল', 'betaloc', 'prolol', 'atenolol', 'কার্ভেডিলল', 'carvedilol'],
    generic: 'Beta Blocker (Bisoprolol / Atenolol)',
    cls: 'Beta Blocker',
    coughRisk: 'MODERATE',
    note: 'হৃদরোগ ও প্রেশারের ওষুধ; হাঁপানি বা শ্বাসনালীর সমস্যা থাকলে কখনো শ্বাসটান বাড়াতে পারে—ডাক্তারের পর্যবেক্ষণে রাখুন।',
  },
  {
    match: ['seclo', 'সেকলো', 'omeprazole', 'ওমিপ্রাজল', 'sergel', 'সার্জেল', 'esomeprazole', 'maxpro', 'ম্যাক্সপ্রো', 'pantonix', 'প্যান্টোনিক্স', 'pantoprazole', 'finex'],
    generic: 'Proton Pump Inhibitor (PPI)',
    cls: 'অ্যাসিডিটি / জিইআরডি ওষুধ',
    coughRisk: 'LOW',
    note: 'পাকস্থলীর অ্যাসিড ও রিফ্লাক্সজনিত কাশি কমাতে সহায়তা করে; সাধারণত কাশি তৈরি করে না।',
  },
  {
    match: ['monas', 'মোনাস', 'montelukast', 'মন্টেলুকাস্ট', 'provair', 'প্রোভায়ার', 'montair', 'reversair'],
    generic: 'Montelukast (মন্টেলুকাস্ট)',
    cls: 'Leukotriene Receptor Antagonist',
    coughRisk: 'LOW',
    note: 'শ্বাসনালীর অ্যালার্জি বা হাঁপানিজনিত কাশি নিয়ন্ত্রণে চিকিৎসক দিয়ে থাকেন।',
  },
  {
    match: ['azmasol', 'আজমাসল', 'salbutamol', 'সালবুটামল', 'sultolin', 'সাল্টোলিন', 'windel', 'উইন্ডেল', 'sulprex'],
    generic: 'Salbutamol / Bronchodilator Inhaler',
    cls: 'Bronchodilator',
    coughRisk: 'LOW',
    note: 'শ্বাসনালী প্রসারিত করে শ্বাসকষ্ট ও হাঁপানির কাশি কমাতে ব্যবহৃত হয়। ইনহেলার ব্যবহারের পর কুলি করে মুখ ধোয়া ভালো।',
  },
  {
    match: ['budeson', 'বুডেসন', 'budesonide', 'seretide', 'ব্রেথফ্লো', 'fluticasone', 'bextram', 'pulmicort'],
    generic: 'Inhaled Corticosteroid (ICS)',
    cls: 'Inhaled Steroid / Preventer',
    coughRisk: 'LOW',
    note: 'শ্বাসনালীর প্রদাহ কমায়। ইনহেলার ব্যবহারের পর অবশ্যই পরিষ্কার পানি দিয়ে কুলি করুন যাতে গলা ভেঙে না যায় বা ছত্রাক না জমে।',
  },
  {
    match: ['fexo', 'ফেক্সো', 'telfast', 'টেলফাস্ট', 'fexofenadine', 'alasit', 'ruppax', 'rupatadine', 'histacin'],
    generic: 'Antihistamine (Fexofenadine / Rupatadine)',
    cls: 'Anti-Allergic',
    coughRisk: 'LOW',
    note: 'নাক থেকে গলায় কফ নামা (UACS) ও অ্যালার্জিজনিত কাশি কমাতে ডাক্তার দেন।',
  },
  {
    match: ['metfo', 'মেটফো', 'comet', 'কমেট', 'metformin', 'মেটফর্মিন', 'diabetin', 'glukophage', 'linagliptin', 'lina'],
    generic: 'Metformin / Diabetes Medication',
    cls: 'ডায়াবেটিস নিয়ন্ত্রণের ওষুধ',
    coughRisk: 'LOW',
    note: 'রক্তে শর্করা নিয়ন্ত্রণের ওষুধ; সাধারণত কাশি সৃষ্টি করে না।',
  },
  {
    match: ['lasix', 'ল্যাসিক্স', 'furosemide', 'ফিউরোসেমাইড', 'fusid', 'ফিউসিড', 'edemil'],
    generic: 'Furosemide (ফিউরোসেমাইড)',
    cls: 'Loop Diuretic',
    coughRisk: 'LOW',
    note: 'শরীর থেকে অতিরিক্ত পানি বের করার ওষুধ। হার্ট ফেইলিউর বা পা ফোলার ক্ষেত্রে ব্যবহৃত হয়।',
  },
  {
    match: ['ecosprin', 'ইকোস্প্রিন', 'clopid', 'ক্লোপিড', 'clopidogrel', 'atova', 'অ্যাটোভা', 'rosuva', 'রসুভা', 'atorvastatin'],
    generic: 'Cardioprotective (Antiplatelet / Statin)',
    cls: 'হৃদযন্ত্র সুরক্ষার ওষুধ',
    coughRisk: 'LOW',
    note: 'হৃদরোগ ও কোলেস্টেরল নিয়ন্ত্রণের নিয়মিত ওষুধ; কাশি সৃষ্টি করে না।',
  },
  {
    match: ['napa', 'নাপা', 'paracetamol', 'প্যারাসিটামল', 'ace tablet', 'অ্যাস'],
    generic: 'Paracetamol (প্যারাসিটামল)',
    cls: 'Analgesic / Antipyretic',
    coughRisk: 'LOW',
    note: 'জ্বর ও ব্যথার ওষুধ। সাধারণত নিরাপদ।',
  },
  {
    match: ['cefspan', 'cefixime', 'সেফিক্সিম', 'zimax', 'জিম্যাক্স', 'azithromycin', 'অ্যাজিথ্রোমাইসিন', 'moxacil'],
    generic: 'Antibiotic (Cefixime / Azithromycin)',
    cls: 'Antibiotic',
    coughRisk: 'LOW',
    note: 'ব্যাকটেরিয়াল সংক্রমণের অ্যান্টিবায়োটিক। ডাক্তারের পরামর্শ ছাড়া নিজে শুরু বা অসম্পূর্ণ বন্ধ করবেন না।',
  },
  {
    match: ['tuska', 'তুস্কা', 'dextromethorphan', 'adovas', 'অ্যাডোভাস', 'basok', 'বাসক'],
    generic: 'OTC Cough Syrup (সতর্কতা)',
    cls: 'Cough Suppressant / Syrup',
    coughRisk: 'MODERATE',
    note: 'সাধারণ কাশির সিরাপ ২+ সপ্তাহের কাশি, টিবি বা প্রেশারের ওষুধজনিত কাশির আসল কারণ সারায় না এবং অনেক সময় চিনি বা ঘুমভাব বাড়াতে পারে।',
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
  'Osartil (Losartan)',
  'Olmesan (Olmesartan)',
  'Amlocard (Amlodipine)',
  'Bizoran (Amlodipine + Olmesartan)',
  'Bisocor (Bisoprolol)',
  'Concor (Bisoprolol)',
  'Lasix (Furosemide)',
  'Seclo (Omeprazole)',
  'Sergel (Esomeprazole)',
  'Maxpro (Esomeprazole)',
  'Monas (Montelukast)',
  'Azmasol (Salbutamol Inhaler)',
  'Budeson (Budesonide)',
  'Fexo (Fexofenadine)',
  'Comet (Metformin)',
  'Metfo (Metformin)',
  'Atova (Atorvastatin)',
  'Ecosprin (Aspirin)',
  'Napa (Paracetamol)',
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
