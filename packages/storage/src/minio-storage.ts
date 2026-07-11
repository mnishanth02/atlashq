import type { Readable } from "node:stream";
import { URL } from "node:url";
import type { BucketItemStat, ClientOptions, ItemBucketMetadata, RemoveOptions } from "minio";
import { Client } from "minio";
import {
  assertSafeObjectKey,
  assertSignedUrlAuthorization,
  type ContentDispositionType,
  createSafeContentDisposition,
  isProvisionalUploadSessionObjectKey,
  type StorageAuthorizationProof,
} from "./object-keys.js";
import { StorageError } from "./storage-error.js";

const DEFAULT_UPLOAD_URL_MAX_EXPIRY_SECONDS = 15 * 60;
const DEFAULT_DOWNLOAD_URL_DEFAULT_EXPIRY_SECONDS = 10 * 60;
const DEFAULT_DOWNLOAD_URL_MAX_EXPIRY_SECONDS = 60 * 60;

type MinioClientLike = {
  bucketExists(bucketName: string): Promise<boolean>;
  makeBucket(bucketName: string, region?: string): Promise<void>;
  setBucketVersioning(
    bucketName: string,
    versionConfig: { Status: "Enabled" | "Suspended" },
  ): Promise<void>;
  getBucketVersioning(bucketName: string): Promise<{ Status: "Enabled" | "Suspended" }>;
  presignedPutObject(bucketName: string, objectName: string, expires?: number): Promise<string>;
  presignedGetObject(
    bucketName: string,
    objectName: string,
    expires?: number,
    respHeaders?: Record<string, string>,
  ): Promise<string>;
  presignedUrl(
    httpMethod: "GET",
    bucketName: string,
    objectName: string,
    expires?: number,
    reqParams?: Record<string, string>,
  ): Promise<string>;
  statObject(
    bucketName: string,
    objectName: string,
    statOpts?: { versionId?: string },
  ): Promise<BucketItemStat>;
  getObject(
    bucketName: string,
    objectName: string,
    getOpts?: { versionId?: string },
  ): Promise<Readable>;
  putObject(
    bucketName: string,
    objectName: string,
    data: Readable | Buffer | string,
    size?: number,
    metaData?: ItemBucketMetadata,
  ): Promise<{ etag: string; versionId: string | null }>;
  removeObject(bucketName: string, objectName: string, removeOpts?: RemoveOptions): Promise<void>;
};

export type MinioStorageClientOptions = {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  region?: string;
  pathStyle?: boolean;
  uploadUrlMaxExpirySeconds?: number;
  downloadUrlDefaultExpirySeconds?: number;
  downloadUrlMaxExpirySeconds?: number;
};

export type MinioStorageClientDependencies = {
  createClient?: (options: ClientOptions) => MinioClientLike;
  now?: () => Date;
};

export type SignedUploadUrlRequest = {
  objectKey: string;
  authorization: StorageAuthorizationProof;
  expiresInSeconds?: number;
  contentType?: string;
};

export type SignedDownloadUrlRequest = {
  objectKey: string;
  authorization: StorageAuthorizationProof;
  expiresInSeconds?: number;
  versionId?: string;
  fileName?: string;
  dispositionType?: ContentDispositionType;
};

export type SignedUrlContract = {
  provider: "minio-s3-compatible";
  endpoint: string;
  bucket: string;
  objectKey: string;
  operation: "read" | "write";
  signedUrl: string;
  expiresAt: string;
  expiresInSeconds: number;
  publicBucket: false;
  requiredHeaders: Readonly<Record<string, string>>;
};

export type StoredObjectMetadata = {
  endpoint: string;
  bucket: string;
  objectKey: string;
  versionId: string | null;
  etag: string;
  sizeBytes: number;
  lastModified: Date;
  contentType: string | null;
  metadata: Readonly<Record<string, string>>;
};

export type ObjectLocator = {
  objectKey: string;
  versionId?: string;
};

export type PutStoredObjectRequest = {
  objectKey: string;
  data: Readable | Buffer | string;
  sizeBytes?: number;
  contentType?: string;
  metadata?: Readonly<Record<string, string>>;
};

export type StoredObjectWriteResult = {
  endpoint: string;
  bucket: string;
  objectKey: string;
  versionId: string | null;
  etag: string;
};

export type BucketBootstrapResult = {
  endpoint: string;
  bucket: string;
  bucketCreated: boolean;
  versioningStatus: "Enabled";
};

export type BucketReadinessResult = {
  endpoint: string;
  bucket: string;
  bucketExists: boolean;
  versioningStatus: "Enabled" | "Suspended" | "Missing";
};

