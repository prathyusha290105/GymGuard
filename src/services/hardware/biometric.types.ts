import { DoorState, DeviceStatus } from '../../types';

export interface BiometricIdentificationResult {
  identified: boolean;
  memberId?: string;
  templateId?: string;
  confidenceScore?: number;
  error?: string;
}

export interface BiometricEnrollmentResult {
  success: boolean;
  templateId?: string;
  qualityScore?: number;
  error?: string;
}

export interface BiometricProvider {
  id: string;
  name: string;
  getStatus(): Promise<DeviceStatus>;
  identifyFingerprint(samplePayload?: string): Promise<BiometricIdentificationResult>;
  enrollFingerprint(memberId: string): Promise<BiometricEnrollmentResult>;
  removeFingerprint(memberId: string, templateId: string): Promise<boolean>;
  syncTemplates(): Promise<{ total: number; synchronized: boolean }>;
}

export interface AccessControllerProvider {
  id: string;
  name: string;
  getStatus(): Promise<DeviceStatus>;
  getDoorState(): Promise<DoorState>;
  unlock(durationSeconds: number): Promise<{ success: boolean; state: DoorState; message?: string }>;
  lock(): Promise<{ success: boolean; state: DoorState }>;
}
