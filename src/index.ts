import * as dotenv from "dotenv";
import { Client } from './hypeer-localtunnel-client/client'
import { ServerFactory } from './hypeer-localtunnel-server/server-factory'

dotenv.config();

const port: number = parseInt(process.env.PORT || '3000') || 3000;

const f = ServerFactory.app;

f.listen(port, () => {
    console.log("Server started on port " + port);

    const c = new Client();
    c.entangle();
});
