import { Server, ServerOpts, Socket } from "net";
import Peer, { SignalData } from 'simple-peer';
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

export class HypServer extends Server {
    private _signaling: Peer.Instance;
    private _online = false;
    private connectedPeers: { [key: string]: Peer.Instance } = {};

    constructor(options?: ServerOpts, connectionListener?: (socket: Socket) => void) {
        super(options, connectionListener);
        this._signaling = this.initSignaling();
    }

    private initSignaling() {
        return new Peer({ wrtc: wrtc, trickle: false })
            .on("signal", (data: string | SignalData) => {
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
                console.log("Server online");
                this._online = true;
                this.emit("online");
            }).once("close", () => {
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
                console.log('peer set timeout: ' + timeout);
                peer.timeout = setTimeout(() => {
                    peer.destroy();
                    if (callback) callback();
                }, timeout);
            }
            return peer;
        };
        peer.unref = () => {
            return peer;
        };
        peer.ref = () => {
            return peer;
        };
        peer.once("close", () => {
            delete this.connectedPeers[nid];
        });
        peer.once("error", (err: any) => {
            console.log("peer got error: [%s]", err);
            delete this.connectedPeers[nid];
        });
        peer.on("signal", (data: string | SignalData) => {
            this._signaling.send(JSON.stringify({ action: 'signal', id: nid, candidates: data }));
        });
        this._signaling.send(JSON.stringify({ action: 'create', id: nid }));
        this.connectedPeers[nid] = peer;
        return peer;
    }

    get online() {
        return this._online;
    }

}