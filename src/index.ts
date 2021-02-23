import * as dotenv from "dotenv";
import express from 'express';
import { HypClient } from './client/hypclient'
import { HypMiddleware } from './server/hypmiddleware'

dotenv.config();
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(HypMiddleware.middleware);

const server = app.listen(port, () => {
    console.log("Server started on port " + port);

    const c = new HypClient();
});

server.on('upgrade', HypMiddleware.wsMiddleware);