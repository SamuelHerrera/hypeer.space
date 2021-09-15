import { Transform } from 'stream';

export default class HeaderHostTransformer extends Transform {
    private host: string;

    private consumer: (cb: (err: any, data: any) => void, data: any) => void;

    constructor(opts: any = {}) {
        super(opts);
        this.host = opts.host || 'localhost';
        this.consumer = (cb, data) => {
            const _d = data.toString().replace(/(\r\n[Hh]ost: )\S+/, (match: any, $1: any) => {
                return $1 + this.host;
            });
            cb(null, _d);
        };
    }

    _transform(data: any, encoding: any, callback: any) {
        this.consumer(callback, data);
    }
}
