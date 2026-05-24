import { azureAIService } from "./azure-ai";

export class ChatManager {
  private context: string[] = [];

  async processMessage(userMessage: string) {
    try {
      // Analyze message sentiment
      const sentiment = await azureAIService.analyzeSentiment(userMessage);
      
      // Extract key phrases
      const keyPhrases = await azureAIService.extractKeyPhrases(userMessage);
      
      // Recognize entities
      const entities = await azureAIService.recognizeEntities(userMessage);
      
      // Prepare chat context
      const messages = [
        { role: "system", content: "You are a university assistant AI helping students with academic and administrative queries." },
        ...this.context.map(msg => ({ role: "user", content: msg })),
        { role: "user", content: userMessage }
      ];
      
      // Generate response using Azure OpenAI
      const response = await azureAIService.generateChatCompletion(messages);
      
      // Update context
      this.context.push(userMessage);
      if (this.context.length > 10) {
        this.context.shift(); // Keep context window manageable
      }
      
      return {
        response: response.content,
        sentiment: (sentiment as any)?.sentiment,
        keyPhrases: (keyPhrases as any)?.keyPhrases,
        entities: (entities as any)?.entities,
      };
    } catch (error) {
      console.error("Error processing message:", error);
      throw error;
    }
  }

  clearContext() {
    this.context = [];
  }
}