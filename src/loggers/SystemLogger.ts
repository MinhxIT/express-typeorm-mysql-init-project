import { Logger } from 'winston';

export interface SystemLogger {
    logger: Logger;
    info(message: string): void;
    warn(message: string): void;
    error(message: string): void;
}
