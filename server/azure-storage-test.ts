import { BlobServiceClient } from '@azure/storage-blob';
import { azureConfig } from './services/azure-config';

async function testAzureSetup() {
    try {
        // 1. Get connection string from Key Vault
        console.log('1. Getting storage connection string from Key Vault...');
        const connectionString = await azureConfig.getStorageConnectionString();
        console.log('✅ Successfully retrieved connection string from Key Vault');

        // 2. Create Blob Service Client
        console.log('\n2. Creating Blob Service Client...');
        const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
        console.log('✅ Successfully created Blob Service Client');

        // 3. Get container client
        console.log('\n3. Accessing documents container...');
        const containerClient = blobServiceClient.getContainerClient('documents');
        const containerExists = await containerClient.exists();
        console.log(`✅ Container 'documents' exists: ${containerExists}`);

        // 4. Upload test file
        console.log('\n4. Uploading test file...');
        const testBlobName = 'test-file.txt';
        const blockBlobClient = containerClient.getBlockBlobClient(testBlobName);
        const testData = 'This is a test file to verify Azure Blob Storage setup.';
        await blockBlobClient.upload(testData, testData.length);
        console.log('✅ Successfully uploaded test file');

        // 5. Download test file
        console.log('\n5. Downloading test file...');
        const downloadResponse = await blockBlobClient.download(0);
        const downloaded = await streamToString(downloadResponse.readableStreamBody!);
        console.log('✅ Successfully downloaded test file');
        console.log(`Content: ${downloaded}`);

        // 6. Clean up
        console.log('\n6. Cleaning up test file...');
        await blockBlobClient.delete();
        console.log('✅ Successfully deleted test file');

        console.log('\n🎉 All tests passed! Azure Blob Storage is properly configured.');
    } catch (error) {
        console.error('\n❌ Test failed:', error);
        throw error;
    }
}

// Helper function to convert stream to string
async function streamToString(readableStream: NodeJS.ReadableStream): Promise<string> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        readableStream.on('data', (data) => {
            chunks.push(Buffer.from(data));
        });
        readableStream.on('end', () => {
            resolve(Buffer.concat(chunks).toString('utf8'));
        });
        readableStream.on('error', reject);
    });
}

// Run the test
testAzureSetup().catch(console.error);