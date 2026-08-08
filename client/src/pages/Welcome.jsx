import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Card,
  Grid,
  CircularProgress,
  Link,
} from '@mui/material';
import {
  CameraAlt,
  EmojiEvents,
  Redeem,
  Public,
  People,
  Recycling,
} from '@mui/icons-material';
import Lottie from 'lottie-react';
import axios from 'axios';
import globeAnimation from '../animations/Globe.json';

export default function Welcome() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    const token = localStorage.getItem('token');
    if (token) {
      navigate('/dashboard');
      return;
    }

    // Fetch global stats
    fetchGlobalStats();
  }, [navigate]);

  const fetchGlobalStats = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/stats/global');
      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching global stats:', error);
      // Set default values on error
      setStats({
        total_scans: 0,
        total_users: 0,
        total_points_awarded: 0,
      });
    } finally {
      setLoading(false);
    }
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
        // Floating mint blob
        '&::after': {
          content: '""',
          position: 'absolute',
          top: '-10%',
          right: '-5%',
          width: { xs: '300px', sm: '400px', md: '500px' },
          height: { xs: '300px', sm: '400px', md: '500px' },
          background:
            'radial-gradient(circle, rgba(168, 213, 186, 0.25) 0%, rgba(168, 213, 186, 0.05) 50%, transparent 70%)',
          borderRadius: '40% 60% 70% 30% / 40% 50% 60% 50%',
          filter: 'blur(40px)',
          animation: 'float 20s ease-in-out infinite',
          zIndex: 0,
        },
      }}
    >
      <Box
        sx={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: { xs: 2, sm: 3, md: 4 },
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Header Section */}
        <Box
          sx={{
            textAlign: 'center',
            mb: { xs: 4, md: 6 },
            mt: { xs: 2, sm: 3, md: 4 },
          }}
        >
          <Box sx={{ mb: 2 }}>
            <Lottie
              animationData={globeAnimation}
              loop={true}
              style={{ width: 100, height: 100, margin: '0 auto' }}
            />
          </Box>
          <Typography
            variant="h2"
            sx={{
              fontWeight: 800,
              color: '#2D5016',
              mb: 1.5,
              fontSize: { xs: '2rem', sm: '2.75rem', md: '3.5rem' },
              letterSpacing: '-0.02em',
            }}
          >
            EcoReward Hub
          </Typography>
          <Typography
            variant="h5"
            sx={{
              color: '#666',
              fontWeight: 600,
              mb: 3,
              fontSize: { xs: '1.2rem', sm: '1.4rem', md: '1.5rem' },
              letterSpacing: '0.02em',
            }}
          >
            Recycle. Earn. Repeat.
          </Typography>
          <Typography
            variant="body1"
            sx={{
              color: '#777',
              maxWidth: 650,
              margin: '0 auto',
              lineHeight: 1.8,
              fontSize: { xs: '0.95rem', sm: '1rem', md: '1.1rem' },
              px: { xs: 2, sm: 0 },
            }}
          >
            Turn your recycling habits into rewards! Use AI to identify recyclable
            items, earn points, and make a positive impact on the environment.
          </Typography>
        </Box>

        {/* Community Impact Stats */}
        <Card
          elevation={0}
          sx={{
            padding: { xs: 2.5, sm: 3, md: 4 },
            borderRadius: { xs: 3, md: 4 },
            backdropFilter: 'blur(20px) saturate(180%)',
            background: 'rgba(255, 255, 255, 0.8)',
            border: '1px solid rgba(255, 255, 255, 0.4)',
            boxShadow: `
              0 8px 32px 0 rgba(45, 80, 22, 0.12),
              0 2px 12px 0 rgba(45, 80, 22, 0.06)
            `,
            mb: { xs: 4, md: 6 },
            mx: { xs: 1, sm: 0 },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, mb: 3 }}>
            <Public sx={{ fontSize: { xs: 28, sm: 32 }, color: '#2D5016' }} />
            <Typography
              variant="h5"
              sx={{
                fontWeight: 700,
                color: '#2D5016',
                fontSize: { xs: '1.3rem', sm: '1.5rem' },
              }}
            >
              Community Impact
            </Typography>
          </Box>

          <Grid
            container
            spacing={{ xs: 2, sm: 3 }}
            sx={{
              width: '100%',
              justifyContent: 'space-evenly',
              alignItems: 'stretch',
            }}
          >
            {/* Total Items Recycled */}
            <Grid item xs={12} sm={4} sx={{ display: 'flex' }}>
              <Box sx={{ textAlign: 'center', py: { xs: 1, sm: 0 }, width: '100%' }}>
                <Recycling sx={{ fontSize: { xs: 36, sm: 40 }, color: '#A8D5BA', mb: 1 }} />
                <Typography
                  variant="h4"
                  sx={{
                    fontWeight: 700,
                    color: '#2D5016',
                    mb: 0.5,
                    fontSize: { xs: '1.8rem', sm: '2rem', md: '2.125rem' },
                  }}
                >
                  {stats?.total_scans?.toLocaleString() || 0}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    color: '#666',
                    fontSize: { xs: '0.85rem', sm: '0.875rem' },
                    fontWeight: 500,
                  }}
                >
                  Items Recycled
                </Typography>
              </Box>
            </Grid>

            {/* Active Users */}
            <Grid item xs={12} sm={4} sx={{ display: 'flex' }}>
              <Box sx={{ textAlign: 'center', py: { xs: 1, sm: 0 }, width: '100%' }}>
                <People sx={{ fontSize: { xs: 36, sm: 40 }, color: '#F4A460', mb: 1 }} />
                <Typography
                  variant="h4"
                  sx={{
                    fontWeight: 700,
                    color: '#2D5016',
                    mb: 0.5,
                    fontSize: { xs: '1.8rem', sm: '2rem', md: '2.125rem' },
                  }}
                >
                  {stats?.total_users?.toLocaleString() || 0}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    color: '#666',
                    fontSize: { xs: '0.85rem', sm: '0.875rem' },
                    fontWeight: 500,
                  }}
                >
                  Active Users
                </Typography>
              </Box>
            </Grid>

            {/* Points Awarded */}
            <Grid item xs={12} sm={4} sx={{ display: 'flex' }}>
              <Box sx={{ textAlign: 'center', py: { xs: 1, sm: 0 }, width: '100%' }}>
                <EmojiEvents sx={{ fontSize: { xs: 36, sm: 40 }, color: '#FFD700', mb: 1 }} />
                <Typography
                  variant="h4"
                  sx={{
                    fontWeight: 700,
                    color: '#2D5016',
                    mb: 0.5,
                    fontSize: { xs: '1.8rem', sm: '2rem', md: '2.125rem' },
                  }}
                >
                  {stats?.total_points_awarded?.toLocaleString() || 0}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    color: '#666',
                    fontSize: { xs: '0.85rem', sm: '0.875rem' },
                    fontWeight: 500,
                  }}
                >
                  Points Awarded
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Card>

        {/* How It Works */}
        <Typography
          variant="h4"
          sx={{
            fontWeight: 700,
            color: '#2D5016',
            mb: { xs: 3, md: 4 },
            textAlign: 'center',
            fontSize: { xs: '1.75rem', sm: '2rem', md: '2.125rem' },
          }}
        >
          How It Works
        </Typography>

        <Box
          sx={{
            maxWidth: 800,
            margin: '0 auto',
            px: { xs: 2, sm: 3 },
            mb: { xs: 4, md: 6 },
          }}
        >
          {/* Step 1: Scan */}
          <Box sx={{ mb: 3 }}>
            <Card
              elevation={0}
              sx={{
                padding: { xs: 3, sm: 4 },
                borderRadius: 3,
                backdropFilter: 'blur(20px) saturate(180%)',
                background: 'rgba(255, 255, 255, 0.85)',
                border: '1px solid rgba(255, 255, 255, 0.5)',
                boxShadow: `0 4px 20px 0 rgba(45, 80, 22, 0.1)`,
                display: 'flex',
                alignItems: 'center',
                gap: { xs: 2, sm: 3 },
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateX(8px)',
                  boxShadow: `0 8px 28px 0 rgba(45, 80, 22, 0.15)`,
                },
              }}
            >
              <Box
                sx={{
                  width: { xs: 60, sm: 70 },
                  height: { xs: 60, sm: 70 },
                  minWidth: { xs: 60, sm: 70 },
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #A8D5BA 0%, #2D5016 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 16px rgba(45, 80, 22, 0.2)',
                }}
              >
                <CameraAlt sx={{ fontSize: { xs: 32, sm: 36 }, color: '#fff' }} />
              </Box>
              <Box sx={{ flex: 1, textAlign: 'left' }}>
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 700,
                    mb: 0.5,
                    color: '#2D5016',
                    fontSize: { xs: '1.1rem', sm: '1.3rem' },
                  }}
                >
                  Scan Items
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    color: '#666',
                    lineHeight: 1.6,
                    fontSize: { xs: '0.9rem', sm: '1rem' },
                  }}
                >
                  Use your camera to scan recyclable items. Our AI identifies the type and
                  provides recycling tips.
                </Typography>
              </Box>
            </Card>
          </Box>

          {/* Step 2: Earn */}
          <Box sx={{ mb: 3 }}>
            <Card
              elevation={0}
              sx={{
                padding: { xs: 3, sm: 4 },
                borderRadius: 3,
                backdropFilter: 'blur(20px) saturate(180%)',
                background: 'rgba(255, 255, 255, 0.85)',
                border: '1px solid rgba(255, 255, 255, 0.5)',
                boxShadow: `0 4px 20px 0 rgba(45, 80, 22, 0.1)`,
                display: 'flex',
                alignItems: 'center',
                gap: { xs: 2, sm: 3 },
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateX(8px)',
                  boxShadow: `0 8px 28px 0 rgba(45, 80, 22, 0.15)`,
                },
              }}
            >
              <Box
                sx={{
                  width: { xs: 60, sm: 70 },
                  height: { xs: 60, sm: 70 },
                  minWidth: { xs: 60, sm: 70 },
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 16px rgba(255, 165, 0, 0.3)',
                }}
              >
                <EmojiEvents sx={{ fontSize: { xs: 32, sm: 36 }, color: '#fff' }} />
              </Box>
              <Box sx={{ flex: 1, textAlign: 'left' }}>
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 700,
                    mb: 0.5,
                    color: '#2D5016',
                    fontSize: { xs: '1.1rem', sm: '1.3rem' },
                  }}
                >
                  Earn Points
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    color: '#666',
                    lineHeight: 1.6,
                    fontSize: { xs: '0.9rem', sm: '1rem' },
                  }}
                >
                  Get points for every item you recycle. Different materials have different
                  point values.
                </Typography>
              </Box>
            </Card>
          </Box>

          {/* Step 3: Redeem */}
          <Box sx={{ mb: 0 }}>
            <Card
              elevation={0}
              sx={{
                padding: { xs: 3, sm: 4 },
                borderRadius: 3,
                backdropFilter: 'blur(20px) saturate(180%)',
                background: 'rgba(255, 255, 255, 0.85)',
                border: '1px solid rgba(255, 255, 255, 0.5)',
                boxShadow: `0 4px 20px 0 rgba(45, 80, 22, 0.1)`,
                display: 'flex',
                alignItems: 'center',
                gap: { xs: 2, sm: 3 },
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateX(8px)',
                  boxShadow: `0 8px 28px 0 rgba(45, 80, 22, 0.15)`,
                },
              }}
            >
              <Box
                sx={{
                  width: { xs: 60, sm: 70 },
                  height: { xs: 60, sm: 70 },
                  minWidth: { xs: 60, sm: 70 },
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #F4A460 0%, #D2691E 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 16px rgba(244, 164, 96, 0.3)',
                }}
              >
                <Redeem sx={{ fontSize: { xs: 32, sm: 36 }, color: '#fff' }} />
              </Box>
              <Box sx={{ flex: 1, textAlign: 'left' }}>
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 700,
                    mb: 0.5,
                    color: '#2D5016',
                    fontSize: { xs: '1.1rem', sm: '1.3rem' },
                  }}
                >
                  Redeem Rewards
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    color: '#666',
                    lineHeight: 1.6,
                    fontSize: { xs: '0.9rem', sm: '1rem' },
                  }}
                >
                  Exchange your points for Touch 'n Go reload, vouchers, and eco-friendly
                  gifts.
                </Typography>
              </Box>
            </Card>
          </Box>
        </Box>

        {/* CTA Section */}
        <Box sx={{ textAlign: 'center' }}>
          <Button
            variant="contained"
            size="large"
            onClick={() => navigate('/register')}
            sx={{
              height: { xs: 56, sm: 60 },
              px: { xs: 6, sm: 8 },
              borderRadius: { xs: 2.5, sm: 3 },
              background: 'linear-gradient(135deg, #2D5016 0%, #3D6B1F 100%)',
              color: '#fff',
              fontSize: { xs: '1rem', sm: '1.1rem' },
              fontWeight: 700,
              textTransform: 'none',
              boxShadow: '0 6px 24px rgba(45, 80, 22, 0.35)',
              '&:hover': {
                background: 'linear-gradient(135deg, #3D6B1F 0%, #2D5016 100%)',
                transform: 'translateY(-3px)',
                boxShadow: '0 8px 32px rgba(45, 80, 22, 0.45)',
              },
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              mb: 2,
            }}
          >
            Get Started
          </Button>

          <Typography
            variant="body2"
            sx={{
              color: '#666',
              fontSize: { xs: '0.9rem', sm: '0.875rem' },
            }}
          >
            Already a member?{' '}
            <Link
              onClick={() => navigate('/login')}
              sx={{
                color: '#2D5016',
                fontWeight: 600,
                cursor: 'pointer',
                textDecoration: 'none',
                '&:hover': {
                  textDecoration: 'underline',
                  color: '#3D6B1F',
                },
                transition: 'color 0.2s ease',
              }}
            >
              Sign In
            </Link>
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
