import { Component, OnInit, OnDestroy } from '@angular/core';
import { NgxSpinnerService } from 'ngx-spinner';
import { Subscription } from 'rxjs';
// App Models
import { Loan, LoanType } from './../../models/loan.model';
// App Services
import { Web3Service } from './../../services/web3.service';
import { TitleService } from '../../services/title.service';
import { ContractsService } from './../../services/contracts.service';
import { AvailableLoansService } from '../../services/available-loans.service';
import { FilterLoansService } from '../../services/filter-loans.service';
import { LoanTypeService } from '../../services/loan-type.service';

@Component({
  selector: 'app-requested-loan',
  templateUrl: './requested-loan.component.html',
  styleUrls: ['./requested-loan.component.scss']
})
export class RequestedLoanComponent implements OnInit, OnDestroy {
  pageId = 'requested-loan';
  winHeight: number = window.innerHeight;
  loading: boolean;
  available: any;
  loans: Loan[] = [];
  availableLoans = true;
  pendingLend = [];
  filters = {
    currency: undefined,
    amountStart: null,
    amountEnd: null,
    interest: null,
    duration: null
  };
  filtersOpen = undefined;
  account: string;

  // subscriptions
  subscriptionAvailable: Subscription;
  subscriptionAccount: Subscription;

  constructor(
    private spinner: NgxSpinnerService,
    private web3Service: Web3Service,
    private titleService: TitleService,
    private availableLoansService: AvailableLoansService,
    private contractsService: ContractsService,
    private filterLoansService: FilterLoansService,
    private loanTypeService: LoanTypeService
  ) { }

  ngOnInit() {
    this.titleService.changeTitle('Lending Marketplace');
    this.spinner.show(this.pageId);
    this.loadLoans();
    this.loadAccount();
    this.handleLoginEvents();

    // Available Loans service
    this.subscriptionAvailable = this.availableLoansService.currentAvailable.subscribe(
      available => this.available = available
    );
  }

  ngOnDestroy() {
    this.spinner.hide(this.pageId);

    try {
      this.subscriptionAvailable.unsubscribe();
      this.subscriptionAccount.unsubscribe();
    } catch (e) { }
  }

  /**
   * Listen and handle login events for account changes and logout
   */
  handleLoginEvents() {
    this.subscriptionAccount = this.web3Service.loginEvent.subscribe(() => this.loadAccount());
  }

  /**
   * Toggle filter visibility
   */
  openFilters() {
    this.filtersOpen = !this.filtersOpen;
  }

  /**
   * Reload loans when the filter is applied
   */
  onFiltered() {
    this.spinner.show(this.pageId);
    this.loadLoans();
  }

  /**
   * Update available loans number
   */
  upgradeAvaiblable() {
    this.availableLoansService.updateAvailable(this.loans.length);
  }

  /**
   * Sort loans
   * @param sort Order by
   */
  async sortLoans(sort: string) {
    this.spinner.show(this.pageId);
    await this.loadLoans(sort);
  }

  /**
   * Load loans
   * @param sort Order by
   */
  async loadLoans(sort?: string) {
    const loans: Loan[] = await this.contractsService.getRequests(sort);
    const ALLOWED_TYPES = [LoanType.UnknownWithCollateral, LoanType.FintechOriginator, LoanType.NftCollateral];
    const filteredLoans: Loan[] = this.loanTypeService.filterLoanByType(loans, ALLOWED_TYPES);

    const filterLoans = this.filterLoansService.filterLoans(filteredLoans, this.filters);
    this.loans = filterLoans;

    this.upgradeAvaiblable();
    this.spinner.hide(this.pageId);

    if (filteredLoans.length) {
      this.availableLoans = true;
    } else {
      this.availableLoans = false;
    }
  }

  /**
   * Load user account
   */
  async loadAccount() {
    const web3 = this.web3Service.web3;
    const account = await this.web3Service.getAccount();
    this.account = web3.utils.toChecksumAddress(account);
  }
}
