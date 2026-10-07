import React, { useContext, useEffect, useState } from "react";
import {
  Box,
  Typography,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Paper,
  Stack,
  Button,
  IconButton,
  TextField,
  Backdrop,
  CircularProgress,
  TableContainer,
  TablePagination,
  Chip,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
} from "@mui/material";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import RefreshIcon from "@mui/icons-material/Refresh";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import PrimaryButton from "../shared/buttons/PrimaryButton";
import ExpenseAddModal, {
  ExpenseFormValues,
} from "../components/ExpenseAddModal/ExpenseAddModal";
import axiosInstance from "../configs/axiosConfig";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { Expense } from "../models/Expense";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import DeleteConfirmModal from "../components/DeleteConfirmModal";
import ViewAttachmentModal from "../components/ViewAttachmentModal";

// Added: date picker imports
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import HasPermission from "../components/HasPermission";
import { UserContext } from "../layouts/DashboardLayout";
import { useNotification } from "../hooks/useNotification";
import TableSortLabel from "@mui/material/TableSortLabel";

const ExpenseListing: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [openAddModal, setOpenAddModal] = useState(false);
  const [viewAttachmentOpen, setViewAttachmentOpen] = useState(false);
  const [viewAttachmentUrl, setViewAttachmentUrl] = useState<string | null>(null);

  // Pagination states
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Search state
  const [search, setSearch] = useState("");
  // local input for search — API triggers only when submitted
  const [searchInput, setSearchInput] = useState("");

  // Date range filter (use Date | null for MUI DatePicker)
  const [fromDate, setFromDate] = useState<Date | null>(null);
  const [toDate, setToDate] = useState<Date | null>(null);

  // sorting state
  const [sortBy, setSortBy] = useState<string>("id");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const formatDateParam = (d: Date | null) => {
    if (!d) return "";
    return d.toISOString().slice(0, 10);
  };

  // format value as Philippine Peso
  const formatPeso = (v: any) =>
    `₱${Number(v ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = (searchInput || "").trim();
    setPage(1);
    setSearch(q);
  };

  // Selected expense for edit
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);

  // Delete confirmation modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [expenseToDeleteId, setExpenseToDeleteId] = useState<number | null>(
    null
  );
  const user = useContext(UserContext);
  const { showSuccess, showError } = useNotification();

  // Fetch expenses from backend
  const fetchExpenses = async (
    pageNum = 1,
    perPageNum = rowsPerPage,
    searchTerm = search,
    fromDateParam?: Date | null,
    toDateParam?: Date | null,
    categoryParam?: string
  ) => {
    setLoading(true);
    try {
      let url = `/expenses?currentPage=${pageNum}&perPage=${perPageNum}&search=${encodeURIComponent(
        searchTerm || ""
      )}`;
      const fromStr = formatDateParam(fromDateParam ?? null);
      const toStr = formatDateParam(toDateParam ?? null);
      if (fromStr) url += `&fromDate=${encodeURIComponent(fromStr)}`;
      if (toStr) url += `&toDate=${encodeURIComponent(toStr)}`;
      // include sorting params
      if (sortBy) url += `&sortBy=${encodeURIComponent(sortBy)}`;
      if (sortDir) url += `&sortDir=${encodeURIComponent(sortDir)}`;
      // include category filter (prefer explicit param when provided)
      const catToSend = typeof categoryParam !== "undefined" ? categoryParam : selectedCategory;
      if (catToSend) url += `&category=${encodeURIComponent(catToSend)}`;

      const res = await axiosInstance.get<{ items: Expense[]; total: number }>(
        url
      );

      setExpenses(res.data.items);
      setTotal(res.data.total);
      setPage(pageNum);
    } catch {
      setExpenses([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses(page, rowsPerPage, search, fromDate, toDate, selectedCategory);
    // eslint-disable-next-line
  }, [page, rowsPerPage, search, fromDate, toDate, sortBy, sortDir, selectedCategory]);

  // Handle create or update
  const handleSaveExpense = async (values: ExpenseFormValues) => {
    setLoading(true);
    try {
      if (selectedExpense && selectedExpense.id) {
        // Edit existing
        await axiosInstance.put(`/expenses/${selectedExpense.id}`, values);
        axiosInstance.post(`/system-logs/`, {
          module: "Expenses",
          action: "Update",
          description: `${user.fullName} (${user.role}) updated an expense`,
          createdBy: user.fullName,
        });
        showSuccess("Expense updated successfully");
      } else {
        // Create new
        await axiosInstance.post("/expenses", values);
        axiosInstance.post(`/system-logs/`, {
          module: "Expenses",
          action: "Create",
          description: `${user.fullName} (${user.role}) created an expense`,
          createdBy: user.fullName,
        });
        showSuccess("Expense created successfully");
      }
      // refresh list
      fetchExpenses(page, rowsPerPage, search, fromDate, toDate);
    } catch (error) {
      console.error("Failed to save expense", error);
    } finally {
      setLoading(false);
      setOpenAddModal(false);
      setSelectedExpense(null);
    }
  };

  const handleRefresh = () => {
    fetchExpenses(page, rowsPerPage, search, fromDate, toDate);
  };

  // open delete confirmation modal
  const handleDeleteExpense = (id?: number) => {
    if (!id) return;
    setExpenseToDeleteId(id);
    setDeleteModalOpen(true);
  };

  // confirm deletion (called from modal)
  const handleConfirmDelete = async () => {
    if (!expenseToDeleteId) return;
    setLoading(true);
    try {
      await axiosInstance.delete(`/expenses/${expenseToDeleteId}`);
      axiosInstance.post(`/system-logs/`, {
        module: "Expenses",
        action: "Delete",
        description: `${user.fullName} (${user.role}) deleted an expense`,
        createdBy: user.fullName,
      });
      showSuccess("Expense deleted successfully");
      // refresh list
      fetchExpenses(page, rowsPerPage, search, fromDate, toDate);
      setDeleteModalOpen(false);
      setExpenseToDeleteId(null);
    } catch (err) {
      console.error("Failed to delete expense", err);
    } finally {
      setLoading(false);
    }
  };

  const pageCount = Math.ceil(total / rowsPerPage);

  // Compute total expenses for today
  const today = new Date();
  const totalExpensesToday = expenses
    .filter((e) => {
      if (!e.purchaseDate) return false;
      const expenseDate = new Date(e.purchaseDate);
      return (
        expenseDate.getFullYear() === today.getFullYear() &&
        expenseDate.getMonth() === today.getMonth() &&
        expenseDate.getDate() === today.getDate()
      );
    })
    .reduce((sum, e) => sum + Number(e.totalCost || 0), 0);

  // Style config to match StockInLogs.tsx
  const getPaymentStatusSx = (status: string) => ({
    fontWeight: 700,
    borderRadius: 1,
    fontSize: 14,
    minWidth: 120,
    "& .MuiSelect-icon": { color: "#333" },
    bgcolor: status === "Fulfilled" ? "#d5f5e3" : "#fdf2c0",
    color: status === "Fulfilled" ? "#229954" : "#b7950b",
    border: status === "Fulfilled" ? "1px solid #27ae60" : "1px solid #f4d03f",
    transition: "background 0.2s",
  });

  const handleViewAttachment = (url?: string | null) => {
    if (!url) return;
    setViewAttachmentUrl(url);
    setViewAttachmentOpen(true);
  };
  const handleCloseViewAttachment = () => {
    setViewAttachmentOpen(false);
    setViewAttachmentUrl(null);
  };

  const handleSort = (col: string) => {
    if (sortBy === col) {
      setSortDir((s) => (s === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(col);
      setSortDir("asc");
    }
    setPage(1);
  };

  useEffect(() => {
    let mounted = true;
    const loadCategories = async () => {
      try {
        const res = await axiosInstance.get("/expense-categories/all");
        if (!mounted) return;
        setCategories(Array.isArray(res.data) ? res.data : []);
      } catch {
        if (!mounted) return;
        setCategories([]);
      }
    };
    loadCategories();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      <Backdrop
        open={loading}
        sx={{ color: "#fff", zIndex: (theme) => theme.zIndex.drawer + 1 }}
      >
        <CircularProgress color="inherit" />
      </Backdrop>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="flex-start"
        sx={{ mb: 3, flexDirection: { xs: "column", sm: "row" } }}
      >
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Expense Listing
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={2}>
            View and manage all expense transactions
          </Typography>
          {/* Search moved into filters area below (inside table Paper) */}
        </Box>
        <Box
          sx={{
            display: "flex",
            gap: 2,
            mt: { xs: 2, sm: 0 },
            flexWrap: { xs: "wrap", sm: "nowrap" },
          }}
        >
          <Stack direction="row" gap={2}>
            <Button
              variant="contained"
              aria-label="Export XLS"
              onClick={() => {
                /* keep existing handler if any */
              }}
              sx={{
                bgcolor: "#27ae60",
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
              <AttachFileIcon sx={{ mr: { xs: 0, sm: 1 } }} />
              <Box
                component="span"
                sx={{ display: { xs: "none", sm: "inline-block" } }}
              >
                XLS
              </Box>
            </Button>

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

            <HasPermission module="Expense Listing" action="Create">
              <Button
                variant="contained"
                aria-label="Add Expense"
                onClick={() => {
                  // open modal in create mode
                  setSelectedExpense(null);
                  setOpenAddModal(true);
                }}
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
                  Add Expense
                </Box>
              </Button>
            </HasPermission>
          </Stack>
        </Box>
      </Stack>

      {/* Widgets container (separate white box) */}
      {/* <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <Box
            sx={{
              flex: 1,
              borderRadius: 2,
              p: 2,
              textAlign: "center",
              bgcolor: "#fff",
              border: "1px solid #eee",
            }}
          >
            <Typography fontWeight={600}>Total Expenses Today</Typography>
            <Typography sx={{ mt: 1, fontWeight: 700, fontSize: 18 }}>
              {totalExpensesToday.toLocaleString(undefined, {
                minimumFractionDigits: 2,
              })}
            </Typography>
          </Box>

          <Box
            sx={{
              flex: 1,
              borderRadius: 2,
              p: 2,
              textAlign: "center",
              bgcolor: "#d5f5e3",
              border: "1px solid #27ae60",
            }}
          >
            <Typography fontWeight={600} color="#229954">
              Fulfilled
            </Typography>
            <Typography sx={{ mt: 1, fontWeight: 700, fontSize: 18 }}>
              {
                expenses.filter(
                  (e) => String(e.status || "").trim() === "Fulfilled"
                ).length
              }
            </Typography>
          </Box>

          <Box
            sx={{
              flex: 1,
              borderRadius: 2,
              p: 2,
              textAlign: "center",
              bgcolor: "#fdf2c0",
              border: "1px solid #f4d03f",
            }}
          >
            <Typography fontWeight={600} color="#b7950b">
              Unfulfilled
            </Typography>
            <Typography sx={{ mt: 1, fontWeight: 700, fontSize: 18 }}>
              {
                expenses.filter(
                  (e) => String(e.status || "").trim() === "Unfulfilled"
                ).length
              }
            </Typography>
          </Box>
        </Stack>
      </Paper> */}

      <Paper sx={{ p: 3, mb: 3, overflow: "auto" }}>
        {/* Filters: keep search in header, date range on right */}
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            justifyContent="space-between"
            sx={{ mb: 2, gap: { xs: 1, md: 0 } }}
          >
            {/* Left: search */}
            <Box sx={{ flex: 1, mr: { xs: 0, md: 2 }, minWidth: 0 }}>
              <form onSubmit={handleSearch} style={{ width: "100%" }}>
                <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
                  <TextField
                    placeholder="Search"
                    size="small"
                    variant="outlined"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    sx={{
                      width: "100%",
                      maxWidth: { xs: "100%", sm: 300 },
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
                              setPage(1);
                              setSearch("");
                              fetchExpenses(1, rowsPerPage, "", fromDate, toDate);
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

                  <FormControl size="small" sx={{ minWidth: 220 }}>
                    <InputLabel id="filter-category-label">Category</InputLabel>
                    <Select
                      labelId="filter-category-label"
                      value={selectedCategory}
                      label="Category"
                      onChange={(e) => {
                        const v = String(e.target.value || "");
                        setSelectedCategory(v);
                        setPage(1);
                        // pass the new category value directly so fetch uses it immediately
                        fetchExpenses(1, rowsPerPage, search, fromDate, toDate, v);
                      }}
                    >
                      <MenuItem value="">All Categories</MenuItem>
                      {categories.map((c) => (
                        <MenuItem key={c.id} value={c.name}>
                          {c.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
              </form>
            </Box>

            {/* Right: date filters + clear */}
            <Stack sx={{ flexDirection: { xs: "column", sm: "row" } }} gap={2}>
              <DatePicker
                label="From"
                value={fromDate}
                onChange={(newVal) => {
                  setFromDate(newVal);
                  setPage(1);
                }}
                slotProps={{
                  textField: {
                    size: "small",
                    placeholder: "From",
                    sx: {
                      width: { xs: "100%", sm: 200 },
                      bgcolor: "#fafbfc",
                      "& .MuiInputBase-root": { height: 40 },
                    },
                  },
                }}
              />

              <DatePicker
                label="To"
                value={toDate}
                onChange={(newVal) => {
                  setToDate(newVal);
                  setPage(1);
                }}
                slotProps={{
                  textField: {
                    size: "small",
                    placeholder: "From",
                    sx: {
                      width: { xs: "100%", sm: 200 },
                      bgcolor: "#fafbfc",
                      "& .MuiInputBase-root": { height: 40 },
                    },
                  },
                }}
              />

              <Button
                variant="outlined"
                size="small"
                onClick={() => {
                  setFromDate(null);
                  setToDate(null);
                  setPage(1);
                  setSearchInput("");
                  setSearch("");
                  // re-fetch without date filters and without search
                  fetchExpenses(1, rowsPerPage, "", null, null);
                }}
              >
                Clear
              </Button>
            </Stack>
          </Stack>
        </LocalizationProvider>

        <Box sx={{ width: "100%", overflowX: "auto" }}>
          <Table sx={{ minWidth: 1550 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>
                  <TableSortLabel
                    active={sortBy === "id"}
                    direction={sortBy === "id" ? sortDir : "asc"}
                    onClick={() => handleSort("id")}
                  >
                    ID
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 700 }}>
                  <TableSortLabel
                    active={sortBy === "purchaseDate"}
                    direction={sortBy === "purchaseDate" ? sortDir : "asc"}
                    onClick={() => handleSort("purchaseDate")}
                  >
                    Purchase Date
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 700 }}>
                  <TableSortLabel
                    active={sortBy === "expenseCategory"}
                    direction={sortBy === "expenseCategory" ? sortDir : "asc"}
                    onClick={() => handleSort("expenseCategory")}
                  >
                    Category
                  </TableSortLabel>
                </TableCell>

                <TableCell sx={{ fontWeight: 700 }}>Item Description</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>
                  <TableSortLabel
                    active={sortBy === "totalCost"}
                    direction={sortBy === "totalCost" ? sortDir : "asc"}
                    onClick={() => handleSort("totalCost")}
                  >
                    Total Cost
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 700 }}>
                  <TableSortLabel
                    active={sortBy === "status"}
                    direction={sortBy === "status" ? sortDir : "asc"}
                    onClick={() => handleSort("status")}
                  >
                    Status
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 700 }}>
                  <TableSortLabel
                    active={sortBy === "receiptNo"}
                    direction={sortBy === "receiptNo" ? sortDir : "asc"}
                    onClick={() => handleSort("receiptNo")}
                  >
                    Receipt No.
                  </TableSortLabel>
                </TableCell>

                <TableCell sx={{ fontWeight: 700 }}>Attachment</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>
                  <TableSortLabel
                    active={sortBy === "createdOn"}
                    direction={sortBy === "createdOn" ? sortDir : "asc"}
                    onClick={() => handleSort("createdOn")}
                  >
                    Created On
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 700 }}>
                  <TableSortLabel
                    active={sortBy === "vendorName"}
                    direction={sortBy === "vendorName" ? sortDir : "asc"}
                    onClick={() => handleSort("vendorName")}
                  >
                    Vendor Name
                  </TableSortLabel>
                </TableCell>

                <TableCell sx={{ fontWeight: 700 }}>Source of Fund</TableCell>

                <TableCell sx={{ fontWeight: 700 }}>TIN No.</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Business Address</TableCell>
                <TableCell sx={{ fontWeight: 700, textAlign: "center" }}>
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {expenses.map((row, idx) => (
                <TableRow key={row.id ?? idx}>
                  <TableCell>{row.id}</TableCell>
                  <TableCell>
                    {row.purchaseDate
                      ? new Date(row.purchaseDate).toLocaleDateString()
                      : ""}
                  </TableCell>
                  <TableCell>{row.expenseCategory}</TableCell>
                  <TableCell>{row.itemDescription}</TableCell>
                  <TableCell>
                    {formatPeso(row.totalCost)}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={String(row.status || "").trim() || "-"}
                      size="small"
                      sx={{
                        fontWeight: 700,
                        fontSize: 13,
                        px: 1.5,
                        bgcolor:
                          String(row.status || "").trim() === "Fulfilled"
                            ? "#d5f5e3"
                            : "#fdf2c0",
                        color:
                          String(row.status || "").trim() === "Fulfilled"
                            ? "#229954"
                            : "#b7950b",
                        border:
                          String(row.status || "").trim() === "Fulfilled"
                            ? "1px solid #27ae60"
                            : "1px solid #f4d03f",
                      }}
                    />
                  </TableCell>
                  <TableCell>{row.receiptNo}</TableCell>

                  {/* Attachment column */}
                  <TableCell>
                    {row.attachment ? (
                      /\.(jpg|jpeg|png|webp|gif)$/i.test(row.attachment) ? (
                        <img
                          src={row.attachment}
                          alt="Attachment"
                          style={{
                            width: 40,
                            height: 28,
                            objectFit: "cover",
                            borderRadius: 4,
                            border: "1px solid #eee",
                            cursor: "pointer",
                            background: "#fafbfc",
                          }}
                          onClick={() => handleViewAttachment(row.attachment)}
                        />
                      ) : /\.pdf$/i.test(row.attachment) ? (
                        <IconButton
                          size="small"
                          onClick={() => handleViewAttachment(row.attachment)}
                        >
                          <PictureAsPdfIcon fontSize="small" />
                        </IconButton>
                      ) : (
                        <Button
                          size="small"
                          variant="text"
                          onClick={() => handleViewAttachment(row.attachment)}
                          sx={{ textTransform: "none", fontSize: 12, px: 0.5 }}
                        >
                          View
                        </Button>
                      )
                    ) : (
                      "-"
                    )}
                  </TableCell>

                  <TableCell>
                    {row.createdOn
                      ? new Date(row.createdOn).toLocaleString()
                      : ""}
                  </TableCell>
                  <TableCell>{row.vendorName}</TableCell>
                  <TableCell>{row.sourceOfFund || "-"}</TableCell>
                  <TableCell>{row.tinNo}</TableCell>
                  <TableCell>{row.businessAddress}</TableCell>
                  <TableCell align="center">
                    <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
                      <HasPermission module="Expense Listing" action="Update">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => {
                            setSelectedExpense(row);
                            setOpenAddModal(true);
                          }}
                        >
                          <EditIcon />
                        </IconButton>
                      </HasPermission>
                      <HasPermission module="Expense Listing" action="Delete">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteExpense(row.id)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </HasPermission>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
              {expenses.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={14} align="center">
                    No records found
                  </TableCell>
                </TableRow>
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
      {/* Add / Edit Expense Modal */}
      <ExpenseAddModal
        open={openAddModal}
        onClose={() => {
          setOpenAddModal(false);
          setSelectedExpense(null);
        }}
        onSuccess={fetchExpenses}
        isEdit={Boolean(selectedExpense)}
        initialValues={
          selectedExpense
            ? ({
                id: selectedExpense.id, // <-- added id
                purchaseDate: selectedExpense.purchaseDate || "",
                expenseCategory: selectedExpense.expenseCategory || "",
                itemDescription: selectedExpense.itemDescription || "",
                totalCost: String(selectedExpense.totalCost || ""),
                status: selectedExpense.status || "Fulfilled",
                receiptNo: selectedExpense.receiptNo || "",
                vendorName: selectedExpense.vendorName || "",                sourceOfFund: selectedExpense.sourceOfFund || "",                tinNo: selectedExpense.tinNo || "",
                businessAddress: selectedExpense.businessAddress || "",
                attachment: selectedExpense.attachment || "",
              } as any)
            : undefined
        }
      />
      {/* View Attachment Preview */}
      <ViewAttachmentModal
        open={viewAttachmentOpen}
        onClose={handleCloseViewAttachment}
        attachmentUrl={viewAttachmentUrl}
      />
      <DeleteConfirmModal
        open={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setExpenseToDeleteId(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Delete Expense"
        message="Are you sure you want to delete this expense? This action cannot be undone."
      />
    </Box>
  );
};

export default ExpenseListing;
