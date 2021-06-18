import { HypClient } from "../client/command/hypclient";
import * as dotenv from "dotenv";
import express from 'express';
import { HypMiddleware } from "../server/hypmiddleware";

dotenv.config();

const subdomain = 'a';
const spaceControlUrl = undefined; //'https://hypeer.space'//undefined
const port = process.env.PORT || 4500;
const clientPort = 3000;

const app = express();
app.use(HypMiddleware.middleware);
app.all('*', (req, res, next) => {
    res.send('ok').end();
});

const startClient = () => { const c: any = new HypClient({ client: { subdomain, spaceControlUrl }, localhost: { port: clientPort } }); };

const server = app.listen(port, () => {
    console.log("Server started on port " + port);
    startClient();
});
server.on('upgrade', HypMiddleware.wsMiddleware);

