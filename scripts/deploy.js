const hre = require("hardhat");
const RLP = require('rlp');
const { ethers } = hre;

async function main() {
  const twoDays = 172800
  const threeDays = 259200
  const accounts = await ethers.getSigners()
  const guardian = "0xB449dfE00aACf406eb442B22745A25430490FE1b"

  const Pasta = await ethers.getContractFactory("Pasta")
  const pasta = await Pasta.deploy(threeDays, twoDays)

  await pasta.deployed()

  const txCount = await ethers.provider.getTransactionCount(accounts[0].address) + 1
  const timelockAddr = '0x' + ethers.utils.keccak256(RLP.encode([accounts[0].address, txCount])).slice(12).substring(14)

  const Governor = await ethers.getContractFactory("GovernorAlpha")
  const governor = await Governor.deploy(pasta.address, guardian, timelockAddr)

  await governor.deployed()

  const Timelock = await ethers.getContractFactory("Timelock")
  const timelock = await Timelock.deploy(governor.address, twoDays)

  await timelock.deployed()

  await hre.run("verify:verify", {
    address: governor.address,
    constructorArguments: [pasta.address, guardian, timelockAddr]
  })

  await hre.run("verify:verify", {
    address: timelock.address,
    constructorArguments: [governor.address, twoDays]
  })

  await hre.run("verify:verify", {
    address: pasta.address,
    constructorArguments: [threeDays, twoDays]
  })
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
