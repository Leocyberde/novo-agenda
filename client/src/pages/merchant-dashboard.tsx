import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, Clock, Users, User, UserCheck, Phone, Mail, DollarSign, StickyNote, Plus, AlertCircle } from "lucide-react";
import { authService } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import ChangePasswordForm from "@/components/auth/change-password-form";


interface MerchantStats {
  appointments: {
    today: number;
    thisWeek: number;
    thisMonth: number;
  };
  services: {
    total: number;
    active: number;
  };
}

interface Appointment {
  id: string;
  clientName: string;
  appointmentDate: string;
  appointmentTime: string;
  endTime?: string;
  status: string;
  notes?: string;
  clientPhone?: string;
  clientEmail?: string;
  serviceId?: string;
  serviceName?: string;
  servicePrice?: number;
  employeeId?: string;
  employeeName?: string;
  completedAt?: string;
  actualStartTime?: string;
  actualEndTime?: string;
  paymentStatus?: string;
}

// Helper function to format currency
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(amount / 100); // Assuming amount is in cents
};


// Componente para lista de pagamentos pendentes
function PendingPaymentsList() {
  const { data: pendingPayments = [], isLoading } = useQuery<Appointment[]>({
    queryKey: ["/api/appointments/pending-payments"],
    enabled: authService.getState().isAuthenticated,
  });

  const queryClient = useQueryClient();

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Carregando pagamentos pendentes...</p>;
  }

  if (pendingPayments.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-sm text-muted-foreground">
          Nenhum pagamento pendente
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-h-96 overflow-y-auto">
      {pendingPayments.slice(0, 5).map((appointment) => (
        <div key={appointment.id} className="flex items-center justify-between p-4 border rounded-lg bg-orange-50 dark:bg-orange-900/20">
          <div className="flex-1">
            <p className="font-medium text-foreground">{appointment.clientName}</p>
            <p className="text-sm text-muted-foreground">{appointment.clientPhone}</p>
            <p className="text-sm text-muted-foreground">
              Data: {appointment.appointmentDate} às {appointment.appointmentTime}
            </p>
            {appointment.servicePrice && (
              <p className="text-sm font-medium text-green-600">
                {formatCurrency(appointment.servicePrice)}
              </p>
            )}
          </div>
          <Button
            size="sm"
            variant="default"
            className="text-xs h-7 bg-green-600 hover:bg-green-700"
            onClick={async (e) => {
              const button = e.currentTarget;
              if (!button) return;

              // Prevent multiple clicks
              button.disabled = true;

              try {
                const response = await fetch(`/api/appointments/${appointment.id}/status`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${authService.getState().token}`,
                  },
                  body: JSON.stringify({ 
                    paymentStatus: "paid"
                  }),
                });

                if (response.ok) {
                  queryClient.invalidateQueries({ queryKey: ["/api/appointments/pending-payments"] });
                  queryClient.invalidateQueries({ queryKey: ["/api/appointments/all"] });
                } else {
                  console.error("Erro ao marcar como pago:", response.status);
                  alert("Erro ao atualizar pagamento. Tente novamente.");
                  if (button) {
                    button.disabled = false;
                  }
                }
              } catch (error) {
                console.error("Error marking payment as paid:", error);
                alert("Erro de conexão. Tente novamente.");
                if (button) {
                  button.disabled = false;
                }
              }
            }}
            data-testid={`button-pay-${appointment.id}`}
          >
            Marcar como Pago
          </Button>
        </div>
      ))}
      {pendingPayments.length > 5 && (
        <div className="text-center pt-2">
          <p className="text-xs text-muted-foreground">
            E mais {pendingPayments.length - 5} pagamentos pendentes...
          </p>
        </div>
      )}
    </div>
  );
}

export default function MerchantDashboard() {
  const [user, setUser] = useState(authService.getState().user);
  const [, setLocation] = useLocation();
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedService, setSelectedService] = useState<any>(null);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    const unsubscribe = authService.subscribe((state) => {
      setUser(state.user);
    });
    return unsubscribe;
  }, []);

  // Fetch merchant stats
  const { data: stats, isLoading: statsLoading } = useQuery<MerchantStats>({
    queryKey: ["/api/merchant/stats"],
    enabled: authService.getState().isAuthenticated && user?.role === "merchant",
  });

  // Get all appointments with complete data
  // Fetch merchant's own cancellation fee settings
  const { data: merchantSettings } = useQuery<any>({
    queryKey: ["/api/merchant/settings"],
    queryFn: async () => {
      const response = await fetch("/api/merchant", {
        headers: {
          "Authorization": `Bearer ${authService.getState().token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Erro ao buscar configurações");
      }

      return response.json();
    },
    enabled: authService.getState().isAuthenticated && user?.role === "merchant",
  });

  // Fetch merchant policies for cancellation fee info
  const { data: merchantPolicies } = useQuery<any>({
    queryKey: [`/api/merchants/${user?.id}/booking-policies`],
    queryFn: async () => {
      const response = await fetch(`/api/merchants/${user?.id}/booking-policies`, {
        headers: {
          "Authorization": `Bearer ${authService.getState().token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Erro ao buscar políticas");
      }

      return response.json();
    },
    enabled: authService.getState().isAuthenticated && user?.role === "merchant" && !!user?.id,
  });

  // Fetch penalties for merchant
  const { data: penalties = [], isLoading: penaltiesLoading } = useQuery<any[]>({
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

      return response.json();
    },
    enabled: authService.getState().isAuthenticated && user?.role === "merchant",
  });

  const { data: allAppointments, isLoading: appointmentsLoading } = useQuery<Appointment[]>({
    queryKey: ["/api/appointments/all"],
    queryFn: async () => {
      const response = await fetch(`/api/appointments`, {
        headers: {
          "Authorization": `Bearer ${authService.getState().token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Erro ao buscar agendamentos");
      }

      const appointments = await response.json();

      // Enrich appointments with service and employee data
      const enrichedAppointments = await Promise.all(
        appointments.map(async (appointment: any) => {
          try {
            // Get service info
            const serviceResponse = await fetch(`/api/services?merchantId=${user?.id}`, {
              headers: {
                "Authorization": `Bearer ${authService.getState().token}`,
              },
            });

            let serviceName = null;
            let servicePrice = null;

            if (serviceResponse.ok) {
              const services = await serviceResponse.json();
              const service = services.find((s: any) => s.id === appointment.serviceId);
              if (service) {
                serviceName = service.name;
                servicePrice = service.price;
              }
            }

            // Get employee info if assigned
            let employeeName = null;
            if (appointment.employeeId) {
              const employeeResponse = await fetch(`/api/employees?merchantId=${user?.id}`, {
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
              ...appointment,
              serviceName,
              servicePrice,
              employeeName,
            };
          } catch (error) {
            console.error("Error enriching appointment:", error);
            return appointment;
          }
        })
      );

      return enrichedAppointments;
    },
    enabled: authService.getState().isAuthenticated && !!user?.id,
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

  const handleServiceClick = async (serviceId: string) => {
    try {
      const response = await fetch(`/api/services?merchantId=${user?.id}`, {
        headers: {
          "Authorization": `Bearer ${authService.getState().token}`,
        },
      });

      if (response.ok) {
        const services = await response.json();
        const service = services.find((s: any) => s.id === serviceId);
        if (service) {
          setSelectedService(service);
          setShowServiceModal(true);
        }
      }
    } catch (error) {
      console.error("Erro ao buscar detalhes do serviço:", error);
    }
  };

  // Filter appointments by status
  const filteredAppointments = allAppointments?.filter(appointment => {
    if (statusFilter === "all") return true;
    return appointment.status === statusFilter;
  }) || [];

  // Get next appointment from today's appointments
  const today = new Date().toISOString().split('T')[0];
  const todaysAppointments = allAppointments?.filter(apt => apt.appointmentDate === today) || [];
  const nextAppointment = todaysAppointments?.find(apt => {
    const currentTime = new Date().toTimeString().slice(0, 5); // HH:MM format
    return apt.appointmentTime > currentTime && (apt.status === "pending" || apt.status === "confirmed");
  });

  const statsCards = [
    {
      title: "Agendamentos Hoje",
      value: stats?.appointments.today || 0,
      icon: Calendar,
      color: "bg-blue-100 text-blue-600",
      description: `${stats?.appointments.thisWeek || 0} esta semana`,
    },
    {
      title: "Total de Serviços",
      value: stats?.services.total || 0,
      icon: Users,
      color: "bg-green-100 text-green-600",
      description: `${stats?.services.active || 0} ativos`,
    },
    {
      title: "Próximo Agendamento",
      value: nextAppointment?.appointmentTime || "---",
      icon: Clock,
      color: "bg-orange-100 text-orange-600",
      description: nextAppointment ? `${nextAppointment.clientName}` : "Nenhum agendamento",
    },
    {
      title: "Este Mês",
      value: stats?.appointments.thisMonth || 0,
      icon: Calendar,
      color: "bg-purple-100 text-purple-600",
      description: "agendamentos totais",
    },
  ];

  return (
    <div className="min-h-screen bg-background" data-testid="page-merchant-dashboard">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-border">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {user?.name || 'Meu Salão'}
              </h1>
              <p className="text-sm text-muted-foreground">
                Painel do Comerciante - {user?.ownerName}
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Bem-vindo,</p>
                <p className="text-sm font-medium text-foreground" data-testid="text-user-email">
                  {user?.email}
                </p>
              </div>
              <button
                onClick={() => authService.logout()}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                data-testid="button-logout"
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="p-6">
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
                          {stat.value}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {stat.description}
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

          {/* Quick Actions */}
          <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <div className="p-6 border-b border-border">
                <h3 className="text-lg font-semibold text-foreground">Ações Rápidas</h3>
                {merchantSettings?.cancellationFeeEnabled && (
                  <div className="mt-2">
                    <Badge variant="destructive" className="text-xs">
                      Sistema de Multas Ativo
                    </Badge>
                  </div>
                )}
              </div>
              <CardContent className="p-6">
                <div className="space-y-3">
                  <button
                    onClick={() => setLocation("/new-appointment")}
                    className="w-full p-3 text-left border border-border rounded-lg hover:bg-muted transition-colors"
                    data-testid="button-new-appointment"
                  >
                    <div className="flex items-center space-x-3">
                      <Calendar className="w-5 h-5 text-blue-600" />
                      <div>
                        <p className="font-medium text-foreground">Novo Agendamento</p>
                        <p className="text-sm text-muted-foreground">Agendar um novo serviço</p>
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => setLocation("/schedule")}
                    className="w-full p-3 text-left border border-border rounded-lg hover:bg-muted transition-colors"
                    data-testid="button-view-schedule"
                  >
                    <div className="flex items-center space-x-3">
                      <Clock className="w-5 h-5 text-green-600" />
                      <div>
                        <p className="font-medium text-foreground">Ver Agenda</p>
                        <p className="text-sm text-muted-foreground">Visualizar agenda do dia</p>
                      </div>
                    </div>
                  </button>

                  <Button
                    onClick={() => setLocation("/services")}
                    className="w-full justify-start h-auto p-4"
                    variant="outline"
                  >
                    <div className="flex items-center space-x-3">
                      <Users className="w-5 h-5 text-purple-600" />
                      <div className="text-left">
                        <div className="font-medium">Gerenciar Serviços</div>
                        <div className="text-xs text-muted-foreground">Configurar serviços oferecidos</div>
                      </div>
                    </div>
                  </Button>
                  <Button
                    onClick={() => setLocation("/employees")}
                    className="w-full justify-start h-auto p-4"
                    variant="outline"
                  >
                    <div className="flex items-center space-x-3">
                      <Users className="w-5 h-5 text-blue-600" />
                      <div className="text-left">
                        <div className="font-medium">Funcionários</div>
                        <div className="text-xs text-muted-foreground">Gerenciar equipe</div>
                      </div>
                    </div>
                  </Button>
                  <button
                    onClick={() => setLocation("/clients")}
                    className="w-full p-3 text-left border border-border rounded-lg hover:bg-muted transition-colors"
                    data-testid="button-manage-clients"
                  >
                    <div className="flex items-center space-x-3">
                      <User className="w-5 h-5 text-indigo-600" />
                      <div>
                        <p className="font-medium text-foreground">Clientes</p>
                        <p className="text-sm text-muted-foreground">Cadastrar e gerenciar clientes</p>
                      </div>
                    </div>
                  </button>
                  <Button
                    onClick={() => setLocation("/employee-days-off")}
                    className="w-full justify-start h-auto p-4"
                    variant="outline"
                  >
                    <div className="flex items-center space-x-3">
                      <Calendar className="w-5 h-5 text-purple-600" />
                      <div className="text-left">
                        <div className="font-medium">Folgas</div>
                        <div className="text-xs text-muted-foreground">Gerenciar folgas dos funcionários</div>
                      </div>
                    </div>
                  </Button>
                  <button
                    onClick={() => setLocation("/merchant-settings")}
                    className="w-full p-3 text-left border border-border rounded-lg hover:bg-muted transition-colors"
                    data-testid="button-merchant-settings"
                  >
                    <div className="flex items-center space-x-3">
                      <Clock className="w-5 h-5 text-teal-600" />
                      <div>
                        <p className="font-medium text-foreground">Configurações</p>
                        <p className="text-sm text-muted-foreground">Configurar dias e horários do salão</p>
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => setLocation("/promotions")}
                    className="w-full p-3 text-left border border-border rounded-lg hover:bg-muted transition-colors"
                    data-testid="button-promotions"
                  >
                    <div className="flex items-center space-x-3">
                      <DollarSign className="w-5 h-5 text-yellow-600" />
                      <div>
                        <p className="font-medium text-foreground">Promoções</p>
                        <p className="text-sm text-muted-foreground">Gerenciar descontos e ofertas especiais</p>
                      </div>
                    </div>
                  </button>
                </div>
              </CardContent>
            </Card>

            {/* All Appointments */}
            <Card>
              <div className="p-6 border-b border-border">
                <h3 className="text-lg font-semibold text-foreground">Todos Agendamentos</h3>
                {/* Status Filter */}
                <div className="mt-4">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-48 p-2 text-sm border border-border rounded-md bg-background text-foreground"
                  >
                    <option value="all">Todos os Status</option>
                    <option value="pending">Pendente</option>
                    <option value="confirmed">Confirmado</option>
                    <option value="late">Atrasado</option>
                    <option value="completed">Concluído</option>
                    <option value="cancelled">Cancelado</option>
                    <option value="no_show">Não Compareceu</option>
                    <option value="rescheduled">Reagendado</option>
                  </select>
                </div>
              </div>
              <CardContent className="p-6">
                <div className="space-y-4 max-h-96 overflow-y-auto" data-testid="schedule-list">
                  {appointmentsLoading ? (
                    <p className="text-sm text-muted-foreground">Carregando agendamentos...</p>
                  ) : filteredAppointments && filteredAppointments.length > 0 ? (
                    filteredAppointments.map((appointment, index) => {
                      // Definir cores e ícones por status
                      const getStatusConfig = (status: string) => {
                        switch (status) {
                          case "pending":
                            return { color: "bg-yellow-500", label: "Pendente", textColor: "text-yellow-700" };
                          case "confirmed":
                            return { color: "bg-blue-500", label: "Confirmado", textColor: "text-blue-700" };
                          case "late":
                            return { color: "bg-orange-500", label: "Atrasado", textColor: "text-orange-700" };
                          case "completed":
                            return { color: "bg-green-500", label: "Concluído", textColor: "text-green-700" };
                          case "cancelled":
                            return { color: "bg-red-500", label: "Cancelado", textColor: "text-red-700" };
                          case "no_show":
                            return { color: "bg-gray-500", label: "Não Compareceu", textColor: "text-gray-700" };
                          case "rescheduled":
                            return { color: "bg-purple-500", label: "Reagendado", textColor: "text-purple-700" };
                          default:
                            return { color: "bg-gray-400", label: status, textColor: "text-gray-600" };
                        }
                      };

                      const statusConfig = getStatusConfig(appointment.status);

                      return (
                        <div key={appointment.id} className="border rounded-lg p-4 space-y-3 bg-card">
                          {/* Header com status */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <div className={`w-3 h-3 ${statusConfig.color} rounded-full`}></div>
                              <span className={`px-2 py-1 text-xs rounded-full bg-opacity-20 ${statusConfig.color.replace('bg-', 'bg-')} ${statusConfig.textColor} font-medium`}>
                                {statusConfig.label}
                              </span>
                              {/* Alerta de multa pendente */}
                              {penalties && penalties.some(p => 
                                p.status === "pending" && 
                                (p.clientPhone === appointment.clientPhone || p.clientId === appointment.clientId)
                              ) && (
                                <div className="flex items-center gap-1 bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-medium">
                                  <AlertCircle className="w-3 h-3" />
                                  <span>Cliente com multa pendente</span>
                                </div>
                              )}
                            </div>
                            {appointment.servicePrice !== undefined && appointment.servicePrice !== null && (
                              <div className="flex items-center gap-1">
                                <DollarSign className="w-4 h-4 text-green-600" />
                                <span className="text-sm text-green-600 font-semibold">
                                  {formatCurrency(appointment.servicePrice)}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Detalhes principais */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {/* Data e Hora */}
                            <div>
                              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Data e Hora</p>
                              <div className="flex items-center gap-2 mt-1">
                                <Calendar className="w-4 h-4 text-blue-600" />
                                <span className="text-sm font-medium text-foreground">
                                  {new Date(appointment.appointmentDate + 'T00:00:00').toLocaleDateString('pt-BR')}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <Clock className="w-4 h-4 text-green-600" />
                                <span className="text-sm font-foreground">
                                  {appointment.status === "in_progress" || appointment.status === "completed" ? (
                                    <>
                                      {appointment.actualStartTime ? (
                                        <span className="text-blue-600 font-medium">
                                          Iniciado: {appointment.actualStartTime}
                                        </span>
                                      ) : (
                                        <span>Agendado: {appointment.appointmentTime}</span>
                                      )}
                                      {appointment.status === "completed" && appointment.actualEndTime && (
                                        <span className="text-green-600 font-medium ml-2">
                                          - Concluído: {appointment.actualEndTime}
                                        </span>
                                      )}
                                      {appointment.status === "in_progress" && (
                                        <span className="text-orange-600 font-medium ml-2">
                                          - Em andamento...
                                        </span>
                                      )}
                                    </>
                                  ) : (
                                    <>
                                      {appointment.appointmentTime}
                                      {appointment.endTime ? ` - ${appointment.endTime}` : ''}
                                      <span className="text-gray-500 text-xs ml-1">(previsto)</span>
                                    </>
                                  )}
                                </span>
                              </div>
                            </div>

                            {/* Cliente */}
                            <div>
                              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Cliente</p>
                              <div className="flex items-center gap-2 mt-1">
                                <User className="w-4 h-4 text-purple-600" />
                                <span className="text-sm font-medium text-foreground">
                                  {appointment.clientName}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <Phone className="w-4 h-4 text-orange-600" />
                                <span className="text-xs text-muted-foreground">
                                  {appointment.clientPhone}
                                </span>
                              </div>
                              {appointment.clientEmail && (
                                <div className="flex items-center gap-2 mt-1">
                                  <Mail className="w-4 h-4 text-cyan-600" />
                                  <span className="text-xs text-muted-foreground">
                                    {appointment.clientEmail}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Serviço */}
                            {appointment.serviceName && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Serviço</p>
                                <button
                                  onClick={() => appointment.serviceId && handleServiceClick(appointment.serviceId)}
                                  className="flex items-center gap-2 mt-1 text-sm font-medium text-blue-600 hover:text-blue-800 underline cursor-pointer"
                                >
                                  <Users className="w-4 h-4" />
                                  {appointment.serviceName}
                                </button>
                              </div>
                            )}

                            {/* FUNCIONÁRIO */}
                            {appointment.employeeName && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Funcionário</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <UserCheck className="w-4 h-4 text-indigo-600" />
                                  <span className="text-sm font-medium text-foreground">
                                    {appointment.employeeName}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Observações */}
                          {appointment.notes && (
                            <div className="pt-2 border-t border-border">
                              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Observações</p>
                              <div className="flex items-start gap-2 mt-1">
                                <StickyNote className="w-4 h-4 text-yellow-600 mt-0.5" />
                                <span className="text-xs text-muted-foreground">
                                  {appointment.notes}
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Ações do Agendamento */}
                          {appointment.status === "confirmed" && (
                            <div className="pt-3 border-t border-border">
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-xs h-7"
                                  onClick={async () => {
                                    try {
                                      await fetch(`/api/appointments/${appointment.id}/status`, {
                                        method: "POST",
                                        headers: {
                                          "Content-Type": "application/json",
                                          "Authorization": `Bearer ${authService.getState().token}`,
                                        },
                                        body: JSON.stringify({ 
                                          status: "in_progress",
                                          arrivalTime: new Date().toTimeString().slice(0, 5)
                                        }),
                                      });
                                      queryClient.invalidateQueries({ queryKey: ["/api/appointments/all"] });
                                    } catch (error) {
                                      console.error("Error starting appointment:", error);
                                    }
                                  }}
                                  data-testid={`button-start-${appointment.id}`}
                                >
                                  Iniciar
                                </Button>
                              </div>
                            </div>
                          )}

                          {appointment.status === "in_progress" && (
                            <div className="pt-3 border-t border-border">
                              <div className="space-y-2">
                                <p className="text-xs font-medium text-muted-foreground">Marcar como concluído:</p>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="default"
                                    className="text-xs h-7 bg-green-600 hover:bg-green-700"
                                    onClick={async () => {
                                      try {
                                        await fetch(`/api/appointments/${appointment.id}/status`, {
                                          method: "POST",
                                          headers: {
                                            "Content-Type": "application/json",
                                            "Authorization": `Bearer ${authService.getState().token}`,
                                          },
                                          body: JSON.stringify({ 
                                            status: "completed",
                                            paymentStatus: "paid",
                                            actualEndTime: new Date().toTimeString().slice(0, 5)
                                          }),
                                        });
                                        queryClient.invalidateQueries({ queryKey: ["/api/appointments/all"] });
                                      } catch (error) {
                                        console.error("Error completing appointment with payment:", error);
                                      }
                                    }}
                                    data-testid={`button-complete-paid-${appointment.id}`}
                                  >
                                    Concluir + Pago
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-xs h-7 border-orange-300 text-orange-700 hover:bg-orange-50"
                                    onClick={async () => {
                                      try {
                                        await fetch(`/api/appointments/${appointment.id}/status`, {
                                          method: "POST",
                                          headers: {
                                            "Content-Type": "application/json",
                                            "Authorization": `Bearer ${authService.getState().token}`,
                                          },
                                          body: JSON.stringify({ 
                                            status: "completed",
                                            paymentStatus: "pending",
                                            actualEndTime: new Date().toTimeString().slice(0, 5)
                                          }),
                                        });
                                        queryClient.invalidateQueries({ queryKey: ["/api/appointments/all"] });
                                      } catch (error) {
                                        console.error("Error completing appointment without payment:", error);
                                      }
                                    }}
                                    data-testid={`button-complete-pending-${appointment.id}`}
                                  >
                                    Concluir (Pagar Depois)
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Opções de Pagamento para Agendamentos Concluídos */}
                          {appointment.status === "completed" && (
                            <div className="pt-3 border-t border-border">
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-medium text-muted-foreground">
                                    Status do pagamento:
                                  </span>
                                  {(appointment as any).paymentStatus === "pending" ? (
                                    <span className="text-xs text-orange-600 font-medium">⚠️ Pendente</span>
                                  ) : (appointment as any).paymentStatus === "paid" ? (
                                    <span className="text-xs text-green-600 font-medium">✅ Pago</span>
                                  ) : (
                                    <span className="text-xs text-gray-600 font-medium">Não definido</span>
                                  )}
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant={(appointment as any).paymentStatus === "paid" ? "default" : "outline"}
                                    className={`text-xs h-7 ${
                                      (appointment as any).paymentStatus === "paid" 
                                        ? "bg-green-600 hover:bg-green-700 text-white cursor-default" 
                                        : "border-green-300 text-green-700 hover:bg-green-50"
                                    }`}
                                    disabled={(appointment as any).paymentStatus === "paid"}
                                    onClick={async (e) => {
                                      const button = e.currentTarget;
                                      if (!button || (appointment as any).paymentStatus === "paid") return;

                                      // Prevent multiple clicks
                                      const originalDisabled = button.disabled;
                                      button.disabled = true;

                                      try {
                                        console.log(`Marking appointment ${appointment.id} as paid`);
                                        
                                        const response = await fetch(`/api/appointments/${appointment.id}/status`, {
                                          method: "POST",
                                          headers: {
                                            "Content-Type": "application/json",
                                            "Authorization": `Bearer ${authService.getState().token}`,
                                          },
                                          body: JSON.stringify({ 
                                            paymentStatus: "paid"
                                          }),
                                        });

                                        if (response.ok) {
                                          console.log("Payment status updated successfully");
                                          // Force immediate refetch of data
                                          await queryClient.invalidateQueries({ queryKey: ["/api/appointments/all"] });
                                          await queryClient.invalidateQueries({ queryKey: ["/api/appointments/pending-payments"] });
                                          
                                          // Force refetch
                                          queryClient.refetchQueries({ queryKey: ["/api/appointments/all"] });
                                          queryClient.refetchQueries({ queryKey: ["/api/appointments/pending-payments"] });
                                        } else {
                                          const errorText = await response.text();
                                          console.error("Erro ao atualizar pagamento:", response.status, errorText);
                                          alert("Erro ao atualizar status do pagamento. Tente novamente.");
                                          button.disabled = originalDisabled;
                                        }
                                      } catch (error) {
                                        console.error("Error marking payment as paid:", error);
                                        alert("Erro de conexão. Verifique sua internet e tente novamente.");
                                        button.disabled = originalDisabled;
                                      }
                                    }}
                                    data-testid={`button-mark-paid-${appointment.id}`}
                                  >
                                    {(appointment as any).paymentStatus === "paid" ? "✓ Pago" : "Marcar como Pago"}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant={(appointment as any).paymentStatus === "pending" ? "default" : "outline"}
                                    className={`text-xs h-7 ${
                                      (appointment as any).paymentStatus === "pending" 
                                        ? "bg-orange-600 hover:bg-orange-700 text-white cursor-default" 
                                        : "border-orange-300 text-orange-700 hover:bg-orange-50"
                                    }`}
                                    disabled={(appointment as any).paymentStatus === "pending"}
                                    onClick={async (e) => {
                                      const button = e.currentTarget;
                                      if (!button || (appointment as any).paymentStatus === "pending") return;

                                      // Prevent multiple clicks
                                      const originalDisabled = button.disabled;
                                      button.disabled = true;

                                      try {
                                        console.log(`Marking appointment ${appointment.id} as pending payment`);
                                        
                                        const response = await fetch(`/api/appointments/${appointment.id}/status`, {
                                          method: "POST",
                                          headers: {
                                            "Content-Type": "application/json",
                                            "Authorization": `Bearer ${authService.getState().token}`,
                                          },
                                          body: JSON.stringify({ 
                                            paymentStatus: "pending"
                                          }),
                                        });

                                        if (response.ok) {
                                          console.log("Payment status updated successfully");
                                          // Force immediate refetch of data
                                          await queryClient.invalidateQueries({ queryKey: ["/api/appointments/all"] });
                                          await queryClient.invalidateQueries({ queryKey: ["/api/appointments/pending-payments"] });
                                          
                                          // Force refetch
                                          queryClient.refetchQueries({ queryKey: ["/api/appointments/all"] });
                                          queryClient.refetchQueries({ queryKey: ["/api/appointments/pending-payments"] });
                                        } else {
                                          const errorText = await response.text();
                                          console.error("Erro ao atualizar pagamento:", response.status, errorText);
                                          alert("Erro ao atualizar status do pagamento. Tente novamente.");
                                          button.disabled = originalDisabled;
                                        }
                                      } catch (error) {
                                        console.error("Error marking payment as pending:", error);
                                        alert("Erro de conexão. Verifique sua internet e tente novamente.");
                                        button.disabled = originalDisabled;
                                      }
                                    }}
                                    data-testid={`button-mark-pending-${appointment.id}`}
                                  >
                                    {(appointment as any).paymentStatus === "pending" ? "⏳ Pendente" : "Marcar como Pendente"}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {statusFilter === "all" ? "Nenhum agendamento encontrado" : `Nenhum agendamento com status "${statusFilter}"`}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Multas Pendentes - Only show if cancellation fee is enabled */}
            {(merchantSettings?.cancellationFeeEnabled || merchantPolicies?.cancellationFeeEnabled) && (
              <Card>
                <div className="p-6 border-b border-border">
                  <h3 className="text-lg font-semibold text-foreground">Multas Pendentes</h3>
                  <p className="text-sm text-muted-foreground">Gerenciar multas de cancelamento</p>
                </div>
                <CardContent className="p-6">
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {penaltiesLoading ? (
                      <p className="text-sm text-muted-foreground">Carregando multas...</p>
                    ) : penalties && penalties.filter(p => p.status === "pending").length > 0 ? (
                      penalties
                        .filter(penalty => penalty.status === "pending")
                        .slice(0, 5)
                        .map((penalty) => (
                          <div key={penalty.id} className="flex items-center justify-between p-4 border rounded-lg">
                            <div className="flex-1">
                              <p className="font-medium text-foreground">{penalty.clientName}</p>
                              <p className="text-sm text-muted-foreground">{penalty.clientPhone}</p>
                              <p className="text-sm text-muted-foreground">{penalty.reason}</p>
                              <p className="text-sm text-muted-foreground">
                                {formatCurrency(penalty.amount)}
                              </p>
                            </div>
                            <div className="flex space-x-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs h-7"
                                onClick={async () => {
                                  try {
                                    await fetch(`/api/penalties/${penalty.id}`, {
                                      method: "PUT",
                                      headers: {
                                        "Content-Type": "application/json",
                                        "Authorization": `Bearer ${authService.getState().token}`,
                                      },
                                      body: JSON.stringify({ status: "paid" }),
                                    });
                                    queryClient.invalidateQueries({ queryKey: ["/api/merchant/penalties"] });
                                  } catch (error) {
                                    console.error("Error marking penalty as paid:", error);
                                  }
                                }}
                              >
                                Pago
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                className="text-xs h-7"
                                onClick={async () => {
                                  try {
                                    await fetch(`/api/penalties/${penalty.id}`, {
                                      method: "PUT",
                                      headers: {
                                        "Content-Type": "application/json",
                                        "Authorization": `Bearer ${authService.getState().token}`,
                                      },
                                      body: JSON.stringify({ status: "waived" }),
                                    });
                                    queryClient.invalidateQueries({ queryKey: ["/api/merchant/penalties"] });
                                  } catch (error) {
                                    console.error("Error waiving penalty:", error);
                                  }
                                }}
                              >
                                Dispensar
                              </Button>
                            </div>
                          </div>
                        ))
                    ) : (
                      <div className="text-center py-4">
                        <p className="text-sm text-muted-foreground">
                          Nenhuma multa pendente
                        </p>
                      </div>
                    )}
                    {penalties && penalties.filter(p => p.status === "pending").length > 5 && (
                      <div className="text-center pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setLocation("/merchant-penalties")}
                          className="text-xs"
                        >
                          Ver todas as multas
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Pagamentos Pendentes */}
            <Card>
              <div className="p-6 border-b border-border">
                <h3 className="text-lg font-semibold text-foreground">Pagamentos Pendentes</h3>
                <p className="text-sm text-muted-foreground">Agendamentos concluídos aguardando pagamento</p>
              </div>
              <CardContent className="p-6">
                <PendingPaymentsList />
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card>
              <div className="p-6 border-b border-border">
                <h3 className="text-lg font-semibold text-foreground">Atividade Recente</h3>
              </div>
              <CardContent className="p-6">
                <div className="space-y-4" data-testid="activity-list">
                  <p className="text-sm text-muted-foreground">
                    Atividades recentes aparecerão aqui
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Account Settings */}
            <Card>
              <div className="p-6 border-b border-border">
                <h3 className="text-lg font-semibold text-foreground">Configurações da Conta</h3>
              </div>
              <CardContent className="p-6">
                <div className="max-w-md">
                  <ChangePasswordForm />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Service Details Modal */}
      {showServiceModal && selectedService && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-foreground">Detalhes do Serviço</h3>
              <button
                onClick={() => setShowServiceModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-foreground">Nome:</p>
                <p className="text-sm text-muted-foreground">{selectedService.name}</p>
              </div>
              {selectedService.description && (
                <div>
                  <p className="text-sm font-medium text-foreground">Descrição:</p>
                  <p className="text-sm text-muted-foreground">{selectedService.description}</p>
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-foreground">Preço:</p>
                <p className="text-sm text-green-600 font-medium">
                  {formatCurrency(selectedService.price)}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Duração:</p>
                <p className="text-sm text-muted-foreground">{selectedService.duration} minutos</p>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Status:</p>
                <p className={`text-sm ${selectedService.isActive ? 'text-green-600' : 'text-red-600'}`}>
                  {selectedService.isActive ? 'Ativo' : 'Inativo'}
                </p>
              </div>
            </div>
            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowServiceModal(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}