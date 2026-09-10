import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
})

const BUCKET = process.env.CLOUDFLARE_R2_BUCKET_NAME!
const PUBLIC_URL = (process.env.CLOUDFLARE_R2_PUBLIC_URL ?? "").replace(/\/+$/, "")

/**
 * `<account>.r2.cloudflarestorage.com` is the S3 API endpoint: every object
 * there needs a signed request, so a browser gets `InvalidArgument:
 * Authorization`. The public URL must be the bucket's r2.dev URL or a custom
 * domain connected to it.
 */
const PUBLIC_URL_IS_API_ENDPOINT = /\.r2\.cloudflarestorage\.com/i.test(PUBLIC_URL)
if (PUBLIC_URL_IS_API_ENDPOINT) {
  console.error(
    "[r2] CLOUDFLARE_R2_PUBLIC_URL apunta al endpoint S3 privado " +
      "(*.r2.cloudflarestorage.com). Usá la URL pública del bucket " +
      "(https://pub-….r2.dev o un dominio propio). Subidas deshabilitadas."
  )
}

/**
 * R2 is optional: the rest of the app works without it, so upload routes check
 * this and answer with a clear message instead of a stack trace from the SDK.
 */
export function isR2Configured(): boolean {
  return Boolean(
    process.env.CLOUDFLARE_R2_ACCOUNT_ID &&
      process.env.CLOUDFLARE_R2_ACCESS_KEY_ID &&
      process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY &&
      process.env.CLOUDFLARE_R2_BUCKET_NAME &&
      PUBLIC_URL &&
      !PUBLIC_URL_IS_API_ENDPOINT
  )
}

export async function uploadToR2(
  key: string,
  body: Buffer,
  contentType: string
): Promise<string> {
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  )
  return `${PUBLIC_URL}/${key}`
}

export async function deleteFromR2(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }))
}

export async function getPresignedUrl(key: string, expiresIn = 3600): Promise<string> {
  const command = new PutObjectCommand({ Bucket: BUCKET, Key: key })
  return getSignedUrl(s3, command, { expiresIn })
}
