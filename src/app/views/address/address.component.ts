import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
// App Spinner
import { NgxSpinnerService } from 'ngx-spinner';
// App Models
import { Loan } from './../../models/loan.model';
// App Services
import { ContractsService } from './../../services/contracts.service';
import { AvailableLoansService } from '../../services/available-loans.service';
import { Web3Service } from '../../services/web3.service';

@Component({
  selector: 'app-address',
  templateUrl: './address.component.html',
  styleUrls: ['./address.component.scss']
})
export class AddressComponent implements OnInit {
  address: string;
  available: any;
  loans = [];
  availableLoans = true;

  constructor(
    private route: ActivatedRoute,
    private contractsService: ContractsService,
    private spinner: NgxSpinnerService,
    private web3Service: Web3Service
  ) {}

  ngOnInit() {
    this.spinner.show(); // Initialize spinner
    this.route.params.subscribe(params => {
      const web3 = this.web3Service.web3;
      this.address = web3.toChecksumAddress(params['address']);
      this.loadLoans(this.address);
    });
  }

  private async loadLoans(address: string) {
    try {
      const result: Loan[] = await this.contractsService.getLoansOfLender(address);
      this.loans = result;
      // this.upgradeAvaiblable();
      this.spinner.hide();
      if (this.loans.length <= 0) {
        this.availableLoans = false;
      }

    } catch (err) {
      this.spinner.hide();
      this.availableLoans = false;
    }
  }
}
