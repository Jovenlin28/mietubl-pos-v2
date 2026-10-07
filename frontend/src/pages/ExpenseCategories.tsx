import React, { useContext, useEffect, useState } from "react";
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
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import SearchIcon from "@mui/icons-material/Search";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";

import PrimaryButton from "../shared/buttons/PrimaryButton";
import DeleteConfirmModal from "../components/DeleteConfirmModal";
import AddExpenseCategoryModal from "../components/AddExpenseCategoryModal";
import axiosInstance from "../configs/axiosConfig";
import { UserContext } from "../layouts/DashboardLayout";
import HasPermission from "../components/HasPermission";

interface ExpenseCategory {
  id?: number;
  name: string;
  description?: string;
}

const ExpenseCategories: React.FC = () => {
  const [items, setItems] = useState<ExpenseCategory[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Use selectedCategory for edit; openCreate handles both create/edit dialog visibility
  const [openCreate, setOpenCreate] = useState(false);
  const [selectedCategory, setSelectedCategory] =
    useState<ExpenseCategory | null>(null);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] =
    useState<ExpenseCategory | null>(null);
  const user = useContext(UserContext);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get("/expense-categories", {
        params: {
          perPage: rowsPerPage,
          currentPage: page + 1,
          search: search.trim(),
        },
      });
      setItems(res.data.items || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
    // eslint-disable-next-line
  }, [page, rowsPerPage]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    fetchCategories();
  };

  const handleRefresh = () => {
    setSearch("");
    setPage(0);
    fetchCategories();
  };

  const handleOpenCreate = () => {
    setSelectedCategory(null);
    setOpenCreate(true);
  };

  // New: open modal in edit mode with selected category
  const handleEditClick = (cat: ExpenseCategory) => {
    setSelectedCategory(cat);
    setOpenCreate(true);
  };

  const handleDeleteClick = (cat: ExpenseCategory) => {
    setCategoryToDelete(cat);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!categoryToDelete) return;
    setLoading(true);
    try {
      await axiosInstance.delete(`/expense-categories/${categoryToDelete.id}`);
      axiosInstance.post(`/system-logs/`, {
        module: "Expense Categories",
        action: "Delete",
        description: `${user.fullName} (${user.role}) deleted an expense category`,
        createdBy: user.fullName,
      });
      setDeleteModalOpen(false);
      setCategoryToDelete(null);
      // adjust page if needed
      const newTotal = Math.max(0, total - 1);
      const maxPage = Math.max(0, Math.ceil(newTotal / rowsPerPage) - 1);
      if (page > maxPage) setPage(maxPage);
      fetchCategories();
    } catch (err) {
      // optionally show error
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteModalClose = () => {
    setDeleteModalOpen(false);
    setCategoryToDelete(null);
  };

  const handleCloseModal = () => {
    setOpenCreate(false);
    setSelectedCategory(null);
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
        title="Delete Expense Category"
        message={
          categoryToDelete
            ? `Are you sure you want to delete "${categoryToDelete.name}"? This action cannot be undone.`
            : ""
        }
      />

      {/* Header */}
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="flex-start"
        sx={{ mb: 3, flexDirection: { xs: "column", sm: "row" } }}
      >
        <Box>
          <Typography variant="h5" fontWeight={600}>
            Expense Categories
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage your expense categories
          </Typography>
        </Box>
        <Box>
          <Stack direction="row" spacing={2} mt={{ xs: 2, sm: 0 }}>
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

            <HasPermission module="Expense Categories" action="Create">
              <Button
                variant="contained"
                aria-label="Add Expense Category"
                onClick={() => handleOpenCreate()}
                sx={{
                  bgcolor: "#ffb300",
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
                  Add Expense Category
                </Box>
              </Button>
            </HasPermission>
          </Stack>
        </Box>
      </Stack>

      <Paper sx={{ p: 3, mb: 3, overflow: "auto" }}>
        {/* Search */}
        <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
          <form onSubmit={handleSearch} style={{ width: "100%" }}>
            <TextField
              placeholder="Search"
              size="small"
              variant="outlined"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{
                width: { xs: "100%", sm: 260 },
                bgcolor: "#fafbfc",
                "& .MuiInputBase-input": { pl: 2 },
              }}
              InputProps={{
                endAdornment: (
                  <IconButton type="submit" size="small">
                    <SearchIcon />
                  </IconButton>
                ),
              }}
            />
          </form>
        </Stack>

        {/* Table */}
        <Box sx={{ width: "100%", overflowX: "auto" }}>
          <Table sx={{ minWidth: 900 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>ID</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Description</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? null : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} align="center">
                    No records found
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {items.map((row, idx) => (
                    <TableRow key={row.id}>
                      <TableCell>{page * rowsPerPage + idx + 1}</TableCell>
                      <TableCell>{row.name}</TableCell>
                      <TableCell>{row.description || "-"}</TableCell>
                      <TableCell>
                        <HasPermission
                          module="Expense Categories"
                          action="Update"
                        >
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => handleEditClick(row)}
                          >
                            <EditIcon />
                          </IconButton>
                        </HasPermission>
                        <HasPermission
                          module="Expense Categories"
                          action="Delete"
                        >
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDeleteClick(row)}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </HasPermission>
                      </TableCell>
                    </TableRow>
                  ))}
                </>
              )}
            </TableBody>
          </Table>
        </Box>

        {/* Pagination */}
        <TablePagination
          component="div"
          count={total}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[5, 10, 25, 50]}
        />
      </Paper>

      {/* Add / Edit Expense Category Modal */}
      <AddExpenseCategoryModal
        open={openCreate}
        onClose={handleCloseModal}
        isEditMode={Boolean(selectedCategory)}
        initialData={selectedCategory || undefined}
        onSuccess={() => {
          handleCloseModal();
          setPage(0);
          fetchCategories();
        }}
      />
    </Box>
  );
};

export default ExpenseCategories;
