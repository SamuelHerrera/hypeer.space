import { Server, ServerOpts, Socket } from "net";
import Peer, { SignalData } from 'simple-peer';
import { PassThrough } from "stream";
import { v4 as uuidv4 } from 'uuid';
const wrtc = require("wrtc");

interface HypeerSocket extends Peer.Instance {
    _id: string;
    timeout: NodeJS.Timeout;
    setKeepAlive(enable: boolean, initialDelay: number): HypeerSocket;
    setTimeout(timeout: number, callback?: Function): HypeerSocket;
    unref(): HypeerSocket;
    ref(): HypeerSocket;

}

export class HypeerServer extends Server {
    private _signaling: Peer.Instance;
    private _online = false;
    public connectedPeers: { [key: string]: Peer.Instance } = {};

    constructor(options?: ServerOpts, connectionListener?: (socket: Socket) => void) {
        super(options, connectionListener);
        this._signaling = new Peer({ wrtc: wrtc, trickle: false });

        this._signaling.on("signal", (data: string | SignalData) => {
            if (this._online) {
                this.signal({ candidates: data })
            } else {
                this.emit('signal', data);
            }
        });
        this._signaling.on('data', (d: Buffer) => {
            const data = JSON.parse(d && d.length ? d.toString() : '{}');
            switch (data.action) {
                case 'signal':
                    this.signal(data);
                    break;
                default:
                    break;
            }
        });
        this._signaling.on("connect", () => {
            console.log("Server online");
            this._online = true;
            this.emit("online");
        });
        this._signaling.once("close", () => {
            console.log("Server offline");
            this.emit("offline");
        });
    }

    public close(cb?: ((err?: Error | undefined) => void) | undefined) {
        let error = undefined;
        try {
            for (let p in this.connectedPeers) {
                this.connectedPeers[p].destroy();
            }
            this._signaling.destroy();
        } catch (e) {
            error = e;
        }
        if (cb) cb(error);
        return this;
    }

    public signal(data: { id?: string, candidates: string | SignalData }) {
        if (data.id) {
            this.connectedPeers[data.id].signal(data.candidates);
        } else {
            this._signaling.signal(data.candidates);
        }
    }

    public createConnection(): Peer.Instance {
        const nid = uuidv4();
        const peer: HypeerSocket = <HypeerSocket>new Peer({ wrtc: wrtc, trickle: true });
        peer._id = nid;
        peer.setKeepAlive = (enable = false, initialDelay = 0) => {
            console.log('peer set keep alive ' + enable);
            if (enable) {
                clearTimeout(peer.timeout);
            } else {
                peer.timeout = setTimeout(() => {
                    peer.destroy();
                }, 10000);
            }
            return peer;
        };
        peer.setTimeout = (timeout: number, callback?: Function) => {
            console.log('peer set timeout: ' + timeout);
            clearTimeout(peer.timeout);
            if (timeout)
                peer.timeout = setTimeout(() => {
                    peer.destroy();
                    if (callback) callback();
                }, 1000);
            return peer;
        };
        peer.unref = () => {
            console.log('peer unref');
            return peer;
        };
        peer.ref = () => {
            console.log('peer ref');
            return peer;
        };
        peer.once("close", () => {
            console.log("peer closed");
            delete this.connectedPeers[nid];
        });
        peer.on('unpipe', () => {
            console.log('peer unpiped');
        });
        peer.once("error", (err: any) => {
            console.log("peer got error: [%s]", err);
            delete this.connectedPeers[nid];
        });
        peer.on("signal", (data: string | SignalData) => {
            console.log(`peer [${nid}] got signal, sending space location...`);
            this._signaling.send(JSON.stringify({ action: 'signal', id: nid, candidates: data }));
        });

        this._signaling.send(JSON.stringify({ action: 'create', id: nid }));
        this.connectedPeers[nid] = peer;

        console.log("peer created, count: %s", Object.keys(this.connectedPeers)?.length);
        return peer;
    }

    get online() {
        return this._online;
    }

}