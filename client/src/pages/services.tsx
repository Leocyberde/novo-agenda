import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, Plus, Edit, Trash2, DollarSign, Clock, Users } from "lucide-react";
import { authService } from "@/lib/auth";
import { toast } from "@/hooks/use-toast";

interface Service {
  id: string;
  merchantId: string;
  name: string;
  description?: string;
  price: number;
  duration: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function Services() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [user, setUser] = useState(authService.getState().user);
  const [isNewServiceModalOpen, setIsNewServiceModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    duration: "",
    isActive: true,
  });

  useEffect(() => {
    const unsubscribe = authService.subscribe((state) => {
      setUser(state.user);
      if (!state.isAuthenticated) {
        setLocation("/login");
      }
    });
    // Initial check for authentication
    if (!authService.getState().isAuthenticated) {
      setLocation("/login");
    }
    return unsubscribe;
  }, [setLocation]);

  // Fetch services - use user ID in query key to prevent cache conflicts between merchants
  const { data: services, isLoading } = useQuery<Service[]>({
    queryKey: ["/api/services", user?.role, user?.id, user?.email], // Include role and user details for strict isolation
    queryFn: async () => {
      console.log(`\n=== 🎯 FRONTEND SERVICES FETCH DEBUG ===`);
      console.log(`👤 Current user:`, {
        id: user?.id?.substring(0, 8) + "...",
        email: user?.email,
        role: user?.role,
        name: user?.name,
        ownerName: user?.ownerName
      });
      console.log(`🔐 Auth state:`, {
        isAuthenticated: authService.getState().isAuthenticated,
        hasToken: !!authService.getState().token,
        userEmail: authService.getState().user?.email
      });

      const token = authService.getState().token;
      console.log(`🔑 Token for request: ${token ? 'PRESENT' : 'MISSING'}`);

      console.log(`\n📞 Making request to /api/services for merchant ${user?.email} (ID: ${user?.id?.substring(0, 8)}...)`);

      const response = await fetch("/api/services", {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      console.log(`\n📡 Response status: ${response.status}`);
      console.log(`📡 Response headers:`, Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        console.error(`❌ Request failed with status ${response.status}`);
        if (response.status === 401) {
          console.log("🚪 Unauthorized - redirecting to login");
          setLocation("/login");
        }
        throw new Error(`Failed to fetch services: ${response.status}`);
      }

      const data = await response.json();
      console.log(`\n📊 Raw response data:`, data);
      console.log(`📋 Frontend: Received ${data.length} services for user ${user?.email}:`);
      data.forEach((s: Service, index: number) => {
        const belongsToMe = s.merchantId === user?.id;
        const status = belongsToMe ? "✅ MINE" : "❌ OTHER";
        console.log(`  [${index}] "${s.name}" (ID: ${s.id.substring(0, 8)}...) merchantId: "${s.merchantId.substring(0, 8)}..." ${status}`);
      });

      // CRITICAL FRONTEND SECURITY CHECK: Ensure ALL services belong to current user
      if (user?.role === "merchant") {
        console.log(`\n🔒 Performing frontend security check for merchant ${user.email} (ID: ${user.id?.substring(0, 8)}...)`);

        const validServices = data.filter((service: Service) => service.merchantId === user.id);
        const invalidServices = data.filter((service: Service) => service.merchantId !== user.id);

        console.log(`🛡️  Frontend Security Results:`);
        console.log(`✅ Valid services (belong to me): ${validServices.length}`);
        console.log(`❌ Invalid services (data leak): ${invalidServices.length}`);

        if (invalidServices.length > 0) {
          console.error(`\n🚨🚨🚨 FRONTEND SECURITY BREACH DETECTED! 🚨🚨🚨`);
          console.error(`❌ Found ${invalidServices.length} services that don't belong to merchant ${user.email}:`);
          invalidServices.forEach(service => {
            console.error(`  - LEAKED: "${service.name}" (ID: ${service.id}) belongs to merchant: "${service.merchantId}"`);
          });

          console.error(`\n📋 FRONTEND INCIDENT REPORT:`);
          console.error(`- Current user: ${user.email} (${user.id})`);
          console.error(`- Services leaked: ${invalidServices.length}`);
          console.error(`- Leaked from merchants:`, Array.from(new Set(invalidServices.map(s => s.merchantId))));

          console.error(`🚨 EMERGENCY SECURITY MEASURES ACTIVATED 🚨`);
          console.error(`- Clearing all cache to prevent data contamination`);
          console.error(`- Forcing logout to ensure security`);

          // Emergency security measures
          queryClient.clear();
          authService.logout();
          setLocation("/login");
          throw new Error("FALHA CRÍTICA DE SEGURANÇA: Dados de outros usuários detectados. Sistema bloqueado por segurança.");
        }

        if (validServices.length !== data.length) {
          console.warn(`⚠️  Frontend: Data inconsistency - received ${data.length} services but only ${validServices.length} are valid for merchant ${user.email}`);
        }

        console.log(`\n✅ Frontend SECURITY VERIFICATION PASSED`);
        console.log(`🎯 All ${validServices.length} services verified for merchant ${user.email}`);
        console.log(`📋 Valid services:`, validServices.map(s => ({ id: s.id.substring(0, 8) + "...", name: s.name })));
        console.log(`=== END FRONTEND SERVICES FETCH DEBUG ===\n`);
        return validServices;
      }

      console.log(`ℹ️  Non-merchant user - returning all data without filtering`);
      console.log(`=== END FRONTEND SERVICES FETCH DEBUG ===\n`);
      return data;
    },
    enabled: authService.getState().isAuthenticated && user?.role === "merchant" && !!user?.id,
    staleTime: 0, // Always refetch to ensure fresh data
    gcTime: 0, // Don't keep cache for long
    refetchOnMount: true, // Always refetch when component mounts
    refetchOnReconnect: true, // Refetch when connection restored
  });

  const createServiceMutation = useMutation({
    mutationFn: async (serviceData: any) => {
      const response = await fetch("/api/services", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          'Authorization': `Bearer ${authService.getState().token}`,
        },
        body: JSON.stringify({
          ...serviceData,
          price: Math.round(parseFloat(serviceData.price.replace(",", ".")) * 100), // Support Brazilian format and convert to cents
          duration: parseInt(serviceData.duration),
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          setLocation("/login");
        }
        const error = await response.json();
        throw new Error(error.message || "Erro ao criar serviço");
      }

      return response.json();
    },
    onSuccess: async () => {
      toast({
        title: "Sucesso!",
        description: "Serviço criado com sucesso",
      });
      // Clear ALL service-related queries to prevent cross-contamination
      queryClient.removeQueries({ queryKey: ["/api/services"] });
      queryClient.invalidateQueries({ queryKey: ["/api/merchant/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/client/services"] });
      queryClient.invalidateQueries({ queryKey: ["/api/client/availability"] });

      // Force refetch with new key
      await queryClient.refetchQueries({ queryKey: ["/api/services", user?.id] });
      resetForm();
      setIsNewServiceModalOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateServiceMutation = useMutation({
    mutationFn: async ({ id, serviceData }: { id: string; serviceData: any }) => {
      const response = await fetch(`/api/services/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          'Authorization': `Bearer ${authService.getState().token}`,
        },
        body: JSON.stringify({
          ...serviceData,
          price: Math.round(parseFloat(serviceData.price.replace(",", ".")) * 100), // Support Brazilian format and convert to cents
          duration: parseInt(serviceData.duration),
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          setLocation("/login");
        }
        const error = await response.json();
        throw new Error(error.message || "Erro ao atualizar serviço");
      }

      return response.json();
    },
    onSuccess: async () => {
      toast({
        title: "Sucesso!",
        description: "Serviço atualizado com sucesso",
      });
      // Clear ALL service-related queries to prevent cross-contamination
      queryClient.removeQueries({ queryKey: ["/api/services"] });
      queryClient.invalidateQueries({ queryKey: ["/api/client/services"] });
      queryClient.invalidateQueries({ queryKey: ["/api/client/availability"] });

      // Force refetch with new key
      await queryClient.refetchQueries({ queryKey: ["/api/services", user?.id] });
      resetForm();
      setEditingService(null);
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteServiceMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/services/${id}`, {
        method: "DELETE",
        headers: {
          'Authorization': `Bearer ${authService.getState().token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          setLocation("/login");
        }
        const error = await response.json();
        throw new Error(error.message || "Erro ao excluir serviço");
      }
    },
    onSuccess: async () => {
      toast({
        title: "Sucesso!",
        description: "Serviço excluído com sucesso",
      });
      // Clear ALL service-related queries to prevent cross-contamination
      queryClient.removeQueries({ queryKey: ["/api/services"] });
      queryClient.invalidateQueries({ queryKey: ["/api/merchant/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/client/services"] });
      queryClient.invalidateQueries({ queryKey: ["/api/client/availability"] });

      // Force refetch with new key
      await queryClient.refetchQueries({ queryKey: ["/api/services", user?.id] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      price: "",
      duration: "",
      isActive: true,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.price || !formData.duration) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    if (editingService) {
      updateServiceMutation.mutate({ id: editingService.id, serviceData: formData });
    } else {
      createServiceMutation.mutate(formData);
    }
  };

  const handleEdit = (service: Service) => {
    setEditingService(service);
    setFormData({
      name: service.name,
      description: service.description || "",
      price: (service.price / 100).toString(),
      duration: service.duration.toString(),
      isActive: service.isActive,
    });
  };

  const handleDelete = (serviceId: string) => {
    if (confirm("Tem certeza que deseja excluir este serviço?")) {
      deleteServiceMutation.mutate(serviceId);
    }
  };

  const toggleServiceStatus = (service: Service) => {
    updateServiceMutation.mutate({
      id: service.id,
      serviceData: {
        name: service.name,
        description: service.description,
        price: (service.price / 100).toString(), // Convert cents to reais (same format as form input)
        duration: service.duration.toString(),
        isActive: !service.isActive,
      }
    });
  };

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
              <h1 className="text-2xl font-bold text-foreground">Gerenciar Serviços</h1>
            </div>
            <Dialog
              open={isNewServiceModalOpen || !!editingService}
              onOpenChange={(open) => {
                if (!open) {
                  setIsNewServiceModalOpen(false);
                  setEditingService(null);
                  resetForm();
                }
              }}
            >
              <DialogTrigger asChild>
                <Button
                  onClick={() => setIsNewServiceModalOpen(true)}
                  className="flex items-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Novo Serviço</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle>
                    {editingService ? "Editar Serviço" : "Novo Serviço"}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome do Serviço *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Ex: Corte masculino"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Descrição</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Descrição do serviço..."
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="price">Preço (R$) *</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="price"
                          type="number"
                          min="0"
                          step="0.01"
                          value={formData.price}
                          onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                          placeholder="0,00"
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="duration">Duração (minutos) *</Label>
                      <div className="relative">
                        <Clock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="duration"
                          type="number"
                          min="15"
                          step="15"
                          value={formData.duration}
                          onChange={(e) => setFormData(prev => ({ ...prev, duration: e.target.value }))}
                          placeholder="30"
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="isActive"
                      checked={formData.isActive}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
                    />
                    <Label htmlFor="isActive">Serviço ativo</Label>
                  </div>

                  <div className="flex justify-end space-x-4 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsNewServiceModalOpen(false);
                        setEditingService(null);
                        resetForm();
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      disabled={createServiceMutation.isPending || updateServiceMutation.isPending}
                    >
                      {createServiceMutation.isPending || updateServiceMutation.isPending
                        ? "Salvando..."
                        : editingService
                        ? "Atualizar"
                        : "Criar"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <main className="p-6">
        <div className="space-y-6">
          {/* Services Grid */}
          {isLoading ? (
            <Card>
              <CardContent className="p-6">
                <p className="text-muted-foreground">Carregando serviços...</p>
              </CardContent>
            </Card>
          ) : services && services.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {services.map((service) => (
                <Card key={service.id} className="relative">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <h3 className="text-lg font-semibold text-foreground">{service.name}</h3>
                          <Badge variant={service.isActive ? "default" : "secondary"}>
                            {service.isActive ? "Ativo" : "Inativo"}
                          </Badge>
                        </div>
                        {service.description && (
                          <p className="text-sm text-muted-foreground mb-3">
                            {service.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="flex items-center space-x-2">
                        <DollarSign className="w-4 h-4 text-muted-foreground" />
                        {(service as any).hasPromotion ? (
                          <div className="flex flex-col">
                            <span className="text-sm line-through text-gray-500">
                              R$ {((service as any).originalPrice / 100).toFixed(2)}
                            </span>
                            <div className="flex items-center space-x-2">
                              <span className="font-medium text-green-600">
                                R$ {((service as any).promotionalPrice / 100).toFixed(2)}
                              </span>
                              <Badge variant="destructive" className="text-xs">
                                PROMOÇÃO
                              </Badge>
                            </div>
                          </div>
                        ) : (
                          <span className="font-medium">R$ {(service.price / 100).toFixed(2)}</span>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          {service.duration} minutos
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1">
                        <Switch
                          checked={service.isActive}
                          onCheckedChange={() => toggleServiceStatus(service)}
                        />
                        <span className="text-sm text-muted-foreground">
                          {service.isActive ? "Ativo" : "Inativo"}
                        </span>
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(service)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(service.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-6 text-center">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">
                  Você ainda não tem serviços cadastrados
                </p>
                <Button
                  onClick={() => setIsNewServiceModalOpen(true)}
                >
                  Criar Primeiro Serviço
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}