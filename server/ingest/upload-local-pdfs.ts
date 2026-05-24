import { promises as fs } from 'fs';
import path from 'path';
import { storageService } from '../services/storage-service';

async function listPdfFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const sub = await listPdfFiles(fullPath);
      files.push(...sub);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.pdf')) {
      files.push(fullPath);
    }
  }
  return files;
}

async function main() {
  try {
    const root = path.resolve(process.cwd(), 'rag_service', 'documents');
    console.log('Scanning for PDFs under:', root);
    const files = await listPdfFiles(root);
    console.log(`Found ${files.length} PDF(s).`);

    if (files.length === 0) {
      console.log('No PDFs found. Nothing to upload.');
      return;
    }

    await storageService.initialize();

    for (const filePath of files) {
      const rel = path.relative(root, filePath).replace(/\\/g, '/');
      // Use the relative path as the blob name to avoid name collisions
      const blobName = rel;
      try {
        const buf = await fs.readFile(filePath);
        await storageService.uploadDocument(blobName, buf);
        console.log(`Uploaded: ${blobName}`);
      } catch (err) {
        console.error(`Failed to upload ${blobName}:`, err);
      }
    }

    console.log('\nUpload complete.');
  } catch (err) {
    console.error('Upload failed:', err);
    process.exitCode = 1;
  }
}

main();
