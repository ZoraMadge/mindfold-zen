/*
  Contract addresses for MindfoldZen deployment
  Updated after deployment to localhost and sepolia networks
*/
export const MindfoldZenAddresses = {
  "31337": {
    address: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    chainId: 31337,
    chainName: "hardhat",
  },
  "11155111": {
    address: "0x3B367b0fA34bbE25Cc5FbEC7174264745fB80412",
    chainId: 11155111,
    chainName: "sepolia",
  },
} as const;

