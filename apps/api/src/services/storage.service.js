import crypto from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

class LocalStorage {
  async put(file) {
    const extension = path.extname(file.originalname).toLowerCase().slice(0, 8);
    const key = `${crypto.randomUUID()}${extension}`;
    const directory = path.resolve("uploads");
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, key), file.buffer);
    return `/uploads/${key}`;
  }
}

class S3Storage {
  constructor() {
    this.bucket = process.env.S3_BUCKET;
    this.publicUrl = process.env.S3_PUBLIC_URL;
    if (!this.bucket || !this.publicUrl) {
      throw new Error("S3_BUCKET and S3_PUBLIC_URL are required for S3 storage");
    }
    this.client = new S3Client({
      region: process.env.S3_REGION,
      endpoint: process.env.S3_ENDPOINT || undefined,
      forcePathStyle: Boolean(process.env.S3_ENDPOINT),
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY
      }
    });
  }
  async put(file) {
    const key = `uploads/${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`;
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype
      })
    );
    return `${this.publicUrl.replace(/\/$/, "")}/${key}`;
  }
}

export const storage = process.env.STORAGE_PROVIDER === "s3" ? new S3Storage() : new LocalStorage();
