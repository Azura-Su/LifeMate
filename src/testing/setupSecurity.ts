jest.mock('expo-secure-store', () => {
  const items = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (key: string) => items.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      items.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      items.delete(key);
    }),
    WHEN_UNLOCKED: 'WHEN_UNLOCKED',
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
  };
});
jest.mock('expo-crypto', () => {
  const encodeBase64 = (value: string) => {
    const bytes = new TextEncoder().encode(value);
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  };
  const decodeBase64 = (value: string) => {
    const binary = atob(value);
    return new TextDecoder().decode(
      Uint8Array.from(binary, (character) => character.charCodeAt(0)),
    );
  };
  class EncryptionKey {
    private readonly mockValue: string;
    constructor(mockValue: string) {
      this.mockValue = mockValue;
    }
    static async generate() {
      return new EncryptionKey('test-encryption-key');
    }
    static async import(mockEncodedValue: string) {
      return new EncryptionKey(mockEncodedValue);
    }
    async encoded() {
      return this.mockValue;
    }
  }
  class SealedData {
    private readonly mockPayload: string;
    constructor(mockPayload: string) {
      this.mockPayload = mockPayload;
    }
    static fromCombined(mockCombined: string) {
      return new SealedData(mockCombined);
    }
    async combined() {
      return this.mockPayload;
    }
  }
  return {
    AESEncryptionKey: EncryptionKey,
    AESSealedData: SealedData,
    CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
    aesEncryptAsync: jest.fn(
      async (
        plaintext: Uint8Array,
        key: { mockValue: string },
        options: { additionalData: Uint8Array },
      ) => {
        return new SealedData(
          encodeBase64(
            JSON.stringify({
              bytes: Array.from(plaintext),
              key: key.mockValue,
              aad: Array.from(options.additionalData),
            }),
          ),
        );
      },
    ),
    aesDecryptAsync: jest.fn(
      async (
        sealed: { mockPayload: string },
        key: { mockValue: string },
        options: { additionalData: Uint8Array },
      ) => {
        const value = JSON.parse(decodeBase64(sealed.mockPayload));
        if (
          value.key !== key.mockValue ||
          JSON.stringify(value.aad) !==
            JSON.stringify(Array.from(options.additionalData))
        )
          throw new Error('Authentication failed');
        return Uint8Array.from(value.bytes);
      },
    ),
    digestStringAsync: jest.fn(async (_algorithm: string, value: string) =>
      encodeBase64(value),
    ),
    randomUUID: jest.fn(() => `test-${Math.random().toString(36).slice(2)}`),
  };
});
jest.mock('expo-local-authentication', () => ({
  AuthenticationType: { FINGERPRINT: 1, FACIAL_RECOGNITION: 2, IRIS: 3 },
  SecurityLevel: { NONE: 0, SECRET: 1, BIOMETRIC_WEAK: 2, BIOMETRIC_STRONG: 3 },
  supportedAuthenticationTypesAsync: jest.fn().mockResolvedValue([2]),
  getEnrolledLevelAsync: jest.fn().mockResolvedValue(3),
  authenticateAsync: jest.fn().mockResolvedValue({ success: true }),
}));
jest.mock('expo-screen-capture', () => ({
  usePreventScreenCapture: jest.fn(),
}));
// Native audio module is unavailable in Jest. Suites that exercise playback
// declare their own richer mock, which replaces this default.
jest.mock('expo-audio', () => ({
  setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
  useAudioPlayer: jest.fn(() => ({
    addListener: jest.fn(() => ({ remove: jest.fn() })),
    play: jest.fn(),
    pause: jest.fn(),
    replace: jest.fn(),
    seekTo: jest.fn().mockResolvedValue(undefined),
  })),
  useAudioPlayerStatus: jest.fn(() => ({
    playing: false,
    isLoaded: false,
    currentTime: 0,
    duration: 0,
  })),
}));
