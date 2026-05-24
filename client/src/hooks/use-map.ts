import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Location } from '@shared/schema';

export const useMap = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [mapRegion, setMapRegion] = useState({
    latitude: 47.493000,
    longitude: 19.052000,
    latitudeDelta: 0.003,
    longitudeDelta: 0.003,
  });

  // Fetch all locations
  const {
    data: locations,
    isLoading,
    error,
  } = useQuery<Location[]>({
    queryKey: ['/api/locations'],
  });

  // Search locations based on query
  const filteredLocations = searchQuery
    ? locations?.filter(
        location =>
          location.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          location.building?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          location.description?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : locations;

  // Select a location and center map on it
  const selectLocation = (location: Location) => {
    setSelectedLocation(location);
    const { lat, lng } = location.coordinates as { lat: number; lng: number };
    setMapRegion({
      latitude: lat,
      longitude: lng,
      latitudeDelta: 0.002,
      longitudeDelta: 0.002,
    });
  };

  // Reset selection
  const resetSelection = () => {
    setSelectedLocation(null);
  };

  // Get directions to selected location
  const getDirectionsUrl = () => {
    if (!selectedLocation) return '';
    
    const { lat, lng } = selectedLocation.coordinates as { lat: number; lng: number };
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  };

  return {
    locations: filteredLocations || [],
    isLoading,
    error,
    searchQuery,
    setSearchQuery,
    selectedLocation,
    selectLocation,
    resetSelection,
    mapRegion,
    setMapRegion,
    getDirectionsUrl,
  };
};
