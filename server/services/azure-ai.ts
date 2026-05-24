import { AzureKeyCredential, TextAnalyticsClient } from "@azure/ai-text-analytics";
import { getChatResponse } from "../openai";

// Azure AI configuration (Text Analytics)
const endpoint = process.env.AZURE_AI_ENDPOINT || "";
const apiKey = process.env.AZURE_AI_API_KEY || "";

// Initialize Text Analytics Client
const textAnalyticsClient = new TextAnalyticsClient(
  endpoint,
  new AzureKeyCredential(apiKey)
);

export class AzureAIService {
  // Analyze text sentiment
  async analyzeSentiment(text: string) {
    const result = await textAnalyticsClient.analyzeSentiment([text]);
    return result[0];
  }

  // Extract key phrases
  async extractKeyPhrases(text: string) {
    const result = await textAnalyticsClient.extractKeyPhrases([text]);
    return result[0];
  }

  // Chat completion via OpenAI helper configured for Azure in ../openai
  async generateChatCompletion(messages: Array<{ role: string; content: string }>) {
    const content = await getChatResponse(
      messages.map((m) => ({ content: m.content, isUserMessage: m.role === "user" }))
    );
    return { content };
  }

  // Entity recognition for academic context
  async recognizeEntities(text: string) {
    const result = await textAnalyticsClient.recognizeEntities([text]);
    return result[0];
  }
}

export const azureAIService = new AzureAIService();