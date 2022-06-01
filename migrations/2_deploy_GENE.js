const GeneToken = artifacts.require("./GeneToken.sol");
const fs = require("fs");

module.exports = function (deployer) {
  var name = "Gene Token";
  var symbol = "GENE";

  deployer.deploy(GeneToken, name, symbol).then(() => {
    if (GeneToken._json) {
      fs.writeFile("deployedABI", JSON.stringify(GeneToken._json.abi), (err) => {
        if (err) throw err;
        console.log(`The abi of ${GeneToken._json.contractName} is recorded on deployedABI file`);
      });
    }

    fs.writeFile("deployedAddress", GeneToken.address, (err) => {
      if (err) throw err;
      console.log(`The deployed contract address * ${GeneToken.address} * is recorded on deployedAddress file`);
    });
  });
};
