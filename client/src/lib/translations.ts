import { createContext, useContext } from "react";
import { apiRequest } from "./queryClient";

export const languages = {
  en: {
    name: "English",
    nativeName: "English",
    code: "en",
  },
  hu: {
    name: "Hungarian",
    nativeName: "Magyar",
    code: "hu",
  },
};

export type Language = keyof typeof languages;

export type TranslationKey =
  // App bar
  | "appTitle"
  | "switchLanguage"
  
  // Navigation
  | "home"
  | "chat"
  | "documents"
  | "map"
  | "notifications"
  
  // Home page
  | "welcome"
  | "importantDeadlines"
  | "quickActions"
  | "askAssistant"
  | "viewAllDeadlines"
  | "documentProgress"
  | "requiredDocuments"
  | "completed"
  | "continueUploading"
  | "upcomingEvents"
  | "viewOnMap"
  
  // Chat page
  | "universityAssistant"
  | "askMeAnything"
  | "typeYourQuestion"
  | "showOnMap"
  | "addToChecklist"
  
  // Document page
  | "documentChecklist"
  | "uploadAndManage"
  | "uploadDocument"
  | "viewDocument"
  | "pending"
  | "required"
  
  // Map page
  | "searchLocations"
  | "directions"
  | "details"
  
  // Notification page
  | "today"
  | "earlier"
  | "dismiss"
  | "addToCalendar"
  
  // Other common phrases
  | "daysLeft"
  | "loading"
  | "error"
  | "retry"
  | "noItems"
  | "close";

export const translations: Record<Language, Record<TranslationKey, string>> = {
  en: {
    // App bar
  appTitle: "AiVersity",
    switchLanguage: "Switch Language",
    
    // Navigation
    home: "Home",
    chat: "Chat",
    documents: "Documents",
    map: "Map",
    notifications: "Alerts",
    
    // Home page
    welcome: "Welcome",
    importantDeadlines: "Important Deadlines",
    quickActions: "Quick Actions",
    askAssistant: "Ask Assistant",
    viewAllDeadlines: "View all deadlines",
    documentProgress: "Document Progress",
    requiredDocuments: "Required Documents",
    completed: "Completed",
    continueUploading: "Continue uploading",
    upcomingEvents: "Upcoming Events",
    viewOnMap: "View on map",
    
    // Chat page
    universityAssistant: "University Assistant",
    askMeAnything: "Ask me anything about university procedures",
    typeYourQuestion: "Type your question...",
    showOnMap: "Show on map",
    addToChecklist: "Add to document checklist",
    
    // Document page
    documentChecklist: "Document Checklist",
    uploadAndManage: "Upload and manage your required documents",
    uploadDocument: "Upload Document",
    viewDocument: "View Document",
    pending: "Pending",
    required: "Required",
    
    // Map page
    searchLocations: "Search locations, buildings, offices...",
    directions: "Directions",
    details: "Details",
    
    // Notification page
    today: "Today",
    earlier: "Earlier",
    dismiss: "Dismiss",
    addToCalendar: "Add to Calendar",
    
    // Other common phrases
    daysLeft: "days left",
    loading: "Loading...",
    error: "Something went wrong",
    retry: "Retry",
    noItems: "No items to display",
    close: "Close"
  },
  hu: {
    // App bar
    appTitle: "Nemzetközi Hallgatói Asszisztens",
    switchLanguage: "Nyelv váltása",
    
    // Navigation
    home: "Főoldal",
    chat: "Chat",
    documents: "Dokumentumok",
    map: "Térkép",
    notifications: "Értesítések",
    
    // Home page
    welcome: "Üdvözöljük",
    importantDeadlines: "Fontos határidők",
    quickActions: "Gyors műveletek",
    askAssistant: "Kérdezz az asszisztenstől",
    viewAllDeadlines: "Összes határidő megtekintése",
    documentProgress: "Dokumentum haladás",
    requiredDocuments: "Szükséges dokumentumok",
    completed: "Kész",
    continueUploading: "Feltöltés folytatása",
    upcomingEvents: "Közelgő események",
    viewOnMap: "Megtekintés a térképen",
    
    // Chat page
    universityAssistant: "Egyetemi Asszisztens",
    askMeAnything: "Kérdezz bármit az egyetemi eljárásokról",
    typeYourQuestion: "Írd be a kérdésed...",
    showOnMap: "Mutasd a térképen",
    addToChecklist: "Hozzáadás a dokumentum ellenőrzőlistához",
    
    // Document page
    documentChecklist: "Dokumentum ellenőrzőlista",
    uploadAndManage: "Töltsd fel és kezeld a szükséges dokumentumokat",
    uploadDocument: "Dokumentum feltöltése",
    viewDocument: "Dokumentum megtekintése",
    pending: "Függőben",
    required: "Szükséges",
    
    // Map page
    searchLocations: "Helyek, épületek, irodák keresése...",
    directions: "Útvonal",
    details: "Részletek",
    
    // Notification page
    today: "Ma",
    earlier: "Korábban",
    dismiss: "Elvetés",
    addToCalendar: "Hozzáadás a naptárhoz",
    
    // Other common phrases
    daysLeft: "nap van hátra",
    loading: "Betöltés...",
    error: "Valami hiba történt",
    retry: "Újra",
    noItems: "Nincs megjeleníthető elem",
    close: "Bezárás"
  }
};

// Helper function to translate text through the API
export async function translateServerSide(text: string, targetLanguage: Language): Promise<string> {
  try {
    const response = await apiRequest('POST', '/api/translate', {
      text,
      targetLanguage
    });
    const data = await response.json();
    return data.translatedText;
  } catch (error) {
    console.error("Translation error:", error);
    return text;
  }
}

export type TranslationContextType = {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
  translateText: (text: string, targetLanguage?: Language) => Promise<string>;
};

export const TranslationContext = createContext<TranslationContextType>({
  language: 'en',
  setLanguage: () => {},
  t: (key) => key,
  translateText: async (text) => text,
});

export const useTranslation = () => useContext(TranslationContext);
