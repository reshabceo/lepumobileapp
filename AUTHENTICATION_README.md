# Authentication System Documentation

## Overview

This document describes the complete authentication system implemented for the Vital Signs Monitor mobile application. The system provides secure user registration, login, and session management with protected routes.

## Features

### 🔐 User Authentication
- **User Registration**: New users can create accounts with email, password, and name
- **User Login**: Existing users can sign in with email and password
- **Session Management**: Automatic token storage and verification
- **Protected Routes**: All app features are protected behind authentication
- **Auto-logout**: Automatic logout on token expiration

### 🎨 User Interface
- **Modern Design**: Clean, responsive UI with dark theme
- **Form Validation**: Real-time validation with error messages
- **Password Visibility**: Toggle password visibility for better UX
- **Loading States**: Visual feedback during authentication operations
- **Toast Notifications**: Success and error messages

### 🛡️ Security Features
- **JWT Tokens**: Secure token-based authentication
- **Route Protection**: Unauthorized users cannot access protected features
- **Token Storage**: Secure localStorage token management
- **Auto-redirect**: Automatic navigation based on authentication status

## Components

### 1. AuthContext (`src/contexts/AuthContext.tsx`)
Central authentication state management using React Context.

**Features:**
- User state management
- Login/logout functions
- Token management
- Authentication status tracking

**Usage:**
```tsx
import { useAuth } from '@/contexts/AuthContext';

const { user, isAuthenticated, login, logout } = useAuth();
```

### 2. LoginPage (`src/components/LoginPage.tsx`)
Main authentication page with login and signup forms.

**Features:**
- Toggle between login and signup modes
- Form validation
- Error handling
- Responsive design

### 3. SignupForm (`src/components/SignupForm.tsx`)
User registration form component.

**Features:**
- Name, email, and password fields
- Password confirmation
- Real-time validation
- Error display

### 4. ProtectedRoute (`src/components/ProtectedRoute.tsx`)
Route protection component for authenticated users.

**Features:**
- Authentication checks
- Loading states
- Automatic redirects
- Route protection

### 5. UserProfile (`src/components/UserProfile.tsx`)
User profile dropdown with logout functionality.

**Features:**
- User information display
- Logout functionality
- Profile settings access
- Dropdown menu

### 6. AppNavigation (`src/components/AppNavigation.tsx`)
Bottom navigation for mobile app experience.

**Features:**
- Navigation between app sections
- Active route highlighting
- Icon-based navigation
- Mobile-optimized design

## API Integration

### Authentication Endpoints

#### Login
```typescript
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "password123"
}
```

#### Signup
```typescript
POST /api/auth/signup
{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe"
}
```

#### Token Verification
```typescript
GET /api/auth/verify
Authorization: Bearer <token>
```

### API Service (`src/lib/api.ts`)
Updated API service with authentication methods:

- `login(credentials)`: User login
- `signup(credentials)`: User registration
- `verifyToken()`: Token validation
- `setToken(token)`: Store authentication token
- `removeToken()`: Clear authentication token

## Route Protection

All application routes are now protected by the `ProtectedRoute` component:

```tsx
// Public route (login/signup)
<Route path="/" element={
  <ProtectedRoute requireAuth={false}>
    <LoginPage />
  </ProtectedRoute>
} />

// Protected route (dashboard, devices, etc.)
<Route path="/dashboard" element={
  <ProtectedRoute>
    <Dashboard />
  </ProtectedRoute>
} />
```

## State Management

### Authentication State
```typescript
interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (email: string, password: string, name: string) => Promise<boolean>;
  logout: () => void;
  updateUser: (userData: Partial<User>) => void;
}
```

### User Interface
```typescript
interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt?: string;
}
```

## Usage Examples

### Basic Authentication Check
```tsx
import { useAuth } from '@/contexts/AuthContext';

function MyComponent() {
  const { isAuthenticated, user } = useAuth();
  
  if (!isAuthenticated) {
    return <div>Please log in to continue</div>;
  }
  
  return <div>Welcome, {user?.name}!</div>;
}
```

### Login Function
```tsx
import { useAuth } from '@/contexts/AuthContext';

function LoginForm() {
  const { login } = useAuth();
  
  const handleLogin = async (email: string, password: string) => {
    try {
      const success = await login(email, password);
      if (success) {
        // Redirect to dashboard
        navigate('/dashboard');
      }
    } catch (error) {
      // Handle error
    }
  };
}
```

### Logout Function
```tsx
import { useAuth } from '@/contexts/AuthContext';

function LogoutButton() {
  const { logout } = useAuth();
  
  const handleLogout = () => {
    logout();
    // User will be redirected to login page
  };
}
```

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Backend Requirements
Ensure your backend provides these authentication endpoints:
- `POST /api/auth/login`
- `POST /api/auth/signup`
- `GET /api/auth/verify`

### 3. Environment Configuration
Update API URLs in `src/lib/api.ts` for your backend:
```typescript
const mobileUrl = 'http://your-backend-ip:3000/api';
const webUrl = 'http://localhost:3000/api';
```

### 4. Run the Application
```bash
npm run dev
```

## Security Considerations

### Token Management
- Tokens are stored in localStorage
- Automatic token verification on app startup
- Automatic logout on token expiration
- Secure token transmission via HTTP headers

### Route Protection
- All sensitive routes are protected
- Unauthorized access attempts are redirected
- Loading states prevent unauthorized content flash

### Form Validation
- Client-side validation for immediate feedback
- Server-side validation for security
- Password strength requirements
- Email format validation

## Customization

### Styling
The authentication system uses Tailwind CSS classes. Customize colors and styling by modifying the className props in components.

### Validation Rules
Update validation logic in `SignupForm.tsx` and `LoginPage.tsx` to match your requirements.

### User Roles
Extend the User interface to include additional role-based features and permissions.

## Troubleshooting

### Common Issues

1. **Authentication Loop**: Check that your backend endpoints are working correctly
2. **Token Not Stored**: Verify localStorage is available in your environment
3. **Route Protection Issues**: Ensure ProtectedRoute components are properly configured
4. **API Connection**: Check network connectivity and backend URL configuration

### Debug Mode
Enable debug logging by checking the browser console for API debug messages.

## Future Enhancements

- [ ] Password reset functionality
- [ ] Email verification
- [ ] Two-factor authentication
- [ ] Social login integration
- [ ] Remember me functionality
- [ ] Session timeout warnings
- [ ] User profile management
- [ ] Role-based access control

## Support

For issues or questions about the authentication system, please refer to the main project documentation or create an issue in the project repository.
