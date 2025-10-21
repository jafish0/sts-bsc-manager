import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'
import TeamCodeEntry from './pages/TeamCodeEntry'
import Demographics from './pages/Demographics'
import STSS from './pages/STSS'
import ProQOL from './pages/ProQOL'
import STSIOA from './pages/STSIOA'
import ctacLogo from './assets/UKCTAC_logoasuite_web__primary_tagline_color.png'
import ukLogo from './assets/UK_Lockup-286.png'

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
          background: 'linear-gradient(135deg, #00A79D 0%, #0E1F56 100%)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '2rem'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '3rem 2.5rem',
            maxWidth: '700px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{ marginBottom: '2rem' }}>
              <img 
                src={ctacLogo} 
                alt="Center on Trauma and Children" 
                style={{ maxWidth: '255px', width: '100%', height: 'auto' }}
              />
            </div>

            <h1 style={{ color: '#0E1F56', marginBottom: '1rem', fontSize: '2rem' }}>
              ✅ Assessment Complete!
            </h1>
            
            <p style={{ color: '#4b5563', fontSize: '1.125rem', lineHeight: '1.6', marginBottom: '2rem' }}>
              Thank you for completing the assessments. Your responses have been saved and will help 
              your organization better understand and support staff wellbeing.
            </p>

            <div style={{ 
              marginTop: '2.5rem',
              paddingTop: '2rem',
              borderTop: '2px solid #e5e7eb'
            }}>
              <img 
                src={ukLogo} 
                alt="University of Kentucky" 
                style={{ maxWidth: '250px', width: '100%', height: 'auto' }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App