
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Trash2, Calendar, User, ArrowLeft, Edit } from "lucide-react";
import { authService } from "@/lib/auth";
import { toast } from "@/hooks/use-toast";

interface Employee {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
}

interface EmployeeDayOff {
  id: string;
  employeeId: string;
  date: string;
  reason?: string;
  createdAt: string;
}

export default function EmployeeDaysOff() {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [user, setUser] = useState(authService.getState().user);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingDayOff, setEditingDayOff] = useState<EmployeeDayOff | null>(null);

  const [formData, setFormData] = useState({
    employeeId: "",
    date: "",
    reason: "",
  });

  const [editFormData, setEditFormData] = useState({
    employeeId: "",
    date: "",
    reason: "",
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

  // Fetch employees
  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
    queryFn: async () => {
      const response = await fetch("/api/employees", {
        headers: {
          'Authorization': `Bearer ${authService.getState().token}`,
        },
      });
      if (!response.ok) {
        throw new Error('Failed to fetch employees');
      }
      return response.json();
    },
    enabled: authService.getState().isAuthenticated && user?.role === "merchant",
  });

  // Fetch employee days off
  const { data: daysOff = [], isLoading } = useQuery<EmployeeDayOff[]>({
    queryKey: ["/api/employee-days-off"],
    queryFn: async () => {
      const response = await fetch("/api/employee-days-off", {
        headers: {
          'Authorization': `Bearer ${authService.getState().token}`,
        },
      });
      if (!response.ok) {
        throw new Error('Failed to fetch days off');
      }
      return response.json();
    },
    enabled: authService.getState().isAuthenticated && user?.role === "merchant",
  });

  const createDayOffMutation = useMutation({
    mutationFn: async (dayOffData: any) => {
      console.log("Sending day off data:", dayOffData);
      
      const response = await fetch("/api/employee-days-off", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          'Authorization': `Bearer ${authService.getState().token}`,
        },
        body: JSON.stringify(dayOffData),
      });

      console.log("Response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Error response:", errorText);
        
        try {
          const error = JSON.parse(errorText);
          throw new Error(error.message || "Erro ao criar folga");
        } catch (parseError) {
          throw new Error(`Erro ao criar folga: ${response.status} ${response.statusText}`);
        }
      }

      const result = await response.json();
      console.log("Success response:", result);
      return result;
    },
    onSuccess: () => {
      toast({
        title: "Sucesso!",
        description: "Folga criada com sucesso",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/employee-days-off"] });
      queryClient.invalidateQueries({ queryKey: ["/api/client/employees"] });
      queryClient.invalidateQueries({ queryKey: ["/api/client/availability"] });
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

  const updateDayOffMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      console.log("Updating day off:", id, data);
      
      const response = await fetch(`/api/employee-days-off/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          'Authorization': `Bearer ${authService.getState().token}`,
        },
        body: JSON.stringify(data),
      });

      console.log("Update response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Update error response:", errorText);
        
        try {
          const error = JSON.parse(errorText);
          throw new Error(error.message || "Erro ao atualizar folga");
        } catch (parseError) {
          throw new Error(`Erro ao atualizar folga: ${response.status} ${response.statusText}`);
        }
      }

      const result = await response.json();
      console.log("Update success response:", result);
      return result;
    },
    onSuccess: () => {
      toast({
        title: "Sucesso!",
        description: "Folga atualizada com sucesso",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/employee-days-off"] });
      queryClient.invalidateQueries({ queryKey: ["/api/client/employees"] });
      queryClient.invalidateQueries({ queryKey: ["/api/client/availability"] });
      setIsEditDialogOpen(false);
      resetEditForm();
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteDayOffMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/employee-days-off/${id}`, {
        method: "DELETE",
        headers: {
          'Authorization': `Bearer ${authService.getState().token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao remover folga");
      }
    },
    onSuccess: () => {
      toast({
        title: "Sucesso!",
        description: "Folga removida com sucesso",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/employee-days-off"] });
      queryClient.invalidateQueries({ queryKey: ["/api/client/employees"] });
      queryClient.invalidateQueries({ queryKey: ["/api/client/availability"] });
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
      employeeId: "",
      date: "",
      reason: "",
    });
  };

  const resetEditForm = () => {
    setEditFormData({
      employeeId: "",
      date: "",
      reason: "",
    });
    setEditingDayOff(null);
  };

  const handleEdit = (dayOff: EmployeeDayOff) => {
    setEditingDayOff(dayOff);
    setEditFormData({
      employeeId: dayOff.employeeId,
      date: dayOff.date,
      reason: dayOff.reason || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!editFormData.employeeId || !editFormData.date) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    if (!editingDayOff) {
      toast({
        title: "Erro",
        description: "Folga não encontrada",
        variant: "destructive",
      });
      return;
    }

    // Check if date is in the past
    const selectedDate = new Date(editFormData.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (selectedDate < today) {
      toast({
        title: "Erro",
        description: "Não é possível editar folga para datas no passado",
        variant: "destructive",
      });
      return;
    }

    // Check if day off already exists for this employee and date (excluding current one)
    const existingDayOff = daysOff.find(
      d => d.employeeId === editFormData.employeeId && 
           d.date === editFormData.date && 
           d.id !== editingDayOff.id
    );

    if (existingDayOff) {
      toast({
        title: "Erro",
        description: "Este funcionário já possui folga registrada para esta data",
        variant: "destructive",
      });
      return;
    }

    console.log("Updating day off with data:", editFormData);
    updateDayOffMutation.mutate({ 
      id: editingDayOff.id, 
      data: {
        employeeId: editFormData.employeeId,
        date: editFormData.date,
        reason: editFormData.reason,
      }
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.employeeId || !formData.date) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    // Check if date is in the past
    const selectedDate = new Date(formData.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (selectedDate < today) {
      toast({
        title: "Erro",
        description: "Não é possível criar folga para datas no passado",
        variant: "destructive",
      });
      return;
    }

    // Check if day off already exists for this employee and date
    const existingDayOff = daysOff.find(
      d => d.employeeId === formData.employeeId && d.date === formData.date
    );

    if (existingDayOff) {
      toast({
        title: "Erro",
        description: "Este funcionário já possui folga registrada para esta data",
        variant: "destructive",
      });
      return;
    }

    console.log("Creating day off with data:", formData);
    createDayOffMutation.mutate(formData);
  };

  const handleDelete = (id: string) => {
    deleteDayOffMutation.mutate(id);
  };

  const getEmployeeName = (employeeId: string) => {
    const employee = employees.find(e => e.id === employeeId);
    return employee?.name || "Funcionário não encontrado";
  };

  if (!authService.getState().isAuthenticated || authService.getState().user?.role !== "merchant") {
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
                <Calendar className="w-6 h-6 text-primary" />
                <h1 className="text-2xl font-bold text-foreground">Folgas dos Funcionários</h1>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="text-sm text-muted-foreground">Total de Folgas</p>
                    <p className="text-2xl font-bold">{daysOff.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <User className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="text-sm text-muted-foreground">Funcionários Ativos</p>
                    <p className="text-2xl font-bold">{employees.filter(e => e.isActive).length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Days Off Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Folgas Programadas</CardTitle>
                <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
                  setIsCreateDialogOpen(open);
                  if (!open) resetForm();
                }}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="w-4 h-4 mr-2" />
                      Nova Folga
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Nova Folga</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="employee">Funcionário *</Label>
                        <Select
                          value={formData.employeeId}
                          onValueChange={(value) => setFormData(prev => ({ ...prev, employeeId: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um funcionário" />
                          </SelectTrigger>
                          <SelectContent>
                            {employees.filter(e => e.isActive).map((employee) => (
                              <SelectItem key={employee.id} value={employee.id}>
                                {employee.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="date">Data da Folga *</Label>
                        <Input
                          id="date"
                          type="date"
                          value={formData.date}
                          onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                          min={new Date().toISOString().split('T')[0]}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="reason">Motivo (opcional)</Label>
                        <Textarea
                          id="reason"
                          placeholder="Motivo da folga..."
                          value={formData.reason}
                          onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                          rows={3}
                        />
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
                          disabled={createDayOffMutation.isPending}
                        >
                          {createDayOffMutation.isPending ? "Criando..." : "Criar Folga"}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>

                {/* Edit Dialog */}
                <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
                  setIsEditDialogOpen(open);
                  if (!open) resetEditForm();
                }}>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Editar Folga</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleEditSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="edit-employee">Funcionário *</Label>
                        <Select
                          value={editFormData.employeeId}
                          onValueChange={(value) => setEditFormData(prev => ({ ...prev, employeeId: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um funcionário" />
                          </SelectTrigger>
                          <SelectContent>
                            {employees.filter(e => e.isActive).map((employee) => (
                              <SelectItem key={employee.id} value={employee.id}>
                                {employee.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="edit-date">Data da Folga *</Label>
                        <Input
                          id="edit-date"
                          type="date"
                          value={editFormData.date}
                          onChange={(e) => setEditFormData(prev => ({ ...prev, date: e.target.value }))}
                          min={new Date().toISOString().split('T')[0]}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="edit-reason">Motivo (opcional)</Label>
                        <Textarea
                          id="edit-reason"
                          placeholder="Motivo da folga..."
                          value={editFormData.reason}
                          onChange={(e) => setEditFormData(prev => ({ ...prev, reason: e.target.value }))}
                          rows={3}
                        />
                      </div>

                      <div className="flex justify-end space-x-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setIsEditDialogOpen(false)}
                        >
                          Cancelar
                        </Button>
                        <Button
                          type="submit"
                          disabled={updateDayOffMutation.isPending}
                        >
                          {updateDayOffMutation.isPending ? "Atualizando..." : "Atualizar Folga"}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p>Carregando folgas...</p>
              ) : daysOff.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Funcionário</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Motivo</TableHead>
                        <TableHead>Criado em</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {daysOff.map((dayOff) => (
                        <TableRow key={dayOff.id}>
                          <TableCell className="font-medium">
                            {getEmployeeName(dayOff.employeeId)}
                          </TableCell>
                          <TableCell>
                            {(() => {
                              const [year, month, day] = dayOff.date.split('-');
                              return new Date(parseInt(year), parseInt(month) - 1, parseInt(day)).toLocaleDateString('pt-BR');
                            })()}
                          </TableCell>
                          <TableCell>
                            {dayOff.reason || "Não informado"}
                          </TableCell>
                          <TableCell>
                            {new Date(dayOff.createdAt).toLocaleDateString('pt-BR')}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleEdit(dayOff)}
                              >
                                <Edit className="w-4 h-4 text-blue-600" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <Trash2 className="w-4 h-4 text-red-600" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Remover folga</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Tem certeza que deseja remover esta folga? Esta ação não pode ser desfeita.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDelete(dayOff.id)}
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
                  <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Nenhuma folga programada</p>
                  <p className="text-sm text-muted-foreground">Clique em "Nova Folga" para começar</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
