import chalk from 'chalk';
import { Container } from 'inversify';
import { Auth } from './auth';
import { UserController } from './controllers/UserController';

export const TYPES = {
    Controller: Symbol.for('Controller'),
    Auth: Symbol.for('Auth'),
    SystemLogger: Symbol.for('SystemLogger'),
};

export default (): Container => {
    const container = new Container();

    /***
     * Controllers
     */

    container.bind<UserController>(TYPES.Controller).to(UserController);

    /***
     * Auth
     */

    container.bind<Auth>(TYPES.Auth).to(Auth);

    console.log(chalk.green('Inversify containers are ready!'));

    return container;
};
