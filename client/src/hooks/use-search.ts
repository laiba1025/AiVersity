import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

export type PolicyResult = { snippet: string; source?: string; page?: number; score?: number };
export type ContactResult = {
  id: number;
  name: string;
  department: string;
  role: string;
  email: string;
  phone?: string;
  office?: string;
  officeHours?: string;
  tags?: string[];
  locationId?: number | null;
};

export const useSearch = () => {
  const [query, setQuery] = useState("");

  const { data, isLoading, error, refetch } = useQuery<{ policies: PolicyResult[]; contacts: ContactResult[] } | undefined>({
    queryKey: ['/api/search', query],
    enabled: false,
    queryFn: async () => {
      const r = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      if (!r.ok) throw new Error('Search failed');
      return r.json();
    }
  });

  // Default content: lightweight policies list (client-side curated) and informatics contacts from backend
  const defaultContactsQuery = useQuery<ContactResult[]>({
    queryKey: ['/api/contacts'],
    queryFn: async () => {
      const r = await fetch('/api/contacts');
      if (!r.ok) throw new Error('Failed to load contacts');
      return r.json();
    },
    staleTime: 60_000,
  });

  const defaultPolicies: PolicyResult[] = useMemo(() => ([
    { snippet: 'Student Code of Conduct — Expectations for respectful behavior, classroom etiquette, and use of university resources.' },
    { snippet: 'Academic Integrity Policy — Rules on plagiarism, use of AI tools, citation requirements, and consequences of misconduct.' },
    { snippet: 'Assessment & Retake Policy — Exam formats, grading scales, retake eligibility, and deadline extensions.' },
    { snippet: 'Attendance & Participation — Minimum attendance for labs/seminars and procedures for justified absences.' },
    { snippet: 'Thesis & Project Guidelines — Topic selection, supervision, formatting, and submission/defense timelines.' },
  ]), []);

  const defaultContacts: ContactResult[] = useMemo(() => {
    const all = defaultContactsQuery.data ?? [];
    // Heuristic filter for Informatics-related people/departments
    return all.filter(c => /informatics|computer|it/i.test(`${c.department} ${c.role}`)).slice(0, 6);
  }, [defaultContactsQuery.data]);

  const search = async () => {
    if (!query.trim()) return;
    await refetch();
  };

  const results = data ?? { policies: defaultPolicies, contacts: defaultContacts };

  return {
    query,
    setQuery,
    results,
    isLoading: isLoading || defaultContactsQuery.isLoading,
    error,
    search
  };
};
