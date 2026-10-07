import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Paper,
  Stack,
  Button,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TextField,
  IconButton,
  Backdrop,
  CircularProgress,
  MenuItem,
  Select,
  TablePagination,
  Chip,
  InputAdornment,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import AddWarehouseModal, {
  WarehouseFormValues,
} from "../components/AddWarehouseModal";
import DeleteConfirmModal from "../components/DeleteConfirmModal";
import axiosInstance from "../configs/axiosConfig";
import { ro } from "date-fns/locale";
import { useNotification } from "../hooks/useNotification";

const API_URL = "/warehouses";

const Warehouses: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");       // committed search
  const [searchInput, setSearchInput] = useState(""); // text field value
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const { showSuccess, showError } = useNotification();

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editWarehouse, setEditWarehouse] = useState<any | null>(null);

  // Delete confirmation state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [warehouseToDelete, setWarehouseToDelete] = useState<any | null>(null);

  // Server-side fetch (pagination + search + sorting)
  const fetchWarehouses = async (
    pageArg = page,
    perPageArg = rowsPerPage,
    searchArg = search
  ) => {
    setLoading(true);
    try {
      const res = await axiosInstance.get(API_URL, {
        params: { perPage: perPageArg, currentPage: pageArg, search: searchArg, sortBy: "id", sortDir: "DESC" },
      });
      setWarehouses(res.data?.items || []);
      setTotal(res.data?.total || 0);
    } catch (err) {
      console.error("fetchWarehouses error:", err);
      setWarehouses([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWarehouses(page, rowsPerPage, search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, rowsPerPage, search]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  const handleClearSearch = () => {
    if (!search && !searchInput) return;
    setSearchInput("");
    setSearch("");
    setPage(1);
  };

  const handleRefresh = () => {
    fetchWarehouses(page, rowsPerPage, search);
  };

  const handleAdd = () => {
    setEditWarehouse(null);
    setModalOpen(true);
  };

  const handleEdit = (warehouse: any) => {
    setEditWarehouse(warehouse);
    setModalOpen(true);
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setEditWarehouse(null);
  };

  const handleSubmit = async (values: WarehouseFormValues) => {
    setLoading(true);
    try {
      if (editWarehouse) {
        // Edit
        await axiosInstance.put(`${API_URL}/${editWarehouse.id}`, {
          ...values,
          status: values.status ? "Active" : "Inactive",
        });
        showSuccess("Warehouse updated successfully");
      } else {
        // Add
        await axiosInstance.post(API_URL, {
          ...values,
          status: values.status ? "Active" : "Inactive",
        });
        showSuccess("Warehouse created successfully");
      }
      handleModalClose();
      fetchWarehouses(page, rowsPerPage, search);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || "Failed to save warehouse";
      showError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (warehouse: any) => {
    setWarehouseToDelete(warehouse);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!warehouseToDelete) return;
    setLoading(true);
    try {
      await axiosInstance.delete(`${API_URL}/${warehouseToDelete.id}`);
      showSuccess("Warehouse deleted successfully");
      setDeleteModalOpen(false);
      setWarehouseToDelete(null);
      fetchWarehouses(page, rowsPerPage, search);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || "Failed to delete warehouse";
      showError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteModalClose = () => {
    setDeleteModalOpen(false);
    setWarehouseToDelete(null);
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      <Backdrop
        open={loading}
        sx={{ color: "#fff", zIndex: (theme) => theme.zIndex.drawer + 1 }}
      >
        <CircularProgress color="inherit" />
      </Backdrop>
      <AddWarehouseModal
        open={modalOpen}
        onClose={handleModalClose}
        onSubmit={handleSubmit}
        isEdit={!!editWarehouse}
        initialValues={
          editWarehouse
            ? {
                name: editWarehouse.name || "",
                contactPerson: editWarehouse.contactPerson || "",
                contactEmail: editWarehouse.contactEmail || "",
                contactPhone: editWarehouse.contactPhone || "",
                address: editWarehouse.address || "",
                status: editWarehouse.status === "Active",
              }
            : undefined
        }
      />
      <DeleteConfirmModal
        open={deleteModalOpen}
        onClose={handleDeleteModalClose}
        onConfirm={handleDeleteConfirm}
        title="Delete Warehouse"
        message={
          warehouseToDelete
            ? `Are you sure you want to delete "${warehouseToDelete.name}"? This action cannot be undone.`
            : ""
        }
      />
      <Stack
        justifyContent="space-between"
        alignItems="flex-start"
        sx={{ mb: 3, flexDirection: { xs: "column", sm: "row" } }}
      >
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Warehouses
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Manage your warehouses
          </Typography>
        </Box>
        <Box>
          <Stack sx={{justifyItems: {xs: "flex-end", sm: "flex-start"}}} direction="row" spacing={2}>
            <Button
              variant="contained"
              startIcon={<RefreshIcon />}
              sx={{ bgcolor: "#95a5a6", color: "#fff", boxShadow: 0 }}
              onClick={handleRefresh}
            >
              REFRESH
            </Button>
            <Button
              variant="contained"
              startIcon={<AddCircleOutlineIcon />}
              sx={{ bgcolor: "#f39c12", color: "#fff", boxShadow: 0 }}
              onClick={handleAdd}
            >
              ADD WAREHOUSE
            </Button>
          </Stack>
        </Box>
      </Stack>
      <Paper sx={{ p: 3, mb: 3, overflow: "auto" }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "stretch", sm: "center" }}
          spacing={2}
          sx={{ mb: 2 }}
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
                "& .MuiInputBase-input": { pl: 2 },
              }}
              InputProps={{
                endAdornment: (
                  <Box sx={{ display: "flex", alignItems: "center" }}>
                    {searchInput && (
                      <IconButton
                        size="small"
                        aria-label="Clear search"
                        sx={{ mr: 0.5 }}
                        onClick={handleClearSearch}
                      >
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    )}
                    <IconButton type="submit" size="small">
                      <SearchIcon fontSize="small" />
                    </IconButton>
                  </Box>
                ),
              }}
            />
          </form>
        </Stack>
        <Box sx={{ width: "100%", overflowX: "auto" }}>
          <Table sx={{ minWidth: 1200 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>ID</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Contact Person</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Contact Email</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Contact Phone</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Address</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Created On</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {warehouses.map((row, idx) => (
                <TableRow key={row.id}>
                  <TableCell>{row.id}</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>{row.name}</TableCell>
                  <TableCell>{row.contactPerson || "-"}</TableCell>
                  <TableCell>{row.contactEmail || "-"}</TableCell>
                  <TableCell>{row.contactPhone || "-"}</TableCell>
                  <TableCell>{row.address}</TableCell>
                  <TableCell>
                    <Chip
                      label={row.status}
                      size="small"
                      sx={{
                        bgcolor:
                          row.status?.toLowerCase() === "active"
                            ? "#d5f5e3"
                            : "#fdecea",
                        color:
                          row.status?.toLowerCase() === "active"
                            ? "#229954"
                            : "#e74c3c",
                        fontWeight: 700,
                        fontSize: 13,
                        px: 1.5,
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    {row.createdOn
                      ? new Date(row.createdOn).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "2-digit",
                        })
                      : "-"}
                  </TableCell>
                  <TableCell>
                    <IconButton
                      size="small"
                      sx={{ mr: 1 }}
                      onClick={() => handleEdit(row)}
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleDeleteClick(row)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {warehouses.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={9} align="center">
                    No records found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Box>
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
    </Box>
  );
};

export default Warehouses;
