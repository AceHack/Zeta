// Node fs adapter for aligned raw block read/write (flash-and-inject seam).
import { closeSync, fsyncSync, openSync, readSync, writeSync } from "node:fs";
export function openAlignedBlockDevice(path, mode) {
    const fd = openSync(path, mode);
    return {
        readRegion(offset, length) {
            const buf = Buffer.alloc(length);
            let pos = 0;
            while (pos < length) {
                const n = readSync(fd, buf, pos, length - pos, offset + pos);
                if (n <= 0)
                    break;
                pos += n;
            }
            return buf;
        },
        writeRegion(offset, data) {
            let pos = 0;
            while (pos < data.length) {
                const n = writeSync(fd, data, pos, data.length - pos, offset + pos);
                if (n <= 0)
                    break;
                pos += n;
            }
        },
        fsync() {
            fsyncSync(fd);
        },
        close() {
            closeSync(fd);
        },
    };
}
