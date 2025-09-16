import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Edit, Trash2, Users, Mail, Phone, ArrowLeft, User } from "lucide-react";
import { authService } from "@/lib/auth";
import { toast } from "@/hooks/use-toast";

interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  notes?: string;
  isActive: boolean;
  createdAt: string;
}

export default function Clients() {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [user, setUser] = useState(authService.getState().user);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    notes: "",
    isActive: true,
  });

  useEffect(() => {
    const unsubscribe = authService.subscribe((state) => {
      setUser(state.user);
    });
    return unsubscribe;
  }, []);

  // Fetch clients
  const { data: clients, isLoading, error } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    queryFn: async () => {
      const response = await fetch("/api/clients", {
        headers: {
          'Authorization': `Bearer ${authService.getState().token}`,
        },
      });
      if (!response.ok) {
        if (response.status === 401) {
          setLocation("/login");
          return [];
        }
        throw new Error('Failed to fetch clients');
      }
      return response.json();
    },
    enabled: authService.getState().isAuthenticated,
  });

  const createClientMutation = useMutation({
    mutationFn: async (clientData: any) => {
      const response = await fetch("/api/clients", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          'Authorization': `Bearer ${authService.getState().token}`,
        },
        body: JSON.stringify(clientData),
      });

      if (!response.ok) {
        if (response.status === 401) {
          setLocation("/login");
          return;
        }
        const error = await response.json();
        throw new Error(error.message || "Erro ao criar cliente");
      }

      return response.json();
    },
    onSuccess: async () => {
      toast({
        title: "Sucesso!",
        description: "Cliente criado com sucesso",
      });
      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/client/appointments"] });

      // Force refetch to update state immediately
      await queryClient.refetchQueries({ queryKey: ["/api/clients"] });

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

  const updateClientMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await fetch(`/api/clients/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          'Authorization': `Bearer ${authService.getState().token}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        if (response.status === 401) {
          setLocation("/login");
          return;
        }
        const error = await response.json();
        throw new Error(error.message || "Erro ao atualizar cliente");
      }

      return response.json();
    },
    onSuccess: async () => {
      toast({
        title: "Sucesso!",
        description: "Cliente atualizado com sucesso",
      });
      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/client/appointments"] });

      // Force refetch to update state immediately
      await queryClient.refetchQueries({ queryKey: ["/api/clients"] });

      setEditingClient(null);
      resetForm();
      setIsCreateDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteClientMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/clients/${id}`, {
        method: "DELETE",
        headers: {
          'Authorization': `Bearer ${authService.getState().token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          setLocation("/login");
          return;
        }
        const error = await response.json();
        throw new Error(error.message || "Erro ao deletar cliente");
      }

      return response.json();
    },
    onSuccess: async () => {
      toast({
        title: "Sucesso!",
        description: "Cliente removido com sucesso",
      });
      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/client/appointments"] });

      // Force refetch to update state immediately
      await queryClient.refetchQueries({ queryKey: ["/api/clients"] });
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
      notes: "",
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

    if (editingClient) {
      const updateData = { ...formData };
      if (!formData.password) {
        delete updateData.password; // Don't update password if empty
      }
      updateClientMutation.mutate({ id: editingClient.id, data: updateData });
    } else {
      if (!formData.password) {
        toast({
          title: "Erro",
          description: "Senha é obrigatória para novos clientes",
          variant: "destructive",
        });
        return;
      }
      createClientMutation.mutate(formData);
    }
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setFormData({
      name: client.name,
      email: client.email,
      password: "",
      phone: client.phone,
      notes: client.notes || "",
      isActive: client.isActive,
    });
    setIsCreateDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    deleteClientMutation.mutate(id);
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (!authService.getState().isAuthenticated) {
    setLocation("/login");
    return null; // Render nothing while redirecting
  }

  if (user?.role !== "merchant") {
    return <div>Acesso negado</div>;
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
                <User className="w-6 h-6 text-primary" />
                <h1 className="text-2xl font-bold text-foreground">Clientes</h1>
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
                  <User className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="text-sm text-muted-foreground">Total</p>
                    <p className="text-2xl font-bold">{clients?.length || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <User className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="text-sm text-muted-foreground">Ativos</p>
                    <p className="text-2xl font-bold">{clients?.filter(c => c.isActive).length || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <User className="w-5 h-5 text-gray-600" />
                  <div>
                    <p className="text-sm text-muted-foreground">Inativos</p>
                    <p className="text-2xl font-bold">{clients?.filter(c => !c.isActive).length || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Clients Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Lista de Clientes</CardTitle>
                <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
                  setIsCreateDialogOpen(open);
                  if (!open) {
                    setEditingClient(null);
                    resetForm();
                  }
                }}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="w-4 h-4 mr-2" />
                      Novo Cliente
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>
                        {editingClient ? "Editar Cliente" : "Novo Cliente"}
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
                          Senha {editingClient ? "(deixe vazio para manter)" : "*"}
                        </Label>
                        <Input
                          id="password"
                          type="password"
                          value={formData.password}
                          onChange={(e) => handleInputChange("password", e.target.value)}
                          required={!editingClient}
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
                        <Label htmlFor="notes">Observações (opcional)</Label>
                        <Textarea
                          id="notes"
                          placeholder="Preferências, alergias, observações..."
                          value={formData.notes}
                          onChange={(e) => handleInputChange("notes", e.target.value)}
                          rows={3}
                        />
                      </div>

                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="isActive"
                          checked={formData.isActive}
                          onChange={(e) => handleInputChange("isActive", e.target.checked)}
                        />
                        <Label htmlFor="isActive">Cliente ativo</Label>
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
                          disabled={createClientMutation.isPending || updateClientMutation.isPending}
                        >
                          {createClientMutation.isPending || updateClientMutation.isPending
                            ? "Salvando..."
                            : editingClient
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
                <p>Carregando clientes...</p>
              ) : error ? (
                <p className="text-red-600">Erro ao carregar clientes</p>
              ) : clients && clients.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Telefone</TableHead>
                        <TableHead>Observações</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clients.map((client) => (
                        <TableRow key={client.id}>
                          <TableCell className="font-medium">{client.name}</TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-1">
                              <Mail className="w-4 h-4 text-muted-foreground" />
                              <span>{client.email}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-1">
                              <Phone className="w-4 h-4 text-muted-foreground" />
                              <span>{client.phone}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {client.notes && client.notes.length > 50 
                                ? `${client.notes.substring(0, 50)}...`
                                : client.notes || "Nenhuma"
                              }
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant={client.isActive ? "success" : "secondary"}>
                              {client.isActive ? "Ativo" : "Inativo"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(client)}
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
                                    <AlertDialogTitle>Remover cliente</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Tem certeza que deseja remover {client.name}? Esta ação não pode ser desfeita.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDelete(client.id)}
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
                  <User className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Nenhum cliente cadastrado</p>
                  <p className="text-sm text-muted-foreground">Clique em "Novo Cliente" para começar</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}