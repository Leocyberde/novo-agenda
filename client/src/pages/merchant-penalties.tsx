
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, DollarSign, User, Calendar, Phone, Mail, CheckCircle, XCircle, FileText, Clock } from "lucide-react";
import { authService } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Penalty {
  id: string;
  merchantId: string;
  clientId: string | null;
  appointmentId: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string | null;
  type: string;
  amount: number;
  reason: string;
  status: string;
  paidAt: string | null;
  paidBy: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PenaltyWithDetails extends Penalty {
  serviceName?: string;
  servicePrice?: number;
  employeeName?: string;
  appointmentDate?: string;
  appointmentTime?: string;
}

export default function MerchantPenalties() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const user = authService.getState().user;

  if (!user || user.role !== "merchant") {
    setLocation("/login");
    return null;
  }

  // Fetch penalties
  const { data: penalties = [], isLoading, error } = useQuery<PenaltyWithDetails[]>({
    queryKey: ["/api/merchant/penalties"],
    queryFn: async () => {
      const response = await fetch("/api/merchant/penalties", {
        headers: {
          "Authorization": `Bearer ${authService.getState().token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Erro ao buscar multas");
      }

      const penaltiesData = await response.json();

      // Enrich with appointment details
      const enrichedPenalties = await Promise.all(
        penaltiesData.map(async (penalty: Penalty) => {
          try {
            // Get appointment details
            const appointmentResponse = await fetch(`/api/appointments/${penalty.appointmentId}`, {
              headers: {
                "Authorization": `Bearer ${authService.getState().token}`,
              },
            });

            if (appointmentResponse.ok) {
              const appointment = await appointmentResponse.json();
              
              // Get service details
              let serviceName = null;
              let servicePrice = null;
              if (appointment.serviceId) {
                const serviceResponse = await fetch(`/api/services`, {
                  headers: {
                    "Authorization": `Bearer ${authService.getState().token}`,
                  },
                });

                if (serviceResponse.ok) {
                  const services = await serviceResponse.json();
                  const service = services.find((s: any) => s.id === appointment.serviceId);
                  if (service) {
                    serviceName = service.name;
                    servicePrice = service.price;
                  }
                }
              }

              // Get employee details
              let employeeName = null;
              if (appointment.employeeId) {
                const employeeResponse = await fetch(`/api/employees`, {
                  headers: {
                    "Authorization": `Bearer ${authService.getState().token}`,
                  },
                });

                if (employeeResponse.ok) {
                  const employees = await employeeResponse.json();
                  const employee = employees.find((e: any) => e.id === appointment.employeeId);
                  if (employee) {
                    employeeName = employee.name;
                  }
                }
              }

              return {
                ...penalty,
                serviceName,
                servicePrice,
                employeeName,
                appointmentDate: appointment.appointmentDate,
                appointmentTime: appointment.appointmentTime,
              };
            }
          } catch (error) {
            console.error("Error enriching penalty:", error);
          }
          return penalty;
        })
      );

      return enrichedPenalties;
    },
    enabled: !!user && user.role === "merchant",
  });

  // Update penalty status mutation
  const updatePenaltyMutation = useMutation({
    mutationFn: async ({ penaltyId, status }: { penaltyId: string; status: string }) => {
      const response = await fetch(`/api/penalties/${penaltyId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authService.getState().token}`,
        },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        throw new Error("Erro ao atualizar status da multa");
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      // Force refetch of penalties data for merchant
      queryClient.invalidateQueries({ queryKey: ["/api/merchant/penalties"] });
      queryClient.refetchQueries({ queryKey: ["/api/merchant/penalties"] });
      
      // Also invalidate client penalties cache so clients see updates immediately
      queryClient.invalidateQueries({ queryKey: ["/api/client/penalties"] });
      
      toast({
        title: "Status atualizado",
        description: variables.status === "paid" ? "Multa marcada como paga" : "Multa dispensada",
      });
    },
    onError: (error: any) => {
      console.error("Error updating penalty:", error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar status da multa",
        variant: "destructive",
      });
    },
  });

  // Filter penalties
  const filteredPenalties = penalties.filter(penalty => {
    if (statusFilter === "all") return true;
    return penalty.status === statusFilter;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge className="bg-yellow-100 text-yellow-800">Pendente</Badge>;
      case "paid":
        return <Badge className="bg-green-100 text-green-800">Pago</Badge>;
      case "waived":
        return <Badge className="bg-blue-100 text-blue-800">Dispensado</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatCurrency = (amount: number) => {
    return (amount / 100).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };

  const formatAppointmentDate = (dateString: string) => {
    return format(new Date(dateString + 'T00:00:00'), "dd/MM/yyyy", { locale: ptBR });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-8">
            <p className="text-muted-foreground">Carregando multas...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-8">
            <p className="text-destructive">Erro ao carregar multas</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-border">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                onClick={() => setLocation("/merchant-dashboard")}
                className="flex items-center space-x-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar</span>
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Gerenciar Multas</h1>
                <p className="text-sm text-muted-foreground">
                  Multas de cancelamento aplicadas aos clientes
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <DollarSign className="w-5 h-5 text-yellow-600" />
                  Multas Pendentes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {penalties.filter(p => p.status === "pending").length}
                </div>
                <p className="text-sm text-muted-foreground">
                  {formatCurrency(
                    penalties
                      .filter(p => p.status === "pending")
                      .reduce((sum, p) => sum + p.amount, 0)
                  )} em aberto
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  Multas Pagas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {penalties.filter(p => p.status === "paid").length}
                </div>
                <p className="text-sm text-muted-foreground">
                  {formatCurrency(
                    penalties
                      .filter(p => p.status === "paid")
                      .reduce((sum, p) => sum + p.amount, 0)
                  )} recebido
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <XCircle className="w-5 h-5 text-blue-600" />
                  Multas Dispensadas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {penalties.filter(p => p.status === "waived").length}
                </div>
                <p className="text-sm text-muted-foreground">
                  {formatCurrency(
                    penalties
                      .filter(p => p.status === "waived")
                      .reduce((sum, p) => sum + p.amount, 0)
                  )} dispensado
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Multas Aplicadas</CardTitle>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Filtrar por status:</span>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-1 border border-border rounded-md bg-background text-foreground text-sm"
                  >
                    <option value="all">Todos</option>
                    <option value="pending">Pendente</option>
                    <option value="paid">Pago</option>
                    <option value="waived">Dispensado</option>
                  </select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredPenalties.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">
                    {statusFilter === "all" 
                      ? "Nenhuma multa encontrada"
                      : `Nenhuma multa com status "${statusFilter}"`
                    }
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredPenalties.map((penalty) => (
                    <div key={penalty.id} className="border rounded-lg p-6 space-y-4">
                      {/* Header com status e valor */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {getStatusBadge(penalty.status)}
                          <span className="text-sm text-muted-foreground">
                            Criada em: {formatDate(penalty.createdAt)}
                          </span>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-bold text-red-600">
                            {formatCurrency(penalty.amount)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Multa de {penalty.type === "cancellation" ? "Cancelamento" : penalty.type}
                          </div>
                        </div>
                      </div>

                      {/* Informações detalhadas da multa */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {/* Informações do Cliente */}
                        <div className="space-y-3 bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                          <h4 className="font-semibold text-blue-800 dark:text-blue-200 flex items-center gap-2">
                            <User className="w-4 h-4" />
                            Cliente
                          </h4>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                              <span className="text-sm font-medium">{penalty.clientName}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Phone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                              <span className="text-sm">{penalty.clientPhone}</span>
                            </div>
                            {penalty.clientEmail && (
                              <div className="flex items-center gap-2">
                                <Mail className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                <span className="text-sm">{penalty.clientEmail}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Informações do Serviço */}
                        <div className="space-y-3 bg-purple-50 dark:bg-purple-950/20 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
                          <h4 className="font-semibold text-purple-800 dark:text-purple-200 flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            Serviço
                          </h4>
                          <div className="space-y-2">
                            {penalty.serviceName ? (
                              <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                                <span className="text-sm font-medium">{penalty.serviceName}</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-gray-400" />
                                <span className="text-sm text-gray-500">Serviço não encontrado</span>
                              </div>
                            )}
                            {penalty.servicePrice ? (
                              <div className="flex items-center gap-2">
                                <DollarSign className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                                <span className="text-sm">{formatCurrency(penalty.servicePrice)}</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <DollarSign className="w-4 h-4 text-gray-400" />
                                <span className="text-sm text-gray-500">Preço não disponível</span>
                              </div>
                            )}
                            {penalty.appointmentDate && penalty.appointmentTime ? (
                              <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                                <span className="text-sm">
                                  {formatAppointmentDate(penalty.appointmentDate)} às {penalty.appointmentTime}
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-gray-400" />
                                <span className="text-sm text-gray-500">Horário não disponível</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Informações do Funcionário */}
                        <div className="space-y-3 bg-green-50 dark:bg-green-950/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                          <h4 className="font-semibold text-green-800 dark:text-green-200 flex items-center gap-2">
                            <User className="w-4 h-4" />
                            Funcionário
                          </h4>
                          <div className="space-y-2">
                            {penalty.employeeName ? (
                              <div className="flex items-center gap-2">
                                <User className="w-4 h-4 text-green-600 dark:text-green-400" />
                                <span className="text-sm font-medium">{penalty.employeeName}</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <User className="w-4 h-4 text-gray-400" />
                                <span className="text-sm text-gray-500">Qualquer funcionário</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Detalhes da Multa e Cancelamento */}
                        <div className="space-y-3 bg-red-50 dark:bg-red-950/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
                          <h4 className="font-semibold text-red-800 dark:text-red-200 flex items-center gap-2">
                            <FileText className="w-4 h-4" />
                            Multa & Cancelamento
                          </h4>
                          <div className="space-y-3">
                            {/* Valor da Multa */}
                            <div className="flex items-start gap-2">
                              <DollarSign className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5" />
                              <div className="text-sm">
                                <span className="font-medium text-red-600 dark:text-red-400">
                                  {formatCurrency(penalty.amount)}
                                </span>
                                <p className="text-xs text-red-500">
                                  {penalty.type === "cancellation" ? "Multa de cancelamento" : penalty.type}
                                </p>
                              </div>
                            </div>
                            
                            {/* Data/Hora do Cancelamento */}
                            <div className="flex items-start gap-2">
                              <Clock className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5" />
                              <div className="text-sm">
                                <span className="font-medium">Cancelado em:</span>
                                <p className="text-xs text-red-500">{formatDate(penalty.createdAt)}</p>
                              </div>
                            </div>
                            
                            {/* Motivo do Cancelamento */}
                            <div className="flex items-start gap-2">
                              <FileText className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5" />
                              <div className="text-sm">
                                <span className="font-medium">Motivo do cancelamento:</span>
                                <p className="text-xs text-red-500 mt-1 break-words bg-white dark:bg-gray-800 p-2 rounded border">
                                  {penalty.reason || "Nenhum motivo informado"}
                                </p>
                              </div>
                            </div>
                            
                            {/* Status de Pagamento */}
                            {penalty.status === "paid" && penalty.paidAt && (
                              <div className="flex items-start gap-2">
                                <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5" />
                                <div className="text-sm">
                                  <span className="font-medium text-green-600">Pago em:</span>
                                  <p className="text-xs text-green-500">{formatDate(penalty.paidAt)}</p>
                                  {penalty.paidBy && (
                                    <p className="text-xs text-green-500">Por: {penalty.paidBy}</p>
                                  )}
                                </div>
                              </div>
                            )}
                            
                            {penalty.status === "waived" && (
                              <div className="flex items-start gap-2">
                                <XCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5" />
                                <div className="text-sm">
                                  <span className="font-medium text-blue-600">Multa dispensada</span>
                                  <p className="text-xs text-blue-500">em {formatDate(penalty.updatedAt)}</p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      {penalty.status === "pending" && (
                        <div className="flex gap-3 pt-4 border-t">
                          <Button
                            size="sm"
                            onClick={() => updatePenaltyMutation.mutate({ 
                              penaltyId: penalty.id, 
                              status: "paid" 
                            })}
                            disabled={updatePenaltyMutation.isPending}
                            className="bg-green-600 hover:bg-green-700 disabled:opacity-50"
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            {updatePenaltyMutation.isPending ? "Processando..." : "Marcar como Pago"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updatePenaltyMutation.mutate({ 
                              penaltyId: penalty.id, 
                              status: "waived" 
                            })}
                            disabled={updatePenaltyMutation.isPending}
                            className="disabled:opacity-50"
                          >
                            <XCircle className="w-4 h-4 mr-2" />
                            {updatePenaltyMutation.isPending ? "Processando..." : "Dispensar Multa"}
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
