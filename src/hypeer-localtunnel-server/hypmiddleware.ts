import { Request, Response, NextFunction } from "express";
import { IncomingMessage, request } from "http";
import tldjs from 'tldjs';
import pump from 'pump';
const myTldjs = tldjs.fromUserSettings({ validHosts: ['localhost'] });
import { uniqueNamesGenerator, Config, adjectives, colors, animals } from 'unique-names-generator';
import { HypAgent } from './hypagent';
import { Socket } from "net";
import { SignalData } from "simple-peer";

export class HypMiddleware {
    private static ENTANGLE_TIMEOUT = 15000;
    private static _portals: { [key: string]: HypAgent; } = {}
    private static customConfig: Config = {
        dictionaries: [adjectives, colors, animals],
        separator: '-',
        length: 2,
    };

    public static get middleware() {
        return this.requestHandler.bind(this);
    }

    public static get wsMiddleware() {
        return this.handleUpgrade.bind(this);
    }

    private static handleUpgrade(req: any, socket: Socket) {
        console.log('hanlding upgrade');
        const key = this.getKey(req);
        const agent: HypAgent = this._portals[key];
        if (agent) {
            socket.once("error", (err: any) => {
                if (err.code == "ECONNRESET" || err.code == "ETIMEDOUT") {
                    return;
                }
                console.error(err);
            });
            agent.createConnection({}, (err: any, conn: any) => {
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
            return true;
        } else {
            return false;
        }
    }

    private static requestHandler(req: Request, res: Response, next: NextFunction) {
        const key = this.getKey(req);
        console.log(`handling req key:${key}`);
        if (req.query.hypeer) {
            this.hypeerHandler(req, res);
        } else {
            const agent: HypAgent = this._portals[key];
            if (agent) {
                const opt = {
                    path: req.url,
                    agent: agent,
                    method: req.method,
                    headers: req.headers,
                };

                const clientReq = request(opt);
                clientReq.on('socket', (sock: Socket) => {
                    req.once('end', () => {
                        console.log(`request [${req.url}] ended`);
                        req.unpipe(clientReq);
                        clientReq.end();
                    });
                    clientReq.on('response', (clientRes: IncomingMessage) => {
                        console.log(`got response from client [${req.url}], teleporting...`);
                        res.writeHead(clientRes.statusCode || 200, clientRes.headers);
                        clientRes.pipe(res, { end: false });
                        clientRes.on('end', () => {
                            console.log(`response [${req.url}] teleported`);
                            clientRes.unpipe(sock);
                            res.end();
                        });
                    });
                    req.pipe(clientReq, { end: false });
                });
                clientReq.once("error", (err) => {
                    console.log('error in request ' + err);
                    res.send(err);
                });
            } else {
                next();
            }
        }
    }

    private static getKey(req: Request) {
        const host = req.headers.host || '';
        const domain = myTldjs.getDomain(host) || '';
        const subdomain = myTldjs.getSubdomain(host) || req.body.subdomain || '';
        return `${domain}-${subdomain}`;
    }


    private static hypeerHandler(req: Request, res: Response) {
        console.log('case: ' + req.query.hypeer)
        let key: string;
        switch (req.query.hypeer) {
            case 'entangle':
                if (!req.body.subdomain) {
                    req.body.subdomain = uniqueNamesGenerator(this.customConfig);
                }
                key = this.getKey(req);
                let portal = this._portals[key]
                console.log(`portals: ${key} ${portal}`)
                if (!portal) {
                    portal = new HypAgent();
                    portal.once("close", () => {
                        console.log("middleware removing closed client: %s", key);
                        delete this._portals[key];
                        portal.destroy();
                    });
                    console.log("Manager: client initialized: http://%s.localhost:3000", req.body.subdomain);
                    this._portals[key] = portal;
                }
                const timeout = setTimeout(() => {
                    res.json({
                        status: 'timed out',
                        subdomain: req.body.subdomain
                    });
                }, this.ENTANGLE_TIMEOUT);
                const handler = (data: string | SignalData) => {
                    console.log("got signal, broadcasting...");
                    clearTimeout(timeout);
                    portal.removeListener('signal', handler);
                    res.json({
                        status: 'entangled',
                        subdomain: req.body.subdomain,
                        candidates: data
                    });
                };
                portal.on('signal', handler);
                portal.init(req.body.candidates);
                break;
            case 'release':
                key = this.getKey(req);
                if (!this._portals[key]) {
                    res.json({
                        status: 'released',
                        response: 'The resource was already released'
                    });
                } else {
                    this._portals[key].destroy();
                    res.json({
                        status: 'released',
                        response: 'ok'
                    });
                }
                break;
            case 'restart':
                for (const k in this._portals) {
                    this._portals[k].destroy();
                }
                res.json({
                    status: 'released',
                    response: 'ok'
                });
                break;
            default:
                res.status(400);
        }
    }
}
