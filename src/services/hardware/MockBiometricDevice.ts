import { DeviceStatus } from '../../types';
import { BiometricProvider, BiometricIdentificationResult, BiometricEnrollmentResult } from './biometric.types';

export class MockBiometricDevice implements BiometricProvider {
  public id: string = 'bio-dev-01';
  public name: string = 'ZKTeco ProCapture-T Simulator (Optical 500 DPI)';
  private isOnline: boolean = true;
  private enrolledTemplates: Map<string, string> = new Map(); // memberId -> templateToken

  constructor() {
    // Initial seeded templates for demo members will be registered on seed
  }

  public setOnline(status: boolean): void {
    this.isOnline = status;
  }

  public async getStatus(): Promise<DeviceStatus> {
    return this.isOnline ? 'ONLINE' : 'OFFLINE';
  }

  public registerTemplate(memberId: string, templateId: string): void {
    this.enrolledTemplates.set(memberId, templateId);
  }

  public unregisterTemplate(memberId: string): void {
    this.enrolledTemplates.delete(memberId);
  }

  public async identifyFingerprint(samplePayload?: string): Promise<BiometricIdentificationResult> {
    if (!this.isOnline) {
      return {
        identified: false,
        error: 'Biometric hardware sensor is OFFLINE or unreachable over TCP/IP.'
      };
    }

    if (!samplePayload || samplePayload === 'UNKNOWN_FINGERPRINT') {
      return {
        identified: false,
        error: 'Fingerprint pattern not matched in local device template database.'
      };
    }

    // In simulation mode, samplePayload is the memberId or templateId
    if (this.enrolledTemplates.has(samplePayload)) {
      return {
        identified: true,
        memberId: samplePayload,
        templateId: this.enrolledTemplates.get(samplePayload),
        confidenceScore: 98.7
      };
    }

    return {
      identified: true,
      memberId: samplePayload,
      templateId: `TMPL_${samplePayload.slice(0, 8)}`,
      confidenceScore: 97.5
    };
  }

  public async enrollFingerprint(memberId: string): Promise<BiometricEnrollmentResult> {
    if (!this.isOnline) {
      return {
        success: false,
        error: 'Cannot enroll: Biometric scanner hardware is OFFLINE.'
      };
    }

    // Generate safe cryptographically structured template reference ID (No raw image stored)
    const templateId = `BIO_HASH_${Math.random().toString(36).substring(2, 10).toUpperCase()}_${Date.now().toString().slice(-4)}`;
    this.enrolledTemplates.set(memberId, templateId);

    return {
      success: true,
      templateId,
      qualityScore: 94.0
    };
  }

  public async removeFingerprint(memberId: string): Promise<boolean> {
    this.enrolledTemplates.delete(memberId);
    return true;
  }

  public async syncTemplates(): Promise<{ total: number; synchronized: boolean }> {
    return {
      total: this.enrolledTemplates.size,
      synchronized: true
    };
  }
}

export const mockBiometricDevice = new MockBiometricDevice();
