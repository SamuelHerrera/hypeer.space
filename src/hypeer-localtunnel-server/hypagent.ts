import { SignalData } from 'simple-peer';
import { Agent } from "http";
import { HypeerServer } from "./hypserver";

export class HypAgent extends Agent {
    public server: HypeerServer;

    constructor() {
        super({ keepAlive: true, maxSockets: 10, maxFreeSockets: 5, timeout: 1000, keepAliveMsecs: 30000 });
        //, keepAliveMsecs: 10000, , maxFreeSockets: 5, timeout: 30000
        this.server = new HypeerServer();
        this.server.once("error", (err) => {
            throw err;
        });
    }

    public createConnection(opt: any, cb: any) {
        const peer = this.server.createConnection();
        peer.on("connect", () => {
            console.log("peer socket online");
            cb(null, peer);
        });

    }

    public init(candidates: string | SignalData) {
        this.server.signal({ candidates });
    }

    public on(event: string, cb: (...args: any[]) => void) {
        console.log('on ' + event)
        if (event == 'signal')
            this.server?.on(event, cb);
        return this;
    }

    public once(event: string, cb: (...args: any[]) => void) {
        console.log('once ' + event)
        return this;
    }

    public removeListener(event: string | symbol, listener: (...args: any[]) => void) {
        this.server.removeListener(event, listener);
    }

    public destroy() {
        this.server.close();
        super.destroy();
    }
}
