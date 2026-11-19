import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { Camera, Loader2, Activity, PlusCircle, CheckCircle2, ScanLine } from 'lucide-react';
import { PredictiveArcCanvas, DiagnosticsPanel } from '@designcodeio/threeui';
import { animate, stagger } from 'animejs';
import { motion, AnimatePresence } from 'motion/react';
import BreathRateTimer from './BreathRateTimer';
import { BD_DRUG_SUGGESTIONS, lookupDrugMatch } from '../utils/drugDatabase';
import { sendEmergencyTelegram } from '../utils/alerts';
import {
  type DrTotaState,
  type CoughLog,
  type Medication,
  type VitalsLog,
  formatNowBn,
  getTodayDateKey,
} from '../utils/storage';

interface CoughTrackerProps {
  state: DrTotaState;
  onUpdateState: (updater: (prev: DrTotaState) => DrTotaState) => void;
  onEmergency: (reason: string) => void;
}

interface ScannedMed {
  brandName: string;
  generic: string;
  cls: string;
  dose?: string;
  prayerTime: string;
  coughRisk: 'HIGH' | 'MODERATE' | 'LOW' | 'UNKNOWN';
  note: string;
}

const DOMAIN_CHECKBOXES = [
  { value: 'সন্ধ্যায় হালকা জ্বর বা রাতে ঘাম', label: 'সন্ধ্যায় জ্বর বা রাতে ঘাম (টিবি)' },
  { value: 'ওজন কমে যাওয়া বা ক্ষুধামন্দা', label: 'ওজন কমা বা ক্ষুধামন্দা (টিবি)' },
  { value: 'বুকে শাঁই শাঁই শব্দ বা হাঁপানি', label: 'বুকে শাঁই শাঁই শব্দ (শ্বাসনালী)' },
  { value: 'মশার কয়েল বা চুলার ধোঁয়ায় বাড়ে', label: 'কয়েল বা চুলার ধোঁয়ায় বাড়ে' },
  { value: 'বুকে জ্বালা বা খাওয়ার পর কাশি', label: 'বুকে জ্বালা বা রিফ্লাক্স (জিইআরডি)' },
  { value: 'পানি বা খাবার খেতে গেলে কাশি', label: 'গিলতে বা পানি খেতে গেলে কাশি' },
  { value: 'রাতে শুলে কাশি বাড়ে (উঁচু বালিশ লাগে)', label: 'রাতে শুলে কাশি বাড়ে (হৃদযন্ত্র)' },
  { value: 'পা বা গোড়ালি ফুলে যাওয়া', label: 'পা বা গোড়ালি ফোলা (হৃদযন্ত্র)' },
  { value: 'গলা খাঁকারি বা নাক থেকে কফ নামা', label: 'গলা খাঁকারি বা নাক ঝরা (ইউএসিএস)' },
];

const PRAYER_TIMES = [
  'ফজরের পর (সকাল)',
  'যোহরের পর (দুপুর)',
  'আসরের পর (বিকাল)',
  'মাগরিবের পর (সন্ধ্যা)',
  'এশার পর (রাত)',
  'ঘুমানোর আগে',
];

const COUGH_TYPES = [
  'শুকনো কাশি (কফ ছাড়া)',
  'সাদা বা পাতলা কফ',
  'হলুদ বা ঘন সবুজ কফ',
  'মিশ্র কাশি (রাতে বাড়ে)',
];

