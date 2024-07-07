'use strict'

class LoadStream {
    //options for transfer file
    #options = {
        method: 'http',
        chunksize: 1024 * 1024,
        fallback: 'http'
    }

    //global Class Parameters
    #fileSize = 0;
    #currentTransferTime = Infinity;
    #controller;
    #isStoped = false;
    #userId = null;
    #ws = null;
    #promiseResolver = null;
    //EventListeners
    onprogress = null;
    onload = null;
    onerror = null;


    /**
     * method: Array of fallback options ['websocket','http'] 
     * disable fallback force single protocol ['websocket'] or 'websocket' or 'http' 
     * default fallback for websocket to http
     * @param {Object} options {method:string|[string],ChunkSize}
     */
    constructor(options = null) {
        if (options) {
            this.#options.chunksize = options.chunksize ? options.chunksize : 1024 * 1024;

            //extractiong fallback options
            if (options.method) {
                if (typeof (options.method) === 'string') // no fallback options
                {
                    this.#options.method = options.method ? options.method : 'http';
                    this.#options.fallback = null;
                }
                else if (typeof (options.method) === 'object') {
                    if (options.method.length) {
                        this.#options.method = options.method[0];
                        if (options.method.length > 1)
                            this.#options.fallback = options.method[1];
                        else this.#options.fallback = null;
                    }
                    else {
                        this.onerror("Empty fallback options")
                    }
                }
            }
        }
    }

    /**
     * 
     * @param {File|Blob|String} file File to Upload
     */
    async upload(file) {
        return new Promise(async (resolve, reject) => {
            this.file = file;
            this.#fileSize = this.file.size;

            if (this.#fileSize > 0) {
                let res = await this.#handShake(); //handshake always via http

                if (res.handshake) {
                    this.#userId = res.userId;

                    if (this.#options.method === 'http') {
                        this.#uploadFile();
                        resolve({ success: true, info: res.info });
                    }
                    else if (this.#options.method === 'websocket') {

                        //check for connection upgrade http->websocket
                        let connectionUpgradeResult = await this.#upgrade(); 
                        if (connectionUpgradeResult.websocket) {
                            //connection switched to websocket 
                            this.#uploadFileWS();
                        }
                        else {
                            //check for fallback
                            if (this.#options.fallback === 'http') { //fallback to http
                                this.#uploadFile();
                                resolve({ success: true, info: res.info });
                            }
                            else {
                                resolve({ success: false, error: "Unable to upgrade connection from http -> ws" });
                            }
                        }
                    }
                    else {
                        resolve({ success: false, error: "Currently only support http or websocket" })
                    }
                }
                else {
                    if (this.onerror)
                        this.onerror({ error: res.error || "Something Wrong During Handshaking!" });
                    resolve({ success: false, error: res.error || "Something Wrong During Handshaking!" })
                }
            }
        })
    }
    /**
     * 
     * @returns boolen is Stoped Transmitting or not
     */
    stop() {
        if (this.#fileSize > 0 && !this.#isStoped) {
            this.#isStoped = true;
            this.#controller.abort();
            return true;
        }
        return false;
    }

    /**
     * 
     * @returns boolen is Resume Transmitting or not
     */
    resume() {
        if (this.#fileSize > 0 && this.#isStoped) {
            this.#isStoped = false;
            this.#uploadFile();
            return true;
        }
        return false;
    }

    async #uploadFile() {
        try {
            let tansferResponse = await this.#getTransferedSize();
            if (!tansferResponse.success) {
                if (this.onerror)
                    this.onerror({ error: tansferResponse.error || "Something went wrong during Getting old Transfer." });
                return;
            }

            let transferedSize = tansferResponse.transfered;
            while (transferedSize < this.#fileSize) {
                let chunk = this.file.slice(transferedSize, transferedSize + this.#options.chunksize);
                let res = await this.#uploadChunk(chunk);
                if (!res.success) {
                    break;
                }
                transferedSize += this.#options.chunksize;
                let progress = (transferedSize / this.#fileSize) * 100;
                let time = this.#expectedTime(transferedSize);
                let speed = this.#uploadSpeed();
                if (this.onprogress)
                    this.onprogress({ progress, time: Math.floor(time), speed });
            }
            if (transferedSize >= this.#fileSize) {
                if (this.onload)
                    this.onload();
            }

        } catch (err) {
            if (this.onerror)
                this.onerror({ error: err });
        }
    }

    async #uploadChunk(chunk) {
        let sTime = Date.now();
        return new Promise((resolve, reject) => {
            let reader = new FileReader();
            reader.readAsArrayBuffer(chunk);
            reader.onload = async (e) => {
                let data = e.target.result;
                try {
                    this.#controller = new AbortController();
                    let res = await fetch(`/loadStream/upload/${this.#userId}`, {
                        method: 'POST',
                        headers: {
                            "Content-Type": "application/octet-stream",
                        },
                        body: data,
                        signal: this.#controller.signal
                    })
                    if (this.#isStoped) {
                        resolve({ success: false })
                    }
                    let success = await res.json();
                    this.#currentTransferTime = Date.now() - sTime;
                    resolve(success);
                } catch (err) {
                    resolve({ success: false });
                }
            }
        })
    }

    #expectedTime(transferedSize) {
        return Math.max(0, ((this.#fileSize - transferedSize) / this.#options.chunksize) * this.#currentTransferTime) / 1000;
    }

    #uploadSpeed() {
        return Math.ceil(this.#options.chunksize / this.#currentTransferTime) * 1000;
    }

    async #handShake() {
        return new Promise(async (resolve, reject) => {
            let handshakeData = {
                fileName: this.file.name,
                fileSize: this.#fileSize,
                chunksize: this.#options.chunksize
            }
            let res = await fetch('/loadStream/handshake', {
                method: 'POST',
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(handshakeData),
            })
            res = await res.json();
            resolve(res);
        })
    }

    async #getTransferedSize() {
        return new Promise(async (resolve, reject) => {
            let res = await fetch(`/loadStream/transfered/${this.#userId}`)
            res = await res.json();
            resolve(res);
        })
    }



    /**
     * WebSocket Communication
     * @return Promise<{[key:string]:string}>
     */
    async #upgrade() {
        return new Promise(async (resolve, reject) => {
            try {
                this.#ws = new WebSocket(`ws://localhost:3000?userId=${this.#userId}`, ['loadstream']);
                this.#ws.onopen = (e) => {
                    this.#addWSListeners();
                    resolve({ websocket: true });
                }
                this.#ws.onerror = e => { 
                    resolve({ websocket: false, reason: "Upgrade fail" });
                }
            } catch (err) { 
                resolve({ websocket: false, reason: err });
            }
        })
    }
    
    #addWSListeners() { 
        this.#ws.onmessage = (e) => {
            let message = e.data;
            message = JSON.parse(message);  
            if(this.#promiseResolver){
                if(this.#promiseResolver)this.#promiseResolver(message);
                this.#promiseResolver = null; 
            }
        }
    }
    async #uploadFileWS() {
        try {
            let tansferResponse = await this.#getTransferedSizeWS();
            if (!tansferResponse.success) {
                if (this.onerror)
                    this.onerror({ error: tansferResponse.error || "Something went wrong during Getting old Transfer." });
                return;
            } 
            let transferedSize = tansferResponse.transfered;
            while (transferedSize < this.#fileSize) {
                let chunk = this.file.slice(transferedSize, transferedSize + this.#options.chunksize);
                let res = await this.#uploadChunkWs(chunk); 
                if (!res.success) {
                    throw new Error(res.msg)
                }
                transferedSize += this.#options.chunksize;
                let progress = (transferedSize / this.#fileSize) * 100;
                // console.log(progress)
                let time = this.#expectedTime(transferedSize);
                let speed = this.#uploadSpeed();
                if (this.onprogress)
                    this.onprogress({ progress, time: Math.floor(time), speed });
            }
            if (transferedSize >= this.#fileSize) {
                if (this.onload)
                    this.onload();
            }

        } catch (err) {
            if (this.onerror)
                this.onerror({ error: err });
        }
    }
    async #getTransferedSizeWS() {
        return new Promise(async (resolve, reject) => { 
            this.#ws.send(JSON.stringify({ type: 'TransferedSize',userId:this.#userId, payload: null }));
            this.#promiseResolver = resolve
        })
    }

    // async #sendDataWS(type, payload){
    //     return new Promise((resolve, reject) => {
    //         this.#ws.send(JSON.stringify({ type, payload }));
    //     })
    // }

    async #uploadChunkWs(chunk) {
        let stime = Date.now();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsArrayBuffer(chunk);
            reader.onload = (e) => {
                try { 
                    let fileData =   Array.from(new Uint8Array(e.target.result)); 
                    this.#ws.send(JSON.stringify({type: 'fileData', payload: {fileData: fileData, userId: this.#userId}}));
                    // resolve();
                    this.#promiseResolver = (data)=>{
                        this.#currentTransferTime = Date.now()-stime;
                        resolve(data);
                    };
                } catch (error) { 
                    reject(error);
                }
            };
            reader.onerror = (e) => { 
                reject(e);
            };
        });
    }
    
} 