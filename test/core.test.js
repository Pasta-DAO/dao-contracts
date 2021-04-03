const hre = require("hardhat");
const { expect } = require("chai");
const RLP = require('rlp');
const { ethers, network } = hre;

describe("🚀 Core", function () {
  let whale, whaleAddr, user, userAddr, voter, voterAddr, swinger, swingAddr, timelock, pasta, governor, ethPastaLP, maxValue, ethereum
  before(async function () {
    const oneDay = 86400
    const twoDays = 172800
    whaleAddr = "0x8d07D225a769b7Af3A923481E1FdF49180e6A265"
    userAddr = "0x8EcCE8e28Af4A2b8d3B093Ef34b24525af0989C6"
    voterAddr = "0xE89bD48a519706E599e6C3e8Fa41b89Ef13e3979"
    swingAddr = "0xa985c12Cab14159abC12EcEBb6c57D253d686ed6"
    const accounts = await ethers.getSigners()

    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [whaleAddr]
    })

    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [userAddr]
    })

    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [voterAddr]
    })

    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [swingAddr]
    })
  
    whale = await ethers.provider.getSigner(whaleAddr)
    user = await ethers.provider.getSigner(userAddr)
    voter = await ethers.provider.getSigner(voterAddr)
    swinger = await ethers.provider.getSigner(swingAddr)

    const Pasta = await ethers.getContractFactory("Pasta")
    pasta = await Pasta.deploy(oneDay, oneDay)

    await pasta.deployed()

    const txCount = await ethers.provider.getTransactionCount(accounts[0].address) + 1
    const timelockAddr = '0x' + ethers.utils.keccak256(RLP.encode([accounts[0].address, txCount])).slice(12).substring(14)

    const Governor = await ethers.getContractFactory("GovernorAlpha")
    governor = await Governor.deploy(pasta.address, whaleAddr, timelockAddr)

    await governor.deployed()

    const Timelock = await ethers.getContractFactory("Timelock")
    timelock = await Timelock.deploy(governor.address, twoDays)

    await timelock.deployed()

    // await governor.connect(whale).__setTimelock(timelock.address)

    const uniLP = [
      "function transfer(address to, uint amount)",
      "function approve(address spender, uint amount)",
      "function balanceOf(address) view returns (uint)"
    ]

    ethPastaLP = new ethers.Contract("0xE92346d9369Fe03b735Ed9bDeB6bdC2591b8227E", uniLP, ethers.provider)

    maxValue = "115792089237316195423570985008687907853269984665640564039457584007913129639935"

    ethereum = network.provider
  })

  describe("🍝 DAO Token", function () {
    const one = ethers.utils.parseEther("1")

    it("Should mint 🍝 DAO tokens and delegate to self", async function () {
      await ethPastaLP.connect(whale).approve(pasta.address, maxValue)
      await pasta.connect(whale).mint(whaleAddr, one)
      const balance = await pasta.balanceOf(whaleAddr)
      expect(balance).to.be.equal(one)
      const delegatee = await pasta.delegates(whaleAddr)
      expect(delegatee).to.be.equal(whaleAddr)
      const votes = await pasta.getCurrentVotes(whaleAddr)
      expect(votes).to.be.equal(one)
      const lpBalance = await ethPastaLP.balanceOf(pasta.address)
      expect(lpBalance).to.be.equal(one)
      const totalSupply = await pasta.totalSupply()
      expect(totalSupply).to.be.equal(one)
    })

    it("Should revert 🌎🧑‍🚀🔫🧑‍🚀", async function () {
      await expect(pasta.connect(whale).approve(
        timelock.address, maxValue
      )).to.be.revertedWith("It's all pasta 🌎🧑‍🚀🔫🧑‍🚀")
      await expect(pasta.connect(whale).transfer(timelock.address, one)).to.be.revertedWith("It's all pasta 🌎🧑‍🚀🔫🧑‍🚀")
    })

    it("Should delegate 🍝 DAO token", async function () {
      await pasta.connect(whale).delegate(userAddr)
      const balance = await pasta.balanceOf(whaleAddr)
      const votes = await pasta.getCurrentVotes(userAddr)
      expect(votes).to.be.equal(balance)
    })

    it("Should mint 🍝 DAO tokens and delegate to the delegatee", async function () {
      await pasta.connect(whale).mint(whaleAddr, one)
      const balance = await pasta.balanceOf(whaleAddr)
      const delegatee = await pasta.delegates(whaleAddr)
      expect(delegatee).to.be.equal(userAddr)
      let votes = await pasta.getCurrentVotes(whaleAddr)
      expect(votes).to.be.equal(0)
      votes = await pasta.getCurrentVotes(userAddr)
      expect(votes).to.be.equal(balance)
      const totalSupply = await pasta.totalSupply()
      expect(totalSupply).to.be.equal(one.add(one))
    })

    it("Should revert buring without cooling down 🧊", async function() {
      await expect(pasta.connect(whale).burn(whaleAddr, one)).to.be.reverted
    })

    let cooldownTimestamp
    it("Should cooldown 🧊", async function () {
      await pasta.connect(whale).cooldown()
      cooldownTimestamp = await pasta.holderCooldowns(whaleAddr)
    })

    it("Should revert if burned before cooldown 🧊", async function () {
      await expect(pasta.connect(whale).burn(whaleAddr, one)).to.be.revertedWith("Pasta::burn: invalid cooldown")
    })

    it("Should burn after cooldown 🔥", async function () {
      cooldownEnd = cooldownTimestamp.add(86405)
      await ethereum.send("evm_setNextBlockTimestamp", [cooldownEnd.toNumber()])
      await ethereum.send("evm_mine", [])
      const initLpBalance = await ethPastaLP.balanceOf(whaleAddr)
      const initBalance = await pasta.balanceOf(whaleAddr)
      await pasta.connect(whale).burn(whaleAddr, one)
      const finalBalance = await pasta.balanceOf(whaleAddr)
      expect(finalBalance).to.be.equal(initBalance.sub(one))
      const finalLpBalance = await ethPastaLP.balanceOf(whaleAddr)
      expect(finalLpBalance).to.be.equal(initLpBalance.add(one))
      const totalSupply = await pasta.totalSupply()
      expect(totalSupply).to.be.equal(one)
    })

    it("Should cooldown 2 🧊", async function () {
      await pasta.connect(whale).cooldown()
      cooldownTimestamp = await pasta.holderCooldowns(whaleAddr)
    })

    it("Should revert if burned after redeem window 🧊", async function () {
      cooldownEnd = cooldownTimestamp.add(172805)
      await ethereum.send("evm_setNextBlockTimestamp", [cooldownEnd.toNumber()])
      await ethereum.send("evm_mine", [])
      await expect(pasta.connect(whale).burn(whaleAddr, one)).to.be.revertedWith("Pasta::burn: redeem window over")
    })

    after(async function () {
      const four = ethers.utils.parseEther("4")
      const ten = ethers.utils.parseEther("10")

      await ethPastaLP.connect(voter).approve(pasta.address, maxValue)
      await ethPastaLP.connect(swinger).approve(pasta.address, maxValue)

      await pasta.connect(whale).mint(userAddr, ten)
      await pasta.connect(voter).mint(voterAddr, ten)
      await pasta.connect(swinger).mint(swingAddr, four)

      await whale.sendTransaction({ to: userAddr, value: one })
    })

  })

  describe("👨‍⚖️ Governor Alpha", function () {
    let initalTotalSupply, cooldownTimestamp
    const num3_9 = ethers.utils.parseEther("3.9")

    it("Proposal threshold should be 1% of the total supply ✅", async function () {
      const totalSupply = await pasta.totalSupply()
      const proposalThreshold = await governor.proposalThreshold()
      expect(proposalThreshold).to.be.equal(totalSupply.div(100)) // 1%
      initalTotalSupply = totalSupply
    })

    it("Should add proposal 🗳️", async function () {
      await governor.connect(user).propose(
        ["0xE92346d9369Fe03b735Ed9bDeB6bdC2591b8227E"],
        [0],
        ["approve()"],
        ["0x"],
        "wubba lubba dub dub"
      )
    })

    it("Quorum should be 4% of the inital Supply ✅", async function () {
      const quorumVotes = await governor.quorumVotes(1)
      expect(quorumVotes).to.be.equal(initalTotalSupply.div(25)) // 4%
    })

    it("Should cooldown 3 🧊", async function () {
      await pasta.connect(swinger).cooldown()
      cooldownTimestamp = await pasta.holderCooldowns(swingAddr)
    })

    it("Should burn after cooldown 🔥", async function () {
      cooldownEnd = cooldownTimestamp.add(86405)
      await ethereum.send("evm_setNextBlockTimestamp", [cooldownEnd.toNumber()])
      await ethereum.send("evm_mine", [])
      await pasta.connect(swinger).burn(swingAddr, num3_9)
    })

    it("Quorum should be 4% of the inital Supply after burning ✅🔥", async function () {
      const quorumVotes = await governor.quorumVotes(1)
      expect(quorumVotes).to.be.equal(initalTotalSupply.div(25)) // 4%
    })

    it("Should not add proposal without proposal threshold ❌🗳️", async function () {
      await expect(governor.connect(swinger).propose(
        ["0xE92346d9369Fe03b735Ed9bDeB6bdC2591b8227E"],
        [0],
        ["approve()"],
        ["0x"],
        "wubba lubba dub dub"
      )).to.be.revertedWith("GovernorAlpha::propose: proposer votes below proposal threshold")
    })
  })
})
