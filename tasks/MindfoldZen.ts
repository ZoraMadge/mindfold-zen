import { FhevmType } from "@fhevm/hardhat-plugin";
import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

const CONTRACT_NAME = "MindfoldZen";

task("zen:address", "Print deployed MindfoldZen address").setAction(async (_args: TaskArguments, hre) => {
  const { deployments } = hre;
  const deployment = await deployments.get(CONTRACT_NAME);
  console.log(`MindfoldZen deployed at: ${deployment.address}`);
});

task("zen:create-game", "Create a game by inviting an opponent with your encrypted move")
  .addParam("opponent", "Opponent address")
  .addParam("move", "Encrypted move in clear form (0=Attack North,1=Attack South,2=Defend North,3=Defend South)")
  .addOptionalParam("address", "Override the deployed contract address")
  .setAction(async (args: TaskArguments, hre) => {
    const { ethers, deployments, fhevm } = hre;

    const move = parseInt(args.move, 10);
    if (!Number.isInteger(move) || move < 0 || move > 3) {
      throw new Error("Move must be 0 (Attack North), 1 (Attack South), 2 (Defend North), or 3 (Defend South)");
    }

    await fhevm.initializeCLIApi();

    const deployment = args.address ? { address: args.address } : await deployments.get(CONTRACT_NAME);
    const [signer] = await ethers.getSigners();
    const contract = await ethers.getContractAt(CONTRACT_NAME, deployment.address);

    const encrypted = await fhevm.createEncryptedInput(deployment.address, signer.address).add8(move).encrypt();

    const tx = await contract
      .connect(signer)
      .createGame(encrypted.handles[0], args.opponent, encrypted.inputProof);

    console.log(`Submitted createGame tx: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`createGame confirmed in block ${receipt?.blockNumber}`);
  });

task("zen:submit-move", "Submit the opponent move for an existing game")
  .addParam("id", "Game identifier")
  .addParam("move", "Encrypted move in clear form (0=Attack North,1=Attack South,2=Defend North,3=Defend South)")
  .addOptionalParam("address", "Override the deployed contract address")
  .setAction(async (args: TaskArguments, hre) => {
    const { ethers, deployments, fhevm } = hre;

    const move = parseInt(args.move, 10);
    if (!Number.isInteger(move) || move < 0 || move > 3) {
      throw new Error("Move must be 0 (Attack North), 1 (Attack South), 2 (Defend North), or 3 (Defend South)");
    }

    const gameId = BigInt(args.id);

    await fhevm.initializeCLIApi();

    const deployment = args.address ? { address: args.address } : await deployments.get(CONTRACT_NAME);
    const [signer] = await ethers.getSigners();
    const contract = await ethers.getContractAt(CONTRACT_NAME, deployment.address);

    const encrypted = await fhevm.createEncryptedInput(deployment.address, signer.address).add8(move).encrypt();

    const tx = await contract
      .connect(signer)
      .submitMove(gameId, encrypted.handles[0], encrypted.inputProof);

    console.log(`Submitted submitMove tx: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`submitMove confirmed in block ${receipt?.blockNumber}`);
  });

task("zen:resolve", "Resolve game outcome (handles forfeits automatically)")
  .addParam("id", "Game identifier")
  .addOptionalParam("address", "Override the deployed contract address")
  .setAction(async (args: TaskArguments, hre) => {
    const { ethers, deployments } = hre;

    const gameId = BigInt(args.id);
    const deployment = args.address ? { address: args.address } : await deployments.get(CONTRACT_NAME);
    const [signer] = await ethers.getSigners();
    const contract = await ethers.getContractAt(CONTRACT_NAME, deployment.address);

    const tx = await contract.connect(signer).resolveGame(gameId);
    console.log(`Submitted resolveGame tx: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`resolveGame confirmed in block ${receipt?.blockNumber}`);
  });

task("zen:inspect", "Inspect a game and decrypt available data with the CLI wallet")
  .addParam("id", "Game identifier")
  .addOptionalParam("address", "Override the deployed contract address")
  .setAction(async (args: TaskArguments, hre) => {
    const { ethers, deployments, fhevm } = hre;

    await fhevm.initializeCLIApi();

    const gameId = BigInt(args.id);
    const deployment = args.address ? { address: args.address } : await deployments.get(CONTRACT_NAME);
    const [signer] = await ethers.getSigners();
    const contract = await ethers.getContractAt(CONTRACT_NAME, deployment.address);

    const gameData = await contract.getGame(gameId);

    console.log(`Game ${gameId.toString()} status: ${gameData.status}`);
    console.log(`Players: ${gameData.playerA} vs ${gameData.playerB}`);
    console.log(`Created at: ${gameData.createdAt}, deadline: ${gameData.deadline}`);
    console.log(`Move A submitted: ${gameData.moveASubmitted}, Move B submitted: ${gameData.moveBSubmitted}`);
    console.log(`Outcome ready: ${gameData.outcomeReady}`);
    console.log(`Decrypted: ${gameData.decrypted}`);

    const decrypt = async (type: FhevmType, handle: string) =>
      fhevm.userDecryptEuint(type, handle, deployment.address, signer);

    if (gameData.moveASubmitted) {
      const moveA = await decrypt(FhevmType.euint8, gameData.moveA);
      console.log(`Player A move (decrypted): ${moveA} (${getMoveName(moveA)})`);
    }

    if (gameData.moveBSubmitted) {
      const moveB = await decrypt(FhevmType.euint8, gameData.moveB);
      console.log(`Player B move (decrypted): ${moveB} (${getMoveName(moveB)})`);
    }

    if (gameData.outcomeReady) {
      const outcome = await decrypt(FhevmType.euint8, gameData.outcome);
      const aWins = await fhevm.userDecryptEbool(FhevmType.ebool, gameData.aWins, deployment.address, signer);
      const bWins = await fhevm.userDecryptEbool(FhevmType.ebool, gameData.bWins, deployment.address, signer);
      const isTie = await fhevm.userDecryptEbool(FhevmType.ebool, gameData.isTie, deployment.address, signer);

      console.log(`Outcome (0=Tie,1=A,2=B): ${outcome}`);
      console.log(`aWins: ${aWins}, bWins: ${bWins}, tie: ${isTie}`);
    }

    if (gameData.decrypted) {
      console.log(`\nDecrypted Results:`);
      console.log(`Player A move: ${gameData.decryptedMoveA} (${getMoveName(gameData.decryptedMoveA)})`);
      console.log(`Player B move: ${gameData.decryptedMoveB} (${getMoveName(gameData.decryptedMoveB)})`);
      console.log(`Outcome: ${gameData.decryptedOutcome} (${getOutcomeName(gameData.decryptedOutcome)})`);
    }
  });

function getMoveName(move: number): string {
  const moves = ["Attack North", "Attack South", "Defend North", "Defend South"];
  return moves[move] || "Unknown";
}

function getOutcomeName(outcome: number): string {
  const outcomes = ["Tie", "Player A Wins", "Player B Wins"];
  return outcomes[outcome] || "Unknown";
}

