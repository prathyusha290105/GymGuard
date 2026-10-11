import { DoorState, DeviceStatus } from '../../types';
import { AccessControllerProvider } from './biometric.types';

type StateListener = (state: DoorState) => void;

export class MockDoorController implements AccessControllerProvider {
  public id: string = 'door-ctrl-01';
  public name: string = 'Wiegand MagLock Controller (IP Relays 12V DC)';
  private currentState: DoorState = 'LOCKED';
  private isOnline: boolean = true;
  private listeners: Set<StateListener> = new Set();
  private unlockTimer: NodeJS.Timeout | null = null;

  public setOnline(status: boolean): void {
    this.isOnline = status;
    if (!status) {
      this.notifyState('OFFLINE');
    } else {
      this.notifyState('LOCKED');
    }
  }

  public setSimulatedError(hasError: boolean): void {
    if (hasError) {
      this.notifyState('ERROR');
    } else {
      this.notifyState(this.isOnline ? 'LOCKED' : 'OFFLINE');
    }
  }

  public subscribeState(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener(this.currentState);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyState(state: DoorState): void {
    this.currentState = state;
    this.listeners.forEach(fn => fn(state));
  }

  public async getStatus(): Promise<DeviceStatus> {
    if (!this.isOnline) return 'OFFLINE';
    if (this.currentState === 'ERROR') return 'ERROR';
    return 'ONLINE';
  }

  public async getDoorState(): Promise<DoorState> {
    return this.currentState;
  }

  public async unlock(durationSeconds: number = 4): Promise<{ success: boolean; state: DoorState; message?: string }> {
    if (!this.isOnline) {
      this.notifyState('OFFLINE');
      return {
        success: false,
        state: 'OFFLINE',
        message: 'Relay command failed: Door Controller is OFFLINE.'
      };
    }

    if (this.currentState === 'ERROR') {
      return {
        success: false,
        state: 'ERROR',
        message: 'Relay command failed: Hardware relay controller is in ERROR state.'
      };
    }

    if (this.unlockTimer) {
      clearTimeout(this.unlockTimer);
    }

    // Step 1: UNLOCKING relay trip
    this.notifyState('UNLOCKING');

    await new Promise(res => setTimeout(res, 250));
    // Step 2: UNLOCKED
    this.notifyState('UNLOCKED');

    // Automatically re-lock after duration
    this.unlockTimer = setTimeout(() => {
      this.notifyState('LOCKED');
      this.unlockTimer = null;
    }, durationSeconds * 1000);

    return {
      success: true,
      state: 'UNLOCKED',
      message: `Magnetic lock released for ${durationSeconds} seconds.`
    };
  }

  public async lock(): Promise<{ success: boolean; state: DoorState }> {
    if (this.unlockTimer) {
      clearTimeout(this.unlockTimer);
      this.unlockTimer = null;
    }
    this.notifyState(this.isOnline ? 'LOCKED' : 'OFFLINE');
    return { success: true, state: this.currentState };
  }
}

export const mockDoorController = new MockDoorController();
