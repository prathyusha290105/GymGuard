import { mockDoorController } from './MockDoorController';
import { AccessControllerProvider } from './biometric.types';
import { DoorState, DeviceStatus } from '../../types';

class AccessControllerService {
  private provider: AccessControllerProvider;

  constructor(provider: AccessControllerProvider = mockDoorController) {
    this.provider = provider;
  }

  public setProvider(newProvider: AccessControllerProvider) {
    this.provider = newProvider;
  }

  public getProvider(): AccessControllerProvider {
    return this.provider;
  }

  public async getDoorStatus(): Promise<DoorState> {
    return this.provider.getDoorState();
  }

  public async getControllerStatus(): Promise<DeviceStatus> {
    return this.provider.getStatus();
  }

  public async unlockDoor(durationSeconds: number = 4): Promise<{ success: boolean; state: DoorState; message?: string }> {
    return this.provider.unlock(durationSeconds);
  }

  public async lockDoor(): Promise<{ success: boolean; state: DoorState }> {
    return this.provider.lock();
  }
}

export const accessControllerService = new AccessControllerService();
