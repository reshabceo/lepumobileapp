# 🔌 Frontend-Backend API Connection Guide

## 📋 **Overview**

Your application uses **two main data sources**:

1. **Supabase** (Cloud Database) - For authentication and data storage
2. **Backend API Server** (Node.js) - For device management and custom business logic

---

## 🏗️ **Architecture**

```
┌─────────────────────────────────────────────────────────┐
│                    Mobile App (APK)                      │
│  ┌──────────────────┐      ┌──────────────────┐       │
│  │   React/TypeScript│      │  Capacitor Native │       │
│  │   Frontend Code   │      │   Plugins (BLE)   │       │
│  └──────────────────┘      └──────────────────┘       │
└──────────────┬──────────────────────┬───────────────────┘
               │                      │
               │                      │
    ┌──────────▼──────────┐  ┌────────▼──────────┐
    │   Supabase Client   │  │  Backend API      │
    │   (Direct HTTP)     │  │  (HTTP Requests)  │
    └──────────┬──────────┘  └────────┬──────────┘
               │                      │
               │                      │
    ┌──────────▼──────────┐  ┌────────▼──────────┐
    │   Supabase Cloud    │  │  Node.js Backend  │
    │   (Database + Auth) │  │  (Port 3000)     │
    └────────────────────┘  └──────────────────┘
```

---

## 🔵 **1. Supabase Connection (Primary)**

### **Location:** `src/lib/supabase.ts`

### **How It Works:**

```typescript
// 1. Configuration (from environment variables)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// 2. Create Supabase Client
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// 3. Make API Calls
const { data, error } = await supabase
  .from('patients')
  .select('*')
  .eq('auth_user_id', userId)
```

### **What It's Used For:**
- ✅ **Authentication** (login, signup, logout)
- ✅ **Database Operations** (CRUD on patients, doctors, vital signs)
- ✅ **Real-time Subscriptions** (live data updates)
- ✅ **File Storage** (uploading reports, images)

### **Connection Method:**
- **Direct HTTP/HTTPS** to Supabase cloud
- **No backend server needed** - connects directly
- **Always available** - Supabase is cloud-hosted

### **Example Usage:**
```typescript
// Authentication
import { auth } from '@/lib/supabase'
await auth.signIn(email, password)

// Database Query
import { db } from '@/lib/supabase'
const { data } = await db.getPatientProfile(userId)

// Real-time Subscription
supabase
  .channel('vital-signs')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'vital_signs' }, 
    (payload) => {
      console.log('New vital sign:', payload.new)
    })
  .subscribe()
```

---

## 🟢 **2. Backend API Connection (Secondary)**

### **Location:** `src/lib/api.ts.old` (Currently not active)

### **How It Should Work:**

```typescript
// 1. Get API Base URL (from environment config)
const getApiBaseUrl = () => {
  const isMobile = /android|iphone/.test(navigator.userAgent)
  return isMobile 
    ? 'http://192.168.1.11:3000/api'  // Mobile device
    : 'http://localhost:3000/api'     // Web browser
}

// 2. Create API Service
class ApiService {
  private baseUrl: string
  
  constructor(baseUrl: string = getApiBaseUrl()) {
    this.baseUrl = baseUrl
  }
  
  // 3. Make HTTP Requests
  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    const response = await fetch(url, {
      method: options?.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`,
        ...options?.headers
      },
      body: options?.body
    })
    return response.json()
  }
  
  // 4. API Methods
  async login(credentials) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    })
  }
}
```

### **What It's Used For:**
- ✅ **Device Management** (connect/disconnect devices)
- ✅ **Device Status** (check if device is connected)
- ✅ **Custom Business Logic** (if not in Supabase)
- ✅ **Third-party Integrations** (external APIs)

### **Connection Method:**
- **HTTP/HTTPS** to your Node.js backend server
- **Requires backend to be running** on port 3000
- **Network accessible** (same WiFi or public URL)

### **Current Status:**
⚠️ **Note:** The `apiService` is referenced in some files but the actual `api.ts` file may not be active. The app primarily uses Supabase.

---

## 📱 **3. How API Calls Are Made**

### **A. Using Supabase (Current Primary Method)**

```typescript
// Example: Fetching patient data
import { supabase } from '@/lib/supabase'

// Direct query
const { data, error } = await supabase
  .from('patients')
  .select('*')
  .eq('id', patientId)
  .single()

// With authentication
const { data: { user } } = await supabase.auth.getUser()
if (user) {
  const { data } = await supabase
    .from('vital_signs')
    .select('*')
    .eq('patient_id', user.id)
}
```

### **B. Using Fetch API (For Backend API)**

```typescript
// Example: Calling backend API
const response = await fetch('http://localhost:3000/api/devices', {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  }
})

