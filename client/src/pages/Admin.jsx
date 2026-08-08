import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  AppBar,
  Toolbar,
  Chip,
  Alert,
  CircularProgress,
  TextField,
  InputAdornment,
} from '@mui/material';
import {
  People,
  Recycling,
  MonetizationOn,
  HourglassEmpty,
  ExitToApp,
  Check,
  Close,
  Block,
  CheckCircle,
  Search,
  Clear,
} from '@mui/icons-material';
import { DataGrid } from '@mui/x-data-grid';
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import axios from 'axios';

const COLORS = ['#2D5016', '#A8D5BA', '#F4A460', '#708090', '#87CEEB', '#9370DB'];

const Admin = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({});
  const [trends, setTrends] = useState([]);
  const [distribution, setDistribution] = useState([]);
  const [pendingRedemptions, setPendingRedemptions] = useState([]);
  const [pendingScans, setPendingScans] = useState([]); // NEW
  const [lowConfidenceScans, setLowConfidenceScans] = useState([]);
  const [users, setUsers] = useState([]); // NEW: User Management
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [scanSearchQuery, setScanSearchQuery] = useState(''); // Search for pending scans by username

  useEffect(() => {
    checkAdminAccess();
    fetchAllData();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      // Try to fetch admin data (will fail if not admin)
      await axios.get('http://localhost:5000/api/admin/stats', {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (error) {
      // Handle JWT errors (malformed, expired, etc.)
      if (error.response?.status === 403) {
        setError('Access denied. Admin only.');
        setTimeout(() => navigate('/dashboard'), 2000);
      } else if (error.response?.status === 401 || !error.response) {
        // Token is invalid/malformed - clear and redirect to login
        localStorage.clear();
        setError('Session expired. Please login again.');
        setTimeout(() => navigate('/login'), 1500);
      }
    }
  };

  const fetchAllData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const [statsRes, trendsRes, distRes, redemptionsRes, pendingScansRes, scansRes, usersRes] =
        await Promise.all([
          axios.get('http://localhost:5000/api/admin/stats', { headers }),
          axios.get('http://localhost:5000/api/admin/trends', { headers }),
          axios.get('http://localhost:5000/api/admin/category-distribution', {
            headers,
          }),
          axios.get('http://localhost:5000/api/admin/pending-redemptions', {
            headers,
          }),
          axios.get('http://localhost:5000/api/admin/pending-scans', { headers }), // NEW
          axios.get('http://localhost:5000/api/admin/low-confidence-scans', {
            headers,
          }),
          axios.get('http://localhost:5000/api/admin/users', { headers }), // NEW: Users
        ]);

      setStats(statsRes.data.data);
      setTrends(trendsRes.data.data);
      setDistribution(distRes.data.data);
      setPendingRedemptions(redemptionsRes.data.data);
      setPendingScans(pendingScansRes.data.data); // NEW
      setLowConfidenceScans(scansRes.data.data);
      setUsers(usersRes.data.data); // NEW: Users
    } catch (error) {
      console.error('Failed to fetch admin data:', error);
      // Handle JWT errors
      if (error.response?.status === 401 || !error.response) {
        localStorage.clear();
        setError('Session expired. Please login again.');
        setTimeout(() => navigate('/login'), 1500);
      }
    } finally {
      setLoading(false);
    }
  };

  // Redemption handlers
  const handleApprove = async (id) => {
    const token = localStorage.getItem('token');
    await axios.post(
      `http://localhost:5000/api/admin/redemptions/${id}/approve`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );
    fetchAllData();
  };

  const handleReject = async (id) => {
    const token = localStorage.getItem('token');
    await axios.post(
      `http://localhost:5000/api/admin/redemptions/${id}/reject`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );
    fetchAllData();
  };

  // NEW: Scan verification handlers
  const handleApproveScan = async (id) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `http://localhost:5000/api/admin/scans/${id}/approve`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchAllData();
    } catch (error) {
      console.error('Failed to approve scan:', error);
    }
  };

  const handleRejectScan = async (id) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `http://localhost:5000/api/admin/scans/${id}/reject`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchAllData();
    } catch (error) {
      console.error('Failed to reject scan:', error);
    }
  };

  // NEW: User Management - Toggle user status (ban/unban)
  const handleToggleUserStatus = async (userId, username, currentStatus) => {
    const action = currentStatus ? 'ban' : 'unban';
    if (window.confirm(`Are you sure you want to ${action} user "${username}"?`)) {
      try {
        const token = localStorage.getItem('token');
        await axios.post(
          `http://localhost:5000/api/admin/users/${userId}/toggle-status`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
        fetchAllData(); // Refresh data
      } catch (error) {
        console.error('Failed to toggle user status:', error);
        alert('Failed to update user status. Please try again.');
      }
    }
  };

  const redemptionColumns = [
    { field: 'username', headerName: 'User', width: 150 },
    { field: 'email', headerName: 'Email', width: 200 },
    { field: 'reward_name', headerName: 'Reward', width: 200 },
    { field: 'points_spent', headerName: 'Points', width: 100 },
    {
      field: 'redeemed_at',
      headerName: 'Date',
      width: 180,
      valueFormatter: (value) => new Date(value).toLocaleString(),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 220,
      renderCell: (params) => (
        <Box
          sx={{
            display: 'flex',
            gap: 1,
            alignItems: 'center',
            height: '100%',
            py: 1,
          }}
        >
          <Button
            size="small"
            variant="contained"
            color="success"
            onClick={() => handleApprove(params.row.redemption_id)}
          >
            ✅ Approve
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="error"
            onClick={() => handleReject(params.row.redemption_id)}
          >
            ❌ Reject
          </Button>
        </Box>
      ),
    },
  ];

  // NEW: Scan columns
  const scanColumns = [
    {
      field: 'image_path',
      headerName: 'Image',
      width: 100,
      renderCell: (params) => (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
          }}
        >
          <Box
            component="img"
            src={`http://localhost:5000${params.value}`}
            alt="Scan"
            sx={{
              width: 60,
              height: 60,
              objectFit: 'cover',
              borderRadius: 1,
            }}
          />
        </Box>
      ),
    },
    { field: 'username', headerName: 'User', width: 120 },
    {
      field: 'item',
      headerName: 'Item',
      width: 200,
      valueGetter: (value, row) => `${row.item_type} - ${row.item_subtype}`,
    },
    {
      field: 'confidence_score',
      headerName: 'AI Confidence',
      width: 130,
      renderCell: (params) => (
        <Chip
          label={`${(params.value * 100).toFixed(0)}%`}
          size="small"
          color={params.value >= 0.8 ? 'success' : params.value >= 0.6 ? 'warning' : 'error'}
        />
      ),
    },
    { field: 'points_earned', headerName: 'Points', width: 80 },
    { field: 'facility_name', headerName: 'Drop-off Location', width: 200 },
    {
      field: 'scan_timestamp',
      headerName: 'Date',
      width: 160,
      valueFormatter: (value) => new Date(value).toLocaleString(),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 200,
      renderCell: (params) => (
        <Box
          sx={{
            display: 'flex',
            gap: 1,
            alignItems: 'center',
            height: '100%',
            py: 1,
          }}
        >
          <Button
            size="small"
            variant="contained"
            color="success"
            startIcon={<Check />}
            onClick={() => handleApproveScan(params.row.scan_id)}
            sx={{ minWidth: 85 }}
          >
            Verify
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="error"
            startIcon={<Close />}
            onClick={() => handleRejectScan(params.row.scan_id)}
            sx={{ minWidth: 85 }}
          >
            Reject
          </Button>
        </Box>
      ),
    },
  ];

  // NEW: User Management columns
  const userColumns = [
    { field: 'user_id', headerName: 'User ID', width: 80 },
    { field: 'username', headerName: 'Username', width: 150 },
    { field: 'email', headerName: 'Email', width: 200 },
    {
      field: 'role',
      headerName: 'Role',
      width: 100,
      renderCell: (params) => (
        <Chip
          label={params.value === 'admin' ? 'Admin' : 'User'}
          size="small"
          color={params.value === 'admin' ? 'warning' : 'success'}
          sx={{
            fontWeight: 600,
            bgcolor: params.value === 'admin' ? '#FFD700' : '#4CAF50',
            color: 'white',
          }}
        />
      ),
    },
    { field: 'total_points', headerName: 'Total Points', width: 120 },
    { field: 'total_scans', headerName: 'Total Scans', width: 100 },
    {
      field: 'is_active',
      headerName: 'Status',
      width: 120,
      renderCell: (params) => (
        <Chip
          label={params.value ? 'Active' : 'Banned'}
          size="small"
          color={params.value ? 'success' : 'error'}
          icon={params.value ? <CheckCircle /> : <Block />}
        />
      ),
    },
    {
      field: 'created_at',
      headerName: 'Joined Date',
      width: 150,
      valueFormatter: (value) => {
        const date = new Date(value);
        return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1)
          .toString()
          .padStart(2, '0')}/${date.getFullYear()}`;
      },
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 150,
      renderCell: (params) => {
        const isAdmin = params.row.role === 'admin';
        const isActive = params.row.is_active;

        return (
          <Button
            size="small"
            variant="contained"
            color={isActive ? 'error' : 'success'}
            startIcon={isActive ? <Block /> : <CheckCircle />}
            onClick={() =>
              handleToggleUserStatus(params.row.user_id, params.row.username, isActive)
            }
            disabled={isAdmin}
            sx={{
              minWidth: 100,
              opacity: isAdmin ? 0.5 : 1,
            }}
          >
            {isActive ? 'Ban User' : 'Unban User'}
          </Button>
        );
      },
    },
  ];

  if (error) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
        }}
      >
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
        }}
      >
        <CircularProgress sx={{ color: '#2D5016' }} />
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', background: '#f5f5f5', pb: 4 }}>
      {/* App Bar */}
      <AppBar
        position="sticky"
        elevation={1}
        sx={{
          background: 'linear-gradient(135deg, #2D5016 0%, #3D6B1F 100%)',
        }}
      >
        <Toolbar sx={{ justifyContent: 'space-between' }}>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            🛡️ EcoReward Admin
          </Typography>
          <Button
            variant="outlined"
            startIcon={<ExitToApp />}
            onClick={() => {
              localStorage.removeItem('token');
              navigate('/login');
            }}
            sx={{
              color: 'white',
              borderColor: 'white',
              '&:hover': {
                borderColor: 'white',
                bgcolor: 'rgba(255, 255, 255, 0.1)',
              },
            }}
          >
            Logout
          </Button>
        </Toolbar>
      </AppBar>

      <Box sx={{ maxWidth: 1600, mx: 'auto', p: { xs: 2, md: 4 } }}>
        {/* Stats Cards */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Total Users"
              value={stats.total_users || 0}
              icon={<People sx={{ fontSize: 32 }} />}
              color="#2D5016"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Items Recycled"
              value={stats.total_items_recycled || 0}
              icon={<Recycling sx={{ fontSize: 32 }} />}
              color="#A8D5BA"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Points Issued"
              value={stats.total_points_issued || 0}
              icon={<MonetizationOn sx={{ fontSize: 32 }} />}
              color="#F4A460"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Pending Approvals"
              value={stats.total_pending_approvals || 0}
              icon={<HourglassEmpty sx={{ fontSize: 32 }} />}
              color="#d32f2f"
              alert={stats.total_pending_approvals > 0}
            />
          </Grid>
        </Grid>

        {/* Charts Row */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          {/* Line Chart - Recycling Activity */}
          <Grid item xs={12} lg={7}>
            <Card elevation={2} sx={{ borderRadius: 3, height: '100%' }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ mb: 3, fontWeight: 600, color: '#2D5016' }}>
                  📊 Recycling Activity (Last 7 Days)
                </Typography>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart
                    data={trends}
                    margin={{ top: 20, right: 30, left: -10, bottom: 10 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#f0f0f0"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="date"
                      stroke="#888"
                      style={{ fontSize: '12px' }}
                      tickLine={false}
                      axisLine={{ stroke: '#e0e0e0' }}
                      tickFormatter={(value) => {
                        const date = new Date(value);
                        return `${date.getDate()} ${date.toLocaleString('default', {
                          month: 'short',
                        })}`;
                      }}
                    />
                    <YAxis
                      stroke="#888"
                      style={{ fontSize: '12px' }}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#fff',
                        border: 'none',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      }}
                      labelFormatter={(value) => new Date(value).toLocaleString()}
                    />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                    <Line
                      type="natural"
                      dataKey="scan_count"
                      stroke="#2D5016"
                      strokeWidth={3}
                      name="Scans"
                      dot={{ fill: '#2D5016', r: 4, strokeWidth: 2, stroke: '#fff' }}
                      activeDot={{ r: 7, strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>

          {/* Pie Chart - Category Distribution */}
          <Grid item xs={12} lg={5}>
            <Card elevation={2} sx={{ borderRadius: 3, height: '100%' }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ mb: 3, fontWeight: 600, color: '#2D5016' }}>
                  ♻️ Waste Category Distribution
                </Typography>
                <ResponsiveContainer width="100%" height={400}>
                  <PieChart>
                    <Pie
                      data={distribution}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={95}
                      innerRadius={60}
                      paddingAngle={2}
                      label={(entry) => (entry.value > 0 ? entry.name : null)}
                      labelLine={{ stroke: '#e0e0e0' }}
                    >
                      {distribution.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                          stroke="none"
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      iconType="circle"
                    />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* NEW: Pending Scans Verification */}
        <Card elevation={2} sx={{ borderRadius: 3, mb: 4 }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: '#2D5016' }}>
              🔍 Pending Scan Verifications
            </Typography>

            {/* Search Bar for Username */}
            <Box sx={{ mb: 2, display: 'flex', gap: 1, alignItems: 'center' }}>
              <TextField
                size="small"
                placeholder="Search by username..."
                value={scanSearchQuery}
                onChange={(e) => setScanSearchQuery(e.target.value)}
                sx={{
                  flex: 1,
                  maxWidth: 350,
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#2D5016',
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#2D5016',
                    },
                  },
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search sx={{ color: '#666' }} />
                    </InputAdornment>
                  ),
                  endAdornment: scanSearchQuery && (
                    <InputAdornment position="end">
                      <Button
                        size="small"
                        onClick={() => setScanSearchQuery('')}
                        sx={{ minWidth: 'auto', p: 0.5 }}
                      >
                        <Clear sx={{ fontSize: 18, color: '#666' }} />
                      </Button>
                    </InputAdornment>
                  ),
                }}
              />
              {scanSearchQuery && (
                <Chip
                  label={`Filtering: "${scanSearchQuery}"`}
                  size="small"
                  onDelete={() => setScanSearchQuery('')}
                  sx={{ bgcolor: '#e8f5e9', color: '#2D5016' }}
                />
              )}
              <Typography variant="body2" sx={{ color: '#666', ml: 'auto' }}>
                {pendingScans.filter((scan) =>
                  scan.username.toLowerCase().includes(scanSearchQuery.toLowerCase())
                ).length}{' '}
                of {pendingScans.length} scans
              </Typography>
            </Box>

            <Box sx={{ height: 500, width: '100%' }}>
              <DataGrid
                rows={pendingScans.filter((scan) =>
                  scan.username.toLowerCase().includes(scanSearchQuery.toLowerCase())
                )}
                columns={scanColumns}
                getRowId={(row) => row.scan_id}
                initialState={{
                  pagination: {
                    paginationModel: { pageSize: 5 },
                  },
                }}
                pageSizeOptions={[5, 10, 25]}
                disableSelectionOnClick
                rowHeight={80}
                sx={{
                  '& .MuiDataGrid-cell': {
                    fontSize: '0.95rem',
                    display: 'flex',
                    alignItems: 'center',
                  },
                  '& .MuiDataGrid-columnHeaders': {
                    backgroundColor: '#f5f5f5',
                    fontWeight: 600,
                    fontSize: '1rem',
                  },
                }}
              />
            </Box>
            {pendingScans.length === 0 && (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="body1" sx={{ color: '#666' }}>
                  ✅ No pending scans. All submissions have been reviewed!
                </Typography>
              </Box>
            )}
          </CardContent>
        </Card>

        {/* Pending Redemptions DataGrid */}
        <Card elevation={2} sx={{ borderRadius: 3, mb: 4 }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 3, fontWeight: 600, color: '#2D5016' }}>
              ⏳ Pending Reward Approvals
            </Typography>
            <Box sx={{ height: 450, width: '100%' }}>
              <DataGrid
                rows={pendingRedemptions}
                columns={redemptionColumns}
                getRowId={(row) => row.redemption_id}
                initialState={{
                  pagination: {
                    paginationModel: { pageSize: 5 },
                  },
                }}
                pageSizeOptions={[5, 10]}
                disableSelectionOnClick
                sx={{
                  '& .MuiDataGrid-cell': {
                    fontSize: '0.95rem',
                    display: 'flex',
                    alignItems: 'center',
                  },
                  '& .MuiDataGrid-columnHeaders': {
                    backgroundColor: '#f5f5f5',
                    fontWeight: 600,
                    fontSize: '1rem',
                  },
                }}
              />
            </Box>
          </CardContent>
        </Card>

        {/* AI Audit - Low Confidence Scans */}
        <Card elevation={2} sx={{ borderRadius: 3, mb: 4 }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 3, fontWeight: 600, color: '#2D5016' }}>
              🤖 AI Audit - Flagged Scans (Confidence &lt; 70%)
            </Typography>
            <Grid container spacing={3}>
              {lowConfidenceScans.slice(0, 6).map((scan) => (
                <Grid item xs={12} sm={6} md={4} lg={3} key={scan.scan_id}>
                  <LowConfidenceCard scan={scan} />
                </Grid>
              ))}
              {lowConfidenceScans.length === 0 && (
                <Grid item xs={12}>
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Typography variant="body1" sx={{ color: '#666' }}>
                      ✅ No low-confidence scans found. All AI predictions look good!
                    </Typography>
                  </Box>
                </Grid>
              )}
            </Grid>
          </CardContent>
        </Card>

        {/* NEW: User Management */}
        <Card elevation={2} sx={{ borderRadius: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 3, fontWeight: 600, color: '#2D5016' }}>
              👥 User Management
            </Typography>
            <Box sx={{ height: 600, width: '100%' }}>
              <DataGrid
                rows={users}
                columns={userColumns}
                getRowId={(row) => row.user_id}
                initialState={{
                  pagination: {
                    paginationModel: { pageSize: 10 },
                  },
                  sorting: {
                    sortModel: [{ field: 'created_at', sort: 'desc' }],
                  },
                }}
                pageSizeOptions={[10, 25, 50]}
                disableSelectionOnClick
                sx={{
                  '& .MuiDataGrid-cell': {
                    fontSize: '0.95rem',
                    display: 'flex',
                    alignItems: 'center',
                  },
                  '& .MuiDataGrid-columnHeaders': {
                    backgroundColor: '#f5f5f5',
                    fontWeight: 600,
                    fontSize: '1rem',
                  },
                  '& .MuiDataGrid-row:hover': {
                    backgroundColor: '#f9f9f9',
                  },
                }}
              />
            </Box>
            {users.length === 0 && (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="body1" sx={{ color: '#666' }}>
                  No users found in the system.
                </Typography>
              </Box>
            )}
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
};

const StatCard = ({ title, value, icon, color, alert }) => (
  <Card
    elevation={2}
    sx={{
      borderRadius: 3,
      background: 'white',
      border: alert ? '2px solid #d32f2f' : 'none',
      height: '100%',
      transition: 'transform 0.2s ease',
      '&:hover': {
        transform: 'translateY(-4px)',
        boxShadow: 4,
      },
    }}
  >
    <CardContent sx={{ p: 3 }}>
      <Typography
        variant="body2"
        sx={{ color: '#666', mb: 1, fontSize: '0.9rem', fontWeight: 500 }}
      >
        {title}
      </Typography>

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
        }}
      >
        <Typography
          variant="h4"
          sx={{
            fontWeight: 700,
            color,
            lineHeight: 1,
            letterSpacing: '-0.5px',
          }}
        >
          {value.toLocaleString()}
        </Typography>

        <Box
          sx={{
            color: color,
            opacity: 0.8,
            display: 'flex',
            alignItems: 'center',
            transform: 'translateY(2px)',
          }}
        >
          {icon}
        </Box>
      </Box>

      {alert && (
        <Chip
          label="Action Required"
          color="error"
          size="small"
          sx={{ mt: 1.5 }}
        />
      )}
    </CardContent>
  </Card>
);

const LowConfidenceCard = ({ scan }) => (
  <Card
    elevation={2}
    sx={{
      borderRadius: 3,
      border: '2px solid #ff9800',
      transition: 'transform 0.2s ease',
      '&:hover': {
        transform: 'translateY(-4px)',
        boxShadow: 4,
      },
    }}
  >
    <CardContent sx={{ p: 2 }}>
      {scan.image_path && (
        <Box
          component="img"
          src={`http://localhost:5000${scan.image_path}`}
          sx={{
            width: '100%',
            height: 180,
            objectFit: 'cover',
            borderRadius: 2,
            mb: 2,
          }}
        />
      )}
      <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
        {scan.item_type} - {scan.item_subtype}
      </Typography>
      <Chip
        label={`${(scan.confidence_score * 100).toFixed(0)}% confidence`}
        size="small"
        color="warning"
        sx={{ mb: 1 }}
      />
      <Typography variant="caption" sx={{ display: 'block', color: '#666' }}>
        by {scan.username}
      </Typography>
    </CardContent>
  </Card>
);

export default Admin;
