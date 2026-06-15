import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// Hybrid storage (mirrors the Kafka/SQS split): local disk in dev, S3 in prod.
const isProd = process.env.NODE_ENV === "production";
export const isLocalStorage = !isProd;

// Local dev: files land here and are served by GET /v1/media/files/:name.
export const UPLOAD_DIR = path.resolve(__dirname, "../../uploads");
if (isLocalStorage && !fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const s3 = isProd ? new S3Client({ region: process.env.AWS_REGION }) : null;

const extFor = (mimetype: string): string => {
    switch (mimetype) {
        case "image/png":  return ".png";
        case "image/jpeg": return ".jpg";
        case "image/gif":  return ".gif";
        case "image/webp": return ".webp";
        default:           return "";
    }
};

/**
 * Persists an uploaded image and returns a URL the web app can render.
 *   - dev:  writes to UPLOAD_DIR, returns `/api/v1/media/files/<key>` (Vite proxy → media-service)
 *   - prod: puts to the S3 MEDIA_BUCKET, returns the CDN/S3 object URL
 */
export const storeUpload = async (buffer: Buffer, mimetype: string): Promise<string> => {
    const key = `${randomUUID()}${extFor(mimetype)}`;

    if (isProd) {
        const Bucket = process.env.MEDIA_BUCKET;
        if (!Bucket) throw new Error("MEDIA_BUCKET is not set");
        await s3!.send(new PutObjectCommand({ Bucket, Key: key, Body: buffer, ContentType: mimetype }));
        const base = process.env.MEDIA_PUBLIC_BASE_URL;
        return base
            ? `${base.replace(/\/$/, "")}/${key}`
            : `https://${Bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
    }

    fs.writeFileSync(path.join(UPLOAD_DIR, key), buffer);
    return `/api/v1/media/files/${key}`;
};