export interface MinioObjectStorageClient {
  readonly endpoint: string;
  readonly bucket: string;
  createSignedUploadUrl(request: SignedUploadUrlRequest): Promise<SignedUrlContract>;
  createSignedDownloadUrl(request: SignedDownloadUrlRequest): Promise<SignedUrlContract>;
  statObject(locator: ObjectLocator): Promise<StoredObjectMetadata>;
  getObjectStream(locator: ObjectLocator): Promise<Readable>;
  putObject(request: PutStoredObjectRequest): Promise<StoredObjectWriteResult>;
  bootstrapBucket(): Promise<BucketBootstrapResult>;
  getBucketReadiness(): Promise<BucketReadinessResult>;
  rollbackObjectWrite(writeResult: StoredObjectWriteResult): Promise<void>;
  deleteProvisionalObject(locator: ObjectLocator): Promise<void>;
}

export function createMinioStorageClient(
  options: MinioStorageClientOptions,
  dependencies: MinioStorageClientDependencies = {},
): MinioObjectStorageClient {
  const endpoint = parseStorageEndpoint(options.endpoint);
  const now = dependencies.now ?? (() => new Date());
  const createClient = dependencies.createClient ?? ((clientOptions) => new Client(clientOptions));
  const clientOptions: ClientOptions = {
    endPoint: endpoint.host,
    useSSL: endpoint.useSSL,
    accessKey: options.accessKeyId,
    secretKey: options.secretAccessKey,
    pathStyle: options.pathStyle ?? true,
  };

  if (endpoint.port !== undefined) {
    clientOptions.port = endpoint.port;
  }

  if (options.region !== undefined) {
    clientOptions.region = options.region;
  }

  const client = createClient(clientOptions);
  const endpointUrl = endpoint.url.toString();
  const uploadMaxExpirySeconds =
    options.uploadUrlMaxExpirySeconds ?? DEFAULT_UPLOAD_URL_MAX_EXPIRY_SECONDS;
  const downloadDefaultExpirySeconds =
    options.downloadUrlDefaultExpirySeconds ?? DEFAULT_DOWNLOAD_URL_DEFAULT_EXPIRY_SECONDS;
  const downloadMaxExpirySeconds =
    options.downloadUrlMaxExpirySeconds ?? DEFAULT_DOWNLOAD_URL_MAX_EXPIRY_SECONDS;
  const issuedWriteResults = new WeakSet<StoredObjectWriteResult>();
  const deleteObjectVersion = async (locator: ObjectLocator) => {
    await client.removeObject(options.bucket, locator.objectKey, {
      ...(locator.versionId ? { versionId: locator.versionId } : {}),
    });
  };
  const assertRollbackWriteResult = (writeResult: StoredObjectWriteResult) => {
    if (writeResult.endpoint !== endpointUrl || writeResult.bucket !== options.bucket) {
      throw new StorageError(
        "INVALID_WRITE_RESULT",
        "Rollback write result does not belong to this storage client.",
        {
          endpointMatches: writeResult.endpoint === endpointUrl,
          bucketMatches: writeResult.bucket === options.bucket,
        },
      );
    }

    if (!issuedWriteResults.has(writeResult)) {
      throw new StorageError(
        "INVALID_WRITE_RESULT",
        "Rollback requires the exact write result returned by this storage client.",
      );
    }
  };

  return {
    endpoint: endpointUrl,
    bucket: options.bucket,
    async createSignedUploadUrl(request) {
      assertSignedUrlAuthorization(request.authorization);
      assertSafeObjectKey(request.objectKey);

      const expiresInSeconds = request.expiresInSeconds ?? uploadMaxExpirySeconds;
      if (expiresInSeconds <= 0 || expiresInSeconds > uploadMaxExpirySeconds) {
        throw new StorageError(
          "INVALID_UPLOAD_EXPIRY",
          `Signed upload URL expiry must be between 1 and ${uploadMaxExpirySeconds} seconds.`,
          { maxExpirySeconds: uploadMaxExpirySeconds },
        );
      }

      try {
        const signedUrl = await client.presignedPutObject(
          options.bucket,
          request.objectKey,
          expiresInSeconds,
        );
        return createSignedUrlContract({
          endpoint: endpointUrl,
          bucket: options.bucket,
          objectKey: request.objectKey,
          operation: "write",
          signedUrl,
          expiresInSeconds,
          now: now(),
          requiredHeaders: request.contentType ? { "Content-Type": request.contentType } : {},
        });
      } catch (error) {
        throw mapMinioError(
          "sign upload URL",
          endpointUrl,
          options.bucket,
          request.objectKey,
          error,
        );
      }
    },
    async createSignedDownloadUrl(request) {
      assertSignedUrlAuthorization(request.authorization);
      assertSafeObjectKey(request.objectKey);

      const expiresInSeconds = request.expiresInSeconds ?? downloadDefaultExpirySeconds;
      if (expiresInSeconds <= 0 || expiresInSeconds > downloadMaxExpirySeconds) {
        throw new StorageError(
          "INVALID_DOWNLOAD_EXPIRY",
          `Signed download URL expiry must be between 1 and ${downloadMaxExpirySeconds} seconds.`,
          { maxExpirySeconds: downloadMaxExpirySeconds },
        );
      }

      const responseHeaders: Record<string, string> = {};

      if (request.fileName) {
        responseHeaders["response-content-disposition"] = createSafeContentDisposition(
          request.fileName,
          request.dispositionType,
        );
      }

      try {
        const signedUrl = request.versionId
          ? await client.presignedUrl("GET", options.bucket, request.objectKey, expiresInSeconds, {
              ...responseHeaders,
              versionId: request.versionId,
            })
          : await client.presignedGetObject(
              options.bucket,
              request.objectKey,
              expiresInSeconds,
              Object.keys(responseHeaders).length > 0 ? responseHeaders : undefined,
            );
        return createSignedUrlContract({
          endpoint: endpointUrl,
          bucket: options.bucket,
          objectKey: request.objectKey,
          operation: "read",
          signedUrl,
          expiresInSeconds,
          now: now(),
          requiredHeaders: {},
        });
      } catch (error) {
        throw mapMinioError(
          "sign download URL",
          endpointUrl,
          options.bucket,
          request.objectKey,
          error,
        );
      }
    },
    async statObject(locator) {
      assertSafeObjectKey(locator.objectKey);

      try {
        const stat = await client.statObject(options.bucket, locator.objectKey, {
          ...(locator.versionId ? { versionId: locator.versionId } : {}),
        });
        return toStoredObjectMetadata(endpointUrl, options.bucket, locator.objectKey, stat);
      } catch (error) {
        throw mapMinioError("stat object", endpointUrl, options.bucket, locator.objectKey, error);
      }
    },
    async getObjectStream(locator) {
      assertSafeObjectKey(locator.objectKey);

      try {
        return await client.getObject(options.bucket, locator.objectKey, {
          ...(locator.versionId ? { versionId: locator.versionId } : {}),
        });
      } catch (error) {
        throw mapMinioError("stream object", endpointUrl, options.bucket, locator.objectKey, error);
      }
    },
    async putObject(request) {
      assertSafeObjectKey(request.objectKey);

      const metadata = { ...(request.metadata ?? {}) };
      if (request.contentType) {
        metadata["Content-Type"] = request.contentType;
      }

      try {
        const result: StoredObjectWriteResult = {
          endpoint: endpointUrl,
          bucket: options.bucket,
          objectKey: request.objectKey,
          ...(await client.putObject(
            options.bucket,
            request.objectKey,
            request.data,
            request.sizeBytes,
            metadata,
          )),
        };
        issuedWriteResults.add(result);
        return result;
      } catch (error) {
        throw mapMinioError("upload object", endpointUrl, options.bucket, request.objectKey, error);
      }
    },
    async bootstrapBucket() {
      try {
        const bucketExists = await client.bucketExists(options.bucket);
        if (!bucketExists) {
          await client.makeBucket(options.bucket, options.region);
        }

        await client.setBucketVersioning(options.bucket, { Status: "Enabled" });
        const versioning = await client.getBucketVersioning(options.bucket);

        if (versioning.Status !== "Enabled") {
          throw new StorageError(
            "BUCKET_VERSIONING_REQUIRED",
            `Bucket versioning must be enabled for ${options.bucket}.`,
            { bucket: options.bucket, versioningStatus: versioning.Status },
          );
        }

        return {
          endpoint: endpointUrl,
          bucket: options.bucket,
          bucketCreated: !bucketExists,
          versioningStatus: "Enabled",
        };
      } catch (error) {
        if (error instanceof StorageError) {
          throw error;
        }

        throw new StorageError(
          "BUCKET_BOOTSTRAP_FAILED",
          `Failed to bootstrap bucket ${options.bucket}.`,
          { bucket: options.bucket, endpoint: endpointUrl },
          { cause: error },
        );
      }
    },
    async getBucketReadiness() {
      try {
        const bucketExists = await client.bucketExists(options.bucket);
        if (!bucketExists) {
          return {
            endpoint: endpointUrl,
            bucket: options.bucket,
            bucketExists: false,
            versioningStatus: "Missing",
          };
        }

        const versioning = await client.getBucketVersioning(options.bucket);
        return {
          endpoint: endpointUrl,
          bucket: options.bucket,
          bucketExists: true,
          versioningStatus: versioning.Status,
        };
      } catch (error) {
        throw new StorageError(
          "STORAGE_UNAVAILABLE",
          `Unable to read bucket readiness for ${options.bucket}.`,
          { bucket: options.bucket, endpoint: endpointUrl },
          { cause: error },
        );
      }
    },
    async rollbackObjectWrite(writeResult) {
      assertRollbackWriteResult(writeResult);
      assertSafeObjectKey(writeResult.objectKey);
      try {
        await deleteObjectVersion({
          objectKey: writeResult.objectKey,
          ...(writeResult.versionId ? { versionId: writeResult.versionId } : {}),
        });
      } catch (error) {
        throw mapMinioError(
          "rollback object write",
          endpointUrl,
          options.bucket,
          writeResult.objectKey,
          error,
        );
      }
    },
    async deleteProvisionalObject(locator) {
      assertSafeObjectKey(locator.objectKey);

      if (!isProvisionalUploadSessionObjectKey(locator.objectKey)) {
        throw new StorageError(
          "PROVISIONAL_CLEANUP_FORBIDDEN",
          "Confirmed object deletion is not exposed by the storage package.",
        );
      }

      try {
        await deleteObjectVersion(locator);
      } catch (error) {
        throw mapMinioError(
          "delete provisional object",
          endpointUrl,
          options.bucket,
          locator.objectKey,
          error,
        );
      }
    },
  };
}

