import { Transform } from 'stream';

export default class HeaderHostTransformer extends Transform {
    private host: string;
    private replaced: boolean;
    constructor(opts: any = {}) {
        super(opts);
        this.host = opts.host || 'localhost';
        this.replaced = false;
    }

    _transform(data: any, encoding: any, callback: any) {
        callback(
            null,
            this.replaced // after replacing the first instance of the Host header we just become a regular passthrough
                ? data
                : data.toString().replace(/(\r\n[Hh]ost: )\S+/, (match: any, $1: any) => {
                    this.replaced = true;
                    return $1 + this.host;
                })
        );
    }
}
