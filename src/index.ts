import * as dotenv from "dotenv";
import express from 'express';
import { Client } from './hypeer-localtunnel-client/client'
import { HypMiddleware } from './hypeer-localtunnel-server/hypmiddleware'

dotenv.config();
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(HypMiddleware.middleware);

const server = app.listen(port, () => {
    console.log("Server started on port " + port);

    const c = new Client();
});

server.on('upgrade', HypMiddleware.wsMiddleware);