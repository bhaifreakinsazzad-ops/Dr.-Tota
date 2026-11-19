export interface Tier0Flag {
  id: string;
  label: string;
  patterns: string[];
}

export const TIER0_RED_FLAGS: Tier0Flag[] = [
  {
    id: 'hemoptysis',
    label: 'কাশির সাথে রক্ত (Hemoptysis)',
    patterns: ['রক্ত', 'রক্তের মতো', 'blood', 'rokto', 'কফে রক্ত'],
  },
  {
    id: 'dyspnea',
    label: 'তীব্র শ্বাসকষ্ট (Severe Dyspnea)',
    patterns: [
      'শ্বাস নিতে পারছি না',
      'দম বন্ধ',
      'শ্বাস আটকে',
      'শ্বাসকষ্ট',
      'হাঁপাচ্ছি',
      'কথা বলতে কষ্ট',
      'cannot breathe',
      "can't breathe",
      'breathless',
    ],
  },
  {
    id: 'cardiac',
    label: 'বুকে চাপ / হৃদরোগের ঝুঁকি (Cardiac Red Flag)',
    patterns: [
      'বুকে চাপ',
      'বুকে ব্যথা',
      'বুক ভার',
      'বুক চেপে',
      'বাম হাতে ব্যথা',
      'চোয়ালে ব্যথা',
      'ঘাম দিয়ে বুক',
      'chest pain',
      'chest pressure',
    ],
  },
  {
    id: 'angioedema',
    label: 'মুখ, ঠোঁট বা গলা ফুলে যাওয়া (Angioedema)',
    patterns: ['ঠোঁট ফুলে', 'জিহ্বা ফুলে', 'গলা ফুলে', 'মুখ ফুলে', 'গিলতে পারছি না', 'swelling lip', 'throat swell'],
  },
  {
    id: 'stroke',
    label: 'স্ট্রোকের সম্ভাব্য লক্ষণ (Stroke Signs)',
    patterns: ['কথা জড়িয়ে', 'কথা জড়িয়ে', 'এক পাশ অবশ', 'একপাশ অবশ', 'মুখ বেঁকে', 'হঠাৎ অজ্ঞান', 'হঠাৎ দুর্বল', 'slurred'],
  },
  {
    id: 'selfharm',
    label: 'মানসিক সংকট / আত্মহত্যার ঝুঁকি',
    patterns: ['বাঁচতে ইচ্ছে করছে না', 'মরে যেতে চাই', 'বাঁচতে চাই না', 'আত্মহত্যা', 'suicide', 'kill myself'],
  },
];

export const EMERGENCY_SCRIPT_BN =
  'শুনুন, এটা খুব জরুরি হতে পারে। এখনই ৯৯৯ নম্বরে কল করুন, অথবা আপনার পাশের কাউকে বলুন ৯৯৯-এ কল করতে। দয়া করে শান্ত হয়ে বসে পড়ুন, হাঁটাহাঁটি করবেন না। আপনার পাশে কি এখন কেউ আছেন?';

export function runServerSafetyCheck(rawText: string): Tier0Flag | null {
  const lower = rawText.toLowerCase();
  for (const rf of TIER0_RED_FLAGS) {
    for (const pattern of rf.patterns) {
      if (lower.includes(pattern.toLowerCase())) {
        return rf;
      }
    }
  }
  return null;
}
