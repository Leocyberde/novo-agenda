import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Calendar, Clock, User, Phone, Mail } from "lucide-react";
import { authService } from "@/lib/auth";
import { toast } from "@/hooks/use-toast";

interface Service {
  id: string;
  name: string;
  duration: number;
  price: number;
}

export default function NewAppointment() {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [user, setUser] = useState(authService.getState().user);

  const [formData, setFormData] = useState({
    serviceId: "",
    clientName: "",
    clientPhone: "",
    clientEmail: "",
    appointmentDate: "",
    appointmentTime: "",
    notes: "",
  });

  useEffect(() => {
    const unsubscribe = authService.subscribe((state) => {
      setUser(state.user);
    });
    return unsubscribe;
  }, []);

  // Fetch active services
  const { data: services, isLoading: servicesLoading, error: servicesError } = useQuery<Service[]>({
    queryKey: ["/api/services/active"],
    queryFn: async () => {
      const response = await fetch("/api/services/active", {
        headers: {
          'Authorization': `Bearer ${authService.getState().token}`,
        },
      });
      if (!response.ok) {
        throw new Error('Failed to fetch services');
      }
      return response.json();
    },
    enabled: authService.getState().isAuthenticated && user?.role === "merchant",
  });

  const createAppointmentMutation = useMutation({
    mutationFn: async (appointmentData: any) => {
      const response = await fetch("/api/appointments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          'Authorization': `Bearer ${authService.getState().token}`,
        },
        body: JSON.stringify(appointmentData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao criar agendamento");
      }

      return response.json();
    },
    onSuccess: async (data) => {
      // Check if client has pending penalties
      if (data.hasPendingPenalties) {
        toast({
          title: "⚠️ Atenção: Cliente com Multa Pendente",
          description: `Este cliente possui ${data.pendingPenaltiesCount} multa(s) pendente(s) no valor de R$ ${(data.pendingPenaltiesAmount / 100).toFixed(2)}. Considere cobrar antes do atendimento.`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Sucesso!",
          description: "Agendamento criado com sucesso",
        });
      }
      
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

      setLocation("/schedule");
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.serviceId || !formData.clientName || !formData.clientPhone ||
        !formData.appointmentDate || !formData.appointmentTime) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    createAppointmentMutation.mutate(formData);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Fetch merchant data to get working hours
  const { data: merchantData } = useQuery({
    queryKey: [`/api/merchants/${user?.id}`],
    queryFn: async () => {
      const response = await fetch(`/api/merchants/${user?.id}`, {
        headers: {
          'Authorization': `Bearer ${authService.getState().token}`,
        },
      });
      if (!response.ok) {
        throw new Error('Failed to fetch merchant data');
      }
      return response.json();
    },
    enabled: authService.getState().isAuthenticated && user?.role === "merchant",
  });

  // Generate time slots based on merchant working hours
  const generateTimeSlots = () => {
    if (!merchantData) return [];
    
    const startTime = merchantData.startTime || "08:00";
    const endTime = merchantData.endTime || "22:00";
    
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);
    
    // Check if selected date is today
    const today = new Date().toISOString().split('T')[0];
    const isToday = formData.appointmentDate === today;
    const now = new Date();
    const currentTimeInMinutes = now.getHours() * 60 + now.getMinutes();
    
    const slots = [];
    let currentHour = startHour;
    let currentMinute = startMinute;
    
    while (currentHour < endHour || (currentHour === endHour && currentMinute < endMinute)) {
      const timeSlot = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
      const slotTimeInMinutes = currentHour * 60 + currentMinute;
      
      // Skip time slots that have already passed today
      if (isToday && slotTimeInMinutes <= currentTimeInMinutes) {
        // Increment by 30 minutes and continue
        currentMinute += 30;
        if (currentMinute >= 60) {
          currentMinute = 0;
          currentHour++;
        }
        continue;
      }
      
      slots.push(timeSlot);
      
      // Increment by 30 minutes
      currentMinute += 30;
      if (currentMinute >= 60) {
        currentMinute = 0;
        currentHour++;
      }
    }
    
    return slots;
  };

  const timeSlots = generateTimeSlots();

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
              <h1 className="text-2xl font-bold text-foreground">Novo Agendamento</h1>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Comerciante:</p>
              <p className="text-sm font-medium text-foreground">{user?.name}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="p-6">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Service Selection */}
                <div className="space-y-2">
                  <Label htmlFor="service">Serviço *</Label>
                  {servicesError && (
                    <p className="text-sm text-red-600">
                      Erro ao carregar serviços. Verifique se você tem serviços cadastrados.
                    </p>
                  )}
                  {!servicesLoading && !servicesError && services && services.length === 0 && (
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-sm text-yellow-800 mb-2">
                        Você precisa cadastrar pelo menos um serviço para criar agendamentos.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setLocation("/services")}
                      >
                        Gerenciar Serviços
                      </Button>
                    </div>
                  )}
                  <Select
                    value={formData.serviceId}
                    onValueChange={(value) => handleInputChange("serviceId", value)}
                    disabled={servicesLoading || !!servicesError || (services && services.length === 0)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={
                        servicesLoading 
                          ? "Carregando serviços..." 
                          : services && services.length === 0 
                            ? "Nenhum serviço disponível" 
                            : "Selecione um serviço"
                      } />
                    </SelectTrigger>
                    <SelectContent>
                      {!servicesLoading && services?.map((service) => (
                        <SelectItem key={service.id} value={service.id}>
                          {service.name} - R$ {(service.price / 100).toFixed(2)} ({service.duration}min)
                        </SelectItem>
                      ))}
                      {!servicesLoading && (!services || services.length === 0) && (
                        <div className="p-2 text-sm text-muted-foreground text-center">
                          Nenhum serviço disponível
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Client Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="clientName">Nome do Cliente *</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="clientName"
                        type="text"
                        placeholder="Nome completo"
                        className="pl-10"
                        value={formData.clientName}
                        onChange={(e) => handleInputChange("clientName", e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="clientPhone">Telefone *</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="clientPhone"
                        type="tel"
                        placeholder="(11) 99999-9999"
                        className="pl-10"
                        value={formData.clientPhone}
                        onChange={(e) => handleInputChange("clientPhone", e.target.value)}
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="clientEmail">Email (opcional)</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="clientEmail"
                      type="email"
                      placeholder="cliente@email.com"
                      className="pl-10"
                      value={formData.clientEmail}
                      onChange={(e) => handleInputChange("clientEmail", e.target.value)}
                    />
                  </div>
                </div>

                {/* Date and Time */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="appointmentDate">Data do Agendamento *</Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="appointmentDate"
                        type="date"
                        className="pl-10"
                        value={formData.appointmentDate}
                        onChange={(e) => handleInputChange("appointmentDate", e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="appointmentTime">Horário *</Label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground z-10" />
                      <Select
                        value={formData.appointmentTime}
                        onValueChange={(value) => handleInputChange("appointmentTime", value)}
                      >
                        <SelectTrigger className="pl-10">
                          <SelectValue placeholder="Selecione o horário" />
                        </SelectTrigger>
                        <SelectContent>
                          {timeSlots.map((time) => (
                            <SelectItem key={time} value={time}>
                              {time}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <Label htmlFor="notes">Observações (opcional)</Label>
                  <Textarea
                    id="notes"
                    placeholder="Observações sobre o agendamento..."
                    value={formData.notes}
                    onChange={(e) => handleInputChange("notes", e.target.value)}
                    rows={3}
                  />
                </div>

                {/* Actions */}
                <div className="flex justify-end space-x-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setLocation("/merchant-dashboard")}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={createAppointmentMutation.isPending}
                  >
                    {createAppointmentMutation.isPending ? "Criando..." : "Criar Agendamento"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}