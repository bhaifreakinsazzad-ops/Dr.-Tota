// Telegram & WhatsApp Alert Dispatch
import type { PatientProfile, CoughLog, Medication } from './storage';

export async function sendTelegramAlert(
  token: string,
  chatId: string,
  messageText: string
): Promise<boolean> {
  if (!token || !chatId) {
    console.warn("Telegram credentials not configured.");
    return false;
  }
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: messageText,
        parse_mode: "Markdown"
      })
    });
    return res.ok;
  } catch (err) {
    console.error("Failed to send Telegram alert:", err);
    return false;
  }
}

export function sendEmergencyTelegram(token: string, chatId: string, userInput: string): void {
  const message = `🚨 *জরুরি সতর্কতা - ডাঃ তোতা* 🚨\n\n` +
    `*সময়:* ${new Date().toLocaleString('bn-BD')}\n` +
    `*জরুরি লক্ষণ শনাক্ত:*\n"${userInput}"\n\n` +
    `⚠️ দয়া করে অবিলম্বে যোগাযোগ করুন।\n` +
    `_ডাঃ তোতা একটি এআই সহকারী, আসল ডাক্তার নয়।_`;
  sendTelegramAlert(token, chatId, message);
}

export function generateWhatsAppSummary(
  profile: PatientProfile,
  coughLogs: CoughLog[],
  medications: Medication[]
): string {
  let summary = `*ডাঃ তোতা (Dr. Tota) — স্বাস্থ্য ও কাশির রিপোর্ট*\n`;
  summary += `━━━━━━━━━━━━━━━━━━━━\n`;
  summary += `রোগীর নাম: ${profile.name || '—'} (${profile.preferredAddress || '—'})\n`;
  summary += `কাশি চলছে: ${profile.coughWeeks} সপ্তাহ ধরে\n`;
  if (profile.conditions) {
    summary += `পরিচিত সমস্যা: ${profile.conditions}\n`;
  }
  summary += `\n*বর্তমান ওষুধসমূহ:*\n`;
  if (medications.length === 0) {
    summary += `• কোনো ওষুধ যোগ করা হয়নি\n`;
  } else {
    medications.forEach(m => {
      summary += `• ${m.brand} (${m.generic}) - ${m.schedule}\n`;
      if (m.coughInducing) {
        summary += `  ⚠️ [ACE Inhibitor কাশির ঝুঁকি]\n`;
      }
    });
  }

  summary += `\n*সাম্প্রতিক কাশির লগ:*\n`;
  if (coughLogs.length === 0) {
    summary += `• কোনো লগ নেই\n`;
  } else {
    coughLogs.slice(-5).forEach(l => {
      summary += `• ${l.date}: ${l.type === 'dry' ? 'শুকনো' : 'কফযুক্ত'}, ${l.timing}`;
      if (l.associated.length > 0) {
        summary += ` | ${l.associated.join(", ")}`;
      }
      summary += `\n`;
    });
  }

  summary += `\nজরুরি যোগাযোগ: ${profile.caregiverPhone || '—'}\n`;
  summary += `━━━━━━━━━━━━━━━━━━━━\n`;
  summary += `_ডাঃ তোতা একটি এআই সহকারী, আসল ডাক্তার নয়।_`;

  return encodeURIComponent(summary);
}

export function openWhatsAppReport(profile: PatientProfile, logs: CoughLog[], meds: Medication[]): void {
  const encoded = generateWhatsAppSummary(profile, logs, meds);
  const phone = profile.caregiverPhone ? profile.caregiverPhone.replace(/[^0-9]/g, '') : '';
  const url = phone
    ? `https://wa.me/${phone}?text=${encoded}`
    : `https://wa.me/?text=${encoded}`;
  window.open(url, '_blank');
}
