import * as dotenv from "dotenv";
import express from 'express';
import { HypMiddleware } from './server/hypmiddleware'

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
});

server.on('upgrade', HypMiddleware.wsMiddleware);