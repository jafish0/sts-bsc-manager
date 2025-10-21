import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'
import TeamCodeEntry from './pages/TeamCodeEntry'
import Demographics from './pages/Demographics'
import STSS from './pages/STSS'
import ProQOL from './pages/ProQOL'
import STSIOA from './pages/STSIOA'

function App() {
  const [teamCodeData, setTeamCodeData] = useState(null)
  const [assessmentResponseId, setAssessmentResponseId] = useState(null)
  const [currentStep, setCurrentStep] = useState('code') // 'code', 'demographics', 'stss', 'proqol', 'stsioa', 'complete'

  // Scroll to top whenever step changes
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [currentStep])

  const handleCodeValidated = async (codeData) => {
    console.log('Team code validated:', codeData)
    setTeamCodeData(codeData)

    // Create a new assessment_response record
    try {
      const { data, error } = await supabase
        .from('assessment_responses')
        .insert({
          team_code_id: codeData.id,
          timepoint: codeData.timepoint,
          is_complete: false,
          demographics_complete: false,
          stss_complete: false,
          proqol_complete: false,
          stsioa_complete: false
        })
        .select()
        .single()

      if (error) throw error

      console.log('Assessment response created:', data)
      setAssessmentResponseId(data.id)
      setCurrentStep('demographics')

    } catch (err) {
      console.error('Error creating assessment response:', err)
      alert('There was an error starting your assessment. Please try again.')
    }
  }

  const handleDemographicsComplete = () => {
    console.log('Demographics completed!')
    setCurrentStep('stss')
  }

  const handleSTSSComplete = () => {
    console.log('STSS completed!')
    setCurrentStep('proqol')
  }

  const handleProQOLComplete = () => {
    console.log('ProQOL completed!')
    setCurrentStep('stsioa')
  }

  const handleSTSIOAComplete = () => {
    console.log('STSI-OA completed!')
    setCurrentStep('complete')
  }

  return (
    <div className="App">
      {currentStep === 'code' && (
        <TeamCodeEntry onCodeValidated={handleCodeValidated} />
      )}

      {currentStep === 'demographics' && (
        <Demographics
          teamCodeData={teamCodeData}
          assessmentResponseId={assessmentResponseId}
          onComplete={handleDemographicsComplete}
        />
      )}

      {currentStep === 'stss' && (
        <STSS
          teamCodeData={teamCodeData}
          assessmentResponseId={assessmentResponseId}
          onComplete={handleSTSSComplete}
        />
      )}

      {currentStep === 'proqol' && (
        <ProQOL
          teamCodeData={teamCodeData}
          assessmentResponseId={assessmentResponseId}
          onComplete={handleProQOLComplete}
        />
      )}

      {currentStep === 'stsioa' && (
        <STSIOA
          teamCodeData={teamCodeData}
          assessmentResponseId={assessmentResponseId}
          onComplete={handleSTSIOAComplete}
        />
      )}

      {currentStep === 'complete' && (
        <div style={{ 
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '2rem'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '3rem',
            maxWidth: '600px',
            textAlign: 'center',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.1)'
          }}>
            <h1 style={{ color: '#1f2937', marginBottom: '1rem' }}>✅ Assessment Complete!</h1>
            <p style={{ color: '#4b5563', fontSize: '1.125rem', lineHeight: '1.6' }}>
              Thank you for completing the assessments. Your responses have been saved and will help 
              your organization better understand and support staff wellbeing.
            </p>
            <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: '1.5rem' }}>
              You may now close this window.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export default App