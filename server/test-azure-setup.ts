import { storageService } from './services/storage-service';
import { monitoringService } from './services/monitoring-service';

async function testAzureSetup() {
    try {
        // Test Application Insights (non-blocking)
        try {
            console.log('Testing Application Insights...');
            await monitoringService.initialize();
            monitoringService.trackEvent('TestEvent', { test: 'success' });
            console.log('✅ Application Insights initialized successfully');
        } catch (e) {
            console.warn('⚠️ Application Insights init failed (continuing):', (e as Error).message);
        }

        // Test Blob Storage
        console.log('\nTesting Azure Blob Storage...');
        await storageService.initialize();
        
        // Create a test file
        const testContent = Buffer.from('Hello, Azure!');
        const fileName = 'test.txt';
        
        // Upload
        console.log('Uploading test file...');
        const url = await storageService.uploadDocument(fileName, testContent);
        console.log('✅ Upload successful:', url);

        // List
        console.log('\nListing documents...');
        const files = await storageService.listDocuments();
        console.log('✅ Files in container:', files);

        // Download
        console.log('\nDownloading test file...');
        const downloaded = await storageService.downloadDocument(fileName);
        console.log('✅ Downloaded content:', downloaded.toString());

        // Delete
        console.log('\nCleaning up test file...');
        await storageService.deleteDocument(fileName);
        console.log('✅ Test file deleted');

    } catch (error) {
        console.error('❌ Error during testing:', error);
    }
}

testAzureSetup();