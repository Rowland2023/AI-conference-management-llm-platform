export class GetJournalEntryUseCase {
    constructor({ journalRepository }) {
        this.journalRepository = journalRepository;
    }

    async execute({ tenantId, id }) {
        if (!tenantId) {
            throw new Error("tenantId is required.");
        }

        if (!id) {
            throw new Error("Journal entry id is required.");
        }

        return this.journalRepository.findById(
            tenantId,
            id,
        );
    }
}
