import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Edit, Trash2, Users, Mail, Phone, ArrowLeft } from "lucide-react";
import { authService } from "@/lib/auth";
import { toast } from "@/hooks/use-toast";

interface Employee {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  specialties?: string;
  isActive: boolean;
  createdAt: string;
}

export default function Employees() {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [user, setUser] = useState(authService.getState().user);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    role: "employee",
    specialties: "",
    paymentType: "monthly",
    paymentValue: 0,
    isActive: true,
  });

  useEffect(() => {
    const unsubscribe = authService.subscribe((state) => {
      setUser(state.user);
      if (!state.isAuthenticated) {
        setLocation("/login");
      }
    });

    // Initial check for authentication state
    if (!authService.getState().isAuthenticated) {
      setLocation("/login");
    }

    return unsubscribe;
  }, [setLocation]);

  // Fetch employees
  const { data: employees, isLoading, error } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
    queryFn: async () => {
      const response = await fetch("/api/employees", {
        headers: {
          'Authorization': `Bearer ${authService.getState().token}`,
        },
      });
      if (!response.ok) {
        if (response.status === 401) {
          authService.logout();
          setLocation("/login");
          throw new Error("Unauthorized");
        }
        throw new Error('Failed to fetch employees');
      }
      return response.json();
    },
    enabled: authService.getState().isAuthenticated && user?.role === "merchant",
  });

  const createEmployeeMutation = useMutation({
    mutationFn: async (employeeData: any) => {
      const response = await fetch("/api/employees", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          'Authorization': `Bearer ${authService.getState().token}`,
        },
        body: JSON.stringify(employeeData),
      });

      if (!response.ok) {
        if (response.status === 401) {
          authService.logout();
          setLocation("/login");
          throw new Error("Unauthorized");
        }
        const error = await response.json();
        throw new Error(error.message || "Erro ao criar funcionário");
      }

      return response.json();
    },
    onSuccess: async () => {
      toast({
        title: "Sucesso!",
        description: "Funcionário criado com sucesso",
      });
      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      queryClient.invalidateQueries({ queryKey: ["/api/client/employees"] });
      queryClient.invalidateQueries({ queryKey: ["/api/client/availability"] });
      queryClient.invalidateQueries({ queryKey: ["/api/client/occupied-times"] });

      // Force refetch to update state immediately
      await queryClient.refetchQueries({ queryKey: ["/api/employees"] });

      setIsCreateDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateEmployeeMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await fetch(`/api/employees/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          'Authorization': `Bearer ${authService.getState().token}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        if (response.status === 401) {
          authService.logout();
          setLocation("/login");
          throw new Error("Unauthorized");
        }
        const error = await response.json();
        throw new Error(error.message || "Erro ao atualizar funcionário");
      }

      return response.json();
    },
    onSuccess: async () => {
      toast({
        title: "Sucesso!",
        description: "Funcionário atualizado com sucesso",
      });
      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      queryClient.invalidateQueries({ queryKey: ["/api/client/employees"] });
      queryClient.invalidateQueries({ queryKey: ["/api/client/availability"] });
      queryClient.invalidateQueries({ queryKey: ["/api/client/occupied-times"] });

      // Force refetch to update state immediately
      await queryClient.refetchQueries({ queryKey: ["/api/employees"] });

      setEditingEmployee(null);
      setIsCreateDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteEmployeeMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/employees/${id}`, {
        method: "DELETE",
        headers: {
          'Authorization': `Bearer ${authService.getState().token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          authService.logout();
          setLocation("/login");
          throw new Error("Unauthorized");
        }
        const error = await response.json();
        throw new Error(error.message || "Erro ao deletar funcionário");
      }

      return response.json();
    },
    onSuccess: async () => {
      toast({
        title: "Sucesso!",
        description: "Funcionário removido com sucesso",
      });
      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      queryClient.invalidateQueries({ queryKey: ["/api/client/employees"] });
      queryClient.invalidateQueries({ queryKey: ["/api/client/availability"] });
      queryClient.invalidateQueries({ queryKey: ["/api/client/occupied-times"] });

      // Force refetch to update state immediately
      await queryClient.refetchQueries({ queryKey: ["/api/employees"] });
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
      email: "",
      password: "",
      phone: "",
      role: "employee",
      specialties: "",
      paymentType: "monthly",
      paymentValue: 0,
      isActive: true,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.email || !formData.phone) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    if (editingEmployee) {
      const updateData: any = { ...formData };
      if (!formData.password) {
        delete updateData.password; // Don't update password if empty
      }
      updateEmployeeMutation.mutate({ id: editingEmployee.id, data: updateData });
    } else {
      if (!formData.password) {
        toast({
          title: "Erro",
          description: "Senha é obrigatória para novos funcionários",
          variant: "destructive",
        });
        return;
      }
      createEmployeeMutation.mutate(formData);
    }
  };

  const handleEdit = (employee: Employee) => {
    setEditingEmployee(employee);
    setFormData({
      name: employee.name,
      email: employee.email,
      password: "",
      phone: employee.phone,
      role: employee.role,
      specialties: employee.specialties || "",
      paymentType: (employee as any).paymentType || "monthly",
      paymentValue: (employee as any).paymentValue || 0,
      isActive: employee.isActive,
    });
    setIsCreateDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    deleteEmployeeMutation.mutate(id);
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Redirect to login if not authenticated or not a merchant
  useEffect(() => {
    if (!authService.getState().isAuthenticated || authService.getState().user?.role !== "merchant") {
      setLocation("/login");
    }
  }, [setLocation]);


  if (!authService.getState().isAuthenticated || authService.getState().user?.role !== "merchant") {
    // Optionally render a loading spinner or null if redirect is handled by useEffect
    return null;
  }

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
              <div className="flex items-center space-x-2">
                <Users className="w-6 h-6 text-primary" />
                <h1 className="text-2xl font-bold text-foreground">Funcionários</h1>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Comerciante:</p>
              <p className="text-sm font-medium text-foreground">{user?.name}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Users className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="text-sm text-muted-foreground">Total</p>
                    <p className="text-2xl font-bold">{employees?.length || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Users className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="text-sm text-muted-foreground">Ativos</p>
                    <p className="text-2xl font-bold">{employees?.filter(e => e.isActive).length || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Users className="w-5 h-5 text-gray-600" />
                  <div>
                    <p className="text-sm text-muted-foreground">Inativos</p>
                    <p className="text-2xl font-bold">{employees?.filter(e => !e.isActive).length || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Employees Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Lista de Funcionários</CardTitle>
                <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
                  setIsCreateDialogOpen(open);
                  if (!open) {
                    setEditingEmployee(null);
                    resetForm();
                  }
                }}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="w-4 h-4 mr-2" />
                      Novo Funcionário
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>
                        {editingEmployee ? "Editar Funcionário" : "Novo Funcionário"}
                      </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Nome *</Label>
                        <Input
                          id="name"
                          type="text"
                          value={formData.name}
                          onChange={(e) => handleInputChange("name", e.target.value)}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="email">Email *</Label>
                        <Input
                          id="email"
                          type="email"
                          value={formData.email}
                          onChange={(e) => handleInputChange("email", e.target.value)}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="password">
                          Senha {editingEmployee ? "(deixe vazio para manter)" : "*"}
                        </Label>
                        <Input
                          id="password"
                          type="password"
                          value={formData.password}
                          onChange={(e) => handleInputChange("password", e.target.value)}
                          required={!editingEmployee}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="phone">Telefone *</Label>
                        <Input
                          id="phone"
                          type="tel"
                          value={formData.phone}
                          onChange={(e) => handleInputChange("phone", e.target.value)}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="role">Função</Label>
                        <Select
                          value={formData.role}
                          onValueChange={(value) => handleInputChange("role", value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="employee">Funcionário</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="specialties">Especialidades (opcional)</Label>
                        <Input
                          id="specialties"
                          type="text"
                          placeholder="Ex: Corte, Manicure, Pedicure"
                          value={formData.specialties}
                          onChange={(e) => handleInputChange("specialties", e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="paymentType">Tipo de Pagamento</Label>
                        <Select
                          value={formData.paymentType}
                          onValueChange={(value) => handleInputChange("paymentType", value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="monthly">Mensal</SelectItem>
                            <SelectItem value="weekly">Semanal</SelectItem>
                            <SelectItem value="daily">Diário</SelectItem>
                            <SelectItem value="percentage">Porcentagem por Serviço</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="paymentValue">
                          {formData.paymentType === "percentage" ? "Porcentagem (%)" : "Valor (R$)"}
                        </Label>
                        <Input
                          id="paymentValue"
                          type="number"
                          step={formData.paymentType === "percentage" ? "1" : "0.01"}
                          min="0"
                          max={formData.paymentType === "percentage" ? "100" : undefined}
                          placeholder={formData.paymentType === "percentage" ? "Ex: 50" : "Ex: 2000.00"}
                          value={
                            formData.paymentValue === 0 
                              ? "" 
                              : formData.paymentType === "percentage" 
                                ? (formData.paymentValue / 100).toString()
                                : (formData.paymentValue / 100).toString()
                          }
                          onChange={(e) => {
                            const inputValue = e.target.value;
                            if (inputValue === "") {
                              handleInputChange("paymentValue", 0);
                              return;
                            }
                            const value = parseFloat(inputValue);
                            if (isNaN(value)) {
                              return;
                            }
                            handleInputChange("paymentValue", Math.round(value * 100));
                          }}
                        />
                        {formData.paymentType === "percentage" && (
                          <p className="text-xs text-muted-foreground">
                            Porcentagem que o funcionário recebe do valor de cada serviço
                          </p>
                        )}
                      </div>

                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="isActive"
                          checked={formData.isActive}
                          onChange={(e) => handleInputChange("isActive", e.target.checked)}
                        />
                        <Label htmlFor="isActive">Funcionário ativo</Label>
                      </div>

                      <div className="flex justify-end space-x-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setIsCreateDialogOpen(false)}
                        >
                          Cancelar
                        </Button>
                        <Button
                          type="submit"
                          disabled={createEmployeeMutation.isPending || updateEmployeeMutation.isPending}
                        >
                          {createEmployeeMutation.isPending || updateEmployeeMutation.isPending
                            ? "Salvando..."
                            : editingEmployee
                            ? "Atualizar"
                            : "Criar"
                          }
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p>Carregando funcionários...</p>
              ) : error ? (
                <p className="text-red-600">Erro ao carregar funcionários</p>
              ) : employees && employees.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Telefone</TableHead>
                        <TableHead>Função</TableHead>
                        <TableHead>Pagamento</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {employees.map((employee) => (
                        <TableRow key={employee.id}>
                          <TableCell className="font-medium">{employee.name}</TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-1">
                              <Mail className="w-4 h-4 text-muted-foreground" />
                              <span>{employee.email}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-1">
                              <Phone className="w-4 h-4 text-muted-foreground" />
                              <span>{employee.phone}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              Funcionário
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {(employee as any).paymentType === "monthly" && "Mensal"}
                              {(employee as any).paymentType === "weekly" && "Semanal"}
                              {(employee as any).paymentType === "daily" && "Diário"}
                              {(employee as any).paymentType === "percentage" && "Porcentagem"}
                              <br />
                              <span className="text-muted-foreground">
                                {(employee as any).paymentType === "percentage" 
                                  ? `${((employee as any).paymentValue || 0) / 100}%`
                                  : `R$ ${((employee as any).paymentValue || 0) / 100}`
                                }
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={employee.isActive ? "default" : "secondary"}>
                              {employee.isActive ? "Ativo" : "Inativo"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(employee)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <Trash2 className="w-4 h-4 text-red-600" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Remover funcionário</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Tem certeza que deseja remover {employee.name}? Esta ação não pode ser desfeita.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDelete(employee.id)}
                                      className="bg-red-600 hover:bg-red-700"
                                    >
                                      Remover
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Nenhum funcionário cadastrado</p>
                  <p className="text-sm text-muted-foreground">Clique em "Novo Funcionário" para começar</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}