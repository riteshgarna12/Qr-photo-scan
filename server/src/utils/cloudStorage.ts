import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';

// Load variables from process.env
const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID;
const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME;
const publicUrl = process.env.CLOUDFLARE_R2_PUBLIC_URL; // e.g., https://pub-xxxxxx.r2.dev

const isConfigured = !!(accountId && accessKeyId && secretAccessKey && bucketName && publicUrl);

let s3Client: S3Client | null = null;

if (isConfigured) {
  s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: accessKeyId!,
      secretAccessKey: secretAccessKey!,
    },
  });
  console.log('☁️ Cloudflare R2 Client initialized successfully');
} else {
  console.log('📁 Cloudflare R2 not configured. Falling back to local disk storage.');
}

/**
 * Returns true if Cloudflare R2 is fully configured in the environment.
 */
export function isCloudEnabled(): boolean {
  return isConfigured;
}

/**
 * Uploads a local file to Cloudflare R2 (if configured).
 * Returns the public access URL of the file.
 * 
 * If R2 is not configured, it returns the local path URL (e.g. `/uploads/filename`).
 */
export async function uploadFile(
  localFilePath: string,
  destinationFilename: string,
  mimeType: string = 'image/jpeg'
): Promise<string> {
  if (!isConfigured || !s3Client) {
    // Local fallback: URL is just the local path
    return `/uploads/${destinationFilename}`;
  }

  const fileStream = fs.createReadStream(localFilePath);

  try {
    const uploadParams = {
      Bucket: bucketName,
      Key: destinationFilename,
      Body: fileStream,
      ContentType: mimeType,
    };

    await s3Client.send(new PutObjectCommand(uploadParams));
    console.log(`[Cloud Storage] Successfully uploaded: ${destinationFilename}`);

    // Return the public cloud URL (ensure no trailing slash issues)
    const base = publicUrl!.replace(/\/$/, '');
    return `${base}/${destinationFilename}`;
  } catch (err: any) {
    console.error(`[Cloud Storage] Failed to upload ${destinationFilename} to R2:`, err.message);
    // Fall back to local path URL on failure
    return `/uploads/${destinationFilename}`;
  } finally {
    fileStream.destroy();
  }
}

/**
 * Deletes a file from Cloudflare R2 (if configured) or local disk.
 */
export async function deleteFile(fileUrlOrFilename: string): Promise<void> {
  const filename = path.basename(fileUrlOrFilename);

  // 1. Delete from Cloudflare R2 (if enabled)
  if (isConfigured && s3Client) {
    try {
      await s3Client.send(
        new DeleteObjectCommand({
          Bucket: bucketName,
          Key: filename,
        })
      );
      console.log(`[Cloud Storage] Deleted from R2: ${filename}`);
    } catch (err: any) {
      console.error(`[Cloud Storage] Failed to delete ${filename} from R2:`, err.message);
    }
  }

  // 2. Always check and delete from local disk as well (clean up local temp uploads)
  const uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads');
  const localPath = path.join(uploadDir, filename);
  try {
    if (fs.existsSync(localPath)) {
      fs.unlinkSync(localPath);
      console.log(`[Local Disk] Deleted local file: ${filename}`);
    }
  } catch (err: any) {
    console.error(`[Local Disk] Failed to delete local file ${filename}:`, err.message);
  }
}

/**
 * Fetches a file from Cloudflare R2 as a stream.
 */
export async function getFileStream(
  destinationFilename: string
): Promise<{ stream: Readable; contentType?: string } | null> {
  if (!isConfigured || !s3Client) {
    return null;
  }

  try {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: destinationFilename,
    });

    const response = await s3Client.send(command);
    if (response.Body) {
      return {
        stream: response.Body as Readable,
        contentType: response.ContentType,
      };
    }
    return null;
  } catch (err: any) {
    console.error(`[Cloud Storage] Failed to fetch stream for ${destinationFilename} from R2:`, err.message);
    return null;
  }
}
