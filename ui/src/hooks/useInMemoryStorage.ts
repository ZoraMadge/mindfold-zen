import { GenericStringInMemoryStorage, GenericStringStorage } from "@/fhevm/GenericStringStorage";
import { useMemo } from "react";

export function useInMemoryStorage() {
  const storage = useMemo<GenericStringStorage>(
    () => new GenericStringInMemoryStorage(),
    []
  );

  return { storage };
}

