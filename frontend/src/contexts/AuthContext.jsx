import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../utils/supabase'

const AuthContext = createContext({})

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  // Collaborative IDs the current user is assigned to via collaborative_trainers.
  // Empty array for anyone who isn't a trainer; super_admins also get an empty
  // array here (their access is gated by isSuperAdmin, not this list).
  const [myAdminCollaborativeIds, setMyAdminCollaborativeIds] = useState([])

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        loadProfile(session.user.id)
        loadAdminCollabs(session.user.id)
      } else {
        setLoading(false)
      }
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        loadProfile(session.user.id)
        loadAdminCollabs(session.user.id)
      } else {
        setProfile(null)
        setMyAdminCollaborativeIds([])
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const loadProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) throw error
      // Mark invite as accepted on first login
      if (data && !data.invite_accepted_at) {
        const now = new Date().toISOString()
        await supabase.from('user_profiles').update({ invite_accepted_at: now }).eq('id', userId)
        data.invite_accepted_at = now
      }
      setProfile(data)
    } catch (error) {
      console.error('Error loading profile:', error)
      setProfile(null)
    } finally {
      setLoading(false)
    }
  }

  const loadAdminCollabs = async (userId) => {
    const { data, error } = await supabase
      .from('collaborative_trainers')
      .select('collaborative_id')
      .eq('user_id', userId)
    if (error) {
      // Non-fatal — page-level guards still work via isSuperAdmin.
      console.warn('Could not load admin collaboratives:', error.message)
      setMyAdminCollaborativeIds([])
      return
    }
    setMyAdminCollaborativeIds((data || []).map(r => r.collaborative_id))
  }

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    return { data, error }
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (!error) {
      setUser(null)
      setProfile(null)
    }
    return { error }
  }

  const isSuperAdmin = profile?.role === 'super_admin'
  const isTrainerAdmin = profile?.role === 'trainer_admin'

  // True if the user can administer (read/write) the given collaborative.
  // Super admins can administer everything; trainer admins only the
  // collaboratives they're explicitly assigned to.
  const canAdminCollaborative = (collabId) => {
    if (!collabId) return false
    if (isSuperAdmin) return true
    if (!isTrainerAdmin) return false
    return myAdminCollaborativeIds.includes(collabId)
  }

  const value = {
    user,
    profile,
    loading,
    signIn,
    signOut,
    isSuperAdmin,
    isTrainerAdmin,
    // True for both super_admin and trainer_admin — useful for "is this user an
    // admin user at all?" checks (e.g. routing decisions, AdminDashboard access).
    isAdminLevel: isSuperAdmin || isTrainerAdmin,
    isAgencyAdmin: profile?.role === 'agency_admin' || profile?.role === 'team_leader',
    isTeamMember: profile?.role === 'team_member',
    myAdminCollaborativeIds,
    canAdminCollaborative,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}