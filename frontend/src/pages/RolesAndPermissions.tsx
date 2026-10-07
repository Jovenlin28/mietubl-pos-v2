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
  Backdrop,
  Chip,
  Tooltip,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import SearchIcon from "@mui/icons-material/Search";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import SecurityIcon from "@mui/icons-material/Security";
import AddRoleModal from "../components/AddRoleModal";
import DeleteConfirmModal from "../components/DeleteConfirmModal";
import { useNavigate } from "react-router-dom";
import axiosInstance from "../configs/axiosConfig";
import HasPermission from "../components/HasPermission";

const RolesAndPermissions: React.FC = () => {
  const [roles, setRoles] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [openCreate, setOpenCreate] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<any | null>(null);
  const [editRole, setEditRole] = useState<any | null>(null);
  const navigate = useNavigate();

  const fetchRoles = async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get("/roles", {
        params: {
          perPage: rowsPerPage,
          currentPage: page + 1,
          search: search.trim(),
        },
      });
      setRoles(res.data.items);
      setTotal(res.data.total);
    } catch (err) {
      setRoles([]);
      setTotal(0);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRoles();
    // eslint-disable-next-line
  }, [page, rowsPerPage]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    fetchRoles();
  };

  const handleRefresh = () => {
    setSearch("");
    setPage(0);
    fetchRoles();
  };

  const handleDeleteClick = (role: any) => {
    setRoleToDelete(role);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!roleToDelete) return;
    setLoading(true);
    try {
      await axiosInstance.delete(`/roles/${roleToDelete.id}`);
      setDeleteModalOpen(false);
      setRoleToDelete(null);
      fetchRoles();
    } catch (err) {
      // Optionally show error notification
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteModalClose = () => {
    setDeleteModalOpen(false);
    setRoleToDelete(null);
  };

  const handleAddRole = () => {
    setEditRole(null);
    setOpenCreate(true);
  };

  const handleEditClick = (role: any) => {
    setEditRole(role);
    setOpenCreate(true);
  };

  const handleManagePermissions = (role: any) => {
    navigate(`/roles/${role.id}/permissions`, { state: { role } });
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
        title="Delete Role"
        message={
          roleToDelete
            ? `Are you sure you want to delete "${roleToDelete.name}"? This action cannot be undone.`
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
            Roles & Permissions
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage system roles and permissions
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
            <HasPermission module="Roles & Permissions" action="Create">
              <Button
                variant="contained"
                startIcon={<AddCircleOutlineIcon />}
                sx={{ bgcolor: "#f39c12", color: "#fff", boxShadow: 0 }}
                onClick={handleAddRole}
              >
                ADD ROLE
              </Button>
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
          <Table sx={{ minWidth: 800 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>ID</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Role Name</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Created On</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? null : roles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    No records found
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {roles.map((row, idx) => (
                    <TableRow key={row.id}>
                      <TableCell>{page * rowsPerPage + idx + 1}</TableCell>
                      <TableCell>{row.name}</TableCell>
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
                        <Tooltip title="Manage permissions" arrow>
                          <IconButton
                            size="small"
                            color="info"
                            aria-label="Manage permissions"
                            onClick={() => handleManagePermissions(row)}
                          >
                            <SecurityIcon />
                          </IconButton>
                        </Tooltip>
                        <HasPermission module="Roles & Permissions" action="Update">
                          <Tooltip title="Edit role" arrow>
                            <IconButton
                              size="small"
                              color="primary"
                              aria-label="Edit role"
                              onClick={() => handleEditClick(row)}
                            >
                              <EditIcon />
                            </IconButton>
                          </Tooltip>
                        </HasPermission>
                        <HasPermission module="Roles & Permissions" action="Delete">
                          <Tooltip title="Delete role" arrow>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleDeleteClick(row)}
                              aria-label="Delete role"
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Tooltip>
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
      {/* Add/Edit Role Modal */}
      <AddRoleModal
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        onSuccess={fetchRoles}
        isEditMode={!!editRole}
        initialValues={editRole || undefined}
      />
    </Box>
  );
};

export default RolesAndPermissions;
