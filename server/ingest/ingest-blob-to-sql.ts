import crypto from 'crypto';
import { storageService } from '../services/storage-service';
import { getSqlPool, closeSqlPool } from '../db/sql';
// @ts-ignore - no types shipped for pdf-parse; declared in root types.d.ts
import pdfParse from 'pdf-parse';

function md5(buf: Buffer): string {
  return crypto.createHash('md5').update(buf).digest('hex');
}

function chunkText(text: string, size: number, overlap: number): string[] {
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    const end = Math.min(text.length, i + size);
    const chunk = text.slice(i, end);
    chunks.push(chunk);
    if (end === text.length) break;
    i = end - overlap;
    if (i < 0) i = 0;
  }
  return chunks;
}

async function upsertDocument(pool: any, title: string, sourceUri: string | null, checksum: string, pageCount: number | null): Promise<number> {
  // Try find by checksum first
  let r = await pool.request()
    .input('checksum', checksum)
    .query(`SELECT TOP 1 id FROM documents_corpus WHERE checksum=@checksum ORDER BY id DESC`);
  if (r.recordset.length > 0) {
    const id = r.recordset[0].id as number;
    // Update metadata in case title/source changed
    await pool.request()
      .input('id', id)
      .input('title', title)
      .input('source_uri', sourceUri)
      .input('page_count', pageCount)
      .query(`UPDATE documents_corpus SET title=@title, source_uri=@source_uri, page_count=@page_count WHERE id=@id`);
    return id;
  }
  // Insert new
  r = await pool.request()
    .input('title', title)
    .input('source_uri', sourceUri)
    .input('checksum', checksum)
    .input('page_count', pageCount)
    .query(`INSERT INTO documents_corpus (title, source_uri, checksum, page_count)
            OUTPUT INSERTED.id
            VALUES (@title, @source_uri, @checksum, @page_count)`);
  return r.recordset[0].id as number;
}

async function clearChunks(pool: any, documentId: number) {
  await pool.request().input('document_id', documentId).query(`DELETE FROM corpus_chunks WHERE document_id=@document_id`);
}

async function insertChunks(pool: any, documentId: number, chunks: string[]) {
  for (let idx = 0; idx < chunks.length; idx++) {
    const text = chunks[idx];
    await pool.request()
      .input('document_id', documentId)
      .input('chunk_index', idx)
      .input('text', text)
      .query(`INSERT INTO corpus_chunks (document_id, chunk_index, text) VALUES (@document_id, @chunk_index, @text)`);
  }
}

async function main() {
  const CHUNK_SIZE = parseInt(process.env.CORPUS_CHUNK_SIZE || '1000', 10);
  const CHUNK_OVERLAP = parseInt(process.env.CORPUS_CHUNK_OVERLAP || '200', 10);

  try {
    console.log('Initializing Azure Blob Storage...');
    await storageService.initialize();

    console.log('Connecting to Azure SQL...');
    const pool = await getSqlPool();

    console.log('Listing blobs...');
    const blobs = await storageService.listDocuments();
    const pdfs = blobs.filter(b => b.toLowerCase().endsWith('.pdf'));
    console.log(`Found ${pdfs.length} PDF(s) in container.`);

    for (const name of pdfs) {
      try {
        console.log(`\nProcessing: ${name}`);
        const buf = await storageService.downloadDocument(name);
        const checksum = md5(buf);

        const parsed = await pdfParse(buf);
        const text = (parsed.text || '').trim();
        const pageCount = (parsed.numpages as number) || null;
        if (!text) {
          console.warn(`No text extracted from ${name}, skipping.`);
          continue;
        }

        const docId = await upsertDocument(pool, name, name, checksum, pageCount);
        console.log(`Document ID: ${docId} (checksum ${checksum})`);

        // Always refresh chunks for latest extraction
        await clearChunks(pool, docId);
        const chunks = chunkText(text, CHUNK_SIZE, CHUNK_OVERLAP);
        await insertChunks(pool, docId, chunks);
        console.log(`Inserted ${chunks.length} chunk(s).`);
      } catch (e) {
        console.error(`Error processing ${name}:`, e);
      }
    }

    console.log('\nIngestion complete.');
  } catch (err) {
    console.error('Ingestion failed:', err);
    process.exitCode = 1;
  } finally {
    await closeSqlPool();
  }
}

main();
