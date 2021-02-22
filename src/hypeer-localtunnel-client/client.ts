
import net from 'net';
import Peer from "simple-peer";
const wrtc = require("wrtc");
import HeaderTransformer from './header-host-transformer';
import { Duplex } from "stream";
import axios from 'axios';

export class Client {
    private subdomain: string;
    private port: number;
    private host: string = process.env.HOST || 'localhost';
    private peers: { [key: string]: Peer.Instance } = {}

    constructor(opts: any = {}) {
        this.port = opts.cport || parseInt(process.env.CLIENT_PORT || '5500') || 5500;
        this.subdomain = opts.subdomain || 'test';
    }

    public entangle() {
        const peer: Peer.Instance = new Peer({ initiator: true, wrtc: wrtc, trickle: false });

        peer.on('error', err => {
            console.log('got peer connection error', err.message);
        });

        const connLocal = () => {
            console.log('Initiating conn local');
            peer.pause();
            const local: Duplex = net.connect({ host: this.host, port: this.port });
            const remoteClose = () => {
                console.log('peer closed, ending local.');
                local.end();
            };

            peer.once('close', remoteClose);
            local.once('error', (err: any) => {
                console.log("error", err)
                local.end();
                peer.removeListener('close', remoteClose);
                setTimeout(connLocal, 0);
            });

            local.once('connect', () => {
                let stream = peer.pipe(new HeaderTransformer({ host: this.host }), { end: false });
                stream.pipe(local, { end: false }).pipe(peer, { end: false });

                local.once('close', (hadError: any) => {
                    console.log('local connection closed [%s], had error:', hadError);
                    peer.unpipe(stream);
                    peer.removeListener('close', remoteClose);
                    setTimeout(connLocal, 0);
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
            console.log("sending candidates");
            axios.post('http://localhost:3000/?hypeer=entangle',
                { subdomain: this.subdomain, candidates: data }).then((res: any) => {
                    console.log('got candidates for ' + res.data.id);
                    if (!this.peers[res.data.id]) {
                        this.peers[res.data.id] = peer;
                    }
                    if (!this.subdomain) {
                        this.subdomain = res.subdomain;
                    }
                    setTimeout(() => {
                        peer.signal(res.data.candidates);
                    }, 0);
                }).catch((e: any) => {
                    console.log('error' + e);
                });
        });
    }
}
