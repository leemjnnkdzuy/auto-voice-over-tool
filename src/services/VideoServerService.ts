import * as http from "http";
import * as url from "url";
import fs from "fs";

const activeStreams = new Set<{ filePath: string; stream: fs.ReadStream }>();

/**
 * Close all active streams whose file path starts with the given prefix.
 * This must be called before deleting a project folder to release file locks on Windows.
 */
export const closeStreamsForPath = (pathPrefix: string): void => {
    const normalizedPrefix = pathPrefix.replace(/\\/g, '/').toLowerCase();
    for (const entry of activeStreams) {
        const normalizedPath = entry.filePath.replace(/\\/g, '/').toLowerCase();
        if (normalizedPath.startsWith(normalizedPrefix)) {
            try {
                entry.stream.destroy();
            } catch (error) {
                // Ignore destroy errors because the stream may already be closed.
                void error;
            }
            activeStreams.delete(entry);
        }
    }
};

export const startVideoServer = () => {
    return new Promise<void>((resolve) => {
        const server = http.createServer((req, res) => {
            if (!req.url) {
                res.writeHead(404);
                res.end();
                return;
            }

            const parsedUrl = url.parse(req.url, true);
            if (parsedUrl.pathname === "/video") {
                const filePath = parsedUrl.query.path as string;

                if (!filePath) {
                    res.writeHead(400);
                    res.end("Missing path parameter");
                    return;
                }

                if (!fs.existsSync(filePath)) {
                    console.error(`Video file not found: ${filePath}`);
                    res.writeHead(404);
                    res.end("File not found");
                    return;
                }

                try {
                    const stat = fs.statSync(filePath);
                    const fileSize = stat.size;
                    const rangeHeader = req.headers.range;

                    let readStream: fs.ReadStream;

                    if (rangeHeader) {
                        const parts = rangeHeader
                            .replace(/bytes=/, "")
                            .split("-");
                        const start = parseInt(parts[0], 10);
                        const end =
                            parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

                        if (
                            start >= fileSize ||
                            end >= fileSize ||
                            start > end
                        ) {
                            res.writeHead(416, {
                                "Content-Range": `bytes */${fileSize}`,
                            });
                            res.end();
                            return;
                        }

                        const chunksize = end - start + 1;
                        res.writeHead(206, {
                            "Content-Range": `bytes ${start}-${end}/${fileSize}`,
                            "Accept-Ranges": "bytes",
                            "Content-Length": chunksize,
                            "Content-Type": "video/mp4",
                            "Access-Control-Allow-Origin": "*",
                        });

                        readStream = fs.createReadStream(filePath, { start, end });
                    } else {
                        res.writeHead(200, {
                            "Content-Length": fileSize,
                            "Accept-Ranges": "bytes",
                            "Content-Type": "video/mp4",
                            "Access-Control-Allow-Origin": "*",
                        });
                        readStream = fs.createReadStream(filePath);
                    }

                    const entry = { filePath, stream: readStream };
                    activeStreams.add(entry);

                    const cleanup = () => {
                        activeStreams.delete(entry);
                        if (!readStream.destroyed) {
                            readStream.destroy();
                        }
                    };

                    readStream.on('end', cleanup);
                    readStream.on('error', cleanup);
                    readStream.on('close', cleanup);
                    res.on('close', cleanup);

                    readStream.pipe(res);
                } catch (err) {
                    console.error("Error streaming video:", err);
                    res.writeHead(500);
                    res.end("Server error");
                }
            } else {
                res.writeHead(404);
                res.end();
            }
        });

        server.listen(9999, "127.0.0.1", () => {
            console.log("Video server started on http://127.0.0.1:9999");
            resolve();
        });
    });
};
