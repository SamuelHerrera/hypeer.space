import Debug from "debug";
import * as dotenv from "dotenv";
import express from 'express';
import { HypMiddleware } from './server/hypmiddleware'
dotenv.config();

const debug = Debug("index");
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(HypMiddleware.middleware);
app.all('*', (req, res, next) => {
    if (process.env.DEFAULT_SITE) {
        res.redirect(301, process.env.DEFAULT_SITE);
    } else {
        res.json({ status: 'online' }).end();
    }
});

const server = app.listen(port, () => {
    debug(`Server started on port ${port}, default site: ${process.env.DEFAULT_SITE}`);
});

server.on('upgrade', HypMiddleware.wsMiddleware);