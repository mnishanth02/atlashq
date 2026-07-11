/**
 * Minimal, dependency-free ZIP central-directory reader used to enforce archive-bomb limits on
 * Office containers (docx/xlsx/pptx) before any parser (`mammoth`/`xlsx`/`officeparser`) is ever
 * invoked (module-02 §6.10, §9). Deliberately reads only the End-Of-Central-Directory record and
 * the Central Directory File Headers that follow it -- it never inflates entry bytes, so scanning
 * is O(entry count), not O(uncompressed size).
 */

export type ZipContainerLimits = {
  maxEntryCount: number;
  maxTotalUncompressedBytes: number;
  maxSingleEntryUncompressedBytes: number;
  /** Rejects entries whose uncompressed/compressed ratio exceeds this (classic zip-bomb guard). */
  maxCompressionRatio: number;
};

export const DEFAULT_ZIP_CONTAINER_LIMITS: ZipContainerLimits = {
  maxEntryCount: 2_000,
  maxTotalUncompressedBytes: 512 * 1024 * 1024,
  maxSingleEntryUncompressedBytes: 200 * 1024 * 1024,
  maxCompressionRatio: 200,
};

export type ZipEntrySummary = {
  fileName: string;
  compressedSize: number;
  uncompressedSize: number;
};

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const EOCD_MIN_SIZE = 22;
const MAX_COMMENT_LENGTH = 65_535;

export class UnsafeZipContainerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeZipContainerError";
  }
}

/**
 * Parses and validates a ZIP container's central directory against `limits`, throwing
 * `UnsafeZipContainerError` on any violation (too many entries, path traversal/absolute paths,
 * oversized entries/total, or an unsafe compression ratio). Returns the validated entry summaries
 * for callers that want them (e.g. for logging), otherwise callers can discard the result.
 */
export function assertSafeZipContainer(
  buffer: Buffer,
  limits: ZipContainerLimits = DEFAULT_ZIP_CONTAINER_LIMITS,
): ZipEntrySummary[] {
  const eocdOffset = findEndOfCentralDirectory(buffer);
  if (eocdOffset === -1) {
    throw new UnsafeZipContainerError(
      "ZIP container is missing a valid End Of Central Directory record.",
    );
  }

  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirectorySize = buffer.readUInt32LE(eocdOffset + 12);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);

  if (entryCount > limits.maxEntryCount) {
    throw new UnsafeZipContainerError(
      `ZIP container declares ${entryCount} entries, exceeding the limit of ${limits.maxEntryCount}.`,
    );
  }

  if (
    centralDirectoryOffset >= buffer.length ||
    centralDirectoryOffset + centralDirectorySize > eocdOffset
  ) {
    throw new UnsafeZipContainerError("ZIP container central directory is out of bounds.");
  }

  const entries: ZipEntrySummary[] = [];
  let cursor = centralDirectoryOffset;
  let totalUncompressed = 0;

  for (let index = 0; index < entryCount; index += 1) {
    if (cursor + 46 > buffer.length) {
      throw new UnsafeZipContainerError("ZIP container central directory record is truncated.");
    }

    const signature = buffer.readUInt32LE(cursor);
    if (signature !== CENTRAL_DIRECTORY_SIGNATURE) {
      throw new UnsafeZipContainerError(
        `ZIP container central directory entry ${index} has an invalid signature.`,
      );
    }

    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const uncompressedSize = buffer.readUInt32LE(cursor + 24);
    const fileNameLength = buffer.readUInt16LE(cursor + 28);
    const extraFieldLength = buffer.readUInt16LE(cursor + 30);
    const fileCommentLength = buffer.readUInt16LE(cursor + 32);
    const nameStart = cursor + 46;
    const nameEnd = nameStart + fileNameLength;

    if (nameEnd > buffer.length) {
      throw new UnsafeZipContainerError("ZIP container entry file name is out of bounds.");
    }

    const fileName = buffer.toString("utf8", nameStart, nameEnd);
    assertSafeEntryName(fileName);

    if (uncompressedSize > limits.maxSingleEntryUncompressedBytes) {
      throw new UnsafeZipContainerError(
        `ZIP container entry "${fileName}" is ${uncompressedSize} uncompressed bytes, exceeding the per-entry limit.`,
      );
    }

    if (compressedSize > 0) {
      const ratio = uncompressedSize / compressedSize;
      if (ratio > limits.maxCompressionRatio) {
        throw new UnsafeZipContainerError(
          `ZIP container entry "${fileName}" has an unsafe compression ratio (${ratio.toFixed(1)}x).`,
        );
      }
    } else if (uncompressedSize > 0) {
      throw new UnsafeZipContainerError(
        `ZIP container entry "${fileName}" claims uncompressed content from a zero-byte compressed entry.`,
      );
    }

    totalUncompressed += uncompressedSize;
    if (totalUncompressed > limits.maxTotalUncompressedBytes) {
      throw new UnsafeZipContainerError(
        `ZIP container total uncompressed size exceeds the limit of ${limits.maxTotalUncompressedBytes} bytes.`,
      );
    }

    entries.push({ fileName, compressedSize, uncompressedSize });
    cursor = nameEnd + extraFieldLength + fileCommentLength;
  }

  return entries;
}

function assertSafeEntryName(fileName: string): void {
  if (fileName.length === 0) {
    throw new UnsafeZipContainerError("ZIP container entry has an empty file name.");
  }
  if (fileName.startsWith("/") || /^[a-zA-Z]:/.test(fileName)) {
    throw new UnsafeZipContainerError(`ZIP container entry "${fileName}" uses an absolute path.`);
  }
  const segments = fileName.split(/[/\\]/);
  const trailingDirectoryMarker = fileName.endsWith("/") || fileName.endsWith("\\");
  if (
    segments.some(
      (segment, index) =>
        (segment.length === 0 && (!trailingDirectoryMarker || index !== segments.length - 1)) ||
        segment === "." ||
        segment === "..",
    )
  ) {
    throw new UnsafeZipContainerError(`ZIP container entry "${fileName}" attempts path traversal.`);
  }
}

/** Scans backward from the end of the file for the EOCD signature (allowing for a zip comment). */
function findEndOfCentralDirectory(buffer: Buffer): number {
  const searchStart = Math.max(0, buffer.length - EOCD_MIN_SIZE - MAX_COMMENT_LENGTH);

  for (let offset = buffer.length - EOCD_MIN_SIZE; offset >= searchStart; offset -= 1) {
    if (buffer.readUInt32LE(offset) === EOCD_SIGNATURE) {
      return offset;
    }
  }

  return -1;
}
