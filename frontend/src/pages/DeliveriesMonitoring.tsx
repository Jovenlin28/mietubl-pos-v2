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
  Collapse,
  Backdrop,
  Chip,
  TableSortLabel,
  InputAdornment,
  TableContainer,
  MenuItem,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import SearchIcon from "@mui/icons-material/Search";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import CloseIcon from "@mui/icons-material/Close";
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import PrimaryButton from "../shared/buttons/PrimaryButton";
import axiosInstance from "../configs/axiosConfig";
import AddDelivery from "../components/AddDelivery";
import DeleteConfirmModal from "../components/DeleteConfirmModal";
import Tooltip from '@mui/material/Tooltip';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ViewDeliverySummaryModal from '../components/ViewDeliverySummaryModal';
import ViewAttachmentModal from '../components/ViewAttachmentModal';
// Datepicker imports
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import dayjs from "dayjs";
import HasPermission from "../components/HasPermission";
import { useNotification } from "../hooks/useNotification";

const DeliveriesMonitoring: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  // local input for search — only apply when user submits (Enter or clicking search)
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  // Date range filters
  const [fromDate, setFromDate] = useState<Date | null>(null);
  const [toDate, setToDate] = useState<Date | null>(null);
  // status filter for deliveries list; default "All"
  const [statusFilter, setStatusFilter] = useState<string>("All");

  // Add / Edit modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalEditMode, setModalEditMode] = useState(false);
  const [modalInitialValues, setModalInitialValues] = useState<any | undefined>(
    undefined
  );

  const { showSuccess, showError } = useNotification();

  // Sorting state (server-side). Default to createdOn desc
  const [sortBy, setSortBy] = useState<string>("createdOn");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const formatDateParam = (d: Date | null) =>
    d ? d.toISOString().slice(0, 10) : "";

  // fetch deliveries with optional date filters (page is 0-based)
  const fetchDeliveries = async (
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
      const st = typeof statusParam !== "undefined" ? statusParam : statusFilter;
      params.status = st === "All" ? "" : st;
 
      const res = await axiosInstance.get("/deliveries", { params });
      setItems(res.data.items || []);
      setTotal(res.data.total || 0);
      setPage(pageNum);
    } catch (err) {
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };
 
  useEffect(() => {
    // initial / reactive fetch — search is only applied when user submits
    fetchDeliveries(page, rowsPerPage, search, fromDate, toDate, sortBy, sortDir, statusFilter);
    // eslint-disable-next-line
  }, [page, rowsPerPage, fromDate, toDate, sortBy, sortDir, statusFilter]);

  // Server-side sorting: request server with sort params
  const handleSort = (columnId: string) => {
    let newDir: "asc" | "desc" = "asc";
    if (sortBy === columnId) newDir = sortDir === "asc" ? "desc" : "asc";
    setSortBy(columnId);
    setSortDir(newDir);
    setPage(0); // reset to first page
  };

  // Search handlers (only trigger server request on submit or clicking search icon)
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const term = (searchInput || "").trim();
    setSearch(term);
    setPage(0);
    fetchDeliveries(0, rowsPerPage, term, fromDate, toDate, sortBy, sortDir);
  };

  const handleClearSearch = () => {
    setSearchInput("");
    setSearch("");
    setPage(0);
    fetchDeliveries(0, rowsPerPage, "", fromDate, toDate, sortBy, sortDir);
  };

  // If user clears the input manually, reset applied search and reload list
  useEffect(() => {
    if ((searchInput || "").trim() === "" && (search || "") !== "") {
      setSearch("");
      setPage(0);
      fetchDeliveries(0, rowsPerPage, "", fromDate, toDate, sortBy, sortDir);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const handleRefresh = () => {
    setSearch("");
    setSearchInput("");
    setFromDate(null);
    setToDate(null);
    setPage(0);
    fetchDeliveries(0, rowsPerPage, "", null, null);
  };

  const handleAdd = () => {
    setModalEditMode(false);
    setModalInitialValues(undefined);
    setModalOpen(true);
  };

  const handleEdit = (item: any) => {
    setModalEditMode(true);
    // map item to the form initial values expected by AddDelivery
    setModalInitialValues(item);
    setModalOpen(true);
  };

  const handleDelete = (item: any) => {
    // open delete confirmation modal
    setDeleteTarget(item);
    setDeleteModalOpen(true);
  };

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setLoading(true);
      await axiosInstance.delete(`/deliveries/${deleteTarget.id}`);
      showSuccess("Delivery deleted successfully");
      // refresh list
      fetchDeliveries(
        page,
        rowsPerPage,
        search,
        fromDate,
        toDate,
        sortBy,
        sortDir
      );
    } catch (err: any) {
      console.error("Failed to delete delivery", err);
      const msg = err?.response?.data?.error || err?.message || "Failed to delete delivery";
      showError(msg);
    } finally {
      setLoading(false);
      setDeleteModalOpen(false);
      setDeleteTarget(null);
    }
  };

  // Get status chip color based on status value
  const getStatusChipColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "pending":
        return {
          backgroundColor: "#9e9e9e", // gray
          color: "#fff",
        };
      case "processed":
        return {
          backgroundColor: "#81d4fa", // light blue
          color: "#fff",
        };
      case "picked up":
        return {
          backgroundColor: "#ff9800", // orange
          color: "#fff",
        };
      case "delivered":
        return {
          backgroundColor: "#4caf50", // green
          color: "#fff",
        };
      default:
        return {
          backgroundColor: "#f5f5f5", // default gray
          color: "#333",
        };
    }
  };

  // Columns definition for the table
  const columns = [
    { id: "purchaseOrderNumber", label: "PO Number", sortable: true },
    { id: "customer", label: "Customer", sortable: true },
    { id: "storeName", label: "Store Name", sortable: true },
    { id: "address", label: "Address", sortable: true },
    { id: "status", label: "Status", sortable: true },
    { id: "method", label: "Method", sortable: true },
    { id: "dateProcessed", label: "Date Processed", sortable: true },
    { id: "datePickedUp", label: "Date Picked Up", sortable: true },
    { id: "dateDelivered", label: "Date Delivered", sortable: true },
    { id: "attachments", label: "Attachments", sortable: false },
    { id: "trackingNumber", label: "Tracking Number", sortable: true },
    { id: "createdOn", label: "Created On", sortable: true },
    { id: "actions", label: "Actions", sortable: false },
  ];

  // track which rows are expanded to show attachments
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const toggleRow = (id: any) => {
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // State for view delivery summary modal
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [viewModalData, setViewModalData] = useState<any | null>(null);

  // State for viewing a single attachment
  const [attachmentModalOpen, setAttachmentModalOpen] = useState(false);
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);

  function openViewModal(row: any): void {
    setViewModalData(row);
    setViewModalOpen(true);
  }

  function openAttachment(url: string | undefined | null) {
    if (!url) return;
    setAttachmentUrl(url);
    setAttachmentModalOpen(true);
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      <AddDelivery
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        isEditMode={modalEditMode}
        initialValues={modalInitialValues}
        onSuccess={() => {
          // refresh list after add/edit
          fetchDeliveries(
            page,
            rowsPerPage,
            search,
            fromDate,
            toDate,
            sortBy,
            sortDir
          );
          setModalOpen(false);
        }}
      />
      <ViewDeliverySummaryModal
        open={viewModalOpen}
        onClose={() => setViewModalOpen(false)}
        delivery={viewModalData}
      />
      <ViewAttachmentModal
        open={attachmentModalOpen}
        onClose={() => {
          setAttachmentModalOpen(false);
          setAttachmentUrl(null);
        }}
        attachmentUrl={attachmentUrl as string}
      />
      <DeleteConfirmModal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Delete Delivery"
        message={
          deleteTarget
            ? `Are you sure you want to delete delivery ${
                deleteTarget.purchaseOrderNumber || deleteTarget.id
              }?`
            : "Are you sure you want to delete the selected delivery?"
        }
      />
      {/* Backdrop loading */}
      <Backdrop open={loading} sx={{ color: "#fff", zIndex: 9999 }}>
        <CircularProgress color="inherit" />
      </Backdrop>

      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="flex-start"
        sx={{ mb: 3, flexDirection: { xs: "column", sm: "row" } }}
      >
        <Box>
          <Typography variant="h5" fontWeight={600}>
            Deliveries Monitoring
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage your delivery records
          </Typography>
        </Box>

        <Box>
          <Stack direction="row" spacing={2} mt={{ xs: 2, sm: 0 }}>
            <Button
              variant="contained"
              size="small"
              startIcon={<RefreshIcon />}
              sx={{
                bgcolor: "#95a5a6",
                color: "#fff",
                boxShadow: 0,
                height: 40,
              }}
              onClick={handleRefresh}
            >
              REFRESH
            </Button>
            {/* <HasPermission module="Deliveries Monitoring" action="Create">
              <PrimaryButton
                startIcon={<AddCircleOutlineIcon />}
                textBtn="Add Delivery"
                onClick={handleAdd}
              />
            </HasPermission> */}
          </Stack>
        </Box>
      </Stack>

      <Paper sx={{ p: 3, mb: 3, overflow: "auto" }}>
        {/* Filters and Controls */}
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
                sx={{ width: { xs: "100%", sm: 300 }, bgcolor: "#fafbfc" }}
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
                      <IconButton type="submit" size="small" aria-label="search">
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
              {/* Status filter dropdown placed before From date */}
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
                <MenuItem value="Pending">Pending</MenuItem>
                <MenuItem value="Processed">Processed</MenuItem>
                <MenuItem value="Picked Up">Picked Up</MenuItem>
                <MenuItem value="Delivered">Delivered</MenuItem>
              </TextField>
              <DatePicker
                label="From"
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
                label="To"
                value={toDate}
                onChange={(newVal) => {
                  setToDate(newVal);
                  setPage(0);
                }}
                slotProps={{
                  textField: {
                    size: "small",
                    placeholder: "To",
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
                  setSearchInput("");
                  setPage(0);
                }}
              >
                Clear
              </Button>
            </Box>
          </Stack>
        </LocalizationProvider>

        {/* Table */}
        <TableContainer>
          <Table>
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
              {loading ? null : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} align="center">
                    No records found
                  </TableCell>
                </TableRow>
              ) : (
                items.map((row) => (
                  <React.Fragment key={row.id}>
                  <TableRow hover>
                    <TableCell>{row.purchaseOrderNumber || "-"}</TableCell>
                    <TableCell>{row.customer?.fullName || '-'}</TableCell>
                    <TableCell>{row.customer?.storeName || '-'}</TableCell>
                    <TableCell>{row.customer?.address || '-'}</TableCell>
                    <TableCell>
                      <Chip
                        label={row.status || "-"}
                        size="small"
                        sx={{
                          ...getStatusChipColor(row.status),
                          fontWeight: 700,
                        }}
                      />
                    </TableCell>
                    <TableCell>{row.method || "-"}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {row.processedDate
                        ? dayjs(row.processedDate).format('MMM D, YYYY, h:mmA')
                        : "-"}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {row.pickedUpDate
                        ? dayjs(row.pickedUpDate).format('MMM D, YYYY, h:mmA')
                        : "-"}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {row.deliveredDate
                        ? dayjs(row.deliveredDate).format('MMM D, YYYY, h:mmA')
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" alignItems="center">
                        <Button
                          sx={{ textAlign: "left" }}
                          size="small"
                          onClick={() => toggleRow(row.id)}
                          endIcon={
                            expandedRows[row.id] ? (
                              <KeyboardArrowUpIcon fontSize="small" />
                            ) : (
                              <KeyboardArrowDownIcon fontSize="small" />
                            )
                          }
                        >
                          View attachments
                        </Button>
                      </Stack>
                    </TableCell>
                    <TableCell>{row.trackingNumber || "-"}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {row.createdOn
                        ? dayjs(row.createdOn).format('MMM D, YYYY, h:mmA')
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1}>
                        <HasPermission module="Deliveries Monitoring" action="View">
                          <Tooltip title="View Delivery Summary">
                            <IconButton
                              size="small"
                              onClick={() => openViewModal(row)}
                              color="primary"
                            >
                              <VisibilityIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </HasPermission>
                        <HasPermission module="Deliveries Monitoring" action="Update">
                          <Tooltip title="Edit Delivery">
                            <IconButton
                              size="small"
                              onClick={() => handleEdit(row)}
                              color="primary"
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </HasPermission>
                        <HasPermission module="Deliveries Monitoring" action="Delete">
                          <Tooltip title="Delete Delivery">
                            <IconButton
                              size="small"
                              onClick={() => handleDelete(row)}
                              color="error"
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </HasPermission>
                      </Stack>
                    </TableCell>
                  </TableRow>

                  {/* Expanded row for attachments */}
                  <TableRow>
                    <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={columns.length}>
                      <Collapse in={!!expandedRows[row.id]} timeout="auto" unmountOnExit>
                        <Box sx={{ margin: 1 }}>
                          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                            { [
                                { label: 'Processed', src: row.processedAttachment },
                                { label: 'Picked Up', src: row.pickedUpAttachment },
                                { label: 'Delivered', src: row.deliveredAttachment },
                              ].filter(a => a.src)
                              .length > 0 ? (
                                [
                                  { label: 'Processed', src: row.processedAttachment },
                                  { label: 'Picked Up', src: row.pickedUpAttachment },
                                  { label: 'Delivered', src: row.deliveredAttachment },
                                ].filter(a => a.src).map((a) => (
                                  <Box key={a.label} sx={{ textAlign: 'center' }}>
                                    <Typography variant="subtitle2" sx={{ mb: 1 }}>{a.label}</Typography>
                                    <Box
                                      component="img"
                                      src={a.src}
                                      alt={a.label}
                                      onClick={() => openAttachment(a.src)}
                                      sx={{ maxWidth: 200, maxHeight: 160, display: 'block', borderRadius: 2, objectFit: 'cover', cursor: 'pointer' }}
                                    />
                                  </Box>
                                ))
                              ) : (
                                <Typography variant="body2" color="text.secondary">No attachments available</Typography>
                              )
                            }
                          </Stack>
                        </Box>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                  </React.Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Pagination */}
        <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 2 }}>
          <TablePagination
            component="div"
            count={total}
            page={page}
            onPageChange={(_, newPage) => setPage(newPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(Number(e.target.value));
              setPage(0);
            }}
            rowsPerPageOptions={[10, 20, 50]}
            labelRowsPerPage="Rows per page:"
          />
        </Box>
      </Paper>
    </Box>
  );
};

export default DeliveriesMonitoring;
