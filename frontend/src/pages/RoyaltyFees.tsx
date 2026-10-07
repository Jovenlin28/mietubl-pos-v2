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
  InputAdornment,
  Backdrop,
  CircularProgress,
  Chip,
  TableSortLabel,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import axiosInstance from "../configs/axiosConfig";
import { useNotification } from "../hooks/useNotification";
import AddRoyaltyFeeModal from "../components/AddRoyaltyFeeModal";
import DeleteConfirmModal from "../components/DeleteConfirmModal";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import ViewAttachmentModal from "../components/ViewAttachmentModal";
import HasPermission from "../components/HasPermission";

const formatPeso = (v: any) =>
  `₱${Number(v || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const RoyaltyFees: React.FC = () => {
  const { showError, showSuccess } = useNotification();

  // data
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);

  // ui state
  const [loading, setLoading] = useState(false);

  // filters / pagination / sorting
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [fromDate, setFromDate] = useState<Date | null>(null);
  const [toDate, setToDate] = useState<Date | null>(null);
  const [page, setPage] = useState(0); // 0-based
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sortBy, setSortBy] = useState("createdOn");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // modals
  const [modalOpen, setModalOpen] = useState(false);
  const [editData, setEditData] = useState<any | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [rowToDelete, setRowToDelete] = useState<any | null>(null);
  const [viewAttachment, setViewAttachment] = useState<string | null>(null);
  const [viewOpen, setViewOpen] = useState(false);

  // Helper to format date for API
  const formatDateParam = (d: Date | null) =>
    d ? d.toISOString().slice(0, 10) : "";

  const fetchData = async (
    pageNum = page,
    perPage = rowsPerPage,
    searchTerm = search,
    from = fromDate,
    to = toDate,
    sBy = sortBy,
    sDir = sortDir
  ) => {
    setLoading(true);
    try {
      const params: any = {
        perPage,
        currentPage: pageNum + 1,
        sortBy: sBy,
        sortDir: sDir,
      };
      if (searchTerm.trim()) params.search = searchTerm.trim();
      const f = formatDateParam(from);
      const t = formatDateParam(to);
      if (f) params.fromDate = f;
      if (t) params.toDate = t;

      const res = await axiosInstance.get("/royalty-fees", { params });
      setItems(res.data.items || []);
      setTotal(res.data.total || 0);
      setPage(pageNum);
    } catch (err: any) {
      showError(
        err?.response?.data?.error || err?.message || "Failed to load records"
      );
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(page, rowsPerPage, search, fromDate, toDate, sortBy, sortDir);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, rowsPerPage, sortBy, sortDir, fromDate, toDate]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput.trim());
    setPage(0);
    fetchData(0, rowsPerPage, searchInput.trim());
  };

  const handleClearSearch = () => {
    setSearchInput("");
    setSearch("");
    setPage(0);
    fetchData(0, rowsPerPage, "");
  };

  const handleRefresh = () => {
    setSearch("");
    setSearchInput("");
    setFromDate(null);
    setToDate(null);
    setSortBy("createdOn");
    setSortDir("desc");
    setPage(0);
    fetchData(0, rowsPerPage, "");
  };

  const openCreate = () => {
    setEditData(null);
    setModalOpen(true);
  };
  const openEdit = (row: any) => {
    setEditData(row);
    setModalOpen(true);
  };

  const promptDelete = (row: any) => {
    setRowToDelete(row);
    setDeleteOpen(true);
  };
  const confirmDelete = async () => {
    if (!rowToDelete) return;
    setLoading(true);
    try {
      await axiosInstance.delete(`/royalty-fees/${rowToDelete.id}`);
      showSuccess("Royalty fee deleted");
      setDeleteOpen(false);
      setRowToDelete(null);
      fetchData(page, rowsPerPage, search);
    } catch (err: any) {
      showError(err?.response?.data?.error || "Failed to delete");
    } finally {
      setLoading(false);
    }
  };
  const cancelDelete = () => {
    setDeleteOpen(false);
    setRowToDelete(null);
  };

  const onSaved = () => {
    fetchData(page, rowsPerPage, search);
  };

  const handleSort = (col: string) => {
    let dir: "asc" | "desc" = "asc";
    if (sortBy === col) dir = sortDir === "asc" ? "desc" : "asc";
    setSortBy(col);
    setSortDir(dir);
    setPage(0);
    fetchData(0, rowsPerPage, search, fromDate, toDate, col, dir);
  };

  const balanceOf = (row: any) =>
    Number(row.amountToPay || 0) - Number(row.amountPaid || 0);

  const handleOpenAttachment = (url: string) => {
    if (!url) return;
    setViewAttachment(url);
    setViewOpen(true);
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
        <Backdrop open={loading} sx={{ color: "#fff", zIndex: 9999 }}>
          <CircularProgress color="inherit" />
        </Backdrop>

        {/* Add / Edit Modal */}
        <AddRoyaltyFeeModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          isEdit={!!editData}
          initialValues={editData}
          onSubmit={onSaved}
        />

        {/* Delete Confirmation */}
        <DeleteConfirmModal
          open={deleteOpen}
          onClose={cancelDelete}
          onConfirm={confirmDelete}
          title="Delete Royalty Fee"
          message="Are you sure you want to delete this royalty fee? This action cannot be undone."
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
              Royalty Fees
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Manage royalty fee records
            </Typography>
          </Box>
          <Stack direction="row" spacing={2} mt={{ xs: 2, sm: 0 }}>
            <Button
              variant="contained"
              startIcon={<RefreshIcon />}
              sx={{ bgcolor: "#95a5a6", color: "#fff", boxShadow: 0 }}
              onClick={handleRefresh}
            >
              REFRESH
            </Button>
            <HasPermission module="Royalty Fees" action="Create">
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                sx={{ bgcolor: "#f39c12", color: "#fff", boxShadow: 0 }}
                onClick={openCreate}
              >
                ADD ROYALTY FEE
              </Button>
            </HasPermission>
          </Stack>
        </Stack>

        <Paper sx={{ p: 3, mb: 3, overflow: "auto" }}>
          {/* Filters */}
          <Stack
            direction={{ xs: "column", sm: "row" }}
            gap={2}
            sx={{ mb: 2, flexDirection: { xs: "column", sm: "row" } }}
          >
            <form onSubmit={handleSearchSubmit} style={{ width: "100%" }}>
              <TextField
                placeholder="Search"
                size="small"
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
                      {searchInput && (
                        <IconButton
                          size="small"
                          aria-label="clear search"
                          onClick={handleClearSearch}
                        >
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      )}
                      <IconButton
                        size="small"
                        aria-label="search royalty"
                        type="submit"
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
                fetchData(0, rowsPerPage, "");
              }}
            >
              Clear
            </Button>
          </Stack>

          {/* Table */}
          <Box sx={{ width: "100%", overflowX: "auto" }}>
            <Table
              sx={{
                minWidth: 1300,
                "& tbody tr:hover": { backgroundColor: "#f5f5f5" },
              }}
            >
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>
                    <TableSortLabel
                      active={sortBy === "mall"}
                      direction={sortBy === "mall" ? sortDir : "asc"}
                      onClick={() => handleSort("mall")}
                    >
                      Mall
                    </TableSortLabel>
                  </TableCell>
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
                      active={sortBy === "partner"}
                      direction={sortBy === "partner" ? sortDir : "asc"}
                      onClick={() => handleSort("partner")}
                    >
                      Partner
                    </TableSortLabel>
                  </TableCell>

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
                      active={sortBy === "dueDate"}
                      direction={sortBy === "dueDate" ? sortDir : "asc"}
                      onClick={() => handleSort("dueDate")}
                    >
                      Due Date
                    </TableSortLabel>
                  </TableCell>

                  <TableCell sx={{ fontWeight: 700 }}>
                    <TableSortLabel
                      active={sortBy === "datePaid"}
                      direction={sortBy === "datePaid" ? sortDir : "asc"}
                      onClick={() => handleSort("datePaid")}
                    >
                      Date Paid
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

                  <TableCell sx={{ fontWeight: 700 }}>Attachment</TableCell>{" "}
                  <TableCell sx={{ fontWeight: 700 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={13} align="center">
                      No records found
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((row) => {
                    const bal = balanceOf(row);

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
                      <TableRow key={row.id}>
                        <TableCell>{row.account?.mall || "-"}</TableCell>
                        <TableCell>{row.account?.store || "-"}</TableCell>
                        <TableCell>{row.account?.partner || "-"}</TableCell>
                        <TableCell>{formatPeso(row.amountToPay)}</TableCell>
                        <TableCell>{formatPeso(row.amountPaid)}</TableCell>
                        <TableCell>{formatPeso(bal)}</TableCell>

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

                        <TableCell>
                          {row.dueDate
                            ? new Date(row.dueDate).toLocaleDateString()
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {row.datePaid
                            ? new Date(row.datePaid).toLocaleDateString()
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {row.createdOn
                            ? new Date(row.createdOn).toLocaleString()
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {row.attachment ? (
                            /\.(jpg|jpeg|png)$/i.test(row.attachment) ? (
                              <img
                                src={row.attachment}
                                alt="Attachment"
                                style={{
                                  maxWidth: 60,
                                  maxHeight: 40,
                                  borderRadius: 4,
                                  border: "1px solid #eee",
                                  background: "#fafbfc",
                                  cursor: "pointer",
                                }}
                                onClick={() =>
                                  handleOpenAttachment(row.attachment)
                                }
                              />
                            ) : (
                              <Button
                                size="small"
                                variant="text"
                                onClick={() =>
                                  handleOpenAttachment(row.attachment)
                                }
                                sx={{
                                  textTransform: "none",
                                  fontSize: 12,
                                  px: 0.5,
                                }}
                              >
                                View
                              </Button>
                            )
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
                              module="Royalty Fees"
                              action="Update"
                            >
                              <IconButton
                                size="small"
                                onClick={() => openEdit(row)}
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
                              module="Royalty Fees"
                              action="Delete"
                            >
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => promptDelete(row)}
                                aria-label="Delete"
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </HasPermission>
                          </Box>
                        </TableCell>
                      </TableRow>
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

        <ViewAttachmentModal
          open={viewOpen}
          onClose={() => setViewOpen(false)}
          attachmentUrl={viewAttachment}
        />
      </Box>
    </LocalizationProvider>
  );
};

export default RoyaltyFees;