function parseStorageEndpoint(endpoint: string): {
  url: URL;
  host: string;
  port?: number;
  useSSL: boolean;
} {
  let url: URL;

  try {
    url = new URL(endpoint);
  } catch (error) {
    throw new StorageError(
      "INVALID_ENDPOINT",
      "Storage endpoint must be an absolute URL.",
      undefined,
      {
        cause: error,
      },
    );
  }

  if (
    url.username ||
    url.password ||
    (url.pathname && url.pathname !== "/") ||
    url.search ||
    url.hash
  ) {
    throw new StorageError(
      "INVALID_ENDPOINT",
      "Storage endpoint must not embed credentials, paths, queries, or hashes.",
    );
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new StorageError("INVALID_ENDPOINT", "Storage endpoint must use http or https.");
  }

  const port = url.port.length > 0 ? Number(url.port) : undefined;
  return {
    url,
    host: url.hostname,
    useSSL: url.protocol === "https:",
    ...(port !== undefined ? { port } : {}),
  };
}

function createSignedUrlContract(input: {
  endpoint: string;
  bucket: string;
  objectKey: string;
  operation: "read" | "write";
  signedUrl: string;
  expiresInSeconds: number;
  now: Date;
  requiredHeaders: Readonly<Record<string, string>>;
}): SignedUrlContract {
  return {
    provider: "minio-s3-compatible",
    endpoint: input.endpoint,
    bucket: input.bucket,
    objectKey: input.objectKey,
    operation: input.operation,
    signedUrl: input.signedUrl,
    expiresInSeconds: input.expiresInSeconds,
    expiresAt: new Date(input.now.getTime() + input.expiresInSeconds * 1_000).toISOString(),
    publicBucket: false,
    requiredHeaders: input.requiredHeaders,
  };
}

