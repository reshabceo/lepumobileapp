# 🚀 Supabase Setup Guide for Vital Signs Monitor

## 📋 **Prerequisites**
- [x] Supabase account created
- [x] New project created
- [x] Project credentials obtained
- [x] Supabase client installed (`@supabase/supabase-js`)

## 🔑 **Step 1: Get Your Supabase Credentials**

### **A. Go to Supabase Dashboard**
1. Visit [supabase.com](https://supabase.com)
2. Sign in to your account
3. Select your project: `vital-signs-monitor`

### **B. Get Project URL & API Key**
1. Go to **Settings** → **API**
2. Copy the **Project URL**: `https://your-project-id.supabase.co`
3. Copy the **anon public** key (starts with `eyJ...`)

## ⚙️ **Step 2: Configure Environment Variables**

### **A. Create `.env.local` file**
```bash
# In your project root directory
touch .env.local
```

### **B. Add Supabase Configuration**
```bash
# .env.local
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# Development API URLs (fallback)
VITE_API_WEB_URL=http://localhost:3000/api
VITE_API_MOBILE_URL=http://192.168.1.11:3000/api

# Environment Settings
VITE_USE_HTTPS=false
VITE_DEBUG=true
```

### **C. Replace Placeholder Values**
- Replace `your-project-id` with your actual project ID
- Replace `your-anon-key-here` with your actual anon key

## 🗄️ **Step 3: Set Up Database Schema**

### **A. Open Supabase SQL Editor**
1. Go to **SQL Editor** in your Supabase dashboard
2. Click **"New query"**

### **B. Run the Schema Script**
1. Copy the entire content of `supabase-schema.sql`
2. Paste it into the SQL Editor
3. Click **"Run"** to execute

### **C. Verify Tables Created**
Go to **Table Editor** and verify these tables exist:
- ✅ `user_profiles`
- ✅ `vital_signs`
- ✅ `devices`
- ✅ `patient_records`
- ✅ `patient_vital_signs`

## 🔐 **Step 4: Configure Authentication**

### **A. Enable Email Auth**
1. Go to **Authentication** → **Providers**
2. Ensure **Email** is enabled
3. Configure email templates if needed

### **B. Set Up Email Templates (Optional)**
1. Go to **Authentication** → **Email Templates**
2. Customize **Confirm signup** template
3. Customize **Reset password** template

### **C. Configure Redirect URLs**
1. Go to **Authentication** → **URL Configuration**
2. Add redirect URLs:
   - `http://localhost:3000`
   - `http://localhost:8080`
   - `capacitor://localhost`

## 🧪 **Step 5: Test the Integration**

### **A. Build and Test**
```bash
# Build the app
npm run build

# Test locally
npm run dev
```

### **B. Check Console Logs**
Look for these messages:
```
🔍 Supabase Debug - URL: https://your-project-id.supabase.co
🔍 Supabase Debug - Anon Key: eyJ...
🔍 Environment Debug - Mode: development
🔍 Environment Debug - Using DEVELOPMENT config
```

### **C. Test Authentication**
1. Try to sign up with a new email
2. Check Supabase **Authentication** → **Users**
3. Verify user profile is created in `user_profiles` table

## 📱 **Step 6: Update Mobile App**

### **A. Sync with Capacitor**
```bash
npx cap sync
```

### **B. Build Android App**
```bash
cd android
./gradlew assembleDebug
```

### **C. Install on Device**
```bash
adb install app/build/outputs/apk/debug/app-debug.apk
```

## 🔍 **Step 7: Troubleshooting**

### **Common Issues & Solutions**

#### **1. "Missing Supabase environment variables"**
```bash
# Check if .env.local exists
ls -la .env.local

# Verify variables are loaded
echo $VITE_SUPABASE_URL
echo $VITE_SUPABASE_ANON_KEY
```

#### **2. "Failed to fetch" errors**
- Check if Supabase project is active
- Verify API key is correct
- Check browser console for CORS issues

#### **3. Database connection errors**
- Verify schema was created successfully
- Check RLS policies are active
- Ensure tables exist in Table Editor

#### **4. Authentication not working**
- Check Authentication settings in Supabase
- Verify email provider is enabled
- Check redirect URLs configuration

## 🚀 **Step 8: Production Deployment**

### **A. Update Production Environment**
```bash
# .env.production
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
VITE_USE_HTTPS=true
VITE_DEBUG=false
```

### **B. Build Production App**
```bash
npm run build
npx cap sync
cd android && ./gradlew assembleRelease
```

### **C. Deploy to App Store**
1. Generate signed APK
2. Upload to Google Play Console
3. Configure app signing

## 📊 **Step 9: Monitor & Analytics**

### **A. Supabase Dashboard**
- **Authentication**: Monitor user signups/logins
- **Database**: View table data and performance
- **Logs**: Check API requests and errors
- **Usage**: Monitor bandwidth and storage

### **B. App Analytics**
- User engagement metrics
- Device usage statistics
- Error tracking and reporting

## 🔒 **Security Best Practices**

### **A. Row Level Security (RLS)**
- ✅ All tables have RLS enabled
- ✅ Users can only access their own data
- ✅ Doctors can access patient data (with proper policies)

### **B. API Security**
- ✅ Use anon key for public operations
- ✅ Use service role key only for admin operations
- ✅ Validate all inputs server-side

### **C. Data Privacy**
- ✅ Personal health data is user-isolated
- ✅ No cross-user data access
- ✅ Audit trails for all operations

## 📈 **Next Steps**

### **Immediate (This Week)**
1. ✅ Set up Supabase project
2. ✅ Configure environment variables
3. ✅ Create database schema
4. ✅ Test authentication flow

### **Short-term (Next Month)**
1. Integrate vital signs data storage
2. Add device management
3. Implement patient monitoring
4. Add real-time updates

### **Long-term (Next Quarter)**
1. Advanced analytics dashboard
2. Machine learning insights
3. Multi-tenant architecture
4. Enterprise features

## 🎯 **Success Checklist**

- [ ] Supabase project created and configured
- [ ] Environment variables set up
- [ ] Database schema created
- [ ] Authentication working
- [ ] App builds successfully
- [ ] Mobile app installed and tested
- [ ] User registration/login working
- [ ] Data storage functional

## 🆘 **Need Help?**

### **Supabase Documentation**
- [Supabase Docs](https://supabase.com/docs)
- [JavaScript Client](https://supabase.com/docs/reference/javascript)
- [Database Guide](https://supabase.com/docs/guides/database)

### **Community Support**
- [Supabase Discord](https://discord.supabase.com)
- [GitHub Issues](https://github.com/supabase/supabase)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/supabase)

---

**🎉 Congratulations!** You now have a production-ready backend with Supabase!

Your app can now:
- ✅ Handle user authentication
- ✅ Store vital signs data securely
- ✅ Manage devices and patients
- ✅ Scale to thousands of users
- ✅ Provide real-time updates
- ✅ Maintain data privacy and security
