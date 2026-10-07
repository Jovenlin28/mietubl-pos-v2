import React, { useEffect, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  Stack,
  Button,
  TextField,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TablePagination,
  CircularProgress,
  IconButton,
  Backdrop,
  Chip,
  TableSortLabel,
  InputAdornment,
  Popover,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import SearchIcon from "@mui/icons-material/Search";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import CloseIcon from "@mui/icons-material/Close";
import dayjs from "dayjs";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import DeleteConfirmModal from "../components/DeleteConfirmModal";
import CreatePaymentModal from "../components/CreatePaymentModal";
import ViewAttachmentModal from "../components/ViewAttachmentModal";
import PrimaryButton from "../shared/buttons/PrimaryButton";
import axiosInstance from "../configs/axiosConfig";
// Datepicker imports (same pattern as other listing pages)
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import HasPermission from "../components/HasPermission";
import { useNotification } from "../hooks/useNotification";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import { getPurchaseOrderNumberSx } from "../helpers/purchaseOrder";

const PaymentsMonitoring: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  // local input for search — only apply when user submits (Enter or clicking search)
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const { showSuccess, showError } = useNotification();
  // Date range filters
  const [fromDate, setFromDate] = useState<Date | null>(null);
  const [toDate, setToDate] = useState<Date | null>(null);
  // status filter for payments list; default "All"
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editInitialValues, setEditInitialValues] = useState<any | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState<any | null>(null);
  const [viewAttachmentOpen, setViewAttachmentOpen] = useState(false);
  const [viewAttachmentUrl, setViewAttachmentUrl] = useState<string>("");
  // Actions menu state (three-dot menu)
  const [actionsAnchorEl, setActionsAnchorEl] = useState<null | HTMLElement>(
    null
  );
  const [actionsRow, setActionsRow] = useState<any | null>(null);
  const actionsOpen = Boolean(actionsAnchorEl);

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

  // Sorting state (server-side). Default to createdOn desc
  const [sortBy, setSortBy] = useState<string>("createdOn"); // purchaseOrderNumber | amount | createdOn | paymentDate
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Expanded groups keyed by purchaseOrderNumber
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Customer popover state (for Customer column)
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

  const formatDateParam = (d: Date | null) => {
    if (!d) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`; // yyyy-mm-dd (local date)
  };

  // fetch payments with optional date filters (page is 0-based)
  const fetchPayments = async (
    pageNum = 0,
    perPageNum = rowsPerPage,
    searchTerm = search,
    fromDateParam?: Date | null,
    toDateParam?: Date | null,
    sortByParam?: string,
    sortDirParam?: string,
    statusParam?: string
  ) => {
    setLoading(true);
    try {
      const params: any = {
        perPage: perPageNum,
        currentPage: pageNum + 1,
        search: (searchTerm || "").trim(),
      };
      const f = formatDateParam(fromDateParam ?? null);
      const t = formatDateParam(toDateParam ?? null);
      if (f) params.fromDate = f;
      if (t) params.toDate = t;
      // include sort params (prefer explicit params passed to this call)
      const sBy = sortByParam ?? sortBy;
      const sDir = sortDirParam ?? sortDir;
      if (sBy) params.sortBy = sBy;
      if (sDir) params.sortDir = sDir;
      // include status query param: if "All" send empty string (backend treats empty as no filter)
      const st =
        typeof statusParam !== "undefined" ? statusParam : statusFilter;
      params.status = st === "All" ? "" : st;

      const res = await axiosInstance.get("/payments", { params });
      setItems(res.data.items);
      setTotal(res.data.total);
      setPage(pageNum);
      // collapse all groups when data refreshes
      setExpanded({});
    } catch (err) {
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // initial / reactive fetch — search is only applied when user submits
    fetchPayments(
      page,
      rowsPerPage,
      search,
      fromDate,
      toDate,
      sortBy,
      sortDir,
      statusFilter
    );
    // eslint-disable-next-line
  }, [page, rowsPerPage, fromDate, toDate, sortBy, sortDir, statusFilter]);

  // Server-side sorting: request server with sort params
  const handleSort = (columnId: string) => {
    let newDir: "asc" | "desc" = "asc";
    if (sortBy === columnId) newDir = sortDir === "asc" ? "desc" : "asc";
    // set state so UI updates and also fetch page 0 with explicit params
    setSortBy(columnId);
    setSortDir(newDir);
    setPage(0);
    fetchPayments(
      0,
      rowsPerPage,
      search,
      fromDate,
      toDate,
      columnId,
      newDir,
      statusFilter
    );
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    // apply the typed search input and trigger fetch
    setSearch(searchInput.trim());
    fetchPayments(
      0,
      rowsPerPage,
      searchInput.trim(),
      fromDate,
      toDate,
      undefined,
      undefined,
      statusFilter
    );
  };

  const handleClearSearch = () => {
    setSearchInput("");
    setSearch("");
    setPage(0);
    fetchPayments(
      0,
      rowsPerPage,
      "",
      fromDate,
      toDate,
      undefined,
      undefined,
      statusFilter
    );
  };

  // When user clears the search input by typing (backspace) to empty,
  // automatically reset applied search and reload the list.
  useEffect(() => {
    if ((searchInput || "").trim() === "" && (search || "") !== "") {
      setPage(0);
      setSearch("");
      fetchPayments(
        0,
        rowsPerPage,
        "",
        fromDate,
        toDate,
        undefined,
        undefined,
        statusFilter
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const handleRefresh = () => {
    setSearch("");
    setFromDate(null);
    setToDate(null);
    setPage(0);
    fetchPayments(
      0,
      rowsPerPage,
      "",
      null,
      null,
      undefined,
      undefined,
      statusFilter
    );
  };

  const handleAdd = () => {
    setEditId(null);
    setEditInitialValues(null);
    setModalOpen(true);
  };

  const handleEdit = (item: any) => {
    setEditId(item.id);
    setEditInitialValues({
      id: item.id,
      referenceNo: item.referenceNo,
      amount: item.amount,
      paymentChannel: item.paymentChannel,
      description: item.description,
      createdOn: item.createdOn,
      paymentDate: item.paymentDate,
      dueDate: item.dueDate || "",            // <-- added
      attachment: item.attachment,
      purchaseOrderNumber: item.purchaseOrderNumber,
      parentPaymentId: item.parentPaymentId || null
    });
    setModalOpen(true);
  };

  const handleDeleteClick = (item: any) => {
    setPaymentToDelete(item);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!paymentToDelete) return;
    setLoading(true);
    try {
      await axiosInstance.delete(`/payments/${paymentToDelete.id}`);
      showSuccess("Payment deleted successfully");
      setDeleteModalOpen(false);
      setPaymentToDelete(null);
      fetchPayments(
        page,
        rowsPerPage,
        search,
        fromDate,
        toDate,
        undefined,
        undefined,
        statusFilter
      );
    } catch (err: any) {
      console.error("Failed to delete payment:", err);
      const msg =
        err?.response?.data?.error ||
        err?.message ||
        "Failed to delete payment";
      showError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteModalClose = () => {
    setDeleteModalOpen(false);
    setPaymentToDelete(null);
  };

  // Handler for viewing attachment
  const handleViewAttachment = (attachment: string) => {
    setViewAttachmentUrl(attachment);
    setViewAttachmentOpen(true);
  };

  // Helper to format currency with peso sign and 2 decimals
  const formatPeso = (val: any) =>
    `₱${Number(val ?? 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  // Columns definition for main table (unchanged)
  const columns = [
    { id: "poNumber", label: "PO Number", sortable: true },
    { id: "customer", label: "Customer", sortable: true },
    { id: "total", label: "Total", sortable: true },
    { id: "amount", label: "Amount Paid", sortable: true },
    { id: "balance", label: "Balance", sortable: true },
    { id: "paymentChannel", label: "Payment Channel", sortable: true },
    { id: "paymentOption", label: "Payment Option", sortable: true },
    { id: "paymentStatus", label: "Payment Status", sortable: true },
    { id: "deliveryStatus", label: "Delivery Status", sortable: true },
    { id: "createdOn", label: "Created On", sortable: true },
    { id: "paymentDate", label: "Payment Date", sortable: true },
    { id: "saleDate", label: "Sale Date", sortable: true }, // <-- new column
    { id: "attachment", label: "Attachment", sortable: false },
    { id: "dueDate", label: "Due Date", sortable: true }, // <-- make sortable
    { id: "actions", label: "Actions", sortable: false },
  ];

  // Items already grouped from backend: each item is the parent; children in item.children
  const groupedRows = items.map((parent) => ({
    key: parent.purchaseOrderNumber || `__id_${parent.id}`,
    head: parent,
    children: Array.isArray(parent.children) ? parent.children : [],
  }));

  const toggleExpand = (key: string) =>
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  // Helper to render a row's cells in the main table order
  const renderCells = (
    row: any,
    opts?: { isChild?: boolean; groupKey?: string }
  ) => {
    const isChild = !!opts?.isChild;
    // compute due-date status badge for unpaid payments
    let dueBadge: React.ReactNode = null;
    if (row.dueDate && String(row.paymentStatus || "").toLowerCase() === "unpaid") {
      const due = new Date(row.dueDate);
      const today = new Date();
      const msPerDay = 1000 * 60 * 60 * 24;
      const dueDateOnly = new Date(due.getFullYear(), due.getMonth(), due.getDate());
      const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const diff = Math.ceil((dueDateOnly.getTime() - todayOnly.getTime()) / msPerDay);
      let label = "";
      let badgeSx: any = {};
      if (diff > 0) {
        label = `Due in ${diff} day${diff > 1 ? "s" : ""}`;
        badgeSx = { bgcolor: "#ffb74d", color: "#000", fontWeight: 700, mt: 1 };
      } else if (diff === 0) {
        label = "Due today";
        badgeSx = { bgcolor: "#fb8c00", color: "#fff", fontWeight: 700, mt: 1 };
      } else {
        const od = Math.abs(diff);
        label = `Overdue by ${od} day${od > 1 ? "s" : ""}`;
        badgeSx = { bgcolor: "#ef5350", color: "#fff", fontWeight: 700, mt: 1 };
      }
      dueBadge = <Chip label={label} size="small" sx={badgeSx} />;
    }

    return (
      <>
        {/* PO Number (hidden for children) */}
        <TableCell>
          {isChild ? (
            <Box component="span" sx={{ display: "inline-block", pl: 4 }} />
          ) : (
            <>
              {groupedRows.find((g) => g.key === opts?.groupKey)?.children
                .length ? (
                <IconButton
                  size="small"
                  onClick={() => toggleExpand(opts!.groupKey!)}
                  aria-label={
                    expanded[opts!.groupKey!]
                      ? "collapse payments"
                      : "expand payments"
                  }
                  sx={{ mr: 1 }}
                >
                  {expanded[opts!.groupKey!] ? (
                    <KeyboardArrowDownIcon fontSize="small" />
                  ) : (
                    <KeyboardArrowRightIcon fontSize="small" />
                  )}
                </IconButton>
              ) : null}
              {row.purchaseOrderNumber ? (
                <Typography
                  component="span"
                  sx={getPurchaseOrderNumberSx(
                    // prefer sale.category (comes from joined sale), fallback to row.category if ever sent
                    row.sale?.category || row.category
                  )}
                >
                  {row.purchaseOrderNumber}
                </Typography>
              ) : (
                row.id
              )}
            </>
          )}
        </TableCell>

        {/* Customer (combined fullName - storeName) with popover */}
        <TableCell>
          <Button
            variant="text"
            onClick={(e) => handleOpenCustomer(e, row.customer)}
            endIcon={<ExpandMoreIcon />}
            sx={{
              textTransform: "none",
              justifyContent: "flex-start",
              textAlign: "left",
            }}
          >
            {row.customer
              ? `${row.customer.fullName || "-"} - ${
                  row.customer.storeName || "-"
                }`
              : "-"}
          </Button>
        </TableCell>

        {/* Total (sale.netTotal) */}
        <TableCell>
          {row.sale && typeof row.sale.netTotal !== "undefined"
            ? formatPeso(row.sale.netTotal)
            : "-"}
        </TableCell>

        {/* Amount */}
        <TableCell>
          {formatPeso(row.amount ?? 0)}
        </TableCell>

        {/* Balance */}
        <TableCell>
          {formatPeso(row.runningBalance)}
        </TableCell>

        {/* Channel */}
        <TableCell>
          {String(row.paymentChannel || "").toUpperCase() === "LBC" ? (
            <Chip
              label="LBC COP"
              size="small"
              sx={{
                backgroundColor: "#ffebee", // light red background
                color: "#c62828", // darker red text
                fontWeight: 700,
              }}
            />
          ) : (
            row.paymentChannel || "-"
          )}
        </TableCell>

        {/* Payment Option */}
        <TableCell>
          {row.sale?.paymentOption && row.sale?.paymentOption ? (
            <Chip
              label={
                row.sale?.paymentOption === "Installment Payment"
                  ? "Installment"
                  : row.sale?.paymentOption === "Cash Payment"
                  ? "Cash"
                  : row.sale?.paymentOption === "LBC"
                  ? "LBC"
                  : row.sale?.paymentOption === "PDC"
                  ? "PDC"
                  : row.sale?.paymentOption
              }
              size="small"
              sx={{
                bgcolor:
                  row.sale?.paymentOption === "Cash Payment"
                    ? "#27ae60"
                    : row.sale?.paymentOption === "Installment Payment"
                    ? "#FF0000"
                    : row.sale?.paymentOption === "LBC"
                    ? "#f1c40f"
                    : row.sale?.paymentOption === "PDC"
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

        {/* Payment Status */}
        <TableCell>
          {row.paymentStatus && row.paymentStatus ? (
            <Chip
              label={row.paymentStatus}
              size="small"
              sx={{
                bgcolor:
                  row.paymentStatus === "Paid"
                    ? "#27ae60"
                    : row.paymentStatus === "Partial"
                    ? "#fb8c00"
                    : row.paymentStatus === "Unpaid"
                    ? "#9e9e9e"
                    : "#e0e0e0",
                color: "#fff",
                fontWeight: 700,
              }}
            />
          ) : (
            "-"
          )}
        </TableCell>

        {/* Delivery Status */}
        <TableCell>
          {row.deliveryStatus ? (
            <Chip
              label={row.deliveryStatus}
              size="small"
              sx={{
                bgcolor:
                  row.deliveryStatus === "Processed"
                    ? "#81d4fa"
                    : row.deliveryStatus === "Picked Up"
                    ? "#ff9800"
                    : row.deliveryStatus === "Delivered"
                    ? "#4caf50"
                    : row.deliveryStatus === "Pending"
                    ? "#9e9e9e"
                    : "#e0e0e0",
                color: "#fff",
                fontWeight: 700,
              }}
            />
          ) : (
            "-"
          )}
        </TableCell>

        {/* Created On */}
        <TableCell sx={{ whiteSpace: 'nowrap' }}>
          {row.createdOn ? dayjs(row.createdOn).format('MMM D, YYYY, h:mmA') : ""}
        </TableCell>

        {/* Payment Date */}
        <TableCell sx={{ whiteSpace: 'nowrap' }}>
          {row.paymentDate ? dayjs(row.paymentDate).format('MMM D, YYYY, h:mmA') : ""}
        </TableCell>

        {/* Sale Date */}
        <TableCell sx={{ whiteSpace: 'nowrap' }}>
          {(row.sale && row.sale.saleDate) || row.saleDate
            ? dayjs(row.sale?.saleDate || row.saleDate).format('MMM D, YYYY, h:mmA')
            : ""}
        </TableCell>

        {/* Attachment */}
        <TableCell>
          {row.attachment ? (
            /\.(jpg|jpeg|png)$/i.test(row.attachment) ? (
              <img
                src={row.attachment}
                alt="Attachment"
                style={{
                  maxWidth: 60,
                  maxHeight: 40,
                  borderRadius: 4,
                  border: "1px solid #eee",
                  background: "#fafbfc",
                  cursor: "pointer",
                }}
                onClick={() => handleViewAttachment(row.attachment)}
              />
            ) : (
              "-" // unsupported attachment types
            )
          ) : (
            "-"
          )}
        </TableCell>

        {/* Due Date */}
        <TableCell sx={{ whiteSpace: 'nowrap' }}>
          {row.dueDate ? (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0 }}>
              <Chip
                label={dayjs(row.dueDate).format('MMM D, YYYY')}
                size="small"
                sx={{
                  bgcolor: "#fafbfc",
                  color: "#333",
                  fontWeight: 700,
                }}
              />
              {dueBadge}
            </Box>
          ) : (
            "-"
          )}
        </TableCell>

        {/* Actions */}
        <TableCell align="right">
          {!isChild && (
            <IconButton
              size="small"
              onClick={(e) => handleOpenActions(e, row)}
              aria-label="more-actions"
            >
              <MoreVertIcon fontSize="small" />
            </IconButton>
          )}
        </TableCell>
      </>
    );
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      {/* Backdrop loading */}
      <Backdrop open={loading} sx={{ color: "#fff", zIndex: 9999 }}>
        <CircularProgress color="inherit" />
      </Backdrop>
      {/* Delete Confirm Modal */}
      <DeleteConfirmModal
        open={deleteModalOpen}
        onClose={handleDeleteModalClose}
        onConfirm={handleDeleteConfirm}
        title="Delete Payment"
        message={
          paymentToDelete
            ? `Are you sure you want to delete payment "${paymentToDelete.referenceNo}"? This action cannot be undone.`
            : ""
        }
      />
      {/* View Attachment Modal */}
      <ViewAttachmentModal
        open={viewAttachmentOpen}
        onClose={() => setViewAttachmentOpen(false)}
        attachmentUrl={viewAttachmentUrl}
      />
      {/* Title and subtitle */}
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="flex-start"
        sx={{ mb: 3, flexDirection: { xs: "column", sm: "row" } }}
      >
        <Box>
          <Typography variant="h5" fontWeight={600}>
            Payments Monitoring
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage your payment records
          </Typography>
        </Box>
        <Box>
          <Stack direction="row" spacing={2} mt={{ xs: 2, sm: 0 }}>
            <Button
              variant="contained"
              startIcon={<RefreshIcon />}
              sx={{ bgcolor: "#95a5a6", color: "#fff", boxShadow: 0 }}
              onClick={handleRefresh}
            >
              REFRESH
            </Button>
            {/* <HasPermission module="Payments Monitoring" action="Create">
              <PrimaryButton
                startIcon={<AddCircleOutlineIcon />}
                textBtn="Add Payment"
                onClick={handleAdd}
              />
            </HasPermission> */}
          </Stack>
        </Box>
      </Stack>

      <Paper sx={{ p: 3, mb: 3, overflow: "auto" }}>
        {/* Search + Date range filter */}
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <Stack
            direction="row"
            gap={2}
            sx={{ mb: 2, flexDirection: { xs: "column", sm: "row" } }}
          >
            <form onSubmit={handleSearch} style={{ width: "100%" }}>
              <TextField
                placeholder="Search"
                size="small"
                variant="outlined"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                sx={{
                  width: { xs: "100%", sm: 300 },
                  bgcolor: "#fafbfc",
                  "& .MuiInputBase-input": { pl: 2 },
                }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      {searchInput ? (
                        <IconButton
                          size="small"
                          onClick={handleClearSearch}
                          aria-label="clear search"
                        >
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      ) : null}
                      <IconButton
                        type="submit"
                        size="small"
                        aria-label="search"
                      >
                        <SearchIcon />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </form>

            <Box
              sx={{
                display: "flex",
                gap: 2,
                flexDirection: { xs: "column", sm: "row" },
              }}
            >
              {/* Status filter dropdown placed before Date from */}
              <TextField
                select
                size="small"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(0);
                }}
                sx={{
                  width: { xs: "100%", sm: 160 },
                  bgcolor: "#fafbfc",
                  "& .MuiInputBase-root": { height: 40 },
                }}
              >
                <MenuItem value="All">All</MenuItem>
                <MenuItem value="Paid">Paid</MenuItem>
                <MenuItem value="Unpaid">Unpaid</MenuItem>
                <MenuItem value="Partial">Partial</MenuItem>
              </TextField>

              <DatePicker
                label="Date from"
                value={fromDate}
                onChange={(newVal) => {
                  setFromDate(newVal);
                  setPage(0);
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
                  setPage(0);
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
                  setPage(0);
                  fetchPayments(
                    0,
                    rowsPerPage,
                    "",
                    null,
                    null,
                    undefined,
                    undefined,
                    statusFilter
                  );
                }}
              >
                Clear
              </Button>
            </Box>
          </Stack>
        </LocalizationProvider>
        {/* Table */}
        <Box sx={{ width: "100%", overflowX: "auto" }}>
          <Table sx={{ minWidth: 1200 }}>
            <TableHead>
              <TableRow>
                {columns.map((col) => (
                  <TableCell key={col.id} sx={{ fontWeight: 700 }}>
                    {col.sortable ? (
                      <TableSortLabel
                        active={sortBy === col.id}
                        direction={sortBy === col.id ? sortDir : "asc"}
                        onClick={() => handleSort(col.id)}
                      >
                        {col.label}
                      </TableSortLabel>
                    ) : (
                      col.label
                    )}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? null : groupedRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} align="center">
                    No records found
                  </TableCell>
                </TableRow>
              ) : (
                groupedRows.map((grp) => {
                  const parent = grp.head;
                  const hasChildren = grp.children.length > 0;
                  const isOpen = !!expanded[grp.key];
                  return (
                    <React.Fragment key={grp.key}>
                      {/* Parent row */}
                      <TableRow hover>
                        {renderCells(parent, {
                          isChild: false,
                          groupKey: grp.key,
                        })}
                      </TableRow>

                      {/* Expanded children rendered as aligned rows (no separate columns/header) */}
                      {hasChildren && isOpen
                        ? grp.children.map((child: any) => (
                            <TableRow
                              key={child.id}
                              sx={{ bgcolor: "#fafbfc" }}
                            >
                              {renderCells(child, {
                                isChild: true,
                                groupKey: grp.key,
                              })}
                            </TableRow>
                          ))
                        : null}
                    </React.Fragment>
                  );
                })
              )}
            </TableBody>
          </Table>
        </Box>

        {/* Pagination */}
        <TablePagination
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={total}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={(event, newPage) => setPage(newPage)}
          onRowsPerPageChange={(event) => {
            setRowsPerPage(parseInt(event.target.value, 10));
            setPage(0);
          }}
          sx={{ borderTop: "1px solid #e0e0e0", mt: 2 }}
        />
      </Paper>

      {/* Create/Edit Payment Modal */}
      <CreatePaymentModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={fetchPayments}
        isEditMode={!!editId}
        initialValues={editInitialValues}
      />

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
                <TableCell>{customerData?.address || "-"}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>TIN</TableCell>
                <TableCell>{customerData?.tinNumber || "-"}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Phone</TableCell>
                <TableCell>{customerData?.phoneNumber || "-"}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Box>
      </Popover>

      {/* Actions menu (three-dot) */}
      <Menu
        anchorEl={actionsAnchorEl}
        open={actionsOpen}
        onClose={handleCloseActions}
        MenuListProps={{ disablePadding: true }}
      >
        <MenuItem
          onClick={() => {
            if (actionsRow) {
              const parentId =
                actionsRow.parentPaymentId === null ||
                typeof actionsRow.parentPaymentId === "undefined"
                  ? actionsRow.id
                  : actionsRow.parentPaymentId; // ensure root parent
              setEditId(null);
              setEditInitialValues({
                purchaseOrderNumber: actionsRow.purchaseOrderNumber,
                parentPaymentId: parentId
              });
              setModalOpen(true);
            }
            handleCloseActions();
          }}
        >
          <ListItemIcon>
            <AttachMoneyIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Create Payment</ListItemText>
        </MenuItem>

        <MenuItem
          onClick={() => {
            if (actionsRow) handleEdit(actionsRow);
            handleCloseActions();
          }}
        >
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit</ListItemText>
        </MenuItem>

        <MenuItem
          onClick={() => {
            if (actionsRow) handleDeleteClick(actionsRow);
            handleCloseActions();
          }}
        >
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
      </Menu>
    </Box>
  );
};

export default PaymentsMonitoring;
