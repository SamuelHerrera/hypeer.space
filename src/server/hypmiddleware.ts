import Debug from "debug";
import { IncomingMessage, request } from "http";
import { Request, Response, NextFunction } from "express";
import { uniqueNamesGenerator, Config, adjectives, colors, animals } from 'unique-names-generator';
import { HypAgent } from './hypagent';
import { Socket } from "net";
import tldjs from 'tldjs';
import pump from 'pump';
import * as path from 'path';

const myTldjs = tldjs.fromUserSettings({ validHosts: ['localhost'] });
const debug = Debug("hyp-middleware");

export class HypMiddleware {
  private static ENTANGLE_TIMEOUT = 15000;
  private static _agents: { [key: string]: HypAgent; } = {}
  private static customConfig: Config = {
    dictionaries: [adjectives, colors, animals],
    separator: '-',
    length: 2,
  };

  public static get middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (req.query.hypeer) {
        this.hypeerSpaceControl(req, res, next);
      } else {
        this.hypeerPortalAgentControl(req, res, next);
      }
    }
  }

  public static get wsMiddleware() {
    return (req: Request, socket: Socket) => {
      const key = this.getKey(req);
      const agent: HypAgent = this._agents[key];
      if (agent) {
        socket.once("error", (err: any) => {
          if (err.code == "ECONNRESET" || err.code == "ETIMEDOUT") {
            return;
          }
          console.error(err);
        });
        agent.createConnection({}, (err: any, conn: any) => {
          debug("< [up] %s", req.url);
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
  }

  private static hypeerPortalAgentControl(req: Request, res: Response, next: NextFunction) {
    const key = this.getKey(req);
    const agent: HypAgent = this._agents[key];
    debug(`hypeerPortalAgentControl handling req for client [${key}]`);
    if (agent) {
      const opt = { path: req.url, agent: agent, method: req.method, headers: req.headers };
      const clientReq = request(opt, (clientRes: IncomingMessage) => {
        debug(`< [${req.url}]`);
        res.writeHead(clientRes.statusCode || 200, clientRes.headers);
        pump(clientRes, res);
      });
      clientReq.once("error", (err) => {
        debug(`clientReq errored for [${req.url}] [${err}]`);
      });
      pump(req, clientReq);
    } else {
      next();
    }
  }

  private static hypeerSpaceControl(req: Request, res: Response, next: NextFunction) {
    let key: string;
    let bodyArr: any[] = [];
    req.on('data', (chunk: any) => {
      bodyArr.push(chunk);
    }).on('end', () => {
      // on end of data, perform necessary action
      req.body = JSON.parse(Buffer.concat(bodyArr).toString());
      switch (req.query.hypeer) {
        case 'entangle':
          key = req.body.subdomain;
          let agent = this._agents[key];
          if (agent) {
            agent.destroy();
          }
          agent = new HypAgent();
          agent.onceClose(() => {
            debug("middleware removing closed client: %s", key);
            delete this._agents[key];
            agent.destroy();
          });
          this._agents[key] = agent;
          const timeout = setTimeout(() => {
            res.json({
              status: 'timed out',
              subdomain: key
            });
          }, this.ENTANGLE_TIMEOUT);
          const handler = (data: any) => {
            clearTimeout(timeout);
            agent.removeListener('signal', handler);
            res.json({
              status: 'entangled',
              subdomain: key,
              candidates: data
            });
          };
          agent.onSignal(handler);
          agent.signal(req.body.candidates);
          break;
        case 'release':
          if (!this.secret(req, res)) return;
          key = req.body.subdomain;
          if (!this._agents[key]) {
            res.json({
              status: 'released',
              response: 'The resource was already released'
            });
          } else {
            this._agents[key].destroy();
            res.json({
              status: 'released',
              response: 'ok'
            });
          }
          break;
        case 'restart':
          if (!this.secret(req, res)) return;
          for (const k in this._agents) {
            this._agents[k].destroy();
          }
          res.json({
            status: 'released',
            response: 'ok'
          });
          break;
        case 'stats':
          if (!this.secret(req, res)) return;
          const keys = Object.keys(this._agents);
          const clientStats: any[] = [];
          for (const k of keys) {
            const s = { name: k, connections: this._agents[k]?.connectedPeers() };
            clientStats.push(s);
          }
          res.json({
            client: clientStats,
            count: keys.length,
          });
          break;
        case 'hypclient-browser.js':
          res.sendFile(path.join(__dirname, '../client/www/hypclient-browser.js'));
          break;
        default:
          next();
      }
    });
  }


  private static getKey(req: Request) {
    const hs = myTldjs.getSubdomain(req.headers.host || '') || null;
    return (hs ? hs : uniqueNamesGenerator(this.customConfig));
  }

  private static secret(req: Request, res: Response) {
    if (process.env.SECRET) {
      if (!req.query.secret || process.env.SECRET != req.query.secret) {
        res.status(403);
        return false;
      }
    }
    return true;
  }
}
