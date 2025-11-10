"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import { useAccount, useWalletClient, usePublicClient } from "wagmi";

import { FhevmDecryptionSignature } from "@/fhevm/FhevmDecryptionSignature";
import type { FhevmInstance, DecryptedResults } from "@/fhevm/fhevmTypes";
import { MindfoldZenABI } from "@/abi/MindfoldZenABI";
import { MindfoldZenAddresses } from "@/abi/MindfoldZenAddresses";
import { useFhevm } from "@/fhevm/useFhevm";
import { useInMemoryStorage } from "./useInMemoryStorage";

type GameViewOutput = Awaited<ReturnType<ethers.Contract["getGame"]>>;

export type DecryptedGame = {
  gameId: bigint;
  moveA?: number;
  moveB?: number;
  outcome?: number;
  aWins?: boolean;
  bWins?: boolean;
  isTie?: boolean;
};

type ContractMetadata = {
  address?: `0x${string}`;
  chainName?: string;
  abi: typeof MindfoldZenABI.abi;
};

function getContractMetadata(chainId: number | undefined): ContractMetadata {
  if (!chainId) {
    return { abi: MindfoldZenABI.abi };
  }
  const entry =
    MindfoldZenAddresses[chainId.toString() as keyof typeof MindfoldZenAddresses];
  if (!entry || entry.address === ethers.ZeroAddress) {
    return { abi: MindfoldZenABI.abi, chainName: entry?.chainName };
  }
  return {
    address: entry.address as `0x${string}`,
    chainName: entry.chainName,
    abi: MindfoldZenABI.abi,
  };
}

function assertInstance(instance: FhevmInstance | undefined): asserts instance is FhevmInstance {
  if (!instance) {
    throw new Error("FHE instance is not ready yet.");
  }
}

