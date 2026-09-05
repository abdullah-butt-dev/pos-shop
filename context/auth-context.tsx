"use client"

import React, { createContext, useContext, useEffect, useState } from "react"
import { User, Session } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"
import { useRouter, usePathname } from "next/navigation"

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
        if (session?.user) {
          setSession(session)
          setUser(session.user)
        } else {
          setSession(null)
          setUser(null)
        }
      } catch (error) {
        console.error("Error getting initial session:", error)
        setSession(null)
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    getInitialSession()

    // Safety timeout: stop loading spinner after 2s in case of network latency
    const timer = setTimeout(() => {
      setLoading(false)
    }, 2000)

    // 2. Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          setSession(session)
          setUser(session.user)
        } else {
          setSession(null)
          setUser(null)
        }
        setLoading(false)
      }
    )

    return () => {
      clearTimeout(timer)
      subscription.unsubscribe()
    }
  }, [])

  // Auto redirection guard
  useEffect(() => {
    if (loading) return

    if (!user && pathname !== "/login") {
      router.replace("/login")
    } else if (user && pathname === "/login") {
      router.replace("/")
    }
  }, [user, loading, pathname, router])

  const signOut = async () => {
    setLoading(true)
    try {
      await supabase.auth.signOut()
      setUser(null)
      setSession(null)
      router.replace("/login")
    } catch (error) {
      console.error("Error signing out:", error)
      router.replace("/login")
    } finally {
      setLoading(false)
    }
  }

  const updateProfileName = async (name: string) => {
    if (!user) return

    const { data, error } = await supabase.auth.updateUser({
      data: { full_name: name }
    })
    if (error) throw error
    if (data && data.user) {
      setUser(data.user)
    }
  }

  // Show loading spinner while determining auth state or redirecting unauthenticated users
  if (loading || (!user && pathname !== "/login")) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[var(--pos-panel-2)] text-foreground gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--pos-brand)]"></div>
        <p className="text-xs text-muted-foreground">Checking authentication...</p>
      </div>
    )
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut, updateProfileName }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
