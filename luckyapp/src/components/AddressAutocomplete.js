'use client';

import { useEffect, useRef, useState } from 'react';
import { MapPin, Loader2 } from 'lucide-react';

const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;

/**
 * AddressAutocomplete — Google Places-powered address input.
 * Props:
 *  - value: current address string
 *  - onChange: (address) => void  — fires on text input
 *  - onPlaceSelect: ({ address, city, state, zip }) => void  — fires when user picks a suggestion
 *  - placeholder
 *  - disabled
 *  - className
 *  - style
 */
export default function AddressAutocomplete({
  value = '',
  onChange,
  onPlaceSelect,
  placeholder = '1234 Main St',
  disabled = false,
  className = 'form-input',
  style = {},
}) {
  const inputRef = useRef(null);
  const autocompleteRef = useRef(null);
  const [loaded, setLoaded] = useState(false);

  // Load Google Maps script if not already loaded
  useEffect(() => {
    if (!GOOGLE_MAPS_KEY) return;

    if (window.google?.maps?.places) {
      setLoaded(true);
      return;
    }

    // Check if script is already loading
    const existingScript = document.getElementById('google-maps-script');
    if (existingScript) {
      const handler = () => setLoaded(true);
      existingScript.addEventListener('load', handler);
      // Check again in case it loaded between checks
      if (window.google?.maps?.places) setLoaded(true);
      return () => existingScript.removeEventListener('load', handler);
    }

    const script = document.createElement('script');
    script.id = 'google-maps-script';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => setLoaded(true);
    script.onerror = () => console.error('Failed to load Google Maps');
    document.head.appendChild(script);
  }, []);

  // Initialize autocomplete once loaded
  useEffect(() => {
    if (!loaded || !inputRef.current || autocompleteRef.current) return;

    const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
      types: ['address'],
      componentRestrictions: { country: 'us' },
      fields: ['address_components', 'formatted_address'],
    });
    autocompleteRef.current = autocomplete;

    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      if (!place.address_components) return;

      let streetNumber = '';
      let route = '';
      let city = '';
      let state = '';
      let zip = '';

      for (const comp of place.address_components) {
        const types = comp.types;
        if (types.includes('street_number')) streetNumber = comp.long_name;
        if (types.includes('route')) route = comp.short_name;
        if (types.includes('locality')) city = comp.long_name;
        if (types.includes('administrative_area_level_1')) state = comp.short_name;
        if (types.includes('postal_code')) zip = comp.long_name;
      }

      const address = `${streetNumber} ${route}`.trim();

      if (onPlaceSelect) {
        onPlaceSelect({ address, city, state, zip });
      }
    });
  }, [loaded, onPlaceSelect]);

  return (
    <div style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        className={className}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        disabled={disabled}
        style={style}
        autoComplete="off"
      />
    </div>
  );
}
