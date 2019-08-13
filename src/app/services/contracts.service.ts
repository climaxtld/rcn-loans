import { BigNumber } from 'bignumber.js';
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { Loan, Oracle, Network } from '../models/loan.model';
import { LoanCurator } from './../utils/loan-curator';
import { LoanUtils } from './../utils/loan-utils';
import { environment } from '../../environments/environment';
import { Web3Service } from './web3.service';
import { TxService } from '../tx.service';
import { CosignerService } from './cosigner.service';
import { ApiService } from './api.service';
import { promisify, Utils } from './../utils/utils';

declare let require: any;

const tokenAbi = require('../contracts/Token.json');
const engineAbi = require('../contracts/NanoLoanEngine.json');
const extensionAbi = require('../contracts/NanoLoanEngineExtension.json');
const oracleAbi = require('../contracts/Oracle.json');
const loanManagerAbi = require('../contracts/LoanManager.json');
const debtEngineAbi = require('../contracts/DebtEngine.json');
const diasporeOracleAbi = require('../contracts/DiasporeOracle.json');
const converterRampAbi = require('../contracts/ConverterRamp.json');
const installmentsModelAbi = require('../contracts/InstallmentsModel.json');
const collateralAbi = require('../contracts/Collateral.json');
// const requestsAbi = require('../contracts/RequestsView.json');

@Injectable()
export class ContractsService {
  private _oracleAddress: string = environment.contracts.oracle;
  private _rcnContract: any;
  private _rcnContractAddress: string = environment.contracts.rcnToken;
  private _rcnEngine: any;
  private _rcnEngineAddress: string = environment.contracts.basaltEngine;
  private _rcnExtension: any;
  private _rcnExtensionAddress: string = environment.contracts.engineExtension;
  private _loanManager: any;
  private _debtEngine: any;
  private _rcnConverterRampAddress: string = environment.contracts.converter.converterRamp;
  private _rcnConverterRamp: any;
  private _installmentsModel: any;
  private _collateral: any;
  private _collateralAddress: string = environment.contracts.diaspore.collateral;
  // private _rcnConverterRamp: any;
  // private _rcnConverterRampAddress: string = environment.contracts.converter.converterRamp;
  // private _requestsView: any;

  constructor(
    private http: HttpClient,
    private web3: Web3Service,
    private txService: TxService,
    private cosignerService: CosignerService,
    private apiService: ApiService
  ) {
    this._rcnContract = this.makeContract(tokenAbi.abi, this._rcnContractAddress);
    this._rcnEngine = this.makeContract(engineAbi.abi, this._rcnEngineAddress);
    this._loanManager = this.makeContract(loanManagerAbi, environment.contracts.diaspore.loanManager);
    this._debtEngine = this.makeContract(debtEngineAbi, environment.contracts.diaspore.debtEngine);
    this._installmentsModel = this.makeContract(installmentsModelAbi.abi, environment.contracts.diaspore.models.installments);
    this._rcnExtension = this.makeContract(extensionAbi.abi, this._rcnExtensionAddress);
    this._rcnConverterRamp = this.makeContract(converterRampAbi.abi, this._rcnConverterRampAddress);
    this._collateral = this.makeContract(collateralAbi.abi, this._collateralAddress);
  }

  /**
   * Make contract private variable
   * @param abi Contract ABI
   * @param address Contract address
   * @return Contract object
   */
  makeContract(abi: string, address: string) {
    return this.web3.web3.eth.contract(abi).at(address);
  }

  async getUserBalanceETHWei(): Promise<BigNumber> {
    const account = await this.web3.getAccount();
    const balance = await this.web3.web3.eth.getBalance(account);
    return new Promise((resolve) => {
      resolve(balance);
    }) as Promise<BigNumber>;
  }

  async getUserBalanceRCNWei(): Promise<number> {
    const account = await this.web3.getAccount();
    return new Promise((resolve, reject) => {
      this._rcnContract.balanceOf.call(account, function (err, result) {
        if (err != null) {
          reject(err);
        }
        resolve(result);
      });
    }) as Promise<number>;
  }

  async getUserBalanceRCN(): Promise<number> {
    return new Promise((resolve) => {
      this.getUserBalanceRCNWei().then((balance) => {
        resolve(this.web3.web3.fromWei(balance));
      });
    }) as Promise<number>;
  }