function toStoredObjectMetadata(
  endpoint: string,
  bucket: string,
  objectKey: string,
  stat: BucketItemStat,
): StoredObjectMetadata {
  const metadata: Record<string, string> = {};

  for (const [key, value] of Object.entries(stat.metaData)) {
    if (typeof value === "string") {
      metadata[key] = value;
    } else if (typeof value === "number") {
      metadata[key] = String(value);
    }
  }

  const contentType = metadata["content-type"] ?? metadata["Content-Type"] ?? null;

  return {
    endpoint,
    bucket,
    objectKey,
    versionId: stat.versionId ?? null,
    etag: stat.etag,
    sizeBytes: stat.size,
    lastModified: stat.lastModified,
    contentType,
    metadata,
  };
}

type MinioErrorLike = {
  code?: string;
  statusCode?: number;
};

function mapMinioError(
  operation: string,
  endpoint: string,
  bucket: string,
  objectKey: string,
  error: unknown,
): StorageError {
  const minioError = error as MinioErrorLike | undefined;

  if (minioError?.code === "NoSuchKey" || minioError?.statusCode === 404) {
    return new StorageError(
      "OBJECT_NOT_FOUND",
      `Object ${objectKey} was not found in bucket ${bucket}.`,
      { bucket, endpoint, objectKey },
      { cause: error },
    );
  }

  return new StorageError(
    "STORAGE_UNAVAILABLE",
    `Unable to ${operation} against bucket ${bucket}.`,
    { bucket, endpoint, objectKey },
    { cause: error },
  );
}
