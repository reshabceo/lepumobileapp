/**
 * s3MultipartUploadService.ts
 *
 * PURE CLIENT-SIDE (Serverless) Implementation for Capacitor apps.
 * Handles large-file (> 40 MB) multipart uploads to AWS S3 using the AWS SDK directly.
 *
 * This version uses @aws-sdk/lib-storage which automatically manages
 * multipart uploads, concurrent parts, and progress tracking.
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface UploadProgress {
  loaded: number;   // bytes uploaded so far
  total: number;    // total file size in bytes
  percent: number;  // 0-100
  partsDone: number;
  totalParts: number;
}

export interface UploadOptions {
  onProgress?: (progress: UploadProgress) => void;
  /** Number of parts uploaded concurrently. Default: 2 (mobile-safe). */
  concurrency?: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build S3Client using environment variables */
const createS3Client = () =>
  new S3Client({
    region: import.meta.env.VITE_AWS_REGION || 'ap-south-2',
    credentials: {
      accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY_ID || '',
      secretAccessKey: import.meta.env.VITE_AWS_SECRET_ACCESS_KEY || '',
    },
    // Fix for "InvalidRequest: The upload was created using a crc32 checksum"
    // This prevents the SDK from automatically adding checksum requirements that fail on completion
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });

const S3_BUCKET = import.meta.env.VITE_AWS_S3_BUCKET || 'monitraq-dicom-upload-bucket';

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Upload a large file (300-400 MB+) to S3 using multipart upload manager (lib-storage).
 * This works entirely client-side without needing a separate backend folder.
 *
 * @param file    The File object selected by the user
 * @param s3Key   The S3 object key (path) to store the file under
 * @param opts    Optional progress callback and concurrency
 * @returns       The S3 object key on success
 */
export const uploadLargeFileToS3 = async (
  file: File,
  s3Key: string,
  opts: UploadOptions = {},
): Promise<string> => {
  const { onProgress, concurrency = 2 } = opts;

  console.log(`🚀 Starting Client-Side Multipart Upload: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)`);

  const client = createS3Client();

  try {
    const parallelUploads3 = new Upload({
      client: client,
      params: {
        Bucket: S3_BUCKET,
        Key: s3Key,
        Body: file,
        ContentType: file.type || 'application/octet-stream',
      },
      queueSize: concurrency, // Number of concurrent parts
      partSize: 10 * 1024 * 1024, // 10MB parts (better for 300MB+ files)
      leavePartsOnError: false,
    });

    parallelUploads3.on('httpUploadProgress', (progress) => {
      if (progress.loaded && progress.total) {
        const percent = Math.round((progress.loaded / progress.total) * 100);
        onProgress?.({
          loaded: progress.loaded,
          total: progress.total,
          percent: percent,
          partsDone: progress.part || 0,
          totalParts: Math.ceil(progress.total / (10 * 1024 * 1024)), // Match new partSize
        });
      }
    });

    await parallelUploads3.done();
    console.log(`🎉 Client-Side Multipart Upload complete: s3://${s3Key}`);
    return s3Key;

  } catch (error) {
    console.error('❌ Client-Side S3 Upload failed:', error);
    throw error;
  }
};

/**
 * Generate a presigned PUT URL for a file in S3.
 * Useful for native uploader plugins.
 */
export const getS3PresignedUrl = async (
  s3Key: string,
  contentType: string,
  expiresIn: number = 3600
): Promise<string> => {
  const client = createS3Client();
  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: s3Key,
    ContentType: contentType,
  });

  try {
    const url = await getSignedUrl(client, command, { expiresIn });
    console.log('✅ Generated S3 presigned URL');
    return url;
  } catch (error) {
    console.error('❌ Failed to generate S3 presigned URL:', error);
    throw error;
  }
};
