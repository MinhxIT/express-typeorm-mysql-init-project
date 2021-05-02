import ErrorMessage, { Errors } from './ErrorMessage';

export default class ApplicationError extends Error {
    payload: object = {};
    status: number;
    message: string;
    errorMessage: ErrorMessage;

    constructor(
        status: number,
        type: string,
        message: string,
        errors: Errors = [],
        payload: object = {}
    ) {
        super(message);
        this.errorMessage = new ErrorMessage(type, message, errors);
        this.payload = payload;
        this.status = status;
    }
}
