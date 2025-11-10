import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm, deployments } from "hardhat";
import { MindfoldZen } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  alice: HardhatEthersSigner;
};

describe("MindfoldZenSepolia", function () {
  let signers: Signers;
  let contract: MindfoldZen;
  let contractAddress: string;
  let step: number;
  let steps: number;

  function progress(message: string) {
    console.log(`${++step}/${steps} ${message}`);
  }

  before(async function () {
    if (fhevm.isMock) {
      console.warn(`This hardhat test suite can only run on Sepolia Testnet`);
      this.skip();
    }

    try {
      const MindfoldZenDeployment = await deployments.get("MindfoldZen");
      contractAddress = MindfoldZenDeployment.address;
      contract = await ethers.getContractAt("MindfoldZen", MindfoldZenDeployment.address);
    } catch (e) {
      (e as Error).message += ". Call 'npx hardhat deploy --network sepolia'";
      throw e;
    }

    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { alice: ethSigners[0] };
  });

  beforeEach(async () => {
    step = 0;
    steps = 0;
  });

  it("create game and submit move", async function () {
    steps = 10;

    this.timeout(4 * 40000);

    progress("Encrypting move '0' (Attack North)...");
    const encryptedMove = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add8(0)
      .encrypt();

    // Get a second signer for opponent
    const signersList = await ethers.getSigners();
    const opponent = signersList[1];

    progress(
      `Call createGame() MindfoldZen=${contractAddress} handle=${ethers.hexlify(encryptedMove.handles[0])} signer=${signers.alice.address}...`,
    );
    let tx = await contract
      .connect(signers.alice)
      .createGame(opponent.address, encryptedMove.handles[0], encryptedMove.inputProof);
    await tx.wait();

    progress(`Get nextGameId...`);
    const nextGameId = await contract.nextGameId();
    const gameId = nextGameId - 1n;

    progress(`Encrypting opponent move '2' (Defend North)...`);
    const encryptedOpponentMove = await fhevm
      .createEncryptedInput(contractAddress, opponent.address)
      .add8(2)
      .encrypt();

    progress(
      `Call submitMove() gameId=${gameId} handle=${ethers.hexlify(encryptedOpponentMove.handles[0])} signer=${opponent.address}...`,
    );
    tx = await contract
      .connect(opponent)
      .submitMove(gameId, encryptedOpponentMove.handles[0], encryptedOpponentMove.inputProof);
    await tx.wait();

    progress(`Call resolveGame() gameId=${gameId}...`);
    tx = await contract.connect(signers.alice).resolveGame(gameId);
    await tx.wait();

    progress(`Call getGame() gameId=${gameId}...`);
    const gameView = await contract.getGame(gameId);
    expect(gameView.outcomeReady).to.eq(true);

    progress(`Decrypting game outcome...`);
    const outcome = await fhevm.userDecryptEuint(
      FhevmType.euint8,
      gameView.outcome,
      contractAddress,
      signers.alice,
    );
    progress(`Clear outcome=${outcome}`);

    expect(outcome).to.eq(1); // Player A should win (Attack North beats Defend North)
  });
});

