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
  CircularProgress,
  IconButton,
  Backdrop,
  TableSortLabel,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import axiosInstance from "../configs/axiosConfig";

const SystemLogs: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  // search (applied on submit)
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  // pagination & sorting
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sortBy, setSortBy] = useState<string>("createdOn");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const fetchSystemLogs = async (
    pageNum = page,
    perPageNum = rowsPerPage,
    searchTerm = search,
    sortByParam?: string,
    sortDirParam?: string
  ) => {
    setLoading(true);
    try {
      const res = await axiosInstance.get("/system-logs", {
        params: {
          perPage: perPageNum,
          currentPage: pageNum + 1,
          search: (searchTerm || "").trim(),
          sortBy: sortByParam ?? sortBy,
          sortDir: sortDirParam ?? sortDir,
        },
      });
      setItems(res.data.items || []);
      setTotal(res.data.total || 0);
      setPage(pageNum);
    } catch (err) {
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSystemLogs(page, rowsPerPage, search, sortBy, sortDir);
    // eslint-disable-next-line
  }, [page, rowsPerPage, sortBy, sortDir]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = (searchInput || "").trim();
    setPage(0);
    setSearch(q);
    fetchSystemLogs(0, rowsPerPage, q);
  };

  const handleClearSearch = () => {
    setSearchInput("");
    setSearch("");
    setPage(0);
    fetchSystemLogs(0, rowsPerPage, "");
  };

  const handleRefresh = () => {
    setPage(0);
    setSearch("");
    setSearchInput("");
    fetchSystemLogs(0, rowsPerPage, "");
  };

  const handleSort = (columnId: string) => {
    let newDir: "asc" | "desc" = "asc";
    if (sortBy === columnId) newDir = sortDir === "asc" ? "desc" : "asc";
    setSortBy(columnId);
    setSortDir(newDir);
    setPage(0);
    fetchSystemLogs(0, rowsPerPage, search, columnId, newDir);
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      <Backdrop open={loading} sx={{ color: "#fff", zIndex: 9999 }}>
        <CircularProgress color="inherit" />
      </Backdrop>

      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="flex-start"
        sx={{ mb: 3, flexDirection: { xs: "column", sm: "row" } }}
      >
        <Box>
          <Typography variant="h5" fontWeight={600}>
            System Logs
          </Typography>
          <Typography variant="body2" color="text.secondary">
            View application system logs
          </Typography>
        </Box>

        <Box>
          <Button
            variant="contained"
            startIcon={<RefreshIcon />}
            sx={{ bgcolor: "#95a5a6", color: "#fff", boxShadow: 0 }}
            onClick={handleRefresh}
          >
            REFRESH
          </Button>
        </Box>
      </Stack>

      <Paper sx={{ p: 3, mb: 3, overflow: "auto" }}>
        <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
          <form onSubmit={handleSearch} style={{ width: "100%" }}>
            <TextField
              placeholder="Search"
              size="small"
              variant="outlined"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              sx={{
                width: { xs: "100%", sm: 300 },
                bgcolor: "#fafbfc",
                "& .MuiInputBase-input": { pl: 2 },
              }}
              InputProps={{
                endAdornment: (
                  <>
                    <IconButton
                      size="small"
                      aria-label="clear-search"
                      onClick={handleClearSearch}
                      sx={{ visibility: searchInput ? "visible" : "hidden" }}
                    >
                      <CloseIcon />
                    </IconButton>
                    <IconButton type="submit" size="small" aria-label="search">
                      <SearchIcon />
                    </IconButton>
                  </>
                ),
              }}
            />
          </form>
        </Stack>

        <Box sx={{ width: "100%", overflowX: "auto" }}>
          <Table sx={{ minWidth: 900 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Module</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Action</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Description</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>
                  <TableSortLabel
                    active={sortBy === "createdOn"}
                    direction={sortBy === "createdOn" ? sortDir : "desc"}
                    onClick={() => handleSort("createdOn")}
                  >
                    Created On
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Created By</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? null : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    No records found
                  </TableCell>
                </TableRow>
              ) : (
                items.map((row, idx) => (
                  <TableRow key={row.id || idx}>
                    <TableCell>{row.module || "-"}</TableCell>
                    <TableCell>{row.action || "-"}</TableCell>
                    <TableCell style={{ maxWidth: 420, whiteSpace: "normal" }}>
                      {row.description || "-"}
                    </TableCell>
                    <TableCell>
                      {row.createdOn ? new Date(row.createdOn).toLocaleString() : "-"}
                    </TableCell>
                    <TableCell>{row.createdBy || "-"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Box>

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
    </Box>
  );
};

export default SystemLogs;