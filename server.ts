import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Type, ThinkingLevel } from '@google/genai';
import { getGeminiClient, withRetry } from './server/gemini.ts';
import { runServerSafetyCheck, EMERGENCY_SCRIPT_BN } from './server/safety.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '15mb' }));

function formatGeminiError(err: unknown): { status: number; error: string } {
  const msg = err instanceof Error ? err.message : String(err);
  const explicitStatus = (err as { status?: number })?.status;
  if (explicitStatus === 503 || msg.includes('GEMINI_API_KEY')) {
    return {
      status: 503,
      error: 'এআই সেবা প্রস্তুত নয়: অনুগ্রহ করে Settings > Secrets-এ GEMINI_API_KEY যুক্ত আছে কি না যাচাই করুন।',
    };
  }
  if (msg.includes('403') || msg.includes('PERMISSION_DENIED') || msg.includes('API_KEY_INVALID')) {
    return {
      status: 403,
      error: 'Gemini API Key অনুমোদিত নয়। Settings > Secrets প্যানেল থেকে বৈধ কী যাচাই করুন।',
    };
  }
  if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
    return {
      status: 429,
      error: 'এআই অনুরোধের সীমা সাময়িকভাবে পূর্ণ হয়েছে। কয়েক মুহূর্ত পর আবার চেষ্টা করুন।',
    };
  }
  return {
    status: 500,
    error: `এআই প্রক্রিয়ায় ত্রুটি হয়েছে: ${msg}`,
  };
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    aiConfigured: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()),
  });
});

