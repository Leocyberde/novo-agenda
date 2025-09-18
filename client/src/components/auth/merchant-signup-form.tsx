import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertMerchantSchema } from "@shared/schema";
import { z } from "zod";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Crown, Gift } from "lucide-react";

type MerchantSignupData = z.infer<typeof insertMerchantSchema> & {
  planType: "trial" | "vip";
};

interface MerchantSignupFormProps {
  onBack: () => void;
}

export default function MerchantSignupForm({ onBack }: MerchantSignupFormProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [vipPrice, setVipPrice] = useState("50,00"); // Default value
  // Removed isRedirecting state that was blocking the redirect
  const [step, setStep] = useState<"info" | "plan" | "payment">("info");

  // Fetch VIP price from system settings
  useEffect(() => {
    const fetchVipPrice = async () => {
      try {
        const response = await fetch('/api/admin/system-settings/vip_plan_price');
        if (response.ok) {
          const setting = await response.json();
          const priceInReais = (parseInt(setting.value) / 100).toFixed(2).replace('.', ',');
          setVipPrice(priceInReais);
        }
      } catch (error) {
        console.log("Could not fetch VIP price, using default");
      }
    };

    fetchVipPrice();
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<MerchantSignupData>({
    resolver: zodResolver(insertMerchantSchema.extend({
      planType: z.enum(["trial", "vip"]).default("trial"),
    })),
    defaultValues: {
      name: "",
      ownerName: "",
      email: "",
      password: "",
      phone: "",
      address: "",
      planType: "trial",
    },
  });

  const selectedPlan = watch("planType");

  const onSubmitInfo = () => {
    setStep("plan");
  };

  const onSubmitPlan = () => {
    if (selectedPlan === "vip") {
      setStep("payment");
    } else {
      handleSignup();
    }
  };

  const handleSignup = async () => {
    setIsLoading(true);
    try {
      const formData = watch();
      console.log("Starting merchant registration for:", formData.email);
      
      // Call the merchant registration API endpoint
      const response = await fetch('/api/merchants/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      console.log("Registration response status:", response.status);

      if (response.ok) {
        console.log("Merchant registration successful, showing toast and redirecting...");
        
        toast({
          title: "Cadastro realizado com sucesso!",
          description: selectedPlan === "trial" 
            ? "Sua conta foi criada com 10 dias grátis! Redirecionando para o login..." 
            : "Conta criada! Aguarde a confirmação do pagamento. Redirecionando para o login...",
        });
        
        // Use setTimeout to ensure the toast is shown before redirect
        setTimeout(() => {
          console.log("About to redirect to /login with automatic page refresh");
          
          // Force navigation to login page with page refresh
          // This ensures the page state is completely reset
          window.location.replace("/login");
          
          // Fallback in case replace doesn't work
          setTimeout(() => {
            console.log("Using href fallback");
            window.location.href = "/login";
          }, 500);
        }, 2000); // 2 second delay to show the toast
      } else {
        console.log("Registration failed with status:", response.status);
        const error = await response.json();
        console.log("Registration error:", error);
        toast({
          title: "Erro no cadastro",
          description: error.message || "Tente novamente",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Network or connection error during registration:", error);
      toast({
        title: "Erro de conexão",
        description: "Não foi possível conectar ao servidor",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const renderInfoStep = () => (
    <>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <CardTitle>Cadastre seu Salão</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome do Salão *</Label>
            <Input
              id="name"
              {...register("name")}
              placeholder="Salão Beauty"
              disabled={isLoading}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="ownerName">Nome do Proprietário *</Label>
            <Input
              id="ownerName"
              {...register("ownerName")}
              placeholder="João Silva"
              disabled={isLoading}
            />
            {errors.ownerName && (
              <p className="text-sm text-destructive">{errors.ownerName.message}</p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email *</Label>
          <Input
            id="email"
            type="email"
            {...register("email")}
            placeholder="joao@salaobeauty.com"
            disabled={isLoading}
          />
          {errors.email && (
            <p className="text-sm text-destructive">{errors.email.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Senha *</Label>
          <Input
            id="password"
            type="password"
            {...register("password")}
            placeholder="Mínimo 6 caracteres"
            disabled={isLoading}
          />
          {errors.password && (
            <p className="text-sm text-destructive">{errors.password.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Telefone *</Label>
          <Input
            id="phone"
            {...register("phone")}
            placeholder="(11) 99999-9999"
            disabled={isLoading}
          />
          {errors.phone && (
            <p className="text-sm text-destructive">{errors.phone.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="address">Endereço *</Label>
          <Input
            id="address"
            {...register("address")}
            placeholder="Rua das Flores, 123 - Centro"
            disabled={isLoading}
          />
          {errors.address && (
            <p className="text-sm text-destructive">{errors.address.message}</p>
          )}
        </div>

        <Button 
          type="button" 
          className="w-full"
          onClick={handleSubmit(onSubmitInfo)}
          disabled={isLoading}
        >
          Continuar
        </Button>
      </CardContent>
    </>
  );

  const renderPlanStep = () => (
    <>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setStep("info")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <CardTitle>Escolha seu Plano</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <RadioGroup 
          value={selectedPlan} 
          onValueChange={(value) => setValue("planType", value as "trial" | "vip")}
        >
          {/* Teste Grátis */}
          <div className="flex items-center space-x-3 border rounded-lg p-4 hover:bg-muted/50">
            <RadioGroupItem value="trial" id="trial" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Gift className="h-5 w-5 text-green-600" />
                <Label htmlFor="trial" className="font-medium">
                  Teste Grátis - 10 Dias
                </Label>
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  Recomendado
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Experimente todas as funcionalidades gratuitamente por 10 dias
              </p>
              <ul className="text-xs text-muted-foreground mt-2 space-y-1">
                <li>✓ Agendamentos ilimitados</li>
                <li>✓ Cadastro de clientes</li>
                <li>✓ Controle de serviços</li>
                <li>✓ Relatórios básicos</li>
              </ul>
            </div>
          </div>

          {/* Plano VIP */}
          <div className="flex items-center space-x-3 border rounded-lg p-4 hover:bg-muted/50">
            <RadioGroupItem value="vip" id="vip" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-amber-600" />
                <Label htmlFor="vip" className="font-medium">
                  Plano VIP - 30 Dias
                </Label>
                <Badge className="bg-amber-100 text-amber-800">
                  R$ {vipPrice}/mês
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Acesso completo com recursos avançados por 30 dias
              </p>
              <ul className="text-xs text-muted-foreground mt-2 space-y-1">
                <li>✓ Tudo do teste grátis</li>
                <li>✓ Relatórios avançados</li>
                <li>✓ Gestão de funcionários</li>
                <li>✓ Sistema de penalidades</li>
                <li>✓ Promoções personalizadas</li>
                <li>✓ Suporte prioritário</li>
              </ul>
            </div>
          </div>
        </RadioGroup>

        <Button 
          type="button" 
          className="w-full"
          onClick={onSubmitPlan}
          disabled={isLoading}
        >
          {selectedPlan === "vip" ? "Ir para Pagamento" : "Criar Conta Gratuita"}
        </Button>
      </CardContent>
    </>
  );

  const renderPaymentStep = () => (
    <>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setStep("plan")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <CardTitle>Pagamento - Plano VIP</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="bg-muted/50 p-4 rounded-lg">
          <h3 className="font-medium mb-2">Resumo do Pedido</h3>
          <div className="flex justify-between">
            <span>Plano VIP - 30 dias</span>
            <span className="font-medium">R$ {vipPrice}</span>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="font-medium">Método de Pagamento</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <Button variant="outline" className="h-16 flex-col">
              <span className="text-sm">Cartão de Crédito</span>
            </Button>
            <Button variant="outline" className="h-16 flex-col">
              <span className="text-sm">PIX</span>
            </Button>
          </div>

          <div className="text-center text-sm text-muted-foreground">
            <p>Esta é apenas uma demonstração da interface de pagamento.</p>
            <p>A integração será implementada em breve.</p>
          </div>
        </div>

        <div className="space-y-2">
          <Button 
            className="w-full"
            onClick={handleSignup}
            disabled={isLoading}
          >
            {isLoading ? "Processando..." : "Finalizar Cadastro"}
          </Button>
          
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => {
              setValue("planType", "trial");
              setStep("plan");
            }}
          >
            Voltar ao Teste Grátis
          </Button>
        </div>
      </CardContent>
    </>
  );

  // Removed isRedirecting render that was blocking the redirect

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-accent/10 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <Card className="shadow-2xl border border-border">
          {step === "info" && renderInfoStep()}
          {step === "plan" && renderPlanStep()}
          {step === "payment" && renderPaymentStep()}
        </Card>
      </div>
    </div>
  );
}