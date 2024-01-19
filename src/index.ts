import express, { Request, Response, Express } from 'express';
import path from 'path';
import fs from 'node:fs';
import { v4 as uuidv4 } from 'uuid';
interface FileData {
    [key: string]: string | number | fs.WriteStream;
}

interface FileInfoStore {
    [key: string]: FileData;
}

interface FileCallback {
    (fileInfo: { fileName: string; fileSize: number; destination: string }): { fileName?: string; destination?: string };
}

class StreamLoader {
    #app: Express;
    #fileInfoStore: FileInfoStore;
    #cb: FileCallback = (() => ({}));
    onerror: Function = (e: { [key: string]: string }) => { console.log(e.error) };

    /**
     *
     * @param cb callback for file name/destination
     * @returns Express app
     * @example
     * const cb = (file)=>{
     *      //file = {
     *      //        fileName:'hello.jpg',
     *      //        fileSize: 34,(Read Only)
     *      //        destination:'/'
     *      //   }
     *      return {
     *            fileName: random_string'+file.fileName,//return New File Name
     *            destination: '/static/upload' //path of your upload dir
     *      }
     * }
     *
     */
    constructor(cb?: FileCallback) {
        this.#app = express();
        this.#app.use(express.json());
        this.#fileInfoStore = {};

        if (cb)
            this.#cb = cb;

        this.#app.get('/loadStream/loadStream.js', (req: Request, res: Response) => {
            res.sendFile(path.resolve(__dirname + '/static/js/loadStream.js'));
        });
        this.#app.post('/loadStream/upload/:userId', this.#handleUpload.bind(this));
        this.#app.post('/loadStream/handshake', this.#handleHandshake.bind(this));
        this.#app.get('/loadStream/transfered/:userId', this.#handleTransfered.bind(this));
    }

    /**
     * Main function to upload Chunks
     * @param req Request
     * @param res Response
     */
    async #handleUpload(req: Request, res: Response) {
        const userId: string = req.params.userId;
        let fileInfo = this.#fileInfoStore[userId];
        let chunkData: any = [];

        req.on('data', (chunk: Buffer) => {
            chunkData.push(chunk);
        });

        req.on('error', () => {
            this.onerror({ error: 'Something Wrong during upload chunks' });
            res.json({ success: false, error: 'Something Wrong during upload chunks' });
        });

        req.on('end', () => {
            chunkData = Buffer.concat(chunkData);
            if (chunkData.length === fileInfo.chunksize) {
                fileInfo.transferedSize += chunkData.length;
                (fileInfo.writeStream as fs.WriteStream).write(chunkData);
                res.json({ success: true });
            } else if (chunkData.length === (fileInfo.fileSize as number % (fileInfo.chunksize as number))) {
                fileInfo.transferedSize += chunkData.length;
                (fileInfo.writeStream as fs.WriteStream).write(chunkData);
                res.json({ success: true });
                (fileInfo.writeStream as fs.WriteStream).end();
                delete this.#fileInfoStore[userId];
            } else {
                this.onerror({ error: 'Invalid Chunk Size neither a chunksize nor a last chunksize!' });
                res.json({ success: false, error: 'Invalid Chunk Size neither a chunksize nor a last chunksize!' });
            }
        });
    }


    /**
     * Intial Handshake to share file details and creating write Stream send back a userId
     * @param req Request
     * @param res Response
    */
    async #handleHandshake(req: Request, res: Response) {
        try {
            const { fileName, fileSize, chunksize } = req.body || {};
            let fileInfo: FileData = {};
            fileInfo['fileName'] = fileName;
            fileInfo['destination'] = '/';
            fileInfo['fileSize'] = fileSize;

            if (this.#cb !== undefined) {
                let cbData = this.#cb({ ...(fileInfo as { fileName: string, destination: string, fileSize: number }) });
                if (cbData.fileName)
                    fileInfo['fileName'] = cbData.fileName;
                if (cbData.destination)
                    fileInfo['destination'] = cbData.destination;
            }

            fileInfo['chunksize'] = chunksize;
            fileInfo['transferedSize'] = 0;
            let userId: string = uuidv4();
            fileInfo['writeStream'] = fs.createWriteStream(path.join((fileInfo['destination'] as string) + '/' + (fileInfo['fileName'] as string))).on('ready', () => {
                this.#fileInfoStore[userId] = fileInfo;
                res.json({ handshake: true, userId });
            }).on('error', (err) => {
                this.onerror({ error: err });
                res.json({ handshake: false, error: err });
            });
        } catch (err) {
            this.onerror({ error: err });
            res.json({ handshake: false, error: err });
        }
    }


    /**
     * To send the data that how much file is transfered till Now.
     * @param req request
     * @param res res
    */
    async #handleTransfered(req: Request, res: Response) {
        try {
            const userId: string = req.params.userId;
            let fileInfo = this.#fileInfoStore[userId];
            res.json({ success: true, transfered: fileInfo.transferedSize });
        } catch (err) {
            this.onerror({ error: err });
            res.json({ success: false, error: err });
        }
    }


    /**
     * To send the list of fallback during socket connection.
     * @param req request
     * @param res res
    */
    async #handleUpgrade(req: Request, res: Response) {
        try {
            const fallback: Array<string> = ['websocket', 'pooling'];
            res.json({ success: true, fallbackArray: fallback });
        } catch (err) {
            this.onerror({ error: err });
            res.json({ success: false, error: err });
        }
    }



    /**
     * 
     * @returns Express App
     */
    load(): Express {
        return this.#app;
    }

}


export default StreamLoader;
module.exports = StreamLoader;