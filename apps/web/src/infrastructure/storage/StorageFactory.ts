import { MinIOAdapter } from "./MinIOAdapter"
import { S3Adapter } from "./S3Adapter"
import type { StorageAdapter } from "./StorageAdapter"

/** Signed URLs always expire in 1 hour. Never expose permanent URLs. */
export const SIGNED_URL_TTL_SECONDS = 3600

const SUPPORTED_ADAPTERS = ["minio", "s3"] as const
type SupportedAdapter = (typeof SUPPORTED_ADAPTERS)[number]

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

/**
 * Parses a `host:port` string used by `MINIO_ENDPOINT`.
 *
 * Accepts:
 *  - "minio.local"        → { host: "minio.local", port: 9000 }
 *  - "minio.local:9000"   → { host: "minio.local", port: 9000 }
 *  - "https://host:9000"  → { host: "host", port: 9000, useSSL: true }
 */
function parseMinioEndpoint(raw: string): {
  host: string
  port: number
  useSSL: boolean
} {
  let useSSL = false
  let value = raw.trim()

  if (value.startsWith("https://")) {
    useSSL = true
    value = value.slice("https://".length)
  } else if (value.startsWith("http://")) {
    useSSL = false
    value = value.slice("http://".length)
  }

  // Drop trailing path if any
  const slashIdx = value.indexOf("/")
  if (slashIdx >= 0) value = value.slice(0, slashIdx)

  const [host, portStr] = value.split(":")
  if (!host) {
    throw new Error(`Invalid MINIO_ENDPOINT: "${raw}"`)
  }
  const port = portStr ? Number.parseInt(portStr, 10) : useSSL ? 443 : 9000
  if (Number.isNaN(port)) {
    throw new Error(`Invalid MINIO_ENDPOINT port: "${raw}"`)
  }
  return { host, port, useSSL }
}

function isSupportedAdapter(value: string): value is SupportedAdapter {
  return (SUPPORTED_ADAPTERS as readonly string[]).includes(value)
}

/**
 * Selects the concrete `StorageAdapter` implementation based on
 * `process.env.STORAGE_ADAPTER`.
 *
 * Supported values: `"minio" | "s3"`.
 */
export function createStorageAdapter(): StorageAdapter {
  const adapter = process.env.STORAGE_ADAPTER

  if (!adapter || !isSupportedAdapter(adapter)) {
    throw new Error(
      `Invalid or missing STORAGE_ADAPTER env. ` +
        `Accepted values: ${SUPPORTED_ADAPTERS.join(", ")}. Received: ${adapter ?? "(unset)"}`,
    )
  }

  if (adapter === "minio") {
    const { host, port, useSSL } = parseMinioEndpoint(requireEnv("MINIO_ENDPOINT"))
    return new MinIOAdapter({
      endPoint: host,
      port,
      useSSL,
      accessKey: requireEnv("MINIO_ACCESS_KEY"),
      secretKey: requireEnv("MINIO_SECRET_KEY"),
      bucket: requireEnv("MINIO_BUCKET"),
    })
  }

  return new S3Adapter({
    region: requireEnv("AWS_REGION"),
    accessKeyId: requireEnv("AWS_ACCESS_KEY_ID"),
    secretAccessKey: requireEnv("AWS_SECRET_ACCESS_KEY"),
    bucket: requireEnv("AWS_S3_BUCKET"),
  })
}
