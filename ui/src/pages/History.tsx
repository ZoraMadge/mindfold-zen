import { useEffect, useState, useCallback } from "react";
import Header from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { History as HistoryIcon, Trophy, X, Minus, Loader2 } from "lucide-react";
import { useAccount } from "wagmi";
import { useMindfoldZen, DecryptedGame } from "@/hooks/useMindfoldZen";
import { ethers } from "ethers";
import { useQuery, useQueryClient } from "@tanstack/react-query";

type GameInfo = {
  gameId: bigint;
  playerA: string;
  playerB: string;
  status: number; // 0: WaitingForOpponent, 1: WaitingForResolution, 2: Resolved, 3: Cancelled
  moveASubmitted: boolean;
  moveBSubmitted: boolean;
  outcomeReady: boolean;
  decrypted: boolean;
  decryptedMoveA?: number;
  decryptedMoveB?: number;
  decryptedOutcome?: number;
  createdAt: bigint;
  deadline: bigint;
};

const moveNames = ["Attack North", "Attack South", "Defend North", "Defend South"];

const History = () => {
  const { address, isConnected } = useAccount();
  const { getPlayerGames, getGame, decryptGame, requestGameDecryption, contractAddress, fhevmReady } = useMindfoldZen();
  const queryClient = useQueryClient();
  const [games, setGames] = useState<GameInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [decryptingGameId, setDecryptingGameId] = useState<bigint | null>(null);

  const fetchPlayerGames = useCallback(async () => {
    if (!address || !isConnected || !contractAddress || !fhevmReady) {
      setGames([]);
      return;
    }

    try {
      setLoading(true);
      const gameIds = await getPlayerGames(address);

      const gameInfos: (GameInfo | null)[] = await Promise.all(
        gameIds.map(async (gameId) => {
          try {
            const game = await getGame(gameId);
            const gameInfo: GameInfo = {
              gameId,
              playerA: game.playerA,
              playerB: game.playerB,
              status: Number(game.status),
              moveASubmitted: game.moveASubmitted,
              moveBSubmitted: game.moveBSubmitted,
              outcomeReady: game.outcomeReady,
              decrypted: game.decrypted,
              decryptedMoveA: game.decryptedMoveA !== undefined && game.decryptedMoveA !== null ? Number(game.decryptedMoveA) : undefined,
              decryptedMoveB: game.decryptedMoveB !== undefined && game.decryptedMoveB !== null ? Number(game.decryptedMoveB) : undefined,
              decryptedOutcome: game.decryptedOutcome !== undefined && game.decryptedOutcome !== null ? Number(game.decryptedOutcome) : undefined,
              createdAt: game.createdAt,
              deadline: game.deadline,
            };

            return gameInfo;
          } catch (e) {
            return null;
          }
        })
      );

      const validGames = gameInfos.filter((g): g is GameInfo => g !== null);
      // Sort by gameId descending (newest first)
      validGames.sort((a, b) => {
        if (a.gameId > b.gameId) return -1;
        if (a.gameId < b.gameId) return 1;
        return 0;
      });

      // Merge with existing games to preserve decrypted data
      setGames(prevGames => {
        const gameMap = new Map(prevGames.map(g => [g.gameId.toString(), g]));
        
        return validGames.map(game => {
          const existingGame = gameMap.get(game.gameId.toString());
          
          // If we had decrypted data before, preserve it even if new fetch doesn't have it
          if (existingGame?.decrypted && 
              existingGame.decryptedMoveA !== undefined && 
              existingGame.decryptedMoveB !== undefined) {
            // If new data doesn't have decrypted info, use the old decrypted data
            if (!game.decrypted || 
                game.decryptedMoveA === undefined || 
                game.decryptedMoveB === undefined) {
              return {
                ...game,  // Keep updated status, outcomeReady, etc.
                decrypted: true,
                decryptedMoveA: existingGame.decryptedMoveA,
                decryptedMoveB: existingGame.decryptedMoveB,
                decryptedOutcome: existingGame.decryptedOutcome,
              };
            }
          }
          
          // If new data has decrypted info, use it
          return game;
        });
      });
    } catch (e) {
      // Failed to fetch player games
    } finally {
      setLoading(false);
    }
  }, [address, isConnected, contractAddress, fhevmReady, getPlayerGames, getGame]);

  const handleDecryptGame = async (gameId: bigint) => {
    if (!address || !fhevmReady) {
      return;
    }
    
    try {
      setDecryptingGameId(gameId);
      
      // First, fetch current game state
      const game = await getGame(gameId);
      
      // Check if outcome is ready
      if (!game.outcomeReady) {
        setDecryptingGameId(null);
        return;
      }
      
      // Try to request decryption first if not already requested
      if (!game.decrypted) {
        try {
          await requestGameDecryption(gameId);
          // Wait a bit for the decryption to process
          await new Promise(resolve => setTimeout(resolve, 2000));
          // Re-fetch game to get updated decrypted status
          const updatedGame = await getGame(gameId);
          if (updatedGame.decrypted) {
            const decrypted = await decryptGame(gameId, updatedGame);
            // Update games list with decrypted data
            setGames(prev => prev.map(g => 
              g.gameId === gameId 
                ? { 
                    ...g, 
                    status: Number(updatedGame.status),
                    decrypted: true, 
                    decryptedMoveA: decrypted.moveA,
                    decryptedMoveB: decrypted.moveB,
                    decryptedOutcome: decrypted.outcome,
                  }
                : g
            ));
            setDecryptingGameId(null);
            return;
          }
        } catch (e) {
          // Continue with direct decryption
        }
      }
      
      // Try direct decryption
      const decrypted = await decryptGame(gameId, game);
      
      // Update games list with decrypted data
      setGames(prev => prev.map(g => 
        g.gameId === gameId 
          ? { 
              ...g, 
              decrypted: true, 
              decryptedMoveA: decrypted.moveA,
              decryptedMoveB: decrypted.moveB,
              decryptedOutcome: decrypted.outcome,
            }
          : g
      ));
    } catch (e) {
      // Silent error handling
    } finally {
      setDecryptingGameId(null);
    }
  };

  useEffect(() => {
    fetchPlayerGames();
    
    // Auto-refresh every 5 seconds
    const interval = setInterval(() => {
      if (isConnected && address && contractAddress && fhevmReady) {
        fetchPlayerGames();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchPlayerGames, isConnected, address, contractAddress, fhevmReady]);

  const getStatusText = (status: number, outcomeReady: boolean, decrypted: boolean) => {
    // Convert status if needed (handle enum values)
    const statusNum = typeof status === 'number' ? status : Number(status);
    
    switch (statusNum) {
      case 0: return "Waiting for Opponent";
      case 1: return "Waiting for Resolution";
      case 2: {
        if (outcomeReady && decrypted) {
          return "Resolved";
        } else if (outcomeReady && !decrypted) {
          return "Resolved (Decrypting...)";
        } else {
          return "Waiting for Resolution";
        }
      }
      case 3: return "Cancelled";
      default: {
        // Fallback: try to infer from outcomeReady
        if (outcomeReady && decrypted) {
          return "Resolved";
        } else if (outcomeReady) {
          return "Resolved (Decrypting...)";
        }
        return `Status ${statusNum}`;
      }
    }
  };

  const getStatusColor = (status: number) => {
    switch (status) {
      case 0: return "text-yellow-600";
      case 1: return "text-blue-600";
      case 2: return "text-green-600";
      case 3: return "text-red-600";
      default: return "text-gray-600";
    }
  };

  const getResult = (game: GameInfo) => {
    // Check if outcome is ready and we have decrypted data
    if (!game.outcomeReady) return null;
    
    const isPlayerA = address?.toLowerCase() === game.playerA.toLowerCase();
    
    // Try to use decrypted outcome first
    if (game.decrypted && game.decryptedOutcome !== undefined) {
      // Outcome: 0 = Tie, 1 = Player A wins, 2 = Player B wins
      if (game.decryptedOutcome === 0) {
        return { text: "Draw", icon: Minus, color: "text-gray-600" };
      } else if (game.decryptedOutcome === 1) {
        return { text: isPlayerA ? "Victory" : "Defeat", icon: isPlayerA ? Trophy : X, color: isPlayerA ? "text-green-600" : "text-red-600" };
      } else {
        return { text: isPlayerA ? "Defeat" : "Victory", icon: isPlayerA ? X : Trophy, color: isPlayerA ? "text-red-600" : "text-green-600" };
      }
    }
    
    // If not decrypted yet but outcome ready, show decrypting status
    if (game.outcomeReady && !game.decrypted) {
      return null; // Don't show anything until decrypted
    }
    
    return null;
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pt-20 px-6 py-12">
          <div className="container mx-auto max-w-6xl">
            <Card className="paper-fold p-12 bg-gradient-paper shadow-fold text-center max-w-md mx-auto">
              <HistoryIcon className="w-16 h-16 mx-auto mb-4 text-primary" />
              <h4 className="text-2xl font-bold mb-3 text-foreground">Connect Your Wallet</h4>
              <p className="text-muted-foreground mb-6">
                Please connect your wallet to view game history
              </p>
            </Card>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-20 px-6 py-12">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-3 mb-4">
              <HistoryIcon className="w-8 h-8 text-primary" />
              <h1 className="text-4xl md:text-5xl font-bold text-foreground">Game History</h1>
            </div>
            <p className="text-xl text-muted-foreground">
              View your past games and results
            </p>
          </div>

          {!contractAddress && (
            <Card className="paper-fold p-8 bg-gradient-paper shadow-fold text-center">
              <p className="text-muted-foreground">
                Contract not deployed. Please connect to Hardhat network (chainId: 31337).
              </p>
            </Card>
          )}

          {!fhevmReady && (
            <Card className="paper-fold p-8 bg-gradient-paper shadow-fold text-center">
              <Loader2 className="w-8 h-8 mx-auto mb-4 animate-spin text-primary" />
              <p className="text-muted-foreground">
                Initializing FHEVM...
              </p>
            </Card>
          )}

          {contractAddress && fhevmReady && (
            <>
              {loading && games.length === 0 ? (
                <Card className="paper-fold p-8 bg-gradient-paper shadow-fold text-center">
                  <Loader2 className="w-8 h-8 mx-auto mb-4 animate-spin text-primary" />
                  <p className="text-muted-foreground">Loading games...</p>
                </Card>
              ) : games.length === 0 ? (
                <Card className="paper-fold p-8 bg-gradient-paper shadow-fold">
                  <div className="text-center py-12">
                    <p className="text-muted-foreground mb-6">
                      No games found. Start playing to see your game history here.
                    </p>
                    <Button asChild>
                      <Link to="/">Start Playing</Link>
                    </Button>
                  </div>
                </Card>
              ) : (
                <div className="space-y-4">
                  {games.map((game) => {
                    const isPlayerA = address?.toLowerCase() === game.playerA.toLowerCase();
                    const opponent = isPlayerA ? game.playerB : game.playerA;
                    const result = getResult(game);
                    // Show decrypt button if outcome is ready but not decrypted yet
                    const canDecrypt = game.outcomeReady && !game.decrypted;
                    

                    return (
                      <Card key={game.gameId.toString()} className="paper-fold p-6 bg-gradient-paper shadow-fold relative" style={{ position: 'relative', overflow: 'visible' }}>
                        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 relative" style={{ position: 'relative' }}>
                          <div className="flex-1" style={{ zIndex: 1, position: 'relative', pointerEvents: 'auto' }}>
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-xl font-bold text-foreground">
                                Game #{game.gameId.toString()}
                              </h3>
                              <span className={`text-sm font-semibold ${getStatusColor(game.status)}`}>
                                {getStatusText(game.status, game.outcomeReady, game.decrypted)}
                              </span>
                            </div>
                            
                            <div className="space-y-1 text-sm text-muted-foreground">
                              <p>
                                <span className="font-semibold">Opponent:</span> {opponent.slice(0, 6)}...{opponent.slice(-4)}
                              </p>
                              <p>
                                <span className="font-semibold">Your Move:</span>{" "}
                                {game.moveASubmitted && isPlayerA || game.moveBSubmitted && !isPlayerA 
                                  ? "✓ Submitted" 
                                  : "Not submitted"}
                              </p>
                              <p>
                                <span className="font-semibold">Opponent Move:</span>{" "}
                                {game.moveBSubmitted && isPlayerA || game.moveASubmitted && !isPlayerA
                                  ? "✓ Submitted"
                                  : "Not submitted"}
                              </p>
                            </div>

                            {game.outcomeReady && (
                              <div className="mt-3 p-3 bg-muted/30 rounded-lg">
                                {game.decrypted && game.decryptedMoveA !== undefined && game.decryptedMoveB !== undefined ? (
                                  <>
                                    <p className="text-sm font-semibold mb-2">Moves & Result:</p>
                                    <div className="grid grid-cols-2 gap-2 text-sm mb-2">
                                      <div>
                                        <span className="text-muted-foreground">You:</span>{" "}
                                        <span className="font-semibold">
                                          {isPlayerA ? moveNames[game.decryptedMoveA] : moveNames[game.decryptedMoveB]}
                                        </span>
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground">Opponent:</span>{" "}
                                        <span className="font-semibold">
                                          {isPlayerA ? moveNames[game.decryptedMoveB] : moveNames[game.decryptedMoveA]}
                                        </span>
                                      </div>
                                    </div>
                                    {result && (
                                      <div className="mt-2 flex items-center gap-2 pt-2 border-t border-border/50">
                                        {result.icon === Loader2 ? (
                                          <result.icon className={`w-5 h-5 ${result.color} animate-spin`} />
                                        ) : (
                                          <result.icon className={`w-5 h-5 ${result.color}`} />
                                        )}
                                        <span className={`font-bold text-lg ${result.color}`}>{result.text}</span>
                                      </div>
                                    )}
                                  </>
                                ) : (
                                  <div className="text-center py-2">
                                    <p className="text-sm text-muted-foreground">
                                      Outcome ready, waiting for decryption...
                                    </p>
                                    {result && (
                                      <div className="mt-2 flex items-center justify-center gap-2">
                                        {result.icon === Loader2 ? (
                                          <result.icon className={`w-5 h-5 ${result.color} animate-spin`} />
                                        ) : (
                                          <result.icon className={`w-5 h-5 ${result.color}`} />
                                        )}
                                        <span className={`font-semibold ${result.color}`}>{result.text}</span>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {canDecrypt && (
                            <div className="flex flex-col items-center justify-center" style={{ minWidth: '140px' }}>
                              <Button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (decryptingGameId !== game.gameId && fhevmReady) {
                                    handleDecryptGame(game.gameId);
                                  }
                                }}
                                disabled={decryptingGameId === game.gameId || !fhevmReady}
                                variant="outline"
                                size="sm"
                                className="w-full"
                              >
                                {decryptingGameId === game.gameId ? (
                                  <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Decrypting...
                                  </>
                                ) : !fhevmReady ? (
                                  'Waiting for FHEVM...'
                                ) : (
                                  'Decrypt Result'
                                )}
                              </Button>
                            </div>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default History;
