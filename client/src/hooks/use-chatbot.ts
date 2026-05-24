import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useTranslation } from '@/lib/translations';
import { Message } from '@shared/schema';

export interface UseChatbotResult {
  messages: Message[];
  isLoading: boolean;
  error: unknown;
  userInput: string;
  setUserInput: (v: string) => void;
  sendMessage: () => Promise<void>;
  isSending: boolean;
}

export const useChatbot = (): UseChatbotResult => { 
  const [userInput, setUserInput] = useState('');
  const { language } = useTranslation();
  const queryClient = useQueryClient();

  // Fetch chat history
  const { data: messages, isLoading, error } = useQuery<Message[]>({
    queryKey: ['/api/messages'],
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await apiRequest('POST', '/api/messages', { content });
      return response.json(); // expecting Message[]
    },
    onSuccess: (_newMessages: Message[]) => {
      // Refetch chat history after sending a message
      queryClient.invalidateQueries({ queryKey: ['/api/messages'] });
    },
    onError: (err: unknown) => {
      console.error('Failed to send message:', err as any);
    }
  });

  // Trigger sending a message
  const sendMessage = async () => {
    if (!userInput.trim()) return;
    const content = userInput;
    setUserInput('');
    await sendMessageMutation.mutateAsync(content);
  };

  return {
  messages: messages ?? [],
    isLoading,
    error,
    userInput,
    setUserInput,
    sendMessage,
    isSending: sendMessageMutation.isPending
  };
};
