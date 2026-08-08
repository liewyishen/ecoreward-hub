import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  TextField,
  Button,
  Typography,
  InputAdornment,
  IconButton,
  Divider,
  Link as MuiLink,
  CircularProgress,
  Alert,
} from '@mui/material';
import { Visibility, VisibilityOff, Google } from '@mui/icons-material';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Lottie from 'lottie-react';
import globeAnimation from '../animations/Globe.json';
import axios from 'axios';

export default function Login() {
  // State management
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Handle OAuth error from URL params
  useEffect(() => {
    const error = searchParams.get('error');
    if (error === 'oauth_failed') {
      setApiError('Google Sign-In failed. Please try again.');
    }
  }, [searchParams]);

  // Validation patterns
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Handle input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: '',
      }));
    }
    setApiError('');
  };

  // Validate form
  const validateForm = () => {
    const newErrors = {};

    // Email validation
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!emailRegex.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      // API call to login endpoint
      const response = await axios.post('http://localhost:5000/api/auth/login', {
        email: formData.email,
        password: formData.password,
      });

      // Store token in localStorage
      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));

        // Show globe animation for 2 seconds before navigating
        setTimeout(() => {
          navigate('/dashboard');
          setLoading(false);
        }, 2000);
      }
    } catch (error) {
      setApiError(
        error.response?.data?.message || 'Login failed. Please try again.'
      );
      setLoading(false);
    }
  };

  // Handle Google Sign-In
  const handleGoogleSignIn = () => {
    // Redirect to Google OAuth endpoint
    window.location.href = 'http://localhost:5000/api/auth/google';
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #F5F5F5 0%, #E8F5E9 100%)',
        padding: { xs: 2, sm: 3 },
        position: 'relative',
        overflow: 'hidden',
        // Background pattern with leaves (enhanced opacity)
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
        // Floating shape 1 - Mint green blob (top-right)
        '&::after': {
          content: '""',
          position: 'absolute',
          top: '-10%',
          right: '-5%',
          width: { xs: '300px', sm: '400px', md: '500px' },
          height: { xs: '300px', sm: '400px', md: '500px' },
          background: 'radial-gradient(circle, rgba(168, 213, 186, 0.25) 0%, rgba(168, 213, 186, 0.05) 50%, transparent 70%)',
          borderRadius: '40% 60% 70% 30% / 40% 50% 60% 50%',
          filter: 'blur(40px)',
          animation: 'float 20s ease-in-out infinite',
          zIndex: 0,
        },
        // Floating shape 2 - Amber blob (bottom-left)
        '@keyframes float': {
          '0%, 100%': { transform: 'translate(0, 0) rotate(0deg)' },
          '33%': { transform: 'translate(30px, -30px) rotate(120deg)' },
          '66%': { transform: 'translate(-20px, 20px) rotate(240deg)' },
        },
        '@keyframes floatReverse': {
          '0%, 100%': { transform: 'translate(0, 0) rotate(0deg)' },
          '33%': { transform: 'translate(-30px, 30px) rotate(-120deg)' },
          '66%': { transform: 'translate(20px, -20px) rotate(-240deg)' },
        },
      }}
    >
      {/* Floating shape 2 - positioned via separate Box */}
      <Box
        sx={{
          position: 'absolute',
          bottom: '-10%',
          left: '-5%',
          width: { xs: '350px', sm: '450px', md: '550px' },
          height: { xs: '350px', sm: '450px', md: '550px' },
          background: 'radial-gradient(circle, rgba(244, 164, 96, 0.2) 0%, rgba(244, 164, 96, 0.05) 50%, transparent 70%)',
          borderRadius: '60% 40% 30% 70% / 60% 30% 70% 40%',
          filter: 'blur(40px)',
          animation: 'floatReverse 25s ease-in-out infinite',
          zIndex: 0,
        }}
      />

      {/* Main Login Card */}
      <Card
        elevation={0}
        sx={{
          width: { xs: '90%', sm: 400, md: 450 },
          padding: { xs: 2, sm: 3, md: 4 },
          borderRadius: 4,
          position: 'relative',
          zIndex: 1,
          backdropFilter: 'blur(20px) saturate(180%)',
          background: 'rgba(255, 255, 255, 0.75)',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          boxShadow: `
            0 8px 32px 0 rgba(45, 80, 22, 0.15),
            0 2px 8px 0 rgba(45, 80, 22, 0.08),
            inset 0 0 0 1px rgba(255, 255, 255, 0.4)
          `,
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: `
              0 12px 40px 0 rgba(45, 80, 22, 0.2),
              0 4px 12px 0 rgba(45, 80, 22, 0.12),
              inset 0 0 0 1px rgba(255, 255, 255, 0.5)
            `,
          },
        }}
      >
        {/* Logo and Tagline */}
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1 }}>
            <Lottie
              animationData={globeAnimation}
              loop={true}
              style={{ width: 80, height: 80 }}
            />
          </Box>
          <Typography
            variant="h4"
            sx={{
              fontWeight: 700,
              color: '#2D5016',
              mb: 0.5,
            }}
          >
            EcoReward Hub
          </Typography>
          <Typography
            variant="body2"
            sx={{
              color: '#666',
              fontSize: '0.95rem',
            }}
          >
            Recycle. Earn. Repeat.
          </Typography>
        </Box>

        {/* Error Alert */}
        {apiError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {apiError}
          </Alert>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit}>
          {/* Email Input */}
          <TextField
            fullWidth
            name="email"
            type="email"
            label="Email Address"
            value={formData.email}
            onChange={handleChange}
            error={!!errors.email}
            helperText={errors.email}
            sx={{
              mb: 2,
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
                transition: 'all 0.3s ease',
                '&:hover': {
                  '& > fieldset': {
                    borderColor: '#2D5016',
                  },
                },
                '&.Mui-focused': {
                  boxShadow: '0 0 0 3px rgba(168, 213, 186, 0.5)',
                  '& > fieldset': {
                    borderColor: '#2D5016',
                  },
                },
              },
              '& .MuiInputLabel-root': {
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                paddingLeft: '4px',
                paddingRight: '4px',
                '&.Mui-focused': {
                  color: '#2D5016',
                },
              },
            }}
          />

          {/* Password Input */}
          <TextField
            fullWidth
            name="password"
            type={showPassword ? 'text' : 'password'}
            label="Password"
            value={formData.password}
            onChange={handleChange}
            error={!!errors.password}
            helperText={errors.password}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setShowPassword(!showPassword)}
                    edge="end"
                    aria-label="toggle password visibility"
                  >
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
            sx={{
              mb: 3,
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
                transition: 'all 0.3s ease',
                '&:hover': {
                  '& > fieldset': {
                    borderColor: '#2D5016',
                  },
                },
                '&.Mui-focused': {
                  boxShadow: '0 0 0 3px rgba(168, 213, 186, 0.5)',
                  '& > fieldset': {
                    borderColor: '#2D5016',
                  },
                },
              },
              '& .MuiInputLabel-root': {
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                paddingLeft: '4px',
                paddingRight: '4px',
                '&.Mui-focused': {
                  color: '#2D5016',
                },
              },
            }}
          />

          {/* Sign In Button */}
          <Button
            fullWidth
            type="submit"
            variant="contained"
            disabled={loading}
            sx={{
              height: 48,
              borderRadius: 2,
              background: 'linear-gradient(135deg, #2D5016 0%, #3D6B1F 100%)',
              fontSize: '1rem',
              fontWeight: 600,
              textTransform: 'none',
              transition: 'all 0.3s ease',
              '&:hover': {
                background: 'linear-gradient(135deg, #3D6B1F 0%, #2D5016 100%)',
                transform: 'scale(1.02)',
                boxShadow: '0 6px 20px rgba(45, 80, 22, 0.3)',
              },
              '&:disabled': {
                background: '#ccc',
              },
            }}
          >
            {loading ? (
              <CircularProgress size={24} sx={{ color: '#fff' }} />
            ) : (
              'Sign In'
            )}
          </Button>
        </form>

        {/* Divider */}
        <Divider sx={{ my: 3 }}>
          <Typography variant="body2" sx={{ color: '#666' }}>
            or
          </Typography>
        </Divider>

        {/* Google Sign-In Button */}
        <Button
          fullWidth
          variant="outlined"
          onClick={handleGoogleSignIn}
          startIcon={<Google />}
          sx={{
            height: 48,
            borderRadius: 2,
            borderColor: '#dadce0',
            color: '#4285F4',
            fontSize: '0.95rem',
            fontWeight: 500,
            textTransform: 'none',
            background: '#fff',
            transition: 'all 0.3s ease',
            '&:hover': {
              borderColor: '#4285F4',
              background: '#f8f9fa',
              transform: 'scale(1.02)',
              boxShadow: '0 2px 8px rgba(66, 133, 244, 0.2)',
            },
          }}
        >
          Continue with Google
        </Button>

        {/* Register Link */}
        <Box sx={{ textAlign: 'center', mt: 3 }}>
          <Typography variant="body2" sx={{ color: '#666' }}>
            Don't have an account?{' '}
            <MuiLink
              component={Link}
              to="/register"
              sx={{
                color: '#2D5016',
                fontWeight: 600,
                textDecoration: 'none',
                transition: 'all 0.2s ease',
                '&:hover': {
                  textDecoration: 'underline',
                  color: '#3D6B1F',
                },
              }}
            >
              Register
            </MuiLink>
          </Typography>
        </Box>
      </Card>

      {/* Loading Overlay with Globe Animation */}
      {loading && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <Box
            sx={{
              background: '#fff',
              padding: 4,
              borderRadius: 4,
              boxShadow: '0 8px 32px rgba(45, 80, 22, 0.2)',
            }}
          >
            <Lottie
              animationData={globeAnimation}
              loop={true}
              style={{ width: 120, height: 120 }}
            />
          </Box>
          <Typography
            variant="body1"
            sx={{
              color: '#fff',
              mt: 2,
              fontWeight: 500,
              fontSize: '1.1rem',
            }}
          >
            Welcome back! 🌱
          </Typography>
        </Box>
      )}
    </Box>
  );
}
