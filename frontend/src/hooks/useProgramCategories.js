import { useState, useEffect } from 'react'
import { supabase } from '../utils/supabase'

const categoryCache = {}

/**
 * Hook to fetch resource categories for a program type.
 * Returns categories in { value, label } format (same shape as domain options).
 * Programs without categories return an empty array.
 */
export function useProgramCategories(programType) {
  const [categories, setCategories] = useState(() => {
    return categoryCache[programType] || []
  })
  const [loading, setLoading] = useState(!categoryCache[programType])

  useEffect(() => {
    if (!programType) {
      setCategories([])
      setLoading(false)
      return
    }

    if (categoryCache[programType]) {
      setCategories(categoryCache[programType])
      setLoading(false)
      return
    }

    const fetchCategories = async () => {
      try {
        const { data, error } = await supabase
          .from('resource_categories')
          .select('id, category_key, category_label, sort_order')
          .eq('program_type', programType)
          .order('sort_order', { ascending: true })

        if (error) throw error

        const formatted = (data || []).map(c => ({
          value: c.category_key,
          label: c.category_label,
          id: c.id,
        }))

        categoryCache[programType] = formatted
        setCategories(formatted)
      } catch (err) {
        console.error('Error fetching resource categories:', err)
        setCategories([])
      } finally {
        setLoading(false)
      }
    }

    fetchCategories()
  }, [programType])

  return { categories, loading }
}
