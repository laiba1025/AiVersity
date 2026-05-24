import { DefaultAzureCredential } from "@azure/identity";
import { SecretClient } from "@azure/keyvault-secrets";
import dotenv from "dotenv";
import path from "path";

// Load environment variables from .env files for convenience (so you don't need to set them every session)
// 1) Load project root .env if present
dotenv.config();
// 2) Also load server/.env to support existing convention in this repo
dotenv.config({ path: path.resolve(process.cwd(), "server", ".env") });

// Allow overriding Key Vault name via environment variable for easier setup
// Fallback to the existing default to remain backward compatible
const keyVaultName = process.env.AZURE_KEY_VAULT_NAME || "aiversity-keyvault";
const keyVaultUrl = `https://${keyVaultName}.vault.azure.net`;

export class AzureConfig {
    private secretClient: SecretClient;

    constructor() {
        const credential = new DefaultAzureCredential();
        this.secretClient = new SecretClient(keyVaultUrl, credential);
    }

    private async getSecretOrEnv(secretName: string, envVar: string): Promise<string> {
        try {
            const secret = await this.secretClient.getSecret(secretName);
            if (secret.value) return secret.value;
        } catch (e) {
            // Fallback to environment variable when Key Vault auth is unavailable in local dev
            const val = process.env[envVar];
            if (val) return val;
            throw e;
        }
        // Final fallback to env if secret existed without value
        const val = process.env[envVar] || "";
        return val;
    }

    async getStorageConnectionString(): Promise<string> {
        return this.getSecretOrEnv('AZURE-STORAGE-CONNECTION-STRING', 'AZURE_STORAGE_CONNECTION_STRING');
    }

    async getCognitiveServiceEndpoint(): Promise<string> {
        return this.getSecretOrEnv('COGNITIVE-SERVICE-ENDPOINT', 'COGNITIVE_SERVICE_ENDPOINT');
    }

    async getCognitiveServiceKey(): Promise<string> {
        return this.getSecretOrEnv('COGNITIVE-SERVICE-KEY', 'COGNITIVE_SERVICE_KEY');
    }

    async getAppInsightsConnectionString(): Promise<string> {
        return this.getSecretOrEnv('APPLICATION-INSIGHTS-CONNECTION-STRING', 'APPLICATION_INSIGHTS_CONNECTION_STRING');
    }
}

export const azureConfig = new AzureConfig();