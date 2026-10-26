
import AccountAggregate from "../../domain/aggregates/account/account.aggregate.js";

export default class AccountMapper {
  /**
   * Maps a ledger_accounts database row to the domain aggregate.
   *
   * Account balances are derived from journal entries and are not
   * persisted in ledger_accounts.
   *
   * @param {Object|null} row
   * @returns {AccountAggregate|null}
   */
  static toDomain(row) {
    if (!row) {
      return null;
    }

    return new AccountAggregate({
      id: row.id,
      tenantId: row.tenant_id,
      accountNumber: row.code,
      name: row.name,
      currency: row.currency,
      type: row.type,

      // The current schema only persists active/inactive.
      // Do not infer FROZEN or CLOSED from is_active=false.
      status: row.is_active ? "ACTIVE" : "SUSPENDED",

      postedBalance: 0n,
      createdAt: row.created_at
        ? new Date(row.created_at)
        : new Date(),
    });
  }

  /**
   * Maps an aggregate to columns defined by ledger_accounts.
   *
   * @param {AccountAggregate|Object|null} aggregate
   * @returns {Object|null}
   */
  static toPersistence(aggregate) {
    if (!aggregate) {
      return null;
    }

    const data =
      typeof aggregate.toJSON === "function"
        ? aggregate.toJSON()
        : aggregate;

    const status = data.status?.value ?? data.status;
    const code = data.accountNumber ?? data.code;
    const currency = data.currency?.toUpperCase();
    const type = data.type?.toUpperCase();

    if (!data.id) {
      throw new Error("Account id is required.");
    }

    if (!data.tenantId) {
      throw new Error("Account tenantId is required.");
    }

    if (!code || typeof code !== "string") {
      throw new Error("Account code is required.");
    }

    if (!data.name || typeof data.name !== "string") {
      throw new Error("Account name is required.");
    }

    if (!currency || !/^[A-Z]{3}$/.test(currency)) {
      throw new Error("Account currency must be a three-letter code.");
    }

    if (
      !["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"]
        .includes(type)
    ) {
      throw new Error("Account type is invalid.");
    }

    return {
      id: data.id,
      tenant_id: data.tenantId,
      code,
      name: data.name,
      type,
      currency,
      is_active: status === "ACTIVE",
      created_at: data.createdAt
        ? new Date(data.createdAt)
        : new Date(),
      updated_at: new Date(),
    };
  }
}
