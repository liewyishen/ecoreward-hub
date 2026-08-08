import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  Avatar,
  Chip,
  CircularProgress,
  Alert,
} from '@mui/material';
import { EmojiEvents, TrendingUp } from '@mui/icons-material';
import axios from 'axios';

// Medal colors and emojis
const MEDALS = { 1: '🥇', 2: '🥈', 3: '🥉' };
const MEDAL_COLORS = {
  1: '#FFD700', // Gold
  2: '#C0C0C0', // Silver
  3: '#CD7F32', // Bronze
};

// PodiumCard Component (Top 3 users)
const PodiumCard = ({ user, rank, height }) => {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        animation: 'fadeInUp 0.6s ease-out',
        animationDelay: `${rank * 0.1}s`,
        animationFillMode: 'both',
        '@keyframes fadeInUp': {
          from: {
            opacity: 0,
            transform: 'translateY(20px)',
          },
          to: {
            opacity: 1,
            transform: 'translateY(0)',
          },
        },
      }}
    >
      {/* Medal Icon */}
      <Typography variant="h2" sx={{ mb: 1, fontSize: { xs: '2.5rem', sm: '3rem' } }}>
        {MEDALS[rank]}
      </Typography>

      {/* User Card */}
      <Card
        elevation={0}
        sx={{
          width: { xs: 90, sm: 110 },
          height: height,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: `linear-gradient(135deg, ${MEDAL_COLORS[rank]}30 0%, ${MEDAL_COLORS[rank]}50 100%)`,
          border: `3px solid ${MEDAL_COLORS[rank]}`,
          borderRadius: 3,
          position: 'relative',
          overflow: 'visible',
          transition: 'all 0.3s ease',
          '&:hover': {
            transform: 'translateY(-8px)',
            boxShadow: `0 12px 24px ${MEDAL_COLORS[rank]}40`,
          },
        }}
      >
        <Avatar
          src={
            user.profile_picture
              ? user.profile_picture.startsWith('data:')
                ? user.profile_picture
                : `http://localhost:5000${user.profile_picture}`
              : null
          }
          sx={{
            width: { xs: 50, sm: 60 },
            height: { xs: 50, sm: 60 },
            mb: 1,
            border: `3px solid ${MEDAL_COLORS[rank]}`,
            fontSize: { xs: '1.2rem', sm: '1.5rem' },
          }}
        >
          {user.username[0].toUpperCase()}
        </Avatar>

        <Typography
          variant="caption"
          sx={{
            fontWeight: 600,
            textAlign: 'center',
            px: 1,
            fontSize: { xs: '0.7rem', sm: '0.75rem' },
            color: '#2D5016',
          }}
        >
          {user.username}
        </Typography>

        <Chip
          label={user.total_points}
          size="small"
          sx={{
            mt: 1,
            bgcolor: MEDAL_COLORS[rank],
            color: 'white',
            fontWeight: 700,
            fontSize: { xs: '0.7rem', sm: '0.75rem' },
            height: { xs: 22, sm: 24 },
          }}
        />
      </Card>
    </Box>
  );
};

// Podium Component (Top 3)
const Podium = ({ topThree }) => {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-end',
        gap: { xs: 1.5, sm: 2 },
        mb: 4,
        px: 2,
      }}
    >
      {/* 2nd Place */}
      {topThree[1] && <PodiumCard user={topThree[1]} rank={2} height={{ xs: 130, sm: 150 }} />}

      {/* 1st Place (tallest) */}
      {topThree[0] && <PodiumCard user={topThree[0]} rank={1} height={{ xs: 160, sm: 190 }} />}

      {/* 3rd Place */}
      {topThree[2] && <PodiumCard user={topThree[2]} rank={3} height={{ xs: 110, sm: 130 }} />}
    </Box>
  );
};

// RankCard Component (4-10+ users)
const RankCard = ({ user, rank, isCurrentUser }) => {
  return (
    <Card
      elevation={0}
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        p: { xs: 1.5, sm: 2 },
        mb: 1.5,
        background: isCurrentUser
          ? 'linear-gradient(90deg, rgba(168, 213, 186, 0.3) 0%, rgba(168, 213, 186, 0.5) 100%)'
          : 'rgba(255, 255, 255, 0.85)',
        backdropFilter: 'blur(10px)',
        border: isCurrentUser ? '2px solid #2D5016' : '1px solid rgba(45, 80, 22, 0.2)',
        borderRadius: 2,
        transition: 'all 0.3s ease',
        '&:hover': {
          transform: 'translateX(4px)',
          boxShadow: '0 4px 16px rgba(45, 80, 22, 0.2)',
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.5, sm: 2 } }}>
        {/* Rank Number */}
        <Typography
          variant="h6"
          sx={{
            fontWeight: 700,
            color: '#2D5016',
            minWidth: { xs: 35, sm: 40 },
            fontSize: { xs: '1rem', sm: '1.25rem' },
          }}
        >
          #{rank}
        </Typography>

        {/* Avatar */}
        <Avatar
          src={
            user.profile_picture
              ? user.profile_picture.startsWith('data:')
                ? user.profile_picture
                : `http://localhost:5000${user.profile_picture}`
              : null
          }
          sx={{ width: { xs: 36, sm: 40 }, height: { xs: 36, sm: 40 } }}
        >
          {user.username[0].toUpperCase()}
        </Avatar>

        {/* Username */}
        <Box>
          <Typography variant="body1" sx={{ fontWeight: 500, fontSize: { xs: '0.9rem', sm: '1rem' } }}>
            {user.username}
            {isCurrentUser && (
              <Chip
                label="YOU"
                size="small"
                sx={{
                  ml: 1,
                  bgcolor: '#2D5016',
                  color: 'white',
                  height: 20,
                  fontSize: '0.65rem',
                  fontWeight: 700,
                }}
              />
            )}
          </Typography>
        </Box>
      </Box>

      {/* Points */}
      <Chip
        label={`${user.total_points} pts`}
        sx={{
          bgcolor: '#F4A460',
          color: 'white',
          fontWeight: 600,
          fontSize: { xs: '0.75rem', sm: '0.85rem' },
        }}
      />
    </Card>
  );
};

