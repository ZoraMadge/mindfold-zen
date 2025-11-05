import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const mindfoldZen = await deploy("MindfoldZen", {
    from: deployer,
    log: true,
  });

  console.log(`MindfoldZen contract deployed at: ${mindfoldZen.address}`);
};
export default func;
func.id = "deploy_mindfold_zen"; // id required to prevent reexecution
func.tags = ["MindfoldZen"];