// 1. Conversational 6-Domain Clinical Companion Chat
app.post('/api/chat', async (req, res) => {
  try {
    const {
      message,
      history = [],
      profile = {},
      medications = [],
      recentLogs = [],
      latestVitals = null,
      adherenceSummary = null,
    } = req.body ?? {};

    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'বার্তা খালি থাকতে পারবে না।' });
      return;
    }

    // Deterministic Pre-LLM Tier-0 Red-Flag Gate
    const redFlag = runServerSafetyCheck(message);
    if (redFlag) {
      res.json({
        tier: 'T0',
        reply: EMERGENCY_SCRIPT_BN,
        simpleText: 'এখনই ৯৯৯-এ কল করুন। চুপচাপ বসে পড়ুন, হাঁটবেন না।',
        emergencyReason: redFlag.label,
        detectedDomains: ['জরুরি রেড-ফ্ল্যাগ'],
        suggestedChips: ['পাশে কেউ আছেন', '৯৯৯-এ কল করছি', 'হাসপাতালে যাচ্ছি'],
        alertNote: redFlag.label,
        autoLog: null,
      });
      return;
    }

    const ai = getGeminiClient();
    const addr = profile.preferredAddress || 'আম্মুজি';
    const dialect = profile.dialect || 'প্রমিত বাংলা ও সহজ চলিত ভাষা';

    const medSummary =
      Array.isArray(medications) && medications.length > 0
        ? medications
            .map(
              (m: { brandName?: string; generic?: string; cls?: string; coughRisk?: string; prayerTime?: string }) =>
                `- ${m.brandName} (${m.generic}, ${m.cls}) [coughRisk=${m.coughRisk}, schedule=${m.prayerTime}]`
            )
            .join('\n')
        : 'কোনো ওষুধ এখনো নথিভুক্ত হয়নি';

    const logsSummary =
      Array.isArray(recentLogs) && recentLogs.length > 0
        ? recentLogs
            .slice(0, 6)
            .map(
              (l: { date?: string; type?: string; severity?: number; breathRate?: number; domains?: string[]; note?: string }) =>
                `- ${l.date}: ${l.type}, তীব্রতা ${l.severity}/10${l.breathRate ? `, শ্বাস ${l.breathRate}/মি.` : ''}, ডোমেইন: ${(l.domains || []).join(', ')} (${l.note})`
            )
            .join('\n')
        : 'সাম্প্রতিক কোনো কাশির লগ নেই';

    const vitalsSummary = latestVitals
      ? `সর্বশেষ ভাইটালস (${latestVitals.date}): BP=${latestVitals.systolic || '-'}/${latestVitals.diastolic || '-'}, SpO2=${latestVitals.spo2 || '-'}%, Temp=${latestVitals.tempF || '-'}°F, BloodSugar=${latestVitals.bloodSugar || '-'}`
      : 'ভাইটালস এখনো নথিভুক্ত হয়নি';

    const systemInstruction = `You are "ডাঃ তোতা" (Dr. Tota), an ultra-warm, respectful, elderly-accessible Bangladeshi AI health companion built by BhaiSazzaD for ${addr}.
CRITICAL SAFETY RULES:
1. You are NOT a licensed doctor ("আমি আসল ডাক্তার নই"). NEVER diagnose definitively, NEVER prescribe new medications, and NEVER tell the patient to stop blood pressure or heart medication on their own.
2. Address the user warmly as "${addr}". Adapt your phrasing gently toward their dialect preference: "${dialect}" (for Sylheti, use respectful light Sylheti warmth like "আফনে/আম্মুজি, কিতা অইছে?" mixed with clear Bangla so it stays readable; for Chattogrami, warm gentle Chattogrami cadence; for Banglish, mix easy Bangla + familiar English words; for Standard, gentle everyday Bangla).
3. Assess across the 6 Chronic Cough Clinical Domains:
   - Domain 1 (TB / Infection - Bangladesh NTP): Any cough >= 2 weeks, evening fever, night sweats, weight loss -> advise free government AFB/GeneXpert sputum test & CXR at Upazila Health Complex / BRAC DOTS.
   - Domain 2 (Drug-induced ACE-I cough): Check if current medications contain ACE inhibitors (Ramipril/Ripril/Enalapril/Lisinopril/Perindopril). Warn never to stop BP meds independently, suggest asking doctor about ARB alternative.
   - Domain 3 (Airway / Smoke - COPD/Asthma): Mosquito coils, cooking smoke, dust, wheezing.
   - Domain 4 (GERD / Reflux): Heartburn, cough after meals or lying down, dysphagia.
   - Domain 5 (Cardiac / Fluid): Orthopnea (needing high pillows), ankle/foot swelling, nocturnal dyspnea.
   - Domain 6 (UACS): Post-nasal drip, throat clearing.
4. If the message reveals ANY hidden Tier-0 emergency symptom (coughing blood, severe breathlessness/unable to speak sentences, chest pain/pressure, lip/tongue/throat swelling, one-sided weakness/slurred speech, SpO2 < 92%, or severe distress), set tier="T0" and fill emergencyReason immediately.
5. Keep "reply" concise (2 to 4 warm sentences), asking AT MOST ONE gentle follow-up question so an elderly mother is never overwhelmed.
6. Provide "simpleText" as 1 very short, crystal-clear Bangla sentence.
7. Provide 3 short, natural Bangla "suggestedChips" (2-5 words each) that ${addr} can tap to answer your question without typing!
8. If the user describes a cough episode, symptom, severity, or duration, populate "shouldAutoLog": true with structured "autoLog" fields.`;

    const recentConversation = Array.isArray(history)
      ? history
          .slice(-8)
          .map((m: { sender?: string; text?: string }) => `${m.sender === 'user' ? addr : 'ডাঃ তোতা'}: ${m.text}`)
          .join('\n')
      : '';

    const promptText = `রোগীর তথ্য:
- নাম/সম্বোধন: ${profile.motherName || addr} (${addr})
- কাশির স্থায়িত্ব: ${profile.coughWeeks || 0} সপ্তাহ
- পূর্বের শারীরিক অবস্থা: ${profile.conditions || 'উল্লেখ নেই'}
- আজকের ওষুধ সেবনের অগ্রগতি: ${adherenceSummary || 'তথ্য নেই'}

যাচাইকৃত ওষুধসমূহ:
${medSummary}

${vitalsSummary}

সাম্প্রতিক কাশির ডায়েরি:
${logsSummary}

সাম্প্রতিক কথোপকথন:
${recentConversation}

বর্তমান বার্তা (${addr}): "${message}"`;

    const response = await withRetry(() =>
      ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: promptText,
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              tier: {
                type: Type.STRING,
                description: 'Must be one of T0, T1, T2, T3',
              },
              reply: {
                type: Type.STRING,
                description: 'Warm, empathetic Bangla response (2-4 sentences, max 1 gentle question).',
              },
              simpleText: {
                type: Type.STRING,
                description: '1 ultra-short Bangla sentence for elderly easy reading.',
              },
              emergencyReason: {
                type: Type.STRING,
                description: 'Empty string unless tier is T0, then short Bengali emergency label.',
              },
              alertNote: {
                type: Type.STRING,
                description: 'Short caregiver alert summary in Bangla if T0/T1/T2 concern exists, otherwise empty string.',
              },
              detectedDomains: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Relevant clinical domain tags in Bangla.',
              },
              suggestedChips: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Exactly 3 short Bangla quick-reply tap phrases for Ammuji.',
              },
              shouldAutoLog: {
                type: Type.BOOLEAN,
                description: 'True if message reports concrete cough symptoms, duration, or severity worth logging.',
              },
              autoLogType: {
                type: Type.STRING,
                description: 'Cough type in Bangla e.g. শুকনো কাশি (কফ ছাড়া)',
              },
              autoLogSeverity: {
                type: Type.INTEGER,
                description: 'Estimated severity 1-10 if shouldAutoLog is true.',
              },
              updatedCoughWeeks: {
                type: Type.NUMBER,
                description: 'If user explicitly mentioned cough duration in weeks, provide numeric weeks, else 0.',
              },
            },
            required: ['tier', 'reply', 'simpleText', 'detectedDomains', 'suggestedChips', 'shouldAutoLog'],
          },
        },
      })
    );

    const parsed = JSON.parse((response.text ?? '{}').trim());
    const normalizedTier = ['T0', 'T1', 'T2', 'T3'].includes(parsed.tier) ? parsed.tier : 'T3';

    res.json({
      tier: normalizedTier,
      reply: parsed.reply || `আপনার কথা শুনেছি, ${addr}। কাশিটা কি শুকনো নাকি কফ ওঠে?`,
      simpleText: parsed.simpleText || `আপনার কাশি কেমন আছে, ${addr}?`,
      emergencyReason: normalizedTier === 'T0' ? parsed.emergencyReason || 'জরুরি স্বাস্থ্য লক্ষণ' : null,
      alertNote: parsed.alertNote ? parsed.alertNote : null,
      detectedDomains: Array.isArray(parsed.detectedDomains) ? parsed.detectedDomains : [],
      suggestedChips:
        Array.isArray(parsed.suggestedChips) && parsed.suggestedChips.length > 0
          ? parsed.suggestedChips.slice(0, 3)
          : ['হ্যাঁ, এমনটা হচ্ছে', 'না, এরকম নেই', 'শুকনো কাশি বেশি'],
      shouldAutoLog: Boolean(parsed.shouldAutoLog),
      autoLogType: parsed.autoLogType || 'শুকনো কাশি (কফ ছাড়া)',
      autoLogSeverity:
        typeof parsed.autoLogSeverity === 'number'
          ? Math.max(1, Math.min(10, Math.round(parsed.autoLogSeverity)))
          : 5,
      updatedCoughWeeks:
        typeof parsed.updatedCoughWeeks === 'number' && parsed.updatedCoughWeeks > 0
          ? parsed.updatedCoughWeeks
          : 0,
    });
  } catch (err) {
    console.error('Error in /api/chat:', err);
    const { status, error } = formatGeminiError(err);
    res.status(status).json({ error });
  }
});

