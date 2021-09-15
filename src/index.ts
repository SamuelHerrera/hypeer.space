import Debug from "debug";
import * as dotenv from "dotenv";
import express from 'express';
import { HypMiddleware } from './server/hypmiddleware';
import cors from 'cors';
import * as path from 'path';

dotenv.config();

const debug = Debug("index");
const app = express();
const port = process.env.PORT || 8805;

app.use(cors());
app.use(HypMiddleware.middleware);
app.use(express.static(path.join(__dirname, '../static')));
app.all('*', (req, res, next) => {
    res.sendFile(path.join(__dirname, '../static/index.html'));
});

const server = app.listen(port, () => {
    debug(`Server started on port ${port}`);
});

server.on('upgrade', HypMiddleware.wsMiddleware);