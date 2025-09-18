import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { authService } from "@/lib/auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema } from "@shared/schema";
import type { z } from "zod";
import MerchantSignupForm from "@/components/auth/merchant-signup-form";

type LoginData = z.infer<typeof loginSchema>;

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showSignup, setShowSignup] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  useEffect(() => {
    const unsubscribe = authService.subscribe((state) => {
      if (state.isAuthenticated) {
        // Let App.tsx handle role-based redirection
        setLocation("/");
      }
    });
    return unsubscribe;
  }, [setLocation]);

  const onSubmit = async (data: LoginData) => {
    setIsLoading(true);
    try {
      const result = await authService.login(data.email, data.password);

      if (result.success) {
        toast({
          title: "Login realizado com sucesso!",
          description: "Redirecionando para o painel...",
        });
        console.log("Login successful, user data:", result.user);
        if (result.user.role === "employee") {
          console.log("Redirecting to employee dashboard");
          setLocation("/employee-dashboard");
        } else if (result.user.role === "merchant") {
          console.log("Redirecting to merchant dashboard");
          setLocation("/merchant-dashboard");
        } else if (result.user.role === "client") {
          console.log("Redirecting to client dashboard");
          setLocation("/client-dashboard");
        } else {
          console.log("Redirecting to admin dashboard");
          setLocation("/dashboard");
        }
      } else {
        toast({
          title: "Erro no login",
          description: result.error || "Credenciais inválidas",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Erro de conexão",
        description: "Não foi possível conectar ao servidor",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (showSignup) {
    return <MerchantSignupForm onBack={() => setShowSignup(false)} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-accent/10 flex items-center justify-center p-4" data-testid="page-login">
      <div className="w-full max-w-md">
        <Card className="shadow-2xl border border-border">
          <CardContent className="p-8 space-y-6">
            {/* Logo/Header */}
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl text-primary-foreground">✂️</span>
              </div>
              <h1 className="text-2xl font-bold text-foreground">Beauty Scheduler</h1>
              <p className="text-muted-foreground">Painel Administrativo</p>
            </div>

            {/* Login Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" data-testid="form-login">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  {...register("email")}
                  placeholder="leolulu842@gmail.com"
                  disabled={isLoading}
                  data-testid="input-email"
                />
                {errors.email && (
                  <p className="text-sm text-destructive" data-testid="error-email">
                    {errors.email.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  {...register("password")}
                  placeholder="Digite sua senha"
                  disabled={isLoading}
                  data-testid="input-password"
                />
                {errors.password && (
                  <p className="text-sm text-destructive" data-testid="error-password">
                    {errors.password.message}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="remember"
                    className="w-4 h-4 text-primary border border-input rounded focus:ring-ring"
                  />
                  <label htmlFor="remember" className="text-sm text-muted-foreground">
                    Lembrar-me
                  </label>
                </div>
                <a href="#" className="text-sm text-primary hover:underline">
                  Esqueceu a senha?
                </a>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
                data-testid="button-login"
              >
                {isLoading ? "Entrando..." : "Entrar"}
              </Button>
            </form>

            {/* Divisor */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Ou
                </span>
              </div>
            </div>

            {/* Botão de Cadastro */}
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => setShowSignup(true)}
              disabled={isLoading}
            >
              Cadastre seu Salão
            </Button>

            <div className="pt-4 text-center text-sm text-muted-foreground">
              © 2024 Beauty Scheduler. Todos os direitos reservados.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}