import { useState, useRef, useEffect } from 'react';
import {
  Fab,
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  IconButton,
  Box,
  Typography,
  Paper,
  CircularProgress,
  Card,
  CardContent,
  Button,
  Chip,
  Divider,
} from '@mui/material';
import { Chat, Close, Send } from '@mui/icons-material';
import axios from 'axios';

/**
 * AI Chatbot Component with Gemini Function Calling
 *
 * Features:
 * - Natural language conversation
 * - Check user points balance
 * - Browse available rewards
 * - Check affordable rewards
 * - Process reward redemptions
 * - Answer recycling questions
 *
 * Uses Gemini AI with function calling to execute real actions
 */
const Chatbot = () => {
  // State management
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content:
        "Hi! 👋 I'm EcoBot, your recycling assistant. I can help you:\n\n• Check your points balance\n• Browse available rewards\n• Redeem rewards for you\n• Answer recycling questions\n\nHow can I help you today?",
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /**
   * Simple markdown to HTML converter
   * Handles: **bold**, *italic*, `code`, newlines
   */
  const markdownToHtml = (text) => {
    if (!text) return '';

    return text
      // Bold: **text** or __text__
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/__(.+?)__/g, '<strong>$1</strong>')
      // Italic: *text* or _text_ (but not if already part of **)
      .replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, '<em>$1</em>')
      .replace(/_([^_]+?)_/g, '<em>$1</em>')
      // Code: `text`
      .replace(/`(.+?)`/g, '<code style="background-color: #f0f0f0; padding: 2px 4px; border-radius: 3px; font-family: monospace;">$1</code>')
      // Line breaks
      .replace(/\n/g, '<br />');
  };

  /**
   * Send message to chatbot backend
   * Handles both regular conversation and function calling results
   */
  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        'http://localhost:5000/api/chatbot/message',
        {
          message: userMessage,
          history: messages, // Send conversation history for context
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      // Handle bot response (may include function results)
      const botResponse = response.data.data;
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: botResponse.message,
          functionResult: botResponse.functionResult, // Optional structured data
        },
      ]);
    } catch (error) {
      console.error('Chatbot error:', error);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again! 😅',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle Enter key press to send message
   */
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  /**
   * Render reward cards from function calling results
   * @param {Array} rewards - Array of reward objects
   * @param {Number} userPoints - Optional user points to show affordability
   */
  const renderRewardCards = (rewards, userPoints = null) => {
    if (!rewards || rewards.length === 0) return null;

    return (
      <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
        {rewards.map((reward) => {
          const canAfford = userPoints !== null && userPoints >= reward.points_cost;
          const pointsNeeded =
            userPoints !== null && userPoints < reward.points_cost
              ? reward.points_cost - userPoints
              : 0;

          return (
            <Card
              key={reward.reward_id}
              variant="outlined"
              sx={{
                bgcolor: canAfford ? '#e8f5e9' : '#f9f9f9',
                borderColor: canAfford ? '#4caf50' : '#2D5016',
                opacity: userPoints !== null && !canAfford ? 0.7 : 1,
                '&:hover': { bgcolor: canAfford ? '#d7f0d9' : '#f0f0f0' },
              }}
            >
              <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" fontWeight="bold">
                      {reward.reward_name}
                    </Typography>
                    {reward.description && (
                      <Typography variant="caption" color="text.secondary">
                        {reward.description}
                      </Typography>
                    )}
                    {userPoints !== null && !canAfford && pointsNeeded > 0 && (
                      <Typography
                        variant="caption"
                        sx={{ display: 'block', mt: 0.5, color: '#f57c00', fontWeight: 'bold' }}
                      >
                        🔒 Need {pointsNeeded} more points
                      </Typography>
                    )}
                    {canAfford && (
                      <Typography
                        variant="caption"
                        sx={{ display: 'block', mt: 0.5, color: '#4caf50', fontWeight: 'bold' }}
                      >
                        ✅ You can afford this!
                      </Typography>
                    )}
                  </Box>
                  <Chip
                    label={`${reward.points_cost} pts`}
                    size="small"
                    sx={{
                      bgcolor: canAfford ? '#4caf50' : '#2D5016',
                      color: 'white',
                      fontWeight: 'bold',
                    }}
                  />
                </Box>
              </CardContent>
            </Card>
          );
        })}
      </Box>
    );
  };

  /**
   * Render points balance display
   */
  const renderPointsDisplay = (data) => {
    if (!data || !data.current_points) return null;

    return (
      <Box
        sx={{
          mt: 1.5,
          p: 2,
          bgcolor: '#f0f7ed',
          borderRadius: 2,
          border: '1px solid #2D5016',
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Current Balance
          </Typography>
          <Typography variant="h6" sx={{ color: '#2D5016', fontWeight: 'bold' }}>
            {data.current_points} pts
          </Typography>
        </Box>
        {data.lifetime_points && (
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="caption" color="text.secondary">
              Lifetime Earnings
            </Typography>
            <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
              {data.lifetime_points} pts
            </Typography>
          </Box>
        )}
      </Box>
    );
  };

  /**
   * Render redemption confirmation request
   */
  const renderConfirmationRequest = (data) => {
    if (!data || !data.reward) return null;

    const canAfford = data.can_afford;

    return (
      <Box
        sx={{
          mt: 1.5,
          p: 2,
          bgcolor: canAfford ? '#fff8e1' : '#ffebee',
          borderRadius: 2,
          border: `1px solid ${canAfford ? '#ffc107' : '#f44336'}`,
        }}
      >
        <Typography variant="body2" fontWeight="bold" sx={{ mb: 1 }}>
          {canAfford ? '⚠️ Confirmation Required' : '❌ Cannot Afford'}
        </Typography>
        <Divider sx={{ my: 1 }} />
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="caption">Reward:</Typography>
            <Typography variant="caption" fontWeight="bold">
              {data.reward.reward_name}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="caption">Cost:</Typography>
            <Typography variant="caption" fontWeight="bold">
              {data.reward.points_cost} pts
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="caption">Your Balance:</Typography>
            <Typography
              variant="caption"
              fontWeight="bold"
              sx={{ color: canAfford ? '#2D5016' : '#f44336' }}
            >
              {data.user_points} pts
            </Typography>
          </Box>
          {!canAfford && (
            <Typography variant="caption" sx={{ mt: 1, color: '#f44336' }}>
              You need {data.reward.points_cost - data.user_points} more points
            </Typography>
          )}
        </Box>
      </Box>
    );
  };

  /**
   * Render redemption success result
   */
  const renderRedemptionResult = (data) => {
    if (!data) return null;

    // Show error if redemption failed
    if (!data.success) {
      return (
        <Box
          sx={{
            mt: 1.5,
            p: 2,
            bgcolor: '#ffebee',
            borderRadius: 2,
            border: '1px solid #f44336',
          }}
        >
          <Typography variant="body2" fontWeight="bold" sx={{ color: '#f44336' }}>
            ❌ Redemption Failed
          </Typography>
          <Typography variant="caption" sx={{ mt: 1, display: 'block' }}>
            {data.message}
          </Typography>
        </Box>
      );
    }

    return (
      <Box
        sx={{
          mt: 1.5,
          p: 2,
          bgcolor: '#e8f5e9',
          borderRadius: 2,
          border: '1px solid #4caf50',
        }}
      >
        <Typography variant="body2" fontWeight="bold" sx={{ mb: 1 }}>
          ✅ Redemption Successful!
        </Typography>
        <Divider sx={{ my: 1 }} />
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="caption">Reward:</Typography>
            <Typography variant="caption" fontWeight="bold">
              {data.reward_name}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="caption">Points Spent:</Typography>
            <Typography variant="caption" fontWeight="bold">
              {data.points_spent}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="caption">New Balance:</Typography>
            <Typography variant="caption" fontWeight="bold" sx={{ color: '#2D5016' }}>
              {data.new_balance} pts
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="caption">Code:</Typography>
            <Typography variant="caption" fontWeight="bold" sx={{ color: '#1976d2' }}>
              {data.redemption_code}
            </Typography>
          </Box>
          {data.status && (
            <Typography variant="caption" sx={{ mt: 1, color: '#f57c00', fontStyle: 'italic' }}>
              Status: {data.status}
            </Typography>
          )}
        </Box>
      </Box>
    );
  };

  return (
    <>
      {/* Floating Action Button - Fixed bottom-right corner */}
      <Fab
        color="primary"
        onClick={() => setOpen(true)}
        sx={{
          position: 'fixed',
          bottom: 80, // Above BottomNav
          right: 16,
          bgcolor: '#2D5016',
          '&:hover': { bgcolor: '#1f3810' },
          zIndex: 1000,
        }}
        aria-label="Open chatbot"
      >
        <Chat />
      </Fab>

      {/* Chat Dialog Window */}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        PaperProps={{
          sx: {
            position: 'fixed',
            bottom: { xs: 0, sm: 80 },
            right: { xs: 0, sm: 16 },
            m: 0,
            width: { xs: '100%', sm: 400 },
            height: { xs: '100vh', sm: 600 },
            maxWidth: '100%',
            maxHeight: { xs: '100vh', sm: '80vh' },
            borderRadius: { xs: 0, sm: 3 },
          },
        }}
        hideBackdrop
      >
        {/* Header */}
        <DialogTitle
          sx={{
            bgcolor: '#2D5016',
            color: 'white',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            py: 1.5,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h6" component="span">
              🤖 EcoBot
            </Typography>
            <Chip label="AI" size="small" sx={{ bgcolor: '#4caf50', color: 'white' }} />
          </Box>
          <IconButton onClick={() => setOpen(false)} sx={{ color: 'white' }}>
            <Close />
          </IconButton>
        </DialogTitle>

        {/* Messages Area */}
        <DialogContent
          sx={{
            p: 2,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            overflowY: 'auto',
            bgcolor: '#fafafa',
            flex: 1,
          }}
        >
          {messages.map((msg, idx) => (
            <Box
              key={idx}
              sx={{
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
              }}
            >
              <Paper
                elevation={1}
                sx={{
                  p: 1.5,
                  bgcolor: msg.role === 'user' ? '#2D5016' : 'white',
                  color: msg.role === 'user' ? 'white' : 'black',
                  borderRadius: 2,
                  borderBottomRightRadius: msg.role === 'user' ? 0 : 2,
                  borderBottomLeftRadius: msg.role === 'user' ? 2 : 0,
                }}
              >
                <Typography
                  variant="body2"
                  sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                  dangerouslySetInnerHTML={{ __html: markdownToHtml(msg.content) }}
                />

                {/* Render function results based on type */}
                {msg.functionResult && (
                  <>
                    {/* Points Display */}
                    {msg.functionResult.type === 'getUserPoints' &&
                      renderPointsDisplay(msg.functionResult.data)}

                    {/* Rewards List */}
                    {msg.functionResult.type === 'getAvailableRewards' &&
                      renderRewardCards(msg.functionResult.data.rewards)}

                    {/* Affordable Rewards */}
                    {msg.functionResult.type === 'getAffordableRewards' && (
                      <>
                        {renderPointsDisplay({
                          current_points: msg.functionResult.data.current_points,
                        })}
                        {/* Show affordable rewards if any, otherwise show all rewards with affordability info */}
                        {msg.functionResult.data.affordable_count > 0
                          ? renderRewardCards(
                              msg.functionResult.data.affordable_rewards,
                              msg.functionResult.data.current_points
                            )
                          : renderRewardCards(
                              msg.functionResult.data.all_rewards,
                              msg.functionResult.data.current_points
                            )}
                      </>
                    )}

                    {/* Redemption Confirmation Request */}
                    {msg.functionResult.type === 'confirmRedemption' &&
                      renderConfirmationRequest(msg.functionResult.data)}

                    {/* Redemption Result */}
                    {msg.functionResult.type === 'redeemReward' &&
                      renderRedemptionResult(msg.functionResult.data)}
                  </>
                )}
              </Paper>
            </Box>
          ))}

          {/* Typing Indicator */}
          {loading && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CircularProgress size={16} sx={{ color: '#2D5016' }} />
              <Typography variant="caption" color="text.secondary">
                EcoBot is thinking...
              </Typography>
            </Box>
          )}

          {/* Auto-scroll anchor */}
          <div ref={messagesEndRef} />
        </DialogContent>

        {/* Input Area */}
        <Box
          sx={{
            p: 2,
            bgcolor: 'white',
            borderTop: '1px solid #e0e0e0',
            display: 'flex',
            gap: 1,
          }}
        >
          <TextField
            fullWidth
            size="small"
            placeholder="Ask me anything..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={loading}
            multiline
            maxRows={3}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
              },
            }}
          />
          <IconButton
            color="primary"
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            sx={{
              bgcolor: '#2D5016',
              color: 'white',
              '&:hover': { bgcolor: '#1f3810' },
              '&.Mui-disabled': { bgcolor: '#ccc' },
            }}
          >
            <Send />
          </IconButton>
        </Box>
      </Dialog>
    </>
  );
};

export default Chatbot;
