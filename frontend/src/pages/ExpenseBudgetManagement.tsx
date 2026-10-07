import React, { useEffect, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  Stack,
  Button,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  IconButton,
  Backdrop,
  CircularProgress,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import axiosInstance from "../configs/axiosConfig";
import { useNotification } from "../hooks/useNotification";
import AddExpenseBudgetModal from "../components/AddExpenseBudgetModal";
import DeleteConfirmModal from "../components/DeleteConfirmModal"; // added import
import HasPermission from "../components/HasPermission";

const ExpenseBudgetManagement: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<null | any>(null);
  const [deleteOpen, setDeleteOpen] = useState(false); // new state
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null); // new state
  const { showSuccess, showError } = useNotification();

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get(
        "/expense-categories/budgets/summary"
      );
      setRows(Array.isArray(res.data) ? res.data : []);
      const cats = await axiosInstance.get("/expense-categories/all");
      setCategories(Array.isArray(cats.data) ? cats.data : []);
    } catch (err) {
      setRows([]);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRefresh = () => fetchData();

  const openCreate = () => {
    setEditing(null);
    setForm(null);
    setOpen(true);
  };

  const openEdit = (row: any) => {
    setEditing(row);
    setForm({
      id: row.budgetId || null,
      category_id: row.id,
      amount: row.budget || "",
      period_start: row.period_start || "",
      period_end: row.period_end || "",
      notes: row.notes || "",
    });
    setOpen(true);
  };

  const openDelete = (row: any) => {
    setDeleteTarget(row);
    setDeleteOpen(true);
  };

  const remove = async (budgetId: number | null) => {
    if (!budgetId) {
      showError("No budget to delete");
      return;
    }
    try {
      await axiosInstance.delete(`/expense-category-budgets/${budgetId}`);
      showSuccess("Budget deleted");
      fetchData();
    } catch (err) {
      console.error(err);
      showError("Failed to delete budget");
    }
  };

  /* helper to format ISO/date-like strings into human readable date */
  const formatDate = (v?: string | null) => {
    if (!v) return "-";
    const d = new Date(v);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      <Backdrop open={loading} sx={{ color: "#fff", zIndex: 9999 }}>
        <CircularProgress color="inherit" />
      </Backdrop>

      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="flex-start"
        sx={{ mb: 3, flexDirection: { xs: "column", sm: "row" } }}
      >
        <Box>
          <Typography variant="h5" fontWeight={600}>
            Expense Budgets
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage budgets per expense category
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

            <HasPermission action="Create" module="Expense Budget Management">
              <Button
                variant="contained"
                aria-label="New Budget"
                onClick={openCreate}
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
                  New Budget
                </Box>
              </Button>
            </HasPermission>
          </Stack>
        </Box>
      </Stack>

      <Paper sx={{ p: 3, mb: 3, overflow: "auto" }}>
        <Box sx={{ width: "100%", overflowX: "auto" }}>
          <Table sx={{ minWidth: 900 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Category</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Budget</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Period</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Spent</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Remaining</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Actions</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    No budget records
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => {
                  const remainingVal = Number(r.remaining || 0);
                  return (
                    <TableRow key={r.id}>
                      <TableCell>{r.name}</TableCell>
                      <TableCell>
                        ₱{Number(r.budget || 0).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {formatDate(r.period_start)} &rarr;{" "}
                        {formatDate(r.period_end)}
                      </TableCell>
                      <TableCell>
                        ₱{Number(r.spent || 0).toLocaleString()}
                      </TableCell>
                      <TableCell
                        sx={{
                          color:
                            remainingVal < 0 ? "error.main" : "text.primary",
                          fontWeight: remainingVal < 0 ? 700 : 400,
                        }}
                      >
                        ₱{remainingVal.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <HasPermission
                          action="Update"
                          module="Expense Budget Management"
                        >
                          <IconButton
                            color="primary"
                            size="small"
                            onClick={() => openEdit(r)}
                          >
                            <EditIcon />
                          </IconButton>
                        </HasPermission>
                        <HasPermission
                          action="Delete"
                          module="Expense Budget Management"
                        >
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => openDelete(r)}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </HasPermission>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </Box>
      </Paper>

      <DeleteConfirmModal
        open={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
          setDeleteTarget(null);
        }}
        onConfirm={async () => {
          await remove(deleteTarget?.budgetId || null);
          setDeleteOpen(false);
          setDeleteTarget(null);
        }}
        title="Delete Budget"
        message={
          deleteTarget
            ? `Are you sure you want to delete the budget for "${deleteTarget.name}"? This action cannot be undone.`
            : "Are you sure you want to delete this budget? This action cannot be undone."
        }
      />

      <AddExpenseBudgetModal
        open={open}
        onClose={() => setOpen(false)}
        onSaved={() => {
          setOpen(false);
          fetchData();
        }}
        initialValues={form || undefined}
      />
    </Box>
  );
};

export default ExpenseBudgetManagement;
