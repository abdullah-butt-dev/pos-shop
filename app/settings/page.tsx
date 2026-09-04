"use client"

import { useState, useEffect } from "react"
import { NavHeader } from "@/components/pos/nav-header"
import { Moon, Sun, User, Shield, Receipt, Check, Save, Loader2, Lock, LogOut, Eye, EyeOff } from "lucide-react"
import { PosSettingsService, type PosBusinessSettingsRow } from "@/lib/pos-service"
import { useAuth } from "@/context/auth-context"
import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"

type TabType = "business" | "account"

type BusinessForm = {
  shop_name: string
  currency: string
  address: string
  phone: string
  invoice_prefix: string
  default_low_stock_threshold: string
  tax_rate: string
}

const emptyBusinessForm: BusinessForm = {
  shop_name: "",
  currency: "PKR",
  address: "",
  phone: "",
  invoice_prefix: "PT",
  default_low_stock_threshold: "5",
  tax_rate: "0",
}

function toForm(row: PosBusinessSettingsRow): BusinessForm {
  return {
    shop_name: row.shop_name || "",
    currency: row.currency || "PKR",
    address: row.address || "",
    phone: row.phone || "",
    invoice_prefix: row.invoice_prefix || "PT",
    default_low_stock_threshold: String(row.default_low_stock_threshold ?? 5),
    tax_rate: String(row.tax_rate ?? 0),
  }
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabType>("business")
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const { user, signOut, updateProfileName } = useAuth()
  const [fullName, setFullName] = useState(user?.user_metadata?.full_name || "")
  const [updatingProfile, setUpdatingProfile] = useState(false)

  const [businessForm, setBusinessForm] = useState<BusinessForm>(emptyBusinessForm)
  const [businessLoading, setBusinessLoading] = useState(true)
  const [businessSaving, setBusinessSaving] = useState(false)

  // Change password state
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [changingPassword, setChangingPassword] = useState(false)
  const [showCurrentPw, setShowCurrentPw] = useState(false)
  const [showNewPw, setShowNewPw] = useState(false)

  useEffect(() => {
    if (user?.user_metadata?.full_name) {
      setFullName(user.user_metadata.full_name)
    }
  }, [user])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    let cancelled = false
    PosSettingsService.get().then((row) => {
      if (cancelled) return
      if (row) setBusinessForm(toForm(row))
      setBusinessLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const currentTheme = mounted ? theme : "dark"

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setUpdatingProfile(true)
    try {
      await updateProfileName(fullName)
      toast.success("Profile updated")
    } catch (err) {
      toast.error("Failed to update profile")
      console.error(err)
    } finally {
      setUpdatingProfile(false)
    }
  }

  const handleSaveBusiness = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!businessForm.shop_name.trim()) {
      toast.error("Business name is required")
      return
    }

    const threshold = Number(businessForm.default_low_stock_threshold)
    const taxRate = Number(businessForm.tax_rate)

    if (!Number.isFinite(threshold) || threshold < 0) {
      toast.error("Default low stock threshold must be zero or greater")
      return
    }

    if (!Number.isFinite(taxRate) || taxRate < 0) {
      toast.error("Tax rate must be zero or greater")
      return
    }

    setBusinessSaving(true)
    try {
      const updated = await PosSettingsService.update({
        shop_name: businessForm.shop_name.trim(),
        currency: businessForm.currency.trim() || "PKR",
        address: businessForm.address.trim(),
        phone: businessForm.phone.trim(),
        invoice_prefix: businessForm.invoice_prefix.trim() || "PT",
        default_low_stock_threshold: threshold,
        tax_rate: taxRate,
      })
      if (updated) setBusinessForm(toForm(updated))
      toast.success("Business settings saved")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save business details")
    } finally {
      setBusinessSaving(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!currentPassword) {
      toast.error("Enter your current password")
      return
    }

    if (newPassword.length < 6) {
      toast.error("New password must be at least 6 characters")
      return
    }

    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match")
      return
    }

    setChangingPassword(true)
    try {
      // Verify current password by re-authenticating
      const email = user?.email
      if (!email || user?.id === "00000000-0000-0000-0000-000000000000") {
        toast.error("Password change requires a real Supabase account")
        return
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      })

      if (signInError) {
        toast.error("Current password is incorrect")
        return
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (updateError) {
        toast.error(updateError.message)
        return
      }

      toast.success("Password changed successfully")
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (err) {
      toast.error("Failed to change password")
      console.error(err)
    } finally {
      setChangingPassword(false)
    }
  }

  const isRealUser = user?.id !== "00000000-0000-0000-0000-000000000000"

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
                  : "pos-panel text-muted-foreground hover:text-foreground"
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
                  : "pos-panel text-muted-foreground hover:text-foreground"
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
                      <label htmlFor="business-name" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Business Name</label>
                      <input
                        id="business-name"
                        value={businessForm.shop_name}
                        onChange={(e) => setBusinessForm((f) => ({ ...f, shop_name: e.target.value }))}
                        required
                        className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-[var(--pos-brand)]"
                        placeholder="Perfect Traders"
                      />
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="phone-number" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Phone</label>
                      <input
                        id="phone-number"
                        value={businessForm.phone}
                        onChange={(e) => setBusinessForm((f) => ({ ...f, phone: e.target.value }))}
                        className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-[var(--pos-brand)]"
                        placeholder="03134640267"
                      />
                    </div>

                    <div className="space-y-2 sm:col-span-2">
                      <label htmlFor="store-address" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Address</label>
                      <textarea
                        id="store-address"
                        value={businessForm.address}
                        onChange={(e) => setBusinessForm((f) => ({ ...f, address: e.target.value }))}
                        className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-[var(--pos-brand)]"
                        rows={2}
                        placeholder="Suraj Miani Road, Multan"
                      />
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="currency" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Currency</label>
                      <input
                        id="currency"
                        value={businessForm.currency}
                        onChange={(e) => setBusinessForm((f) => ({ ...f, currency: e.target.value }))}
                        className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-[var(--pos-brand)]"
                        placeholder="PKR"
                      />
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="invoice-prefix" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Receipt Prefix</label>
                      <input
                        id="invoice-prefix"
                        value={businessForm.invoice_prefix}
                        onChange={(e) => setBusinessForm((f) => ({ ...f, invoice_prefix: e.target.value }))}
                        className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-[var(--pos-brand)]"
                        placeholder="PT"
                      />
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="tax-rate" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tax Rate (%)</label>
                      <input
                        id="tax-rate"
                        type="number"
                        min={0}
                        step={0.01}
                        value={businessForm.tax_rate}
                        onChange={(e) => setBusinessForm((f) => ({ ...f, tax_rate: e.target.value }))}
                        className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--pos-brand)]"
                      />
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="default-threshold" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Low Stock Alert</label>
                      <input
                        id="default-threshold"
                        type="number"
                        min={0}
                        step={1}
                        value={businessForm.default_low_stock_threshold}
                        onChange={(e) => setBusinessForm((f) => ({ ...f, default_low_stock_threshold: e.target.value }))}
                        className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--pos-brand)]"
                      />
                      <p className="text-[11px] text-muted-foreground">Default alert threshold for new products.</p>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={businessSaving}
                      className="flex items-center gap-2 bg-[var(--pos-brand)] hover:opacity-90 text-black px-5 py-2.5 rounded-xl font-semibold transition disabled:opacity-60 min-h-[44px]"
                    >
                      {businessSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
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
                      {currentTheme === "dark" ? <Moon className="w-5 h-5 text-[var(--pos-brand)]" /> : <Sun className="w-5 h-5 text-amber-500" />}
                    </div>
                    <div>
                      <span className="font-semibold block">Theme</span>
                      <span className="text-xs text-muted-foreground">Dark or light mode</span>
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
                          : "text-muted-foreground hover:text-foreground"
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
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Moon className="w-3.5 h-3.5" />
                      Dark
                    </button>
                  </div>
                </div>
              </div>

              {/* Profile */}
              <div className="pos-panel rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-[var(--pos-brand)] to-[var(--pos-accent-blue)] flex items-center justify-center font-bold text-black text-sm shrink-0">
                    {fullName ? fullName[0].toUpperCase() : "O"}
                  </div>
                  <div>
                    <p className="font-semibold">{fullName || user?.email || "Owner"}</p>
                    <p className="text-xs text-muted-foreground">{user?.email}</p>
                  </div>
                </div>

                <form onSubmit={handleUpdateProfile} className="space-y-3">
                  <div className="space-y-2">
                    <label htmlFor="full-name" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Display Name</label>
                    <input
                      id="full-name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--pos-brand)]"
                      placeholder="Owner"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={updatingProfile}
                    className="flex items-center gap-2 bg-[var(--pos-brand)] hover:opacity-90 text-black px-4 py-2.5 rounded-xl font-semibold text-sm transition disabled:opacity-50 min-h-[44px]"
                  >
                    {updatingProfile ? "Saving..." : "Update Name"}
                  </button>
                </form>
              </div>

              {/* Change Password */}
              {isRealUser && (
                <div className="pos-panel rounded-xl p-5 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-amber-500/10">
                      <Lock className="w-5 h-5 text-amber-500" />
                    </div>
                    <div>
                      <span className="font-semibold block">Change Password</span>
                      <span className="text-xs text-muted-foreground">Update your login password</span>
                    </div>
                  </div>

                  <form onSubmit={handleChangePassword} className="space-y-3 max-w-md">
                    <div className="space-y-2">
                      <label htmlFor="current-pw" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Current Password</label>
                      <div className="relative">
                        <input
                          id="current-pw"
                          type={showCurrentPw ? "text" : "password"}
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-4 py-2.5 pr-10 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--pos-brand)]"
                          required
                        />
                        <button type="button" onClick={() => setShowCurrentPw(!showCurrentPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                          {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="new-pw" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">New Password</label>
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
                        <button type="button" onClick={() => setShowNewPw(!showNewPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                          {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="confirm-pw" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Confirm New Password</label>
                      <input
                        id="confirm-pw"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--pos-brand)]"
                        required
                        minLength={6}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={changingPassword}
                      className="flex items-center gap-2 bg-amber-500 hover:opacity-90 text-black px-4 py-2.5 rounded-xl font-semibold text-sm transition disabled:opacity-50 min-h-[44px]"
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
                      <span className="text-xs text-muted-foreground">End your current session</span>
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
  )
}
