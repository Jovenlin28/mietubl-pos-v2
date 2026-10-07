import React, { useEffect, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  Stack,
  Button,
  Grid,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  IconButton,
  Select,
  MenuItem,
  TextField,
  InputAdornment,
  Backdrop,
  CircularProgress,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import RefreshIcon from "@mui/icons-material/Refresh";
import axiosInstance from "../configs/axiosConfig";
import { Product } from "../models/Product";

const LowStocks: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [warehouses, setWarehouses] = useState<{ id: number; name: string }[]>([]);
  const [stores, setStores] = useState<{ id: number; name: string }[]>([]);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [warehouseFilter, setWarehouseFilter] = useState("");
  const [storeFilter, setStoreFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  useEffect(() => {
    // Fetch filter options
    axiosInstance.get("/warehouses").then(res => setWarehouses(res.data));
    axiosInstance.get("/stores").then(res => setStores(res.data));
    axiosInstance.get("/categories").then(res => setCategories(res.data));
  }, []);

  useEffect(() => {
    fetchProducts();
    // eslint-disable-next-line
  }, [page, rowsPerPage, search, warehouseFilter, storeFilter, categoryFilter]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get(
        `/products?page=${page}&perPage=${rowsPerPage}&isLowStock=true&search=${search}` +
        (warehouseFilter ? `&warehouse=${warehouseFilter}` : "") +
        (storeFilter ? `&store=${storeFilter}` : "") +
        (categoryFilter ? `&category=${categoryFilter}` : "")
      );
      setProducts(res.data.items);
      setTotal(res.data.total);
    } catch {
      setProducts([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  const pageCount = Math.ceil(total / rowsPerPage);

  return (
    <Box sx={{ p: 4, position: "relative" }}>
      <Backdrop
        open={loading}
        sx={{ color: "#fff", zIndex: (theme) => theme.zIndex.drawer + 1 }}
      >
        <CircularProgress color="inherit" />
      </Backdrop>
      <Paper elevation={0}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ mb: 3 }}
        >
          <Box>
            <Typography variant="h5" fontWeight={700}>
              Low Stocks
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Manage your low stocks
            </Typography>
          </Box>
          <Stack direction="row" spacing={2}>
            <Button
              variant="contained"
              sx={{
                bgcolor: "#e74c3c",
                color: "#fff",
                borderRadius: 2,
                boxShadow: 0,
                minWidth: 0,
                px: 2,
                display: "flex",
                alignItems: "center",
                gap: 1,
              }}
              startIcon={<PictureAsPdfIcon />}
            >
              PDF
            </Button>
            <Button
              variant="contained"
              sx={{
                bgcolor: "#27ae60",
                color: "#fff",
                borderRadius: 2,
                boxShadow: 0,
                minWidth: 0,
                px: 2,
                display: "flex",
                alignItems: "center",
                gap: 1,
              }}
              startIcon={<AttachFileIcon />}
            >
              XLS
            </Button>
            <Button
              variant="contained"
              sx={{
                bgcolor: "#95a5a6",
                color: "#fff",
                borderRadius: 2,
                boxShadow: 0,
                minWidth: 0,
                px: 2,
                display: "flex",
                alignItems: "center",
                gap: 1,
              }}
              startIcon={<RefreshIcon />}
              onClick={() => fetchProducts()}
            >
              REFRESH
            </Button>
          </Stack>
        </Stack>

        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
          <TextField
            placeholder="Search"
            size="small"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            sx={{ width: 240, bgcolor: "#fafbfc" }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
          <Box sx={{ flex: 1 }} />
          <Select
            size="small"
            displayEmpty
            sx={{ minWidth: 140 }}
            value={warehouseFilter}
            onChange={e => {
              setWarehouseFilter(e.target.value);
              setPage(1);
            }}
          >
            <MenuItem value="">Warehouse</MenuItem>
            {warehouses.map(w => (
              <MenuItem key={w.id} value={w.name}>{w.name}</MenuItem>
            ))}
          </Select>
          <Select
            size="small"
            displayEmpty
            sx={{ minWidth: 140 }}
            value={storeFilter}
            onChange={e => {
              setStoreFilter(e.target.value);
              setPage(1);
            }}
          >
            <MenuItem value="">Store</MenuItem>
            {stores.map(s => (
              <MenuItem key={s.id} value={s.name}>{s.name}</MenuItem>
            ))}
          </Select>
          <Select
            size="small"
            displayEmpty
            sx={{ minWidth: 140 }}
            value={categoryFilter}
            onChange={e => {
              setCategoryFilter(e.target.value);
              setPage(1);
            }}
          >
            <MenuItem value="">Category</MenuItem>
            {categories.map(c => (
              <MenuItem key={c.id} value={c.name}>{c.name}</MenuItem>
            ))}
          </Select>
        </Stack>

        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Warehouse</TableCell>
                <TableCell>Store</TableCell>
                <TableCell>Product Name</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>SKU</TableCell>
                <TableCell>Qty</TableCell>
                <TableCell>Qty Alert</TableCell>
                <TableCell align="right"></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>{product.warehouse?.name || "-"}</TableCell>
                  <TableCell>{product.store?.name || "-"}</TableCell>
                  <TableCell>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      {/* <img
                        src={product.imageUrl || "/images/product-placeholder.png"}
                        alt={product.name}
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 6,
                          objectFit: "cover",
                        }}
                      /> */}
                      <Typography>{product.name}</Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>{product.category?.name || "-"}</TableCell>
                  <TableCell>{product.sku}</TableCell>
                  <TableCell>{product.qty}</TableCell>
                  <TableCell>{product.alertQty}</TableCell>
                  <TableCell align="right">
                    <IconButton>
                      <EditIcon />
                    </IconButton>
                    <IconButton>
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {products.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    No records found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 2 }}>
          <Typography variant="body2" component="div">
            Row Per Page
            <Select
              size="small"
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(Number(e.target.value));
                setPage(1);
              }}
              sx={{ mx: 1, width: 70 }}
            >
              <MenuItem value={10}>10</MenuItem>
              <MenuItem value={20}>20</MenuItem>
              <MenuItem value={50}>50</MenuItem>
            </Select>
            Entries
          </Typography>
          <Stack direction="row" alignItems="center" spacing={1}>
            <IconButton
              size="small"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
              sx={{ bgcolor: "#fafbfc" }}
            >
              <ArrowBackIosNewIcon fontSize="small" />
            </IconButton>
            <Box
              sx={{
                bgcolor: "#f39c12",
                color: "#fff",
                px: 1.2,
                py: 0.2,
                borderRadius: "50%",
                fontWeight: 600,
                minWidth: 24,
                fontSize: 14,
                textAlign: "center",
                height: 24,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {page}
            </Box>
            <IconButton
              size="small"
              disabled={page === pageCount || pageCount === 0}
              onClick={() => setPage(page + 1)}
              sx={{ bgcolor: "#fafbfc" }}
            >
              <ArrowForwardIosIcon fontSize="small" />
            </IconButton>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
};

export default LowStocks;