const data = await response.json()
```

### **C. Using API Service (If Active)**

```typescript
// Example: Using apiService
import { apiService } from '@/lib/api'

const devices = await apiService.getDevices()
const patient = await apiService.getPatient(patientId)
```

---

## 🔧 **4. Configuration**

### **Environment Variables** (`.env.local`)

```env
# Supabase (Always Active)
VITE_SUPABASE_URL=https://xktewvqzmbkhnrbwtxjb.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Backend API (If Using)
VITE_API_WEB_URL=http://localhost:3000/api
VITE_API_MOBILE_URL=http://192.168.1.11:3000/api
```

### **Environment Config** (`src/config/environment.ts`)

```typescript
export const ENV = {
  development: {
    supabase: {
      url: import.meta.env.VITE_SUPABASE_URL,
      anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY
    }
  },
  production: {
    supabase: {
      url: import.meta.env.VITE_SUPABASE_URL,
      anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY
    }
  }
}
```

---

## 🔍 **5. Finding API Calls in Your Code**

### **Search Patterns:**

```bash
# Find Supabase calls
grep -r "supabase\." src/
grep -r "from.*supabase" src/

# Find fetch calls
grep -r "fetch(" src/
grep -r "await fetch" src/

# Find apiService calls
grep -r "apiService\." src/
```

### **Common Locations:**

1. **Authentication:** `src/contexts/AuthContext.tsx`
   - Uses Supabase for login/signup

2. **Data Fetching:** `src/hooks/useHealthData.ts`
   - Uses Supabase for vital signs

3. **Patient Data:** `src/pages/PatientMonitor.tsx`
   - Uses `apiService.getPatient()` (if active)

4. **Device Status:** `src/pages/ECGMonitor.tsx`
   - Uses `fetch('http://localhost:3000/api/devices/...')`

---

## 🚀 **6. How to Add New API Calls**

### **Option A: Using Supabase (Recommended)**

```typescript
// Add to src/lib/supabase.ts
export const db = {
  // ... existing methods ...
  
  // New method
  getCustomData: async (userId: string) => {
    const { data, error } = await supabase
      .from('your_table')
      .select('*')
      .eq('user_id', userId)
    
    return { data, error }
  }
}

// Use in component
import { db } from '@/lib/supabase'
const { data } = await db.getCustomData(userId)
```

### **Option B: Using Backend API**

```typescript
// Add to src/lib/api.ts (if it exists)
class ApiService {
  // ... existing methods ...
  
  async getCustomData(userId: string) {
    return this.request(`/custom/${userId}`, {
      method: 'GET'
    })
  }
}

// Use in component
import { apiService } from '@/lib/api'
const data = await apiService.getCustomData(userId)
```

### **Option C: Direct Fetch**

```typescript
// In your component
const fetchCustomData = async () => {
  const response = await fetch('http://localhost:3000/api/custom', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  })
  const data = await response.json()
  return data
}
```

---

## 🐛 **7. Troubleshooting**

### **"Failed to fetch" Error**

**Possible Causes:**
1. **Backend not running** → Start backend: `cd backend && npm run dev`
2. **Wrong URL** → Check `src/config/environment.ts`
3. **CORS error** → Configure CORS on backend
4. **Network issue** → Check WiFi/network connection

### **"Supabase error"**

**Possible Causes:**
1. **Missing env variables** → Check `.env.local` file
2. **Wrong credentials** → Verify Supabase URL and key
3. **Network issue** → Check internet connection

### **"apiService is undefined"**

**Possible Causes:**
1. **api.ts file missing** → Create `src/lib/api.ts`
2. **Not imported** → Add `import { apiService } from '@/lib/api'`
3. **File renamed** → Check if it's `api.ts.old`

---

## 📊 **8. Current Status Summary**

| Component | Status | Connection Method | Location |
|-----------|--------|------------------|----------|
| **Supabase** | ✅ Active | Direct HTTP | `src/lib/supabase.ts` |
| **Backend API** | ⚠️ Partial | HTTP Fetch | `src/lib/api.ts.old` |
| **Device Status** | ⚠️ Direct Fetch | HTTP | `src/pages/ECGMonitor.tsx` |
| **Video Call API** | ⚠️ Direct Fetch | HTTP | `src/pages/VideoCall.tsx` |

---

## ✅ **Summary**

1. **Supabase** is the **primary** data source (always connected)
2. **Backend API** is **optional** (only if you need custom logic)
3. **Most operations** use Supabase directly
4. **Some features** may use direct `fetch()` calls to backend
5. **API service** exists but may not be fully integrated

**For most use cases, Supabase handles everything. Backend API is only needed for custom device management or third-party integrations.**