// 2. Multimodal Prescription & Medicine Strip Scanner
app.post('/api/scan-prescription', async (req, res) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg' } = req.body ?? {};
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      res.status(400).json({ error: 'ছবির তথ্য পাওয়া যায়নি।' });
      return;
    }

    const ai = getGeminiClient();
    const promptText = `You are a clinical pharmacist assistant specializing in Bangladesh prescriptions and pharmaceutical brands (Square, Beximco, Incepta, Renata, Aristopharma, Healthcare Pharma, etc.).
Inspect this image of a Bangladeshi doctor's prescription, medicine blister strip, or inhaler box.
Extract all identifiable medications accurately.
For each medication:
- brandName: Brand name & strength visible (e.g. "Ripril 2.5 mg", "Losartil 50", "Seclo 20")
- generic: Generic molecule name with Bangla in parentheses (e.g. "Ramipril (র‍্যামিপ্রিল)")
- cls: Drug class (e.g. "ACE Inhibitor", "ARB", "PPI", "Beta Blocker", "Bronchodilator")
- dose: Dosage instructions in simple Bangla if visible (e.g. "১টি করে দিনে ১ বার")
- prayerTime: Map timing to the closest Bangladeshi prayer schedule option from ONLY these exact strings:
  "ফজরের পর (সকাল)", "যোহরের পর (দুপুর)", "আসরের পর (বিকাল)", "মাগরিবের পর (সন্ধ্যা)", "এশার পর (রাত)", "ঘুমানোর আগে"
- coughRisk: "HIGH" for any ACE Inhibitor (Ramipril, Enalapril, Lisinopril, Perindopril, Captopril), "MODERATE" for Calcium Channel Blockers / Beta Blockers / NSAIDs, "LOW" otherwise.
- note: Concise Bangla safety/cough observation for the family.
Also extract concise "doctorNotes" and "warnings" in Bangla.`;

    const response = await withRetry(() =>
      ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: {
          parts: [
            { inlineData: { mimeType, data: imageBase64 } },
            { text: promptText },
          ],
        },
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              medications: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    brandName: { type: Type.STRING },
                    generic: { type: Type.STRING },
                    cls: { type: Type.STRING },
                    dose: { type: Type.STRING },
                    prayerTime: { type: Type.STRING },
                    coughRisk: { type: Type.STRING },
                    note: { type: Type.STRING },
                  },
                  required: ['brandName', 'generic', 'cls', 'prayerTime', 'coughRisk', 'note'],
                },
              },
              doctorNotes: { type: Type.STRING },
              warnings: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: ['medications', 'doctorNotes', 'warnings'],
          },
        },
      })
    );

    const parsed = JSON.parse((response.text ?? '{}').trim());
    res.json({
      medications: Array.isArray(parsed.medications) ? parsed.medications : [],
      doctorNotes: parsed.doctorNotes || '',
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
    });
  } catch (err) {
    console.error('Error in /api/scan-prescription:', err);
    const { status, error } = formatGeminiError(err);
    res.status(status).json({ error });
  }
});

