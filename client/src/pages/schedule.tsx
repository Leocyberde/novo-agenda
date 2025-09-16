import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Calendar, Clock, Phone, Mail, Plus, Edit, Trash2, User, DollarSign, UserCheck } from "lucide-react";
import { authService } from "@/lib/auth";
import { toast } from "@/hooks/use-toast";

interface Appointment {
  id: string;
  serviceId: string;
  clientName: string;
  clientPhone: string;
  clientEmail?: string;
  appointmentDate: string;
  appointmentTime: string;
  status: "pending" | "scheduled" | "confirmed" | "in_progress" | "completed" | "cancelled" | "late" | "no_show" | "rescheduled";
  notes?: string;
  createdAt: string;
  serviceName?: string;
  servicePrice?: number;
  employeeName?: string;
  employeeId?: string;
  actualStartTime?: string;
  actualEndTime?: string;
  rescheduleReason?: string;
  newDate?: string;
  newTime?: string;
  arrivalTime?: string;
}

export default function Schedule() {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [user, setUser] = useState(authService.getState().user);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    const unsubscribe = authService.subscribe((state) => {
      setUser(state.user);
    });
    return unsubscribe;
  }, []);

  // Fetch appointments for selected date
  const { data: appointments, isLoading } = useQuery<Appointment[]>({
    queryKey: ["/api/appointments", { date: selectedDate }],
    queryFn: async () => {
      const response = await fetch(`/api/appointments?date=${selectedDate}`, {
        headers: {
          'Authorization': `Bearer ${authService.getState().token}`,
        },
      });
      if (!response.ok) {
        throw new Error('Failed to fetch appointments');
      }
      return response.json();
    },
    enabled: authService.getState().isAuthenticated && user?.role === "merchant",
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const response = await fetch(`/api/appointments/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          'Authorization': `Bearer ${authService.getState().token}`,
        },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao atualizar agendamento");
      }

      return response.json();
    },
    onSuccess: async () => {
      toast({
        title: "Sucesso!",
        description: "Status do agendamento atualizado",
      });
      // Invalidate all appointment-related queries to sync all dashboards
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/client/appointments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/employee/appointments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/appointments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/merchants/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/client/occupied-times"] });
      queryClient.invalidateQueries({ queryKey: ["/api/client/availability"] });

      // Force refetch to update state immediately
      await queryClient.refetchQueries({ queryKey: ["/api/appointments"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteAppointmentMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/appointments/${id}`, {
        method: "DELETE",
        headers: {
          'Authorization': `Bearer ${authService.getState().token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao excluir agendamento");
      }
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

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { label: "Pendente", variant: "secondary" as const },
      scheduled: { label: "Agendado", variant: "secondary" as const },
      confirmed: { label: "Confirmado", variant: "default" as const },
      in_progress: { label: "Em Andamento", variant: "default" as const },
      completed: { label: "Concluído", variant: "secondary" as const },
      cancelled: { label: "Cancelado", variant: "destructive" as const },
      late: { label: "Atrasado", variant: "destructive" as const },
      no_show: { label: "Não Compareceu", variant: "destructive" as const },
      rescheduled: { label: "Reagendado", variant: "secondary" as const },
    };

    // Verificar se o status existe e não é undefined/null
    if (!status) {
      return (
        <Badge variant="secondary">
          Desconhecido
        </Badge>
      );
    }

    const config = statusConfig[status as keyof typeof statusConfig];

    // Se o status não existe no config, usar um padrão
    if (!config) {
      return (
        <Badge variant="secondary">
          {status}
        </Badge>
      );
    }

    return (
      <Badge variant={config.variant}>
        {config.label}
      </Badge>
    );
  };

  const handleStatusChange = (appointmentId: string, newStatus: string) => {
    updateStatusMutation.mutate({ id: appointmentId, status: newStatus });
  };

  const handleDeleteAppointment = (appointmentId: string) => {
    if (confirm("Tem certeza que deseja excluir este agendamento?")) {
      deleteAppointmentMutation.mutate(appointmentId);
    }
  };

  const filteredAppointments = appointments?.filter(appointment => {
    if (statusFilter === "all") return true;
    return appointment.status === statusFilter;
  }) || [];

  const sortedAppointments = filteredAppointments.sort((a, b) =>
    a.appointmentTime.localeCompare(b.appointmentTime)
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-border">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                onClick={() => setLocation("/merchant-dashboard")}
                variant="ghost"
                size="sm"
                className="flex items-center space-x-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar</span>
              </Button>
              <h1 className="text-2xl font-bold text-foreground">Agenda</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Button
                onClick={() => setLocation("/new-appointment")}
                className="flex items-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>Novo Agendamento</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="p-6">
        <div className="space-y-6">
          {/* Filters */}
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <Input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-auto"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-muted-foreground">Status:</span>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-auto min-w-[150px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="pending">Pendente</SelectItem>
                      <SelectItem value="scheduled">Agendado</SelectItem>
                      <SelectItem value="confirmed">Confirmado</SelectItem>
                      <SelectItem value="in_progress">Em Andamento</SelectItem>
                      <SelectItem value="completed">Concluído</SelectItem>
                      <SelectItem value="cancelled">Cancelado</SelectItem>
                      <SelectItem value="late">Atrasado</SelectItem>
                      <SelectItem value="no_show">Não Compareceu</SelectItem>
                      <SelectItem value="rescheduled">Reagendado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Appointments List */}
          <div className="space-y-4">
            {isLoading ? (
              <Card>
                <CardContent className="p-6">
                  <p className="text-muted-foreground">Carregando agendamentos...</p>
                </CardContent>
              </Card>
            ) : sortedAppointments.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    {appointments?.length === 0
                      ? "Nenhum agendamento para esta data"
                      : "Nenhum agendamento encontrado com os filtros aplicados"}
                  </p>
                  <Button
                    onClick={() => setLocation("/new-appointment")}
                    className="mt-4"
                  >
                    Criar Novo Agendamento
                  </Button>
                </CardContent>
              </Card>
            ) : (
              sortedAppointments.map((appointment) => (
                <Card key={appointment.id}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-3">
                        {/* Status e Horário */}
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center space-x-2">
                            <Clock className="w-4 h-4 text-orange-600" />
                            <span className="font-medium text-lg">
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
                                      - Finalizado: {appointment.actualEndTime}
                                    </span>
                                  )}
                                </>
                              ) : (
                                <>
                                  {appointment.appointmentTime}
                                  <span className="text-gray-500 text-xs ml-1">(agendado)</span>
                                </>
                              )}
                            </span>
                          </div>
                          {getStatusBadge(appointment.status)}
                        </div>

                        {/* Informações do Cliente */}
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <User className="w-4 h-4 text-green-600" />
                            <span className="font-medium text-foreground">{appointment.clientName}</span>
                          </div>
                          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                            <Phone className="w-4 h-4 text-blue-600" />
                            <span>{appointment.clientPhone}</span>
                          </div>
                          {appointment.clientEmail && (
                            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                              <Mail className="w-4 h-4 text-cyan-600" />
                              <span>{appointment.clientEmail}</span>
                            </div>
                          )}
                        </div>

                        {/* Informações do Serviço */}
                        {appointment.serviceName && (
                          <div className="flex items-center space-x-2">
                            <Calendar className="w-4 h-4 text-purple-600" />
                            <span className="text-sm font-medium text-purple-600">
                              Serviço: {appointment.serviceName}
                            </span>
                          </div>
                        )}

                        {/* Preço do Serviço */}
                        {appointment.servicePrice !== undefined && (
                          <div className="flex items-center space-x-2">
                            <DollarSign className="w-4 h-4 text-green-600" />
                            <span className="text-sm font-medium text-green-600">
                              Valor: R$ {(appointment.servicePrice / 100).toFixed(2)}
                            </span>
                          </div>
                        )}

                        {/* Funcionário Responsável */}
                        {appointment.employeeName && (
                          <div className="flex items-center space-x-2">
                            <UserCheck className="w-4 h-4 text-blue-600" />
                            <span className="text-sm font-medium text-blue-600">
                              Atendente: {appointment.employeeName}
                            </span>
                          </div>
                        )}

                        {/* Duração Real */}
                        {appointment.actualStartTime && appointment.actualEndTime && (
                          <div className="flex items-center space-x-2">
                            <Clock className="w-4 h-4 text-purple-600" />
                            <span className="text-xs text-purple-600 font-medium">
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
                            </span>
                          </div>
                        )}


                        {/* Observações */}
                        {appointment.notes && (
                          <div className="flex items-start space-x-2">
                            <Edit className="w-4 h-4 text-muted-foreground mt-0.5" />
                            <span className="text-sm text-muted-foreground">
                              Obs: {appointment.notes}
                            </span>
                          </div>
                        )}

                        {/* Motivo do Reagendamento */}
                        {appointment.rescheduleReason && (
                          <div className="flex items-start space-x-2">
                            <Calendar className="w-4 h-4 text-orange-600 mt-0.5" />
                            <span className="text-sm text-orange-600">
                              Motivo do reagendamento: {appointment.rescheduleReason}
                            </span>
                          </div>
                        )}

                        {/* Data de Reagendamento */}
                        {appointment.status === "rescheduled" && appointment.newDate && appointment.newTime && (
                          <div className="flex items-center space-x-2">
                            <Calendar className="w-4 h-4 text-blue-600" />
                            <span className="text-sm font-medium text-blue-600">
                              Reagendado para: {new Date(appointment.newDate).toLocaleDateString('pt-BR')} às {appointment.newTime}
                            </span>
                          </div>
                        )}

                        {/* Horário de Chegada */}
                        {appointment.arrivalTime && (
                          <div className="flex items-center space-x-2">
                            <Clock className="w-4 h-4 text-green-600" />
                            <span className="text-sm text-green-600 font-medium">
                              Chegada: {appointment.arrivalTime}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center space-x-2">
                        {(appointment.status === "pending" || appointment.status === "scheduled") && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleStatusChange(appointment.id, "confirmed")}
                          >
                            Confirmar
                          </Button>
                        )}
                        {appointment.status === "confirmed" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleStatusChange(appointment.id, "in_progress")}
                          >
                            Iniciar
                          </Button>
                        )}
                        {appointment.status === "in_progress" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleStatusChange(appointment.id, "completed")}
                          >
                            Concluir
                          </Button>
                        )}
                        <Select
                          value={appointment.status}
                          onValueChange={(status) => handleStatusChange(appointment.id, status)}
                        >
                          <SelectTrigger className="w-auto">
                            <Edit className="w-4 h-4" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pendente</SelectItem>
                            <SelectItem value="scheduled">Agendado</SelectItem>
                            <SelectItem value="confirmed">Confirmado</SelectItem>
                            <SelectItem value="in_progress">Em Andamento</SelectItem>
                            <SelectItem value="completed">Concluído</SelectItem>
                            <SelectItem value="cancelled">Cancelado</SelectItem>
                            <SelectItem value="late">Atrasado</SelectItem>
                            <SelectItem value="no_show">Não Compareceu</SelectItem>
                            <SelectItem value="rescheduled">Reagendado</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteAppointment(appointment.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}