// import { expect } from "chai";
const { expect } = require("chai");
const { ethers } = require("hardhat");
import moment from "moment";
import _ from "lodash";
// eslint-disable-next-line node/no-extraneous-import
import { BigNumberish } from "@ethersproject/bignumber";

const MockProjects = [
  { uid: "01", allocation: 10, badge: 0 },
  { uid: "02", allocation: 10, badge: 1 },
  { uid: "03", allocation: 10, badge: 2 },
  { uid: "04", allocation: 10, badge: 3 },
  { uid: "05", allocation: 10, badge: 0 },
];
const MockAccounts = [
  { uid: "01", badge: 0 },
  { uid: "02", badge: 1 },
  { uid: "03", badge: 2 },
  { uid: "04", badge: 3 },
  { uid: "05", badge: 0 },
];

const MockBuyPrice = 100;
const MockSellPrice = 100;

describe("Voting Contract", async function () {
  let deployer: any, accounts: any;
  let _voting: any, _token: any, _vendor: any, vendorTokensSupply: any;
  // const provider = waffle.provider;
  let buyPrice: BigNumberish, sellPrice: BigNumberish;

  beforeEach(async () => {
    accounts = await ethers.getSigners();
    deployer = accounts[0];

    // Deploy LVP Token
    const LVPToken = await ethers.getContractFactory("LVPToken");
    _token = await LVPToken.deploy(Math.pow(10, 4));
    await _token.deployed();
    // Deploy Vendor Contract
    const Vendor = await ethers.getContractFactory("Vendor");
    _vendor = await Vendor.deploy(MockBuyPrice, MockSellPrice, _token.address);
    await _vendor.deployed();
    await _token.transfer(_vendor.address, ethers.utils.parseEther("1000"));
    await _vendor.transferOwnership(deployer.address);
    vendorTokensSupply = await _token.balanceOf(_vendor.address);
    buyPrice = await _vendor.buyPricePerBNB();
    sellPrice = await _vendor.sellPricePerBNB();
    expect(buyPrice).to.equal(MockBuyPrice);
    expect(sellPrice).to.equal(MockSellPrice);
    // Deploy Voting Contract
    const startingAt = _.parseInt(moment().format("X"));
    const endingAt = _.parseInt(moment().add(60, "minutes").format("X"));
    const Voting = await ethers.getContractFactory("Voting");
    _voting = await Voting.deploy(startingAt, endingAt, _token.address);
    await _voting.deployed();

    await Promise.all(
      _.map(MockProjects, (project) => {
        return _voting
          .connect(deployer)
          .registrationProject(project.uid, project.allocation, project.badge);
      })
    );
    await Promise.all(
      _.map(MockAccounts, (account, index) => {
        return _voting
          .connect(accounts[index])
          .registrationPlayer(`${account.uid}`, account.badge);
      })
    );

    expect(await _voting.startingAt()).to.equal(startingAt);
    expect(await _voting.endingAt()).to.equal(endingAt);
  });

  describe("Test buyTokens() method", () => {
    it("buyTokens reverted no eth sent", async () => {
      const amount = ethers.utils.parseEther("0");
      await expect(
        _vendor.connect(accounts[1]).buyTokens({
          value: amount,
        })
      ).to.be.revertedWith("Send BNB to buy some tokens");
    });
    it("buyTokens reverted vendor has not enough tokens", async () => {
      const amount = ethers.utils.parseEther("101");
      await expect(
        _vendor.connect(accounts[1]).buyTokens({
          value: amount,
        })
      ).to.be.revertedWith(
        "Vendor contract has not enough tokens in its balance"
      );
    });
    it("buyTokens success!", async () => {
      const amount = ethers.utils.parseEther("1");

      // Check that the buyTokens process is successful and the event is emitted
      await expect(
        _vendor.connect(accounts[1]).buyTokens({
          value: amount,
        })
      ).to.emit(_vendor, "BUY_SUCCESS")
        .withArgs(accounts[1].address, amount, amount.mul(buyPrice));

      // Check that the user's balance of token is 100
      const userTokenBalance = await _token.balanceOf(accounts[1].address);
      const userTokenAmount = ethers.utils.parseEther("100");
      expect(userTokenBalance).to.equal(userTokenAmount);

      // Check that the vendor's token balance is 900
      const vendorTokenBalance = await _token.balanceOf(_vendor.address);
      expect(vendorTokenBalance).to.equal(
        vendorTokensSupply.sub(userTokenAmount)
      );

      // Check that the vendor's BNB balance is 1
      const vendorBalance = await ethers.provider.getBalance(_vendor.address);
      expect(vendorBalance).to.equal(amount);
    });
  });

  describe('Test withdraw() method', () => {
    it('withdraw reverted because called by not the owner', async () => {
      await expect(_vendor.connect(accounts[1]).withdraw()).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('withdraw reverted because called by not the owner', async () => {
      await expect(_vendor.connect(deployer).withdraw()).to.be.revertedWith('Owner has not balance to withdraw');
    });

    it('withdraw success', async () => {
      const ethOfTokenToBuy = ethers.utils.parseEther('1');

      // buyTokens operation
      await _vendor.connect(accounts[1]).buyTokens({
        value: ethOfTokenToBuy,
      });

      // withdraw operation
      const txWithdraw = await _vendor.connect(deployer).withdraw();

      // Check that the Vendor's balance has 0 eth
      const vendorBalance = await ethers.provider.getBalance(_vendor.address);
      expect(vendorBalance).to.equal(0);

      // Check the the deployer balance has changed of 1 eth
      await expect(txWithdraw).to.changeEtherBalance(deployer, ethOfTokenToBuy);
    });
  });

  describe('Test sellTokens() method', () => {
    it('sellTokens reverted because tokenAmountToSell is 0', async () => {
      const amountToSell = ethers.utils.parseEther('0');
      await expect(_vendor.connect(accounts[1]).sellTokens(amountToSell)).to.be.revertedWith(
        'Specify an amount of token greater than zero',
      );
    });

    it('sellTokens reverted because user has not enough tokens', async () => {
      const amountToSell = ethers.utils.parseEther('1');
      await expect(_vendor.connect(accounts[1]).sellTokens(amountToSell)).to.be.revertedWith(
        'Your balance is lower than the amount of tokens you want to sell',
      );
    });

    it('sellTokens reverted because vendor has not enough tokens', async () => {
      // User 1 buy
      const ethOfTokenToBuy = ethers.utils.parseEther('1');

      // buyTokens operation
      await _vendor.connect(accounts[1]).buyTokens({
        value: ethOfTokenToBuy,
      });

      await _vendor.connect(deployer).withdraw();

      const amountToSell = ethers.utils.parseEther('100');
      await expect(_vendor.connect(accounts[1]).sellTokens(amountToSell)).to.be.revertedWith(
        'Vendor has not enough funds to accept the sell request',
      );
    });

    it('sellTokens reverted because user has now approved transfer', async () => {
      // User 1 buy
      const ethOfTokenToBuy = ethers.utils.parseEther('1');

      // buyTokens operation
      await _vendor.connect(accounts[1]).buyTokens({
        value: ethOfTokenToBuy,
      });

      const amountToSell = ethers.utils.parseEther('100');
      await expect(_vendor.connect(accounts[1]).sellTokens(amountToSell)).to.be.revertedWith(
        'ERC20: transfer amount exceeds allowance',
      );
    });

    it('sellTokens success', async () => {
      // accounts[1] buy 1 ETH of tokens
      const ethOfTokenToBuy = ethers.utils.parseEther('1');

      // buyTokens operation
      await _vendor.connect(accounts[1]).buyTokens({
        value: ethOfTokenToBuy,
      });

      const amountToSell = ethers.utils.parseEther('100');
      await _token.connect(accounts[1]).approve(_vendor.address, amountToSell);

      // check that the Vendor can transfer the amount of tokens we want to sell
      const vendorAllowance = await _token.allowance(accounts[1].address, _vendor.address);
      expect(vendorAllowance).to.equal(amountToSell);

      const sellTx = await _vendor.connect(accounts[1]).sellTokens(amountToSell);

      // Check that the vendor's token balance is 1000
      const vendorTokenBalance = await _token.balanceOf(_vendor.address);
      expect(vendorTokenBalance).to.equal(ethers.utils.parseEther('1000'));

      // Check that the user's token balance is 0
      const userTokenBalance = await _token.balanceOf(accounts[1].address);
      expect(userTokenBalance).to.equal(0);

      // Check that the user's ETH balance is 1
      const userEthBalance = ethers.utils.parseEther('1');
      await expect(sellTx).to.changeEtherBalance(accounts[1], userEthBalance);
    });
  });

  describe('Voing sellTokens() method', () => {
    it("Voing successfully", async function () {
      const amount = ethers.utils.parseEther("30");
      await expect(
        _vendor.connect(accounts[1]).buyTokens({
          value: amount,
        })
      ).to.emit(_vendor, "BUY_SUCCESS")
        .withArgs(accounts[1].address, amount, amount.mul(buyPrice));

      const _amountToVoting = ethers.utils.parseEther(`${10}`);

      await _token?.approve(_voting.address, _amountToVoting);

      const votingTx = await _voting.connect(accounts[1]).vote(`${MockProjects[1].uid}`, _amountToVoting)

      await expect(votingTx).to.changeEtherBalance(accounts[1], _amountToVoting);
    });
  })
});
