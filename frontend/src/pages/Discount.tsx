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
  IconButton,
  Backdrop,
  Tooltip,
  InputAdornment, // added
  TableSortLabel, // added
} from "@mui/material";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import RefreshIcon from "@mui/icons-material/Refresh";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close"; // added
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import CircularProgress from "@mui/material/CircularProgress";

import DeleteConfirmModal from "../components/DeleteConfirmModal";
import AddDiscountModal, {
  DiscountFormValues,
} from "../components/AddDiscountModal";
import axiosInstance from "../configs/axiosConfig";
import HasPermission from "../components/HasPermission";
import { UserContext } from "../layouts/DashboardLayout";

const API_URL = "/customer-product-discounts";
const DELETE_URL = "/customer-product-discounts";
const Discount: React.FC = () => {
  const [discounts, setDiscounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [total, setTotal] = useState(0);

  // sorting state (default: Created On desc)
  const [sortBy, setSortBy] = useState<string>("createdOn");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // For delete confirmation modal
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // For add/edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editInitialValues, setEditInitialValues] = useState<
    DiscountFormValues | undefined
  >(undefined);
  const user = useContext(UserContext);

  // allow explicit search and page so callers can immediately refetch with known values
  const fetchDiscounts = async (searchValue?: string, currentPage?: number) => {
    setLoading(true);
    try {
      const pageNumber = typeof currentPage !== "undefined" ? currentPage : page + 1;
      const q = typeof searchValue !== "undefined" ? searchValue : search.trim();
      const res = await axiosInstance.get(API_URL, {
        params: {
          perPage: rowsPerPage,
          currentPage: pageNumber,
          search: q,
          sortBy,
          sortDir,
        },
      });
      setDiscounts(res.data.items || []);
      setTotal(res.data.total || 0);
    } catch {
      setDiscounts([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiscounts(undefined, page + 1);
    // eslint-disable-next-line
  }, [page, rowsPerPage]);

  // refetch when sorting changes
  useEffect(() => {
    setPage(0);
    fetchDiscounts(undefined, 1);
    // eslint-disable-next-line
  }, [sortBy, sortDir]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    fetchDiscounts(search.trim(), 1);
  };

  const handleRefresh = () => {
    setSearch("");
    setPage(0);
    fetchDiscounts("", 1);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleteLoading(true);
    try {
      await axiosInstance.delete(`${DELETE_URL}/${deleteId}`);
      axiosInstance.post(`/system-logs/`, {
        module: "Discounts",
        action: "Delete",
        description: `${user.fullName} (${user.role}) deleted a discount`,
        createdBy: user.fullName,
      });
      setDeleteId(null);
      fetchDiscounts();
    } catch {
      setDeleteLoading(false);
    }
    setDeleteLoading(false);
  };

  // Add Discount
  const handleAddDiscount = () => {
    setEditInitialValues(undefined);
    setIsEdit(false);
    setModalOpen(true);
  };

  // Edit Discount
  const handleEditDiscount = (row: any) => {
    setEditInitialValues({
      customer_id: row.customer_id,
      product_id: row.product_id,
      discount_value: row.discount_value,
      id: row.id,
    } as any);
    setIsEdit(true);
    setModalOpen(true);
  };

  const handleSort = (col: string) => {
    if (sortBy === col) {
      setSortDir((s) => (s === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(col);
      setSortDir("asc");
    }
    setPage(0);
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      <Backdrop
        open={loading || deleteLoading}
        sx={{ color: "#fff", zIndex: 9999 }}
      >
        <CircularProgress color="inherit" />
      </Backdrop>
      <DeleteConfirmModal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Discount"
        message="Are you sure you want to delete this discount?"
      />
      <AddDiscountModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={() => {
          setModalOpen(false);
          fetchDiscounts();
        }}
        isEdit={isEdit}
        initialValues={editInitialValues}
      />
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", sm: "flex-start" }}
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography variant="h5" fontWeight={600}>
            Customer Product Discounts
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage per-customer, per-product discounts
          </Typography>
        </Box>
        <Stack direction="row" spacing={2}>
          <Button
            variant="contained"
            startIcon={<RefreshIcon />}
            sx={{ bgcolor: "#95a5a6", color: "#fff", boxShadow: 0 }}
            onClick={handleRefresh}
          >
            REFRESH
          </Button>
          <HasPermission module="Discounts" action="Create">
            <Button
              variant="contained"
              startIcon={<AddCircleOutlineIcon />}
              sx={{ bgcolor: "#f39c12", color: "#fff", boxShadow: 0 }}
              onClick={handleAddDiscount}
            >
              ADD DISCOUNT
            </Button>
          </HasPermission>
        </Stack>
      </Stack>
      <Paper sx={{ p: { xs: 1.5, sm: 2, md: 3 }, mb: 3, overflow: "auto" }}>
        {/* Filters inside table wrapper */}
        <Box sx={{ mb: 2 }}>
          <form onSubmit={handleSearch}>
            <TextField
              placeholder="Search by customer or product"
              size="small"
              variant="outlined"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{
                width: { xs: "100%", sm: 320 },
                bgcolor: "#fafbfc",
                "& .MuiInputBase-input": { pl: 2 },
              }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end" sx={{ gap: 0.5 }}>
                    {search ? (
                      <IconButton
                        size="small"
                        onClick={() => {
                          setSearch("");
                          setPage(0);
                          fetchDiscounts("", 1); // explicit refresh with cleared search and page 1
                        }}
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
        </Box>
        <Box sx={{ width: "100%", overflowX: "auto" }}>
          <Table sx={{ minWidth: 800 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>ID</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>
                  <TableSortLabel
                    active={sortBy === "customer"}
                    direction={sortBy === "customer" ? sortDir : "asc"}
                    onClick={() => handleSort("customer")}
                  >
                    Customer
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Product</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>
                  <TableSortLabel
                    active={sortBy === "discountValue"}
                    direction={sortBy === "discountValue" ? sortDir : "asc"}
                    onClick={() => handleSort("discountValue")}
                  >
                    Discount Value
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 700 }}>
                  <TableSortLabel
                    active={sortBy === "createdOn"}
                    direction={sortBy === "createdOn" ? sortDir : "desc"}
                    onClick={() => handleSort("createdOn")}
                  >
                    Created On
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {discounts.map((row, idx) => (
                <TableRow key={row.id}>
                  <TableCell>{row.id}</TableCell>
                  <TableCell>{row.customer_name}</TableCell>
                  <TableCell>{row.product_name}</TableCell>
                  <TableCell>{row.discount_value}</TableCell>
                  <TableCell>
                    {row.created_on
                      ? new Date(row.created_on).toLocaleString()
                      : ""}
                  </TableCell>
                  <TableCell>
                    <HasPermission module="Discounts" action="Update">
                      <Tooltip title="Edit discount" arrow>
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => handleEditDiscount(row)}
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                    </HasPermission>
                    <HasPermission module="Discounts" action="Delete">
                      <Tooltip title="Delete discount" arrow>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => setDeleteId(row.id)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </HasPermission>
                  </TableCell>
                </TableRow>
              ))}
              {discounts.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    No records found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Box>
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
          sx={{ px: 1 }}
        />
      </Paper>
    </Box>
  );
};

export default Discount;