  async isApproved(contract: string): Promise<boolean> {
    const pending = this.txService.getLastPendingApprove(this._rcnContract.address, contract);
    if (pending !== undefined) {
      return pending;
    }
    const result = await promisify(this._rcnContract.allowance.call, [await this.web3.getAccount(), contract]);
    return result >= this.web3.web3.toWei(1000000000);
  }

  async approve(contract: string): Promise<string> {

    const account = await this.web3.getAccount();
    const web3 = this.web3.opsWeb3;

    const result = await promisify(this.loadAltContract(web3, this._rcnContract).approve,
      [contract, web3.toWei(10 ** 32), { from: account }]);

    this.txService.registerApproveTx(result, this._rcnContract.address, contract, true);

    return result;
  }

  async disapprove(contract: string): Promise<string> {
    const account = await this.web3.getAccount();
    const web3 = this.web3.opsWeb3;

    const result = await promisify(this.loadAltContract(web3, this._rcnContract).approve,
      [contract, 0, { from: account }]);

    this.txService.registerApproveTx(result, this._rcnContract.address, contract, false);

    return result;
  }

  /**
   * Return estimated lend amount in RCN
   * @param loan Loan payload
   * @return Required amount
   */
  async estimateLendAmount(loan: Loan): Promise<number> {
    if (loan.oracle.address === Utils.address0x) {
      return loan.amount;
    }

    let oracleAddress: string = loan.oracle.address;
    environment.blacklist.map(element => {
      if (element.forbidden.includes(oracleAddress)) {
        oracleAddress = this._oracleAddress;
      }
    });
    let oracle: any;

    switch (loan.network) {
      case Network.Basalt:
        oracle = this.web3.web3.eth.contract(oracleAbi.abi).at(oracleAddress);
        break;

      case Network.Diaspore:
        oracle = this.web3.web3.eth.contract(diasporeOracleAbi).at(oracleAddress);
        break;

      default:
        break;
    }

    const oracleData = await this.getOracleData(loan.oracle);
    const oracleRate = await promisify(oracle.readSample.call, [oracleData]);
    const rate = oracleRate[0];
    const decimals = oracleRate[1];
    const required: number = (rate * loan.amount) / decimals;
    return required;
  }

  /**
   * Lend loan using ConverterRamp
   * @param payableAmount Ether amount
   * @param converter Converter address
   * @param fromToken From token address
   * @param loanManager Loan Manager address
   * @param cosigner Cosigner address
   * @param debtEngine Debt Engine address
   * @param loanId Loan ID
   * @param oracleData Oracle data
   * @param cosignerData Cosigner data
   * @param account Account address
   * @return Required amount
   */
  async converterRampLend(
    payableAmount: number,
    converter: string,
    fromToken: string,
    loanManager: string,
    cosigner: string,
    debtEngine: string,
    loanId: string,
    oracleData: string,
    cosignerData: string,
    account: string,
    callbackData: string
  ) {
    const web3 = this.web3.opsWeb3;
    return await promisify(this.loadAltContract(web3, this._rcnConverterRamp).lend, [
      converter,
      fromToken,
      loanManager,
      cosigner,
      debtEngine,
      loanId,
      oracleData,
      cosignerData,
      callbackData,
      {
        from: account,
        value: payableAmount
      }
    ]);
  }

  /**
   * Pay loan using ConverterRamp
   * @param payableAmount Ether amount
   * @param converter TokenConverter address
   * @param fromToken From token address
   * @param loanManager Loan Manager address
   * @param debtEngine Debt Engine address
   * @param loanId Loan ID
   * @param oracleData Oracle data
   * @param account Account address
   * @return Required amount
   */
  async converterRampPay(
    payableAmount: number,
    converter: string,
    fromToken: string,
    loanManager: string,
    debtEngine: string,
    loanId: string,
    oracleData: string,
    account: string
  ) {
    const web3 = this.web3.opsWeb3;
    return await promisify(this.loadAltContract(web3, this._rcnConverterRamp).pay, [
      payableAmount,
      converter,
      fromToken,
      loanManager,
      debtEngine,
      account,
      loanId,
      oracleData,
      { from: account }
    ]);
  }

  /**
   * Get the cost, in wei, of making a convertion using the value specified
   * @param amount Amount to calculate cost
   * @param converter Converter address to use for swap
   * @param fromToken Token to convert
   * @param token RCN Token address
   * @return _tokenCost and _etherCost
   */
  async getCostInToken(
    amount: number,
    converter: string,
    fromToken: string,
    token: string
  ) {
    return await promisify(this._rcnConverterRamp.getCost, [
      amount,
      converter,
      fromToken,
      token
    ]);
  }