// Main Leaderboard Component
export default function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [isInTop, setIsInTop] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('token');
      if (!token) {
        setError('Please log in to view the leaderboard');
        setLoading(false);
        return;
      }

      const response = await axios.get('http://localhost:5000/api/leaderboard', {
        headers: { Authorization: `Bearer ${token}` },
        params: { limit: 10 },
      });

      if (response.data.success) {
        setLeaderboard(response.data.data.topUsers);
        setCurrentUser(response.data.data.currentUser);
        setIsInTop(response.data.data.isInTopList);
        console.log(`✅ Loaded leaderboard with ${response.data.data.topUsers.length} users`);
      }
    } catch (err) {
      console.error('❌ Failed to fetch leaderboard:', err);
      setError('Failed to load leaderboard. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #F5F5F5 0%, #E8F5E9 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
        }}
      >
        <CircularProgress sx={{ color: '#2D5016' }} size={50} />
        <Typography variant="body1" sx={{ color: '#666' }}>
          Loading leaderboard...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #F5F5F5 0%, #E8F5E9 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 3,
        }}
      >
        <Alert severity="error" sx={{ maxWidth: 500 }}>
          {error}
        </Alert>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #F5F5F5 0%, #E8F5E9 100%)',
        pb: { xs: 2, sm: 3 },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          textAlign: 'center',
          pt: { xs: 3, sm: 4 },
          pb: { xs: 2, sm: 3 },
          background: 'rgba(45, 80, 22, 0.05)',
          borderBottom: '2px solid rgba(45, 80, 22, 0.1)',
        }}
      >
        <EmojiEvents sx={{ fontSize: { xs: 42, sm: 52 }, color: '#FFD700', mb: 1 }} />
        <Typography
          variant="h4"
          sx={{
            fontWeight: 700,
            color: '#2D5016',
            fontSize: { xs: '1.5rem', sm: '2rem' },
          }}
        >
          Leaderboard
        </Typography>
        <Typography variant="body2" sx={{ color: '#666', mt: 0.5 }}>
          Top eco-warriors making a difference
        </Typography>
      </Box>

      <Box sx={{ maxWidth: 800, margin: '0 auto', px: { xs: 2, sm: 3 } }}>
        {/* Podium for Top 3 */}
        {leaderboard.length >= 3 && (
          <Box sx={{ mt: 4 }}>
            <Podium topThree={leaderboard.slice(0, 3)} />
          </Box>
        )}

        {/* Rest of Top 10 (4-10) */}
        {leaderboard.length > 3 && (
          <Box sx={{ mt: 4 }}>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 600,
                color: '#2D5016',
                mb: 2,
                fontSize: { xs: '1rem', sm: '1.25rem' },
              }}
            >
              Top Recyclers
            </Typography>
            {leaderboard.slice(3).map((user) => (
              <RankCard
                key={user.user_id}
                user={user}
                rank={Number(user.user_rank)}
                isCurrentUser={currentUser && user.user_id === currentUser.user_id}
              />
            ))}
          </Box>
        )}

        {/* Current User Card (if not in top 10) */}
        {!isInTop && currentUser && (
          <Card
            elevation={0}
            sx={{
              mt: 4,
              p: { xs: 2, sm: 3 },
              background: 'linear-gradient(135deg, #2D5016 0%, #1f3810 100%)',
              color: 'white',
              borderRadius: 3,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <TrendingUp sx={{ fontSize: 24 }} />
              <Typography variant="h6" sx={{ fontWeight: 600, fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                Your Ranking
              </Typography>
            </Box>

            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 2,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography variant="h3" sx={{ fontWeight: 700, fontSize: { xs: '2rem', sm: '2.5rem' } }}>
                  #{Number(currentUser.user_rank)}
                </Typography>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 600, fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                    {currentUser.username}
                  </Typography>
                  <Typography variant="caption" sx={{ opacity: 0.9 }}>
                    Keep recycling to climb! 💪
                  </Typography>
                </Box>
              </Box>
              <Chip
                label={`${currentUser.total_points} pts`}
                sx={{
                  bgcolor: '#F4A460',
                  color: 'white',
                  fontWeight: 700,
                  fontSize: { xs: '0.9rem', sm: '1rem' },
                  height: { xs: 32, sm: 36 },
                  px: 1,
                }}
              />
            </Box>
          </Card>
        )}

        {/* No Users Message */}
        {leaderboard.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <EmojiEvents sx={{ fontSize: 80, color: '#ccc', mb: 2 }} />
            <Typography variant="h6" sx={{ color: '#2D5016', mb: 1 }}>
              No Rankings Yet
            </Typography>
            <Typography variant="body2" sx={{ color: '#666' }}>
              Start recycling to appear on the leaderboard!
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}
