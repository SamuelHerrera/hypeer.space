import Debug from "debug";
import net from 'net';
import tls from 'tls';
import fs from 'fs';
import Peer, { SignalData } from "simple-peer";
const wrtc = require("wrtc");
import HeaderTransformer from './header-host-transformer';
import { Duplex } from "stream";
import axios from 'axios';
import tldjs from 'tldjs';

const myTldjs = tldjs.fromUserSettings({ validHosts: ['localhost'] });
const debug = Debug("hyp-client");

interface opts {
  client?: {
    subdomain?: string;
    spaceControlUrl?: string;
  };
  localhost: {
    port: number;
    host?: string
  };
}

export class HypClient {
  private spaceControl: string;
  private subdomain: string | null = null;
  private localhostPort: any;
  private localhostName: string = 'localhost';
  private https: boolean = false;
  private allowInvalidCert: boolean = false;
  private local_cert: string = '';
  private local_key: string = '';
  private local_ca: string = '';

  private _signaling: Peer.Instance;
  private peers: { [key: string]: Peer.Instance } = {}

  constructor(opts: opts) {
    if (!opts.localhost.port) {
      throw 'Missing localhost.port argument';
    }
    this.localhostPort = opts.localhost.port;
    this.spaceControl = (opts.client?.spaceControlUrl
      ? opts.client.spaceControlUrl
      : process.env.IS_PROD == 'true' ? 'https://hypeer.space' : `http://localhost:${process.env.PORT || 4500}`)
      + '?hypeer=entangle';
    this.localhostName = opts.localhost.host ? opts.localhost.host : this.localhostName;
    this._signaling = this.initSignaling(opts);
  }

  public initSignaling(opts: opts) {
    let sendCandidate = (data: string | SignalData) => {
      axios.post(this.spaceControl,
        { subdomain: opts.client?.subdomain, candidates: data }).then((res: any) => {
          if (res.data?.status == 'entangled') {
            this.subdomain = res.data.subdomain;
            this._signaling.signal(res.data.candidates);
          } else {
            debug(`Is not possible to stablish the connection.`);
            this._signaling?.destroy();
          }
        }).catch((e: any) => {
          debug('error' + e);
        });
    };
    return new Peer({ initiator: true, wrtc: wrtc, trickle: false })
      .on("signal", (data: string | SignalData) => {
        sendCandidate(data);
      }).on('connect', () => {
        debug(`entangled http://${this.subdomain}.${myTldjs.getDomain(this.spaceControl)}`);
        sendCandidate = (data: string | SignalData) => {
          this._signaling.send(JSON.stringify({ action: 'signal', candidates: data }));
        }
      }).on('data', (d: Buffer) => {
        const data = JSON.parse(d && d.length ? d.toString() : '{}');
        switch (data.action) {
          case 'signal':
            if (data.id) {
              this.peers[data.id]?.signal(data.candidates);
            } else {
              this._signaling.signal(data.candidates);
            }
            break;
          case 'create':
            this.entangle(data.id);
            debug(`[${data.id}] Entangled`);
            break;
          default:
            break;
        }
      }).on('error', err => {
        debug('signaling connection error:', err.message);
        setTimeout(() => {
          this._signaling?.destroy();
          this._signaling = this.initSignaling(opts);
        }, 0);
      });
  }

  public destroy() {
    this._signaling.destroy();
    for (const k in this.peers) {
      this.peers[k]?.destroy();
    }
  }

  public entangle(id: string) {
    const peer: Peer.Instance = new Peer({ initiator: true, wrtc: wrtc, trickle: true });

    const connLocal = () => {
      peer.pause();
      const getLocalCertOpts = () =>
        this.allowInvalidCert
          ? { rejectUnauthorized: false }
          : {
            cert: fs.readFileSync(this.local_cert),
            key: fs.readFileSync(this.local_key),
            ca: this.local_ca ? [fs.readFileSync(this.local_ca)] : undefined,
          };

      const local: Duplex = this.https
        ? tls.connect({ host: this.localhostName, port: this.localhostPort, ...getLocalCertOpts() })
        : net.connect({ host: this.localhostName, port: this.localhostPort });


      const remoteClose = () => {
        debug(`[${id}] called afterlife to destroy peer`);
        delete this.peers[id];
        local.end();
      };

      peer.once('close', remoteClose);

      local.once('error', (err: any) => {
        debug("local socket got error ", err)
        local.end();
        peer.removeListener('close', remoteClose);
        console.log(err.code);
        if (err.code == 'ECONNREFUSED') {
          return this._signaling?.destroy();
        }
        setTimeout(connLocal, 0);
      });

      local.once('connect', () => {
        peer.resume();
        debug(`[${id}] local connected, entangling`);
        let stream = peer.pipe(new HeaderTransformer({ host: this.localhostName }));
        stream.pipe(local).pipe(peer);
        debug(`[${id}] entangled`);
        local.once('close', (hadError: any) => {
          if (hadError) {
            debug(`[${id}] connection ended with error`);
          } else if (peer.writable) {
            debug(`[${id}] local connection ended, is peer writable [${peer.writable}], reconnecting.`);
            setTimeout(connLocal, 0);
          } else {
            debug(`[${id}] local connection ended, is peer writable [${peer.writable}]`);
          }
        });
      });
    };

    peer.on('error', err => {
      debug('got peer connection error', err.message);
      delete this.peers[id];
    }).on('data', data => {
      const match = data.toString().match(/^(\w+) (\S+)/);
      if (match) {
        debug(`proxying request ${id}`, { method: match[1], path: match[2], });
      }
    }).on('connect', () => {
      connLocal();
    }).on("signal", data => {
      this._signaling.send(JSON.stringify({ action: 'signal', id: id, candidates: data }));
    });
    this.peers[id] = peer;
  }
}