// 3. Universal Bangla Audio Transcription (works across all browsers & dialects)
app.post('/api/transcribe-audio', async (req, res) => {
  try {
    const { audioBase64, mimeType = 'audio/webm', dialect = 'প্রমিত বাংলা' } = req.body ?? {};
    if (!audioBase64 || typeof audioBase64 !== 'string') {
      res.status(400).json({ error: 'অডিও তথ্য পাওয়া যায়নি।' });
      return;
    }

    const ai = getGeminiClient();
    const response = await withRetry(() =>
      ai.models.generateContent({
        model: 'gemini-3.5-transcribe',
        contents: {
          parts: [
            { inlineData: { mimeType, data: audioBase64 } },
            {
              text: `Transcribe this elderly Bangladeshi speaker's Bengali speech accurately into clean Bangla script (preserving meaning even if spoken in ${dialect} or mixed Banglish). If coughing or wheezing is audible, keep the spoken words clean and do not invent words.`,
            },
          ],
        },
      })
    );

    const transcript = (response.text ?? '').trim();
    res.json({ transcript });
  } catch (err) {
    console.error('Error in /api/transcribe-audio:', err);
    const { status, error } = formatGeminiError(err);
    res.status(status).json({ error });
  }
});

// 4. High-Clarity Bangla Text-to-Speech via Gemini TTS
app.post('/api/tts', async (req, res) => {
  try {
    const { text, urgent = false } = req.body ?? {};
    if (!text || typeof text !== 'string') {
      res.status(400).json({ error: 'পাঠ করার মতো লেখা পাওয়া যায়নি।' });
      return;
    }

    const ai = getGeminiClient();
    const style = urgent
      ? 'Urgent, calm, very clear Bangladeshi emergency guidance spoken steadily'
      : 'Warm, gentle, unhurried, respectful Bangladeshi caregiver speaking clearly to an elderly mother in Bangla';

    const response = await withRetry(() =>
      ai.models.generateContent({
        model: 'gemini-3.8-flash-lite-tts',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text,
                speechMetadata: { style },
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      })
    );

    const audioBase64 = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!audioBase64) {
      res.status(502).json({ error: 'অডিও তৈরি করা যায়নি।' });
      return;
    }

    res.json({ audioBase64, mimeType: 'audio/wav' });
  } catch (err) {
    console.error('Error in /api/tts:', err);
    const { status, error } = formatGeminiError(err);
    res.status(status).json({ error });
  }
});

