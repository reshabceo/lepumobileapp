// Dexcom API Service
// Based on: https://developer.dexcom.com/docs/dexcomv2/endpoint-overview/

export interface DexcomConfig {
  clientId: string;
  clientSecret: string;
  sandboxUrl: string;
  productionUrl: string;
  redirectUri: string;
}

export interface GlucoseReading {
  systemTime: string;
  displayTime: string;
  value: number;
  trend: 'Rising' | 'Falling' | 'Stable' | 'Unknown';
  trendRate?: number;
  unit: 'mg/dL';
}

export interface DexcomDevice {
  id: string;
  name: string;
  model: string;
  lastUploadDate: string;
  batteryLevel?: number;
  signalStrength?: number;
}

export interface DexcomCalibration {
  systemTime: string;
  displayTime: string;
  value: number;
  unit: 'mg/dL';
}

export interface DexcomEvent {
  systemTime: string;
  displayTime: string;
  eventType: string;
  value?: number;
  unit?: string;
}

class DexcomApiService {
  private config: DexcomConfig;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiry: number | null = null;
  private isProduction: boolean = false;

  constructor(config: DexcomConfig, useProduction: boolean = false) {
    this.config = config;
    this.isProduction = useProduction;
    this.loadTokens();
  }

  private get baseUrl(): string {
    return this.isProduction ? this.config.productionUrl : this.config.sandboxUrl;
  }

  private loadTokens(): void {
    try {
      const tokens = localStorage.getItem('dexcom_tokens');
      if (tokens) {
        const parsed = JSON.parse(tokens);
        this.accessToken = parsed.accessToken;
        this.refreshToken = parsed.refreshToken;
        this.tokenExpiry = parsed.expiry;
      }
    } catch (error) {
      console.error('Failed to load Dexcom tokens:', error);
    }
  }

  private saveTokens(accessToken: string, refreshToken: string, expiresIn: number): void {
    try {
      const tokens = {
        accessToken,
        refreshToken,
        expiry: Date.now() + (expiresIn * 1000),
      };
      localStorage.setItem('dexcom_tokens', JSON.stringify(tokens));
      this.accessToken = accessToken;
      this.refreshToken = refreshToken;
      this.tokenExpiry = tokens.expiry;
    } catch (error) {
      console.error('Failed to save Dexcom tokens:', error);
    }
  }

  private isTokenValid(): boolean {
    return this.accessToken !== null && this.tokenExpiry !== null && Date.now() < this.tokenExpiry;
  }

  private async refreshAccessToken(): Promise<boolean> {
    if (!this.refreshToken) return false;

    try {
      const response = await fetch(`${this.baseUrl}/v2/oauth2/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: this.refreshToken,
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        this.saveTokens(data.access_token, data.refresh_token, data.expires_in);
        return true;
      }
    } catch (error) {
      console.error('Failed to refresh Dexcom token:', error);
    }

    return false;
  }

  private async getValidToken(): Promise<string | null> {
    if (this.isTokenValid()) {
      return this.accessToken;
    }

    if (await this.refreshAccessToken()) {
      return this.accessToken;
    }

    return null;
  }

  // Get authorization URL for OAuth2 flow
  getAuthorizationUrl(): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: 'offline_access',
      state: Math.random().toString(36).substring(7),
    });

    return `${this.baseUrl}/v2/oauth2/auth?${params.toString()}`;
  }

  // Exchange authorization code for tokens
  async exchangeCodeForTokens(code: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/v2/oauth2/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: this.config.redirectUri,
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        this.saveTokens(data.access_token, data.refresh_token, data.expires_in);
        return true;
      }
    } catch (error) {
      console.error('Failed to exchange code for tokens:', error);
    }

    return false;
  }

  // Get estimated glucose values (EGVs)
  async getGlucoseValues(startDate: string, endDate: string): Promise<GlucoseReading[]> {
    const token = await this.getValidToken();
    if (!token) {
      throw new Error('No valid access token');
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/v2/users/self/egvs?startDate=${startDate}&endDate=${endDate}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        return data.egvs.map((egv: any) => ({
          systemTime: egv.systemTime,
          displayTime: egv.displayTime,
          value: egv.value,
          trend: egv.trend,
          trendRate: egv.trendRate,
          unit: egv.unit,
        }));
      } else {
        throw new Error(`Failed to fetch glucose values: ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to fetch glucose values:', error);
      throw error;
    }
  }

  // Get device information
  async getDevices(): Promise<DexcomDevice[]> {
    const token = await this.getValidToken();
    if (!token) {
      throw new Error('No valid access token');
    }

    try {
      const response = await fetch(`${this.baseUrl}/v2/users/self/devices`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        return data.devices.map((device: any) => ({
          id: device.id,
          name: device.name,
          model: device.model,
          lastUploadDate: device.lastUploadDate,
        }));
      } else {
        throw new Error(`Failed to fetch devices: ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to fetch devices:', error);
      throw error;
    }
  }

  // Get calibration entries
  async getCalibrations(startDate: string, endDate: string): Promise<DexcomCalibration[]> {
    const token = await this.getValidToken();
    if (!token) {
      throw new Error('No valid access token');
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/v2/users/self/calibrations?startDate=${startDate}&endDate=${endDate}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        return data.calibrations.map((cal: any) => ({
          systemTime: cal.systemTime,
          displayTime: cal.displayTime,
          value: cal.value,
          unit: cal.unit,
        }));
      } else {
        throw new Error(`Failed to fetch calibrations: ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to fetch calibrations:', error);
      throw error;
    }
  }

  // Get user events
  async getEvents(startDate: string, endDate: string): Promise<DexcomEvent[]> {
    const token = await this.getValidToken();
    if (!token) {
      throw new Error('No valid access token');
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/v2/users/self/events?startDate=${startDate}&endDate=${endDate}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        return data.events.map((event: any) => ({
          systemTime: event.systemTime,
          displayTime: event.displayTime,
          eventType: event.eventType,
          value: event.value,
          unit: event.unit,
        }));
      } else {
        throw new Error(`Failed to fetch events: ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to fetch events:', error);
      throw error;
    }
  }

  // Get data range
  async getDataRange(): Promise<{ start: string; end: string }> {
    const token = await this.getValidToken();
    if (!token) {
      throw new Error('No valid access token');
    }

    try {
      const response = await fetch(`${this.baseUrl}/v2/users/self/dataRange`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        return {
          start: data.start,
          end: data.end,
        };
      } else {
        throw new Error(`Failed to fetch data range: ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to fetch data range:', error);
      throw error;
    }
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    return this.isTokenValid();
  }

  // Logout (clear tokens)
  logout(): void {
    try {
      localStorage.removeItem('dexcom_tokens');
      this.accessToken = null;
      this.refreshToken = null;
      this.tokenExpiry = null;
    } catch (error) {
      console.error('Failed to logout:', error);
    }
  }
}

// Create and export the service instance
export const dexcomApi = new DexcomApiService({
  clientId: 'Q2qEFvo579VN7tpFQ0TYxjJCbLwET0eu',
  clientSecret: 'sebkvpGkfUgBwcww',
  sandboxUrl: 'https://sandbox-api.dexcom.com',
  productionUrl: 'https://api.dexcom.com',
  redirectUri: 'https://your-app.com/callback', // Update this with your actual redirect URI
}, false); // Set to true for production

export default DexcomApiService;
