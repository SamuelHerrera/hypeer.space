import Debug from "debug";
import { Server, ServerOpts, Socket } from "net";
import Peer, { SignalData } from 'simple-peer';
import { v4 as uuidv4 } from 'uuid';
const wrtc = require("wrtc");
const debug = Debug("HypServer");
interface HypeerSocket extends Peer.Instance {
    _id: string;
    timeout: NodeJS.Timeout;
    setKeepAlive(enable: boolean, initialDelay: number): HypeerSocket;
    setTimeout(timeout: number, callback?: Function): HypeerSocket;
    unref(): HypeerSocket;
    ref(): HypeerSocket;
    destroy(error?: Error): void;
}

export class HypServer extends Server {
    private _signaling: Peer.Instance;
    private _online = false;
    private _connectedPeers: { [key: string]: Peer.Instance } = {};
    private _peerState: { [key: string]: boolean } = {};

    constructor(options?: ServerOpts, connectionListener?: (socket: Socket) => void) {
        super(options, connectionListener);
        this._signaling = this.initSignaling();
    }

    private initSignaling() {
        debug(`initSignaling`);
        return new Peer({ wrtc: wrtc, trickle: false })
            .on("signal", (data: string | SignalData) => {
                debug(`Got signal, online ${this._online}`);
                if (this._online) {
                    this.signal({ candidates: data })
                } else {
                    this.emit('signal', data);
                }
            }).on('data', (d: Buffer) => {
                const data = JSON.parse(d && d.length ? d.toString() : '{}');
                switch (data.action) {
                    case 'signal':
                        this.signal(data);
                        break;
                    default:
                        break;
                }
            }).on("connect", () => {
                debug(`Connected, server online`);
                this._online = true;
                this.emit("online");
            }).once("close", () => {
                debug(`Closed, server offline`);
                this._online = false;
                this.emit("offline");
            }).once("error", (err: any) => {
                debug(`Signaling got error, server offline. [${err}]`);
                this._online = false;
                this.emit("offline");
            });
    }

    public close(cb?: ((err?: Error | undefined) => void) | undefined) {
        debug(`Called close(), about to destroy peers`);
        let error = undefined;
        try {
            for (let p in this._connectedPeers) {
                this._connectedPeers[p].destroy();
            }
            this._signaling.destroy();
        } catch (e) {
            error = e;
        }
        debug(`Peers cleared, error [${error}]`);
        if (cb) cb(error);
        return this;
    }

    public signal(data: { id?: string, candidates: string | SignalData }) {
        if (data.id) {
            this._connectedPeers[data.id].signal(data.candidates);
        } else {
            this._signaling.signal(data.candidates);
        }
    }

    public createConnection(cb?: any): Peer.Instance {
        const nid = uuidv4();
        debug(`[${nid}] Starting connection`);
        const peer: HypeerSocket = <HypeerSocket>new Peer({ wrtc: wrtc, trickle: true });
        peer._id = nid;
        peer.setKeepAlive = (enable = false, initialDelay = 0) => {
            clearTimeout(peer.timeout);
            if (enable) {
                peer.timeout = setTimeout(() => {
                    peer.destroy();
                }, initialDelay);
            } else {
                peer.timeout = setTimeout(() => {
                    peer.destroy();
                }, 10000);
            }
            return peer;
        };
        peer.setTimeout = (timeout: number, callback?: Function) => {
            clearTimeout(peer.timeout);
            if (timeout) {
                debug('peer set timeout: ' + timeout);
                peer.timeout = setTimeout(() => {
                    peer.destroy();
                    if (callback) callback();
                }, timeout);
            }
            return peer;
        };
        peer.unref = () => {
            debug(`[${nid}] peer unref`);
            return peer;
        };
        peer.ref = () => {
            debug(`[${nid}] peer ref`);
            return peer;
        };

        peer.once("close", () => {
            debug(`[${nid}] peer closed`);
            delete this._connectedPeers[nid];
            delete this._peerState[nid];
        });
        peer.once("error", (err: any) => {
            debug(`[${nid}] peer got error: [${err}]`);
            delete this._connectedPeers[nid];
            delete this._peerState[nid];
        });
        peer.on("signal", (data: string | SignalData) => {
            this._signaling.send(JSON.stringify({ action: 'signal', id: nid, candidates: data }));
        });
        peer.on("connect", () => {
            if (cb)
                cb(null, peer);
        });
        this._signaling.send(JSON.stringify({ action: 'create', id: nid }));
        this._connectedPeers[nid] = peer;
        debug(`[${nid}] Signaling send, returning peer`);
        return peer;
    }

    get online() {
        return this._online;
    }

    get connectedPeers() {
        return Object.keys(this._connectedPeers).length;
    }

}