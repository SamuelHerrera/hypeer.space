import { Agent } from "http";
import { Server } from "net";

export class TunnelAgent extends Agent {
    public server: Server;
    private closed: any = false;

    constructor(server: Server) {
        super({ keepAlive: true });
        this.server = server;
        this.server.once("error", (err) => {
            throw err;
        });
    }

    _onClose() {
        this.closed = true;
        console.log("Agent: closed tcp socket");
        this.server.emit("end");
    }

    createConnection(opt: any, cb: any) {
        if (this.closed) {
            cb(new Error("Error: connection already closed"), null);
            return;
        }
        setTimeout(() => {
            this.server.emit("awaiting", cb);
        }, 0);
    }

    destroy() {
        this.server.close();
        super.destroy();
    }
}
