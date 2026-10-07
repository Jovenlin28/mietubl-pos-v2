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
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import SearchIcon from "@mui/icons-material/Search";
import DeleteIcon from "@mui/icons-material/Delete";
import ClearIcon from "@mui/icons-material/Clear";
import EditIcon from "@mui/icons-material/Edit";
import PrimaryButton from "../shared/buttons/PrimaryButton";
import AddUserModal from "../components/AddUserModal";
import DeleteConfirmModal from "../components/DeleteConfirmModal";
import axiosInstance from "../configs/axiosConfig";
import HasPermission from "../components/HasPermission";
import { useNotification } from "../hooks/useNotification";
import { UserContext } from "../layouts/DashboardLayout";

const Users: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [openCreate, setOpenCreate] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<any | null>(null);
  const [editUser, setEditUser] = useState<any | null>(null);
  const { showSuccess, showError } = useNotification();
  const user = useContext(UserContext);

  const fetchUsers = async (
    searchValue: string = search,
    pageValue: number = page,
    rowsValue: number = rowsPerPage
  ) => {
    setLoading(true);
    try {
      const res = await axiosInstance.get("/users", {
        params: {
          perPage: rowsValue,
          currentPage: pageValue + 1,
          search: searchValue.trim(),
        },
      });
      setUsers(res.data.items);
      setTotal(res.data.total);
    } catch (err) {
      setUsers([]);
      setTotal(0);
    }
    setLoading(false);
  };

  useEffect(() => {
    // Only trigger fetchUsers if not searching (search is empty)
    if (!search.trim()) {
      fetchUsers("", page, rowsPerPage);
    }
    // eslint-disable-next-line
  }, [page, rowsPerPage]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    // Call fetchUsers with updated search, page, and rowsPerPage
    fetchUsers(search, 0, rowsPerPage);
  };

  const handleRefresh = () => {
    setSearch("");
    setPage(0);
    fetchUsers("", 0, rowsPerPage);
  };

  const handleDeleteClick = (user: any) => {
    setUserToDelete(user);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!userToDelete) return;
    setLoading(true);
    try {
      await axiosInstance.delete(`/users/${userToDelete.id}`);
      axiosInstance.post(`/system-logs/`, {
        module: "Users",
        action: "Delete",
        description: `${user.fullName} (${user.role}) deleted a user`,
        createdBy: user.fullName,
      });
      showSuccess("User deleted successfully");
      setDeleteModalOpen(false);
      setUserToDelete(null);
      fetchUsers();
    } catch (err: any) {
      const msg =
        err?.response?.data?.error || err?.message || "Failed to delete user";
      showError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteModalClose = () => {
    setDeleteModalOpen(false);
    setUserToDelete(null);
  };

  const handleEditClick = (user: any) => {
    setEditUser(user);
    setOpenCreate(true);
  };

  const handleModalClose = () => {
    setOpenCreate(false);
    setEditUser(null);
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
        title="Delete User"
        message={
          userToDelete
            ? `Are you sure you want to delete "${userToDelete.fullName}"? This action cannot be undone.`
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
            Users
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage your user records
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
            <HasPermission module="Users" action="Create">
              <PrimaryButton
                startIcon={<AddCircleOutlineIcon />}
                textBtn="Add User"
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
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{
                width: { xs: "100%", sm: 260 },
                bgcolor: "#fafbfc",
                "& .MuiInputBase-input": { pl: 2 },
              }}
              InputProps={{
                endAdornment: (
                  <>
                    {search && (
                      <IconButton
                        size="small"
                        onClick={() => {
                          setSearch("");
                          setPage(0);
                          fetchUsers("", 0, rowsPerPage);
                        }}
                        aria-label="Clear search"
                      >
                        <ClearIcon />
                      </IconButton>
                    )}
                    <IconButton type="submit" size="small">
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
          <Table sx={{ minWidth: 1000 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>ID</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Full Name</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Username</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Phone</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Role</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Created On</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? null : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    No records found
                  </TableCell>
                </TableRow>
              ) : (
                users.map((row, idx) => (
                  <TableRow key={row.id}>
                    <TableCell>{page * rowsPerPage + idx + 1}</TableCell>
                    <TableCell>{row.fullName}</TableCell>
                    <TableCell>{row.username}</TableCell>
                    <TableCell>{row.phone || "-"}</TableCell>
                    <TableCell>{row.role}</TableCell>
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
                        ? new Date(row.createdOn).toLocaleDateString()
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <HasPermission module="Users" action="Update">
                        <Tooltip title="Edit user" arrow>
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => handleEditClick(row)}
                            aria-label="Edit user"
                          >
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                      </HasPermission>
                      <HasPermission module="Users" action="Delete">
                        <Tooltip title="Delete user" arrow>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDeleteClick(row)}
                            aria-label="Delete user"
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
      {/* Create User Modal */}
      <AddUserModal
        open={openCreate}
        onClose={handleModalClose}
        onSuccess={fetchUsers}
        isEditMode={!!editUser}
        initialValues={editUser}
      />
    </Box>
  );
};

export default Users;
