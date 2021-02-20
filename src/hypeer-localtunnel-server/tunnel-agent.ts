import { Agent } from "http";
import { Server } from "net";

export class TunnelAgent extends Agent {
    private waitingCreateConn: any = [];
    public server: Server;
    private closed: any = false;

    constructor(server: Server) {
        super({ keepAlive: false, maxFreeSockets: 1 });
        this.server = server;
        this.server.once("error", (err) => {
            throw err;
        });
        this.server.on("freeSocket", (socket) => {
            socket.resume();
            const cb = this.waitingCreateConn.shift();
            if (cb) {
                console.log("Agent: giving socket to queued conn request");
                setTimeout(() => { cb(null, socket); }, 0);
            }
        });
    }

    _onClose() {
        this.closed = true;
        console.log("Agent: closed tcp socket");
        for (const conn of this.waitingCreateConn) {
            conn(new Error("closed"), null);
        }
        this.waitingCreateConn = [];
        this.server.emit("end");
    }

    createConnection(opt: any, cb: any) {
        if (this.closed) {
            cb(new Error("Error: connection already closed"), null);
            return;
        }
        this.waitingCreateConn.push(cb);
        setTimeout(() => {
            this.server.emit("awaiting");
        }, 0);
    }

    destroy() {
        this.server.close();
        super.destroy();
    }
}
