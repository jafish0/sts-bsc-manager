import { useState } from 'react'
import { supabase } from './utils/supabase'
import TeamCodeEntry from './pages/TeamCodeEntry'
import Demographics from './pages/Demographics'
import STSS from './pages/STSS'
import STSIOA from './pages/STSIOA'
import './App.css'

function App() {
  const [teamCodeData, setTeamCodeData] = useState(null)
  const [assessmentResponseId, setAssessmentResponseId] = useState(null)
  const [currentStep, setCurrentStep] = useState('code')

  const handleCodeValidated = async (codeData) => {
    console.log('Team code validated:', codeData)
    setTeamCodeData(codeData)

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

      {currentStep === 'stsioa' && (
        <STSIOA
          teamCodeData={teamCodeData}
          assessmentResponseId={assessmentResponseId}
          onComplete={handleSTSIOAComplete}
        />
      )}

      {currentStep === 'complete' && (
        <div className="completion-container">
          <div className="completion-card">
            <div className="completion-icon">✓</div>
            <h1>Assessment Complete!</h1>
            <p className="completion-message">
              Thank you for taking the time to complete this comprehensive assessment. 
              Your responses will help your organization better understand and address 
              Secondary Traumatic Stress in the workplace.
            </p>
            <div className="completion-details">
              <p>
                <strong>What happens next:</strong>
              </p>
              <ul>
                <li>Your responses have been securely saved</li>
                <li>Your organization's leadership team will review aggregated results</li>
                <li>You may be invited to participate in follow-up assessments to track progress over time</li>
              </ul>
            </div>
            <p className="completion-footer">
              Your commitment to this process demonstrates your organization's dedication 
              to creating a trauma-informed workplace that supports staff wellbeing.
            </p>
            <p className="completion-contact">
              Questions? Contact your organizational leadership or reach out to 
              <strong> sprang@uky.edu</strong>
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export default App