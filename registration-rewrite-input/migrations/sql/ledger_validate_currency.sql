CREATE OR REPLACE FUNCTION ledger_validate_journal()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_journal_id UUID;
    v_entry_count INTEGER;
    v_balance NUMERIC(20,0);
BEGIN
    v_journal_id := COALESCE(NEW.journal_id, OLD.journal_id);

    SELECT
        COUNT(*),
        COALESCE(
            SUM(
                CASE
                    WHEN entry_type = 'DEBIT'
                        THEN amount_minor
                    ELSE
                        -amount_minor
                END
            ),
            0
        )
    INTO
        v_entry_count,
        v_balance
    FROM ledger_entries
    WHERE journal_id = v_journal_id;

    IF v_entry_count < 2 THEN
        RAISE EXCEPTION
            'Journal % must contain at least two entries.',
            v_journal_id;
    END IF;

    IF v_balance <> 0 THEN
        RAISE EXCEPTION
            'Journal % is out of balance by %.',
            v_journal_id,
            v_balance;
    END IF;

    RETURN NULL;
END;
$$;