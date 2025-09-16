import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import Header from "@/components/layout/header";
import Sidebar from "@/components/layout/sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Store, CheckCircle, PlusCircle, Clock } from "lucide-react";
import { authService } from "@/lib/auth";
import ChangePasswordForm from "@/components/auth/change-password-form";

interface MerchantStats {
  total: number;
  active: number;
  pending: number;
  inactive: number;
  thisMonth: number;
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const [user, setUser] = useState(authService.getState().user);

  // Role guard - redirect non-admin users to their appropriate dashboards
  useEffect(() => {
    const unsubscribe = authService.subscribe((state) => {
      setUser(state.user);
      
      // Redirect non-admin users to their appropriate dashboards
      if (state.user?.role === "merchant") {
        setLocation("/merchant-dashboard");
      } else if (state.user?.role === "employee") {
        setLocation("/employee-dashboard");
      }
    });
    return unsubscribe;
  }, [setLocation]);

  // Check on component mount as well
  useEffect(() => {
    const currentUser = authService.getState().user;
    if (currentUser?.role === "merchant") {
      setLocation("/merchant-dashboard");
    } else if (currentUser?.role === "employee") {
      setLocation("/employee-dashboard");
    }
  }, [setLocation]);

  const { data: stats, isLoading } = useQuery<MerchantStats>({
    queryKey: ["/api/merchants/stats"],
    enabled: authService.getState().isAuthenticated && (!user || user.role === "admin"),
  });

  const formatDate = () => {
    return new Date().toLocaleString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const statsCards = [
    {
      title: "Total de Comerciantes",
      value: stats?.total || 0,
      icon: Store,
      color: "bg-primary/10 text-primary",
    },
    {
      title: "Comerciantes Ativos",
      value: stats?.active || 0,
      icon: CheckCircle,
      color: "bg-green-100 text-green-600",
    },
    {
      title: "Novos Este Mês",
      value: stats?.thisMonth || 0,
      icon: PlusCircle,
      color: "bg-blue-100 text-blue-600",
    },
    {
      title: "Pendentes",
      value: stats?.pending || 0,
      icon: Clock,
      color: "bg-yellow-100 text-yellow-600",
    },
  ];

  return (
    <div className="min-h-screen bg-background" data-testid="page-dashboard">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-foreground">Dashboard</h2>
              <div className="text-sm text-muted-foreground">
                Última atualização: <span data-testid="text-last-update">{formatDate()}</span>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {statsCards.map((stat, index) => {
                const Icon = stat.icon;
                return (
                  <Card key={index} data-testid={`card-stat-${index}`}>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">{stat.title}</p>
                          <p className="text-2xl font-bold text-foreground" data-testid={`stat-value-${index}`}>
                            {isLoading ? "-" : stat.value}
                          </p>
                        </div>
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${stat.color}`}>
                          <Icon className="w-6 h-6" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Recent Activity */}
            <Card>
              <div className="p-6 border-b border-border">
                <h3 className="text-lg font-semibold text-foreground">Atividade Recente</h3>
              </div>
              <CardContent className="p-6">
                {isLoading ? (
                  <div className="text-center text-muted-foreground" data-testid="loading-activity">
                    Carregando atividades...
                  </div>
                ) : (
                  <div className="space-y-4" data-testid="activity-list">
                    <div className="flex items-center space-x-4">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <div className="flex-1">
                        <p className="text-sm text-foreground">
                          Sistema iniciado com <strong>{stats?.total || 0} comerciantes</strong> cadastrados
                        </p>
                        <p className="text-xs text-muted-foreground">Agora</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <div className="flex-1">
                        <p className="text-sm text-foreground">
                          <strong>{stats?.active || 0} comerciantes ativos</strong> no sistema
                        </p>
                        <p className="text-xs text-muted-foreground">Agora</p>
                      </div>
                    </div>
                    {(stats?.pending || 0) > 0 && (
                      <div className="flex items-center space-x-4">
                        <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                        <div className="flex-1">
                          <p className="text-sm text-foreground">
                            <strong>{stats?.pending} comerciantes</strong> aguardando aprovação
                          </p>
                          <p className="text-xs text-muted-foreground">Agora</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Account Settings */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-4">Configurações da Conta</h3>
                <ChangePasswordForm />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
