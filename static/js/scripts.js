(function () {
    const btnCont = document.getElementById('menu');
    const btnBuilder = (btnD) => {
        return () => {
            window.open(btnD.link, btnD.label,
                `resizable=yes, toolbar=no, menubar=no, status=no, 
            directories=no, width=${btnD.w | 600}, height=${btnD.h | 600}, 
            left=${btnD.x | 20}, top=${btnD.y | 20}`);

        }
    };

    const buttons = [
        {
            label: 'Contratar servicios',
            link: 'https://hypeer.space',
            handler: (d) => {
                return () => {

                }
            }
        },
        {
            label: 'Code server',
            link: 'https://codeserver.hypeer.space',
            handler: btnBuilder
        },
        {
            label: 'SSH',
            link: 'https://ssh.hypeer.space',
            handler: btnBuilder
        },
        {
            label: 'VNC',
            link: 'https://vnc.hypeer.space',
            handler: btnBuilder
        },
        {
            label: 'File server',
            link: 'https://files.hypeer.space',
            handler: btnBuilder
        },
        {
            label: 'Ipfs node',
            link: 'https://ipfs.hypeer.space',
            handler: btnBuilder
        },
        {
            label: 'Ipfs gateway',
            link: 'https://gateway.hypeer.space',
            handler: (btnD) => {
                return () => {
                    const ans = prompt("CID");
                    if (ans != null) {
                        window.open(`${btnD.link}/ipfs/${ans}`, btnD.label,
                            `resizable=yes, toolbar=no, menubar=no, status=no, 
                        directories=no, width=${btnD.w | 600}, height=${btnD.h | 600}, 
                        left=${btnD.x | 20}, top=${btnD.y | 20}`);
                    }

                }
            }
        },
        {
            label: 'Cloudflare teams',
            link: 'https://dash.teams.cloudflare.com',
            handler: btnBuilder
        },
    ]
    for (let btnD of buttons) {
        let span = document.createElement("span");
        span.appendChild(document.createTextNode(btnD.label));
        let btn = document.createElement("button");
        btn.appendChild(span);
        btn.onclick = btnD.handler(btnD);
        btnCont.appendChild(btn);
    }
})();