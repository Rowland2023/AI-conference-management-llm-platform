import { PaymentLifecycle } from '../../src/vo/PaymentLifecycle.js';
describe('PaymentLifecycle', () => {
  test('creates', () => {
    expect(new PaymentLifecycle()).toBeDefined();
  });
});
