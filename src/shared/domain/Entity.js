export class Entity {
  constructor(props = {}) {
    this._id = props.id || props._id || null;
    this._props = { ...props };
    this._createdAt = props.createdAt || new Date();
    this._updatedAt = props.updatedAt || new Date();
  }

  get id() {
    return this._id;
  }

  equals(other) {
    if (!other) return false;
    return this._id === other._id;
  }
}

export default Entity;
