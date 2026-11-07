import mongoose from 'mongoose'
import { Readable } from 'node:stream'
import { badRequest } from '../lib/errors.js'
import { logger } from '../lib/logger.js'

export const MAX_RECEIPT_BYTES = 5 * 1024 * 1024

type Kind = { mime: string; ext: string; image: boolean }

/** Identify the file type from its first bytes. The client-declared type is ignored. */
export function sniffFileType(buf: Buffer): Kind | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg', image: true }
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return { mime: 'image/png', ext: 'png', image: true }
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP')
    return { mime: 'image/webp', ext: 'webp', image: true }
  if (buf.length >= 5 && buf.toString('ascii', 0, 5) === '%PDF-') return { mime: 'application/pdf', ext: 'pdf', image: false }
  return null
}

/**
 * Re-encode images: strips EXIF (incl. GPS location), drops anything hidden after the image data,
 * and bounds the size. PDFs are stored as-is but always served as downloads.
 */
async function normalize(buf: Buffer, kind: Kind): Promise<{ data: Buffer; mime: string }> {
  if (!kind.image) return { data: buf, mime: kind.mime }
  try {
    const { default: sharp } = await import('sharp')
    const data = await sharp(buf, { limitInputPixels: 50_000_000 })
      .rotate() // apply EXIF orientation before metadata is dropped
      .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer()
    return { data, mime: 'image/webp' }
  } catch (err) {
    logger.warn({ err }, 'Image re-encode failed')
    throw badRequest('Could not process this image')
  }
}

function bucket() {
  const db = mongoose.connection.db
  if (!db) throw new Error('Database not connected')
  return new mongoose.mongo.GridFSBucket(db, { bucketName: 'receipts' })
}

export async function storeReceipt(
  buf: Buffer,
  meta: { expenseId: string; uploadedBy: string },
): Promise<{ fileId: mongoose.Types.ObjectId; mime: string }> {
  const kind = sniffFileType(buf)
  if (!kind) throw badRequest('Unsupported file type. Use JPEG, PNG, WebP or PDF.')
  const { data, mime } = await normalize(buf, kind)

  const upload = bucket().openUploadStream(`receipt-${meta.expenseId}`, {
    metadata: { ...meta, contentType: mime },
  })
  await new Promise<void>((resolve, reject) => {
    Readable.from(data).pipe(upload).on('finish', () => resolve()).on('error', reject)
  })
  return { fileId: upload.id as mongoose.Types.ObjectId, mime }
}

export function openReceipt(fileId: mongoose.Types.ObjectId) {
  return bucket().openDownloadStream(fileId)
}

export async function deleteReceipt(fileId: mongoose.Types.ObjectId): Promise<void> {
  try {
    await bucket().delete(fileId)
  } catch (err) {
    logger.warn({ err, fileId }, 'Failed to delete receipt file')
  }
}
