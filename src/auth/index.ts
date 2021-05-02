import express from 'express';
import fs from 'fs';
import { injectable } from 'inversify';
import passport from 'passport';
import { getCustomRepository } from 'typeorm';
import { Strategy as LocalStrategy, } from 'passport-local';
import { Strategy as JWTStrategy, ExtractJwt } from 'passport-jwt';
import Registerable from '../interfaces';
import ErrorMessage from '../errors/ErrorMessage';
import { UserRepository } from '../repositories/UserRepository';

const UNAUTHORIZED_ERROR = new ErrorMessage('unauthorized', 'Không đủ quyền thực hiện yêu cầu!', []);

export const passport_authorize = (strategy: string | string[], callback: (req: express.Request, res: express.Response, next: express.NextFunction) => void) => {
    return (req: express.Request, res: express.Response, next: express.NextFunction) => {
        passport.authenticate(strategy, { session: false }, (err, user) => {
            if (err) return next(err)
            if (!user) return res.status(401).send(
                UNAUTHORIZED_ERROR
            );

            req.user = user;
            return callback(req, res, next);
        })(req, res, next);
    }

}

@injectable()
export class Auth implements Registerable {
    private userRepository: UserRepository;

    constructor() {
        this.userRepository = getCustomRepository(UserRepository);
    }

    register(app: express.Application) {
        app.use(passport.initialize());

        passport.use('password', new LocalStrategy({
            usernameField: 'username',
            passwordField: 'password'
        }, async (username, password, done) => {
            try {
                const user = await this.userRepository.findByUsernamePassword(username, password);
                return done(null, user);
            } catch (error) {
                return done(error);
            }
        }));

        passport.use('guest', new LocalStrategy({
            usernameField: 'userId',
            passwordField: 'token',
        }, async (username, password, done) => {
            try {
                const user = await this.userRepository.findByUserIdAndToken(Number(username), password);
                return done(null, user);
            } catch (error) {
                return done(null, false);
            }
        }));

        const private_key = fs.readFileSync(process.env.JWT_SECRET);

        passport.use(new JWTStrategy({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            secretOrKey: private_key
        }, async (jwtPayload, done) => {
            const { id } = jwtPayload;
            const user = await this.userRepository.findOne(id, { relations: ['userPermissions'] });
            return done(null, user);
        }));
    }
}
