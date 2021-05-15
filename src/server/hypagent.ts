import { Agent } from "http";
import { HypServer } from "./hypserver";

export class HypAgent extends Agent {
    private _server: HypServer;

    constructor() {
        super({
            keepAlive: true
        });
        this._server = new HypServer();
        this._server.once("error", (err) => {
            throw err;
        });
    }

    public createConnection(opt: any, cb: any) {
        this._server.createConnection(cb);
    }

    public signal(candidates: string | {
        type?: 'offer' | 'pranswer' | 'answer' | 'rollback';
        sdp?: any;
        candidate?: any;
    }) {
        this._server.signal({ candidates });
    }

    public onSignal(cb: (...args: any[]) => void) {
        this._server?.on('signal', cb);
    }

    public onceClose(cb: (...args: any[]) => void) {
        this._server?.once('offline', cb);
    }

    public removeListener(event: string | symbol, listener: (...args: any[]) => void) {
        this._server.removeListener(event, listener);
    }

    public destroy() {
        this._server.close();
        super.destroy();
    }

    public connectedPeers() {
        return this._server?.connectedPeers;
    }
}
