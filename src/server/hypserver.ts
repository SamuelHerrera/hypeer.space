import Debug from "debug";
import { Server, ServerOpts, Socket } from "net";
import Peer, { SignalData } from 'simple-peer';
import { Duplex } from "stream";
import { v4 as uuidv4 } from 'uuid';
const wrtc = require("wrtc");
const debug = Debug("HypServer");

export class HypServer extends Server {
  private _signaling: Peer.Instance;
  private _online = false;
  private _connectedPeers: { [key: string]: Peer.Instance } = {};
  private _availablePeers: string[] = [];
  private _peerState: { [key: string]: boolean } = {};

  constructor(options?: ServerOpts, connectionListener?: (socket: Socket) => void) {
    super(options, connectionListener);
    this._signaling = this.initSignaling();
  }

  private initSignaling() {
    debug(`initSignaling`);
    return new Peer({ wrtc: wrtc, trickle: false })
      .on("signal", (data: string | SignalData) => {
        debug(`Got signal, online ${this._online}`);
        if (this._online) {
          this.signal({ candidates: data })
        } else {
          this.emit('signal', data);
        }
      }).on('data', (d: Buffer) => {
        const data = JSON.parse(d && d.length ? d.toString() : '{}');
        switch (data.action) {
          case 'signal':
            this.signal(data);
            break;
          default:
            break;
        }
      }).on("connect", () => {
        debug(`Connected, server online`);
        this._online = true;
        this.emit("online");
      }).once("close", () => {
        debug(`Closed, server offline`);
        this._online = false;
        this.emit("offline");
      }).once("error", (err: any) => {
        debug(`Signaling got error, server offline. [${err}]`);
        this._online = false;
        this.emit("offline");
      });
  }

  public close(cb?: ((err?: Error | undefined) => void) | undefined) {
    debug(`Called close(), about to destroy peers`);
    let error = undefined;
    try {
      for (let p in this._connectedPeers) {
        this._connectedPeers[p].destroy();
      }
      this._signaling.destroy();
    } catch (e) {
      error = e;
    }
    debug(`Peers cleared, error [${error}]`);
    if (cb) cb(error);
    return this;
  }

  public signal(data: { id?: string, candidates: string | SignalData }) {
    if (data.id) {
      this._connectedPeers[data.id].signal(data.candidates);
    } else {
      this._signaling.signal(data.candidates);
    }
  }

  public createConnection(cb?: any): HypeerSocket {
    debug(`Starting connection`);
    let nid: string = '';
    let _nid: string | undefined = this._availablePeers.shift();
    let peer: Peer.Instance | undefined = undefined;
    while (_nid) {
      nid = _nid;
      peer = this._connectedPeers[nid];
      if (peer && peer.readable && peer.writable) break;
      _nid = this._availablePeers.shift();
    }
    if (!peer) {
      _nid = undefined;
      nid = uuidv4();
      peer = this.buildPeer(nid);
      debug(`[${nid}] Signaling send, returning peer`);
    }

    const sock: HypeerSocket = new HypeerSocket(nid, peer);
    if (_nid) {
      if (cb)
        cb(null, sock);
    } else {
      peer.on("connect", () => {
        debug(`[${nid}] connected, callbaking.`);
        if (cb)
          cb(null, sock);
      });
    }

    sock.on("end", () => {
      this._availablePeers.push(nid);
    });
    return sock;
  }

  private buildPeer(nid: string): Peer.Instance {
    const peer = new Peer({ wrtc: wrtc, trickle: true });
    peer.once("close", () => {
      debug(`[${nid}] peer closed`);
      delete this._connectedPeers[nid];
      delete this._peerState[nid];
    });
    peer.once("error", (err: any) => {
      debug(`[${nid}] peer got error: [${err}]`);
      delete this._connectedPeers[nid];
      delete this._peerState[nid];
    });
    peer.on("signal", (data: string | SignalData) => {
      this._signaling.send(JSON.stringify({ action: 'signal', id: nid, candidates: data }));
    });
    this._signaling.send(JSON.stringify({ action: 'create', id: nid }));
    this._connectedPeers[nid] = peer;
    return peer
  }

  get online() {
    return this._online;
  }

  get connectedPeers() {
    return Object.keys(this._connectedPeers).length;
  }

}

class HypeerSocket extends Duplex {

  private id: string = '';
  private peer: Peer.Instance | undefined;
  private readingPaused = false;
  private timeout: any;

  constructor(id: string, peer: Peer.Instance) {
    super({}); // options?: SocketConstructorOpts
    this.id = id;
    this._wrapSocket(peer);
  }

  _wrapSocket(peer: Peer.Instance) {
    const close = (hadError: any) => {debug('close: '); this.emit('close', hadError); }
    const connect = () => {debug('connect: '); this.emit('connect'); }
    const drain = () => {debug('drain: '); this.emit('drain'); }
    const end = () => {debug('end: '); this.emit('end'); }
    const error = (err: any) => {debug('close: '); this.emit('error', err); }
    const lookup = (err: any, address: any, family: any, host: any) => {debug('lookup: '); this.emit('lookup', err, address, family, host); }
    const ready = () => {debug('ready: '); this.emit('ready'); }
    const timeout = () => {debug('timeout: '); this.emit('timeout'); }
    // these are simply passed through
    peer.on('close', close);
    peer.on('connect', connect);
    peer.on('drain', drain);
    peer.on('end', end);
    peer.on('error', error);
    peer.on('lookup', lookup); // prettier-ignore
    peer.on('ready', ready);
    peer.on('timeout', timeout);
    // we customize data events!
    peer.on('data', (data) => {
      debug('_pushing');
      this.push(data);
    });

    this.peer = peer;
  }


  _read(x: any) {
    if (this.peer?.readable) {
      const y = this.peer?.read(x);
      debug('_read: ', x);
      if (y)
        this.push(y)
    }
  }

  _write(obj: any, encoding: any, cb: any) {
    debug('_write: ');
    this.peer?.write(obj, encoding, cb);
  }

  public setKeepAlive(enable = false, initialDelay = 0) {
    clearTimeout(this.timeout);
    if (enable) {
      this.timeout = setTimeout(() => {
        this.destroy();
      }, initialDelay);
    } else {
      this.timeout = setTimeout(() => {
        this.destroy();
      }, 10000);
    }
    return this;
  };

  public setTimeout(timeout: number, callback?: Function) {
    clearTimeout(this.timeout);
    if (timeout) {
      debug('soc set timeout: ' + timeout);
      this.timeout = setTimeout(() => {
        this.destroy();
        if (callback) callback();
      }, timeout);
    }
    return this;
  };

  public unref() {
    debug(`[${this.id}] sock unref`);
    return this;
  };

  public ref() {
    debug(`[${this.id}] sock ref`);
    return this;
  };

  public destroy() {
    this.peer?.destroy();
  }

}
