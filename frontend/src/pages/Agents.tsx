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
import AddAgentModal from "../components/AddAgentModal";
import DeleteConfirmModal from "../components/DeleteConfirmModal";
import axiosInstance from "../configs/axiosConfig";
import HasPermission from "../components/HasPermission";
import { useNotification } from "../hooks/useNotification";
import { UserContext } from "../layouts/DashboardLayout";

const Agents: React.FC = () => {
  const [agents, setAgents] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [openCreate, setOpenCreate] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [agentToDelete, setAgentToDelete] = useState<any | null>(null);
  const [editAgent, setEditAgent] = useState<any | null>(null);
  const { showSuccess, showError } = useNotification();
  const user = useContext(UserContext);

  const fetchAgents = async (
    searchValue: string = search,
    pageValue: number = page,
    rowsValue: number = rowsPerPage
  ) => {
    setLoading(true);
    try {
      const res = await axiosInstance.get("/agents", {
        params: {
          perPage: rowsValue,
          currentPage: pageValue + 1,
          search: searchValue.trim(),
        },
      });
      setAgents(res.data.items || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      setAgents([]);
      setTotal(0);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!search.trim()) {
      fetchAgents("", page, rowsPerPage);
    }
    // eslint-disable-next-line
  }, [page, rowsPerPage]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    fetchAgents(search, 0, rowsPerPage);
  };

  const handleRefresh = () => {
    setSearch("");
    setPage(0);
    fetchAgents("", 0, rowsPerPage);
  };

  const handleDeleteClick = (agent: any) => {
    setAgentToDelete(agent);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!agentToDelete) return;
    setLoading(true);
    try {
      await axiosInstance.delete(`/agents/${agentToDelete.id}`);
      axiosInstance.post(`/system-logs/`, {
        module: "Agents",
        action: "Delete",
        description: `${user.fullName} (${user.role}) deleted an agent`,
        createdBy: user.fullName,
      });
      showSuccess("Agent deleted successfully");
      setDeleteModalOpen(false);
      setAgentToDelete(null);
      fetchAgents();
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || "Failed to delete agent";
      showError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteModalClose = () => {
    setDeleteModalOpen(false);
    setAgentToDelete(null);
  };

  const handleEditClick = (agent: any) => {
    setEditAgent(agent);
    setOpenCreate(true);
  };

  const handleModalClose = () => {
    setOpenCreate(false);
    setEditAgent(null);
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      <Backdrop open={loading} sx={{ color: "#fff", zIndex: 9999 }}>
        <CircularProgress color="inherit" />
      </Backdrop>

      <DeleteConfirmModal
        open={deleteModalOpen}
        onClose={handleDeleteModalClose}
        onConfirm={handleDeleteConfirm}
        title="Delete Agent"
        message={
          agentToDelete
            ? `Are you sure you want to delete "${agentToDelete.fullName}"? This action cannot be undone.`
            : ""
        }
      />

      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="flex-start"
        sx={{ mb: 3, flexDirection: { xs: "column", sm: "row" } }}
      >
        <Box>
          <Typography variant="h5" fontWeight={600}>
            Agents
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage your agents records
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
            <HasPermission module="Agents" action="Create">
              <PrimaryButton
                startIcon={<AddCircleOutlineIcon />}
                textBtn="Add Agent"
                onClick={() => setOpenCreate(true)}
              />
            </HasPermission>
          </Stack>
        </Box>
      </Stack>

      <Paper sx={{ p: 3, mb: 3, overflow: "auto" }}>
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
                          fetchAgents("", 0, rowsPerPage);
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

        <Box sx={{ width: "100%", overflowX: "auto" }}>
          <Table sx={{ minWidth: 800 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>ID</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Full Name</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Phone</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Created On</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? null : agents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    No records found
                  </TableCell>
                </TableRow>
              ) : (
                agents.map((row, idx) => (
                  <TableRow key={row.id}>
                    <TableCell>{page * rowsPerPage + idx + 1}</TableCell>
                    <TableCell>{row.fullName}</TableCell>
                    <TableCell>{row.phone || "-"}</TableCell>
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
                      {row.createdOn ? new Date(row.createdOn).toLocaleDateString() : "-"}
                    </TableCell>
                    <TableCell>
                      <HasPermission module="Agents" action="Update">
                        <Tooltip title="Edit agent" arrow>
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => handleEditClick(row)}
                            aria-label="Edit agent"
                          >
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                      </HasPermission>
                      <HasPermission module="Agents" action="Delete">
                        <Tooltip title="Delete agent" arrow>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDeleteClick(row)}
                            aria-label="Delete agent"
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

      <AddAgentModal
        open={openCreate}
        onClose={handleModalClose}
        onSuccess={fetchAgents}
        isEditMode={!!editAgent}
        initialValues={editAgent}
      />
    </Box>
  );
};

export default Agents;
