import { useState, useEffect } from 'react';
import { GoogleMap, useLoadScript, Marker, InfoWindow } from '@react-google-maps/api';
import {
  Box,
  Typography,
  CircularProgress,
  Chip,
  Button,
  Card,
  Divider,
  Alert,
} from '@mui/material';
import {
  Phone,
  Directions,
  Schedule,
  LocationOn,
  Recycling,
} from '@mui/icons-material';
import axios from 'axios';

// Map container styling
const mapContainerStyle = {
  width: '100%',
  height: '100%',
  borderRadius: '16px',
};

// Default center (TARUMT - Wangsa Maju)
const defaultCenter = {
  lat: 3.2167,
  lng: 101.7333,
};

// Map options
const mapOptions = {
  disableDefaultUI: false,
  zoomControl: true,
  mapTypeControl: false,
  scaleControl: true,
  streetViewControl: false,
  rotateControl: false,
  fullscreenControl: true,
  styles: [
    {
      featureType: 'poi',
      elementType: 'labels',
      stylers: [{ visibility: 'off' }],
    },
  ],
};

// Get icon/emoji for waste type
const getWasteTypeIcon = (type) => {
  const icons = {
    Plastic: '🥤',
    Metal: '🥫',
    Glass: '🍾',
    Paper: '📄',
    Organic: '🌿',
    'E-waste': '📱',
  };
  return icons[type] || '♻️';
};

