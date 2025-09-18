
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import Header from "@/components/layout/header";
import Sidebar from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, DollarSign, Users, AlertCircle, Clock, CheckCircle2, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { authService } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface Merchant {
  id: string;
  name: string;
  ownerName: string;
  email: string;
  phone: string;
  status: string;
  accessStartDate?: string;
  accessEndDate?: string;
  accessDurationDays?: number;
  monthlyFee?: number;
  paymentStatus?: string;
  lastPaymentDate?: string;
  nextPaymentDue?: string;
  createdAt: string;
}

interface AccessStats {
  active: number;
  expired: number;
  paymentPending: number;
  totalRevenue: number;
}

export default function MerchantAccess() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMerchant, setSelectedMerchant] = useState<Merchant | null>(null);
  const [isAccessModalOpen, setIsAccessModalOpen] = useState(false);
  const [accessForm, setAccessForm] = useState({
    durationDays: 30,
    monthlyFee: 5000, // R$ 50.00 in cents
  });
  const { toast } = useToast();

  // Get all merchants
  const { data: merchants = [], isLoading } = useQuery<Merchant[]>({
    queryKey: ["/api/merchants"],
    enabled: authService.getState().isAuthenticated,
  });

  // Get merchant stats including access stats
  const { data: stats } = useQuery<{
    total: number;
    active: number;
    pending: number;
    inactive: number;
    thisMonth: number;
    access: AccessStats;
  }>({
    queryKey: ["/api/merchants/stats"],
    enabled: authService.getState().isAuthenticated,
  });

  // Grant access mutation
  const grantAccessMutation = useMutation({
    mutationFn: async ({ merchantId, durationDays, monthlyFee }: { merchantId: string; durationDays: number; monthlyFee: number }) => {
      const response = await apiRequest("POST", `/api/admin/merchants/${merchantId}/grant-access`, {
        durationDays,
        monthlyFee,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/merchants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/merchants/stats"] });
      setIsAccessModalOpen(false);
      setSelectedMerchant(null);
      toast({
        title: "Acesso concedido!",
        description: "O acesso foi concedido com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao conceder acesso",
        description: error.message || "Ocorreu um erro inesperado",
        variant: "destructive",
      });
    },
  });

  // Suspend access mutation
  const suspendAccessMutation = useMutation({
    mutationFn: async (merchantId: string) => {
      const response = await apiRequest("POST", `/api/admin/merchants/${merchantId}/suspend-access`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/merchants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/merchants/stats"] });
      toast({
        title: "Acesso suspenso!",
        description: "O acesso foi suspenso com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao suspender acesso",
        description: error.message || "Ocorreu um erro inesperado",
        variant: "destructive",
      });
    },
  });

  // Renew access mutation
  const renewAccessMutation = useMutation({
    mutationFn: async (merchantId: string) => {
      const response = await apiRequest("POST", `/api/admin/merchants/${merchantId}/renew-access`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/merchants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/merchants/stats"] });
      toast({
        title: "Acesso renovado!",
        description: "O acesso foi renovado com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao renovar acesso",
        description: error.message || "Ocorreu um erro inesperado",
        variant: "destructive",
      });
    },
  });

  const filteredMerchants = merchants.filter((merchant) =>
    merchant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    merchant.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    merchant.ownerName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (merchant: Merchant) => {
    if (merchant.status === "active") {
      if (merchant.accessEndDate) {
        const now = new Date();
        const endDate = new Date(merchant.accessEndDate);
        if (endDate <= now) {
          return <Badge variant="destructive">Expirado</Badge>;
        }
        const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (daysLeft <= 7) {
          return <Badge className="bg-orange-100 text-orange-800">Expira em {daysLeft} dias</Badge>;
        }
        return <Badge className="bg-green-100 text-green-800">Ativo ({daysLeft} dias)</Badge>;
      }
      return <Badge className="bg-green-100 text-green-800">Ativo</Badge>;
    }
    
    if (merchant.status === "payment_pending") {
      return <Badge variant="destructive">Pagamento Pendente</Badge>;
    }
    
    if (merchant.status === "pending") {
      return <Badge className="bg-yellow-100 text-yellow-800">Aguardando Aprovação</Badge>;
    }
    
    return <Badge variant="secondary">{merchant.status}</Badge>;
  };

  const formatDate = (date: string | undefined) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("pt-BR");
  };

  const formatCurrency = (cents: number | undefined) => {
    if (!cents) return "-";
    return (cents / 100).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  };

  const handleGrantAccess = (merchant: Merchant) => {
    setSelectedMerchant(merchant);
    setAccessForm({
      durationDays: merchant.accessDurationDays || 30,
      monthlyFee: merchant.monthlyFee || 5000,
    });
    setIsAccessModalOpen(true);
  };

  const handleSubmitAccess = () => {
    if (!selectedMerchant) return;
    
    grantAccessMutation.mutate({
      merchantId: selectedMerchant.id,
      durationDays: accessForm.durationDays,
      monthlyFee: accessForm.monthlyFee,
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-6">
            <div className="text-center">Carregando...</div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-foreground">Gerenciar Acesso dos Comerciantes</h2>
            </div>

            {/* Stats Cards */}
            {stats?.access && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Ativos</CardTitle>
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">{stats.access.active}</div>
                    <p className="text-xs text-muted-foreground">Comerciantes com acesso ativo</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Expirados</CardTitle>
                    <XCircle className="h-4 w-4 text-red-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">{stats.access.expired}</div>
                    <p className="text-xs text-muted-foreground">Comerciantes com acesso expirado</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Pagamento Pendente</CardTitle>
                    <AlertCircle className="h-4 w-4 text-orange-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-orange-600">{stats.access.paymentPending}</div>
                    <p className="text-xs text-muted-foreground">Aguardando pagamento</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
                    <DollarSign className="h-4 w-4 text-blue-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600">
                      {formatCurrency(stats.access.totalRevenue)}
                    </div>
                    <p className="text-xs text-muted-foreground">Receita dos pagamentos</p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Search */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center space-x-2">
                  <Label htmlFor="search">Buscar comerciantes:</Label>
                  <Input
                    id="search"
                    type="text"
                    placeholder="Nome, email ou proprietário..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="max-w-md"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Merchants Table */}
            <Card>
              <CardHeader>
                <CardTitle>Comerciantes ({filteredMerchants.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2">Comerciante</th>
                        <th className="text-left py-2">Status</th>
                        <th className="text-left py-2">Acesso</th>
                        <th className="text-left py-2">Mensalidade</th>
                        <th className="text-left py-2">Último Pagamento</th>
                        <th className="text-left py-2">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMerchants.map((merchant) => (
                        <tr key={merchant.id} className="border-b hover:bg-muted/50">
                          <td className="py-3">
                            <div>
                              <div className="font-medium">{merchant.name}</div>
                              <div className="text-sm text-muted-foreground">{merchant.ownerName}</div>
                              <div className="text-xs text-muted-foreground">{merchant.email}</div>
                            </div>
                          </td>
                          <td className="py-3">{getStatusBadge(merchant)}</td>
                          <td className="py-3">
                            <div className="text-sm">
                              <div>Início: {formatDate(merchant.accessStartDate)}</div>
                              <div>Fim: {formatDate(merchant.accessEndDate)}</div>
                              <div className="text-xs text-muted-foreground">
                                {merchant.accessDurationDays} dias
                              </div>
                            </div>
                          </td>
                          <td className="py-3">
                            <div className="font-medium">{formatCurrency(merchant.monthlyFee)}</div>
                            <Badge variant={
                              merchant.paymentStatus === "paid" ? "default" : 
                              merchant.paymentStatus === "trial" ? "secondary" : 
                              "destructive"
                            } className="text-xs">
                              {merchant.paymentStatus === "paid" ? "Pago" : 
                               merchant.paymentStatus === "trial" ? "Teste Grátis" : 
                               "Pendente"}
                            </Badge>
                          </td>
                          <td className="py-3">
                            <div className="text-sm">
                              {formatDate(merchant.lastPaymentDate)}
                            </div>
                          </td>
                          <td className="py-3">
                            <div className="flex space-x-2">
                              {(merchant.status === "pending" || merchant.status === "payment_pending") && (
                                <Button
                                  size="sm"
                                  onClick={() => handleGrantAccess(merchant)}
                                  disabled={grantAccessMutation.isPending}
                                >
                                  Conceder Acesso
                                </Button>
                              )}
                              
                              {merchant.status === "active" && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => renewAccessMutation.mutate(merchant.id)}
                                    disabled={renewAccessMutation.isPending}
                                  >
                                    Renovar
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => suspendAccessMutation.mutate(merchant.id)}
                                    disabled={suspendAccessMutation.isPending}
                                  >
                                    Suspender
                                  </Button>
                                </>
                              )}
                              
                              {merchant.status === "payment_pending" && (
                                <Button
                                  size="sm"
                                  onClick={() => renewAccessMutation.mutate(merchant.id)}
                                  disabled={renewAccessMutation.isPending}
                                >
                                  Renovar Acesso
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>

      {/* Grant Access Modal */}
      <Dialog open={isAccessModalOpen} onOpenChange={setIsAccessModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conceder Acesso - {selectedMerchant?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="duration">Duração do Acesso (dias)</Label>
              <Input
                id="duration"
                type="number"
                min="1"
                value={accessForm.durationDays}
                onChange={(e) => setAccessForm({ ...accessForm, durationDays: parseInt(e.target.value) || 30 })}
              />
            </div>
            
            <div>
              <Label htmlFor="fee">Taxa Mensal (R$)</Label>
              <Input
                id="fee"
                type="number"
                step="0.01"
                min="0"
                value={accessForm.monthlyFee / 100}
                onChange={(e) => setAccessForm({ ...accessForm, monthlyFee: Math.round(parseFloat(e.target.value) * 100) || 5000 })}
              />
              <div className="text-sm text-muted-foreground mt-1">
                Valor em reais (ex: 50.00)
              </div>
            </div>

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsAccessModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleSubmitAccess}
                disabled={grantAccessMutation.isPending}
              >
                {grantAccessMutation.isPending ? "Concedendo..." : "Conceder Acesso"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
