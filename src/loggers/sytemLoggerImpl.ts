import winston from 'winston';
import { injectable } from 'inversify';
import { SystemLogger } from './systemLogger';

@injectable()
export class SystemLoggerImpl implements SystemLogger {
    logger: winston.Logger;
    async info(message: string) {
        this.logger.info({
            level: 'info',
            message: message,
            date: new Date()
        });
    }

    async warn(message: string) {
        this.logger.warn({
            level: 'warn',
            message: message,
            date: new Date()
        });
    }

    async error(message: string) {
        this.logger.error({
            level: 'error',
            message: message,
            date: new Date()
        });
    }

    constructor() {
        this.logger = winston.createLogger({
            transports: [
                new winston.transports.Console(),
                new winston.transports.File({ filename: 'logger.log' })
            ]
        });
    }
}
