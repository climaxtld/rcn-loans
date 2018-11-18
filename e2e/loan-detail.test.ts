
import 'jest';

import { screenshot } from './utils/test-utils';

const puppeteer = require('puppeteer');
const dappeteer = require('dappeteer');

let browser;

beforeAll(async (done) => {
  browser = await dappeteer.launch(puppeteer, { args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  done();
});

test('Should display detail of loan', async () => {
  // Open profile
  const page = await browser.newPage({ width: 1366, height: 768 });

  await page.goto('http://localhost:4200/loan/2');
  await page.waitFor(3000);

  await screenshot(page, 'loan-2-detail');

  // Should display paid status
  const statusText = await page.$eval(
    // tslint:disable-next-line:max-line-length
    '#page-content-wrapper > app-loan-detail > div > div.loan-description.flex-container > div.left > div.avatar-information > div:nth-child(2) > app-avatar-title > div > div.txt-container.flex-item > div.title.ellipsis',
    e => e.innerText
  );
  expect(statusText).toBe('Paid');

  // Should display lent 400
  const lentText = await page.$eval(
    // tslint:disable-next-line:max-line-length
    '#page-content-wrapper > app-loan-detail > div > div.loan-description.flex-container > div.left > div:nth-child(2) > app-conversion-graphic > app-body-list > div > div:nth-child(1)',
    e => e.innerText
  );
  expect(lentText).toBe('4000');

  // Should display paid ammount
  const paidText = await page.$eval(
    // tslint:disable-next-line:max-line-length
    '#page-content-wrapper > app-loan-detail > div > div.loan-description.flex-container > div.left > div:nth-child(3) > app-conversion-graphic > app-body-list > div > div:nth-child(1)',
    e => e.innerText
  );

  expect(paidText).toBe('4085.07');

  // Should contain lender address
  const lenderText = await page.$eval(
    '#page-content-wrapper > app-loan-detail > div > div.loan-description.flex-container > div.left > div:nth-child(7)',
    e => e.innerText
  );

  expect(lenderText).toContain('0x791bcc53d4adbfeb6f471f6241262b9a9021ea3f');
}, 14000);

afterAll(async () => {
  browser.close();
});
