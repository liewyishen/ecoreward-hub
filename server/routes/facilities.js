const express = require('express');
const router = express.Router();
const db = require('../config/db');

/**
 * GET /api/facilities/nearby
 * Get all verified recycling facilities within radius
 * Query params:
 *   - lat (default: 3.2167 - TARUMT latitude)
 *   - lng (default: 101.7333 - TARUMT longitude)
 *   - radius (default: 5000 meters = 5km)
 * Public route - no authentication required
 */
router.get('/nearby', async (req, res) => {
  try {
    const { lat = 3.2167, lng = 101.7333, radius = 5000 } = req.query;

    // Convert to numbers
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    const radiusMeters = parseFloat(radius);

    // Haversine formula to calculate distance in meters
    // Formula: distance = 6371 * acos(cos(lat1) * cos(lat2) * cos(lng2 - lng1) + sin(lat1) * sin(lat2))
    // Multiply by 1000 to convert km to meters
    const query = `
      SELECT
        facility_id,
        facility_name,
        description,
        address,
        latitude,
        longitude,
        accepted_types,
        opening_hours,
        contact_number,
        is_verified,
        (6371 * acos(
          cos(radians(?)) * cos(radians(latitude))
          * cos(radians(longitude) - radians(?))
          + sin(radians(?)) * sin(radians(latitude))
        )) * 1000 AS distance
      FROM recycling_facilities
      WHERE is_verified = TRUE
      HAVING distance < ?
      ORDER BY distance ASC
    `;

    const [facilities] = await db.execute(query, [
      latitude,
      longitude,
      latitude,
      radiusMeters
    ]);

    // Process facilities data
    const processedFacilities = facilities.map(facility => {
      // Convert accepted_types SET to array
      let acceptedTypesArray = [];
      if (facility.accepted_types) {
        acceptedTypesArray = facility.accepted_types.split(',').map(type => type.trim());
      }

      // Parse opening_hours if it's a JSON string
      let openingHours = facility.opening_hours;
      if (typeof openingHours === 'string') {
        try {
          openingHours = JSON.parse(openingHours);
        } catch (e) {
          openingHours = null;
        }
      }

      return {
        facility_id: facility.facility_id,
        facility_name: facility.facility_name,
        description: facility.description,
        address: facility.address,
        latitude: parseFloat(facility.latitude),
        longitude: parseFloat(facility.longitude),
        accepted_types: acceptedTypesArray,
        opening_hours: openingHours,
        contact_number: facility.contact_number,
        distance: parseFloat(facility.distance.toFixed(2)) // Distance in meters, rounded to 2 decimals
      };
    });

    return res.status(200).json({
      success: true,
      count: processedFacilities.length,
      data: processedFacilities
    });

  } catch (error) {
    console.error('Error fetching facilities:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch recycling facilities',
      error: process.env.NODE_ENV !== 'production' ? error.message : undefined
    });
  }
});

/**
 * GET /api/facilities/:id
 * Get single facility details by ID
 * Public route - no authentication required
 */
router.get('/:id', async (req, res) => {
  try {
    const facilityId = req.params.id;

    const [facilities] = await db.execute(
      `SELECT
        facility_id,
        facility_name,
        description,
        address,
        latitude,
        longitude,
        accepted_types,
        opening_hours,
        contact_number,
        is_verified
      FROM recycling_facilities
      WHERE facility_id = ? AND is_verified = TRUE`,
      [facilityId]
    );

    if (facilities.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Facility not found'
      });
    }

    const facility = facilities[0];

    // Process accepted_types
    let acceptedTypesArray = [];
    if (facility.accepted_types) {
      acceptedTypesArray = facility.accepted_types.split(',').map(type => type.trim());
    }

    // Parse opening_hours
    let openingHours = facility.opening_hours;
    if (typeof openingHours === 'string') {
      try {
        openingHours = JSON.parse(openingHours);
      } catch (e) {
        openingHours = null;
      }
    }

    const processedFacility = {
      facility_id: facility.facility_id,
      facility_name: facility.facility_name,
      description: facility.description,
      address: facility.address,
      latitude: parseFloat(facility.latitude),
      longitude: parseFloat(facility.longitude),
      accepted_types: acceptedTypesArray,
      opening_hours: openingHours,
      contact_number: facility.contact_number
    };

    return res.status(200).json({
      success: true,
      data: processedFacility
    });

  } catch (error) {
    console.error('Error fetching facility details:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch facility details',
      error: process.env.NODE_ENV !== 'production' ? error.message : undefined
    });
  }
});

module.exports = router;
