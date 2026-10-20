CREATE TRIGGER trg_validate_entry_tenant
BEFORE INSERT OR UPDATE
ON ledger_entries
FOR EACH ROW
EXECUTE FUNCTION ledger_validate_tenant();