  async lendLoan(loan: Loan): Promise<string> {
    const pOracleData = await this.getOracleData(loan.oracle);
    console.info('oracle Data', pOracleData);
    const cosigner = this.cosignerService.getCosigner(loan);
    let cosignerAddr = '0x0';
    let cosignerData = '0x0';

    if (cosigner !== undefined) {
      const cosignerOffer = await cosigner.offer(loan);
      cosignerAddr = cosignerOffer.contract;
      cosignerData = cosignerOffer.lendData;
    }

    const callbackData = '0x0';
    const oracleData = pOracleData;
    const web3 = this.web3.opsWeb3;
    const account = await this.web3.getAccount();

    switch (loan.network) {
      case Network.Basalt:
        return await promisify(this.loadAltContract(web3, this._rcnEngine).lend,
          [loan.id, oracleData, cosignerAddr, cosignerData, { from: account }]);

      case Network.Diaspore:
        return await promisify(this.loadAltContract(web3, this._loanManager).lend,
          [loan.id, oracleData, cosignerAddr, 0, cosignerData, callbackData, { from: account }]);

      default:
        throw Error('Unknown network');
    }
  }

  async getRate(loan: any): Promise<BigNumber> {
    // TODO: Calculate and add cost of the cosigner
    if (loan.oracle === Utils.address0x) {
      return loan.rawAmount;
    }
    const oracleData = await this.getOracleData(loan.oracle);
    console.info('Loan oracle address', loan.oracle.address);
    const oracle = this.web3.web3.eth.contract(oracleAbi.abi).at(loan.oracle.address);
    const oracleRate = await promisify(oracle.getRate, [loan.currency, oracleData]);
    const rate = oracleRate[0];
    const decimals = oracleRate[1];
    console.info('Oracle rate obtained', rate, decimals);
    const required = (rate * loan.rawAmount * 10 ** (18 - decimals) / 10 ** 18) * 1.02;
    console.info('Estimated required rcn is', required);
    // this.loanRcnAmount = required
    return rate;
  }

  /**
   * Encode installments data
   * @param cuota Installment amount
   * @param interestRate Interest rate
   * @param installments Number of installments
   * @param duration Installment duration in seconds
   * @param timeUnit Time unit (seconds)
   * @return Encoded installments data
   */
  async encodeInstallmentsData(
    cuota: number,
    interestRate: number,
    installments: number,
    duration: number,
    timeUnit: number
  ) {
    return new Promise((resolve, reject) => {
      this._installmentsModel.encodeData(
        cuota,
        interestRate,
        installments,
        duration,
        timeUnit,
        (err, result) => {
          if (err != null) {
            reject(err);
          } else {
            resolve(result);
          }
        }
      );
    });
  }

  /**
   * Calculate loan ID
   * @param amount Total amount
   * @param borrower Borrower address
   * @param creator Creator address
   * @param model Model address
   * @param oracle Oracle address
   * @param callback Callback address
   * @param salt Salt hash
   * @param expiration Expiration timestamp
   * @param data Model data
   * @return Loan ID
   */
  async calculateLoanId(
    amount: number,
    borrower: string,
    creator: string,
    model: string,
    oracle: string,
    callback: string,
    salt: string,
    expiration: number,
    data: any
  ) {
    return new Promise((resolve, reject) => {
      this._loanManager.calcId(
        amount,
        borrower,
        creator,
        model,
        oracle,
        callback,
        salt,
        expiration,
        data,
        (err, result) => {
          if (err != null) {
            reject(err);
          } else {
            resolve(result);
          }
        }
      );
    });
  }

  /**
   * Check encoded installments data
   * @param encodedData Array of bytes
   * @return True if can validate the data
   */
  async validateEncodedData(encodedData: string) {
    return new Promise((resolve, reject) => {
      this._installmentsModel.validate(
        encodedData,
        (err, result) => {
          if (err != null) {
            reject(err);
          } else {
            resolve(result);
          }
        }
      );
    });
  }

