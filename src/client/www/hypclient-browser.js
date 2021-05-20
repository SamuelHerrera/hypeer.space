
var HypClient = function () {
    const signalPeers = {};
    const http = axios.create();
    const spaceControl = `?hypeer=entangle`
    let clientHost;

    const initSignaling = (subdomain, localhost) => {
        clientHost = localhost;
        let sendCandidate = (data) => {
            axios.post(spaceControl,
                { subdomain: subdomain, candidates: data }).then((res) => {
                    if (res.data?.status == 'entangled') {
                        subdomain = res.data.subdomain;
                        signalPeers[subdomain].signal(res.data.candidates);
                    } else {
                        console.log(`Is not possible to stablish the connection.`);
                        signalPeers[subdomain]?.destroy();
                    }
                }).catch((e) => {
                    console.log('error' + e);
                });
        };
        stopSignaling(subdomain);
        signalPeers[subdomain] = new SimplePeer({ initiator: true, trickle: false })
            .on("signal", (data) => {
                sendCandidate(data);
            }).on('connect', () => {
                console.log(`entangled`);
                sendCandidate = (data) => {
                    signalPeers[subdomain].send(JSON.stringify({ action: 'signal', candidates: data }));
                }
            }).on('data', (d) => {
                const data = JSON.parse(d && d.length ? d.toString() : '{}');
                switch (data.action) {
                    case 'signal':
                        if (data.id) {
                            signalPeers[subdomain]['peerList'][data.id]?.signal(data.candidates);
                        } else {
                            signalPeers[subdomain].signal(data.candidates);
                        }
                        break;
                    case 'create':
                        entangle(data.id, subdomain);
                        console.log(`[${data.id}] Entangled`);
                        break;
                    default:
                        break;
                }
            }).on('error', err => {
                console.log('signaling connection error:', err.message);
                setTimeout(() => {
                    signalPeers[subdomain]?.destroy();
                    signalPeers[subdomain] = initSignaling(subdomain, localhost);
                }, 0);
            });

        signalPeers[subdomain]['peerList'] = {};
    }

    const stopSignaling = (subdomain) => {
        if (signalPeers[subdomain]) {
            signalPeers[subdomain].destroy();
            for (let p in signalPeers[subdomain]['peerList']) {
                signalPeers[subdomain]['peerList'][p].destroy();
            }
            signalPeers[subdomain].destroy();
        }
    }

    const entangle = (id, subdomain) => {
        const peer = new SimplePeer({ initiator: true, trickle: true });
        const connLocal = () => {
            console.log('reached connection local!');
        };
        peer.on('error', err => {
            console.log('got peer connection error', err.message);
            delete signalPeers[subdomain]['peerList'][id];
        }).on('data', data => {
            const strDat = data.toString();
            const match = strDat.match(/^(\w+) (\S+)/);
            if (match) {
                const matchHeaders = strDat.match(/([\w-]+): (.*)/g);
                const headers = {};
                for (let x in matchHeaders) {
                    console.log(matchHeaders[x]);
                    if (typeof matchHeaders[x] == "string") {
                        let y = matchHeaders[x].split(/(?<=^\S+)\s/);
                        if (y[0].toLowerCase() != 'host') {
                            headers[y[0]] = y[1];
                        }
                    }

                }
                console.log(match, matchHeaders);
                const method = match[1], path = match[2];
                console.log('proxying request to ' + clientHost, { method, path, headers });
                try {
                    http({ method: method.toLowerCase(), url: `${clientHost}${path}`, headers: headers }).
                        then((response) => {
                            let headersString = '';
                            for (let k in response.headers) {
                                headersString += `${k}: ${response.headers[k]}\r\n`;
                            }
                            const resp = `HTTP/1.0 ${response.status} ${response.statusText}\r\n${headersString}\r\n${response.data}\r\n\r\n`;
                            console.log(response, headersString);
                            peer.send(resp);
                        }).catch((err) => {
                            console.log(err);
                            peer.send(`HTTP/1.0 500 ${response.status} BAD REQUEST\r\n\r\n\r\n`);
                        });
                } catch (e) {
                    console.log(`Answering ${method} ${path} with error ${e}`);
                    peer.send(`HTTP/1.0 500 ${response.status} BAD REQUEST\r\n\r\n\r\n`);
                }
            }
        }).on('connect', () => {
            connLocal();
        }).on("signal", data => {
            signalPeers[subdomain].send(JSON.stringify({ action: 'signal', id: id, candidates: data }));
        });
        const peerAfterLife = () => {
            console.log(`[${id}] called afterlife to destroy peer`);
            delete signalPeers[subdomain]['peerList'][id];
        };
        peer.once('close', peerAfterLife);
        signalPeers[subdomain]['peerList'][id] = peer;
    }

    return { initSignaling, stopSignaling }
}();


