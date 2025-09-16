import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Clock, Save, ArrowLeft, Image, Power, Upload, DollarSign, AlertTriangle } from "lucide-react";
import { authService } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import type { BookingPoliciesData } from "@shared/schema";

const merchantScheduleSchema = z.object({
  workDays: z.array(z.number()).min(1, "Selecione pelo menos um dia de funcionamento"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Horário deve estar no formato HH:MM"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Horário deve estar no formato HH:MM"),
  hasBreak: z.boolean().optional(),
  breakStartTime: z.string().optional(),
  breakEndTime: z.string().optional(),
}).refine((data) => {
  if (data.hasBreak) {
    return data.breakStartTime && data.breakEndTime;
  }
  return true;
}, {
  message: "Horários de intervalo são obrigatórios quando habilitado",
  path: ["breakStartTime"],
});

type MerchantScheduleForm = z.infer<typeof merchantScheduleSchema>;

const weekDays = [
  { id: 0, name: "Domingo", short: "Dom" },
  { id: 1, name: "Segunda-feira", short: "Seg" },
  { id: 2, name: "Terça-feira", short: "Ter" },
  { id: 3, name: "Quarta-feira", short: "Qua" },
  { id: 4, name: "Quinta-feira", short: "Qui" },
  { id: 5, name: "Sexta-feira", short: "Sex" },
  { id: 6, name: "Sábado", short: "Sáb" },
];

