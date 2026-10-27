export class ValueObject {
  constructor(props) {
    this._props = Object.freeze({ ...props });
  }

  equals(other) {
    if (!other) return false;
    return JSON.stringify(this._props) === JSON.stringify(other._props);
  }

  get props() {
    return this._props;
  }
}

export default ValueObject;
