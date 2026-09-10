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

/**
 * The stored URLs are `PUBLIC_URL/key`, frozen at upload time, so rows written
 * under a wrong or older CLOUDFLARE_R2_PUBLIC_URL keep a dead link. The key is
 * the source of truth: on boot, rebuild every URL that no longer matches it.
 * Idempotent — once the rows agree with the current PUBLIC_URL it touches nothing.
 */
export async function repairR2Urls(): Promise<void> {
  if (!isR2Configured()) return
  const { prisma } = await import("./prisma.js")
  const [links, covers, comments] = await Promise.all([
    prisma.$executeRaw`
      UPDATE "ModuleLink" SET url = ${PUBLIC_URL} || '/' || "storageKey"
      WHERE "storageKey" IS NOT NULL AND url <> ${PUBLIC_URL} || '/' || "storageKey"`,
    prisma.$executeRaw`
      UPDATE "ModuleItem" SET "coverImageUrl" = ${PUBLIC_URL} || '/' || "coverImageKey"
      WHERE "coverImageKey" IS NOT NULL
        AND "coverImageUrl" IS DISTINCT FROM ${PUBLIC_URL} || '/' || "coverImageKey"`,
    prisma.$executeRaw`
      UPDATE "ModuleItemComment" SET "imageUrl" = ${PUBLIC_URL} || '/' || "imageKey"
      WHERE "imageKey" IS NOT NULL
        AND "imageUrl" IS DISTINCT FROM ${PUBLIC_URL} || '/' || "imageKey"`,
  ])
  if (links + covers + comments > 0) {
    console.log(`[r2] URLs reparadas: ${links} links, ${covers} portadas, ${comments} fotos`)
  }
}

export async function deleteFromR2(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }))
}

export async function getPresignedUrl(key: string, expiresIn = 3600): Promise<string> {
  const command = new PutObjectCommand({ Bucket: BUCKET, Key: key })
  return getSignedUrl(s3, command, { expiresIn })
}
