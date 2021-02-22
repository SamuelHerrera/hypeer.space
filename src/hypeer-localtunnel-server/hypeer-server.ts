import { Server, ServerOpts, Socket } from "net";
import Peer from 'simple-peer';
import { v4 as uuidv4 } from 'uuid';
const wrtc = require("wrtc");

export class HypeerServer extends Server {
    public availableSockets: Peer.Instance[];
    private waitingCreateConn: any[];
    public connectedSockets: number;
    public subdomain: string = '';

    constructor(options?: ServerOpts, connectionListener?: (socket: Socket) => void) {
        super(options);

        this.waitingCreateConn = [];
        this.availableSockets = [];
        this.connectedSockets = 0;

        this.on("awaiting", (cb: any) => {
            console.log(`a connection is awaiting socket`);
            let sock = this.availableSockets.shift();
            let stillOn = sock?.writable && sock.readable;
            while (!stillOn && sock) {
                sock = this.availableSockets.shift();
                stillOn = sock && sock.writable && sock.readable;
            }
            if (!sock) {
                console.log(`... little conn needs to wait`);
                this.waitingCreateConn.push(cb);
            } else {
                sock.resume();
                console.log("... connection on the way");
                setTimeout(() => { cb(null, sock); }, 0);
            }
        });

        this.on("socketReady", () => {
            console.log(`Socket became ready,free socks: ${this.availableSockets.length} pending queue: ${this.waitingCreateConn.length}`);
            if (this.waitingCreateConn.length > 0) {
                const cb = this.waitingCreateConn.shift();
                if (cb) {
                    this.emit('awaiting', cb);
                }
            }
        });

        this.on("online", () => {
            console.log("Server online");
        });

        this.on("offline", () => {
            console.log("Server offline");
            for (const conn of this.waitingCreateConn) {
                conn(new Error("Server became offline"), null);
            }
            this.waitingCreateConn = [];
        });

        this.on("close", () => {
            for (let p of this.availableSockets) {
                p.destroy();
            }
        });

    }

    public createConnection(_peer?: Peer.Instance): Peer.Instance {
        if (!_peer) {
            console.log(`Creating connection`);
            const peer = new Peer({ wrtc: wrtc, trickle: false });
            (<any>peer)['_id'] = uuidv4();
            (<any>peer)['setKeepAlive'] = (x: any) => {
                console.log('peer set keep alive ' + x);
            };
            (<any>peer)['unref'] = () => {
                console.log('peer unref');
                setTimeout(() => {
                    peer.emit('readytogo');
                }, 0);
            };
            (<any>peer)['ref'] = () => {
                console.log('peer ref, now sock is busy');
                const idx = this.availableSockets.indexOf(peer);
                if (idx >= 0) {
                    this.availableSockets.splice(idx, 1);
                }
            };
            peer.on("connect", () => {
                console.log("peer connected");
                if (this.connectedSockets == 1) {
                    this.emit("online");
                }
            });
            peer.once("close", () => {
                console.log("peer closed");
                this.connectedSockets--;
            });
            peer.on('unpipe', () => {
                console.log('peer unpiped');
            });
            peer.once("readytogo", () => {
                this.createConnection(peer);
            });
            peer.once("error", (err: any) => {
                console.log("Error: peer got [%s]", err);
                const idx = this.availableSockets.indexOf(peer);
                if (idx >= 0) {
                    this.availableSockets.splice(idx, 1);
                }
                if (this.connectedSockets <= 0) {
                    this.emit("offline");
                }
            });
            this.connectedSockets++;
            _peer = peer;
        }
        console.log(`Storing idle peer`);
        this.availableSockets.push(_peer);
        setTimeout(() => {
            this.emit("socketReady");
        }, 0);
        console.log("peers connected: %s", this.connectedSockets);
        return _peer;
    }

}