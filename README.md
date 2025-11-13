# Mindfold Zen

A privacy-preserving strategy game built on Ethereum using **Zama's FHEVM (Fully Homomorphic Encryption Virtual Machine)** technology. Mindfold Zen enables completely confidential gameplay where moves remain encrypted throughout the entire process, ensuring privacy and fairness for all participants.

## 🌐 Live Demo

- **Vercel Deployment**: [https://mindfold-zen.vercel.app/](https://mindfold-zen.vercel.app/)
- **Video Demo**: See `mindfold-zen.mp4` in the project root for a complete walkthrough

## 📍 Contract Addresses

### Local Network (Hardhat)
- **Chain ID**: 31337
- **Contract Address**: `0x5FbDB2315678afecb367f032d93F642f64180aa3`
- **Network**: Hardhat Local Node

### Sepolia Testnet
- **Chain ID**: 11155111
- **Contract Address**: `0x3B367b0fA34bbE25Cc5FbEC7174264745fB80412`
- **Network**: Sepolia Testnet
- **Explorer**: [View on Etherscan](https://sepolia.etherscan.io/address/0x3B367b0fA34bbE25Cc5FbEC7174264745fB80412)

## 🚀 Overview

Mindfold Zen revolutionizes blockchain gaming by implementing **end-to-end encryption** at the smart contract level. Unlike traditional games where moves can be monitored, our platform ensures that:

- **Moves remain completely confidential** until both players have committed
- **No participant can see others' moves**, eliminating reactive play
- **Only the final outcome is revealed** after game completion
- **All computations are performed on encrypted data** without ever exposing sensitive information

## 🎯 Key Features

### 🔒 **Privacy-First Architecture**
- **Encrypted Moves**: All moves are encrypted using FHEVM's homomorphic encryption
- **Confidential Game State**: Game state verification without revealing moves
- **Hidden Strategy**: Participants cannot see opponent moves until resolution
- **Secure State Management**: All game state transitions maintain privacy

### ⚡ **Real-Time Game Mechanics**
- **3-Minute Response Window**: Players have 3 minutes to respond to invitations
- **Automatic Game Resolution**: Games resolve when both moves are submitted or timeout
- **Fair Competition**: Equal opportunity for all participants without information asymmetry

### 🎮 **Game Rules**
- **4 Moves Available**:
  - `0` = Attack North ⚔️
  - `1` = Attack South 🎯
  - `2` = Defend North 🛡️
  - `3` = Defend South ⚡

- **Win Conditions**:
  - **You Win If:**
    - You attack a direction (North or South) and your opponent does **not** defend that same direction
    - Your opponent attacks a direction and you defend that same direction
  - **Tie If:**
    - Both players choose the exact same move
    - Both players attack, but in different directions
    - Both players defend (regardless of direction)

## 📁 Project Structure

```
project/mindfold-zen/
├── contracts/          # Solidity smart contracts
│   └── MindfoldZen.sol
├── test/               # Contract tests
│   ├── MindfoldZen.ts
│   └── MindfoldZenSepolia.ts
├── deploy/            # Deployment scripts
│   └── deploy.ts
├── tasks/             # Hardhat tasks
│   ├── accounts.ts
│   └── MindfoldZen.ts
├── ui/                # Frontend application
│   ├── src/
│   │   ├── pages/     # Page components
│   │   ├── components/ # UI components
│   │   └── hooks/     # Custom hooks
│   └── package.json
└── package.json       # Contract dependencies
```

## 🛠️ Setup Instructions

### Prerequisites
- Node.js >= 20
- npm >= 7.0.0
- Hardhat local network or Sepolia testnet access

### Contract Setup

1. **Install dependencies:**
   ```bash
   cd project/mindfold-zen
   npm install
   ```

2. **Compile contracts:**
   ```bash
   npm run compile
   ```

3. **Run tests:**
   ```bash
   npm test
   ```

4. **Deploy to local network:**
   ```bash
   npx hardhat node
   # In another terminal
   npx hardhat deploy --network localhost
   ```

5. **Deploy to Sepolia:**
   ```bash
   npx hardhat deploy --network sepolia
   ```

### Frontend Setup

1. **Navigate to UI directory:**
   ```bash
   cd ui
   npm install
   ```

2. **Set environment variables:**
   Create a `.env` file:
   ```
   VITE_WALLETCONNECT_PROJECT_ID=your_project_id
   ```

3. **Update contract addresses:**
   After deployment, update the contract addresses in `ui/src/abi/MindfoldZenAddresses.ts`

4. **Start development server:**
   ```bash
   npm run dev
   ```

## 🎮 Game Flow

### Phase 1: Selection Phase
Players choose from 4 moves:
- Attack North ⚔️
- Attack South 🎯
- Defend North 🛡️
- Defend South ⚡

### Phase 2: Commitment Phase
- Player A invites Player B with encrypted move
- Player B receives invitation and submits encrypted move
- Both moves are encrypted and stored on-chain

### Phase 3: Revelation Phase
- Once both moves are submitted, game resolves automatically
- Outcome is computed on encrypted data
- Decryption is requested for both players

### Phase 4: Resolution Phase
- Moves and outcome are decrypted
- Results are displayed to both players
- Game history is updated

## 🧪 Testing

### Local Testing
```bash
npm test
```

### Sepolia Testnet Testing
```bash
npm run test:sepolia
```

### Hardhat Tasks
```bash
# Get contract address
npx hardhat zen:address

# Create a game
npx hardhat zen:create-game --opponent <address> --move <0-3>

# Submit move
npx hardhat zen:submit-move --id <gameId> --move <0-3>

# Resolve game
npx hardhat zen:resolve --id <gameId>

# Inspect game
npx hardhat zen:inspect --id <gameId>
```

## 📝 Contract Functions

### Main Functions
- `createGame(opponent, encryptedMove, inputProof)` - Create a game by inviting an opponent with encrypted move
- `submitMove(gameId, encryptedMove, inputProof)` - Submit encrypted move as opponent
- `resolveGame(gameId)` - Resolve game outcome (computes on encrypted data)
- `requestGameDecryption(gameId)` - Request decryption of game results via FHE oracle
- `getGame(gameId)` - Get game view with encrypted state
- `getPlayerGames(player)` - Get all game IDs for a player

### Contract Code Structure

The main contract `MindfoldZen.sol` implements:

```solidity
// Move encoding
uint8 private constant MOVE_ATTACK_NORTH = 0;
uint8 private constant MOVE_ATTACK_SOUTH = 1;
uint8 private constant MOVE_DEFEND_NORTH = 2;
uint8 private constant MOVE_DEFEND_SOUTH = 3;

// Result encoding
uint8 private constant RESULT_TIE = 0;
uint8 private constant RESULT_A_WINS = 1;
uint8 private constant RESULT_B_WINS = 2;
```

**Key Data Structures:**
- `Game`: Stores encrypted moves (`euint8`), encrypted outcome, and decryption status
- `EncryptedMove`: Contains encrypted move value (`euint8`), submission status, and timestamp
- `GameView`: Public view of game state with encrypted fields

**Core Logic:**
- All moves are stored as `euint8` (encrypted uint8) using FHEVM
- Game outcome is computed entirely on encrypted data using homomorphic operations
- Decryption is permission-based: only game participants can decrypt results

## 🔐 Security Features

- **FHE Encryption**: All moves encrypted using Zama's FHEVM
- **Commit-Reveal Scheme**: Prevents reactive play
- **Timeout Protection**: Games auto-resolve if opponent doesn't respond (3-minute invitation timeout)
- **Permission-Based Decryption**: Only game participants can decrypt results
- **Homomorphic Computation**: Game outcomes computed on encrypted data without decryption

## 🔓 Encryption & Decryption Logic

### Encryption Flow

1. **Move Encryption (Frontend)**:
   ```typescript
   // Create encrypted input using FHEVM instance
   const input = instance.createEncryptedInput(contractAddress, userAddress);
   input.add8(move); // Add move (0-3) as encrypted uint8
   const encrypted = input.encrypt(); // Returns handles and inputProof
   ```

2. **On-Chain Storage**:
   - Encrypted moves stored as `euint8` in contract
   - Contract grants decryption permissions to both players via `FHE.allow()`
   - Moves remain encrypted throughout game lifecycle

3. **Homomorphic Computation**:
   ```solidity
   // All comparisons done on encrypted data
   ebool aAttacksNorth = FHE.eq(moveA, MOVE_ATTACK_NORTH);
   ebool bDefendsNorth = FHE.eq(moveB, MOVE_DEFEND_NORTH);
   
   // Outcome computed without decryption
   ebool aWins = FHE.and(aAttacksNorth, FHE.not(bDefendsNorth));
   ```

### Decryption Flow

1. **Request Decryption**:
   ```solidity
   // Contract requests decryption via FHE oracle
   bytes32[] memory handles = [moveA, moveB, outcome];
   requestId = FHE.requestDecryption(handles, callback);
   ```

2. **Oracle Processing**:
   - FHE oracle decrypts the handles
   - Validates decryption signatures
   - Calls `onDecryptionComplete()` callback

3. **Client-Side Decryption (Alternative)**:
   ```typescript
   // User can decrypt using FHEVM instance
   const signature = await FhevmDecryptionSignature.loadOrSign(
     instance, [contractAddress], signer, storage
   );
   const decrypted = await instance.userDecrypt(
     handles, signature.privateKey, signature.publicKey, ...
   );
   ```

4. **Permission System**:
   - Only game participants (`playerA` and `playerB`) can decrypt
   - Permissions granted via `FHE.allow(move, playerAddress)`
   - Contract itself has permission via `FHE.allowThis()`

### Key Security Properties

- **Zero-Knowledge**: Moves never exposed on-chain in plaintext
- **Homomorphic Operations**: All game logic runs on encrypted data
- **Selective Decryption**: Only authorized parties can decrypt
- **Commit-Reveal**: Moves committed before opponent sees them

## 🚀 Deployment

### Local Network
1. Start Hardhat node: `npx hardhat node`
2. Deploy: `npx hardhat deploy --network localhost`
3. Contract will be deployed at: `0x5FbDB2315678afecb367f032d93F642f64180aa3`
4. Update frontend contract addresses in `ui/src/abi/MindfoldZenAddresses.ts` (already configured)

### Sepolia Testnet
1. Set up environment variables:
   ```bash
   export PRIVATE_KEY=your_private_key
   export INFURA_API_KEY=your_infura_key
   export ETHERSCAN_API_KEY=your_etherscan_key
   ```
2. Deploy: `npx hardhat deploy --network sepolia`
3. Contract deployed at: `0x3B367b0fA34bbE25Cc5FbEC7174264745fB80412`
4. Verify contract: `npx hardhat verify --network sepolia 0x3B367b0fA34bbE25Cc5FbEC7174264745fB80412`

## 📄 License

MIT

## 📚 Additional Resources

- **Contract Source**: `contracts/MindfoldZen.sol`
- **Frontend Code**: `ui/src/`
- **Test Files**: `test/MindfoldZen.ts`, `test/MindfoldZenSepolia.ts`
- **Video Demo**: `mindfold-zen.mp4` (in project root)

## 🚀 Future Enhancements

- Implement tournament brackets for multiple rounds
- Add leaderboard and player statistics
- Integrate with more wallet providers
- Add real-time notifications for game events
- Support for custom game rules and variants

## 🙏 Acknowledgments

- Built with [Zama's FHEVM](https://github.com/zama-ai/fhevm)
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- Wallet integration via [RainbowKit](https://rainbowkit.com/)
- Deployed on [Vercel](https://vercel.com/)