  /**
   * Request a loan
   * @param amount Total amount
   * @param model Model address
   * @param oracle Oracle address
   * @param borrower Borrower address
   * @param callback Callback address
   * @param salt Salt hash
   * @param expiration Expiration timestamp
   * @param loanData Loan model data
   * @return Loan ID
   */
  async requestLoan(
    amount: number,
    model: string,
    oracle: string,
    borrower: string,
    callback: string,
    salt: string,
    expiration: number,
    loanData: any
  ) {
    const web3 = this.web3.opsWeb3;
    return await promisify(this.loadAltContract(web3, this._loanManager).requestLoan, [
      amount,
      model,
      oracle,
      borrower,
      callback,
      salt,
      expiration,
      loanData,
      { from: borrower }
    ]);
  }

  async estimatePayAmount(loan: Loan, amount: number): Promise<number> {
    if (loan.oracle.address === Utils.address0x) {
      return amount;
    }

    const oracleData = await this.getOracleData(loan.oracle);

    if (loan.network === Network.Basalt) {
      const legacyOracle = this.web3.web3.eth.contract(oracleAbi.abi).at(loan.oracle.address);
      const oracleRate = await promisify(legacyOracle.getRate, [loan.oracle.code, oracleData]);
      const rate = oracleRate[0];
      const decimals = oracleRate[1];
      console.info('Oracle rate obtained', rate, decimals);
      const required = (rate * amount * 10 ** (18 - decimals) / 10 ** 18) * 1.02;
      console.info('Estimated required rcn is', required);
      return required;
    }

    const oracle = this.web3.web3.eth.contract(diasporeOracleAbi).at(loan.oracle.address);
    const oracleResult = await promisify(oracle.readSample.call, [oracleData]);

    const tokens = oracleResult[0];

    const equivalent = oracleResult[1];
    return (tokens * amount) / equivalent;
  }

  async payLoan(loan: Loan, amount: number): Promise<string> {
    const account = await this.web3.getAccount();
    const pOracleData = this.getOracleData(loan.oracle);
    const oracleData = await pOracleData;
    const web3 = this.web3.opsWeb3;

    switch (loan.network) {
      case Network.Basalt:
        return await promisify(this.loadAltContract(web3, this._rcnEngine).pay, [loan.id, amount, account, oracleData, { from: account }]);
      case Network.Diaspore:
        return await promisify(this.loadAltContract(web3, this._debtEngine).pay,
          [loan.id, amount, account, oracleData, { from: account }]);
      default:
        throw Error('Unknown network');
    }
  }

  async transferLoan(loan: Loan, to: string): Promise<string> {
    const account = await this.web3.getAccount();
    const web3 = this.web3.opsWeb3;
    switch (loan.network) {
      case Network.Basalt:
        return await promisify(this.loadAltContract(web3, this._rcnEngine).transfer, [to, loan.id, { from: account }]);
      case Network.Diaspore:
        return await promisify(this.loadAltContract(web3, this._debtEngine).safeTransferFrom,
          [account, to, loan.id, { from: account }]);
      default:
        throw Error('Unknown network');
    }
  }

  async withdrawFundsBasalt(basaltIdLoans: number[]): Promise<string> {
    const account = await this.web3.getAccount();
    const web3 = this.web3.opsWeb3;

    return await promisify(this.loadAltContract(web3, this._rcnEngine).withdrawalList,
      [basaltIdLoans, account, { from: account }]);
  }

  async withdrawFundsDiaspore(diasporeIdLoans: number[]): Promise<string> {
    const account = await this.web3.getAccount();
    const web3 = this.web3.opsWeb3;

    console.info('loans to withdraw diaspore', diasporeIdLoans);
    return await promisify(this.loadAltContract(web3, this._debtEngine).withdrawBatch,
      [diasporeIdLoans, account, { from: account }]);
  }

  /**
   * Get oracle object data
   * @param oracle Oracle
   * @return Oracle data
   */
  async getOracleData(oracle?: Oracle): Promise<string> {
    if (oracle.address === Utils.address0x) {
      return '0x';
    }

    const oracleContract = this.web3.web3.eth.contract(diasporeOracleAbi).at(oracle.address);
    const oracleUrlRcn: any = environment.rcn_oracle.url;
    let oracleUrl = await promisify(oracleContract.url.call, []);

    environment.blacklist.map(element => {
      if (element.forbidden.includes(oracleUrl)) {
        oracleUrl = oracleUrlRcn;
      }
    });

    if (oracleUrl === '') {
      return '0x';
    }

    const oracleResponse = (await this.http.get(oracleUrl).toPromise()) as any[];
    console.info('Searching currency', oracle.code, oracleResponse);

    let data;
    oracleResponse.forEach(e => {
      if (e.currency === oracle.code) {
        data = e.data;
        console.info('Oracle data found', e);
      }
    });

    if (data === undefined) {
      throw new Error('Oracle did not provide data');
    }

    return data;
  }

