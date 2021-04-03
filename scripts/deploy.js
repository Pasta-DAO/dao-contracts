const hre = require("hardhat");
const RLP = require('rlp');
const { ethers } = hre;

async function main() {
  const twoDays = 172800
  const threeDays = 259200
  const fiveDays = 432000
  const accounts = await ethers.getSigners()
  const guardian = "0x2b02AAd6f1694E7D9c934B7b3Ec444541286cF0f"

  const Pasta = await ethers.getContractFactory("Pasta")
  const pasta = await Pasta.deploy(threeDays, twoDays)

  await pasta.deployed()

  const txCount = await ethers.provider.getTransactionCount(accounts[0].address) + 1
  const timelockAddr = '0x' + ethers.utils.keccak256(RLP.encode([accounts[0].address, txCount])).slice(12).substring(14)

  const Governor = await ethers.getContractFactory("GovernorAlpha")
  const governor = await Governor.deploy(pasta.address, guardian, timelockAddr)

  await governor.deployed()

  const Timelock = await ethers.getContractFactory("Timelock")
  const timelock = await Timelock.deploy(governor.address, fiveDays)

  await timelock.deployed()

  await hre.run("verify:verify", {
    address: pasta.address,
    constructorArguments: [threeDays, twoDays]
  })

  await hre.run("verify:verify", {
    address: governor.address,
    constructorArguments: [pasta.address, guardian, timelockAddr]
  })

  await hre.run("verify:verify", {
    address: timelock.address,
    constructorArguments: [governor.address, fiveDays]
  })
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
