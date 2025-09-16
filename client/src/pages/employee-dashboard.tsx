import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, Clock, User, LogOut, Check, X, Edit3, Play, CheckCircle, AlertCircle, UserX, Trash2, History, DollarSign, Phone, Mail, FileText, Star, Scissors } from "lucide-react";
import { authService } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ChangePasswordForm from "@/components/auth/change-password-form";


interface Appointment {
  id: string;
  clientName: string;
  clientPhone: string;
  appointmentDate: string;
  appointmentTime: string;
  status: string;
  notes?: string;
  serviceName?: string;
  servicePrice?: number;
  rescheduleReason?: string;
  newDate?: string;
  newTime?: string;
  employeePaymentType?: string;
  employeeEarning?: number;
  cancelReason?: string;
  actualStartTime?: string;
  actualEndTime?: string;
}

interface EmployeeStats {
  appointments: {
    today: number;
    thisWeek: number;
    thisMonth: number;
  };
}

// Helper function to get status badge
function getStatusBadge(status: string) {
  const statusConfig = {
    pending: { label: "Pendente", className: "bg-yellow-100 text-yellow-700" },
    scheduled: { label: "Agendado", className: "bg-blue-100 text-blue-700" },
    confirmed: { label: "Confirmado", className: "bg-green-100 text-green-700" },
    in_progress: { label: "Em Andamento", className: "bg-purple-100 text-purple-700" },
    completed: { label: "Concluído", className: "bg-gray-100 text-gray-700" },
    cancelled: { label: "Cancelado", className: "bg-red-100 text-red-700" },
    rescheduled: { label: "Reagendado", className: "bg-orange-100 text-orange-700" },
    late: { label: "Atrasado", className: "bg-red-100 text-red-700" },
    no_show: { label: "Não Compareceu", className: "bg-gray-100 text-gray-700" },
  };

  const config = statusConfig[status as keyof typeof statusConfig] || {
    label: status,
    className: "bg-gray-100 text-gray-700"
  };

  return (
    <Badge className={`text-xs ${config.className}`}>
      {config.label}
    </Badge>
  );
}

