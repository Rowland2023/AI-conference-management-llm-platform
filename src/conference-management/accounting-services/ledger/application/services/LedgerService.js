export class LedgerService {
    constructor({
        createAccountUseCase,
        createHoldUseCase,
        getLedgerBalanceUseCase,
        getJournalEntryUseCase,
        postJournalEntryUseCase,
        reverseJournalEntryUseCase,
    }) {
        this.createAccountUseCase = createAccountUseCase;
        this.createHoldUseCase = createHoldUseCase;
        this.getLedgerBalanceUseCase = getLedgerBalanceUseCase;
        this.getJournalEntryUseCase = getJournalEntryUseCase;
        this.postJournalEntryUseCase = postJournalEntryUseCase;
        this.reverseJournalEntryUseCase = reverseJournalEntryUseCase;
    }

    async createAccount(command) {
        return this.createAccountUseCase.execute(command);
    }

    async getAccountBalance(query) {
        return this.getLedgerBalanceUseCase.execute(query);
    }

    async getJournalEntry(query) {
        return this.getJournalEntryUseCase.execute(query);
    }

    async postJournalEntry(command) {
        return this.postJournalEntryUseCase.execute(command);
    }

    async reverseJournalEntry(command) {
        return this.reverseJournalEntryUseCase.execute(command);
    }

    async createHold(command) {
        return this.createHoldUseCase.execute(command);
    }
}