  async getOracleUrl(oracle?: Oracle): Promise<string> {
    const oracleContract = this.web3.web3.eth.contract(diasporeOracleAbi).at(oracle.address);
    const url = await promisify(oracleContract.url.call, []);
    return url;
  }

  async getLoan(id: string): Promise<Loan> {
    if (id.startsWith('0x')) {
      // Load Diaspore loan
      return await this.apiService.getLoan(id);
      // const result = await promisify(this._requestsView.getLoan.call, [environment.contracts.diaspore.loanManager, id]);
      // if (result.length === 0) throw new Error('Loan not found');
      // return LoanUtils.parseLoan(environment.contracts.diaspore.loanManager, result);
    }

    return new Promise((resolve, reject) => {
      this._rcnExtension.getLoan.call(this._rcnEngineAddress, id, (err, result) => {
        if (err != null) {
          reject(err);
        } else if (result.length === 0) {
          reject(new Error('Loan does not exist'));
        } else {
          resolve(LoanUtils.parseBasaltLoan(this._rcnEngineAddress, result));
        }
      });
    }) as Promise<Loan>;
  }
  async getActiveLoans(): Promise<Loan[]> {
    const bfilters = [environment.filters.ongoing];
    const bparams = ['0x0'];
    const pbasalt = promisify(this._rcnExtension.queryLoans.call, [this._rcnEngineAddress, 0, 0, bfilters, bparams]);
    // Filter lenderIn Diaspore loans
    // const dfilter = [
    //   // Created by loan manager
    //   this.addressToBytes32(environment.contracts.diaspore.filters.debtCreator),
    //   this.addressToBytes32(this._loanManager.address),
    //   // Ongoing status
    //   this.addressToBytes32(environment.contracts.diaspore.filters.isStatus),
    //   Utils.toBytes32('0x1')
    // ];
    // const pdiaspore = promisify(this._requestsView.getLoans, [this._loanManager.address, dfilter]);
    // return this.parseLoanBytes(await pdiaspore).concat(this.parseBasaltBytes(await pbasalt));
    // return this.parseLoanBytes(await pdiaspore);

    const activeDiasporeLoans = this.apiService.getActiveLoans();
    return (await activeDiasporeLoans).concat(this.parseBasaltBytes(await pbasalt));
    // return activeDiasporeLoans;

  }
  async getRequests(): Promise<Loan[]> {
    const basalt = new Promise((resolve, reject) => {
      // Filter open loans, non expired loand and valid mortgage
      const filters = [
        environment.filters.openLoans,
        environment.filters.nonExpired,
        environment.filters.validMortgage
      ];

      const params = ['0x0', '0x0', this.addressToBytes32(environment.contracts.decentraland.mortgageCreator)];
      this._rcnExtension.queryLoans.call(this._rcnEngineAddress, 0, 0, filters, params, (err, result) => {
        if (err != null) {
          reject(err);
        }
        resolve(LoanCurator.curateBasaltRequests(this.parseBasaltBytes(result)));
      });
    }) as Promise<Loan[]>;

    const web3 = await this.web3.web3;

    const block = await web3.eth.getBlock('latest');
    const now = block.timestamp;

    const diaspore = this.apiService.getRequests(now);

    // const diaspore = new Promise((resolve, reject) => {
    //   const filters = [
    //     this.addressToBytes32(environment.contracts.diaspore.filters.notExpired),
    //     '0x0000000000000000000000000000000000000000000000000000000000000000'
    //   ];
    //   this._requestsView.getRequests(environment.contracts.diaspore.loanManager, 1, 10000, filters, (err, result) => {
    //     if (err != null) {
    //       reject(err);
    //       console.error(err);
    //     }
    //     resolve(this.parseRequestBytes(result));
    //   });
    // }) as Promise<Loan[]>;
    // return diaspore;
    return (await diaspore).concat(await basalt);
  }

