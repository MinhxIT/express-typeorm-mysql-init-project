import chalk from 'chalk';
import express from 'express';
import fs from 'fs';
import multer from 'multer';
import passport from 'passport';
import * as jwt from 'jsonwebtoken';
import { classToPlain } from 'class-transformer';
import { injectable } from 'inversify';
import { EntityManager, getCustomRepository, getManager, In } from 'typeorm';
import { UserRepository } from '../repositories/UserRepository';
import { UserPermissionRepository } from '../repositories/UserPermissionRepository';
import ErrorMessage from '../errors/ErrorMessage';
import AppStandardError from '../errors/AppStandardError';
import User from '../models/db/User';
import UserInfo from '../models/db/UserInfo';
import { PERMISSIONS } from '../constant';
import Registerable from '../interfaces';
import { passport_authorize } from '../auth';

@injectable()
export class UserController implements Registerable {
    private readonly userRepository: UserRepository;

    constructor() {
        this.userRepository = getCustomRepository(UserRepository);
    }

    register(app: express.Application, upload: multer.Multer): void {
        const router = express.Router();
        app.use('/user', router);

        router.route('/').get(this._find);
        router.route('/verify').get(passport.authenticate('jwt', { session: false }), this._loadSelf);
        router.route('/:id').get(this._get);
        router.route('/').post(upload.single('avatar'), this._registerAsGuest);
        router.route('/login').post(this._login);
        router.route('/change_password_me').put(passport_authorize(['jwt'], this._changePasswordMe));
        router.route('/signup').post(upload.single('avatar'), this._signup);
        router.route('/me').put(upload.single('avatar'), passport_authorize(['jwt', 'guest'], this._updateMe));
    }

    private _loadSelf = (req: express.Request, res: express.Response) => {
        res.status(200).json(classToPlain(req.user));
    }

    private _find = async (req: express.Request, res: express.Response) => {
        const { query } = req;

        const limit = Number(query.limit);
        const skip = req.skip;

        const repository = this.userRepository
            .createQueryBuilder('user')
            .leftJoinAndSelect('user.userInfo', 'userInfo')
            .leftJoinAndSelect('user.userPermissions', 'userPermissions')
            .select()

        repository.where('COALESCE(userInfo.name," ") like :name', { name: (query.name ? `%${query.name}%` : '%') })
            .andWhere('COALESCE(userInfo.address," ") like :address', { address: (query.address ? `%${query.address}%` : '%') })
            .andWhere('COALESCE(user.username," ") like :username', { username: (query.username ? `%${query.username}%` : '%') })
            .andWhere('COALESCE(userPermissions.id," ") like :permissions', { permissions: (query.permission ? `%${query.permission}%` : '%') })
            .andWhere('COALESCE(userInfo.phoneNumber," ") like :phoneNumber', { phoneNumber: (query.phoneNumber ? `%${query.phoneNumber}%` : '%') })
            .andWhere('COALESCE(userInfo.isDeleted," ") = :isDeleted', { isDeleted: false });
        repository.take(limit).skip(skip);

        if (query.withCount) {
            const [users, totalCount] = await repository.getManyAndCount();
            const pageCount = Math.ceil(totalCount / Number(query.limit));
            return res.status(200).json({
                data: classToPlain(users),
                pageCount,
                totalCount,
                page: req.query.page,
                limit: req.query.limit
            });
        } else {
            const users = await repository.getMany();
            return res.status(200).json(classToPlain(users));
        }
    }

    private _get = async (req: express.Request, res: express.Response) => {
        const repository = this.userRepository
            .createQueryBuilder('user')
            .leftJoinAndSelect('user.userInfo', 'userInfo')
            .leftJoinAndSelect('user.userPermissions', 'userPermissions')
            .select()

        repository.where("user.id = :id", { id: req.params.id })
            .andWhere("userInfo.isDeleted = :isDeleted", { isDeleted: false })

        const user = await repository.getOne();

        if (!user) {
            const errorMessage = new ErrorMessage('user_not_found', 'Không tìm thấy người dùng!', []);
            return res.status(400).json(errorMessage);
        }

        return res.status(200).json(classToPlain(user));
    }

    private _signup = async (req: express.Request, res: express.Response) => {
        const { body } = req;

        if (body.password !== body.repeatPassword) {
            const error = new AppStandardError('confirmation_password', 'Mật khẩu không hợp lệ', [], {
                errors: [
                    {
                        field: 'repeatPassword',
                        messages: ['Mật khẩu xác nhận không trùng khớp!']
                    }
                ]
            });
            return res.status(400).json(error);
        }

        let user = await this.userRepository.findByUsername(body.username);
        if (user) {
            const errorMessage = new ErrorMessage('user_existed', 'Tài khoản đã tồn tại!', []);
            return res.status(400).json(errorMessage);
        }

        getManager().transaction(async (manager: EntityManager) => {
            user = new User();
            user.username = body.username;
            user.password = body.password;

            await manager.save(user);

            const userInfo = new UserInfo();
            userInfo.id = user.id;
            userInfo.phoneNumber = body.phoneNumber;
            userInfo.name = body.username;
            userInfo.address = body.address;
            if (req.file) {
                userInfo.avatarUrl = `${process.env.MINIO_FILE_HOST}${req.file.filename}`;
            }

            await manager.save(userInfo);

            res.send();
        }).catch((err: Error) => {
            console.log(chalk.red(err));
            const errorMessage = new ErrorMessage('signup_error', 'Lỗi trong quá trình đăng ký!', []);
            res.status(400).json(errorMessage);
        });

    }

