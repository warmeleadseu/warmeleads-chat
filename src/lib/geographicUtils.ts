/**
 * Geographic Utilities for Meta Lead Qualifying
 * Handles postcode to coordinates conversion and distance calculations
 */

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface TerritoryConfig {
  type: 'radius' | 'full_country' | 'regions';
  centerPostcode?: string;
  centerLat?: number;
  centerLng?: number;
  radiusKm?: number;
  allowedRegions?: string[];
}

// Dutch postcode regex: 1234AB format
const POSTCODE_REGEX = /^\d{4}\s*[A-Z]{2}$/i;

// Approximate coordinates for Dutch provinces (for region matching)
const PROVINCE_COORDINATES: Record<string, Coordinates> = {
  'Noord-Holland': { lat: 52.5200, lng: 4.7885 },
  'Zuid-Holland': { lat: 51.9244, lng: 4.4777 },
  'Utrecht': { lat: 52.0907, lng: 5.1214 },
  'Noord-Brabant': { lat: 51.4827, lng: 5.2322 },
  'Gelderland': { lat: 52.0452, lng: 5.8722 },
  'Overijssel': { lat: 52.4388, lng: 6.5016 },
  'Flevoland': { lat: 52.5277, lng: 5.5950 },
  'Friesland': { lat: 53.1642, lng: 5.7818 },
  'Groningen': { lat: 53.2194, lng: 6.5665 },
  'Drenthe': { lat: 52.9476, lng: 6.6231 },
  'Zeeland': { lat: 51.4940, lng: 3.8497 },
  'Limburg': { lat: 50.8476, lng: 5.7070 }
};

// Simple postcode to coordinates mapping (fallback for basic postcodes)
// In production, you'd want a proper geocoding service
const POSTCODE_COORDINATES: Record<string, Coordinates> = {
  // Zwolle area examples
  '8011': { lat: 52.5168, lng: 6.0830 }, // Zwolle centrum
  '8012': { lat: 52.5168, lng: 6.0830 }, // Zwolle
  '8013': { lat: 52.5168, lng: 6.0830 }, // Zwolle
  '8014': { lat: 52.5168, lng: 6.0830 }, // Zwolle

  // Amsterdam area
  '1000': { lat: 52.3676, lng: 4.9041 }, // Amsterdam centrum
  '1011': { lat: 52.3676, lng: 4.9041 }, // Amsterdam
  '1012': { lat: 52.3676, lng: 4.9041 }, // Amsterdam

  // Rotterdam area
  '3000': { lat: 51.9244, lng: 4.4777 }, // Rotterdam centrum
  '3011': { lat: 51.9244, lng: 4.4777 }, // Rotterdam
  '3012': { lat: 51.9244, lng: 4.4777 }, // Rotterdam

  // Default for unknown postcodes (Amsterdam as fallback)
  'default': { lat: 52.3676, lng: 4.9041 }
};

export class GeographicUtils {
  /**
   * Validate Dutch postcode format
   */
  static isValidPostcode(postcode: string): boolean {
    return POSTCODE_REGEX.test(postcode);
  }

  /**
   * Clean postcode (remove spaces, uppercase)
   */
  static cleanPostcode(postcode: string): string {
    return postcode.replace(/\s/g, '').toUpperCase();
  }

  /**
   * Convert postcode to coordinates
   * Uses local mapping for now - in production use a geocoding service
   */
  static async postcodeToCoordinates(postcode: string): Promise<Coordinates | null> {
    if (!this.isValidPostcode(postcode)) {
      console.warn(`Invalid postcode format: ${postcode}`);
      return null;
    }

    const cleaned = this.cleanPostcode(postcode);
    const prefix = cleaned.substring(0, 4);

    // Try exact postcode match first
    if (POSTCODE_COORDINATES[cleaned]) {
      return POSTCODE_COORDINATES[cleaned];
    }

    // Try 4-digit prefix match
    if (POSTCODE_COORDINATES[prefix]) {
      return POSTCODE_COORDINATES[prefix];
    }

    // Fallback to default (Amsterdam)
    console.warn(`No coordinates found for postcode ${cleaned}, using default`);
    return POSTCODE_COORDINATES.default;
  }

