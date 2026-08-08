import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  Button,
  Grid,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Alert,
  Divider,
  CircularProgress,
  IconButton,
} from '@mui/material';
import {
  CardGiftcard,
  LocalOffer,
  ContentCopy,
  CheckCircle,
} from '@mui/icons-material';
import axios from 'axios';
import ConfettiExplosion from 'react-confetti-explosion';
import { useNavigate } from 'react-router-dom';

// Reward type icons and colors
const getRewardStyle = (type) => {
  const styles = {
    tng_cashback: { icon: '💰', color: '#2196F3', label: 'TnG Reload' },
    voucher: { icon: '🎫', color: '#9C27B0', label: 'Voucher' },
    discount: { icon: '🏷️', color: '#FF9800', label: 'Discount' },
    physical_gift: { icon: '🎁', color: '#4CAF50', label: 'Physical Gift' },
  };
  return styles[type] || { icon: '🎁', color: '#757575', label: 'Reward' };
};

// RewardCard Component
const RewardCard = ({ reward, userPoints, onRedeem }) => {
  const canAfford = userPoints >= reward.points_cost;
  const isOutOfStock = reward.stock_quantity === 0;
  const isLimitedStock = reward.stock_quantity > 0 && reward.stock_quantity < 20;
  const style = getRewardStyle(reward.reward_type);

  return (
    <Card
      elevation={0}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        opacity: canAfford && !isOutOfStock ? 1 : 0.6,
        border: canAfford ? '2px solid #A8D5BA' : '1px solid rgba(45, 80, 22, 0.2)',
        borderRadius: 3,
        transition: 'all 0.3s ease',
        backdropFilter: 'blur(10px)',
        background: 'rgba(255, 255, 255, 0.9)',
        '&:hover': canAfford && !isOutOfStock
          ? {
              transform: 'translateY(-4px)',
              boxShadow: '0 8px 24px rgba(45, 80, 22, 0.15)',
            }
          : {},
      }}
    >
      {/* Reward Icon/Image */}
      <Box
        sx={{
          p: 3,
          background: `linear-gradient(135deg, ${style.color}20 0%, ${style.color}40 100%)`,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: 120,
        }}
      >
        <Typography variant="h1" sx={{ fontSize: '4rem' }}>
          {style.icon}
        </Typography>
      </Box>

      {/* Reward Details */}
      <Box sx={{ p: 2, flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Type Badge */}
        <Chip
          label={style.label}
          size="small"
          sx={{
            bgcolor: style.color,
            color: 'white',
            fontWeight: 600,
            fontSize: '0.65rem',
            height: 20,
            mb: 1,
            alignSelf: 'flex-start',
          }}
        />

        {/* Reward Name */}
        <Typography
          variant="h6"
          sx={{
            fontWeight: 600,
            mb: 0.5,
            color: '#2D5016',
            fontSize: { xs: '0.95rem', sm: '1.1rem' },
          }}
        >
          {reward.reward_name}
        </Typography>

        {/* Description */}
        <Typography
          variant="caption"
          sx={{
            color: '#666',
            display: 'block',
            mb: 2,
            flexGrow: 1,
            fontSize: '0.75rem',
          }}
        >
          {reward.description}
        </Typography>

        {/* Points Cost */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Chip
            label={`${reward.points_cost} pts`}
            sx={{
              bgcolor: '#F4A460',
              color: 'white',
              fontWeight: 700,
              fontSize: { xs: '0.75rem', sm: '0.85rem' },
            }}
          />

          {isLimitedStock && (
            <Chip
              label={`${reward.stock_quantity} left`}
              size="small"
              sx={{
                bgcolor: '#FF9800',
                color: 'white',
                fontSize: '0.65rem',
                height: 22,
              }}
            />
          )}

          {isOutOfStock && (
            <Chip
              label="Out of Stock"
              size="small"
              color="error"
              sx={{ fontSize: '0.65rem', height: 22 }}
            />
          )}
        </Box>

        {/* Redeem Button */}
        <Button
          fullWidth
          variant={canAfford ? 'contained' : 'outlined'}
          disabled={!canAfford || isOutOfStock}
          onClick={onRedeem}
          startIcon={<CardGiftcard />}
          sx={{
            bgcolor: canAfford ? '#2D5016' : 'transparent',
            color: canAfford ? 'white' : '#666',
            borderColor: '#2D5016',
            fontWeight: 600,
            textTransform: 'none',
            '&:hover': {
              bgcolor: canAfford ? '#1f3810' : 'transparent',
            },
            '&:disabled': {
              bgcolor: '#e0e0e0',
              color: '#999',
            },
          }}
        >
          {!canAfford ? 'Need More Points' : isOutOfStock ? 'Out of Stock' : 'Redeem'}
        </Button>
      </Box>
    </Card>
  );
};

