import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { animate, createTimeline, stagger, svg } from 'animejs';
import { motion, AnimatePresence } from 'motion/react';
import {
  Mic,
  MicOff,
  AudioLines,
  Volume2,
  VolumeX,
  Loader2,
  Sparkles,
  ShieldAlert,
  RotateCcw,
} from 'lucide-react';

export type AgentVisualState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'emergency';

export interface DomainTelemetryInfo {
  id: string;
  shortLabel: string;
  titleBn: string;
  clinicalFocus: string;
  promptPhrase: string;
  flagged: boolean;
}

interface AgenticDoctorStageProps {
  agentState: AgentVisualState;
  dialectLabel: string;
  coughWeeks: number;
  hasAceRisk: boolean;
  purdahMode: boolean;
  micStatus: string;
  interimText: string;
  isTranscribing: boolean;
  isAiAudioRecording: boolean;
  isSpeaking: boolean;
  audioLevelRef?: React.MutableRefObject<number>;
  activeDomains: string[];
  onToggleVoice: () => void;
  onToggleAiAudio: () => void;
  onStopSpeaking: () => void;
  onAskDomain: (phrase: string) => void;
}

const DOMAIN_NODES: Omit<DomainTelemetryInfo, 'flagged'>[] = [
  {
    id: 'tb',
    shortLabel: '১. টিবি (NTP)',
    titleBn: 'সংক্রমণ ও টিবি স্ক্রিনিং (২+ সপ্তাহ)',
    clinicalFocus: '২ সপ্তাহের বেশি কাশি, সন্ধ্যার জ্বর বা রাতের ঘাম যাচাই',
    promptPhrase: 'দুই সপ্তাহের বেশি সময় ধরে কাশি হলে টিবি বা কফ পরীক্ষা কি করা উচিত?',
  },
  {
    id: 'ace',
    shortLabel: '২. প্রেশার ওষুধ',
    titleBn: 'ওষুধজনিত কাশি (ACE-Inhibitor)',
    clinicalFocus: 'র‍্যামিপ্রিল/রিপ্রিল জাতীয় ওষুধে শুকনো গলা-সুড়সুড়ে কাশি',
    promptPhrase: 'আমার প্রেশারের ওষুধে কি এই শুকনো কাশি হচ্ছে?',
  },
  {
    id: 'copd',
    shortLabel: '৩. শ্বাসনালী',
    titleBn: 'শ্বাসনালী ও ধোঁয়া সংবেদনশীলতা (COPD)',
    clinicalFocus: 'কয়েল, চুলার ধোঁয়া ও বুকে শাঁই শাঁই শব্দ পর্যবেক্ষণ',
    promptPhrase: 'মশার কয়েল বা চুলার ধোঁয়ায় কাশি ও শ্বাসকষ্ট বেড়ে যাচ্ছে',
  },
  {
    id: 'gerd',
    shortLabel: '৪. অ্যাসিডিটি',
    titleBn: 'অ্যাসিডিটি ও রিফ্লাক্স (GERD)',
    clinicalFocus: 'খাওয়ার পর বুকে জ্বালা বা শোয়ার পর টক ঢেঁকুর/কাশি',
    promptPhrase: 'খাওয়ার পর বুকে জ্বালা ও অ্যাসিডিটির সাথে কাশি ওঠে',
  },
  {
    id: 'cardiac',
    shortLabel: '৫. হৃদযন্ত্র',
    titleBn: 'হৃদযন্ত্র ও পানি জমা (Cardiac)',
    clinicalFocus: 'রাতে শুলে কাশি বাড়া, উঁচু বালিশ লাগা ও পা ফোলা',
    promptPhrase: 'রাতে শুলে কাশি বাড়ে এবং উঁচু বালিশ লাগে',
  },
  {
    id: 'uacs',
    shortLabel: '৬. নাক-গলা',
    titleBn: 'নাক-গলার প্রদাহ (UACS)',
    clinicalFocus: 'গলা খাঁকারি দিয়ে কফ নামা ও নাক বন্ধ ভাব',
    promptPhrase: 'গলায় কফ জমে থাকে আর বারবার গলা খাঁকারি দিতে হয়',
  },
];

const STATE_CONFIG: Record<
  AgentVisualState,
  {
    labelBn: string;
    coreHex: number;
    ringHex: number;
    accentCss: string;
    breathScale: number;
    ringSpeed: number;
    glowIntensity: number;
    waveSpeed: number;
    cameraZ: number;
    particleSpread: number;
    gimbalSpread: number;
  }
> = {
  idle: {
    labelBn: 'প্রস্তুত · শান্ত পর্যবেক্ষণ',
    coreHex: 0x16b9cc,
    ringHex: 0x4de8f4,
    accentCss: '#38e2f4',
    breathScale: 1.0,
    ringSpeed: 0.45,
    glowIntensity: 0.9,
    waveSpeed: 1.0,
    cameraZ: 5.25,
    particleSpread: 1.0,
    gimbalSpread: 1.0,
  },
  listening: {
    labelBn: 'শুনছি · ৬৫০ মি.সে. কাশি বাফার চালু',
    coreHex: 0x10d998,
    ringHex: 0x6ef7c8,
    accentCss: '#34d399',
    breathScale: 1.13,
    ringSpeed: 1.45,
    glowIntensity: 1.65,
    waveSpeed: 2.35,
    cameraZ: 4.78,
    particleSpread: 1.18,
    gimbalSpread: 1.08,
  },
  thinking: {
    labelBn: 'বিশ্লেষণ করছি · ৬-ডোমেইন স্ক্যান',
    coreHex: 0x5c7cfa,
    ringHex: 0x91a7ff,
    accentCss: '#818cf8',
    breathScale: 0.94,
    ringSpeed: 2.35,
    glowIntensity: 1.55,
    waveSpeed: 2.85,
    cameraZ: 4.9,
    particleSpread: 0.88,
    gimbalSpread: 1.14,
  },
  speaking: {
    labelBn: 'পরামর্শ দিচ্ছি · বাংলায় শুনুন',
    coreHex: 0x22d3ee,
    ringHex: 0xa5f3fc,
    accentCss: '#22d3ee',
    breathScale: 1.09,
    ringSpeed: 1.1,
    glowIntensity: 1.4,
    waveSpeed: 1.95,
    cameraZ: 4.95,
    particleSpread: 1.08,
    gimbalSpread: 1.04,
  },
  emergency: {
    labelBn: 'সতর্কতা · জরুরি রেড-ফ্ল্যাগ প্রটোকল',
    coreHex: 0xef4444,
    ringHex: 0xfca5a5,
    accentCss: '#f87171',
    breathScale: 1.18,
    ringSpeed: 2.55,
    glowIntensity: 1.95,
    waveSpeed: 3.1,
    cameraZ: 4.65,
    particleSpread: 1.24,
    gimbalSpread: 1.16,
  },
};

