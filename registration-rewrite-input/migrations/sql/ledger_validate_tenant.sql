CREATE OR REPLACE FUNCTION ledger_validate_tenant()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    journal_tenant UUID;
    account_tenant UUID;
BEGIN

    SELECT tenant_id
    INTO journal_tenant
    FROM ledger_journals
    WHERE id = NEW.journal_id;

    SELECT tenant_id
    INTO account_tenant
    FROM ledger_accounts
    WHERE id = NEW.account_id;

    IF NEW.tenant_id <> journal_tenant THEN
        RAISE EXCEPTION
            'Tenant mismatch between entry and journal.';
    END IF;

    IF NEW.tenant_id <> account_tenant THEN
        RAISE EXCEPTION
            'Tenant mismatch between entry and account.';
    END IF;

    RETURN NEW;
END;
$$;