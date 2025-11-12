// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {
    FHE,
    ebool,
    euint8,
    euint32,
    externalEuint8
} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title MindfoldZen - Privacy-preserving strategy game
/// @notice Enables two players to compete using homomorphically encrypted moves with commit-reveal mechanism
/// @dev Main contract for privacy-preserving strategy game with 4 moves: Attack North, Attack South, Defend North, Defend South
contract MindfoldZen is SepoliaConfig {
    uint256 public constant INVITATION_TIMEOUT = 3 minutes;
    uint256 public constant MATCH_TIMEOUT = 10 minutes;

// Move encoding: 0 = Attack North, 1 = Attack South, 2 = Defend North, 3 = Defend South
uint8 private constant MOVE_ATTACK_NORTH = 0;
uint8 private constant MOVE_ATTACK_SOUTH = 1;
uint8 private constant MOVE_DEFEND_NORTH = 2;
uint8 private constant MOVE_DEFEND_SOUTH = 3;

    // Result encoding: 0 = Tie, 1 = Player A wins, 2 = Player B wins
    uint8 private constant RESULT_TIE = 0;
    uint8 private constant RESULT_A_WINS = 1;
    uint8 private constant RESULT_B_WINS = 2;

    enum GameStatus {
        WaitingForOpponent,
        WaitingForResolution,
        Resolved,
        Cancelled
    }

    struct EncryptedMove {
        euint8 value;
        bool submitted;
        uint256 submittedAt;
    }

    struct Game {
        address playerA;
        address playerB;
        uint256 createdAt;
        uint256 deadline;
        GameStatus status;
        EncryptedMove moveA;
        EncryptedMove moveB;
        euint8 encryptedOutcome;
        ebool aWins;
        ebool bWins;
        ebool isTie;
        bool outcomeComputed;
        uint256 decryptionRequestId;
        bool decryptionRequested;
        uint8 decryptedMoveA;
        uint8 decryptedMoveB;
        uint8 decryptedOutcome;
        bool decrypted;
    }

    struct GameView {
        address playerA;
        address playerB;
        uint256 createdAt;
        uint256 deadline;
        GameStatus status;
        bool moveASubmitted;
        bool moveBSubmitted;
        euint8 moveA;
        euint8 moveB;
        bool outcomeReady;
        euint8 outcome;
        ebool aWins;
        ebool bWins;
        ebool isTie;
        bool decrypted;
        uint8 decryptedMoveA;
        uint8 decryptedMoveB;
        uint8 decryptedOutcome;
    }

    uint256 public nextGameId;
    mapping(uint256 => Game) private _games;
    mapping(uint256 => uint256) private _requestToGame;
    mapping(address => uint256[]) private _playerGames;

    event GameCreated(uint256 indexed gameId, address indexed playerA, address indexed playerB, uint256 deadline);
    event MoveSubmitted(uint256 indexed gameId, address indexed player, bool isSecondMove);
    event GameResolved(
        uint256 indexed gameId,
        euint8 encryptedOutcome,
        ebool aWins,
        ebool bWins,
        ebool isTie
    );
    event ForfeitProcessed(uint256 indexed gameId, address indexed forfeitingPlayer);
    event GameCancelled(uint256 indexed gameId);
    event DecryptionRequested(uint256 indexed gameId, uint256 requestId);
    event GameDecrypted(uint256 indexed gameId, uint8 moveA, uint8 moveB, uint8 outcome);

    modifier gameExists(uint256 gameId) {
        require(gameId < nextGameId, "MindfoldZen: game does not exist");
        _;
    }

    /// @notice Creates a game by inviting an opponent with the caller's encrypted move
    /// @param opponent The address of the opponent to invite
    /// @param encryptedMove The encrypted move (0-3)
    /// @param inputProof The input proof for the encrypted move
    /// @return gameId The ID of the created game
    function createGame(
        address opponent,
        externalEuint8 encryptedMove,
        bytes calldata inputProof
    ) external returns (uint256 gameId) {
        require(opponent != address(0), "MindfoldZen: invalid opponent");
        require(opponent != msg.sender, "MindfoldZen: opponent cannot be self");

        gameId = nextGameId++;

        Game storage g = _games[gameId];
        g.playerA = msg.sender;
        g.playerB = opponent;
        g.createdAt = block.timestamp;
        g.deadline = block.timestamp + INVITATION_TIMEOUT;
        g.status = GameStatus.WaitingForOpponent;

        euint8 move = FHE.fromExternal(encryptedMove, inputProof);
        g.moveA = EncryptedMove({value: move, submitted: true, submittedAt: block.timestamp});

        _allowMoveForParticipants(move, msg.sender, opponent);

        _playerGames[msg.sender].push(gameId);
        _playerGames[opponent].push(gameId);

        emit GameCreated(gameId, msg.sender, opponent, g.deadline);
        emit MoveSubmitted(gameId, msg.sender, false);
    }

    /// @notice Allows the opponent to submit their encrypted move
    /// @param gameId The ID of the game
    /// @param encryptedMove The encrypted move (0-3)
    /// @param inputProof The input proof for the encrypted move
    function submitMove(
        uint256 gameId,
        externalEuint8 encryptedMove,
        bytes calldata inputProof
    ) external gameExists(gameId) {
        Game storage g = _games[gameId];
        require(g.status == GameStatus.WaitingForOpponent, "MindfoldZen: game not accepting moves");
        require(msg.sender == g.playerB, "MindfoldZen: only designated opponent");
        require(block.timestamp <= g.deadline, "MindfoldZen: submission window closed");
        require(!g.moveB.submitted, "MindfoldZen: move already submitted");

        euint8 move = FHE.fromExternal(encryptedMove, inputProof);
        g.moveB = EncryptedMove({value: move, submitted: true, submittedAt: block.timestamp});
        g.status = GameStatus.WaitingForResolution;
        g.deadline = block.timestamp + INVITATION_TIMEOUT; // Extend deadline for resolution

        _allowMoveForParticipants(move, g.playerA, g.playerB);

        emit MoveSubmitted(gameId, msg.sender, true);
    }

    /// @notice Resolves a game by computing the encrypted outcome. Handles forfeits automatically.
    /// @param gameId The ID of the game to resolve
    function resolveGame(uint256 gameId) external gameExists(gameId) {
        Game storage g = _games[gameId];
        require(
            g.status == GameStatus.WaitingForResolution || g.status == GameStatus.WaitingForOpponent,
            "MindfoldZen: nothing to resolve"
        );
        require(!g.outcomeComputed, "MindfoldZen: outcome already computed");

        // Check if opponent didn't submit within timeout
        if (!g.moveB.submitted) {
            require(block.timestamp > g.deadline, "MindfoldZen: opponent still has time");

            // Player A wins by forfeit
            euint8 placeholder = FHE.asEuint8(255);
            g.moveB = EncryptedMove({value: placeholder, submitted: false, submittedAt: 0});
            _allowMoveForParticipants(placeholder, g.playerA, g.playerB);

            ebool forfeitAWins = FHE.asEbool(true);
            ebool forfeitBWins = FHE.asEbool(false);
            ebool forfeitTie = FHE.asEbool(false);
            euint8 forfeitOutcome = FHE.asEuint8(RESULT_A_WINS);

            _finalizeOutcome(gameId, g, forfeitOutcome, forfeitAWins, forfeitBWins, forfeitTie);

            emit ForfeitProcessed(gameId, g.playerB);
            return;
        }

        // Both moves submitted, compute outcome
        (euint8 outcome, ebool isTie, ebool aWins, ebool bWins) = _computeOutcome(g.moveA.value, g.moveB.value);

        _finalizeOutcome(gameId, g, outcome, aWins, bWins, isTie);
    }

    /// @notice Cancel a game that has exceeded the timeout period
    /// @param gameId The ID of the game to cancel
    function cancelExpiredGame(uint256 gameId) external gameExists(gameId) {
        Game storage g = _games[gameId];
        require(
            g.status == GameStatus.WaitingForOpponent || g.status == GameStatus.WaitingForResolution,
            "MindfoldZen: game already finalized"
        );
        require(block.timestamp > g.createdAt + MATCH_TIMEOUT, "MindfoldZen: game not expired yet");

        g.status = GameStatus.Cancelled;
        emit GameCancelled(gameId);
    }

    /// @notice Requests decryption of both moves and the outcome via the FHE oracle
    /// @param gameId The ID of the game
    /// @return requestId The decryption request ID
    function requestGameDecryption(uint256 gameId) external gameExists(gameId) returns (uint256 requestId) {
        Game storage g = _games[gameId];
        require(g.outcomeComputed, "MindfoldZen: outcome not ready");
        require(!g.decryptionRequested, "MindfoldZen: decryption already requested");

        bytes32[] memory handles = new bytes32[](3);
        handles[0] = FHE.toBytes32(g.moveA.value);
        handles[1] = FHE.toBytes32(g.moveB.value);
        handles[2] = FHE.toBytes32(g.encryptedOutcome);

        requestId = FHE.requestDecryption(handles, this.onDecryptionComplete.selector);
        g.decryptionRequestId = requestId;
        g.decryptionRequested = true;
        _requestToGame[requestId] = gameId;

        emit DecryptionRequested(gameId, requestId);
    }

    /// @notice Callback executed when decrypted plaintexts are ready
    /// @param requestId The decryption request ID
    /// @param cleartexts The decrypted values
    /// @param decryptionProof The decryption proof
    /// @return success Whether the decryption was successful
    function onDecryptionComplete(
        uint256 requestId,
        bytes calldata cleartexts,
        bytes calldata decryptionProof
    ) external returns (bool) {
        uint256 gameId = _requestToGame[requestId];
        Game storage g = _games[gameId];
        require(g.decryptionRequested, "MindfoldZen: invalid request");

        FHE.checkSignatures(requestId, cleartexts, decryptionProof);

        (uint8 moveA, uint8 moveB, uint8 outcome) = abi.decode(cleartexts, (uint8, uint8, uint8));
        
        g.decryptedMoveA = moveA;
        g.decryptedMoveB = moveB;
        g.decryptedOutcome = outcome;
        g.decrypted = true;

        emit GameDecrypted(gameId, moveA, moveB, outcome);
        return true;
    }

    /// @notice Retrieves a view of the game, including encrypted state
    /// @param gameId The ID of the game
    /// @return A GameView struct with game information
    function getGame(uint256 gameId) external view gameExists(gameId) returns (GameView memory) {
        Game storage g = _games[gameId];
        return
            GameView({
                playerA: g.playerA,
                playerB: g.playerB,
                createdAt: g.createdAt,
                deadline: g.deadline,
                status: g.status,
                moveASubmitted: g.moveA.submitted,
                moveBSubmitted: g.moveB.submitted,
                moveA: g.moveA.value,
                moveB: g.moveB.value,
                outcomeReady: g.outcomeComputed,
                outcome: g.encryptedOutcome,
                aWins: g.aWins,
                bWins: g.bWins,
                isTie: g.isTie,
                decrypted: g.decrypted,
                decryptedMoveA: g.decryptedMoveA,
                decryptedMoveB: g.decryptedMoveB,
                decryptedOutcome: g.decryptedOutcome
            });
    }

    /// @notice Gets all game IDs for a player
    /// @param player The address of the player
    /// @return An array of game IDs
    function getPlayerGames(address player) external view returns (uint256[] memory) {
        return _playerGames[player];
    }

    /// @notice Computes the game outcome based on encrypted moves
    /// @param moveA Player A's encrypted move
    /// @param moveB Player B's encrypted move
    /// @return outcome The encrypted outcome (0=tie, 1=A wins, 2=B wins)
    /// @return isTie Whether the result is a tie
    /// @return aWins Whether player A wins
    /// @return bWins Whether player B wins
    function _computeOutcome(
        euint8 moveA,
        euint8 moveB
    ) private returns (euint8 outcome, ebool isTie, ebool aWins, ebool bWins) {
        // Check if moves are the same (tie)
        ebool sameMove = FHE.eq(moveA, moveB);

        // Check if A attacks (0 or 1)
        ebool aAttacksNorth = FHE.eq(moveA, MOVE_ATTACK_NORTH);
        ebool aAttacksSouth = FHE.eq(moveA, MOVE_ATTACK_SOUTH);
        ebool aAttacks = FHE.or(aAttacksNorth, aAttacksSouth);

        // Check if B attacks (0 or 1)
        ebool bAttacksNorth = FHE.eq(moveB, MOVE_ATTACK_NORTH);
        ebool bAttacksSouth = FHE.eq(moveB, MOVE_ATTACK_SOUTH);
        ebool bAttacks = FHE.or(bAttacksNorth, bAttacksSouth);

        // Check if A defends (2 or 3)
        ebool aDefendsNorth = FHE.eq(moveA, MOVE_DEFEND_NORTH);
        ebool aDefendsSouth = FHE.eq(moveA, MOVE_DEFEND_SOUTH);
        ebool aDefends = FHE.or(aDefendsNorth, aDefendsSouth);

        // Check if B defends (2 or 3)
        ebool bDefendsNorth = FHE.eq(moveB, MOVE_DEFEND_NORTH);
        ebool bDefendsSouth = FHE.eq(moveB, MOVE_DEFEND_SOUTH);
        ebool bDefends = FHE.or(bDefendsNorth, bDefendsSouth);

        // New win conditions:
        // 1. If A attacks North and B does NOT defend North -> A wins
        // 2. If A attacks North and B defends North -> B wins
        // 3. If A attacks South and B does NOT defend South -> A wins
        // 4. If A attacks South and B defends South -> B wins
        // 5. If both attack different directions -> tie
        // 6. If both defend -> tie

        // A wins if:
        // - (A attacks North AND B does NOT defend North) OR
        // - (A attacks South AND B does NOT defend South)
        ebool aWinsByAttackNorth = FHE.and(aAttacksNorth, FHE.not(bDefendsNorth));
        ebool aWinsByAttackSouth = FHE.and(aAttacksSouth, FHE.not(bDefendsSouth));
        ebool aWinsCondition = FHE.or(aWinsByAttackNorth, aWinsByAttackSouth);

        // B wins if:
        // - (A attacks North AND B defends North) OR
        // - (A attacks South AND B defends South) OR
        // - (B attacks North AND A does NOT defend North) OR
        // - (B attacks South AND A does NOT defend South)
        ebool bWinsByDefendingA = FHE.or(
            FHE.and(aAttacksNorth, bDefendsNorth),
            FHE.and(aAttacksSouth, bDefendsSouth)
        );
        ebool bWinsByAttackNorth = FHE.and(bAttacksNorth, FHE.not(aDefendsNorth));
        ebool bWinsByAttackSouth = FHE.and(bAttacksSouth, FHE.not(aDefendsSouth));
        ebool bWinsCondition = FHE.or(FHE.or(bWinsByDefendingA, bWinsByAttackNorth), bWinsByAttackSouth);

        // Tie conditions:
        // - Same move
        // - Both attack different directions (A attacks and B attacks but different)
        // - Both defend (regardless of direction)
        ebool bothAttackDifferent = FHE.and(
            aAttacks,
            FHE.and(bAttacks, FHE.not(sameMove))
        );
        ebool bothDefend = FHE.and(aDefends, bDefends);
        isTie = FHE.or(FHE.or(sameMove, bothAttackDifferent), bothDefend);

        // Determine winner (not a tie)
        aWins = FHE.select(isTie, FHE.asEbool(false), aWinsCondition);
        bWins = FHE.select(isTie, FHE.asEbool(false), bWinsCondition);

        // Set outcome
        outcome = FHE.select(
            isTie,
            FHE.asEuint8(RESULT_TIE),
            FHE.select(aWins, FHE.asEuint8(RESULT_A_WINS), FHE.asEuint8(RESULT_B_WINS))
        );
    }

    /// @notice Finalizes the game outcome and updates permissions
    /// @param gameId The ID of the game
    /// @param g The game storage reference
    /// @param outcome The encrypted outcome
    /// @param aWins Whether player A wins
    /// @param bWins Whether player B wins
    /// @param isTie Whether the result is a tie
    function _finalizeOutcome(
        uint256 gameId,
        Game storage g,
        euint8 outcome,
        ebool aWins,
        ebool bWins,
        ebool isTie
    ) private {
        g.encryptedOutcome = outcome;
        g.aWins = aWins;
        g.bWins = bWins;
        g.isTie = isTie;
        g.outcomeComputed = true;
        g.status = GameStatus.Resolved;

        _grantOutcomePermissions(g);
        emit GameResolved(gameId, outcome, aWins, bWins, isTie);
    }

    /// @notice Grants decryption permissions for outcome to both players
    /// @param g The game storage reference
    function _grantOutcomePermissions(Game storage g) private {
        address playerA = g.playerA;
        address playerB = g.playerB;

        FHE.allowThis(g.encryptedOutcome);
        FHE.allowThis(g.aWins);
        FHE.allowThis(g.bWins);
        FHE.allowThis(g.isTie);

        FHE.allow(g.encryptedOutcome, playerA);
        FHE.allow(g.encryptedOutcome, playerB);
        FHE.allow(g.aWins, playerA);
        FHE.allow(g.aWins, playerB);
        FHE.allow(g.bWins, playerA);
        FHE.allow(g.bWins, playerB);
        FHE.allow(g.isTie, playerA);
        FHE.allow(g.isTie, playerB);
    }

    /// @notice Grants decryption permissions for moves to both players
    /// @param move The encrypted move
    /// @param playerA Player A's address
    /// @param playerB Player B's address
    function _allowMoveForParticipants(euint8 move, address playerA, address playerB) private {
        FHE.allowThis(move);
        FHE.allow(move, playerA);
        FHE.allow(move, playerB);
    }
}

