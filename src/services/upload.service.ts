import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

export interface UploadResult {
  url: string;
  path: string;
  size: number;
  mimeType: string;
}

export interface StorageAdapter {
  upload(file: Express.Multer.File, folder: string): Promise<UploadResult>;
  delete(filePath: string): Promise<void>;
  getPublicUrl(filePath: string): string;
}

/**
 * Local disk storage adapter (for development)
 */
export class LocalStorageAdapter implements StorageAdapter {
  private uploadDir: string;
  private baseUrl: string;

  constructor() {
    this.uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
    this.baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  }

  async upload(file: Express.Multer.File, folder: string): Promise<UploadResult> {
    const dir = path.join(this.uploadDir, folder);
    await fs.mkdir(dir, { recursive: true });

    const ext = path.extname(file.originalname);
    const filename = `${randomUUID()}${ext}`;
    const filePath = path.join(folder, filename);
    const fullPath = path.join(this.uploadDir, filePath);

    await fs.writeFile(fullPath, file.buffer);

    return {
      url: this.getPublicUrl(filePath),
      path: filePath,
      size: file.size,
      mimeType: file.mimetype,
    };
  }

  async delete(filePath: string): Promise<void> {
    const fullPath = path.join(this.uploadDir, filePath);
    try {
      await fs.unlink(fullPath);
    } catch (error) {
      // File might not exist, ignore
    }
  }

  getPublicUrl(filePath: string): string {
    return `${this.baseUrl}/uploads/${filePath}`;
  }
}

/**
 * S3-compatible storage adapter (for production)
 * Placeholder - implement with AWS SDK or compatible client
 */
export class S3StorageAdapter implements StorageAdapter {
  async upload(_file: Express.Multer.File, _folder: string): Promise<UploadResult> {
    // TODO: Implement S3 upload
    // Example with AWS SDK:
    // const s3 = new S3Client({ region: process.env.AWS_REGION });
    // const key = `${folder}/${randomUUID()}${path.extname(file.originalname)}`;
    // await s3.send(new PutObjectCommand({
    //   Bucket: process.env.S3_BUCKET,
    //   Key: key,
    //   Body: file.buffer,
    //   ContentType: file.mimetype,
    // }));
    
    throw new Error('S3 storage not implemented yet');
  }

  async delete(_filePath: string): Promise<void> {
    // TODO: Implement S3 delete
    throw new Error('S3 storage not implemented yet');
  }

  getPublicUrl(filePath: string): string {
    // TODO: Return S3 URL or CloudFront URL
    const bucket = process.env.S3_BUCKET || 'finwise-uploads';
    const region = process.env.AWS_REGION || 'us-east-1';
    return `https://${bucket}.s3.${region}.amazonaws.com/${filePath}`;
  }
}

/**
 * Upload service with pluggable storage adapter
 */
export class UploadService {
  private adapter: StorageAdapter;

  constructor(adapter?: StorageAdapter) {
    // Use local storage by default, S3 in production
    this.adapter = adapter || (
      process.env.NODE_ENV === 'production'
        ? new S3StorageAdapter()
        : new LocalStorageAdapter()
    );
  }

  async uploadFile(file: Express.Multer.File, folder: string): Promise<UploadResult> {
    return this.adapter.upload(file, folder);
  }

  async deleteFile(filePath: string): Promise<void> {
    return this.adapter.delete(filePath);
  }

  getPublicUrl(filePath: string): string {
    return this.adapter.getPublicUrl(filePath);
  }
}

export const uploadService = new UploadService();
