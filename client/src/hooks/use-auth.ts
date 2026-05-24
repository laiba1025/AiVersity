import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/queryClient';

export interface AuthState {
  isAuthenticated: boolean;
  username: string | null;
  token: string | null;
}

export const useAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    username: null,
    token: null
  });

  // Load auth state from localStorage on mount
  useEffect(() => {
    const savedAuth = localStorage.getItem('authState');
    if (savedAuth) {
      setAuthState(JSON.parse(savedAuth));
    }
  }, []);

  // Save auth state to localStorage whenever it changes
  useEffect(() => {
    if (authState.isAuthenticated) {
      localStorage.setItem('authState', JSON.stringify(authState));
    } else {
      localStorage.removeItem('authState');
    }
  }, [authState]);

  const login = async (username: string, password: string) => {
    try {
      const response = await apiRequest('POST', '/api/auth/login', {
        username,
        password
      });
      const data = await response.json();
      
      setAuthState({
        isAuthenticated: true,
        username: data.username,
        token: data.token
      });
      
      return { success: true };
    } catch (error) {
      console.error('Login failed:', error);
      return { success: false, error: 'Login failed' };
    }
  };

  const logout = () => {
    setAuthState({
      isAuthenticated: false,
      username: null,
      token: null
    });
  };

  return {
    ...authState,
    login,
    logout
  };
};