import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Microscope, Mail, Lock, User, Phone, Hospital, Award, ArrowLeft } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function RadiologistAuth() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('login');

  const [loginData, setLoginData] = useState({
    email: '',
    password: ''
  });

  const [signupData, setSignupData] = useState({
    email: '',
    password: '',
    full_name: '',
    phone_number: '',
    license_number: '',
    specialization: '',
    years_experience: '',
    hospital: '',
    bio: '',
    report_fee: ''
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: loginData.email,
      password: loginData.password
    });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    const { data: radiologist } = await supabase
      .from('radiologists')
      .select('*')
      .eq('auth_user_id', data.user.id)
      .single();

    if (!radiologist) {
      await supabase.auth.signOut();
      toast.error('Not authorized as radiologist');
      setLoading(false);
      return;
    }

    toast.success('Welcome back!');
    navigate('/radiologist-dashboard');
    setLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: signupData.email,
        password: signupData.password
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Failed to create user');

      const radiologistCode = `RAD${Date.now().toString().slice(-6)}`;
      const specializationArray = signupData.specialization
        .split(',')
        .map(s => s.trim())
        .filter(s => s);

      const { error: profileError } = await supabase
        .from('radiologists')
        .insert({
          auth_user_id: authData.user.id,
          radiologist_code: radiologistCode,
          full_name: signupData.full_name,
          email: signupData.email,
          phone_number: signupData.phone_number,
          license_number: signupData.license_number,
          specialization: specializationArray,
          years_experience: parseInt(signupData.years_experience) || 0,
          hospital: signupData.hospital,
          bio: signupData.bio,
          report_fee: parseFloat(signupData.report_fee) || 0,
          currency: 'INR',
          is_available: true,
          is_active: true
        });

      if (profileError) {
        await supabase.auth.admin.deleteUser(authData.user.id);
        throw profileError;
      }

      toast.success('Account created! Please check your email.');
      setActiveTab('login');
      setLoading(false);
    } catch (error: any) {
      console.error('Signup error:', error);
      toast.error(error.message || 'Failed to create account');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="max-w-2xl mx-auto">
        <Button
          variant="ghost"
          className="mb-4"
          onClick={() => navigate('/')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <Card className="shadow-2xl">
          <CardHeader className="text-center pb-4">
            <div className="flex items-center justify-center gap-3 mb-2">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Microscope className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-2xl">Radiologist Portal</CardTitle>
            </div>
            <CardDescription>Professional radiology reporting</CardDescription>
          </CardHeader>
          
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="mt-4">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <Label htmlFor="login-email">Email</Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="radiologist@hospital.com"
                      value={loginData.email}
                      onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="login-password">Password</Label>
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="••••••••"
                      value={loginData.password}
                      onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                      required
                    />
                  </div>

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? 'Signing in...' : 'Sign In'}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup" className="mt-4">
                <ScrollArea className="h-[500px] pr-4">
                  <form onSubmit={handleSignup} className="space-y-4">
                    <div>
                      <Label htmlFor="signup-name">Full Name *</Label>
                      <Input
                        id="signup-name"
                        placeholder="Dr. John Doe"
                        value={signupData.full_name}
                        onChange={(e) => setSignupData({ ...signupData, full_name: e.target.value })}
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="signup-email">Email *</Label>
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="radiologist@hospital.com"
                        value={signupData.email}
                        onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="signup-password">Password *</Label>
                      <Input
                        id="signup-password"
                        type="password"
                        placeholder="••••••••"
                        value={signupData.password}
                        onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
                        required
                        minLength={6}
                      />
                    </div>

                    <div>
                      <Label htmlFor="signup-phone">Phone Number *</Label>
                      <Input
                        id="signup-phone"
                        type="tel"
                        placeholder="+91 9876543210"
                        value={signupData.phone_number}
                        onChange={(e) => setSignupData({ ...signupData, phone_number: e.target.value })}
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="signup-license">License Number</Label>
                      <Input
                        id="signup-license"
                        placeholder="MED-12345"
                        value={signupData.license_number}
                        onChange={(e) => setSignupData({ ...signupData, license_number: e.target.value })}
                      />
                    </div>

                    <div>
                      <Label htmlFor="signup-experience">Years Experience *</Label>
                      <Input
                        id="signup-experience"
                        type="number"
                        placeholder="10"
                        value={signupData.years_experience}
                        onChange={(e) => setSignupData({ ...signupData, years_experience: e.target.value })}
                        required
                        min="0"
                      />
                    </div>

                    <div>
                      <Label htmlFor="signup-specialization">Specialization *</Label>
                      <Input
                        id="signup-specialization"
                        placeholder="CT, MRI, X-Ray"
                        value={signupData.specialization}
                        onChange={(e) => setSignupData({ ...signupData, specialization: e.target.value })}
                        required
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Comma-separated
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="signup-hospital">Hospital *</Label>
                      <Input
                        id="signup-hospital"
                        placeholder="City General Hospital"
                        value={signupData.hospital}
                        onChange={(e) => setSignupData({ ...signupData, hospital: e.target.value })}
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="signup-fee">Report Fee (INR)</Label>
                      <Input
                        id="signup-fee"
                        type="number"
                        placeholder="500"
                        value={signupData.report_fee}
                        onChange={(e) => setSignupData({ ...signupData, report_fee: e.target.value })}
                        min="0"
                      />
                    </div>

                    <div>
                      <Label htmlFor="signup-bio">Bio</Label>
                      <Textarea
                        id="signup-bio"
                        placeholder="Your expertise..."
                        value={signupData.bio}
                        onChange={(e) => setSignupData({ ...signupData, bio: e.target.value })}
                        rows={3}
                      />
                    </div>

                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? 'Creating...' : 'Create Account'}
                    </Button>
                  </form>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

