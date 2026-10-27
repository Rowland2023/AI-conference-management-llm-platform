export class Specification {
  isSatisfiedBy(candidate) {
    throw new Error("Not implemented");
  }

  and(other) {
    const self = this;
    return new (class extends Specification {
      isSatisfiedBy(c) {
        return self.isSatisfiedBy(c) && other.isSatisfiedBy(c);
      }
    })();
  }
}

export default Specification;
