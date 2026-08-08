import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  IconButton,
  Box,
  LinearProgress,
  Typography,
} from '@mui/material';
import { Close as CloseIcon, Image as ImageIcon, Clear as ClearIcon } from '@mui/icons-material';
import axios from 'axios';

const CreatePostDialog = ({ open, onClose, onSuccess }) => {
  const [content, setContent] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        alert('Image size must be less than 5MB');
        return;
      }

      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please select a valid image file');
        return;
      }

      setSelectedImage(file);
      setPreview(URL.createObjectURL(file));
    }
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    if (preview) {
      URL.revokeObjectURL(preview);
    }
    setPreview(null);
  };

  const handleSubmit = async () => {
    if (!content.trim()) {
      alert('Please write something to share');
      return;
    }

    if (content.length > 280) {
      alert('Post is too long (max 280 characters)');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Please log in to create a post');
        return;
      }

      const formData = new FormData();
      formData.append('content', content);
      if (selectedImage) {
        formData.append('image', selectedImage);
      }

      const response = await axios.post(
        'http://localhost:5000/api/community/posts',
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      if (response.data.success) {
        // Reset form
        setContent('');
        handleRemoveImage();

        // Notify parent
        onSuccess();
      }
    } catch (error) {
      console.error('Post creation error:', error);
      alert(error.response?.data?.message || 'Failed to create post');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setContent('');
      handleRemoveImage();
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
        },
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ fontWeight: 600, color: '#2D5016' }}>
            Create Post
          </Typography>
          <IconButton onClick={handleClose} disabled={loading}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        <TextField
          multiline
          rows={4}
          fullWidth
          placeholder="Share your eco journey... 🌱"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          sx={{
            mb: 2,
            '& .MuiOutlinedInput-root': {
              borderRadius: 2,
            },
          }}
          inputProps={{ maxLength: 280 }}
          disabled={loading}
        />

        <Typography
          variant="caption"
          sx={{
            display: 'block',
            textAlign: 'right',
            color: content.length > 250 ? '#d32f2f' : '#999',
            mb: 2,
          }}
        >
          {content.length}/280
        </Typography>

        {/* Image Preview */}
        {preview && (
          <Box
            sx={{
              position: 'relative',
              mb: 2,
              borderRadius: 2,
              overflow: 'hidden',
              bgcolor: '#f5f5f5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <img
              src={preview}
              alt="Preview"
              style={{
                width: '100%',
                maxHeight: 300,
                objectFit: 'contain',
                display: 'block',
              }}
            />
            <IconButton
              size="small"
              sx={{
                position: 'absolute',
                top: 8,
                right: 8,
                bgcolor: 'rgba(0,0,0,0.6)',
                color: 'white',
                '&:hover': { bgcolor: 'rgba(0,0,0,0.8)' },
              }}
              onClick={handleRemoveImage}
              disabled={loading}
            >
              <ClearIcon />
            </IconButton>
          </Box>
        )}

        {/* Image Upload Button */}
        <Box>
          <input
            accept="image/*"
            style={{ display: 'none' }}
            id="post-image-upload"
            type="file"
            onChange={handleImageSelect}
            disabled={loading}
          />
          <label htmlFor="post-image-upload">
            <Button
              component="span"
              variant="outlined"
              startIcon={<ImageIcon />}
              sx={{
                color: '#2D5016',
                borderColor: '#2D5016',
                '&:hover': { borderColor: '#1f3810', bgcolor: 'rgba(45, 80, 22, 0.05)' },
              }}
              disabled={loading}
            >
              {selectedImage ? 'Change Image' : 'Add Image (Optional)'}
            </Button>
          </label>
        </Box>

        {loading && <LinearProgress sx={{ mt: 2 }} />}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!content.trim() || loading}
          sx={{
            bgcolor: '#2D5016',
            '&:hover': { bgcolor: '#1f3810' },
          }}
        >
          {loading ? 'Posting...' : 'Post'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CreatePostDialog;
