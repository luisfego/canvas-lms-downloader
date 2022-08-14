import * as fs from "fs-extra";
import * as path from 'path';
import { Bucket } from "@google-cloud/storage";

export interface IWriter {
    stream: NodeJS.WritableStream
}

export interface WriterOptions {
    baseDir: string,
    provider: "fs" | "gcp", 
    bucket?: Bucket // Optional property
}

// Filesystem writer
export class FSWriter implements IWriter { // Need to add file checking and all that stuff
    stream: NodeJS.WritableStream;
    
    constructor(destPath: string, resolve: Function, reject: Function, options: WriterOptions) {
        // Handle creating dirs before writing
        const basePath = path.dirname(destPath);
        if (!fs.existsSync(basePath)) fs.mkdirSync(basePath, {recursive: true});

        // Write to stream
        const fstream = fs.createWriteStream(destPath);
        this.stream = fstream;

        this.stream
        .on('error', err => {
            console.error(`[ERROR] ${err.message}`);
            reject();
        })
        .on('finish', () => {
            console.log(`[WRITE] ${destPath}`);
            resolve();
        })
    }
}

// Google Storage Writer
export class GoogleStorageWriter implements IWriter {
    stream: NodeJS.WritableStream;
    
    constructor(destPath: string, resolve: Function, reject: Function, options: WriterOptions) {
        const bucket = options.bucket;
        const blob = bucket.file(destPath);
        
        this.stream = blob.createWriteStream({
            resumable: true
        })
        .on('error', err => {
            console.error(`[ERROR] ${err.message}`);
            reject();
        })
        .on('finish', () => {
            console.log(`[UPLOAD] ${destPath}`);
            resolve();
        })
    }
}