// Simple in-memory storage for public keys
// For production, consider using IndexedDB

type StorageType = {
  [key: string]: {
    publicKey?: { id: string; data: Uint8Array };
    publicParams?: {
      "2048": { publicParamsId: string; publicParams: Uint8Array };
    };
  };
};

const storage: StorageType = {};

export async function publicKeyStorageGet(aclAddress: `0x${string}`): Promise<{
  publicKey?: { id: string; data: Uint8Array };
  publicParams: {
    "2048": { publicParamsId: string; publicParams: Uint8Array };
  } | null;
}> {
  const stored = storage[aclAddress.toLowerCase()];
  if (!stored) {
    return { publicParams: null };
  }
  return {
    ...(stored.publicKey && { publicKey: stored.publicKey }),
    publicParams: stored.publicParams ?? null,
  };
}

export async function publicKeyStorageSet(
  aclAddress: `0x${string}`,
  publicKey: { id: string; data: Uint8Array } | null,
  publicParams: { "2048": { publicParamsId: string; publicParams: Uint8Array } } | null
) {
  const key = aclAddress.toLowerCase();
  if (!storage[key]) {
    storage[key] = {};
  }
  if (publicKey) {
    storage[key].publicKey = publicKey;
  }
  if (publicParams) {
    storage[key].publicParams = publicParams;
  }
}

