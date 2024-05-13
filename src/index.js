"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _StreamLoader_instances, _StreamLoader_app, _StreamLoader_fileInfoStore, _StreamLoader_server, _StreamLoader_cb, _StreamLoader_wsConnection, _StreamLoader_handleUpload, _StreamLoader_handleHandshake, _StreamLoader_handleTransfered, _StreamLoader_handleUpgrade, _StreamLoader_wsListeners;
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const node_fs_1 = __importDefault(require("node:fs"));
const uuid_1 = require("uuid");
const websocket_1 = __importDefault(require("websocket"));
const wsServer = websocket_1.default.server;
class StreamLoader {
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
    constructor(server, cb) {
        _StreamLoader_instances.add(this);
        _StreamLoader_app.set(this, void 0);
        _StreamLoader_fileInfoStore.set(this, void 0);
        _StreamLoader_server.set(this, void 0);
        _StreamLoader_cb.set(this, (() => ({})));
        _StreamLoader_wsConnection.set(this, void 0);
        this.onerror = (e) => { console.log(e.error); };
        __classPrivateFieldSet(this, _StreamLoader_app, (0, express_1.default)(), "f");
        __classPrivateFieldGet(this, _StreamLoader_app, "f").use(express_1.default.json());
        __classPrivateFieldSet(this, _StreamLoader_fileInfoStore, {}, "f");
        __classPrivateFieldSet(this, _StreamLoader_server, new wsServer({
            httpServer: server
        }), "f");
        if (cb) {
            __classPrivateFieldSet(this, _StreamLoader_cb, cb, "f");
        }
        __classPrivateFieldGet(this, _StreamLoader_app, "f").get('/loadStream/loadStream.js', (req, res) => {
            res.sendFile(path_1.default.resolve(__dirname + '/static/js/loadStream.js'));
        });
        __classPrivateFieldGet(this, _StreamLoader_app, "f").post('/loadStream/upload/:userId', __classPrivateFieldGet(this, _StreamLoader_instances, "m", _StreamLoader_handleUpload).bind(this));
        __classPrivateFieldGet(this, _StreamLoader_app, "f").post('/loadStream/handshake', __classPrivateFieldGet(this, _StreamLoader_instances, "m", _StreamLoader_handleHandshake).bind(this));
        __classPrivateFieldGet(this, _StreamLoader_app, "f").get('/loadStream/transfered/:userId', __classPrivateFieldGet(this, _StreamLoader_instances, "m", _StreamLoader_handleTransfered).bind(this));
        //webSocket Listeners
        __classPrivateFieldGet(this, _StreamLoader_server, "f").on('request', __classPrivateFieldGet(this, _StreamLoader_instances, "m", _StreamLoader_handleUpgrade).bind(this));
    }
    /**
     *
     * @returns Express App to use as middleware
     */
    load() {
        return __classPrivateFieldGet(this, _StreamLoader_app, "f");
    }
}
_StreamLoader_app = new WeakMap(), _StreamLoader_fileInfoStore = new WeakMap(), _StreamLoader_server = new WeakMap(), _StreamLoader_cb = new WeakMap(), _StreamLoader_wsConnection = new WeakMap(), _StreamLoader_instances = new WeakSet(), _StreamLoader_handleUpload = function _StreamLoader_handleUpload(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const userId = req.params.userId;
        let fileInfo = __classPrivateFieldGet(this, _StreamLoader_fileInfoStore, "f")[userId];
        let chunkData = [];
        req.on('data', (chunk) => {
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
                fileInfo.writeStream.write(chunkData);
                res.json({ success: true });
            }
            else if (chunkData.length === (fileInfo.fileSize % fileInfo.chunksize)) {
                fileInfo.transferedSize += chunkData.length;
                fileInfo.writeStream.write(chunkData);
                res.json({ success: true });
                fileInfo.writeStream.end();
                delete __classPrivateFieldGet(this, _StreamLoader_fileInfoStore, "f")[userId];
            }
            else {
                this.onerror({ error: 'Invalid Chunk Size neither a chunksize nor a last chunksize!' });
                res.json({ success: false, error: 'Invalid Chunk Size neither a chunksize nor a last chunksize!' });
            }
        });
    });
}, _StreamLoader_handleHandshake = function _StreamLoader_handleHandshake(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { fileName, fileSize, chunksize } = req.body || {};
            let fileInfo = {};
            fileInfo['fileName'] = fileName;
            fileInfo['destination'] = '/';
            fileInfo['fileSize'] = fileSize;
            if (__classPrivateFieldGet(this, _StreamLoader_cb, "f") !== undefined) {
                let cbData = __classPrivateFieldGet(this, _StreamLoader_cb, "f").call(this, Object.assign({}, fileInfo));
                if (cbData.fileName)
                    fileInfo['fileName'] = cbData.fileName;
                if (cbData.destination)
                    fileInfo['destination'] = cbData.destination;
            }
            fileInfo['chunksize'] = chunksize;
            fileInfo['transferedSize'] = 0;
            let userId = (0, uuid_1.v4)();
            fileInfo['writeStream'] = node_fs_1.default.createWriteStream(path_1.default.join(path_1.default.resolve() + fileInfo['destination'] + '/' + fileInfo['fileName'])).on('ready', () => {
                __classPrivateFieldGet(this, _StreamLoader_fileInfoStore, "f")[userId] = fileInfo;
                res.json({
                    handshake: true, userId, info: {
                        file: fileInfo.fileName,
                        size: fileInfo.fileSize,
                        destination: fileInfo.destination
                    }
                });
            }).on('error', (err) => {
                this.onerror({ error: err });
                res.json({ handshake: false, error: err });
            });
        }
        catch (err) {
            this.onerror({ error: err });
            res.json({ handshake: false, error: err });
        }
    });
}, _StreamLoader_handleTransfered = function _StreamLoader_handleTransfered(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const userId = req.params.userId;
            let fileInfo = __classPrivateFieldGet(this, _StreamLoader_fileInfoStore, "f")[userId];
            res.json({ success: true, transfered: fileInfo.transferedSize });
        }
        catch (err) {
            this.onerror({ error: err });
            res.json({ success: false, error: err });
        }
    });
}, _StreamLoader_handleUpgrade = function _StreamLoader_handleUpgrade(request) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(request.resourceURL.query);
        try {
            const fallback = ['websocket', 'polling'];
            if (request.requestedProtocols.includes('loadstream')) {
                __classPrivateFieldSet(this, _StreamLoader_wsConnection, request.accept(null, request.origin), "f");
                console.log("Connection Upgraded");
                __classPrivateFieldGet(this, _StreamLoader_instances, "m", _StreamLoader_wsListeners).call(this);
            }
            else {
                request.reject(101, "Unrecorgnised resouce path must be via '/loadstream'");
            }
        }
        catch (err) {
            this.onerror({ error: err });
        }
    });
}, _StreamLoader_wsListeners = function _StreamLoader_wsListeners() {
    return __awaiter(this, void 0, void 0, function* () {
        __classPrivateFieldGet(this, _StreamLoader_wsConnection, "f").on('message', (data) => {
            if (data.type === 'utf8') {
                let message = data.utf8Data;
                if (message == 'back') {
                    __classPrivateFieldGet(this, _StreamLoader_wsConnection, "f").send("Hello Client");
                }
            }
            else {
            }
        });
    });
};
exports.default = StreamLoader;
module.exports = StreamLoader;