  /**
   * Calculate distance between two coordinates using Haversine formula
   * Returns distance in kilometers
   */
  static calculateDistance(coord1: Coordinates, coord2: Coordinates): number {
    const R = 6371; // Earth's radius in kilometers

    const lat1Rad = (coord1.lat * Math.PI) / 180;
    const lat2Rad = (coord2.lat * Math.PI) / 180;
    const deltaLatRad = ((coord2.lat - coord1.lat) * Math.PI) / 180;
    const deltaLngRad = ((coord2.lng - coord1.lng) * Math.PI) / 180;

    const a =
      Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
      Math.cos(lat1Rad) * Math.cos(lat2Rad) *
      Math.sin(deltaLngRad / 2) * Math.sin(deltaLngRad / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in kilometers
  }

  /**
   * Check if coordinates fall within territory configuration
   */
  static async coordinatesInTerritory(
    coordinates: Coordinates,
    territory: TerritoryConfig
  ): Promise<{ matches: boolean; distance?: number }> {
    switch (territory.type) {
      case 'full_country':
        // Netherlands is small, everything is within "full country"
        return { matches: true };

      case 'radius':
        if (!territory.centerLat || !territory.centerLng || !territory.radiusKm) {
          console.error('Radius territory missing center coordinates or radius');
          return { matches: false };
        }

        const centerCoords: Coordinates = {
          lat: territory.centerLat,
          lng: territory.centerLng
        };

        const distance = this.calculateDistance(coordinates, centerCoords);

        return {
          matches: distance <= territory.radiusKm,
          distance: Math.round(distance * 10) / 10 // Round to 1 decimal
        };

      case 'regions':
        if (!territory.allowedRegions || territory.allowedRegions.length === 0) {
          return { matches: false };
        }

        // Find closest province and check if it's allowed
        let closestProvince: string | null = null;
        let minDistance = Infinity;

        for (const [province, provinceCoords] of Object.entries(PROVINCE_COORDINATES)) {
          const distance = this.calculateDistance(coordinates, provinceCoords);
          if (distance < minDistance) {
            minDistance = distance;
            closestProvince = province;
          }
        }

        const matches = closestProvince ? territory.allowedRegions.includes(closestProvince) : false;

        return {
          matches,
          distance: Math.round(minDistance * 10) / 10
        };

      default:
        console.error(`Unknown territory type: ${territory.type}`);
        return { matches: false };
    }
  }

  /**
   * Check if postcode falls within territory (convenience method)
   */
  static async postcodeInTerritory(
    postcode: string,
    territory: TerritoryConfig
  ): Promise<{ matches: boolean; distance?: number; coordinates?: Coordinates }> {
    const coordinates = await this.postcodeToCoordinates(postcode);

    if (!coordinates) {
      return { matches: false };
    }

    const result = await this.coordinatesInTerritory(coordinates, territory);

    return {
      ...result,
      coordinates
    };
  }

  /**
   * Get territory description for display
   */
  static getTerritoryDescription(territory: TerritoryConfig): string {
    switch (territory.type) {
      case 'full_country':
        return 'Heel Nederland';

      case 'radius':
        if (territory.centerPostcode && territory.radiusKm) {
          return `${territory.radiusKm}km rondom ${territory.centerPostcode}`;
        }
        return 'Straal (configuratie onvolledig)';

      case 'regions':
        if (territory.allowedRegions && territory.allowedRegions.length > 0) {
          if (territory.allowedRegions.length === 1) {
            return territory.allowedRegions[0];
          }
          return `${territory.allowedRegions.length} provincies`;
        }
        return 'Regios (geen provincies geselecteerd)';

      default:
        return 'Onbekend gebied';
    }
  }
}
