import { HypClient } from "../client/hypclient";
import * as dotenv from "dotenv";
import express from 'express';
import { HypMiddleware } from "../server/hypmiddleware";

dotenv.config();

const subdomain = 'test';
const spaceControlUrl = undefined // 'https://hypeer.space'
const port = process.env.PORT || 3000;
const clientPort = 5500;

const app = express();
app.use(express.json());
app.use(HypMiddleware.middleware);
app.all('*', (req, res, next) => {
    res.send('ok').end();
});

const server = app.listen(port, () => {
    console.log("Server started on port " + port);
    startClient();
});
server.on('upgrade', HypMiddleware.wsMiddleware);

const startClient = () => { const c: any = new HypClient({ client: { subdomain, spaceControlUrl }, localhost: { port: clientPort } }); };