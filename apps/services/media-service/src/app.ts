import express from "express";
import multer from "multer";
import { verifyToken } from "@xcloud/shared";
import { storeUpload, isLocalStorage, UPLOAD_DIR } from "./services/media.service";

const app = express();

app.use(express.json());

app.get("/health", (_req, res) => res.status(200).json({ status: "ok", service: "media-service" }));

// Dev only: serve uploaded files straight from local disk.
if (isLocalStorage) {
    app.use("/v1/media/files", express.static(UPLOAD_DIR));
}

const upload = multer({
    storage: multer.memoryStorage(),
    limits:  { fileSize: 5 * 1024 * 1024 }, // 5 MB
    fileFilter: (_req, file, cb) => {
        if (/^image\/(png|jpe?g|gif|webp)$/.test(file.mimetype)) cb(null, true);
        else cb(new Error("Only PNG/JPEG/GIF/WebP image uploads are allowed"));
    },
});

// POST /v1/media — multipart form, field name "file". Requires auth (Bearer JWT).
app.post("/v1/media", verifyToken, upload.single("file"), async (req, res) => {
    try {
        if (!req.file) {
            res.status(400).json({ message: "file is required (multipart field 'file')" });
            return;
        }
        const url = await storeUpload(req.file.buffer, req.file.mimetype);
        res.status(201).json({ url });
    } catch (err) {
        res.status(500).json({ message: (err as Error).message });
    }
});

// Multer rejections (bad type, file too large) surface here as errors before the
// handler runs — return a clean JSON 400 instead of leaking an HTML stack trace.
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(400).json({ message: err.message || "Upload error" });
});

export default app;
