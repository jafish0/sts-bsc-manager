import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import {
  GENDER_OPTIONS,
  AGE_CONFIG,
  YEARS_SERVICE_CONFIG,
  JOB_ROLES,
  AREAS_OF_RESPONSIBILITY,
  EXPOSURE_LEVEL_CONFIG,
  EXPOSURE_EXPLANATION
} from '../config/demographics'
import '../styles/Demographics.css'

function Demographics() {
  const navigate = useNavigate()
  const [assessmentResponseId, setAssessmentResponseId] = useState(null)
  const [formData, setFormData] = useState({
    gender: '',
    gender_other: '',
    age: '',
    years_in_service: '',
    job_role: '',
    job_role_other: '',
    areas_of_responsibility: [],
    areas_of_responsibility_other: '',
    exposure_level: 50
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showExposureInfo, setShowExposureInfo] = useState(false)

  // On mount, create assessment_response record
  useEffect(() => {
    const initializeAssessment = async () => {
      const teamCodeId = sessionStorage.getItem('teamCodeId')
      
      if (!teamCodeId) {
        alert('No team code found. Please start from the beginning.')
        navigate('/')
        return
      }

      try {
        // First, get the timepoint from team_codes
        const { data: teamCodeData, error: teamCodeError } = await supabase
          .from('team_codes')
          .select('timepoint')
          .eq('id', teamCodeId)
          .single()

        if (teamCodeError) throw teamCodeError

        // Create assessment_response record with timepoint
        const { data, error } = await supabase
          .from('assessment_responses')
          .insert({
            team_code_id: teamCodeId,
            timepoint: teamCodeData.timepoint,
            demographics_complete: false,
            stss_complete: false,
            proqol_complete: false,
            stsioa_complete: false,
            started_at: new Date().toISOString()
          })
          .select()
          .single()

        if (error) throw error
        
        setAssessmentResponseId(data.id)
        sessionStorage.setItem('assessmentResponseId', data.id)
      } catch (err) {
        console.error('Error creating assessment response:', err)
        alert('Error starting assessment. Please try again.')
        navigate('/')
      }
    }

    initializeAssessment()
  }, [navigate])

  // Generate age options
  const ageOptions = []
  for (let i = AGE_CONFIG.min; i <= AGE_CONFIG.max; i++) {
    ageOptions.push(i)
  }
  ageOptions.push(AGE_CONFIG.over65Label)

  // Generate years of service options
  const yearsOptions = []
  for (let i = YEARS_SERVICE_CONFIG.min; i <= YEARS_SERVICE_CONFIG.max; i++) {
    yearsOptions.push(i)
  }
  yearsOptions.push(YEARS_SERVICE_CONFIG.over30Label)

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleCheckboxChange = (area) => {
    setFormData(prev => ({
      ...prev,
      areas_of_responsibility: prev.areas_of_responsibility.includes(area)
        ? prev.areas_of_responsibility.filter(a => a !== area)
        : [...prev.areas_of_responsibility, area]
    }))
  }

  const handleSliderChange = (e) => {
    setFormData(prev => ({
      ...prev,
      exposure_level: parseInt(e.target.value)
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!assessmentResponseId) {
      setError('Assessment not initialized. Please refresh and try again.')
      return
    }

    setLoading(true)
    setError('')

    try {
      // Prepare data for database
      const demographicsData = {
        assessment_response_id: assessmentResponseId,
        gender: formData.gender,
        gender_other: formData.gender === 'not_listed' ? formData.gender_other : null,
        age: formData.age === AGE_CONFIG.over65Label ? 65 : parseInt(formData.age),
        age_over_65: formData.age === AGE_CONFIG.over65Label,
        years_in_service: formData.years_in_service === YEARS_SERVICE_CONFIG.over30Label ? 30 : parseInt(formData.years_in_service),
        years_over_30: formData.years_in_service === YEARS_SERVICE_CONFIG.over30Label,
        job_role: formData.job_role,
        job_role_other: formData.job_role.includes('Other') ? formData.job_role_other : null,
        areas_of_responsibility: formData.areas_of_responsibility,
        areas_of_responsibility_other: formData.areas_of_responsibility.includes('Other (please specify)') ? formData.areas_of_responsibility_other : null,
        exposure_level: formData.exposure_level
      }

      // Insert into database
      const { error: insertError } = await supabase
        .from('demographics')
        .insert(demographicsData)

      if (insertError) throw insertError

      // Update assessment_responses to mark demographics as complete
      const { error: updateError } = await supabase
        .from('assessment_responses')
        .update({ demographics_complete: true })
        .eq('id', assessmentResponseId)

      if (updateError) throw updateError

      // Navigate to next assessment
      navigate('/stss')

    } catch (err) {
      console.error('Error saving demographics:', err)
      setError('An error occurred saving your information. Please try again.')
      setLoading(false)
    }
  }

  if (!assessmentResponseId) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⏳</div>
          <div>Initializing assessment...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="demographics-container">
      <div className="demographics-card">
        <div className="progress-bar">
          <div className="progress-step active">Demographics</div>
          <div className="progress-step">STSS</div>
          <div className="progress-step">ProQOL</div>
          <div className="progress-step">STSI-OA</div>
        </div>

        <h2>Demographic Information</h2>
        <p className="intro-text">
          This information helps us understand the characteristics of staff in your organization. 
          All responses are anonymous and cannot be linked back to you individually.
        </p>

        <form onSubmit={handleSubmit}>
          {/* Gender */}
          <div className="form-group">
            <label htmlFor="gender">Gender *</label>
            <select
              id="gender"
              name="gender"
              value={formData.gender}
              onChange={handleInputChange}
              required
            >
              <option value="">Select...</option>
              {GENDER_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {formData.gender === 'not_listed' && (
              <input
                type="text"
                name="gender_other"
                value={formData.gender_other}
                onChange={handleInputChange}
                placeholder="Please specify"
                className="other-input"
                required
              />
            )}
          </div>

          {/* Age */}
          <div className="form-group">
            <label htmlFor="age">Age *</label>
            <select
              id="age"
              name="age"
              value={formData.age}
              onChange={handleInputChange}
              required
            >
              <option value="">Select...</option>
              {ageOptions.map(age => (
                <option key={age} value={age}>{age}</option>
              ))}
            </select>
          </div>

          {/* Years in Service */}
          <div className="form-group">
            <label htmlFor="years_in_service">Years Working in This Field *</label>
            <select
              id="years_in_service"
              name="years_in_service"
              value={formData.years_in_service}
              onChange={handleInputChange}
              required
            >
              <option value="">Select...</option>
              {yearsOptions.map(years => (
                <option key={years} value={years}>{years}</option>
              ))}
            </select>
          </div>

          {/* Job Role */}
          <div className="form-group">
            <label htmlFor="job_role">Job Role *</label>
            <select
              id="job_role"
              name="job_role"
              value={formData.job_role}
              onChange={handleInputChange}
              required
            >
              <option value="">Select...</option>
              {JOB_ROLES.map(role => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
            {formData.job_role.includes('Other') && (
              <input
                type="text"
                name="job_role_other"
                value={formData.job_role_other}
                onChange={handleInputChange}
                placeholder="Please specify your role"
                className="other-input"
                required
              />
            )}
          </div>

          {/* Areas of Responsibility */}
          <div className="form-group">
            <label>Area(s) of Responsibility * (Select all that apply)</label>
            <div className="checkbox-group">
              {AREAS_OF_RESPONSIBILITY.map(area => (
                <label key={area} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.areas_of_responsibility.includes(area)}
                    onChange={() => handleCheckboxChange(area)}
                  />
                  <span>{area}</span>
                </label>
              ))}
            </div>
            {formData.areas_of_responsibility.includes('Other (please specify)') && (
              <input
                type="text"
                name="areas_of_responsibility_other"
                value={formData.areas_of_responsibility_other}
                onChange={handleInputChange}
                placeholder="Please specify"
                className="other-input"
                required
              />
            )}
          </div>

          {/* Exposure Level */}
          <div className="form-group exposure-section">
            <div className="section-header">
              <label>Level of Trauma Exposure *</label>
              <button
                type="button"
                className="info-toggle"
                onClick={() => setShowExposureInfo(!showExposureInfo)}
              >
                {showExposureInfo ? '▼ Hide Information' : '▶ Understanding Trauma Exposure'}
              </button>
            </div>

            {showExposureInfo && (
              <div className="exposure-explanation">
                <h3>{EXPOSURE_EXPLANATION.title}</h3>
                <p>{EXPOSURE_EXPLANATION.intro}</p>
                
                <div className="exposure-types">
                  <h4>There are four main types of trauma exposure:</h4>
                  {EXPOSURE_EXPLANATION.types.map((type, index) => (
                    <div key={index} className="exposure-type">
                      <strong>{index + 1}. {type.title}</strong> - {type.description}
                      {type.example && <div className="example">Example: {type.example}</div>}
                      {type.examples && (
                        <div className="examples">
                          {type.examples.map((ex, i) => (
                            <div key={i} className="example">Example: {ex}</div>
                          ))}
                        </div>
                      )}
                      {type.note && <div className="note">Note: {type.note}</div>}
                    </div>
                  ))}
                </div>

                <p className="conclusion"><strong>{EXPOSURE_EXPLANATION.conclusion}</strong></p>
              </div>
            )}

            <div className="slider-container">
              <p className="slider-question">
                Based on your current job responsibilities, how would you rate your overall level 
                of exposure to traumatic material through your work?
              </p>
              <p className="slider-subtext">
                Please consider all types of exposure listed above, including hearing trauma stories, 
                reviewing case details, witnessing traumatic situations, or being exposed to graphic 
                materials as part of your professional duties.
              </p>

              <div className="slider-wrapper">
                <input
                  type="range"
                  min={EXPOSURE_LEVEL_CONFIG.min}
                  max={EXPOSURE_LEVEL_CONFIG.max}
                  value={formData.exposure_level}
                  onChange={handleSliderChange}
                  className="exposure-slider"
                />
                <div className="slider-value">{formData.exposure_level}</div>
              </div>

              <div className="slider-labels">
                <span>{EXPOSURE_LEVEL_CONFIG.labels.low}</span>
                <span>{EXPOSURE_LEVEL_CONFIG.labels.mid}</span>
                <span>{EXPOSURE_LEVEL_CONFIG.labels.high}</span>
              </div>
            </div>
          </div>

          {error && (
            <div className="error-message">{error}</div>
          )}

          <div className="form-actions">
            <button type="submit" disabled={loading || formData.areas_of_responsibility.length === 0}>
              {loading ? 'Saving...' : 'Continue to STSS Assessment →'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default Demographics