export default function Map() {
  const [facilities, setFacilities] = useState([]);
  const [selectedFacility, setSelectedFacility] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mapRef, setMapRef] = useState(null);

  // Load Google Maps script
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  });

  // Fetch facilities on component mount
  useEffect(() => {
    fetchFacilities();
  }, []);

  const fetchFacilities = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await axios.get('http://localhost:5000/api/facilities/nearby', {
        params: {
          lat: defaultCenter.lat,
          lng: defaultCenter.lng,
          radius: 10000, // 10km radius
        },
      });

      if (response.data.success) {
        setFacilities(response.data.data);
        console.log(`✅ Loaded ${response.data.count} recycling facilities`);
      }
    } catch (err) {
      console.error('❌ Failed to fetch facilities:', err);
      setError('Failed to load recycling centers. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  // Handle map load
  const onMapLoad = (map) => {
    setMapRef(map);
  };

  // Recenter map to default location
  const handleRecenter = () => {
    if (mapRef) {
      mapRef.panTo(defaultCenter);
      mapRef.setZoom(13);
    }
  };

  // Open Google Maps directions
  const openDirections = (facility) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${facility.latitude},${facility.longitude}`;
    window.open(url, '_blank');
  };

  // Call facility
  const callFacility = (phoneNumber) => {
    window.open(`tel:${phoneNumber}`, '_self');
  };

  // Handle map loading error
  if (loadError) {
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
          <Typography variant="h6" gutterBottom>
            Failed to Load Map
          </Typography>
          <Typography variant="body2">
            There was an error loading Google Maps. Please check your internet connection or try
            again later.
          </Typography>
        </Alert>
      </Box>
    );
  }

  // Handle map loading
  if (!isLoaded) {
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
          Loading map...
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #F5F5F5 0%, #E8F5E9 100%)',
        padding: { xs: 2, sm: 3 },
        position: 'relative',
      }}
    >
      <Box sx={{ maxWidth: 1200, margin: '0 auto' }}>
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
          Recycling Centers Map
        </Typography>

        {/* Error Alert */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Map Container */}
        <Card
          elevation={0}
          sx={{
            height: { xs: '70vh', sm: '75vh' },
            borderRadius: 3,
            overflow: 'hidden',
            position: 'relative',
            backdropFilter: 'blur(20px) saturate(180%)',
            background: 'rgba(255, 255, 255, 0.75)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            boxShadow: '0 8px 32px 0 rgba(45, 80, 22, 0.15)',
          }}
        >
          {/* Loading Overlay */}
          {loading && (
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
                gap: 2,
              }}
            >
              <CircularProgress sx={{ color: '#2D5016' }} />
              <Typography variant="body2" sx={{ color: '#666' }}>
                Loading recycling centers...
              </Typography>
            </Box>
          )}

          {/* Google Map */}
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={defaultCenter}
            zoom={13}
            options={mapOptions}
            onLoad={onMapLoad}
          >
            {/* Facility Markers */}
            {facilities.map((facility) => (
              <Marker
                key={facility.facility_id}
                position={{
                  lat: facility.latitude,
                  lng: facility.longitude,
                }}
                onClick={() => setSelectedFacility(facility)}
                icon={{
                  path: window.google.maps.SymbolPath.CIRCLE,
                  scale: 12,
                  fillColor: '#2D5016',
                  fillOpacity: 1,
                  strokeColor: '#A8D5BA',
                  strokeWeight: 4,
                }}
                animation={window.google.maps.Animation.DROP}
              />
            ))}

            {/* Info Window */}
            {selectedFacility && (
              <InfoWindow
                position={{
                  lat: selectedFacility.latitude,
                  lng: selectedFacility.longitude,
                }}
                onCloseClick={() => setSelectedFacility(null)}
                options={{
                  pixelOffset: new window.google.maps.Size(0, -10),
                }}
              >
                <Box sx={{ maxWidth: 300, p: 1 }}>
                  {/* Facility Name */}
                  <Typography
                    variant="h6"
                    sx={{
                      fontWeight: 700,
                      color: '#2D5016',
                      mb: 1,
                      fontSize: '1rem',
                    }}
                  >
                    🌱 {selectedFacility.facility_name}
                  </Typography>

                  {/* Description */}
                  {selectedFacility.description && (
                    <Typography
                      variant="body2"
                      sx={{ color: '#666', mb: 1.5, fontSize: '0.85rem' }}
                    >
                      {selectedFacility.description}
                    </Typography>
                  )}

                  <Divider sx={{ my: 1 }} />

                  {/* Address */}
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
                    <LocationOn sx={{ fontSize: 18, color: '#2D5016', mt: 0.3 }} />
                    <Typography variant="body2" sx={{ fontSize: '0.85rem', color: '#555' }}>
                      {selectedFacility.address}
                    </Typography>
                  </Box>

                  {/* Contact Number */}
                  {selectedFacility.contact_number && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Phone sx={{ fontSize: 18, color: '#2D5016' }} />
                      <Typography variant="body2" sx={{ fontSize: '0.85rem', color: '#555' }}>
                        {selectedFacility.contact_number}
                      </Typography>
                    </Box>
                  )}

                  {/* Distance */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                    <Directions sx={{ fontSize: 18, color: '#2D5016' }} />
                    <Typography variant="body2" sx={{ fontSize: '0.85rem', color: '#555' }}>
                      {(selectedFacility.distance / 1000).toFixed(2)} km away
                    </Typography>
                  </Box>

                  {/* Accepted Waste Types */}
                  {selectedFacility.accepted_types &&
                    selectedFacility.accepted_types.length > 0 && (
                      <Box sx={{ mb: 1.5 }}>
                        <Typography
                          variant="caption"
                          sx={{
                            fontWeight: 600,
                            color: '#2D5016',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5,
                            mb: 0.5,
                          }}
                        >
                          <Recycling sx={{ fontSize: 16 }} />
                          Accepts:
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {selectedFacility.accepted_types.map((type) => (
                            <Chip
                              key={type}
                              label={`${getWasteTypeIcon(type)} ${type}`}
                              size="small"
                              sx={{
                                bgcolor: '#E8F5E9',
                                color: '#2D5016',
                                fontSize: '0.7rem',
                                height: 24,
                              }}
                            />
                          ))}
                        </Box>
                      </Box>
                    )}

                  {/* Action Buttons */}
                  <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<Directions sx={{ fontSize: 16 }} />}
                      onClick={() => openDirections(selectedFacility)}
                      sx={{
                        flex: 1,
                        bgcolor: '#2D5016',
                        color: '#fff',
                        fontSize: '0.75rem',
                        textTransform: 'none',
                        py: 0.75,
                        '&:hover': {
                          bgcolor: '#1f3810',
                        },
                      }}
                    >
                      Directions
                    </Button>

                    {selectedFacility.contact_number && (
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<Phone sx={{ fontSize: 16 }} />}
                        onClick={() => callFacility(selectedFacility.contact_number)}
                        sx={{
                          flex: 1,
                          borderColor: '#2D5016',
                          color: '#2D5016',
                          fontSize: '0.75rem',
                          textTransform: 'none',
                          py: 0.75,
                          '&:hover': {
                            borderColor: '#1f3810',
                            bgcolor: 'rgba(45, 80, 22, 0.05)',
                          },
                        }}
                      >
                        Call
                      </Button>
                    )}
                  </Box>
                </Box>
              </InfoWindow>
            )}
          </GoogleMap>

          {/* Recenter Button */}
          <Button
            variant="contained"
            onClick={handleRecenter}
            sx={{
              position: 'absolute',
              bottom: { xs: 80, sm: 16 },
              left: '50%',
              transform: 'translateX(-50%)',
              bgcolor: 'white',
              color: '#2D5016',
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
              textTransform: 'none',
              fontWeight: 600,
              '&:hover': {
                bgcolor: '#f5f5f5',
              },
            }}
          >
            🎯 Recenter
          </Button>

          {/* Facilities Count Badge */}
          {!loading && facilities.length > 0 && (
            <Chip
              label={`${facilities.length} Centers Found`}
              sx={{
                position: 'absolute',
                top: 16,
                left: 16,
                bgcolor: '#2D5016',
                color: '#fff',
                fontWeight: 600,
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
              }}
            />
          )}

          {/* No Facilities Message */}
          {!loading && facilities.length === 0 && (
            <Box
              sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                textAlign: 'center',
                bgcolor: 'white',
                p: 3,
                borderRadius: 2,
                boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
              }}
            >
              <Typography variant="h6" sx={{ color: '#2D5016', mb: 1 }}>
                No Recycling Centers Found
              </Typography>
              <Typography variant="body2" sx={{ color: '#666', mb: 2 }}>
                Try adjusting your search area or check back later.
              </Typography>
              <Button
                variant="contained"
                onClick={fetchFacilities}
                sx={{
                  bgcolor: '#2D5016',
                  '&:hover': { bgcolor: '#1f3810' },
                }}
              >
                Retry
              </Button>
            </Box>
          )}
        </Card>
      </Box>
    </Box>
  );
}
