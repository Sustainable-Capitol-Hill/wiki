import * as path from 'path';
import * as fs from 'fs';

/**
 * Sanitizes a file or folder name for use in file paths
 * - Converts to lowercase
 * - Replaces spaces with hyphens
 * - Removes special characters
 * - Trims leading/trailing hyphens
 */
export function sanitizePath(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')           // Replace spaces with hyphens
    .replace(/[^a-z0-9-_]/g, '')    // Remove special characters
    .replace(/^-+|-+$/g, '')        // Trim leading/trailing hyphens
    .replace(/-+/g, '-');           // Collapse multiple hyphens
}

/**
 * Builds a relative path from the docs root based on Drive folder structure
 */
export function buildRelativePath(pathParts: string[]): string {
  return pathParts.map(sanitizePath).join('/');
}

/**
 * Gets the full file system path for a content file
 */
export function getContentPath(relativePath: string): string {
  return path.join(process.cwd(), 'src', 'content', 'docs', relativePath);
}

/**
 * Gets the full file system path for an image file
 */
export function getImagePath(relativePath: string): string {
  return path.join(process.cwd(), 'public', 'images', relativePath);
}

/**
 * Ensures a directory exists, creating it and parent directories if needed
 */
export function ensureDirectoryExists(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Gets the relative path from a markdown file to an image in public/images
 * Astro serves public/ at the root, so we return /images/...
 */
export function getImageUrlForMarkdown(imageRelativePath: string): string {
  return `/images/${imageRelativePath}`;
}

/**
 * Recursively deletes a directory and all its contents
 */
export function deleteDirectory(dirPath: string): void {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}

/**
 * Deletes a single file if it exists
 */
export function deleteFile(filePath: string): void {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}
