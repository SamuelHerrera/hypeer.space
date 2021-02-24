import { exit } from "process";
import { HypClient } from "../client/hypclient";

let c: any = new HypClient({
    client: {
        // spaceControlUrl: "https://shiburashid.tk"
    },
    localhost: { port: 5500 }
});
setTimeout(() => {
    exit(0);
}, 20000);