function isSoftwareGl(canvas: HTMLCanvasElement): boolean {
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (!ext) return false;
    const renderer = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '');
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(renderer);
  } catch {
    return true;
  }
}

const AgenticDoctorStage: React.FC<AgenticDoctorStageProps> = ({
  agentState,
  dialectLabel,
  coughWeeks,
  hasAceRisk,
  purdahMode,
  micStatus,
  interimText,
  isTranscribing,
  isAiAudioRecording,
  isSpeaking,
  audioLevelRef,
  activeDomains,
  onToggleVoice,
  onToggleAiAudio,
  onStopSpeaking,
  onAskDomain,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const speakingAuraRef = useRef<HTMLDivElement>(null);
  const stateReadoutRef = useRef<HTMLDivElement>(null);
  const waveSvgRef = useRef<SVGSVGElement>(null);
  const ecgPathRef = useRef<SVGPathElement>(null);
  const ecgPulseDotRef = useRef<SVGCircleElement>(null);
  const domainStripRef = useRef<HTMLDivElement>(null);
  const stageShellRef = useRef<HTMLDivElement>(null);

  const [selectedDomainId, setSelectedDomainId] = useState<string | null>(null);
  const [hoveredDomainId, setHoveredDomainId] = useState<string | null>(null);
  const [scanningDomainIdx, setScanningDomainIdx] = useState<number>(-1);
  const [webglFallback, setWebglFallback] = useState<boolean>(false);

  // Proxy animated parameters choreographed by Anime.js v4 timelines and sampled at 60fps in Three.js
  const animeProxyRef = useRef({
    breathScale: 1.0,
    ringSpeed: 0.45,
    glowIntensity: 0.9,
    waveSpeed: 1.0,
    cameraZ: 5.25,
    particleSpread: 1.0,
    gimbalSpread: 1.0,
    gimbalBurstTilt: 0,
    speakingSizePulse: 0,
    speakingOpacityPulse: 0,
  });

  const agentStateRef = useRef<AgentVisualState>(agentState);
  agentStateRef.current = agentState;

  const isSpeakingRef = useRef<boolean>(isSpeaking);
  isSpeakingRef.current = isSpeaking;

  const selectedDomainRef = useRef<string | null>(selectedDomainId);
  selectedDomainRef.current = selectedDomainId;

  const scanningIdxRef = useRef<number>(scanningDomainIdx);
  scanningIdxRef.current = scanningDomainIdx;

  const onToggleVoiceRef = useRef(onToggleVoice);
  onToggleVoiceRef.current = onToggleVoice;

  const domainFlagMap = React.useMemo(() => {
    const text = activeDomains.join(' ');
    return {
      tb: coughWeeks >= 2 || text.includes('টিবি') || text.includes('জ্বর'),
      ace: hasAceRisk || text.includes('ACE'),
      copd: text.includes('শ্বাসনালী') || text.includes('কয়েল') || text.includes('ধোঁয়া'),
      gerd: text.includes('জ্বালা') || text.includes('GERD') || text.includes('গিলতে'),
      cardiac: text.includes('হৃদযন্ত্র') || text.includes('শুলে') || text.includes('পা'),
      uacs: text.includes('গলা খাঁকারি') || text.includes('ইউএসিএস') || text.includes('নাক'),
    };
  }, [coughWeeks, hasAceRisk, activeDomains]);

  const enrichedDomains: DomainTelemetryInfo[] = React.useMemo(
    () =>
      DOMAIN_NODES.map((d) => ({
        ...d,
        flagged: Boolean(domainFlagMap[d.id as keyof typeof domainFlagMap]),
      })),
    [domainFlagMap]
  );

  const flaggedRef = useRef<Record<string, boolean>>(domainFlagMap);
  flaggedRef.current = domainFlagMap;

  // 1. Anime.js v4 Multi-Stage Timeline Choreography for 3D Core + Spectrogram + ECG Drawable/MotionPath
  useEffect(() => {
    const cfg = STATE_CONFIG[agentState];
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Choreographed 2-beat Anime.js timeline: kinetic impulse -> settled clinical rhythm
    const tl = createTimeline({
      defaults: { ease: 'outExpo' },
    });

    tl.add(animeProxyRef.current, {
      ringSpeed: cfg.ringSpeed * (reducedMotion ? 1 : 1.75),
      glowIntensity: cfg.glowIntensity * 1.25,
      gimbalSpread: cfg.gimbalSpread * 1.07,
      gimbalBurstTilt: agentState === 'idle' ? 0 : 0.24,
      cameraZ: cfg.cameraZ,
      duration: 320,
    }).add(
      animeProxyRef.current,
      {
        breathScale: cfg.breathScale,
        ringSpeed: cfg.ringSpeed,
        glowIntensity: cfg.glowIntensity,
        waveSpeed: cfg.waveSpeed,
        particleSpread: cfg.particleSpread,
        gimbalSpread: cfg.gimbalSpread,
        gimbalBurstTilt: 0,
        duration: 620,
        ease: 'outElastic(1, 0.72)',
      },
      '-=60'
    );

    // Spectrogram bars staggered harmonic bounce
    let waveAnim: ReturnType<typeof animate> | null = null;
    if (waveSvgRef.current && !reducedMotion) {
      const bars = waveSvgRef.current.querySelectorAll('.voice-bar');
      if (bars.length > 0) {
        const minScale = agentState === 'idle' ? 0.18 : 0.3;
        const maxScale =
          agentState === 'listening' || agentState === 'emergency'
            ? 1.0
            : agentState === 'speaking'
            ? 0.94
            : agentState === 'thinking'
            ? 0.82
            : 0.44;
        const dur =
          agentState === 'listening' || agentState === 'emergency'
            ? 270
            : agentState === 'thinking'
            ? 340
            : agentState === 'speaking'
            ? 310
            : 880;

        waveAnim = animate(bars, {
          scaleY: [minScale, maxScale],
          opacity: agentState === 'idle' ? [0.42, 0.78] : [0.68, 1.0],
          duration: dur,
          delay: stagger(34, { from: 'center' }),
          loop: true,
          alternate: true,
          ease: 'inOutSine',
        });
      }
    }

    // Live SVG ECG stroke draw + motionPath pulse tracer
    let ecgDrawAnim: ReturnType<typeof animate> | null = null;
    let ecgDotAnim: ReturnType<typeof animate> | null = null;
    if (ecgPathRef.current && ecgPulseDotRef.current && !reducedMotion) {
      const ecgDur =
        agentState === 'emergency'
          ? 900
          : agentState === 'listening' || agentState === 'thinking'
          ? 1250
          : agentState === 'speaking'
          ? 1450
          : 2200;

      const [drawable] = svg.createDrawable(ecgPathRef.current);
      if (drawable) {
        ecgDrawAnim = animate(drawable, {
          draw: ['0 0', '0 1', '1 1'],
          duration: ecgDur,
          loop: true,
          ease: 'inOutQuad',
        });
      }

      const motionPath = svg.createMotionPath(ecgPathRef.current);
      ecgDotAnim = animate(ecgPulseDotRef.current, {
        ...motionPath,
        duration: ecgDur,
        loop: true,
        ease: 'linear',
      });
    }

    return () => {
      tl.revert();
      waveAnim?.revert();
      ecgDrawAnim?.revert();
      ecgDotAnim?.revert();
    };
  }, [agentState]);

  // 2. Anime.js Live 6-Domain Sequential Diagnostic Sweep while Agent is Thinking
  useEffect(() => {
    if (agentState !== 'thinking') {
      setScanningDomainIdx(-1);
      return;
    }

    let step = 0;
    setScanningDomainIdx(0);
    const interval = setInterval(() => {
      step = (step + 1) % DOMAIN_NODES.length;
      setScanningDomainIdx(step);
    }, 340);

    return () => {
      clearInterval(interval);
      setScanningDomainIdx(-1);
    };
  }, [agentState]);

  // Staggered Anime.js cascade on domain buttons when a domain is selected or thinking starts
  useEffect(() => {
    const strip = domainStripRef.current;
    if (!strip) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) return;

    const btns = strip.querySelectorAll('.domain-node-btn');
    if (btns.length === 0) return;

    const anim = animate(btns, {
      translateY: [6, 0],
      opacity: [0.65, 1],
      duration: 380,
      delay: stagger(40),
      ease: 'outCubic',
    });

    return () => {
      anim.revert();
    };
  }, [agentState]);

  // Anime.js border-glow pulse when a user clicks/selects a domain node
  useEffect(() => {
    if (!selectedDomainId || !stageShellRef.current) return;
    const anim = animate(animeProxyRef.current, {
      ringSpeed: STATE_CONFIG[agentStateRef.current].ringSpeed * 1.45,
      glowIntensity: STATE_CONFIG[agentStateRef.current].glowIntensity * 1.22,
      duration: 340,
      alternate: true,
      ease: 'outQuad',
    });
    return () => {
      anim.revert();
    };
  }, [selectedDomainId]);

  // 2b. Anime.js Ambient Breathing Animation on the Agent Viewport (.agent-viewport)
  useEffect(() => {
    const viewportEl = viewportRef.current;
    if (!viewportEl) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) return;

    const breathProfile: Record<
      AgentVisualState,
      { scales: [number, number]; duration: number }
    > = {
      idle: { scales: [1.0, 1.015], duration: 3200 },
      listening: { scales: [1.0, 1.021], duration: 2100 },
      thinking: { scales: [0.994, 1.012], duration: 1850 },
      speaking: { scales: [1.0, 1.022], duration: 1500 },
      emergency: { scales: [1.0, 1.026], duration: 1150 },
    };

    const { scales, duration } = breathProfile[agentState];
    const breathAnim = animate(viewportEl, {
      scale: scales,
      duration,
      loop: true,
      alternate: true,
      ease: 'inOutSine',
    });

    return () => {
      breathAnim.revert();
    };
  }, [agentState]);

  // 2c. Anime.js Synchronized Rhythmic Speaking Pulse (Size + Opacity Oscillations)
  useEffect(() => {
    const activeSpeaking = isSpeaking || agentState === 'speaking';
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!activeSpeaking || reducedMotion) {
      const settleProxy = animate(animeProxyRef.current, {
        speakingSizePulse: 0,
        speakingOpacityPulse: 0,
        duration: 260,
        ease: 'outQuad',
      });
      const settleAura = speakingAuraRef.current
        ? animate(speakingAuraRef.current, {
            opacity: 0,
            scale: 0.9,
            duration: 240,
            ease: 'outQuad',
          })
        : null;
      return () => {
        settleProxy.revert();
        settleAura?.revert();
      };
    }

    // Rhythmic multi-beat vocal cadence in Anime.js driving 3D size & opacity oscillations
    const speakTimeline = createTimeline({
      loop: true,
      defaults: { ease: 'inOutSine' },
    });

    speakTimeline
      .add(animeProxyRef.current, {
        speakingSizePulse: 0.095,
        speakingOpacityPulse: 0.34,
        duration: 210,
      })
      .add(animeProxyRef.current, {
        speakingSizePulse: 0.025,
        speakingOpacityPulse: 0.12,
        duration: 160,
      })
      .add(animeProxyRef.current, {
        speakingSizePulse: 0.125,
        speakingOpacityPulse: 0.42,
        duration: 220,
      })
      .add(animeProxyRef.current, {
        speakingSizePulse: 0.01,
        speakingOpacityPulse: 0.06,
        duration: 240,
      });

    // Synchronized concentric acoustic halo ring oscillation inside the viewport
    const auraAnim = speakingAuraRef.current
      ? animate(speakingAuraRef.current, {
          opacity: [0.18, 0.84],
          scale: [0.9, 1.13],
          duration: 415,
          loop: true,
          alternate: true,
          ease: 'inOutSine',
        })
      : null;

    // Synchronized state readout rhythmic opacity & scale pulse
    const readoutAnim = stateReadoutRef.current
      ? animate(stateReadoutRef.current, {
          opacity: [0.74, 1.0],
          scale: [0.988, 1.025],
          duration: 415,
          loop: true,
          alternate: true,
          ease: 'inOutSine',
        })
      : null;

    return () => {
      speakTimeline.revert();
      auraAnim?.revert();
      readoutAnim?.revert();
    };
  }, [isSpeaking, agentState]);

  // 3. Three.js 3D Bio-Respiratory Neural Core + 6-Domain Orbital Array
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-label', 'ডাঃ তোতা ত্রিমাত্রিক স্বাস্থ্য কোর');
    container.appendChild(canvas);

    const soft = isSoftwareGl(canvas);
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: !soft,
        alpha: true,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglFallback(true);
      canvas.remove();
      return;
    }

    const dpr = Math.min(window.devicePixelRatio || 1, soft ? 1.25 : 2);
    renderer.setPixelRatio(dpr);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = !soft;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x06131a, 0.058);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmrem.fromScene(roomEnv, 0.04);
    scene.environment = envTarget.texture;
    roomEnv.dispose();

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 60);
    camera.position.set(0, 0.45, 5.25);
    camera.lookAt(0, 0.02, 0);

    // Three-point clinical lighting (warm key + cool fill + teal rim)
    const keyLight = new THREE.DirectionalLight(0xfff5e4, 2.2);
    keyLight.position.set(3.2, 4.6, 3.8);
    if (!soft) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.bias = -0.0005;
    }
    scene.add(keyLight);

    const hemiLight = new THREE.HemisphereLight(0x9be7f2, 0x091c24, 1.15);
    scene.add(hemiLight);

    const rimLight = new THREE.PointLight(0x22d3ee, 3.2, 12);
    rimLight.position.set(-2.8, 1.5, -2.5);
    scene.add(rimLight);

    // Root hero group (10+ procedural parts)
    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    // Part 1 & 2: Grounded holographic clinical pedestal + radial floor glow disc
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 128;
    shadowCanvas.height = 128;
    const sctx = shadowCanvas.getContext('2d');
    if (sctx) {
      const grad = sctx.createRadialGradient(64, 64, 8, 64, 64, 62);
      grad.addColorStop(0, 'rgba(34, 211, 238, 0.34)');
      grad.addColorStop(0.55, 'rgba(11, 122, 136, 0.14)');
      grad.addColorStop(1, 'rgba(6, 19, 26, 0)');
      sctx.fillStyle = grad;
      sctx.fillRect(0, 0, 128, 128);
    }
    const shadowTex = new THREE.CanvasTexture(shadowCanvas);
    const contactDisc = new THREE.Mesh(
      new THREE.PlaneGeometry(3.8, 3.8),
      new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })
    );
    contactDisc.rotation.x = -Math.PI / 2;
    contactDisc.position.y = -1.42;
    rootGroup.add(contactDisc);

    const baseRingMat = new THREE.MeshStandardMaterial({
      color: 0x163845,
      metalness: 0.78,
      roughness: 0.28,
    });
    const basePlinth = new THREE.Mesh(
      new THREE.CylinderGeometry(1.15, 1.32, 0.14, 48),
      baseRingMat
    );
    basePlinth.position.y = -1.34;
    basePlinth.receiveShadow = !soft;
    rootGroup.add(basePlinth);

    const baseGlowRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.18, 0.024, 16, 72),
      new THREE.MeshStandardMaterial({
        color: 0x38e2f4,
        emissive: 0x129fb0,
        emissiveIntensity: 1.4,
        metalness: 0.2,
        roughness: 0.3,
      })
    );
    baseGlowRing.rotation.x = Math.PI / 2;
    baseGlowRing.position.y = -1.25;
    rootGroup.add(baseGlowRing);

    // Part 3: Inner Bio-Respiratory Neural Core (interactive raycast target)
    const coreGeo = new THREE.IcosahedronGeometry(0.68, soft ? 2 : 3);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x16b9cc,
      emissive: 0x0d94a6,
      emissiveIntensity: 1.0,
      metalness: 0.28,
      roughness: 0.22,
      wireframe: false,
    });
    const innerCore = new THREE.Mesh(coreGeo, coreMat);
    innerCore.position.y = 0.05;
    innerCore.castShadow = !soft;
    innerCore.userData = { action: 'toggleMic' };
    rootGroup.add(innerCore);

    // Part 4: Faceted neural lattice cage surrounding inner core
    const latticeMat = new THREE.MeshBasicMaterial({
      color: 0x7ef5ff,
      wireframe: true,
      transparent: true,
      opacity: 0.34,
    });
    const latticeShell = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8, 1), latticeMat);
    latticeShell.position.y = 0.05;
    rootGroup.add(latticeShell);

    // Part 5: Translucent Clearcoat Bio-Capsule Sphere
    const capsuleMat = new THREE.MeshPhysicalMaterial({
      color: 0xb7f4fb,
      metalness: 0.08,
      roughness: 0.12,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    });
    const bioCapsule = new THREE.Mesh(new THREE.SphereGeometry(0.95, 36, 36), capsuleMat);
    bioCapsule.position.y = 0.05;
    bioCapsule.userData = { action: 'toggleMic' };
    rootGroup.add(bioCapsule);

    // Part 6, 7, 8: Triple Articulated Clinical Gimbal Rings
    const gimbalMatA = new THREE.MeshStandardMaterial({
      color: 0x267487,
      emissive: 0x0b5060,
      emissiveIntensity: 0.55,
      metalness: 0.85,
      roughness: 0.24,
    });
    const gimbalRingA = new THREE.Mesh(new THREE.TorusGeometry(1.24, 0.028, 16, 90), gimbalMatA);
    gimbalRingA.position.y = 0.05;
    gimbalRingA.rotation.x = Math.PI / 3;
    rootGroup.add(gimbalRingA);

    const gimbalMatB = new THREE.MeshStandardMaterial({
      color: 0x38d9eb,
      emissive: 0x168d9e,
      emissiveIntensity: 0.8,
      metalness: 0.72,
      roughness: 0.22,
    });
    const gimbalRingB = new THREE.Mesh(new THREE.TorusGeometry(1.42, 0.02, 16, 96), gimbalMatB);
    gimbalRingB.position.y = 0.05;
    gimbalRingB.rotation.y = Math.PI / 4;
    gimbalRingB.rotation.x = -Math.PI / 5;
    rootGroup.add(gimbalRingB);

    const harmonicWaveMat = new THREE.MeshBasicMaterial({
      color: 0x52e5f5,
      transparent: true,
      opacity: 0.42,
    });
    const harmonicWaveRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.68, 0.014, 12, 108),
      harmonicWaveMat
    );
    harmonicWaveRing.position.y = 0.05;
    harmonicWaveRing.rotation.x = Math.PI / 2.25;
    rootGroup.add(harmonicWaveRing);

    // Part 9: 6-Domain Interactive Orbital Sensor Nodes
    const domainGroup = new THREE.Group();
    domainGroup.position.y = 0.05;
    rootGroup.add(domainGroup);

    const domainMeshes: THREE.Mesh[] = [];
    const domainRingMeshes: THREE.Mesh[] = [];
    const domainOrbRadius = 1.66;
    const nodeSphereGeo = new THREE.SphereGeometry(0.115, 22, 22);
    const nodeRingGeo = new THREE.TorusGeometry(0.165, 0.015, 10, 32);

    DOMAIN_NODES.forEach((dom, idx) => {
      const angle = (idx / DOMAIN_NODES.length) * Math.PI * 2;
      const x = Math.cos(angle) * domainOrbRadius;
      const z = Math.sin(angle) * domainOrbRadius;
      const y = Math.sin(angle * 2) * 0.18;

      const nodeMat = new THREE.MeshStandardMaterial({
        color: 0x2bd9ec,
        emissive: 0x128799,
        emissiveIntensity: 0.9,
        metalness: 0.45,
        roughness: 0.25,
      });
      const nodeMesh = new THREE.Mesh(nodeSphereGeo, nodeMat);
      nodeMesh.position.set(x, y, z);
      nodeMesh.userData = { domainId: dom.id };
      domainGroup.add(nodeMesh);
      domainMeshes.push(nodeMesh);

      const haloMat = new THREE.MeshBasicMaterial({
        color: 0x6ef0ff,
        transparent: true,
        opacity: 0.55,
      });
      const haloMesh = new THREE.Mesh(nodeRingGeo, haloMat);
      haloMesh.position.copy(nodeMesh.position);
      haloMesh.lookAt(0, 0, 0);
      domainGroup.add(haloMesh);
      domainRingMeshes.push(haloMesh);
    });

    // Part 10: InstancedMesh Bio-Telemetry Particle Cloud
    const PARTICLE_COUNT = soft ? 48 : 88;
    const particleGeo = new THREE.OctahedronGeometry(0.026, 0);
    const particleMat = new THREE.MeshBasicMaterial({
      color: 0x7ef2ff,
      transparent: true,
      opacity: 0.72,
    });
    const particleInstanced = new THREE.InstancedMesh(particleGeo, particleMat, PARTICLE_COUNT);
    const particleData = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      radius: 1.15 + (i % 7) * 0.16,
      angle: (i / PARTICLE_COUNT) * Math.PI * 2 * 3,
      yOffset: ((i % 11) - 5) * 0.18,
      speed: 0.18 + (i % 5) * 0.07,
      scale: 0.65 + (i % 4) * 0.28,
    }));
    rootGroup.add(particleInstanced);

    // Pre-allocated math objects for render loop
    const dummyObj = new THREE.Object3D();
    const targetCoreColor = new THREE.Color();
    const targetRingColor = new THREE.Color();
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();

    let isDragging = false;
    let pointerDownPos = { x: 0, y: 0 };
    let targetYaw = 0;
    let targetPitch = 0.08;
    let currentYaw = 0;
    let currentPitch = 0.08;

    const getNdc = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      pointerNdc.x = ((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
      pointerNdc.y = -((clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1;
    };

    const handlePointerDown = (e: PointerEvent) => {
      isDragging = true;
      pointerDownPos = { x: e.clientX, y: e.clientY };
      canvas.setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (isDragging) {
        const dx = e.clientX - pointerDownPos.x;
        const dy = e.clientY - pointerDownPos.y;
        targetYaw += dx * 0.008;
        targetPitch = Math.max(-0.45, Math.min(0.45, targetPitch + dy * 0.006));
        pointerDownPos = { x: e.clientX, y: e.clientY };
        return;
      }

      getNdc(e.clientX, e.clientY);
      raycaster.setFromCamera(pointerNdc, camera);
      const hits = raycaster.intersectObjects([...domainMeshes, bioCapsule, innerCore], false);
      if (hits.length > 0) {
        const hitData = hits[0].object.userData;
        canvas.style.cursor = 'pointer';
        if (hitData.domainId) {
          setHoveredDomainId(hitData.domainId);
        } else {
          setHoveredDomainId(null);
        }
      } else {
        canvas.style.cursor = 'grab';
        setHoveredDomainId(null);
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      const moved =
        Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y) > 6;
      isDragging = false;
      if (canvas.hasPointerCapture(e.pointerId)) {
        canvas.releasePointerCapture(e.pointerId);
      }
      if (!moved) {
        getNdc(e.clientX, e.clientY);
        raycaster.setFromCamera(pointerNdc, camera);
        const hits = raycaster.intersectObjects([...domainMeshes, bioCapsule, innerCore], false);
        if (hits.length > 0) {
          const hitData = hits[0].object.userData;
          if (hitData.domainId) {
            setSelectedDomainId((prev) => (prev === hitData.domainId ? null : hitData.domainId));
          } else if (hitData.action === 'toggleMic') {
            onToggleVoiceRef.current();
          }
        }
      }
    };

    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerup', handlePointerUp);

    const resize = () => {
      const w = container.clientWidth || 420;
      const h = container.clientHeight || 310;
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    resize();

    let contextLost = false;
    const onContextLost = (ev: Event) => {
      ev.preventDefault();
      contextLost = true;
    };
    const onContextRestored = () => {
      contextLost = false;
    };
    canvas.addEventListener('webglcontextlost', onContextLost);
    canvas.addEventListener('webglcontextrestored', onContextRestored);

    let disposed = false;
    let rafId = 0;
    let lastTime = performance.now();
    let elapsed = 0;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const afterDraw = (fn: () => void) => {
      if (soft) {
        const gl = renderer.getContext();
        const sync = (gl as WebGL2RenderingContext).fenceSync
          ? (gl as WebGL2RenderingContext).fenceSync(
              (gl as WebGL2RenderingContext).SYNC_GPU_COMMANDS_COMPLETE,
              0
            )
          : null;
        if (sync) {
          gl.flush();
          const poll = () => {
            if (disposed) return;
            const status = (gl as WebGL2RenderingContext).clientWaitSync(sync, 0, 0);
            if (status === (gl as WebGL2RenderingContext).TIMEOUT_EXPIRED) {
              rafId = requestAnimationFrame(poll);
            } else {
              (gl as WebGL2RenderingContext).deleteSync(sync);
              fn();
            }
          };
          rafId = requestAnimationFrame(poll);
          return;
        }
      }
      rafId = requestAnimationFrame(fn);
    };

    const tick = () => {
      if (disposed) return;
      const now = performance.now();
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      if (!contextLost && !document.hidden) {
        const proxy = animeProxyRef.current;
        const st = STATE_CONFIG[agentStateRef.current];
        const motionFactor = reducedMotion ? 0.15 : 1;
        elapsed += dt * motionFactor;

        const speakingActive = isSpeakingRef.current || agentStateRef.current === 'speaking';
        const liveAudioBoost = speakingActive ? Math.min(1, audioLevelRef?.current || 0) : 0;
        const speakingSizeMod = proxy.speakingSizePulse + liveAudioBoost * 0.1;
        const speakingOpacityMod = proxy.speakingOpacityPulse + liveAudioBoost * 0.35;

        // Anime.js driven dynamic camera focus & gimbal spread
        camera.position.z = proxy.cameraZ;
        gimbalRingA.scale.setScalar(proxy.gimbalSpread + speakingSizeMod * 0.28);
        gimbalRingB.scale.setScalar(proxy.gimbalSpread + speakingSizeMod * 0.34);
        harmonicWaveRing.scale.setScalar(proxy.gimbalSpread * 1.02 + speakingSizeMod * 0.55);

        // Smooth color interpolation + rhythmic speaking opacity & emissive glow oscillations
        targetCoreColor.setHex(st.coreHex);
        targetRingColor.setHex(st.ringHex);
        coreMat.color.lerp(targetCoreColor, 0.08);
        coreMat.emissive.lerp(targetCoreColor, 0.08);
        coreMat.emissiveIntensity = proxy.glowIntensity + speakingOpacityMod * 1.35;
        latticeMat.opacity = Math.min(0.88, 0.34 + speakingOpacityMod * 0.85);
        capsuleMat.opacity = Math.min(0.54, 0.22 + speakingOpacityMod * 0.45);
        harmonicWaveMat.opacity = Math.min(0.95, 0.42 + speakingOpacityMod * 0.9);
        particleMat.opacity = Math.min(1.0, 0.72 + speakingOpacityMod * 0.45);
        gimbalMatB.color.lerp(targetRingColor, 0.08);
        gimbalMatB.emissive.lerp(targetCoreColor, 0.08);
        baseGlowRing.material.color.lerp(targetRingColor, 0.08);
        baseGlowRing.material.emissive.lerp(targetCoreColor, 0.08);
        rimLight.color.lerp(targetCoreColor, 0.08);
        rimLight.intensity = 3.2 + speakingOpacityMod * 2.4;

        // Breathing pulmonary harmonic + synchronized speaking size oscillations
        const pulse = Math.sin(elapsed * 2.1 * proxy.waveSpeed) * 0.048;
        const scale = proxy.breathScale + pulse + speakingSizeMod;
        innerCore.scale.setScalar(scale);
        latticeShell.scale.setScalar(scale * 1.04 + speakingSizeMod * 0.25);
        bioCapsule.scale.setScalar(1 + pulse * 0.45 + speakingSizeMod * 0.65);

        innerCore.rotation.y += dt * 0.45 * proxy.ringSpeed * motionFactor;
        latticeShell.rotation.y -= dt * 0.3 * proxy.ringSpeed * motionFactor;

        gimbalRingA.rotation.z += dt * 0.55 * proxy.ringSpeed * motionFactor;
        gimbalRingA.rotation.x = Math.PI / 3 + proxy.gimbalBurstTilt;
        gimbalRingB.rotation.z -= dt * 0.42 * proxy.ringSpeed * motionFactor;
        gimbalRingB.rotation.y += dt * 0.25 * proxy.ringSpeed * motionFactor;
        harmonicWaveRing.rotation.z += dt * 0.22 * proxy.ringSpeed * motionFactor;

        if (!isDragging) {
          targetYaw += dt * 0.14 * motionFactor;
        }
        currentYaw += (targetYaw - currentYaw) * 0.08;
        currentPitch += (targetPitch - currentPitch) * 0.08;
        rootGroup.rotation.y = currentYaw;
        rootGroup.rotation.x = currentPitch;

        // 6-Domain Orbital Nodes update (highlights active thinking scan node + flagged nodes)
        domainGroup.rotation.y = elapsed * 0.2 * proxy.ringSpeed;
        domainMeshes.forEach((mesh, idx) => {
          const domId = DOMAIN_NODES[idx].id;
          const isFlagged = flaggedRef.current[domId];
          const isSelected = selectedDomainRef.current === domId;
          const isScanningNode = scanningIdxRef.current === idx;
          const nodeScale = isSelected
            ? 1.5
            : isScanningNode
            ? 1.44
            : isFlagged
            ? 1.24
            : 1.0;
          mesh.scale.setScalar(nodeScale);
          const mMat = mesh.material as THREE.MeshStandardMaterial;
          if (isScanningNode) {
            mMat.color.setHex(0xffffff);
            mMat.emissive.setHex(0x818cf8);
            mMat.emissiveIntensity = 1.85;
          } else if (isFlagged) {
            mMat.color.setHex(0xf59e0b);
            mMat.emissive.setHex(0xd97706);
            mMat.emissiveIntensity = 1.45;
          } else if (isSelected) {
            mMat.color.setHex(0xffffff);
            mMat.emissive.setHex(0x38e2f4);
            mMat.emissiveIntensity = 1.6;
          } else {
            mMat.color.lerp(targetRingColor, 0.1);
            mMat.emissive.lerp(targetCoreColor, 0.1);
            mMat.emissiveIntensity = 0.85;
          }

          const halo = domainRingMeshes[idx];
          if (halo) {
            halo.scale.setScalar(nodeScale + Math.sin(elapsed * 3 + idx) * 0.08);
            (halo.material as THREE.MeshBasicMaterial).color.setHex(
              isScanningNode ? 0xc7d2fe : isFlagged ? 0xfcd34d : 0x6ef0ff
            );
          }
        });

        // Instanced particle drift with Anime.js particleSpread
        for (let i = 0; i < PARTICLE_COUNT; i++) {
          const p = particleData[i];
          const a = p.angle + elapsed * p.speed * proxy.ringSpeed;
          const r = p.radius * proxy.particleSpread;
          dummyObj.position.set(
            Math.cos(a) * r,
            p.yOffset + Math.sin(elapsed * 1.4 + i) * 0.08,
            Math.sin(a) * r
          );
          dummyObj.rotation.set(a, a * 0.7, 0);
          dummyObj.scale.setScalar(p.scale);
          dummyObj.updateMatrix();
          particleInstanced.setMatrixAt(i, dummyObj.matrix);
        }
        particleInstanced.instanceMatrix.needsUpdate = true;

        renderer.render(scene, camera);
      }

      afterDraw(tick);
    };

    afterDraw(tick);

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      ro.disconnect();
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerup', handlePointerUp);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);

      shadowTex.dispose();
      envTarget.dispose();
      pmrem.dispose();
      coreGeo.dispose();
      particleGeo.dispose();
      nodeSphereGeo.dispose();
      nodeRingGeo.dispose();

      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const mesh = obj as THREE.Mesh;
          mesh.geometry?.dispose();
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((m) => m.dispose());
          } else {
            mesh.material?.dispose();
          }
        }
      });

      renderer.dispose();
      canvas.remove();
    };
  }, []);

  const stateMeta = STATE_CONFIG[agentState];
  const inspectedDomain =
    enrichedDomains.find((d) => d.id === (hoveredDomainId || selectedDomainId)) || null;
  const activeRecording = agentState === 'listening';

  return (
    <div className="agent-stage-shell" ref={stageShellRef}>
      {/* Top Clinical Telemetry Bar */}
      <div className="agent-stage-topbar">
        <div
          ref={stateReadoutRef}
          className="agent-state-readout"
          role="status"
          aria-live="polite"
          style={{ transformOrigin: 'left center' }}
        >
          <Sparkles size={17} aria-hidden="true" />
          <span>{stateMeta.labelBn}</span>
        </div>
        <span className="mono-num" style={{ fontSize: '0.78rem', color: 'var(--stage-muted)' }}>
          {coughWeeks > 0 ? `কাশি: ${coughWeeks} সপ্তাহ` : '৬-ডোমেইন এআই কোর'} · {dialectLabel.split(' ')[0]}
        </span>
      </div>

      {purdahMode && (
        <div
          className="status-card"
          id="purdah-active-banner"
          data-status="warn"
          style={{ width: '100%', textAlign: 'left' }}
        >
          <strong>নিরিবিলি মোড চালু:</strong> পাশে মানুষ থাকায় সাধারণ শব্দ বন্ধ ও ব্যক্তিগত তথ্য আড়াল রাখা হয়েছে।
        </div>
      )}

      {/* Interactive 3D Neural-Respiratory Canvas */}
      <div className="agent-viewport" ref={viewportRef}>
        {webglFallback ? (
          <div className="h-full w-full flex flex-col items-center justify-center p-4 text-center">
            <Sparkles size={40} className="text-[#38e2f4] mb-2" aria-hidden="true" />
            <div className="font-bold text-[#e8f7fa]">ডাঃ তোতা ক্লিনিক্যাল কোর সক্রিয়</div>
          </div>
        ) : (
          <div ref={mountRef} className="w-full h-full" />
        )}

        <div
          ref={speakingAuraRef}
          className="speaking-aura-ring"
          style={{ borderColor: stateMeta.accentCss }}
          aria-hidden="true"
        />

        <div className="viewport-hud-top">
          <span>ডাঃ তোতা নিউরাল কোর · ৩ডি</span>
          <span>
            {agentState === 'thinking' && scanningDomainIdx >= 0
              ? `স্ক্যান: ${DOMAIN_NODES[scanningDomainIdx].shortLabel}`
              : '৬৫০ মি.সে. কাশি বাফার'}
          </span>
        </div>

        <div className="viewport-hud-bottom">
          <span>গোলকের মাঝে চাপলে কথা শুরু হবে · ঘুরিয়ে দেখতে টানুন</span>
          {selectedDomainId && (
            <button
              type="button"
              onClick={() => setSelectedDomainId(null)}
              style={{
                pointerEvents: 'auto',
                background: 'rgba(8, 27, 36, 0.9)',
                border: '1px solid rgba(94, 224, 240, 0.45)',
                color: '#d4f3f9',
                borderRadius: '0.45rem',
                padding: '0.15rem 0.45rem',
                fontSize: '0.72rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}
            >
              <RotateCcw size={12} aria-hidden="true" />
              রিসেট
            </button>
          )}
        </div>
      </div>

      {/* Anime.js v4 Dual Telemetry: Live ECG MotionPath + 28-Bar Harmonic Spectrogram */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1.25fr',
          gap: '0.5rem',
          alignItems: 'center',
          height: '44px',
          padding: '0 0.65rem',
          borderRadius: '0.65rem',
          background: '#06131a',
          border: '1px solid rgba(56, 178, 196, 0.22)',
        }}
        aria-hidden="true"
      >
        <svg viewBox="0 0 180 34" width="100%" height="32" preserveAspectRatio="none">
          <path
            d="M 2 18 L 36 18 L 46 18 L 54 6 L 62 29 L 70 11 L 78 18 L 112 18 L 120 18 L 128 7 L 136 28 L 144 12 L 152 18 L 178 18"
            fill="none"
            stroke="rgba(56, 226, 244, 0.16)"
            strokeWidth="1.5"
          />
          <path
            ref={ecgPathRef}
            d="M 2 18 L 36 18 L 46 18 L 54 6 L 62 29 L 70 11 L 78 18 L 112 18 L 120 18 L 128 7 L 136 28 L 144 12 L 152 18 L 178 18"
            fill="none"
            stroke={stateMeta.accentCss}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle
            ref={ecgPulseDotRef}
            cx="0"
            cy="0"
            r="3.2"
            fill="#ffffff"
            stroke={stateMeta.accentCss}
            strokeWidth="1.5"
          />
        </svg>

        <svg
          ref={waveSvgRef}
          viewBox="0 0 240 32"
          width="100%"
          height="28"
          preserveAspectRatio="none"
        >
          {Array.from({ length: 24 }).map((_, i) => (
            <rect
              key={i}
              className="voice-bar"
              x={i * 10 + 2}
              y={4}
              width={5}
              height={24}
              rx={2.5}
              fill={stateMeta.accentCss}
              style={{ transformOrigin: 'center', transformBox: 'fill-box' }}
            />
          ))}
        </svg>
      </div>

      {/* Interactive 6-Domain Orbital Selector Strip (synced with Thinking Scan!) */}
      <div
        ref={domainStripRef}
        className="domain-orbit-strip"
        aria-label="৬টি ক্লিনিক্যাল ডোমেইন নির্বাচন"
      >
        {enrichedDomains.map((dom, idx) => {
          const active =
            selectedDomainId === dom.id ||
            hoveredDomainId === dom.id ||
            scanningDomainIdx === idx;
          return (
            <motion.button
              key={dom.id}
              type="button"
              whileTap={{ scale: 0.96 }}
              className="domain-node-btn"
              data-active={active}
              data-flagged={dom.flagged}
              onClick={() =>
                setSelectedDomainId((prev) => (prev === dom.id ? null : dom.id))
              }
            >
              <span className="truncate">{dom.shortLabel}</span>
              {dom.flagged && <ShieldAlert size={13} aria-hidden="true" className="shrink-0" />}
            </motion.button>
          );
        })}
      </div>

      {/* Motion.dev Selected Domain Clinical Inspector */}
      <AnimatePresence mode="wait">
        {inspectedDomain && (
          <motion.div
            key={inspectedDomain.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            className="domain-inspector-card"
          >
            <div style={{ flex: 1, minWidth: '180px' }}>
              <div style={{ fontWeight: 700, fontSize: 'var(--label-size)', color: '#ffffff' }}>
                {inspectedDomain.titleBn}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#a8d5df', marginTop: '0.15rem' }}>
                {inspectedDomain.clinicalFocus}
              </div>
            </div>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                onAskDomain(inspectedDomain.promptPhrase);
                setSelectedDomainId(null);
              }}
            >
              এ বিষয়ে জিজ্ঞাসা করুন
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Primary Mic Action CTA (Preserving exact IDs for compatibility) */}
      <motion.button
        type="button"
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.98 }}
        className={`btn mic-cta-btn ${activeRecording ? 'btn-emergency' : 'btn-primary'}`}
        id="btn-mic-orb"
        onClick={onToggleVoice}
        disabled={isTranscribing || agentState === 'thinking'}
        aria-pressed={activeRecording}
      >
        {isTranscribing ? (
          <Loader2 size={24} className="animate-spin" aria-hidden="true" />
        ) : activeRecording ? (
          <MicOff size={24} aria-hidden="true" />
        ) : (
          <Mic size={24} aria-hidden="true" />
        )}
        <span id="mic-orb-label">
          {isTranscribing
            ? 'কণ্ঠ বিশ্লেষণ হচ্ছে…'
            : activeRecording
            ? 'শুনছি… থামাতে এখানে চাপুন'
            : 'বোতামে চাপ দিয়ে বাংলায় বলুন'}
        </span>
      </motion.button>

      <div style={{ textAlign: 'center' }}>
        <div
          id="mic-status-text"
          style={{
            fontWeight: 700,
            fontSize: 'var(--label-size)',
            color: '#d4f3f9',
            marginBottom: '0.2rem',
          }}
        >
          {micStatus}
        </div>
        <div className="interim-box-stage" id="interim-transcript-box">
          {interimText}
        </div>
      </div>

      {/* Secondary Audio & TTS Controls */}
      <div className="header-actions" style={{ justifyContent: 'center' }}>
        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          className={`btn btn-sm ${isAiAudioRecording ? 'btn-emergency' : 'btn-stage-ghost'}`}
          onClick={onToggleAiAudio}
          disabled={
            agentState === 'listening' && !isAiAudioRecording
              ? true
              : isTranscribing || agentState === 'thinking'
          }
          title="সিলেটি, চট্টগ্রামী বা যেকোনো ব্রাউজারে স্পষ্ট কথা বোঝার জন্য"
        >
          <AudioLines size={17} aria-hidden="true" />
          <span>{isAiAudioRecording ? 'রেকর্ড থামান ও পাঠান' : 'এআই অডিও রেকর্ড'}</span>
        </motion.button>

        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          className="btn btn-stage-ghost btn-sm"
          id="btn-stop-speak"
          onClick={onStopSpeaking}
        >
          {isSpeaking ? <Volume2 size={17} aria-hidden="true" /> : <VolumeX size={17} aria-hidden="true" />}
          <span>{isSpeaking ? 'শব্দ থামান (বলছি…)' : 'শব্দ থামান'}</span>
        </motion.button>
      </div>
    </div>
  );
};

export default AgenticDoctorStage;
