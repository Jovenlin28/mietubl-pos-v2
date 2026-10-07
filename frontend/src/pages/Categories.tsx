import React, { useContext, useEffect, useState } from "react";
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
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  IconButton,
  Backdrop,
  CircularProgress,
  Modal,
  FormControlLabel,
  Switch,
  TablePagination,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import RefreshIcon from "@mui/icons-material/Refresh";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import SearchIcon from "@mui/icons-material/Search";
import axiosInstance from "../configs/axiosConfig";
import CategoryAddModal from "../components/CategoryAddModal/CategoryAddModal";
import { Category } from "../models/Category";
import PrimaryButton from "../shared/buttons/PrimaryButton";
import DeleteConfirmModal from "../components/DeleteConfirmModal";
import { useNotification } from "../hooks/useNotification";
import { UserContext } from "../layouts/DashboardLayout";

const Categories: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortBy, setSortBy] = useState("Latest");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [addEditModalOpen, setAddEditModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editCategory, setEditCategory] = useState<Category | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const { showSuccess, showError } = useNotification();
  const user = useContext(UserContext);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get<Category[]>("/categories");
      setTotal(res.data.length);
      setCategories(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  // Filter and paginate using actual API fields
  const filteredCategories = categories
    .filter(
      (cat) =>
        cat.name.toLowerCase().includes(search.toLowerCase()) &&
        (statusFilter === "All" ? true : cat.status === statusFilter)
    )
    .sort((a, b) => {
      if (sortBy === "Latest") {
        return (
          new Date(b.createdOn).getTime() - new Date(a.createdOn).getTime()
        );
      } else {
        return (
          new Date(a.createdOn).getTime() - new Date(b.createdOn).getTime()
        );
      }
    });

  const paginatedCategories = filteredCategories.slice(
    (page - 1) * rowsPerPage,
    page * rowsPerPage
  );

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleteLoading(true);
    try {
      await axiosInstance.delete(`/categories/${deleteId}`);
      axiosInstance.post(`/system-logs/`, {
        module: "Categories",
        action: "Delete",
        description: `${user.fullName} (${user.role}) deleted a category`,
        createdBy: user.fullName,
      });
      showSuccess("Category deleted successfully");
      setDeleteId(null);
      fetchCategories();
    } catch (error: any) {
      console.error("Error deleting category:", error);
      const msg =
        error?.response?.data?.error ||
        error?.message ||
        "Failed to delete category";
      showError(msg);
      setDeleteLoading(false);
    }
    setDeleteLoading(false);
  };

  const buttonHeight = 40; // consistent height for all header buttons

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      <Backdrop
        open={loading || deleteLoading}
        sx={{ color: "#fff", zIndex: (theme) => theme.zIndex.drawer + 1 }}
      >
        <CircularProgress color="inherit" />
      </Backdrop>
      <DeleteConfirmModal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Category"
        message="Are you sure you want to delete this category?"
      />
      <CategoryAddModal
        open={addEditModalOpen}
        onClose={(isSuccess) => {
          if (isSuccess) {
            fetchCategories();
          }
          setAddEditModalOpen(false);
        }}
        isEdit={isEditMode}
        editCategory={editCategory as Category}
      />
      <Stack
        justifyContent="space-between"
        alignItems="flex-start"
        sx={{ mb: 3, flexDirection: { xs: "column", sm: "row" } }}
      >
        <Box>
          <Typography variant="h6" fontWeight={700}>
            Category
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Manage your categories
          </Typography>
        </Box>
        <Box
          sx={{
            display: "flex",
            gap: 2,
            justifyContent: { xs: "flex-end", sm: "flex-start" },
          }}
        >
          <Button
            variant="contained"
            startIcon={<RefreshIcon />}
            sx={{ bgcolor: "#95a5a6", color: "#fff", boxShadow: 0 }}
            onClick={fetchCategories}
          >
            REFRESH
          </Button>
          <PrimaryButton
            startIcon={<AddCircleOutlineIcon />}
            onClick={() => {
              setIsEditMode(false);
              setEditCategory(null);
              setAddEditModalOpen(true);
            }}
            textBtn="Add Category"
          ></PrimaryButton>
        </Box>
      </Stack>
      <Paper elevation={0} sx={{ mt: 4, borderRadius: 2, p: 3 }}>
        {/* Filters inside table wrapper */}
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "stretch", sm: "center" }}
          spacing={2}
          sx={{ mb: 2 }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setPage(1);
            }}
            style={{ margin: 0 }}
          >
            <TextField
              placeholder="Search"
              variant="outlined"
              size="small"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{
                width: 250,
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
          {/* <Stack direction="row" spacing={2} alignItems="center">
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Status</InputLabel>
              <Select
                label="Status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <MenuItem value="All">All</MenuItem>
                <MenuItem value="Active">Active</MenuItem>
                <MenuItem value="Inactive">Inactive</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Sort By</InputLabel>
              <Select
                label="Sort By"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <MenuItem value="Latest">Sort By : Latest</MenuItem>
                <MenuItem value="Oldest">Sort By : Oldest</MenuItem>
              </Select>
            </FormControl>
          </Stack> */}
        </Stack>
        <TableContainer component={Paper} elevation={0}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Category</TableCell>
                <TableCell>Category slug</TableCell>
                <TableCell>Created On</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedCategories.map((cat) => (
                <TableRow key={cat.id}>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>
                      {cat.name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {cat.categorySlug}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {new Date(cat.createdOn).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={cat.status}
                      size="small"
                      sx={{
                        bgcolor:
                          cat.status?.toLowerCase() === "active"
                            ? "#d5f5e3"
                            : "#fdecea",
                        color:
                          cat.status?.toLowerCase() === "active"
                            ? "#229954"
                            : "#e74c3c",
                        fontWeight: 700,
                        fontSize: 13,
                        px: 1.5,
                      }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Stack
                      direction="row"
                      spacing={1}
                      justifyContent="flex-end"
                      alignItems="center"
                    >
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => {
                          setIsEditMode(true);
                          setAddEditModalOpen(true);
                          setEditCategory(cat);
                        }}
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        color="error"
                        size="small"
                        onClick={() => setDeleteId(cat.id)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
              {paginatedCategories.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={5} align="center">
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
            count={filteredCategories.length}
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

export default Categories;
