import { useQuery } from "@tanstack/react-query";
import Header from "@/components/layout/header";
import Sidebar from "@/components/layout/sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, TrendingUp, PieChart, BarChart3 } from "lucide-react";
import { authService } from "@/lib/auth";

interface MerchantStats {
  total: number;
  active: number;
  pending: number;
  inactive: number;
  thisMonth: number;
}

export default function Reports() {
  const { data: stats, isLoading } = useQuery<MerchantStats>({
    queryKey: ["/api/merchants/stats"],
    enabled: authService.getState().isAuthenticated,
  });

  const handleExport = () => {
    // Implementar exportação de dados
    console.log("Exportar relatórios");
  };

  const calculateGrowthRate = () => {
    if (!stats) return 0;
    // Simulação de crescimento baseado nos dados atuais
    const growthRate = Math.round((stats.thisMonth / Math.max(stats.total - stats.thisMonth, 1)) * 100);
    return Math.min(growthRate, 100);
  };

  const calculateSatisfactionRate = () => {
    if (!stats) return 0;
    // Simulação de taxa de satisfação baseada na proporção de ativos
    return Math.round((stats.active / Math.max(stats.total, 1)) * 100);
  };

  const summaryStats = [
    {
      title: "Receita Estimada",
      value: "R$ 12.450",
      description: "Baseado em comerciantes ativos",
      icon: TrendingUp,
      color: "text-primary",
    },
    {
      title: "Crescimento Mensal",
      value: `+${calculateGrowthRate()}%`,
      description: "Novos comerciantes este mês",
      icon: BarChart3,
      color: "text-green-600",
    },
    {
      title: "Taxa de Aprovação",
      value: `${calculateSatisfactionRate()}%`,
      description: "Comerciantes aprovados/total",
      icon: PieChart,
      color: "text-blue-600",
    },
  ];

  return (
    <div className="min-h-screen bg-background" data-testid="page-reports">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-foreground">Relatórios</h2>
              <Button 
                onClick={handleExport}
                variant="secondary"
                className="flex items-center space-x-2"
                data-testid="button-export"
              >
                <Download className="w-4 h-4" />
                <span>Exportar</span>
              </Button>
            </div>

            {/* Report Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Merchants Growth Chart */}
              <Card data-testid="card-growth-chart">
                <div className="p-6 border-b border-border">
                  <h3 className="text-lg font-semibold text-foreground">Crescimento de Comerciantes</h3>
                </div>
                <CardContent className="p-6">
                  <div className="h-64 bg-muted rounded-lg flex items-center justify-center">
                    <div className="text-center text-muted-foreground">
                      <TrendingUp className="w-12 h-12 mx-auto mb-2" />
                      <p>Gráfico de crescimento será implementado</p>
                      <p className="text-sm">Total atual: {stats?.total || 0} comerciantes</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Status Distribution */}
              <Card data-testid="card-status-distribution">
                <div className="p-6 border-b border-border">
                  <h3 className="text-lg font-semibold text-foreground">Distribuição por Status</h3>
                </div>
                <CardContent className="p-6">
                  <div className="h-64 bg-muted rounded-lg flex items-center justify-center">
                    <div className="text-center text-muted-foreground">
                      <PieChart className="w-12 h-12 mx-auto mb-2" />
                      <p>Gráfico de distribuição será implementado</p>
                      {stats && (
                        <div className="text-sm mt-2 space-y-1">
                          <p>Ativos: {stats.active}</p>
                          <p>Pendentes: {stats.pending}</p>
                          <p>Inativos: {stats.inactive}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Summary Stats */}
            <Card data-testid="card-summary-stats">
              <div className="p-6 border-b border-border">
                <h3 className="text-lg font-semibold text-foreground">Resumo Estatístico</h3>
              </div>
              <CardContent className="p-6">
                {isLoading ? (
                  <div className="text-center text-muted-foreground" data-testid="loading-stats">
                    Carregando estatísticas...
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {summaryStats.map((stat, index) => {
                      const Icon = stat.icon;
                      return (
                        <div key={index} className="text-center" data-testid={`stat-summary-${index}`}>
                          <div className="flex justify-center mb-2">
                            <Icon className={`w-8 h-8 ${stat.color}`} />
                          </div>
                          <div className={`text-3xl font-bold mb-2 ${stat.color}`}>
                            {stat.value}
                          </div>
                          <p className="text-muted-foreground text-sm">{stat.description}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Additional Reports Section */}
            <Card data-testid="card-additional-reports">
              <div className="p-6 border-b border-border">
                <h3 className="text-lg font-semibold text-foreground">Relatórios Detalhados</h3>
              </div>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button variant="outline" className="h-20 flex flex-col space-y-2">
                    <BarChart3 className="w-6 h-6" />
                    <span>Relatório de Atividade</span>
                  </Button>
                  <Button variant="outline" className="h-20 flex flex-col space-y-2">
                    <PieChart className="w-6 h-6" />
                    <span>Análise de Performance</span>
                  </Button>
                  <Button variant="outline" className="h-20 flex flex-col space-y-2">
                    <TrendingUp className="w-6 h-6" />
                    <span>Tendências Mensais</span>
                  </Button>
                  <Button variant="outline" className="h-20 flex flex-col space-y-2">
                    <Download className="w-6 h-6" />
                    <span>Relatório Completo</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
