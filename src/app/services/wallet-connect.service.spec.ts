import { async, TestBed } from '@angular/core/testing';
import { SharedModule } from './../shared/shared.module';
import { WalletConnectService } from './wallet-connect.service';

describe('WalletConnectService', () => {
  let service: WalletConnectService;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      imports: [SharedModule],
      providers: [WalletConnectService]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    service = TestBed.get(WalletConnectService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
