import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import Header from "@/components/layout/header";
import Sidebar from "@/components/layout/sidebar";
import MerchantTable from "@/components/merchants/merchant-table";
import MerchantForm from "@/components/merchants/merchant-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { authService } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Merchant } from "@shared/schema";

export default function Merchants() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isNewMerchantModalOpen, setIsNewMerchantModalOpen] = useState(false);
  const [editingMerchant, setEditingMerchant] = useState<Merchant | null>(null);
  const [viewingMerchant, setViewingMerchant] = useState<Merchant | null>(null);
  const [deletingMerchant, setDeletingMerchant] = useState<Merchant | null>(null);
  const { toast } = useToast();

  const { data: merchants = [], isLoading } = useQuery<Merchant[]>({
    queryKey: ["/api/merchants"],
    enabled: authService.getState().isAuthenticated,
  });

  const createMerchantMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/merchants", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/merchants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/merchants/stats"] });
      setIsNewMerchantModalOpen(false);
      toast({
        title: "Comerciante criado com sucesso!",
        description: "O novo comerciante foi adicionado ao sistema.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar comerciante",
        description: error.message || "Ocorreu um erro inesperado",
        variant: "destructive",
      });
    },
  });

  const updateMerchantMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await apiRequest("PUT", `/api/merchants/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/merchants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/merchants/stats"] });
      setEditingMerchant(null);
      toast({
        title: "Comerciante atualizado com sucesso!",
        description: "As informações foram salvas.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar comerciante",
        description: error.message || "Ocorreu um erro inesperado",
        variant: "destructive",
      });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const response = await apiRequest("PATCH", `/api/merchants/${id}/status`, { status });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/merchants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/merchants/stats"] });
      toast({
        title: "Status atualizado com sucesso!",
        description: "O status do comerciante foi alterado.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar status",
        description: error.message || "Ocorreu um erro inesperado",
        variant: "destructive",
      });
    },
  });

  const deleteMerchantMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/merchants/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/merchants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/merchants/stats"] });
      setDeletingMerchant(null);
      toast({
        title: "Comerciante excluído com sucesso!",
        description: "O comerciante foi removido do sistema.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao excluir comerciante",
        description: error.message || "Ocorreu um erro inesperado",
        variant: "destructive",
      });
    },
  });

  const filteredMerchants = merchants.filter((merchant) =>
    merchant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    merchant.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleView = (merchant: Merchant) => {
    setViewingMerchant(merchant);
  };

  const handleEdit = (merchant: Merchant) => {
    setEditingMerchant(merchant);
  };

  const handleUpdateStatus = (merchantId: string, status: string) => {
    updateStatusMutation.mutate({ id: merchantId, status });
  };

  const handleDelete = (merchant: Merchant) => {
    setDeletingMerchant(merchant);
  };

  const confirmDelete = () => {
    if (deletingMerchant) {
      deleteMerchantMutation.mutate(deletingMerchant.id);
    }
  };

  const handleCreateMerchant = async (data: any) => {
    await createMerchantMutation.mutateAsync(data);
  };

  const handleUpdateMerchant = async (data: any) => {
    if (editingMerchant) {
      await updateMerchantMutation.mutateAsync({ id: editingMerchant.id, data });
    }
  };

  return (
    <div className="min-h-screen bg-background" data-testid="page-merchants">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-foreground">Gerenciar Comerciantes</h2>
              <Button 
                onClick={() => setIsNewMerchantModalOpen(true)}
                className="flex items-center space-x-2"
                data-testid="button-new-merchant"
              >
                <Plus className="w-4 h-4" />
                <span>Novo Comerciante</span>
              </Button>
            </div>

            {/* Search and Filter */}
            <div className="bg-card rounded-lg border border-border p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-foreground">Lista de Comerciantes</h3>
                <div className="flex items-center space-x-2">
                  <Input
                    type="text"
                    placeholder="Buscar comerciantes..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-64"
                    data-testid="input-search"
                  />
                  <Button variant="outline" size="sm">
                    <Search className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Merchants Table */}
            <MerchantTable
              merchants={filteredMerchants}
              onView={handleView}
              onEdit={handleEdit}
              onUpdateStatus={handleUpdateStatus}
              onDelete={handleDelete}
              isLoading={isLoading}
            />
          </div>
        </main>
      </div>

      {/* New Merchant Modal */}
      <Dialog open={isNewMerchantModalOpen} onOpenChange={setIsNewMerchantModalOpen}>
        <DialogContent className="max-w-md" data-testid="modal-new-merchant">
          <DialogHeader>
            <DialogTitle>Novo Comerciante</DialogTitle>
          </DialogHeader>
          <MerchantForm
            onSubmit={handleCreateMerchant}
            onCancel={() => setIsNewMerchantModalOpen(false)}
            isLoading={createMerchantMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Merchant Modal */}
      <Dialog open={!!editingMerchant} onOpenChange={() => setEditingMerchant(null)}>
        <DialogContent className="max-w-md" data-testid="modal-edit-merchant">
          <DialogHeader>
            <DialogTitle>Editar Comerciante</DialogTitle>
          </DialogHeader>
          {editingMerchant && (
            <MerchantForm
              onSubmit={handleUpdateMerchant}
              onCancel={() => setEditingMerchant(null)}
              initialData={editingMerchant}
              isLoading={updateMerchantMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* View Merchant Modal */}
      <Dialog open={!!viewingMerchant} onOpenChange={() => setViewingMerchant(null)}>
        <DialogContent className="max-w-md" data-testid="modal-view-merchant">
          <DialogHeader>
            <DialogTitle>Detalhes do Comerciante</DialogTitle>
          </DialogHeader>
          {viewingMerchant && (
            <div className="space-y-4">
              <div>
                <strong>Nome do Estabelecimento:</strong> {viewingMerchant.name}
              </div>
              <div>
                <strong>Proprietário:</strong> {viewingMerchant.ownerName}
              </div>
              <div>
                <strong>Email:</strong> {viewingMerchant.email}
              </div>
              <div>
                <strong>Telefone:</strong> {viewingMerchant.phone}
              </div>
              <div>
                <strong>Endereço:</strong> {viewingMerchant.address}
              </div>
              <div>
                <strong>Status:</strong> {viewingMerchant.status}
              </div>
              <div>
                <strong>Cadastrado em:</strong> {new Date(viewingMerchant.createdAt!).toLocaleDateString("pt-BR")}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <AlertDialog open={!!deletingMerchant} onOpenChange={() => setDeletingMerchant(null)}>
        <AlertDialogContent data-testid="modal-delete-merchant">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o comerciante "{deletingMerchant?.name}"?
              <br />
              <strong>Esta ação não pode ser desfeita!</strong>
              <br />
              Todos os dados relacionados (serviços, funcionários, clientes e agendamentos) também serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMerchantMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMerchantMutation.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
