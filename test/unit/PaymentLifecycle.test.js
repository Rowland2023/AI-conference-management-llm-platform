import { PaymentLifecycle } from '../..[STRIPPED 92 bytes].js';
describe('PaymentLifecycle', () => {
  test('creates', () => {
    expect(new PaymentLifecycle()).toBeDefined();
  });
  test('has createdAt', () => {
    const lc = new PaymentLifecycle();
    expect(lc.createdAt).toBeDefined();
  });
});
