import type { DrTotaState, PatientProfile, CoughLog, Medication } from './storage';

export function buildWhatsappSummaryText(state: DrTotaState): string {
  const p: PatientProfile = state.profile;
  const meds: Medication[] = state.medications;
  const logs: CoughLog[] = state.coughLogs;

  const mother = p.motherName ? `${p.motherName} (${p.preferredAddress})` : p.preferredAddress;
  const medLines =
    meds.length > 0
      ? meds
          .map((m, i) => {
            const flag = m.coughRisk === 'HIGH' ? ' [সতর্কতা: ACE Inhibitor - শুকনো কাশি হতে পারে]' : '';
            return `${i + 1}. ${m.brandName} (${m.generic}) — ${m.prayerTime}${m.dose ? ` (${m.dose})` : ''}${flag}`;
          })
          .join('\n')
      : 'কোনো ওষুধ এখনো নথিভুক্ত হয়নি';

  const recentLogs =
    logs.length > 0
      ? logs
          .slice(0, 5)
          .map(
            (l) =>
              `• ${l.date}: ${l.type}, তীব্রতা ${l.severity}/১০ [${l.tier}] — ${l.domains.join(', ') || 'সাধারণ'}`
          )
          .join('\n')
      : 'এখনো কোনো কাশির ডায়েরি যোগ করা হয়নি';

  const aceWarning = meds.some((m) => m.coughRisk === 'HIGH')
    ? '\n* ডাক্তারের জন্য বিশেষ প্রশ্ন: রক্তচাপের ওষুধ (ACE Inhibitor) থেকে কি এই শুকনো কাশি হচ্ছে? বিকল্প ARB ওষুধ বিবেচনা করা যাবে কি?'
    : '';

  const tbWarning =
    Number(p.coughWeeks) >= 2
      ? '\n* বাংলাদেশ এনটিপি (NTP) নির্দেশিকা: ২+ সপ্তাহের কাশি — কফ পরীক্ষা (AFB / GeneXpert MTB/RIF) ও বুকের এক্স-রে (CXR) সম্পর্কে চিকিৎসকের পরামর্শ নিন।'
      : '';

  return (
    `=== ডাঃ তোতা: স্বাস্থ্য ও কাশি পর্যবেক্ষণ সারসংক্ষেপ ===\n` +
    `রোগী: ${mother}\n` +
    `কাশি স্থায়িত্ব: ${p.coughWeeks || 0} সপ্তাহ\n` +
    `পূর্বের অবস্থা: ${p.conditions || 'নথিভুক্ত নয়'}\n` +
    `পরিবার সমন্বয়কারী: ${p.caregiverName || 'উল্লেখ নেই'} (${p.caregiverPhone || 'নম্বর নেই'})\n\n` +
    `--- যাচাইকৃত ওষুধ ---\n${medLines}\n\n` +
    `--- সাম্প্রতিক কাশির নথি ---\n${recentLogs}` +
    aceWarning +
    tbWarning +
    `\n\n(বি.দ্র.: এটি কেবল পর্যবেক্ষণমূলক সহায়তা; রোগ নির্ণয়ের জন্য নিবন্ধিত চিকিৎসকের পরীক্ষা অপরিহার্য।)`
  );
}

export function buildWhatsappShareUrl(state: DrTotaState): string {
  const encoded = encodeURIComponent(buildWhatsappSummaryText(state));
  const phone = state.profile.caregiverPhone ? state.profile.caregiverPhone.replace(/[^0-9]/g, '') : '';
  return phone ? `https://wa.me/${phone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
}

export function buildTelegramPayload(profile: PatientProfile, customText?: string) {
  const chatId = profile.tgChatId || '<CHAT_ID>';
  const mother = profile.motherName || profile.preferredAddress || 'আম্মুজি';
  return {
    chat_id: chatId,
    text:
      customText ||
      `[ডাঃ তোতা সতর্কবার্তা] ${mother}-এর জরুরি লক্ষণ পরীক্ষা (টিয়ার-০/১) প্রযোজ্য। কাশির সময়কাল: ${profile.coughWeeks} সপ্তাহ। অনুগ্রহ করে এখনই খোঁজ নিন।`,
    parse_mode: 'HTML',
  };
}

export async function sendTelegramAlert(token: string, chatId: string, messageText: string): Promise<boolean> {
  if (!token || !chatId) return false;
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: messageText,
        parse_mode: 'HTML',
      }),
    });
    return res.ok;
  } catch (err) {
    console.error('Failed to send Telegram alert:', err);
    return false;
  }
}

export function sendEmergencyTelegram(profile: PatientProfile, reason: string, userInput: string): void {
  if (!profile.tgToken || !profile.tgChatId) return;
  const mother = profile.motherName || profile.preferredAddress || 'আম্মুজি';
  const message =
    `🚨 <b>জরুরি স্বাস্থ্য সতর্কতা - ডাঃ তোতা</b> 🚨\n\n` +
    `<b>রোগী:</b> ${mother}\n` +
    `<b>কারণ:</b> ${reason}\n` +
    `<b>উদ্ধৃতি:</b> "${userInput}"\n` +
    `<b>সময়:</b> ${new Date().toLocaleString('bn-BD')}\n\n` +
    `⚠️ অনুগ্রহ করে এখনই খোঁজ নিন।`;
  void sendTelegramAlert(profile.tgToken, profile.tgChatId, message);
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through to textarea fallback
    }
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function triggerFileDownload(content: string, filename: string, mimeType: string = 'text/plain;charset=utf-8'): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
