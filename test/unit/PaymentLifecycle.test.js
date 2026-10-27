import { PaymentLifecycle } from '../../src/conference-management/accounting-services/payment/domain/value-objects/PaymentLifecycle.js';
describe('PaymentLifecycle', () => {
  test('creates', () => {
    expect(new PaymentLifecycle()).toBeDefined();
  });
  test('has createdAt', () => {
    const lc = new PaymentLifecycle();
    expect(lc.createdAt).toBeDefined();
  });
});
