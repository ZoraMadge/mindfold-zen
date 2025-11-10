//////////////////////////////////////////////////////////////////////////
//
// WARNING!!
// ALWAY USE DYNAMICALLY IMPORT THIS FILE TO AVOID INCLUDING THE ENTIRE 
// FHEVM MOCK LIB IN THE FINAL PRODUCTION BUNDLE!!
//
//////////////////////////////////////////////////////////////////////////

import { JsonRpcProvider } from "ethers";
import type { FhevmInstance } from "../../fhevmTypes";

export const fhevmMockCreateInstance = async (parameters: {
  rpcUrl: string;
  chainId: number;
  metadata: {
    ACLAddress: `0x${string}`;
    InputVerifierAddress: `0x${string}`;
    KMSVerifierAddress: `0x${string}`;
  };
}): Promise<FhevmInstance> => {
  // Dynamically import @fhevm/mock-utils to avoid including it in production bundle
  // This package is only available in devDependencies, so wrap in try-catch
  try {
    const { MockFhevmInstance } = await import("@fhevm/mock-utils");
    const provider = new JsonRpcProvider(parameters.rpcUrl);
    const instance = await MockFhevmInstance.create(provider, provider, {
      aclContractAddress: parameters.metadata.ACLAddress,
      chainId: parameters.chainId,
      gatewayChainId: 55815,
      inputVerifierContractAddress: parameters.metadata.InputVerifierAddress,
      kmsContractAddress: parameters.metadata.KMSVerifierAddress,
      verifyingContractAddressDecryption:
        "0x5ffdaAB0373E62E2ea2944776209aEf29E631A64",
      verifyingContractAddressInputVerification:
        "0x812b06e1CDCE800494b79fFE4f925A504a9A9810",
    });
    return instance;
  } catch (error) {
    throw new Error(
      `Failed to load @fhevm/mock-utils. This package is only available in development. Error: ${error instanceof Error ? error.message : String(error)}`
    );
  }
};

