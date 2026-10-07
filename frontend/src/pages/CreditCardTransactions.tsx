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
  IconButton,
  Backdrop,
  CircularProgress,
  Chip,
  TableSortLabel,
  InputAdornment,
  Collapse,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import axiosInstance from "../configs/axiosConfig";
import { useNotification } from "../hooks/useNotification";
import DeleteConfirmModal from "../components/DeleteConfirmModal";
import AddCreditCardTransactionModal from "../components/AddCreditCardTransactionModal";
import { CreditCardTransaction } from "../models/CreditCardTransaction";
import HasPermission from "../components/HasPermission";
import { Store } from "../models/Store";
import ViewAttachmentModal from "../components/ViewAttachmentModal";

const CreditCardTransactions: React.FC = () => {
  const { showError, showSuccess } = useNotification();

  // helper to format currency with Peso sign
  const formatPeso = (v: any) =>
    `₱${Number(v || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<CreditCardTransaction[]>([]);
  const [total, setTotal] = useState(0);
  // expanded rows for attachment preview
  const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({});

  // pagination, search, filters
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const [fromDate, setFromDate] = useState<Date | null>(null);
  const [toDate, setToDate] = useState<Date | null>(null);

  // sorting
  const [sortBy, setSortBy] = useState("transactionDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // delete
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // stores (for chip label fallback)
  const [stores, setStores] = useState<Store[]>([]);

  // modal (create / edit)
  const [modalOpen, setModalOpen] = useState(false);
  const [editRow, setEditRow] = useState<any | null>(null);

  // attachment modal (same UX as other pages)
  const [attachmentModalOpen, setAttachmentModalOpen] = useState(false);
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);

  const formatDateParam = (d: Date | null) =>
    d ? d.toISOString().slice(0, 10) : "";

  const fetchStores = async () => {
    try {
      const res = await axiosInstance.get("/stores", {
        params: { perPage: 1000, currentPage: 1 },
      });
      setStores(res.data.items || res.data || []);
    } catch {
      setStores([]);
    }
  };

  const fetchTransactions = async (
    pageNum = page,
    perPageNum = rowsPerPage,
    searchTerm = search,
    fromDateParam = fromDate,
    toDateParam = toDate,
    sortByParam = sortBy,
    sortDirParam = sortDir
  ) => {
    setLoading(true);
    try {
      const params: any = {
        perPage: perPageNum,
        currentPage: pageNum + 1,
        search: (searchTerm || "").trim(),
        sortBy: sortByParam,
        sortDir: sortDirParam,
      };
      const f = formatDateParam(fromDateParam);
      const t = formatDateParam(toDateParam);
      if (f) params.fromDate = f;
      if (t) params.toDate = t;
      const res = await axiosInstance.get("/credit-card-transactions", {
        params,
      });
      setItems(res.data.items || []);
      setTotal(res.data.total || 0);
      setPage(pageNum);
    } catch (err: any) {
      showError(
        err?.response?.data?.error ||
          err?.message ||
          "Failed to fetch transactions"
      );
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStores();
  }, []);

  useEffect(() => {
    fetchTransactions(page, rowsPerPage, search, fromDate, toDate, sortBy, sortDir);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, rowsPerPage, sortBy, sortDir, fromDate, toDate]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    setSearch(searchInput.trim());
    fetchTransactions(0, rowsPerPage, searchInput.trim());
  };

  const handleClearSearch = () => {
    setSearchInput("");
    setSearch("");
    setPage(0);
    fetchTransactions(0, rowsPerPage, "");
  };

  const handleRefresh = () => {
    setSearch("");
    setSearchInput("");
    setFromDate(null);
    setToDate(null);
    setPage(0);
    fetchTransactions(0, rowsPerPage, "");
  };

  const handleSort = (col: string) => {
    let dir: "asc" | "desc" = "asc";
    if (sortBy === col) dir = sortDir === "asc" ? "desc" : "asc";
    setSortBy(col);
    setSortDir(dir);
    setPage(0);
    fetchTransactions(0, rowsPerPage, search, fromDate, toDate, col, dir);
  };

  const openAdd = () => {
    setEditRow(null);
    setModalOpen(true);
  };
  const openEdit = (row: any) => {
    setEditRow(row);
    setModalOpen(true);
  };
  const closeModal = () => {
    setModalOpen(false);
    setEditRow(null);
  };
  const handleSaved = () => {
    fetchTransactions(page, rowsPerPage, search, fromDate, toDate, sortBy, sortDir);
  };

  const handleDelete = (id: number) => {
    setDeleteId(id);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setLoading(true);
    try {
      await axiosInstance.delete(`/credit-card-transactions/${deleteId}`);
      showSuccess("Credit card transaction successfully deleted");
      setDeleteModalOpen(false);
      setDeleteId(null);
      fetchTransactions(page, rowsPerPage, search);
    } catch (err: any) {
      showError(
        err?.response?.data?.error || err?.message || "Delete failed"
      );
    } finally {
      setLoading(false);
    }
  };

  const toggleRow = (id: number) => setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));
  const openAttachment = (url?: string | null) => {
    if (!url) return;
    setAttachmentUrl(url);
    setAttachmentModalOpen(true);
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
        <Backdrop open={loading} sx={{ color: "#fff", zIndex: 9999 }}>
          <CircularProgress color="inherit" />
        </Backdrop>

        <AddCreditCardTransactionModal
          open={modalOpen}
          onClose={closeModal}
          onSuccess={handleSaved}
          isEditMode={!!editRow}
          initialValues={editRow || undefined}
        />

        <DeleteConfirmModal
          open={deleteModalOpen}
          onClose={() => setDeleteModalOpen(false)}
          onConfirm={confirmDelete}
          title="Delete Transaction"
          message="Are you sure you want to delete this transaction? This action cannot be undone."
        />

        <ViewAttachmentModal
          open={attachmentModalOpen}
          onClose={() => {
            setAttachmentModalOpen(false);
            setAttachmentUrl(null);
          }}
          attachmentUrl={attachmentUrl as string}
        />

        {/* Header */}
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="flex-start"
          sx={{ mb: 3, flexDirection: { xs: "column", sm: "row" } }}
        >
          <Box>
            <Typography variant="h5" fontWeight={600}>
              Credit Card Transactions
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Manage credit card transaction records
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
              <HasPermission module="Credit Card Transactions" action="Create">
                <Button
                  variant="contained"
                  sx={{ bgcolor: "#f39c12", color: "#fff", boxShadow: 0 }}
                  onClick={openAdd}
                >
                  ADD CREDIT CARD TRANSACTION
                </Button>
              </HasPermission>
            </Stack>
          </Box>
        </Stack>

        <Paper sx={{ p: 3, mb: 3, overflow: "auto" }}>
          {/* Filters */}
          <Stack
            direction={{ xs: "column", sm: "row" }}
            gap={2}
            sx={{ mb: 2, flexDirection: { xs: "column", sm: "row" } }}
          >
            <form onSubmit={handleSearch} style={{ width: "100%" }}>
              <TextField
                placeholder="Search"
                size="small"
                variant="outlined"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                sx={{
                  width: { xs: "100%", sm: 280 },
                  bgcolor: "#fafbfc",
                  "& .MuiInputBase-input": { pl: 2 },
                }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      {searchInput ? (
                        <IconButton
                          size="small"
                          onClick={handleClearSearch}
                          aria-label="clear search"
                        >
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      ) : null}
                      <IconButton type="submit" size="small" aria-label="search">
                        <SearchIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </form>

            <DatePicker
              label="Date from"
              value={fromDate}
              onChange={(v) => {
                setFromDate(v);
                setPage(0);
              }}
              slotProps={{
                textField: {
                  size: "small",
                  placeholder: "From",
                  sx: {
                    width: { xs: "100%", sm: 300 },
                    bgcolor: "#fafbfc",
                    "& .MuiInputBase-root": { height: 40 },
                  },
                },
              }}
            />
            <DatePicker
              label="Date to"
              value={toDate}
              onChange={(v) => {
                setToDate(v);
                setPage(0);
              }}
              slotProps={{
                textField: {
                  size: "small",
                  placeholder: "To",
                  sx: {
                    width: { xs: "100%", sm: 300 },
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
                setSearch("");
                setSearchInput("");
                setPage(0);
                fetchTransactions(0, rowsPerPage, "");
              }}
            >
              Clear
            </Button>
          </Stack>

          {/* Table */}
          <Box sx={{ width: "100%", overflowX: "auto" }}>
            <Table
              sx={{
                minWidth: 1550, // widened to accommodate new columns
                "& tbody tr:hover": { backgroundColor: "#f5f5f5" },
              }}
            >
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>
                    <TableSortLabel
                      active={sortBy === "store"}
                      direction={sortBy === "store" ? sortDir : "asc"}
                      onClick={() => handleSort("store")}
                    >
                      Store
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>
                    <TableSortLabel
                      active={sortBy === "transactionAmount"}
                      direction={sortBy === "transactionAmount" ? sortDir : "asc"}
                      onClick={() => handleSort("transactionAmount")}
                    >
                      Amount
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Bank Deduction</TableCell> {/* NEW (fixed 5%) */}
                  <TableCell sx={{ fontWeight: 700 }}>Net Amount</TableCell>     {/* NEW (amount - 5%) */}
                  <TableCell sx={{ fontWeight: 700 }}>
                    <TableSortLabel
                      active={sortBy === "transactionDate"}
                      direction={sortBy === "transactionDate" ? sortDir : "desc"}
                      onClick={() => handleSort("transactionDate")}
                    >
                      Transaction Date
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
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} align="center">
                      No records found
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((row) => {
                    const amount = Number(row.transactionAmount || 0);
                    const netAmount = amount - amount * 0.05;
                    const storeName = row.account?.store || "-";
                    return (
                      <React.Fragment key={row.id}>
                        <TableRow>
                          <TableCell>
                            <Chip
                              label={storeName}
                              size="small"
                              sx={{
                                bgcolor: "#eaf2f8",
                                color: "#21618c",
                                fontWeight: 600,
                              }}
                            />
                          </TableCell>
                          <TableCell>{formatPeso(amount)}</TableCell>
                          <TableCell>5%</TableCell>
                          <TableCell>{formatPeso(netAmount)}</TableCell>
                          <TableCell>
                            {row.transactionDate
                              ? new Date(row.transactionDate).toLocaleString()
                              : "-"}
                          </TableCell>
                          <TableCell>{row.receiptNo || "-"}</TableCell>
                          <TableCell>
                            {row.attachment ? (
                              <Button
                                size="small"
                                onClick={() => toggleRow(row.id)}
                                endIcon={
                                  expandedRows[row.id] ? (
                                    <KeyboardArrowUpIcon />
                                  ) : (
                                    <KeyboardArrowDownIcon />
                                  )
                                }
                              >
                                View Attachments
                              </Button>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell>
                            {(row as any).createdOn
                              ? new Date((row as any).createdOn).toLocaleString()
                              : "-"}
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                              <HasPermission module="Credit Card Transactions" action="Update">
                                <IconButton
                                  size="small"
                                  onClick={() => openEdit(row)}
                                  sx={{ color: "#1976d2", "&:hover": { backgroundColor: "rgba(25,118,210,0.08)" } }}
                                  aria-label="Edit"
                                >
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              </HasPermission>
                              <HasPermission module="Credit Card Transactions" action="Delete">
                                <IconButton size="small" color="error" onClick={() => handleDelete(row.id)} aria-label="Delete">
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </HasPermission>
                            </Box>
                          </TableCell>
                        </TableRow>

                        <TableRow>
                          <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={10}>
                            <Collapse in={!!expandedRows[row.id]} timeout="auto" unmountOnExit>
                              <Box sx={{ margin: 1 }}>
                                {row.attachment ? (
                                  <Box>
                                    <Box
                                      component="img"
                                      src={row.attachment}
                                      alt="attachment"
                                      onClick={() => openAttachment(row.attachment)}
                                      sx={{
                                        display: "block",
                                        maxWidth: 400,
                                        maxHeight: 300,
                                        borderRadius: 1,
                                        objectFit: "contain",
                                        mt: 1,
                                        cursor: "pointer",
                                      }}
                                    />
                                  </Box>
                                ) : (
                                  <Typography variant="body2" color="text.secondary">
                                    No attachment available
                                  </Typography>
                                )}
                              </Box>
                            </Collapse>
                          </TableCell>
                        </TableRow>
                      </React.Fragment>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Box>

          <TablePagination
            component="div"
            count={total}
            page={page}
            rowsPerPage={rowsPerPage}
            onPageChange={(_, newPage) => setPage(newPage)}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
            rowsPerPageOptions={[5, 10, 25, 50]}
            sx={{ borderTop: "1px solid #e0e0e0", mt: 2 }}
          />
        </Paper>
      </Box>
    </LocalizationProvider>
  );
};

export default CreditCardTransactions;