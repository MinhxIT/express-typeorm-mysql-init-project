import chalk from 'chalk';
import app from './app';

const port = process.env.PORT || 3000;

app.listen(port, (err?: Error) => {
    if (err) {
        return console.error(chalk.red(err));
    }
    return console.log(chalk.greenBright("Server Started!!!"));
});