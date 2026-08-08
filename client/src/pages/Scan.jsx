import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  Button,
  Typography,
  IconButton,
  Alert,
  LinearProgress,
  Chip,
  Divider,
  Stack,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  CameraAlt,
  Upload,
  Close,
  CheckCircle,
  Recycling,
  EmojiEvents,
  Info,
  LocationOn,
  HourglassEmpty,
  ContentCopy,
  CheckCircleOutline,
  ExpandMore,
  ExpandLess,
  Block,
  Whatshot,
} from '@mui/icons-material';
import Lottie from 'lottie-react';
import axios from 'axios';

// Import animations - make sure these exist in animations folder
import recycleAnimation from '../animations/Recycle.json';
import globeAnimation from '../animations/Globe.json';

export default function Scan() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // State management
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  // NEW: Facility selection state
  const [facilities, setFacilities] = useState([]);
  const [selectedFacility, setSelectedFacility] = useState('');
  const [showFacilitySelect, setShowFacilitySelect] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Low confidence warning state
  const [showLowConfidenceWarning, setShowLowConfidenceWarning] = useState(false);

  // Non-recyclable item warning state
  const [showNonRecyclableWarning, setShowNonRecyclableWarning] = useState(false);

  // Camera state
  const [showCamera, setShowCamera] = useState(false);
  const [stream, setStream] = useState(null);

  // Drop-off instruction state
  const [submittedFacility, setSubmittedFacility] = useState(null);
  const [usernameCopied, setUsernameCopied] = useState(false);
  const [showFaq, setShowFaq] = useState(false);

  // Streak feedback state
  const [streakInfo, setStreakInfo] = useState(null);

  // Check authentication on mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
    }
  }, [navigate]);

  // NEW: Fetch facilities on mount
  useEffect(() => {
    fetchFacilities();
  }, []);

  // NEW: Fetch nearby facilities
  const fetchFacilities = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/facilities/nearby');
      if (response.data.success) {
        setFacilities(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch facilities:', error);
      // Set default facilities if fetch fails
      setFacilities([]);
    }
  };

  // Handle file selection (upload or camera)
  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (JPG or PNG)');
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image size must be less than 5MB');
      return;
    }

    // Clear previous errors and results
    setError('');
    setResult(null);
    setShowFacilitySelect(false);
    setSelectedFacility('');

    // Set selected file
    setSelectedImage(file);

    // Create preview URL
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  // Clear selected image
  const handleClearImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    setError('');
    setResult(null);
    setShowFacilitySelect(false);
    setSelectedFacility('');
    setSubmittedFacility(null);
    setUsernameCopied(false);
    setShowFaq(false);
    setShowNonRecyclableWarning(false);
    setStreakInfo(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Open camera
  const handleOpenCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }, // Use back camera on mobile
        audio: false,
      });

      setStream(mediaStream);
      setShowCamera(true);

      // Wait for video element to be ready
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      }, 100);
    } catch (err) {
      console.error('Camera access error:', err);
      setError('Unable to access camera. Please check permissions or use Upload Image instead.');
    }
  };

  // Close camera
  const handleCloseCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setShowCamera(false);
  };

  // Capture photo from camera
  const handleCapturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert canvas to blob
    canvas.toBlob((blob) => {
      if (blob) {
        // Create File object from blob
        const file = new File([blob], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' });

        // Set as selected image
        setSelectedImage(file);

        // Create preview
        const reader = new FileReader();
        reader.onloadend = () => {
          setImagePreview(reader.result);
        };
        reader.readAsDataURL(file);

        // Close camera
        handleCloseCamera();

        // Clear previous results
        setError('');
        setResult(null);
        setShowFacilitySelect(false);
        setSelectedFacility('');
      }
    }, 'image/jpeg', 0.95);
  };

  // Analyze image with AI
  const handleAnalyze = async () => {
    if (!selectedImage) {
      setError('Please select an image first');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Prepare form data
      const formData = new FormData();
      formData.append('image', selectedImage);

      // Get JWT token
      const token = localStorage.getItem('token');

      // Call scan API (only analyzes, doesn't save)
      const response = await axios.post(
        'http://localhost:5000/api/scan/analyze',
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      if (response.data.success) {
        const analysisResult = response.data.data;
        setResult(analysisResult);
        setError('');

        // Check if item is Non-recyclable - don't allow submission
        if (analysisResult.item_type === 'Non-recyclable') {
          setShowNonRecyclableWarning(true);
        }
        // Check if confidence is low (< 60%)
        else if (analysisResult.confidence < 0.6) {
          setShowLowConfidenceWarning(true);
        } else {
          // Normal flow: Show facility selection dialog
          setShowFacilitySelect(true);
        }
      } else {
        setError(response.data.message || 'Failed to analyze image. Please try again.');
      }
    } catch (err) {
      console.error('Scan error:', err);
      setError(
        err.response?.data?.message ||
          'Failed to analyze image. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  // Handle low confidence warning - Continue Anyway
  const handleContinueAnyway = () => {
    setShowLowConfidenceWarning(false);
    setShowFacilitySelect(true);
  };

  // Handle low confidence warning - Rescan
  const handleRescan = () => {
    setShowLowConfidenceWarning(false);
    handleClearImage();
  };

  // NEW: Submit scan with facility for verification
  const handleSubmitScan = async () => {
    if (!selectedFacility) {
      setError('Please select a drop-off facility');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const token = localStorage.getItem('token');

      const submitResponse = await axios.post(
        'http://localhost:5000/api/scan/submit',
        {
          facility_id: selectedFacility,
          item_type: result.item_type,
          item_subtype: result.item_subtype,
          confidence: result.confidence,
          points_earned: result.points_earned,
          image_path: result.image_path,
          recycling_tips: result.tips,
          gemini_raw_response: result.gemini_raw_response,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      // Store streak info from response
      if (submitResponse.data?.data?.streak) {
        setStreakInfo(submitResponse.data.data.streak);
      }

      // Store the selected facility info for drop-off instructions
      const facilityInfo = facilities.find(f => f.facility_id === selectedFacility);
      setSubmittedFacility(facilityInfo);

      // Close facility dialog
      setShowFacilitySelect(false);

      // Show success message - result stays visible with pending status
      setError('');
    } catch (err) {
      console.error('Submit error:', err);
      setError(
        err.response?.data?.message ||
          'Failed to submit scan. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Get confidence color
  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.8) return '#4caf50'; // Green
    if (confidence >= 0.6) return '#ff9800'; // Orange
    return '#f44336'; // Red
  };

  // Get item type color
  const getItemTypeColor = (type) => {
    const colors = {
      Plastic: '#2196f3',
      Metal: '#9e9e9e',
      Glass: '#00bcd4',
      Paper: '#795548',
      Organic: '#8bc34a',
      'E-waste': '#ff5722',
      'Non-recyclable': '#f44336',
    };
    return colors[type] || '#757575';
  };

  // Get username from localStorage
  const getUsername = () => {
    try {
      const userData = localStorage.getItem('user');
      if (userData) {
        const user = JSON.parse(userData);
        return user.username || 'User';
      }
    } catch (e) {
      console.error('Error getting username:', e);
    }
    return 'User';
  };

  // Copy username to clipboard
  const handleCopyUsername = async () => {
    const username = getUsername();
    try {
      await navigator.clipboard.writeText(username);
      setUsernameCopied(true);
      setTimeout(() => setUsernameCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy username:', err);
    }
  };

  // Format opening hours for display
  const formatOpeningHours = (hours) => {
    if (!hours) return 'Contact facility for hours';
    if (typeof hours === 'string') return hours;
    if (typeof hours === 'object') {
      // Handle JSON format like { "Mon-Fri": "9AM-6PM", "Sat": "9AM-1PM" }
      return Object.entries(hours)
        .map(([day, time]) => `${day}: ${time}`)
        .join(' | ');
    }
    return 'Contact facility for hours';
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #F5F5F5 0%, #E8F5E9 100%)',
        padding: { xs: 2, sm: 3 },
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
      <Box sx={{ maxWidth: 800, margin: '0 auto', position: 'relative', zIndex: 1 }}>
        {/* Page Header */}
        <Box sx={{ textAlign: 'center', mb: 4, pt: { xs: 2, sm: 3 } }}>
          <Typography
            variant="h5"
            sx={{
              fontWeight: 700,
              color: '#2D5016',
              mb: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1,
              fontSize: { xs: '1.3rem', sm: '1.5rem' },
            }}
          >
            <Recycling sx={{ fontSize: 32 }} />
            AI Waste Scanner
          </Typography>
          <Typography variant="body1" sx={{ color: '#666' }}>
            Upload or capture an image to identify recyclable items
          </Typography>
        </Box>

        {/* Main Card */}
        <Card
          elevation={0}
          sx={{
            padding: { xs: 2, sm: 3, md: 4 },
            borderRadius: 4,
            backdropFilter: 'blur(20px) saturate(180%)',
            background: 'rgba(255, 255, 255, 0.75)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            boxShadow: `
              0 8px 32px 0 rgba(45, 80, 22, 0.15),
              0 2px 8px 0 rgba(45, 80, 22, 0.08),
              inset 0 0 0 1px rgba(255, 255, 255, 0.4)
            `,
          }}
        >
          {/* Error Alert */}
          {error && (
            <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
              {error}
            </Alert>
          )}

          {/* Upload Section */}
          {!selectedImage && !result && (
            <Box>
              <Typography variant="h6" sx={{ mb: 3, color: '#2D5016', textAlign: 'center' }}>
                Choose an option to get started
              </Typography>

              <Stack spacing={2}>
                {/* Camera Button */}
                <Button
                  variant="contained"
                  fullWidth
                  startIcon={<CameraAlt />}
                  onClick={handleOpenCamera}
                  sx={{
                    height: 60,
                    borderRadius: 2,
                    background: 'linear-gradient(135deg, #2D5016 0%, #3D6B1F 100%)',
                    fontSize: '1rem',
                    fontWeight: 600,
                    textTransform: 'none',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #3D6B1F 0%, #2D5016 100%)',
                      transform: 'scale(1.02)',
                    },
                  }}
                >
                  Take Photo
                </Button>

                <Divider>
                  <Typography variant="body2" sx={{ color: '#666' }}>
                    or
                  </Typography>
                </Divider>

                {/* Upload Button */}
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<Upload />}
                  onClick={() => fileInputRef.current?.click()}
                  sx={{
                    height: 60,
                    borderRadius: 2,
                    borderColor: '#2D5016',
                    color: '#2D5016',
                    fontSize: '1rem',
                    fontWeight: 600,
                    textTransform: 'none',
                    '&:hover': {
                      borderColor: '#3D6B1F',
                      background: 'rgba(45, 80, 22, 0.05)',
                      transform: 'scale(1.02)',
                    },
                  }}
                >
                  Upload Image
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png"
                  style={{ display: 'none' }}
                  onChange={handleFileSelect}
                />
              </Stack>

              <Typography
                variant="caption"
                sx={{ display: 'block', textAlign: 'center', mt: 2, color: '#999' }}
              >
                Supported formats: JPG, PNG (max 5MB)
              </Typography>
            </Box>
          )}

          {/* Image Preview */}
          {selectedImage && !result && (
            <Box>
              <Box sx={{ position: 'relative', mb: 3 }}>
                <img
                  src={imagePreview}
                  alt="Preview"
                  style={{
                    width: '100%',
                    maxHeight: '400px',
                    objectFit: 'contain',
                    borderRadius: '12px',
                  }}
                />
                <IconButton
                  onClick={handleClearImage}
                  sx={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    background: 'rgba(0, 0, 0, 0.6)',
                    color: '#fff',
                    '&:hover': {
                      background: 'rgba(0, 0, 0, 0.8)',
                    },
                  }}
                >
                  <Close />
                </IconButton>
              </Box>

              <Button
                fullWidth
                variant="contained"
                onClick={handleAnalyze}
                disabled={loading}
                sx={{
                  height: 56,
                  borderRadius: 2,
                  background: 'linear-gradient(135deg, #2D5016 0%, #3D6B1F 100%)',
                  fontSize: '1.1rem',
                  fontWeight: 600,
                  textTransform: 'none',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #3D6B1F 0%, #2D5016 100%)',
                  },
                }}
              >
                {loading ? 'Analyzing...' : 'Analyze Item'}
              </Button>
            </Box>
          )}

          {/* Result Display - Different UI for Non-recyclable vs Submitted items */}
          {result && !showFacilitySelect && (
            <Box>
              {/* Header - Different for Non-recyclable */}
              <Box sx={{ textAlign: 'center', mb: 3 }}>
                {result.item_type === 'Non-recyclable' ? (
                  <>
                    <Block sx={{ fontSize: 60, color: '#9e9e9e', mb: 1 }} />
                    <Typography variant="h5" sx={{ fontWeight: 700, color: '#616161' }}>
                      Item Analyzed
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#d32f2f', mt: 1, fontWeight: 500 }}>
                      This item cannot be recycled
                    </Typography>
                  </>
                ) : (
                  <>
                    <HourglassEmpty sx={{ fontSize: 60, color: '#ff9800', mb: 1 }} />
                    <Typography variant="h5" sx={{ fontWeight: 700, color: '#2D5016' }}>
                      Scan Submitted!
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#666', mt: 1 }}>
                      Awaiting admin verification...
                    </Typography>
                  </>
                )}
              </Box>

              {/* Image Preview (smaller) */}
              <Box
                sx={{
                  mb: 3,
                  textAlign: 'center',
                }}
              >
                <img
                  src={imagePreview}
                  alt="Scanned item"
                  style={{
                    maxWidth: '200px',
                    maxHeight: '200px',
                    objectFit: 'contain',
                    borderRadius: '12px',
                    border: result.item_type === 'Non-recyclable' ? '3px solid #9e9e9e' : '3px solid #ff9800',
                  }}
                />
              </Box>

              {/* Classification Details */}
              <Box sx={{ mb: 3 }}>
                <Stack spacing={2}>
                  {/* Item Type */}
                  <Box>
                    <Typography variant="caption" sx={{ color: '#666', display: 'block', mb: 0.5 }}>
                      Item Type
                    </Typography>
                    <Chip
                      label={result.item_type}
                      sx={{
                        backgroundColor: getItemTypeColor(result.item_type),
                        color: '#fff',
                        fontWeight: 600,
                        fontSize: '1rem',
                        height: 36,
                        px: 1,
                      }}
                    />
                  </Box>

                  {/* Item Subtype */}
                  <Box>
                    <Typography variant="caption" sx={{ color: '#666', display: 'block', mb: 0.5 }}>
                      Identified As
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 600, color: '#333' }}>
                      {result.item_subtype}
                    </Typography>
                  </Box>

                  {/* Confidence */}
                  <Box>
                    <Typography variant="caption" sx={{ color: '#666', display: 'block', mb: 0.5 }}>
                      AI Confidence: {Math.round(result.confidence * 100)}%
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={result.confidence * 100}
                      sx={{
                        height: 10,
                        borderRadius: 5,
                        backgroundColor: '#e0e0e0',
                        '& .MuiLinearProgress-bar': {
                          backgroundColor: getConfidenceColor(result.confidence),
                          borderRadius: 5,
                        },
                      }}
                    />
                  </Box>

                  {/* Pending Points - Only for recyclable items */}
                  {result.item_type !== 'Non-recyclable' && (
                    <Box
                      sx={{
                        background: 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)',
                        borderRadius: 2,
                        padding: 2,
                        textAlign: 'center',
                      }}
                    >
                      <HourglassEmpty sx={{ fontSize: 40, color: '#fff', mb: 0.5 }} />
                      <Typography variant="h4" sx={{ fontWeight: 700, color: '#fff' }}>
                        +{result.points_earned}
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#fff', opacity: 0.9 }}>
                        Points Pending Verification
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#fff', display: 'block', mt: 1 }}>
                        You'll receive an email once approved!
                      </Typography>
                    </Box>
                  )}

                  {/* Streak Info - Show after successful submission */}
                  {streakInfo && result.item_type !== 'Non-recyclable' && (
                    <Box
                      sx={{
                        background: streakInfo.current >= 7
                          ? 'linear-gradient(135deg, #ff6b35 0%, #f7931e 100%)'
                          : streakInfo.current >= 3
                          ? 'linear-gradient(135deg, #ff8a65 0%, #ffab91 100%)'
                          : 'linear-gradient(135deg, #a5d6a7 0%, #81c784 100%)',
                        borderRadius: 2,
                        padding: 2,
                        textAlign: 'center',
                        border: streakInfo.grace_used ? '2px dashed #fff' : 'none',
                      }}
                    >
                      <Whatshot
                        sx={{
                          fontSize: 36,
                          color: '#fff',
                          mb: 0.5,
                          animation: streakInfo.current > 1 ? 'pulse 1s infinite' : 'none',
                          '@keyframes pulse': {
                            '0%, 100%': { transform: 'scale(1)' },
                            '50%': { transform: 'scale(1.1)' },
                          },
                        }}
                      />
                      <Typography variant="h5" sx={{ fontWeight: 700, color: '#fff' }}>
                        {streakInfo.current} Day{streakInfo.current !== 1 ? 's' : ''} Streak!
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#fff', opacity: 0.9, mt: 0.5 }}>
                        {streakInfo.message}
                      </Typography>
                      {streakInfo.grace_used && (
                        <Chip
                          label="Grace Period Used"
                          size="small"
                          sx={{
                            mt: 1,
                            bgcolor: 'rgba(255,255,255,0.3)',
                            color: '#fff',
                            fontSize: '0.7rem',
                          }}
                        />
                      )}
                    </Box>
                  )}

                  {/* Non-recyclable Notice - Only for non-recyclable items */}
                  {result.item_type === 'Non-recyclable' && (
                    <Box
                      sx={{
                        background: 'linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%)',
                        borderRadius: 2,
                        padding: 2,
                        border: '1px solid #ef9a9a',
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Block sx={{ color: '#d32f2f' }} />
                        <Typography variant="body1" sx={{ fontWeight: 600, color: '#c62828' }}>
                          No Points Awarded
                        </Typography>
                      </Box>
                      <Typography variant="body2" sx={{ color: '#666' }}>
                        This item doesn't qualify for recycling points. Please dispose of it properly in regular waste.
                      </Typography>
                    </Box>
                  )}
                </Stack>
              </Box>

              {/* Disposal/Recycling Tips */}
              {result.tips && (
                <Box
                  sx={{
                    background: result.item_type === 'Non-recyclable'
                      ? 'rgba(158, 158, 158, 0.1)'
                      : 'rgba(45, 80, 22, 0.05)',
                    borderRadius: 2,
                    padding: 2,
                    mb: 3,
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Info sx={{ color: result.item_type === 'Non-recyclable' ? '#616161' : '#2D5016' }} />
                    <Typography
                      variant="h6"
                      sx={{
                        fontWeight: 600,
                        color: result.item_type === 'Non-recyclable' ? '#616161' : '#2D5016'
                      }}
                    >
                      {result.item_type === 'Non-recyclable' ? 'Disposal Tips' : 'Recycling Tips'}
                    </Typography>
                  </Box>
                  <Typography variant="body2" sx={{ color: '#333', lineHeight: 1.6 }}>
                    {result.tips}
                  </Typography>
                </Box>
              )}

              {/* Drop-off Instructions Card */}
              {submittedFacility && (
                <Card
                  elevation={0}
                  sx={{
                    mb: 3,
                    borderRadius: 3,
                    border: '2px solid #2D5016',
                    background: 'linear-gradient(135deg, #f1f8e9 0%, #e8f5e9 100%)',
                    overflow: 'hidden',
                  }}
                >
                  {/* Header */}
                  <Box
                    sx={{
                      background: 'linear-gradient(135deg, #2D5016 0%, #3D6B1F 100%)',
                      color: '#fff',
                      p: 2,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                    }}
                  >
                    <CheckCircleOutline sx={{ fontSize: 28 }} />
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.1rem' }}>
                        Drop-off Instructions
                      </Typography>
                      <Typography variant="caption" sx={{ opacity: 0.9 }}>
                        Follow these steps to complete your recycling
                      </Typography>
                    </Box>
                  </Box>

                  <Box sx={{ p: 2.5 }}>
                    {/* Step 1: Facility Info */}
                    <Box sx={{ display: 'flex', gap: 2, mb: 2.5 }}>
                      <Box
                        sx={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          background: '#2D5016',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        1
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body1" sx={{ fontWeight: 600, color: '#2D5016', mb: 0.5 }}>
                          Go to your selected facility
                        </Typography>
                        <Box
                          sx={{
                            background: '#fff',
                            borderRadius: 2,
                            p: 1.5,
                            border: '1px solid #c8e6c9',
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                            <LocationOn sx={{ color: '#2D5016', fontSize: 20 }} />
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {submittedFacility.facility_name}
                            </Typography>
                          </Box>
                          {submittedFacility.address && (
                            <Typography variant="caption" sx={{ color: '#666', display: 'block', ml: 3.5 }}>
                              {submittedFacility.address}
                            </Typography>
                          )}
                          {submittedFacility.opening_hours && (
                            <Typography variant="caption" sx={{ color: '#558b2f', display: 'block', ml: 3.5, mt: 0.5 }}>
                              🕐 {formatOpeningHours(submittedFacility.opening_hours)}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    </Box>

                    {/* Step 2: Get Sticker */}
                    <Box sx={{ display: 'flex', gap: 2, mb: 2.5 }}>
                      <Box
                        sx={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          background: '#2D5016',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        2
                      </Box>
                      <Box>
                        <Typography variant="body1" sx={{ fontWeight: 600, color: '#2D5016', mb: 0.5 }}>
                          Get a sticker label from staff
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#666' }}>
                          🏷️ Stickers are provided FREE at the facility
                        </Typography>
                      </Box>
                    </Box>

                    {/* Step 3: Write Username - HIGHLIGHTED */}
                    <Box sx={{ display: 'flex', gap: 2, mb: 2.5 }}>
                      <Box
                        sx={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          background: '#2D5016',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        3
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body1" sx={{ fontWeight: 600, color: '#2D5016', mb: 1 }}>
                          Write your username on the sticker
                        </Typography>
                        {/* Username Sticker Preview */}
                        <Box
                          sx={{
                            background: '#fff',
                            border: '3px dashed #ff9800',
                            borderRadius: 2,
                            p: 2,
                            textAlign: 'center',
                            position: 'relative',
                          }}
                        >
                          <Typography variant="caption" sx={{ color: '#666', display: 'block', mb: 0.5 }}>
                            ♻️ ECOREWARD HUB
                          </Typography>
                          <Divider sx={{ my: 1 }} />
                          <Typography variant="caption" sx={{ color: '#888' }}>
                            Username:
                          </Typography>
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 1,
                              mt: 0.5,
                            }}
                          >
                            <Typography
                              variant="h5"
                              sx={{
                                fontWeight: 700,
                                color: '#2D5016',
                                background: 'linear-gradient(135deg, #ffeb3b 0%, #ffc107 100%)',
                                px: 2,
                                py: 0.5,
                                borderRadius: 1,
                                border: '2px solid #f57c00',
                              }}
                            >
                              {getUsername()}
                            </Typography>
                          </Box>
                          <Button
                            size="small"
                            startIcon={usernameCopied ? <CheckCircle /> : <ContentCopy />}
                            onClick={handleCopyUsername}
                            sx={{
                              mt: 1.5,
                              color: usernameCopied ? '#4caf50' : '#2D5016',
                              fontSize: '0.75rem',
                            }}
                          >
                            {usernameCopied ? 'Copied!' : 'Copy Username'}
                          </Button>
                          <Typography
                            variant="caption"
                            sx={{
                              position: 'absolute',
                              top: 8,
                              right: 8,
                              color: '#ff9800',
                              fontWeight: 600,
                            }}
                          >
                            ← Write this!
                          </Typography>
                        </Box>
                      </Box>
                    </Box>

                    {/* Step 4: Stick Label */}
                    <Box sx={{ display: 'flex', gap: 2, mb: 2.5 }}>
                      <Box
                        sx={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          background: '#2D5016',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        4
                      </Box>
                      <Box>
                        <Typography variant="body1" sx={{ fontWeight: 600, color: '#2D5016', mb: 0.5 }}>
                          Attach the sticker to your item
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#666' }}>
                          Place it visibly on the item so staff can see it
                        </Typography>
                      </Box>
                    </Box>

                    {/* Step 5: Hand to Staff */}
                    <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                      <Box
                        sx={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          background: '#2D5016',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        5
                      </Box>
                      <Box>
                        <Typography variant="body1" sx={{ fontWeight: 600, color: '#2D5016', mb: 0.5 }}>
                          Hand to staff for verification
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#666' }}>
                          Staff will verify and approve your submission ✓
                        </Typography>
                      </Box>
                    </Box>

                    {/* Tips and Info */}
                    <Box
                      sx={{
                        background: '#fff8e1',
                        borderRadius: 2,
                        p: 2,
                        borderLeft: '4px solid #ffc107',
                        mb: 2,
                      }}
                    >
                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#f57c00', mb: 0.5 }}>
                        💡 Tip
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#666' }}>
                        Take a photo of your labeled item as proof of drop-off!
                      </Typography>
                    </Box>

                    <Box
                      sx={{
                        background: '#e3f2fd',
                        borderRadius: 2,
                        p: 2,
                        borderLeft: '4px solid #2196f3',
                      }}
                    >
                      <Typography variant="body2" sx={{ color: '#1565c0' }}>
                        ⏰ Points will be awarded after staff verification
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#1565c0', mt: 0.5 }}>
                        📧 You'll receive an email confirmation once approved
                      </Typography>
                    </Box>

                    {/* FAQ Section */}
                    <Box sx={{ mt: 2 }}>
                      <Button
                        fullWidth
                        onClick={() => setShowFaq(!showFaq)}
                        endIcon={showFaq ? <ExpandLess /> : <ExpandMore />}
                        sx={{
                          color: '#666',
                          justifyContent: 'space-between',
                          textTransform: 'none',
                        }}
                      >
                        Frequently Asked Questions
                      </Button>
                      {showFaq && (
                        <Box sx={{ mt: 1, pl: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: '#333', mb: 0.5 }}>
                            What if I forget to label my item?
                          </Typography>
                          <Typography variant="body2" sx={{ color: '#666', mb: 1.5, pl: 1 }}>
                            The item cannot be verified and no points will be awarded.
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: '#333', mb: 0.5 }}>
                            Can I drop off multiple items?
                          </Typography>
                          <Typography variant="body2" sx={{ color: '#666', mb: 1.5, pl: 1 }}>
                            Yes! Label each item separately with your username.
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: '#333', mb: 0.5 }}>
                            What if the facility is closed?
                          </Typography>
                          <Typography variant="body2" sx={{ color: '#666', pl: 1 }}>
                            Check the operating hours above and drop off during open hours.
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  </Box>
                </Card>
              )}

              {/* Action Buttons */}
              <Stack spacing={2}>
                <Button
                  fullWidth
                  variant="contained"
                  onClick={handleClearImage}
                  sx={{
                    height: 48,
                    borderRadius: 2,
                    background: 'linear-gradient(135deg, #2D5016 0%, #3D6B1F 100%)',
                    fontWeight: 600,
                    textTransform: 'none',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #3D6B1F 0%, #2D5016 100%)',
                    },
                  }}
                >
                  Scan Another Item
                </Button>

                <Button
                  fullWidth
                  variant="outlined"
                  onClick={() => navigate('/dashboard')}
                  sx={{
                    height: 48,
                    borderRadius: 2,
                    borderColor: '#2D5016',
                    color: '#2D5016',
                    fontWeight: 600,
                    textTransform: 'none',
                    '&:hover': {
                      borderColor: '#3D6B1F',
                      background: 'rgba(45, 80, 22, 0.05)',
                    },
                  }}
                >
                  Back to Dashboard
                </Button>
              </Stack>
            </Box>
          )}
        </Card>

        {/* Low Confidence Warning Dialog */}
        <Dialog
          open={showLowConfidenceWarning}
          onClose={() => setShowLowConfidenceWarning(false)}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: 3,
              boxShadow: '0 8px 32px rgba(244, 67, 54, 0.2)',
            },
          }}
        >
          <DialogTitle
            sx={{
              background: 'linear-gradient(135deg, #f44336 0%, #d32f2f 100%)',
              color: '#fff',
              pb: 2,
              pt: 2.5,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Info sx={{ fontSize: 28 }} />
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.25rem' }}>
                  Low AI Confidence Detected
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.9, fontSize: '0.85rem' }}>
                  The scan quality may not be optimal
                </Typography>
              </Box>
            </Box>
          </DialogTitle>

          <DialogContent sx={{ pt: 4, pb: 2, px: 3 }}>
            <Alert
              severity="warning"
              sx={{
                mb: 3,
                borderRadius: 2,
                background: 'linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)',
                border: '1px solid #ffb74d',
                '& .MuiAlert-icon': { color: '#f57c00' },
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                AI confidence is only{' '}
                <strong>{result ? Math.round(result.confidence * 100) : 0}%</strong>
              </Typography>
            </Alert>

            {result && (
              <Box
                sx={{
                  mb: 3,
                  p: 2.5,
                  background: 'linear-gradient(135deg, #f5f5f5 0%, #eeeeee 100%)',
                  borderRadius: 2,
                  border: '2px solid #bdbdbd',
                }}
              >
                <Typography variant="caption" sx={{ color: '#666', fontWeight: 600 }}>
                  Analysis Result:
                </Typography>
                <Typography variant="h6" sx={{ color: '#424242', fontWeight: 700, mt: 0.5 }}>
                  {result.item_type} - {result.item_subtype}
                </Typography>
              </Box>
            )}

            <Box
              sx={{
                p: 2.5,
                background: '#fff8e1',
                borderRadius: 2,
                borderLeft: '4px solid #ffc107',
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 1, color: '#f57c00' }}>
                ⚠️ What does this mean?
              </Typography>
              <Typography variant="body2" sx={{ color: '#666', mb: 1 }}>
                • The image quality may be poor (blurry, dark, or unclear)
              </Typography>
              <Typography variant="body2" sx={{ color: '#666', mb: 1 }}>
                • The AI is not certain about the item identification
              </Typography>
              <Typography variant="body2" sx={{ color: '#666' }}>
                • Your submission may be rejected during admin review
              </Typography>
            </Box>

            <Box
              sx={{
                mt: 3,
                p: 2,
                background: '#e8f5e9',
                borderRadius: 2,
                borderLeft: '4px solid #4caf50',
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 1, color: '#2e7d32' }}>
                💡 Recommendation
              </Typography>
              <Typography variant="body2" sx={{ color: '#666' }}>
                We recommend rescanning with better lighting and a clearer photo for higher accuracy
                and faster approval.
              </Typography>
            </Box>
          </DialogContent>

          <DialogActions sx={{ p: 2.5, pt: 2, background: '#fafafa', borderTop: '1px solid #e0e0e0' }}>
            <Button
              onClick={handleRescan}
              variant="outlined"
              sx={{
                color: '#f57c00',
                borderColor: '#f57c00',
                fontWeight: 600,
                px: 3,
                borderRadius: 2,
                '&:hover': {
                  background: 'rgba(245, 124, 0, 0.08)',
                  borderColor: '#f57c00',
                },
              }}
            >
              🔄 Rescan
            </Button>
            <Button
              onClick={handleContinueAnyway}
              variant="contained"
              sx={{
                background: 'linear-gradient(135deg, #f44336 0%, #d32f2f 100%)',
                color: '#fff',
                fontWeight: 700,
                px: 3,
                py: 1,
                borderRadius: 2,
                textTransform: 'none',
                fontSize: '1rem',
                boxShadow: '0 4px 12px rgba(244, 67, 54, 0.3)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #d32f2f 0%, #c62828 100%)',
                  boxShadow: '0 6px 16px rgba(244, 67, 54, 0.4)',
                },
              }}
            >
              Continue Anyway →
            </Button>
          </DialogActions>
        </Dialog>

        {/* Non-recyclable Item Warning Dialog */}
        <Dialog
          open={showNonRecyclableWarning}
          onClose={() => setShowNonRecyclableWarning(false)}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: 3,
              boxShadow: '0 8px 32px rgba(158, 158, 158, 0.3)',
            },
          }}
        >
          <DialogTitle
            sx={{
              background: 'linear-gradient(135deg, #616161 0%, #424242 100%)',
              color: '#fff',
              pb: 2,
              pt: 2.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Block sx={{ fontSize: 28 }} />
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.25rem' }}>
                  Non-Recyclable Item Detected
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.9, fontSize: '0.85rem' }}>
                  This item cannot be recycled
                </Typography>
              </Box>
            </Box>
            <IconButton
              onClick={() => setShowNonRecyclableWarning(false)}
              sx={{
                color: '#fff',
                '&:hover': {
                  background: 'rgba(255, 255, 255, 0.1)',
                },
              }}
            >
              <Close />
            </IconButton>
          </DialogTitle>

          <DialogContent sx={{ pt: 3, pb: 2, px: 3 }}>
            <Alert
              severity="warning"
              sx={{
                mb: 3,
                mt: 1,
                borderRadius: 2,
                background: 'linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%)',
                border: '1px solid #ef9a9a',
                '& .MuiAlert-icon': { color: '#d32f2f' },
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                Our AI has determined this item is <strong>not recyclable</strong>
              </Typography>
            </Alert>

            {result && (
              <Box
                sx={{
                  mb: 3,
                  p: 2.5,
                  background: 'linear-gradient(135deg, #f5f5f5 0%, #eeeeee 100%)',
                  borderRadius: 2,
                  border: '2px solid #bdbdbd',
                }}
              >
                <Typography variant="caption" sx={{ color: '#666', fontWeight: 600 }}>
                  Identified As:
                </Typography>
                <Typography variant="h6" sx={{ color: '#424242', fontWeight: 700, mt: 0.5 }}>
                  {result.item_subtype}
                </Typography>
                <Chip
                  label="Non-recyclable"
                  size="small"
                  sx={{
                    mt: 1,
                    bgcolor: '#9e9e9e',
                    color: '#fff',
                    fontWeight: 600,
                  }}
                />
              </Box>
            )}

            <Box
              sx={{
                p: 2.5,
                background: '#fff3e0',
                borderRadius: 2,
                borderLeft: '4px solid #ff9800',
                mb: 2,
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 1, color: '#e65100' }}>
                ⚠️ Why can't this be recycled?
              </Typography>
              <Typography variant="body2" sx={{ color: '#666', mb: 1 }}>
                • The item doesn't fall into recyclable categories (Plastic, Metal, Glass, Paper, Organic, E-waste)
              </Typography>
              <Typography variant="body2" sx={{ color: '#666' }}>
                • Only verified recyclable items can earn points
              </Typography>
            </Box>

            <Box
              sx={{
                p: 2,
                background: '#e3f2fd',
                borderRadius: 2,
                borderLeft: '4px solid #2196f3',
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 1, color: '#1565c0' }}>
                💡 What should you do?
              </Typography>
              <Typography variant="body2" sx={{ color: '#666' }}>
                Dispose of this item in regular waste. Try scanning a different item that's made of recyclable materials.
              </Typography>
            </Box>
          </DialogContent>

          <DialogActions sx={{ p: 2.5, pt: 2, background: '#fafafa', borderTop: '1px solid #e0e0e0' }}>
            <Button
              onClick={() => {
                setShowNonRecyclableWarning(false);
                handleClearImage();
              }}
              variant="contained"
              sx={{
                background: 'linear-gradient(135deg, #2D5016 0%, #3D6B1F 100%)',
                color: '#fff',
                fontWeight: 700,
                px: 3,
                py: 1,
                borderRadius: 2,
                textTransform: 'none',
                fontSize: '1rem',
                boxShadow: '0 4px 12px rgba(45, 80, 22, 0.3)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #3D6B1F 0%, #2D5016 100%)',
                  boxShadow: '0 6px 16px rgba(45, 80, 22, 0.4)',
                },
              }}
            >
              🔄 Scan Different Item
            </Button>
          </DialogActions>
        </Dialog>

        {/* NEW: Facility Selection Dialog */}
        <Dialog
          open={showFacilitySelect}
          onClose={() => !submitting && setShowFacilitySelect(false)}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: 3,
              boxShadow: '0 8px 32px rgba(45, 80, 22, 0.15)',
            },
          }}
        >
          <DialogTitle
            sx={{
              background: 'linear-gradient(135deg, #2D5016 0%, #3D6B1F 100%)',
              color: '#fff',
              pb: 2,
              pt: 2.5,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <LocationOn sx={{ fontSize: 28 }} />
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.25rem' }}>
                  Select Drop-off Location
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.9, fontSize: '0.85rem' }}>
                  Where will you recycle this item?
                </Typography>
              </Box>
            </Box>
          </DialogTitle>

          <DialogContent sx={{ pt: 4, pb: 2, px: 3 }}>
            <Alert
              severity="info"
              icon={<HourglassEmpty />}
              sx={{
                mb: 3,
                borderRadius: 2,
                background: 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)',
                border: '1px solid #90caf9',
                '& .MuiAlert-icon': { color: '#1976d2' },
                mt: 0.5,
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                Admin will verify your submission before awarding points
              </Typography>
            </Alert>

            {result && (
              <Box
                sx={{
                  mb: 3,
                  p: 2.5,
                  background: 'linear-gradient(135deg, #f1f8e9 0%, #dcedc8 100%)',
                  borderRadius: 2,
                  border: '2px solid #aed581',
                  boxShadow: '0 2px 8px rgba(45, 80, 22, 0.1)',
                }}
              >
                <Typography variant="caption" sx={{ color: '#558b2f', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  ✓ AI Analysis Complete
                </Typography>
                <Typography variant="h6" sx={{ color: '#2D5016', fontWeight: 700, mt: 1, fontSize: '1.15rem' }}>
                  {result.item_type} - {result.item_subtype}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.5 }}>
                  <HourglassEmpty sx={{ fontSize: 18, color: '#ff9800' }} />
                  <Typography variant="body2" sx={{ color: '#f57c00', fontWeight: 600 }}>
                    Pending: +{result.points_earned} points
                  </Typography>
                </Box>
              </Box>
            )}

            <FormControl
              fullWidth
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#2D5016',
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#2D5016',
                    borderWidth: 2,
                  },
                },
                '& .MuiInputLabel-root.Mui-focused': {
                  color: '#2D5016',
                },
              }}
            >
              <InputLabel sx={{ fontWeight: 500 }}>Choose Recycling Facility</InputLabel>
              <Select
                value={selectedFacility}
                onChange={(e) => setSelectedFacility(e.target.value)}
                label="Choose Recycling Facility"
              >
                {facilities.map((facility) => (
                  <MenuItem
                    key={facility.facility_id}
                    value={facility.facility_id}
                    sx={{
                      py: 1.5,
                      borderBottom: '1px solid #f0f0f0',
                      '&:hover': {
                        background: 'linear-gradient(135deg, rgba(45, 80, 22, 0.05) 0%, rgba(45, 80, 22, 0.08) 100%)',
                      },
                      '&.Mui-selected': {
                        background: 'linear-gradient(135deg, rgba(45, 80, 22, 0.1) 0%, rgba(45, 80, 22, 0.15) 100%)',
                        '&:hover': {
                          background: 'linear-gradient(135deg, rgba(45, 80, 22, 0.15) 0%, rgba(45, 80, 22, 0.2) 100%)',
                        },
                      },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
                      <LocationOn sx={{ color: '#2D5016', fontSize: 24 }} />
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body1" sx={{ fontWeight: 600, color: '#2D5016' }}>
                          {facility.facility_name}
                        </Typography>
                        {facility.distance && (
                          <Typography variant="caption" sx={{ color: '#666', display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.3 }}>
                            📍 {facility.distance.toFixed(1)} km away
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </DialogContent>

          <DialogActions sx={{ p: 2.5, pt: 2, background: '#fafafa', borderTop: '1px solid #e0e0e0' }}>
            <Button
              onClick={() => setShowFacilitySelect(false)}
              disabled={submitting}
              sx={{
                color: '#666',
                fontWeight: 600,
                px: 2.5,
                '&:hover': {
                  background: 'rgba(0, 0, 0, 0.05)',
                },
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitScan}
              variant="contained"
              disabled={!selectedFacility || submitting}
              sx={{
                background: 'linear-gradient(135deg, #2D5016 0%, #3D6B1F 100%)',
                color: '#fff',
                fontWeight: 700,
                px: 3,
                py: 1,
                borderRadius: 2,
                textTransform: 'none',
                fontSize: '1rem',
                boxShadow: '0 4px 12px rgba(45, 80, 22, 0.3)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #3D6B1F 0%, #2D5016 100%)',
                  boxShadow: '0 6px 16px rgba(45, 80, 22, 0.4)',
                  transform: 'translateY(-1px)',
                },
                '&:disabled': {
                  background: '#ccc',
                  color: '#888',
                },
              }}
            >
              {submitting ? 'Submitting...' : 'Submit for Verification'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Loading Overlay */}
        {loading && (
          <Box
            sx={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              flexDirection: 'column',
              gap: 2,
            }}
          >
            <Box
              sx={{
                background: '#fff',
                padding: 4,
                borderRadius: 3,
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Box
                sx={{
                  width: 150,
                  height: 150,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Lottie
                  animationData={recycleAnimation}
                  loop={true}
                  style={{ width: '100%', height: '100%' }}
                />
              </Box>
              <Typography variant="h6" sx={{ mt: 2, color: '#2D5016', fontWeight: 600 }}>
                Analyzing with AI...
              </Typography>
              <Typography variant="body2" sx={{ color: '#666' }}>
                This may take a few seconds
              </Typography>
            </Box>
          </Box>
        )}

        {/* Camera Dialog */}
        <Dialog
          open={showCamera}
          onClose={handleCloseCamera}
          maxWidth="md"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: 3,
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(10px)',
            },
          }}
        >
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6" sx={{ fontWeight: 600, color: '#2D5016' }}>
              📸 Camera
            </Typography>
            <IconButton onClick={handleCloseCamera} size="small">
              <Close />
            </IconButton>
          </DialogTitle>

          <DialogContent>
            <Box
              sx={{
                position: 'relative',
                width: '100%',
                aspectRatio: '4/3',
                bgcolor: '#000',
                borderRadius: 2,
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {/* Video Stream */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />

              {/* Hidden Canvas for capturing */}
              <canvas ref={canvasRef} style={{ display: 'none' }} />
            </Box>

            <Typography variant="body2" sx={{ mt: 2, color: '#666', textAlign: 'center' }}>
              Position your recyclable item in the frame
            </Typography>
          </DialogContent>

          <DialogActions sx={{ p: 2, gap: 1 }}>
            <Button onClick={handleCloseCamera} variant="outlined" sx={{ borderColor: '#2D5016', color: '#2D5016' }}>
              Cancel
            </Button>
            <Button
              onClick={handleCapturePhoto}
              variant="contained"
              startIcon={<CameraAlt />}
              sx={{
                background: 'linear-gradient(135deg, #2D5016 0%, #3D6B1F 100%)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #3D6B1F 0%, #2D5016 100%)',
                },
              }}
            >
              Capture Photo
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Box>
  );
}
