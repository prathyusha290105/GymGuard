import React, { useState, useEffect } from 'react';
import {
  Fingerprint,
  Lock,
  Unlock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { accessAuthorizationService } from '../services/access/accessAuthorizationService';
import { biometricService } from '../services/hardware/biometricService';
import { accessControllerService } from '../services/hardware/accessControllerService';
import { mockDoorController } from '../services/hardware/MockDoorController';
import { Member, AccessDecision, DoorState } from '../types';
import { formatTimeDisplay } from '../utils/dateUtils';

export const AccessControlKioskPage: React.FC = () => {
  const { currentGym } = useAuth();
  const gymId = currentGym?.gymId || 'gym-01';

  const [members, setMembers] = useState<Member[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string>('mem-001'); // Default valid member
  const [doorState, setDoorState] = useState<DoorState>('LOCKED');
  const [scanStep, setScanStep] = useState<'IDLE' | 'SCANNING' | 'IDENTIFYING' | 'CHECKING' | 'DECISION'>('IDLE');
  const [decision, setDecision] = useState<AccessDecision | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [autoResetTimer, setAutoResetTimer] = useState<any>(null);

  useEffect(() => {
    // Subscribe to door controller state
    const unsub = mockDoorController.subscribeState(st => setDoorState(st));

    // Load registered members for simulator dropdown
    const fetchMembers = async () => {
      try {
        const snap = await getDocs(query(collection(db, 'members'), where('gymId', '==', gymId)));
        const list = snap.docs.map(d => d.data() as Member);
        setMembers(list);
      } catch (e) {
        console.error('Error fetching members for kiosk', e);
      }
    };
    fetchMembers();

    return () => unsub();
  }, [gymId]);

  const playChime = (allowed: boolean) => {
    if (!soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (allowed) {
        // High pleasant double beep
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15); // A5
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
      } else {
        // Low rejection buzz
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        osc.frequency.setValueAtTime(160, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
      }
    } catch {
      // AudioContext not allowed without gesture
    }
  };

  const handleSimulateScan = async (memberToScan: string) => {
    if (scanStep !== 'IDLE' && scanStep !== 'DECISION') return;
    if (autoResetTimer) clearTimeout(autoResetTimer);

    setDecision(null);

    // Step 1: Physical sensor triggered
    setScanStep('SCANNING');
    await new Promise(r => setTimeout(r, 400));

    // Step 2: Biometric template identification
    setScanStep('IDENTIFYING');
    const bioResult = await biometricService.identifyFingerprint(memberToScan);
    await new Promise(r => setTimeout(r, 400));

    // Step 3: Central Authorization Engine checks membership & policy
    setScanStep('CHECKING');
    await new Promise(r => setTimeout(r, 450));

    const authDecision = await accessAuthorizationService.authorizeAccess({
      gymId,
      memberId: bioResult.memberId,
      deviceId: 'bio-dev-01',
      source: 'KIOSK_TERMINAL',
    });

    setDecision(authDecision);
    setScanStep('DECISION');
    playChime(authDecision.allowed);

    // Reset back to idle after 6 seconds
    const timer = setTimeout(() => {
      setScanStep('IDLE');
      setDecision(null);
    }, 6000);
    setAutoResetTimer(timer);
  };

  return (
    <div className="min-h-[calc(100vh-6rem)] flex flex-col justify-between max-w-4xl mx-auto py-4 px-4 space-y-6">
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-wide">
              ENTRANCE ACCESS TERMINAL
            </h2>
            <p className="text-[11px] text-zinc-400">
              Turnstile A &bull; ProCapture Optical Reader
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg bg-zinc-900 border border-zinc-800 text-xs flex items-center gap-1.5"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-zinc-500" />}
            <span className="text-[10px] hidden sm:inline">{soundEnabled ? 'Chime ON' : 'Chime Muted'}</span>
          </button>

          <div
            className={`px-3 py-1 rounded-full text-xs font-mono font-bold flex items-center gap-1.5 border ${
              doorState === 'UNLOCKED'
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse'
                : 'bg-zinc-900 text-zinc-400 border-zinc-800'
            }`}
          >
            {doorState === 'UNLOCKED' ? <Unlock className="w-3.5 h-3.5 text-emerald-400" /> : <Lock className="w-3.5 h-3.5 text-zinc-400" />}
            <span>DOOR {doorState}</span>
          </div>
        </div>
      </div>

      {/* Main Kiosk Card */}
      <div className="relative bg-zinc-950/80 border border-zinc-800 rounded-3xl p-8 sm:p-12 shadow-2xl flex flex-col items-center justify-center text-center overflow-hidden">
        {/* Glow backdrop based on decision */}
        {decision && decision.allowed && (
          <div className="absolute inset-0 bg-emerald-500/10 blur-3xl pointer-events-none" />
        )}
        {decision && !decision.allowed && (
          <div className="absolute inset-0 bg-rose-500/10 blur-3xl pointer-events-none" />
        )}

        {/* Large Central Scanner Graphics */}
        <div className="relative my-4">
          <div
            onClick={() => handleSimulateScan(selectedMemberId)}
            className={`w-36 h-36 sm:w-44 sm:h-44 rounded-full flex items-center justify-center cursor-pointer transition-all duration-300 border-2 ${
              scanStep === 'IDLE'
                ? 'bg-zinc-900/90 border-zinc-700 hover:border-emerald-500/70 hover:shadow-lg hover:shadow-emerald-500/10'
                : scanStep === 'SCANNING' || scanStep === 'IDENTIFYING' || scanStep === 'CHECKING'
                ? 'bg-amber-500/10 border-amber-500/50 scale-105 animate-pulse'
                : decision?.allowed
                ? 'bg-emerald-500/20 border-emerald-400 scale-105 shadow-xl shadow-emerald-500/20'
                : 'bg-rose-500/20 border-rose-500 scale-105 shadow-xl shadow-rose-500/20'
            }`}
          >
            {scanStep === 'IDLE' ? (
              <Fingerprint className="w-20 h-20 sm:w-24 sm:h-24 text-zinc-400 hover:text-emerald-400 transition-colors" />
            ) : scanStep === 'SCANNING' ? (
              <div className="flex flex-col items-center">
                <Fingerprint className="w-20 h-20 text-amber-400 animate-pulse" />
              </div>
            ) : scanStep === 'IDENTIFYING' ? (
              <Sparkles className="w-16 h-16 text-amber-400 animate-spin" />
            ) : scanStep === 'CHECKING' ? (
              <ShieldCheck className="w-16 h-16 text-amber-300 animate-bounce" />
            ) : decision?.allowed ? (
              <CheckCircle2 className="w-20 h-20 text-emerald-400 animate-in zoom-in-75" />
            ) : (
              <XCircle className="w-20 h-20 text-rose-500 animate-in zoom-in-75" />
            )}
          </div>

          {/* Pulse ring animation while scanning */}
          {(scanStep === 'SCANNING' || scanStep === 'IDENTIFYING' || scanStep === 'CHECKING') && (
            <div className="absolute inset-0 rounded-full border-2 border-amber-400 animate-ping pointer-events-none" />
          )}
        </div>

        {/* State Messaging */}
        <div className="mt-4 min-h-[90px] flex flex-col items-center justify-center">
          {scanStep === 'IDLE' && (
            <>
              <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Place Finger on Scanner
              </h3>
              <p className="text-xs sm:text-sm text-zinc-400 mt-1.5 max-w-sm">
                Optical biometric turnstile is ready. Tap the scanner to simulate authentication.
              </p>
            </>
          )}

          {scanStep === 'SCANNING' && (
            <>
              <h3 className="text-xl sm:text-2xl font-bold text-amber-400 tracking-tight animate-pulse">
                SCANNING FINGERPRINT...
              </h3>
              <p className="text-xs text-zinc-400 mt-1">Reading 500 DPI ridges & minutiae...</p>
            </>
          )}

          {scanStep === 'IDENTIFYING' && (
            <>
              <h3 className="text-xl sm:text-2xl font-bold text-amber-300 tracking-tight">
                IDENTIFYING TEMPLATE...
              </h3>
              <p className="text-xs text-zinc-400 mt-1">Matching against enrolled hash tokens...</p>
            </>
          )}

          {scanStep === 'CHECKING' && (
            <>
              <h3 className="text-xl sm:text-2xl font-bold text-amber-200 tracking-tight">
                VERIFYING MEMBERSHIP & EXPIRY...
              </h3>
              <p className="text-xs text-zinc-400 mt-1">Checking subscription dates & status...</p>
            </>
          )}

          {scanStep === 'DECISION' && decision && (
            <div className="animate-in fade-in zoom-in-95">
              {decision.allowed ? (
                <>
                  <div className="inline-flex items-center gap-2 bg-emerald-500/15 text-emerald-400 px-4 py-1.5 rounded-full border border-emerald-500/30 mb-2">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="font-extrabold tracking-wider text-sm">ACCESS GRANTED</span>
                  </div>
                  <h3 className="text-2xl font-extrabold text-white">
                    Welcome, {decision.member?.fullName || 'Member'}!
                  </h3>
                  <p className="text-xs text-emerald-300 mt-1">
                    {decision.reason}
                  </p>
                  <div className="mt-2 text-[11px] font-mono text-zinc-400 flex items-center justify-center gap-3">
                    <span>Door: <strong className="text-emerald-400">UNLOCKED</strong></span>
                    <span>&bull;</span>
                    <span>Attendance: <strong className="text-emerald-400">RECORDED</strong></span>
                  </div>
                </>
              ) : (
                <>
                  <div className="inline-flex items-center gap-2 bg-rose-500/15 text-rose-400 px-4 py-1.5 rounded-full border border-rose-500/30 mb-2">
                    <XCircle className="w-4 h-4" />
                    <span className="font-extrabold tracking-wider text-sm">ACCESS DENIED</span>
                  </div>
                  <h3 className="text-2xl font-extrabold text-rose-400">
                    {decision.result.replace('DENIED_', '').replace(/_/g, ' ')}
                  </h3>
                  <p className="text-xs text-zinc-300 mt-1 max-w-md">
                    {decision.reason}
                  </p>
                  <div className="mt-2 text-[11px] font-mono text-zinc-400 flex items-center justify-center gap-3">
                    <span>Door: <strong className="text-rose-400">LOCKED</strong></span>
                    <span>&bull;</span>
                    <span>Access Attempt: <strong className="text-amber-400">LOGGED</strong></span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Simulator Hardware Control Tray */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              Kiosk Hardware Simulator Controls
            </h4>
          </div>
          <span className="text-[11px] text-zinc-400">
            Select test persona & trigger scan
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Quick Member Preset 1: Valid Active Member */}
          <button
            onClick={() => {
              setSelectedMemberId('mem-001');
              handleSimulateScan('mem-001');
            }}
            disabled={scanStep !== 'IDLE' && scanStep !== 'DECISION'}
            className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-emerald-500/50 text-left transition-all group disabled:opacity-50"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-white group-hover:text-emerald-400">
                Alex Rivera
              </span>
              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/20 font-medium">
                Active
              </span>
            </div>
            <p className="text-[11px] text-zinc-400">Valid Annual VIP (Access Granted)</p>
          </button>

          {/* Quick Member Preset 2: Expired Member */}
          <button
            onClick={() => {
              setSelectedMemberId('mem-011');
              handleSimulateScan('mem-011');
            }}
            disabled={scanStep !== 'IDLE' && scanStep !== 'DECISION'}
            className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-rose-500/50 text-left transition-all group disabled:opacity-50"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-white group-hover:text-rose-400">
                Carlos Mendez
              </span>
              <span className="text-[10px] bg-rose-500/10 text-rose-400 px-1.5 py-0.5 rounded border border-rose-500/20 font-medium">
                Expired
              </span>
            </div>
            <p className="text-[11px] text-zinc-400">Expired 2 days ago (Door Locked)</p>
          </button>

          {/* Quick Member Preset 3: Frozen Member */}
          <button
            onClick={() => {
              setSelectedMemberId('mem-016');
              handleSimulateScan('mem-016');
            }}
            disabled={scanStep !== 'IDLE' && scanStep !== 'DECISION'}
            className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-cyan-500/50 text-left transition-all group disabled:opacity-50"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-white group-hover:text-cyan-400">
                Maya Lin
              </span>
              <span className="text-[10px] bg-cyan-500/10 text-cyan-400 px-1.5 py-0.5 rounded border border-cyan-500/20 font-medium">
                Frozen
              </span>
            </div>
            <p className="text-[11px] text-zinc-400">Medical freeze (Door Locked)</p>
          </button>

          {/* Quick Preset 4: Unknown Fingerprint */}
          <button
            onClick={() => handleSimulateScan('UNKNOWN_FINGERPRINT')}
            disabled={scanStep !== 'IDLE' && scanStep !== 'DECISION'}
            className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-amber-500/50 text-left transition-all group disabled:opacity-50"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-white group-hover:text-amber-400">
                Unknown Fingerprint
              </span>
              <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded font-medium">
                Unregistered
              </span>
            </div>
            <p className="text-[11px] text-zinc-400">Non-member scan (Rejected)</p>
          </button>
        </div>

        {/* Custom Member Selector */}
        <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
          <label className="text-xs text-zinc-400 shrink-0">Or pick from all 20 members:</label>
          <select
            value={selectedMemberId}
            onChange={(e) => setSelectedMemberId(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
          >
            {members.map((m) => (
              <option key={m.memberId} value={m.memberId}>
                {m.fullName} ({m.memberId}) - Status: {m.status}
              </option>
            ))}
          </select>
          <button
            onClick={() => handleSimulateScan(selectedMemberId)}
            disabled={scanStep !== 'IDLE' && scanStep !== 'DECISION'}
            className="w-full sm:w-auto shrink-0 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs rounded-xl shadow transition-colors disabled:opacity-50"
          >
            Scan Selected Member
          </button>
        </div>
      </div>
    </div>
  );
};
