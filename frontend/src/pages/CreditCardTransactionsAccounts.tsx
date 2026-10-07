import React, { useEffect, useState, useContext } from "react";
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
import axiosInstance from "../configs/axiosConfig";
import { useNotification } from "../hooks/useNotification";
import { UserContext } from "../layouts/DashboardLayout";
import HasPermission from "../components/HasPermission";
import DeleteConfirmModal from "../components/DeleteConfirmModal";
import AddCreditCardTransactionsAccountModal from "../components/AddCreditCardTransactionsAccountModal";

export interface CreditCardTransactionAccount {
  id: string;
  store: string;
  status: string;
  createdOn: string;
}

const CreditCardTransactionsAccounts: React.FC = () => {
  const { showError, showSuccess } = useNotification();
  const user = useContext(UserContext) as any;

  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<CreditCardTransactionAccount[]>([]);
  const [total, setTotal] = useState(0);

  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const [modalOpen, setModalOpen] = useState(false);
  const [editAccount, setEditAccount] =
    useState<CreditCardTransactionAccount | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [accountToDelete, setAccountToDelete] =
    useState<CreditCardTransactionAccount | null>(null);

  const fetchAccounts = async (
    pageArg = page,
    perPageArg = rowsPerPage,
    searchArg = search
  ) => {
    setLoading(true);
    try {
      const res = await axiosInstance.get(
        "/credit-card-transactions-accounts",
        {
          params: {
            perPage: perPageArg,
            currentPage: pageArg,
            search: searchArg,
            sortBy: "createdOn",
            sortDir: "DESC",
          },
        }
      );
      setAccounts(res.data?.items || []);
      setTotal(res.data?.total || 0);
    } catch (err: any) {
      showError(
        err?.response?.data?.error || err?.message || "Failed to fetch accounts"
      );
      setAccounts([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
    // eslint-disable-next-line
  }, [page, rowsPerPage, search]);

  const handleRefresh = () => {
    setSearch("");
    setSearchInput("");
    setPage(1);
    fetchAccounts(1, rowsPerPage, "");
  };

  const handleAdd = () => {
    setEditAccount(null);
    setModalOpen(true);
  };

  const handleEdit = (acct: CreditCardTransactionAccount) => {
    setEditAccount(acct);
    setModalOpen(true);
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setEditAccount(null);
  };

  const handleSaved = () => {
    fetchAccounts(page, rowsPerPage, search);
  };

  const confirmDeleteClick = (acct: CreditCardTransactionAccount) => {
    setAccountToDelete(acct);
    setDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!accountToDelete) return;
    setLoading(true);
    try {
      await axiosInstance.delete(
        `/credit-card-transactions-accounts/${accountToDelete.id}`
      );
      showSuccess("Account deleted");
      try {
        await axiosInstance.post("/system-logs", {
          module: "Credit Card Transactions Accounts",
          action: "Delete",
          description: `${
            user?.fullName || "User"
          } deleted credit card transaction account: ${accountToDelete.store}`,
          createdBy: user?.fullName || user?.username || "system",
        });
      } catch {}
      setDeleteOpen(false);
      setAccountToDelete(null);
      fetchAccounts(page, rowsPerPage, search);
    } catch (err: any) {
      showError(
        err?.response?.data?.error || err?.message || "Failed to delete"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      <Backdrop
        open={loading}
        sx={{ color: "#fff", zIndex: (theme) => theme.zIndex.drawer + 1 }}
      >
        <CircularProgress color="inherit" />
      </Backdrop>

      <AddCreditCardTransactionsAccountModal
        open={modalOpen}
        onClose={handleModalClose}
        isEdit={!!editAccount}
        initialValues={
          editAccount
            ? {
                id: Number(editAccount.id),
                store: editAccount.store || "",
                status:
                  (editAccount.status as "Active" | "Inactive") || "Active",
              }
            : undefined
        }
        onSubmit={(_saved, _isEdit) => handleSaved()}
      />

      <DeleteConfirmModal
        open={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
          setAccountToDelete(null);
        }}
        onConfirm={handleDelete}
        title="Delete Credit Card Transaction Account"
        message={
          accountToDelete
            ? `Are you sure you want to delete "${accountToDelete.store}"? This action cannot be undone.`
            : "Are you sure you want to delete this account?"
        }
      />

      <Stack
        justifyContent="space-between"
        alignItems="flex-start"
        sx={{ mb: 3, flexDirection: { xs: "column", sm: "row" } }}
      >
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Credit Card Transactions Accounts
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Manage credit card transaction accounts
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
            <HasPermission
              module="Financial Credit Card Transactions"
              action="Create"
            >
              <Button
                variant="contained"
                startIcon={<AddCircleOutlineIcon />}
                sx={{ bgcolor: "#f39c12", color: "#fff", boxShadow: 0 }}
                onClick={handleAdd}
              >
                ADD ACCOUNT
              </Button>
            </HasPermission>
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
                width: 300,
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
        </Stack>

        <Box sx={{ width: "100%", overflowX: "auto" }}>
          <Table
            sx={{
              minWidth: 700,
              "& tbody tr:hover": { backgroundColor: "#f5f5f5" },
            }}
          >
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>ID</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Store</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Created On</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {accounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    No records found
                  </TableCell>
                </TableRow>
              ) : (
                accounts.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.id}</TableCell>
                    <TableCell>{row.store || "-"}</TableCell>
                    <TableCell>
                      <Chip
                        label={row.status || "-"}
                        size="small"
                        sx={{
                          bgcolor:
                            (row.status || "").toLowerCase() === "active"
                              ? "#d5f5e3"
                              : "#fdecea",
                          color:
                            (row.status || "").toLowerCase() === "active"
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
                    <TableCell>
                      <HasPermission
                        module="Financial Credit Card Transactions"
                        action="Update"
                      >
                        <IconButton
                          size="small"
                          sx={{
                            color: "#1976d2",
                            "&:hover": {
                              backgroundColor: "rgba(25,118,210,0.08)",
                            },
                          }}
                          onClick={() => handleEdit(row)}
                        >
                          <EditIcon />
                        </IconButton>
                      </HasPermission>
                      <HasPermission
                        module="Financial Credit Card Transactions"
                        action="Delete"
                      >
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => confirmDeleteClick(row)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </HasPermission>
                    </TableCell>
                  </TableRow>
                ))
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

export default CreditCardTransactionsAccounts;
