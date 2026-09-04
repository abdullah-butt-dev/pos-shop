"use client"

import React, { createContext, useContext, useEffect, useState } from "react"
import { User, Session } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"
import { useRouter, usePathname } from "next/navigation"

// This app is single-user (see business rules: one authenticated application
// user only, no roles, no signup). The mock user below is only a local
// fallback so the app remains usable before real Supabase credentials/user
// are configured — it is not a role or multi-account system.
const mockUser: User = {
  id: "00000000-0000-0000-0000-000000000000",
  email: "owner@perfecttraders.com",
  app_metadata: {},
  user_metadata: {
    full_name: "Owner",
  },
  aud: "authenticated",
  created_at: new Date().toISOString()
}

const getPersistedMockUser = (): User => {
  if (typeof window === 'undefined') return mockUser
  try {
    const savedName = localStorage.getItem('pt_owner_name')
    if (savedName) {
      // Strip legacy bracket role suffix
      const cleanName = savedName.replace(/\s*\([^)]+\)\s*$/, '').trim()
      // Persist the cleaned name back to remove old format
      if (cleanName !== savedName) {
        localStorage.setItem('pt_owner_name', cleanName)
      }
      return {
        ...mockUser,
        user_metadata: {
          ...mockUser.user_metadata,
          full_name: cleanName
        }
      }
    }
  } catch (e) {
    console.warn(e)
  }
  return mockUser
}

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signOut: () => Promise<void>
  updateProfileName: (name: string) => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
  updateProfileName: async () => {},
})

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // 1. Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          setSession(session)
          setUser(session.user)
        } else {
          setUser(getPersistedMockUser())
          setSession({
            access_token: "mock-token",
            token_type: "bearer",
            expires_in: 3600,
            refresh_token: "mock-refresh",
            user: getPersistedMockUser(),
          })
        }
      } catch (error) {
        console.error("Error getting initial session:", error)
        setUser(getPersistedMockUser())
      } finally {
        setLoading(false)
      }
    }

    getInitialSession()

    // Safety timeout: stop loading spinner after 1.5s in case of slow/blocked network
    const timer = setTimeout(() => {
      setLoading(false)
    }, 1500)

    // 2. Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session) {
          setSession(session)
          setUser(session.user)
        } else {
          setUser(getPersistedMockUser())
          setSession({
            access_token: "mock-token",
            token_type: "bearer",
            expires_in: 3600,
            refresh_token: "mock-refresh",
            user: getPersistedMockUser(),
          })
        }
        setLoading(false)
      }
    )

    return () => {
      clearTimeout(timer)
      subscription.unsubscribe()
    }
  }, [])

  // Auto redirection for the /login route if logged in
  useEffect(() => {
    if (loading) return

    if (user && pathname === "/login") {
      router.push("/")
    }
  }, [user, loading, pathname, router])

  const signOut = async () => {
    setLoading(true)
    try {
      await supabase.auth.signOut()
      router.push("/")
    } catch (error) {
      console.error("Error signing out:", error)
    } finally {
      setLoading(false)
    }
  }

  const updateProfileName = async (name: string) => {
    if (session && session.user && session.user.id !== "00000000-0000-0000-0000-000000000000") {
      const { data, error } = await supabase.auth.updateUser({
        data: { full_name: name }
      })
      if (error) throw error
      if (data && data.user) {
        setUser(data.user)
      }
    } else {
      localStorage.setItem('pt_owner_name', name)
      setUser(prev => {
        const baseUser = prev || getPersistedMockUser()
        return {
          ...baseUser,
          user_metadata: {
            ...baseUser.user_metadata,
            full_name: name
          }
        }
      })
    }
  }

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[var(--pos-panel-2)]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--pos-brand)]"></div>
      </div>
    )
  }

  return (
    <AuthContext.Provider value={{ user: user || getPersistedMockUser(), session, loading, signOut, updateProfileName }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
