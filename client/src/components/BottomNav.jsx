import { useNavigate, useLocation } from 'react-router-dom';
import { BottomNavigation, BottomNavigationAction, Box } from '@mui/material';
import {
  Home,
  Map,
  EmojiEvents,
  Person,
  CameraAlt,
} from '@mui/icons-material';

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  // Determine active tab based on current route
  const getActiveTab = () => {
    const path = location.pathname;
    if (path === '/dashboard') return 0;
    if (path === '/map') return 1;
    if (path === '/scan') return 2;
    if (path === '/leaderboard') return 3;
    if (path === '/profile') return 4;
    return 0;
  };

  const handleNavigationChange = (event, newValue) => {
    const routes = ['/dashboard', '/map', '/scan', '/leaderboard', '/profile'];
    navigate(routes[newValue]);
  };

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.1)',
      }}
    >
      <BottomNavigation
        value={getActiveTab()}
        onChange={handleNavigationChange}
        showLabels
        sx={{
          height: { xs: 65, sm: 70 },
          background: '#fff',
          borderTop: '1px solid rgba(0, 0, 0, 0.08)',
          '& .MuiBottomNavigationAction-root': {
            minWidth: 'auto',
            padding: { xs: '6px 0', sm: '8px 12px' },
            color: '#888',
            transition: 'all 0.3s ease',
            '&.Mui-selected': {
              color: '#2D5016',
            },
          },
          '& .MuiBottomNavigationAction-label': {
            fontSize: { xs: '0.65rem', sm: '0.75rem' },
            fontWeight: 500,
            marginTop: '4px',
            '&.Mui-selected': {
              fontSize: { xs: '0.7rem', sm: '0.8rem' },
              fontWeight: 600,
            },
          },
        }}
      >
        {/* Home */}
        <BottomNavigationAction
          label="Home"
          icon={<Home sx={{ fontSize: { xs: 24, sm: 26 } }} />}
        />

        {/* Map */}
        <BottomNavigationAction
          label="Map"
          icon={<Map sx={{ fontSize: { xs: 24, sm: 26 } }} />}
        />

        {/* Scan - Center button with special styling */}
        <BottomNavigationAction
          label="Scan"
          icon={
            <Box
              sx={{
                width: { xs: 50, sm: 56 },
                height: { xs: 50, sm: 56 },
                borderRadius: '50%',
                background:
                  location.pathname === '/scan'
                    ? 'linear-gradient(135deg, #2D5016 0%, #3D6B1F 100%)'
                    : 'linear-gradient(135deg, #A8D5BA 0%, #8FBC8F 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(45, 80, 22, 0.25)',
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'scale(1.05)',
                  boxShadow: '0 6px 16px rgba(45, 80, 22, 0.35)',
                },
              }}
            >
              <CameraAlt
                sx={{
                  fontSize: { xs: 26, sm: 30 },
                  color: location.pathname === '/scan' ? '#fff' : '#2D5016',
                }}
              />
            </Box>
          }
          sx={{
            '& .MuiBottomNavigationAction-label': {
              color: location.pathname === '/scan' ? '#2D5016' : '#888',
              fontWeight: location.pathname === '/scan' ? 700 : 500,
            },
          }}
        />

        {/* Leaderboard */}
        <BottomNavigationAction
          label="Board"
          icon={<EmojiEvents sx={{ fontSize: { xs: 24, sm: 26 } }} />}
        />

        {/* Profile */}
        <BottomNavigationAction
          label="Profile"
          icon={<Person sx={{ fontSize: { xs: 24, sm: 26 } }} />}
        />
      </BottomNavigation>
    </Box>
  );
}
