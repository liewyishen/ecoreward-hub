import { Navigate, Outlet, useSearchParams } from 'react-router-dom';
import { Box } from '@mui/material';
import BottomNav from './BottomNav';
import Chatbot from './Chatbot';

/**
 * ProtectedRoute component
 * Wraps protected pages with authentication check and bottom navigation
 * Also includes the AI Chatbot for logged-in users
 */
export default function ProtectedRoute() {
  const [searchParams] = useSearchParams();
  const token = localStorage.getItem('token');
  const tokenFromUrl = searchParams.get('token');

  // Allow access if token exists in localStorage OR URL (for OAuth callback)
  if (!token && !tokenFromUrl) {
    return <Navigate to="/login" replace />;
  }

  // Render child routes with bottom navigation and chatbot
  return (
    <Box sx={{ pb: { xs: 7, sm: 8 } }}>
      {/* pb (padding-bottom) creates space for fixed bottom nav */}
      <Outlet />
      <BottomNav />
      {/* AI Chatbot - available on all protected pages */}
      <Chatbot />
    </Box>
  );
}
