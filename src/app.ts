require('dotenv').config()

import 'reflect-metadata';
import express, { Express } from 'express';
import paginate from 'express-paginate';
import cors from 'cors';
import bodyParser from 'body-parser';
import * as minio from 'minio';
import multerMinio from 'multer-minio-storage-engine';
import multer from 'multer';
import chalk from 'chalk';
import dotenv from 'dotenv';
import path from 'path';
import { Connection, createConnection } from 'typeorm';
import { Container, injectable } from 'inversify';
import generateContainer, { TYPES } from './container';
import ErrorMessage from './errors/ErrorMessage';
import Registerable from './interfaces';
import { CACHE_API, CACHE_TIME, PAGE_LIMIT } from './constant';

dotenv.config();

@injectable()
class App {
    public express: Express;
    public upload: multer.Multer;
    public container: Container;
    public connection: Connection;
    public minioClient: minio.Client;
    public cache = require('memory-cache');

    constructor() {
        this.express = express();
        this.express.use(cors());
        this.express.use(bodyParser.json());
        this.express.use(bodyParser.urlencoded({ extended: true }));
        this.express.use(paginate.middleware(1, PAGE_LIMIT));

        this.express.use((req, res, next) => {
            if (Number(req.query.limit) <= 0) {
                req.query.limit = PAGE_LIMIT.toString()
            };
            next();
        });

        this.upload = this.initMulter();

        this.initApp();
    }

    private async initApp() {
        await this.connectDB();

        this.container = generateContainer();
        this.mountRoutes();
        this.mountAuth();

    }

    private async connectDB() {
        try {
            this.connection = await createConnection({
                type: 'mysql',
                host: process.env.DB_HOST,
                port: parseInt(`${process.env.DB_PORT || 3306}`, 10),
                database: process.env.DB_DATABASE_NAME,
                username: process.env.DB_USERNAME,
                password: process.env.DB_PASSWORD,
                entities: [
                    `${__dirname}/models/db/**/*.js`
                ],
                synchronize: false,
            });
        } catch (error) {
            console.error(chalk.red('Cannot connect to database', error));
            process.exit();
        }
        console.log(chalk.green('Database connected!'));

    }

    private initMulter() {
        this.minioClient = new minio.Client({
            endPoint: process.env.MINIO_ENDPOINT,
            port: Number(process.env.MINIO_PORT || 9000),
            accessKey: process.env.MINIO_ACCESS_KEY,
            secretKey: process.env.MINIO_SECRET_KEY,
            useSSL: false
        });

        const storage = multerMinio({
            minio: this.minioClient,
            bucketName: process.env.MINIO_BUCKET || 'weatherplus',
            metaData: (req, file, cb) => {
                cb(null, { fieldName: file.fieldname, 'Content-Type': file.mimetype });
            },
            objectName: (req: express.Request, file, cb) => {
                const key = `${file.fieldname === 'file' ? req.params.category : file.fieldname}/${file.fieldname}_${Date.now()}_${file.originalname}`;
                file.filename = key;
                cb(null, key);
            },
        });

        return multer({
            storage,
            fileFilter: (req, file, cb) => {
                if (file.fieldname === 'document') {
                    const filetypes = /pdf/;
                    const mimetype = filetypes.test(file.mimetype);
                    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

                    if (mimetype && extname) {
                        return cb(null, true);
                    }
                    const errorMessage = new ErrorMessage('create_document_error', 'Thông tin không hợp lệ!', [{ field: 'document', messages: [`Văn bản chỉ chấp nhận file ${filetypes}`] }]);
                    return cb(errorMessage as unknown as Error);
                }

                if (file.fieldname === 'image') {
                    const filetypes = /jpeg|jpg|png|gif/;
                    const mimetype = filetypes.test(file.mimetype);
                    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

                    if (mimetype && extname) {
                        return cb(null, true);
                    }
                    const errorMessage = new ErrorMessage('create_image_error', 'Thông tin không hợp lệ!', [{ field: 'thumbnail', messages: [`Ảnh chỉ chấp nhận file ${filetypes}`] }]);
                    return cb(errorMessage as unknown as Error);
                }


                return cb(null, true);
            }
        });
    }

    private mountRoutes(): void {
        const controllers: Registerable[] = this.container.getAll<Registerable>(TYPES.Controller);

        controllers.forEach(controller => controller.register(this.express, this.upload));
    }

    private mountAuth(): void {
        const auths: Registerable[] = this.container.getAll<Registerable>(TYPES.Auth);

        auths.forEach(auth => {
            auth.register(this.express);
        });
    }
}
const app = new App();

app.express.use(bodyParser.json());       // to support JSON-encoded bodies
app.express.use(bodyParser.urlencoded({     // to support URL-encoded bodies
    extended: true
}));

app.express.use((req, res, next) => {
    const key = JSON.stringify(req.url);
    if (req.method === 'GET') {
        if (CACHE_API.includes(req.path) && app.cache.get(key) !== null) {
            res.send(app.cache.get(key));
        } else {
            next();
            try {
                const oldJSON = res.json;
                res.json = (data) => {
                    if (data) {
                        if (CACHE_API.includes(req.baseUrl)) {
                            app.cache.put(key, data, CACHE_TIME);
                        }
                        return oldJSON.call(res, data);
                    } else {
                        res.json = oldJSON;
                        return oldJSON.call(res, []);
                    }
                }
            } catch (error) {
                next(error);
            }
        }
    } else {
        app.cache.clear();
        next();
    }
})

export const connection = app.connection;

export const minioClient = app.minioClient;

export default app.express;