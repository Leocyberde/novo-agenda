
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import Header from "@/components/layout/header";
import Sidebar from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings, DollarSign, Calendar, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { authService } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface SystemSetting {
  id: string;
  key: string;
  value: string;
  description: string;
  type: string;
  createdAt: string;
  updatedAt: string;
}

export default function AdminSettings() {
  const [vipPrice, setVipPrice] = useState("");
  const [trialDuration, setTrialDuration] = useState("");
  const [vipDuration, setVipDuration] = useState("");
  const { toast } = useToast();

  // Fetch all system settings
  const { data: settings = [], isLoading } = useQuery<SystemSetting[]>({
    queryKey: ["/api/admin/system-settings"],
    enabled: authService.getState().isAuthenticated,
  });

  // Update system settings values when data is loaded
  React.useEffect(() => {
    if (settings.length > 0) {
      const vipPriceSetting = settings.find(s => s.key === 'vip_plan_price');
      const trialDurationSetting = settings.find(s => s.key === 'trial_plan_duration');
      const vipDurationSetting = settings.find(s => s.key === 'vip_plan_duration');

      if (vipPriceSetting) {
        setVipPrice((parseInt(vipPriceSetting.value) / 100).toString()); // Convert cents to reais
      }
      if (trialDurationSetting) {
        setTrialDuration(trialDurationSetting.value);
      }
      if (vipDurationSetting) {
        setVipDuration(vipDurationSetting.value);
      }
    }
  }, [settings]);

  const updateSettingMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const response = await apiRequest("PUT", `/api/admin/system-settings/${key}`, { value });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/system-settings"] });
      toast({
        title: "Configuração atualizada",
        description: "As configurações foram salvas com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar",
        description: error.message || "Não foi possível salvar as configurações.",
        variant: "destructive",
      });
    },
  });

  const handleSaveVipPrice = () => {
    const priceInCents = Math.round(parseFloat(vipPrice || "0") * 100);
    updateSettingMutation.mutate({ key: "vip_plan_price", value: priceInCents.toString() });
  };

  const handleSaveTrialDuration = () => {
    updateSettingMutation.mutate({ key: "trial_plan_duration", value: trialDuration });
  };

  const handleSaveVipDuration = () => {
    updateSettingMutation.mutate({ key: "vip_plan_duration", value: vipDuration });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-6">
            <div className="flex items-center justify-center h-64">
              <p className="text-muted-foreground">Carregando configurações...</p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" data-testid="page-admin-settings">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                  <Settings className="w-6 h-6" />
                  Configurações do Sistema
                </h2>
                <p className="text-muted-foreground">
                  Gerencie os valores e configurações gerais da plataforma
                </p>
              </div>
            </div>

            {/* Plan Pricing Configuration */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  Configuração de Planos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* VIP Plan Price */}
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="vipPrice" className="text-base font-medium">
                      Valor do Plano VIP (R$)
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Este valor será aplicado a todos os novos cadastros de plano VIP
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="relative flex-1 max-w-xs">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">
                        R$
                      </span>
                      <Input
                        id="vipPrice"
                        type="number"
                        min="0"
                        step="0.01"
                        value={vipPrice}
                        onChange={(e) => setVipPrice(e.target.value)}
                        className="pl-10"
                        placeholder="50.00"
                        data-testid="input-vip-price"
                      />
                    </div>
                    <Button
                      onClick={handleSaveVipPrice}
                      disabled={updateSettingMutation.isPending || !vipPrice}
                      data-testid="button-save-vip-price"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      Salvar
                    </Button>
                  </div>
                </div>

                <div className="border-t pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Trial Duration */}
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="trialDuration" className="text-base font-medium">
                          Duração do Teste Grátis (dias)
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Quantos dias o plano de teste ficará ativo
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Input
                          id="trialDuration"
                          type="number"
                          min="1"
                          max="365"
                          value={trialDuration}
                          onChange={(e) => setTrialDuration(e.target.value)}
                          className="max-w-xs"
                          placeholder="10"
                          data-testid="input-trial-duration"
                        />
                        <Button
                          onClick={handleSaveTrialDuration}
                          disabled={updateSettingMutation.isPending || !trialDuration}
                          data-testid="button-save-trial-duration"
                        >
                          <Save className="w-4 h-4 mr-2" />
                          Salvar
                        </Button>
                      </div>
                    </div>

                    {/* VIP Duration */}
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="vipDuration" className="text-base font-medium">
                          Duração do Plano VIP (dias)
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Quantos dias o plano VIP ficará ativo
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Input
                          id="vipDuration"
                          type="number"
                          min="1"
                          max="365"
                          value={vipDuration}
                          onChange={(e) => setVipDuration(e.target.value)}
                          className="max-w-xs"
                          placeholder="30"
                          data-testid="input-vip-duration"
                        />
                        <Button
                          onClick={handleSaveVipDuration}
                          disabled={updateSettingMutation.isPending || !vipDuration}
                          data-testid="button-save-vip-duration"
                        >
                          <Save className="w-4 h-4 mr-2" />
                          Salvar
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Current Settings Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Resumo das Configurações Atuais</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <h3 className="font-medium text-foreground">Plano VIP</h3>
                    <p className="text-2xl font-bold text-green-600">
                      R$ {vipPrice || "0,00"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {vipDuration || "30"} dias de acesso
                    </p>
                  </div>
                  
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <h3 className="font-medium text-foreground">Teste Grátis</h3>
                    <p className="text-2xl font-bold text-blue-600">
                      Gratuito
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {trialDuration || "10"} dias de acesso
                    </p>
                  </div>

                  <div className="bg-muted/50 p-4 rounded-lg">
                    <h3 className="font-medium text-foreground">Última Atualização</h3>
                    <p className="text-sm text-muted-foreground">
                      {settings.length > 0 
                        ? new Date(settings[0].updatedAt).toLocaleDateString("pt-BR")
                        : "Nunca"
                      }
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
