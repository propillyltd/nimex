import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Search, Loader2, Navigation } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { googleMapsService } from '../../services/googleMapsService';

interface LocationPickerProps {
  initialLocation?: { lat: number; lng: number; address?: string };
  onLocationSelect: (location: {
    lat: number;
    lng: number;
    address: string;
    city?: string;
    state?: string;
  }) => void;
  placeholder?: string;
  className?: string;
}

export const LocationPicker: React.FC<LocationPickerProps> = ({
  initialLocation,
  onLocationSelect,
  placeholder = 'Search for a location in Nigeria',
  className = '',
}) => {
  const [searchQuery, setSearchQuery] = useState(initialLocation?.address || '');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(initialLocation);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [marker, setMarker] = useState<google.maps.Marker | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) return;

    if (window.google && window.google.maps) {
      initializeMap();
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.onload = initializeMap;
    document.head.appendChild(script);
  }, []);

  const initializeMap = () => {
    if (!mapRef.current) return;

    const initialCenter = initialLocation || { lat: 6.5244, lng: 3.3792 };

    const newMap = new google.maps.Map(mapRef.current, {
      center: initialCenter,
      zoom: 15,
      mapTypeControl: false,
      streetViewControl: false,
    });

    const newMarker = new google.maps.Marker({
      position: initialCenter,
      map: newMap,
      draggable: true,
    });

    newMarker.addListener('dragend', async () => {
      const position = newMarker.getPosition();
      if (!position) return;

      const lat = position.lat();
      const lng = position.lng();

      try {
        const geocoder = new google.maps.Geocoder();
        const result = await geocoder.geocode({ location: { lat, lng } });

        if (result.results[0]) {
          const address = result.results[0].formatted_address;
          const addressComponents = result.results[0].address_components;

          let city = '';
          let state = '';

          addressComponents.forEach((component) => {
            if (component.types.includes('locality')) {
              city = component.long_name;
            }
            if (component.types.includes('administrative_area_level_1')) {
              state = component.long_name;
            }
          });

          setSearchQuery(address);
          setSelectedLocation({ lat, lng, address });
          onLocationSelect({ lat, lng, address, city, state });
        }
      } catch (error) {
        console.error('Geocoding error:', error);
      }
    });

    newMap.addListener('click', (e: google.maps.MapMouseEvent) => {
      if (e.latLng) {
        newMarker.setPosition(e.latLng);
        newMarker.setMap(newMap);
      }
    });

    setMap(newMap);
    setMarker(newMarker);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (value.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsSearching(true);

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await googleMapsService.getAutocompleteSuggestions(value);
        setSuggestions(results);
        setShowSuggestions(true);
      } catch (error) {
        console.error('Error getting suggestions:', error);
      } finally {
        setIsSearching(false);
      }
    }, 500);
  };

  const handleSuggestionClick = async (address: string) => {
    setSearchQuery(address);
    setShowSuggestions(false);
    setIsSearching(true);

    try {
      const results = await googleMapsService.geocodeAddress(address);

      if (results.length > 0) {
        const location = results[0];
        const lat = location.geometry.location.lat;
        const lng = location.geometry.location.lng;

        setSelectedLocation({ lat, lng, address });

        if (map && marker) {
          map.setCenter({ lat, lng });
          marker.setPosition({ lat, lng });
          marker.setMap(map);
        }

        const addressComponents = address.split(',');
        const city = addressComponents[addressComponents.length - 2]?.trim() || '';
        const state = addressComponents[addressComponents.length - 1]?.trim() || '';

        onLocationSelect({ lat, lng, address, city, state });
      }
    } catch (error) {
      console.error('Error geocoding address:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    setIsSearching(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        try {
          const geocoder = new google.maps.Geocoder();
          const result = await geocoder.geocode({ location: { lat, lng } });

          if (result.results[0]) {
            const address = result.results[0].formatted_address;
            const addressComponents = result.results[0].address_components;

            let city = '';
            let state = '';

            addressComponents.forEach((component) => {
              if (component.types.includes('locality')) {
                city = component.long_name;
              }
              if (component.types.includes('administrative_area_level_1')) {
                state = component.long_name;
              }
            });

            setSearchQuery(address);
            setSelectedLocation({ lat, lng, address });

            if (map && marker) {
              map.setCenter({ lat, lng });
              marker.setPosition({ lat, lng });
              marker.setMap(map);
            }

            onLocationSelect({ lat, lng, address, city, state });
          }
        } catch (error) {
          console.error('Error getting current location:', error);
        } finally {
          setIsSearching(false);
        }
      },
      (error) => {
        console.error('Geolocation error:', error);
        setIsSearching(false);
        alert('Unable to get your location');
      }
    );
  };

  return (
    <div className={className}>
      <div className="space-y-4">
        <div className="relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder={placeholder}
              className="w-full pl-10 pr-10 py-3 border border-neutral-300 rounded-lg font-sans text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            {isSearching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-primary-600 animate-spin" />
            )}
          </div>

          {showSuggestions && suggestions.length > 0 && (
            <Card className="absolute z-10 w-full mt-2 max-h-60 overflow-y-auto">
              <div className="py-2">
                {suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="w-full px-4 py-2 text-left hover:bg-neutral-50 font-sans text-sm text-neutral-900 flex items-center gap-2"
                  >
                    <MapPin className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                    <span className="flex-1">{suggestion}</span>
                  </button>
                ))}
              </div>
            </Card>
          )}
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={handleUseCurrentLocation}
          disabled={isSearching}
          className="w-full"
        >
          <Navigation className="w-4 h-4 mr-2" />
          Use Current Location
        </Button>

        <div
          ref={mapRef}
          className="w-full h-64 md:h-96 rounded-lg border border-neutral-200 bg-neutral-100"
        />

        {selectedLocation && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="font-sans text-sm text-green-900 flex items-start gap-2">
              <MapPin className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
              <span className="flex-1">{searchQuery}</span>
            </p>
            <p className="font-sans text-xs text-green-700 mt-1 ml-6">
              Drag the marker to adjust the location
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
