// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import moment from "moment";
import _ from "lodash";
const fs = require("fs");
const chalk = require("chalk");
const { ethers } = require("hardhat");
const { utils } = require("ethers");
const R = require("ramda");

const configs = {
  token: {
    totalSupply: Math.pow(10, 4),
  },
  vendor: {
    buyPricePerBNB: 100,
    sellPricePerBNB: 100
  },
  ownerShipAddress: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  voting: {
    startingAt: _.parseInt(moment().format("X")),
    endingAt: _.parseInt(moment().add(60, "minutes").format("X")),
  },
};

const main = async () => {
  console.log("\n\n 📡 Deploying...\n");
  // Deploy LVP Token
  const _token = await deploy("LVPToken", _.values(configs.token));

  // Deploy Vendor Contract
  const _vendor = await deploy("Vendor", [..._.values(configs.vendor), _token.address]);

  console.log("\n 🏵  Sending all 1000 tokens to the vendor...\n");
  await _token.transfer(_vendor.address, ethers.utils.parseEther("1000"));
  await _vendor.transferOwnership(configs.ownerShipAddress);


  // Deploy Voting Contract
  const _voiting = await deploy("Voting", [..._.values(configs.voting), _token.address]);
  await _voiting.transferOwnership(configs.ownerShipAddress);

  console.log(
    " 💾  Artifacts (address, abi, and args) saved to: ",
    chalk.blue("hardhat/artifacts/"),
    "\n\n"
  );
};

// eslint-disable-next-line no-unused-vars
const deploy = async (
  contractName: any,
  _args: any = [],
  overrides: any = {},
  libraries: any = {}
) => {
  console.log(` 🛰  Deploying: ${contractName}`);

  const contractArgs = _args || [];
  const contractArtifacts = await ethers.getContractFactory(contractName, {
    libraries: libraries,
  });
  const deployed = await contractArtifacts.deploy(...contractArgs, overrides);
  const encoded = abiEncodeArgs(deployed, contractArgs);
  fs.writeFileSync(`artifacts/${contractName}.address`, deployed.address);

  console.log(
    " 📄",
    chalk.cyan(contractName),
    "deployed to:",
    chalk.magenta(deployed.address)
  );

  if (!encoded || encoded.length <= 2) return deployed;
  fs.writeFileSync(`artifacts/${contractName}.args`, encoded.slice(2));

  return deployed;
};
// ------ utils -------

// abi encodes contract arguments
// useful when you want to manually verify the contracts
// for example, on Etherscan
const abiEncodeArgs = (deployed: any, contractArgs: any) => {
  // not writing abi encoded args if this does not pass
  if (
    !contractArgs ||
    !deployed ||
    !R.hasPath(["interface", "deploy"], deployed)
  ) {
    return "";
  }
  const encoded = utils.defaultAbiCoder.encode(
    deployed.interface.deploy.inputs,
    contractArgs
  );
  return encoded;
};

// checks if it is a Solidity file
// eslint-disable-next-line no-unused-vars
const isSolidity = (fileName: any) =>
  fileName.indexOf(".sol") >= 0 &&
  fileName.indexOf(".swp") < 0 &&
  fileName.indexOf(".swap") < 0;

// eslint-disable-next-line no-unused-vars
const readArgsFile = (contractName: any) => {
  let args: any[] = [];
  try {
    const argsFile = `./contracts/${contractName}.args`;
    if (!fs.existsSync(argsFile)) return args;
    args = JSON.parse(fs.readFileSync(argsFile));
  } catch (e) {
    console.log(e);
  }
  return args;
};

// eslint-disable-next-line no-unused-vars
function sleep(ms: any) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main()
  .then(() => {
    process.exitCode = 0;
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });

// function saveFrontendFiles(token: { name: string; data: any }) {
//   const fs = require("fs");
//   // eslint-disable-next-line node/no-path-concat
//   const contractsDir = __dirname + "/../../source/public/contracts";

//   if (!fs.existsSync(contractsDir)) {
//     fs.mkdirSync(contractsDir);
//   }

//   fs.writeFileSync(
//     contractsDir + `/${token.name}-Contract-Address.json`,
//     JSON.stringify({ Token: token.data.address }, undefined, 2)
//   );

//   const TokenArtifact = artifacts.readArtifactSync(token.name);

//   fs.writeFileSync(
//     contractsDir + `/${token.name}.json`,
//     JSON.stringify(TokenArtifact, null, 2)
//   );
// }

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
// main().catch((error) => {
//   console.error(error);
//   process.exitCode = 1;
// });
