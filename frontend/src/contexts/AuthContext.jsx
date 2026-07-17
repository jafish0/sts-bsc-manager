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

  // "View as" preview (super_admin only). When set, the exposed profile + role
  // booleans are overridden so participant-facing pages render the simulated
  // experience. This is a FRONT-END preview only — data fetches still run under
  // the real super_admin session (NOT an RLS sandbox). Persisted in
  // sessionStorage so a page refresh mid-preview doesn't drop it.
  // Shape: { role, collaborativeId, teamId, programType, teamName, collaborativeName }
  const [viewAs, setViewAsState] = useState(() => {
    try {
      const raw = sessionStorage.getItem('bsc_view_as')
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })

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

  const clearViewAs = () => {
    try { sessionStorage.removeItem('bsc_view_as') } catch { /* ignore */ }
    setViewAsState(null)
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (!error) {
      setUser(null)
      setProfile(null)
      clearViewAs()
    }
    return { error }
  }

  // The user's TRUE role, independent of any active preview.
  const isRealSuperAdmin = profile?.role === 'super_admin'
  // A preview is only active for a genuine super_admin with a viewAs config.
  const previewing = isRealSuperAdmin && !!viewAs

  // Enter/exit preview. Only real super_admins may set it; passing null exits.
  const setViewAs = (config) => {
    if (!isRealSuperAdmin) return
    if (config) {
      try { sessionStorage.setItem('bsc_view_as', JSON.stringify(config)) } catch { /* ignore */ }
      setViewAsState(config)
    } else {
      clearViewAs()
    }
  }

  // Profile exposed to consumers: overridden while previewing so participant
  // pages (TeamDashboard, Resources, ForumThreadList, …) read the simulated
  // role / team / collaborative. realProfile always holds the true profile.
  const effectiveProfile = previewing
    ? {
        ...profile,
        role: viewAs.role,
        team_id: viewAs.teamId ?? null,
        collaborative_id: viewAs.collaborativeId ?? profile?.collaborative_id ?? null,
      }
    : profile

  const effectiveRole = effectiveProfile?.role
  const isSuperAdmin = effectiveRole === 'super_admin'
  const isTrainerAdmin = effectiveRole === 'trainer_admin'

  // Collaboratives the effective role can administer. Previewing as a
  // trainer_admin scopes to the single chosen collaborative so the scoped
  // trainer experience renders correctly; any other preview role has none;
  // otherwise it's the real trainer's assignments.
  const effectiveAdminCollaborativeIds = previewing
    ? (viewAs.role === 'trainer_admin' && viewAs.collaborativeId ? [viewAs.collaborativeId] : [])
    : myAdminCollaborativeIds

  // True if the user can administer (read/write) the given collaborative.
  // Super admins can administer everything; trainer admins only the
  // collaboratives they're explicitly assigned to (or, while previewing as a
  // trainer_admin, the single chosen collaborative).
  const canAdminCollaborative = (collabId) => {
    if (!collabId) return false
    if (isSuperAdmin) return true
    if (!isTrainerAdmin) return false
    return effectiveAdminCollaborativeIds.includes(collabId)
  }

  const value = {
    user,
    profile: effectiveProfile,
    realProfile: profile,
    loading,
    signIn,
    signOut,
    isSuperAdmin,
    isTrainerAdmin,
    // True for both super_admin and trainer_admin — useful for "is this user an
    // admin user at all?" checks (e.g. routing decisions, AdminDashboard access).
    isAdminLevel: isSuperAdmin || isTrainerAdmin,
    isAgencyAdmin: effectiveRole === 'agency_admin' || effectiveRole === 'team_leader',
    isTeamMember: effectiveRole === 'team_member',
    myAdminCollaborativeIds: effectiveAdminCollaborativeIds,
    canAdminCollaborative,
    // "View as" preview state + controls.
    isRealSuperAdmin,
    viewAs,
    setViewAs,
    previewing,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}