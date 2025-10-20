import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'
import TeamCodeEntry from './pages/TeamCodeEntry'
import Demographics from './pages/Demographics'
import STSS from './pages/STSS'

function App() {
  const [teamCodeData, setTeamCodeData] = useState(null)
  const [assessmentResponseId, setAssessmentResponseId] = useState(null)
  const [currentStep, setCurrentStep] = useState('code') // 'code', 'demographics', 'stss', 'proqol', 'stsioa', 'complete'

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
    // TODO: Build ProQOL assessment next
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
        <div style={{ padding: '40px', textAlign: 'center' }}>
          <h1>✅ STSS Complete!</h1>
          <p>Next: ProQOL Assessment (we'll build this next!)</p>
        </div>
      )}
    </div>
  )
}

export default App