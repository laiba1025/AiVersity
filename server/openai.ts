import { OpenAI } from "openai";

const openai = new OpenAI({
  apiKey: process.env.AZURE_OPENAI_KEY || "",
  baseURL: `${process.env.AZURE_OPENAI_ENDPOINT}/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT_CHAT}`,
  defaultQuery: { "api-version": "2024-02-15-preview" },
  defaultHeaders: { "api-key": process.env.AZURE_OPENAI_KEY || "" }
});

// Remove Markdown bold markers from AI output
function sanitizeOutput(text: string | null | undefined): string {
  const t = text || "";
  // Replace **bold** with bold and strip any remaining **
  return t.replace(/\*\*(.*?)\*\*/gs, "$1").replace(/\*\*/g, "");
}

// Context for RAG system about university content
const universitySystemPrompt = `
You are an assistant for international students at a university in Hungary. You'll help students with:
1. University procedures and requirements
2. Document information and deadlines
3. Campus navigation and locations
4. Events and important dates
5. Visa and residence permit information

Be concise, helpful, and provide accurate information. If you're asked about a location on campus,
suggest to view it on the map. If you're asked about documents, mention if they can be added to the 
document checklist. Always offer to help with any follow-up questions.

Answer in the same language the user asks the question (English or Hungarian). If unsure, default to English.
`;

// Function to get a chat response from OpenAI
export async function getChatResponse(messages: { content: string; isUserMessage: boolean }[]): Promise<string> {
  try {
    // Format messages for OpenAI API
    const formattedMessages = [
      { role: "system" as const, content: universitySystemPrompt },
      ...messages.map(msg => ({
        role: (msg.isUserMessage ? "user" : "assistant") as "user" | "assistant",
        content: msg.content
      }))
    ];

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: formattedMessages,
      temperature: 0.7,
      max_tokens: 500
    });

    return sanitizeOutput(response.choices[0].message.content) || "I'm sorry, I couldn't generate a response right now.";
  } catch (error) {
    console.error("Error getting chat response:", error);
    return "I'm sorry, I encountered an error while processing your request. Please try again later.";
  }
}

export async function getRAGResponse(
  question: string,
  chatHistory: { content: string; isUserMessage: boolean }[]
): Promise<{answer: string, sources: string[] }> {
  try {
  const response = await fetch("http://127.0.0.1:5001/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question,
        chat_history: chatHistory.map(m => [m.isUserMessage ? "user" : "assistant", m.content])
      })
    });

    const data = await response.json();

    if (data.error) throw new Error(data.error);

    // return data.answer + "\n\nSources:\n" + data.sources.map((s: string) => "- " + s).join("\n");
    console.log("RAG response:", data.answer, data.sources);
    return {
      answer: sanitizeOutput(data.answer),
      sources: data.sources || []
    }
  } catch (err) {
    console.error("RAG error:", err);
    return {
      answer: "Sorry, I couldn't retrieve an answer right now.",
      sources: []
    }
  }
}

// RAG-powered smart search for policies and guides (returns top snippets)
export async function searchPoliciesGuides(
  query: string
): Promise<Array<{ snippet: string; source?: string; page?: number; score?: number }>> {
  try {
  const response = await fetch("http://127.0.0.1:5001/search?q=" + encodeURIComponent(query), {
      method: "GET",
      headers: { "Content-Type": "application/json" }
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error);
    // Expecting data.results: [{ snippet, source, page, score }]
    return data.results || [];
  } catch (err) {
    console.error("RAG search error:", err);
    return [];
  }
}

// Function to get document requirements explanation
export async function getDocumentInfo(documentTitle: string): Promise<string> {
  try {
    const prompt = `
    Please provide detailed information about the document "${documentTitle}" needed by international students in Hungary.
    Include:
    1. What exactly this document is
    2. Where and how to obtain it
    3. Common issues or requirements for this document
    4. Any relevant deadlines or renewal information
    Keep the response concise but informative.
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        { role: "system", content: universitySystemPrompt },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 400
    });

    return sanitizeOutput(response.choices[0].message.content) || "No information available for this document.";
  } catch (error) {
    console.error("Error getting document info:", error);
    return "Information temporarily unavailable. Please try again later.";
  }
}

// Function to translate text between English and Hungarian
export async function translateText(text: string, targetLanguage: "en" | "hu"): Promise<string> {
  try {
    const sourceLanguage = targetLanguage === "en" ? "Hungarian" : "English";
    const target = targetLanguage === "en" ? "English" : "Hungarian";
    
    const prompt = `Translate the following ${sourceLanguage} text to ${target}:\n\n${text}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        { role: "system", content: "You are a professional translator between English and Hungarian." },
        { role: "user", content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 500
    });

    return sanitizeOutput(response.choices[0].message.content) || text;
  } catch (error) {
    console.error("Error translating text:", error);
    return text;
  }
}
