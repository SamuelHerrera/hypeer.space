import { Client } from './client';
import express, { Express, Request, Response, NextFunction } from "express";
import _ash from 'express-async-handler'
import tldjs from 'tldjs';
const myTldjs = tldjs.fromUserSettings({ validHosts: ['localhost'] });

export class ServerFactory {
    private static _app: Express;
    private static _portals: { [key: string]: Client; } = {}
    constructor() {
    }

    static get app() {
        if (!this._app) {
            this._app = express();
            this._app.use(express.json());
            this._app.use(_ash(this.middleware.bind(this)));
        }
        return this._app;
    }

    private static async middleware(req: Request, res: Response, next: NextFunction) {
        const subdomain = req.headers.host ? myTldjs.getSubdomain(req.headers.host) : null;
        if (!req.query.hypeer) {
            if (subdomain) {
                const client: Client = this._portals[subdomain];
                if (client) {
                    client.handleRequest(req, res);
                } else {
                    res.status(404).end();
                }
            } else {
                next();
            }
        } else {
            switch (req.query.hypeer) {
                case 'entangle':
                    if (!req.body.subdomain) {
                        res.json({
                            status: 'error',
                            response: 'Must specify id'
                        });
                        return;
                    }
                    let portal = this._portals[req.body.subdomain]
                    if (!portal) {
                        const client = new Client(req.body.subdomain);
                        this._portals[req.body.subdomain] = client;
                        client.once("close", () => {
                            console.log("Manager: removing closed client: %s", req.body.subdomain);
                            const clientToClose = this._portals[req.body.subdomain];
                            if (!clientToClose) { return; }
                            delete this._portals[req.body.subdomain];
                            clientToClose.close();
                        });
                        console.log("Manager: client initialized: http://%s.localhost:3000", req.body.subdomain);
                        portal = client;
                    }

                    const peer = portal.server.createConnection();
                    const prom = new Promise(resolve => {
                        peer.on("signal", data => {
                            console.log("got signal, broadcasting...");
                            if (resolve) resolve(data);
                        });
                    });
                    peer.signal(req.body.candidates);

                    res.json({
                        status: 'entangled',
                        id: '',
                        candidates: await prom
                    });
                    break;
                case 'release':
                    if (!this._portals[req.body.subdomain]) {
                        res.json({
                            status: 'released',
                            response: 'The resource was already released'
                        });
                        return;
                    }
                    this._portals[req.body.subdomain].close();
                    res.json({
                        status: 'released',
                        response: 'ok'
                    });
                    break;
                case 'restart':
                    for (const k in this._portals) {
                        this._portals[k].close();
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
}
