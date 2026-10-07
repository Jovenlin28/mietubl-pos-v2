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
  TablePagination,
  Chip,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import axios from "axios";
import AddStoreModal, { StoreFormValues } from "../components/AddStoreModal";
import DeleteConfirmModal from "../components/DeleteConfirmModal";
import axiosInstance from "../configs/axiosConfig";
import { useNotification } from "../hooks/useNotification";

const Stores: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [stores, setStores] = useState<any[]>([]);
  const [total, setTotal] = useState(0);

  // Server-side search states (search is committed, searchInput is field text)
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);          // 1-based for API
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const { showSuccess, showError } = useNotification();

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editStore, setEditStore] = useState<any | null>(null);

  // Delete confirmation state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [storeToDelete, setStoreToDelete] = useState<any | null>(null);

  const fetchStores = async (
    pageArg = page,
    perPageArg = rowsPerPage,
    searchArg = search
  ) => {
    setLoading(true);
    try {
      const res = await axiosInstance.get("/stores", {
        params: {
          perPage: perPageArg,
          currentPage: pageArg,
          search: searchArg,
          sortBy: "id",
          sortDir: "DESC",
        },
      });
      setStores(res.data?.items || []);
      setTotal(res.data?.total || 0);
    } catch (err) {
      console.error("fetchStores error:", err);
      setStores([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStores(page, rowsPerPage, search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, rowsPerPage, search]);

  const handleRefresh = () => {
    fetchStores(page, rowsPerPage, search);
  };

  const handleAdd = () => {
    setEditStore(null);
    setModalOpen(true);
  };

  const handleEdit = (store: any) => {
    setEditStore(store);
    setModalOpen(true);
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setEditStore(null);
  };

  const handleSubmit = async (values: StoreFormValues) => {
    setLoading(true);
    try {
      if (editStore) {
        await axiosInstance.put(`/stores/${editStore.id}`, {
          ...values,
          status: values.status ? "Active" : "Inactive",
        });
        showSuccess("Store updated successfully");
      } else {
        await axiosInstance.post("/stores", {
          ...values,
          status: values.status ? "Active" : "Inactive",
        });
        showSuccess("Store created successfully");
      }
      handleModalClose();
      fetchStores(page, rowsPerPage, search);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || "Failed to save store";
      showError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (store: any) => {
    setStoreToDelete(store);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!storeToDelete) return;
    setLoading(true);
    try {
      await axiosInstance.delete(`/stores/${storeToDelete.id}`);
      showSuccess("Store deleted successfully");
      setDeleteModalOpen(false);
      setStoreToDelete(null);
      fetchStores(page, rowsPerPage, search);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || "Failed to delete store";
      showError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteModalClose = () => {
    setDeleteModalOpen(false);
    setStoreToDelete(null);
  };

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

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      <Backdrop
        open={loading}
        sx={{ color: "#fff", zIndex: (theme) => theme.zIndex.drawer + 1 }}
      >
        <CircularProgress color="inherit" />
      </Backdrop>
      <AddStoreModal
        open={modalOpen}
        onClose={handleModalClose}
        onSubmit={handleSubmit}
        isEdit={!!editStore}
        initialValues={
          editStore
            ? {
                name: editStore.name || "",
                address: editStore.address || "",
                phoneNumber: editStore.phoneNumber || "",
                status: "Active",
              }
            : undefined
        }
      />
      <DeleteConfirmModal
        open={deleteModalOpen}
        onClose={handleDeleteModalClose}
        onConfirm={handleDeleteConfirm}
        title="Delete Store"
        message={
          storeToDelete
            ? `Are you sure you want to delete "${storeToDelete.name}"? This action cannot be undone.`
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
            Stores
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Manage your stores
          </Typography>
        </Box>
        <Box>
          <Stack direction="row" spacing={2}>
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
              ADD STORE
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
                    <IconButton type="submit" size="small" sx={{ mr: 0.5 }}>
                      <SearchIcon />
                    </IconButton>
                  </Box>
                ),
              }}
            />
          </form>
        </Stack>
        <Box sx={{ width: "100%", overflowX: "auto" }}>
          <Table sx={{ minWidth: 900 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>ID</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Address</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Phone Number</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Created On</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {stores.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.id}</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>{row.name}</TableCell>
                  <TableCell>{row.address}</TableCell>
                  <TableCell>{row.phoneNumber || "-"}</TableCell>
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
              {stores.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={7} align="center">
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

export default Stores;
