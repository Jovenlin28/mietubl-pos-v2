import React, { useState, useEffect, useMemo } from "react";
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Stack,
  TextField,
  IconButton,
  Chip,
  Backdrop,
  CircularProgress,
  TablePagination,
  Modal,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import SearchIcon from "@mui/icons-material/Search";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import axiosInstance from "../configs/axiosConfig";
import { useNotification } from "../hooks/useNotification";

type PublicPurchaseOrder = {
  id: number;
  ticketCode?: string;
  ticket_code?: string;
  customerName?: string;
  customer_name?: string;
  customer_full_name?: string;
  storeName?: string;
  store_name?: string;
  customer_store_name?: string;
  customerPhone?: string;
  customer_phone?: string;
  customerEmail?: string;
  customer_email?: string;
  saleDate?: string;
  sale_date?: string;
  createdOn?: string;
  created_on?: string;
  created_at?: string;
  status?: string;
  total?: number;
  grandTotal?: number;
  products?: any[];
};

type ConfirmAction = "confirm" | "cancel";

const normalizeStatus = (status?: string) =>
  String(status || "submitted").toLowerCase();

const getTicketCode = (row: PublicPurchaseOrder) =>
  row.ticketCode || row.ticket_code || `PPO-${row.id}`;

const getCustomerName = (row: PublicPurchaseOrder) =>
  row.customerName || row.customer_name || row.customer_full_name || "-";

const getStoreName = (row: PublicPurchaseOrder) =>
  row.storeName || row.store_name || row.customer_store_name || "-";

const getPhone = (row: PublicPurchaseOrder) =>
  row.customerPhone || row.customer_phone || "-";

const getEmail = (row: PublicPurchaseOrder) =>
  row.customerEmail || row.customer_email || "-";

const getSaleDate = (row: PublicPurchaseOrder) => row.saleDate || row.sale_date || "";

const getCreatedOn = (row: PublicPurchaseOrder) =>
  row.createdOn || row.created_on || row.created_at || "";

const getProductName = (product: any) =>
  String(product?.name ?? product?.product_name ?? "Product");

const getProductQty = (product: any) => Number(product?.quantity ?? product?.qty ?? 0);

