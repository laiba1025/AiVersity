import { BlobServiceClient, ContainerClient, BlobSASPermissions, SASProtocol, generateBlobSASQueryParameters, StorageSharedKeyCredential } from '@azure/storage-blob';
import { azureConfig } from './azure-config';

export class StorageService {
    private blobServiceClient: BlobServiceClient | null = null;
    private containerClient: ContainerClient | null = null;
    private containerName = 'documents';
    private accountName: string | null = null;
    private accountKey: string | null = null;

    async initialize() {
        const connectionString = await azureConfig.getStorageConnectionString();
        this.blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
        this.containerClient = this.blobServiceClient.getContainerClient(this.containerName);
        // Extract accountName and accountKey for SAS generation
        const nameMatch = connectionString.match(/AccountName=([^;]+)/i);
        const keyMatch = connectionString.match(/AccountKey=([^;]+)/i);
        this.accountName = nameMatch ? nameMatch[1] : null;
        this.accountKey = keyMatch ? keyMatch[1] : null;
        
        // Ensure container exists
        await this.containerClient.createIfNotExists();
    }

    async uploadDocument(filename: string, content: Buffer): Promise<string> {
        if (!this.containerClient) {
            await this.initialize();
        }
        
        const blockBlobClient = this.containerClient!.getBlockBlobClient(filename);
        await blockBlobClient.upload(content, content.length);
        return blockBlobClient.url;
    }

    async downloadDocument(filename: string): Promise<Buffer> {
        if (!this.containerClient) {
            await this.initialize();
        }

        const blockBlobClient = this.containerClient!.getBlockBlobClient(filename);
        const downloadResponse = await blockBlobClient.download(0);
        
        const chunks: Buffer[] = [];
        for await (const chunk of downloadResponse.readableStreamBody!) {
            chunks.push(Buffer.from(chunk));
        }
        
        return Buffer.concat(chunks);
    }

    async listDocuments(): Promise<string[]> {
        if (!this.containerClient) {
            await this.initialize();
        }

        const documents: string[] = [];
        for await (const blob of this.containerClient!.listBlobsFlat()) {
            documents.push(blob.name);
        }
        
        return documents;
    }

    async exists(filename: string): Promise<boolean> {
        if (!this.containerClient) {
            await this.initialize();
        }
        const blockBlobClient = this.containerClient!.getBlockBlobClient(filename);
        try {
            return await blockBlobClient.exists();
        } catch {
            return false;
        }
    }

    async deleteDocument(filename: string): Promise<void> {
        if (!this.containerClient) {
            await this.initialize();
        }

        const blockBlobClient = this.containerClient!.getBlockBlobClient(filename);
        await blockBlobClient.delete();
    }

    async generateSasUrl(filename: string, expiresInMinutes = 15): Promise<string> {
        if (!this.containerClient) {
            await this.initialize();
        }
        if (!this.accountName || !this.accountKey) {
            throw new Error('Storage account credentials not available for SAS generation');
        }

        const sharedKey = new StorageSharedKeyCredential(this.accountName, this.accountKey);
        const startsOn = new Date();
        const expiresOn = new Date(Date.now() + expiresInMinutes * 60 * 1000);

        const sas = generateBlobSASQueryParameters(
            {
                containerName: this.containerName,
                blobName: filename,
                permissions: BlobSASPermissions.parse('r'),
                startsOn,
                expiresOn,
                protocol: SASProtocol.Https,
            },
            sharedKey,
        ).toString();

        const blobClient = this.containerClient!.getBlockBlobClient(filename);
        return `${blobClient.url}?${sas}`;
    }
}

export const storageService = new StorageService();