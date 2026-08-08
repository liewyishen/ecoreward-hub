import { useState, useEffect } from 'react';
import {
  Card,
  CardHeader,
  CardContent,
  CardMedia,
  CardActions,
  Avatar,
  Typography,
  IconButton,
  Collapse,
  Box,
  TextField,
  Button,
  Divider,
  CircularProgress,
} from '@mui/material';
import {
  Favorite,
  FavoriteBorder,
  ChatBubbleOutline,
  Send as SendIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { formatDistanceToNow } from 'date-fns';

const PostCard = ({ post, onUpdate }) => {
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(post.likes_count);
  const [commentsExpanded, setCommentsExpanded] = useState(false);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [addingComment, setAddingComment] = useState(false);

  // Check if user has liked this post
  useEffect(() => {
    checkLikeStatus();
  }, []);

  const checkLikeStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await axios.get(
        `http://localhost:5000/api/community/posts/${post.post_id}/check-like`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        setLiked(response.data.liked);
      }
    } catch (error) {
      console.error('Check like status error:', error);
    }
  };

  const handleLike = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Please log in to like posts');
        return;
      }

      const response = await axios.post(
        `http://localhost:5000/api/community/posts/${post.post_id}/like`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        setLiked(response.data.action === 'liked');
        setLikesCount(response.data.likes_count);
      }
    } catch (error) {
      console.error('Like error:', error);
    }
  };

  const handleToggleComments = async () => {
    if (!commentsExpanded && comments.length === 0) {
      setLoadingComments(true);
      try {
        const response = await axios.get(
          `http://localhost:5000/api/community/posts/${post.post_id}/comments`
        );
        if (response.data.success) {
          setComments(response.data.data);
        }
      } catch (error) {
        console.error('Fetch comments error:', error);
      }
      setLoadingComments(false);
    }
    setCommentsExpanded(!commentsExpanded);
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Please log in to comment');
        return;
      }

      setAddingComment(true);

      await axios.post(
        `http://localhost:5000/api/community/posts/${post.post_id}/comments`,
        { text: newComment },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setNewComment('');

      // Refresh comments
      const response = await axios.get(
        `http://localhost:5000/api/community/posts/${post.post_id}/comments`
      );
      if (response.data.success) {
        setComments(response.data.data);
      }

      // Update parent to refresh comment count
      if (onUpdate) {
        onUpdate();
      }
    } catch (error) {
      console.error('Comment error:', error);
      alert(error.response?.data?.message || 'Failed to add comment');
    } finally {
      setAddingComment(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAddComment();
    }
  };

  return (
    <Card
      elevation={0}
      sx={{
        mb: 2,
        borderRadius: 3,
        background: 'rgba(255, 255, 255, 0.85)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(45, 80, 22, 0.1)',
      }}
    >
      {/* Header */}
      <CardHeader
        avatar={
          <Avatar
            src={
              post.profile_picture
                ? post.profile_picture.startsWith('data:')
                  ? post.profile_picture
                  : `http://localhost:5000${post.profile_picture}`
                : null
            }
            sx={{ bgcolor: '#2D5016' }}
          >
            {post.username[0].toUpperCase()}
          </Avatar>
        }
        title={
          <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#2D5016' }}>
            {post.username}
          </Typography>
        }
        subheader={
          <Typography variant="caption" sx={{ color: '#666' }}>
            {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
          </Typography>
        }
      />

      {/* Content */}
      <CardContent sx={{ pt: 0 }}>
        <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
          {post.content}
        </Typography>
      </CardContent>

      {/* Image (if exists) */}
      {post.image_url && (
        <Box
          sx={{
            bgcolor: '#f5f5f5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            maxHeight: 400,
            overflow: 'hidden',
          }}
        >
          <CardMedia
            component="img"
            image={`http://localhost:5000${post.image_url}`}
            alt="Post image"
            sx={{
              maxHeight: 400,
              objectFit: 'contain',
              width: '100%',
            }}
          />
        </Box>
      )}

      {/* Action Bar */}
      <CardActions sx={{ px: 2, py: 1.5, justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          {/* Like Button */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <IconButton onClick={handleLike} sx={{ color: liked ? '#F4A460' : '#666' }}>
              {liked ? <Favorite /> : <FavoriteBorder />}
            </IconButton>
            <Typography variant="body2" sx={{ color: '#666' }}>
              {likesCount}
            </Typography>
          </Box>

          {/* Comments Button */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <IconButton onClick={handleToggleComments} sx={{ color: '#666' }}>
              <ChatBubbleOutline />
            </IconButton>
            <Typography variant="body2" sx={{ color: '#666' }}>
              {post.comments_count} {post.comments_count === 1 ? 'comment' : 'comments'}
            </Typography>
          </Box>
        </Box>
      </CardActions>

      {/* Expandable Comments Section */}
      <Collapse in={commentsExpanded} timeout="auto" unmountOnExit>
        <Divider />
        <Box sx={{ p: 2 }}>
          {loadingComments ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <CircularProgress size={24} sx={{ color: '#2D5016' }} />
            </Box>
          ) : comments.length > 0 ? (
            <Box sx={{ mb: 2 }}>
              {comments.map((comment) => (
                <CommentItem key={comment.comment_id} comment={comment} />
              ))}
            </Box>
          ) : (
            <Typography
              variant="body2"
              sx={{ color: '#999', textAlign: 'center', py: 2 }}
            >
              No comments yet. Be the first!
            </Typography>
          )}

          {/* Add Comment Input */}
          <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
            <TextField
              size="small"
              fullWidth
              placeholder="Add a comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={addingComment}
              inputProps={{ maxLength: 500 }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 3,
                },
              }}
            />
            <IconButton
              onClick={handleAddComment}
              disabled={!newComment.trim() || addingComment}
              sx={{
                bgcolor: '#2D5016',
                color: 'white',
                '&:hover': { bgcolor: '#1f3810' },
                '&:disabled': { bgcolor: '#ccc' },
              }}
            >
              {addingComment ? (
                <CircularProgress size={20} sx={{ color: 'white' }} />
              ) : (
                <SendIcon />
              )}
            </IconButton>
          </Box>
        </Box>
      </Collapse>
    </Card>
  );
};

const CommentItem = ({ comment }) => (
  <Box sx={{ mb: 2, display: 'flex', gap: 1 }}>
    <Avatar
      src={
        comment.profile_picture
          ? comment.profile_picture.startsWith('data:')
            ? comment.profile_picture
            : `http://localhost:5000${comment.profile_picture}`
          : null
      }
      sx={{ width: 32, height: 32, bgcolor: '#2D5016' }}
    >
      {comment.username[0]}
    </Avatar>
    <Box sx={{ flex: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <Typography variant="body2" sx={{ fontWeight: 600, color: '#2D5016' }}>
          {comment.username}
        </Typography>
        <Typography variant="caption" sx={{ color: '#999' }}>
          · {formatDistanceToNow(new Date(comment.created_at))} ago
        </Typography>
      </Box>
      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
        {comment.comment_text}
      </Typography>
    </Box>
  </Box>
);

export default PostCard;