// 5. Doctor Consultation Brief Generator (Bilingual Clinical Handoff)
app.post('/api/doctor-brief', async (req, res) => {
  try {
    const { state } = req.body ?? {};
    if (!state) {
      res.status(400).json({ error: 'রোগীর তথ্য পাওয়া যায়নি।' });
      return;
    }

    const ai = getGeminiClient();
    const response = await withRetry(() =>
      ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Generate a structured, concise Doctor Visit Consultation Brief for an elderly Bangladeshi patient based on this telemetry JSON. Include:
1. Patient & Chronicity Snapshot (Bangla + Clinical English header)
2. 6-Domain Cough Etiology Findings (NTP TB >= 2 weeks screening status, ACE-I drug-cough suspicion, Airway/COPD, GERD, Cardiac/Fluid, UACS)
3. Vitals & Respiratory Rate Summary
4. Medication List & Adherence Check
5. 3 Focused Questions for the Attending Physician (especially ACE-I -> ARB switch if applicable, and AFB/GeneXpert/CXR if >= 2 weeks).
Keep it crisp, factual, non-diagnostic, and directly usable during a clinic visit in Bangladesh.

Data:
${JSON.stringify({
  profile: state.profile,
  medications: state.medications,
  coughLogs: (state.coughLogs || []).slice(0, 15),
  vitalsLogs: (state.vitalsLogs || []).slice(0, 10),
  alerts: (state.alerts || []).slice(0, 10),
  adherence: state.adherence || {},
})}`,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
        },
      })
    );

    res.json({ brief: (response.text ?? '').trim() });
  } catch (err) {
    console.error('Error in /api/doctor-brief:', err);
    const { status, error } = formatGeminiError(err);
    res.status(status).json({ error });
  }
});

// 6. Server-side Telegram Alert Proxy
app.post('/api/alerts/telegram', async (req, res) => {
  try {
    const { token, chatId, messageText } = req.body ?? {};
    const resolvedToken = (typeof token === 'string' && token.trim()) || process.env.TELEGRAM_BOT_TOKEN || '';
    const resolvedChatId = (typeof chatId === 'string' && chatId.trim()) || process.env.TELEGRAM_CHAT_ID || '';

    if (!resolvedToken || !resolvedChatId || !messageText) {
      res.status(400).json({ ok: false, error: 'Telegram Bot Token বা Chat ID অনুপস্থিত।' });
      return;
    }

    const tgRes = await fetch(`https://api.telegram.org/bot${resolvedToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: resolvedChatId,
        text: messageText,
        parse_mode: 'HTML',
      }),
    });

    const data = await tgRes.json();
    res.status(tgRes.ok ? 200 : 502).json({ ok: tgRes.ok, data });
  } catch (err) {
    console.error('Telegram proxy error:', err);
    res.status(500).json({ ok: false, error: 'টেলিগ্রাম বার্তা পাঠানো যায়নি।' });
  }
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`DoctorTota full-stack server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
