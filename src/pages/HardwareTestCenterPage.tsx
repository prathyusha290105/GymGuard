import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Lock,
  Unlock,
  Radio,
  Fingerprint,
  CheckCircle2,
  XCircle,
  AlertOctagon,
  RefreshCw,
  Terminal,
  Activity,
  Trash2,
} from 'lucide-react';
import { mockBiometricDevice } from '../services/hardware/MockBiometricDevice';
import { mockDoorController } from '../services/hardware/MockDoorController';
import { accessAuthorizationService } from '../services/access/accessAuthorizationService';
import { DeviceStatus, DoorState } from '../types';
import { useAuth } from '../context/AuthContext';

interface EventLogEntry {
  id: string;
  time: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'door';
}

export const HardwareTestCenterPage: React.FC = () => {
  const { currentGym } = useAuth();
  const gymId = currentGym?.gymId || 'gym-01';

  const [bioStatus, setBioStatus] = useState<DeviceStatus>('ONLINE');
  const [doorCtrlStatus, setDoorCtrlStatus] = useState<DeviceStatus>('ONLINE');
  const [doorState, setDoorState] = useState<DoorState>('LOCKED');
  const [eventLogs, setEventLogs] = useState<EventLogEntry[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    // Initial status fetch and subscriptions
    const fetchStatus = async () => {
      setBioStatus(await mockBiometricDevice.getStatus());
      setDoorCtrlStatus(await mockDoorController.getStatus());
      setDoorState(await mockDoorController.getDoorState());
    };
    fetchStatus();

    const unsubDoor = mockDoorController.subscribeState((st) => {
      setDoorState(st);
      if (st === 'UNLOCKED') {
        addLog('Door unlocked (Magnetic relay released)', 'door');
      } else if (st === 'LOCKED') {
        addLog('Door locked (Magnetic relay engaged)', 'info');
      } else if (st === 'UNLOCKING') {
        addLog('Relay tripping to open...', 'info');
      }
    });

    // Add initial log
    addLog('Hardware test environment initialized and linked to Cloud Firestore.', 'info');

    return () => unsubDoor();
  }, []);

  const addLog = (message: string, type: EventLogEntry['type'] = 'info') => {
    const now = new Date();
    const time = now.toTimeString().split(' ')[0]; // HH:MM:SS
    setEventLogs((prev) => [
      { id: `${Date.now()}-${Math.random()}`, time, message, type },
      ...prev.slice(0, 99),
    ]);
  };

  const runTestScenario = async (
    scenarioTitle: string,
    memberId: string | undefined,
    options?: { expectDeny?: boolean; offlineDevice?: boolean; offlineDoor?: boolean }
  ) => {
    if (isRunning) return;
    setIsRunning(true);

    addLog(`--- START TEST: ${scenarioTitle} ---`, 'info');

    // 1. Biometric Scanner Event
    addLog('Fingerprint detected on scanner glass', 'info');
    await new Promise((r) => setTimeout(r, 350));

    // Handle offline simulator
    if (options?.offlineDevice) {
      mockBiometricDevice.setOnline(false);
      setBioStatus('OFFLINE');
      addLog('DEVICE ERROR: Scanner hardware is OFFLINE or TCP/IP socket timed out.', 'error');
      addLog('ACCESS DENIED: Hardware communication failure.', 'error');
      addLog(`Door remains LOCKED.`, 'warning');
      setIsRunning(false);
      return;
    }

    if (options?.offlineDoor) {
      mockDoorController.setOnline(false);
      setDoorCtrlStatus('OFFLINE');
      addLog('CONTROLLER ERROR: Door magnetic relay is OFFLINE.', 'error');
      addLog('ACCESS DENIED: Door controller unavailable.', 'error');
      setIsRunning(false);
      return;
    }

    // 2. Identify template
    const bioIdResult = await mockBiometricDevice.identifyFingerprint(memberId);
    if (!bioIdResult.identified) {
      addLog(`Identification failure: ${bioIdResult.error}`, 'error');
      addLog('ACCESS DENIED: Unknown fingerprint.', 'error');
      addLog('Door remains LOCKED.', 'warning');
      addLog('Access attempt logged to security audit.', 'info');
      setIsRunning(false);
      return;
    }

    addLog(`Member identified: ID ${bioIdResult.memberId} (Confidence: ${bioIdResult.confidenceScore}%)`, 'info');
    await new Promise((r) => setTimeout(r, 350));

    // 3. Central Authorization Service
    const decision = await accessAuthorizationService.authorizeAccess({
      gymId,
      memberId: bioIdResult.memberId,
      deviceId: 'bio-dev-01',
      source: 'HARDWARE_TEST_CENTER',
    });

    addLog(`Membership status evaluation: ${decision.membership?.status || 'NO ACTIVE PLAN'}`, 'info');
    await new Promise((r) => setTimeout(r, 300));

    if (decision.allowed) {
      addLog(`ACCESS GRANTED: ${decision.reason}`, 'success');
      addLog(`Door unlocked (Relay held for 4s)`, 'door');
      if (decision.attendanceRecorded) {
        addLog('Attendance recorded in Firestore', 'success');
      }
    } else {
      addLog(`ACCESS DENIED: ${decision.result}`, 'error');
      addLog(`Reason: ${decision.reason}`, 'error');
      addLog('Door remains LOCKED.', 'warning');
      addLog('Failed access logged to Firestore accessLogs', 'info');
    }

    addLog(`--- END TEST: ${scenarioTitle} ---`, 'info');
    setIsRunning(false);
  };

  const toggleDeviceOnline = async () => {
    const next = bioStatus === 'ONLINE' ? 'OFFLINE' : 'ONLINE';
    mockBiometricDevice.setOnline(next === 'ONLINE');
    setBioStatus(next);
    addLog(`Biometric Scanner switched to ${next}`, next === 'ONLINE' ? 'success' : 'warning');
  };

  const toggleDoorOnline = async () => {
    const next = doorCtrlStatus === 'ONLINE' ? 'OFFLINE' : 'ONLINE';
    mockDoorController.setOnline(next === 'ONLINE');
    setDoorCtrlStatus(next);
    addLog(`Door Controller switched to ${next}`, next === 'ONLINE' ? 'success' : 'warning');
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900 border border-zinc-800 p-5 rounded-2xl">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Hardware Test Center
            </h1>
            <span className="bg-emerald-500/10 text-emerald-400 text-xs px-2 py-0.5 rounded-full border border-emerald-500/20 font-medium">
              Simulation Engine
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Simulate real biometric hardware scans, relay tripping, and server-side policy enforcement.
          </p>
        </div>

        <button
          onClick={() => setEventLogs([])}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-750 text-zinc-300 text-xs rounded-xl border border-zinc-700 transition-colors self-start sm:self-auto"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Clear Stream
        </button>
      </div>

      {/* Hardware Status Display Cards (Section 19: Biometric Device, Door Controller, Door) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* 1. Biometric Device */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border ${
              bioStatus === 'ONLINE'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
            }`}>
              <Fingerprint className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-zinc-400 uppercase">Biometric Device</p>
              <p className="text-sm font-bold text-white">Status: {bioStatus}</p>
            </div>
          </div>
          <button
            onClick={toggleDeviceOnline}
            className="text-[10px] font-mono px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition-colors"
          >
            Toggle
          </button>
        </div>

        {/* 2. Door Controller */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border ${
              doorCtrlStatus === 'ONLINE'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
            }`}>
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-zinc-400 uppercase">Door Controller</p>
              <p className="text-sm font-bold text-white">Status: {doorCtrlStatus}</p>
            </div>
          </div>
          <button
            onClick={toggleDoorOnline}
            className="text-[10px] font-mono px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition-colors"
          >
            Toggle
          </button>
        </div>

        {/* 3. Physical Door State */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border ${
              doorState === 'UNLOCKED'
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse'
                : doorState === 'UNLOCKING'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                : 'bg-zinc-800 text-zinc-400 border-zinc-700'
            }`}>
              {doorState === 'UNLOCKED' ? (
                <Unlock className="w-5 h-5 text-emerald-400" />
              ) : (
                <Lock className="w-5 h-5" />
              )}
            </div>
            <div>
              <p className="text-[11px] font-semibold text-zinc-400 uppercase">Physical Door</p>
              <p className={`text-sm font-bold ${doorState === 'UNLOCKED' ? 'text-emerald-400' : 'text-white'}`}>
                Status: {doorState}
              </p>
            </div>
          </div>
          {doorState === 'UNLOCKED' && (
            <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-300 px-2 py-1 rounded border border-emerald-500/30 animate-pulse">
              RELAY OPEN
            </span>
          )}
        </div>
      </div>

      {/* Main Split: Test Buttons & Live Terminal Event Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Interactive Test Buttons (Section 19 mandatory buttons) */}
        <div className="lg:col-span-5 bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-zinc-800">
            <Activity className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Simulation Action Triggers
            </h3>
          </div>

          <div className="space-y-2">
            {/* 1. VALID MEMBER */}
            <button
              onClick={() => runTestScenario('VALID ACTIVE MEMBER', 'mem-001')}
              disabled={isRunning}
              className="w-full p-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-left transition-all group disabled:opacity-50"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400">
                  SIMULATE VALID MEMBER
                </span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-[11px] text-zinc-400 mt-1">
                Alex Rivera &bull; Active membership &bull; Expects: DOOR UNLOCKED & ATTENDANCE
              </p>
            </button>

            {/* 2. EXPIRED MEMBER */}
            <button
              onClick={() => runTestScenario('EXPIRED MEMBER', 'mem-011', { expectDeny: true })}
              disabled={isRunning}
              className="w-full p-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-left transition-all group disabled:opacity-50"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-rose-400">
                  SIMULATE EXPIRED MEMBER
                </span>
                <XCircle className="w-4 h-4 text-rose-400" />
              </div>
              <p className="text-[11px] text-zinc-400 mt-1">
                Carlos Mendez &bull; Expired subscription &bull; Expects: DENIED & DOOR LOCKED
              </p>
            </button>

            {/* 3. FROZEN MEMBER */}
            <button
              onClick={() => runTestScenario('FROZEN MEMBER', 'mem-016', { expectDeny: true })}
              disabled={isRunning}
              className="w-full p-3 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-left transition-all group disabled:opacity-50"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-cyan-400">
                  SIMULATE FROZEN MEMBER
                </span>
                <Lock className="w-4 h-4 text-cyan-400" />
              </div>
              <p className="text-[11px] text-zinc-400 mt-1">
                Maya Lin &bull; Medical freeze &bull; Expects: DENIED & DOOR LOCKED
              </p>
            </button>

            {/* 4. SUSPENDED MEMBER */}
            <button
              onClick={() => runTestScenario('SUSPENDED MEMBER', 'mem-018', { expectDeny: true })}
              disabled={isRunning}
              className="w-full p-3 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-left transition-all group disabled:opacity-50"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-purple-400">
                  SIMULATE SUSPENDED MEMBER
                </span>
                <AlertOctagon className="w-4 h-4 text-purple-400" />
              </div>
              <p className="text-[11px] text-zinc-400 mt-1">
                Brandon Cole &bull; Suspended account &bull; Expects: DENIED & DOOR LOCKED
              </p>
            </button>

            {/* 5. UNKNOWN FINGERPRINT */}
            <button
              onClick={() => runTestScenario('UNKNOWN FINGERPRINT', 'UNKNOWN_FINGERPRINT', { expectDeny: true })}
              disabled={isRunning}
              className="w-full p-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-left transition-all group disabled:opacity-50"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-400">
                  SIMULATE UNKNOWN FINGERPRINT
                </span>
                <Fingerprint className="w-4 h-4 text-amber-400" />
              </div>
              <p className="text-[11px] text-zinc-400 mt-1">
                Unregistered print &bull; Template match fails &bull; Expects: DENIED
              </p>
            </button>

            {/* 6. DEVICE OFFLINE */}
            <button
              onClick={() => runTestScenario('DEVICE OFFLINE SIMULATION', 'mem-001', { offlineDevice: true })}
              disabled={isRunning}
              className="w-full p-3 rounded-xl bg-zinc-800/80 hover:bg-zinc-800 border border-zinc-700 text-left transition-all group disabled:opacity-50"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-300">
                  SIMULATE DEVICE OFFLINE
                </span>
                <Radio className="w-4 h-4 text-zinc-400" />
              </div>
              <p className="text-[11px] text-zinc-400 mt-1">
                Sensor disconnected &bull; Timeout error &bull; Expects: DEVICE_ERROR
              </p>
            </button>

            {/* 7. DOOR OFFLINE */}
            <button
              onClick={() => runTestScenario('DOOR OFFLINE SIMULATION', 'mem-001', { offlineDoor: true })}
              disabled={isRunning}
              className="w-full p-3 rounded-xl bg-zinc-800/80 hover:bg-zinc-800 border border-zinc-700 text-left transition-all group disabled:opacity-50"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-300">
                  SIMULATE DOOR OFFLINE
                </span>
                <Lock className="w-4 h-4 text-zinc-400" />
              </div>
              <p className="text-[11px] text-zinc-400 mt-1">
                Relay controller offline &bull; Failsafe secured &bull; Expects: ERROR
              </p>
            </button>
          </div>
        </div>

        {/* Right: Live Terminal Event Stream (Section 19: Live event stream) */}
        <div className="lg:col-span-7 bg-zinc-950 border border-zinc-800 rounded-2xl p-5 flex flex-col justify-between font-mono shadow-inner min-h-[480px]">
          <div>
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <span className="text-white font-bold uppercase tracking-wider">
                  Live Event Stream
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping ml-1" />
              </div>
              <span className="text-[10px] text-zinc-500">Auto-scrolling stream</span>
            </div>

            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
              {eventLogs.length === 0 ? (
                <p className="text-xs text-zinc-600 py-10 text-center">
                  Awaiting biometric triggers... Click any simulation button on the left.
                </p>
              ) : (
                eventLogs.map((log) => (
                  <div
                    key={log.id}
                    className={`text-xs p-2 rounded flex items-start gap-3 border ${
                      log.type === 'success'
                        ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                        : log.type === 'error'
                        ? 'bg-rose-500/10 text-rose-300 border-rose-500/20'
                        : log.type === 'warning'
                        ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                        : log.type === 'door'
                        ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40 font-bold'
                        : 'bg-zinc-900/60 text-zinc-400 border-zinc-850'
                    }`}
                  >
                    <span className="text-[10px] text-zinc-500 shrink-0 font-mono mt-0.5">
                      {log.time}
                    </span>
                    <span className="leading-snug">{log.message}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-zinc-850 text-[11px] text-zinc-500 flex items-center justify-between">
            <span>Hardware Model: ZKTeco ProCapture Optical</span>
            <span>Relay: Wiegand 12V Pulse</span>
          </div>
        </div>
      </div>
    </div>
  );
};
