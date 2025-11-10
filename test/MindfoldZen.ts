import { FhevmType } from "@fhevm/hardhat-plugin";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, fhevm } from "hardhat";

import { MindfoldZen, MindfoldZen__factory } from "../types";
import { time } from "@nomicfoundation/hardhat-network-helpers";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

async function encryptMove(
  contractAddress: string,
  signer: HardhatEthersSigner,
  move: number,
): Promise<{ handle: string; proof: string }> {
  if (move < 0 || move > 4) throw new Error("Invalid move");
  const cipher = await fhevm.createEncryptedInput(contractAddress, signer.address).add8(move).encrypt();
  return { handle: cipher.handles[0], proof: cipher.inputProof };
}

async function decryptUint8(
  contractAddress: string,
  signer: HardhatEthersSigner,
  handle: string,
): Promise<number> {
  return Number(await fhevm.userDecryptEuint(FhevmType.euint8, handle, contractAddress, signer));
}

async function decryptBool(contractAddress: string, signer: HardhatEthersSigner, handle: string): Promise<boolean> {
  return fhevm.userDecryptEbool(handle, contractAddress, signer);
}

describe("MindfoldZen", () => {
  let signers: Signers;
  let contract: MindfoldZen;
  let contractAddress: string;

  before(async function () {
    const ethSigners = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1], bob: ethSigners[2] };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn("This test suite requires the FHEVM hardhat mock environment");
      this.skip();
    }

    const factory = (await ethers.getContractFactory("MindfoldZen")) as MindfoldZen__factory;
    contract = await factory.deploy();
    contractAddress = await contract.getAddress();
  });

  it("allows opponent submission and resolves with correct outcome - Attack North vs Defend North", async () => {
    // Alice chooses Attack North (0)
    const aliceEncrypted = await encryptMove(contractAddress, signers.alice, 0);
    await contract.connect(signers.alice).createGame(signers.bob.address, aliceEncrypted.handle, aliceEncrypted.proof);

    const nextId = await contract.nextGameId();
    const gameId = nextId - 1n;

    // Bob chooses Defend North (2)
    const bobEncrypted = await encryptMove(contractAddress, signers.bob, 2);
    await contract.connect(signers.bob).submitMove(gameId, bobEncrypted.handle, bobEncrypted.proof);

    await contract.connect(signers.alice).resolveGame(gameId);

    const gameView = await contract.getGame(gameId);

    expect(gameView.outcomeReady).to.eq(true);
    expect(gameView.status).to.eq(2); // Resolved

    const outcome = await decryptUint8(contractAddress, signers.alice, gameView.outcome);
    const aWins = await decryptBool(contractAddress, signers.alice, gameView.aWins);
    const bWins = await decryptBool(contractAddress, signers.alice, gameView.bWins);
    const tie = await decryptBool(contractAddress, signers.alice, gameView.isTie);

    expect(outcome).to.eq(1); // Player A wins (Attack beats Defend in same direction)
    expect(aWins).to.eq(true);
    expect(bWins).to.eq(false);
    expect(tie).to.eq(false);
  });

  it("records ties correctly when both players choose same move", async () => {
    // Alice chooses Attack North (0)
    const aliceEncrypted = await encryptMove(contractAddress, signers.alice, 0);
    await contract.connect(signers.alice).createGame(signers.bob.address, aliceEncrypted.handle, aliceEncrypted.proof);

    const gameId = (await contract.nextGameId()) - 1n;

    // Bob chooses Attack North (0) - same as Alice
    const bobEncrypted = await encryptMove(contractAddress, signers.bob, 0);
    await contract.connect(signers.bob).submitMove(gameId, bobEncrypted.handle, bobEncrypted.proof);

    await contract.connect(signers.bob).resolveGame(gameId);

    const gameView = await contract.getGame(gameId);

    const outcome = await decryptUint8(contractAddress, signers.alice, gameView.outcome);
    const tie = await decryptBool(contractAddress, signers.alice, gameView.isTie);

    expect(outcome).to.eq(0); // Tie
    expect(tie).to.eq(true);
  });

  it("handles Attack South vs Defend South correctly - Player A wins", async () => {
    // Alice chooses Attack South (1)
    const aliceEncrypted = await encryptMove(contractAddress, signers.alice, 1);
    await contract.connect(signers.alice).createGame(signers.bob.address, aliceEncrypted.handle, aliceEncrypted.proof);

    const gameId = (await contract.nextGameId()) - 1n;

    // Bob chooses Defend South (3)
    const bobEncrypted = await encryptMove(contractAddress, signers.bob, 3);
    await contract.connect(signers.bob).submitMove(gameId, bobEncrypted.handle, bobEncrypted.proof);

    await contract.connect(signers.alice).resolveGame(gameId);

    const gameView = await contract.getGame(gameId);
    const outcome = await decryptUint8(contractAddress, signers.alice, gameView.outcome);
    const aWins = await decryptBool(contractAddress, signers.alice, gameView.aWins);

    expect(outcome).to.eq(1); // Player A wins
    expect(aWins).to.eq(true);
  });

  it("handles Defend North vs Attack North correctly - Player B wins", async () => {
    // Alice chooses Defend North (2)
    const aliceEncrypted = await encryptMove(contractAddress, signers.alice, 2);
    await contract.connect(signers.alice).createGame(signers.bob.address, aliceEncrypted.handle, aliceEncrypted.proof);

    const gameId = (await contract.nextGameId()) - 1n;

    // Bob chooses Attack North (0)
    const bobEncrypted = await encryptMove(contractAddress, signers.bob, 0);
    await contract.connect(signers.bob).submitMove(gameId, bobEncrypted.handle, bobEncrypted.proof);

    await contract.connect(signers.alice).resolveGame(gameId);

    const gameView = await contract.getGame(gameId);
    const outcome = await decryptUint8(contractAddress, signers.alice, gameView.outcome);
    const bWins = await decryptBool(contractAddress, signers.alice, gameView.bWins);

    expect(outcome).to.eq(2); // Player B wins
    expect(bWins).to.eq(true);
  });

  /*
  it("handles forfeits when opponent misses the deadline", async () => {
    const aliceEncrypted = await encryptMove(contractAddress, signers.alice, 1); // Attack South
    await contract.connect(signers.alice).createGame(signers.bob.address, aliceEncrypted.handle, aliceEncrypted.proof);

    const gameId = (await contract.nextGameId()) - 1n;

    // Fast-forward past deadline (> 3 minutes)
    await ethers.provider.send("evm_increaseTime", [181]);
    await ethers.provider.send("evm_mine", []);

    await contract.connect(signers.alice).resolveGame(gameId);

    const gameView = await contract.getGame(gameId);
    const outcome = await decryptUint8(contractAddress, signers.alice, gameView.outcome);

    expect(gameView.outcomeReady).to.eq(true);
    expect(outcome).to.eq(1); // Player A wins by default
  });
  */

  /*
  it("should allow cancelling expired games", async function () {
    const aliceMove = await encryptMove(contractAddress, signers.alice, 0); // Attack North
    const tx = await contract.connect(signers.alice).createGame(
      signers.bob.address,
      aliceMove.handle,
      aliceMove.proof
    );
    const receipt = await tx.wait();
    
    // Extract gameId from event
    const gameCreatedEvent = receipt?.logs.find(
      (log: any) => log.topics[0] === ethers.id("GameCreated(uint256,address,address,uint256)")
    );
    const gameId = BigInt(gameCreatedEvent?.topics[1] || "0");

    // Fast forward time past the match timeout (10 minutes + 1 second)
    await time.increase(10 * 60 + 1);

    // Cancel the expired game
    await contract.connect(signers.alice).cancelExpiredGame(gameId);

    const gameView = await contract.getGame(gameId);
    expect(gameView.status).to.eq(3); // Cancelled status
  });
  */

  it("should return player games list", async () => {
    const aliceEncrypted = await encryptMove(contractAddress, signers.alice, 0);
    await contract.connect(signers.alice).createGame(signers.bob.address, aliceEncrypted.handle, aliceEncrypted.proof);

    const gameId1 = (await contract.nextGameId()) - 1n;

    const aliceEncrypted2 = await encryptMove(contractAddress, signers.alice, 1);
    await contract.connect(signers.alice).createGame(signers.bob.address, aliceEncrypted2.handle, aliceEncrypted2.proof);

    const gameId2 = (await contract.nextGameId()) - 1n;

    const aliceGames = await contract.getPlayerGames(signers.alice.address);
    const bobGames = await contract.getPlayerGames(signers.bob.address);

    expect(aliceGames.length).to.be.gte(2);
    expect(bobGames.length).to.be.gte(2);
    expect(aliceGames).to.include(gameId1);
    expect(aliceGames).to.include(gameId2);
  });
});

