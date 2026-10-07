import React, { useEffect, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  Grid,
  Avatar,
  Button,
  TextField,
  Stack,
  CircularProgress,
  InputAdornment,
  IconButton,
} from "@mui/material";
import CameraAltIcon from "@mui/icons-material/CameraAlt";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import { useFormik } from "formik";
import * as Yup from "yup";
import { jwtDecode } from "jwt-decode";
import { useSnackbar } from "notistack";
import axiosInstance from "../configs/axiosConfig";

interface ProfileValues {
  fullName: string;
  userName: string;
  phone: string;
  password: string;
  role?: string;
  status?: string;
  avatar?: string | null;
  avatarFile?: File | null;
}

const validationSchema = Yup.object({
  fullName: Yup.string().required("Full name is required"),
  userName: Yup.string().required("User name is required"),
  password: Yup.string().min(6, "Password must be at least 6 characters"),
});

const Profile: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | number | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const { enqueueSnackbar } = useSnackbar();

  const formik = useFormik<ProfileValues>({
    initialValues: {
      fullName: "",
      userName: "",
      phone: "",
      password: "",
      role: "",
      status: "",
      avatar: null,
      avatarFile: null,
    },
    validationSchema,
    enableReinitialize: true,
    onSubmit: async (values) => {
      if (!userId) return;
      setSaving(true);
      try {
        // If user changed avatar file, upload it first and get URL
        let avatarUrl = values.avatar || null;
        if (values.avatarFile && values.avatarFile instanceof File) {
          // create deterministic filename and request presigned PUT URL
          const filename = `${Date.now()}-${values.avatarFile.name.replace(
            /\s+/g,
            "_"
          )}`;
          const contentType = values.avatarFile.type || "application/octet-stream";

          const presignRes = await axiosInstance.get("/upload/presign", {
            params: { filename, contentType },
          });
          const { url: presignedUrl, method, expiresAt } = presignRes.data;

          if (expiresAt && Date.now() + 5000 > expiresAt) {
            throw new Error("Presigned URL expired, retry upload");
          }

          const putResp = await fetch(presignedUrl, {
            method: method || "PUT",
            headers: {
              "Content-Type": contentType,
              "x-amz-acl": "public-read",
            },
            body: values.avatarFile,
          });
          if (!putResp.ok) {
            const body = await putResp.text();
            console.error("Avatar upload failed", putResp.status, body);
            throw new Error(`Avatar upload failed: ${putResp.status}`);
          }

          // derive public URL from presigned URL
          avatarUrl = presignedUrl.split("?")[0];
        }

        // send update and capture response
        const res = await axiosInstance.put(`/users/${userId}`, {
          fullName: values.fullName,
          username: values.userName,
          phone: values.phone,
          password: values.password || "",
          role: values.role || "",
          status: values.status || "",
          avatar: avatarUrl,
        });

        // If backend returned a new token, replace stored token so decoded profile is up-to-date
        const newToken = res?.data?.token;
        if (newToken) {
          if (localStorage.getItem("token")) {
            localStorage.setItem("token", newToken);
          } else {
            sessionStorage.setItem("token", newToken);
          }
        }
        enqueueSnackbar("Profile updated successfully", { variant: "success" });
        // Optionally refresh token/user info elsewhere
      } catch (err: any) {
        const msg =
          err?.response?.data?.error ||
          err?.message ||
          "Failed to update profile";
        enqueueSnackbar(msg, { variant: "error" });
        console.error("Failed to update profile", err);
      } finally {
        setSaving(false);
      }
    },
  });

  useEffect(() => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      if (token) {
        const decoded: any = jwtDecode(token);
        setUserId(decoded?.id ?? null);
        formik.setValues({
          fullName:
            decoded?.fullName || decoded?.full_name || decoded?.name || "",
          userName:
            decoded?.username || decoded?.userName || decoded?.sub || "",
          phone: decoded?.phone || decoded?.tel || "",
          password: "",
          role: decoded?.role || "",
          status: decoded?.status || "",
          avatar: decoded?.avatar || null,
          avatarFile: null,
        });
      }
    } catch (err) {
      console.error("Failed to decode token", err);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    formik.setFieldValue("avatarFile", file);
    const reader = new FileReader();
    reader.onload = () =>
      formik.setFieldValue("avatar", reader.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      <Typography variant="h5" fontWeight={700}>
        Profile
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={2}>
        User Profile
      </Typography>

      <Paper sx={{ p: { xs: 2, sm: 2, md: 4 } }}>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <Typography variant="h6" fontWeight={700} gutterBottom>
              Profile
            </Typography>

            <Box sx={{ borderTop: "1px solid #eee", mt: 2, pt: 3 }}>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                Basic Information
              </Typography>

              <Grid container spacing={3} direction="column">
                <Grid
                  item
                  xs={12}
                  md={3}
                  lg={2}
                  sx={{
                    // add horizontal spacing on md+ and vertical spacing on small screens
                    pr: { md: 4 },
                    mb: { xs: 2, md: 0 },
                  }}
                >
                  <Stack spacing={2} alignItems="flex-start">
                    <Avatar
                      src={formik.values.avatar || undefined}
                      alt="avatar"
                      sx={{ width: 96, height: 96, borderRadius: 1 }}
                    />
                    <label htmlFor="avatar-upload">
                      <input
                        id="avatar-upload"
                        type="file"
                        accept="image/*"
                        style={{ display: "none" }}
                        onChange={handleAvatarChange}
                      />
                      <Button
                        variant="contained"
                        component="span"
                        startIcon={<CameraAltIcon />}
                        sx={{
                          bgcolor: "#f39c12",
                          px: 3, // equal horizontal padding
                          py: 1.25,
                          whiteSpace: "nowrap", // prevent icon/text wrapping to multiple lines
                        }}
                      >
                        Change Image
                      </Button>
                    </label>
                    <Typography variant="caption" color="text.secondary">
                      Upload an image below 2 MB, Accepted File format JPG, PNG
                    </Typography>
                  </Stack>
                </Grid>

                <Grid item xs={12} md={9} lg={10}>
                  <form onSubmit={formik.handleSubmit}>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          label="Full Name"
                          name="fullName"
                          value={formik.values.fullName}
                          onChange={formik.handleChange}
                          onBlur={formik.handleBlur}
                          error={Boolean(
                            formik.touched.fullName && formik.errors.fullName
                          )}
                          helperText={
                            formik.touched.fullName && formik.errors.fullName
                          }
                        />
                      </Grid>

                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          label="User Name"
                          name="userName"
                          value={formik.values.userName}
                          onChange={formik.handleChange}
                          onBlur={formik.handleBlur}
                          error={Boolean(
                            formik.touched.userName && formik.errors.userName
                          )}
                          helperText={
                            formik.touched.userName && formik.errors.userName
                          }
                          required
                        />
                      </Grid>

                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          label="Phone Number"
                          name="phone"
                          value={formik.values.phone}
                          onChange={formik.handleChange}
                          onBlur={formik.handleBlur}
                          error={Boolean(
                            formik.touched.phone && formik.errors.phone
                          )}
                          helperText={
                            formik.touched.phone && formik.errors.phone
                          }
                        />
                      </Grid>

                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          label="Password"
                          name="password"
                          type={showPassword ? "text" : "password"}
                          value={formik.values.password}
                          onChange={formik.handleChange}
                          onBlur={formik.handleBlur}
                          error={Boolean(
                            formik.touched.password && formik.errors.password
                          )}
                          helperText={
                            formik.touched.password && formik.errors.password
                          }
                          InputProps={{
                            endAdornment: (
                              <InputAdornment position="end">
                                <IconButton
                                  aria-label={showPassword ? "Hide password" : "Show password"}
                                  onClick={() => setShowPassword((s) => !s)}
                                  edge="end"
                                >
                                  {showPassword ? <VisibilityOff /> : <Visibility />}
                                </IconButton>
                              </InputAdornment>
                            ),
                          }}
                        />
                      </Grid>

                      <Grid
                        item
                        xs={12}
                        sx={{
                          display: "flex",
                          justifyContent: "flex-end",
                          gap: 2,
                          mt: 1,
                        }}
                      >
                        <Button
                          type="submit"
                          variant="contained"
                          sx={{ bgcolor: "#f39c12", color: "#fff" }}
                          disabled={saving}
                        >
                          {saving ? "Saving..." : "Save Changes"}
                        </Button>
                      </Grid>
                    </Grid>
                  </form>
                </Grid>
              </Grid>
            </Box>
          </>
        )}
      </Paper>
    </Box>
  );
};

export default Profile;