export default function EmployeeDashboard() {
  const [user, setUser] = useState(authService.getState().user);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [rescheduleData, setRescheduleData] = useState({
    appointmentId: "",
    newDate: "",
    newTime: "",
    reason: "",
  });
  const [isRescheduleDialogOpen, setIsRescheduleDialogOpen] = useState(false);
  const [historyFilter, setHistoryFilter] = useState("day"); // day, week, month
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  

  useEffect(() => {
    const unsubscribe = authService.subscribe((state) => {
      console.log('Employee dashboard - auth state changed:', state);
      setUser(state.user);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    console.log('Employee dashboard - current user:', user?.id ? { id: user.id, role: user.role } : 'None');
  }, [user]);

  // Fetch appointments for the selected date
  // Fetch merchant settings for cancellation fee info
  const { data: merchantSettings } = useQuery<any>({
    queryKey: ["/api/employee/merchant-settings"],
    queryFn: async () => {
      const response = await fetch("/api/employee/merchant-settings", {
        headers: {
          "Authorization": `Bearer ${authService.getState().token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Erro ao buscar configurações do salão");
      }

      return response.json();
    },
    enabled: authService.getState().isAuthenticated && user?.role === "employee",
  });

  // Fetch penalties for merchant
  const { data: penalties, isLoading: penaltiesLoading } = useQuery<any[]>({
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
    enabled: authService.getState().isAuthenticated && user?.role === "employee" && merchantSettings?.cancellationFeeEnabled,
  });

  const { data: todaysAppointments, isLoading: appointmentsLoading, error, refetch: fetchAppointments } = useQuery<Appointment[]>({
    queryKey: ["/api/employee/appointments", selectedDate],
    queryFn: async () => {
      console.log('Fetching appointments for employee:', user?.id || 'None');
      console.log('Date:', selectedDate);
      console.log('Auth token:', authService.getState().token ? 'Present' : 'Missing');

      const response = await fetch(`/api/employee/appointments?date=${selectedDate}`, {
        headers: {
          'Authorization': `Bearer ${authService.getState().token}`,
        },
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Erro de conexão" }));
        console.error('API Error:', errorData);
        throw new Error(errorData.message || "Erro ao carregar agendamentos");
      }

      const data = await response.json();
      console.log('Appointments count:', data?.length || 0);
      return data;
    },
    retry: 2,
    enabled: Boolean(authService.getState().isAuthenticated || authService.getState().token),
  });

  // Get employee upcoming appointments (future dates with pending/confirmed status)
  const { data: upcomingAppointments, isLoading: upcomingLoading, error: upcomingError, refetch: fetchUpcomingAppointments } = useQuery<Appointment[]>({
    queryKey: ["/api/employee/appointments/upcoming"],
    queryFn: async () => {
      console.log('Fetching upcoming appointments for employee:', user?.id || 'None');
      console.log('Auth token for upcoming:', authService.getState().token ? 'Present' : 'Missing');

      const response = await fetch(`/api/employee/appointments/upcoming`, {
        headers: {
          'Authorization': `Bearer ${authService.getState().token}`,
        },
      });

      console.log('Upcoming appointments response status:', response.status);

      if (!response.ok) {
        throw new Error("Erro ao carregar próximos agendamentos");
      }

      const data = await response.json();
      console.log('Upcoming appointments count:', data?.length || 0);
      console.log('Upcoming appointments data:', data);

      // Filtrar apenas agendamentos com status pendente, agendado ou confirmado
      // Remover agendamentos concluídos, cancelados, não compareceu, etc.
      const filteredData = data.filter((appointment: Appointment) =>
        appointment.status === "pending" ||
        appointment.status === "scheduled" ||
        appointment.status === "confirmed"
      );

      console.log('Filtered upcoming appointments count:', filteredData?.length || 0);
      return filteredData;
    },
    enabled: Boolean(authService.getState().isAuthenticated || authService.getState().token),
  });

  // Fetch historical appointments with filter (completed appointments only)
  const { data: historicalAppointments, isLoading: historyLoading, refetch: fetchHistoricalAppointments } = useQuery({
    queryKey: ["/api/employee/appointments/history", historyFilter],
    queryFn: async () => {
      const response = await fetch(`/api/employee/appointments/history?filter=${historyFilter}`, {
        headers: {
          'Authorization': `Bearer ${authService.getState().token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Erro ao carregar histórico");
      }

      return response.json();
    },
    enabled: Boolean(authService.getState().isAuthenticated || authService.getState().token),
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

  // Mutation to update appointment status
  const updateAppointmentMutation = useMutation({
    mutationFn: async ({ appointmentId, updates }: { appointmentId: string; updates: any }) => {
      const response = await fetch(`/api/appointments/${appointmentId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authService.getState().token}`,
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error("Erro ao atualizar agendamento");
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate all appointment-related queries to sync all dashboards
      queryClient.invalidateQueries({ queryKey: ["/api/employee/appointments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/employee/appointments/upcoming"] });
      queryClient.invalidateQueries({ queryKey: ["/api/employee/appointments/history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/client/appointments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/appointments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/merchants/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/client/occupied-times"] });
      queryClient.invalidateQueries({ queryKey: ["/api/client/availability"] });

      toast({
        title: "Sucesso",
        description: "Agendamento atualizado com sucesso",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: (error as Error).message,
        variant: "destructive",
      });
    },
  });

  const handleConfirmAppointment = (appointmentId: string) => {
    updateAppointmentMutation.mutate({
      appointmentId,
      updates: { status: "confirmed" },
    });
  };

  const handleCancelAppointment = (appointmentId: string) => {
    updateAppointmentMutation.mutate({
      appointmentId,
      updates: { status: "cancelled" },
    });
  };

  const handleStartAppointment = (appointmentId: string) => {
    updateAppointmentMutation.mutate({
      appointmentId,
      updates: { status: "in_progress" },
    });
  };

  const handleCompleteAppointment = (appointmentId: string) => {
    updateAppointmentMutation.mutate({
      appointmentId,
      updates: { status: "completed" },
    });
  };

  const handleMarkLate = (appointmentId: string) => {
    updateAppointmentMutation.mutate({
      appointmentId,
      updates: { status: "late" },
    });
  };

  const handleMarkNoShow = (appointmentId: string) => {
    updateAppointmentMutation.mutate({
      appointmentId,
      updates: { status: "no_show" },
    });
  };

  const handleDeleteAppointment = (appointmentId: string) => {
    if (confirm("Tem certeza que deseja excluir este agendamento? Esta ação não pode ser desfeita.")) {
      deleteAppointmentMutation.mutate(appointmentId);
    }
  };

  // Mutation specifically for rescheduling appointments
  const rescheduleAppointmentMutation = useMutation({
    mutationFn: async ({
      appointmentId,
      newDate,
      newTime,
      reason,
    }: {
      appointmentId: string;
      newDate: string;
      newTime: string;
      reason: string;
    }) => {
      const response = await fetch(`/api/appointments/${appointmentId}/reschedule`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authService.getState().token}`,
        },
        body: JSON.stringify({ newDate, newTime, reason }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao reagendar agendamento");
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate all appointment-related queries to sync all dashboards
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/client/appointments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/employee/appointments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/employee/appointments/upcoming"] });
      queryClient.invalidateQueries({ queryKey: ["/api/employee/appointments/history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/appointments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/merchants/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/client/occupied-times"] });
      queryClient.invalidateQueries({ queryKey: ["/api/client/availability"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation for deleting appointments
  const deleteAppointmentMutation = useMutation({
    mutationFn: async (appointmentId: string) => {
      const response = await fetch(`/api/appointments/${appointmentId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${authService.getState().token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao excluir agendamento");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Sucesso!",
        description: "Agendamento excluído com sucesso",
      });

      // Invalidate all appointment-related queries to sync all dashboards
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/client/appointments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/employee/appointments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/employee/appointments/upcoming"] });
      queryClient.invalidateQueries({ queryKey: ["/api/employee/appointments/history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/appointments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/merchants/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/client/occupied-times"] });
      queryClient.invalidateQueries({ queryKey: ["/api/client/availability"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleReschedule = async () => {
    if (!rescheduleData.appointmentId || !rescheduleData.newDate || !rescheduleData.newTime || !rescheduleData.reason.trim()) {
      toast({
        title: "Erro",
        description: "Todos os campos são obrigatórios para reagendar",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch(`/api/appointments/${rescheduleData.appointmentId}/reschedule`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authService.getState().token}`,
        },
        body: JSON.stringify({
          newDate: rescheduleData.newDate,
          newTime: rescheduleData.newTime,
          reason: rescheduleData.reason,
        }),
      });

      if (response.ok) {
        toast({
          title: "Sucesso",
          description: "Agendamento reagendado com sucesso",
        });
        setIsRescheduleDialogOpen(false);
        setRescheduleData({
          appointmentId: "",
          newDate: "",
          newTime: "",
          reason: "",
        });
        fetchAppointments();
        fetchUpcomingAppointments();
        queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      } else {
        const errorData = await response.json();
        toast({
          title: "Erro",
          description: errorData.message || "Erro ao reagendar agendamento",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error rescheduling appointment:", error);
      toast({
        title: "Erro",
        description: "Erro interno do servidor",
        variant: "destructive",
      });
    }
  };

  

  useEffect(() => {
    if (user && user.role === "employee") {
      fetchAppointments();
      fetchUpcomingAppointments();
      fetchHistoricalAppointments();
    }
  }, [user]);

  // Separate active and completed appointments
  const activeAppointments = todaysAppointments?.filter(apt =>
    apt.status !== "completed" &&
    apt.status !== "cancelled" &&
    apt.status !== "no_show"
  ) || [];

  // Combine today's completed appointments with historical ones
  const todaysCompletedAppointments = todaysAppointments?.filter(apt =>
    apt.status === "completed" ||
    apt.status === "cancelled" ||
    apt.status === "no_show"
  ) || [];

  const historicalCompletedAppointments = historicalAppointments?.filter(apt =>
    apt.status === "completed" ||
    apt.status === "cancelled" ||
    apt.status === "no_show"
  ) || [];

  // Remove duplicates by ID and combine both arrays
  const completedAppointments = [...todaysCompletedAppointments, ...historicalCompletedAppointments.filter(hist => 
    !todaysCompletedAppointments.some(today => today.id === hist.id)
  )];

  // Get next appointment from active appointments only
  const nextAppointment = activeAppointments?.find(apt => {
    const currentTime = new Date().toTimeString().slice(0, 5);
    return apt.appointmentTime > currentTime && (apt.status === "scheduled" || apt.status === "pending" || apt.status === "confirmed" || apt.status === "rescheduled");
  });

  const statsCards = [
    {
      title: "Agendamentos Ativos",
      value: activeAppointments?.length || 0,
      icon: Calendar,
      color: "bg-blue-100 text-blue-600",
      description: "seus atendimentos pendentes",
    },
    {
      title: "Próximo Atendimento",
      value: nextAppointment?.appointmentTime || "---",
      icon: Clock,
      color: "bg-orange-100 text-orange-600",
      description: nextAppointment ? `${nextAppointment.clientName}` : "Nenhum agendamento",
    },
    {
      title: "Status",
      value: "Ativo",
      icon: User,
      color: "bg-green-100 text-green-600",
      description: "funcionário",
    },
  ];

  return (
    <div className="min-h-screen bg-background" data-testid="page-employee-dashboard">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-border">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Olá, {user?.name || 'Funcionário'}! 👋
              </h1>
              <p className="text-sm text-muted-foreground">
                Painel do Funcionário - {formatDate()}
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm font-medium text-foreground">
                  {user?.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {user?.email}
                </p>
              </div>
              <button
                onClick={() => authService.logout()}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors flex items-center space-x-2"
                data-testid="button-logout"
              >
                <LogOut className="w-4 h-4" />
                <span>Sair</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-6">
        <div className="max-w-7xl mx-auto">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {statsCards.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <Card key={index} data-testid={`card-stat-${index}`}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">
                          {stat.title}
                        </p>
                        <p className="text-2xl font-bold text-foreground">
                          {stat.value}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {stat.description}
                        </p>
                      </div>
                      <div className={`p-3 rounded-full ${stat.color}`}>
                        <Icon className="w-6 h-6" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            
          </div>

          {/* Active Schedule, Upcoming and History */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Active Appointments */}
            <Card>
              <div className="p-6 border-b border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">Minha Agenda</h3>
                    <p className="text-sm text-muted-foreground">Agendamentos para a data selecionada</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Label htmlFor="selectedDate" className="text-sm text-muted-foreground">Data:</Label>
                    <Input
                      id="selectedDate"
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="w-auto"
                    />
                  </div>
                </div>
              </div>
              <CardContent className="p-6">
                <div className="space-y-4" data-testid="schedule-list">
                  {appointmentsLoading ? (
                    <p className="text-sm text-muted-foreground">Carregando agenda...</p>
                  ) : error ? (
                    <div className="flex flex-col items-center justify-center py-8 space-y-4">
                      <div className="text-lg text-red-600">⚠️ Erro ao carregar agendamentos</div>
                      <div className="text-sm text-gray-600 text-center">{(error as Error).message}</div>
                      <button
                        onClick={() => window.location.reload()}
                        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                      >
                        🔄 Tentar novamente
                      </button>
                    </div>
                  ) : activeAppointments && activeAppointments.length > 0 ? (
                    activeAppointments.map((appointment, index) => {
                      const colors = ["bg-blue-500", "bg-green-500", "bg-orange-500", "bg-purple-500"];
                      return (
                        <div key={appointment.id} className="border rounded-lg p-4 mb-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center space-x-4">
                              <div className={`w-2 h-2 ${colors[index % colors.length]} rounded-full`}></div>
                              <div className="flex-1">
                                <p className="text-sm font-medium text-foreground flex items-center gap-2">
                                  <Clock className="w-4 h-4 text-blue-600" />
                                  {appointment.status === "in_progress" || appointment.status === "completed" ? (
                                    <>
                                      {appointment.actualStartTime ? (
                                        <span className="text-blue-600 font-semibold">
                                          Iniciado: {appointment.actualStartTime}
                                        </span>
                                      ) : (
                                        <span>Agendado: {appointment.appointmentTime}</span>
                                      )}
                                      {appointment.status === "completed" && appointment.actualEndTime && (
                                        <span className="text-green-600 font-semibold ml-2">
                                          - Concluído: {appointment.actualEndTime}
                                        </span>
                                      )}
                                      {appointment.status === "in_progress" && (
                                        <span className="text-orange-600 font-semibold ml-2">
                                          - Em andamento...
                                        </span>
                                      )}
                                    </>
                                  ) : (
                                    <>
                                      {appointment.appointmentTime}
                                      <span className="text-gray-500 text-xs ml-1">(agendado)</span>
                                    </>
                                  )} -
                                  <User className="w-4 h-4 text-green-600" />
                                  {appointment.clientName}
                                </p>
                                {/* Alerta de multa pendente */}
                                {penalties && penalties.some(p => 
                                  p.status === "pending" && 
                                  (p.clientPhone === appointment.clientPhone || p.clientId === appointment.clientId)
                                ) && (
                                  <div className="flex items-center gap-1 bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-medium mt-1">
                                    <AlertCircle className="w-3 h-3" />
                                    <span>⚠️ Cliente possui multa pendente de R$ {
                                      (penalties
                                        .filter(p => p.status === "pending" && 
                                          (p.clientPhone === appointment.clientPhone || p.clientId === appointment.clientId))
                                        .reduce((total, p) => total + p.amount, 0) / 100
                                      ).toFixed(2)
                                    }</span>
                                  </div>
                                )}
                                {appointment.status === "rescheduled" && (
                                  <div className="mt-1">
                                    <p className="text-sm font-medium text-blue-600 flex items-center gap-1">
                                      <Calendar className="w-4 h-4" />
                                      Reagendado para: {appointment.newDate ? appointment.newDate.split('-').reverse().join('/') : ''} às {appointment.newTime}
                                    </p>
                                  </div>
                                )}
                                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                  <Phone className="w-3 h-3" />
                                  {appointment.clientPhone}
                                </p>
                                {appointment.serviceName && (
                                  <p className="text-xs text-purple-600 font-medium mt-1 flex items-center gap-1">
                                    <Star className="w-3 h-3" />
                                    Serviço: {appointment.serviceName}
                                  </p>
                                )}
                                {appointment.notes && (
                                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                    <FileText className="w-3 h-3" />
                                    Obs: {appointment.notes}
                                  </p>
                                )}
                                {appointment.rescheduleReason && (
                                  <p className="text-xs text-orange-600 mt-1 flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" />
                                    Motivo do reagendamento: {appointment.rescheduleReason}
                                  </p>
                                )}
                                {(appointment.status === "completed" || appointment.status === "cancelled") && (
                                  <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                                    {appointment.status === "completed" ? (
                                      <>
                                        <CheckCircle className="w-3 h-3" />
                                        Agendamento concluído - não pode ser reagendado
                                      </>
                                    ) : (
                                      <>
                                        <X className="w-3 h-3" />
                                        Agendamento cancelado - não pode ser reagendado
                                      </>
                                    )}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-col items-end space-y-2">
                              {getStatusBadge(appointment.status)}
                            </div>
                          </div>

                          {/* Botões para agendamentos pendentes/agendados/confirmados */}
                          {(appointment.status === "pending" || appointment.status === "scheduled" || appointment.status === "confirmed") && (
                            <div className="space-y-2">
                              <div className="flex flex-wrap gap-2">
                                {(appointment.status === "pending" || appointment.status === "scheduled") && (
                                  <Button
                                    size="sm"
                                    onClick={() => handleConfirmAppointment(appointment.id)}
                                    className="flex items-center space-x-1"
                                  >
                                    <Check className="w-3 h-3" />
                                    <span>Confirmar</span>
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="default"
                                  onClick={() => handleStartAppointment(appointment.id)}
                                  className="flex items-center space-x-1 bg-blue-600 hover:bg-blue-700"
                                >
                                  <Play className="w-3 h-3" />
                                  <span>Iniciar</span>
                                </Button>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => handleMarkLate(appointment.id)}
                                  className="flex items-center space-x-1"
                                >
                                  <AlertCircle className="w-3 h-3" />
                                  <span>Atrasado</span>
                                </Button>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setRescheduleData({ ...rescheduleData, appointmentId: appointment.id });
                                    setIsRescheduleDialogOpen(true);
                                  }}
                                  className="flex items-center space-x-1"
                                >
                                  <Edit3 className="w-3 h-3" />
                                  <span>Reagendar</span>
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleMarkNoShow(appointment.id)}
                                  className="flex items-center space-x-1"
                                >
                                  <UserX className="w-3 h-3" />
                                  <span>Não Compareceu</span>
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleCancelAppointment(appointment.id)}
                                  className="flex items-center space-x-1"
                                >
                                  <X className="w-3 h-3" />
                                  <span>Cancelar</span>
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleDeleteAppointment(appointment.id)}
                                  className="flex items-center space-x-1 bg-red-700 hover:bg-red-800"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  <span>Excluir</span>
                                </Button>
                              </div>
                            </div>
                          )}

                          {/* Botões para agendamento em andamento */}
                          {appointment.status === "in_progress" && (
                            <div className="flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => handleCompleteAppointment(appointment.id)}
                                className="flex items-center space-x-1 bg-green-600 hover:bg-green-700"
                              >
                                <CheckCircle className="w-3 h-3" />
                                <span>Concluir</span>
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setRescheduleData({ ...rescheduleData, appointmentId: appointment.id });
                                  setIsRescheduleDialogOpen(true);
                                }}
                                className="flex items-center space-x-1"
                              >
                                <Edit3 className="w-3 h-3" />
                                <span>Reagendar</span>
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleDeleteAppointment(appointment.id)}
                                className="flex items-center space-x-1 bg-red-700 hover:bg-red-800"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Excluir</span>
                              </Button>
                            </div>
                          )}

                          {/* Botões para agendamentos reagendados */}
                          {appointment.status === "rescheduled" && (
                            <div className="space-y-2">
                              <div className="flex flex-wrap gap-2">
                                {appointment.status !== "confirmed" && (
                                  <Button
                                    size="sm"
                                    onClick={() => handleConfirmAppointment(appointment.id)}
                                    className="flex items-center space-x-1"
                                  >
                                    <Check className="w-3 h-3" />
                                    <span>Confirmar</span>
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="default"
                                  onClick={() => handleStartAppointment(appointment.id)}
                                  className="flex items-center space-x-1 bg-blue-600 hover:bg-blue-700"
                                >
                                  <Play className="w-3 h-3" />
                                  <span>Iniciar</span>
                                </Button>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => handleMarkLate(appointment.id)}
                                  className="flex items-center space-x-1"
                                >
                                  <AlertCircle className="w-3 h-3" />
                                  <span>Atrasado</span>
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setRescheduleData({ ...rescheduleData, appointmentId: appointment.id });
                                    setIsRescheduleDialogOpen(true);
                                  }}
                                  className="flex items-center space-x-1"
                                >
                                  <Edit3 className="w-3 h-3" />
                                  <span>Reagendar</span>
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleMarkNoShow(appointment.id)}
                                  className="flex items-center space-x-1"
                                >
                                  <UserX className="w-3 h-3" />
                                  <span>Não Compareceu</span>
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleCancelAppointment(appointment.id)}
                                  className="flex items-center space-x-1"
                                >
                                  <X className="w-3 h-3" />
                                  <span>Cancelar</span>
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleDeleteAppointment(appointment.id)}
                                  className="flex items-center space-x-1 bg-red-700 hover:bg-red-800"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  <span>Excluir</span>
                                </Button>
                              </div>
                            </div>
                          )}

                          {/* Botões para agendamento atrasado */}
                          {appointment.status === "late" && (
                            <div className="flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => handleStartAppointment(appointment.id)}
                                className="flex items-center space-x-1 bg-blue-600 hover:bg-blue-700"
                              >
                                <Play className="w-3 h-3" />
                                <span>Iniciar</span>
                              </Button>
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => handleCompleteAppointment(appointment.id)}
                                className="flex items-center space-x-1 bg-green-600 hover:bg-green-700"
                              >
                                <CheckCircle className="w-3 h-3" />
                                <span>Concluir</span>
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleMarkNoShow(appointment.id)}
                                className="flex items-center space-x-1"
                              >
                                <UserX className="w-3 h-3" />
                                <span>Não Compareceu</span>
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleDeleteAppointment(appointment.id)}
                                className="flex items-center space-x-1 bg-red-700 hover:bg-red-800"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Excluir</span>
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Nenhum agendamento ativo para hoje 📅
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Upcoming Appointments */}
            <Card>
              <div className="p-6 border-b border-border">
                <h3 className="text-lg font-semibold text-foreground">Próximos Agendamentos</h3>
                <p className="text-sm text-muted-foreground">Agendamentos futuros confirmados</p>
              </div>
              <CardContent className="p-6">
                <div className="space-y-4" data-testid="upcoming-list">
                  {upcomingLoading ? (
                    <p className="text-sm text-muted-foreground">Carregando próximos agendamentos...</p>
                  ) : upcomingError ? (
                    <div className="flex flex-col items-center justify-center py-8 space-y-4">
                      <div className="text-lg text-red-600">⚠️ Erro ao carregar próximos agendamentos</div>
                      <div className="text-sm text-gray-600 text-center">{(upcomingError as Error).message}</div>
                    </div>
                  ) : upcomingAppointments && upcomingAppointments.length > 0 ? (
                    upcomingAppointments.map((appointment, index) => {
                      const colors = ["bg-purple-500", "bg-pink-500", "bg-indigo-500", "bg-cyan-500"];
                      return (
                        <div key={appointment.id} className="border rounded-lg p-4 mb-4 bg-blue-50 dark:bg-blue-900/20">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center space-x-4">
                              <div className={`w-2 h-2 ${colors[index % colors.length]} rounded-full`}></div>
                              <div className="flex-1">
                                <p className="text-sm font-medium text-foreground flex items-center gap-2">
                                  <Calendar className="w-4 h-4 text-blue-600" />
                                  {appointment.appointmentDate.split('-').reverse().join('/')} -
                                  <Clock className="w-4 h-4 text-orange-600" />
                                  {appointment.appointmentTime}
                                  <User className="w-4 h-4 text-green-600" />
                                  {appointment.clientName}
                                </p>
                                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                  <Phone className="w-3 h-3" />
                                  {appointment.clientPhone}
                                </p>
                                {appointment.serviceName && (
                                  <p className="text-xs text-purple-600 font-medium mt-1 flex items-center gap-1">
                                    <Star className="w-3 h-3" />
                                    Serviço: {appointment.serviceName}
                                  </p>
                                )}
                                {appointment.notes && (
                                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                    <FileText className="w-3 h-3" />
                                    Obs: {appointment.notes}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className={`px-2 py-1 text-xs rounded-full ${{
                                pending: "bg-yellow-100 text-yellow-700",
                                confirmed: "bg-blue-100 text-blue-700"
                              }[appointment.status] || "bg-gray-100 text-gray-700"}`}>
                                {{
                                  pending: "Pendente",
                                  confirmed: "Confirmado"
                                }[appointment.status] || appointment.status}
                              </span>
                            </div>
                          </div>

                          {/* Action Buttons for Upcoming Appointments */}
                          <div className="flex flex-wrap gap-2 mt-4">
                            {appointment.status !== "confirmed" && (
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => handleConfirmAppointment(appointment.id)}
                                className="flex items-center space-x-1 bg-blue-600 hover:bg-blue-700"
                              >
                                <CheckCircle className="w-3 h-3" />
                                <span>Confirmar</span>
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handleStartAppointment(appointment.id)}
                              className="flex items-center space-x-1 bg-green-600 hover:bg-green-700"
                            >
                              <Play className="w-3 h-3" />
                              <span>Iniciar</span>
                            </Button>
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handleCompleteAppointment(appointment.id)}
                              className="flex items-center space-x-1 bg-green-600 hover:bg-green-700"
                            >
                              <CheckCircle className="w-3 h-3" />
                              <span>Concluir</span>
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setRescheduleData({ ...rescheduleData, appointmentId: appointment.id });
                                setIsRescheduleDialogOpen(true);
                              }}
                              className="flex items-center space-x-1"
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>Reagendar</span>
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleMarkNoShow(appointment.id)}
                              className="flex items-center space-x-1"
                            >
                              <UserX className="w-3 h-3" />
                              <span>Não Compareceu</span>
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleCancelAppointment(appointment.id)}
                              className="flex items-center space-x-1"
                            >
                              <X className="w-3 h-3" />
                              <span>Cancelar</span>
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeleteAppointment(appointment.id)}
                              className="flex items-center space-x-1 bg-red-700 hover:bg-red-800"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Excluir</span>
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-sm text-muted-foreground">
                        Nenhum agendamento futuro 📅
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Próximos agendamentos aparecerão aqui
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Earnings Summary for Percentage-based employees */}
            {historicalAppointments && historicalAppointments.length > 0 && historicalAppointments[0]?.employeePaymentType === "percentage" && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5" />
                    Resumo de Ganhos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Serviços concluídos:</span>
                      <span className="font-medium">{historicalAppointments.filter(apt => apt.status === "completed").length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Total ganho:</span>
                      <span className="font-medium text-green-600">
                        R$ {(historicalAppointments.filter(apt => apt.status === "completed").reduce((total, apt) => total + (apt.employeeEarning || 0), 0) / 100).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Valor total dos serviços concluídos:</span>
                      <span className="font-medium">
                        R$ {(historicalAppointments.filter(apt => apt.status === "completed").reduce((total, apt) => total + (apt.servicePrice || 0), 0) / 100).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Serviços cancelados/não compareceu:</span>
                      <span className="font-medium text-red-600">{historicalAppointments.filter(apt => apt.status === "cancelled" || apt.status === "no_show").length}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Historical Appointments */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <History className="w-5 h-5" />
                    Histórico de Serviços
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="historyFilter" className="text-sm">Filtrar por:</Label>
                    <Select value={historyFilter} onValueChange={setHistoryFilter}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="day">Hoje</SelectItem>
                        <SelectItem value="week">7 dias</SelectItem>
                        <SelectItem value="month">30 dias</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  {historyLoading ? (
                    <p className="text-sm text-muted-foreground">Carregando histórico...</p>
                  ) : completedAppointments && completedAppointments.length > 0 ? (
                    completedAppointments.map((appointment, index) => {
                      const colors = ["bg-gray-400", "bg-gray-500", "bg-gray-600"];
                      return (
                        <div key={appointment.id} className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center space-x-4">
                              <div className={`w-2 h-2 ${colors[index % colors.length]} rounded-full`}></div>
                              <div className="flex-1">
                                <p className="text-sm font-medium text-foreground flex items-center gap-2">
                                  <Calendar className="w-4 h-4 text-blue-600" />
                                  {appointment.appointmentDate.split('-').reverse().join('/')} -
                                  <Clock className="w-4 h-4 text-orange-600" />
                                  {appointment.appointmentTime} -
                                  <User className="w-4 h-4 text-green-600" />
                                  {appointment.clientName}
                                </p>
                                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                  <Phone className="w-3 h-3" />
                                  {appointment.clientPhone}
                                </p>
                                {appointment.serviceName && (
                                  <p className="text-xs text-blue-600 font-medium mt-1 flex items-center gap-1">
                                    <Scissors className="w-3 h-3" />
                                    Serviço: {appointment.serviceName}
                                  </p>
                                )}
                                {appointment.servicePrice && (
                                  <p className="text-xs text-green-600 font-medium flex items-center gap-1">
                                    <DollarSign className="w-3 h-3" />
                                    Valor: R$ {(appointment.servicePrice / 100).toFixed(2)}
                                  </p>
                                )}
                                {appointment.actualStartTime && (
                                  <p className="text-xs text-blue-600 font-medium flex items-center gap-1">
                                    <Play className="w-3 h-3" />
                                    Iniciado às: {appointment.actualStartTime}
                                  </p>
                                )}
                                {appointment.actualEndTime && (
                                  <p className="text-xs text-green-600 font-medium flex items-center gap-1">
                                    <CheckCircle className="w-3 h-3" />
                                    Concluído às: {appointment.actualEndTime}
                                  </p>
                                )}
                                {appointment.actualStartTime && appointment.actualEndTime && (
                                  <p className="text-xs text-purple-600 font-medium flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    Duração real: {(() => {
                                      const [startHour, startMin] = appointment.actualStartTime.split(':').map(Number);
                                      const [endHour, endMin] = appointment.actualEndTime.split(':').map(Number);
                                      const startMinutes = startHour * 60 + startMin;
                                      const endMinutes = endHour * 60 + endMin;
                                      const duration = endMinutes - startMinutes;
                                      const hours = Math.floor(duration / 60);
                                      const minutes = duration % 60;
                                      return hours > 0 ? `${hours}h ${minutes}min` : `${minutes}min`;
                                    })()}
                                  </p>
                                )}
                                {appointment.notes && (
                                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                    <FileText className="w-3 h-3" />
                                    Obs: {appointment.notes}
                                  </p>
                                )}
                                {appointment.cancelReason && (
                                  <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" />
                                    Motivo do cancelamento: {appointment.cancelReason}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-col items-end space-y-2">
                              {getStatusBadge(appointment.status)}
                              <p className="text-xs text-muted-foreground">
                                {appointment.status === "completed" ? "✅ Finalizado" : "❌ Cancelado"}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-sm text-muted-foreground">
                        Nenhum serviço encontrado para o período selecionado 📋
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Os atendimentos finalizados aparecerão aqui
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Multas Pendentes - Only show if cancellation fee is enabled */}
          {merchantSettings?.cancellationFeeEnabled && (
            <Card className="mt-8">
              <div className="p-6 border-b border-border">
                <h3 className="text-lg font-semibold text-foreground">Multas Pendentes</h3>
                <p className="text-sm text-muted-foreground">Multas de cancelamento dos clientes</p>
              </div>
              <CardContent className="p-6">
                <div className="space-y-4">
                  {penaltiesLoading ? (
                    <p className="text-sm text-muted-foreground">Carregando multas...</p>
                  ) : penalties && penalties.length > 0 ? (
                    penalties
                      .filter(penalty => penalty.status === "pending")
                      .map((penalty) => (
                        <div key={penalty.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex-1">
                            <p className="font-medium text-foreground">{penalty.clientName}</p>
                            <p className="text-sm text-muted-foreground">{penalty.clientPhone}</p>
                            <p className="text-sm text-muted-foreground">{penalty.reason}</p>
                            <p className="text-sm text-muted-foreground">
                              Tipo: {penalty.type === "cancellation" ? "Cancelamento" : penalty.type}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-red-600">
                              R$ {(penalty.amount / 100).toFixed(2)}
                            </p>
                            <Badge variant="destructive" className="text-xs">
                              Pendente
                            </Badge>
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
                </div>
              </CardContent>
            </Card>
          )}

          

          {/* Reschedule Dialog */}
          <Dialog open={isRescheduleDialogOpen} onOpenChange={setIsRescheduleDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Reagendar Atendimento</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newDate">Nova Data</Label>
                  <Input
                    id="newDate"
                    type="date"
                    value={rescheduleData.newDate}
                    onChange={(e) => setRescheduleData(prev => ({ ...prev, newDate: e.target.value }))}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newTime">Novo Horário</Label>
                  <Input
                    id="newTime"
                    type="time"
                    value={rescheduleData.newTime}
                    onChange={(e) => setRescheduleData(prev => ({ ...prev, newTime: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reason">Motivo do Reagendamento *</Label>
                  <Textarea
                    id="reason"
                    placeholder="Explique o motivo do reagendamento..."
                    value={rescheduleData.reason}
                    onChange={(e) => setRescheduleData(prev => ({ ...prev, reason: e.target.value }))}
                    rows={3}
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsRescheduleDialogOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleReschedule}
                    disabled={rescheduleAppointmentMutation.isPending}
                  >
                    {rescheduleAppointmentMutation.isPending ? "Reagendando..." : "Reagendar"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Account Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Configurações da Conta</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-w-md">
                <ChangePasswordForm />
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}