export function useMindfoldZen() {
  const { address, chainId, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const { storage } = useInMemoryStorage();

  // Get provider from wagmi for FHEVM (needs Eip1193Provider)
  const fhevmProvider = useMemo(() => {
    if (!walletClient || !chainId) return undefined;
    return walletClient as unknown as ethers.Eip1193Provider;
  }, [walletClient, chainId]);

  // Get provider for ethers.js contract interactions
  const provider = useMemo(() => {
    if (!walletClient || !chainId) return undefined;
    return new ethers.BrowserProvider(walletClient as unknown as ethers.Eip1193Provider);
  }, [walletClient, chainId]);

  // Setup FHEVM
  const { instance, status: fhevmStatus } = useFhevm({
    provider: fhevmProvider,
    chainId: chainId ?? undefined,
    enabled: isConnected && !!chainId,
    initialMockChains: {
      31337: "http://127.0.0.1:8545",
    },
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [txHash, setTxHash] = useState<string | undefined>(undefined);

  const contractInfo = useMemo(() => {
    const info = getContractMetadata(chainId ?? undefined);
    if (chainId) {
      console.log("Contract metadata for chainId", chainId, ":", {
        address: info.address,
        chainName: info.chainName,
      });
    }
    return info;
  }, [chainId]);

  const [signer, setSigner] = useState<ethers.Signer | undefined>(undefined);

  useEffect(() => {
    if (!provider || !address) {
      setSigner(undefined);
      return;
    }
    provider.getSigner().then(setSigner).catch(() => setSigner(undefined));
  }, [provider, address]);

  const contractWithSigner = useMemo(() => {
    if (!signer || !contractInfo.address) {
      return undefined;
    }
    try {
      return new ethers.Contract(contractInfo.address, contractInfo.abi, signer);
    } catch {
      return undefined;
    }
  }, [contractInfo, signer]);

  const contractReadOnly = useMemo(() => {
    if (!publicClient || !contractInfo.address || !chainId) {
      return undefined;
    }
    try {
      const url = typeof publicClient.transport === 'object' && 'url' in publicClient.transport 
        ? publicClient.transport.url as string
        : `http://127.0.0.1:8545`;
      return new ethers.Contract(
        contractInfo.address,
        contractInfo.abi,
        new ethers.JsonRpcProvider(url)
      );
    } catch {
      return undefined;
    }
  }, [contractInfo, publicClient, chainId]);

  const ensureContractAvailable = useCallback(() => {
    if (!contractInfo.address) {
      throw new Error(
        contractInfo.chainName
          ? `MindfoldZen is not deployed on ${contractInfo.chainName}.`
          : "Contract deployment not found for the selected network.",
      );
    }
    if (!isConnected) {
      throw new Error("Connect your wallet to interact with the game.");
    }
    if (!contractWithSigner) {
      throw new Error("Signer is unavailable. Switch network or reconnect wallet.");
    }
  }, [contractInfo, isConnected, contractWithSigner]);

  const encryptMove = useCallback(
    async (move: number) => {
      assertInstance(instance);
      if (!address) {
        throw new Error("Wallet address missing.");
      }
      ensureContractAvailable();
      const input = instance.createEncryptedInput(contractInfo.address!, address);
      input.add8(move);
      return input.encrypt();
    },
    [instance, address, ensureContractAvailable, contractInfo.address],
  );

  const extractGameId = useCallback(
    (logs: readonly ethers.Log[]) => {
      if (!contractWithSigner) return undefined;
      for (const log of logs ?? []) {
        if (!log || String(log.address).toLowerCase() !== String(contractWithSigner.target).toLowerCase()) {
          continue;
        }
        try {
          const parsed = contractWithSigner.interface.parseLog(log);
          if (parsed && parsed.name === "GameCreated") {
            const value = parsed.args?.gameId ?? parsed.args?.[0];
            if (typeof value === "bigint") {
              return value;
            }
          }
        } catch {
          // ignore non-matching logs
        }
      }
      return undefined;
    },
    [contractWithSigner],
  );

  const createGame = useCallback(
    async (opponent: string, move: number) => {
      setError(undefined);
      setTxHash(undefined);
      ensureContractAvailable();
      if (!ethers.isAddress(opponent)) {
        throw new Error("Opponent address is invalid.");
      }
      if (move < 0 || move > 3) {
        throw new Error("Move must be between 0 and 3.");
      }
      const enc = await encryptMove(move);
      setIsProcessing(true);
      try {
        const tx = await contractWithSigner!.createGame(
          opponent,
          enc.handles[0],
          enc.inputProof,
        );
        setTxHash(tx.hash);
        const receipt = await tx.wait();
        const gameId = extractGameId(receipt?.logs ?? []);
        return {
          txHash: tx.hash,
          blockNumber: receipt?.blockNumber,
          gameId: gameId ?? undefined,
        };
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        setError(message);
        throw e;
      } finally {
        setIsProcessing(false);
      }
    },
    [contractWithSigner, encryptMove, ensureContractAvailable, extractGameId],
  );

  const submitMove = useCallback(
    async (gameId: bigint, move: number) => {
      setError(undefined);
      setTxHash(undefined);
      ensureContractAvailable();
      if (move < 0 || move > 3) {
        throw new Error("Move must be between 0 and 3.");
      }
      const enc = await encryptMove(move);
      setIsProcessing(true);
      try {
        const tx = await contractWithSigner!.submitMove(
          gameId,
          enc.handles[0],
          enc.inputProof,
        );
        setTxHash(tx.hash);
        const receipt = await tx.wait();
        return {
          txHash: tx.hash,
          blockNumber: receipt?.blockNumber,
          gameId: gameId ?? undefined,
        };
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        setError(message);
        throw e;
      } finally {
        setIsProcessing(false);
      }
    },
    [contractWithSigner, ensureContractAvailable, encryptMove],
  );

  const resolveGame = useCallback(
    async (gameId: bigint) => {
      setError(undefined);
      setTxHash(undefined);
      ensureContractAvailable();
      setIsProcessing(true);
      try {
        const tx = await contractWithSigner!.resolveGame(gameId);
        setTxHash(tx.hash);
        const receipt = await tx.wait();
        return {
          txHash: tx.hash,
          blockNumber: receipt?.blockNumber,
          gameId: gameId ?? undefined,
        };
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        setError(message);
        throw e;
      } finally {
        setIsProcessing(false);
      }
    },
    [contractWithSigner, ensureContractAvailable],
  );

  const requestGameDecryption = useCallback(
    async (gameId: bigint) => {
      setError(undefined);
      setTxHash(undefined);
      ensureContractAvailable();
      setIsProcessing(true);
      try {
        const tx = await contractWithSigner!.requestGameDecryption(gameId);
        setTxHash(tx.hash);
        const receipt = await tx.wait();
        return {
          txHash: tx.hash,
          blockNumber: receipt?.blockNumber,
          requestId: undefined, // Extract from logs if needed
        };
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        setError(message);
        throw e;
      } finally {
        setIsProcessing(false);
      }
    },
    [contractWithSigner, ensureContractAvailable],
  );

  const getGame = useCallback(
    async (gameId: bigint) => {
      if (!contractReadOnly) {
        throw new Error("Read provider unavailable for this network.");
      }
      return contractReadOnly.getGame(gameId) as Promise<GameViewOutput>;
    },
    [contractReadOnly],
  );

  const getPlayerGames = useCallback(
    async (player: string) => {
      if (!contractReadOnly) {
        throw new Error("Read provider unavailable for this network.");
      }
      return contractReadOnly.getPlayerGames(player) as Promise<bigint[]>;
    },
    [contractReadOnly],
  );

  const decryptGame = useCallback(
    async (gameId: bigint, game: GameViewOutput): Promise<DecryptedGame> => {
      assertInstance(instance);
      ensureContractAvailable();
      if (!signer) {
        throw new Error("Wallet signer required for decryption.");
      }
      const handles = [
        game.moveA,
        game.moveB,
        game.outcome,
        game.aWins,
        game.bWins,
        game.isTie,
      ];

      const uniqueHandles = Array.from(new Set(handles.filter((h) => h && h !== ethers.ZeroHash)));
      if (uniqueHandles.length === 0) {
        return { gameId };
      }

      const signature = await FhevmDecryptionSignature.loadOrSign(
        instance,
        [contractInfo.address!],
        signer,
        storage,
      );

      if (!signature) {
        throw new Error("Unable to sign decryption request.");
      }

      const response: DecryptedResults = await instance.userDecrypt(
        uniqueHandles.map((handle) => ({ handle, contractAddress: contractInfo.address! })),
        signature.privateKey,
        signature.publicKey,
        signature.signature,
        signature.contractAddresses,
        signature.userAddress,
        signature.startTimestamp,
        signature.durationDays,
      );

      const getValue = (handle: string) => {
        if (!handle || handle === ethers.ZeroHash) return undefined;
        const result = response[handle];
        return result !== undefined ? result : undefined;
      };

      return {
        gameId,
        moveA: getValue(game.moveA) !== undefined ? Number(getValue(game.moveA)) : undefined,
        moveB: getValue(game.moveB) !== undefined ? Number(getValue(game.moveB)) : undefined,
        outcome:
          getValue(game.outcome) !== undefined ? Number(getValue(game.outcome)) : undefined,
        aWins: getValue(game.aWins) !== undefined ? Boolean(getValue(game.aWins)) : undefined,
        bWins: getValue(game.bWins) !== undefined ? Boolean(getValue(game.bWins)) : undefined,
        isTie: getValue(game.isTie) !== undefined ? Boolean(getValue(game.isTie)) : undefined,
      };
    },
    [instance, ensureContractAvailable, signer, storage, contractInfo.address],
  );

  return {
    contractAddress: contractInfo.address,
    chainName: contractInfo.chainName,
    isConnected,
    isProcessing,
    fhevmReady: fhevmStatus === "ready",
    error,
    txHash,
    createGame,
    submitMove,
    resolveGame,
    requestGameDecryption,
    getGame,
    getPlayerGames,
    decryptGame,
  };
}

