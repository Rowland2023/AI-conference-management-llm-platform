const { Payment } = require('./Payment');
const { InvalidArgumentError } = require('../errors/PaymentErrors'); // Adjust path as per your repo

class PaymentFactory {
  static create(props) {
    // Extract heavy validation and object construction logic here
    if (!props.amount || props.amount.isZero()) {
      throw new InvalidArgumentError('Payment amount must be greater than zero.');
    }
    
    return new Payment({
      id: props.id,
      amount: props.amount,
      status: 'PENDING',
      createdAt: new Date(),
      ...props
    });
  }
}

module.exports = { PaymentFactory };