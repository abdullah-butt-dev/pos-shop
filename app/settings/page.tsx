"use client";

import { useState, useEffect } from "react";
import { NavHeader } from "@/components/pos/nav-header";
import {
  Moon,
  Sun,
  User,
  Shield,
  Receipt,
  Check,
  Save,
  Loader2,
  Lock,
  LogOut,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  PosSettingsService,
  type PosBusinessSettingsRow,
} from "@/lib/pos-service";
import { useAuth } from "@/context/auth-context";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

type TabType = "business" | "account";

type BusinessForm = {
  shop_name: string;
  currency: string;
  address: string;
  phone: string;
  invoice_prefix: string;
  tax_rate: string;
};

const emptyBusinessForm: BusinessForm = {
  shop_name: "",
  currency: "PKR",
  address: "",
  phone: "",
  invoice_prefix: "PT",
  tax_rate: "0",
};

function toForm(row: PosBusinessSettingsRow): BusinessForm {
  return {
    shop_name: row.shop_name || "",
    currency: row.currency || "PKR",
    address: row.address || "",
    phone: row.phone || "",
    invoice_prefix: row.invoice_prefix || "PT",
    tax_rate: String(row.tax_rate ?? 0),
  };
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabType>("business");
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const { user, signOut } = useAuth();

  const [businessForm, setBusinessForm] =
    useState<BusinessForm>(emptyBusinessForm);
  const [businessLoading, setBusinessLoading] = useState(true);
  const [businessSaving, setBusinessSaving] = useState(false);

  // Change password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    PosSettingsService.get().then((row) => {
      if (cancelled) return;
      if (row) setBusinessForm(toForm(row));
      setBusinessLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const currentTheme = mounted ? theme : "dark";

  const handleSaveBusiness = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!businessForm.shop_name.trim()) {
      toast.error("Business name is required");
      return;
    }

    setBusinessSaving(true);
    try {
      const updated = await PosSettingsService.update({
        shop_name: businessForm.shop_name.trim(),
        currency: businessForm.currency.trim() || "PKR",
        address: businessForm.address.trim(),
        phone: businessForm.phone.trim(),
        invoice_prefix: "PT",
        tax_rate: 0,
      });
      if (updated) setBusinessForm(toForm(updated));
      toast.success("Business settings saved");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to save business details",
      );
    } finally {
      setBusinessSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentPassword) {
      toast.error("Enter your current password");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("New password must be at least 6 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    setChangingPassword(true);
    try {
      const email = user?.email;
      if (!email) {
        toast.error("You must be logged in to change your password");
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });

      if (signInError) {
        toast.error("Current password is incorrect");
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        toast.error(updateError.message);
        return;
      }

      toast.success("Password changed successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast.error("Failed to change password");
      console.error(err);
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <main className="h-full w-full flex flex-col overflow-hidden bg-[var(--pos-panel-2)] text-foreground">
      <NavHeader />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-5 space-y-5">
          {/* Tab Selector */}
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab("business")}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition min-h-[44px]",
                activeTab === "business"
                  ? "bg-[var(--pos-brand)] text-[oklch(0.15_0_0)] shadow-md"
                  : "pos-panel text-muted-foreground hover:text-foreground",
              )}
            >
              <Receipt className="w-4 h-4" />
              Shop Information
            </button>

            <button
              onClick={() => setActiveTab("account")}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition min-h-[44px]",
                activeTab === "account"
                  ? "bg-[var(--pos-brand)] text-[oklch(0.15_0_0)] shadow-md"
                  : "pos-panel text-muted-foreground hover:text-foreground",
              )}
            >
              <User className="w-4 h-4" />
              Account
            </button>
          </div>

          {/* Business & Invoice Tab */}
          {activeTab === "business" && (
            <div className="pos-panel rounded-xl p-5 sm:p-6 space-y-6">
              <div>
                <h2 className="text-lg font-semibold">Shop Information</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Details shown on receipts and dashboard.
                </p>
              </div>

              {businessLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading...
                </div>
              ) : (
                <form onSubmit={handleSaveBusiness} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label
                        htmlFor="business-name"
                        className="text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                      >
                        Business Name
                      </label>
                      <input
                        id="business-name"
                        value={businessForm.shop_name}
                        onChange={(e) =>
                          setBusinessForm((f) => ({
                            ...f,
                            shop_name: e.target.value,
                          }))
                        }
                        required
                        className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-[var(--pos-brand)]"
                        placeholder="Perfect Traders"
                      />
                    </div>

                    <div className="space-y-2">
                      <label
                        htmlFor="phone-number"
                        className="text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                      >
                        Phone
                      </label>
                      <input
                        id="phone-number"
                        value={businessForm.phone}
                        onChange={(e) =>
                          setBusinessForm((f) => ({
                            ...f,
                            phone: e.target.value,
                          }))
                        }
                        className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-[var(--pos-brand)]"
                        placeholder="03134640267"
                      />
                    </div>

                    <div className="space-y-2 sm:col-span-2">
                      <label
                        htmlFor="store-address"
                        className="text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                      >
                        Address
                      </label>
                      <textarea
                        id="store-address"
                        value={businessForm.address}
                        onChange={(e) =>
                          setBusinessForm((f) => ({
                            ...f,
                            address: e.target.value,
                          }))
                        }
                        className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-[var(--pos-brand)]"
                        rows={2}
                        placeholder="Suraj Miani Road, Multan"
                      />
                    </div>

                    <div className="space-y-2">
                      <label
                        htmlFor="currency"
                        className="text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                      >
                        Currency
                      </label>
                      <input
                        id="currency"
                        value={businessForm.currency}
                        onChange={(e) =>
                          setBusinessForm((f) => ({
                            ...f,
                            currency: e.target.value,
                          }))
                        }
                        className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-[var(--pos-brand)]"
                        placeholder="PKR"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={businessSaving}
                      className="flex items-center gap-2 bg-[var(--pos-brand)] hover:opacity-90 text-black px-5 py-2.5 rounded-xl font-semibold transition disabled:opacity-60 min-h-[44px]"
                    >
                      {businessSaving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      {businessSaving ? "Saving..." : "Save"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Account Tab */}
          {activeTab === "account" && (
            <div className="space-y-4">
              {/* Theme */}
              <div className="pos-panel rounded-xl p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-[var(--pos-brand)]/10">
                      {currentTheme === "dark" ? (
                        <Moon className="w-5 h-5 text-[var(--pos-brand)]" />
                      ) : (
                        <Sun className="w-5 h-5 text-amber-500" />
                      )}
                    </div>
                    <div>
                      <span className="font-semibold block">Theme</span>
                      <span className="text-xs text-muted-foreground">
                        Dark or light mode
                      </span>
                    </div>
                  </div>

                  <div className="flex p-1 bg-foreground/5 rounded-xl border border-foreground/10 shrink-0">
                    <button
                      type="button"
                      onClick={() => setTheme("light")}
                      className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition min-h-[36px]",
                        currentTheme === "light"
                          ? "bg-white text-black shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <Sun className="w-3.5 h-3.5" />
                      Light
                    </button>
                    <button
                      type="button"
                      onClick={() => setTheme("dark")}
                      className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition min-h-[36px]",
                        currentTheme === "dark"
                          ? "bg-[var(--pos-brand)] text-black shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <Moon className="w-3.5 h-3.5" />
                      Dark
                    </button>
                  </div>
                </div>
              </div>

              {/* Change Password */}
              {user && (
                <div className="pos-panel rounded-xl p-5 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-amber-500/10">
                      <Lock className="w-5 h-5 text-amber-500" />
                    </div>
                    <div>
                      <span className="font-semibold block">
                        Change Password
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Update your login password
                      </span>
                    </div>
                  </div>

                  <form
                    onSubmit={handleChangePassword}
                    className="space-y-3 max-w-md"
                  >
                    <div className="space-y-2">
                      <label
                        htmlFor="current-pw"
                        className="text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                      >
                        Current Password
                      </label>
                      <div className="relative">
                        <input
                          id="current-pw"
                          type={showCurrentPw ? "text" : "password"}
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-4 py-2.5 pr-10 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--pos-brand)]"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrentPw(!showCurrentPw)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                          {showCurrentPw ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label
                        htmlFor="new-pw"
                        className="text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                      >
                        New Password
                      </label>
                      <div className="relative">
                        <input
                          id="new-pw"
                          type={showNewPw ? "text" : "password"}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-4 py-2.5 pr-10 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--pos-brand)]"
                          required
                          minLength={6}
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPw(!showNewPw)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                          {showNewPw ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label
                        htmlFor="confirm-pw"
                        className="text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                      >
                        Confirm New Password
                      </label>
                      <div className="relative">
                        <input
                          id="confirm-pw"
                          type={showConfirmPw ? "text" : "password"}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-4 py-2.5 pr-10 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--pos-brand)]"
                          required
                          minLength={6}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPw(!showConfirmPw)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                          {showConfirmPw ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={changingPassword}
                      className="flex items-center gap-2 bg-amber-500 hover:opacity-90 text-black px-4 py-2.5 rounded-xl font-semibold text-sm transition disabled:opacity-50 min-h-[44px] cursor-pointer"
                    >
                      <Lock className="w-4 h-4" />
                      {changingPassword ? "Changing..." : "Change Password"}
                    </button>
                  </form>
                </div>
              )}

              {/* Sign Out */}
              <div className="pos-panel rounded-xl p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-red-500/10">
                      <LogOut className="w-5 h-5 text-red-500" />
                    </div>
                    <div>
                      <span className="font-semibold block">Sign Out</span>
                      <span className="text-xs text-muted-foreground">
                        End your current session
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={signOut}
                    className="text-sm font-semibold text-red-500 hover:text-red-400 transition px-4 py-2 rounded-lg hover:bg-red-500/5 min-h-[44px]"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
