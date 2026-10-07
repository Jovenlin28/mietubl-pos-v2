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
  Chip,
  Tooltip,
  TableSortLabel,
} from "@mui/material";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import RefreshIcon from "@mui/icons-material/Refresh";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import PrimaryButton from "../shared/buttons/PrimaryButton";
import CreateCustomerModal from "../components/CreateCustomerModal";
import DeleteConfirmModal from "../components/DeleteConfirmModal";
import axiosInstance from "../configs/axiosConfig";
import { Customer } from "../models/Customer";
import HasPermission from "../components/HasPermission";
import { UserContext } from "../layouts/DashboardLayout";

const Customers: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  // local input for search — API triggers only when submitted
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [openCreate, setOpenCreate] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<any | null>(null);

  // server-side sorting (default: createdOn DESC)
  const [sortBy, setSortBy] = useState<string>("createdOn"); // fullName | storeName | createdOn
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const user = useContext(UserContext);

  const handleSort = (columnId: string) => {
    let newDir: "asc" | "desc" = "asc";
    if (sortBy === columnId) {
      newDir = sortDir === "asc" ? "desc" : "asc";
    }
    setSortBy(columnId);
    setSortDir(newDir);
    setPage(0);
    // immediate fetch with new sort applied
    fetchCustomers(0, rowsPerPage, search);
  };

  // fetchCustomers now accepts optional overrides so callers can trigger immediate reloads
  const fetchCustomers = async (
    pageNum: number = page,
    perPageNum: number = rowsPerPage,
    searchTerm: string = search
  ) => {
    setLoading(true);
    try {
      const res = await axiosInstance.get("/customers", {
        params: {
          perPage: perPageNum,
          currentPage: pageNum + 1,
          search: (searchTerm || "").trim(),
          sortBy,
          sortDir,
        },
      });
      setCustomers(res.data.items);
      setTotal(res.data.total);
    } catch (err) {
      setCustomers([]);
      setTotal(0);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCustomers(page, rowsPerPage, search);
    // eslint-disable-next-line
  }, [page, rowsPerPage, sortBy, sortDir]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = (searchInput || "").trim();
    setPage(0);
    setSearch(q);
    // trigger immediate fetch using overrides so we don't rely on state sync
    fetchCustomers(0, rowsPerPage, q);
  };

  const handleRefresh = () => {
    setSearch("");
    setPage(0);
    fetchCustomers();
  };

  const handleDeleteClick = (customer: any) => {
    setCustomerToDelete(customer);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!customerToDelete) return;
    setLoading(true);
    try {
      await axiosInstance.delete(`/customers/${customerToDelete.id}`);
      axiosInstance.post(`/system-logs/`, {
        module: "Customers",
        action: "Delete",
        description: `${user.fullName} (${user.role}) deleted a customer`,
        createdBy: user.fullName,
      });
      setDeleteModalOpen(false);
      setCustomerToDelete(null);
      fetchCustomers();
    } catch (err) {
      // Optionally show error notification
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteModalClose = () => {
    setDeleteModalOpen(false);
    setCustomerToDelete(null);
  };

  const handleEditClick = (customer: Customer) => {
    setEditingCustomer(customer);
    setOpenCreate(true);
  };

  const handleCreateOrUpdateSuccess = async () => {
    // refresh list after create/update
    setOpenCreate(false);
    setEditingCustomer(null);
    await fetchCustomers(0, rowsPerPage, search);
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
        title="Delete Customer"
        message={
          customerToDelete
            ? `Are you sure you want to delete "${customerToDelete.fullName}"? This action cannot be undone.`
            : ""
        }
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
            Customers
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage your customer records
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
            <HasPermission module="Customers" action="Create">
              <PrimaryButton
                startIcon={<AddCircleOutlineIcon />}
                textBtn="Add Customer"
                onClick={() => setOpenCreate(true)}
              />
            </HasPermission>
          </Stack>
        </Box>
      </Stack>

      <Paper sx={{ p: 3, mb: 3, overflow: "auto" }}>
        {/* Search filter */}
        <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
          <form onSubmit={handleSearch} style={{ width: "100%" }}>
            <TextField
              placeholder="Search"
              size="small"
              variant="outlined"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              sx={{
                width: { xs: "100%", sm: 260 },
                bgcolor: "#fafbfc",
                "& .MuiInputBase-input": { pl: 2 },
              }}
              InputProps={{
                endAdornment: (
                  <>
                    <IconButton
                      size="small"
                      aria-label="clear-search"
                      onClick={() => {
                        setSearchInput("");
                        setPage(0);
                        setSearch("");
                        // trigger immediate fetch for cleared search
                        fetchCustomers(0, rowsPerPage, "");
                      }}
                      sx={{ visibility: searchInput ? "visible" : "hidden" }}
                    >
                      <CloseIcon />
                    </IconButton>
                    <IconButton type="submit" size="small" aria-label="search">
                      <SearchIcon />
                    </IconButton>
                  </>
                ),
              }}
            />
          </form>
        </Stack>

        {/* Table */}
        <Box sx={{ width: "100%", overflowX: "auto" }}>
          <Table sx={{ minWidth: 1200 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>
                  <TableSortLabel
                    active={sortBy === "fullName"}
                    direction={sortBy === "fullName" ? sortDir : "asc"}
                    onClick={() => handleSort("fullName")}
                  >
                    Full Name
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Email</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Phone Number</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Country</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Address</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>
                  <TableSortLabel
                    active={sortBy === "storeName"}
                    direction={sortBy === "storeName" ? sortDir : "asc"}
                    onClick={() => handleSort("storeName")}
                  >
                    Store Name
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Company</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>TIN Number</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
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
              {loading ? null : customers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} align="center">
                    No records found
                  </TableCell>
                </TableRow>
              ) : (
                customers.map((row, idx) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.fullName}</TableCell>
                    <TableCell>{row.email}</TableCell>
                    <TableCell>{row.phoneNumber}</TableCell>
                    <TableCell>{row.country}</TableCell>
                    <TableCell>{row.address}</TableCell>
                    <TableCell>{row.storeName}</TableCell>
                    <TableCell>{row.company || "-"}</TableCell>
                    <TableCell>{row.tinNumber || "-"}</TableCell>
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
                        ? new Date(row.createdOn).toLocaleString()
                        : "-"}
                    </TableCell>
                    <TableCell
                      // use flex so icons sit side-by-side and aligned to the right
                      sx={{
                        display: "flex",
                        justifyContent: "flex-end",
                        gap: 1,
                      }}
                    >
                      <HasPermission module="Customers" action="Update">
                        <Tooltip title="Edit customer" arrow>
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => handleEditClick(row)}
                            aria-label="edit-customer"
                          >
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                      </HasPermission>

                      <HasPermission module="Customers" action="Delete">
                        <Tooltip title="Delete customer" arrow>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDeleteClick(row)}
                            aria-label="delete-customer"
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </HasPermission>
                    </TableCell>
                  </TableRow>
                ))
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
      {/* Create Customer Modal */}
      <CreateCustomerModal
        open={openCreate}
        initialData={editingCustomer}
        onClose={() => {
          setOpenCreate(false);
          setEditingCustomer(null);
        }}
        onSuccess={handleCreateOrUpdateSuccess}
      />
    </Box>
  );
};

export default Customers;
