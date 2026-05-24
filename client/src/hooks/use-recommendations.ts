import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export type Recommendation = {
  id: number;
  code: string;
  title: string;
  credits: number;
  required: boolean;
  elective: boolean;
  semester: number | null;
  reason: string;
};

export const useRecommendations = () => {
  const [program, setProgram] = useState<string>('AI MSc');
  const [maxCredits, setMaxCredits] = useState<number>(18);
  const [preferElectives, setPreferElectives] = useState<boolean>(false);

  const [results, setResults] = useState<{ recommendations: Recommendation[]; totalCredits: number }>({ recommendations: [], totalCredits: 0 });

  const { mutateAsync, isPending, error } = useMutation({
    mutationFn: async () => {
      const resp = await apiRequest('POST', '/api/recommendations', { program, maxCredits, preferElectives });
      return resp.json() as Promise<{ recommendations: Recommendation[]; totalCredits: number }>;
    },
    onSuccess: (data) => {
      setResults({ recommendations: data.recommendations, totalCredits: data.totalCredits });
    }
  });

  const run = async () => {
    await mutateAsync();
  };

  return {
    program,
    setProgram,
    maxCredits,
    setMaxCredits,
    preferElectives,
    setPreferElectives,
    run,
    isLoading: isPending,
    error,
    results
  };
};
