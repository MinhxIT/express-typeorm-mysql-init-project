import express from 'express';
import multer from 'multer';

export default interface Registerable {
    register(app: express.Application, upload?: multer.Multer): void;
}
