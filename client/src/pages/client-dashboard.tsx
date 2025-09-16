import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { authService } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, Clock, User, Phone, Mail, MapPin, Store, ImageIcon, Star, Sparkles, X, CalendarDays, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import ChangePasswordForm from "@/components/auth/change-password-form";

interface User {
  id: string;
  email: string;
  role: string;
  name?: string;
  phone?: string;
  merchantId?: string;
}

interface Appointment {
  id: string;
  merchantId: string;
  serviceId: string;
  clientId?: string;
  employeeId?: string;
  clientName: string;
  clientPhone: string;
  clientEmail?: string;
  appointmentDate: string;
  appointmentTime: string;
  notes?: string;
  status: string;
  createdAt: string;
  serviceName?: string;
  servicePrice?: number;
  employeeName?: string;
  rescheduleReason?: string; // Adicionado campo para motivo de reagendamento
  actualStartTime?: string; // Novo campo para horário de início real
  actualEndTime?: string; // Novo campo para horário de fim real
  cancelReason?: string; // Campo para motivo de cancelamento
}

interface Service {
  id: string;
  name: string;
  description?: string;
  price: number;
  duration: number;
  isActive: boolean;
  merchantId: string;
}

interface Merchant {
  id: string;
  name: string;
  address: string;
  phone: string;
  logoUrl?: string;
  isOpen: boolean;
  workDays: string;
  startTime: string;
  endTime: string;
  breakStartTime?: string;
  breakEndTime?: string;
}

interface MerchantPolicies {
  cancellationFeeEnabled: boolean;
  cancellationFeeAmount: number;
  cancellationPolicyHours: number;
}

interface AppointmentsResponse {
  appointments: Appointment[];
  merchantPolicies: MerchantPolicies;
}

