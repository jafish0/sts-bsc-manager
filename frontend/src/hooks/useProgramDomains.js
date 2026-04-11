import { useState, useEffect } from 'react'
import { supabase } from '../utils/supabase'
import { DOMAIN_OPTIONS } from '../utils/constants'

// Cache domains per program type to avoid repeated DB fetches
const domainCache = {}

/**
 * Hook to fetch program domains from the database.
 * Returns domain options in the same format as the old DOMAIN_OPTIONS constant:
 *   [{ value: 'resilience', label: 'Domain 1 — Promotion of Resilience...' }]
 *
 * Falls back to hardcoded STS-BSC DOMAIN_OPTIONS if programType is null or fetch fails.
 */
export function useProgramDomains(programType) {
  const [domains, setDomains] = useState(() => {
    if (domainCache[programType]) return domainCache[programType]
    if (!programType || programType === 'sts_bsc') return DOMAIN_OPTIONS
    return []
  })
  const [loading, setLoading] = useState(!domainCache[programType])

  useEffect(() => {
    if (!programType) {
      setDomains(DOMAIN_OPTIONS)
      setLoading(false)
      return
    }

    if (domainCache[programType]) {
      setDomains(domainCache[programType])
      setLoading(false)
      return
    }

    const fetchDomains = async () => {
      try {
        const { data, error } = await supabase
          .from('program_domains')
          .select('domain_key, domain_label, sort_order')
          .eq('program_type', programType)
          .order('sort_order', { ascending: true })

        if (error) throw error

        const formatted = (data || []).map((d, i) => ({
          value: d.domain_key,
          label: `Domain ${i + 1} — ${d.domain_label}`,
        }))

        domainCache[programType] = formatted
        setDomains(formatted)
      } catch (err) {
        console.error('Error fetching program domains:', err)
        // Fallback to STS-BSC domains
        setDomains(DOMAIN_OPTIONS)
      } finally {
        setLoading(false)
      }
    }

    fetchDomains()
  }, [programType])

  // Also build a labels map: { domain_key: 'Label' }
  const domainLabels = {}
  domains.forEach(d => {
    // Strip "Domain N — " prefix for the labels map
    const label = d.label.replace(/^Domain \d+ — /, '')
    domainLabels[d.value] = label
  })

  return { domains, domainLabels, loading }
}
