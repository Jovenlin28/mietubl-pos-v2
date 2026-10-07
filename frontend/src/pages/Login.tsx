import React, { useState } from "react";
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  FormControlLabel,
  Switch,
  InputAdornment,
  CircularProgress,
  Backdrop,
  Alert,
} from "@mui/material";
import PersonIcon from "@mui/icons-material/Person";
import LockIcon from "@mui/icons-material/Lock";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import IconButton from "@mui/material/IconButton";
import axios from "axios";
import axiosInstance from "../configs/axiosConfig";

const Login: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState(""); // changed from email to username
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string>("");

  const [keepLoggedIn, setKeepLoggedIn] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validatePassword = (pwd: string) => {
    if (!pwd || pwd.length === 0) {
      return "Password is required.";
    }
    if (pwd.length < 6) {
      return "Password must be at least 6 characters.";
    }
    if (!/[A-Za-z0-9]/.test(pwd)) {
      return "Password must contain at least one alphanumeric character.";
    }
    return "";
  };

  // update handler ensures validation runs as user types
  const handlePasswordChange = (value: string) => {
    setPassword(value);
    setPasswordError(validatePassword(value));
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const pwdErr = validatePassword(password);
    if (pwdErr) {
      setPasswordError(pwdErr);
      setLoading(false);
      return;
    }

    try {
      const res = await axiosInstance.post("/login", {
        username,
        password,
      });
      // Save token or user info as needed
      if (res.data && res.data.token) {
        if (keepLoggedIn) {
          localStorage.setItem("token", res.data.token);
        } else {
          sessionStorage.setItem("token", res.data.token);
        }
        // Redirect to dashboard or home
        window.location.href = "/";
      } else {
        setError("Invalid response from server.");
      }
    } catch (err: any) {
      setError(
        err.response?.data?.error ||
          "Login failed. Please check your credentials."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        width: "100%", // use 100% instead of 100vw to avoid horizontal overflow
        overflowX: "hidden", // prevent any horizontal overflow from showing
        bgcolor: "#f9fafd",
        // improved background: subtle multi-stop gradient overlay + image,
        // fixed on larger screens for a parallax effect, non-fixed on mobile
        backgroundImage: [
          // gradient layer for contrast and color tint
          "linear-gradient(135deg, rgba(15,40,48,0.65) 0%, rgba(64,115,120,0.45) 60%, rgba(255,255,255,0.02) 100%)",
          // subtle radial vignette to focus center
          "radial-gradient(circle at 50% 30%, rgba(0,0,0,0.15), rgba(0,0,0,0.45))",
          // actual background photo
          "url('/POS-bg.jfif')",
        ].join(", "),
        backgroundRepeat: "no-repeat",
        backgroundSize: "cover",
        backgroundPosition: "center center",
        backgroundBlendMode: "overlay, multiply, normal",
        backgroundAttachment: { xs: "scroll", sm: "fixed" },
        display: "flex",
        alignItems: "center",
        justifyContent: "center", // center horizontally and vertically
        py: { xs: 6, sm: 0 }, // give equal vertical spacing on small screens
        px: { xs: 2, sm: 0 }, // horizontal padding to prevent touching screen edges on mobile
        boxSizing: "border-box",
      }}
    >
      <Backdrop open={loading} sx={{ color: "#fff", zIndex: 9999 }}>
        <CircularProgress color="inherit" />
      </Backdrop>
      <Box
        sx={{
          width: "100%",
          maxWidth: 420,
          px: { xs: 1, sm: 0 }, // ensure inner horizontal padding on very small screens
          mx: "auto",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          boxSizing: "border-box",
        }}
      >
        <Box
          component="img"
          src="/mietubl-logo.png"
          alt="Mietubl Logo"
          sx={{
            width: { xs: 200, sm: 280 }, // keep logo smaller on mobile so it doesn't force overflow
            height: "auto",
            display: "block",
            objectFit: "contain",
          }}
        />
        <Typography
          variant="subtitle1"
          color="#fff"
          sx={{ mb: 2, mt: -2, textAlign: "center" }}
        >
          Online inventory management system
        </Typography>
        <Paper
          elevation={3}
          sx={{
            p: { xs: 1.5, sm: 4 }, // slightly tighter on mobile
            borderRadius: 3,
            width: "100%",
            maxWidth: 400,
            mx: "auto",
            boxSizing: "border-box",
            zIndex: 2,
          }}
        >
          <Typography variant="h5" fontWeight={700} mb={1}>
            Login
          </Typography>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <Box component="form" onSubmit={handleLogin} sx={{ mt: 2 }}>
            <TextField
              fullWidth
              margin="normal"
              placeholder="Username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PersonIcon sx={{ color: "#bdbdbd" }} />
                  </InputAdornment>
                ),
              }}
              autoComplete="username"
              required
            />
            <TextField
              fullWidth
              margin="normal"
              placeholder="Password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => handlePasswordChange(e.target.value)}
              error={!!passwordError}
              helperText={passwordError || ""}
              FormHelperTextProps={{ sx: { mt: 0.5 } }}
              inputProps={{ maxLength: 128 }}
              aria-describedby="password-requirements"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockIcon sx={{ color: "#bdbdbd" }} />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                      onClick={() => setShowPassword((v) => !v)}
                      edge="end"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              autoComplete="current-password"
              required
            />
            {/* accessible explanation of validation rules */}{" "}
            <Typography
              id="password-requirements"
              variant="caption"
              color="text.secondary"
              sx={{ display: "block", mt: 0.5 }}
            >
              Minimum 6 characters — must include at least one alphanumeric
              character. {" "}
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={keepLoggedIn}
                  onChange={() => setKeepLoggedIn((v) => !v)}
                  color="primary"
                />
              }
              label="Keep me logged in"
              sx={{ mt: 1, mb: 2 }}
            />
            <Button
              fullWidth
              type="submit"
              variant="contained"
              sx={{
                mt: 1,
                py: 1.2,
                fontWeight: 600,
                fontSize: "1rem",
                background: "#f39c12",
                boxShadow: "0 4px 16px 0 rgba(30,144,255,0.10)",
              }}
              disabled={loading || !!passwordError || !username}
            >
              LOG IN
            </Button>
          </Box>
        </Paper>
      </Box>
    </Box>
  );
};

export default Login;
