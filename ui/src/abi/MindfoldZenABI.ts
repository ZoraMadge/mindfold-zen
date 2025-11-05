/*
  Contract ABI for MindfoldZen
  Auto-generated from deployment artifacts
  Updated: 2025-11-15 15:19:08
*/
export const MindfoldZenABI = {
  abi: [
    {
        "inputs":  [

                   ],
        "name":  "HandlesAlreadySavedForRequestID",
        "type":  "error"
    },
    {
        "inputs":  [

                   ],
        "name":  "InvalidKMSSignatures",
        "type":  "error"
    },
    {
        "inputs":  [

                   ],
        "name":  "NoHandleFoundForRequestID",
        "type":  "error"
    },
    {
        "anonymous":  false,
        "inputs":  [
                       {
                           "indexed":  true,
                           "internalType":  "uint256",
                           "name":  "requestID",
                           "type":  "uint256"
                       }
                   ],
        "name":  "DecryptionFulfilled",
        "type":  "event"
    },
    {
        "anonymous":  false,
        "inputs":  [
                       {
                           "indexed":  true,
                           "internalType":  "uint256",
                           "name":  "gameId",
                           "type":  "uint256"
                       },
                       {
                           "indexed":  false,
                           "internalType":  "uint256",
                           "name":  "requestId",
                           "type":  "uint256"
                       }
                   ],
        "name":  "DecryptionRequested",
        "type":  "event"
    },
    {
        "anonymous":  false,
        "inputs":  [
                       {
                           "indexed":  true,
                           "internalType":  "uint256",
                           "name":  "gameId",
                           "type":  "uint256"
                       },
                       {
                           "indexed":  true,
                           "internalType":  "address",
                           "name":  "forfeitingPlayer",
                           "type":  "address"
                       }
                   ],
        "name":  "ForfeitProcessed",
        "type":  "event"
    },
    {
        "anonymous":  false,
        "inputs":  [
                       {
                           "indexed":  true,
                           "internalType":  "uint256",
                           "name":  "gameId",
                           "type":  "uint256"
                       }
                   ],
        "name":  "GameCancelled",
        "type":  "event"
    },
    {
        "anonymous":  false,
        "inputs":  [
                       {
                           "indexed":  true,
                           "internalType":  "uint256",
                           "name":  "gameId",
                           "type":  "uint256"
                       },
                       {
                           "indexed":  true,
                           "internalType":  "address",
                           "name":  "playerA",
                           "type":  "address"
                       },
                       {
                           "indexed":  true,
                           "internalType":  "address",
                           "name":  "playerB",
                           "type":  "address"
                       },
                       {
                           "indexed":  false,
                           "internalType":  "uint256",
                           "name":  "deadline",
                           "type":  "uint256"
                       }
                   ],
        "name":  "GameCreated",
        "type":  "event"
    },
    {
        "anonymous":  false,
        "inputs":  [
                       {
                           "indexed":  true,
                           "internalType":  "uint256",
                           "name":  "gameId",
                           "type":  "uint256"
                       },
                       {
                           "indexed":  false,
                           "internalType":  "uint8",
                           "name":  "moveA",
                           "type":  "uint8"
                       },
                       {
                           "indexed":  false,
                           "internalType":  "uint8",
                           "name":  "moveB",
                           "type":  "uint8"
                       },
                       {
                           "indexed":  false,
                           "internalType":  "uint8",
                           "name":  "outcome",
                           "type":  "uint8"
                       }
                   ],
        "name":  "GameDecrypted",
        "type":  "event"
    },
    {
        "anonymous":  false,
        "inputs":  [
                       {
                           "indexed":  true,
                           "internalType":  "uint256",
                           "name":  "gameId",
                           "type":  "uint256"
                       },
                       {
                           "indexed":  false,
                           "internalType":  "euint8",
                           "name":  "encryptedOutcome",
                           "type":  "bytes32"
                       },
                       {
                           "indexed":  false,
                           "internalType":  "ebool",
                           "name":  "aWins",
                           "type":  "bytes32"
                       },
                       {
                           "indexed":  false,
                           "internalType":  "ebool",
                           "name":  "bWins",
                           "type":  "bytes32"
                       },
                       {
                           "indexed":  false,
                           "internalType":  "ebool",
                           "name":  "isTie",
                           "type":  "bytes32"
                       }
                   ],
        "name":  "GameResolved",
        "type":  "event"
    },
    {
        "anonymous":  false,
        "inputs":  [
                       {
                           "indexed":  true,
                           "internalType":  "uint256",
                           "name":  "gameId",
                           "type":  "uint256"
                       },
                       {
                           "indexed":  true,
                           "internalType":  "address",
                           "name":  "player",
                           "type":  "address"
                       },
                       {
                           "indexed":  false,
                           "internalType":  "bool",
                           "name":  "isSecondMove",
                           "type":  "bool"
                       }
                   ],
        "name":  "MoveSubmitted",
        "type":  "event"
    },
    {
        "inputs":  [

                   ],
        "name":  "INVITATION_TIMEOUT",
        "outputs":  [
                        {
                            "internalType":  "uint256",
                            "name":  "",
                            "type":  "uint256"
                        }
                    ],
        "stateMutability":  "view",
        "type":  "function"
    },
    {
        "inputs":  [

                   ],
        "name":  "MATCH_TIMEOUT",
        "outputs":  [
                        {
                            "internalType":  "uint256",
                            "name":  "",
                            "type":  "uint256"
                        }
                    ],
        "stateMutability":  "view",
        "type":  "function"
    },
    {
        "inputs":  [
                       {
                           "internalType":  "uint256",
                           "name":  "gameId",
                           "type":  "uint256"
                       }
                   ],
        "name":  "cancelExpiredGame",
        "outputs":  [

                    ],
        "stateMutability":  "nonpayable",
        "type":  "function"
    },
    {
        "inputs":  [
                       {
                           "internalType":  "address",
                           "name":  "opponent",
                           "type":  "address"
                       },
                       {
                           "internalType":  "externalEuint8",
                           "name":  "encryptedMove",
                           "type":  "bytes32"
                       },
                       {
                           "internalType":  "bytes",
                           "name":  "inputProof",
                           "type":  "bytes"
                       }
                   ],
        "name":  "createGame",
        "outputs":  [
                        {
                            "internalType":  "uint256",
                            "name":  "gameId",
                            "type":  "uint256"
                        }
                    ],
        "stateMutability":  "nonpayable",
        "type":  "function"
    },
    {
        "inputs":  [
                       {
                           "internalType":  "uint256",
                           "name":  "gameId",
                           "type":  "uint256"
                       }
                   ],
        "name":  "getGame",
        "outputs":  [
                        {
                            "components":  [
                                               {
                                                   "internalType":  "address",
                                                   "name":  "playerA",
                                                   "type":  "address"
                                               },
                                               {
                                                   "internalType":  "address",
                                                   "name":  "playerB",
                                                   "type":  "address"
                                               },
                                               {
                                                   "internalType":  "uint256",
                                                   "name":  "createdAt",
                                                   "type":  "uint256"
                                               },
                                               {
                                                   "internalType":  "uint256",
                                                   "name":  "deadline",
                                                   "type":  "uint256"
                                               },
                                               {
                                                   "internalType":  "enum MindfoldZen.GameStatus",
                                                   "name":  "status",
                                                   "type":  "uint8"
                                               },
                                               {
                                                   "internalType":  "bool",
                                                   "name":  "moveASubmitted",
                                                   "type":  "bool"
                                               },
                                               {
                                                   "internalType":  "bool",
                                                   "name":  "moveBSubmitted",
                                                   "type":  "bool"
                                               },
                                               {
                                                   "internalType":  "euint8",
                                                   "name":  "moveA",
                                                   "type":  "bytes32"
                                               },
                                               {
                                                   "internalType":  "euint8",
                                                   "name":  "moveB",
                                                   "type":  "bytes32"
                                               },
                                               {
                                                   "internalType":  "bool",
                                                   "name":  "outcomeReady",
                                                   "type":  "bool"
                                               },
                                               {
                                                   "internalType":  "euint8",
                                                   "name":  "outcome",
                                                   "type":  "bytes32"
                                               },
                                               {
                                                   "internalType":  "ebool",
                                                   "name":  "aWins",
                                                   "type":  "bytes32"
                                               },
                                               {
                                                   "internalType":  "ebool",
                                                   "name":  "bWins",
                                                   "type":  "bytes32"
                                               },
                                               {
                                                   "internalType":  "ebool",
                                                   "name":  "isTie",
                                                   "type":  "bytes32"
                                               },
                                               {
                                                   "internalType":  "bool",
                                                   "name":  "decrypted",
                                                   "type":  "bool"
                                               },
                                               {
                                                   "internalType":  "uint8",
                                                   "name":  "decryptedMoveA",
                                                   "type":  "uint8"
                                               },
                                               {
                                                   "internalType":  "uint8",
                                                   "name":  "decryptedMoveB",
                                                   "type":  "uint8"
                                               },
                                               {
                                                   "internalType":  "uint8",
                                                   "name":  "decryptedOutcome",
                                                   "type":  "uint8"
                                               }
                                           ],
                            "internalType":  "struct MindfoldZen.GameView",
                            "name":  "",
                            "type":  "tuple"
                        }
                    ],
        "stateMutability":  "view",
        "type":  "function"
    },
    {
        "inputs":  [
                       {
                           "internalType":  "address",
                           "name":  "player",
                           "type":  "address"
                       }
                   ],
        "name":  "getPlayerGames",
        "outputs":  [
                        {
                            "internalType":  "uint256[]",
                            "name":  "",
                            "type":  "uint256[]"
                        }
                    ],
        "stateMutability":  "view",
        "type":  "function"
    },
    {
        "inputs":  [

                   ],
        "name":  "nextGameId",
        "outputs":  [
                        {
                            "internalType":  "uint256",
                            "name":  "",
                            "type":  "uint256"
                        }
                    ],
        "stateMutability":  "view",
        "type":  "function"
    },
    {
        "inputs":  [
                       {
                           "internalType":  "uint256",
                           "name":  "requestId",
                           "type":  "uint256"
                       },
                       {
                           "internalType":  "bytes",
                           "name":  "cleartexts",
                           "type":  "bytes"
                       },
                       {
                           "internalType":  "bytes",
                           "name":  "decryptionProof",
                           "type":  "bytes"
                       }
                   ],
        "name":  "onDecryptionComplete",
        "outputs":  [
                        {
                            "internalType":  "bool",
                            "name":  "",
                            "type":  "bool"
                        }
                    ],
        "stateMutability":  "nonpayable",
        "type":  "function"
    },
    {
        "inputs":  [

                   ],
        "name":  "protocolId",
        "outputs":  [
                        {
                            "internalType":  "uint256",
                            "name":  "",
                            "type":  "uint256"
                        }
                    ],
        "stateMutability":  "pure",
        "type":  "function"
    },
    {
        "inputs":  [
                       {
                           "internalType":  "uint256",
                           "name":  "gameId",
                           "type":  "uint256"
                       }
                   ],
        "name":  "requestGameDecryption",
        "outputs":  [
                        {
                            "internalType":  "uint256",
                            "name":  "requestId",
                            "type":  "uint256"
                        }
                    ],
        "stateMutability":  "nonpayable",
        "type":  "function"
    },
    {
        "inputs":  [
                       {
                           "internalType":  "uint256",
                           "name":  "gameId",
                           "type":  "uint256"
                       }
                   ],
        "name":  "resolveGame",
        "outputs":  [

                    ],
        "stateMutability":  "nonpayable",
        "type":  "function"
    },
    {
        "inputs":  [
                       {
                           "internalType":  "uint256",
                           "name":  "gameId",
                           "type":  "uint256"
                       },
                       {
                           "internalType":  "externalEuint8",
                           "name":  "encryptedMove",
                           "type":  "bytes32"
                       },
                       {
                           "internalType":  "bytes",
                           "name":  "inputProof",
                           "type":  "bytes"
                       }
                   ],
        "name":  "submitMove",
        "outputs":  [

                    ],
        "stateMutability":  "nonpayable",
        "type":  "function"
    }
]
} as const;