export default function ClientDashboard() {
  const [, setLocation] = useLocation();
  const [user, setUser] = useState<User | null>(authService.getState().user);
  const [historyFilter, setHistoryFilter] = useState("month"); // day, week, month
  const [merchantPolicies, setMerchantPolicies] = useState<MerchantPolicies | null>(null);
  const { toast } = useToast();

  // Reschedule modal state
  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [rescheduleReason, setRescheduleReason] = useState<string>("");
  const [availableTimeSlots, setAvailableTimeSlots] = useState<string[]>([]);

  useEffect(() => {
    const unsubscribe = authService.subscribe((state) => {
      setUser(state.user);
    });
    return unsubscribe;
  }, []);

  // Function to check if appointment can be cancelled/rescheduled
  const canModifyAppointment = (appointment: Appointment) => {
    // Clientes podem cancelar/reagendar apenas agendamentos pendentes ou confirmados
    if (!["pending", "confirmed"].includes(appointment.status)) {
      return false;
    }

    // Verificar se está dentro do prazo definido pelo merchant
    const now = new Date();

    // Parse the appointment date and time correctly
    // appointmentDate format: "YYYY-MM-DD", appointmentTime format: "HH:MM"
    const appointmentDateTime = new Date(`${appointment.appointmentDate}T${appointment.appointmentTime}:00`);

    const timeDiff = appointmentDateTime.getTime() - now.getTime();
    const hoursDiff = timeDiff / (1000 * 60 * 60);
    const policyHours = merchantPolicies?.cancellationPolicyHours || 24;

    console.log("DEBUG canModifyAppointment:", {
      appointmentDate: appointment.appointmentDate,
      appointmentTime: appointment.appointmentTime,
      appointmentDateTime: appointmentDateTime.toISOString(),
      now: now.toISOString(),
      hoursDiff: hoursDiff.toFixed(2),
      policyHours,
      canModify: hoursDiff >= policyHours
    });

    // Só pode reagendar se faltarem mais horas que a política exige
    return hoursDiff > policyHours;
  };

  // Function to check if appointment can be cancelled
  const canCancelAppointment = (appointment: Appointment) => {
    // Clientes podem cancelar apenas agendamentos confirmados
    if (appointment.status !== "confirmed") {
      return false;
    }

    return true; // Cliente pode sempre cancelar, mas pode haver multa
  };

  // Function to check if appointment can be cancelled
  const willHaveCancellationFee = (appointment: Appointment) => {
    console.log("=== CHECKING CANCELLATION FEE ===");
    console.log("Merchant policies:", merchantPolicies);
    console.log("Appointment:", {
      id: appointment.id,
      date: appointment.appointmentDate,
      time: appointment.appointmentTime,
      status: appointment.status
    });

    if (!merchantPolicies?.cancellationFeeEnabled) {
      console.log("❌ Cancellation fee is DISABLED for this merchant");
      return false;
    }

    console.log("✅ Cancellation fee is ENABLED for this merchant");

    const now = new Date();

    // Parse the appointment date and time correctly using ISO format
    // appointmentDate format: "YYYY-MM-DD", appointmentTime format: "HH:MM"
    const appointmentDateTime = new Date(`${appointment.appointmentDate}T${appointment.appointmentTime}:00`);

    const timeDiff = appointmentDateTime.getTime() - now.getTime();
    const hoursDiff = timeDiff / (1000 * 60 * 60);
    const policyHours = merchantPolicies.cancellationPolicyHours || 24;

    console.log("Time calculation:", {
      now: now.toISOString(),
      appointmentDateTimeISO: `${appointment.appointmentDate}T${appointment.appointmentTime}:00`,
      appointmentDateTime: appointmentDateTime.toISOString(),
      timeDiff: timeDiff,
      hoursDiff: hoursDiff.toFixed(2),
      policyHours: policyHours,
      feeAmount: merchantPolicies.cancellationFeeAmount
    });

    // Haverá multa se cancelar com menos tempo que a política exige
    const willHaveFee = hoursDiff < policyHours;

    console.log(`⚖️ DECISION: ${willHaveFee ? 'WILL HAVE FEE' : 'NO FEE'} - ${hoursDiff.toFixed(2)}h remaining vs ${policyHours}h policy`);
    console.log("=== END CHECKING CANCELLATION FEE ===");

    return willHaveFee;
  };

  // Function to get cancellation fee amount in reais
  const getCancellationFeeAmount = () => {
    if (!merchantPolicies?.cancellationFeeAmount) return 0;
    return merchantPolicies.cancellationFeeAmount / 100; // Convert from cents to reais
  };

  // Mutation to cancel appointment
  const cancelAppointmentMutation = useMutation({
    mutationFn: async ({ appointmentId, reason }: { appointmentId: string; reason: string }) => {
      const response = await apiRequest('POST', `/api/client/appointments/${appointmentId}/cancel`, { reason });
      return response.json();
    },
    onSuccess: (data: any) => {
      // Invalidate all related queries to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ["/api/client/appointments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/client/appointments/history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/client/penalties"] });

      // Force refetch to get updated data immediately
      queryClient.refetchQueries({ queryKey: ["/api/client/appointments"] });
      queryClient.refetchQueries({ queryKey: ["/api/client/penalties"] });

      const { cancellationFee } = data;
      let message = "Seu agendamento foi cancelado com sucesso.";

      if (cancellationFee?.hasFee) {
        message += ` Foi aplicada uma multa de R$ ${cancellationFee.amountInReais.toFixed(2)}.`;
      } else {
        message += " Não foi aplicada multa.";
      }

      toast({
        title: "Agendamento cancelado",
        description: message,
        variant: cancellationFee?.hasFee ? "default" : "default",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao cancelar",
        description: error.message || "Não foi possível cancelar o agendamento.",
        variant: "destructive",
      });
    }
  });

  // Mutation to reschedule appointment
  const rescheduleAppointmentMutation = useMutation({
    mutationFn: async ({ appointmentId, newDate, newTime, reason }: {
      appointmentId: string;
      newDate: string;
      newTime: string;
      reason: string;
    }) => {
      return apiRequest('POST', `/api/client/appointments/${appointmentId}/reschedule`, { newDate, newTime, reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client/appointments"] });
      toast({
        title: "Agendamento reagendado",
        description: "Seu agendamento foi reagendado com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao reagendar",
        description: error.message || "Não foi possível reagendar o agendamento.",
        variant: "destructive",
      });
    }
  });

  // Function to handle appointment cancellation
  const handleCancelAppointment = (appointment: Appointment) => {
    console.log("=== CANCELAMENTO DEBUG ===");
    console.log("Appointment:", appointment);
    console.log("Merchant policies:", merchantPolicies);

    const hasFee = willHaveCancellationFee(appointment);
    const feeAmount = getCancellationFeeAmount();

    console.log("Fee calculation result:", { hasFee, feeAmount });

    const now = new Date();
    const appointmentDateTime = new Date(`${appointment.appointmentDate}T${appointment.appointmentTime}:00`);
    const timeDiff = appointmentDateTime.getTime() - now.getTime();
    const hoursDiff = timeDiff / (1000 * 60 * 60);
    const policyHours = merchantPolicies?.cancellationPolicyHours || 24;

    let message = "Por favor, informe o motivo do cancelamento:";
    if (hasFee) {
      message = `⚠️ ATENÇÃO: Este cancelamento terá uma multa de R$ ${feeAmount.toFixed(2)}.\n\n` +
                `Motivo: Cancelamento com menos de ${policyHours}h de antecedência (${hoursDiff.toFixed(1)}h restantes).\n\n` +
                `Por favor, informe o motivo do cancelamento:`;
    }

    const reason = prompt(message);
    if (reason && reason.trim()) {
      cancelAppointmentMutation.mutate({
        appointmentId: appointment.id,
        reason: reason.trim(),
      });
    }
  };

  // Function to handle appointment rescheduling
  const handleRescheduleAppointment = (appointmentId: string) => {
    setSelectedAppointmentId(appointmentId);
    setSelectedDate(undefined);
    setSelectedTime("");
    setRescheduleReason("");
    setAvailableTimeSlots([]);
    setRescheduleModalOpen(true);
  };

  // Function to handle date selection and load available times
  const handleDateSelection = async (date: Date | undefined) => {
    setSelectedDate(date);
    setSelectedTime("");

    if (date) {
      const dateStr = format(date, "yyyy-MM-dd");
      try {
        // Generate time slots (9:00 to 18:00, 30-minute intervals)
        const slots = [];
        for (let hour = 9; hour < 18; hour++) {
          slots.push(`${hour.toString().padStart(2, '0')}:00`);
          slots.push(`${hour.toString().padStart(2, '0')}:30`);
        }
        setAvailableTimeSlots(slots);
      } catch (error) {
        console.error("Error loading time slots:", error);
        setAvailableTimeSlots([]);
      }
    }
  };

  // Function to submit reschedule
  const handleSubmitReschedule = () => {
    if (!selectedDate || !selectedTime || !rescheduleReason.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha todos os campos.",
        variant: "destructive",
      });
      return;
    }

    const newDate = format(selectedDate, "yyyy-MM-dd");
    rescheduleAppointmentMutation.mutate({
      appointmentId: selectedAppointmentId,
      newDate,
      newTime: selectedTime,
      reason: rescheduleReason.trim()
    });

    setRescheduleModalOpen(false);
  };

  // Fetch client's appointments
  const { data: appointmentsData, isLoading: appointmentsLoading } = useQuery<AppointmentsResponse>({
    queryKey: ["/api/client/appointments"],
    queryFn: async () => {
      const response = await fetch(`/api/client/appointments`, {
        headers: {
          'Authorization': `Bearer ${authService.getState().token}`,
        },
      });
      if (!response.ok) {
        throw new Error("Erro ao carregar agendamentos");
      }
      return response.json();
    },
    enabled: authService.getState().isAuthenticated && user?.role === "client",
  });

  // Update merchant policies when appointments data is received
  useEffect(() => {
    if (appointmentsData?.merchantPolicies) {
      console.log("=== APPOINTMENTS DATA RECEIVED ===");
      console.log("Merchant policies from server:", appointmentsData.merchantPolicies);
      console.log("Appointments count:", appointmentsData.appointments?.length || 0);
      setMerchantPolicies(appointmentsData.merchantPolicies);
      console.log("=== END APPOINTMENTS DATA ===");
    }
  }, [appointmentsData]);

  const clientAppointments = appointmentsData?.appointments || [];

  // Fetch available services
  const { data: availableServices = [] } = useQuery<Service[]>({
    queryKey: ["/api/client/services"],
    queryFn: async () => {
      const response = await fetch(`/api/client/services`, {
        headers: {
          'Authorization': `Bearer ${authService.getState().token}`,
        },
      });
      if (!response.ok) {
        throw new Error("Erro ao carregar serviços");
      }
      return response.json();
    },
    enabled: authService.getState().isAuthenticated && user?.role === "client",
  });

  // Fetch historical appointments with filter
  const { data: historicalAppointments = [], isLoading: historyLoading } = useQuery<Appointment[]>({
    queryKey: ["/api/client/appointments/history", historyFilter],
    queryFn: async () => {
      const response = await fetch(`/api/client/appointments/history?filter=${historyFilter}`, {
        headers: {
          'Authorization': `Bearer ${authService.getState().token}`,
        },
      });
      if (!response.ok) {
        throw new Error("Erro ao carregar histórico");
      }
      return response.json();
    },
    enabled: authService.getState().isAuthenticated && user?.role === "client",
  });

  // Fetch available merchants
  const { data: availableMerchants = [] } = useQuery<Merchant[]>({
    queryKey: ["/api/client/merchants"],
    queryFn: async () => {
      const response = await fetch(`/api/client/merchants`, {
        headers: {
          'Authorization': `Bearer ${authService.getState().token}`,
        },
      });
      if (!response.ok) {
        throw new Error("Erro ao carregar salões");
      }
      return response.json();
    },
    enabled: authService.getState().isAuthenticated && user?.role === "client",
  });

  // Fetch client penalties (multas)
  const { data: clientPenalties = [], isLoading: penaltiesLoading } = useQuery<any[]>({
    queryKey: ["/api/client/penalties"],
    queryFn: async () => {
      const response = await fetch("/api/client/penalties", {
        headers: {
          "Authorization": `Bearer ${authService.getState().token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          return []; // No penalties found
        }
        throw new Error("Erro ao buscar multas");
      }

      return response.json();
    },
    enabled: authService.getState().isAuthenticated && user?.role === "client",
    refetchInterval: 30000, // Refetch every 30 seconds to check if penalties were paid
  });

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { label: "Pendente", variant: "outline" as const },
      scheduled: { label: "Agendado", variant: "default" as const },
      confirmed: { label: "Confirmado", variant: "secondary" as const },
      in_progress: { label: "Em Andamento", variant: "default" as const },
      completed: { label: "Concluído", variant: "secondary" as const },
      cancelled: { label: "Cancelado", variant: "destructive" as const },
      late: { label: "Atrasado", variant: "destructive" as const },
      no_show: { label: "Não Compareceu", variant: "destructive" as const },
      rescheduled: { label: "Reagendado", variant: "outline" as const },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  // Format currency helper
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value / 100); // Convert cents to reais
  };

  // Format working days
  const formatWorkDays = (workDaysStr: string) => {
    const weekDaysMap = {
      0: "Dom", 1: "Seg", 2: "Ter", 3: "Qua", 4: "Qui", 5: "Sex", 6: "Sáb"
    };

    try {
      const workDays = JSON.parse(workDaysStr || "[]");
      return workDays.map((day: number) => weekDaysMap[day as keyof typeof weekDaysMap]).join(", ");
    } catch {
      return "Não informado";
    }
  };

  // Separate upcoming and past appointments
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // Start of today, ignoring time

  const upcomingAppointments = clientAppointments.filter(apt => {
    const appointmentDate = new Date(apt.appointmentDate + 'T00:00:00'); // Ensure local date parsing
    return appointmentDate >= today && (apt.status === "pending" || apt.status === "scheduled" || apt.status === "confirmed" || apt.status === "late" || apt.status === "in_progress");
  }).sort((a, b) => new Date(a.appointmentDate).getTime() - new Date(b.appointmentDate).getTime());

  // Get completed appointments from both current and historical data
  const completedFromCurrent = clientAppointments.filter(apt => apt.status === "completed");
  const completedFromHistory = historicalAppointments.filter(apt => apt.status === "completed");

  // Combine and deduplicate completed appointments
  const allCompleted = [...completedFromCurrent, ...completedFromHistory];
  const uniqueCompleted = allCompleted.filter((apt, index, self) =>
    index === self.findIndex(t => t.id === apt.id)
  );

  const pastAppointments = [...uniqueCompleted, ...historicalAppointments.filter(apt => apt.status === "cancelled")]
    .sort((a, b) => new Date(b.appointmentDate).getTime() - new Date(a.appointmentDate).getTime());

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Carregando...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-accent/10 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Meus Agendamentos</h1>
            <p className="text-muted-foreground">Bem-vindo(a), {user.name}!</p>
          </div>
          <div className="flex items-center space-x-3">
            <Button
              onClick={() => setLocation("/client-booking")}
              className="flex items-center space-x-2"
            >
              <CalendarIcon className="w-4 h-4" />
              <span>Novo Agendamento</span>
            </Button>
            <Button
              onClick={() => authService.logout()}
              variant="outline"
            >
              Sair
            </Button>
          </div>
        </div>

        {/* Client Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Meus Dados
            </CardTitle>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <span>{user.email}</span>
            </div>
            {user.phone && (
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <span>{user.phone}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-3 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <CalendarIcon className="w-8 h-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{upcomingAppointments.length}</p>
                  <p className="text-sm text-muted-foreground">Próximos Agendamentos</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <Clock className="w-8 h-8 text-green-600" />
                <div>
                  <p className="text-2xl font-bold">{uniqueCompleted.length}</p>
                  <p className="text-sm text-muted-foreground">Serviços Realizados</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <MapPin className="w-8 h-8 text-blue-600" />
                <div>
                  <p className="text-2xl font-bold">{availableServices.length}</p>
                  <p className="text-sm text-muted-foreground">Serviços Disponíveis</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Available Salons */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="w-5 h-5" />
              Salões Disponíveis
            </CardTitle>
            <CardDescription>
              Conheça os salões onde você pode agendar seus serviços
            </CardDescription>
          </CardHeader>
          <CardContent>
            {availableMerchants.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Nenhum salão disponível no momento.
              </p>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {availableMerchants.map((merchant) => (
                  <Card key={merchant.id} className="border border-border hover:shadow-md transition-shadow" data-testid={`card-merchant-${merchant.id}`}>
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        {/* Logo and Name */}
                        <div className="flex items-center space-x-3">
                          {merchant.logoUrl ? (
                            <img
                              src={merchant.logoUrl.startsWith('/uploads/') ? `${window.location.origin}${merchant.logoUrl}` : merchant.logoUrl}
                              alt={`Logo ${merchant.name}`}
                              className="w-12 h-12 rounded-full object-cover border-2 border-border"
                              data-testid={`img-merchant-logo-${merchant.id}`}
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center border-2 border-border">
                              <ImageIcon className="w-6 h-6 text-muted-foreground" />
                            </div>
                          )}
                          <div>
                            <h3 className="font-semibold text-foreground" data-testid={`text-merchant-name-${merchant.id}`}>
                              {merchant.name}
                            </h3>
                            <div className="flex items-center space-x-2">
                              <Badge variant={merchant.isOpen ? "default" : "secondary"} data-testid={`badge-status-${merchant.id}`}>
                                {merchant.isOpen ? "Aberto" : "Fechado"}
                              </Badge>
                            </div>
                          </div>
                        </div>

                        {/* Contact Info */}
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center space-x-2 text-muted-foreground">
                            <MapPin className="w-4 h-4" />
                            <span data-testid={`text-merchant-address-${merchant.id}`}>{merchant.address}</span>
                          </div>
                          <div className="flex items-center space-x-2 text-muted-foreground">
                            <Phone className="w-4 h-4" />
                            <span data-testid={`text-merchant-phone-${merchant.id}`}>{merchant.phone}</span>
                          </div>
                        </div>

                        {/* Working Hours */}
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center space-x-2 text-muted-foreground">
                            <CalendarIcon className="w-4 h-4" />
                            <span data-testid={`text-merchant-days-${merchant.id}`}>{formatWorkDays(merchant.workDays)}</span>
                          </div>
                          <div className="flex items-center space-x-2 text-muted-foreground">
                            <Clock className="w-4 h-4" />
                            <span data-testid={`text-merchant-hours-${merchant.id}`}>
                              {merchant.startTime} - {merchant.endTime}
                              {merchant.breakStartTime && merchant.breakEndTime && (
                                ` (Pausa: ${merchant.breakStartTime} - ${merchant.breakEndTime})`
                              )}
                            </span>
                          </div>
                        </div>

                        {/* Action Button */}
                        <Button
                          onClick={() => setLocation("/client-booking")}
                          className="w-full mt-4"
                          disabled={!merchant.isOpen}
                          data-testid={`button-book-${merchant.id}`}
                        >
                          {merchant.isOpen ? "Agendar Serviço" : "Salão Fechado"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Multas Pendentes - Only show if cancellation fee is enabled and there are penalties */}
        {merchantPolicies?.cancellationFeeEnabled && clientPenalties && clientPenalties.filter(p => p.status === "pending").length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-red-600" />
                Multas Pendentes
              </CardTitle>
              <CardDescription>
                Multas de cancelamento que devem ser pagas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {clientPenalties
                  .filter(penalty => penalty.status === "pending")
                  .map((penalty) => {
                    // Buscar o agendamento relacionado para mostrar detalhes
                    const relatedAppointment = [...upcomingAppointments, ...pastAppointments].find(
                      apt => apt.id === penalty.appointmentId
                    );

                    return (
                      <div key={penalty.id} className="border border-red-200 rounded-lg p-4 bg-red-50 dark:bg-red-950/20">
                        <div className="flex justify-between items-start mb-2">
                          <div className="space-y-1">
                            <h4 className="font-semibold text-red-800 dark:text-red-200">
                              Multa de {penalty.type === "cancellation" ? "Cancelamento" : penalty.type}
                            </h4>
                            <p className="text-sm text-red-600 dark:text-red-400">{penalty.reason}</p>
                            <p className="text-xs text-muted-foreground">
                              Multa criada em: {format(new Date(penalty.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-red-600 dark:text-red-400">
                              R$ {(penalty.amount / 100).toFixed(2)}
                            </p>
                            <Badge variant="destructive" className="text-xs">
                              Pendente
                            </Badge>
                          </div>
                        </div>

                        {/* Informações do agendamento cancelado */}
                        {relatedAppointment && (
                          <div className="mt-3 p-3 bg-gray-100 dark:bg-gray-800 rounded border-l-4 border-blue-400">
                            <h5 className="font-medium text-gray-800 dark:text-gray-200 mb-2 flex items-center gap-2">
                              <CalendarIcon className="w-4 h-4" />
                              Informações do Agendamento Cancelado
                            </h5>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                              {/* Serviço */}
                              <div className="flex items-center gap-2">
                                <Star className="w-4 h-4 text-blue-600" />
                                <div>
                                  <span className="font-medium">Serviço:</span>
                                  <p className="text-blue-600">{relatedAppointment.serviceName || 'Serviço'}</p>
                                </div>
                              </div>

                              {/* Funcionário */}
                              {relatedAppointment.employeeName && (
                                <div className="flex items-center gap-2">
                                  <Sparkles className="w-4 h-4 text-purple-600" />
                                  <div>
                                    <span className="font-medium">Funcionário:</span>
                                    <p className="text-purple-600">{relatedAppointment.employeeName}</p>
                                  </div>
                                </div>
                              )}

                              {/* Data e hora */}
                              <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-green-600" />
                                <div>
                                  <span className="font-medium">Data/Hora:</span>
                                  <p className="text-green-600">
                                    {format(new Date(relatedAppointment.appointmentDate + 'T12:00:00'), "dd/MM/yyyy", { locale: ptBR })} às {relatedAppointment.appointmentTime}
                                  </p>
                                </div>
                              </div>

                              {/* Preço do serviço */}
                              {relatedAppointment.servicePrice && (
                                <div className="flex items-center gap-2">
                                  <DollarSign className="w-4 h-4 text-orange-600" />
                                  <div>
                                    <span className="font-medium">Valor do serviço:</span>
                                    <p className="text-orange-600">{formatCurrency(relatedAppointment.servicePrice)}</p>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Motivo do cancelamento */}
                            {relatedAppointment.cancelReason && (
                              <div className="mt-3 p-2 bg-white dark:bg-gray-700 rounded">
                                <div className="flex items-start gap-2">
                                  <X className="w-4 h-4 text-red-500 mt-0.5" />
                                  <div>
                                    <span className="font-medium text-red-600">Motivo do cancelamento:</span>
                                    <p className="text-red-500 text-sm mt-1">{relatedAppointment.cancelReason}</p>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="mt-3 p-3 bg-white dark:bg-gray-800 rounded border-l-4 border-red-400">
                          <p className="text-sm text-gray-700 dark:text-gray-300">
                            <strong>Como pagar:</strong> Entre em contato com o salão para quitar esta multa.
                            Após o pagamento, ela será marcada como paga pelo estabelecimento e será removida desta lista.
                          </p>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Upcoming Appointments */}
        {upcomingAppointments.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="w-5 h-5" />
                Próximos Agendamentos
              </CardTitle>
              <CardDescription>
                Seus agendamentos confirmados
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {upcomingAppointments.map((appointment) => (
                  <div key={appointment.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 mb-2">
                          <Star className="w-4 h-4 text-primary" />
                          <h4 className="font-semibold">{appointment.serviceName || 'Serviço'}</h4>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <CalendarIcon className="w-4 h-4" />
                          <span>
                            {format(new Date(appointment.appointmentDate + 'T12:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                          </span>
                          <Clock className="w-4 h-4 ml-2" />
                          <span>
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
                                <span className="text-gray-500 text-xs ml-1">(agendado)</span>
                              </>
                            )}
                          </span>
                        </div>
                        {appointment.employeeName && (
                          <div className="flex items-center gap-2 text-sm text-blue-600 font-medium">
                            <Sparkles className="w-4 h-4" />
                            <span>Especialista: {appointment.employeeName}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {getStatusBadge(appointment.status)}
                        {(appointment.status === "pending" || canModifyAppointment(appointment) || canCancelAppointment(appointment)) && (
                          <div className="flex gap-2 mt-2">
                            {(appointment.status === "pending" || canModifyAppointment(appointment)) && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRescheduleAppointment(appointment.id)}
                                disabled={rescheduleAppointmentMutation.isPending}
                                className="flex items-center gap-1"
                                data-testid={`button-reschedule-${appointment.id}`}
                              >
                                <CalendarDays className="w-3 h-3" />
                                Reagendar
                              </Button>
                            )}
                            {appointment.status === "confirmed" && canCancelAppointment(appointment) && (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleCancelAppointment(appointment)}
                                disabled={cancelAppointmentMutation.isPending}
                                className="flex items-center gap-1"
                                data-testid={`button-cancel-${appointment.id}`}
                                title={willHaveCancellationFee(appointment)
                                  ? `⚠️ Cancelamento com multa de R$ ${getCancellationFeeAmount().toFixed(2)}`
                                  : "✅ Cancelamento sem multa"
                                }
                              >
                                <X className="w-3 h-3" />
                                Cancelar
                                {willHaveCancellationFee(appointment) && (
                                  <span className="text-xs ml-1">(R$ {getCancellationFeeAmount().toFixed(2)})</span>
                                )}
                              </Button>
                            )}
                          </div>
                        )}

                      </div>
                    </div>
                    {appointment.servicePrice !== undefined && (
                      <div className="flex items-center gap-2 text-sm">
                        <span>💰</span>
                        {(appointment as any).hasPromotion ? (
                          <div className="flex flex-col">
                            <span className="text-sm line-through text-gray-500">
                              {formatCurrency((appointment as any).originalPrice)}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-green-600 font-medium">
                                {formatCurrency((appointment as any).promotionalPrice)}
                              </span>
                              <Badge variant="destructive" className="text-xs">
                                OFERTA
                              </Badge>
                            </div>
                          </div>
                        ) : (
                          <span className="text-green-600 font-medium">{formatCurrency(appointment.servicePrice)}</span>
                        )}
                      </div>
                    )}
                    {appointment.notes && (
                      <div className="flex items-start gap-2 text-sm text-muted-foreground mt-2">
                        <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <span>Observações: {appointment.notes}</span>
                      </div>
                    )}
                    {appointment.rescheduleReason && (
                      <div className="flex items-start gap-2 text-sm text-orange-600 font-medium mt-2">
                        <Clock className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <span>Motivo do reagendamento: {appointment.rescheduleReason}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Available Services */}
        {availableServices.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Store className="w-5 h-5" />
                    Serviços Disponíveis
                  </CardTitle>
                  <CardDescription>
                    Todos os serviços oferecidos pelo salão
                  </CardDescription>
                </div>
                <Button
                  onClick={() => setLocation("/client-booking")}
                  size="sm"
                  className="flex items-center space-x-2"
                >
                  <CalendarIcon className="w-4 h-4" />
                  <span>Agendar</span>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {availableServices.map((service) => (
                  <div key={service.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 mb-2">
                      <Star className="w-4 h-4 text-primary" />
                      <h4 className="font-semibold">{service.name}</h4>
                    </div>
                    {service.description && (
                      <p className="text-sm text-muted-foreground mb-3 flex items-start gap-2">
                        <MapPin className="w-3 h-3 mt-0.5 text-muted-foreground flex-shrink-0" />
                        {service.description}
                      </p>
                    )}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <span className="text-lg font-bold text-green-600">💰</span>
                          {(service as any).hasPromotion ? (
                            <div className="flex flex-col">
                              <span className="text-sm line-through text-gray-500">
                                {formatCurrency((service as any).originalPrice)}
                              </span>
                              <div className="flex items-center gap-1">
                                <span className="text-lg font-bold text-green-600">
                                  {formatCurrency((service as any).promotionalPrice)}
                                </span>
                                <Badge variant="destructive" className="text-xs">
                                  OFERTA
                                </Badge>
                              </div>
                            </div>
                          ) : (
                            <span className="text-lg font-bold text-green-600">
                              {formatCurrency(service.price)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground bg-gray-100 px-2 py-1 rounded">
                            {service.duration}min
                          </span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setLocation("/client-booking")}
                        className="w-full flex items-center gap-2"
                      >
                        <CalendarIcon className="w-4 h-4" />
                        Agendar Este Serviço
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Past Appointments */}
        {pastAppointments.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    Histórico de Serviços
                  </CardTitle>
                  <CardDescription>
                    Serviços realizados e cancelados
                  </CardDescription>
                </div>
                <div className="flex items-center space-x-2">
                  <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                  <select
                    value={historyFilter}
                    onChange={(e) => setHistoryFilter(e.target.value)}
                    className="px-3 py-1 border rounded-md text-sm"
                  >
                    <option value="week">Esta Semana</option>
                    <option value="month">Este Mês</option>
                    <option value="all">Todos</option>
                  </select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {historyLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="w-4 h-4 animate-spin" />
                    <span>Carregando histórico...</span>
                  </div>
                ) : pastAppointments.slice(0, 10).map((appointment) => (
                  <div key={appointment.id} className="border rounded-lg p-4 opacity-75">
                    <div className="flex justify-between items-start mb-2">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Star className="w-4 h-4 text-primary opacity-75" />
                          <h4 className="font-semibold">{appointment.serviceName || 'Serviço'}</h4>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <CalendarIcon className="w-4 h-4" />
                          <span>
                            {format(new Date(appointment.appointmentDate + 'T12:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                          </span>
                          <Clock className="w-4 h-4 ml-2" />
                          <span>
                            {appointment.status === "completed" ? (
                              <>
                                {appointment.actualStartTime && appointment.actualEndTime ? (
                                  <>
                                    <span className="text-blue-600 font-medium">
                                      Realizado: {appointment.actualStartTime} - {appointment.actualEndTime}
                                    </span>
                                  </>
                                ) : (
                                  <span>Agendado: {appointment.appointmentTime}</span>
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
                        {appointment.employeeName && (
                          <div className="flex items-center gap-2 text-sm text-blue-600 font-medium">
                            <Sparkles className="w-4 h-4" />
                            <span>Especialista: {appointment.employeeName}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {getStatusBadge(appointment.status)}
                        {(canModifyAppointment(appointment) || canCancelAppointment(appointment)) && (
                          <div className="flex gap-2 mt-2">
                            {canModifyAppointment(appointment) && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRescheduleAppointment(appointment.id)}
                                disabled={rescheduleAppointmentMutation.isPending}
                                className="flex items-center gap-1"
                                data-testid={`button-reschedule-${appointment.id}`}
                              >
                                <CalendarDays className="w-3 h-3" />
                                Reagendar
                              </Button>
                            )}
                            {canCancelAppointment(appointment) && (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleCancelAppointment(appointment)}
                                disabled={cancelAppointmentMutation.isPending}
                                className="flex items-center gap-1"
                                data-testid={`button-cancel-${appointment.id}`}
                                title={willHaveCancellationFee(appointment)
                                  ? `⚠️ Cancelamento com multa de R$ ${getCancellationFeeAmount().toFixed(2)}`
                                  : "✅ Cancelamento sem multa"
                                }
                              >
                                <X className="w-3 h-3" />
                                Cancelar
                                {willHaveCancellationFee(appointment) && (
                                  <span className="text-xs ml-1">(R$ {getCancellationFeeAmount().toFixed(2)})</span>
                                )}
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    {appointment.servicePrice !== undefined && (
                      <div className="flex items-center gap-2 text-sm">
                        <span>💰</span>
                        {(appointment as any).hasPromotion ? (
                          <div className="flex flex-col">
                            <span className="text-sm line-through text-gray-500">
                              {formatCurrency((appointment as any).originalPrice)}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-green-600 font-medium">
                                {formatCurrency((appointment as any).promotionalPrice)}
                              </span>
                              <Badge variant="destructive" className="text-xs">
                                OFERTA
                              </Badge>
                            </div>
                          </div>
                        ) : (
                          <span className="text-green-600 font-medium">{formatCurrency(appointment.servicePrice)}</span>
                        )}
                      </div>
                    )}
                    {appointment.rescheduleReason && appointment.status !== "completed" && (
                      <div className="flex items-start gap-2 text-sm text-orange-600 font-medium mt-2">
                        <Clock className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <span>Motivo do reagendamento: {appointment.rescheduleReason}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* No appointments message */}
        {clientAppointments.length === 0 && !appointmentsLoading && (
          <Card>
            <CardContent className="p-8 text-center">
              <CalendarIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhum agendamento encontrado</h3>
              <p className="text-muted-foreground">
                Entre em contato para fazer seu primeiro agendamento!
              </p>
            </CardContent>
          </Card>
        )}

        {/* Reschedule Modal */}
        <Dialog open={rescheduleModalOpen} onOpenChange={setRescheduleModalOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CalendarDays className="w-5 h-5" />
                Reagendar Agendamento
              </DialogTitle>
              <DialogDescription>
                Selecione uma nova data e horário para seu agendamento.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {/* Calendar */}
              <div className="space-y-2">
                <Label>Nova Data</Label>
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={handleDateSelection}
                  disabled={(date) => date < addDays(new Date(), 1)}
                  initialFocus
                  locale={ptBR}
                  className="rounded-md border"
                />
              </div>

              {/* Time Selection */}
              {selectedDate && (
                <div className="space-y-2">
                  <Label htmlFor="reschedule-time">Novo Horário</Label>
                  <Select value={selectedTime} onValueChange={setSelectedTime}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o horário" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTimeSlots.map((time) => (
                        <SelectItem key={time} value={time}>
                          {time}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Reason */}
              <div className="space-y-2">
                <Label htmlFor="reschedule-reason">Motivo do Reagendamento</Label>
                <Textarea
                  id="reschedule-reason"
                  placeholder="Informe o motivo do reagendamento..."
                  value={rescheduleReason}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setRescheduleModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSubmitReschedule}
                disabled={rescheduleAppointmentMutation.isPending || !selectedDate || !selectedTime || !rescheduleReason.trim()}
              >
                {rescheduleAppointmentMutation.isPending ? "Reagendando..." : "Reagendar"}
              </Button>
            </DialogFooter>
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
    </div>
  );
}