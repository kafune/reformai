import { Client as MinioClient } from "minio"

import type { StorageAdapter } from "./StorageAdapter"

export interface MinIOAdapterConfig {
  endPoint: string
  port: number
  useSSL: boolean
  accessKey: string
  secretKey: string
  bucket: string
  region?: string
}

/**
 * MinIO-backed implementation of `StorageAdapter`.
 *
 * Used in local/dev environments. Auto-creates the bucket on first `upload`
 * if it does not already exist — convenient for ephemeral dev containers.
 */
export class MinIOAdapter implements StorageAdapter {
  private readonly client: MinioClient
  private readonly bucket: string
  private readonly region: string | undefined

  constructor(config: MinIOAdapterConfig) {
    this.bucket = config.bucket
    this.region = config.region
    this.client = new MinioClient({
      endPoint: config.endPoint,
      port: config.port,
      useSSL: config.useSSL,
      accessKey: config.accessKey,
      secretKey: config.secretKey,
    })
  }

  async upload(key: string, buffer: Buffer, mimeType: string): Promise<void> {
    const exists = await this.client.bucketExists(this.bucket)
    if (!exists) {
      await this.client.makeBucket(this.bucket, this.region ?? "")
    }
    await this.client.putObject(this.bucket, key, buffer, buffer.length, {
      "Content-Type": mimeType,
    })
  }

  async getSignedUrl(key: string, expiresInSeconds: number): Promise<string> {
    return this.client.presignedGetObject(this.bucket, key, expiresInSeconds)
  }

  async delete(key: string): Promise<void> {
    await this.client.removeObject(this.bucket, key)
  }
}
