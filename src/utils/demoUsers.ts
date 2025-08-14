// Demo user data for testing purposes
// In production, these should be removed and replaced with real backend authentication

export interface DemoUser {
  email: string;
  password: string;
  name: string;
  role: string;
}

export const demoUsers: DemoUser[] = [
  {
    email: 'doctor@vitalsigns.com',
    password: 'password123',
    name: 'Dr. Sarah Johnson',
    role: 'doctor'
  },
  {
    email: 'nurse@vitalsigns.com',
    password: 'password123',
    name: 'Nurse Mike Chen',
    role: 'nurse'
  },
  {
    email: 'admin@vitalsigns.com',
    password: 'password123',
    name: 'Admin User',
    role: 'admin'
  },
  {
    email: 'test@vitalsigns.com',
    password: 'test123',
    name: 'Test User',
    role: 'user'
  }
];

export const getDemoUser = (email: string): DemoUser | undefined => {
  return demoUsers.find(user => user.email === email);
};

export const validateDemoUser = (email: string, password: string): DemoUser | null => {
  const user = getDemoUser(email);
  if (user && user.password === password) {
    return user;
  }
  return null;
};

// Mock API responses for demo purposes
export const createMockAuthResponse = (user: DemoUser, token: string) => ({
  success: true,
  token,
  user: {
    id: `user-${Date.now()}`,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: new Date().toISOString()
  }
});

export const createMockErrorResponse = (message: string) => ({
  success: false,
  error: message
});