const formatDate = (dateValue: string) => {
  if (!dateValue) return "-";
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const StatusChip: React.FC<{ status?: string }> = ({ status }) => {
  const normalized = normalizeStatus(status);

  let bg = "#e5e7eb";
  let color = "#374151";
  let label = status || "Submitted";

  if (normalized === "submitted") {
    bg = "#dbeafe";
    color = "#1d4ed8";
    label = "Submitted";
  } else if (normalized === "processing") {
    bg = "#fef3c7";
    color = "#b45309";
    label = "Processing";
  } else if (normalized === "converted") {
    bg = "#dcfce7";
    color = "#15803d";
    label = "Converted";
  } else if (normalized === "cancelled" || normalized === "canceled") {
    bg = "#fee2e2";
    color = "#b91c1c";
    label = "Cancelled";
  } else if (normalized === "failed") {
    bg = "#fee2e2";
    color = "#991b1b";
    label = "Failed";
  }

  return (
    <Chip
      label={label}
      size="small"
      sx={{
        bgcolor: bg,
        color,
        fontWeight: 700,
      }}
    />
  );
};

const CustomerPurchaseOrders: React.FC = () => {
  const { showError, showSuccess } = useNotification();

  const [rows, setRows] = useState<PublicPurchaseOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [total, setTotal] = useState(0);

  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionType, setActionType] = useState<ConfirmAction>("confirm");
  const [selectedRow, setSelectedRow] = useState<PublicPurchaseOrder | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const canConfirm = useMemo(() => {
    const status = normalizeStatus(selectedRow?.status);
    return status !== "converted" && status !== "cancelled" && status !== "canceled";
  }, [selectedRow]);

  const fetchPublicPurchaseOrders = async (
    nextPage = page,
    nextRowsPerPage = rowsPerPage,
    searchTerm = search
  ) => {
    setLoading(true);
    try {
      const params = {
        currentPage: nextPage + 1,
        perPage: nextRowsPerPage,
        search: searchTerm || undefined,
      };

      const res = await axiosInstance.get("/public-purchase-orders", { params });
      const data = res.data;

      const items = Array.isArray(data)
        ? data
        : Array.isArray(data?.items)
        ? data.items
        : [];

      const nextTotal = Array.isArray(data)
        ? data.length
        : Number(data?.total ?? items.length);

      setRows(items);
      setTotal(nextTotal);
    } catch (err: any) {
      setRows([]);
      setTotal(0);
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        "Failed to fetch public purchase orders";
      showError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPublicPurchaseOrders(page, rowsPerPage, search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, rowsPerPage, search]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    setSearch(searchInput.trim());
  };

  const handleRefresh = () => {
    fetchPublicPurchaseOrders(page, rowsPerPage, search);
  };

  const openActionModal = (row: PublicPurchaseOrder, action: ConfirmAction) => {
    setSelectedRow(row);
    setActionType(action);
    setConfirmModalOpen(true);
  };

  const closeActionModal = () => {
    setConfirmModalOpen(false);
    setSelectedRow(null);
  };

  const postActionWithFallback = async (
    rowId: number,
    action: ConfirmAction
  ) => {
    const endpoints =
      action === "confirm"
        ? [
            `/public-purchase-orders/${rowId}/confirm`,
            `/public-purchase-orders/${rowId}/convert`,
          ]
        : [
            `/public-purchase-orders/${rowId}/cancel`,
            `/public-purchase-orders/${rowId}/reject`,
          ];

    let lastError: any = null;
    for (const endpoint of endpoints) {
      try {
        return await axiosInstance.post(endpoint);
      } catch (err: any) {
        const status = err?.response?.status;
        if (status === 404 || status === 405) {
          lastError = err;
          continue;
        }
        throw err;
      }
    }

    throw lastError || new Error("Action endpoint not found");
  };

  const handleConfirmAction = async () => {
    if (!selectedRow?.id) return;

    if (actionType === "confirm" && !canConfirm) {
      closeActionModal();
      return;
    }

    setActionLoading(true);
    try {
      const res = await postActionWithFallback(selectedRow.id, actionType);
      const salesId = res?.data?.salesId || res?.data?.saleId || res?.data?.sales_id;

      if (actionType === "confirm") {
        showSuccess(
          salesId
            ? `Public purchase order converted successfully. Sales ID: ${salesId}`
            : "Public purchase order converted successfully"
        );
      } else {
        showSuccess("Public purchase order cancelled successfully");
      }

      closeActionModal();
      fetchPublicPurchaseOrders(page, rowsPerPage, search);
    } catch (err: any) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        `Failed to ${actionType} public purchase order`;
      showError(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const toggleRowExpansion = (rowId: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  };

  const renderProductToggle = (row: PublicPurchaseOrder) => {
    const hasProducts = Array.isArray(row.products) && row.products.length > 0;
    if (!hasProducts) {
      return <Typography variant="body2">-</Typography>;
    }

    const isExpanded = expandedRows.has(row.id);
    return (
      <Button
        variant="text"
        size="small"
        onClick={() => toggleRowExpansion(row.id)}
        sx={{
          textTransform: "none",
          fontWeight: 700,
          color: "primary.main",
          minWidth: 0,
          p: 0,
          "&:hover": { bgcolor: "transparent", textDecoration: "underline" },
        }}
        endIcon={isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
      >
        {isExpanded ? "Hide products" : "View products"}
      </Button>
    );
  };

  const renderExpandedProductDetails = (row: PublicPurchaseOrder) => {
    const products = Array.isArray(row.products) ? row.products : [];
    const isExpanded = expandedRows.has(row.id);
    if (!isExpanded || !products.length) return null;

    return (
      <TableRow key={`expanded-${row.id}`}>
        <TableCell colSpan={10} sx={{ py: 0, border: 0 }}>
          <Box sx={{ py: 2 }}>
            <Table size="small" sx={{ maxWidth: 920 }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>SKU</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">
                    Quantity
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">
                    Price
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">
                    Total
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {products.map((product: any, idx: number) => {
                  const qty = getProductQty(product);
                  const price = Number(product?.price ?? product?.unit_price ?? 0);
                  const total = Number(product?.total ?? price * qty);
                  return (
                    <TableRow key={`${row.id}-${idx}`}>
                      <TableCell>{getProductName(product)}</TableCell>
                      <TableCell>{String(product?.sku ?? product?.code ?? "-")}</TableCell>
                      <TableCell align="right">{qty}</TableCell>
                      <TableCell align="right">
                        ₱
                        {price.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </TableCell>
                      <TableCell align="right">
                        ₱
                        {total.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Box>
        </TableCell>
      </TableRow>
    );
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      <Backdrop open={loading || actionLoading} sx={{ color: "#fff", zIndex: 9999 }}>
        <CircularProgress color="inherit" />
      </Backdrop>

      <Modal open={confirmModalOpen} onClose={closeActionModal}>
        <Box
          sx={{
            width: 420,
            bgcolor: "#fff",
            borderRadius: 2,
            boxShadow: 24,
            overflow: "hidden",
            mx: "auto",
            mt: 12,
            outline: "none",
          }}
        >
          <Box sx={{ p: 4, textAlign: "center" }}>
            <Typography variant="h6" fontWeight={700} mb={2}>
              {actionType === "confirm" ? "Process Purchase Order" : "Cancel Purchase Order"}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {actionType === "confirm"
                ? `Process ${getTicketCode(selectedRow || { id: 0 })} into a Purchase Order?`
                : `Are you sure you want to cancel ${getTicketCode(selectedRow || { id: 0 })}?`}
            </Typography>
          </Box>

          <Box sx={{ px: 3, pb: 3, pt: 2, borderTop: "1px solid #e5e7eb" }}>
            <Stack direction="row" spacing={2} width="100%" justifyContent="space-between">
              <Button
                variant="contained"
                sx={{ bgcolor: "#0f172a", color: "#fff", boxShadow: 0 }}
                onClick={closeActionModal}
              >
                Close
              </Button>
              <Button
                variant="contained"
                color={actionType === "confirm" ? "success" : "error"}
                onClick={handleConfirmAction}
                disabled={actionType === "confirm" && !canConfirm}
              >
                {actionType === "confirm" ? "Confirm" : "Cancel"}
              </Button>
            </Stack>
          </Box>
        </Box>
      </Modal>

      <Stack
        justifyContent="space-between"
        alignItems="flex-start"
        sx={{ mb: 3, flexDirection: { xs: "column", sm: "row" } }}
      >
        <Box>
          <Typography variant="h6" fontWeight={700}>
            Customer Purchase Orders
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Review purchase orders made by the customers
          </Typography>
        </Box>

        <Button
          variant="contained"
          startIcon={<RefreshIcon />}
          sx={{ bgcolor: "#95a5a6", color: "#fff", boxShadow: 0 }}
          onClick={handleRefresh}
        >
          Refresh
        </Button>
      </Stack>

      <Paper elevation={0} sx={{ mt: 4, borderRadius: 2, p: 3 }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "stretch", sm: "center" }}
          spacing={2}
          sx={{ mb: 2 }}
        >
          <form onSubmit={handleSearchSubmit} style={{ margin: 0 }}>
            <TextField
              placeholder="Search by ticket, customer, store, phone"
              variant="outlined"
              size="small"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              sx={{
                width: { xs: "100%", sm: 360 },
                bgcolor: "#fafbfc",
                "& .MuiInputBase-input": { pl: 2, py: "10px" },
              }}
              InputProps={{
                endAdornment: (
                  <IconButton type="submit" size="small" sx={{ mr: 0.5 }}>
                    <SearchIcon />
                  </IconButton>
                ),
              }}
            />
          </form>
        </Stack>

        <TableContainer component={Paper} elevation={0}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Ticket Code</TableCell>
                <TableCell>Customer</TableCell>
                <TableCell>Store Name</TableCell>
                <TableCell>Phone</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>PO Date</TableCell>
                <TableCell>Created On</TableCell>
                <TableCell>Products</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => {
                const status = normalizeStatus(row.status);
                const disableConfirm =
                  status === "converted" || status === "cancelled" || status === "canceled";
                const disableCancel =
                  status === "converted" || status === "cancelled" || status === "canceled";

                return (
                  <React.Fragment key={row.id}>
                    <TableRow hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight={700}>
                          {getTicketCode(row)}
                        </Typography>
                      </TableCell>
                      <TableCell>{getCustomerName(row)}</TableCell>
                      <TableCell>{getStoreName(row)}</TableCell>
                      <TableCell>{getPhone(row)}</TableCell>
                      <TableCell>{getEmail(row)}</TableCell>
                      <TableCell>{formatDate(getSaleDate(row))}</TableCell>
                      <TableCell>{formatDate(getCreatedOn(row))}</TableCell>
                      <TableCell>{renderProductToggle(row)}</TableCell>
                      <TableCell>
                        <StatusChip status={row.status} />
                      </TableCell>
                      <TableCell align="right">
                        <Stack
                          direction="row"
                          spacing={1}
                          justifyContent="flex-end"
                          alignItems="center"
                        >
                          <Button
                            size="small"
                            variant="contained"
                            color="success"
                            startIcon={<CheckCircleIcon />}
                            disabled={disableConfirm}
                            onClick={() => openActionModal(row, "confirm")}
                            sx={{ textTransform: "none", boxShadow: 0 }}
                          >
                            Confirm
                          </Button>
                          <Button
                            size="small"
                            variant="contained"
                            color="error"
                            startIcon={<CancelIcon />}
                            disabled={disableCancel}
                            onClick={() => openActionModal(row, "cancel")}
                            sx={{ textTransform: "none", boxShadow: 0 }}
                          >
                            Cancel
                          </Button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                    {renderExpandedProductDetails(row)}
                  </React.Fragment>
                );
              })}

              {!rows.length && !loading && (
                <TableRow>
                  <TableCell colSpan={10} align="center">
                    No records found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          component="div"
          count={total}
          page={page}
          rowsPerPage={rowsPerPage}
          onPageChange={(_, nextPage) => setPage(nextPage)}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[5, 10, 25, 50]}
        />
      </Paper>
    </Box>
  );
};

export default CustomerPurchaseOrders;
