import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Lock, Eye, EyeOff } from "lucide-react";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Senha atual é obrigatória"),
  newPassword: z.string().min(6, "Nova senha deve ter pelo menos 6 caracteres"),
  confirmPassword: z.string().min(1, "Confirmação de senha é obrigatória"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Nova senha e confirmação devem ser iguais",
  path: ["confirmPassword"],
});

type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;

export default function ChangePasswordForm() {
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { toast } = useToast();

  const form = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (data: ChangePasswordFormData) => {
      console.log("Enviando dados para alteração de senha:", {
        currentPassword: "***",
        newPassword: "***",
        confirmPassword: "***"
      });
      
      const response = await apiRequest("POST", "/api/auth/change-password", {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
        confirmPassword: data.confirmPassword,
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Erro desconhecido" }));
        console.error("Erro na API de alteração de senha:", errorData);
        throw new Error(errorData.message || "Erro ao alterar senha");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      console.log("Senha alterada com sucesso:", data);
      toast({
        title: "Sucesso",
        description: "Senha alterada com sucesso!",
      });
      form.reset();
    },
    onError: (error: any) => {
      console.error("Erro na mutation de alteração de senha:", error);
      const message = error?.message || "Erro ao alterar senha";
      toast({
        title: "Erro",
        description: message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ChangePasswordFormData) => {
    changePasswordMutation.mutate(data);
  };

  return (
    <Card className="w-full max-w-md" data-testid="card-change-password">
      <CardHeader>
        <CardTitle className="flex items-center gap-2" data-testid="text-title">
          <Lock className="w-5 h-5" />
          Alterar Senha
        </CardTitle>
        <CardDescription data-testid="text-description">
          Altere sua senha de acesso ao sistema
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" data-testid="form-change-password">
            <FormField
              control={form.control}
              name="currentPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel data-testid="label-current-password">Senha Atual</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showCurrentPassword ? "text" : "password"}
                        placeholder="Digite sua senha atual"
                        data-testid="input-current-password"
                        {...field}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-2 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        data-testid="button-toggle-current-password"
                      >
                        {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage data-testid="error-current-password" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel data-testid="label-new-password">Nova Senha</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showNewPassword ? "text" : "password"}
                        placeholder="Digite sua nova senha (mínimo 6 caracteres)"
                        data-testid="input-new-password"
                        {...field}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-2 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        data-testid="button-toggle-new-password"
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage data-testid="error-new-password" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel data-testid="label-confirm-password">Confirmar Nova Senha</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Digite novamente sua nova senha"
                        data-testid="input-confirm-password"
                        {...field}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-2 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        data-testid="button-toggle-confirm-password"
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage data-testid="error-confirm-password" />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full"
              disabled={changePasswordMutation.isPending}
              data-testid="button-submit"
            >
              {changePasswordMutation.isPending ? "Alterando..." : "Alterar Senha"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}