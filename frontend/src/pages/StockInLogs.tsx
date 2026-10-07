import React, { useEffect, useState } from "react";
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
  Select,
  MenuItem,
  TextField,
  Backdrop,
  CircularProgress,
  IconButton,
  TableContainer,
  TablePagination,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from "@mui/material";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import RefreshIcon from "@mui/icons-material/Refresh";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import SearchIcon from "@mui/icons-material/Search";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import CloseIcon from "@mui/icons-material/Close";
import axiosInstance from "../configs/axiosConfig";
import StockInModal from "../components/StockInModal"; // Import the modal
import PrimaryButton from "../shared/buttons/PrimaryButton";
import HasPermission from "../components/HasPermission";
import { useNotification } from "../hooks/useNotification";
import DeleteConfirmModal from "../components/DeleteConfirmModal";

interface StockInLog {
  id: number;
  stock_in_date: string;
  product_id: number;
  product_name: string;
  stocks_added: number;
  status: string;
  notes: string;
  createdBy?: string;
}

const statusColors: Record<string, string> = {
  Completed: "#27ae60",
  "In Process": "#f4d03f",
};

const ROWS_PER_PAGE_OPTIONS = [10, 20, 50];

const StockInLogs: React.FC = () => {
  const [logs, setLogs] = useState<StockInLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");        // committed search used for API
  const [searchInput, setSearchInput] = useState(""); // text field value (uncommitted)
  const [page, setPage] = useState(1);             // 1-based for API
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [total, setTotal] = useState(0);
  const [statusUpdatingId, setStatusUpdatingId] = useState<number | null>(null);
  const { showSuccess, showError } = useNotification();

  // Confirm dialog state for completing status
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<{
    id: number;
    newStatus: string;
  } | null>(null);

  // Modal state
  const [openModal, setOpenModal] = useState(false);
  const [editRecord, setEditRecord] = useState<StockInLog | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<StockInLog | null>(null);

  // Server-side fetch (pagination + search)
  const fetchLogs = async (
    pageArg = page,
    perPageArg = rowsPerPage,
    searchArg = search
  ) => {
    setLoading(true);
    try {
      const res = await axiosInstance.get<{
        items: StockInLog[];
        total?: number;
      }>(`/stock-in-log`, {
        params: {
          perPage: perPageArg,
            currentPage: pageArg,
          search: searchArg,
          sortBy: "stock_in_date",
          sortDir: "DESC",
        },
      });
      setLogs(res.data?.items || []);
      setTotal(res.data?.total || 0);
    } catch (err) {
      console.error("fetchLogs error:", err);
      setLogs([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  // Initial + reactive fetch
  useEffect(() => {
    fetchLogs(page, rowsPerPage, search);
    // eslint-disable-next-line
  }, [page, rowsPerPage, search]);
  
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  const handleClearSearch = () => {
    if (!searchInput && !search) return;
    setSearchInput("");
    setSearch("");
    setPage(1);
    fetchLogs(1, rowsPerPage, "");
  };

  const pageCount = Math.ceil(total / rowsPerPage); // (unused but kept if needed)

  const inProcessCount = logs.filter(
    (log) => log.status === "In Process"
  ).length;
  const completedCount = logs.filter(
    (log) => log.status === "Completed"
  ).length;

  // Handler for status change
  const handleStatusChange = async (id: number, newStatus: string) => {
    setStatusUpdatingId(id);
    try {
      await axiosInstance.put(`/stock-in-log/${id}/status`, {
        status: newStatus,
      });
      showSuccess("Status updated successfully");
      fetchLogs(page, rowsPerPage, search);
    } catch (err: any) {
      console.error("handleStatusChange error:", err);
      const msg = err?.response?.data?.error || err?.message || "Failed to update status";
      showError(msg);
    } finally {
      setStatusUpdatingId(null);
    }
  };

  // Intercept selection change to show confirmation when completing status
  const handleStatusSelectChange = (row: StockInLog, newStatus: string) => {
    if (row.status === "Completed") return; // already completed, nothing to do
    if (newStatus === "Completed" && row.status !== "Completed") {
      // show confirmation dialog
      setConfirmTarget({ id: row.id, newStatus });
      setConfirmOpen(true);
      return;
    }
    // do immediate update for other statuses
    handleStatusChange(row.id, newStatus);
  };

  const handleConfirmComplete = async () => {
    if (!confirmTarget) {
      setConfirmOpen(false);
      return;
    }
    setConfirmOpen(false);
    await handleStatusChange(confirmTarget.id, confirmTarget.newStatus);
    setConfirmTarget(null);
  };

  const handleCancelComplete = () => {
    setConfirmOpen(false);
    setConfirmTarget(null);
  };

  // Open modal handler
  const handleOpenModal = () => {
    setEditRecord(null);
    setOpenModal(true);
  };
  const handleEditClick = (row: StockInLog) => {
    setEditRecord(row);
    setOpenModal(true);
  };
  const handleDeleteClick = (row: StockInLog) => {
    setDeleteTarget(row);
    setDeleteOpen(true);
  };
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      setLoading(true);
      await axiosInstance.delete(`/stock-in-log/${deleteTarget.id}`);
      // Delete logic: refresh after delete
      fetchLogs(page, rowsPerPage, search);
      setDeleteOpen(false);
      setDeleteTarget(null);
      showSuccess("Record deleted successfully");
    } catch (err: any) {
      const msg =
        err?.response?.data?.error || err?.message || "Delete failed";
      showError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      <Backdrop
        open={loading || statusUpdatingId !== null}
        sx={{ color: "#fff", zIndex: (theme) => theme.zIndex.drawer + 1 }}
      >
        <CircularProgress color="inherit" />
      </Backdrop>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="flex-start"
        sx={{ mb: 3, flexDirection: { xs: "column", sm: "row" } }}
      >
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Stock-In Logs
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Track all stock-in activities
          </Typography>
        </Box>
        <Box>
          <Stack direction="row" spacing={2}>
            <Button
              variant="contained"
              startIcon={<RefreshIcon />}
              sx={{ bgcolor: "#95a5a6", color: "#fff", boxShadow: 0 }}
              onClick={() => fetchLogs(page, rowsPerPage, search)}
            >
              REFRESH
            </Button>
            <HasPermission module="Stock In Logs" action="Create">
              <PrimaryButton
                startIcon={<AddCircleOutlineIcon />}
                onClick={handleOpenModal}
                textBtn="Stock In"
              ></PrimaryButton>
            </HasPermission>
          </Stack>
        </Box>
      </Stack>

      {/* Widgets container (moved out to its own white box like SalesListing) */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <Box
            sx={{
              flex: 1,
              borderRadius: 2,
              p: 2,
              textAlign: "center",
              bgcolor: "#fff",
              border: "1px solid #eee",
            }}
          >
            <Typography fontWeight={600}>Stocks Added Today</Typography>
            <Typography sx={{ mt: 1, fontWeight: 700, fontSize: 18 }}>
              0.00
            </Typography>
          </Box>

          <Box
            sx={{
              flex: 1,
              borderRadius: 2,
              p: 2,
              textAlign: "center",
              bgcolor: "#fdf2c0",
              border: "1px solid #f4d03f",
            }}
          >
            <Typography fontWeight={600} color="#b7950b">
              In Process
            </Typography>
            <Typography fontWeight={700} fontSize={22}>
              {inProcessCount}
            </Typography>
          </Box>

          <Box
            sx={{
              flex: 1,
              borderRadius: 2,
              p: 2,
              textAlign: "center",
              bgcolor: "#d5f5e3",
              border: "1px solid #27ae60",
            }}
          >
            <Typography fontWeight={600} color="#229954">
              Completed
            </Typography>
            <Typography fontWeight={700} fontSize={22}>
              {completedCount}
            </Typography>
          </Box>
        </Stack>
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        {/* Filters inside table wrapper */}
        <Stack
          sx={{ mb: 3, flexDirection: { xs: "column", sm: "row" } }}
          justifyContent="space-between"
          alignItems={{ xs: "stretch", sm: "center" }}
          spacing={2}
        >
          <form onSubmit={handleSearchSubmit} style={{ margin: 0 }}>
            <TextField
              placeholder="Search"
              size="small"
              variant="outlined"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              sx={{
                width: 260,
                bgcolor: "#fafbfc",
                "& .MuiInputBase-input": { pl: 2, py: "10px" },
              }}
              InputProps={{
                endAdornment: (
                 <Box sx={{ display: "flex", alignItems: "center" }}>
                   {searchInput && (
                     <IconButton
                       size="small"
                       sx={{ mr: 0.5 }}
                       aria-label="Clear search"
                       onClick={handleClearSearch}
                     >
                       <CloseIcon fontSize="small" />
                     </IconButton>
                   )}
                   <IconButton
                     type="submit"
                     size="small"
                     sx={{ mr: 0.5 }}
                     aria-label="Search"
                   >
                     <SearchIcon fontSize="small" />
                   </IconButton>
                 </Box>
                ),
              }}
            />
          </form>
        </Stack>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>ID</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Stock-In Date</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Product Name</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Created By</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Stocks Added</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Notes</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {logs.map((row, idx) => (
                <TableRow key={row.id}>
                  <TableCell>{row.id}</TableCell>
                  <TableCell>
                    {row.stock_in_date
                      ? new Date(row.stock_in_date).toLocaleDateString(
                          "en-GB",
                          {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            weekday: "short",
                          }
                        )
                      : ""}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>
                    {row.product_name}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>
                    {row.createdBy || "-"}
                  </TableCell>
                  <TableCell sx={{ color: "#c0392b", fontWeight: 600 }}>
                    {row.stocks_added?.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}
                  </TableCell>
                  <TableCell>
                    <Select
                      size="small"
                      value={row.status}
                      sx={{
                        fontWeight: 700,
                        borderRadius: 1,
                        fontSize: 14,
                        minWidth: 120,
                        "& .MuiSelect-icon": { color: "#333" },
                        bgcolor:
                          row.status === "Completed" ? "#d5f5e3" : "#fdf2c0",
                        color:
                          row.status === "Completed" ? "#229954" : "#b7950b",
                        border:
                          row.status === "Completed"
                            ? "1px solid #27ae60"
                            : "1px solid #f4d03f",
                        transition: "background 0.2s",
                      }}
                      // disable when already completed or when updating
                      disabled={
                        statusUpdatingId === row.id ||
                        row.status === "Completed"
                      }
                      onChange={(e) =>
                        handleStatusSelectChange(row, e.target.value as string)
                      }
                    >
                      <MenuItem
                        value="In Process"
                        sx={{
                          bgcolor: "#fdf2c0",
                          color: "#b7950b",
                          fontWeight: 700,
                        }}
                      >
                        In Process
                      </MenuItem>
                      <MenuItem
                        value="Completed"
                        sx={{
                          bgcolor: "#d5f5e3",
                          color: "#229954",
                          fontWeight: 700,
                        }}
                      >
                        Completed
                      </MenuItem>
                    </Select>
                  </TableCell>
                  <TableCell>{row.notes}</TableCell>
                  <TableCell>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                      <IconButton
                        size="small"
                        onClick={() => handleEditClick(row)}
                        sx={{
                          color: "#1976d2",
                          "&:hover": { backgroundColor: "rgba(25,118,210,0.08)" },
                        }}
                        aria-label="Edit"
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDeleteClick(row)}
                        aria-label="Delete"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
              {logs.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    No records found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        {/* Replace custom pagination with TablePagination */}
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

      {/* Confirm dialog for completing status */}
      <Dialog open={confirmOpen} onClose={handleCancelComplete}>
        <DialogTitle>Confirm Complete</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to complete the status? This cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelComplete}>Cancel</Button>
          <Button
            onClick={handleConfirmComplete}
            variant="contained"
            color="primary"
            disabled={statusUpdatingId === confirmTarget?.id}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      {/* Stock In Modal */}
      <StockInModal
        open={openModal}
        onClose={() => {
          setOpenModal(false);
          setEditRecord(null);
        }}
        onSuccess={() => fetchLogs(page, rowsPerPage, search)}
        isEditMode={!!editRecord}
        editStockIn={
          editRecord
            ? {
                product_id: editRecord.product_id,
                stocks_added: editRecord.stocks_added,
                status: editRecord.status,
                notes: editRecord.notes,
              }
            : undefined
        }
      />
      <DeleteConfirmModal
        open={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
          setDeleteTarget(null);
        }}
        onConfirm={handleDeleteConfirm}
        title="Delete Stock-In Log"
        message={
          deleteTarget
            ? `Are you sure you want to delete stock-in log #${deleteTarget.id}? This action cannot be undone.`
            : ""
        }
      />
    </Box>
  );
};

export default StockInLogs;
