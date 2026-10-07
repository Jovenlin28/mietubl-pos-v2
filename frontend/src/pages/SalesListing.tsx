import React, { useContext, useEffect, useState } from "react";
import {
  Box,
  Typography,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Paper,
  Stack,
  Button,
  TextField,
  Backdrop,
  CircularProgress,
  IconButton,
  TableContainer,
  TablePagination,
  Chip,
  Tooltip,
  TableSortLabel,
  Autocomplete,
} from "@mui/material";
import Popover from "@mui/material/Popover";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import ViewPaymentsModal from "../components/ViewPaymentsModal";
import RefreshIcon from "@mui/icons-material/Refresh";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import dayjs from "dayjs";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import CreatePaymentModal from "../components/CreatePaymentModal";

import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";

import axiosInstance from "../configs/axiosConfig";
import PrimaryButton from "../shared/buttons/PrimaryButton";
import { useNavigate } from "react-router-dom";
import InvoiceModal from "../components/InvoiceModal";
import DeleteConfirmModal from "../components/DeleteConfirmModal";
import { useNotification } from "../hooks/useNotification";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import HasPermission from "../components/HasPermission";
import { UserContext } from "../layouts/DashboardLayout";
import { getPurchaseOrderNumberSx } from "../helpers/purchaseOrder";

