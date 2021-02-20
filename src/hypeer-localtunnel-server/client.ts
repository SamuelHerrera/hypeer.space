import { request, IncomingMessage } from "http";
import { EventEmitter } from "events";
import pump from 'pump';
import { TunnelAgent } from "./tunnel-agent";
import { Request, Response } from "express";
import { Socket } from "net";
import { HypeerServer } from "./hypeer-server";

export class Client extends EventEmitter {
    private _agent: TunnelAgent;
    private _server: HypeerServer;
    private _subdomain: string;

    constructor(subdomain: string) {
        super();
        this._subdomain = subdomain;
        this._server = new HypeerServer();
        this._server.subdomain = this._subdomain;
        this._agent = new TunnelAgent(this._server);
    }

    get server() {
        return this._server;
    }

    close() {
        this._agent.destroy();
        this.emit("close");
    }

    handleRequest(req: Request, res: Response) {
        const opt = {
            path: req.url,
            agent: this._agent,
            method: req.method,
            headers: req.headers,
        };
        const clientReq = request(opt, (clientRes: IncomingMessage) => {
            res.writeHead(clientRes.statusCode || 200, clientRes.headers);
            clientRes.pipe(res, { end: false });
            clientRes.once('end', () => {
                console.log('response ended');
                clientRes.unpipe(res);
                clientRes.emit('readytogo');
            })
        });
        clientReq.once("error", (err) => {
            res.send(err);
        });
        req.once('end', () => {
            console.log('request ended');
            clientReq.write('');
            req.unpipe(clientReq);
            clientReq.emit('readytogo');
        });
        req.pipe(clientReq, { end: false });
    }

    handleUpgrade(req: any, socket: Socket) {
        socket.once("error", (err: any) => {
            if (err.code == "ECONNRESET" || err.code == "ETIMEDOUT") {
                return;
            }
            console.error(err);
        });
        this._agent.createConnection({}, (err: any, conn: any) => {
            console.log("< [up] %s", req.url);
            if (err) {
                socket.end();
                return;
            }
            if (!socket.readable || !socket.writable) {
                conn.destroy();
                socket.end();
                return;
            }
            const arr = [`${req.method} ${req.url} HTTP/${req.httpVersion}`];
            for (let i = 0; i < req.rawHeaders.length - 1; i += 2) {
                arr.push(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}`);
            }
            arr.push("");
            arr.push("");
            pump(conn, socket);
            pump(socket, conn);
            conn.write(arr.join("\r\n"));
        });
    }
}
