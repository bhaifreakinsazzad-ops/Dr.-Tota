// Bangladesh Pharmaceutical Reference Database (BDDrugBank Mock Engine)
export interface DrugEntry {
  brand: string;
  generic: string;
  strength: string;
  class: string;
  coughInducing: boolean;
  warningBn: string;
}

export const BD_DRUG_DATABASE: DrugEntry[] = [
  {
    brand: "Ripril",
    generic: "Ramipril",
    strength: "2.5mg / 5mg",
    class: "ACE Inhibitor (Antihypertensive)",
    coughInducing: true,
    warningBn: "সতর্কতা: র‍্যামিপ্রিল (ACE Inhibitor) ওষুধে অনেকের দীর্ঘমেয়াদী শুকনো কাশি হতে পারে। নিজে থেকে ওষুধ বন্ধ করবেন না, তবে ডাক্তারের সাথে পরামর্শ করে বিকল্প ওষুধ (যেমন ARB) নেওয়া যায় কিনা তা আলোচনা করুন।"
  },
  {
    brand: "Ramoril",
    generic: "Ramipril",
    strength: "5mg",
    class: "ACE Inhibitor",
    coughInducing: true,
    warningBn: "সতর্কতা: র‍্যামিপ্রিল জাতীয় ওষুধে শুকনো কাশি একটি পরিচিত পার্শ্বপ্রতিক্রিয়া। ডাক্তারকে এটি জানান।"
  },
  {
    brand: "Neopril",
    generic: "Enalapril",
    strength: "5mg",
    class: "ACE Inhibitor",
    coughInducing: true,
    warningBn: "সতর্কতা: এনালাপ্রিল একটি ACE Inhibitor যা শ্বাসনালীতে ব্রাডিকাইনিন বাড়িয়ে শুকনো কাশি তৈরি করতে পারে।"
  },
  {
    brand: "Lipril",
    generic: "Lisinopril",
    strength: "5mg / 10mg",
    class: "ACE Inhibitor",
    coughInducing: true,
    warningBn: "সতর্কতা: লিসিনোপ্রিল একটি ACE Inhibitor। দীর্ঘমেয়াদী শুকনো কাশি হতে পারে। ডাক্তারের সাথে আলোচনা করুন।"
  },
  {
    brand: "Sergel",
    generic: "Esomeprazole",
    strength: "20mg / 40mg",
    class: "Proton Pump Inhibitor (Anti-ulcerant)",
    coughInducing: false,
    warningBn: "গ্যাস্ট্রিক বা বুক জ্বালাপোড়ার জন্য ব্যবহৃত হয়। অ্যাসিডিটি বা রিফ্লাক্সের কারণে কাশি হলে ডাক্তার এটি দিয়ে থাকেন।"
  },
  {
    brand: "Comet",
    generic: "Metformin Hydrochloride",
    strength: "500mg / 850mg",
    class: "Antidiabetic (Biguanide)",
    coughInducing: false,
    warningBn: "ডায়াবেটিস নিয়ন্ত্রণের ওষুধ। নিয়মিত খাবারের সাথে সেবন করতে হয়।"
  },
  {
    brand: "Monas",
    generic: "Montelukast",
    strength: "10mg",
    class: "Leukotriene Receptor Antagonist",
    coughInducing: false,
    warningBn: "অ্যাজমা, অ্যালার্জি এবং শ্বাসনালীর টান কমানোর ওষুধ।"
  },
  {
    brand: "Amlong",
    generic: "Amlodipine",
    strength: "5mg / 10mg",
    class: "Calcium Channel Blocker",
    coughInducing: false,
    warningBn: "রক্তচাপ নিয়ন্ত্রণের ওষুধ। সাধারণত কাশি করে না, তবে পা ফোলা হতে পারে।"
  },
  {
    brand: "Losartan",
    generic: "Losartan",
    strength: "50mg / 100mg",
    class: "ARB (Angiotensin Receptor Blocker)",
    coughInducing: false,
    warningBn: "রক্তচাপের ওষুধ। ACE Inhibitor-এর বিকল্প হিসেবে ব্যবহৃত হয়, কাশি কম হয়।"
  },
  {
    brand: "Lasix",
    generic: "Furosemide",
    strength: "40mg",
    class: "Loop Diuretic",
    coughInducing: false,
    warningBn: "শরীর থেকে অতিরিক্ত পানি বের করার ওষুধ। হার্ট ফেইলিউর বা পা ফোলার ক্ষেত্রে ব্যবহৃত হয়।"
  },
  {
    brand: "Napa",
    generic: "Paracetamol",
    strength: "500mg",
    class: "Analgesic / Antipyretic",
    coughInducing: false,
    warningBn: "জ্বর ও ব্যথার ওষুধ। সাধারণত নিরাপদ।"
  },
  {
    brand: "Seclo",
    generic: "Omeprazole",
    strength: "20mg",
    class: "Proton Pump Inhibitor",
    coughInducing: false,
    warningBn: "গ্যাস্ট্রিক এসিড কমানোর ওষুধ। রিফ্লাক্সজনিত কাশিতে সাহায্য করতে পারে।"
  },
  {
    brand: "Cefspan",
    generic: "Cefixime",
    strength: "200mg",
    class: "Cephalosporin Antibiotic",
    coughInducing: false,
    warningBn: "ব্যাকটেরিয়াল ইনফেকশনের অ্যান্টিবায়োটিক। ডাক্তারের পরামর্শ ছাড়া ব্যবহার করবেন না।"
  }
];

export function auditMedicine(medName: string): DrugEntry {
  const query = medName.trim().toLowerCase();
  const match = BD_DRUG_DATABASE.find(d =>
    d.brand.toLowerCase() === query || d.generic.toLowerCase() === query
  );
  if (match) return match;
  return {
    brand: medName,
    generic: "অনিশ্চিত (Unverified Generic)",
    strength: "—",
    class: "অজ্ঞাত",
    coughInducing: false,
    warningBn: "ওষুধটি স্থানীয় ডাটাবেজে পাওয়া যায়নি। ডাক্তারের প্রেসক্রিপশন অনুযায়ী সঠিক নাম ও জেনেরিক মিলিয়ে নিন।"
  };
}
