import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  IconButton,
  CircularProgress,
  Button,
  Stack,
  TextField,
  MenuItem,
  Backdrop,
  Select,
  TableContainer,
  Paper,
  TablePagination,
  Chip,
  InputAdornment,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import RefreshIcon from "@mui/icons-material/Refresh";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import SearchIcon from "@mui/icons-material/Search";
import axiosInstance from "../configs/axiosConfig";
import BrandAddModal from "../components/BrandAddModal/BrandAddModal";
import DeleteConfirmModal from "../components/DeleteConfirmModal";
import { Brand } from "../models/Brand";
import PrimaryButton from "../shared/buttons/PrimaryButton";
import { useNotification } from "../hooks/useNotification";

const Brands: React.FC = () => {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [allBrands, setAllBrands] = useState<Brand[]>([]); // full list for client-side filtering
  const [loading, setLoading] = useState(false);
  const { showSuccess, showError } = useNotification();

  // Modal states
  const [addEditModalOpen, setAddEditModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editBrand, setEditBrand] = useState<Brand | null>(null);

  // Delete modal states
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteBrandId, setDeleteBrandId] = useState<number | null>(null);

  // Filter and search states
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortBy, setSortBy] = useState("Latest");

  // Pagination states
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [total, setTotal] = useState(0);

  // Fetch all brands once; client-side filter/pagination
  const fetchBrands = async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get<{ items: Brand[]; total: number }>(
        `/brands?page=1&perPage=100000`
      );
      const list = res.data.items || [];
      setAllBrands(list);
      setPage(1);
    } catch (err) {
      console.error("fetchBrands error:", err);
      setAllBrands([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBrands();
    // eslint-disable-next-line
  }, []);

  // Derived filtered and sorted brands (based on allBrands), then paginate
  const filteredSorted = allBrands
    .filter((brand) => {
      if (statusFilter !== "All" && brand.status !== statusFilter) return false;
      if (search && !brand.name.toLowerCase().includes(search.toLowerCase()))
        return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "Latest") {
        return (
          new Date(b.createdOn || "").getTime() -
          new Date(a.createdOn || "").getTime()
        );
      }
      if (sortBy === "Oldest") {
        return (
          new Date(a.createdOn || "").getTime() -
          new Date(b.createdOn || "").getTime()
        );
      }
      if (sortBy === "A-Z") {
        return a.name.localeCompare(b.name);
      }
      if (sortBy === "Z-A") {
        return b.name.localeCompare(a.name);
      }
      return 0;
    });

  // paginated view
  const start = (page - 1) * rowsPerPage;
  const pagedBrands = filteredSorted.slice(start, start + rowsPerPage);

  // update total whenever filter changes
  useEffect(() => {
    setTotal(filteredSorted.length);
    // if current page is out of range after filter change, reset to first page
    if (page > Math.ceil(filteredSorted.length / rowsPerPage) && page > 1) {
      setPage(1);
    }
    // eslint-disable-next-line
  }, [allBrands, search, statusFilter, sortBy, rowsPerPage]);

  const handleDeleteBrand = async () => {
    if (deleteBrandId) {
      setLoading(true);
      try {
        await axiosInstance.delete(`/brands/${deleteBrandId}`);
        showSuccess("Brand deleted successfully");
        fetchBrands();
      } catch (error: any) {
        console.error("Error deleting brand:", error);
        const msg = error?.response?.data?.error || error?.message || "Failed to delete brand";
        showError(msg);
      } finally {
        setLoading(false);
        setDeleteModalOpen(false);
        setDeleteBrandId(null);
      }
    }
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      <Backdrop
        open={loading}
        sx={{ color: "#fff", zIndex: (theme) => theme.zIndex.drawer + 1 }}
      >
        <CircularProgress color="inherit" />
      </Backdrop>
      <Box
        sx={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          mb: 3,
          flexDirection: { xs: "column", sm: "row" }
        }}
      >
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Brands
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Manage your brands
          </Typography>
        </Box>
        <Box
          sx={{
            display: "flex",
            gap: 2,
          }}
        >
          <Button
            variant="contained"
            startIcon={<RefreshIcon />}
            sx={{ bgcolor: "#95a5a6", color: "#fff", boxShadow: 0 }}
            onClick={fetchBrands}
          >
            REFRESH
          </Button>
          <PrimaryButton
            startIcon={<AddCircleOutlineIcon />}
            onClick={() => {
              setIsEditMode(false);
              setEditBrand(null);
              setAddEditModalOpen(true);
            }}
            textBtn="Add Brand"
          ></PrimaryButton>
        </Box>
      </Box>
      <Paper elevation={0} sx={{ borderRadius: 2, p: 3 }}>
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
              size="small"
              variant="outlined"
              sx={{
                width: 260,
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
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </form>
          {/* Optionally you can re-enable status/sort filters here */}
          {/* <Stack direction="row" spacing={2} alignItems="center">
            <TextField
              select
              label="Status"
              size="small"
              value={statusFilter}
              sx={{ minWidth: 120 }}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
            >
              <MenuItem value="All">All</MenuItem>
              <MenuItem value="Active">Active</MenuItem>
              <MenuItem value="Inactive">Inactive</MenuItem>
            </TextField>
            <TextField
              select
              label="Sort By"
              size="small"
              value={sortBy}
              sx={{ minWidth: 160 }}
              onChange={(e) => {
                setSortBy(e.target.value);
                setPage(1);
              }}
            >
              <MenuItem value="Latest">Sort By : Latest</MenuItem>
              <MenuItem value="Oldest">Sort By : Oldest</MenuItem>
              <MenuItem value="A-Z">Sort By : A-Z</MenuItem>
              <MenuItem value="Z-A">Sort By : Z-A</MenuItem>
            </TextField>
          </Stack> */}
        </Stack>
        <TableContainer component={Paper} elevation={0}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Brand Name</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Created On</TableCell>
                <TableCell align="center" sx={{ width: 120 }}>
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pagedBrands.map((brand) => (
                <TableRow key={brand.id}>
                  <TableCell>{brand.name}</TableCell>
                  <TableCell>
                    <Chip
                      label={brand.status}
                      size="small"
                      sx={{
                        bgcolor:
                          brand.status?.toLowerCase() === "active"
                            ? "#d5f5e3"
                            : "#fdecea",
                        color:
                          brand.status?.toLowerCase() === "active"
                            ? "#229954"
                            : "#e74c3c",
                        fontWeight: 700,
                        fontSize: 13,
                        px: 1.5,
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    {brand.createdOn
                      ? new Date(brand.createdOn).toLocaleDateString()
                      : ""}
                  </TableCell>
                  <TableCell align="center">
                    <Stack direction="row" spacing={1} justifyContent="center">
                      <IconButton
                        size="small"
                        color="primary"
                        sx={{ p: 0.5 }}
                        onClick={() => {
                          setIsEditMode(true);
                          setEditBrand(brand);
                          setAddEditModalOpen(true);
                        }}
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        sx={{ p: 0.5 }}
                        onClick={() => {
                          setDeleteBrandId(brand.id);
                          setDeleteModalOpen(true);
                        }}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
              {pagedBrands.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={4} align="center">
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
      <BrandAddModal
        open={addEditModalOpen}
        onClose={(isSuccess) => {
          if (isSuccess) {
            fetchBrands();
          }
          setAddEditModalOpen(false);
        }}
        isEdit={isEditMode}
        editBrand={editBrand as Partial<Brand>}
      />
      <DeleteConfirmModal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDeleteBrand}
        title="Delete Brand"
        message="Are you sure you want to delete this brand?"
      />
    </Box>
  );
};

export default Brands;