    private _registerAsGuest = async (req: express.Request, res: express.Response) => {
        const { body } = req;
        if (!body.name) {
            const errorMessage = new ErrorMessage('create_guest_error', 'Thông tin không hợp lệ!', [{ field: 'name', messages: ['Phải nhập tên hiển thị!'] }]);
            return res.status(400).json(errorMessage);
        }

        if (!body.phoneNumber) {
            const errorMessage = new ErrorMessage('create_guest_error', 'Thông tin không hợp lệ!', [{ field: 'phoneNumber', messages: ['Phải nhập số điện thoại!'] }]);
            return res.status(400).json(errorMessage);
        }

        getManager().transaction(async (manager: EntityManager) => {
            const user = new User();

            await manager.save(user);

            const userInfo = new UserInfo();
            userInfo.id = user.id;
            userInfo.phoneNumber = body.phoneNumber;
            userInfo.name = body.name;
            userInfo.address = body.address;
            if (req.file) {
                userInfo.avatarUrl = `${process.env.MINIO_FILE_HOST}${req.file.filename}`;
            }

            await manager.save(userInfo);

            user.userInfo = userInfo;

            res.status(200).json(classToPlain(user, { groups: ['register'] }));
        }).catch((err: Error) => {
            console.log(chalk.red(err));
            const errorMessage = new ErrorMessage('create_guest_error', 'Lỗi trong quá trình đăng ký!', []);
            res.status(400).json(errorMessage);
        });

    }

    private _login(req: express.Request, res: express.Response) {
        passport.authenticate('password', { session: false }, (err, user: User) => {
            if (err || !user) {
                const errorMessage = new ErrorMessage('login_error', 'Tài khoản đăng nhập hoặc mật khẩu không hợp lệ', []);
                return res.status(400).json(errorMessage);
            }

            if (user.enable === false || !user.permissions.find((item) => item === PERMISSIONS.ADMIN || item === PERMISSIONS.SUPER_ADMIN)) {
                const errorMessage = new ErrorMessage('login_error', 'Tài khoản không có quyền đăng nhập', []);
                return res.status(401).json(errorMessage);
            }

            req.login(user, { session: false }, err => {
                if (err) {
                    return res.send(err).end();
                }

                const payload = {
                    id: user.id
                };
                const private_key = fs.readFileSync(process.env.JWT_SECRET);
                const token = jwt.sign(payload, private_key, { expiresIn: process.env.JWT_TOKEN_EXPIRE || 36000 });
                return res.status(200).json({ token, user: classToPlain(user) });
            });
        })(req, res);
    }

    private _updateMe = async (req: express.Request, res: express.Response) => {
        const { body } = req;

        if (!req.user) {
            const errorMessage = new ErrorMessage('update_user', 'Thông tin không hợp lệ!', [{ field: 'userId', messages: ['Không có quyền cập nhật!'] }]);
            return res.status(400).json(errorMessage);
        }

        if ('phoneNumber' in body && body.phoneNumber.trim() === '') {
            const errorMessage = new ErrorMessage('update_user', 'Thông tin không hợp lệ!', [{ field: 'phoneNumber', messages: ['Thông tin số điện thoại không được để trống!'] }]);
            return res.status(400).json(errorMessage);
        }

        if ('name' in body && body.name.trim() === '') {
            const errorMessage = new ErrorMessage('update_user', 'Thông tin không hợp lệ!', [{ field: 'name', messages: ['Tên hiển thị không được để trống!'] }]);
            return res.status(400).json(errorMessage);
        }

        getManager().transaction(async (manager: EntityManager) => {
            const userInfo = (req.user as User).userInfo;
            if ('phoneNumber' in body) {
                userInfo.phoneNumber = body.phoneNumber;
            }
            if ('name' in body) {
                userInfo.name = body.name;
            }
            if ('address' in body) {
                userInfo.address = body.address;
            }
            if (req.file) {
                userInfo.avatarUrl = `${process.env.MINIO_FILE_HOST}${req.file.filename}`;
            }

            await manager.save(userInfo);

            res.status(200).json(classToPlain(req.user));
        }).catch((err: Error) => {
            console.log(chalk.red(err));
            const errorMessage = new ErrorMessage('update_user', 'Lỗi trong quá trình cập nhật!', []);
            res.status(400).json(errorMessage);
        });
    }

    private _changePasswordMe = async (req: express.Request, res: express.Response) => {
        const { body } = req;

        if ('newPassword' in body && body.newPassword.trim() === '') {
            const errorMessage = new ErrorMessage('change_password', 'Mật khẩu không hợp lệ!', [{ field: 'password', messages: ['Mật khẩu không được để trống!'] }]);
            return res.status(400).json(errorMessage);
        }

        if (body.newPassword !== body.repeatNewPassword) {
            const error = new AppStandardError('confirmation_password', 'Mật khẩu không hợp lệ', [], {
                errors: [
                    {
                        field: 'repeatPassword',
                        messages: ['Mật khẩu xác nhận không trùng khớp!']
                    }
                ]
            });
            return res.status(400).json(error);
        }

        passport.authenticate('password', { session: false }, (err, user: User) => {
            if (err || !user) {
                const errorMessage = new ErrorMessage('login_error', 'Mật khẩu cũ không hợp lệ', []);
                return res.status(400).json(errorMessage);
            }
            getManager().transaction(async (manager: EntityManager) => {
                const user = req.user as User;
                user.password = body.newPassword;

                await manager.save(user);

                res.status(200).json(classToPlain(req.user));
            }).catch((err: Error) => {
                console.log(chalk.red(err));
                const errorMessage = new ErrorMessage('change_password', 'Lỗi trong quá trình cập nhật!', []);
                res.status(400).json(errorMessage);
            });
        })(req, res);
    }
}