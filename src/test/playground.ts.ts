import { HypClient } from "../client/hypclient";
import * as dotenv from "dotenv";
import express from 'express';
import { HypMiddleware } from "../server/hypmiddleware";

dotenv.config();
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(HypMiddleware.middleware);
app.all('*', (req, res, next) => {
    res.send('ok').end();
});

const server = app.listen(port, () => {
    console.log("Server started on port " + port);
    let c: any = new HypClient({
        client: {
           subdomain: 'test',
        },
        localhost: { port: 5500 }
    });
    // setTimeout(() => {
    //     c.destroy();
    // }, 15000);
});

server.on('upgrade', HypMiddleware.wsMiddleware);

// -------------------------------------------------------------------------------------------

// import { HypClient } from "../client/hypclient";
// let c: any = new HypClient({
//     client: {
//         subdomain: 'dapper-alert-alley',
//         spaceControlUrl: "https://dapper-alert-alley.glitch.me"
//     },
//     localhost: { port: 5500 }
// });

// let c: any = new HypClient({
//     client: {
//         subdomain: 'test',
//         spaceControlUrl: "http://localhost:3000"
//     },
//     localhost: { port: 5500 }
// });


// -------------------------------------------------------------------------------------------