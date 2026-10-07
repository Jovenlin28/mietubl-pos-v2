import React, { useState, useContext } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Tooltip,
  Box,
  Divider,
  Typography,
  useTheme,
  useMediaQuery,
  Avatar,
  Stack,
  Button,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import MenuIcon from "@mui/icons-material/Menu";
import DashboardIcon from "@mui/icons-material/Dashboard";
import StoreIcon from "@mui/icons-material/Store";
import CategoryIcon from "@mui/icons-material/Category";
import InventoryIcon from "@mui/icons-material/Inventory";
import PeopleIcon from "@mui/icons-material/People";
import ContactsIcon from "@mui/icons-material/Contacts";
import DiscountIcon from "@mui/icons-material/Percent";
import ReceiptIcon from "@mui/icons-material/Receipt";
import WarehouseIcon from "@mui/icons-material/Warehouse";
import MoneyIcon from "@mui/icons-material/AttachMoney";
import BarChartIcon from "@mui/icons-material/BarChart";
import AssessmentIcon from "@mui/icons-material/Assessment";
import PieChartIcon from "@mui/icons-material/PieChart";
import LogoutIcon from "@mui/icons-material/Logout";
import People from "@mui/icons-material/People";
import { Close } from "@mui/icons-material";
import SecurityIcon from "@mui/icons-material/Security";
import DescriptionIcon from "@mui/icons-material/Description";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import CreditCardIcon from "@mui/icons-material/CreditCard";
import MonetizationOnIcon from "@mui/icons-material/MonetizationOn";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import { PermissionsContext } from "../../layouts/DashboardLayout";
import { jwtDecode } from "jwt-decode";

const drawerWidth = 280; // widened by +50 (was 260)
const collapsedWidth = 104; // increased correspondingly (was 64)

const sections = [
  {
    label: "Main",
    items: [
      { label: "Dashboard", icon: <DashboardIcon />, path: "/dashboard" },
      { label: "Quotations", icon: <DescriptionIcon />, path: "/quotations" },
      { label: "Purchase Orders", icon: <ReceiptIcon />, path: "/sales" },
      {
        label: "Customer Purchase Orders",
        icon: <ReceiptIcon />,
        path: "/customer-purchase-orders",
      },
      {
        label: "Deliveries Monitoring",
        icon: <LocalShippingIcon />,
        path: "/deliveries-monitoring",
      },
      {
        label: "Payments Monitoring",
        icon: <MoneyIcon />,
        path: "/payments-monitoring",
      },
      { label: "System Logs", icon: <DescriptionIcon />, path: "/system-logs" },
    ],
  },
  {
    label: "Inventory",
    items: [
      { label: "Products", icon: <InventoryIcon />, path: "/products" },
      { label: "Categories", icon: <CategoryIcon />, path: "/categories" },
      { label: "Brands", icon: <StoreIcon />, path: "/brands" },
      { label: "Warehouses", icon: <WarehouseIcon />, path: "/warehouses" },
      { label: "Stores", icon: <StoreIcon />, path: "/stores" },
      {
        label: "Stock In Logs",
        icon: <InventoryIcon />,
        path: "/stock-in-logs",
      },
    ],
  },
  {
    label: "Sales & Expenses",
    items: [
      { label: "Expense Listing", icon: <MoneyIcon />, path: "/expenses" },
      {
        label: "Expense Categories",
        icon: <CategoryIcon />,
        path: "/expense-categories",
      },
      { label: "Expense Budget Management", icon: <MoneyIcon />, path: "/expense-budget-management" },
    ],
  },
  {
    label: "Reports",
    items: [
      {
        label: "Sales Report",
        icon: <AssessmentIcon />,
        path: "/sales-report",
      },
      {
        label: "Expense Report",
        icon: <PieChartIcon />,
        path: "/expense-report",
      },
      {
        label: "Agents Report",
        icon: <AssessmentIcon />,
        path: "/agents-report",
      },
    ],
  },
  {
    label: "Users Management",
    items: [
      { label: "Customers", icon: <ContactsIcon />, path: "/customers" },
      { label: "Agents", icon: <ContactsIcon />, path: "/agents" },
      { label: "Users", icon: <People />, path: "/users" },
      { label: "Roles & Permissions", icon: <SecurityIcon />, path: "/roles" },
    ],
  },
  {
    label: "Promo",
    items: [{ label: "Discounts", icon: <DiscountIcon />, path: "/discounts" }],
  },
  {
    label: "Financial",
    items: [
      {
        label: "Financial Statement of Accounts",
        icon: <AccountBalanceIcon />,
        path: "/financial-statement-of-accounts",
      },
      {
        label: "Statement of Accounts",
        icon: <DescriptionIcon />,
        path: "/statement-of-accounts",
      },
      {
        label: "Financial Royalty Fees",
        path: "/financial-royalty-fees-accounts",
        icon: <AccountBalanceWalletIcon fontSize="small" />,
      },
      {
        label: "Royalty Fees",
        icon: <MonetizationOnIcon />,
        path: "/royalty-fees",
      },
      {
        label: "Financial Credit Card Transactions",
        path: "/credit-card-transactions-accounts",
        icon: <CreditCardIcon fontSize="small" />,
      },
      {
        label: "Credit Card Transactions",
        icon: <CreditCardIcon />,
        path: "/credit-card-transactions",
      },
      {
        label: "Credit Card Transactions Report",
        icon: <BarChartIcon />,
        path: "/credit-card-transactions-report",
      },
    ],
  },
];

interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ collapsed, setCollapsed }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery("(max-width:800px)");
  const [mobileOpen, setMobileOpen] = useState(false);

  const permissions = useContext(PermissionsContext);

  // decode role safely
  let userRole = "";
  try {
    const token = localStorage.getItem("token");
    if (token) {
      const decoded: any = jwtDecode(token as string);
      userRole = decoded?.role || "";
    }
  } catch {
    userRole = "";
  }

  const canShowMenu = (label: string) => {
    if (userRole === "SuperAdmin") return true;
    if (!permissions) return false; // if permissions not loaded treat as hidden
    const perms = permissions[label];
    return !!(perms && perms["Read"]);
  };

  // NEW: filter out sections that have no visible items for this user
  const visibleSections = sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => canShowMenu(item.label)),
    }))
    .filter((section) => section.items.length > 0);

  const handleLogout = () => {
    localStorage.clear();
    sessionStorage.clear();
    navigate("/login");
  };

  const isActive = (path: string) => {
    return (
      location.pathname === path ||
      (location.pathname === "/" && path === "/dashboard")
    );
  };

  const drawerContent = (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        width: "100%",
        overflowX: "hidden", // prevent horizontal scrollbar from inner content
        bgcolor:
          theme.palette.mode === "dark"
            ? "#0f1720"
            : `linear-gradient(180deg, ${theme.palette.background.paper} 0%, #f7f8fa 100%)`,
        color: theme.palette.text.primary,
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "space-between",
          px: 2,
          py: 2,
          minHeight: 72,
        }}
      >
        {/* top logo: hide the circular initial when sidebar is collapsed */}
        {!collapsed ? (
          <Stack direction="row" spacing={2} alignItems="center">
            <Avatar
              sx={{
                bgcolor: theme.palette.primary.main,
                width: 44,
                height: 44,
                fontWeight: 800,
              }}
            >
              M
            </Avatar>
            <Box>
              <Typography
                sx={{
                  fontWeight: 800,
                  fontSize: 18,
                  letterSpacing: 0.6,
                  color: "#f39c12",
                }}
              >
                MIETUBL POS
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Point of Sale
              </Typography>
            </Box>
          </Stack>
        ) : null}

        {!isMobile && (
          <IconButton
            onClick={() => setCollapsed((prev) => !prev)}
            size="small"
            sx={{
              ml: collapsed ? 0 : 1,
              bgcolor: alpha(theme.palette.primary.main, 0.06),
              "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.12) },
            }}
          >
            <MenuIcon />
          </IconButton>
        )}

        {isMobile && (
          <IconButton onClick={() => setMobileOpen(false)} size="small">
            <Close />
          </IconButton>
        )}
      </Box>

      <Divider sx={{ mx: collapsed ? 1 : 2, my: 1, opacity: 0.6 }} />

      <Box
        sx={{
          paddingTop: 2,
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden", // ensure vertical scroll only
          px: 0, // remove container horizontal offset so section label + items align
          "&::-webkit-scrollbar": {
            width: "7px",
            background: "#f4f4f4",
          },
          "&::-webkit-scrollbar-thumb": {
            background: "#b0b0b0",
            borderRadius: "6px",
          },
        }}
      >
        {visibleSections.map((section, idx) => (
          <Box key={section.label} sx={{ mb: 1 }}>
            {!collapsed && (
              <Typography
                variant="caption"
                sx={{
                  px: 2,
                  pt: idx === 0 ? 0 : 1,
                  pb: 0.5,
                  color: theme.palette.text.secondary,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  fontSize: 12,
                }}
              >
                {section.label}
              </Typography>
            )}
            <List sx={{ py: 0, px: 0 }}>
              {section.items.map((item) => {
                const active = isActive(item.path);
                return (
                  <Tooltip
                    key={item.label}
                    title={collapsed ? item.label : ""}
                    placement="right"
                    arrow
                  >
                    <ListItem
                      button
                      onClick={() => {
                        navigate(item.path);
                        if (isMobile) setMobileOpen(false);
                      }}
                      sx={{
                        mx: 0,
                        mb: 0.5,
                        borderRadius: 1.25,
                        minHeight: 48,
                        justifyContent: collapsed ? "center" : "flex-start",
                        px: collapsed ? 1 : 2, // keep same left padding as section label (label uses px:2)
                        color: active ? theme.palette.primary.main : "inherit",
                        bgcolor: active
                          ? alpha(theme.palette.primary.main, 0.12)
                          : "transparent",
                        transition: "background 0.12s, color 0.12s",
                        "&:hover": {
                          bgcolor: active
                            ? alpha(theme.palette.primary.main, 0.16)
                            : alpha(theme.palette.action.hover, 0.08),
                        },
                        // keep items from causing horizontal overflow
                        width: "100%",
                        boxSizing: "border-box",
                      }}
                    >
                      <ListItemIcon
                        sx={{
                          minWidth: 36, // consistent icon column width
                          mr: collapsed ? 0 : 2,
                          ml: 0, // ensure icon aligns with label left padding
                          justifyContent: "center",
                          color: active
                            ? theme.palette.primary.main
                            : theme.palette.text.secondary,
                          flex: "0 0 36px",
                        }}
                      >
                        {item.icon}
                      </ListItemIcon>
                      {!collapsed && (
                        <ListItemText
                          primary={item.label}
                          sx={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                         
                            mr: 0,
                          }}
                        />
                      )}
                    </ListItem>
                  </Tooltip>
                );
              })}
            </List>
            <Divider sx={{ my: 1 }} />
          </Box>
        ))}
      </Box>

      <Box sx={{ px: 2, py: 2 }}>
        <Divider sx={{ mb: 1 }} />
        <Stack
          direction={collapsed ? "column" : "row"}
          spacing={2}
          alignItems="center"
          justifyContent={collapsed ? "center" : "space-between"}
        >
          {!collapsed ? (
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {userRole || "Guest"}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Signed in
              </Typography>
            </Box>
          ) : (
            <Tooltip title={userRole || "Guest"} placement="right">
              <Avatar
                sx={{
                  bgcolor: theme.palette.primary.main,
                  width: 36,
                  height: 36,
                }}
              >
                U
              </Avatar>
            </Tooltip>
          )}

          <Box>
            <Button
              onClick={handleLogout}
              startIcon={<LogoutIcon />}
              size="small"
              variant={collapsed ? "contained" : "outlined"}
              sx={{
                textTransform: "none",
                bgcolor: collapsed ? theme.palette.error.main : "transparent",
                color: collapsed ? "#fff" : theme.palette.text.primary,
                borderColor: alpha(theme.palette.text.primary, 0.08),
                "&:hover": {
                  bgcolor: collapsed
                    ? alpha(theme.palette.error.main, 0.9)
                    : alpha(theme.palette.action.hover, 0.06),
                },
              }}
            >
              {!collapsed ? "Logout" : ""}
            </Button>
          </Box>
        </Stack>
      </Box>
    </Box>
  );

  if (isMobile) {
    return (
      <>
        {!mobileOpen && (
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={() => setMobileOpen(true)}
            sx={{
              position: "fixed",
              top: 20,
              left: 24,
              zIndex: 1301,
              background: "#fff",
              boxShadow: 1,
            }}
          >
            <MenuIcon />
          </IconButton>
        )}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            width: drawerWidth,
            flexShrink: 0,
            "& .MuiDrawer-paper": {
              width: drawerWidth,
              boxSizing: "border-box",
              borderRadius: 2,
            },
            display: { xs: "block", sm: "block" },
          }}
        >
          {drawerContent}
        </Drawer>
      </>
    );
  }

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: collapsed ? collapsedWidth : drawerWidth,
        flexShrink: 0,
        "& .MuiDrawer-paper": {
          width: collapsed ? collapsedWidth : drawerWidth,
          boxSizing: "border-box",
          transition: "width 0.2s",
          overflowX: "hidden",
          boxShadow: `0 6px 18px ${alpha(theme.palette.common.black, 0.06)}`,
          borderRight: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
          borderRadius: 2,
        },
      }}
      open
    >
      {drawerContent}
    </Drawer>
  );
};

export default Sidebar;
