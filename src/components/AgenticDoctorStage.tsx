import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { animate, stagger } from 'animejs';
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
    breathScale: number;
    ringSpeed: number;
    glowIntensity: number;
    waveSpeed: number;
  }
> = {
  idle: {
    labelBn: 'প্রস্তুত · শান্ত পর্যবেক্ষণ',
    coreHex: 0x16b9cc,
    ringHex: 0x4de8f4,
    breathScale: 1.0,
    ringSpeed: 0.45,
    glowIntensity: 0.9,
    waveSpeed: 1.0,
  },
  listening: {
    labelBn: 'শুনছি · ৬৫০ মি.সে. কাশি বাফার চালু',
    coreHex: 0x10d998,
    ringHex: 0x6ef7c8,
    breathScale: 1.12,
    ringSpeed: 1.35,
    glowIntensity: 1.55,
    waveSpeed: 2.3,
  },
  thinking: {
    labelBn: 'বিশ্লেষণ করছি · ৬-ডোমেইন যাচাই',
    coreHex: 0x5c7cfa,
    ringHex: 0x91a7ff,
    breathScale: 0.94,
    ringSpeed: 2.1,
    glowIntensity: 1.45,
    waveSpeed: 2.8,
  },
  speaking: {
    labelBn: 'পরামর্শ দিচ্ছি · বাংলায় শুনুন',
    coreHex: 0x22d3ee,
    ringHex: 0xa5f3fc,
    breathScale: 1.08,
    ringSpeed: 1.05,
    glowIntensity: 1.35,
    waveSpeed: 1.9,
  },
  emergency: {
    labelBn: 'সতর্কতা · জরুরি রেড-ফ্ল্যাগ প্রটোকল',
    coreHex: 0xef4444,
    ringHex: 0xfca5a5,
    breathScale: 1.16,
    ringSpeed: 2.4,
    glowIntensity: 1.9,
    waveSpeed: 3.1,
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
  activeDomains,
  onToggleVoice,
  onToggleAiAudio,
  onStopSpeaking,
  onAskDomain,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const waveSvgRef = useRef<SVGSVGElement>(null);
  const [selectedDomainId, setSelectedDomainId] = useState<string | null>(null);
  const [hoveredDomainId, setHoveredDomainId] = useState<string | null>(null);
  const [webglFallback, setWebglFallback] = useState<boolean>(false);

  // Proxy animated parameters driven by Anime.js v4 and read smoothly inside Three.js render loop
  const animeProxyRef = useRef({
    breathScale: 1.0,
    ringSpeed: 0.45,
    glowIntensity: 0.9,
    waveSpeed: 1.0,
    colorBlend: 0,
  });

  const agentStateRef = useRef<AgentVisualState>(agentState);
  agentStateRef.current = agentState;

  const selectedDomainRef = useRef<string | null>(selectedDomainId);
  selectedDomainRef.current = selectedDomainId;

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

  // 1. Anime.js v4 Choreography: Smoothly morph 3D stage physics & SVG voice spectrogram on state changes
  useEffect(() => {
    const cfg = STATE_CONFIG[agentState];
    const anim = animate(animeProxyRef.current, {
      breathScale: cfg.breathScale,
      ringSpeed: cfg.ringSpeed,
      glowIntensity: cfg.glowIntensity,
      waveSpeed: cfg.waveSpeed,
      duration: 680,
      ease: 'outExpo',
    });

    const svgEl = waveSvgRef.current;
    let waveAnim: ReturnType<typeof animate> | null = null;
    if (svgEl) {
      const bars = svgEl.querySelectorAll('.voice-bar');
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!reducedMotion && bars.length > 0) {
        const minScale = agentState === 'idle' ? 0.22 : 0.35;
        const maxScale =
          agentState === 'listening'
            ? 1.0
            : agentState === 'speaking'
            ? 0.92
            : agentState === 'thinking'
            ? 0.78
            : agentState === 'emergency'
            ? 1.0
            : 0.42;
        const dur =
          agentState === 'listening' || agentState === 'emergency'
            ? 320
            : agentState === 'thinking'
            ? 380
            : agentState === 'speaking'
            ? 360
            : 900;

        waveAnim = animate(bars, {
          scaleY: [minScale, maxScale],
          opacity: agentState === 'idle' ? [0.45, 0.75] : [0.65, 1.0],
          duration: dur,
          delay: stagger(38, { from: 'center' }),
          loop: true,
          alternate: true,
          ease: 'inOutSine',
        });
      }
    }

    return () => {
      anim.revert();
      waveAnim?.revert();
    };
  }, [agentState]);

  // 2. Three.js 3D Bio-Respiratory Neural Core + 6-Domain Orbital Array
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
    const latticeShell = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.8, 1),
      latticeMat
    );
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
    const bioCapsule = new THREE.Mesh(
      new THREE.SphereGeometry(0.95, 36, 36),
      capsuleMat
    );
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

    const harmonicWaveRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.68, 0.014, 12, 108),
      new THREE.MeshBasicMaterial({
        color: 0x52e5f5,
        transparent: true,
        opacity: 0.42,
      })
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

    // Pointer interaction (orbit drag + hover/click raycast)
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

    // ResizeObserver
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

    // Context loss safety
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

    // Animation loop (hardware vs software GL pacing)
    let disposed = false;
    let rafId = 0;
    let lastTime = performance.now();
    let elapsed = 0;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const afterDraw = (fn: () => void) => {
      if (soft) {
        const gl = renderer.getContext();
        const sync = (gl as WebGL2RenderingContext).fenceSync
          ? (gl as WebGL2RenderingContext).fenceSync((gl as WebGL2RenderingContext).SYNC_GPU_COMMANDS_COMPLETE, 0)
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

        // Smooth color interpolation
        targetCoreColor.setHex(st.coreHex);
        targetRingColor.setHex(st.ringHex);
        coreMat.color.lerp(targetCoreColor, 0.08);
        coreMat.emissive.lerp(targetCoreColor, 0.08);
        coreMat.emissiveIntensity = proxy.glowIntensity;
        gimbalMatB.color.lerp(targetRingColor, 0.08);
        gimbalMatB.emissive.lerp(targetCoreColor, 0.08);
        baseGlowRing.material.color.lerp(targetRingColor, 0.08);
        baseGlowRing.material.emissive.lerp(targetCoreColor, 0.08);
        rimLight.color.lerp(targetCoreColor, 0.08);

        // Breathing pulmonary harmonic
        const pulse = Math.sin(elapsed * 2.1 * proxy.waveSpeed) * 0.045;
        const scale = proxy.breathScale + pulse;
        innerCore.scale.setScalar(scale);
        latticeShell.scale.setScalar(scale * 1.03);
        bioCapsule.scale.setScalar(1 + pulse * 0.45);

        innerCore.rotation.y += dt * 0.45 * proxy.ringSpeed * motionFactor;
        latticeShell.rotation.y -= dt * 0.3 * proxy.ringSpeed * motionFactor;

        gimbalRingA.rotation.z += dt * 0.55 * proxy.ringSpeed * motionFactor;
        gimbalRingB.rotation.z -= dt * 0.42 * proxy.ringSpeed * motionFactor;
        gimbalRingB.rotation.y += dt * 0.25 * proxy.ringSpeed * motionFactor;
        harmonicWaveRing.rotation.z += dt * 0.22 * proxy.ringSpeed * motionFactor;

        // Orbit drag damping + gentle auto-drift
        if (!isDragging) {
          targetYaw += dt * 0.12 * motionFactor;
        }
        currentYaw += (targetYaw - currentYaw) * 0.08;
        currentPitch += (targetPitch - currentPitch) * 0.08;
        rootGroup.rotation.y = currentYaw;
        rootGroup.rotation.x = currentPitch;

        // 6-Domain Orbital Nodes update
        domainGroup.rotation.y = elapsed * 0.2 * proxy.ringSpeed;
        domainMeshes.forEach((mesh, idx) => {
          const domId = DOMAIN_NODES[idx].id;
          const isFlagged = flaggedRef.current[domId];
          const isSelected = selectedDomainRef.current === domId;
          const nodeScale = isSelected ? 1.48 : isFlagged ? 1.24 : 1.0;
          mesh.scale.setScalar(nodeScale);
          const mMat = mesh.material as THREE.MeshStandardMaterial;
          if (isFlagged) {
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
              isFlagged ? 0xfcd34d : 0x6ef0ff
            );
          }
        });

        // Instanced particle drift
        for (let i = 0; i < PARTICLE_COUNT; i++) {
          const p = particleData[i];
          const a = p.angle + elapsed * p.speed * proxy.ringSpeed;
          dummyObj.position.set(
            Math.cos(a) * p.radius,
            p.yOffset + Math.sin(elapsed * 1.4 + i) * 0.08,
            Math.sin(a) * p.radius
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
    <div className="agent-stage-shell">
      {/* Top Clinical Telemetry Bar */}
      <div className="agent-stage-topbar">
        <div className="agent-state-readout" role="status" aria-live="polite">
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
      <div className="agent-viewport">
        {webglFallback ? (
          <div className="h-full w-full flex flex-col items-center justify-center p-4 text-center">
            <Sparkles size={40} className="text-[#38e2f4] mb-2" aria-hidden="true" />
            <div className="font-bold text-[#e8f7fa]">ডাঃ তোতা ক্লিনিক্যাল কোর সক্রিয়</div>
          </div>
        ) : (
          <div ref={mountRef} className="w-full h-full" />
        )}

        <div className="viewport-hud-top">
          <span>ডাঃ তোতা নিউরাল কোর · ৩ডি</span>
          <span>৬৫০ মি.সে. কাশি বাফার</span>
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

      {/* Anime.js v4 Live Harmonic Voice & Respiratory Spectrogram */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '38px',
          padding: '0 0.5rem',
          borderRadius: '0.65rem',
          background: '#06131a',
          border: '1px solid rgba(56, 178, 196, 0.2)',
        }}
        aria-hidden="true"
      >
        <svg
          ref={waveSvgRef}
          viewBox="0 0 280 32"
          width="100%"
          height="28"
          preserveAspectRatio="none"
        >
          {Array.from({ length: 28 }).map((_, i) => (
            <rect
              key={i}
              className="voice-bar"
              x={i * 10 + 2}
              y={4}
              width={5}
              height={24}
              rx={2.5}
              fill={
                agentState === 'emergency'
                  ? '#f87171'
                  : agentState === 'listening'
                  ? '#34d399'
                  : agentState === 'thinking'
                  ? '#818cf8'
                  : '#38e2f4'
              }
              style={{ transformOrigin: 'center', transformBox: 'fill-box' }}
            />
          ))}
        </svg>
      </div>

      {/* Interactive 6-Domain Orbital Selector Strip */}
      <div className="domain-orbit-strip" aria-label="৬টি ক্লিনিক্যাল ডোমেইন নির্বাচন">
        {enrichedDomains.map((dom) => {
          const active = selectedDomainId === dom.id || hoveredDomainId === dom.id;
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
          disabled={agentState === 'listening' && !isAiAudioRecording ? true : isTranscribing || agentState === 'thinking'}
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
