import { mockBiometricDevice } from './MockBiometricDevice';
import { BiometricProvider, BiometricIdentificationResult, BiometricEnrollmentResult } from './biometric.types';
import { DeviceStatus } from '../../types';

class BiometricService {
  private provider: BiometricProvider;

  constructor(provider: BiometricProvider = mockBiometricDevice) {
    this.provider = provider;
  }

  public setProvider(newProvider: BiometricProvider) {
    this.provider = newProvider;
  }

  public getProvider(): BiometricProvider {
    return this.provider;
  }

  public async getDeviceStatus(): Promise<DeviceStatus> {
    return this.provider.getStatus();
  }

  public async identifyFingerprint(samplePayload?: string): Promise<BiometricIdentificationResult> {
    return this.provider.identifyFingerprint(samplePayload);
  }

  public async enrollMemberFingerprint(memberId: string): Promise<BiometricEnrollmentResult> {
    return this.provider.enrollFingerprint(memberId);
  }

  public async removeMemberFingerprint(memberId: string, templateId: string): Promise<boolean> {
    return this.provider.removeFingerprint(memberId, templateId);
  }

  public async syncDevice(): Promise<{ total: number; synchronized: boolean }> {
    return this.provider.syncTemplates();
  }
}

export const biometricService = new BiometricService();
