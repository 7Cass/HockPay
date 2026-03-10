/**
 * Error thrown when an account operation attempts to exceed the available 
 * or pending balances, or when trying to process a negative balance operation.
 */
export class InvalidBalanceError extends Error {
    code = 'INVALID_BALANCE';

    constructor(message: string) {
        super(message);
        this.name = 'InvalidBalanceError';
    }
}