  async getLoansOfLender(lender: string): Promise<Loan[]> {
    // Filter [lenderIn] Basalt loans
    const bfilters = [environment.filters.lenderIn];
    const bparams = [this.addressToBytes32(lender)];
    const pbasalt = await promisify(this._rcnExtension.queryLoans.call, [this._rcnEngineAddress, 0, 0, bfilters, bparams]);
    // // Filter lenderIn Diaspore loans
    // const dfilter = [
    //   // Created by loan manager
    //   this.addressToBytes32(environment.contracts.diaspore.filters.debtCreator),
    //   this.addressToBytes32(this._loanManager.address),
    //   // Lender in
    //   this.addressToBytes32(environment.contracts.diaspore.filters.isLender),
    //   this.addressToBytes32(lender)
    // ];
    // const pdiaspore = promisify(this._requestsView.getLoans, [this._loanManager.address, dfilter]);
    // // return this.parseLoanBytes(await pdiaspore).concat(this.parseBasaltBytes(await pbasalt));
    // return this.parseLoanBytes(await pdiaspore);

    const pdiaspore = await this.apiService.getLoansOfLender(lender);
    return (pdiaspore).concat(this.parseBasaltBytes(pbasalt));

    // return await pdiaspore;
  }

  /**
   * Create loan collateral
   * @param loanId Loan ID
   * @param oracle Oracle address
   * @param collateralToken Token address
   * @param entryAmount Collateral amount
   * @param liquidationRatio Liquidation ratio
   * @param balanceRatio Balance ratio
   * @param burnFee Burn fee
   * @param rewardFee Reward fee
   * @param account Account address
   * @return Loan ID
   */
  async createCollateral(
    loanId: string,
    oracle: string,
    collateralToken: string,
    entryAmount: string,
    liquidationRatio: number,
    balanceRatio: number,
    burnFee: number,
    rewardFee: number,
    account: string
  ) {
    const web3 = this.web3.opsWeb3;
    return await promisify(this.loadAltContract(web3, this._collateral).create, [
      loanId,
      oracle,
      collateralToken,
      entryAmount,
      liquidationRatio,
      balanceRatio,
      burnFee,
      rewardFee,
      { from: account }
    ]);
  }

  readPendingWithdraws(loans: Loan[]): [BigNumber, number[], BigNumber, number[]] {
    const pendingBasaltLoans = [];
    const pendingDiasporeLoans = [];
    let totalBasalt = 0;
    let totalDiaspore = 0;

    loans.forEach(loan => {
      if (loan.debt.balance > 0 && loan.network === Network.Basalt) {
        totalBasalt += loan.debt.balance;
        pendingBasaltLoans.push(loan.id);
      } else if (loan.debt.balance > 0 && loan.network === Network.Diaspore) {
        totalDiaspore += loan.debt.balance;
        pendingDiasporeLoans.push(loan.id);
      }
    });
    return [totalBasalt, pendingBasaltLoans, totalDiaspore, pendingDiasporeLoans];
  }

  async getPendingWithdraws(): Promise<[number, number[], number, number[]]> {
    const account = await this.web3.getAccount();

    return new Promise((resolve, _reject) => {
      this.getLoansOfLender(account).then((loans: Loan[]) => {
        resolve(this.readPendingWithdraws(loans));
      });
    }) as Promise<[number, number[], number, number[]]>;
  }

  private parseBasaltBytes(bytes: any): Loan[] {
    const loans = [];
    const total = bytes.length / 20;
    for (let i = 0; i < total; i++) {
      const loanBytes = bytes.slice(i * 20, i * 20 + 20);
      loans.push(LoanUtils.parseBasaltLoan(this._rcnEngineAddress, loanBytes));
    }
    return loans;
  }
  // private parseRequestBytes(bytes: any): Loan[] {
  //   const requests = [];
  //   const total = bytes.length / 17;
  //   for (let i = 0; i < total; i++) {
  //     const loanBytes = bytes.slice(i * 17, i * 17 + 17);
  //     requests.push(LoanUtils.parseLoan(environment.contracts.diaspore.loanManager, loanBytes));
  //   }
  //   return requests;
  // }
  // private parseLoanBytes(bytes: any): Loan[] {
  //   const requests = [];
  //   const total = bytes.length / 25;
  //   for (let i = 0; i < total; i++) {
  //     const loanBytes = bytes.slice(i * 25, i * 25 + 25);
  //     requests.push(LoanUtils.parseLoan(environment.contracts.diaspore.loanManager, loanBytes));
  //   }
  //   return requests;
  // }
  private addressToBytes32(address: string): string {
    try {
      address = '0x000000000000000000000000' + address.replace('0x', '');
      return address;
    } catch (e) {
      return null;
    }
  }
  private loadAltContract(web3: any, contract: any): any {
    return web3.eth.contract(contract.abi).at(contract.address);
  }
}
