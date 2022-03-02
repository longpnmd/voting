import fs from "fs";
import chalk from "chalk";
import bre from "hardhat";

const publishDir = "../source/public/contracts";
const graphDir = "../subgraph";

function publishContract(contractName: any = 'Voting') {
  console.log(
    " 💽 Publishing",
    chalk.cyan(contractName),
    "to",
    chalk.gray(publishDir)
  );
  try {
    let contract: any = fs
      .readFileSync(
        `${bre.config.paths.artifacts}/contracts/${contractName}.sol/${contractName}.json`
      )
      .toString();
    const address = fs
      .readFileSync(`${bre.config.paths.artifacts}/${contractName}.address`)
      .toString();
    contract = JSON.parse(contract);
    const graphConfigPath = `${graphDir}/config/config.json`;
    let graphConfig: any;
    try {
      if (fs.existsSync(graphConfigPath)) {
        graphConfig = fs.readFileSync(graphConfigPath).toString();
      } else {
        graphConfig = "{}";
      }
    } catch (e) {
      console.log(e);
    }

    graphConfig = JSON.parse(graphConfig);
    graphConfig[contractName + "Address"] = address;
    fs.writeFileSync(
      `${publishDir}/${contractName}.address.ts`,
      `export default "${address}";`
    );
    fs.writeFileSync(
      `${publishDir}/${contractName}.abi.ts`,
      `export default ${JSON.stringify(contract.abi, null, 2)};`
    );
    fs.writeFileSync(
      `${publishDir}/${contractName}.bytecode.ts`,
      `export default "${contract.bytecode}";`
    );

    const folderPath = graphConfigPath.replace("/config.json", "");
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath);
    }
    fs.writeFileSync(graphConfigPath, JSON.stringify(graphConfig, null, 2));
    fs.writeFileSync(
      `${graphDir}/abis/${contractName}.json`,
      JSON.stringify(contract.abi, null, 2)
    );

    console.log(
      " 📠 Published " + chalk.green(contractName) + " to the frontend."
    );

    return true;
  } catch (e:any) {
    if (e.toString().indexOf("no such file or directory") >= 0) {
      console.log(
        chalk.yellow(
          " ⚠️  Can't publish " +
            contractName +
            " yet (make sure it getting deployed)."
        )
      );
    } else {
      console.log(e);
      return false;
    }
  }
}

async function main() {
  if (!fs.existsSync(publishDir)) {
    fs.mkdirSync(publishDir);
  }
  const finalContractList:any = [];
  fs.readdirSync(bre.config.paths.sources).forEach((file) => {
    if (file.indexOf(".sol") >= 0) {
      const contractName = file.replace(".sol", "");
      // Add contract to list if publishing is successful
      if (publishContract(contractName)) {
        finalContractList.push(contractName);
      }
    }
  });
  fs.writeFileSync(
    `${publishDir}/contracts.ts`,
    `export default ${JSON.stringify(finalContractList)};`
  );
}
main()
  .then(() => {
    process.exitCode = 0;
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
