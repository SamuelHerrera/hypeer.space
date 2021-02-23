import { Agent } from "http";
import { HypServer } from "./hypserver";

export class HypAgent extends Agent {
    public server: HypServer;

    constructor() {
        super({ keepAlive: true, maxSockets: 15, maxFreeSockets: 5, timeout: 5000, keepAliveMsecs: 15000 });
        this.server = new HypServer();
        this.server.once("error", (err) => {
            throw err;
        });
    }

    public createConnection(opt: any, cb: any) {
        const peer = this.server.createConnection();
        peer.on("connect", () => {
            cb(null, peer);
        });

    }

    public init(candidates: string | {
        type?: 'offer' | 'pranswer' | 'answer' | 'rollback';
        sdp?: any;
        candidate?: any;
    }) {
        this.server.signal({ candidates });
    }

    public onSignal(cb: (...args: any[]) => void) {
        this.server?.on('signal', cb);
    }

    public onceClose(cb: (...args: any[]) => void) {
        this.server?.once('close', cb);
    }

    public removeListener(event: string | symbol, listener: (...args: any[]) => void) {
        this.server.removeListener(event, listener);
    }

    public destroy() {
        this.server.close();
        super.destroy();
    }
}
