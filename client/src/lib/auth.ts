interface User {
  id: string;
  email: string;
  role: string;
  name?: string;
  ownerName?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}

class AuthService {
  private state: AuthState = {
    user: null,
    token: localStorage.getItem('token'), // Usar 'token' ao invés de 'auth_token'
    isAuthenticated: !!localStorage.getItem('token'), // Set true if token exists
  };

  private listeners: Array<(state: AuthState) => void> = [];
  private isInitializing = false;

  constructor() {
    this.initializeAuth();
  }

  private async initializeAuth() {
    const token = localStorage.getItem('token'); // Usar 'token' ao invés de 'auth_token'
    if (token && !this.isInitializing) {
      this.isInitializing = true;
      try {
        const response = await fetch('/api/auth/verify', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const { user } = await response.json();
          this.state = {
            user,
            token,
            isAuthenticated: true,
          };
        } else {
          this.logout();
        }
      } catch (error) {
        this.logout();
      } finally {
        this.isInitializing = false;
      }
    }
    this.notifyListeners();
  }

  async login(email: string, password: string): Promise<{ success: boolean; error?: string; user?: User }> {
    try {
      console.log(`=== AUTH SERVICE LOGIN DEBUG ===`);
      console.log(`Attempting login for email: ${email}`);
      
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      console.log(`Login response status: ${response.status}`);
      
      const data = await response.json();
      console.log(`Login response data:`, data);

      if (response.ok) {
        console.log(`Login successful for user:`, data.user);
        console.log(`Token received: ${data.token ? 'YES' : 'NO'}`);
        
        localStorage.setItem('token', data.token); // Usar 'token' ao invés de 'auth_token'
        this.state = {
          user: data.user,
          token: data.token,
          isAuthenticated: true,
        };
        
        console.log(`Updated auth state:`, this.state);
        this.notifyListeners();
        console.log(`=== END AUTH LOGIN DEBUG (SUCCESS) ===`);
        return { success: true, user: data.user };
      } else {
        console.log(`Login failed: ${data.message}`);
        console.log(`=== END AUTH LOGIN DEBUG (FAILED) ===`);
        return { success: false, error: data.message };
      }
    } catch (error) {
      console.error('Login error:', error);
      console.log(`=== END AUTH LOGIN DEBUG (ERROR) ===`);
      return { success: false, error: 'Erro de conexão' };
    }
  }

  logout() {
    localStorage.removeItem('token'); // Usar 'token' ao invés de 'auth_token'
    
    // Clear ALL localStorage to prevent any data leakage
    localStorage.clear();
    
    this.state = {
      user: null,
      token: null,
      isAuthenticated: false,
    };
    this.notifyListeners();
    
    // Clear any cached data when user logs out to prevent data leakage
    if (typeof window !== 'undefined' && window.location) {
      // Force hard refresh to clear all caches
      window.location.replace('/login');
    }
  }

  getState(): AuthState {
    return { ...this.state };
  }

  subscribe(listener: (state: AuthState) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.state));
  }

  getAuthHeaders(): Record<string, string> {
    return this.state.token ? { 'Authorization': `Bearer ${this.state.token}` } : {};
  }
}

export const authService = new AuthService();