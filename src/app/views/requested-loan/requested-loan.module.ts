import { RouterModule } from '@angular/router';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

// App Modules
import { NgxSpinnerModule, NgxSpinnerService } from 'ngx-spinner';
import { SharedModule } from '../../shared/shared.module';
import { MaterialModule } from './../../material/material.module';
// App Services
import { ContractsService } from './../../services/contracts.service';
import { ApiService } from './../../services/api.service';
import { FilterLoansService } from '../../services/filter-loans.service';
// App Component
import { RequestedLoanComponent } from './requested-loan.component';

@NgModule({
  imports: [
    RouterModule,
    CommonModule,
    NgxSpinnerModule,
    MaterialModule,
    SharedModule,
    ReactiveFormsModule,
    FormsModule
  ],
  declarations: [
    RequestedLoanComponent
  ],
  providers: [
    NgxSpinnerService,
    ContractsService,
    ApiService,
    FilterLoansService
  ],
  exports: [
    RequestedLoanComponent
  ]
})
export class RequestedLoanModule { }
