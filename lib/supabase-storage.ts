import "server-only";

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

type SupabaseS3Config = {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicBaseUrl: string;
};

let s3ClientSingleton: S3Client | undefined;

function readRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing ${name}. Configure Supabase S3 environment variables before uploading thumbnails.`,
    );
  }

  return value;
}

function getSupabaseS3Config(): SupabaseS3Config {
  const endpoint = readRequiredEnv("SUPABASE_STORAGE_S3_ENDPOINT");
  const region = readRequiredEnv("SUPABASE_STORAGE_S3_REGION");
  const accessKeyId = readRequiredEnv("SUPABASE_STORAGE_S3_ACCESS_KEY_ID");
  const secretAccessKey = readRequiredEnv(
    "SUPABASE_STORAGE_S3_SECRET_ACCESS_KEY",
  );
  const bucket = readRequiredEnv("SUPABASE_STORAGE_BUCKET");
  const publicBaseUrl = readRequiredEnv("SUPABASE_STORAGE_PUBLIC_BASE_URL");

  return {
    endpoint,
    region,
    accessKeyId,
    secretAccessKey,
    bucket,
    publicBaseUrl: publicBaseUrl,
  };
}

function getS3Client(config: SupabaseS3Config): S3Client {
  if (!s3ClientSingleton) {
    s3ClientSingleton = new S3Client({
      forcePathStyle: true,
      region: config.region,
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  return s3ClientSingleton;
}

function encodeObjectKey(objectKey: string): string {
  return objectKey
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export function getProjectThumbnailObjectKey(projectId: string): string {
  return `projects/${projectId}/thumbnail.png`;
}

export async function uploadProjectThumbnailToStorage(params: {
  projectId: string;
  bytes: Buffer;
  contentType: string;
}): Promise<string> {
  const config = getSupabaseS3Config();
  const s3Client = getS3Client(config);
  const objectKey = getProjectThumbnailObjectKey(params.projectId);

  await s3Client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: objectKey,
      Body: params.bytes,
      ContentType: params.contentType,
      CacheControl: "public, max-age=0, must-revalidate",
    }),
  );

  const encodedObjectKey = encodeObjectKey(objectKey);
  const publicObjectUrl = `${config.publicBaseUrl}/${config.bucket}/${encodedObjectKey}`;

  // Add a version query to avoid stale thumbnail cache after overwrites.
  return `${publicObjectUrl}?v=${Date.now()}`;
}
