const fs = require('fs');
let content = fs.readFileSync('app/login/page.tsx', 'utf8');

const importReplacement = `import { useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  KeyRound,
  Mail,
  Sparkles,
  Loader2,
  LogIn,
  Eye,
  EyeOff,
  RefreshCcw,
} from "lucide-react";`;
content = content.replace(/import \{ useState \} from "react";[\s\S]*?from "lucide-react";/, importReplacement);

const componentStart = `export default function LoginPage() {
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [username, setUsername] = useState("");`;
content = content.replace(/export default function LoginPage\(\) {\n  const \[username, setUsername\] = useState\(""\);/, componentStart);

const handleAuthReplacement = `  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const trimmedUser = username.trim();
    if (!trimmedUser || !password || (isChangingPassword && !newPassword)) {
      setError("Please fill in all required fields.");
      setLoading(false);
      return;
    }

    const email = trimmedUser.includes("@")
      ? trimmedUser.toLowerCase()
      : \`\${trimmedUser.toLowerCase()}@pos.com\`;

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) throw signInError;

      if (isChangingPassword) {
        const { error: updateError } = await supabase.auth.updateUser({
          password: newPassword,
        });

        if (updateError) {
          throw updateError;
        }
      }

      router.replace("/");
    } catch (err: any) {
      console.error("Authentication error:", err);
      setError(err?.message || "Invalid username or password.");
    } finally {
      setLoading(false);
    }
  };`;
content = content.replace(/  const handleAuth = async \(e: React.FormEvent\) => \{[\s\S]*?  \};/, handleAuthReplacement);

const newPasswordInput = `          <div className="space-y-2">
            <label
              htmlFor="login-password"
              className="text-xs font-semibold text-muted-foreground tracking-wider uppercase block cursor-pointer"
            >
              {isChangingPassword ? "Old Password" : "Password"}
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-muted-foreground/60">
                <KeyRound className="h-5 w-5" />
              </span>
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-foreground/5 border border-foreground/10 rounded-xl pl-10 pr-12 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-[var(--pos-brand)] transition-all"
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground/60 hover:text-foreground transition-colors cursor-pointer"
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {isChangingPassword && (
            <div className="space-y-2">
              <label
                htmlFor="new-password"
                className="text-xs font-semibold text-muted-foreground tracking-wider uppercase block cursor-pointer"
              >
                New Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-muted-foreground/60">
                  <KeyRound className="h-5 w-5" />
                </span>
                <input
                  id="new-password"
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-foreground/5 border border-foreground/10 rounded-xl pl-10 pr-12 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-[var(--pos-brand)] transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>
          )}`;
content = content.replace(/          <div className="space-y-2">\s*<label\s*htmlFor="login-password"[\s\S]*?<\/div>\s*<\/div>/, newPasswordInput);

const buttonReplacement = `          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 flex items-center justify-center gap-2 bg-[var(--pos-brand)] hover:opacity-90 text-black font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-[var(--pos-brand)]/10 disabled:opacity-50 disabled:cursor-not-allowed mt-8 cursor-pointer"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                {isChangingPassword ? <RefreshCcw className="h-5 w-5" /> : <LogIn className="h-5 w-5" />} 
                {isChangingPassword ? "Change Password & Login" : "Access POS"}
              </>
            )}
          </button>
          
          <div className="text-center mt-4">
            <button
              type="button"
              onClick={() => setIsChangingPassword(!isChangingPassword)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {isChangingPassword ? "Back to Login" : "Change Password"}
            </button>
          </div>`;
content = content.replace(/          <button\s*type="submit"[\s\S]*?<\/button>/, buttonReplacement);

fs.writeFileSync('app/login/page.tsx', content);