const SalesListing: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [sales, setSales] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const { showSuccess, showError } = useNotification();
  const user = useContext(UserContext);
  // Pagination states
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Sorting (server-side). Default: createdOn DESC
  const [sortBy, setSortBy] = useState<string>("createdOn"); // saleDate | purchaseOrderNumber | createdOn | grandTotal
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  // Category filter for SalesListing
  const [categoriesList, setCategoriesList] = useState<string[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>("");

  const handleSort = (columnId: string) => {
    if (sortBy === columnId) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(columnId);
      setSortDir("asc");
    }
    setPage(1);
  };

  // Search state
  const [search, setSearch] = useState("");
  // local input for search — API triggers only when submitted
  const [searchInput, setSearchInput] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = (searchInput || "").trim();
    setPage(1);
    setSearch(q);
  };
  const clearSearchInput = () => {
    setSearchInput("");
    setPage(1);
    setSearch("");
  };

  // Date range filter (use Date | null for MUI DatePicker)
  const [fromDate, setFromDate] = useState<Date | null>(null);
  const [toDate, setToDate] = useState<Date | null>(null);

  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<any | null>(null);

  // Delete confirmation modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    id?: number;
    label?: string;
  } | null>(null);

  // action menu state
  const [actionsAnchorEl, setActionsAnchorEl] = useState<null | HTMLElement>(
    null
  );
  const [actionsRow, setActionsRow] = useState<any | null>(null);
  const actionsOpen = Boolean(actionsAnchorEl);

  // Create Payment modal state + initial values
  const [createPaymentOpen, setCreatePaymentOpen] = useState(false);
  const [paymentInitialValues, setPaymentInitialValues] = useState<any | null>(
    null
  );

  // View Payments modal state
  const [viewPaymentsOpen, setViewPaymentsOpen] = useState(false);
  const [viewPaymentsPONumber, setViewPaymentsPONumber] = useState<string>("");

  // Expanded rows state for product details
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Customer details popover
  const [customerAnchorEl, setCustomerAnchorEl] = useState<null | HTMLElement>(
    null
  );
  const [customerData, setCustomerData] = useState<any | null>(null);

  const handleOpenCustomer = (
    event: React.MouseEvent<HTMLElement>,
    customer: any
  ) => {
    setCustomerAnchorEl(event.currentTarget);
    setCustomerData(customer || null);
  };
  const handleCloseCustomer = () => {
    setCustomerAnchorEl(null);
    setCustomerData(null);
  };
  const customerOpen = Boolean(customerAnchorEl);

  const navigate = useNavigate();

  const formatDateParam = (d: Date | null) => {
    if (!d) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`; // yyyy-mm-dd (local date)
  };

  // Fetch sales from backend (supports fromDate/toDate)
  const fetchSales = async (
    pageNum = 1,
    perPageNum = rowsPerPage,
    searchTerm = search,
    fromDateParam?: Date | null,
    toDateParam?: Date | null,
    categoryParam: string | null = categoryFilter || null
  ) => {
    setLoading(true);
    try {
      let url = `/sales?currentPage=${pageNum}&perPage=${perPageNum}&search=${encodeURIComponent(
        searchTerm || ""
      )}`;

      const fromStr = formatDateParam(fromDateParam ?? null);
      const toStr = formatDateParam(toDateParam ?? null);

      if (fromStr) url += `&fromDate=${encodeURIComponent(fromStr)}`;
      if (toStr) url += `&toDate=${encodeURIComponent(toStr)}`;

      if (categoryParam)
        url += `&category=${encodeURIComponent(categoryParam)}`;
      // include server-side sort params
      if (sortBy) url += `&sortBy=${encodeURIComponent(sortBy)}`;
      if (sortDir) url += `&sortDir=${encodeURIComponent(sortDir)}`;

      const res = await axiosInstance.get<{ items: any[]; total: number }>(url);
      setSales(res.data.items || []);
      setTotal(res.data.total || 0);
      setPage(pageNum);
    } catch (err) {
      setSales([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSales(page, rowsPerPage, search, fromDate, toDate);
    // eslint-disable-next-line
  }, [
    page,
    rowsPerPage,
    search,
    fromDate,
    toDate,
    sortBy,
    sortDir,
    categoryFilter,
  ]);

  // load categories for filter dropdown
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setCategoriesLoading(true);
        const res = await axiosInstance.get("/categories");
        if (!mounted) return;
        const normalize = (data: any) => {
          const arr = Array.isArray(data)
            ? data
            : Array.isArray(data?.items)
            ? data.items
            : [];
          return arr
            .map((x: any) => (x && x.name ? x.name : String(x)))
            .filter(Boolean);
        };
        setCategoriesList(normalize(res.data));
      } catch (err) {
        console.error("Failed to load categories", err);
        if (mounted) setCategoriesList([]);
      } finally {
        if (mounted) setCategoriesLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const handleRefresh = () => {
    fetchSales(page, rowsPerPage, search, fromDate, toDate);
  };

  const handleEditSale = (saleId?: number) => {
    if (!saleId) return;
    navigate(`/sales/${saleId}/edit`);
  };

  // open delete modal instead of window.confirm
  const onDeleteClick = (row: any) => {
    setDeleteTarget({
      id: row.id,
      label: `Purchase order ${row.purchaseOrderNumber}`,
    });
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget?.id) {
      setDeleteModalOpen(false);
      setDeleteTarget(null);
      return;
    }
    setLoading(true);
    try {
      await axiosInstance.delete(`/sales/${deleteTarget.id}`);
      showSuccess("Purchase order deleted successfully");
      // refresh
      fetchSales(page, rowsPerPage, search, fromDate, toDate);
      axiosInstance.post(`/system-logs/`, {
        module: "Purchase Order",
        action: "Delete",
        description: `${user.fullName} (${user.role}) deleted ${deleteTarget.label}`,
        createdBy: user.fullName,
      });
    } catch (err: any) {
      console.error("Failed to delete purchase order", err);
      const msg =
        err?.response?.data?.error || err?.message || "Failed to delete sale";
      showError(msg);
    } finally {
      setLoading(false);
      setDeleteModalOpen(false);
      setDeleteTarget(null);
    }
  };

  const openInvoice = (sale: any) => {
    setSelectedSale(sale);
    setInvoiceOpen(true);
  };

  const handleOpenActions = (
    event: React.MouseEvent<HTMLElement>,
    row: any
  ) => {
    setActionsAnchorEl(event.currentTarget);
    setActionsRow(row);
  };
  const handleCloseActions = () => {
    setActionsAnchorEl(null);
    setActionsRow(null);
  };

  const handleMenuView = () => {
    if (actionsRow) openInvoice(actionsRow);
    handleCloseActions();
  };
  const handleMenuEdit = () => {
    if (actionsRow) handleEditSale(actionsRow.id);
    handleCloseActions();
  };
  const handleMenuDelete = () => {
    if (actionsRow) onDeleteClick(actionsRow);
    handleCloseActions();
  };
  const handleMenuViewPayments = () => {
    if (actionsRow) {
      const po = actionsRow.purchaseOrderNumber || "";
      setViewPaymentsPONumber(po);
      setViewPaymentsOpen(true);
    }
    handleCloseActions();
  };

  const handleMenuCreatePayment = () => {
    if (!actionsRow) {
      handleCloseActions();
      return;
    }
    // Pass PO number into payment modal initial values
    setPaymentInitialValues({
      purchaseOrderNumber: actionsRow.purchaseOrderNumber || "",
      referenceNo: "",
      amount: "",
      paymentChannel: "",
      description: "",
      paymentDate: "",
      attachment: null,
    });
    setCreatePaymentOpen(true);
    handleCloseActions();
  };

  const handleCloseCreatePayment = () => {
    setCreatePaymentOpen(false);
    setPaymentInitialValues(null);
  };

  const handlePaymentSuccess = () => {
    fetchSales();
    handleCloseCreatePayment();
  };

  // Compute total sales today
  const today = new Date();
  const totalSalesToday = sales
    .filter((s) => {
      if (!s.saleDate) return false;
      const d = new Date(s.saleDate);
      return (
        d.getFullYear() === today.getFullYear() &&
        d.getMonth() === today.getMonth() &&
        d.getDate() === today.getDate()
      );
    })
    .reduce((sum, s) => sum + Number(s.total || 0), 0);

  // Compute sold items/services today
  const soldItemsToday = sales
    .filter((s) => {
      if (!s.saleDate) return false;
      const d = new Date(s.saleDate);
      return (
        d.getFullYear() === today.getFullYear() &&
        d.getMonth() === today.getMonth() &&
        d.getDate() === today.getDate()
      );
    })
    .reduce((sum, s) => {
      if (Array.isArray(s.products)) {
        return (
          sum +
          s.products.reduce(
            (a: number, p: any) => a + Number(p.quantity || p.qty || 0),
            0
          )
        );
      }
      return sum + Number(s.quantity || 0);
    }, 0);

  const getPaymentStatusSx = (status: string) => ({
    fontWeight: 700,
    borderRadius: 1,
    fontSize: 14,
    minWidth: 120,
    bgcolor: status === "Paid" ? "#d5f5e3" : "#fdf2c0",
    color: status === "Paid" ? "#229954" : "#b7950b",
    border: status === "Paid" ? "1px solid #27ae60" : "1px solid #f4d03f",
  });

  // Helper to format products list as separate lines
  const renderProductList = (row: any) => {
    if (!Array.isArray(row.products) || row.products.length === 0) {
      const name = row.product_name || row.name || "";
      const qty = row.quantity || row.qty || 0;
      return <div>{name ? `${name} (${qty})` : "-"}</div>;
    }

    return row.products.map((p: any, i: number) => {
      const name = p.name || p.product_name || "Product";
      const qty = p.quantity ?? p.qty ?? 0;
      return (
        <div key={i} style={{ marginBottom: 4, maxWidth: 300 }}>
          {`${name} (${qty})`}
        </div>
      );
    });
  };

  // Toggle expansion state for a row
  const toggleRowExpansion = (rowKey: string) => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(rowKey)) {
        newSet.delete(rowKey);
      } else {
        newSet.add(rowKey);
      }
      return newSet;
    });
  };

  // Get row key for expansion tracking
  const getRowKey = (row: any) => {
    return row.id || row.purchaseOrderNumber || `row-${Math.random()}`;
  };

  // Calculate product total: (price - discount + tax) * quantity
  const calculateProductTotal = (product: any) => {
    const price = Number(product.price || product.unit_price || 0);
    const tax = Number(product.tax || 0);
    const quantity = Number(product.quantity || product.qty || 1);

    return (price + tax) * quantity;
  };

  // Render expandable product toggle button
  const renderProductToggle = (row: any) => {
    const rowKey = getRowKey(row);
    const isExpanded = expandedRows.has(rowKey);

    return (
      <Button
        variant="text"
        size="small"
        onClick={() => toggleRowExpansion(rowKey)}
        sx={{
          textTransform: "none",
          fontWeight: 600,
          color: "primary.main",
          "&:hover": {
            backgroundColor: "primary.light",
            color: "primary.contrastText",
          },
          textAlign: "left",
        }}
        endIcon={isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
      >
        {isExpanded ? "Hide Products" : "View Products"}
      </Button>
    );
  };

  // Render expanded product details table
  const renderExpandedProductDetails = (row: any) => {
    const rowKey = getRowKey(row);
    const isExpanded = expandedRows.has(rowKey);

    if (!isExpanded) return null;

    // Prepare products array
    let products: any[] = [];
    if (Array.isArray(row.products) && row.products.length > 0) {
      products = row.products;
    } else {
      // Single-line sale case
      const name = row.product_name || row.name || "";
      if (name) {
        products = [
          {
            name: name,
            product_name: name,
            sku: row.sku || row.code || "",
            price: row.price || row.unit_price || 0,
            quantity: row.quantity || row.qty || 1,
            discount:
              row.discount || row.discountValue || row.discount_value || 0,
            tax: row.tax || 0,
          },
        ];
      }
    }

    return (
      <TableRow key={`${rowKey}-expanded`}>
        <TableCell colSpan={10} sx={{ py: 0, border: 0 }}>
          <Box sx={{ py: 2 }}>
            {products.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                No products
              </Typography>
            ) : (
              <Table size="small" sx={{ maxWidth: 800 }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>SKU</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="right">
                      Quantity
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="right">
                      Price
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="right">
                      Total
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {products.map((product, index) => {
                    const name =
                      product.name || product.product_name || "Product";
                    const sku = product.sku || product.code || "-";
                    const price = Number(
                      product.price || product.unit_price || 0
                    );
                    const total = calculateProductTotal(product);

                    const quantity = Number(
                      product.quantity ?? product.qty ?? 0
                    );
                    return (
                      <TableRow key={index}>
                        <TableCell>{name}</TableCell>
                        <TableCell>{sku}</TableCell>
                        <TableCell align="right">
                          {formatQty(quantity)}
                        </TableCell>
                        <TableCell align="right">{formatPeso(price)}</TableCell>
                        <TableCell align="right">{formatPeso(total)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </Box>
        </TableCell>
      </TableRow>
    );
  };

  // Compute total discount for a sale row (sums product.discount * quantity when products present)
  const computeRowDiscount = (row: any) => {
    if (Array.isArray(row.products) && row.products.length > 0) {
      return row.products.reduce((sum: number, p: any) => {
        const qty = Number(p.quantity ?? p.qty ?? 1) || 0;
        const disc = Number(p.discount ?? 0) || 0;
        return sum + disc * qty;
      }, 0);
    }
    return Number(row.discount ?? 0) || 0;
  };

  // Currency/quantity formatters
  const formatPeso = (val: any) =>
    `₱${Number(val ?? 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  const formatQty = (val: any) =>
    Number(val ?? 0).toLocaleString(undefined, { minimumFractionDigits: 0 });

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      <Backdrop
        open={loading}
        sx={{ color: "#fff", zIndex: (theme) => theme.zIndex.drawer + 1 }}
      >
        <CircularProgress color="inherit" />
      </Backdrop>

      <Stack
        justifyContent="space-between"
        alignItems="flex-start"
        sx={{ mb: 3, flexDirection: { xs: "column", sm: "row" } }}
      >
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Purchase Orders
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={2}>
            View and manage all purchase order transactions
          </Typography>
        </Box>

        <Box>
          <Stack
            sx={{ flexWrap: { xs: "wrap", sm: "nowrap" } }}
            direction="row"
            gap={2}
          >
            <Button
              variant="contained"
              aria-label="Export XLS"
              onClick={() => {
                /* keep existing handler if any */
              }}
              sx={{
                bgcolor: "#27ae60",
                color: "#fff",
                boxShadow: 0,
                width: { xs: 44, sm: "auto" },
                minWidth: { xs: 44, sm: 0 },
                height: 40,
                px: { xs: 0, sm: 2 },
                justifyContent: { xs: "center", sm: "flex-start" },
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              <AttachFileIcon sx={{ mr: { xs: 0, sm: 1 } }} />
              <Box
                component="span"
                sx={{ display: { xs: "none", sm: "inline-block" } }}
              >
                XLS
              </Box>
            </Button>

            <Button
              variant="contained"
              aria-label="Refresh"
              onClick={handleRefresh}
              sx={{
                bgcolor: "#95a5a6",
                color: "#fff",
                boxShadow: 0,
                width: { xs: 44, sm: "auto" },
                minWidth: { xs: 44, sm: 0 },
                height: 40,
                px: { xs: 0, sm: 2 },
                justifyContent: { xs: "center", sm: "flex-start" },
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              <RefreshIcon sx={{ mr: { xs: 0, sm: 1 } }} />
              <Box
                component="span"
                sx={{ display: { xs: "none", sm: "inline-block" } }}
              >
                REFRESH
              </Box>
            </Button>

            <HasPermission module="Purchase Orders" action="Create">
              <Button
                variant="contained"
                aria-label="Add Purchase Order"
                onClick={() => navigate("/add-sales")}
                sx={{
                  bgcolor: "#ff9800",
                  color: "#fff",
                  boxShadow: 0,
                  width: { xs: 44, sm: "auto" },
                  minWidth: { xs: 44, sm: 0 },
                  height: 40,
                  px: { xs: 0, sm: 2 },
                  justifyContent: { xs: "center", sm: "flex-start" },
                  display: "inline-flex",
                  alignItems: "center",
                }}
              >
                <AddCircleOutlineIcon sx={{ mr: { xs: 0, sm: 1 } }} />
                <Box
                  component="span"
                  sx={{ display: { xs: "none", sm: "inline-block" } }}
                >
                  Add Purchase Order
                </Box>
              </Button>
            </HasPermission>
          </Stack>
        </Box>
      </Stack>

      {/* Widgets container (separate white box) */}
      {/* <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <Box
            sx={{
              flex: 1,
              borderRadius: 2,
              p: 2,
              textAlign: "center",
              bgcolor: "#e8f4ff",
              border: "1px solid #cfe8ff",
            }}
          >
            <Typography fontWeight={600}>Total Sales Today</Typography>
            <Typography sx={{ mt: 1, fontWeight: 700, fontSize: 18 }}>
              {totalSalesToday.toLocaleString(undefined, {
                minimumFractionDigits: 2,
              })}
            </Typography>
          </Box>

          <Box
            sx={{
              flex: 1,
              borderRadius: 2,
              p: 2,
              textAlign: "center",
              bgcolor: "#f3e8ff",
              border: "1px solid #e3ccff",
            }}
          >
            <Typography fontWeight={600}>Sold Items/Services Today</Typography>
            <Typography sx={{ mt: 1, fontWeight: 700, fontSize: 18 }}>
              {soldItemsToday.toLocaleString(undefined, {
                minimumFractionDigits: 0,
              })}
            </Typography>
          </Box>

          <Box
            sx={{
              flex: 1,
              borderRadius: 2,
              p: 2,
              textAlign: "center",
              bgcolor: "#fff4d6",
              border: "1px solid #fde3a6",
            }}
          >
            <Typography fontWeight={600} color="#b7950b">
              Unpaid
            </Typography>
            <Typography sx={{ mt: 1, fontWeight: 700, fontSize: 18 }}>
              {
                sales.filter(
                  (s) =>
                    String(s.paymentStatus || "")
                      .trim()
                      .toLowerCase() === "unpaid"
                ).length
              }
            </Typography>
          </Box>

          <Box
            sx={{
              flex: 1,
              borderRadius: 2,
              p: 2,
              textAlign: "center",
              bgcolor: "#e9fbf0",
              border: "1px solid #cfeee0",
            }}
          >
            <Typography fontWeight={600} color="#229954">
              Paid
            </Typography>
            <Typography sx={{ mt: 1, fontWeight: 700, fontSize: 18 }}>
              {
                sales.filter(
                  (s) =>
                    String(s.paymentStatus || "")
                      .trim()
                      .toLowerCase() === "paid"
                ).length
              }
            </Typography>
          </Box>
        </Stack>
      </Paper> */}

      {/* Main content: filters + table */}
      <Paper sx={{ p: 3, mb: 3, overflow: "auto" }}>
        {/* Filters */}
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            justifyContent="space-between"
            sx={{ mb: 2, gap: { xs: 1, md: 0 } }}
          >
            {/* Left: search + category filter */}
            <Box sx={{ flex: 1, mr: { xs: 0, md: 2 }, minWidth: 0 }}>
              <form onSubmit={handleSearch} style={{ width: "100%" }}>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={2}
                  alignItems="center"
                >
                  <TextField
                    placeholder="Search by PO, Product or Customer..."
                    size="small"
                    variant="outlined"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    sx={{
                      width: { xs: "100%", sm: 350 },
                      minWidth: { sm: 0 },
                      bgcolor: "#fafbfc",
                      "& .MuiInputBase-input": { pl: 2 },
                    }}
                    InputProps={{
                      endAdornment: (
                        <>
                          <IconButton
                            size="small"
                            aria-label="clear-search"
                            onClick={clearSearchInput}
                            sx={{
                              visibility: searchInput ? "visible" : "hidden",
                            }}
                          >
                            <CloseIcon />
                          </IconButton>
                          <IconButton
                            type="submit"
                            size="small"
                            aria-label="search"
                          >
                            <SearchIcon />
                          </IconButton>
                        </>
                      ),
                    }}
                  />

                  <Autocomplete
                    options={categoriesList}
                    loading={categoriesLoading}
                    size="small"
                    value={categoryFilter || null}
                    onChange={(_, value) => {
                      setCategoryFilter(value || "");
                      setPage(1);
                    }}
                    clearOnEscape
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Category"
                        placeholder="All"
                        size="small"
                      />
                    )}
                    sx={{ minWidth: { xs: "100%", sm: 200 } }}
                  />
                </Stack>
              </form>
            </Box>

            {/* Right: date filters + clear */}
            <Stack
              sx={{ mb: 3, flexDirection: { xs: "column", sm: "row" } }}
              gap={2}
            >
              <DatePicker
                label="Date from"
                value={fromDate}
                onChange={(newVal) => {
                  setFromDate(newVal);
                  setPage(1);
                }}
                slotProps={{
                  textField: {
                    size: "small",
                    placeholder: "From",
                    sx: {
                      width: { xs: "100%", sm: 200 },
                      bgcolor: "#fafbfc",
                      "& .MuiInputBase-root": { height: 40 },
                    },
                  },
                }}
              />

              <DatePicker
                label="Date to"
                value={toDate}
                onChange={(newVal) => {
                  setToDate(newVal);
                  setPage(1);
                }}
                slotProps={{
                  textField: {
                    size: "small",
                    placeholder: "From",
                    sx: {
                      width: { xs: "100%", sm: 200 },
                      bgcolor: "#fafbfc",
                      "& .MuiInputBase-root": { height: 40 },
                    },
                  },
                }}
              />

              <Button
                variant="outlined"
                size="small"
                onClick={() => {
                  setFromDate(null);
                  setToDate(null);
                  setSearch("");
                  setPage(1);
                }}
              >
                Clear
              </Button>
            </Stack>
          </Stack>
        </LocalizationProvider>

        {/* Table */}
        <TableContainer>
          <Table
            sx={{
              "& tbody tr": { transition: "background-color 0.15s ease" },
              "& tbody tr:hover": { backgroundColor: "#ededed" }, // darker than #f5f5f5
            }}
          >
            <TableHead>
              <TableRow>
                <TableCell>
                  <TableSortLabel
                    active={sortBy === "purchaseOrderNumber"}
                    direction={
                      sortBy === "purchaseOrderNumber" ? sortDir : "asc"
                    }
                    onClick={() => handleSort("purchaseOrderNumber")}
                  >
                    PO Number
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortBy === "createdOn"}
                    direction={sortBy === "createdOn" ? sortDir : "desc"}
                    onClick={() => handleSort("createdOn")}
                  >
                    Created On
                  </TableSortLabel>
                </TableCell>

                <TableCell>
                  <TableSortLabel
                    active={sortBy === "saleDate"}
                    direction={sortBy === "saleDate" ? sortDir : "desc"}
                    onClick={() => handleSort("saleDate")}
                  >
                    Purchase Order Date
                  </TableSortLabel>
                </TableCell>

                {/* Customer */}
                <TableCell
                  sx={{ width: { xs: "20%", md: "15%" }, minWidth: 150 }}
                >
                  Customer
                </TableCell>
                <TableCell>Payment Option</TableCell>
                <TableCell
                  sx={{ width: { xs: "20%", md: "15%" }, minWidth: 150 }}
                >
                  Product / Service Name
                </TableCell>
                <TableCell
                  sx={{ width: { xs: "12%", md: "10%" }, minWidth: 100 }}
                >
                  Grand Total
                </TableCell>
                <TableCell>Discount</TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortBy === "grandTotal"}
                    direction={sortBy === "grandTotal" ? sortDir : "desc"}
                    onClick={() => handleSort("grandTotal")}
                  >
                    Net Total
                  </TableSortLabel>
                </TableCell>

                {/* Agent Commission column (percentage) */}
                <TableCell>Agent Commission</TableCell>

                {/* TIN No. and Business Address columns removed */}
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sales.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} align="center">
                    No records found
                  </TableCell>
                </TableRow>
              )}
              {sales.map((row, idx) => (
                <React.Fragment key={row.id ?? idx}>
                  <TableRow>
                    {/* PO Number */}
                    <TableCell>
                      {row.purchaseOrderNumber ? (
                        <Typography
                          component="span"
                          sx={getPurchaseOrderNumberSx(row.category)}
                        >
                          {row.purchaseOrderNumber}
                        </Typography>
                      ) : (
                        "-"
                      )}
                    </TableCell>

                    {/* Created On */}
                    <TableCell>
                      {row.createdOn ? dayjs(row.createdOn).format('MMM D, YYYY, h:mmA') : "-"}
                    </TableCell>

                    {/* Sale Date */}
                    <TableCell>
                      {row.saleDate ? dayjs(row.saleDate).format('MMM D, YYYY, h:mmA') : "-"}
                    </TableCell>

                    {/* Customer Name */}
                    <TableCell align="left">
                      <Button
                        variant="text"
                        onClick={(e) =>
                          handleOpenCustomer(
                            e,
                            row.customer || {
                              fullName: row.customer_name || row.customer,
                            }
                          )
                        }
                        endIcon={<ExpandMoreIcon />}
                        sx={{
                          textTransform: "none",
                          justifyContent: "flex-start",
                          textAlign: "left",
                        }}
                      >
                        {`${row.customer?.fullName} - ${row.customer?.storeName}`}
                      </Button>
                    </TableCell>
                      
                    {/* Payment Option */}
                    <TableCell>
                      {row.paymentOption && row.paymentOption ? (
                        <Chip
                          label={
                            row.paymentOption === "Installment Payment"
                              ? "Installment"
                              : row.paymentOption === "Cash Payment"
                              ? "Cash"
                              : row.paymentOption === "LBC"
                              ? "LBC"
                              : row.paymentOption === "PDC"
                              ? "PDC"
                              : row.paymentOption
                          }
                          size="small"
                          sx={{
                            bgcolor:
                              row.paymentOption === "Cash Payment"
                                ? "#27ae60"
                                : row.paymentOption === "Installment Payment"
                                ? "#FF0000"
                                : row.paymentOption === "LBC"
                                ? "#f1c40f"
                                : row.paymentOption === "PDC"
                                ? "#003151"
                                : "#808080",
                            color: "#fff",
                            fontWeight: 700,
                          }}
                        />
                      ) : (
                        "-"
                      )}
                    </TableCell>

                    {/* Products */}
                    <TableCell
                      sx={{
                        fontWeight: 700,
                        width: { xs: "20%", md: "15%" },
                        minWidth: 150,
                      }}
                    >
                      {renderProductToggle(row)}
                    </TableCell>

                    {/* Amount = Grand Total - Discount */}
                    <TableCell>{formatPeso(row.grandTotal)}</TableCell>

                    {/* Discount */}
                    <TableCell>{formatPeso(row.totalDiscount || 0)}</TableCell>

                    {/* Net Total */}
                    <TableCell>{formatPeso(row.netTotal)}</TableCell>

                    {/* Agent Commission */}
                    <TableCell>{
                      row.agentCommission !== null && typeof row.agentCommission !== 'undefined'
                        ? `${Number(row.agentCommission).toLocaleString(undefined, { maximumFractionDigits: 2 })} Percent`
                        : "-"
                    }</TableCell>

                    {/* Sales Channel, Receipt No., TIN No., Business Address columns removed */}

                    <TableCell align="right">
                      <Stack
                        direction="row"
                        spacing={1}
                        justifyContent="flex-end"
                      >
                        <Tooltip title="More Actions">
                          <IconButton
                            size="small"
                            onClick={(e) => handleOpenActions(e, row)}
                            color={
                              actionsOpen && actionsRow?.id === row.id
                                ? "primary"
                                : "default"
                            }
                          >
                            <MoreVertIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                  {renderExpandedProductDetails(row)}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Pagination */}
        <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 2 }}>
          <TablePagination
            component="div"
            count={total}
            page={page - 1}
            onPageChange={(_, newPage) => setPage(newPage + 1)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(Number(e.target.value));
              setPage(1);
            }}
            rowsPerPageOptions={[10, 20, 50]}
            labelRowsPerPage="Rows per page:"
          />
        </Box>
      </Paper>

      <InvoiceModal
        open={invoiceOpen}
        onClose={() => setInvoiceOpen(false)}
        sale={selectedSale}
      />

      <DeleteConfirmModal
        open={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setDeleteTarget(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Delete Purchase Order"
        message={`Are you sure you want to delete ${
          deleteTarget?.label || "this purchase order"
        }? This action cannot be undone.`}
      />

      {/* Actions menu (for mobile/tablet) */}
      <Menu
        anchorEl={actionsAnchorEl}
        open={actionsOpen}
        onClose={handleCloseActions}
        MenuListProps={{ disablePadding: true }}
      >
        <MenuItem onClick={handleMenuView}>
          <ListItemIcon>
            <ReceiptLongIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>
            <Typography variant="body2" color="inherit">
              Generate Purchase Order
            </Typography>
          </ListItemText>
        </MenuItem>

        <HasPermission module="Purchase Orders" action="Update">
          <MenuItem onClick={handleMenuEdit}>
            <ListItemIcon>
              <EditIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>
              <Typography variant="body2" color="inherit">
                Edit
              </Typography>
            </ListItemText>
          </MenuItem>
        </HasPermission>

        {/* Create Payment and View Payments menu items removed */}
        <HasPermission module="Purchase Orders" action="Delete">
          <MenuItem onClick={handleMenuDelete}>
            <ListItemIcon>
              <DeleteIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>
              <Typography
                variant="body2"
                color="inherit"
                sx={{ color: "error.main" }}
              >
                Delete
              </Typography>
            </ListItemText>
          </MenuItem>
        </HasPermission>
      </Menu>

      {/* Customer details popover */}
      <Popover
        open={customerOpen}
        anchorEl={customerAnchorEl}
        onClose={handleCloseCustomer}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      >
        <Box sx={{ p: 2, minWidth: 280 }}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
            Customer Details
          </Typography>
          <Table size="small">
            <TableBody>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Company</TableCell>
                <TableCell>{customerData?.company || "-"}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Address</TableCell>
                <TableCell>
                  {customerData?.address ||
                    customerData?.businessAddress ||
                    "-"}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>TIN</TableCell>
                <TableCell>{customerData?.tin || "-"}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Phone</TableCell>
                <TableCell>
                  {customerData?.phoneNumber || customerData?.phone || "-"}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Box>
      </Popover>

      <CreatePaymentModal
        open={createPaymentOpen}
        onClose={handleCloseCreatePayment}
        initialValues={paymentInitialValues}
        onSuccess={handlePaymentSuccess}
      />

      <ViewPaymentsModal
        open={viewPaymentsOpen}
        onClose={() => {
          setViewPaymentsOpen(false);
          setViewPaymentsPONumber("");
        }}
        purchaseOrderNumber={viewPaymentsPONumber}
      />
    </Box>
  );
};

export default SalesListing;