const CoughTracker: React.FC<CoughTrackerProps> = ({ state, onUpdateState, onEmergency }) => {
  const [coughWeeks, setCoughWeeks] = useState<number>(state.profile.coughWeeks || 0);
  const [coughType, setCoughType] = useState<string>(COUGH_TYPES[0]);
  const [severity, setSeverity] = useState<number>(4);
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);
  const [coughNote, setCoughNote] = useState<string>('');
  const [coughFeedback, setCoughFeedback] = useState<string>('');

  const [systolic, setSystolic] = useState<string>('');
  const [diastolic, setDiastolic] = useState<string>('');
  const [spo2, setSpo2] = useState<string>('');
  const [tempF, setTempF] = useState<string>('');
  const [bloodSugar, setBloodSugar] = useState<string>('');
  const [vitalsFeedback, setVitalsFeedback] = useState<string>('');

  const [medName, setMedName] = useState<string>('');
  const [medPrayer, setMedPrayer] = useState<string>(PRAYER_TIMES[0]);
  const [medDose, setMedDose] = useState<string>('');
  const [medFeedback, setMedFeedback] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const kpiGridRef = useRef<HTMLDivElement>(null);
  const scanBeamRef = useRef<HTMLDivElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState('');
  const [scannedMeds, setScannedMeds] = useState<ScannedMed[]>([]);
  const [scanDoctorNotes, setScanDoctorNotes] = useState('');
  const [scanWarnings, setScanWarnings] = useState<string[]>([]);

  useEffect(() => {
    setCoughWeeks(Number(state.profile.coughWeeks) || 0);
  }, [state.profile.coughWeeks]);

  // Anime.js v4 staggered KPI entrance + numeric roll-up
  useEffect(() => {
    const grid = kpiGridRef.current;
    if (!grid) return;
    const cards = grid.querySelectorAll('.kpi-anim-card');
    if (cards.length === 0) return;
    const anim = animate(cards, {
      opacity: [0, 1],
      translateY: [10, 0],
      duration: 420,
      delay: stagger(55),
      ease: 'outCubic',
    });

    const weeksEl = document.getElementById('stat-duration');
    const targetWeeks = Number(state.profile.coughWeeks) || 0;
    const counterProxy = { val: 0 };
    const numAnim =
      weeksEl && targetWeeks > 0
        ? animate(counterProxy, {
            val: targetWeeks,
            duration: 600,
            ease: 'outExpo',
            onUpdate: () => {
              const rounded = Number.isInteger(targetWeeks)
                ? Math.round(counterProxy.val)
                : Number(counterProxy.val.toFixed(1));
              weeksEl.textContent = `${rounded} সপ্তাহ`;
            },
          })
        : null;

    return () => {
      anim.revert();
      numAnim?.revert();
    };
  }, [state.profile.coughWeeks]);

  // Anime.js v4 prescription scanning optical laser sweep
  useEffect(() => {
    if (!isScanning || !scanBeamRef.current) return;
    const anim = animate(scanBeamRef.current, {
      translateX: ['-10%', '110%'],
      duration: 1100,
      loop: true,
      alternate: true,
      ease: 'inOutSine',
    });
    return () => {
      anim.revert();
    };
  }, [isScanning]);

  const toggleDomainCheck = (val: string) => {
    setSelectedDomains((prev) =>
      prev.includes(val) ? prev.filter((item) => item !== val) : [...prev, val]
    );
  };

  const handleSaveManualCoughLog = () => {
    const domains = [...selectedDomains];
    const hasCardiacOrFever = domains.some(
      (d) => d.includes('পা বা গোড়ালি') || d.includes('জ্বর')
    );

    if (coughWeeks >= 2 && !domains.some((d) => d.includes('টিবি'))) {
      domains.push('২+ সপ্তাহ স্থায়ী (এনটিপি টিবি স্ক্রিনিং)');
    }

    const tier: CoughLog['tier'] =
      hasCardiacOrFever && severity >= 7
        ? 'T1'
        : coughWeeks >= 2 || domains.length > 0
        ? 'T2'
        : 'T3';

    const newLog: CoughLog = {
      id: `log_${Date.now()}`,
      date: formatNowBn(),
      timestamp: Date.now(),
      weeks: coughWeeks,
      type: coughType,
      severity,
      domains,
      note: coughNote.trim() || 'দৈনিক ডায়েরি এন্ট্রি',
      tier,
    };

    onUpdateState((prev) => ({
      ...prev,
      profile: { ...prev.profile, coughWeeks },
      coughLogs: [newLog, ...prev.coughLogs],
      alerts:
        tier === 'T1'
          ? [
              {
                id: `al_${Date.now()}`,
                level: 'T1 ২৪ ঘণ্টার সতর্কতা',
                reason: 'ডায়েরিতে উচ্চ তীব্রতা বা পা ফোলা/জ্বর নথিভুক্ত হয়েছে',
                quote: coughNote.trim() || coughType,
                time: formatNowBn(),
              },
              ...prev.alerts,
            ]
          : prev.alerts,
    }));

    setCoughNote('');
    setSelectedDomains([]);
    setCoughFeedback('তথ্য সংরক্ষিত হয়েছে');
  };

  const handleLoadSampleCoughCase = () => {
    setCoughWeeks(3);
    setCoughType('শুকনো কাশি (কফ ছাড়া)');
    setSeverity(6);
    setCoughNote('নমুনা পরীক্ষা: ৩ সপ্তাহের শুকনো কাশি, রাতে শুলে বাড়ে');
    setSelectedDomains([
      'সন্ধ্যায় হালকা জ্বর বা রাতে ঘাম',
      'রাতে শুলে কাশি বাড়ে (উঁচু বালিশ লাগে)',
    ]);
    setCoughFeedback("নমুনা তথ্য ফর্মে লোড হয়েছে — সংরক্ষণ করতে 'ডায়েরিতে সংরক্ষণ করুন' চাপুন");
  };

  const handleSaveVitals = () => {
    const sysNum = systolic ? parseInt(systolic, 10) : undefined;
    const diaNum = diastolic ? parseInt(diastolic, 10) : undefined;
    const spo2Num = spo2 ? parseInt(spo2, 10) : undefined;
    const tempNum = tempF ? parseFloat(tempF) : undefined;
    const sugarNum = bloodSugar ? parseFloat(bloodSugar) : undefined;

    if (!sysNum && !diaNum && !spo2Num && !tempNum && !sugarNum) {
      setVitalsFeedback('অন্তত একটি ভাইটাল মান লিখুন');
      return;
    }

    const newVital: VitalsLog = {
      id: `vit_${Date.now()}`,
      date: formatNowBn(),
      timestamp: Date.now(),
      systolic: sysNum,
      diastolic: diaNum,
      spo2: spo2Num,
      tempF: tempNum,
      bloodSugar: sugarNum,
    };

    const isCriticalHypoxia = spo2Num !== undefined && spo2Num < 92;
    const isWarnVital =
      (spo2Num !== undefined && spo2Num >= 92 && spo2Num <= 94) ||
      (sysNum !== undefined && sysNum >= 160) ||
      (tempNum !== undefined && tempNum >= 101);

    const alertSummary = isCriticalHypoxia
      ? `অক্সিজেন স্যাচুরেশন বিপজ্জনকভাবে কম (${spo2Num}%)`
      : isWarnVital
      ? `ভাইটাল সতর্কতা (BP: ${sysNum || '-'}/${diaNum || '-'}, SpO2: ${spo2Num || '-'}%, Temp: ${tempNum || '-'}°F)`
      : null;

    onUpdateState((prev) => ({
      ...prev,
      vitalsLogs: [newVital, ...prev.vitalsLogs],
      alerts: alertSummary
        ? [
            {
              id: `al_${Date.now()}`,
              level: isCriticalHypoxia ? 'T0 জরুরি' : 'T1 ভাইটাল সতর্কতা',
              reason: alertSummary,
              quote: `SpO2: ${spo2Num || '-'}% | BP: ${sysNum || '-'}/${diaNum || '-'}`,
              time: formatNowBn(),
            },
            ...prev.alerts,
          ]
        : prev.alerts,
    }));

    setSystolic('');
    setDiastolic('');
    setSpo2('');
    setTempF('');
    setBloodSugar('');

    if (isCriticalHypoxia) {
      setVitalsFeedback('সতর্কতা: SpO2 ৯২%-এর নিচে! জরুরি সহায়তা প্রটোকল খোলা হয়েছে।');
      onEmergency(`অক্সিজেন (SpO2) ${spo2Num}% — জরুরি চিকিৎসা প্রয়োজন`);
      sendEmergencyTelegram(state.profile, `কম অক্সিজেন (SpO2 ${spo2Num}%)`, `SpO2: ${spo2Num}%`);
    } else if (isWarnVital) {
      setVitalsFeedback('ভাইটালস সংরক্ষিত হয়েছে ও পরিবার সতর্কবার্তা তৈরি হয়েছে।');
    } else {
      setVitalsFeedback('ভাইটালস সফলভাবে সংরক্ষিত হয়েছে');
    }
  };

  const handleAddMedication = () => {
    const rawName = medName.trim();
    if (!rawName) {
      setMedFeedback('দয়া করে ওষুধের নাম লিখুন');
      return;
    }

    const matched = lookupDrugMatch(rawName);
    const medObj: Medication = {
      id: `med_${Date.now()}`,
      brandName: rawName,
      generic: matched ? matched.generic : 'যাচাইকৃত প্রেসক্রিপশন ওষুধ',
      cls: matched ? matched.cls : 'তালিকাভুক্ত শ্রেণি (ফার্মাসিস্ট/ডাক্তার থেকে নিশ্চিত করুন)',
      coughRisk: matched ? matched.coughRisk : 'UNKNOWN',
      note: matched
        ? matched.note
        : 'আমাদের স্থানীয় এসিই-ইনহিবিটর তালিকায় সরাসরি পাওয়া যায়নি; তবে পূর্ণাঙ্গ নিশ্চিতকরণের জন্য ফার্মাসিস্ট বা ডাক্তারকে দেখান।',
      prayerTime: medPrayer,
      dose: medDose.trim(),
    };

    onUpdateState((prev) => ({
      ...prev,
      medications: [...prev.medications, medObj],
      alerts:
        medObj.coughRisk === 'HIGH'
          ? [
              {
                id: `al_${Date.now()}`,
                level: 'T2 ওষুধ সতর্কতা',
                reason: `সম্ভাব্য কাশি সৃষ্টিকারী এসিই-ইনহিবিটর যোগ হয়েছে: ${medObj.brandName}`,
                quote: medObj.generic,
                time: formatNowBn(),
              },
              ...prev.alerts,
            ]
          : prev.alerts,
    }));

    setMedName('');
    setMedDose('');
    setMedFeedback('ওষুধ তালিকায় যোগ হয়েছে');
  };

  const handlePrescriptionFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanError('');
    setScannedMeds([]);
    setScanDoctorNotes('');
    setScanWarnings([]);
    setIsScanning(true);

    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('ছবি পড়া যায়নি'));
        reader.readAsDataURL(file);
      });

      const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
      const res = await fetch('/api/scan-prescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType: file.type || 'image/jpeg',
        }),
      });
      const data = (await res.json()) as {
        medications?: ScannedMed[];
        doctorNotes?: string;
        warnings?: string[];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || 'প্রেসক্রিপশন স্ক্যান করা যায়নি।');
      }
      setScannedMeds(data.medications || []);
      setScanDoctorNotes(data.doctorNotes || '');
      setScanWarnings(data.warnings || []);
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'স্ক্যান করতে সমস্যা হয়েছে।');
    } finally {
      setIsScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleImportScannedMeds = () => {
    if (scannedMeds.length === 0) return;
    const now = Date.now();
    const newMeds: Medication[] = scannedMeds.map((sm, idx) => {
      const matched = lookupDrugMatch(`${sm.brandName} ${sm.generic}`);
      const risk = (['HIGH', 'MODERATE', 'LOW', 'UNKNOWN'].includes(sm.coughRisk)
        ? sm.coughRisk
        : matched?.coughRisk || 'UNKNOWN') as Medication['coughRisk'];
      const validPrayer = PRAYER_TIMES.includes(sm.prayerTime) ? sm.prayerTime : PRAYER_TIMES[0];
      return {
        id: `med_${now}_${idx}`,
        brandName: sm.brandName,
        generic: sm.generic || matched?.generic || 'প্রেসক্রিপশন ওষুধ',
        cls: sm.cls || matched?.cls || 'শনাক্তকৃত ওষুধ',
        coughRisk: risk,
        note: sm.note || matched?.note || 'প্রেসক্রিপশন স্ক্যান থেকে যুক্ত',
        prayerTime: validPrayer,
        dose: sm.dose || '',
      };
    });

    const aceFound = newMeds.filter((m) => m.coughRisk === 'HIGH');

    onUpdateState((prev) => ({
      ...prev,
      medications: [...prev.medications, ...newMeds],
      alerts:
        aceFound.length > 0
          ? [
              {
                id: `al_${now}`,
                level: 'T2 প্রেসক্রিপশন সতর্কতা',
                reason: `স্ক্যান করা প্রেসক্রিপশনে ACE-Inhibitor পাওয়া গেছে: ${aceFound
                  .map((a) => a.brandName)
                  .join(', ')}`,
                quote: 'Gemini Vision Prescription Scan',
                time: formatNowBn(),
              },
              ...prev.alerts,
            ]
          : prev.alerts,
    }));

    setMedFeedback(`${newMeds.length} টি ওষুধ সফলভাবে তালিকায় যোগ হয়েছে`);
    setScannedMeds([]);
  };

  const handleRemoveMedication = (medId: string) => {
    onUpdateState((prev) => ({
      ...prev,
      medications: prev.medications.filter((m) => m.id !== medId),
    }));
  };

  const handleRecordBreathRate = useCallback(
    (bpm: number, durationSeconds: number, rawBreaths: number) => {
      const now = Date.now();
      const tier: CoughLog['tier'] = bpm >= 25 ? 'T1' : bpm >= 21 || bpm < 12 ? 'T2' : 'T3';
      const sev = bpm >= 25 ? 7 : bpm >= 21 || bpm < 12 ? 5 : 2;
      const domains = [`শ্বাস-প্রশ্বাসের হার (${bpm} বার/মিনিট)`];
      if (bpm >= 25) {
        domains.push('দ্রুত শ্বাস-প্রশ্বাস (শ্বাসনালী/সংক্রমণ যাচাই)');
      }

      onUpdateState((prev) => ({
        ...prev,
        coughLogs: [
          {
            id: `log_${now}`,
            date: formatNowBn(),
            timestamp: now,
            weeks: Number(prev.profile.coughWeeks) || 0,
            type: 'শ্বাস-প্রশ্বাসের হার পরিমাপ',
            severity: sev,
            breathRate: bpm,
            domains,
            note: `${durationSeconds} সেকেন্ডে ${rawBreaths} বার শ্বাস গণনা থেকে প্রতি মিনিটে ${bpm} বার রেকর্ড করা হয়েছে।`,
            tier,
          },
          ...prev.coughLogs,
        ],
        alerts:
          bpm >= 25
            ? [
                {
                  id: `al_${now}`,
                  level: 'T1 শ্বাস-প্রশ্বাস সতর্কতা',
                  reason: `প্রতি মিনিটে ${bpm} বার দ্রুত শ্বাস-প্রশ্বাস শনাক্ত হয়েছে`,
                  quote: `টাইমার পরিমাপ: ${bpm} বার/মিনিট`,
                  time: formatNowBn(),
                },
                ...prev.alerts,
              ]
            : prev.alerts,
      }));
    },
    [onUpdateState]
  );

  const profileWeeks = Number(state.profile.coughWeeks) || 0;
  const aceCount = state.medications.filter((m) => m.coughRisk === 'HIGH').length;
  const totalFlags = aceCount + state.alerts.length;
  const todayTaken = (state.adherence[getTodayDateKey()] || []).length;
  const latestTier =
    state.alerts.length > 0 && state.alerts[0].level.includes('T0')
      ? 'টিয়ার-০ (জরুরি)'
      : state.coughLogs.length > 0
      ? state.coughLogs[0].tier
      : profileWeeks >= 2
      ? 'T2'
      : 'পর্যবেক্ষণ';

  const tierKpiStatus = latestTier.includes('T0')
    ? 'alert'
    : latestTier.includes('T1') || latestTier.includes('T2')
    ? 'warn'
    : 'ok';

  const allDomainText = state.coughLogs
    .map((l) => `${l.domains.join(' ')} ${l.note}`)
    .join(' ');
  const hasAce = aceCount > 0;

  const sixDomains = [
    {
      title: '১. সংক্রমণ ও টিবি (NTP)',
      active: profileWeeks >= 2 || allDomainText.includes('জ্বর') || allDomainText.includes('টিবি'),
      status: profileWeeks >= 2 ? 'warn' : 'info',
      desc:
        profileWeeks >= 2
          ? `${profileWeeks} সপ্তাহের কাশি — বিনামূল্যে কফ (GeneXpert) ও এক্স-রে করান।`
          : '২+ সপ্তাহ বা সন্ধ্যার জ্বর থাকলে অগ্রাধিকার পরীক্ষা প্রযোজ্য।',
    },
    {
      title: '২. ওষুধজনিত কাশি (ACE-I)',
      active: hasAce || allDomainText.includes('ACE-I'),
      status: hasAce ? 'alert' : 'ok',
      desc: hasAce
        ? 'এসিই-ইনহিবিটর শনাক্ত হয়েছে — ডাক্তারের সাথে বিকল্প ওষুধ আলোচনা করুন।'
        : 'যাচাইকৃত ওষুধের তালিকায় কাশি সৃষ্টিকারী এসিই-ইনহিবিটর নেই।',
    },
    {
      title: '৩. শ্বাসনালী ও ধোঁয়া (COPD)',
      active: allDomainText.includes('শ্বাসনালী') || allDomainText.includes('কয়েল'),
      status:
        allDomainText.includes('শ্বাসনালী') || allDomainText.includes('কয়েল') ? 'warn' : 'info',
      desc: 'মশার কয়েল, চুলার ধোঁয়া বা বুকে শাঁই শাঁই শব্দের সাথে সম্পর্কিত।',
    },
    {
      title: '৪. অ্যাসিডিটি ও রিফ্লাক্স (GERD)',
      active:
        allDomainText.includes('জ্বালা') ||
        allDomainText.includes('GERD') ||
        allDomainText.includes('গিলতে'),
      status: allDomainText.includes('জ্বালা') || allDomainText.includes('GERD') ? 'warn' : 'info',
      desc: 'বুকে জ্বালা, খাওয়ার পর বা পানি গিলতে গিয়ে কাশি ওঠা পর্যবেক্ষণ।',
    },
    {
      title: '৫. হৃদযন্ত্র ও পানি জমা',
      active:
        allDomainText.includes('শুলে') ||
        allDomainText.includes('হৃদযন্ত্র') ||
        allDomainText.includes('পা'),
      status: allDomainText.includes('পা')
        ? 'alert'
        : allDomainText.includes('শুলে')
        ? 'warn'
        : 'info',
      desc: 'শুলে কাশি বাড়া, উঁচু বালিশ লাগা বা পা ফোলার লক্ষণ যাচাই।',
    },
    {
      title: '৬. নাক-গলার প্রদাহ (UACS)',
      active: allDomainText.includes('গলা খাঁকারি') || allDomainText.includes('ইউএসিএস'),
      status: allDomainText.includes('গলা খাঁকারি') ? 'warn' : 'info',
      desc: 'নাক বন্ধ বা গলা খাঁকারি দিয়ে কফ ঝরার প্রবণতা।',
    },
  ];

  const chartData = [...state.coughLogs]
    .slice(0, 12)
    .reverse()
    .map((l, idx) => ({
      name: `#${idx + 1} (${l.date.split('•')[0].trim()})`,
      severity: Number(l.severity) || 0,
    }));

  const weeklyChartData = useMemo(() => {
    const toLocalDateKey = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate()
      ).padStart(2, '0')}`;

    const countsByDay = new Map<string, number>();
    for (const log of state.coughLogs) {
      let ts = log.timestamp;
      if (!ts && log.id.startsWith('log_')) {
        const parsed = parseInt(log.id.slice(4), 10);
        if (!Number.isNaN(parsed)) ts = parsed;
      }
      if (!ts) continue;
      const key = toLocalDateKey(new Date(ts));
      countsByDay.set(key, (countsByDay.get(key) || 0) + 1);
    }

    const days: { day: string; fullDate: string; count: number }[] = [];
    const today = new Date();
    for (let offset = 6; offset >= 0; offset--) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset);
      const key = toLocalDateKey(d);
      const label =
        offset === 0
          ? 'আজ'
          : d.toLocaleDateString('bn-BD', { weekday: 'short', day: 'numeric' });
      const fullDate = d.toLocaleDateString('bn-BD', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
      });
      days.push({
        day: label,
        fullDate,
        count: countsByDay.get(key) || 0,
      });
    }
    return days;
  }, [state.coughLogs]);

  const weeklyLogTotal = weeklyChartData.reduce((sum, d) => sum + d.count, 0);

  return (
    <section className="tab-panel" id="panel-tracker" aria-labelledby="tab-btn-tracker">
      {/* 4 KPI Status Cards */}
      <div className="kpi-grid" ref={kpiGridRef}>
        <div
          className="status-card kpi-anim-card"
          id="kpi-card-duration"
          data-status={profileWeeks >= 2 ? 'warn' : 'info'}
        >
          <div className="kpi-label">কাশির মোট সময়কাল</div>
          <div className="kpi-value mono-num" id="stat-duration">
            {profileWeeks} সপ্তাহ
          </div>
          <div className="kpi-caption" id="stat-duration-note">
            {profileWeeks >= 2
              ? '২+ সপ্তাহ: টিবি স্ক্রিনিং ও এক্স-রে জরুরি'
              : profileWeeks === 0
              ? 'প্রোফাইল বা লগে সময়কাল লিখুন'
              : 'নজরদারি চলমান'}
          </div>
        </div>

        <div className="status-card kpi-anim-card" id="kpi-card-tier" data-status={tierKpiStatus}>
          <div className="kpi-label">সর্বশেষ মূল্যায়ন স্তর</div>
          <div className="kpi-value" id="stat-tier">
            {latestTier}
          </div>
          <div className="kpi-caption">রোগ নির্ণয় নয় · কেবল সতর্কতা স্তর</div>
        </div>

        <div className="status-card kpi-anim-card" id="kpi-card-meds" data-status="info">
          <div className="kpi-label">আজকের ওষুধ গ্রহণ</div>
          <div className="kpi-value mono-num" id="stat-med-count">
            {todayTaken}/{state.medications.length} টি
          </div>
          <div className="kpi-caption">নামাজের সময়ের সাথে যুক্ত তালিকা</div>
        </div>

        <div
          className="status-card kpi-anim-card"
          id="kpi-card-flags"
          data-status={totalFlags > 0 ? 'alert' : 'ok'}
        >
          <div className="kpi-label">সতর্কতা ও সর্বশেষ SpO2</div>
          <div className="kpi-value mono-num" id="stat-flag-count">
            {state.vitalsLogs[0]?.spo2 ? `${state.vitalsLogs[0].spo2}%` : `${totalFlags} টি`}
          </div>
          <div className="kpi-caption">
            {totalFlags} টি ফ্ল্যাগ · এসিই-ইনহিবিটর নজরদারি
          </div>
        </div>
      </div>

      {/* Dynamic Bangladesh NTP TB >= 2 Week Banner */}
      <AnimatePresence>
        {profileWeeks >= 2 && (
          <motion.div
            className="status-card"
            id="ntp-tb-banner"
            data-status="warn"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <div className="brand-title-row" style={{ justifyContent: 'space-between' }}>
              <strong className="subhead" style={{ margin: 0 }}>
                বাংলাদেশ জাতীয় যক্ষ্মা নিয়ন্ত্রণ কর্মসূচি (এনটিপি) সতর্কতা: ২ সপ্তাহ বা তার বেশি কাশি
              </strong>
              <span className="status-text" data-status="warn">
                বিনামূল্যে পরীক্ষাযোগ্য
              </span>
            </div>
            <p className="lede" style={{ marginTop: 'var(--space-xs)' }}>
              ২ সপ্তাহ বা তার বেশি স্থায়ী কাশি—বিশেষত সন্ধ্যার জ্বর, রাতে ঘাম বা ওজন কমার সাথে থাকলে—সরকারি উপজেলা স্বাস্থ্য কমপ্লেক্স, জেলা হাসপাতাল বা ব্র্যাক ডটস (DOTS) কেন্দ্রে{' '}
              <strong>বিনামূল্যে দুটি কফ পরীক্ষা (এএফবি / জিনএক্সপার্ট এমটিবি/রিফ)</strong> এবং একটি{' '}
              <strong>বুকের এক্স-রে (CXR)</strong> করানো অত্যন্ত জরুরি।
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dynamic ACE Inhibitor Medication Alert Banner */}
      <AnimatePresence>
        {hasAce && (
          <motion.div
            className="status-card"
            id="ace-alert-banner"
            data-status="alert"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <div className="brand-title-row" style={{ justifyContent: 'space-between' }}>
              <strong className="subhead" style={{ margin: 0, color: 'var(--error)' }}>
                ওষুধজনিত কাশির সতর্কতা: এসিই-ইনহিবিটর (ACE Inhibitor) শনাক্ত হয়েছে
              </strong>
              <span className="status-text" data-status="alert">
                ডাক্তারের সাথে পর্যালোচনা করুন
              </span>
            </div>
            <p className="lede" style={{ marginTop: 'var(--space-xs)' }}>
              তালিকায় থাকা রক্তচাপের ওষুধ (যেমন র‍্যামিপ্রিল/রিপ্রিল) কিছু রোগীর ক্ষেত্রে দীর্ঘস্থায়ী শুকনো, গলা সুড়সুড়ে কাশি তৈরি করে যা কাশির সিরাপে সারে না।{' '}
              <strong>সাবধান:</strong> ডাক্তারের অনুমতি ছাড়া নিজে থেকে প্রেশারের ওষুধ বন্ধ করবেন না। চিকিৎসককে জিজ্ঞাসা করুন—এই কাশি কি প্রেশারের ওষুধের কারণে হচ্ছে এবং এআরবি (ARB) শ্রেণির বিকল্প ওষুধ দেওয়া যাবে কি না।
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Row 1: 6-Domain Cough Diary + ThreeUI Predictive Arc 6-Domain Index & Charts */}
      <div className="two-col-grid">
        <div className="card">
          <h2 className="section-heading">৬-ডোমেইন দৈনিক কাশির ডায়েরি</h2>
          <p className="lede" style={{ marginBottom: 'var(--space-md)' }}>
            আম্মুজির আসল কাশির ধরন ও আনুষঙ্গিক লক্ষণ সংরক্ষণ করুন। প্রথমবার দেখতে চাইলে নিচের নমুনা বোতাম ব্যবহার করতে পারেন।
          </p>

          <div className="form-grid">
            <div className="field-group">
              <label className="field-label" htmlFor="input-cough-weeks">
                কাশি কত সপ্তাহ ধরে চলছে?
              </label>
              <input
                type="number"
                min={0}
                max={150}
                step={0.5}
                className="input-control tabular-nums"
                id="input-cough-weeks"
                value={coughWeeks}
                onChange={(e) => setCoughWeeks(parseFloat(e.target.value) || 0)}
              />
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="input-cough-type">
                কাশির ধরন ও কফ
              </label>
              <select
                className="select-control"
                id="input-cough-type"
                value={coughType}
                onChange={(e) => setCoughType(e.target.value)}
              >
                {COUGH_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-grid" style={{ marginTop: 'var(--space-md)' }}>
            <div className="field-group">
              <label className="field-label" htmlFor="slider-severity">
                কাশির তীব্রতা (০ থেকে ১০ স্কেল)
              </label>
              <input
                type="range"
                min={0}
                max={10}
                step={1}
                id="slider-severity"
                value={severity}
                onChange={(e) => setSeverity(parseInt(e.target.value, 10) || 0)}
                style={{ width: '100%', accentColor: 'var(--primary)', minHeight: '44px' }}
              />
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="input-severity">
                তীব্রতার সংখ্যা
              </label>
              <input
                type="number"
                min={0}
                max={10}
                step={1}
                className="input-control tabular-nums"
                id="input-severity"
                value={severity}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!Number.isNaN(val)) {
                    setSeverity(Math.max(0, Math.min(10, val)));
                  }
                }}
              />
            </div>
          </div>

          <div style={{ marginTop: 'var(--space-md)' }}>
            <span className="field-label" style={{ display: 'block', marginBottom: 'var(--space-sm)' }}>
              ৬টি ক্লিনিক্যাল ডোমেইনের চিহ্নসমূহ (যা যা দেখা যাচ্ছে টিক দিন):
            </span>
            <div className="check-grid" id="domain-checks">
              {DOMAIN_CHECKBOXES.map((cb) => (
                <label key={cb.value} className="check-pill">
                  <input
                    type="checkbox"
                    checked={selectedDomains.includes(cb.value)}
                    onChange={() => toggleDomainCheck(cb.value)}
                  />
                  <span>{cb.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="field-group" style={{ marginTop: 'var(--space-md)' }}>
            <label className="field-label" htmlFor="input-cough-note">
              অতিরিক্ত পর্যবেক্ষণ বা ডাক্তারের বলা তথ্য
            </label>
            <input
              type="text"
              className="input-control"
              id="input-cough-note"
              value={coughNote}
              onChange={(e) => setCoughNote(e.target.value)}
              placeholder="যেমন: রাত ২টার পর কাশি বেড়ে ঘুম ভেঙে যায়"
            />
          </div>

          <div
            className="input-row-end"
            style={{ marginTop: 'var(--space-md)', justifyContent: 'space-between' }}
          >
            <div className="header-actions">
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                className="btn btn-primary"
                onClick={handleSaveManualCoughLog}
              >
                ডায়েরিতে সংরক্ষণ করুন
              </motion.button>
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                className="btn btn-outline btn-sm"
                onClick={handleLoadSampleCoughCase}
              >
                নমুনা তথ্য দিয়ে দেখুন
              </motion.button>
            </div>
            <span className="inline-feedback" id="cough-log-feedback">
              {coughFeedback}
            </span>
          </div>
        </div>

        {/* Right Column: ThreeUI Predictive Arc Differential Index + Trend Charts */}
        <div className="list-stack">
          <div className="card">
            {/* ThreeUI PredictiveArcCanvas Clinical Header */}
            <div className="threeui-telemetry-frame" style={{ marginBottom: 'var(--space-md)', minHeight: '108px' }}>
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  pointerEvents: 'none',
                  opacity: 0.72,
                }}
                aria-hidden="true"
              >
                <PredictiveArcCanvas variant="predictive" mode="dark" hue={182} speed={0.9} />
              </div>
              <div className="threeui-telemetry-overlay">
                <div className="brand-title-row" style={{ justifyContent: 'space-between' }}>
                  <h2 className="subhead" style={{ margin: 0, color: '#e8f8fb' }}>
                    ৬-ডোমেইন কাশির কারণ বিশ্লেষণ সূচক
                  </h2>
                  <span className="mono-num" style={{ fontSize: '0.76rem', color: '#7eeef9' }}>
                    {sixDomains.filter((d) => d.active).length}/৬ সক্রিয় সংকেত
                  </span>
                </div>
                <p style={{ margin: '0.35rem 0 0 0', fontSize: 'var(--label-size)', color: '#b4dce4' }}>
                  চিকিৎসকের পরীক্ষার সুবিধার্থে সংগৃহীত তথ্যের ভিত্তিতে সম্ভাব্য ৬টি ক্ষেত্রের বর্তমান অবস্থান
                </p>
              </div>
            </div>

            <div className="domain-grid" id="six-domain-grid">
              {sixDomains.map((d, idx) => (
                <motion.div
                  key={d.title}
                  className="status-card"
                  data-status={d.active ? d.status : 'info'}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                >
                  <div
                    className="brand-title-row"
                    style={{ justifyContent: 'space-between', marginBottom: 'var(--space-xs)' }}
                  >
                    <strong style={{ fontSize: 'var(--body-size)' }}>{d.title}</strong>
                    <span className="status-text" data-status={d.active ? d.status : 'info'}>
                      {d.active ? 'চিহ্নিত' : 'নিরীক্ষণ'}
                    </span>
                  </div>
                  <div className="kpi-caption" style={{ margin: 0 }}>
                    {d.desc}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="card">
            <div
              className="brand-title-row"
              style={{ justifyContent: 'space-between', marginBottom: 'var(--space-xs)' }}
            >
              <h2 className="subhead" style={{ margin: 0 }}>
                গত ৭ দিনের দৈনিক কাশি ও লক্ষণ লগ
              </h2>
              <span className="status-text tabular-nums" data-status="info">
                মোট {weeklyLogTotal} টি লগ
              </span>
            </div>
            <p className="lede" style={{ marginBottom: 'var(--space-sm)', fontSize: 'var(--label-size)' }}>
              সপ্তাহজুড়ে প্রতিদিন কতবার কাশি বা শ্বাস-প্রশ্বাসের তথ্য নথিভুক্ত হয়েছে তা দেখুন:
            </p>
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart
                  data={weeklyChartData}
                  margin={{ top: 10, right: 16, left: -16, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--outline-variant)" vertical={false} />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 12, fill: 'var(--on-surface-variant)' }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 12, fill: 'var(--on-surface-variant)' }}
                  />
                  <Tooltip
                    formatter={(val: number) => [`${val} টি লগ`, 'দৈনিক সংখ্যা']}
                    labelFormatter={(_, payload) =>
                      payload?.[0]?.payload?.fullDate || ''
                    }
                    contentStyle={{
                      borderRadius: '0.625rem',
                      border: '1px solid var(--outline-variant)',
                      backgroundColor: 'var(--background)',
                    }}
                  />
                  <Bar
                    dataKey="count"
                    fill="var(--data-1)"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={44}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <h2 className="subhead">কাশির তীব্রতা (০–১০) ও সময়ক্রম</h2>
            <div className="chart-wrap">
              {chartData.length === 0 ? (
                <div className="empty-state" id="chart-empty-state">
                  <strong>এখনো কোনো কাশির তীব্রতার তথ্য নেই</strong>
                  <span>বাম পাশ থেকে প্রথম দৈনিক তথ্য যোগ করলে এখানে গ্রাফ তৈরি হবে।</span>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={chartData} margin={{ top: 10, right: 16, left: -12, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--outline-variant)" />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--on-surface-variant)' }} />
                    <YAxis
                      domain={[0, 10]}
                      ticks={[0, 2, 4, 6, 8, 10]}
                      tick={{ fontSize: 12, fill: 'var(--on-surface-variant)' }}
                    />
                    <Tooltip
                      formatter={(val: number) => [`${val}/১০`, 'কাশির তীব্রতা']}
                      contentStyle={{
                        borderRadius: '0.625rem',
                        border: '1px solid var(--outline-variant)',
                        backgroundColor: 'var(--background)',
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="severity"
                      stroke="var(--data-1)"
                      strokeWidth={2.5}
                      dot={{ r: 5, fill: 'var(--data-1)' }}
                      activeDot={{ r: 7 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Vitals Logger + 60-Second Breath Rate Timer */}
      <div className="two-col-grid">
        <div className="card">
          <div className="flex items-center gap-2" style={{ marginBottom: 'var(--space-xs)' }}>
            <Activity size={22} className="text-[#0b7a88]" aria-hidden="true" />
            <h2 className="section-heading" style={{ margin: 0 }}>
              রক্তচাপ, অক্সিজেন (SpO2) ও জ্বর লগার
            </h2>
          </div>
          <p className="lede" style={{ marginBottom: 'var(--space-md)' }}>
            পালস অক্সিমিটার বা প্রেশার মেশিন থেকে পাওয়া মান লিখুন। SpO2 ৯২%-এর নিচে গেলে সাথে সাথে জরুরি সতর্কতা চালু হবে।
          </p>

          <div className="form-grid">
            <div className="field-group">
              <label className="field-label" htmlFor="vit-sys">সিস্টোলিক প্রেশার (উপরের)</label>
              <input
                type="number"
                id="vit-sys"
                className="input-control tabular-nums"
                value={systolic}
                onChange={(e) => setSystolic(e.target.value)}
                placeholder="যেমন: 130"
              />
            </div>
            <div className="field-group">
              <label className="field-label" htmlFor="vit-dia">ডায়াস্টোলিক প্রেশার (নিচের)</label>
              <input
                type="number"
                id="vit-dia"
                className="input-control tabular-nums"
                value={diastolic}
                onChange={(e) => setDiastolic(e.target.value)}
                placeholder="যেমন: 80"
              />
            </div>
            <div className="field-group">
              <label className="field-label" htmlFor="vit-spo2">অক্সিজেন SpO2 (%)</label>
              <input
                type="number"
                id="vit-spo2"
                className="input-control tabular-nums"
                value={spo2}
                onChange={(e) => setSpo2(e.target.value)}
                placeholder="যেমন: 97"
              />
            </div>
            <div className="field-group">
              <label className="field-label" htmlFor="vit-temp">জ্বর / তাপমাত্রা (°F)</label>
              <input
                type="number"
                step="0.1"
                id="vit-temp"
                className="input-control tabular-nums"
                value={tempF}
                onChange={(e) => setTempF(e.target.value)}
                placeholder="যেমন: 98.6"
              />
            </div>
            <div className="field-group">
              <label className="field-label" htmlFor="vit-sugar">ব্লাড সুগার (mmol/L)</label>
              <input
                type="number"
                step="0.1"
                id="vit-sugar"
                className="input-control tabular-nums"
                value={bloodSugar}
                onChange={(e) => setBloodSugar(e.target.value)}
                placeholder="যেমন: 7.4"
              />
            </div>
          </div>

          <div
            className="input-row-end"
            style={{ marginTop: 'var(--space-md)', justifyContent: 'space-between' }}
          >
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              className="btn btn-primary"
              onClick={handleSaveVitals}
            >
              ভাইটালস সংরক্ষণ করুন
            </motion.button>
            <span className="inline-feedback">{vitalsFeedback}</span>
          </div>

          {state.vitalsLogs.length > 0 && (
            <div className="list-stack" style={{ marginTop: 'var(--space-md)', gap: '0.5rem' }}>
              {state.vitalsLogs.slice(0, 4).map((v) => (
                <div key={v.id} className="item-row" style={{ padding: '0.75rem 1rem' }}>
                  <div className="mono-num" style={{ fontWeight: 700, fontSize: 'var(--label-size)' }}>
                    {v.systolic || '-'}/{v.diastolic || '-'} mmHg · SpO2 {v.spo2 || '-'}% · {v.tempF || '-'}°F
                    {v.bloodSugar ? ` · Sugar ${v.bloodSugar}` : ''}
                  </div>
                  <span className="kpi-caption" style={{ margin: 0 }}>{v.date}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <BreathRateTimer onRecordBreathRate={handleRecordBreathRate} />
      </div>

      {/* Row 2: ThreeUI DiagnosticsPanel Prescription Vision Scanner + Verified Medication + Timeline */}
      <div className="two-col-grid">
        <div className="card">
          <h2 className="section-heading">প্রেসক্রিপশন স্ক্যানার ও ওষুধ যাচাই</h2>
          <p className="lede" style={{ marginBottom: 'var(--space-md)' }}>
            ডাক্তারের প্রেসক্রিপশন বা ওষুধের পাতার ছবি তুলুন—অথবা নিচে হাতে নাম লিখুন। এসিই-ইনহিবিটর জাতীয় কাশি সৃষ্টিকারী ওষুধ স্বয়ংক্রিয়ভাবে শনাক্ত হবে।
          </p>

          {/* AI Vision Prescription Upload with ThreeUI DiagnosticsPanel + Anime.js Scan Beam */}
          <div
            className="threeui-telemetry-frame"
            style={{ marginBottom: 'var(--space-lg)', minHeight: '116px' }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                opacity: isScanning ? 0.85 : 0.48,
              }}
              aria-hidden="true"
            >
              <DiagnosticsPanel
                variant="flow"
                mode="dark"
                hue={175}
                speed={isScanning ? 2.1 : 0.65}
                opacity={0.75}
              />
            </div>

            {isScanning && (
              <div
                ref={scanBeamRef}
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  width: '4px',
                  background: 'linear-gradient(180deg, transparent, #38e2f4, transparent)',
                  boxShadow: '0 0 18px 4px rgba(56, 226, 244, 0.55)',
                  zIndex: 3,
                  pointerEvents: 'none',
                }}
              />
            )}

            <div className="threeui-telemetry-overlay">
              <div className="brand-title-row" style={{ justifyContent: 'space-between' }}>
                <div>
                  <div className="flex items-center gap-2" style={{ color: '#e8f8fb', fontWeight: 700 }}>
                    <ScanLine size={18} className="text-[#38e2f4]" aria-hidden="true" />
                    <span>ছবি তুলে ওষুধ চিনে নিন (অপটিক্যাল স্ক্যানার)</span>
                  </div>
                  <span style={{ fontSize: 'var(--label-size)', color: '#a8d5df', display: 'block', marginTop: '0.2rem' }}>
                    বাংলাদেশি প্রেসক্রিপশন বা ওষুধের স্ট্রিপের স্পষ্ট ছবি আপলোড করুন
                  </span>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => void handlePrescriptionFileChange(e)}
                />
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  className="btn btn-primary btn-sm"
                  disabled={isScanning}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {isScanning ? (
                    <>
                      <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                      <span>স্ক্যান হচ্ছে…</span>
                    </>
                  ) : (
                    <>
                      <Camera size={16} aria-hidden="true" />
                      <span>প্রেসক্রিপশন / ওষুধের ছবি দিন</span>
                    </>
                  )}
                </motion.button>
              </div>
            </div>
          </div>

          {scanError && (
            <div className="error-banner" style={{ marginBottom: 'var(--space-md)' }} role="alert">
              {scanError}
            </div>
          )}

          <AnimatePresence>
            {scannedMeds.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                style={{ marginBottom: 'var(--space-lg)' }}
              >
                <div
                  className="brand-title-row"
                  style={{ justifyContent: 'space-between', marginBottom: 'var(--space-sm)' }}
                >
                  <strong>শনাক্তকৃত {scannedMeds.length} টি ওষুধ:</strong>
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.97 }}
                    className="btn btn-primary btn-sm"
                    onClick={handleImportScannedMeds}
                  >
                    <CheckCircle2 size={16} aria-hidden="true" />
                    <span>সব তালিকায় যোগ করুন</span>
                  </motion.button>
                </div>

                <div className="list-stack" style={{ gap: '0.5rem' }}>
                  {scannedMeds.map((sm, idx) => (
                    <div key={idx} className="item-row" style={{ padding: '0.75rem' }}>
                      <div style={{ flex: 1 }}>
                        <div className="meta-line" style={{ color: 'var(--on-surface)', fontWeight: 700 }}>
                          <span>{sm.brandName}</span>
                          <span className="meta-sep" aria-hidden="true">·</span>
                          <span>{sm.generic}</span>
                          <span className="meta-sep" aria-hidden="true">·</span>
                          <span className="status-text" data-status={sm.coughRisk === 'HIGH' ? 'alert' : 'ok'}>
                            {sm.coughRisk === 'HIGH' ? 'উচ্চ কাশি ঝুঁকি (ACE-I)' : sm.cls}
                          </span>
                        </div>
                        <div className="kpi-caption">
                          {sm.prayerTime} {sm.dose ? `· ${sm.dose}` : ''} — {sm.note}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {scanDoctorNotes && (
                  <p className="kpi-caption" style={{ marginTop: 'var(--space-sm)' }}>
                    <strong>প্রেসক্রিপশন নোট:</strong> {scanDoctorNotes}
                  </p>
                )}
                {scanWarnings.length > 0 && (
                  <p className="status-text" data-status="warn" style={{ marginTop: 'var(--space-xs)' }}>
                    {scanWarnings.join(' · ')}
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Manual Medication Entry */}
          <div className="form-grid">
            <div className="field-group">
              <label className="field-label" htmlFor="input-med-name">
                ওষুধের নাম (বাংলাদেশি ব্র্যান্ড বা জেনেরিক)
              </label>
              <input
                type="text"
                className="input-control"
                id="input-med-name"
                list="bd-drug-suggestions"
                value={medName}
                onChange={(e) => setMedName(e.target.value)}
                placeholder="যেমন: Ripril 2.5, Losartil 50, Seclo 20"
              />
              <datalist id="bd-drug-suggestions">
                {BD_DRUG_SUGGESTIONS.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="input-med-prayer">
                নামাজের সময়সূচী অনুযায়ী সময়
              </label>
              <select
                className="select-control"
                id="input-med-prayer"
                value={medPrayer}
                onChange={(e) => setMedPrayer(e.target.value)}
              >
                {PRAYER_TIMES.map((pt) => (
                  <option key={pt} value={pt}>
                    {pt}
                  </option>
                ))}
              </select>
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="input-med-dose">
                প্রেসক্রিপশন অনুযায়ী মাত্রা (ঐচ্ছিক)
              </label>
              <input
                type="text"
                className="input-control"
                id="input-med-dose"
                value={medDose}
                onChange={(e) => setMedDose(e.target.value)}
                placeholder="যেমন: ১টি ট্যাবলেট, খাবারের পর"
              />
            </div>
          </div>

          <div
            className="input-row-end"
            style={{ marginTop: 'var(--space-md)', justifyContent: 'space-between' }}
          >
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              className="btn btn-primary"
              onClick={handleAddMedication}
            >
              <PlusCircle size={18} aria-hidden="true" />
              <span>ওষুধ যাচাই ও যোগ করুন</span>
            </motion.button>
            <span className="inline-feedback" id="med-feedback">
              {medFeedback}
            </span>
          </div>

          <div className="list-stack" id="medications-list" style={{ marginTop: 'var(--space-lg)' }}>
            {state.medications.length === 0 ? (
              <div className="empty-state">
                <strong>এখনো কোনো যাচাইকৃত ওষুধ যোগ করা হয়নি</strong>
                <span>
                  উপরে প্রেসক্রিপশনের ছবি তুলুন অথবা আসল ওষুধের নাম লিখুন।
                </span>
              </div>
            ) : (
              state.medications.map((med) => {
                const badgeStatus =
                  med.coughRisk === 'HIGH'
                    ? 'alert'
                    : med.coughRisk === 'MODERATE'
                    ? 'warn'
                    : 'ok';
                const riskLabel =
                  med.coughRisk === 'HIGH'
                    ? 'উচ্চ ঝুঁকি: শুকনো কাশির সম্ভাব্য কারণ'
                    : med.coughRisk === 'MODERATE'
                    ? 'মাঝারি: রিফ্লাক্স/পা ফোলা পর্যবেক্ষণ'
                    : 'কাশির সরাসরি ঝুঁকি পাওয়া যায়নি';

                return (
                  <div key={med.id} className="item-row">
                    <div
                      className={state.settings.purdahMode ? 'privacy-blur' : ''}
                      style={{ flex: 1 }}
                    >
                      <div
                        className="meta-line"
                        style={{ color: 'var(--on-surface)', fontWeight: 700, marginBottom: 'var(--space-xs)' }}
                      >
                        <span style={{ fontSize: 'var(--subhead-size)' }}>{med.brandName}</span>
                        <span className="meta-sep" aria-hidden="true">·</span>
                        <span>{med.prayerTime}</span>
                        <span className="meta-sep" aria-hidden="true">·</span>
                        <span className="status-text" data-status={badgeStatus}>
                          {riskLabel}
                        </span>
                      </div>
                      <div className="kpi-caption">
                        <strong>জেনেরিক ও শ্রেণি:</strong> {med.generic} ({med.cls})
                        {med.dose ? ` · মাত্রা: ${med.dose}` : ''}
                      </div>
                      <p
                        className="lede"
                        style={{ fontSize: 'var(--label-size)', marginTop: 'var(--space-xs)' }}
                      >
                        {med.note}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => handleRemoveMedication(med.id)}
                    >
                      মুছুন
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="card">
          <h2 className="subhead">নথিভুক্ত কাশির টাইমলাইন</h2>
          <p className="lede" style={{ marginBottom: 'var(--space-md)' }}>
            আম্মুজির কথোপকথন ও দৈনিক ডায়েরি থেকে সংগৃহীত কাশির নথি:
          </p>
          <div className="list-stack" id="cough-timeline-list">
            {state.coughLogs.length === 0 ? (
              <div className="empty-state">
                <strong>এখনো কোনো কাশির ডায়েরি লেখা হয়নি</strong>
                <span>
                  বাম পাশের ফর্ম থেকে অথবা ভয়েস কথায় আম্মুজির কাশির লক্ষণ জানালে এখানে তারিখসহ তালিকা তৈরি হবে।
                </span>
              </div>
            ) : (
              state.coughLogs.map((log) => (
                <div
                  key={log.id}
                  className="status-card"
                  data-status={
                    log.tier === 'T1' ? 'alert' : log.tier === 'T2' ? 'warn' : 'ok'
                  }
                >
                  <div className="brand-title-row" style={{ justifyContent: 'space-between' }}>
                    <strong className="tabular-nums">
                      {log.breathRate !== undefined
                        ? `${log.type} — ${log.breathRate} বার/মিনিট`
                        : `${log.type} — তীব্রতা ${log.severity}/১০`}
                    </strong>
                    <span className="meta-line tabular-nums">
                      <span>{log.tier}</span>
                      <span className="meta-sep" aria-hidden="true">·</span>
                      <span>{log.date}</span>
                    </span>
                  </div>
                  <div className="kpi-caption">
                    {log.domains.length > 0
                      ? `ডোমেইন: ${log.domains.join(' · ')}`
                      : 'সাধারণ পর্যবেক্ষণ'}
                  </div>
                  <p
                    className="lede"
                    style={{ marginTop: 'var(--space-xs)', fontSize: 'var(--label-size)' }}
                  >
                    {log.note}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default CoughTracker;