// ConfirmDialog Component
const ConfirmDialog = ({ open, reward, userPoints, onClose, onConfirm }) => {
  if (!reward) return null;

  const style = getRewardStyle(reward.reward_type);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ textAlign: 'center', pt: 3 }}>
        <Typography variant="h2" sx={{ fontSize: '3rem', mb: 1 }}>
          {style.icon}
        </Typography>
        <Typography variant="h6" sx={{ fontWeight: 600, color: '#2D5016' }}>
          Confirm Redemption
        </Typography>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Redeem <strong>{reward.reward_name}</strong> for{' '}
            <strong style={{ color: '#F4A460' }}>{reward.points_cost} points</strong>?
          </Typography>

          <Divider sx={{ my: 2 }} />

          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              p: 2,
              bgcolor: '#F5F5F5',
              borderRadius: 2,
            }}
          >
            <Box>
              <Typography variant="caption" sx={{ color: '#666', display: 'block' }}>
                Current Balance
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#2D5016' }}>
                {userPoints} pts
              </Typography>
            </Box>
            <Typography variant="h6" sx={{ color: '#666' }}>
              →
            </Typography>
            <Box>
              <Typography variant="caption" sx={{ color: '#666', display: 'block' }}>
                New Balance
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#F4A460' }}>
                {userPoints - reward.points_cost} pts
              </Typography>
            </Box>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button onClick={onClose} sx={{ flex: 1, color: '#666' }}>
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          sx={{ flex: 1, bgcolor: '#2D5016', '&:hover': { bgcolor: '#1f3810' } }}
        >
          Confirm
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// SuccessDialog Component
const SuccessDialog = ({ open, voucherData, onClose }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(voucherData?.voucher_code || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!voucherData) return null;

  const isPending = voucherData.status === 'pending';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogContent sx={{ textAlign: 'center', py: 4, px: 3 }}>
        {/* Icon - Different for pending vs approved */}
        <Typography variant="h1" sx={{ fontSize: '4rem', mb: 2 }}>
          {isPending ? '⏳' : '🎉'}
        </Typography>

        <Typography
          variant="h5"
          sx={{ fontWeight: 700, mb: 1, color: isPending ? '#ff9800' : '#2D5016' }}
        >
          {isPending ? 'Redemption Submitted!' : 'Redemption Successful!'}
        </Typography>

        <Typography variant="body2" sx={{ color: '#666', mb: 3 }}>
          You've requested to redeem <strong>{voucherData.reward_name}</strong>
        </Typography>

        {isPending ? (
          /* Pending Approval Message */
          <>
            <Card
              sx={{
                p: 3,
                mb: 3,
                background: 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)',
                color: 'white',
              }}
            >
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                Awaiting Admin Approval
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                Your voucher code will be sent to your email once approved by an administrator.
              </Typography>
            </Card>

            <Alert severity="info" sx={{ mb: 3, textAlign: 'left' }}>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                What's next?
              </Typography>
              <Typography variant="caption" component="div" sx={{ mb: 0.5 }}>
                • Admin will review your redemption request
              </Typography>
              <Typography variant="caption" component="div" sx={{ mb: 0.5 }}>
                • You'll receive an email with your voucher code
              </Typography>
              <Typography variant="caption" component="div">
                • Points have been deducted and reserved for this redemption
              </Typography>
            </Alert>
          </>
        ) : (
          /* Approved - Show Voucher Code */
          <>
            <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
              Your Voucher Code:
            </Typography>
            <Card
              sx={{
                p: 3,
                mb: 3,
                background: 'linear-gradient(135deg, #F4A460 0%, #E59547 100%)',
                color: 'white',
                position: 'relative',
              }}
            >
              <Typography
                variant="h4"
                sx={{
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  letterSpacing: 2,
                  fontSize: { xs: '1.3rem', sm: '1.8rem' },
                }}
              >
                {voucherData.voucher_code}
              </Typography>
              <IconButton
                onClick={handleCopy}
                sx={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  color: 'white',
                }}
              >
                {copied ? <CheckCircle /> : <ContentCopy />}
              </IconButton>
            </Card>

            <Typography variant="caption" sx={{ color: '#666', display: 'block', mb: 2 }}>
              {copied ? '✓ Copied to clipboard!' : 'Screenshot or copy this code for later use'}
            </Typography>
          </>
        )}

        {/* New Balance */}
        <Box
          sx={{
            p: 2,
            bgcolor: '#E8F5E9',
            borderRadius: 2,
            border: '1px solid #A8D5BA',
          }}
        >
          <Typography variant="caption" sx={{ color: '#666', display: 'block' }}>
            New Points Balance
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 700, color: '#2D5016' }}>
            {voucherData.new_balance} pts
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button
          onClick={onClose}
          variant="contained"
          fullWidth
          sx={{ bgcolor: '#2D5016', '&:hover': { bgcolor: '#1f3810' } }}
        >
          Done
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// Main Rewards Component
export default function Rewards() {
  const navigate = useNavigate();
  const [rewards, setRewards] = useState([]);
  const [userPoints, setUserPoints] = useState(0);
  const [history, setHistory] = useState([]);
  const [selectedReward, setSelectedReward] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(false);
  const [successDialog, setSuccessDialog] = useState(false);
  const [voucherData, setVoucherData] = useState(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState(false);

  useEffect(() => {
    fetchRewards();
    fetchUserPoints();
    fetchHistory();
  }, []);

  const fetchRewards = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/rewards');
      if (response.data.success) {
        setRewards(response.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch rewards:', err);
      setError('Failed to load rewards');
    }
  };

  const fetchUserPoints = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:5000/api/user/stats', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data.success) {
        setUserPoints(response.data.data.total_points);
      }
    } catch (err) {
      console.error('Failed to fetch points:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:5000/api/rewards/history', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data.success) {
        setHistory(response.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch history:', err);
    }
  };

  const handleRedeem = async () => {
    setRedeeming(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        'http://localhost:5000/api/rewards/redeem',
        { reward_id: selectedReward.reward_id },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        setVoucherData(response.data.data);
        setUserPoints(response.data.data.new_balance);
        setShowConfetti(true);
        setConfirmDialog(false);
        setSuccessDialog(true);
        fetchHistory();
        fetchRewards(); // Refresh rewards to update stock
        console.log('✅ Redemption successful');
      }
    } catch (err) {
      console.error('❌ Redemption failed:', err);
      setError(err.response?.data?.message || 'Redemption failed. Please try again.');
      setConfirmDialog(false);
    } finally {
      setRedeeming(false);
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
        <CircularProgress sx={{ color: '#2D5016' }} />
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
      {/* Header with Balance */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, #2D5016 0%, #1f3810 100%)',
          color: 'white',
          p: { xs: 3, sm: 4 },
          textAlign: 'center',
        }}
      >
        <CardGiftcard sx={{ fontSize: 48, mb: 1 }} />
        <Typography
          variant="h5"
          sx={{ fontWeight: 700, mb: 2, fontSize: { xs: '1.3rem', sm: '1.5rem' } }}
        >
          Rewards Shop
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1 }}>
          <Typography variant="h3" sx={{ fontWeight: 700, fontSize: { xs: '2rem', sm: '2.5rem' } }}>
            {userPoints}
          </Typography>
          <Box sx={{ textAlign: 'left' }}>
            <Typography variant="body1" sx={{ fontSize: { xs: '0.9rem', sm: '1rem' } }}>
              points
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.8 }}>
              available
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Main Content */}
      <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 1400, mx: 'auto' }}>
        {/* Available Rewards */}
        <Typography
          variant="h6"
          sx={{
            mb: 2,
            fontWeight: 700,
            color: '#2D5016',
            fontSize: { xs: '1.1rem', sm: '1.25rem' },
          }}
        >
          Available Rewards
        </Typography>

        <Grid
          container
          spacing={{ xs: 2, sm: 2.5, md: 3 }}
          sx={{
            justifyContent: 'center',
          }}
        >
          {rewards.map((reward) => (
            <Grid
              item
              xs={6}
              sm={4}
              md={3}
              key={reward.reward_id}
            >
              <RewardCard
                reward={reward}
                userPoints={userPoints}
                onRedeem={() => {
                  setSelectedReward(reward);
                  setConfirmDialog(true);
                }}
              />
            </Grid>
          ))}
        </Grid>

        {rewards.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <CardGiftcard sx={{ fontSize: 80, color: '#ccc', mb: 2 }} />
            <Typography variant="h6" sx={{ color: '#666' }}>
              No rewards available at the moment
            </Typography>
          </Box>
        )}

        {/* Redemption History */}
        {history.length > 0 && (
          <>
            <Divider sx={{ my: 4 }} />
            <Typography
              variant="h6"
              sx={{
                mb: 2,
                fontWeight: 700,
                color: '#2D5016',
                fontSize: { xs: '1.1rem', sm: '1.25rem' },
              }}
            >
              Recent Redemptions
            </Typography>
            {history.map((item) => (
              <Card
                key={item.redemption_id}
                elevation={0}
                sx={{
                  p: 2,
                  mb: 1.5,
                  background: 'rgba(255, 255, 255, 0.9)',
                  border: '1px solid rgba(45, 80, 22, 0.2)',
                  borderRadius: 2,
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 1,
                  }}
                >
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <Typography
                        variant="h6"
                        sx={{ fontSize: { xs: '1.2rem', sm: '1.5rem' } }}
                      >
                        {getRewardStyle(item.reward_type).icon}
                      </Typography>
                      <Typography
                        variant="body1"
                        sx={{ fontWeight: 600, fontSize: { xs: '0.9rem', sm: '1rem' } }}
                      >
                        {item.reward_name}
                      </Typography>
                    </Box>
                    {item.status === 'pending' ? (
                      <Chip
                        label="⏳ Awaiting Approval"
                        size="small"
                        sx={{
                          bgcolor: '#fff3e0',
                          color: '#f57c00',
                          fontWeight: 600,
                          fontSize: { xs: '0.7rem', sm: '0.75rem' },
                        }}
                      />
                    ) : item.status === 'completed' ? (
                      <Typography
                        variant="caption"
                        sx={{
                          color: '#666',
                          fontFamily: 'monospace',
                          fontSize: { xs: '0.7rem', sm: '0.75rem' },
                        }}
                      >
                        Code: {item.redemption_code}
                      </Typography>
                    ) : (
                      <Chip
                        label="❌ Cancelled"
                        size="small"
                        sx={{
                          bgcolor: '#ffebee',
                          color: '#c62828',
                          fontWeight: 600,
                          fontSize: { xs: '0.7rem', sm: '0.75rem' },
                        }}
                      />
                    )}
                  </Box>
                  <Chip
                    label={`-${item.points_spent} pts`}
                    size="small"
                    sx={{
                      bgcolor: '#ffebee',
                      color: '#c62828',
                      fontWeight: 600,
                      fontSize: { xs: '0.7rem', sm: '0.75rem' },
                    }}
                  />
                </Box>
              </Card>
            ))}
          </>
        )}
      </Box>

      {/* Dialogs */}
      <ConfirmDialog
        open={confirmDialog}
        reward={selectedReward}
        userPoints={userPoints}
        onClose={() => !redeeming && setConfirmDialog(false)}
        onConfirm={handleRedeem}
      />

      <SuccessDialog
        open={successDialog}
        voucherData={voucherData}
        onClose={() => {
          setSuccessDialog(false);
          setShowConfetti(false);
        }}
      />

      {/* Confetti Animation */}
      {showConfetti && (
        <Box sx={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
          <ConfettiExplosion
            duration={3000}
            particleCount={150}
            width={1600}
          />
        </Box>
      )}

      {/* Error Snackbar */}
      <Snackbar open={!!error} autoHideDuration={5000} onClose={() => setError('')}>
        <Alert severity="error" onClose={() => setError('')}>
          {error}
        </Alert>
      </Snackbar>
    </Box>
  );
}
