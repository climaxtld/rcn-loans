// Angular Core
import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { HttpModule } from '@angular/http';
import { Router, RouterModule, Routes } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

// App Services
import { ContractsService } from './services/contracts.service';
import { TxService } from './tx.service';
import { BrandingService } from './services/branding.service';
import { CosignerService } from './services/cosigner.service';
import { Web3Service } from './services/web3.service';

// TODO: Move
import { DecentralandCosignerService } from './services/cosigners/decentraland-cosigner.service';

// App Directives
import { FadeToggleDirective } from './directives/fade-toggle.directive';
import { WindowsHeightDirective } from './directives/windows-height.directive';

// App Component
import { AppComponent } from './app.component';
import { SharedModule } from './shared/shared.module';
import { MaterialModule } from './material/material.module';
import { HeaderComponent } from './header/header.component';
import { ContentWrapperComponent } from './content-wrapper/content-wrapper.component';

import { OpenLoansComponent } from './views/open-loans/open-loans.component';
import { LoanDetailComponent } from './views/loan-detail/loan-detail.component';
import { DetailCosignerComponent } from './views/loan-detail/detail-cosigner/detail-cosigner.component';
import { DetailIdentityComponent } from './views/loan-detail/detail-identity/detail-identity.component';
import { DecentralandCosignerComponent } from './views/loan-detail/detail-cosigner/decentraland-cosigner/decentraland-cosigner.component';
import { DialogApproveContractComponent } from './dialogs/dialog-approve-contract/dialog-approve-contract.component';

const appRoutes: Routes = [
  { path: 'loans', component: OpenLoansComponent },
  { path: 'loan/:id', component: LoanDetailComponent },
  { path: '',
    redirectTo: '/loans',
    pathMatch: 'full'
  }
];

@NgModule({
  declarations: [
    AppComponent,
    HeaderComponent,
    FadeToggleDirective,
    WindowsHeightDirective,
    LoanDetailComponent,
    OpenLoansComponent,
    DetailCosignerComponent,
    ContentWrapperComponent,
    DetailIdentityComponent,
    DecentralandCosignerComponent,
    DialogApproveContractComponent
  ],
  imports: [
    BrowserModule,
    SharedModule,
    MaterialModule,
    HttpModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule.forRoot(
      appRoutes,
      { enableTracing: false } // <-- debugging purposes only
    )
  ],
  entryComponents: [
    DialogApproveContractComponent
  ],
  providers: [ContractsService, TxService, BrandingService, CosignerService, Web3Service, DecentralandCosignerService],
  bootstrap: [AppComponent]
})
export class AppModule { }

