import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  CircularProgress,
  Button,
  Card,
  Grid,
  IconButton,
  Divider,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  QrCodeScanner,
  EmojiEvents,
  Recycling,
  Logout,
  Map as MapIcon,
  TrendingUp,
  CardGiftcard,
  Close,
  InfoOutlined,
  People,
  HourglassEmpty,
} from '@mui/icons-material';
import Lottie from 'lottie-react';
import axios from 'axios';
import { formatDistanceToNow } from 'date-fns';
import CountUp from 'react-countup';
import globeAnimation from '../animations/Globe.json';

// Eco-friendly quotes collection
const ecoQuotes = [
  "Every recycled item is a love letter to the future 💚",
  "Small actions × 8 billion people = Massive change",
  "The best time to recycle was yesterday. The second best time is now.",
  "One person's trash is Earth's treasure",
  "Be the change you want to see in your bin",
  "Recycling: Because there is no Planet B 🌍",
  "Today's effort is tomorrow's clean air",
  "Your waste choices write Earth's story",
  "Sustainability is not a trend, it's survival",
  "Think globally, recycle locally",
];

export default function Dashboard() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState(null);
  const [recentScans, setRecentScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [greeting, setGreeting] = useState({ text: '', icon: '' });
  const [selectedScan, setSelectedScan] = useState(null);
  const [scanDetailOpen, setScanDetailOpen] = useState(false);
  const [loadingScanDetail, setLoadingScanDetail] = useState(false);
  const [dailyQuote, setDailyQuote] = useState('');

  useEffect(() => {
    // Check if token is in URL (from Google OAuth)
    const tokenFromUrl = searchParams.get('token');

    if (tokenFromUrl) {
      // Store token in localStorage
      localStorage.setItem('token', tokenFromUrl);

      // Remove token from URL for security
      window.history.replaceState({}, document.title, '/dashboard');
    }

    // Check if user is authenticated
    const token = localStorage.getItem('token');
    if (!token) {
      // Not authenticated, redirect to login
      navigate('/login');
      return;
    }

    // Set time-based greeting
    setTimeBasedGreeting();

    // Set random quote (new quote on every refresh)
    const randomQuote = ecoQuotes[Math.floor(Math.random() * ecoQuotes.length)];
    setDailyQuote(randomQuote);

    // Fetch user data
    fetchUserData();
  }, [searchParams, navigate]);

  const setTimeBasedGreeting = () => {
    const hour = new Date().getHours();
    let text, icon;

    if (hour < 12) {
      text = 'Good morning';
      icon = '🌅';
    } else if (hour < 18) {
      text = 'Good afternoon';
      icon = '☀️';
    } else {
      text = 'Good evening';
      icon = '🌙';
    }

    setGreeting({ text, icon });
  };

  const fetchUserData = async () => {
    try {
      const token = localStorage.getItem('token');

      // Fetch user stats
      const statsResponse = await axios.get('http://localhost:5000/api/user/stats', {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Fetch recent scans
      const scansResponse = await axios.get(
        'http://localhost:5000/api/user/recent-scans?limit=3',
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (statsResponse.data.success) {
        setStats(statsResponse.data.data);
        setUser(statsResponse.data.data);

        // Update localStorage with latest user data
        localStorage.setItem('user', JSON.stringify(statsResponse.data.data));
      }

      if (scansResponse.data.success) {
        setRecentScans(scansResponse.data.data);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      if (error.response?.status === 401) {
        // Token expired or invalid
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  // Get item type icon and color
  const getItemTypeStyle = (itemType) => {
    const styles = {
      Plastic: { icon: '🥤', color: '#3B82F6' },
      Metal: { icon: '🥫', color: '#8B8B8B' },
      Glass: { icon: '🍾', color: '#10B981' },
      Paper: { icon: '📄', color: '#F59E0B' },
      Organic: { icon: '🌿', color: '#22C55E' },
      'E-waste': { icon: '📱', color: '#8B5CF6' },
    };
    return styles[itemType] || { icon: '♻️', color: '#2D5016' };
  };

  // Fetch scan details
  const fetchScanDetails = async (scanId) => {
    try {
      setLoadingScanDetail(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`http://localhost:5000/api/scan/${scanId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data.success) {
        setSelectedScan(response.data.data);
        setScanDetailOpen(true);
      }
    } catch (error) {
      console.error('Failed to fetch scan details:', error);
    } finally {
      setLoadingScanDetail(false);
    }
  };

  // Get confidence color
  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.8) return '#4CAF50'; // Green
    if (confidence >= 0.6) return '#FF9800'; // Orange
    return '#F44336'; // Red
  };

  // Format full datetime
  const formatFullDateTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
        }}
      >
        <CircularProgress sx={{ color: '#2D5016' }} />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #F5F5F5 0%, #E8F5E9 100%)',
        padding: { xs: 2, sm: 3, md: 4 },
        pb: { xs: 2, sm: 2 },
        position: 'relative',
        overflow: 'hidden',
        // Background pattern
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 15c-8.284 0-15 6.716-15 15 0 8.284 6.716 15 15 15 8.284 0 15-6.716 15-15 0-8.284-6.716-15-15-15zm0 2c7.18 0 13 5.82 13 13s-5.82 13-13 13-13-5.82-13-13 5.82-13 13-13z' fill='%232D5016' fill-opacity='0.08'/%3E%3C/svg%3E")`,
          opacity: 0.6,
          zIndex: 0,
        },
      }}
    >
      <Box sx={{ maxWidth: 1200, margin: '0 auto', position: 'relative', zIndex: 1 }}>
        {/* App Title Header - Badge Style */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            mb: 3,
            pt: { xs: 2, sm: 3 },
          }}
        >
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1.2,
              px: 2.5,
              py: 1.2,
              borderRadius: 50,
              background: 'rgba(232, 245, 233, 0.85)',
              backdropFilter: 'blur(10px)',
              border: '1.5px solid rgba(45, 80, 22, 0.25)',
              boxShadow: '0 4px 16px rgba(45, 80, 22, 0.12)',
              transition: 'all 0.2s ease',
              '&:hover': {
                transform: 'scale(1.02)',
                boxShadow: '0 6px 20px rgba(45, 80, 22, 0.18)',
              },
            }}
          >
            <Lottie
              animationData={globeAnimation}
              loop={true}
              style={{ width: 36, height: 36 }}
            />
            <Typography
              variant="h5"
              sx={{
                fontWeight: 700,
                background: 'linear-gradient(90deg, #2D5016, #4A8B2C, #68B042, #4A8B2C, #2D5016)',
                backgroundSize: '200% 100%',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                fontSize: { xs: '1.1rem', sm: '1.3rem' },
                letterSpacing: '-0.01em',
                animation: 'gradientFlow 5s ease infinite',
                '@keyframes gradientFlow': {
                  '0%, 100%': {
                    backgroundPosition: '0% 50%',
                  },
                  '50%': {
                    backgroundPosition: '100% 50%',
                  },
                },
              }}
            >
              EcoReward Hub
            </Typography>
          </Box>
        </Box>

        {/* User Greeting & Logout */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 3,
            flexWrap: 'wrap',
            gap: 2,
          }}
        >
          <Box>
            <Typography
              variant="h5"
              sx={{
                fontWeight: 700,
                color: '#2D5016',
                fontSize: { xs: '1.2rem', sm: '1.4rem' },
              }}
            >
              {greeting.text}, {user?.username || 'User'}! {greeting.icon}
            </Typography>
            <Typography variant="body2" sx={{ color: '#666', mt: 0.5 }}>
              Ready to make a difference today?
            </Typography>
          </Box>

          <IconButton
            onClick={handleLogout}
            sx={{
              color: '#666',
              '&:hover': {
                color: '#2D5016',
                background: 'rgba(45, 80, 22, 0.1)',
              },
            }}
          >
            <Logout />
          </IconButton>
        </Box>

        {/* Daily Eco Quote */}
        {dailyQuote && (
          <Box
            sx={{
              textAlign: 'center',
              py: { xs: 1.5, sm: 2 },
              px: { xs: 2, sm: 3 },
              mb: 3,
              background: 'rgba(168, 213, 186, 0.18)',
              borderLeft: '4px solid #A8D5BA',
              borderRadius: 2,
              '@keyframes subtlePulse': {
                '0%, 100%': { opacity: 0.9 },
                '50%': { opacity: 1 },
              },
              animation: 'subtlePulse 5s ease-in-out infinite',
            }}
          >
            <Typography
              variant="body1"
              sx={{
                fontStyle: 'italic',
                color: '#555',
                fontSize: { xs: '0.85rem', sm: '1rem' },
                lineHeight: 1.6,
              }}
            >
              "{dailyQuote}"
            </Typography>
          </Box>
        )}

        {/* Stats Cards */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'repeat(2, 1fr)',
              sm: 'repeat(2, 1fr)',
              md: 'repeat(4, 1fr)',
            },
            gap: 2,
            mb: 3,
          }}
        >
          {/* Total Points */}
          <Box>
            <Card
              elevation={0}
              sx={{
                padding: 2,
                minHeight: 120,
                borderRadius: 3,
                backdropFilter: 'blur(20px) saturate(180%)',
                background: 'rgba(255, 255, 255, 0.75)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                boxShadow: `0 8px 32px 0 rgba(45, 80, 22, 0.15)`,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: `0 12px 40px 0 rgba(45, 80, 22, 0.2)`,
                },
              }}
            >
              <Box sx={{ textAlign: 'center' }}>
                <EmojiEvents sx={{ fontSize: 32, color: '#FFD700', mb: 1 }} />
                <Typography variant="h5" sx={{ fontWeight: 700, color: '#2D5016' }}>
                  <CountUp end={stats?.total_points || 0} duration={1.5} />
                </Typography>
                <Typography variant="caption" sx={{ color: '#666', fontSize: '0.75rem' }}>
                  Points
                </Typography>
              </Box>
            </Card>
          </Box>

          {/* Rank */}
          <Box>
            <Card
              elevation={0}
              sx={{
                padding: 2,
                minHeight: 120,
                borderRadius: 3,
                backdropFilter: 'blur(20px) saturate(180%)',
                background: 'rgba(255, 255, 255, 0.75)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                boxShadow: `0 8px 32px 0 rgba(45, 80, 22, 0.15)`,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: `0 12px 40px 0 rgba(45, 80, 22, 0.2)`,
                },
              }}
            >
              <Box sx={{ textAlign: 'center' }}>
                <TrendingUp sx={{ fontSize: 32, color: '#2D5016', mb: 1 }} />
                <Typography variant="h5" sx={{ fontWeight: 700, color: '#2D5016' }}>
                  #{stats?.rank || '-'}
                </Typography>
                <Typography variant="caption" sx={{ color: '#666', fontSize: '0.75rem' }}>
                  Rank
                </Typography>
              </Box>
            </Card>
          </Box>

          {/* Streak */}
          <Box>
            <Card
              elevation={0}
              sx={{
                padding: 2,
                minHeight: 120,
                borderRadius: 3,
                backdropFilter: 'blur(20px) saturate(180%)',
                background: 'rgba(255, 255, 255, 0.75)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                boxShadow: `0 8px 32px 0 rgba(45, 80, 22, 0.15)`,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: `0 12px 40px 0 rgba(45, 80, 22, 0.2)`,
                },
              }}
            >
              <Box sx={{ textAlign: 'center' }}>
                <Box
                  sx={{
                    fontSize: 32,
                    lineHeight: 1,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: 32,
                    mb: 1,
                  }}
                >
                  🔥
                </Box>
                <Typography variant="h5" sx={{ fontWeight: 700, color: '#2D5016' }}>
                  <CountUp end={stats?.current_streak_days || 0} duration={1.5} />
                </Typography>
                <Typography variant="caption" sx={{ color: '#666', fontSize: '0.75rem' }}>
                  Day Streak
                </Typography>
              </Box>
            </Card>
          </Box>

          {/* Total Scans */}
          <Box>
            <Card
              elevation={0}
              sx={{
                padding: 2,
                minHeight: 120,
                borderRadius: 3,
                backdropFilter: 'blur(20px) saturate(180%)',
                background: 'rgba(255, 255, 255, 0.75)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                boxShadow: `0 8px 32px 0 rgba(45, 80, 22, 0.15)`,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: `0 12px 40px 0 rgba(45, 80, 22, 0.2)`,
                },
              }}
            >
              <Box sx={{ textAlign: 'center' }}>
                <Recycling sx={{ fontSize: 32, color: '#2D5016', mb: 1 }} />
                <Typography variant="h5" sx={{ fontWeight: 700, color: '#2D5016' }}>
                  <CountUp end={stats?.total_scans || 0} duration={1.5} />
                </Typography>
                <Typography variant="caption" sx={{ color: '#666', fontSize: '0.75rem' }}>
                  Items
                </Typography>
              </Box>
            </Card>
          </Box>
        </Box>

        {/* Quick Actions */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {/* Scan Now - Primary Action */}
          <Grid item xs={12} sm={6} md={4}>
            <Card
              elevation={0}
              sx={{
                padding: 3,
                borderRadius: 3,
                background: 'linear-gradient(135deg, #2D5016 0%, #3D6B1F 100%)',
                boxShadow: `0 8px 32px 0 rgba(45, 80, 22, 0.3)`,
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: `0 12px 40px 0 rgba(45, 80, 22, 0.4)`,
                },
              }}
              onClick={() => navigate('/scan')}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box
                  sx={{
                    width: 60,
                    height: 60,
                    borderRadius: '50%',
                    background: 'rgba(255, 255, 255, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <QrCodeScanner sx={{ fontSize: 32, color: '#fff' }} />
                </Box>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#fff' }}>
                    Scan an Item
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                    Identify & earn points
                  </Typography>
                </Box>
              </Box>
            </Card>
          </Grid>

          {/* Redeem Rewards */}
          <Grid item xs={12} sm={6} md={4}>
            <Card
              elevation={0}
              sx={{
                padding: 3,
                borderRadius: 3,
                backdropFilter: 'blur(20px) saturate(180%)',
                background: 'rgba(255, 255, 255, 0.75)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                boxShadow: `0 8px 32px 0 rgba(45, 80, 22, 0.15)`,
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: `0 12px 40px 0 rgba(45, 80, 22, 0.2)`,
                },
              }}
              onClick={() => navigate('/rewards')}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box
                  sx={{
                    width: 60,
                    height: 60,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #F4A460 0%, #E59547 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <CardGiftcard sx={{ fontSize: 32, color: '#fff' }} />
                </Box>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#2D5016' }}>
                    Redeem Rewards
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#666' }}>
                    Use your points
                  </Typography>
                </Box>
              </Box>
            </Card>
          </Grid>

          {/* Find Centers */}
          <Grid item xs={12} sm={6} md={4}>
            <Card
              elevation={0}
              sx={{
                padding: 3,
                borderRadius: 3,
                backdropFilter: 'blur(20px) saturate(180%)',
                background: 'rgba(255, 255, 255, 0.75)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                boxShadow: `0 8px 32px 0 rgba(45, 80, 22, 0.15)`,
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: `0 12px 40px 0 rgba(45, 80, 22, 0.2)`,
                },
              }}
              onClick={() => navigate('/map')}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box
                  sx={{
                    width: 60,
                    height: 60,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #A8D5BA 0%, #2D5016 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <MapIcon sx={{ fontSize: 32, color: '#fff' }} />
                </Box>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#2D5016' }}>
                    Find Centers
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#666' }}>
                    Nearby recycling spots
                  </Typography>
                </Box>
              </Box>
            </Card>
          </Grid>

          {/* Community */}
          <Grid item xs={12} sm={6} md={4}>
            <Card
              elevation={0}
              sx={{
                padding: 3,
                borderRadius: 3,
                backdropFilter: 'blur(20px) saturate(180%)',
                background: 'rgba(255, 255, 255, 0.75)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                boxShadow: `0 8px 32px 0 rgba(45, 80, 22, 0.15)`,
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: `0 12px 40px 0 rgba(45, 80, 22, 0.2)`,
                },
              }}
              onClick={() => navigate('/community')}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box
                  sx={{
                    width: 60,
                    height: 60,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #9370DB 0%, #7B68EE 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <People sx={{ fontSize: 32, color: '#fff' }} />
                </Box>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#2D5016' }}>
                    Community
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#666' }}>
                    Share & connect
                  </Typography>
                </Box>
              </Box>
            </Card>
          </Grid>
        </Grid>

        {/* Recent Activity */}
        <Card
          elevation={0}
          sx={{
            padding: 3,
            borderRadius: 3,
            backdropFilter: 'blur(20px) saturate(180%)',
            background: 'rgba(255, 255, 255, 0.75)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            boxShadow: `0 8px 32px 0 rgba(45, 80, 22, 0.15)`,
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#2D5016', mb: 2 }}>
            Recent Activity
          </Typography>

          {recentScans.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Recycling sx={{ fontSize: 64, color: '#ccc', mb: 2 }} />
              <Typography variant="body2" sx={{ color: '#888' }}>
                No scans yet. Start recycling to see your activity!
              </Typography>
              <Button
                variant="outlined"
                onClick={() => navigate('/scan')}
                sx={{
                  mt: 2,
                  borderColor: '#2D5016',
                  color: '#2D5016',
                  textTransform: 'none',
                  '&:hover': {
                    borderColor: '#2D5016',
                    background: 'rgba(45, 80, 22, 0.05)',
                  },
                }}
              >
                Scan Your First Item
              </Button>
            </Box>
          ) : (
            <Box>
              {recentScans.map((scan, index) => {
                const itemStyle = getItemTypeStyle(scan.item_type);
                return (
                  <Box key={scan.scan_id}>
                    <Box
                      onClick={() => fetchScanDetails(scan.scan_id)}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        py: 2,
                        cursor: 'pointer',
                        borderRadius: 2,
                        px: 1,
                        mx: -1,
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          bgcolor: 'rgba(45, 80, 22, 0.05)',
                          transform: 'translateX(4px)',
                        },
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Typography sx={{ fontSize: 32 }}>{itemStyle.icon}</Typography>
                        <Box>
                          <Typography
                            variant="body1"
                            sx={{ fontWeight: 600, color: '#2D5016' }}
                          >
                            {scan.item_subtype || scan.item_type}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#888' }}>
                            {formatDistanceToNow(new Date(scan.scan_timestamp), {
                              addSuffix: true,
                            })}
                          </Typography>
                        </Box>
                      </Box>
                      {scan.verification_status === 'pending' ? (
                        <Chip
                          icon={<HourglassEmpty sx={{ fontSize: 16, color: '#fff !important' }} />}
                          label="Pending"
                          sx={{
                            background: 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)',
                            color: '#fff',
                            fontWeight: 700,
                            fontSize: '0.75rem',
                          }}
                        />
                      ) : scan.verification_status === 'approved' ? (
                        <Chip
                          label={`+${scan.points_earned} pts`}
                          sx={{
                            background: itemStyle.color,
                            color: '#fff',
                            fontWeight: 700,
                            fontSize: '0.75rem',
                          }}
                        />
                      ) : (
                        <Chip
                          label="Rejected"
                          sx={{
                            background: 'linear-gradient(135deg, #f44336 0%, #c62828 100%)',
                            color: '#fff',
                            fontWeight: 700,
                            fontSize: '0.75rem',
                          }}
                        />
                      )}
                    </Box>
                    {index < recentScans.length - 1 && <Divider />}
                  </Box>
                );
              })}
            </Box>
          )}
        </Card>
      </Box>

      {/* Scan Detail Modal */}
      <Dialog
        open={scanDetailOpen}
        onClose={() => setScanDetailOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Scan Details
          </Typography>
          <IconButton onClick={() => setScanDetailOpen(false)} size="small">
            <Close />
          </IconButton>
        </DialogTitle>

        <DialogContent>
          {loadingScanDetail ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress sx={{ color: '#2D5016' }} />
            </Box>
          ) : selectedScan ? (
            <Box>
              {/* Scan Image */}
              {selectedScan.image_path && (
                <Box
                  sx={{
                    mb: 3,
                    borderRadius: 2,
                    overflow: 'hidden',
                    bgcolor: '#F5F5F5',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    minHeight: 200,
                  }}
                >
                  <img
                    src={`http://localhost:5000${selectedScan.image_path}`}
                    alt={selectedScan.item_subtype || selectedScan.item_type}
                    style={{
                      maxWidth: '100%',
                      maxHeight: 400,
                      objectFit: 'contain',
                      borderRadius: 8,
                    }}
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.style.display = 'none';
                      e.target.parentElement.innerHTML = `
                        <div style="display: flex; flex-direction: column; align-items: center; padding: 40px; color: #999;">
                          <svg width="80" height="80" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
                          </svg>
                          <p>Image not available</p>
                        </div>
                      `;
                    }}
                  />
                </Box>
              )}

              {/* Item Info */}
              <Box sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  <Typography sx={{ fontSize: 48 }}>
                    {getItemTypeStyle(selectedScan.item_type).icon}
                  </Typography>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 600, color: '#2D5016' }}>
                      {selectedScan.item_subtype || selectedScan.item_type}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#666' }}>
                      Category: {selectedScan.item_type}
                    </Typography>
                  </Box>
                </Box>

                {/* Stats Grid */}
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: 2,
                    mb: 2,
                  }}
                >
                  <Box
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      bgcolor: '#F5F5F5',
                      textAlign: 'center',
                    }}
                  >
                    <Typography variant="caption" sx={{ color: '#666', display: 'block' }}>
                      Confidence
                    </Typography>
                    <Typography
                      variant="h6"
                      sx={{
                        fontWeight: 700,
                        color: getConfidenceColor(selectedScan.confidence_score),
                      }}
                    >
                      {(selectedScan.confidence_score * 100).toFixed(0)}%
                    </Typography>
                  </Box>

                  <Box
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      bgcolor: '#E8F5E9',
                      textAlign: 'center',
                    }}
                  >
                    <Typography variant="caption" sx={{ color: '#666', display: 'block' }}>
                      Points Earned
                    </Typography>
                    <Typography
                      variant="h6"
                      sx={{ fontWeight: 700, color: '#2D5016' }}
                    >
                      +{selectedScan.points_earned}
                    </Typography>
                  </Box>
                </Box>
              </Box>

              {/* Recycling Tips */}
              {selectedScan.recycling_tips && (
                <Box
                  sx={{
                    mb: 3,
                    p: 2,
                    borderRadius: 2,
                    bgcolor: '#E3F2FD',
                    border: '1px solid #BBDEFB',
                  }}
                >
                  <Typography
                    variant="subtitle2"
                    sx={{
                      fontWeight: 600,
                      color: '#1976D2',
                      mb: 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                    }}
                  >
                    <InfoOutlined sx={{ fontSize: 18 }} />
                    Recycling Tips
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#555' }}>
                    {selectedScan.recycling_tips}
                  </Typography>
                </Box>
              )}

              {/* Timestamp */}
              <Box sx={{ textAlign: 'center', pt: 2, borderTop: '1px solid #e0e0e0' }}>
                <Typography variant="caption" sx={{ color: '#999', display: 'block' }}>
                  Scanned on
                </Typography>
                <Typography variant="body2" sx={{ color: '#666', fontWeight: 500 }}>
                  {formatFullDateTime(selectedScan.scan_timestamp)}
                </Typography>
              </Box>
            </Box>
          ) : null}
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setScanDetailOpen(false)} sx={{ color: '#2D5016' }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
