import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Paper,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Stack,
  Backdrop,
  CircularProgress,
} from "@mui/material";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import axiosInstance from "../configs/axiosConfig";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const AgentsReport: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [dailyBreakdown, setDailyBreakdown] = useState<any[]>([]);
  const [monthlyBreakdown, setMonthlyBreakdown] = useState<any[]>([]);
  const [allTimeRecord, setAllTimeRecord] = useState<any>({
    agentName: "",
    commission: 0,
    /* other summary fields could be added here */
  });
  const [agents, setAgents] = useState<Array<{ id: number; fullName: string }>>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<number | "">("");
  const [dailyChartData, setDailyChartData] = useState<any>({
    labels: [],
    datasets: [
      {
        label: "Commission",
        data: [],
        backgroundColor: "#27ae60",
        borderRadius: 4,
        barPercentage: 0.7,
      },
    ],
  });
  const [monthlyChartData, setMonthlyChartData] = useState<any>({
    labels: [],
    datasets: [
      {
        label: "Commission",
        data: [],
        backgroundColor: "#27ae60",
        borderRadius: 4,
        barPercentage: 0.7,
      },
    ],
  });

  useEffect(() => {
    const fetchSummary = async () => {
      setLoading(true);
      try {
        // include agent filter if selected
        const params: any = {};
        if (selectedAgentId !== "") {
          params.agentId = selectedAgentId;
        }
        const { data } = await axiosInstance.get("/dashboard/agents/commissions", {
          params,
        });

        // all-time record
        setAllTimeRecord({
          agentName: data.allTimeRecord?.agentName || "",
          commission: Number(data.allTimeRecord?.commission || 0),
        });

        // daily chart
        const dLabels = Array.isArray(data.dailyLabels) ? data.dailyLabels : [];
        const dCom = Array.isArray(data.dailyCommission)
          ? data.dailyCommission
          : Array(dLabels.length).fill(0);

        setDailyChartData({
          labels: dLabels,
          datasets: [
            {
              label: "Commission",
              backgroundColor: "#27ae60",
              data: dCom,
              borderRadius: 4,
              barPercentage: 0.7,
            },
          ],
        });

        // monthly chart
        const mCom = Array.isArray(data.monthlyCommission)
          ? data.monthlyCommission
          : Array(12).fill(0);

        setMonthlyChartData({
          labels: months,
          datasets: [
            {
              label: "Commission",
              backgroundColor: "#27ae60",
              data: mCom,
              borderRadius: 4,
              barPercentage: 0.7,
            },
          ],
        });

        // build daily breakdown table data
        const dailyBreakdownData = dLabels.map((label: string, idx: number) => ({
          day: label, // could be day number or date string
          commission: Number(dCom[idx] || 0),
        }));
        setDailyBreakdown(dailyBreakdownData);

        // build monthly breakdown table data
        const monthlyBreakdownData = months.map((m, idx) => ({
          month: m,
          commission: Number(mCom[idx] || 0),
        }));
        setMonthlyBreakdown(monthlyBreakdownData);
      } catch (err) {
        setDailyChartData({ labels: [], datasets: [] });
        setMonthlyChartData({ labels: [], datasets: [] });
        setDailyBreakdown([]);
        setMonthlyBreakdown([]);
        setAllTimeRecord({ agentName: "", commission: 0 });
      } finally {
        setLoading(false);
      }
    };
    fetchSummary();
  }, [selectedAgentId]);

  const chartOptions: ChartOptions = {
    responsive: true,
    plugins: {
      legend: { display: true, position: "top" as const },
      title: { display: false },
    },
    scales: {
      x: { grid: { display: false } },
      y: {
        grid: { color: "#eee" },
        ticks: {
          callback: (value: any) =>
            value.toLocaleString(undefined, { minimumFractionDigits: 2 }),
        },
      },
    },
  };

  React.useEffect(() => {
    // fetch agent list once
    const loadAgents = async () => {
      try {
        const resp = await axiosInstance.get("/agents", { params: { perPage: 1000 } });
        setAgents(
          Array.isArray(resp.data.items)
            ? resp.data.items.map((a: any) => ({ id: a.id, fullName: a.fullName }))
            : []
        );
      } catch (e) {
        // ignore
      }
    };
    loadAgents();
  }, []);

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      <Backdrop
        open={loading}
        sx={{ color: "#fff", zIndex: (theme) => theme.zIndex.drawer + 1 }}
      >
        <CircularProgress color="inherit" />
      </Backdrop>
      {/* Header + filter */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Agents Report
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={2}>
            View the Agents Commission Report
          </Typography>
        </Box>
        <Box sx={{ minWidth: 200, mb: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
            Filter by agent
          </Typography>
          <select
            value={selectedAgentId}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedAgentId(val === "" ? "" : Number(val));
            }}
            style={{ width: "100%", padding: 4 }}
          >
            <option value="">All Agents</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.fullName}
              </option>
            ))}
          </select>
        </Box>
      </Box>
      <Box sx={{ display: "flex", justifyContent: "center", mb: 4 }}>
        <Box sx={{ width: "100%" }}>
          <Box
            sx={{
              bgcolor: "#23224c",
              color: "#fff",
              px: 2,
              py: 1,
              borderTopLeftRadius: 2,
              borderTopRightRadius: 2,
              textAlign: "center",
              fontWeight: 700,
              fontSize: 20,
              letterSpacing: 1,
              border: "1px solid #23224c",
            }}
          >
            ALL-TIME RECORD
          </Box>
          <Box
            sx={{
              display: "flex",
              border: "1px solid #23224c",
              borderTop: "none",
              borderBottomLeftRadius: 2,
              borderBottomRightRadius: 2,
              overflow: "hidden",
              flexDirection: { xs: "column", sm: "row" },
            }}
          >
            <Box
              sx={{
                flex: 1,
                bgcolor: "#27ae60",
                textAlign: "center",
                py: 1,
                borderRight: "1px solid #23224c",
              }}
            >
              <Typography fontWeight={700} fontSize={18} color="#fff" sx={{ mb: 0.5 }}>
                {allTimeRecord.agentName || "-"}
              </Typography>
              <Typography fontWeight={600} fontSize={15} color="#fff">
                Commission
              </Typography>
              <Typography fontWeight={700} fontSize={22} color="#fff">
                {allTimeRecord.commission.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
              </Typography>
            </Box>
          </Box>
        </Box>
      </Box>
      {/* --- Start: Two columns for Daily and Monthly Commission breakdown --- */}
      <Stack spacing={3} sx={{ mb: 3 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={3}>
          <Paper sx={{ flex: 1, p: 0, overflow: "auto" }}>
            <Box sx={{ bgcolor: "#f39c12", color: "#fff", py: 1, px: 2 }}>
              <Typography fontWeight={700}>Daily Commission Breakdown</Typography>
            </Box>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Day</TableCell>
                  <TableCell>Commission</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {dailyBreakdown.map((row) => (
                  <TableRow key={row.day}>
                      <TableCell>{row.day}</TableCell>
                    <TableCell>
                      {row.commission.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
          <Paper sx={{ flex: 1, p: 0, overflow: "auto" }}>
            <Box sx={{ bgcolor: "#f39c12", color: "#fff", py: 1, px: 2 }}>
              <Typography fontWeight={700}>Monthly Commission Breakdown</Typography>
            </Box>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Month</TableCell>
                  <TableCell>Commission</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {monthlyBreakdown.map((row) => (
                  <TableRow key={row.month}>
                    <TableCell>{row.month}</TableCell>
                    <TableCell>
                      {row.commission.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        </Stack>
      </Stack>
      {/* --- End: Two columns for Daily and Monthly --- */}
    </Box>
  );
};

export default AgentsReport;
