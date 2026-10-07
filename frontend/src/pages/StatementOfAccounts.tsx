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
import ViewAttachmentModal from "../components/ViewAttachmentModal";
import DeleteConfirmModal from "../components/DeleteConfirmModal";
import { useNotification } from "../hooks/useNotification";
import axiosInstance from "../configs/axiosConfig";
import { StatementOfAccount } from "../models/StatementOfAccount";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { Account } from "../models/Account";
import AddStatementOfAccountModal from "../components/AddStatementOfAccountModal";
import HasPermission from "../components/HasPermission";

const StatementOfAccounts: React.FC = () => {
  // helper to format currency with Peso sign
  const formatPeso = (v: any) =>
    `₱${Number(v || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<StatementOfAccount[]>([]);
  const [total, setTotal] = useState(0);

  // search & pagination
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(0); // 0-based UI
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // date filters (periodStart range)
  const [fromDate, setFromDate] = useState<Date | null>(null);
  const [toDate, setToDate] = useState<Date | null>(null);

  // sorting
  const [sortBy, setSortBy] = useState("createdOn");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // delete confirm
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // creation / editing modal
  const [soaModalOpen, setSoaModalOpen] = useState(false);
  const [editSOA, setEditSOA] = useState<any | null>(null);

  // track expanded rows for attachments
  const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({});
  // attachment preview modal state (same UX as DeliveriesMonitoring)
  const [attachmentModalOpen, setAttachmentModalOpen] = useState(false);
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const openAttachment = (url?: string | null) => {
    if (!url) return;
    setAttachmentUrl(url);
    setAttachmentModalOpen(true);
  };

  const { showError, showSuccess } = useNotification();

  const formatDateParam = (d: Date | null) =>
    d ? d.toISOString().slice(0, 10) : "";


  const fetchSOA = async (
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
      // backend not yet filtering by date; sending for future support
      const f = formatDateParam(fromDateParam);
      const t = formatDateParam(toDateParam);
      if (f) params.fromDate = f;
      if (t) params.toDate = t;

      const res = await axiosInstance.get("/statement-of-accounts", {
        params,
      });
      setItems(res.data.items || []);
      setTotal(res.data.total || 0);
      setPage(pageNum);
    } catch (err: any) {
      showError(
        err?.response?.data?.error || err?.message || "Failed to fetch records"
      );
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSOA(page, rowsPerPage, search, fromDate, toDate, sortBy, sortDir);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, rowsPerPage, sortBy, sortDir, fromDate, toDate]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    setSearch(searchInput.trim());
    fetchSOA(0, rowsPerPage, searchInput.trim());
  };

  const handleClearSearch = () => {
    setSearchInput("");
    setSearch("");
    setPage(0);
    fetchSOA(0, rowsPerPage, "");
  };

  const handleRefresh = () => {
    setSearch("");
    setSearchInput("");
    setFromDate(null);
    setToDate(null);
    setPage(0);
    fetchSOA(0, rowsPerPage, "");
  };

  const handleSort = (col: string) => {
    let dir: "asc" | "desc" = "asc";
    if (sortBy === col) dir = sortDir === "asc" ? "desc" : "asc";
    setSortBy(col);
    setSortDir(dir);
    setPage(0);
    fetchSOA(0, rowsPerPage, search, fromDate, toDate, col, dir);
  };

  const handleDelete = (id: number) => {
    setDeleteId(id);
    setDeleteModalOpen(true);
  };
  const openAddSOA = () => {
    setEditSOA(null);
    setSoaModalOpen(true);
  };
  const openEditSOA = (row: any) => {
    setEditSOA(row);
    setSoaModalOpen(true);
  };
  const closeSOAModal = () => {
    setSoaModalOpen(false);
    setEditSOA(null);
  };
  const handleSOASaved = () => {
    fetchSOA(page, rowsPerPage, search, fromDate, toDate, sortBy, sortDir);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setLoading(true);
    try {
      await axiosInstance.delete(`/statement-of-accounts/${deleteId}`);
      showSuccess("Statement deleted");
      setDeleteModalOpen(false);
      setDeleteId(null);
      fetchSOA(page, rowsPerPage, search);
    } catch (err: any) {
      showError(err?.response?.data?.error || err?.message || "Delete failed");
    } finally {
      setLoading(false);
    }
  };

  const remainingBalance = (row: any) =>
    (row.remainingBalance ??
      Number(row.amountToPay || 0) - Number(row.amountPaid || 0)) ||
    0;

  const toggleRow = (id: number) => {
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
        <Backdrop open={loading} sx={{ color: "#fff", zIndex: 9999 }}>
          <CircularProgress color="inherit" />
        </Backdrop>

        <AddStatementOfAccountModal
          open={soaModalOpen}
          onClose={closeSOAModal}
          onSuccess={handleSOASaved}
          isEditMode={!!editSOA}
          initialValues={editSOA || undefined}
        />

        <DeleteConfirmModal
          open={deleteModalOpen}
          onClose={() => setDeleteModalOpen(false)}
          onConfirm={confirmDelete}
          title="Delete Statement"
          message="Are you sure you want to delete this statement? This action cannot be undone."
        />
        <ViewAttachmentModal
          open={attachmentModalOpen}
          onClose={() => {
            setAttachmentModalOpen(false);
            setAttachmentUrl(null);
          }}
          attachmentUrl={attachmentUrl as string}
        />

        {/* Creation / editing modal removed */}

        {/* Header */}
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="flex-start"
          sx={{ mb: 3, flexDirection: { xs: "column", sm: "row" } }}
        >
          <Box>
            <Typography variant="h5" fontWeight={600}>
              Statement of Accounts
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Manage statement of accounts
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
              <HasPermission module="Statement of Accounts" action="Create">
                <Button
                  variant="contained"
                  sx={{ bgcolor: "#f39c12", color: "#fff", boxShadow: 0 }}
                  onClick={openAddSOA}
                >
                  ADD STATEMENT OF ACCOUNT
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
                      <IconButton
                        type="submit"
                        size="small"
                        aria-label="search"
                      >
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
                  placeholder: "From",
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
                fetchSOA(0, rowsPerPage, "");
              }}
            >
              Clear
            </Button>
          </Stack>

          {/* Table */}
          <Box sx={{ width: "100%", overflowX: "auto" }}>
            <Table
              sx={{
                minWidth: 1400,
                "& tbody tr:hover": { backgroundColor: "#f5f5f5" },
              }}
            >
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>
                    <TableSortLabel
                      active={sortBy === "account"}
                      direction={sortBy === "account" ? sortDir : "asc"}
                      onClick={() => handleSort("account")}
                    >
                      Account
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Description</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>
                    <TableSortLabel
                      active={sortBy === "amountToPay"}
                      direction={sortBy === "amountToPay" ? sortDir : "asc"}
                      onClick={() => handleSort("amountToPay")}
                    >
                      Amount To Pay
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>
                    <TableSortLabel
                      active={sortBy === "amountPaid"}
                      direction={sortBy === "amountPaid" ? sortDir : "asc"}
                      onClick={() => handleSort("amountPaid")}
                    >
                      Amount Paid
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>
                    <TableSortLabel
                      active={sortBy === "balance"}
                      direction={sortBy === "balance" ? sortDir : "asc"}
                      onClick={() => handleSort("balance")}
                    >
                      Balance
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
                      active={sortBy === "referenceNo"}
                      direction={sortBy === "referenceNo" ? sortDir : "asc"}
                      onClick={() => handleSort("referenceNo")}
                    >
                      Reference No
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>
                    <TableSortLabel
                      active={sortBy === "periodStart"}
                      direction={sortBy === "periodStart" ? sortDir : "asc"}
                      onClick={() => handleSort("periodStart")}
                    >
                      Period Start
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>
                    <TableSortLabel
                      active={sortBy === "periodEnd"}
                      direction={sortBy === "periodEnd" ? sortDir : "asc"}
                      onClick={() => handleSort("periodEnd")}
                    >
                      Period End
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
                  <TableCell sx={{ fontWeight: 700 }}>Attachment</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} align="center">
                      No records found
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((row) => {
                    const accountName = row.account?.name || '-';
                    const amountPaid = Number(row.amountPaid || 0);
                    const amountToPay = Number(row.amountToPay || 0);
                    let statusLabel = "Unpaid";
                    if (amountPaid === 0) statusLabel = "Unpaid";
                    else if (amountPaid > 0 && amountPaid < amountToPay)
                      statusLabel = "Partial";
                    else if (amountToPay > 0 && amountPaid >= amountToPay)
                      statusLabel = "Paid";
                    else statusLabel = amountPaid > 0 ? "Partial" : "Unpaid";

                    const statusBg =
                      statusLabel === "Paid"
                        ? "#27ae60"
                        : statusLabel === "Partial"
                        ? "#fb8c00"
                        : "#9e9e9e";

                    return (
                      <React.Fragment key={row.id}>
                        <TableRow>
                          <TableCell>
                            <Chip
                              label={accountName}
                              size="small"
                              sx={{
                                bgcolor: "#eaf2f8",
                                color: "#21618c",
                                fontWeight: 600,
                              }}
                            />
                          </TableCell>
                          <TableCell
                            sx={{
                              maxWidth: 260,
                              whiteSpace: "normal",
                              wordBreak: "break-word",
                            }}
                          >
                            {row.description || "-"}
                          </TableCell>
                          <TableCell>{formatPeso(row.amountToPay)}</TableCell>
                          <TableCell>{formatPeso(row.amountPaid)}</TableCell>
                          <TableCell>
                            {formatPeso(remainingBalance(row))}
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={statusLabel}
                              size="small"
                              sx={{
                                bgcolor: statusBg,
                                color: "#fff",
                                fontWeight: 700,
                              }}
                            />
                          </TableCell>
                          <TableCell>{row.referenceNo || "-"}</TableCell>
                          <TableCell>
                            {row.periodStart
                              ? new Date(row.periodStart).toLocaleDateString()
                              : "-"}
                          </TableCell>
                          <TableCell>
                            {row.periodEnd
                              ? new Date(row.periodEnd).toLocaleDateString()
                              : "-"}
                          </TableCell>
                          <TableCell>
                            {row.createdOn
                              ? new Date(row.createdOn).toLocaleString()
                              : "-"}
                          </TableCell>
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
                            <Box
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 0.5,
                              }}
                            >
                              <HasPermission
                                module="Statement of Accounts"
                                action="Update"
                              >
                                <IconButton
                                  size="small"
                                  onClick={() => openEditSOA(row)}
                                  sx={{
                                    color: "#1976d2",
                                    "&:hover": {
                                      backgroundColor: "rgba(25,118,210,0.08)",
                                    },
                                  }}
                                  aria-label="Edit"
                                >
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              </HasPermission>
                              <HasPermission
                                module="Statement of Accounts"
                                action="Delete"
                              >
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => handleDelete(row.id)}
                                  aria-label="Delete"
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </HasPermission>
                            </Box>
                          </TableCell>
                        </TableRow>

                        <TableRow>
                          <TableCell
                            style={{ paddingBottom: 0, paddingTop: 0 }}
                            colSpan={13}
                          >
                            <Collapse
                              in={!!expandedRows[row.id]}
                              timeout="auto"
                              unmountOnExit
                            >
                              <Box sx={{ margin: 1 }}>
                                {row.attachment ? (
                                  <Box>
                                    <Box
                                      component="img"
                                      src={row.attachment}
                                      alt="attachment"
                                      onClick={() =>
                                        openAttachment(row.attachment)
                                      }
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
                                  <Typography
                                    variant="body2"
                                    color="text.secondary"
                                  >
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

          {/* Pagination */}
          {items.length > 0 && (
            <TablePagination
              rowsPerPageOptions={[10, 25, 50]}
              component="div"
              count={total}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={(e, newPage) => setPage(newPage)}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10));
                setPage(0);
              }}
              sx={{ borderTop: "none" }}
            />
          )}
        </Paper>
      </Box>
    </LocalizationProvider>
  );
};

export default StatementOfAccounts;
