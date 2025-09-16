import { Eye, Edit, Ban, Check, X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Merchant } from "@shared/schema";

interface MerchantTableProps {
  merchants: Merchant[];
  onView: (merchant: Merchant) => void;
  onEdit: (merchant: Merchant) => void;
  onUpdateStatus: (merchantId: string, status: string) => void;
  onDelete: (merchant: Merchant) => void;
  isLoading?: boolean;
}

export default function MerchantTable({ 
  merchants, 
  onView, 
  onEdit, 
  onUpdateStatus,
  onDelete,
  isLoading = false 
}: MerchantTableProps) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-100 text-green-800">Ativo</Badge>;
      case "pending":
        return <Badge className="bg-yellow-100 text-yellow-800">Pendente</Badge>;
      case "inactive":
        return <Badge className="bg-red-100 text-red-800">Inativo</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatDate = (date: Date | null | undefined) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("pt-BR");
  };

  if (isLoading) {
    return (
      <div className="bg-card rounded-lg border border-border p-8">
        <div className="text-center text-muted-foreground">
          Carregando comerciantes...
        </div>
      </div>
    );
  }

  if (merchants.length === 0) {
    return (
      <div className="bg-card rounded-lg border border-border p-8">
        <div className="text-center text-muted-foreground">
          Nenhum comerciante encontrado.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden" data-testid="table-merchants">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted">
            <tr>
              <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">
                Estabelecimento
              </th>
              <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">
                Proprietário
              </th>
              <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">
                Email
              </th>
              <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">
                Telefone
              </th>
              <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">
                Status
              </th>
              <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">
                Cadastro
              </th>
              <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {merchants.map((merchant) => (
              <tr 
                key={merchant.id} 
                className="hover:bg-accent/50"
                data-testid={`row-merchant-${merchant.id}`}
              >
                <td className="px-6 py-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                      <span className="text-primary text-xs">🏪</span>
                    </div>
                    <span className="font-medium text-foreground" data-testid={`text-name-${merchant.id}`}>
                      {merchant.name}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-muted-foreground" data-testid={`text-owner-${merchant.id}`}>
                  {merchant.ownerName}
                </td>
                <td className="px-6 py-4 text-sm text-muted-foreground" data-testid={`text-email-${merchant.id}`}>
                  {merchant.email}
                </td>
                <td className="px-6 py-4 text-sm text-muted-foreground" data-testid={`text-phone-${merchant.id}`}>
                  {merchant.phone}
                </td>
                <td className="px-6 py-4" data-testid={`status-${merchant.id}`}>
                  {getStatusBadge(merchant.status)}
                </td>
                <td className="px-6 py-4 text-sm text-muted-foreground" data-testid={`text-created-${merchant.id}`}>
                  {formatDate(merchant.createdAt)}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onView(merchant)}
                      title="Visualizar"
                      data-testid={`button-view-${merchant.id}`}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(merchant)}
                      title="Editar"
                      data-testid={`button-edit-${merchant.id}`}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    {merchant.status === "pending" ? (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onUpdateStatus(merchant.id, "active")}
                          title="Aprovar"
                          className="text-green-600 hover:bg-green-100"
                          data-testid={`button-approve-${merchant.id}`}
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onUpdateStatus(merchant.id, "inactive")}
                          title="Rejeitar"
                          className="text-destructive hover:bg-destructive/10"
                          data-testid={`button-reject-${merchant.id}`}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onUpdateStatus(
                          merchant.id, 
                          merchant.status === "active" ? "inactive" : "active"
                        )}
                        title={merchant.status === "active" ? "Desativar" : "Ativar"}
                        className="text-destructive hover:bg-destructive/10"
                        data-testid={`button-toggle-${merchant.id}`}
                      >
                        <Ban className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(merchant)}
                      title="Excluir comerciante"
                      className="text-destructive hover:bg-destructive/10"
                      data-testid={`button-delete-${merchant.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
