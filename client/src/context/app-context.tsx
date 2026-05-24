import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { TranslationContext, Language, translations, TranslationKey, translateServerSide } from "@/lib/translations";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Types for user context
interface User {
  id: number;
  username: string;
  fullName: string;
  language: Language;
  // Optional student profile fields (may be present from /api/user)
  program?: string;
  major?: string;
  currentSemester?: number;
  // local-only fallback flag
  localOnly?: boolean;
}

interface AppContextType {
  user: User | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

const AppContext = createContext<AppContextType>({
  user: null,
  isLoading: false,
  login: async () => {},
  logout: async () => {},
  isAuthenticated: false,
});

export const useApp = () => useContext(AppContext);

interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider = ({ children }: AppProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [language, setLanguage] = useState<Language>('en');
  const { toast } = useToast();

  // Fetch user data on init
  const userQuery = useQuery<User>({
    queryKey: ['/api/user'],
    retry: false,
  });

  useEffect(() => {
    if (userQuery.data) {
      setUser(userQuery.data);
      setLanguage(userQuery.data.language as Language);
    }
    // If fetching /api/user failed, don't clobber a local-only user — allow offline demo users
    if (userQuery.isError) {
      setUser(prev => (prev && prev.localOnly ? prev : null));
    }
  }, [userQuery.data, userQuery.isError]);

  // Attempt to auto-login a remembered local user (demo-only) when no server session exists
  useEffect(() => {
    (async () => {
      if (user) return; // already authenticated
      if (userQuery.isLoading) return; // wait until /api/user resolved
      try {
        const { getCurrentLocalCredentials, localUserStore } = await import('@/lib/localUserStore');
        const creds = getCurrentLocalCredentials();
        if (creds && creds.username && creds.password) {
          const lu = await localUserStore.authenticate(creds.username, creds.password);
          if (lu) {
            setUser({
              id: -1,
              username: lu.username,
              fullName: lu.fullName || lu.username,
              language: (lu.language as Language) || 'en',
              program: lu.profile?.program,
              major: lu.profile?.major,
              currentSemester: lu.profile?.currentSemester,
              localOnly: true,
            });
            toast({ title: 'Offline', description: 'Restored local session' });
          }
        }
      } catch (e) {
        // ignore
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userQuery.isLoading]);

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: async (credentials: { username: string; password: string }) => {
      const response = await apiRequest('POST', '/api/auth/login', credentials);
      return response.json();
    },
    onSuccess: (userData: User) => {
      setUser(userData);
      setLanguage(userData.language as Language);
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      toast({
        title: "Success",
        description: "Successfully logged in",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: "Failed to login. Please check your credentials.",
        variant: "destructive",
      });
    }
  });

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/auth/logout', {});
      return response.json();
    },
    onSuccess: () => {
      setUser(null);
      queryClient.invalidateQueries();
      toast({
        title: "Success",
        description: "Successfully logged out",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to logout",
        variant: "destructive",
      });
    }
  });

  // Update user language mutation
  const updateLanguageMutation = useMutation({
    mutationFn: async (newLanguage: Language) => {
      const response = await apiRequest('PATCH', '/api/user/language', { language: newLanguage });
      return response.json();
    },
    onSuccess: (userData: User) => {
      setUser(userData);
      setLanguage(userData.language as Language);
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update language preference",
        variant: "destructive",
      });
    }
  });

  // Handle language change
  const handleLanguageChange = (newLanguage: Language) => {
    setLanguage(newLanguage);
    if (user) {
      updateLanguageMutation.mutate(newLanguage);
    }
  };

  // Translation function
  const t = (key: TranslationKey): string => {
    return translations[language][key] || key;
  };

  // Dynamic text translation
  const translateText = async (text: string, targetLanguage?: Language): Promise<string> => {
    if (!text) return '';
    const target = targetLanguage || language;
    return translateServerSide(text, target);
  };

  // Auth functions
  const login = async (username: string, password: string) => {
    try {
      await loginMutation.mutateAsync({ username, password });
      return;
    } catch (e) {
      // server login failed — try local fallback
      try {
        const { localUserStore } = await import('@/lib/localUserStore');
        const lu = await localUserStore.authenticate(username, password);
        if (lu) {
          setUser({
            id: -1,
            username: lu.username,
            fullName: lu.fullName || lu.username,
            language: (lu.language as Language) || 'en',
            program: lu.profile?.program,
            major: lu.profile?.major,
            currentSemester: lu.profile?.currentSemester,
            localOnly: true,
          });
          toast({ title: 'Offline', description: 'Logged in locally (no server session)' });
          return;
        }
      } catch (ee) {
        // swallow
      }
      throw e;
    }
  };

  const logout = async () => {
    try {
      // if this is a server-backed session, attempt server logout
      if (user && !user.localOnly) {
        await logoutMutation.mutateAsync();
      }
    } catch (e) {
      // ignore logout errors
    } finally {
      setUser(null);
      queryClient.invalidateQueries();
    }
  };

  // For simplicity in this demo, we're auto-logging in
  // NOTE: removed automatic demo login so the app shows the unauthenticated
  // UI (register/login) by default. If you want to auto-login in dev,
  // re-enable the block below.
  /*
  useEffect(() => {
    if (!user && !userQuery.isLoading) {
      login("maria", "password123");
    }
  }, [user, userQuery.isLoading]);
  */

  // If running in a developer environment, auto-login a demo user so
  // dev-only API calls (chat, recommendations) don't get 401 Not Authenticated.
  // This keeps the dev experience smooth while preserving production behavior.
  useEffect(() => {
    // Developer auto-login only when explicitly enabled via VITE_AUTO_LOGIN=true
    // This avoids overriding a real user's session on reload (e.g., your 'laiba' login).
    const autoLoginEnabled = String(import.meta.env.VITE_AUTO_LOGIN || '').toLowerCase() === 'true';
    if (import.meta.env.DEV && autoLoginEnabled) {
      if (!user && !userQuery.isLoading) {
        // Best-effort login; swallow errors to avoid spamming the UI
        login("maria", "password123").catch(() => {});
      }
    }
  }, [user, userQuery.isLoading]);

  const appContextValue: AppContextType = {
    user,
    isLoading: userQuery.isLoading || loginMutation.isPending || logoutMutation.isPending,
    login,
    logout,
    isAuthenticated: !!user,
  };

  const translationContextValue = {
    language,
    setLanguage: handleLanguageChange,
    t,
    translateText,
  };

  return (
    <AppContext.Provider value={appContextValue}>
      <TranslationContext.Provider value={translationContextValue}>
        {children}
      </TranslationContext.Provider>
    </AppContext.Provider>
  );
};
