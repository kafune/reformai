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
  /**
   * Endpoint público (opcional). Quando definido, as URLs assinadas são
   * geradas contra este host — necessário quando o MinIO roda numa rede
   * interna inacessível ao navegador do usuário. As operações de
   * leitura/escrita continuam usando o endpoint interno.
   */
  publicEndPoint?: string
  publicPort?: number
  publicUseSSL?: boolean
}

/**
 * MinIO-backed implementation of `StorageAdapter`.
 *
 * Auto-creates the bucket on first `upload` if it does not exist.
 * Signed URLs are generated against the public endpoint when configured.
 */
export class MinIOAdapter implements StorageAdapter {
  private readonly client: MinioClient
  private readonly signingClient: MinioClient
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
    this.signingClient = config.publicEndPoint
      ? new MinioClient({
          endPoint: config.publicEndPoint,
          port: config.publicPort ?? 443,
          useSSL: config.publicUseSSL ?? true,
          accessKey: config.accessKey,
          secretKey: config.secretKey,
          region: config.region ?? "us-east-1",
        })
      : this.client
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
    return this.signingClient.presignedGetObject(this.bucket, key, expiresInSeconds)
  }

  async delete(key: string): Promise<void> {
    await this.client.removeObject(this.bucket, key)
  }
}