export default function MerchantSettings() {
  const [user, setUser] = useState(authService.getState().user);
  const [hasBreak, setHasBreak] = useState(false);
  const [logoUrl, setLogoUrl] = useState("");
  const [isOpen, setIsOpen] = useState(true);
  const [bookingPolicies, setBookingPolicies] = useState<BookingPoliciesData>({
    noShowFeeEnabled: false,
    noShowFeeAmount: 0,
    lateFeeEnabled: false,
    lateFeeAmount: 0,
    lateToleranceMinutes: 15,
    cancellationPolicyHours: 24,
    cancellationFeeEnabled: false,
    cancellationFeeAmount: 0,
  });
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    const unsubscribe = authService.subscribe((state) => {
      setUser(state.user);
    });
    return unsubscribe;
  }, []);

  // Determine merchantId based on user role
  const merchantId = user?.role === "merchant" ? user.id : user?.merchantId;

  // Redirect if not authenticated or not authorized
  useEffect(() => {
    if (!authService.getState().isAuthenticated) {
      setLocation("/login");
      return;
    }
    if (user && user.role !== "merchant" && user.role !== "admin") {
      setLocation("/dashboard");
    }
  }, [user, setLocation]);

  // Fetch current merchant data
  const { data: merchant, isLoading } = useQuery({
    queryKey: [`/api/merchants/${merchantId}`],
    enabled: !!merchantId,
  });

  const form = useForm<MerchantScheduleForm>({
    resolver: zodResolver(merchantScheduleSchema),
    defaultValues: {
      workDays: [1, 2, 3, 4, 5, 6], // Monday to Saturday by default
      startTime: "09:00",
      endTime: "18:00",
      hasBreak: false,
      breakStartTime: "",
      breakEndTime: "",
    },
  });

  // Update form values when merchant data is loaded
  useEffect(() => {
    if (merchant) {
      const workDays = merchant.workDays ? JSON.parse(merchant.workDays) : [1, 2, 3, 4, 5, 6];
      const hasBreakTime = !!(merchant.breakStartTime && merchant.breakEndTime);

      form.reset({
        workDays: workDays,
        startTime: merchant.startTime || "09:00",
        endTime: merchant.endTime || "18:00",
        hasBreak: hasBreakTime,
        breakStartTime: merchant.breakStartTime || "",
        breakEndTime: merchant.breakEndTime || "",
      });

      setHasBreak(hasBreakTime);
      setLogoUrl(merchant.logoUrl || "");
      setIsOpen(merchant.isOpen !== undefined ? merchant.isOpen : true);
    }
  }, [merchant, form]);

  const updateScheduleMutation = useMutation({
    mutationFn: async (data: MerchantScheduleForm) => {
      console.log("=== DEBUG: updateScheduleMutation ===");
      console.log("merchantId:", merchantId);
      console.log("user:", user);
      console.log("data recebida:", data);

      if (!merchantId) {
        console.error("Erro: merchantId não encontrado");
        throw new Error("Usuário não autenticado ou sem permissão");
      }

      const scheduleData = {
        workDays: JSON.stringify(data.workDays),
        startTime: data.startTime,
        endTime: data.endTime,
        breakStartTime: (data.hasBreak && data.breakStartTime && data.breakStartTime.trim() !== "") ? data.breakStartTime : null,
        breakEndTime: (data.hasBreak && data.breakEndTime && data.breakEndTime.trim() !== "") ? data.breakEndTime : null,
      };

      console.log("scheduleData preparado:", scheduleData);

      const url = `/api/merchants/${merchantId}/schedule`;
      const token = localStorage.getItem('token');

      console.log("URL da requisição:", url);
      console.log("Token presente:", !!token);
      console.log("Token value (primeiros 20 chars):", token ? token.substring(0, 20) + '...' : 'NULO');
      console.log("LocalStorage keys:", Object.keys(localStorage));
      console.log("Headers:", {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token ? 'TOKEN_PRESENTE' : 'TOKEN_AUSENTE'}`
      });

      try {
        const response = await fetch(url, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify(scheduleData),
        });

        console.log("Response status:", response.status);
        console.log("Response ok:", response.ok);

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Response error text:", errorText);
          throw new Error(`Erro ao atualizar horários: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        console.log("Response success data:", result);
        return result;
      } catch (error) {
        console.error("Fetch error:", error);
        throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: "Horários atualizados",
        description: "Os horários de funcionamento foram atualizados com sucesso.",
      });
      if (merchantId) {
        queryClient.invalidateQueries({ queryKey: [`/api/merchants/${merchantId}`] });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar",
        description: error.message || "Não foi possível atualizar os horários.",
        variant: "destructive",
      });
    },
  });

  // Upload logo mutation
  const uploadLogoMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!merchantId) {
        throw new Error("Usuário não autenticado ou sem permissão");
      }

      const formData = new FormData();
      formData.append('logo', file);

      const response = await fetch('/api/upload/logo', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao fazer upload');
      }

      const data = await response.json();
      return data.logoUrl;
    },
    onSuccess: async (logoUrl: string) => {
      // Update merchant with new logo URL
      await updateLogoMutation.mutateAsync(logoUrl);
      setLogoUrl(logoUrl);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao fazer upload",
        description: error.message || "Não foi possível fazer upload da imagem.",
        variant: "destructive",
      });
    },
  });

  // Update logo mutation
  const updateLogoMutation = useMutation({
    mutationFn: async (logoUrl: string) => {
      console.log("=== DEBUG: updateLogoMutation ===");
      console.log("merchantId:", merchantId);
      console.log("logoUrl:", logoUrl);

      if (!merchantId) {
        console.error("Erro: merchantId não encontrado para logo");
        throw new Error("Usuário não autenticado ou sem permissão");
      }

      const url = `/api/merchants/${merchantId}/logo`;
      const token = localStorage.getItem('token');

      console.log("Logo URL da requisição:", url);
      console.log("Logo Token presente:", !!token);

      try {
        const response = await fetch(url, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({ logoUrl }),
        });

        console.log("Logo Response status:", response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Logo Response error:", errorText);
          throw new Error(`Erro ao atualizar logo: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        console.log("Logo Response success:", result);
        return result;
      } catch (error) {
        console.error("Logo Fetch error:", error);
        throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: "Logo atualizado",
        description: "O logo do salão foi atualizado com sucesso.",
      });
      if (merchantId) {
        queryClient.invalidateQueries({ queryKey: [`/api/merchants/${merchantId}`] });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar logo",
        description: error.message || "Não foi possível atualizar o logo.",
        variant: "destructive",
      });
    },
  });

  // Handle file upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "A imagem deve ter no máximo 5MB.",
        variant: "destructive",
      });
      return;
    }

    // Validate file type
    const allowedTypes = [
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/gif',
      'image/webp',
      'image/bmp',
      'image/svg+xml'
    ];

    if (!file.type.startsWith('image/') && !allowedTypes.includes(file.type)) {
      toast({
        title: "Tipo de arquivo inválido",
        description: "Apenas arquivos de imagem são permitidos (JPG, PNG, GIF, WebP, BMP, SVG).",
        variant: "destructive",
      });
      return;
    }

    uploadLogoMutation.mutate(file);
  };

  // Update open/closed status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async (isOpen: boolean) => {
      console.log("=== DEBUG: updateStatusMutation ===");
      console.log("merchantId:", merchantId);
      console.log("isOpen:", isOpen);

      if (!merchantId) {
        console.error("Erro: merchantId não encontrado para status");
        throw new Error("Usuário não autenticado ou sem permissão");
      }

      const url = `/api/merchants/${merchantId}/is-open`;
      const token = localStorage.getItem('token');

      console.log("Status URL da requisição:", url);
      console.log("Status Token presente:", !!token);

      try {
        const response = await fetch(url, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({ isOpen }),
        });

        console.log("Status Response status:", response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Status Response error:", errorText);
          throw new Error(`Erro ao atualizar status: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        console.log("Status Response success:", result);
        return result;
      } catch (error) {
        console.error("Status Fetch error:", error);
        throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: "Status atualizado",
        description: `Salão marcado como ${isOpen ? "aberto" : "fechado"}.`,
      });
      if (merchantId) {
        queryClient.invalidateQueries({ queryKey: [`/api/merchants/${merchantId}`] });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar status",
        description: error.message || "Não foi possível atualizar o status.",
        variant: "destructive",
      });
    },
  });

  // Fetch booking policies
  const { data: fetchedBookingPolicies } = useQuery({
    queryKey: [`/api/merchants/${merchantId}/booking-policies`],
    enabled: !!merchantId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Update booking policies state when data is fetched
  useEffect(() => {
    if (fetchedBookingPolicies) {
      // Convert cents to reais for display
      setBookingPolicies({
        ...fetchedBookingPolicies,
        noShowFeeAmount: fetchedBookingPolicies.noShowFeeAmount / 100,
        lateFeeAmount: fetchedBookingPolicies.lateFeeAmount / 100,
        cancellationFeeAmount: fetchedBookingPolicies.cancellationFeeAmount / 100,
      });
    }
  }, [fetchedBookingPolicies]);

  // Update booking policies mutation
  const updateBookingPoliciesMutation = useMutation({
    mutationFn: async (policies: BookingPoliciesData) => {
      if (!merchantId) {
        throw new Error("Usuário não autenticado ou sem permissão");
      }

      // Convert reais to cents before sending to backend
      const policiesInCents = {
        ...policies,
        noShowFeeAmount: Math.round(policies.noShowFeeAmount * 100),
        lateFeeAmount: Math.round(policies.lateFeeAmount * 100),
        cancellationFeeAmount: Math.round(policies.cancellationFeeAmount * 100),
      };

      const response = await apiRequest("PATCH", `/api/merchants/${merchantId}/booking-policies`, policiesInCents);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Políticas atualizadas",
        description: "As políticas de agendamento foram atualizadas com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/merchants/${merchantId}/booking-policies`] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar políticas",
        description: error.message || "Não foi possível atualizar as políticas.",
        variant: "destructive",
      });
    },
  });

  const handleBookingPolicyChange = (field: keyof BookingPoliciesData, value: boolean | number) => {
    setBookingPolicies(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSaveBookingPolicies = () => {
    updateBookingPoliciesMutation.mutate(bookingPolicies);
  };

  const onSubmit = (data: MerchantScheduleForm) => {
    updateScheduleMutation.mutate(data);
  };

  const handleWorkDayToggle = (dayId: number, checked: boolean) => {
    const currentWorkDays = form.getValues("workDays");
    if (checked) {
      if (!currentWorkDays.includes(dayId)) {
        form.setValue("workDays", [...currentWorkDays, dayId].sort());
      }
    } else {
      form.setValue("workDays", currentWorkDays.filter(id => id !== dayId));
    }
  };

  const handleBreakToggle = (checked: boolean) => {
    setHasBreak(checked);
    form.setValue("hasBreak", checked);
    if (!checked) {
      form.setValue("breakStartTime", "");
      form.setValue("breakEndTime", "");
    } else {
      form.setValue("breakStartTime", "12:00");
      form.setValue("breakEndTime", "13:00");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background" data-testid="page-merchant-settings">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Carregando configurações...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" data-testid="page-merchant-settings">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-border">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation("/merchant-dashboard")}
                data-testid="button-back"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  Configurações de Horário
                </h1>
                <p className="text-sm text-muted-foreground">
                  Configure os dias e horários de funcionamento do seu salão
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Salão:</p>
                <p className="text-sm font-medium text-foreground" data-testid="text-salon-name">
                  {user?.name}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="p-6">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Clock className="w-5 h-5" />
                <span>Horários de Funcionamento</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  {/* Work Days */}
                  <FormField
                    control={form.control}
                    name="workDays"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Dias de Funcionamento</FormLabel>
                        <FormDescription>
                          Selecione os dias da semana em que o salão funciona
                        </FormDescription>
                        <FormControl>
                          <div className="grid grid-cols-7 gap-4">
                            {weekDays.map((day) => (
                              <div key={day.id} className="flex flex-col items-center space-y-2">
                                <Checkbox
                                  id={`day-${day.id}`}
                                  checked={field.value.includes(day.id)}
                                  onCheckedChange={(checked) => 
                                    handleWorkDayToggle(day.id, checked as boolean)
                                  }
                                  data-testid={`checkbox-day-${day.id}`}
                                />
                                <Label 
                                  htmlFor={`day-${day.id}`} 
                                  className="text-xs text-center cursor-pointer"
                                >
                                  {day.short}
                                </Label>
                              </div>
                            ))}
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Working Hours */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="startTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Horário de Abertura</FormLabel>
                          <FormControl>
                            <Input
                              type="time"
                              {...field}
                              data-testid="input-start-time"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="endTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Horário de Fechamento</FormLabel>
                          <FormControl>
                            <Input
                              type="time"
                              {...field}
                              data-testid="input-end-time"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Break Hours */}
                  <div>
                    <div className="flex items-center space-x-3 mb-4">
                      <Checkbox
                        id="hasBreak"
                        checked={hasBreak}
                        onCheckedChange={handleBreakToggle}
                        data-testid="checkbox-has-break"
                      />
                      <Label htmlFor="hasBreak" className="text-lg font-medium text-foreground cursor-pointer">
                        Possui intervalo para almoço
                      </Label>
                    </div>

                    {hasBreak && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                        <FormField
                          control={form.control}
                          name="breakStartTime"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Início do Intervalo</FormLabel>
                              <FormControl>
                                <Input
                                  type="time"
                                  {...field}
                                  data-testid="input-break-start-time"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="breakEndTime"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Fim do Intervalo</FormLabel>
                              <FormControl>
                                <Input
                                  type="time"
                                  {...field}
                                  data-testid="input-break-end-time"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    )}
                  </div>

                  {/* Submit Button */}
                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      disabled={updateScheduleMutation.isPending}
                      data-testid="button-save-schedule"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      {updateScheduleMutation.isPending ? "Salvando..." : "Salvar Alterações"}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* Logo Management Card */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Image className="w-5 h-5" />
                <span>Logo do Salão</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {logoUrl && (
                  <div className="flex items-center justify-center w-32 h-32 border border-dashed border-muted-foreground rounded-lg overflow-hidden">
                    <img
                      src={logoUrl.startsWith('/uploads/') ? `${window.location.origin}${logoUrl}` : logoUrl}
                      alt="Logo do salão"
                      className="w-full h-full object-cover"
                      data-testid="img-current-logo"
                    />
                  </div>
                )}

                <div className="space-y-4">
                  {/* Upload de Arquivo */}
                  <div className="space-y-2">
                    <Label htmlFor="logoFile" className="text-base font-medium">Fazer Upload da Imagem</Label>
                    <div className="flex flex-col space-y-2">
                      <div className="relative">
                        <Input
                          id="logoFile"
                          type="file"
                          accept="image/*"
                          onChange={handleFileUpload}
                          disabled={uploadLogoMutation.isPending}
                          data-testid="input-logo-file"
                          className="bg-gray-100 border-2 border-dashed border-gray-300 hover:border-gray-400 focus:border-blue-500 cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                        />
                        {uploadLogoMutation.isPending && (
                          <div className="absolute inset-0 bg-white bg-opacity-50 flex items-center justify-center">
                            <span className="text-sm text-blue-600 font-medium">Enviando...</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-center w-full">
                        <label 
                          htmlFor="logoFile" 
                          className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors"
                        >
                          <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            <Upload className="w-8 h-8 mb-4 text-gray-500" />
                            <p className="mb-2 text-sm text-gray-500">
                              <span className="font-semibold">Clique para fazer upload</span> ou arraste e solte
                            </p>
                            <p className="text-xs text-gray-500">JPG, PNG, GIF, WebP, BMP ou SVG (máx. 5MB)</p>
                          </div>
                        </label>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Selecione uma imagem do seu computador (máx. 5MB)
                    </p>
                  </div>

                  <div className="flex items-center space-x-4">
                    <div className="flex-1 h-px bg-border"></div>
                    <span className="text-sm text-muted-foreground">OU</span>
                    <div className="flex-1 h-px bg-border"></div>
                  </div>

                  {/* URL da Imagem */}
                  <div className="space-y-2">
                    <Label htmlFor="logoUrl">URL da Imagem</Label>
                    <div className="flex space-x-2">
                      <Input
                        id="logoUrl"
                        type="url"
                        value={logoUrl}
                        onChange={(e) => setLogoUrl(e.target.value)}
                        placeholder="https://exemplo.com/logo.png"
                        data-testid="input-logo-url"
                      />
                      <Button
                        onClick={() => updateLogoMutation.mutate(logoUrl)}
                        disabled={updateLogoMutation.isPending || !logoUrl.trim()}
                        data-testid="button-update-logo"
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        {updateLogoMutation.isPending ? "Salvando..." : "Salvar URL"}
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Cole a URL de uma imagem online
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Open/Closed Status Card */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Power className="w-5 h-5" />
                <span>Status de Funcionamento</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="isOpen" className="text-base font-medium">
                    Salão {isOpen ? "Aberto" : "Fechado"}
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Controle se o salão está atualmente funcionando para novos agendamentos.
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="isOpen"
                    checked={isOpen}
                    onCheckedChange={(checked) => {
                      setIsOpen(checked);
                      updateStatusMutation.mutate(checked);
                    }}
                    disabled={updateStatusMutation.isPending}
                    data-testid="switch-is-open"
                  />
                  <span className={`text-sm font-medium ${isOpen ? "text-green-600" : "text-red-600"}`}>
                    {isOpen ? "Aberto" : "Fechado"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Booking Policies Card */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5" />
                <span>Políticas de Agendamento</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Cancellation Fee */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="cancellationFeeEnabled" className="text-base font-medium flex items-center space-x-2">
                      <AlertTriangle className="w-4 h-4" />
                      <span>Multa por Cancelamento</span>
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Cobrança por cancelamento fora do prazo estabelecido.
                    </p>
                  </div>
                  <Switch
                    id="cancellationFeeEnabled"
                    checked={bookingPolicies.cancellationFeeEnabled}
                    onCheckedChange={(checked) => handleBookingPolicyChange('cancellationFeeEnabled', checked)}
                    data-testid="switch-cancellation-fee"
                  />
                </div>
                {bookingPolicies.cancellationFeeEnabled && (
                  <div className="ml-6 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="cancellationFeeAmount">Valor da multa (R$)</Label>
                      <Input
                        id="cancellationFeeAmount"
                        type="number"
                        min="0"
                        step="0.01"
                        value={bookingPolicies.cancellationFeeAmount === 0 ? "" : bookingPolicies.cancellationFeeAmount}
                        onChange={(e) => handleBookingPolicyChange('cancellationFeeAmount', e.target.value === "" ? 0 : parseFloat(e.target.value))}
                        className="w-32"
                        data-testid="input-cancellation-fee-amount"
                        placeholder="0,00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cancellationPolicyHours">Prazo para cancelamento (horas)</Label>
                      <Input
                        id="cancellationPolicyHours"
                        type="number"
                        min="0"
                        max="168"
                        value={bookingPolicies.cancellationPolicyHours}
                        onChange={(e) => handleBookingPolicyChange('cancellationPolicyHours', parseInt(e.target.value || '24'))}
                        className="w-32"
                        data-testid="input-cancellation-hours"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Save Button */}
              <div className="pt-4 border-t">
                <Button
                  onClick={handleSaveBookingPolicies}
                  disabled={updateBookingPoliciesMutation.isPending}
                  className="w-full"
                  data-testid="button-save-policies"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {updateBookingPoliciesMutation.isPending ? "Salvando..." : "Salvar Políticas"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}