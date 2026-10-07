import React, { useState, useEffect } from "react";
import {
  Box,
  Paper,
  Typography,
  Stack,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Checkbox,
  TextField,
  Chip,
  Button,
  Backdrop,
  CircularProgress,
  Snackbar,
  Alert,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate, useParams } from "react-router-dom";
import { MODULES } from "../constants/modules.constant";
import axiosInstance from "../configs/axiosConfig";
import PrimaryButton from "../shared/buttons/PrimaryButton";

// All possible permissions
const allPerms = [
  "Allow All",
  "Read",
  "Create",
  "Update",
  "Delete",
  "Import",
  "Export",
];

const Permissions: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [role, setRole] = useState<{ name?: string } | null>(null);
  const [loading, setLoading] = useState(true);

  // Permissions state: { [module]: { [perm]: boolean } }
  const [permissions, setPermissions] = useState<{ [key: string]: { [key: string]: boolean } }>(() => {
    const initial: any = {};
    MODULES.forEach((mod) => {
      initial[mod.name] = {};
      allPerms.forEach((perm) => {
        initial[mod.name][perm] = false;
      });
    });
    return initial;
  });

  const [search, setSearch] = useState("");

  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMsg, setSnackbarMsg] = useState("");
  const [snackbarSeverity, setSnackbarSeverity] = useState<"success" | "error">("success");

  useEffect(() => {
    const fetchRole = async () => {
      setLoading(true);
      try {
        const res = await axiosInstance.get(`/roles/${id}`);
        setRole(res.data);

        // Preselect permissions from API response
        if (res.data.permissions) {
          setPermissions((prev) => {
            const updated: any = {};
            MODULES.forEach((mod) => {
              updated[mod.name] = {};
              allPerms.forEach((perm) => {
                // Only set perms that exist for the module
                if (perm !== "Allow All" && mod.perms.includes(perm)) {
                  updated[mod.name][perm] = !!res.data.permissions[mod.name]?.[perm];
                } else {
                  updated[mod.name][perm] = false;
                }
              });
              // Set Allow All if all perms are true
              updated[mod.name]["Allow All"] = mod.perms.every(
                (perm) => updated[mod.name][perm]
              );
            });
            return updated;
          });
        }
      } catch (err) {
        setRole({ name: "Not found" });
      }
      setLoading(false);
    };
    fetchRole();
  }, [id]);

  // Filter modules by search
  const filteredModules = MODULES.filter((mod) =>
    mod.name.toLowerCase().includes(search.toLowerCase())
  );

  // Handle checkbox change
  const handleCheck = (module: string, perm: string) => {
    setPermissions((prev) => {
      const updated = { ...prev };
      // If Allow All is checked/unchecked, set all applicable perms
      if (perm === "Allow All") {
        const isChecked = !prev[module][perm];
        MODULES
          .find((m) => m.name === module)!
          .perms.forEach((p) => {
            updated[module][p] = isChecked;
          });
        updated[module][perm] = isChecked;
      } else {
        updated[module][perm] = !prev[module][perm];
        // If all perms are checked, check Allow All
        const modPerms = MODULES.find((m) => m.name === module)!.perms;
        updated[module]["Allow All"] = modPerms.every((p) => updated[module][p]);
      }
      return updated;
    });
  };

  // Save permissions to API
  const handleSavePermissions = async () => {
    setLoading(true);
    try {
      // Prepare permissions payload: only include actual perms, not "Allow All"
      const payload: { [key: string]: { [key: string]: boolean } } = {};
      MODULES.forEach((mod) => {
        payload[mod.name] = {};
        mod.perms.forEach((perm) => {
          payload[mod.name][perm] = permissions[mod.name][perm];
        });
      });
      await axiosInstance.post(
        `/roles/${id}/permissions`,
        { permissions: payload }
      );
      setSnackbarMsg("Permissions saved successfully!");
      setSnackbarSeverity("success");
      setSnackbarOpen(true);
    } catch (err) {
      setSnackbarMsg("Failed to save permissions.");
      setSnackbarSeverity("error");
      setSnackbarOpen(true);
    }
    setLoading(false);
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      <Backdrop open={loading} sx={{ color: "#fff", zIndex: 9999 }}>
        <CircularProgress color="inherit" />
      </Backdrop>
      {/* Page Title and Subtitle */}
      <Stack justifyContent="space-between" sx={{ mb: 3, flexDirection: { xs: "column", sm: "row" } }}>
        <Box>
          <Typography variant="h5" fontSize={17} fontWeight={700}>
            Role Permissions
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage permissions for this role
          </Typography>
        </Box>
        <Button
          className="back-button"
          startIcon={<ArrowBackIcon />}
          variant="contained"
          sx={{ mt: { xs: 2, sm: 0 }, bgcolor: "#1a2c4b", color: "#fff", boxShadow: 0, textTransform: "none" }}
          onClick={() => navigate("/roles")}
        >
          Back to Roles
        </Button>
      </Stack>
      <Paper sx={{ p: 3, mb: 3 }}>
        {/* Align search and role label/value */}
        <Stack direction="row" justifyContent="space-between" sx={{ mb: 2, flexDirection: { xs: "column", sm: "row" } }}>
          <TextField
            placeholder="Search"
            size="small"
            variant="outlined"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{
              width: { xs: "100%", sm: 260 },
              bgcolor: "#fafbfc",
              "& .MuiInputBase-input": { pl: 2 },
            }}
          />
          <Stack direction="row" alignItems="center" gap={1} sx={{ mt: { xs: 3, sm: 0 } }}>
            <Typography variant="h6" fontWeight={600}>
              Role:
            </Typography>
            <Chip label={role?.name || ""} color="primary" sx={{ fontWeight: 700 }} />
          </Stack>
        </Stack>
        <Box sx={{ width: "100%", overflowX: "auto" }}>
          <Table sx={{ minWidth: 900 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Modules</TableCell>
                {allPerms.map((perm) => (
                  <TableCell key={perm} sx={{ fontWeight: 700, textAlign: "center" }}>
                    {perm}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredModules.map((mod) => (
                <TableRow key={mod.name}>
                  <TableCell sx={{ fontWeight: 500 }}>{mod.name}</TableCell>
                  {allPerms.map((perm) => (
                    <TableCell key={perm} align="center">
                      <Checkbox
                        checked={permissions[mod.name][perm]}
                        disabled={perm !== "Allow All" && !mod.perms.includes(perm)}
                        onChange={() => handleCheck(mod.name, perm)}
                        color="primary"
                        size="small"
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>

        {/* Save Permissions button moved inside the card, right aligned */}
        <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 2 }}>
          <PrimaryButton
            onClick={handleSavePermissions}
            textBtn="Save Permissions"
            sx={{ bgcolor: "#f39c12", "&:hover": { bgcolor: "#f4b000" }, textTransform: "none", fontWeight: 700 }}
          />
        </Box>
      </Paper>
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert
          onClose={() => setSnackbarOpen(false)}
          severity={snackbarSeverity}
          sx={{ width: "100%" }}
        >
          {snackbarMsg}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Permissions;