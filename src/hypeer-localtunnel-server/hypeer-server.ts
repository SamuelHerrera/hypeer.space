import { Server, ServerOpts, Socket } from "net";
import Peer from 'simple-peer';
const wrtc = require("wrtc");

export class HypeerServer extends Server {
    public availableSockets: Peer.Instance[];
    public waitingCreateConnCount: number;
    public connectedSockets: number;
    public subdomain: string = '';

    constructor(options?: ServerOpts, connectionListener?: (socket: Socket) => void) {
        super(options);

        this.waitingCreateConnCount = 0;
        this.availableSockets = [];
        this.connectedSockets = 0;

        this.on("awaiting", async () => {
            console.log(`Socket is awaiting`);
            let sock = this.availableSockets.shift();
            let stillOn = sock?.writable && sock.readable;
            while (!stillOn && sock) {
                sock = this.availableSockets.shift();
                stillOn = sock && sock.writable && sock.readable;
            }
            if (!sock) {
                ++this.waitingCreateConnCount;
            } else {
                this.emit("freeSocket", sock);
            }
        });

        this.on("socketReady", () => {
            console.log("Socket became ready, pending queue: " + this.waitingCreateConnCount);
            if (this.waitingCreateConnCount > 0) {
                const sock = this.availableSockets.shift();
                if (sock && sock.writable && sock.readable) {
                    this.emit("freeSocket", sock);
                    --this.waitingCreateConnCount;
                } else {
                    throw 'Error: Invalid socket state, check connectivity issues w:' + sock?.writable + ' r:' + sock?.readable;
                }
            }
        });

        this.on("online", () => {
            console.log("Server online");
        });

        this.on("offline", () => {
            console.log("Server offline");
        });

        this.on("close", () => {
            for (let p of this.availableSockets) {
                p.destroy();
            }
        })
    }

    public createConnection(_peer?: Peer.Instance): Peer.Instance {
        if (!_peer) {
            console.log(`Creating connection`);
            const peer = new Peer({ wrtc: wrtc, trickle: false });
            peer.on("data", data => {
                console.log("got data! on portal");
            });
            peer.on("connect", () => {
                console.log("peer connected");
            });
            peer.once("close", () => {
                console.log("peer closed");
                this.connectedSockets -= 1;
            });
            peer.on('unpipe', () => {
                console.log('peer unpiped');
            });
            peer.once("readytogo", () => {
                this.createConnection(peer);
                console.log("peers connected: %s", this.connectedSockets);
            });
            peer.once("error", (err: any) => {
                console.log("Error: peer got [%s]", err);
                if (typeof err == "string" && err.includes("No such API call.")) {
                    this.availableSockets = [];
                    this.connectedSockets = 0;
                } else {
                    const idx = this.availableSockets.indexOf(peer);
                    if (idx >= 0) {
                        this.availableSockets.splice(idx, 1);
                    }
                }
                if (this.connectedSockets <= 0) {
                    this.emit("offline");
                }
            });
            _peer = peer;
        }
        console.log(`Storing idle peer`);
        this.connectedSockets += 1;
        this.availableSockets.push(_peer);
        setTimeout(() => {
            this.emit("socketReady");
        }, 0);
        return _peer;
    }
}