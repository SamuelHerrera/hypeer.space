
import net from 'net';
import Peer, { SignalData } from "simple-peer";
const wrtc = require("wrtc");
import HeaderTransformer from './header-host-transformer';
import { Duplex } from "stream";
import axios from 'axios';
import tldjs from 'tldjs';

const myTldjs = tldjs.fromUserSettings({ validHosts: ['localhost'] });
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

    private _signaling: Peer.Instance;
    private peers: { [key: string]: Peer.Instance } = {}

    constructor(opts: opts) {
        if (!opts.localhost.port) {
            throw 'Missing localhost.port argument';
        }
        this.localhostPort = opts.localhost.port;
        this.spaceControl = (opts.client?.spaceControlUrl
            ? opts.client.spaceControlUrl
            : process.env.IS_PROD == 'true' ? 'https://hypeer.space' : `http://localhost:${process.env.PORT || 3000}`)
            + '?hypeer=entangle';
        this.localhostName = opts.localhost.host ? opts.localhost.host : this.localhostName;
        let sendCandidate = (data: string | SignalData) => {
            axios.post(this.spaceControl,
                { subdomain: opts.client?.subdomain, candidates: data }).then((res: any) => {
                    if (res.data?.status == 'entangled') {
                        this.subdomain = res.data.subdomain;
                        this._signaling.signal(res.data.candidates);
                    } else {
                        console.log(`Is not possible to stablish the connection.`);
                        this._signaling?.destroy();
                    }
                }).catch((e: any) => {
                    console.log('error' + e);
                });
        };
        this._signaling = new Peer({ initiator: true, wrtc: wrtc, trickle: false });
        this._signaling.on("signal", (data: string | SignalData) => {
            sendCandidate(data);
        });
        this._signaling.on('connect', () => {
            sendCandidate = (data: string | SignalData) => {
                this._signaling.send(JSON.stringify({ action: 'signal', candidates: data }));
            }
            console.log(`Client entangled. http://${this.subdomain}.${myTldjs.getDomain(this.spaceControl)}:${process.env.PORT || 3000}`);
        });
        this._signaling.on('data', (d: Buffer) => {
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
                    break;
                default:
                    break;
            }
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
        peer.on('error', err => {
            console.log('got peer connection error', err.message);
            delete this.peers[id];
        });
        const connLocal = () => {
            peer.pause();
            const local: Duplex = net.connect({ host: this.localhostName, port: this.localhostPort });
            const peerAfterLife = () => {
                delete this.peers[id];
                local.end();
            };
            peer.once('close', peerAfterLife);
            local.once('error', (err: any) => {
                console.log("error", err)
                local.end();
                peer.removeListener('close', peerAfterLife);
                setTimeout(connLocal, 0);
            });

            local.once('connect', () => {
                let stream = peer.pipe(new HeaderTransformer({ host: this.localhostName }), { end: false });
                stream.pipe(local, { end: false }).pipe(peer, { end: false });
                local.once('close', (hadError: any) => {
                    if (hadError) {
                        console.log(`connection ended with error`);
                    } else {
                        peer.unpipe(stream);
                        peer.removeListener('close', peerAfterLife);
                        if (peer.writable) {
                            setTimeout(connLocal, 0);
                        }
                    }
                });
            });
        };

        peer.on('data', data => {
            const match = data.toString().match(/^(\w+) (\S+)/);
            if (match) {
                console.log('proxying request', {
                    method: match[1],
                    path: match[2],
                });
            }
        });

        peer.on('connect', () => {
            connLocal();
        });

        peer.on("signal", data => {
            this._signaling.send(JSON.stringify({ action: 'signal', id: id, candidates: data }));
        });

        this.peers[id] = peer;
    }
}
