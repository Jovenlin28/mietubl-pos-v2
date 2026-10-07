import React, { useContext, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import {
  Box,
  Button,
  Typography,
  Paper,
  Grid,
  TextField,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  FormHelperText,
  Divider,
  CircularProgress,
  IconButton,
  Stack,
  Autocomplete,
  Chip,
} from "@mui/material";
import { Formik, Form } from "formik";
import * as Yup from "yup";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import CloseIcon from "@mui/icons-material/Close";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";

import { Store } from "../models/Store";
import { Warehouse } from "../models/Warehouse";
import { Category } from "../models/Category";
import { Brand } from "../models/Brand";
import axiosInstance from "../configs/axiosConfig";
import { Product } from "../models/Product";
import { useNotification } from "../hooks/useNotification";
import { UserContext } from "../layouts/DashboardLayout";

const initialValues = {
  store: "",
  warehouse: "",
  productName: "",
  sellingType: "",
  category: "",
  brand: "",
  unit: "",
  barcodeSymbology: "",
  itemBarcode: "",
  description: "",
  qty: "",
  price: "", // Selling Price
  costingPrice: "", // Costing Price (new)
};

const validationSchema = Yup.object({
  store: Yup.string().required("Store is required"),
  warehouse: Yup.string().required("Warehouse is required"),
  productName: Yup.string().required("Product Name is required"),
  sellingType: Yup.string().required("Selling Type is required"),
  category: Yup.string().required("Category is required"),
  brand: Yup.string().required("Brand is required"),
  unit: Yup.string().required("Unit is required"),
  itemBarcode: Yup.string().required("Item Barcode is required"),
  description: Yup.string(),
  qty: Yup.number()
    .typeError("Quantity must be a number")
    .required("Quantity is required")
    .min(0, "Quantity must be at least 0"),
  price: Yup.number()
    .typeError("Price must be a number")
    .required("Price is required")
    .min(0, "Price must be at least 0"),
  costingPrice: Yup.number()
    .typeError("Costing Price must be a number")
    .required("Costing Price is required")
    .min(0, "Costing Price must be at least 0"),
  // discounts removed
});

const CreateProduct: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const { showSuccess, showError } = useNotification();

  // State for dropdowns and their loading
  const [stores, setStores] = useState<Store[]>([]);
  const [storesLoading, setStoresLoading] = useState(false);

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehousesLoading, setWarehousesLoading] = useState(false);

  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);

  const [brands, setBrands] = useState<Brand[]>([]);
  const [brandsLoading, setBrandsLoading] = useState(false);

  const [units] = useState<string[]>(["Piece", "Box"]);
  const [barcodeSymbologies] = useState<string[]>(["EAN-13", "UPC-A"]);
  const [sellingTypes] = useState<string[]>(["Retail", "Wholesale"]);
  const [loading, setLoading] = useState(false);

  // Edit mode states
  const [editInitialValues, setEditInitialValues] = useState(initialValues);
  const [isEdit, setIsEdit] = useState(false);
  const [formReady, setFormReady] = useState(!id); // Only ready if not editing

  // Images state for product
  // we keep selected File objects + preview URL; upload only on Save
  const [images, setImages] = useState<
    { file?: File; preview: string; uploadedUrl?: string; filename?: string }[]
  >([]);
  const [uploading, setUploading] = useState(false);
  const user = useContext(UserContext);

  useEffect(() => {
    // Fetch stores
    setStoresLoading(true);
    axiosInstance
      .get<{ items: Store[]; total: number }>("/stores")
      .then((res) => setStores(res.data.items))
      .catch(() => setStores([]))
      .finally(() => setStoresLoading(false));

    // Fetch warehouses
    setWarehousesLoading(true);
    axiosInstance
      .get<{ items: Warehouse[]; total: number }>("/warehouses")
      .then((res) => setWarehouses(res.data.items))
      .catch(() => setWarehouses([]))
      .finally(() => setWarehousesLoading(false));

    // Fetch categories
    setCategoriesLoading(true);
    axiosInstance
      .get<Category[]>("/categories")
      .then((res) => setCategories(res.data))
      .catch(() => setCategories([]))
      .finally(() => setCategoriesLoading(false));

    // Fetch brands
    setBrandsLoading(true);
    axiosInstance
      .get<{ items: Brand[]; total: number }>("/brands")
      .then((res) => setBrands(res.data.items))
      .catch(() => setBrands([]))
      .finally(() => setBrandsLoading(false));
  }, []);

  // Fetch product data if in edit mode
  useEffect(() => {
    if (id) {
      setIsEdit(true);
      setFormReady(false);
      axiosInstance
        .get(`/products/${id}`)
        .then((res) => {
          const product = res.data as Product;
          setEditInitialValues({
            store: product.store?.name || "",
            warehouse: product.warehouse?.name || "",
            productName: product.name || "",
            sellingType: product.sellingType || "",
            category: product.category?.name || "",
            brand: product.brand?.name || "",
            unit: product.unit || "",
            barcodeSymbology: "", // Map if you have barcodeSymbology info
            itemBarcode: product.sku || "",
            description: product.description || "",
            qty: product.qty.toString() || "",
            price: product.price?.toString() || "",
            costingPrice: product.costingPrice?.toString() || "",
          });
          setImages(
            product.images?.map((img: any) => ({
              preview: "",
              uploadedUrl: typeof img === "string" ? img : img?.url || "",
              filename:
                typeof img === "string"
                  ? img.split("/").pop()
                  : img?.filename || undefined,
            })) || []
          );
          setFormReady(true);
        })
        .catch(() => {
          setFormReady(true);
        });
    }
  }, [id]);

  // handle file input change -> only create preview, do NOT upload yet
  const handleImageFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const next: typeof images = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const preview = URL.createObjectURL(file);
      next.push({ file, preview });
    }
    setImages((prev) => [...prev, ...next]);
    // clear input so same file can be re-selected later
    e.currentTarget.value = "";
  };

  const handleRemoveImage = (index: number) => {
    setImages((prev) => {
      const item = prev[index];
      if (item?.file && item.preview) {
        try {
          URL.revokeObjectURL(item.preview);
        } catch {}
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  // cleanup previews on unmount
  useEffect(() => {
    return () => {
      images.forEach((it) => {
        if (it.preview) {
          try {
            URL.revokeObjectURL(it.preview);
          } catch {}
        }
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Box
      sx={{
        bgcolor: "#fafbfc",
        minHeight: "100vh",
        p: { xs: 1, sm: 2, md: 4 },
        position: "relative",
      }}
    >
      <Box
        sx={{
          display: "flex",
          mb: 2,
          flexDirection: { xs: "column", sm: "row" },
        }}
      >
        <div>
          <Typography
            fontSize={17}
            variant="h5"
            fontWeight={600}
            sx={{ mr: 2 }}
          >
            {isEdit ? "Edit Product" : "Create Product"}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {isEdit ? "Edit product details" : "Create new product"}
          </Typography>
        </div>
        <Box sx={{ flexGrow: 1 }} />
        <Button
          className="back-button"
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
      </Box>
      <Paper elevation={0} sx={{ p: 0, borderRadius: 2 }}>
        <Box
          sx={{
            p: 2,
            borderBottom: "1px solid #eee",
            display: "flex",
            alignItems: "center",
          }}
        >
          <InfoOutlinedIcon color="warning" sx={{ mr: 1 }} />
          <Typography variant="subtitle1" fontWeight={600}>
            Product Information
          </Typography>
        </Box>
        {formReady ? (
          <Formik
            initialValues={isEdit ? editInitialValues : initialValues}
            enableReinitialize
            validationSchema={validationSchema}
            onSubmit={async (values, { resetForm }) => {
              setLoading(true);
              try {
                // Find IDs for dropdowns
                const categoryObj = categories.find(
                  (c) => c.name === values.category
                );
                const brandObj = brands.find((b) => b.name === values.brand);
                const storeObj = stores.find((s) => s.name === values.store);
                const warehouseObj = warehouses.find(
                  (w) => w.name === values.warehouse
                );

                // upload any selected files first, then include URLs in payload
                setUploading(true);
                const finalImageUrls: string[] = [];
                try {
                  for (const img of images) {
                    if (img.uploadedUrl) {
                      finalImageUrls.push(img.uploadedUrl);
                      continue;
                    }
                    if (!img.file) continue;

                    // Create deterministic filename (timestamp + original name)
                    const filename = `${Date.now()}-${img.file.name.replace(
                      /\s+/g,
                      "_"
                    )}`;
                    const contentType =
                      img.file.type || "application/octet-stream";

                    // Request presigned URL from backend
                    const presignRes = await axiosInstance.get(
                      "/upload/presign",
                      {
                        params: { filename, contentType },
                      }
                    );
                    const {
                      url: presignedUrl,
                      method,
                      expiresAt,
                    } = presignRes.data;
                    console.log(
                      "PRESIGNED URL host:",
                      new URL(presignedUrl).host,
                      "expiresAt:",
                      new Date(expiresAt).toISOString()
                    );

                    // If presigned URL is about to expire, request a fresh one
                    if (expiresAt && Date.now() + 5000 > expiresAt) {
                      throw new Error("Presigned URL expired, retry upload");
                    }

                    // PUT file directly to storage
                    const putResp = await fetch(presignedUrl, {
                      method: method || "PUT",
                      headers: {
                        "Content-Type": contentType,
                        // header must match what was signed (or omitted if not signed)
                        "x-amz-acl": "public-read",
                      },
                      body: img.file,
                    });
                    if (!putResp.ok) {
                      const body = await putResp.text();
                      console.error("Upload failed", putResp.status, body);
                      throw new Error(`Upload failed: ${putResp.status}`);
                    }

                    // Derive public URL from presigned URL (strip query)
                    const publicUrl = presignedUrl.split("?")[0];
                    finalImageUrls.push(publicUrl);
                  }
                } finally {
                  setUploading(false);
                }

                const payload = {
                  sku: values.itemBarcode,
                  name: values.productName,
                  category_id: categoryObj?.id,
                  brand_id: brandObj?.id,
                  price: Number(values.price), // selling price
                  unit: values.unit,
                  sellingType: values.sellingType,
                  qty: Number(values.qty),
                  createdBy: "Admin",
                  description: values.description,
                  // discounts removed
                  store_id: storeObj?.id,
                  warehouse_id: warehouseObj?.id,
                  barcodeSymbology: values.barcodeSymbology,
                  images: finalImageUrls,
                  costingPrice: Number(values.costingPrice), // costing price (new)
                };

                if (isEdit && id) {
                  await axiosInstance.put(`/products/${id}`, payload);
                  axiosInstance.post(`/system-logs/`, {
                    module: "Products",
                    action: "Update",
                    description: `${user.fullName} (${user.role}) updated a product`,
                    createdBy: user.fullName,
                  });
                  showSuccess("Product updated successfully");
                } else {
                  await axiosInstance.post("/products", payload);
                  axiosInstance.post(`/system-logs/`, {
                    module: "Products",
                    action: "Create",
                    description: `${user.fullName} (${user.role}) created a product`,
                    createdBy: user.fullName,
                  });
                  showSuccess("Product created successfully");
                }

                resetForm();
                navigate("/products");
              } catch (error: any) {
                console.error(error);
                const msg =
                  error?.response?.data?.error ||
                  error?.message ||
                  "Failed to save product";
                showError(msg);
              } finally {
                setLoading(false);
              }
            }}
          >
            {({
              errors,
              touched,
              handleChange,
              handleBlur,
              values,
              setFieldValue,
              resetForm,
            }) => (
              <Form>
                <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
                  {/* action buttons placed at the right side of Product Information card */}
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "flex-end",
                      gap: 1,
                      mb: 2,
                    }}
                  >
                    <Button
                      variant="contained"
                      onClick={async () => {
                        try {
                          const text = await navigator.clipboard.readText();
                          if (!text) return;
                          const product = JSON.parse(text);
                          // Map product object fields into form fields (safe fallbacks)
                          setFieldValue(
                            "productName",
                            product.name ?? product.product_name ?? ""
                          );
                          setFieldValue(
                            "itemBarcode",
                            product.sku ?? product.code ?? ""
                          );
                          setFieldValue(
                            "description",
                            product.description ?? ""
                          );
                          setFieldValue(
                            "qty",
                            product.qty != null ? String(product.qty) : ""
                          );
                          setFieldValue(
                            "price",
                            product.price != null ? String(product.price) : ""
                          );
                          setFieldValue(
                            "costingPrice",
                            (product.costingPrice ?? product.cost_price) != null
                              ? String(
                                  product.costingPrice ?? product.cost_price
                                )
                              : ""
                          );
                          setFieldValue(
                            "unit",
                            product.unit ?? product.unit_name ?? ""
                          );
                          setFieldValue(
                            "sellingType",
                            product.sellingType ?? ""
                          );
                          setFieldValue(
                            "barcodeSymbology",
                            product.barcodeSymbology ?? ""
                          );
                          setFieldValue(
                            "category",
                            product.category?.name ??
                              product.category_name ??
                              ""
                          );
                          setFieldValue(
                            "brand",
                            product.brand?.name ?? product.brand_name ?? ""
                          );
                          setFieldValue("store", product.store?.name ?? "");
                          setFieldValue(
                            "warehouse",
                            product.warehouse?.name ?? ""
                          );
                          // images: if product.images is an array of urls, map to uploadedUrl preview objects
                          if (Array.isArray(product.images)) {
                            setImages(
                              product.images.map((img: any) => ({
                                preview: "",
                                uploadedUrl:
                                  typeof img === "string"
                                    ? img
                                    : img?.url || "",
                                filename:
                                  typeof img === "string"
                                    ? img.split("/").pop()
                                    : img?.filename || undefined,
                              }))
                            );
                          }
                        } catch (err) {
                          console.error("Paste product failed:", err);
                          alert(
                            "Failed to paste product. Ensure clipboard contains a JSON product object."
                          );
                        }
                      }}
                      sx={{
                        bgcolor: "#fb8c00",
                        "&:hover": { bgcolor: "#f57c00" },
                        color: "#fff",
                        textTransform: "none",
                      }}
                    >
                      Paste Copied Product
                    </Button>

                    <Button
                      variant="outlined"
                      onClick={() => {
                        resetForm();
                        setImages([]);
                      }}
                      sx={{ textTransform: "none" }}
                    >
                      Clear
                    </Button>
                  </Box>
                  <Grid container spacing={2}>
                    {/* Store Dropdown */}
                    <Grid item xs={12} sm={6}>
                      <FormControl
                        fullWidth
                        error={touched.store && !!errors.store}
                      >
                        <InputLabel>
                          Store <span style={{ color: "#f44336" }}>*</span>
                        </InputLabel>
                        <Select
                          name="store"
                          value={stores.length > 0 ? values.store : ""}
                          label="Store *"
                          onChange={handleChange}
                          onBlur={handleBlur}
                          disabled={storesLoading}
                          endAdornment={
                            storesLoading ? (
                              <CircularProgress size={20} />
                            ) : null
                          }
                        >
                          {stores.map((store) => (
                            <MenuItem key={store.id} value={store.name}>
                              {store.name}
                            </MenuItem>
                          ))}
                        </Select>
                        <FormHelperText>
                          {touched.store && errors.store
                            ? errors.store
                            : storesLoading
                            ? "Loading stores..."
                            : ""}
                        </FormHelperText>
                      </FormControl>
                    </Grid>
                    {/* Warehouse Dropdown */}
                    <Grid item xs={12} sm={6}>
                      <FormControl
                        fullWidth
                        error={touched.warehouse && !!errors.warehouse}
                      >
                        <InputLabel>
                          Warehouse <span style={{ color: "#f44336" }}>*</span>
                        </InputLabel>
                        <Select
                          name="warehouse"
                          value={warehouses.length > 0 ? values.warehouse : ""}
                          label="Warehouse *"
                          onChange={handleChange}
                          onBlur={handleBlur}
                          disabled={warehousesLoading}
                          endAdornment={
                            warehousesLoading ? (
                              <CircularProgress size={20} />
                            ) : null
                          }
                        >
                          {warehouses.map((warehouse) => (
                            <MenuItem key={warehouse.id} value={warehouse.name}>
                              {warehouse.name}
                            </MenuItem>
                          ))}
                        </Select>
                        <FormHelperText>
                          {touched.warehouse && errors.warehouse
                            ? errors.warehouse
                            : warehousesLoading
                            ? "Loading warehouses..."
                            : ""}
                        </FormHelperText>
                      </FormControl>
                    </Grid>
                    {/* Product Name Field */}
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label={
                          <>
                            Product Name{" "}
                            <span style={{ color: "#f44336" }}>*</span>
                          </>
                        }
                        name="productName"
                        value={values.productName}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        error={touched.productName && !!errors.productName}
                        helperText={touched.productName && errors.productName}
                        sx={{ mb: 2 }}
                      />
                    </Grid>
                    {/* Selling Type Dropdown */}
                    <Grid item xs={12} sm={6}>
                      <FormControl
                        fullWidth
                        error={touched.sellingType && !!errors.sellingType}
                      >
                        <InputLabel>
                          Selling Type{" "}
                          <span style={{ color: "#f44336" }}>*</span>
                        </InputLabel>
                        <Select
                          name="sellingType"
                          value={values.sellingType}
                          label="Selling Type *"
                          onChange={handleChange}
                          onBlur={handleBlur}
                        >
                          {sellingTypes.map((type) => (
                            <MenuItem key={type} value={type}>
                              {type}
                            </MenuItem>
                          ))}
                        </Select>
                        <FormHelperText>
                          {touched.sellingType && errors.sellingType
                            ? errors.sellingType
                            : ""}
                        </FormHelperText>
                      </FormControl>
                    </Grid>
                    {/* Category Dropdown */}
                    <Grid item xs={12} sm={6}>
                      <FormControl
                        fullWidth
                        error={touched.category && !!errors.category}
                      >
                        <InputLabel>
                          Category <span style={{ color: "#f44336" }}>*</span>
                        </InputLabel>
                        <Select
                          name="category"
                          value={categories.length > 0 ? values.category : ""}
                          label="Category *"
                          onChange={handleChange}
                          onBlur={handleBlur}
                          disabled={categoriesLoading}
                          endAdornment={
                            categoriesLoading ? (
                              <CircularProgress size={20} />
                            ) : null
                          }
                        >
                          {categories.map((cat) => (
                            <MenuItem key={cat.id} value={cat.name}>
                              {cat.name}
                            </MenuItem>
                          ))}
                        </Select>
                        <FormHelperText>
                          {touched.category && errors.category
                            ? errors.category
                            : categoriesLoading
                            ? "Loading categories..."
                            : ""}
                        </FormHelperText>
                      </FormControl>
                    </Grid>
                    {/* Unit Dropdown */}
                    <Grid item xs={12} sm={6}>
                      <FormControl
                        fullWidth
                        error={touched.unit && !!errors.unit}
                      >
                        <InputLabel>
                          Unit <span style={{ color: "#f44336" }}>*</span>
                        </InputLabel>
                        <Select
                          name="unit"
                          value={values.unit}
                          label="Unit *"
                          onChange={handleChange}
                          onBlur={handleBlur}
                        >
                          {units.map((unit) => (
                            <MenuItem key={unit} value={unit}>
                              {unit}
                            </MenuItem>
                          ))}
                        </Select>
                        <FormHelperText>
                          {touched.unit && errors.unit ? errors.unit : ""}
                        </FormHelperText>
                      </FormControl>
                    </Grid>
                    {/* Brand Dropdown */}
                    <Grid item xs={12} sm={6}>
                      <FormControl
                        fullWidth
                        error={touched.brand && !!errors.brand}
                      >
                        <InputLabel>
                          Brand <span style={{ color: "#f44336" }}>*</span>
                        </InputLabel>
                        <Select
                          name="brand"
                          value={brands.length > 0 ? values.brand : ""}
                          label="Brand *"
                          onChange={handleChange}
                          onBlur={handleBlur}
                          disabled={brandsLoading}
                          endAdornment={
                            brandsLoading ? (
                              <CircularProgress size={20} />
                            ) : null
                          }
                        >
                          {brands.map((brand) => (
                            <MenuItem key={brand.id} value={brand.name}>
                              {brand.name}
                            </MenuItem>
                          ))}
                        </Select>
                        <FormHelperText>
                          {touched.brand && errors.brand
                            ? errors.brand
                            : brandsLoading
                            ? "Loading brands..."
                            : ""}
                        </FormHelperText>
                      </FormControl>
                    </Grid>
                    {/* Barcode Symbology Dropdown */}
                    <Grid item xs={12} sm={6}>
                      <FormControl
                        fullWidth
                        error={
                          touched.barcodeSymbology && !!errors.barcodeSymbology
                        }
                      >
                        <InputLabel>Barcode Symbology</InputLabel>
                        <Select
                          name="barcodeSymbology"
                          value={values.barcodeSymbology}
                          label="Barcode Symbology *"
                          onChange={handleChange}
                          onBlur={handleBlur}
                        >
                          {barcodeSymbologies.map((sym) => (
                            <MenuItem key={sym} value={sym}>
                              {sym}
                            </MenuItem>
                          ))}
                        </Select>
                        <FormHelperText>
                          {touched.barcodeSymbology && errors.barcodeSymbology
                            ? errors.barcodeSymbology
                            : ""}
                        </FormHelperText>
                      </FormControl>
                    </Grid>
                    {/* Item Barcode Field */}
                    <Grid item xs={12} sm={6}>
                      <Box sx={{ position: "relative", mb: 2 }}>
                        <TextField
                          fullWidth
                          label={
                            <>
                              Item Barcode{" "}
                              <span style={{ color: "#f44336" }}>*</span>
                            </>
                          }
                          name="itemBarcode"
                          value={values.itemBarcode}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          error={touched.itemBarcode && !!errors.itemBarcode}
                          helperText={touched.itemBarcode && errors.itemBarcode}
                        />
                        {/* Generate button removed as requested */}
                      </Box>
                    </Grid>
                    {/* Description Field */}
                    <Grid item xs={12}>
                      <Typography
                        variant="body2"
                        fontWeight={500}
                        sx={{ mb: 1 }}
                      >
                        Description
                      </Typography>
                      <TextField
                        fullWidth
                        multiline
                        rows={4}
                        name="description"
                        value={values.description}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        placeholder="Enter product description"
                        sx={{ mb: 2 }}
                      />
                    </Grid>

                    {/* Images Section - matches Product Information / Pricing & Stocks design */}
                    <Grid item xs={12}>
                      <Paper
                        elevation={0}
                        sx={{
                          mt: 3,
                          borderRadius: 2,
                          bgcolor: "#fff",
                          boxShadow: 0,
                          border: "1px solid #eee",
                        }}
                      >
                        <Box
                          sx={{
                            p: 2,
                            borderBottom: "1px solid #eee",
                            display: "flex",
                            alignItems: "center",
                          }}
                        >
                          <ImageOutlinedIcon color="warning" sx={{ mr: 1 }} />
                          <Typography variant="subtitle1" fontWeight={600}>
                            Images
                          </Typography>
                        </Box>

                        <Box sx={{ p: 3 }}>
                          <Stack
                            direction="row"
                            spacing={2}
                            alignItems="flex-start"
                            flexWrap="wrap"
                          >
                            <label htmlFor="product-images">
                              <input
                                id="product-images"
                                type="file"
                                accept="image/*"
                                multiple
                                style={{ display: "none" }}
                                onChange={handleImageFiles}
                              />
                              <Paper
                                elevation={0}
                                sx={{
                                  width: 120,
                                  height: 120,
                                  border: "2px dashed #e0e0e0",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  cursor: "pointer",
                                  color: "text.secondary",
                                  p: 1,
                                }}
                              >
                                <Box textAlign="center">
                                  <Typography
                                    variant="h6"
                                    color="text.secondary"
                                  >
                                    +
                                  </Typography>
                                  <Typography variant="caption">
                                    Add Images
                                  </Typography>
                                </Box>
                              </Paper>
                            </label>

                            {images.map((img, idx) => (
                              <Paper
                                key={idx}
                                elevation={0}
                                sx={{
                                  width: 120,
                                  height: 120,
                                  borderRadius: 1,
                                  overflow: "hidden",
                                  position: "relative",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                <img
                                  src={
                                    // support preview (new file), uploadedUrl (already uploaded), or legacy url
                                    (img as any).preview ||
                                    img.uploadedUrl ||
                                    (img as any).url
                                  }
                                  alt={`img-${idx}`}
                                  style={{
                                    maxWidth: "100%",
                                    maxHeight: "100%",
                                    objectFit: "cover",
                                  }}
                                />
                                <IconButton
                                  size="small"
                                  onClick={() => handleRemoveImage(idx)}
                                  sx={{
                                    position: "absolute",
                                    top: 6,
                                    right: 6,
                                    bgcolor: "rgba(0,0,0,0.6)",
                                    "&:hover": { bgcolor: "rgba(0,0,0,0.8)" },
                                  }}
                                >
                                  <CloseIcon
                                    sx={{ color: "#fff", fontSize: 16 }}
                                  />
                                </IconButton>
                              </Paper>
                            ))}

                            {uploading && (
                              <Paper
                                elevation={0}
                                sx={{
                                  width: 120,
                                  height: 120,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  borderRadius: 1,
                                }}
                              >
                                <CircularProgress size={28} />
                              </Paper>
                            )}
                          </Stack>

                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ mt: 1, display: "block" }}
                          >
                            Upload JPG, PNG files. Max size 2MB.
                          </Typography>
                        </Box>
                      </Paper>
                    </Grid>
                  </Grid>
                  <Divider sx={{ my: 3 }} />
                  <Paper
                    elevation={0}
                    sx={{
                      mt: 3,
                      borderRadius: 2,
                      bgcolor: "#fff",
                      boxShadow: 0,
                      border: "1px solid #eee",
                    }}
                  >
                    <Box
                      sx={{
                        p: 2,
                        borderBottom: "1px solid #eee",
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      <InfoOutlinedIcon color="warning" sx={{ mr: 1 }} />
                      <Typography variant="subtitle1" fontWeight={600}>
                        Pricing & Stocks
                      </Typography>
                    </Box>
                    <Box sx={{ p: 3 }}>
                      <Grid container spacing={2}>
                        {/* Quantity */}
                        <Grid item xs={12} sm={4}>
                          <TextField
                            fullWidth
                            label={
                              <>
                                Quantity{" "}
                                <span style={{ color: "#f44336" }}>*</span>
                              </>
                            }
                            name="qty"
                            type="number"
                            value={values.qty || ""}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            error={touched.qty && !!errors.qty}
                            helperText={touched.qty && errors.qty}
                          />
                        </Grid>
                        {/* Price */}
                        <Grid item xs={12} sm={4}>
                          <TextField
                            fullWidth
                            label={
                              <>
                                Selling Price{" "}
                                <span style={{ color: "#f44336" }}>*</span>
                              </>
                            }
                            name="price"
                            type="number"
                            value={values.price || ""}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            error={touched.price && !!errors.price}
                            helperText={touched.price && errors.price}
                          />
                        </Grid>
                        {/* Costing Price */}
                        <Grid item xs={12} sm={4}>
                          <TextField
                            fullWidth
                            label={
                              <>
                                Costing Price{" "}
                                <span style={{ color: "#f44336" }}>*</span>
                              </>
                            }
                            name="costingPrice"
                            type="number"
                            value={values.costingPrice || ""}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            error={
                              touched.costingPrice && !!errors.costingPrice
                            }
                            helperText={
                              touched.costingPrice && errors.costingPrice
                            }
                          />
                        </Grid>
                      </Grid>
                    </Box>
                  </Paper>
                  <Divider sx={{ my: 3 }} />
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "flex-end",
                      alignItems: "center",
                    }}
                  >
                    <Button
                      type="submit"
                      variant="contained"
                      sx={{
                        bgcolor: "#f4b000",
                        color: "#fff",
                        borderRadius: 2,
                        boxShadow: 0,
                        textTransform: "none",
                        fontWeight: 500,
                        px: 4,
                        "&:hover": { bgcolor: "#0b1e38" },
                      }}
                      disabled={loading}
                    >
                      {loading ? (
                        <CircularProgress size={24} sx={{ color: "#fff" }} />
                      ) : isEdit ? (
                        "Update Product"
                      ) : (
                        "Save Product"
                      )}
                    </Button>
                  </Box>
                </Box>
              </Form>
            )}
          </Formik>
        ) : (
          <Box sx={{ p: 3 }}>
            <CircularProgress />
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default CreateProduct;
