import React, { useEffect, useRef } from 'react';
import { useTranslation } from '@/lib/translations';
import { useMap } from '@/hooks/use-map';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

// Mock map component (in a real app, would use React Native Maps)
const MapContainer: React.FC<{
  locations: any[];
  selectedLocation: any | null;
  onMarkerPress: (location: any) => void;
  region: any;
}> = ({ locations, selectedLocation, onMarkerPress, region }) => {
  // This is a mock of what would be a real map component in React Native
  return (
    <div className="relative w-full h-full bg-neutral-100">
      {/* Static map background */}
      <div className="absolute inset-0 bg-neutral-200 flex items-center justify-center">
        <div className="text-center">
          <p className="text-neutral-500 mb-2">Interactive map would be rendered here</p>
          <p className="text-neutral-400 text-sm">Using React Native Maps in the actual app</p>
        </div>
      </div>

      {/* Map controls */}
      <div className="absolute right-4 top-4 flex flex-col space-y-2">
        <Button size="icon" className="bg-white shadow-md rounded-full p-2 h-10 w-10">
          <span className="material-icons text-primary">add</span>
        </Button>
        <Button size="icon" className="bg-white shadow-md rounded-full p-2 h-10 w-10">
          <span className="material-icons text-primary">remove</span>
        </Button>
        <Button size="icon" className="bg-white shadow-md rounded-full p-2 h-10 w-10">
          <span className="material-icons text-primary">my_location</span>
        </Button>
      </div>

      {/* Map markers */}
      {locations.map((location) => (
        <div 
          key={location.id}
          className="absolute"
          style={{ 
            top: `${Math.random() * 70 + 10}%`, 
            left: `${Math.random() * 70 + 10}%`,
            cursor: 'pointer',
            zIndex: selectedLocation?.id === location.id ? 10 : 1
          }}
          onClick={() => onMarkerPress(location)}
        >
          <div className="relative flex flex-col items-center">
            <div className={`
              ${location.locationType === 'building' ? 'bg-primary' : 
                location.locationType === 'office' ? 'bg-secondary' : 
                'bg-accent'} 
              text-white px-3 py-1 rounded-lg shadow-md text-sm
            `}>
              {location.name}
            </div>
            <div className={`
              ${location.locationType === 'building' ? 'bg-primary' : 
                location.locationType === 'office' ? 'bg-secondary' : 
                'bg-accent'} 
              h-6 w-6 rounded-full flex items-center justify-center shadow-md
            `}>
              <span className="material-icons text-white text-sm">place</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

const Map: React.FC = () => {
  const { t } = useTranslation();
  const { 
    locations, 
    isLoading, 
    searchQuery, 
    setSearchQuery, 
    selectedLocation, 
    selectLocation, 
    resetSelection,
    mapRegion,
    getDirectionsUrl
  } = useMap();

  // Handle external navigation to directions
  const openDirections = () => {
    if (selectedLocation) {
      window.open(getDirectionsUrl(), '_blank');
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-neutral-200">
        <div className="relative">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-500">
            <span className="material-icons">search</span>
          </span>
          <Input
            type="text"
            placeholder={t('searchLocations')}
            className="w-full pl-10 pr-4 py-2 border border-neutral-300 rounded-lg"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>
      
      <div className="relative flex-1">
        <MapContainer 
          locations={locations}
          selectedLocation={selectedLocation}
          onMarkerPress={selectLocation}
          region={mapRegion}
        />
        
        {selectedLocation && (
          <Card className="absolute bottom-4 left-4 right-4 bg-white rounded-lg shadow-lg p-4">
            <div className="flex items-start">
              <div className={`
                ${selectedLocation.locationType === 'building' ? 'bg-primary' : 
                  selectedLocation.locationType === 'office' ? 'bg-secondary' : 
                  'bg-accent'} 
                h-10 w-10 rounded-full flex items-center justify-center mr-3
              `}>
                <span className="material-icons text-white">
                  {selectedLocation.locationType === 'building' ? 'account_balance' : 
                    selectedLocation.locationType === 'office' ? 'business' : 
                    'hotel'}
                </span>
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-lg">{selectedLocation.name}</h3>
                <p className="text-sm text-neutral-600 mb-1">
                  {selectedLocation.building && `Building ${selectedLocation.building}, `}
                  {selectedLocation.floor && `${selectedLocation.floor}, `}
                  {selectedLocation.roomNumber && `${selectedLocation.roomNumber}`}
                </p>
                {selectedLocation.hours && (
                  <div className="flex items-center text-sm text-neutral-500 mb-2">
                    <span className="material-icons text-sm mr-1">schedule</span>
                    <span>{selectedLocation.hours}</span>
                  </div>
                )}
                <div className="flex space-x-2">
                  <Button 
                    className="flex-1 bg-primary text-white py-2 rounded-lg text-sm flex justify-center items-center"
                    onClick={openDirections}
                  >
                    <span className="material-icons text-sm mr-1">directions</span>
                    {t('directions')}
                  </Button>
                  <Button 
                    variant="outline"
                    className="flex-1 bg-neutral-100 text-neutral-700 py-2 rounded-lg text-sm flex justify-center items-center"
                    onClick={resetSelection}
                  >
                    <span className="material-icons text-sm mr-1">info</span>
                    {t('details')}
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Map;
