import { beforeEach, describe, expect, it, vi } from "vitest"

const bucketExistsMock = vi.fn()
const makeBucketMock = vi.fn()
const putObjectMock = vi.fn()
const presignedGetObjectMock = vi.fn()
const removeObjectMock = vi.fn()

vi.mock("minio", () => {
  return {
    Client: vi.fn().mockImplementation(() => ({
      bucketExists: bucketExistsMock,
      makeBucket: makeBucketMock,
      putObject: putObjectMock,
      presignedGetObject: presignedGetObjectMock,
      removeObject: removeObjectMock,
    })),
  }
})

import { MinIOAdapter } from "../MinIOAdapter"

const baseConfig = {
  endPoint: "localhost",
  port: 9000,
  useSSL: false,
  accessKey: "minio",
  secretKey: "minio12345",
  bucket: "reformai",
}

function makeAdapter(overrides: Partial<typeof baseConfig> = {}): MinIOAdapter {
  return new MinIOAdapter({ ...baseConfig, ...overrides })
}

describe("MinIOAdapter", () => {
  beforeEach(() => {
    bucketExistsMock.mockReset()
    makeBucketMock.mockReset()
    putObjectMock.mockReset()
    presignedGetObjectMock.mockReset()
    removeObjectMock.mockReset()
  })

  describe("upload", () => {
    it("creates the bucket when it does not exist", async () => {
      bucketExistsMock.mockResolvedValueOnce(false)
      makeBucketMock.mockResolvedValueOnce(undefined)
      putObjectMock.mockResolvedValueOnce({ etag: "abc", versionId: null })

      const adapter = makeAdapter()
      const buffer = Buffer.from("hello-world")

      await adapter.upload("tenants/t1/file.txt", buffer, "text/plain")

      expect(bucketExistsMock).toHaveBeenCalledTimes(1)
      expect(bucketExistsMock).toHaveBeenCalledWith("reformai")
      expect(makeBucketMock).toHaveBeenCalledTimes(1)
      expect(makeBucketMock).toHaveBeenCalledWith("reformai", "")
    })

    it("does not create the bucket when it already exists", async () => {
      bucketExistsMock.mockResolvedValueOnce(true)
      putObjectMock.mockResolvedValueOnce({ etag: "abc", versionId: null })

      const adapter = makeAdapter()
      await adapter.upload("k", Buffer.from("x"), "text/plain")

      expect(bucketExistsMock).toHaveBeenCalledTimes(1)
      expect(makeBucketMock).not.toHaveBeenCalled()
    })

    it("calls putObject with the correct key, buffer and mimeType", async () => {
      bucketExistsMock.mockResolvedValueOnce(true)
      putObjectMock.mockResolvedValueOnce({ etag: "abc", versionId: null })

      const adapter = makeAdapter()
      const buffer = Buffer.from("payload-content")
      const key = "tenants/t1/condominiums/c1/units/u1/cases/x/incoming/d1/file.pdf"

      await adapter.upload(key, buffer, "application/pdf")

      expect(putObjectMock).toHaveBeenCalledTimes(1)
      expect(putObjectMock).toHaveBeenCalledWith(
        "reformai",
        key,
        buffer,
        buffer.length,
        { "Content-Type": "application/pdf" },
      )
    })
  })

  describe("getSignedUrl", () => {
    it("delegates to presignedGetObject with the given TTL", async () => {
      presignedGetObjectMock.mockResolvedValueOnce("https://signed.example/url")

      const adapter = makeAdapter()
      const url = await adapter.getSignedUrl("some/key.pdf", 3600)

      expect(url).toBe("https://signed.example/url")
      expect(presignedGetObjectMock).toHaveBeenCalledTimes(1)
      expect(presignedGetObjectMock).toHaveBeenCalledWith(
        "reformai",
        "some/key.pdf",
        3600,
      )
    })
  })

  describe("delete", () => {
    it("calls removeObject with the bucket and key", async () => {
      removeObjectMock.mockResolvedValueOnce(undefined)

      const adapter = makeAdapter()
      await adapter.delete("path/to/object.bin")

      expect(removeObjectMock).toHaveBeenCalledTimes(1)
      expect(removeObjectMock).toHaveBeenCalledWith(
        "reformai",
        "path/to/object.bin",
      )
    })
  })
})
