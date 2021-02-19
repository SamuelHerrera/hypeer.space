import * as dotenv from "dotenv";
import net from 'net';
import Peer from "simple-peer";
import wrtc from "wrtc";
import HeaderHostTransformer from './header-host-transformer';
import { Duplex } from "stream";
import axios from 'axios';

dotenv.config();

const port: number = parseInt(process.env.PORT) || 5500;
const host: string = process.env.HOST || 'localhost';
const peer: Peer.Instance = new Peer({ initiator: true, wrtc: wrtc, trickle: false });

peer.on('error', err => {
    console.log('got peer connection error', err.message);
});

const connLocal = () => {
    console.log('Initiating conn local');
    peer.pause();
    const local: Duplex = net.connect({ host: host, port: port });
    const remoteClose = () => {
        console.log('remote close');
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
        let stream = peer.pipe(new HeaderHostTransformer({ host: host }), { end: false });
        stream.pipe(local, { end: false }).pipe(peer, { end: false });

        local.once('close', hadError => {
            console.log('local connection closed [%s]', hadError);
            peer.unpipe(stream);
            peer.removeListener('close', remoteClose);
            setTimeout(connLocal, 0);
        });
    });
};

peer.on('data', data => {
    const match = data.toString().match(/^(\w+) (\S+)/);
    if (match) {
        console.log('request', {
            method: match[1],
            path: match[2],
        });
    }
});

peer.on('connect', () => {
    console.log('open');
    connLocal();
});

peer.on("signal", data => {
    console.log("sending candidates");
    axios.post('https://numerous-sustaining-krypton.glitch.me/entangle', data).then((res: any) => {
        console.log('got candidates');
        setTimeout(() => {
            peer.signal(res.data);
        }, 0);
    }).catch((e: any) => {
        console.log(e);
    });
});