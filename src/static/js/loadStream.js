class loadStream {
    //options for transfer file
    #options = {
        method: 'http',
        chunksize: 1024 * 1024
    }

    //global Class Parameters
    #fileSize = 0;
    #currentTransferTime = Infinity;
    #controller;
    #isStoped = false;
    #userId = null;
    //EventListeners
    onprogress = null;
    onload = null;
    onerror = null;

    /**
     * 
     * @param {Object} options {uploadMethod:http|websocket,ChunkSize}
     */
    constructor(options = null) {
        if (options) {
            this.#options.method = options.method ? options.method : 'http';
            this.#options.chunksize = options.chunksize ? options.chunksize : 1024 * 1024;
        }
    }

    /**
     * 
     * @param {File|Blob|String} file File to Upload
     */
    async upload(file) {
        this.file = file;
        this.#fileSize = this.file.size;
        if (this.#fileSize > 0) {
            if (this.#options.method === 'http') {
                let res = await this.#handShake();
                if (res.handshake) {
                    this.#userId = res.userId;
                    this.#uploadFile();
                } else {
                    if (this.onerror)
                        this.onerror({ error: res.error || "Something Wrong During Handshaking!" });
                }
            } else if (this.#options.method === 'websocket') {
                // let socket = io({ path: '/loadStream.io' });
                console.log("Currently Unavalible!");
            }
        }
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
}