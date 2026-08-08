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
  LinearProgress,
  Tooltip,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Google,
  CheckCircle,
  Cancel,
  CloudUpload,
} from '@mui/icons-material';
import { Link, useNavigate } from 'react-router-dom';
import Lottie from 'lottie-react';
import globeAnimation from '../animations/Globe.json';
import axios from 'axios';

export default function Register() {
  // State management
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    profilePicture: null,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [usernameStatus, setUsernameStatus] = useState(''); // 'available', 'taken', 'checking'
  const [passwordStrength, setPasswordStrength] = useState(0); // 0-100
  const [imagePreview, setImagePreview] = useState(null);
  const navigate = useNavigate();

  // Validation patterns
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;

  // Debounce timer
  let usernameCheckTimeout;

  // Calculate password strength
  const calculatePasswordStrength = (password) => {
    let strength = 0;
    if (password.length >= 6) strength += 25;
    if (password.length >= 10) strength += 25;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength += 25;
    if (/[0-9]/.test(password)) strength += 25;
    return strength;
  };

  // Get password strength color
  const getPasswordStrengthColor = () => {
    if (passwordStrength < 50) return '#f44336'; // Red
    if (passwordStrength < 75) return '#ff9800'; // Orange
    return '#4caf50'; // Green
  };

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

    // Update password strength on password change
    if (name === 'password') {
      setPasswordStrength(calculatePasswordStrength(value));
    }
  };

  // Check username availability with debounce
  const checkUsernameAvailability = async (username) => {
    if (!username || !usernameRegex.test(username)) {
      setUsernameStatus('');
      return;
    }

    setUsernameStatus('checking');
    try {
      const response = await axios.get(
        `http://localhost:5000/api/auth/check-username/${username}`
      );
      setUsernameStatus(response.data.available ? 'available' : 'taken');
    } catch (error) {
      setUsernameStatus('');
    }
  };

  // Handle username blur with debounce
  const handleUsernameBlur = () => {
    clearTimeout(usernameCheckTimeout);
    usernameCheckTimeout = setTimeout(() => {
      checkUsernameAvailability(formData.username);
    }, 500);
  };

  // Handle profile picture upload
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Check file size (2MB max)
      if (file.size > 2 * 1024 * 1024) {
        setErrors((prev) => ({
          ...prev,
          profilePicture: 'Image must be less than 2MB',
        }));
        return;
      }

      // Check file type
      if (!['image/jpeg', 'image/png'].includes(file.type)) {
        setErrors((prev) => ({
          ...prev,
          profilePicture: 'Only JPG and PNG files are allowed',
        }));
        return;
      }

      // Store the actual file object
      setFormData((prev) => ({
        ...prev,
        profilePicture: file, // Store as File object
      }));

      // Create preview for display
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);

      setErrors((prev) => ({
        ...prev,
        profilePicture: '',
      }));
    }
  };

  // Validate form
  const validateForm = () => {
    const newErrors = {};

    // Username validation
    if (!formData.username) {
      newErrors.username = 'Username is required';
    } else if (!usernameRegex.test(formData.username)) {
      newErrors.username = '3-20 chars, alphanumeric and underscore only';
    } else if (usernameStatus === 'taken') {
      newErrors.username = 'Username is already taken';
    }

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
      // Use FormData to handle file upload
      const formDataToSend = new FormData();
      formDataToSend.append('username', formData.username);
      formDataToSend.append('email', formData.email);
      formDataToSend.append('password', formData.password);

      // Only append profile picture if a file was selected
      if (formData.profilePicture) {
        formDataToSend.append('profile_picture', formData.profilePicture);
      }

      // API call to register endpoint
      const response = await axios.post(
        'http://localhost:5000/api/auth/register',
        formDataToSend,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      if (response.data.success) {
        setSuccessMessage('Registration successful! Redirecting to login...');
        // Redirect to login page after 2 seconds
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      }
    } catch (error) {
      setApiError(
        error.response?.data?.message ||
          'Registration failed. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  // Handle Google Sign-Up
  const handleGoogleSignUp = () => {
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

      {/* Main Register Card */}
      <Card
        elevation={0}
        sx={{
          width: { xs: '90%', sm: 450, md: 500 },
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
          maxHeight: '90vh',
          overflowY: 'auto',
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
            Join EcoReward Hub
          </Typography>
          <Typography
            variant="body2"
            sx={{
              color: '#666',
              fontSize: '0.95rem',
            }}
          >
            Start your recycling journey today!
          </Typography>
        </Box>

        {/* Error Alert */}
        {apiError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {apiError}
          </Alert>
        )}

        {/* Success Alert */}
        {successMessage && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {successMessage}
          </Alert>
        )}

        {/* Register Form */}
        <form onSubmit={handleSubmit}>
          {/* Username Input with Availability Check */}
          <TextField
            fullWidth
            name="username"
            label="Username"
            value={formData.username}
            onChange={handleChange}
            onBlur={handleUsernameBlur}
            error={!!errors.username}
            helperText={errors.username || '3-20 characters, alphanumeric and underscore only'}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  {usernameStatus === 'checking' && (
                    <CircularProgress size={20} />
                  )}
                  {usernameStatus === 'available' && (
                    <CheckCircle sx={{ color: '#4caf50' }} />
                  )}
                  {usernameStatus === 'taken' && (
                    <Cancel sx={{ color: '#f44336' }} />
                  )}
                </InputAdornment>
              ),
            }}
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

          {/* Password Input with Strength Indicator */}
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
                  <Tooltip title="Min 6 chars, mix letters & numbers">
                    <IconButton
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                      aria-label="toggle password visibility"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </Tooltip>
                </InputAdornment>
              ),
            }}
            sx={{
              mb: 1,
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

          {/* Password Strength Bar */}
          {formData.password && (
            <Box sx={{ mb: 2 }}>
              <LinearProgress
                variant="determinate"
                value={passwordStrength}
                sx={{
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: '#e0e0e0',
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: getPasswordStrengthColor(),
                    borderRadius: 3,
                  },
                }}
              />
              <Typography
                variant="caption"
                sx={{
                  color: getPasswordStrengthColor(),
                  fontSize: '0.75rem',
                  mt: 0.5,
                  display: 'block',
                }}
              >
                {passwordStrength < 50
                  ? 'Weak'
                  : passwordStrength < 75
                  ? 'Medium'
                  : 'Strong'}
              </Typography>
            </Box>
          )}

          {/* Profile Picture Upload (Optional) */}
          <Box sx={{ mb: 3 }}>
            <Button
              component="label"
              variant="outlined"
              startIcon={<CloudUpload />}
              sx={{
                width: '100%',
                height: 48,
                borderRadius: 2,
                borderColor: '#dadce0',
                color: '#666',
                textTransform: 'none',
                '&:hover': {
                  borderColor: '#2D5016',
                },
              }}
            >
              Upload Profile Picture (Optional)
              <input
                type="file"
                hidden
                accept="image/jpeg,image/png"
                onChange={handleImageUpload}
              />
            </Button>
            {errors.profilePicture && (
              <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
                {errors.profilePicture}
              </Typography>
            )}
            {imagePreview && (
              <Box
                sx={{
                  mt: 2,
                  display: 'flex',
                  justifyContent: 'center',
                }}
              >
                <img
                  src={imagePreview}
                  alt="Preview"
                  style={{
                    width: 100,
                    height: 100,
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '3px solid #2D5016',
                  }}
                />
              </Box>
            )}
          </Box>

          {/* Register Button */}
          <Button
            fullWidth
            type="submit"
            variant="contained"
            disabled={loading || usernameStatus === 'taken'}
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
              'Create Account'
            )}
          </Button>
        </form>

        {/* Divider */}
        <Divider sx={{ my: 3 }}>
          <Typography variant="body2" sx={{ color: '#666' }}>
            or
          </Typography>
        </Divider>

        {/* Google Sign-Up Button */}
        <Button
          fullWidth
          variant="outlined"
          onClick={handleGoogleSignUp}
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
          Sign up with Google
        </Button>

        {/* Login Link */}
        <Box sx={{ textAlign: 'center', mt: 3 }}>
          <Typography variant="body2" sx={{ color: '#666' }}>
            Already have an account?{' '}
            <MuiLink
              component={Link}
              to="/login"
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
              Sign In
            </MuiLink>
          </Typography>
        </Box>
      </Card>

      {/* Loading Overlay */}
      {loading && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <Box sx={{ background: '#fff', padding: 3, borderRadius: 2 }}>
            <Lottie
              animationData={globeAnimation}
              loop={true}
              style={{ width: 100, height: 100 }}
            />
          </Box>
        </Box>
      )}
    </Box>
  );
}
