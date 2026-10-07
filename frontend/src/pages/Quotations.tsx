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
  Autocomplete,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import Popover from "@mui/material/Popover";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import SearchIcon from "@mui/icons-material/Search";
import DeleteIcon from "@mui/icons-material/Delete";
import DescriptionIcon from "@mui/icons-material/Description";
import EditIcon from "@mui/icons-material/Edit";
import CloseIcon from "@mui/icons-material/Close";
import PrimaryButton from "../shared/buttons/PrimaryButton";
import { useNavigate } from "react-router-dom";
import DeleteConfirmModal from "../components/DeleteConfirmModal";
import GenerateQuotationModal from "../components/GenerateQuotationModal";
import { formatCurrency } from "../constants/currency-formatter";
import axiosInstance from "../configs/axiosConfig";
// Datepicker imports (same pattern as SalesListing)
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { UserContext } from "../layouts/DashboardLayout";

const STATUS_OPTIONS = [
  { value: "Pending", label: "Pending", color: "#1976d2", text: "#fff" },
  { value: "Sent", label: "Sent", color: "#fb8c00", text: "#fff" },
  { value: "Ordered", label: "Ordered", color: "#27ae60", text: "#fff" },
];

const Quotations: React.FC = () => {
  const [quotations, setQuotations] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  // local search input (only applies filter when submitted)
  const [searchInput, setSearchInput] = useState("");
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = (searchInput || "").trim();
    setPage(0);
    setSearch(q);
  };
  const clearSearchInput = () => {
    setSearchInput("");
    setSearch("");
    setPage(0);
    // refresh listings immediately
    fetchQuotations(0, rowsPerPage, "");
  };

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sortBy, setSortBy] = useState<"grandTotal" | "createdOn" | "">("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  // Category filter (same behavior as SalesListing)
  const [categoriesList, setCategoriesList] = useState<string[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>("");

  // Date range state (same UX as SalesListing)
  const [fromDate, setFromDate] = useState<Date | null>(null);
  const [toDate, setToDate] = useState<Date | null>(null);

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [quotationToDelete, setQuotationToDelete] = useState<any | null>(null);

  // Generate Quotation modal state
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [selectedQuotation, setSelectedQuotation] = useState<any | null>(null);

  const navigate = useNavigate();
  const user = useContext(UserContext);

  // helper: format Date to yyyy-mm-dd for query params
  const formatDateParam = (d: Date | null) => {
    if (!d) return "";
    return d.toISOString().slice(0, 10);
  };

  // fetch quotations with optional date filters (page is 0-based)
  const fetchQuotations = async (
    pageNum = 0,
    perPageNum = rowsPerPage,
    searchTerm = search,
    fromDateParam?: Date | null,
    toDateParam?: Date | null,
    sortByParam: string | null = sortBy || null,
    sortDirParam: string | null = sortDir || null,
    categoryParam: string | null = categoryFilter || null
  ) => {
    setLoading(true);
    try {
      let url = `/quotations?currentPage=${
        pageNum + 1
      }&perPage=${perPageNum}&search=${encodeURIComponent(searchTerm || "")}`;
      const fromStr = formatDateParam(fromDateParam ?? null);
      const toStr = formatDateParam(toDateParam ?? null);
      if (fromStr) url += `&fromDate=${encodeURIComponent(fromStr)}`;
      if (toStr) url += `&toDate=${encodeURIComponent(toStr)}`;
      if (categoryParam)
        url += `&category=${encodeURIComponent(categoryParam)}`;
      if (sortByParam) url += `&sortBy=${encodeURIComponent(sortByParam)}`;
      if (sortDirParam) url += `&sortDir=${encodeURIComponent(sortDirParam)}`;

      const res = await axiosInstance.get<{ items: any[]; total: number }>(url);
      setQuotations(res.data.items);
      setTotal(res.data.total || 0);
      setPage(pageNum);
    } catch (err) {
      setQuotations([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  // load categories for filter dropdown
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setCategoriesLoading(true);
        const res = await axiosInstance.get("/categories");
        if (!mounted) return;
        const normalize = (data: any) => {
          const arr = Array.isArray(data)
            ? data
            : Array.isArray(data?.items)
            ? data.items
            : [];
          return arr
            .map((x: any) => (x && x.name ? x.name : String(x)))
            .filter(Boolean);
        };
        setCategoriesList(normalize(res.data));
      } catch (err) {
        if (mounted) setCategoriesList([]);
      } finally {
        if (mounted) setCategoriesLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    fetchQuotations(
      page,
      rowsPerPage,
      search,
      fromDate,
      toDate,
      sortBy,
      sortDir,
      categoryFilter
    );
    // eslint-disable-next-line
  }, [page, rowsPerPage, sortBy, sortDir, categoryFilter]);

  // re-run when search or date filters change (triggered when user submits search)
  useEffect(() => {
    setPage(0);
    fetchQuotations(
      0,
      rowsPerPage,
      search,
      fromDate,
      toDate,
      sortBy,
      sortDir,
      categoryFilter
    );
    // eslint-disable-next-line
  }, [search, fromDate, toDate, rowsPerPage]);

  // when sort changes reset to first page and fetch
  useEffect(() => {
    setPage(0);
    fetchQuotations(
      0,
      rowsPerPage,
      search,
      fromDate,
      toDate,
      sortBy,
      sortDir,
      categoryFilter
    );
    // eslint-disable-next-line
  }, [sortBy, sortDir]);

  const handleRefresh = () => {
    setSearch("");
    setFromDate(null);
    setToDate(null);
    setPage(0);
    fetchQuotations(0, rowsPerPage, "");
  };

  const toggleSort = (column: "grandTotal" | "createdOn") => {
    if (sortBy === column) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortDir("desc");
    }
  };

  // Delete handlers
  const handleDeleteClick = (quotation: any) => {
    setQuotationToDelete(quotation);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!quotationToDelete) return;
    setLoading(true);
    try {
      await axiosInstance.delete(`/quotations/${quotationToDelete.id}`);
      axiosInstance.post(`/system-logs/`, {
        module: "Quotations",
        action: "Delete",
        description: `${user.fullName} (${user.role}) deleted a quotation`,
        createdBy: user.fullName,
      });
      setDeleteModalOpen(false);
      setQuotationToDelete(null);
      fetchQuotations(page, rowsPerPage, search, fromDate, toDate);
    } catch (err) {
      // Optionally show error notification
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteModalClose = () => {
    setDeleteModalOpen(false);
    setQuotationToDelete(null);
  };

  // Helper to display products summary (each product on a new line)
  const getProductsSummary = (items: any[]) => {
    if (!items || items.length === 0) return "-";
    return (
      <Box component="span" sx={{ whiteSpace: "pre-line" }}>
        {items.map((item) => `${item.name} (${item.quantity})`).join("\n")}
      </Box>
    );
  };

  const getGrandTotal = (items: any[]) => {
    if (!items || items.length === 0) return 0;
    return items.reduce((sum, item) => {
      const qty = Number(item.quantity);
      const validQty = isNaN(qty) || qty <= 0 ? 1 : qty;
      const price =
        Number(item.total) && validQty
          ? Number(item.total) / validQty
          : Number(item.price ?? item.unit_price ?? item.product?.price ?? 0);
      const perUnitDisc =
        Number(item.discount ?? item.product?.discount ?? 0) || 0;
      const lineTotal =
        // if item.total provided use it (trusted), otherwise compute
        (Number(item.total) || price * validQty) - perUnitDisc * validQty;
      return sum + lineTotal;
    }, 0);
  };

  // Expanded rows state and helpers (same as SalesListing)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const toggleRowExpansion = (rowKey: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowKey)) next.delete(rowKey);
      else next.add(rowKey);
      return next;
    });
  };
  const getRowKey = (row: any) =>
    row.id || row.purchaseOrderNumber || `row-${Math.random()}`;

  // Customer popover state (same as SalesListing)
  const [customerAnchorEl, setCustomerAnchorEl] = useState<null | HTMLElement>(
    null
  );
  const [customerData, setCustomerData] = useState<any | null>(null);
  const handleOpenCustomer = (
    event: React.MouseEvent<HTMLElement>,
    customer: any
  ) => {
    setCustomerAnchorEl(event.currentTarget);
    setCustomerData(customer || null);
  };
  const handleCloseCustomer = () => {
    setCustomerAnchorEl(null);
    setCustomerData(null);
  };
  const customerOpen = Boolean(customerAnchorEl);

  // Render expandable product toggle (copied from SalesListing)
  const renderProductToggle = (row: any) => {
    const rowKey = getRowKey(row);
    const isExpanded = expandedRows.has(rowKey);
    return (
      <Button
        variant="text"
        size="small"
        onClick={() => toggleRowExpansion(rowKey)}
        sx={{
          textTransform: "none",
          fontWeight: 600,
          color: "primary.main",
          justifyContent: "flex-start",
        }}
        endIcon={isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
      >
        {isExpanded ? "Hide Products" : "View Products"}
      </Button>
    );
  };

  const renderExpandedProductDetails = (row: any) => {
    const rowKey = getRowKey(row);
    const isExpanded = expandedRows.has(rowKey);
    if (!isExpanded) return null;

    let products: any[] = [];
    if (Array.isArray(row.products) && row.products.length > 0) {
      products = row.products;
    } else {
      const name = row.product_name || row.name || "";
      if (name) {
        products = [
          {
            name: name,
            product_name: name,
            sku: row.sku || row.code || "",
            price: row.price || row.unit_price || 0,
            quantity: row.quantity || row.qty || 1,
            discount:
              row.discount || row.discountValue || row.discount_value || 0,
            tax: row.tax || 0,
            total: row.total || 0,
          },
        ];
      }
    }

    return (
      <TableRow key={`${rowKey}-expanded`}>
        <TableCell colSpan={9} sx={{ py: 0, border: 0 }}>
          <Box sx={{ py: 2 }}>
            {products.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No products
              </Typography>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>SKU</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="right">
                      Price
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="right">
                      Total
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {products.map((p: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell>{p.name || p.product_name || "-"}</TableCell>
                      <TableCell>{p.sku || p.product_sku || "-"}</TableCell>
                      <TableCell align="right">
                        {formatCurrency(Number(p.price || p.unit_price || 0))}
                      </TableCell>
                      <TableCell align="right">
                        {formatCurrency(Number(p.total || 0))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Box>
        </TableCell>
      </TableRow>
    );
  };

  // Handler for generating quotation (open modal)
  const handleGenerateQuotation = (quotation: any) => {
    setSelectedQuotation(quotation);
    setGenerateModalOpen(true);
  };

  // Navigate to edit page
  const handleEdit = (quotation: any) => {
    navigate(`/quotations/${quotation.id}/edit`);
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
        title="Delete Quotation"
        message={
          quotationToDelete
            ? `Are you sure you want to delete quotation #${quotationToDelete.id}? This action cannot be undone.`
            : ""
        }
      />
      {/* Generate Quotation Modal */}
      <GenerateQuotationModal
        open={generateModalOpen}
        onClose={() => setGenerateModalOpen(false)}
        quotation={selectedQuotation}
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
            Quotations
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage your quotation records
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
            <PrimaryButton
              startIcon={<AddCircleOutlineIcon />}
              textBtn="Add Quotation"
              onClick={() => navigate("/add-quotation")}
            />
          </Stack>
        </Box>
      </Stack>

      <Paper sx={{ p: 3, mb: 3, overflow: "auto" }}>
        {/* Search + Category on the left, Date range + Clear on the right (like SalesListing) */}
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            justifyContent="space-between"
            sx={{ mb: 2, gap: { xs: 1, sm: 0 } }}
          >
            <Box sx={{ flex: 1, mr: { xs: 0, sm: 2 }, minWidth: 0 }}>
              <form onSubmit={handleSearch} style={{ width: "100%" }}>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  gap={2}
                  alignItems="center"
                >
                  <TextField
                    placeholder="Search by Product or Customer"
                    size="small"
                    variant="outlined"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    sx={{
                      width: { xs: "100%", sm: 330 },
                      bgcolor: "#fafbfc",
                      "& .MuiInputBase-input": { pl: 2 },
                    }}
                    InputProps={{
                      endAdornment: (
                        <>
                          <IconButton
                            size="small"
                            aria-label="clear-search"
                            onClick={clearSearchInput}
                            sx={{
                              visibility: searchInput ? "visible" : "hidden",
                            }}
                          >
                            <CloseIcon />
                          </IconButton>
                          <IconButton
                            type="submit"
                            size="small"
                            aria-label="search"
                          >
                            <SearchIcon />
                          </IconButton>
                        </>
                      ),
                    }}
                  />

                  {/* <Autocomplete
                    options={categoriesList}
                    loading={categoriesLoading}
                    size="small"
                    value={categoryFilter || null}
                    onChange={(_, value) => {
                      setCategoryFilter(value || "");
                      setPage(0);
                    }}
                    clearOnEscape
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Category"
                        placeholder="All"
                        size="small"
                      />
                    )}
                    sx={{ minWidth: { xs: "100%", sm: 220 } }}
                  /> */}
                </Stack>
              </form>
            </Box>

            <Box
              sx={{
                display: "flex",
                gap: 2,
                flexDirection: { xs: "column", sm: "row" },
                alignItems: { xs: "stretch", sm: "center" },
                mt: { xs: 1, sm: 0 },
              }}
            >
              <DatePicker
                label="Date from"
                value={fromDate}
                onChange={(newVal) => {
                  setFromDate(newVal);
                  setPage(0);
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
                label="Date to"
                value={toDate}
                onChange={(newVal) => {
                  setToDate(newVal);
                  setPage(0);
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
                  setSearch("");
                  setSearchInput("");
                  setCategoryFilter("");
                  setPage(0);
                  fetchQuotations(0, rowsPerPage, "");
                }}
              >
                Clear
              </Button>
            </Box>
          </Stack>
        </LocalizationProvider>

        {/* Table */}
        <Box sx={{ width: "100%", overflowX: "auto" }}>
          <Table sx={{ minWidth: 1200 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>ID</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Customer</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Products</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Grand Total</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Discount</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>
                  <TableSortLabel
                    active={sortBy === "grandTotal"}
                    direction={sortBy === "grandTotal" ? sortDir : "desc"}
                    onClick={() => toggleSort("grandTotal")}
                  >
                    Net Total
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 700 }}>
                  <TableSortLabel
                    active={sortBy === "createdOn"}
                    direction={sortBy === "createdOn" ? sortDir : "desc"}
                    onClick={() => toggleSort("createdOn")}
                  >
                    Created On
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? null : quotations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center">
                    No records found
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {quotations.map((row, idx) => {
                    const status = row.status || "Pending";
                    const statusMeta =
                      STATUS_OPTIONS.find((s) => s.value === status) ||
                      STATUS_OPTIONS[0];
                    const rowKey = getRowKey(row);
                    return (
                      <React.Fragment key={row.id ?? idx}>
                        <TableRow>
                          <TableCell>{row.id}</TableCell>
                          <TableCell align="left">
                            <Button
                              variant="text"
                              onClick={(e) =>
                                handleOpenCustomer(
                                  e,
                                  row.customer || {
                                    fullName: row.customer_name || "-",
                                  }
                                )
                              }
                              endIcon={<ExpandMoreIcon />}
                              sx={{
                                textTransform: "none",
                                justifyContent: "flex-start",
                                textAlign: "left",
                              }}
                            >
                              {`${row.customer?.fullName} - ${row.customer?.storeName}`}
                            </Button>
                          </TableCell>

                          <TableCell
                            sx={{
                              fontWeight: 700,
                              width: { xs: "20%", md: "15%" },
                              minWidth: 150,
                            }}
                          >
                            {renderProductToggle(row)}
                          </TableCell>

                          <TableCell>
                            {formatCurrency(row.grandTotal)}
                          </TableCell>

                          <TableCell>
                            {formatCurrency(row.totalDiscount)}
                          </TableCell>

                          <TableCell>
                            {formatCurrency(
                              row.netTotal ??
                                row.grandTotal - (row.totalDiscount || 0)
                            )}
                          </TableCell>

                          <TableCell>
                            {row.createdOn
                              ? new Date(row.createdOn).toLocaleString()
                              : "-"}
                          </TableCell>

                          <TableCell>
                            <Chip
                              label={statusMeta.label}
                              sx={{
                                bgcolor: statusMeta.color,
                                color: statusMeta.text,
                                fontWeight: 700,
                                minWidth: 90,
                                textAlign: "center",
                              }}
                            />
                          </TableCell>

                          <TableCell>
                            <Stack direction="row" spacing={1}>
                              <Tooltip title="Edit">
                                <IconButton
                                  size="small"
                                  color="primary"
                                  onClick={() => handleEdit(row)}
                                >
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Generate Quotation">
                                <IconButton
                                  size="small"
                                  color="primary"
                                  onClick={() => handleGenerateQuotation(row)}
                                >
                                  <DescriptionIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Delete">
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => handleDeleteClick(row)}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          </TableCell>
                        </TableRow>
                        {renderExpandedProductDetails(row)}
                      </React.Fragment>
                    );
                  })}
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

      {/* Customer details popover */}
      <Popover
        open={customerOpen}
        anchorEl={customerAnchorEl}
        onClose={handleCloseCustomer}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      >
        <Box sx={{ p: 2, minWidth: 280 }}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
            Customer Details
          </Typography>
          <Table size="small">
            <TableBody>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Company</TableCell>
                <TableCell>{customerData?.company || "-"}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Address</TableCell>
                <TableCell>
                  {customerData?.address ||
                    customerData?.businessAddress ||
                    "-"}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>TIN</TableCell>
                <TableCell>{customerData?.tin || "-"}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Phone</TableCell>
                <TableCell>
                  {customerData?.phoneNumber || customerData?.phone || "-"}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Box>
      </Popover>
    </Box>
  );
};

export default Quotations;
