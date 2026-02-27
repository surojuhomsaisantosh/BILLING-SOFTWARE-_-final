import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import logo from '@/assets/logo.png';
import { Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

/** Helper: detect if an error is a network/timeout issue. */
function isNetworkError(err: any): boolean {
  if (!err) return false;
  const msg = (err.message || err.toString()).toLowerCase();
  return (
    msg.includes('timed out') ||
    msg.includes('failed to fetch') ||
    msg.includes('network') ||
    msg.includes('load failed') ||
    msg.includes('err_connection') ||
    err.name === 'NetworkError' ||
    err.name === 'AbortError'
  );
}

export function SignIn() {
  const [storeData, setStoreData] = useState({ franchiseId: '', password: '' });
  const [adminData, setAdminData] = useState({ franchiseId: '', emailInput: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [showStorePassword, setShowStorePassword] = useState(false);
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const { signIn, connectionError } = useAuth();
  const { toast } = useToast();

  const showNetworkErrorToast = () => {
    toast({
      title: "Connection Failed",
      description: "Cannot connect to server. Please check your internet connection and try again.",
      variant: "destructive",
    });
  };

  const handleStoreLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const rawId = storeData.franchiseId.toLowerCase().trim();
    const normalizedId = rawId.startsWith('fr-') ? rawId : `fr-${rawId}`;
    const constructedEmail = `store.${normalizedId}@yourdomain.com`;

    console.log("[DEBUG] Store Attempt:", { normalizedId, constructedEmail });

    try {
      // Search DB for the franchise_id
      const { data: profile, error: queryError } = await supabase
        .from('profiles')
        .select('id')
        .eq('franchise_id', normalizedId.toUpperCase())
        .maybeSingle();

      if (queryError) {
        if (isNetworkError(queryError)) {
          showNetworkErrorToast();
          setLoading(false);
          return;
        }
        console.error("[DEBUG] Profile query error:", queryError);
      }

      if (!profile) {
        toast({
          title: "Wrong Franchise ID",
          description: `Franchise ID "${storeData.franchiseId}" not found.`,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const { error: loginError } = await signIn(constructedEmail, storeData.password);
      if (loginError) {
        if (isNetworkError(loginError)) {
          showNetworkErrorToast();
        } else {
          toast({ title: "Wrong Password", description: "Incorrect password for this store.", variant: "destructive" });
        }
      }
    } catch (err: any) {
      console.error(err);
      if (isNetworkError(err)) {
        showNetworkErrorToast();
      } else {
        toast({ title: "Error", description: "An unexpected error occurred. Please try again.", variant: "destructive" });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // 1. Normalize Franchise ID (e.g. 0003 -> FR-0003)
    const rawId = adminData.franchiseId.toLowerCase().trim();
    const normalizedId = rawId.startsWith('fr-') ? rawId : `fr-${rawId}`;
    const dbFranchiseId = normalizedId.toUpperCase();

    // 2. Extract Prefix and Build Auth Email
    const typedEmail = adminData.emailInput.toLowerCase().trim();
    const prefix = typedEmail.split('@')[0];
    const authEmail = `${prefix}+${normalizedId}@gmail.com`;

    console.log("[DEBUG] Admin Logic Trace:", {
      searchDbFor: typedEmail,
      authWith: authEmail,
      franchiseId: dbFranchiseId
    });

    try {
      // STEP A: Verify Admin exists for this franchise in DB (Plain Email)
      const { data: adminProfile, error: dbError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', typedEmail)
        .eq('franchise_id', dbFranchiseId)
        .maybeSingle();

      if (dbError) {
        console.error("[DEBUG] DB Check Error:", dbError);
        if (isNetworkError(dbError)) {
          showNetworkErrorToast();
          setLoading(false);
          return;
        }
      }

      if (!adminProfile) {
        toast({
          title: "Wrong ID or Email",
          description: "This email is not assigned to this Franchise ID.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // STEP B: Auth with the Plus email
      const { error: loginError } = await signIn(authEmail, adminData.password);

      if (loginError) {
        if (isNetworkError(loginError)) {
          showNetworkErrorToast();
        } else {
          toast({
            title: "Wrong Password",
            description: "Incorrect password for this Admin account.",
            variant: "destructive"
          });
        }
      }
    } catch (err: any) {
      console.error("[DEBUG] Fatal Admin Error:", err);
      if (isNetworkError(err)) {
        showNetworkErrorToast();
      } else {
        toast({ title: "Error", description: "An unexpected error occurred. Please try again.", variant: "destructive" });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-4">
      <Card className="w-full max-w-md shadow-md border border-gray-200">
        <CardHeader className="text-center flex flex-col items-center gap-2">
          <img src={logo} alt="Logo" width={140} height={140} />
          <CardTitle className="text-2xl font-bold" style={{ color: 'rgb(0, 100, 55)' }}>
            T VANAMM BILLING
          </CardTitle>
          <CardDescription>Secure Access Portal</CardDescription>
        </CardHeader>

        {/* Connection error alert */}
        {connectionError && (
          <div className="mx-6 mb-2 p-3 rounded-lg bg-red-50 border border-red-200 flex items-center gap-2 text-sm text-red-700">
            <AlertTriangle size={16} className="flex-shrink-0" />
            <span>Server unreachable. Please check your internet connection.</span>
          </div>
        )}

        <CardContent>
          <Tabs defaultValue="store" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-gray-100 mb-6 p-1 rounded-lg">
              <TabsTrigger value="store" className="data-[state=active]:bg-[rgb(0,100,55)] data-[state=active]:text-white transition-all">Store</TabsTrigger>
              <TabsTrigger value="admin" className="data-[state=active]:bg-[rgb(0,100,55)] data-[state=active]:text-white transition-all">Admin</TabsTrigger>
            </TabsList>

            {/* Store Tab Content */}
            <TabsContent value="store">
              <form onSubmit={handleStoreLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label>Franchise ID</Label>
                  <Input
                    placeholder="e.g. 0003"
                    value={storeData.franchiseId}
                    onChange={(e) => setStoreData({ ...storeData, franchiseId: e.target.value })}
                    required
                    className="focus-visible:ring-[rgb(0,100,55)]"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Password</Label>
                  <div className="relative">
                    <Input
                      type={showStorePassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={storeData.password}
                      onChange={(e) => setStoreData({ ...storeData, password: e.target.value })}
                      required
                      className="focus-visible:ring-[rgb(0,100,55)] pr-10"
                    />
                    <button type="button" className="absolute right-3 top-2.5 text-gray-400" onClick={() => setShowStorePassword(!showStorePassword)}>
                      {showStorePassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <Button className="w-full bg-[rgb(0,100,55)] hover:bg-[rgb(0,80,45)] transition-colors" disabled={loading}>
                  {loading ? 'Logging in...' : 'Sign In to Store'}
                </Button>
              </form>
            </TabsContent>

            {/* Admin Tab Content */}
            <TabsContent value="admin">
              <form onSubmit={handleAdminLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label>Franchise ID</Label>
                  <Input
                    placeholder="e.g. 0003"
                    value={adminData.franchiseId}
                    onChange={(e) => setAdminData({ ...adminData, franchiseId: e.target.value })}
                    required
                    className="focus-visible:ring-[rgb(0,100,55)]"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Admin Email</Label>
                  <Input
                    type="email"
                    placeholder="Enter your email here"
                    value={adminData.emailInput}
                    onChange={(e) => setAdminData({ ...adminData, emailInput: e.target.value })}
                    required
                    className="focus-visible:ring-[rgb(0,100,55)]"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Password</Label>
                  <div className="relative">
                    <Input
                      type={showAdminPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={adminData.password}
                      onChange={(e) => setAdminData({ ...adminData, password: e.target.value })}
                      required
                      className="focus-visible:ring-[rgb(0,100,55)] pr-10"
                    />
                    <button type="button" className="absolute right-3 top-2.5 text-gray-400" onClick={() => setShowAdminPassword(!showAdminPassword)}>
                      {showAdminPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <Button className="w-full bg-[rgb(0,100,55)] hover:bg-[rgb(0,80,45)]" disabled={loading}>
                  {loading ? 'Logging in...' : 'Sign In as Admin'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}