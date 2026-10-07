import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  Paper,
  Button,
  CircularProgress,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableRow,
  IconButton,
  Card,
  CardContent,
  Avatar,
  Divider,
  Stack,
  Chip,
  ImageList,
  ImageListItem,
  Tooltip,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PrintIcon from "@mui/icons-material/Print";
import EditIcon from "@mui/icons-material/Edit";
import axiosInstance from "../configs/axiosConfig";
import { Product } from "../models/Product";

const formatCurrency = (v: any) =>
  v == null || v === ""
    ? "-"
    : Number(v).toLocaleString(undefined, { minimumFractionDigits: 2 });

const ProductDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProduct = async () => {
      setLoading(true);
      try {
        const res = await axiosInstance.get<Product>(`/products/${id}`);
        setProduct(res.data);
      } catch (error) {
        setProduct(null);
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchProduct();
  }, [id]);

  if (loading) {
    return (
      <Box sx={{ p: 6, textAlign: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  const images = (product as any).images || [];
  // Only use an image if provided (no placeholder fallback)
  const mainImage = images.length > 0 ? images[0] : (product as any).imageUrl ?? null;

  return (
    <Box
      sx={{ p: { xs: 2, md: 4 }, background: "#f3f5f7", minHeight: "100vh" }}
    >
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          flexDirection: { xs: "column", sm: "row" },
          mb: 3,
          gap: 2,
        }}
      >
        <Box>
          <Typography fontSize={17} variant="h5" fontWeight={700}>
            Product Details
          </Typography>
          <Typography variant="subtitle2" color="text.secondary">
            Full details of the product
          </Typography>
        </Box>

        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            startIcon={<ArrowBackIcon />}
            sx={{
              mt: { xs: 2, sm: 0 },
              bgcolor: "#112D4E",
              color: "#fff",
              borderRadius: 2,
              boxShadow: 0,
              textTransform: "none",
              fontWeight: 500,
              "&:hover": { bgcolor: "#0b1e38" },
            }}
            onClick={() => navigate("/products")}
          >
            Back to Products
          </Button>
        </Stack>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Paper
            elevation={0}
            sx={{
              p: 3,
              borderRadius: 2,
              background: "#fff",
            }}
          >
            <Box
              sx={{
                display: "flex",
                gap: 2,
                alignItems: "flex-start",
                mb: 2,
                flexDirection: { xs: "column", sm: "row" },
              }}
            >
              <Box
                sx={{
                  width: 160,
                  height: 160,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "1px solid #e6e6e6",
                  borderRadius: 2,
                  background: "#fafafa",
                  overflow: "hidden",
                }}
              >
                {mainImage ? (
                  <img
                    src={mainImage}
                    alt={product?.name}
                    style={{
                      maxWidth: "100%",
                      maxHeight: "100%",
                      objectFit: "contain",
                    }}
                  />
                ) : null}
              </Box>

              <Box sx={{ flex: 1 }}>
                <Typography variant="h6" fontWeight={700} gutterBottom>
                  {product?.name}
                </Typography>

                <Stack
                  direction="row"
                  gap={1}
                  flexWrap="wrap"
                  alignItems="center"
                >
                  <Chip
                    label={product?.sku ? `SKU: ${product?.sku}` : "No SKU"}
                    size="small"
                  />
                  <Chip
                    label={product?.unit ? `${product?.unit}` : "Unit: Piece"}
                    size="small"
                  />
                  <Chip
                    label={`Qty: ${product?.qty ?? 0}`}
                    size="small"
                    color="info"
                  />
                  <Chip
                    label={
                      product?.sellingType ? product?.sellingType : "Selling: -"
                    }
                    size="small"
                  />
                  <Chip
                    label={`₱ ${formatCurrency(product?.price)}`}
                    color="success"
                    size="small"
                  />
                </Stack>

                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mt: 1 }}
                >
                  {product?.description || "-"}
                </Typography>
              </Box>

              <Box sx={{ width: { xs: "100%", sm: 220 }, textAlign: "center" }}>
                <Box sx={{ mb: 1 }}>
                  <img
                    src={`https://barcode.tec-it.com/barcode.ashx?data=${encodeURIComponent(
                      product?.sku || product?.name || "product"
                    )}&code=Code128&dpi=200`}
                    alt="Barcode"
                    style={{ maxWidth: "100%", height: 80 }}
                  />
                </Box>
                <Tooltip title="Print barcode">
                  <IconButton
                    color="primary"
                    onClick={() => {
                      // keep existing simple behavior: open barcode image in new tab for printing
                      window.open(
                        `https://barcode.tec-it.com/barcode.ashx?data=${encodeURIComponent(
                          product?.sku || product?.name || "product"
                        )}&code=Code128&dpi=96`,
                        "_blank"
                      );
                    }}
                  >
                    <PrintIcon />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>

            <Divider sx={{ my: 2 }} />

            <Table
              size="small"
              sx={{
                width: "100%",
                borderCollapse: "collapse",
                "& td, & th": {
                  borderBottom: "1px solid #f0f0f0",
                  padding: "12px 8px",
                },
                "& th": {
                  width: 220,
                  textAlign: "left",
                  fontWeight: 600,
                  color: "text.secondary",
                },
              }}
            >
              <TableBody>
                <TableRow>
                  <TableCell component="th">Category</TableCell>
                  <TableCell>{product?.category?.name || "None"}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell component="th">Brand</TableCell>
                  <TableCell>{product?.brand?.name || "None"}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell component="th">Costing Price</TableCell>
                  <TableCell>
                    {formatCurrency((product as any).costingPrice)}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell component="th">Selling Price</TableCell>
                  <TableCell>{formatCurrency(product?.price)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell component="th">Date Created</TableCell>
                  <TableCell>{product ? new Date(product?.createdOn).toLocaleDateString() : "-"}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card elevation={0} sx={{ borderRadius: 2 }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                Images
              </Typography>

              <Box sx={{ mb: 2 }}>
                <ImageList cols={2} gap={8} rowHeight={90}>
                  {images.length > 0 &&
                    images.map((url: string, idx: number) => (
                      <ImageListItem key={idx}>
                        <img
                          src={url}
                          alt={`${product?.name}-${idx}`}
                          loading="lazy"
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            borderRadius: 6,
                          }}
                        />
                      </ImageListItem>
                    ))}
                </ImageList>
              </Box>

              <Divider sx={{ my: 1 }} />

              <Box
                sx={{ display: "flex", flexDirection: "column", gap: 1, mt: 1 }}
              >
                <Typography variant="subtitle2">Quick actions</Typography>
                <Stack direction="row" spacing={1}>
                  <Button
                    fullWidth
                    variant="outlined"
                    onClick={() => navigate(`/products/${product?.id}/edit`)}
                  >
                    Edit Product
                  </Button>
                </Stack>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ProductDetail;
