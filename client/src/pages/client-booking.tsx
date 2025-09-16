import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Calendar, Clock, User, DollarSign } from "lucide-react";
import { authService } from "@/lib/auth";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge"; // Import Badge component

interface User {
  id: string;
  email: string;
  role: string;
  name?: string;
  phone?: string;
  merchantId?: string;
}

interface Service {
  id: string;
  name: string;
  description?: string;
  price: number;
  duration: number;
  isActive: boolean;
  merchantId: string;
  originalPrice?: number; // Added for promotional price display
  promotionalPrice?: number; // Added for promotional price display
  hasPromotion?: boolean; // Added to indicate if there's a promotion
}

interface Employee {
  id: string;
  name: string;
  email: string;
  role: string;
  specialties?: string;
  isActive: boolean;
  merchantId: string;
}

interface Merchant {
  id: string;
  name: string;
  address: string;
  phone: string;
  startTime?: string; // e.g., "09:00"
  endTime?: string;   // e.g., "18:00"
  openingDays?: string[]; // e.g., ["Mon", "Tue", ...]
}


export default function ClientBooking() {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [user, setUser] = useState<User | null>(authService.getState().user);

  const [formData, setFormData] = useState({
    serviceId: "",
    employeeId: "",
    appointmentDate: "",
    appointmentTime: "",
    notes: "",
  });

  const [selectedService, setSelectedService] = useState<Service | null>(null);

  useEffect(() => {
    const unsubscribe = authService.subscribe((state) => {
      setUser(state.user);
    });
    return unsubscribe;
  }, []);

  // Fetch available services
  const { data: services = [], isLoading: servicesLoading } = useQuery<Service[]>({
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
      const servicesData: Service[] = await response.json();

      // Check for promotions and augment data
      const promotionResponse = await fetch(`/api/client/promotions`, {
        headers: {
          'Authorization': `Bearer ${authService.getState().token}`,
        },
      });
      const promotions = await promotionResponse.json();

      const servicesWithPromotions = servicesData.map(service => {
        const activePromotion = promotions.find((promo: any) =>
          promo.serviceId === service.id &&
          promo.isActive &&
          new Date(promo.validUntil) >= new Date() // Check if promotion is still valid
        );

        if (activePromotion) {
          return {
            ...service,
            hasPromotion: true,
            originalPrice: service.price,
            promotionalPrice: activePromotion.discountedPrice,
          };
        }
        return service;
      });

      return servicesWithPromotions;
    },
    enabled: authService.getState().isAuthenticated && user?.role === "client",
  });

  // Query to get available employees (filtered by selected date if available)
  const { data: employees = [], isLoading: employeesLoading } = useQuery<Employee[]>({
    queryKey: ["/api/client/employees", formData.appointmentDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (formData.appointmentDate) {
        params.append("date", formData.appointmentDate);
      }

      const response = await fetch(`/api/client/employees?${params}`, {
        headers: {
          'Authorization': `Bearer ${authService.getState().token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Erro ao buscar funcionários");
      }

      return response.json();
    },
    enabled: !!authService.getState().token,
  });

  // Fetch merchant data to get working hours
  const { data: merchantData } = useQuery<Merchant[]>({
    queryKey: [`/api/client/merchants`],
    queryFn: async () => {
      const response = await fetch(`/api/client/merchants`, {
        headers: {
          'Authorization': `Bearer ${authService.getState().token}`,
        },
      });
      if (!response.ok) {
        throw new Error("Erro ao carregar dados do salão");
      }
      return response.json();
    },
    enabled: authService.getState().isAuthenticated && user?.role === "client",
  });


  // Check availability
  const { data: availability, isLoading: availabilityLoading } = useQuery({
    queryKey: ["/api/client/availability", formData.employeeId, formData.appointmentDate, formData.appointmentTime, selectedService?.duration],
    queryFn: async () => {
      if (!formData.employeeId || !formData.appointmentDate || !formData.appointmentTime || !selectedService) {
        return null;
      }

      // Use the promotional price if available, otherwise use the regular price
      const priceToUse = (selectedService as any).hasPromotion
        ? (selectedService as any).promotionalPrice
        : selectedService.price;

      const response = await fetch(
        `/api/client/availability?employeeId=${formData.employeeId}&date=${formData.appointmentDate}&time=${formData.appointmentTime}&duration=${selectedService.duration}&price=${priceToUse}`,
        {
          headers: {
            'Authorization': `Bearer ${authService.getState().token}`,
          },
        }
      );
      if (!response.ok) {
        throw new Error("Erro ao verificar disponibilidade");
      }
      return response.json();
    },
    enabled: !!(formData.employeeId && formData.appointmentDate && formData.appointmentTime && selectedService),
  });

  const createAppointmentMutation = useMutation({
    mutationFn: async (appointmentData: any) => {
      // Determine the price to charge based on promotion
      const service = services.find(s => s.id === appointmentData.serviceId);
      const priceToCharge = service && (service as any).hasPromotion
        ? (service as any).promotionalPrice
        : service?.price;

      const finalAppointmentData = {
        ...appointmentData,
        price: priceToCharge,
      };


      const response = await fetch("/api/client/appointments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          'Authorization': `Bearer ${authService.getState().token}`,
        },
        body: JSON.stringify(finalAppointmentData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        // Verificar se é erro de funcionário de folga
        if (errorData.message && errorData.message.includes("folga")) {
          throw new Error("🏖️ Este funcionário está de folga neste dia. Por favor, escolha outro dia ou outro funcionário.");
        }

        throw new Error(errorData.message || "Erro ao criar agendamento");
      }
      return response.json();
    },
    onSuccess: () => {
      setFormData({
        serviceId: "",
        employeeId: "",
        appointmentDate: "",
        appointmentTime: "",
        notes: "",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/client/appointments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/employee/appointments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/appointments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/merchants/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/client/occupied-times"] });
      queryClient.invalidateQueries({ queryKey: ["/api/client/availability"] });

      // Force refetch of occupied times for the current date and employee to update state immediately
      if (formData.appointmentDate) {
        queryClient.refetchQueries({
          queryKey: ["/api/client/occupied-times", formData.appointmentDate, formData.employeeId]
        });
      }

      setLocation("/client-dashboard");
      toast({
        title: "Sucesso!",
        description: "Agendamento criado com sucesso",
      });
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

    if (!formData.serviceId || !formData.appointmentDate || !formData.appointmentTime) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    // Check if the selected time is in the available slots
    const availableSlots = getAvailableTimeSlots();
    console.log("Available slots:", availableSlots);
    console.log("Selected time:", formData.appointmentTime);
    console.log("Occupied times:", occupiedTimes);

    if (!availableSlots.includes(formData.appointmentTime)) {
      toast({
        title: "Erro",
        description: "Este horário não está mais disponível. Por favor, selecione outro horário.",
        variant: "destructive",
      });
      return;
    }

    createAppointmentMutation.mutate(formData);
  };

  const handleInputChange = (field: string, value: string) => {
    // Convert "any" back to empty string for employeeId
    const processedValue = field === "employeeId" && value === "any" ? "" : value;
    setFormData(prev => ({ ...prev, [field]: processedValue }));

    if (field === "serviceId") {
      const service = services.find(s => s.id === value);
      setSelectedService(service || null);
    }
  };

  // Query to get occupied times for the selected date
  const { data: occupiedTimes = [], isLoading: occupiedTimesLoading } = useQuery({
    queryKey: ["/api/client/occupied-times", formData.appointmentDate, formData.employeeId],
    queryFn: async () => {
      if (!formData.appointmentDate) return [];

      const params = new URLSearchParams({ date: formData.appointmentDate });
      // Only filter by employee if one is specifically selected (not empty string)
      if (formData.employeeId && formData.employeeId !== "") {
        params.append("employeeId", formData.employeeId);
      }

      const response = await fetch(`/api/client/occupied-times?${params}`, {
        headers: {
          'Authorization': `Bearer ${authService.getState().token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Erro ao buscar horários ocupados");
      }

      const data = await response.json();
      return data.occupiedTimes || [];
    },
    enabled: !!formData.appointmentDate,
    // Refetch whenever date or employee changes
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  // Generate time slots helper function based on merchant working hours
  const generateAllTimeSlots = () => {
    if (!merchantData || !merchantData[0]) return [];

    const merchant = merchantData[0];
    const startTime = merchant.startTime || "09:00";
    const endTime = merchant.endTime || "18:00";

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

      // Check if this time slot is occupied
      const isOccupied = occupiedTimes.includes(timeSlot);

      if (!isOccupied) {
        slots.push(timeSlot);
      }

      // Increment by 30 minutes
      currentMinute += 30;
      if (currentMinute >= 60) {
        currentMinute = 0;
        currentHour++;
      }
    }

    return slots;
  };

  // Get available time slots (generated slots minus occupied ones, considering service duration)
  const getAvailableTimeSlots = () => {
    const allSlots = generateAllTimeSlots();

    if (!selectedService?.duration) {
      // If no service selected, just filter out directly occupied times
      return allSlots.filter(slot => !occupiedTimes.includes(slot));
    }

    const serviceDuration = selectedService.duration;

    return allSlots.filter(slot => {
      // Convert slot time to minutes
      const [slotHour, slotMinute] = slot.split(':').map(Number);
      const slotStartMinutes = slotHour * 60 + slotMinute;
      const slotEndMinutes = slotStartMinutes + serviceDuration;

      // Check if this slot conflicts with any occupied time
      for (const occupiedTime of occupiedTimes) {
        const [occupiedHour, occupiedMinute] = occupiedTime.split(':').map(Number);
        const occupiedMinutes = occupiedHour * 60 + occupiedMinute;

        // Each occupied slot is considered as a 30-minute block minimum
        // But we need to check actual overlap with our service duration
        const occupiedEndMinutes = occupiedMinutes + 30; // Minimum 30min block

        // Check for any overlap
        if (slotStartMinutes < occupiedEndMinutes && slotEndMinutes > occupiedMinutes) {
          return false; // This slot conflicts
        }
      }

      return true; // No conflicts found
    });
  };

  const timeSlots = getAvailableTimeSlots();

  // Format currency helper
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value / 100);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-accent/10 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              onClick={() => setLocation("/client-dashboard")}
              variant="ghost"
              size="sm"
              className="flex items-center space-x-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar</span>
            </Button>
            <h1 className="text-3xl font-bold text-foreground">Novo Agendamento</h1>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Booking Form */}
          <div className="md:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Agendar Serviço</CardTitle>
                <CardDescription>
                  Selecione o serviço, funcionário e horário desejado
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Service Selection */}
                  <div className="space-y-2">
                    <Label htmlFor="service">Serviço *</Label>
                    <Select
                      value={formData.serviceId}
                      onValueChange={(value) => handleInputChange("serviceId", value)}
                      disabled={servicesLoading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={
                          servicesLoading
                            ? "Carregando serviços..."
                            : "Selecione um serviço"
                        } />
                      </SelectTrigger>
                      <SelectContent>
                        {services.map((service) => (
                          <SelectItem key={service.id} value={service.id}>
                            <div className="flex flex-col">
                              <div className="flex items-center space-x-2">
                                <span>{service.name}</span>
                                {(service as any).hasPromotion && (
                                  <Badge variant="destructive" className="text-xs">
                                    PROMOÇÃO
                                  </Badge>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {(service as any).hasPromotion ? (
                                  <span>
                                    <span className="line-through">{formatCurrency((service as any).originalPrice)}</span>
                                    {" "}
                                    <span className="text-green-600 font-medium">
                                      {formatCurrency((service as any).promotionalPrice)}
                                    </span>
                                  </span>
                                ) : (
                                  formatCurrency(service.price)
                                )} • {service.duration}min
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedService?.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {selectedService.description}
                      </p>
                    )}
                  </div>

                  {/* Employee Selection */}
                  <div className="space-y-2">
                    <Label htmlFor="employee">Funcionário (opcional)</Label>
                    <Select
                      value={formData.employeeId || "any"}
                      onValueChange={(value) => handleInputChange("employeeId", value)}
                      disabled={employeesLoading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={
                          employeesLoading
                            ? "Carregando funcionários..."
                            : "Selecione um funcionário ou deixe em branco"
                        } />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Qualquer funcionário disponível</SelectItem>
                        {employees.map((employee) => (
                          <SelectItem key={employee.id} value={employee.id}>
                            <div className="flex flex-col">
                              <span>{employee.name}</span>
                              {employee.specialties && (
                                <span className="text-sm text-muted-foreground">
                                  {employee.specialties}
                                </span>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Date and Time */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="appointmentDate">Data *</Label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="appointmentDate"
                          type="date"
                          className="pl-10"
                          value={formData.appointmentDate}
                          onChange={(e) => handleInputChange("appointmentDate", e.target.value)}
                          min={(() => {
                            const today = new Date();
                            const merchant = merchantData?.[0];
                            
                            // Se o salão estiver fechado, só pode agendar a partir de amanhã
                            if (merchant && !merchant.isOpen) {
                              const tomorrow = new Date(today);
                              tomorrow.setDate(today.getDate() + 1);
                              return tomorrow.toISOString().split('T')[0];
                            }
                            
                            // Se o salão estiver aberto, pode agendar a partir de hoje
                            return today.toISOString().split('T')[0];
                          })()}
                          required
                        />
                      </div>
                      {merchantData?.[0] && !merchantData[0].isOpen && (
                        <p className="text-sm text-yellow-600 bg-yellow-50 p-2 rounded border">
                          ⚠️ O salão está fechado hoje. Você só pode agendar a partir de amanhã.
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="appointmentTime">Horário *</Label>
                      <div className="relative">
                        <Clock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground z-10" />
                        <Select
                          value={formData.appointmentTime}
                          onValueChange={(value) => handleInputChange("appointmentTime", value)}
                          disabled={occupiedTimesLoading || !formData.appointmentDate}
                        >
                          <SelectTrigger className="pl-10">
                            <SelectValue placeholder={
                              occupiedTimesLoading
                                ? "Carregando horários..."
                                : !formData.appointmentDate
                                ? "Selecione uma data primeiro"
                                : timeSlots.length === 0
                                ? "Nenhum horário disponível"
                                : "Selecione o horário"
                            } />
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

                  {/* Availability Status */}
                  {formData.employeeId && formData.appointmentDate && formData.appointmentTime && (
                    <div className="p-3 rounded-lg border">
                      {availabilityLoading ? (
                        <p className="text-sm text-muted-foreground">Verificando disponibilidade...</p>
                      ) : availability ? (
                        <div className={`flex items-center space-x-2 ${availability.available ? 'text-green-600' : 'text-red-600'}`}>
                          <div className={`w-2 h-2 rounded-full ${availability.available ? 'bg-green-600' : 'bg-red-600'}`} />
                          <span className="text-sm font-medium">
                            {availability.available ? 'Horário disponível' : 'Horário indisponível'}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  )}

                  {/* Notes */}
                  <div className="space-y-2">
                    <Label htmlFor="notes">Observações (opcional)</Label>
                    <Textarea
                      id="notes"
                      placeholder="Alguma observação especial..."
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
                      onClick={() => setLocation("/client-dashboard")}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      disabled={createAppointmentMutation.isPending || (formData.employeeId && availability && !availability.available)}
                    >
                      {createAppointmentMutation.isPending ? "Agendando..." : "Confirmar Agendamento"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Service Info Sidebar */}
          <div className="space-y-6">
            {selectedService && (
              <Card>
                <CardHeader>
                  <CardTitle>Detalhes do Serviço</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-semibold">{selectedService.name}</h4>
                    {selectedService.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {selectedService.description}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <DollarSign className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium">
                        {(selectedService as any).hasPromotion ? formatCurrency((selectedService as any).promotionalPrice) : formatCurrency(selectedService.price)}
                      </span>
                      {(selectedService as any).hasPromotion && (
                        <span className="text-sm text-muted-foreground line-through">
                          {formatCurrency((selectedService as any).originalPrice)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {selectedService.duration} minutos
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Instruções</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>• Selecione o serviço desejado</p>
                <p>• Escolha um funcionário ou deixe em branco para qualquer um disponível</p>
                <p>• Escolha a data e horário</p>
                <p>• Verifique se o horário está disponível</p>
                <p>• Adicione observações se necessário</p>
                {merchantData?.[0] && !merchantData[0].isOpen && (
                  <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                    <p className="text-yellow-800 font-medium">
                      🔒 Salão Fechado Hoje
                    </p>
                    <p className="text-yellow-700 text-xs mt-1">
                      O salão está temporariamente fechado. Agendamentos só podem ser feitos para os próximos dias.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}