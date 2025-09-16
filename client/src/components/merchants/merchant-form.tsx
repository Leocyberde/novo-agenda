import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertMerchantSchema } from "@shared/schema";
import type { z } from "zod";

const merchantFormSchema = insertMerchantSchema.extend({
  status: insertMerchantSchema.shape.status.default("active"),
});

type MerchantFormData = z.infer<typeof merchantFormSchema>;

interface MerchantFormProps {
  onSubmit: (data: MerchantFormData) => Promise<void>;
  onCancel: () => void;
  initialData?: Partial<MerchantFormData>;
  isLoading?: boolean;
}

export default function MerchantForm({ 
  onSubmit, 
  onCancel, 
  initialData,
  isLoading = false 
}: MerchantFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<MerchantFormData>({
    resolver: zodResolver(merchantFormSchema),
    defaultValues: {
      name: initialData?.name || "",
      ownerName: initialData?.ownerName || "",
      email: initialData?.email || "",
      password: initialData?.password || "",
      phone: initialData?.phone || "",
      address: initialData?.address || "",
      status: initialData?.status || "active",
    },
  });

  const handleFormSubmit = async (data: MerchantFormData) => {
    await onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4" data-testid="form-merchant">
      <div className="space-y-2">
        <Label htmlFor="name">Nome do Estabelecimento</Label>
        <Input
          id="name"
          {...register("name")}
          placeholder="Ex: Salão Bella Vista"
          data-testid="input-name"
        />
        {errors.name && (
          <p className="text-sm text-destructive" data-testid="error-name">
            {errors.name.message}
          </p>
        )}
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="ownerName">Nome Completo do Proprietário</Label>
        <Input
          id="ownerName"
          {...register("ownerName")}
          placeholder="Ex: Maria Silva Santos"
          data-testid="input-owner-name"
        />
        {errors.ownerName && (
          <p className="text-sm text-destructive" data-testid="error-owner-name">
            {errors.ownerName.message}
          </p>
        )}
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          {...register("email")}
          placeholder="contato@salao.com"
          data-testid="input-email"
        />
        {errors.email && (
          <p className="text-sm text-destructive" data-testid="error-email">
            {errors.email.message}
          </p>
        )}
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="password">Senha de Acesso</Label>
        <Input
          id="password"
          type="password"
          {...register("password")}
          placeholder="Digite uma senha"
          data-testid="input-password"
        />
        {errors.password && (
          <p className="text-sm text-destructive" data-testid="error-password">
            {errors.password.message}
          </p>
        )}
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="phone">Telefone</Label>
        <Input
          id="phone"
          {...register("phone")}
          placeholder="(11) 98765-4321"
          data-testid="input-phone"
        />
        {errors.phone && (
          <p className="text-sm text-destructive" data-testid="error-phone">
            {errors.phone.message}
          </p>
        )}
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="address">Endereço</Label>
        <Textarea
          id="address"
          {...register("address")}
          placeholder="Endereço completo"
          rows={3}
          className="resize-none"
          data-testid="input-address"
        />
        {errors.address && (
          <p className="text-sm text-destructive" data-testid="error-address">
            {errors.address.message}
          </p>
        )}
      </div>
      
      <div className="flex space-x-3 pt-4">
        <Button 
          type="button" 
          variant="secondary"
          onClick={onCancel}
          className="flex-1"
          disabled={isLoading}
          data-testid="button-cancel"
        >
          Cancelar
        </Button>
        <Button 
          type="submit" 
          className="flex-1"
          disabled={isLoading}
          data-testid="button-submit"
        >
          {isLoading ? "Salvando..." : initialData ? "Atualizar" : "Criar"}
        </Button>
      </div>
    </form>
  );
}
