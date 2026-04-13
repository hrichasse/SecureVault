import { createHash } from 'crypto'

/**
 * Computes the SHA-256 hash of a file buffer.
 *
 * Used for document integrity verification and certification.
 *
 * @param buffer - The file content as a Node.js Buffer
 * @returns Hex-encoded SHA-256 hash string (64 characters)
 *
 * @example
 * const fs = require('fs')
 * const buffer = fs.readFileSync('./document.pdf')
 * const hash = hashFile(buffer)
 * // → "a3f1b2c9d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1"
 */
export function hashFile(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex')
}

/**
 * Computes the SHA-256 hash of a plain string.
 *
 * @param content - The string to hash
 * @returns Hex-encoded SHA-256 hash string
 */
export function hashString(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex')
}

/**
 * Verifies that a file's hash matches the expected hash.
 *
 * @param buffer - The file content as a Buffer
 * @param expectedHash - The expected SHA-256 hex hash
 * @returns `true` if the hash matches, `false` otherwise
 */
export function verifyFileHash(buffer: Buffer, expectedHash: string): boolean {
  const actualHash = hashFile(buffer)
  return actualHash === expectedHash
}
