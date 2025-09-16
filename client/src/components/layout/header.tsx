import { LogOut, User } from "lucide-react";
import { authService } from "@/lib/auth";
import { useState, useEffect } from "react";

export default function Header() {
  const [user, setUser] = useState(authService.getState().user);

  useEffect(() => {
    const unsubscribe = authService.subscribe((state) => {
      setUser(state.user);
    });
    return unsubscribe;
  }, []);

  const handleLogout = () => {
    authService.logout();
  };

  return (
    <header className="bg-card border-b border-border px-6 py-4" data-testid="header">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-primary-foreground text-lg">✂️</span>
          </div>
          <h1 className="text-xl font-semibold text-foreground">Beauty Scheduler</h1>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <User className="w-4 h-4" />
            <span data-testid="user-email">{user?.email}</span>
          </div>
          <button 
            onClick={handleLogout}
            className="text-muted-foreground hover:text-foreground transition-colors p-2"
            title="Sair"
            data-testid="button-logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
