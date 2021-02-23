
import net from 'net';
import Peer, { SignalData } from "simple-peer";
const wrtc = require("wrtc");
import HeaderTransformer from './header-host-transformer';
import { Duplex } from "stream";
import axios from 'axios';

export class HypClient {
    private subdomain: string;
    private port: number;
    private host: string = process.env.HOST || 'localhost';
    private _signaling: Peer.Instance;
    private peers: { [key: string]: Peer.Instance } = {}
    private sendCandidate = (data: string | SignalData) => {
        axios.post('http://localhost:3000/?hypeer=entangle',
            { subdomain: this.subdomain, candidates: data }).then((res: any) => {
                if (!this.subdomain) {
                    this.subdomain = res.subdomain;
                }
                this._signaling.signal(res.data.candidates);
            }).catch((e: any) => {
                console.log('error' + e);
            });
    };

    constructor(opts: any = {}) {
        this.port = opts.cport || parseInt(process.env.CLIENT_PORT || '5500') || 5500;
        this.subdomain = opts.subdomain || 'test';
        this._signaling = new Peer({ initiator: true, wrtc: wrtc, trickle: false });
        this._signaling.on("signal", (data: string | SignalData) => {
            this.sendCandidate(data);
        });
        this._signaling.on('connect', () => {
            this.sendCandidate = (data: string | SignalData) => {
                this._signaling.send(JSON.stringify({ action: 'signal', candidates: data }));
            }
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

    public entangle(id: string) {
        const peer: Peer.Instance = new Peer({ initiator: true, wrtc: wrtc, trickle: true });
        peer.on('error', err => {
            console.log('got peer connection error', err.message);
            delete this.peers[id];
        });
        const connLocal = () => {
            peer.pause();
            const local: Duplex = net.connect({ host: this.host, port: this.port });
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
                let stream = peer.pipe(new HeaderTransformer({ host: this.host }), { end: false });
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
