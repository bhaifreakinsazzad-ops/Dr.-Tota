// Deterministic Pre-LLM Emergency Safety Gateway
export interface SafetyResult {
  isEmergency: boolean;
  tier: string;
  reason: string;
  emergencyScriptBn: string;
}

const EMERGENCY_REGEX_PATTERNS: { pattern: RegExp; reason: string }[] = [
  { pattern: /রক্ত|blood|hemoptysis|কফের সাথে রক্ত|কাশির সাথে রক্ত/i, reason: "Hemoptysis - Blood in cough/sputum" },
  { pattern: /শ্বাস\s*কষ্ট|দম\s*বন্ধ|can't breathe|breathless|দম নিতে পারি না|শ্বাস নিতে পারছি না|নিঃশ্বাস/i, reason: "Acute respiratory distress" },
  { pattern: /বুক\s*চেপে|বুকে\s*চাপ|chest pain|chest pressure|হার্ট\s*অ্যাটাক|বুকের ভেতর ভার|বুকে ব্যথা/i, reason: "Possible cardiac event" },
  { pattern: /মুখ\s*বেঁকে|কথা\s*জড়িয়ে|stroke|একপাশ অবশ|হাত তুলতে পারছি না|weakness one side/i, reason: "Possible stroke symptoms" },
  { pattern: /গলা\s*ফুলে|জিভ\s*ফুলে|swollen throat|swollen lips|অ্যালার্জি শ্বাসকষ্ট|anaphylaxis/i, reason: "Anaphylaxis / airway obstruction" },
  { pattern: /আত্মহত্যা|মরতে চাই|বাঁচতে চাই না|suicide|kill myself/i, reason: "Self-harm risk detected" },
];

export function evaluateSafetyGate(userInputText: string): SafetyResult {
  for (const { pattern, reason } of EMERGENCY_REGEX_PATTERNS) {
    if (pattern.test(userInputText)) {
      return {
        isEmergency: true,
        tier: "T0",
        reason,
        emergencyScriptBn: "শুনুন, এটা খুব জরুরি লক্ষণ হতে পারে। এখনই ৯৯৯ নম্বরে কল করুন অথবা পাশের কাউকে ডাকুন। আমি আপনার পরিবারের কাছেও জরুরি বার্তা পাঠিয়েছি। দয়া করে শান্ত হয়ে বসুন, হাঁটাচলা করবেন না।"
      };
    }
  }
  return { isEmergency: false, tier: "", reason: "", emergencyScriptBn: "" };
}
