
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Edit, Trash2, DollarSign, Calendar, Percent, Tag } from "lucide-react";
import { authService } from "@/lib/auth";
import { toast } from "@/hooks/use-toast";

interface Service {
  id: string;
  name: string;
  price: number;
  duration: number;
  isActive: boolean;
}

interface Promotion {
  id: string;
  merchantId: string;
  serviceId: string;
  name: string;
  description?: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
  serviceName?: string;
  servicePrice?: number;
  createdAt: string;
  updatedAt: string;
}

export default function Promotions() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [user, setUser] = useState(authService.getState().user);
  const [isNewPromotionModalOpen, setIsNewPromotionModalOpen] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    serviceId: "",
    discountType: "percentage" as "percentage" | "fixed",
    discountValue: "",
    startDate: "",
    endDate: "",
    isActive: true,
  });

  useEffect(() => {
    const unsubscribe = authService.subscribe((state) => {
      setUser(state.user);
      if (!state.isAuthenticated) {
        setLocation("/login");
      }
    });
    if (!authService.getState().isAuthenticated) {
      setLocation("/login");
    }
    return unsubscribe;
  }, [setLocation]);

  // Fetch services
  const { data: services = [], isLoading: servicesLoading } = useQuery<Service[]>({
    queryKey: ["/api/services", user?.id],
    queryFn: async () => {
      const response = await fetch("/api/services", {
        headers: {
          'Authorization': `Bearer ${authService.getState().token}`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch services");
      return response.json();
    },
    enabled: authService.getState().isAuthenticated && user?.role === "merchant",
  });

  // Fetch promotions
  const { data: promotions = [], isLoading: promotionsLoading } = useQuery<Promotion[]>({
    queryKey: ["/api/promotions", user?.id],
    queryFn: async () => {
      const response = await fetch("/api/promotions", {
        headers: {
          'Authorization': `Bearer ${authService.getState().token}`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch promotions");
      return response.json();
    },
    enabled: authService.getState().isAuthenticated && user?.role === "merchant",
  });

  const createPromotionMutation = useMutation({
    mutationFn: async (promotionData: any) => {
      const response = await fetch("/api/promotions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          'Authorization': `Bearer ${authService.getState().token}`,
        },
        body: JSON.stringify({
          ...promotionData,
          discountValue: promotionData.discountType === "percentage" 
            ? parseInt(promotionData.discountValue)
            : Math.round(parseFloat(promotionData.discountValue.replace(",", ".")) * 100), // Convert to cents for fixed discount
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao criar promoção");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Sucesso!",
        description: "Promoção criada com sucesso",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/promotions"] });
      resetForm();
      setIsNewPromotionModalOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updatePromotionMutation = useMutation({
    mutationFn: async ({ id, promotionData }: { id: string; promotionData: any }) => {
      const response = await fetch(`/api/promotions/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          'Authorization': `Bearer ${authService.getState().token}`,
        },
        body: JSON.stringify({
          ...promotionData,
          discountValue: promotionData.discountType === "percentage" 
            ? parseInt(promotionData.discountValue)
            : Math.round(parseFloat(promotionData.discountValue.replace(",", ".")) * 100), // Convert to cents for fixed discount
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao atualizar promoção");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Sucesso!",
        description: "Promoção atualizada com sucesso",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/promotions"] });
      resetForm();
      setEditingPromotion(null);
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deletePromotionMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/promotions/${id}`, {
        method: "DELETE",
        headers: {
          'Authorization': `Bearer ${authService.getState().token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao excluir promoção");
      }
    },
    onSuccess: () => {
      toast({
        title: "Sucesso!",
        description: "Promoção excluída com sucesso",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/promotions"] });
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
      serviceId: "",
      discountType: "percentage",
      discountValue: "",
      startDate: "",
      endDate: "",
      isActive: true,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.serviceId || !formData.discountValue || !formData.startDate || !formData.endDate) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    const discountValue = parseFloat(formData.discountValue);
    if (formData.discountType === "percentage" && (discountValue < 1 || discountValue > 99)) {
      toast({
        title: "Erro",
        description: "Desconto percentual deve estar entre 1% e 99%",
        variant: "destructive",
      });
      return;
    }

    if (editingPromotion) {
      updatePromotionMutation.mutate({ id: editingPromotion.id, promotionData: formData });
    } else {
      createPromotionMutation.mutate(formData);
    }
  };

  const handleEdit = (promotion: Promotion) => {
    setEditingPromotion(promotion);
    setFormData({
      name: promotion.name,
      description: promotion.description || "",
      serviceId: promotion.serviceId,
      discountType: promotion.discountType,
      discountValue: promotion.discountType === "percentage" 
        ? promotion.discountValue.toString()
        : (promotion.discountValue / 100).toString(),
      startDate: promotion.startDate,
      endDate: promotion.endDate,
      isActive: promotion.isActive,
    });
  };

  const handleDelete = (promotionId: string) => {
    if (confirm("Tem certeza que deseja excluir esta promoção?")) {
      deletePromotionMutation.mutate(promotionId);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(amount / 100);
  };

  const calculateDiscountedPrice = (originalPrice: number, discountType: string, discountValue: number) => {
    if (discountType === "percentage") {
      return originalPrice - Math.round((originalPrice * discountValue) / 100);
    } else {
      return Math.max(0, originalPrice - discountValue);
    }
  };

  const isPromotionActive = (startDate: string, endDate: string) => {
    const today = new Date().toISOString().split('T')[0];
    return today >= startDate && today <= endDate;
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
              <h1 className="text-2xl font-bold text-foreground">Gerenciar Promoções</h1>
            </div>
            <Dialog
              open={isNewPromotionModalOpen || !!editingPromotion}
              onOpenChange={(open) => {
                if (!open) {
                  setIsNewPromotionModalOpen(false);
                  setEditingPromotion(null);
                  resetForm();
                }
              }}
            >
              <DialogTrigger asChild>
                <Button
                  onClick={() => setIsNewPromotionModalOpen(true)}
                  className="flex items-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nova Promoção</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle>
                    {editingPromotion ? "Editar Promoção" : "Nova Promoção"}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome da Promoção *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Ex: Desconto de Verão"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Descrição</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Descrição da promoção..."
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="serviceId">Serviço *</Label>
                    <Select
                      value={formData.serviceId}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, serviceId: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um serviço" />
                      </SelectTrigger>
                      <SelectContent>
                        {services.map((service) => (
                          <SelectItem key={service.id} value={service.id}>
                            {service.name} - {formatCurrency(service.price)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="discountType">Tipo de Desconto *</Label>
                      <Select
                        value={formData.discountType}
                        onValueChange={(value: "percentage" | "fixed") => setFormData(prev => ({ ...prev, discountType: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percentage">Porcentagem (%)</SelectItem>
                          <SelectItem value="fixed">Valor Fixo (R$)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="discountValue">Valor do Desconto *</Label>
                      <div className="relative">
                        {formData.discountType === "percentage" ? (
                          <Percent className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        ) : (
                          <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        )}
                        <Input
                          id="discountValue"
                          type="number"
                          min={formData.discountType === "percentage" ? "1" : "0.01"}
                          max={formData.discountType === "percentage" ? "99" : undefined}
                          step={formData.discountType === "percentage" ? "1" : "0.01"}
                          value={formData.discountValue}
                          onChange={(e) => setFormData(prev => ({ ...prev, discountValue: e.target.value }))}
                          placeholder={formData.discountType === "percentage" ? "10" : "10,00"}
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="startDate">Data de Início *</Label>
                      <Input
                        id="startDate"
                        type="date"
                        value={formData.startDate}
                        onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="endDate">Data de Fim *</Label>
                      <Input
                        id="endDate"
                        type="date"
                        value={formData.endDate}
                        onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                        required
                      />
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="isActive"
                      checked={formData.isActive}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
                    />
                    <Label htmlFor="isActive">Promoção ativa</Label>
                  </div>

                  <div className="flex justify-end space-x-4 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsNewPromotionModalOpen(false);
                        setEditingPromotion(null);
                        resetForm();
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      disabled={createPromotionMutation.isPending || updatePromotionMutation.isPending}
                    >
                      {createPromotionMutation.isPending || updatePromotionMutation.isPending
                        ? "Salvando..."
                        : editingPromotion
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
          {/* Promotions Grid */}
          {promotionsLoading ? (
            <Card>
              <CardContent className="p-6">
                <p className="text-muted-foreground">Carregando promoções...</p>
              </CardContent>
            </Card>
          ) : promotions && promotions.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {promotions.map((promotion) => {
                const isActive = isPromotionActive(promotion.startDate, promotion.endDate) && promotion.isActive;
                const originalPrice = promotion.servicePrice || 0;
                const discountedPrice = calculateDiscountedPrice(originalPrice, promotion.discountType, promotion.discountValue);

                return (
                  <Card key={promotion.id} className="relative">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h3 className="text-lg font-semibold text-foreground">{promotion.name}</h3>
                            <Badge variant={isActive ? "default" : "secondary"}>
                              {isActive ? "Ativa" : "Inativa"}
                            </Badge>
                          </div>
                          {promotion.description && (
                            <p className="text-sm text-muted-foreground mb-3">
                              {promotion.description}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="space-y-3 mb-4">
                        <div className="flex items-center space-x-2">
                          <Tag className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">{promotion.serviceName}</span>
                        </div>
                        
                        <div className="bg-green-50 p-3 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-gray-600">Preço Original:</span>
                            <span className="text-sm line-through text-gray-500">
                              {formatCurrency(originalPrice)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-green-700">Preço Promocional:</span>
                            <span className="text-lg font-bold text-green-600">
                              {formatCurrency(discountedPrice)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <Percent className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            {promotion.discountType === "percentage" 
                              ? `${promotion.discountValue}% de desconto`
                              : `R$ ${(promotion.discountValue / 100).toFixed(2)} de desconto`}
                          </span>
                        </div>

                        <div className="flex items-center space-x-2">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            {new Date(promotion.startDate).toLocaleDateString('pt-BR')} - {new Date(promotion.endDate).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                      </div>

                      <div className="flex justify-end space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(promotion)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(promotion.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="p-6 text-center">
                <Tag className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">
                  Você ainda não tem promoções cadastradas
                </p>
                <Button
                  onClick={() => setIsNewPromotionModalOpen(true)}
                >
                  Criar Primeira Promoção
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
