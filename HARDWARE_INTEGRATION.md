# GYMGUARD: Physical Hardware Integration Guide

## 1. Overview & Architecture

GymGuard connects to physical biometric turnstiles, optical fingerprint readers, and electronic door controllers using a **Hardware Abstraction Layer (HAL)**. 

Business logic (membership validity, expiration, freeze states, suspensions) is completely separated from hardware drivers. Upgrading or changing physical scanner vendors (e.g., ZKTeco, Suprema, HID, Hikvision, or custom ESP32/Raspberry Pi microcontrollers) requires only writing a driver adapter that satisfies `BiometricProvider` or `AccessControllerProvider`.

---

## 2. Security & Privacy Constraints

1. **NO RAW BIOMETRIC IMAGES:** Raw fingerprint images (BMP/JPEG) must NEVER be transmitted or stored on the cloud server or database.
2. **CRYPTOGRAPHIC TEMPLATE HASHES:** The reader firmware extracts irreversible minutiae vectors (ANSI/INCITS 378 or ISO/IEC 19794-2) and generates a one-way token reference (`BIO_HASH_...`).
3. **CENTRALIZED DECISION AUTHORITY:** Physical devices must NEVER decide whether to open a door autonomously. The reader queries the central `AccessAuthorizationService`. Only when `ACCESS_GRANTED` is returned does the controller release the magnetic lock.

---

## 3. How to Connect a Physical Fingerprint Scanner

### Step 1: Network Configuration
- Assign the physical reader a static IPv4 address on the gym's secure IoT VLAN (e.g., `192.168.1.101`).
- Port: Default TCP 4370 (ZKTeco standalone protocol) or HTTPS REST webhook.

### Step 2: Implement the `BiometricProvider` Adapter

```typescript
import { BiometricProvider, BiometricIdentificationResult, BiometricEnrollmentResult } from './biometric.types';

export class PhysicalZKTecoAdapter implements BiometricProvider {
  id = 'zk-turnstile-01';
  name = 'ZKTeco ProCapture-T';

  async getStatus() {
    // Ping device TCP port 4370
    return isReachable('192.168.1.101', 4370) ? 'ONLINE' : 'OFFLINE';
  }

  async enrollFingerprint(memberId: string): Promise<BiometricEnrollmentResult> {
    // 1. Send CMD_STARTENROLL over socket to physical terminal
    // 2. Hardware prompts user to place finger 3 times
    // 3. Firmware returns template vector hash
    // 4. Return token reference to backend
    return {
      success: true,
      templateId: 'BIO_HASH_78F3A921',
      qualityScore: 96,
    };
  }

  async identifyFingerprint(samplePayload?: string): Promise<BiometricIdentificationResult> {
    // Reader sends template match event or pushes scanned minutiae
    return {
      identified: true,
      memberId: 'mem-001',
      confidenceScore: 98.4,
    };
  }

  async removeFingerprint(memberId: string, templateId: string) {
    // Issue CMD_DELETE_USER on device memory
    return true;
  }

  async syncTemplates() {
    // Push active member templates to reader local flash
    return { total: 20, synchronized: true };
  }
}
```

---

## 4. How to Connect a Physical Door Controller

Electronic magnetic door locks (MagLocks, Drop Bolts, Motorized Turnstiles) are driven by Wiegand 26/34 relays or IP-controlled dry contact relays.

### Wiring & Relay Operation
- **Fail-Secure vs Fail-Safe:** Fire-safety code mandates Fail-Safe (magnetic lock releases upon building power loss).
- **Trigger Duration:** When `AccessAuthorizationService` returns `ACCESS_GRANTED`, send a pulse command:
  ```json
  POST http://192.168.1.102/api/relay/pulse
  {
    "relayIndex": 1,
    "durationMs": 4000
  }
  ```
- **Relay State Verification:** Confirm status transition from `LOCKED` -> `UNLOCKING` -> `UNLOCKED` -> `LOCKED`.

---

## 5. Offline Handling & Failsafe Policies

If the internet connection or local switch fails:
1. Devices report `OFFLINE` status immediately to the health dashboard.
2. The authorization engine denies turnstile entry with `DEVICE_ERROR`.
3. In physical emergencies, break-glass units and manual keys override electronic relays independently of the software stack.
