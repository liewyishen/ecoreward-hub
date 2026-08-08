import { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Card,
  Avatar,
  Chip,
  Grid,
  LinearProgress,
  Divider,
  CircularProgress,
  Alert,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  IconButton,
} from '@mui/material';
import {
  Star,
  LocalFireDepartment,
  Recycling,
  EmojiEvents,
  WbSunny,
  Diamond,
  CalendarToday,
  Email,
  TrendingUp,
  Edit,
  PhotoCamera,
  Close,
} from '@mui/icons-material';
import axios from 'axios';

export default function Profile() {
  const fileInputRef = useRef(null);

  const [userInfo, setUserInfo] = useState(null);
  const [achievements, setAchievements] = useState([]);
  const [unlockedCount, setUnlockedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(6);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Edit profile states
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editUsername, setEditUsername] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    fetchProfileData();
  }, []);

  const fetchProfileData = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('token');

      if (!token) {
        setError('Please log in to view your profile');
        return;
      }

      // Fetch user stats
      const statsRes = await axios.get('http://localhost:5000/api/user/stats', {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Fetch achievements
      const achRes = await axios.get('http://localhost:5000/api/achievements', {
        headers: { Authorization: `Bearer ${token}` },
      });

      setUserInfo(statsRes.data.data);
      setAchievements(achRes.data.data);
      setUnlockedCount(achRes.data.unlockedCount);
      setTotalCount(achRes.data.totalCount);
    } catch (err) {
      console.error('Failed to fetch profile:', err);
      setError('Failed to load profile data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Achievement icon mapping
  const achievementIcons = {
    1: { icon: <Star sx={{ fontSize: 40 }} />, color: '#FFD700', name: 'First Step' },
    2: {
      icon: <LocalFireDepartment sx={{ fontSize: 40 }} />,
      color: '#FF4500',
      name: '3-Day Streak',
    },
    3: { icon: <Recycling sx={{ fontSize: 40 }} />, color: '#2D5016', name: 'Plastic Hunter' },
    4: { icon: <EmojiEvents sx={{ fontSize: 40 }} />, color: '#708090', name: 'Metal Head' },
    5: { icon: <WbSunny sx={{ fontSize: 40 }} />, color: '#FFA500', name: 'Early Bird' },
    6: { icon: <Diamond sx={{ fontSize: 40 }} />, color: '#9370DB', name: 'Eco Legend' },
  };

  // Level thresholds with gradually increasing requirements
  const LEVEL_THRESHOLDS = [
    { level: 1, min: 0, max: 199 },       // Welcome bonus gets you to 150/200
    { level: 2, min: 200, max: 449 },     // Need 50 more points
    { level: 3, min: 450, max: 749 },     // Need 250 more (total gap: 250)
    { level: 4, min: 750, max: 1099 },    // Need 300 more (total gap: 300)
    { level: 5, min: 1100, max: 1499 },   // Need 350 more (total gap: 400)
    { level: 6, min: 1500, max: 1999 },   // Need 400 more (total gap: 500)
    { level: 7, min: 2000, max: 2599 },   // Need 500 more (total gap: 600)
    { level: 8, min: 2600, max: 3299 },   // Need 600 more (total gap: 700)
    { level: 9, min: 3300, max: 4099 },   // Need 700 more (total gap: 800)
    { level: 10, min: 4100, max: 4999 },  // Need 800 more (total gap: 900)
    { level: 11, min: 5000, max: Infinity }, // Max level
  ];

  // Get level info with progress to next level
  const getLevelInfo = (points = 0) => {
    const currentLevelData = LEVEL_THRESHOLDS.find(
      (tier) => points >= tier.min && points <= tier.max
    );

    if (!currentLevelData) {
      return {
        level: 1,
        progress: 0,
        pointsToNext: LEVEL_THRESHOLDS[0].max + 1,
        currentMin: 0,
        currentMax: LEVEL_THRESHOLDS[0].max,
      };
    }

    const { level, min, max } = currentLevelData;

    // If max level, show 100% progress
    if (max === Infinity) {
      return {
        level,
        progress: 100,
        pointsToNext: 0,
        currentMin: min,
        currentMax: points, // Use current points as max
      };
    }

    // Calculate progress percentage within current level
    const pointsInLevel = points - min;
    const levelRange = max - min + 1;
    const progress = Math.floor((pointsInLevel / levelRange) * 100);
    const pointsToNext = max + 1 - points;

    return {
      level,
      progress,
      pointsToNext,
      currentMin: min,
      currentMax: max,
    };
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  };

  // Open edit dialog
  const handleOpenEditDialog = () => {
    setEditUsername(userInfo?.username || '');
    // Set image preview - handle both base64 and file paths
    let previewUrl = null;
    if (userInfo?.profile_picture) {
      // Check if it's a base64 string
      if (userInfo.profile_picture.startsWith('data:')) {
        previewUrl = userInfo.profile_picture;
      } else {
        // It's a file path, prepend server URL
        previewUrl = `http://localhost:5000${userInfo.profile_picture}`;
      }
    }
    setImagePreview(previewUrl);
    setSelectedImage(null);
    setEditDialogOpen(true);
  };

  // Close edit dialog
  const handleCloseEditDialog = () => {
    setEditDialogOpen(false);
    setEditUsername('');
    setSelectedImage(null);
    setImagePreview(null);
    setError(null);
  };

  // Handle image selection
  const handleImageSelect = (event) => {
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

    setError(null);
    setSelectedImage(file);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  // Save profile changes
  const handleSaveProfile = async () => {
    try {
      setSaving(true);
      setError(null);

      const token = localStorage.getItem('token');
      const formData = new FormData();

      // Only append fields that changed
      if (editUsername !== userInfo?.username) {
        formData.append('username', editUsername);
      }

      if (selectedImage) {
        formData.append('profile_picture', selectedImage);
      }

      // Call update API
      const response = await axios.put(
        'http://localhost:5000/api/user/profile',
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      if (response.data.success) {
        // Update localStorage
        const user = JSON.parse(localStorage.getItem('user'));
        user.username = response.data.data.username;
        user.profile_picture = response.data.data.profile_picture;
        localStorage.setItem('user', JSON.stringify(user));

        setSuccessMessage('Profile updated successfully!');
        setTimeout(() => setSuccessMessage(''), 3000);
        handleCloseEditDialog();

        // Re-fetch profile data to update UI
        await fetchProfileData();
      }
    } catch (err) {
      console.error('Profile update error:', err);
      setError(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #F5F5F5 0%, #E8F5E9 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <CircularProgress sx={{ color: '#2D5016' }} size={50} />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #F5F5F5 0%, #E8F5E9 100%)',
        padding: { xs: 2, sm: 3, md: 4 },
        pb: { xs: 10, sm: 4 },
      }}
    >
      <Box sx={{ maxWidth: 900, margin: '0 auto', pt: { xs: 2, sm: 3 } }}>
        {/* Page Title */}
        <Typography
          variant="h4"
          sx={{
            fontWeight: 700,
            color: '#2D5016',
            mb: 3,
            textAlign: 'center',
            fontSize: { xs: '1.5rem', sm: '1.75rem' },
          }}
        >
          My Profile
        </Typography>

        {/* Error Alert */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Success Alert */}
        {successMessage && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMessage('')}>
            {successMessage}
          </Alert>
        )}

        {/* User Info Card */}
        <Card
          elevation={0}
          sx={{
            padding: { xs: 3, sm: 4 },
            borderRadius: 3,
            mb: 3,
            backdropFilter: 'blur(20px) saturate(180%)',
            background: 'rgba(255, 255, 255, 0.75)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            textAlign: 'center',
            position: 'relative',
          }}
        >
          {/* Edit Profile Button - Top Right */}
          <IconButton
            onClick={handleOpenEditDialog}
            sx={{
              position: 'absolute',
              top: { xs: 12, sm: 16 },
              right: { xs: 12, sm: 16 },
              bgcolor: 'rgba(45, 80, 22, 0.1)',
              color: '#2D5016',
              '&:hover': {
                bgcolor: 'rgba(45, 80, 22, 0.2)',
              },
            }}
          >
            <Edit />
          </IconButton>

          {/* Avatar */}
          <Avatar
            src={
              userInfo?.profile_picture
                ? userInfo.profile_picture.startsWith('data:')
                  ? userInfo.profile_picture
                  : `http://localhost:5000${userInfo.profile_picture}`
                : null
            }
            sx={{
              width: { xs: 80, sm: 100 },
              height: { xs: 80, sm: 100 },
              margin: '0 auto',
              mb: 2,
              bgcolor: '#2D5016',
              fontSize: { xs: '2rem', sm: '2.5rem' },
              fontWeight: 700,
            }}
          >
            {userInfo?.username?.[0]?.toUpperCase() || 'U'}
          </Avatar>

          {/* Username */}
          <Typography
            variant="h5"
            sx={{
              fontWeight: 700,
              color: '#2D5016',
              mb: 1,
              fontSize: { xs: '1.25rem', sm: '1.5rem' },
            }}
          >
            {userInfo?.username || 'User'}
          </Typography>

          {/* Email */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 2 }}>
            <Email sx={{ fontSize: 16, color: '#666' }} />
            <Typography variant="body2" sx={{ color: '#666' }}>
              {userInfo?.email || 'user@ecoreward.com'}
            </Typography>
          </Box>

          {/* Member Since */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 2 }}>
            <CalendarToday sx={{ fontSize: 16, color: '#666' }} />
            <Typography variant="body2" sx={{ color: '#666' }}>
              Member since {formatDate(userInfo?.member_since)}
            </Typography>
          </Box>

          {/* Level Chip */}
          <Chip
            icon={<TrendingUp />}
            label={`Level ${getLevelInfo(userInfo?.lifetime_points).level}`}
            sx={{
              bgcolor: '#F4A460',
              color: 'white',
              fontWeight: 600,
              fontSize: '0.9rem',
              px: 1,
              mb: 2,
            }}
          />

          {/* Level Progress Bar */}
          <Box sx={{ width: '100%', maxWidth: 300, mx: 'auto' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="caption" sx={{ color: '#666', fontSize: '0.75rem' }}>
                {userInfo?.lifetime_points || 0} points
              </Typography>
              <Typography variant="caption" sx={{ color: '#666', fontSize: '0.75rem' }}>
                {getLevelInfo(userInfo?.lifetime_points).pointsToNext > 0
                  ? `${getLevelInfo(userInfo?.lifetime_points).pointsToNext} to next level`
                  : 'Max Level!'}
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={getLevelInfo(userInfo?.lifetime_points).progress}
              sx={{
                height: 8,
                borderRadius: 4,
                bgcolor: 'rgba(244, 164, 96, 0.2)',
                '& .MuiLinearProgress-bar': {
                  bgcolor: '#F4A460',
                  borderRadius: 4,
                },
              }}
            />
          </Box>
        </Card>

        {/* Achievements Section */}
        <Card
          elevation={0}
          sx={{
            padding: { xs: 3, sm: 4 },
            borderRadius: 3,
            mb: 3,
            backdropFilter: 'blur(20px) saturate(180%)',
            background: 'rgba(255, 255, 255, 0.75)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            maxWidth: 800,
            margin: '0 auto 24px auto',
          }}
        >
          {/* Section Title */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <EmojiEvents sx={{ fontSize: 28, color: '#FFD700' }} />
            <Typography
              variant="h6"
              sx={{
                fontWeight: 700,
                color: '#2D5016',
                fontSize: { xs: '1.1rem', sm: '1.25rem' },
              }}
            >
              Achievements
            </Typography>
          </Box>

          {/* Progress Bar */}
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" sx={{ color: '#666' }}>
                {unlockedCount} of {totalCount} unlocked
              </Typography>
              <Typography variant="body2" sx={{ color: '#2D5016', fontWeight: 600 }}>
                {totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0}% Complete
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={totalCount > 0 ? (unlockedCount / totalCount) * 100 : 0}
              sx={{
                height: 10,
                borderRadius: 5,
                bgcolor: '#E0E0E0',
                '& .MuiLinearProgress-bar': {
                  bgcolor: '#2D5016',
                  borderRadius: 5,
                },
              }}
            />
          </Box>

          {/* Achievement Grid */}
          <Grid container spacing={{ xs: 2, sm: 2.5 }} sx={{ justifyContent: 'center' }}>
            {achievements.map((ach) => {
              const iconData = achievementIcons[ach.achievement_id] || achievementIcons[1];
              const isUnlocked = ach.is_unlocked;

              return (
                <Grid item xs={6} sm={4} md={4} key={ach.achievement_id}>
                  <Tooltip
                    title={
                      <Box sx={{ p: 0.5 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                          {ach.achievement_name}
                        </Typography>
                        <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
                          {ach.description}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#FFD700' }}>
                          +{ach.points_reward} points
                        </Typography>
                        {isUnlocked && ach.unlocked_at && (
                          <Typography variant="caption" sx={{ display: 'block', mt: 0.5, fontStyle: 'italic' }}>
                            Unlocked: {new Date(ach.unlocked_at).toLocaleDateString()}
                          </Typography>
                        )}
                      </Box>
                    }
                    arrow
                  >
                    <Card
                      sx={{
                        textAlign: 'center',
                        p: { xs: 2, sm: 2.5 },
                        borderRadius: '12px',
                        minHeight: 180,
                        maxHeight: 180,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        // KEY STYLE: Grayscale for locked achievements
                        filter: isUnlocked ? 'none' : 'grayscale(100%)',
                        opacity: isUnlocked ? 1 : 0.5,
                        transition: 'all 0.3s ease',
                        cursor: 'pointer',
                        '&:hover': {
                          transform: 'translateY(-4px)',
                          boxShadow: isUnlocked ? 3 : 1,
                        },
                        border: isUnlocked
                          ? `2px solid ${iconData.color}`
                          : '1px solid #e0e0e0',
                        background: isUnlocked
                          ? `linear-gradient(135deg, ${iconData.color}10 0%, ${iconData.color}20 100%)`
                          : 'rgba(245, 245, 245, 0.5)',
                      }}
                    >
                      {/* Icon */}
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          mb: 1,
                          color: isUnlocked ? iconData.color : '#999',
                        }}
                      >
                        {iconData.icon}
                      </Box>

                      {/* Achievement Name */}
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 600,
                          color: isUnlocked ? '#2D5016' : '#999',
                          mb: 0.5,
                          fontSize: { xs: '0.75rem', sm: '0.85rem' },
                        }}
                      >
                        {ach.achievement_name}
                      </Typography>

                      {/* Rarity Badge */}
                      <Chip
                        label={ach.rarity}
                        size="small"
                        sx={{
                          fontSize: '0.65rem',
                          height: 20,
                          bgcolor: isUnlocked ? iconData.color : '#ccc',
                          color: 'white',
                        }}
                      />

                      {/* Lock/Unlock Indicator */}
                      <Typography
                        variant="caption"
                        sx={{
                          display: 'block',
                          mt: 1,
                          color: isUnlocked ? '#2D5016' : '#999',
                          fontSize: '0.7rem',
                        }}
                      >
                        {isUnlocked ? '✅ Unlocked' : '🔒 Locked'}
                      </Typography>
                    </Card>
                  </Tooltip>
                </Grid>
              );
            })}
          </Grid>
        </Card>

        {/* Stats Overview */}
        <Card
          elevation={0}
          sx={{
            padding: { xs: 3, sm: 4 },
            borderRadius: 3,
            backdropFilter: 'blur(20px) saturate(180%)',
            background: 'rgba(255, 255, 255, 0.75)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
          }}
        >
          {/* Section Title */}
          <Typography
            variant="h6"
            sx={{
              fontWeight: 700,
              color: '#2D5016',
              mb: 2,
              fontSize: { xs: '1.1rem', sm: '1.25rem' },
            }}
          >
            📊 Your Impact
          </Typography>

          <Divider sx={{ mb: 2 }} />

          {/* Stats Grid */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <StatRow
              icon={<Recycling sx={{ fontSize: 20, color: '#2D5016' }} />}
              label="Total Scans"
              value={userInfo?.total_scans || 0}
            />
            <Divider />
            <StatRow
              icon={<Star sx={{ fontSize: 20, color: '#FFD700' }} />}
              label="Lifetime Points"
              value={userInfo?.lifetime_points?.toLocaleString() || 0}
            />
            <Divider />
            <StatRow
              icon={<EmojiEvents sx={{ fontSize: 20, color: '#F4A460' }} />}
              label="Current Points"
              value={userInfo?.total_points?.toLocaleString() || 0}
            />
            <Divider />
            <StatRow
              icon={<LocalFireDepartment sx={{ fontSize: 20, color: '#FF4500' }} />}
              label="Current Streak"
              value={`${userInfo?.current_streak_days || 0} days`}
            />
            <Divider />
            <StatRow
              icon={<TrendingUp sx={{ fontSize: 20, color: '#2D5016' }} />}
              label="User Level"
              value={getLevelInfo(userInfo?.lifetime_points).level}
            />
          </Box>
        </Card>

        {/* Edit Profile Dialog */}
        <Dialog
          open={editDialogOpen}
          onClose={handleCloseEditDialog}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#2D5016' }}>
              Edit Profile
            </Typography>
            <IconButton onClick={handleCloseEditDialog} size="small">
              <Close />
            </IconButton>
          </DialogTitle>

          <DialogContent>
            {/* Profile Picture Section */}
            <Box sx={{ textAlign: 'center', mb: 3 }}>
              <Typography variant="body2" sx={{ color: '#666', mb: 2 }}>
                Profile Picture
              </Typography>

              <Box sx={{ position: 'relative', display: 'inline-block' }}>
                <Avatar
                  src={imagePreview}
                  sx={{
                    width: 120,
                    height: 120,
                    bgcolor: '#2D5016',
                    fontSize: '3rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: '3px solid #2D5016',
                  }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {editUsername?.[0]?.toUpperCase() || 'U'}
                </Avatar>

                <IconButton
                  onClick={() => fileInputRef.current?.click()}
                  sx={{
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    bgcolor: '#2D5016',
                    color: 'white',
                    '&:hover': {
                      bgcolor: '#3D6B1F',
                    },
                  }}
                  size="small"
                >
                  <PhotoCamera />
                </IconButton>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png"
                  style={{ display: 'none' }}
                  onChange={handleImageSelect}
                />
              </Box>

              <Typography variant="caption" sx={{ display: 'block', color: '#999', mt: 1 }}>
                Click to upload new picture (JPG, PNG - max 5MB)
              </Typography>
            </Box>

            {/* Username Field */}
            <TextField
              label="Username"
              fullWidth
              value={editUsername}
              onChange={(e) => setEditUsername(e.target.value)}
              sx={{ mb: 2 }}
              helperText="Choose a unique username"
            />

            {/* Email (Read-only) */}
            <TextField
              label="Email"
              fullWidth
              value={userInfo?.email || ''}
              disabled
              helperText="Email cannot be changed"
            />
          </DialogContent>

          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button
              onClick={handleCloseEditDialog}
              sx={{
                color: '#666',
                textTransform: 'none',
                fontWeight: 600,
              }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleSaveProfile}
              disabled={saving || !editUsername.trim()}
              sx={{
                bgcolor: '#2D5016',
                textTransform: 'none',
                fontWeight: 600,
                '&:hover': {
                  bgcolor: '#3D6B1F',
                },
              }}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Box>
  );
}

// Stat Row Component
function StatRow({ icon, label, value }) {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {icon}
        <Typography variant="body1" sx={{ color: '#666', fontWeight: 500 }}>
          {label}
        </Typography>
      </Box>
      <Typography
        variant="h6"
        sx={{
          fontWeight: 700,
          color: '#2D5016',
          fontSize: { xs: '1rem', sm: '1.25rem' },
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}
