import React, { useContext, useEffect, useState } from "react";
import axiosInstance from "../configs/axiosConfig";
import {
  Box,
  Typography,
  Select,
  MenuItem,
  Stack,
  IconButton,
  Backdrop,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  TextField,
  FormControl,
  InputLabel,
  TablePagination,
  Tooltip,
  TableSortLabel,
  Autocomplete,
  Chip,
} from "@mui/material";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import RefreshIcon from "@mui/icons-material/Refresh";
import VisibilityIcon from "@mui/icons-material/Visibility";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { useNavigate } from "react-router-dom";
import DeleteConfirmModal from "../components/DeleteConfirmModal";
import PrimaryButton from "../shared/buttons/PrimaryButton";
import { Product } from "../models/Product";
import HasPermission from "../components/HasPermission";
import { UserContext } from "../layouts/DashboardLayout";
import { useNotification } from "../hooks/useNotification";
import { hi } from "date-fns/locale";

const Products: React.FC = () => {
  const [categoriesList, setCategoriesList] = useState<string[]>([]);
  const [categoryIdByName, setCategoryIdByName] = useState<Record<string, string>>({});
  const [brandsList, setBrandsList] = useState<string[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [brandsLoading, setBrandsLoading] = useState(false);
  // sorting state
  const [sortBy, setSortBy] = useState<string>(""); // e.g. 'sku' | 'name' | 'price' | 'qty' | 'createdOn'
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0); // 0-based for TablePagination
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalProducts, setTotalProducts] = useState(0);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  // Product table states
  // searchInput: controlled input in the UI
  // search: applied server-side search (only updated when user triggers search)
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteProductId, setDeleteProductId] = useState<string | null>(null);
  const navigate = useNavigate();
  const user = useContext(UserContext);
  const { showSuccess, showError } = useNotification();
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const fetchProducts = async (searchValue?: string) => {
    setLoading(true);
    try {
      const res = await axiosInstance.get<{ items: Product[]; total: number }>(
        `/products`,
        {
          params: {
            perPage: rowsPerPage,
            currentPage: page + 1,
            search: typeof searchValue !== "undefined" ? searchValue : search,
            ...(sortBy ? { sortBy, sortDir } : {}),
            ...(categoryFilter ? { category: categoryFilter } : {}), // server-side category filter
          },
        }
      );
      setProducts(res.data.items || []);
      setTotalProducts(res.data.total || 0);
      // if caller provided a new searchValue, update applied search state
      if (typeof searchValue !== "undefined") {
        setSearch(searchValue);
      }
    } catch (err) {
      console.error("Fetch products failed:", err);
      setProducts([]);
      setTotalProducts(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // fetch current page using last applied search and sort
    fetchProducts();
    // eslint-disable-next-line
  }, [page, rowsPerPage, sortBy, sortDir]);

  // Refetch when category changes (server-side filtering)
  useEffect(() => {
    setPage(0);
    fetchProducts();
    // eslint-disable-next-line
  }, [categoryFilter]);

  const handleDeleteProduct = async () => {
    if (deleteProductId) {
      try {
        await axiosInstance.delete(`/products/${deleteProductId}`);
        showSuccess("Product deleted successfully");
        axiosInstance.post(`/system-logs/`, {
          module: "Products",
          action: "Delete",
          description: `${user.fullName} (${user.role}) deleted a product`,
          createdBy: user.fullName,
        });
        setProducts(
          products.filter((product) => product.id !== deleteProductId)
        );
        setTotalProducts((prev) => prev - 1);
      } catch (error: any) {
        console.error("Error deleting product:", error);
        const msg =
          error?.response?.data?.error ||
          error?.message ||
          "Failed to delete category";
        showError(msg);
      } finally {
        setDeleteModalOpen(false);
        setDeleteProductId(null);
      }
    }
  };

  // Remove client-side name search — server handles it now.
  // Only brand still filtered client-side (category now on server)
  const filteredProducts = products.filter((product) => {
    const prodBrand = product?.brand?.name || "";
    return brandFilter ? prodBrand === brandFilter : true;
  });

  // fetch all categories & brands for filters (searchable dropdowns)
  useEffect(() => {
    let mounted = true;
    const fetchLists = async () => {
      try {
        setCategoriesLoading(true);
        setBrandsLoading(true);
        const [catRes, brandRes] = await Promise.all([
          axiosInstance.get("/categories"),
          axiosInstance.get("/brands"),
        ]);
        if (!mounted) return;

        // normalize to array of names - support both direct array response or { items: [...] }
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

        const normalizeCategoryMap = (data: any) => {
          const arr = Array.isArray(data)
            ? data
            : Array.isArray(data?.items)
            ? data.items
            : [];
          return arr.reduce((acc: Record<string, string>, item: any) => {
            if (item?.name && item?.id) {
              acc[item.name] = item.id;
            }
            return acc;
          }, {});
        };
        setCategoriesList(normalize(catRes.data));
        setCategoryIdByName(normalizeCategoryMap(catRes.data));
        setBrandsList(normalize(brandRes.data));
      } catch (err) {
        console.error("Failed to load categories/brands", err);
        setCategoriesList([]);
        setCategoryIdByName({});
        setBrandsList([]);
      } finally {
        if (mounted) {
          setCategoriesLoading(false);
          setBrandsLoading(false);
        }
      }
    };
    fetchLists();
    return () => {
      mounted = false;
    };
  }, []);

  // Trigger server search (called when clicking search icon)
  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setPage(0);
    await fetchProducts(searchInput.trim());
  };

  // Clear search input and reset applied search (and refetch)
  const handleClearSearch = async () => {
    setSearchInput("");
    setPage(0);
    await fetchProducts("");
  };

  const handleCopyProduct = async (product: any) => {
    const text = JSON.stringify(product, null, 2);
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // fallback for older browsers
        const el = document.createElement("textarea");
        el.value = text;
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
      }
      // optional: small console confirmation
      console.info("Product copied to clipboard");
    } catch (err) {
      console.error("Copy failed", err);
      // fallback alert so user knows it failed
      alert("Unable to copy product to clipboard");
    }
  };

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortDir("asc");
    }
    setPage(0);
  };

  // helper: attempt to find first image url on product (return string only)
  const getFirstImageUrl = (p: any) => {
    return (
      (p?.images && Array.isArray(p.images) && (p.images[0]?.url || p.images[0])) ||
      p?.image ||
      p?.imageUrl ||
      p?.photo ||
      (p?.photos && Array.isArray(p.photos) && (p.photos[0]?.url || p.photos[0])) ||
      ""
    );
  };

  // helper: qty chip color
  const renderQtyChip = (qtyRaw: any) => {
    const qty = Number(qtyRaw || 0);
    let bg = "#43a047"; // green
    if (qty < 10) bg = "#e53935"; // red
    else if (qty < 20) bg = "#fb8c00"; // orange
    return (
      <Chip
        label={qty}
        size="small"
        sx={{
          bgcolor: bg,
          color: "#fff",
          fontWeight: 700,
          minWidth: 44,
          justifyContent: "center",
        }}
      />
    );
  };

  const exportProducts = async () => {
    setLoading(true);
    try {
      const resp = await axiosInstance.get("/export-products", {
        params: {
          ...(selectedCategoryId ? { categoryId: selectedCategoryId } : {}),
        },
        responseType: "blob",
      });
      const blob = new Blob(
        [resp.data],
        { type: resp.headers["content-type"] || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }
      );
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const disposition = resp.headers["content-disposition"] || "";
      let filename = "products_export.xlsx";
      const match = disposition.match(/filename="(.+)"/);
      if (match && match[1]) filename = match[1];
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export products failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleImportClick = () => {
    if (fileInputRef.current) fileInputRef.current.value = "";
    fileInputRef.current?.click();
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const resp = await axiosInstance.post("/import-products", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (resp.data && resp.data.inserted > 0) {
        showSuccess(`Imported ${resp.data.inserted} products successfully.`);
        fetchProducts();
      } else if (resp.data && resp.data.errors?.length) {
        showError(`Some rows failed: ${resp.data.errors.map((e:any)=>`Row ${e.row}`).join(", ")}`);
      } else {
        showError("Import completed, but no products were added.");
      }
    } catch (err: any) {
      showError(err?.response?.data?.error || "Import failed");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      <Backdrop
        open={loading}
        sx={{ color: "#fff", zIndex: (theme) => theme.zIndex.drawer + 1 }}
      >
        <CircularProgress color="inherit" />
      </Backdrop>
      <Box
        sx={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          mb: 3,
          flexDirection: { xs: "column", sm: "row" },
        }}
      >
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Product List
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Manage your products
          </Typography>
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
            <HasPermission module="Products" action="Export">
              <Button
                variant="contained"
                aria-label="Export XLS"
                onClick={exportProducts}
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
            </HasPermission>

            <Button
              variant="contained"
              aria-label="Refresh"
              onClick={() => {
                setSearchInput("");
                setSearch("");
                setPage(0);
                fetchProducts("");
              }}
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

            <HasPermission module="Products" action="Import">
              <Button
                variant="contained"
                aria-label="Import"
                onClick={handleImportClick}
                sx={{
                  bgcolor: "#111",
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
                disabled={importing}
              >
                <CloudUploadIcon sx={{ mr: { xs: 0, sm: 1 } }} />
                <Box component="span" sx={{ display: { xs: "none", sm: "inline-block" } }}>
                  IMPORT
                </Box>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  ref={fileInputRef}
                  style={{ display: "none" }}
                  onChange={handleImportFile}
                  disabled={importing}
                />
              </Button>
            </HasPermission>
            <HasPermission module="Products" action="Create">
              <Button
                variant="contained"
                aria-label="Add Product"
                onClick={() => navigate("/products/create")}
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
                  Add Product
                </Box>
              </Button>
            </HasPermission>
          </Stack>
        </Box>
      </Box>

      <Paper sx={{ p: 3, mb: 2, borderRadius: 2 }}>
        {/* Filters */}
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          alignItems={{ sm: "center" }}
          justifyContent="space-between"
          sx={{ mb: 2 }}
        >
          <Box sx={{ width: { xs: "100%", sm: 280 } }}>
            <form onSubmit={handleSearch}>
              <TextField
                placeholder="Search by code or name"
                variant="outlined"
                size="small"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                sx={{ width: "100%", bgcolor: "#fafbfc" }}
                InputProps={{
                  endAdornment: (
                    <Box
                      sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
                    >
                      {searchInput.trim() !== "" && (
                        <IconButton
                          type="button"
                          size="small"
                          onClick={handleClearSearch}
                          aria-label="clear search"
                          title="Clear"
                        >
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      )}
                      <IconButton
                        type="submit"
                        size="small"
                        aria-label="search"
                        title="Search"
                      >
                        <SearchIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  ),
                }}
              />
            </form>
          </Box>

          <Stack
            sx={{ flexDirection: { xs: "column", sm: "row" } }}
            gap={2}
            alignItems="center"
          >
            <Autocomplete
              options={categoriesList}
              loading={categoriesLoading}
              size="small"
              value={categoryFilter || null}
              onChange={(_, value) => {
                setCategoryFilter(value || "");
                setSelectedCategoryId(value ? categoryIdByName[value] || "" : "");
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
              sx={{ minWidth: { xs: "100%", sm: 200 } }}
            />

            <Autocomplete
              options={brandsList}
              loading={brandsLoading}
              size="small"
              value={brandFilter || null}
              onChange={(_, value) => {
                setBrandFilter(value || "");
              }}
              clearOnEscape
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Brand"
                  placeholder="All"
                  size="small"
                />
              )}
              sx={{ minWidth: { xs: "100%", sm: 200 } }}
            />
          </Stack>
        </Stack>

        {/* Table */}
        <Box sx={{ width: "100%", overflowX: "auto" }}>
          <Table sx={{ minWidth: 1200 }}>
            <TableHead>
              <TableRow>
                <TableCell>
                  <TableSortLabel
                    active={sortBy === "sku"}
                    direction={sortBy === "sku" ? sortDir : "asc"}
                    onClick={() => handleSort("sku")}
                  >
                    SKU
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortBy === "name"}
                    direction={sortBy === "name" ? sortDir : "asc"}
                    onClick={() => handleSort("name")}
                  >
                    Product Name
                  </TableSortLabel>
                </TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Brand</TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortBy === "price"}
                    direction={sortBy === "price" ? sortDir : "asc"}
                    onClick={() => handleSort("price")}
                  >
                    Price
                  </TableSortLabel>
                </TableCell>
                <TableCell>Unit</TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortBy === "qty"}
                    direction={sortBy === "qty" ? sortDir : "asc"}
                    onClick={() => handleSort("qty")}
                  >
                    Qty
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortBy === "createdOn"}
                    direction={sortBy === "createdOn" ? sortDir : "desc"}
                    onClick={() => handleSort("createdOn")}
                  >
                    Created on
                  </TableSortLabel>
                </TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredProducts.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>{product.sku}</TableCell>
                  <TableCell>
                    <Stack direction="row" alignItems="center" spacing={2}>
                      {(() => {
                        const imgUrl = getFirstImageUrl(product);
                        if (!imgUrl) return null; // do not render when there's no image
                        return (
                          <Box
                            component="img"
                            src={String(imgUrl)}
                            alt={product.name || "product"}
                            onError={(e: any) => {
                              e.currentTarget.style.display = "none";
                            }}
                            sx={{
                              width: 56,
                              height: 56,
                              objectFit: "cover",
                              borderRadius: 1,
                              border: "1px solid #eee",
                              background: "#fff",
                            }}
                          />
                        );
                      })()}
                      <Typography sx={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 350 }}>
                        {product.name}
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>{product.category?.name || "-"}</TableCell>
                  <TableCell>{product.brand?.name || "-"}</TableCell>
                  <TableCell>
                    ₱{Number(product.price || 0).toLocaleString()}
                  </TableCell>
                  <TableCell>{product.unit}</TableCell>
                  <TableCell>{renderQtyChip(product.qty)}</TableCell>
                  <TableCell>
                    {product.createdOn
                      ? new Date(product.createdOn).toLocaleString()
                      : "-"}
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={1}>
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => navigate(`/products/${product.id}`)}
                      >
                        <VisibilityIcon />
                      </IconButton>
                      <HasPermission module="Products" action="Update">
                        <Tooltip title="Edit product">
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() =>
                              navigate(`/products/${product.id}/edit`)
                            }
                          >
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                      </HasPermission>
                      <HasPermission module="Products" action="Delete">
                        <Tooltip title="Delete product">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => {
                              setDeleteProductId(product.id);
                              setDeleteModalOpen(true);
                            }}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </HasPermission>
                      <Tooltip title="Copy product">
                        <IconButton
                          size="small"
                          onClick={() => handleCopyProduct(product)}
                          aria-label="copy product"
                        >
                          <ContentCopyIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
              {filteredProducts.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={9} align="center">
                    No records found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Box>

        {/* Pagination */}
        <TablePagination
          component="div"
          count={totalProducts}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[5, 10, 20]}
          sx={{ px: 1, mt: 2 }}
        />
      </Paper>

      <DeleteConfirmModal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDeleteProduct}
        title="Delete Product"
        message="Are you sure you want to delete product?"
      />
    </Box>
  );
};

export default Products;
