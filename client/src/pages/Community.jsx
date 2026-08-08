import { useState, useEffect } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  Snackbar,
  Alert,
  CircularProgress,
  Button,
  IconButton,
} from '@mui/material';
import { Add as AddIcon, People as PeopleIcon } from '@mui/icons-material';
import axios from 'axios';
import PostCard from '../components/PostCard';
import CreatePostDialog from '../components/CreatePostDialog';

const Community = () => {
  const [posts, setPosts] = useState([]);
  const [userPoints, setUserPoints] = useState(0);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  useEffect(() => {
    fetchPosts();
    fetchUserPoints();
  }, []);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const response = await axios.get('http://localhost:5000/api/community/posts');
      if (response.data.success) {
        setPosts(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch posts:', error);
      setSnackbar({
        open: true,
        message: 'Failed to load posts',
        severity: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchUserPoints = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await axios.get('http://localhost:5000/api/user/stats', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data.success) {
        setUserPoints(response.data.data.total_points);
      }
    } catch (error) {
      console.error('Failed to fetch user points:', error);
    }
  };

  const handlePostCreated = () => {
    setCreateDialogOpen(false);
    setSnackbar({
      open: true,
      message: 'Post shared! 🌱',
      severity: 'success',
    });
    fetchPosts(); // Refresh feed
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #F5F5F5 0%, #E8F5E9 100%)',
        pb: 10,
      }}
    >
      {/* App Bar - Modern Design */}
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          background: 'linear-gradient(135deg, #2D5016 0%, #3D6B1F 100%)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <Toolbar sx={{ justifyContent: 'space-between', py: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <PeopleIcon sx={{ fontSize: 24 }} />
            </Box>
            <Typography
              variant="h5"
              sx={{
                fontWeight: 700,
                fontSize: { xs: '1.3rem', sm: '1.5rem' },
                letterSpacing: '-0.5px',
                background: 'linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.8) 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Community
            </Typography>
          </Box>
          <IconButton
            onClick={() => setCreateDialogOpen(true)}
            sx={{
              bgcolor: 'rgba(255, 255, 255, 0.2)',
              color: 'white',
              '&:hover': {
                bgcolor: 'rgba(255, 255, 255, 0.3)',
                transform: 'scale(1.05)',
              },
              transition: 'all 0.2s ease',
            }}
          >
            <AddIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* Feed Container */}
      <Box
        sx={{
          maxWidth: 600,
          margin: '0 auto',
          px: { xs: 2, sm: 3 },
          pt: 3,
        }}
      >
        {loading ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              py: 8,
            }}
          >
            <CircularProgress sx={{ color: '#2D5016', mb: 2 }} size={50} />
            <Typography variant="body1" sx={{ color: '#666' }}>
              Loading community posts...
            </Typography>
          </Box>
        ) : posts.length === 0 ? (
          <EmptyState onCreateClick={() => setCreateDialogOpen(true)} />
        ) : (
          posts.map((post) => (
            <PostCard key={post.post_id} post={post} onUpdate={fetchPosts} />
          ))
        )}
      </Box>

      {/* Create Post Dialog */}
      <CreatePostDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onSuccess={handlePostCreated}
      />

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

const EmptyState = ({ onCreateClick }) => (
  <Box
    sx={{
      textAlign: 'center',
      py: 8,
      px: 3,
    }}
  >
    <Typography variant="h1" sx={{ fontSize: 80, mb: 2 }}>
      🌱
    </Typography>
    <Typography variant="h5" sx={{ fontWeight: 600, color: '#2D5016', mb: 1 }}>
      No posts yet
    </Typography>
    <Typography variant="body1" sx={{ color: '#666', mb: 3 }}>
      Be the first to inspire the community!
    </Typography>
    <Button
      variant="contained"
      startIcon={<AddIcon />}
      onClick={onCreateClick}
      sx={{
        bgcolor: '#2D5016',
        '&:hover': { bgcolor: '#1f3810' },
        borderRadius: 3,
        px: 4,
        py: 1.5,
      }}
    >
      Share Your Eco Journey
    </Button>
  </Box>
);

export default Community;
