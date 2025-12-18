import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, Unlock, Swords, Shield, Target, Zap, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { useAccount } from 'wagmi';
import { useMindfoldZen } from "@/hooks/useMindfoldZen";
import { ethers } from "ethers";

type Move = "attack-north" | "attack-south" | "defend-north" | "defend-south";
type GamePhase = "idle" | "creating" | "waiting-opponent" | "selecting" | "committed" | "waiting-resolution" | "resolved";

const moves = [
  { id: "attack-north" as Move, label: "Attack North", icon: Swords, color: "primary", value: 0 },
  { id: "attack-south" as Move, label: "Attack South", icon: Target, color: "primary", value: 1 },
  { id: "defend-north" as Move, label: "Defend North", icon: Shield, color: "secondary", value: 2 },
  { id: "defend-south" as Move, label: "Defend South", icon: Zap, color: "secondary", value: 3 },
];

const GameArena = () => {
  const { isConnected, address } = useAccount();
  const {
    contractAddress,
    chainName,
    isConnected: contractConnected,
    isProcessing,
    fhevmReady,
    error,
    txHash,
    createGame,
    submitMove,
    resolveGame,
    requestGameDecryption,
    getGame,
    getPlayerGames,
    decryptGame,
  } = useMindfoldZen();

  const [gamePhase, setGamePhase] = useState<GamePhase>("idle");
  const [selectedMove, setSelectedMove] = useState<Move | null>(null);
  const [playerMove, setPlayerMove] = useState<Move | null>(null);
  const [opponentMove, setOpponentMove] = useState<Move | null>(null);
  const [currentGameId, setCurrentGameId] = useState<bigint | null>(null);
  const [opponentAddress, setOpponentAddress] = useState("");
  const [gameIdInput, setGameIdInput] = useState("");
  const [gameStatus, setGameStatus] = useState<any>(null);
  const [decryptedResult, setDecryptedResult] = useState<any>(null);
  const [isLoadingGame, setIsLoadingGame] = useState(false);

  // Enhanced loading state management
  const isGameLoading = isProcessing || isLoadingGame || fhevmReady === false;

  useEffect(() => {
    if (error) {
      toast.error("Transaction failed", {
        description: error,
      });
      // Reset processing state on error
      setGamePhase("idle");
    }
    if (txHash) {
      toast.success("Transaction submitted", {
        description: `Tx: ${txHash.slice(0, 10)}...`,
      });
    }
  }, [error, txHash]);

  useEffect(() => {
    if (!isConnected || !fhevmReady) {
      setGamePhase("idle");
      return;
    }
  }, [isConnected, fhevmReady, contractAddress, chainName]);

  useEffect(() => {
    const saved = localStorage.getItem('gameState');
    if (saved) {
      try {
        const state = JSON.parse(saved);
        setGamePhase(state.gamePhase || "idle");
        setSelectedMove(state.selectedMove || null);
        setPlayerMove(state.playerMove || null);
        setOpponentMove(state.opponentMove || null);
        setCurrentGameId(state.currentGameId ? BigInt(state.currentGameId) : null);
        setOpponentAddress(state.opponentAddress || "");
        setGameIdInput(state.gameIdInput || "");
      } catch (e) {
        console.error("Failed to load game state:", e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('gameState', JSON.stringify({
      gamePhase,
      selectedMove,
      playerMove,
      opponentMove,
      currentGameId: currentGameId?.toString(),
      opponentAddress,
      gameIdInput,
    }));
  }, [gamePhase, selectedMove, playerMove, opponentMove, currentGameId, opponentAddress, gameIdInput]);

  const pollGameStatus = async (gameId: bigint) => {
    if (!gameId) return;
    try {
      const game = await getGame(gameId);
      setGameStatus(game);
      
      // Check if game is cancelled
      if (game.status === 3) {
        setGamePhase("idle");
        setTimeout(() => {
          toast.error("Game was cancelled");
        }, 0);
        return;
      }
      
      // Check if both moves are submitted
      if (game.moveASubmitted && game.moveBSubmitted && !game.outcomeReady) {
        setGamePhase("waiting-resolution");
        // Auto-resolve if ready
        try {
          await resolveGame(gameId);
        } catch (e) {
          // Ignore if already resolved or not ready
          console.log("Resolve game error (may be expected):", e);
        }
        // Continue polling after resolve
        setTimeout(() => pollGameStatus(gameId), 3000);
      } else if (game.outcomeReady && !game.decrypted && game.status === 2) {
        // Outcome ready, stop polling - user can decrypt manually from History page
        setGamePhase("waiting-resolution");
        setTimeout(() => {
          toast.info("Game outcome ready! Check History page to decrypt result.", {
            duration: 5000,
          });
        }, 0);
        return;
      } else if (game.decrypted && game.status === 2) {
        // Game is decrypted, show results
        try {
          const decrypted = await decryptGame(gameId, game);
          setDecryptedResult(decrypted);
          if (decrypted.moveA !== undefined && decrypted.moveB !== undefined) {
            const moveA = moves.find(m => m.value === decrypted.moveA);
            const moveB = moves.find(m => m.value === decrypted.moveB);
            setPlayerMove(moveA?.id || null);
            setOpponentMove(moveB?.id || null);
            setGamePhase("resolved");
            
            // Show result using setTimeout to avoid render-phase updates
            setTimeout(() => {
              if (decrypted.aWins) {
                toast.success("Victory!", {
                  description: "You won the match!",
                });
              } else if (decrypted.bWins) {
                toast.error("Defeat", {
                  description: "Opponent won the match",
                });
              } else {
                toast.info("Draw", {
                  description: "The match ended in a tie",
                });
              }
            }, 0);
          }
        } catch (e) {
          console.error("Decryption error:", e);
        }
      } else if (game.status === 2 && game.outcomeReady) {
        // Game resolved but not decrypted yet, keep polling
        setTimeout(() => pollGameStatus(gameId), 3000);
      }
    } catch (e) {
      console.error("Failed to poll game status:", e);
    }
  };

  const handleCreateGame = async () => {
    if (!isConnected) {
      toast.error("Please connect your wallet first");
      return;
    }
    if (!opponentAddress || !ethers.isAddress(opponentAddress)) {
      toast.error("Please enter a valid opponent address");
      return;
    }
    if (!selectedMove) {
      toast.error("Please select a move first");
      return;
    }

    try {
      setGamePhase("creating");
      const moveValue = moves.find(m => m.id === selectedMove)?.value;
      if (moveValue === undefined) {
        throw new Error("Invalid move");
      }

      const result = await createGame(opponentAddress, moveValue);
      if (result.gameId) {
        setCurrentGameId(result.gameId);
        setPlayerMove(selectedMove);
        setGamePhase("waiting-opponent");
        toast.success("Game created!", {
          description: `Game ID: ${result.gameId.toString()}`,
        });
        // Start polling
        setTimeout(() => pollGameStatus(result.gameId!), 2000);
      }
    } catch (e: any) {
      console.error("Create game error:", e);
      toast.error("Failed to create game", {
        description: e.message || String(e),
      });
      setGamePhase("idle");
    }
  };

  const handleSubmitMove = async () => {
    if (!isConnected) {
      toast.error("Please connect your wallet first");
      return;
    }
    if (!currentGameId) {
      toast.error("No game found");
      return;
    }
    if (!selectedMove) {
      toast.error("Please select a move first");
      return;
    }

    try {
      setGamePhase("creating");
      const moveValue = moves.find(m => m.id === selectedMove)?.value;
      if (moveValue === undefined) {
        throw new Error("Invalid move");
      }

      await submitMove(currentGameId, moveValue);
      setPlayerMove(selectedMove);
      setGamePhase("committed");
      toast.success("Move submitted!");
      
      // Start polling
      setTimeout(() => pollGameStatus(currentGameId), 2000);
    } catch (e: any) {
      toast.error("Failed to submit move", {
        description: e.message || String(e),
      });
      setGamePhase("selecting");
    }
  };

  const handleSubmitMoveOrCreateGame = async () => {
    // If we have a currentGameId, submit move to existing game
    // Otherwise, create a new game
    if (currentGameId) {
      await handleSubmitMove();
    } else {
      await handleCreateGame();
    }
  };

  const handleJoinGameByID = async () => {
    if (!isConnected) {
      toast.error("Please connect your wallet first");
      return;
    }
    if (!fhevmReady) {
      toast.error("FHEVM not ready", {
        description: "Please wait for FHEVM to initialize",
      });
      return;
    }
    if (!contractAddress) {
      toast.error("Contract not deployed", {
        description: `Please deploy contract on ${chainName || "current network"}`,
      });
      return;
    }
    if (!gameIdInput || !gameIdInput.trim()) {
      toast.error("Please enter a game ID");
      return;
    }

    try {
      setIsLoadingGame(true);
      const gameIdBigInt = BigInt(gameIdInput.trim());
      const game = await getGame(gameIdBigInt);
      
      // Check if game exists
      if (!game || game.status === 3) { // 3 = Cancelled
        toast.error("Game not found or cancelled");
        setIsLoadingGame(false);
        return;
      }

      // Check if user is playerA or playerB
      const isPlayerA = game.playerA.toLowerCase() === address?.toLowerCase();
      const isPlayerB = game.playerB.toLowerCase() === address?.toLowerCase();
      
      if (!isPlayerA && !isPlayerB) {
        toast.error("You are not a player in this game");
        setIsLoadingGame(false);
        return;
      }

      // Set game info
      setCurrentGameId(gameIdBigInt);
      setGameStatus(game);
      setOpponentAddress(isPlayerA ? game.playerB : game.playerA);

      // Check game status and transition accordingly
      if (game.status === 2) { // Resolved
        toast.info("Game already resolved");
        setGamePhase("resolved");
        // Try to decrypt if both moves submitted
        if (game.outcomeReady && !game.decrypted) {
          try {
            const decrypted = await decryptGame(gameIdBigInt, game);
            setDecryptedResult(decrypted);
          } catch (e) {
            // Silent error handling
          }
        }
      } else if (game.moveASubmitted && game.moveBSubmitted && game.outcomeReady) {
        // Both moves submitted, waiting for resolution
        setGamePhase("waiting-resolution");
        toast.info("Game is being resolved");
        // Start polling
        setTimeout(() => pollGameStatus(gameIdBigInt), 2000);
      } else if ((isPlayerA && !game.moveASubmitted) || (isPlayerB && !game.moveBSubmitted)) {
        // Current player hasn't submitted move yet
        setGamePhase("selecting");
        toast.success("Game found! Please select your move");
      } else {
        // Waiting for opponent
        setGamePhase("waiting-opponent");
        if (isPlayerA) {
          setPlayerMove(game.moveA ? "attack-north" : null); // Placeholder, encrypted
        } else {
          setPlayerMove(game.moveB ? "attack-north" : null); // Placeholder, encrypted
        }
        toast.info("Waiting for opponent to submit move");
        // Start polling
        setTimeout(() => pollGameStatus(gameIdBigInt), 2000);
      }

      setIsLoadingGame(false);
    } catch (e: any) {
      toast.error("Failed to load game", {
        description: e.message || String(e),
      });
      setIsLoadingGame(false);
    }
  };

  // Removed handleJoinGame - not needed in current flow

  const handleJoinGame = async (gameId: string) => {
    if (!isConnected) {
      toast.error("Please connect your wallet first");
      return;
    }
    if (!selectedMove) {
      toast.error("Please select a move first");
      return;
    }

    try {
      setGamePhase("creating");
      const gameIdBigInt = BigInt(gameId);
      const game = await getGame(gameIdBigInt);
      setCurrentGameId(gameIdBigInt);
      setGameStatus(game);
      
      if (game.moveASubmitted && game.moveBSubmitted) {
        toast.info("Game already completed");
        setGamePhase("waiting-resolution");
        await pollGameStatus(gameIdBigInt);
        return;
      }

      const moveValue = moves.find(m => m.id === selectedMove)?.value;
      if (moveValue === undefined) {
        throw new Error("Invalid move");
      }

      await submitMove(gameIdBigInt, moveValue);
      setPlayerMove(selectedMove);
      setGamePhase("committed");
      toast.success("Move submitted!");
      
      // Start polling
      setTimeout(() => pollGameStatus(gameIdBigInt), 2000);
    } catch (e: any) {
      toast.error("Failed to join game", {
        description: e.message || String(e),
      });
      setGamePhase("idle");
    }
  };

  const handleStartGame = () => {
    
    if (!isConnected) {
      toast.error("Please connect your wallet first");
      return;
    }
    if (!fhevmReady) {
      toast.error("FHEVM not ready", {
        description: "Please wait for FHEVM to initialize",
      });
      return;
    }
    if (!contractAddress) {
      toast.error("Contract not deployed", {
        description: `Please deploy contract on ${chainName || "current network"}`,
      });
      return;
    }
    
    setGamePhase("selecting");
    setSelectedMove(null);
    setPlayerMove(null);
    setOpponentMove(null);
    // Keep opponentAddress when entering selecting phase, only clear it when going back to idle
    // setOpponentAddress("");
    setCurrentGameId(null);
    setGameStatus(null);
    setDecryptedResult(null);
  };

  const getMoveDisplay = (move: Move) => {
    const moveData = moves.find(m => m.id === move);
    return moveData ? moveData.label : move;
  };

  if (!isConnected) {
    return (
      <section className="py-24 px-6">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h3 className="text-4xl md:text-5xl font-bold mb-4 text-foreground">The Arena</h3>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Where encrypted intentions meet strategic revelation
            </p>
          </div>
          <Card className="paper-fold p-12 bg-gradient-paper shadow-fold text-center max-w-md mx-auto">
            <Lock className="w-16 h-16 mx-auto mb-4 text-primary" />
            <h4 className="text-2xl font-bold mb-3 text-foreground">Connect Your Wallet</h4>
            <p className="text-muted-foreground mb-6">
              Please connect your wallet to enter the arena
            </p>
          </Card>
        </div>
      </section>
    );
  }

  return (
    <section className="py-24 px-6">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-16">
          <h3 className="text-4xl md:text-5xl font-bold mb-4 text-foreground">The Arena</h3>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Where encrypted intentions meet strategic revelation
          </p>
          {contractAddress && (
            <p className="text-sm text-muted-foreground mt-2">
              Contract: {contractAddress.slice(0, 6)}...{contractAddress.slice(-4)} ({chainName})
            </p>
          )}
          {!fhevmReady && (
            <p className="text-sm text-yellow-500 mt-2">
              ⏳ Initializing FHEVM...
            </p>
          )}
          {!contractAddress && (
            <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg max-w-2xl mx-auto">
              <p className="text-sm text-yellow-600 dark:text-yellow-400">
                ⚠️ Contract not found. Please ensure:
              </p>
              <ul className="text-sm text-yellow-600/80 dark:text-yellow-400/80 mt-2 list-disc list-inside space-y-1">
                <li>You are connected to Hardhat network (chainId: 31337)</li>
                <li>The contract is deployed to your Hardhat node</li>
                <li>Check browser console for details</li>
              </ul>
            </div>
          )}
        </div>

        {gamePhase === "idle" && (
          <div className="text-center max-w-3xl mx-auto">
            <div className="grid md:grid-cols-2 gap-8 mb-12">
              <Card className="paper-fold p-8 bg-gradient-paper shadow-fold border-2 border-primary/20">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Lock className="w-6 h-6 text-primary" />
                  </div>
                  <h4 className="text-2xl font-semibold text-foreground">Commitment Phase</h4>
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  Both players simultaneously encrypt and commit their moves. The blockchain ensures no one can change their decision.
                </p>
              </Card>
              
              <Card className="paper-fold p-8 bg-gradient-paper shadow-fold border-2 border-secondary/20">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center">
                    <Unlock className="w-6 h-6 text-secondary" />
                  </div>
                  <h4 className="text-2xl font-semibold text-foreground">Revelation Phase</h4>
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  After both commit, moves are revealed simultaneously. The strategic truth unfolds—who predicted better?
                </p>
              </Card>
            </div>

            <div className="space-y-4 mb-8">
              <div className="grid md:grid-cols-2 gap-4">
                <Card className="paper-fold p-6 bg-gradient-paper shadow-fold relative">
                  <h4 className="text-xl font-semibold mb-4">Create New Game</h4>
                <div className="space-y-4 relative z-0">
                  <Input
                    placeholder="Opponent address (0x...)"
                    value={opponentAddress}
                    onChange={(e) => setOpponentAddress(e.target.value)}
                    className="max-w-md mx-auto"
                  />
                  <div className="relative" style={{ zIndex: 10, pointerEvents: 'auto' }}>
                  <Button 
                    onClick={(e) => {
                      const isDisabled = !fhevmReady || !contractAddress;
                      
                      if (isDisabled) {
                        e.preventDefault();
                        e.stopPropagation();
                        return;
                      }
                      
                      handleStartGame();
                    }}
                    size="lg"
                    className="paper-fold shadow-fold text-lg px-8 py-6 h-auto relative z-10"
                    disabled={!fhevmReady || !contractAddress}
                    style={{
                      pointerEvents: (!fhevmReady || !contractAddress) ? 'none' : 'auto',
                      cursor: (!fhevmReady || !contractAddress) ? 'not-allowed' : 'pointer',
                      position: 'relative',
                      zIndex: 100,
                      touchAction: 'manipulation',
                      WebkitTapHighlightColor: 'transparent',
                    }}
                    tabIndex={(!fhevmReady || !contractAddress) ? -1 : 0}
                    onKeyDown={(e) => {
                      if ((e.key === 'Enter' || e.key === ' ') && fhevmReady && contractAddress) {
                        e.preventDefault();
                        handleStartGame();
                      }
                    }}
                    aria-disabled={!fhevmReady || !contractAddress}
                  >
                    {!fhevmReady ? "⏳ Initializing FHEVM..." : !contractAddress ? "⚠️ Waiting for contract address..." : "Enter the Arena"}
                  </Button>
                  </div>
                  {(!fhevmReady || !contractAddress) && (
                    <p className="text-xs text-muted-foreground mt-2">
                      {!fhevmReady && "FHEVM is initializing, please wait..."}
                      {fhevmReady && !contractAddress && "Make sure you're connected to Hardhat network (chainId: 31337)"}
                    </p>
                  )}
                </div>
              </Card>

                <Card className="paper-fold p-6 bg-gradient-paper shadow-fold relative">
                  <h4 className="text-xl font-semibold mb-4">Join Game by ID</h4>
                  <div className="space-y-4 relative z-0">
                    <Input
                      placeholder="Game ID (e.g., 1, 2, 3...)"
                      value={gameIdInput}
                      onChange={(e) => setGameIdInput(e.target.value)}
                      className="w-full"
                      type="number"
                      min="0"
                    />
                    <div className="relative" style={{ zIndex: 10, pointerEvents: 'auto' }}>
                      <Button 
                        onClick={handleJoinGameByID}
                        size="lg"
                        variant="secondary"
                        className="w-full text-lg py-6 h-auto relative z-10"
                        disabled={!fhevmReady || !contractAddress || !gameIdInput.trim() || isLoadingGame}
                        style={{
                          pointerEvents: (!fhevmReady || !contractAddress || !gameIdInput.trim() || isLoadingGame) ? 'none' : 'auto',
                          cursor: (!fhevmReady || !contractAddress || !gameIdInput.trim() || isLoadingGame) ? 'not-allowed' : 'pointer',
                          position: 'relative',
                          zIndex: 100,
                        }}
                        type="button"
                      >
                        {isLoadingGame ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Loading...
                          </>
                        ) : (
                          "Join Game"
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Enter the game ID you received from the game creator
                    </p>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        )}

        {gamePhase === "selecting" && (
          <div className="max-w-4xl mx-auto">
            <Card className="paper-fold p-8 bg-gradient-paper shadow-fold">
              <div className="text-center mb-8">
                <div className="flex items-center justify-center gap-3 mb-4">
                  <Lock className="w-8 h-8 text-primary" />
                  <h4 className="text-3xl font-bold text-foreground">Select Your Move</h4>
                </div>
                <p className="text-muted-foreground">
                  Choose your strategy wisely. Once committed, it cannot be changed.
                </p>
                {currentGameId && (
                  <div className="mt-4 p-3 bg-primary/10 border border-primary/20 rounded-lg">
                    <p className="text-sm text-primary font-semibold">
                      Game ID: {currentGameId.toString()}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Submitting move to existing game
                    </p>
                  </div>
                )}
                {!currentGameId && (
                  <div className="mt-4">
                    <Input
                      placeholder="Opponent address (0x...)"
                      value={opponentAddress}
                      onChange={(e) => setOpponentAddress(e.target.value)}
                      className="max-w-md mx-auto"
                    />
                    {opponentAddress && !ethers.isAddress(opponentAddress) && (
                      <p className="text-xs text-red-500 mt-1">Invalid address format</p>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-6 mb-8 relative" style={{ isolation: 'isolate' }}>
                {moves.map((move, index) => {
                  const Icon = move.icon;
                  const isSelected = selectedMove === move.id;
                  const isAttack = move.id.includes('attack');
                  
                  return (
                    <button
                      key={move.id}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setSelectedMove(move.id);
                      }}
                      style={{ zIndex: isSelected ? 10 : 1 }}
                      className={`group relative p-8 rounded-2xl border-2 transition-all duration-300 overflow-visible ${
                        isSelected
                          ? `border-primary ${isAttack ? 'bg-gradient-to-br from-red-500/20 to-orange-500/20' : 'bg-gradient-to-br from-blue-500/20 to-cyan-500/20'} shadow-2xl scale-105`
                          : "border-border hover:border-primary/50 hover:bg-muted/50 hover:scale-102 hover:shadow-lg"
                      }`}
                    >
                      {/* 选中时的外圈光效 - 使用伪元素避免阻挡 */}
                      {isSelected && (
                        <div 
                          className="absolute -inset-1 rounded-2xl border-4 border-primary/30 pointer-events-none" 
                          style={{ zIndex: -1 }}
                        />
                      )}
                      
                      {/* 背景动画效果 - 使用pointer-events-none避免阻挡点击 */}
                      <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none ${isAttack ? 'bg-gradient-to-br from-red-500/10 to-orange-500/10' : 'bg-gradient-to-br from-blue-500/10 to-cyan-500/10'}`} />
                      
                      {/* 图标容器 */}
                      <div className="relative z-10 flex flex-col items-center justify-center">
                        <div className={`relative mb-4 ${isSelected ? 'animate-pulse' : ''}`}>
                          {/* 图标光晕效果 */}
                          {isSelected && (
                            <div className="absolute inset-0 bg-primary/30 blur-xl rounded-full animate-ping pointer-events-none" style={{ animationDuration: '2s' }} />
                          )}
                          <Icon className={`w-16 h-16 transition-all duration-300 ${isSelected ? "text-primary scale-110" : "text-muted-foreground group-hover:text-primary group-hover:scale-110"}`} />
                        </div>
                        
                        {/* 标签 */}
                        <p className={`font-bold text-xl transition-colors ${isSelected ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"}`}>
                          {move.label}
                        </p>
                        
                        {/* 选择指示器 */}
                        {isSelected && (
                          <div className="mt-2 w-12 h-1 bg-primary rounded-full animate-pulse" />
                        )}
                      </div>
                      
                      {/* 边框光效 - 使用pointer-events-none避免阻挡点击 */}
                      {isSelected && (
                        <div className="absolute inset-0 rounded-2xl border-2 border-primary animate-pulse opacity-50 pointer-events-none" />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="flex gap-4 relative" style={{ zIndex: 20 }}>
                <Button
                  onClick={() => {
                    setGamePhase("idle");
                    setSelectedMove(null);
                  }}
                  variant="outline"
                  className="flex-1"
                  type="button"
                >
                  Back
                </Button>
                <div className="flex-1 relative" style={{ zIndex: 100 }}>
                  <Button
                    onClick={(e) => {
                      const hasGameId = !!currentGameId;
                      const canCreate = selectedMove && (!hasGameId ? (opponentAddress && ethers.isAddress(opponentAddress)) : true);
                      console.log("=== Submit/Create button clicked! ===", {
                        selectedMove,
                        opponentAddress,
                        currentGameId: currentGameId?.toString(),
                        hasGameId,
                        canCreate,
                        isProcessing,
                        disabled: e.currentTarget.disabled,
                        timestamp: Date.now(),
                      });
                      
                      if (!canCreate || isProcessing) {
                        console.warn("Cannot submit, conditions not met", {
                          selectedMove: !!selectedMove,
                          opponentAddress: !!opponentAddress,
                          validAddress: opponentAddress ? ethers.isAddress(opponentAddress) : false,
                          hasGameId,
                          isProcessing,
                        });
                        if (!selectedMove) {
                          toast.error("Please select a move first");
                        } else if (!hasGameId && !opponentAddress) {
                          toast.error("Please enter an opponent address");
                        } else if (!hasGameId && opponentAddress && !ethers.isAddress(opponentAddress)) {
                          toast.error("Please enter a valid opponent address");
                        }
                        return;
                      }
                      
                      if (hasGameId) {
                        handleSubmitMove();
                      } else {
                        handleCreateGame();
                      }
                    }}
                    disabled={
                      !selectedMove || 
                      isProcessing ||
                      (!currentGameId && (!opponentAddress || !ethers.isAddress(opponentAddress)))
                    }
                    size="lg"
                    className="w-full text-lg py-6 h-auto relative"
                    style={{
                      pointerEvents: (
                        !selectedMove || 
                        isProcessing ||
                        (!currentGameId && (!opponentAddress || !ethers.isAddress(opponentAddress)))
                      ) ? 'none' : 'auto',
                      cursor: (
                        !selectedMove || 
                        isProcessing ||
                        (!currentGameId && (!opponentAddress || !ethers.isAddress(opponentAddress)))
                      ) ? 'not-allowed' : 'pointer',
                      position: 'relative',
                      zIndex: 100,
                      touchAction: 'manipulation',
                      WebkitTapHighlightColor: 'transparent',
                    }}
                    type="button"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {currentGameId ? "Submitting..." : "Creating..."}
                      </>
                    ) : (
                      currentGameId ? "Submit Move" : "Create Game"
                    )}
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}

        {gamePhase === "creating" && (
          <div className="max-w-3xl mx-auto">
            <Card className="paper-fold p-8 bg-gradient-paper shadow-fold text-center">
              <Loader2 className="w-16 h-16 mx-auto mb-4 text-primary animate-spin" />
              <h4 className="text-2xl font-bold mb-3 text-foreground">Processing...</h4>
              <p className="text-muted-foreground">Please wait for transaction confirmation</p>
            </Card>
          </div>
        )}

        {(gamePhase === "waiting-opponent" || gamePhase === "committed" || gamePhase === "waiting-resolution") && (
          <div className="max-w-3xl mx-auto">
            <Card className="paper-fold p-8 bg-gradient-paper shadow-fold text-center relative overflow-hidden">
              {/* 背景脉冲效果 */}
              {gameStatus?.status !== 3 && (
                <div className="absolute inset-0 bg-primary/5 animate-pulse" />
              )}
              
              <div className="relative z-10">
                {gameStatus?.status === 3 ? (
                  <>
                    <X className="w-16 h-16 mx-auto mb-4 text-red-500" />
                    <h4 className="text-2xl font-bold mb-3 text-foreground text-red-600">Game Cancelled</h4>
                    <p className="text-muted-foreground mb-4">
                      This game has been cancelled. You can start a new game.
                    </p>
                    <Button onClick={handleStartGame} className="mt-4">
                      Start New Game
                    </Button>
                  </>
                ) : (
                  <>
                    {/* 进度条 */}
                    <div className="w-full bg-muted/30 rounded-full h-2 mb-6 overflow-hidden">
                      <div 
                        className="h-full bg-primary rounded-full transition-all duration-500 ease-out" 
                        style={{
                          width: gamePhase === "waiting-resolution" ? "100%" : gamePhase === "committed" ? "75%" : "50%",
                        }}
                      />
                    </div>
                    
                    <div className="relative inline-block mb-4">
                      <div className="absolute inset-0 bg-primary/30 blur-2xl rounded-full animate-ping" style={{ animationDuration: '2s' }} />
                      <Lock className="w-16 h-16 mx-auto relative text-primary animate-pulse" />
                    </div>
                    
                    <h4 className="text-2xl font-bold mb-3 text-foreground">
                      {gamePhase === "waiting-opponent" && "Waiting for Opponent"}
                      {gamePhase === "committed" && "Move Committed"}
                      {gamePhase === "waiting-resolution" && "Resolving Game..."}
                    </h4>
                    
                    {currentGameId && (
                      <div className="bg-muted/30 rounded-lg p-4 font-mono text-sm text-muted-foreground mb-6">
                        <div>Game ID: {currentGameId.toString()}</div>
                        {playerMove && <div>Your Move: [encrypted]</div>}
                        {gameStatus && (
                          <>
                            <div>Status: {gameStatus.status === 0 ? "Waiting" : gameStatus.status === 1 ? "Ready" : gameStatus.status === 2 ? "Resolved" : "Cancelled"}</div>
                            <div>Move A: {gameStatus.moveASubmitted ? "✓" : "✗"}</div>
                            <div>Move B: {gameStatus.moveBSubmitted ? "✓" : "✗"}</div>
                            {gameStatus.outcomeReady && <div className="text-green-500 mt-2">✓ Outcome Ready</div>}
                            {gameStatus.decrypted && <div className="text-green-500">✓ Decrypted</div>}
                          </>
                        )}
                        {txHash && <div className="text-accent mt-2">✓ Tx: {txHash.slice(0, 10)}...</div>}
                      </div>
                    )}
                    
                    {(gamePhase === "waiting-opponent" || gamePhase === "committed") && (
                      <p className="text-lg text-muted-foreground">
                        {gamePhase === "waiting-opponent" && "Share the game ID with your opponent..."}
                        {gamePhase === "committed" && "Waiting for opponent to commit their move..."}
                      </p>
                    )}
                    
                    {gamePhase === "waiting-resolution" && (
                      <>
                        <p className="text-lg text-muted-foreground mb-4">
                          Both moves submitted. Resolving and decrypting game result...
                        </p>
                        <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary" />
                        <p className="text-sm text-muted-foreground mt-4">
                          Check the History page for results once decryption completes
                        </p>
                      </>
                    )}
                  </>
                )}
              </div>
            </Card>
          </div>
        )}

        {gamePhase === "resolved" && (
          <div className="max-w-4xl mx-auto">
            <Card className="paper-fold p-8 bg-gradient-paper shadow-fold relative overflow-hidden">
              {/* 成功时的庆祝效果 */}
              {decryptedResult?.aWins && (
                <div className="absolute inset-0 bg-gradient-to-br from-green-500/20 to-emerald-500/20 animate-pulse" />
              )}
              
              <div className="relative z-10">
                <div className="text-center mb-8">
                  <div className="relative inline-block mb-4">
                    {decryptedResult?.aWins && (
                      <div className="absolute inset-0 bg-green-500/30 blur-2xl rounded-full animate-ping" style={{ animationDuration: '2s' }} />
                    )}
                    <Unlock className={`w-16 h-16 mx-auto relative ${decryptedResult?.aWins ? 'text-green-500 animate-bounce' : 'text-secondary'}`} />
                  </div>
                  <h4 className="text-3xl font-bold mb-2 text-foreground">Revelation</h4>
                  <p className="text-muted-foreground">The strategic truth unfolds</p>
                </div>

                {/* 对战视图 */}
                <div className="relative grid md:grid-cols-2 gap-6 mb-8">
                  {/* 玩家卡片 */}
                  <div className="relative">
                    <div className="absolute -top-2 -right-2 w-20 h-20 bg-primary/20 rounded-full blur-xl animate-pulse" />
                    <div className="bg-gradient-to-br from-primary/10 to-primary/5 border-2 border-primary/30 rounded-xl p-6 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full -mr-16 -mt-16" />
                      <p className="text-sm text-muted-foreground mb-2 font-semibold">Your Move</p>
                      <div className="flex items-center gap-3">
                        {playerMove && (() => {
                          const moveData = moves.find(m => m.id === playerMove);
                          const MoveIcon = moveData?.icon || Swords;
                          return <MoveIcon className="w-8 h-8 text-primary" />;
                        })()}
                        <p className="text-2xl font-bold text-primary">
                          {playerMove ? getMoveDisplay(playerMove) : "---"}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {/* VS 分隔符 */}
                  <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20 hidden md:block">
                    <div className="w-16 h-16 bg-background border-4 border-border rounded-full flex items-center justify-center shadow-lg">
                      <span className="text-xl font-bold text-muted-foreground">VS</span>
                    </div>
                  </div>
                  
                  {/* 对手卡片 */}
                  <div className="relative">
                    <div className="absolute -top-2 -left-2 w-20 h-20 bg-secondary/20 rounded-full blur-xl animate-pulse" />
                    <div className="bg-gradient-to-br from-secondary/10 to-secondary/5 border-2 border-secondary/30 rounded-xl p-6 relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-32 h-32 bg-secondary/10 rounded-full -ml-16 -mt-16" />
                      <p className="text-sm text-muted-foreground mb-2 font-semibold">Opponent's Move</p>
                      <div className="flex items-center gap-3">
                        {opponentMove && (() => {
                          const moveData = moves.find(m => m.id === opponentMove);
                          const MoveIcon = moveData?.icon || Shield;
                          return <MoveIcon className="w-8 h-8 text-secondary" />;
                        })()}
                        <p className="text-2xl font-bold text-secondary">
                          {opponentMove ? getMoveDisplay(opponentMove) : "---"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 结果展示 */}
                {decryptedResult && (
                  <div className={`rounded-xl p-8 mb-8 text-center relative overflow-hidden ${
                    decryptedResult.aWins 
                      ? 'bg-gradient-to-br from-green-500/20 to-emerald-500/10 border-2 border-green-500/30' 
                      : decryptedResult.bWins
                      ? 'bg-gradient-to-br from-red-500/20 to-orange-500/10 border-2 border-red-500/30'
                      : 'bg-gradient-to-br from-yellow-500/20 to-amber-500/10 border-2 border-yellow-500/30'
                  }`}>
                    {/* 背景动画 */}
                    <div className="absolute inset-0 opacity-20">
                      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-transparent via-white to-transparent animate-shimmer" />
                    </div>
                    
                    <div className="relative z-10">
                      <p className="text-lg font-semibold mb-4">Result</p>
                      {decryptedResult.aWins && (
                        <div className="flex flex-col items-center gap-2">
                          <div className="text-4xl mb-2">🎉</div>
                          <p className="text-3xl font-bold text-green-500">You Win!</p>
                          <div className="w-24 h-1 bg-green-500 rounded-full mt-2" />
                        </div>
                      )}
                      {decryptedResult.bWins && (
                        <div className="flex flex-col items-center gap-2">
                          <div className="text-4xl mb-2">💔</div>
                          <p className="text-3xl font-bold text-red-500">You Lose</p>
                        </div>
                      )}
                      {decryptedResult.isTie && (
                        <div className="flex flex-col items-center gap-2">
                          <div className="text-4xl mb-2">🤝</div>
                          <p className="text-3xl font-bold text-yellow-500">Draw</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <Button
                  onClick={handleStartGame}
                  size="lg"
                  className="w-full text-lg py-6 h-auto"
                >
                  Play Again
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </section>
  );
};

export default GameArena;
